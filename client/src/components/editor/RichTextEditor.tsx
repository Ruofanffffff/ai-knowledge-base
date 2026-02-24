import React, {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useRef,
  useState,
  useEffect,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Image as ImageIcon,
  Loader2,
  Sparkles,
  CheckCircle,
  TableIcon,
  Network,
  Undo2,
  Redo2,
  Quote,
  Minus,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../ui/dialog';
import apiClient from '../../api/client';
import ImageBlockExtension from './ImageBlockExtension';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import { TextSelection } from '@tiptap/pm/state';
import { MindMapImage, buildMindMapSVG, computeMMPositions as computeMMPositionsShared } from './mindmap-svg-utils';

// ============================================================================
// Types
// ============================================================================

export interface RichTextEditorHandle {
  getJSON: () => object;
  setContent: (json: object) => void;
  getEditor: () => ReturnType<typeof useEditor>;
}

export interface RichTextEditorProps {
  content?: object;
  editable?: boolean;
  onChange?: (json: object) => void;
}

// ============================================================================
// Image upload helpers (module-level, no hooks dependency)
// ============================================================================

interface UploadResult {
  url: string;
  analysisId: string | null;
  analysisStatus: string;
}

async function uploadImageFile(file: File): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/images/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return {
    url: response.data.url,
    analysisId: response.data.analysisId ?? null,
    analysisStatus: response.data.analysisStatus ?? 'pending',
  };
}

async function uploadFromUrl(url: string): Promise<UploadResult | null> {
  // 策略：先尝试前端直接 fetch 图片（浏览器有正确的 Referer，不易被防盗链拦截），
  // 然后作为 File 上传到 /api/images/upload。
  // 如果前端 fetch 失败（CORS），再尝试后端代理。

  // 1. 前端直接 fetch
  try {
    const resp = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (resp.ok) {
      const blob = await resp.blob();
      if (blob.type.startsWith('image/') || blob.size > 0) {
        const ext = blob.type.split('/')[1]?.split(';')[0] || 'png';
        const file = new File([blob], `pasted-${Date.now()}.${ext}`, { type: blob.type || 'image/png' });
        return await uploadImageFile(file);
      }
    }
  } catch {
    // CORS or network error — fall through to backend proxy
    console.log('[uploadFromUrl] 前端 fetch 失败，尝试后端代理:', url.substring(0, 60));
  }

  // 2. 后端代理
  try {
    const response = await apiClient.post('/images/upload-from-url', { url });
    return {
      url: response.data.url,
      analysisId: response.data.analysisId ?? null,
      analysisStatus: response.data.analysisStatus ?? 'pending',
    };
  } catch (err) {
    console.error('[uploadFromUrl] 后端代理也失败:', url.substring(0, 60), err);
    return null;
  }
}

function dataUriToFile(dataUri: string): File | null {
  try {
    const [header, base64] = dataUri.split(',');
    if (!header || !base64) return null;
    const mimeMatch = header.match(/:(.*?);/);
    const mime = mimeMatch?.[1] || 'image/png';
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const ext = mime.split('/')[1] || 'png';
    return new File([bytes], `pasted-${Date.now()}.${ext}`, { type: mime });
  } catch {
    return null;
  }
}

// ============================================================================
// Toolbar button
// ============================================================================

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded hover:bg-slate-100 transition-colors ${
        isActive ? 'bg-slate-200 text-purple-600' : 'text-slate-600'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

// ============================================================================
// Process pasted HTML with images — extract, upload to MinIO, build nodes
// ============================================================================

async function processPastedHtmlWithImages(
  html: string,
  editorInstance: ReturnType<typeof useEditor>,
  clipboardFiles?: File[],
) {
  if (!editorInstance) return false;

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const imgs = doc.querySelectorAll('img[src]');
  console.log(`[processPastedHtml] 找到 ${imgs.length} 个 <img> 标签`);

  if (imgs.length === 0) {
    const text = doc.body.textContent?.trim();
    if (text && editorInstance) {
      editorInstance.chain().focus().insertContent(text).run();
    }
    return false;
  }

  imgs.forEach((img, i) => {
    console.log(`[processPastedHtml] img[${i}] src:`, img.getAttribute('src')?.substring(0, 100));
  });

  // 递归遍历 DOM 树，按顺序收集文本段落和图片
  // 这样无论 Word/网页的 HTML 嵌套多深，都能正确提取文字和图片
  const contentNodes: object[] = [];
  let currentTextParts: string[] = [];

  function flushText() {
    const text = currentTextParts.join('').trim();
    if (text) {
      contentNodes.push({ type: 'paragraph', content: [{ type: 'text', text }] });
    }
    currentTextParts = [];
  }

  // 块级标签 — 遇到这些标签时需要断段
  const blockTags = new Set([
    'P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'LI', 'UL', 'OL', 'BLOCKQUOTE', 'PRE', 'TABLE', 'TR',
    'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'FIGURE',
    'BR',
  ]);

  // 用于追踪 file:/// 图片，从 clipboardFiles 中按顺序取
  let fileImageIndex = 0;

  async function walkNode(node: Node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        currentTextParts.push(text);
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    const tag = el.tagName;

    // 跳过 style / script
    if (tag === 'STYLE' || tag === 'SCRIPT') return;

    // 遇到 <img> — flush 当前文字，插入图片节点
    if (tag === 'IMG') {
      flushText();
      let src = el.getAttribute('src') || '';
      if (!src) return;
      if (src.startsWith('//')) src = 'https:' + src;

      // 已经是我们的代理 URL，直接用
      if (src.includes('/api/images/proxy/')) {
        contentNodes.push({
          type: 'imageBlock',
          attrs: { src, alt: el.getAttribute('alt') || '', analysisId: null, analysisStatus: 'none' },
        });
        return;
      }

      let result: UploadResult | null = null;

      if (src.startsWith('data:')) {
        const file = dataUriToFile(src);
        if (file) {
          try { result = await uploadImageFile(file); } catch (err) {
            console.error('[processPastedHtml] data URI 图片上传失败:', err);
          }
        }
      } else if (src.startsWith('file:///') || src.startsWith('blob:')) {
        // Word 粘贴的本地图片 — 从剪贴板文件列表中按顺序取
        if (clipboardFiles && fileImageIndex < clipboardFiles.length) {
          const file = clipboardFiles[fileImageIndex++];
          console.log('[processPastedHtml] 使用剪贴板文件上传 Word 图片:', file.name, file.size);
          try { result = await uploadImageFile(file); } catch (err) {
            console.error('[processPastedHtml] Word 图片上传失败:', err);
          }
        } else {
          console.warn('[processPastedHtml] file:/// 图片无对应剪贴板文件，跳过');
        }
      } else if (src.startsWith('http://') || src.startsWith('https://')) {
        console.log('[processPastedHtml] 上传外部图片:', src.substring(0, 80));
        result = await uploadFromUrl(src);
        if (!result) {
          const proxyUrl = `/api/images/external-proxy?url=${encodeURIComponent(src)}`;
          contentNodes.push({
            type: 'imageBlock',
            attrs: { src: proxyUrl, alt: el.getAttribute('alt') || '', analysisId: null, analysisStatus: 'none' },
          });
          return;
        }
      }

      if (result) {
        contentNodes.push({
          type: 'imageBlock',
          attrs: {
            src: result.url,
            alt: el.getAttribute('alt') || '',
            analysisId: result.analysisId,
            analysisStatus: result.analysisStatus,
          },
        });
      }
      return;
    }

    // 遇到 <br> — 断段
    if (tag === 'BR') {
      flushText();
      return;
    }

    // 块级元素 — 先 flush，递归子节点，再 flush
    if (blockTags.has(tag)) {
      flushText();
      for (const child of Array.from(el.childNodes)) {
        await walkNode(child);
      }
      flushText();
      return;
    }

    // 行内元素（span, a, strong, em 等）— 直接递归子节点
    for (const child of Array.from(el.childNodes)) {
      await walkNode(child);
    }
  }

  // 遍历 body 的所有子节点
  for (const child of Array.from(doc.body.childNodes)) {
    await walkNode(child);
  }
  flushText(); // flush 最后残留的文字

  console.log(`[processPastedHtml] 准备插入 ${contentNodes.length} 个节点`);

  if (contentNodes.length > 0) {
    editorInstance.chain().focus().insertContent(contentNodes).run();
  }
  return true;
}

// ============================================================================
// AI Context Menu types & helpers
// ============================================================================

type AIActionType = 'generate' | 'proofread' | 'table' | 'mindmap';

// ============================================================================
// Mind map helpers — layout, SVG, data conversion
// ============================================================================

interface MMNode { id: string; label: string; type?: string }
interface MMLink { source: string; target: string }
interface MMData { nodes: MMNode[]; links: MMLink[] }

/** Convert API format {central_topic, nodes[{id,text,children}]} to flat {nodes, links} */
function mindmapApiToFlat(central_topic: string, apiNodes: Array<{id: string; text: string; children?: any[]}>): MMData {
  const flatNodes: MMNode[] = [];
  const links: MMLink[] = [];
  const rootId = '__root__';
  flatNodes.push({ id: rootId, label: central_topic, type: 'main' });

  function walk(items: Array<{id: string; text: string; children?: any[]}>, parentId: string) {
    items.forEach(item => {
      flatNodes.push({ id: item.id, label: item.text, type: parentId === rootId ? 'sub' : 'leaf' });
      links.push({ source: parentId, target: item.id });
      if (item.children?.length) walk(item.children, item.id);
    });
  }
  walk(apiNodes, rootId);
  return { nodes: flatNodes, links };
}

/** Convert flat {nodes, links} back to API format for tiptap insertion */
function flatToMindmapApi(data: MMData): { central_topic: string; nodes: Array<{id: string; text: string; children?: any[]}> } {
  const targetIds = new Set(data.links.map(l => l.target));
  const root = data.nodes.find(n => !targetIds.has(n.id)) || data.nodes[0];
  const childMap: Record<string, string[]> = {};
  data.links.forEach(l => {
    childMap[l.source] = [...(childMap[l.source] || []), l.target];
  });
  const nodeMap = Object.fromEntries(data.nodes.map(n => [n.id, n]));

  function buildTree(parentId: string): Array<{id: string; text: string; children?: any[]}> {
    const childIds = childMap[parentId] || [];
    return childIds.map(cid => {
      const node = nodeMap[cid];
      if (!node) return { id: cid, text: '?' };
      const children = buildTree(cid);
      return children.length > 0
        ? { id: node.id, text: node.label, children }
        : { id: node.id, text: node.label };
    });
  }

  return {
    central_topic: root?.label || '',
    nodes: buildTree(root?.id || ''),
  };
}

/** Radial tree layout */
function computeMMPositions(nodes: MMNode[], links: MMLink[]): Record<string, { x: number; y: number }> {
  if (!nodes.length) return {};
  const pos: Record<string, { x: number; y: number }> = {};
  const targetIds = new Set(links.map(l => l.target));
  const root = nodes.find(n => !targetIds.has(n.id)) || nodes[0];
  pos[root.id] = { x: 0, y: 0 };
  const childMap: Record<string, string[]> = {};
  links.forEach(l => {
    childMap[l.source] = [...(childMap[l.source] || []), l.target];
  });
  const layout = (id: string, a0: number, a1: number, r: number) => {
    const ch = childMap[id] || [];
    if (!ch.length) return;
    ch.forEach((cid, i) => {
      const a = a0 + (a1 - a0) * (i + 0.5) / ch.length;
      pos[cid] = { x: Math.round(Math.cos(a) * r), y: Math.round(Math.sin(a) * r) };
      const span = (a1 - a0) / Math.max(ch.length, 1);
      layout(cid, a - span * 0.72, a + span * 0.72, r + 130);
    });
  };
  layout(root.id, -Math.PI, Math.PI, 155);
  return pos;
}

const mmTrunc = (s: string, n: number) => (s.length > n ? s.slice(0, n) + '…' : s);

// ============================================================================
// RichTextEditor component
// ============================================================================

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ content, editable = true, onChange }, ref) => {
    const imageInputRef = useRef<HTMLInputElement>(null);
    // Ref to hold the editor instance for use inside editorProps callbacks
    const editorRef = useRef<ReturnType<typeof useEditor>>(null) as React.MutableRefObject<ReturnType<typeof useEditor>>;

    // AI Context Menu state
    const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; isLoading: boolean; loadingAction: string | null } | null>(null);
    const [selectedText, setSelectedText] = useState('');
    const selectionRef = useRef<{ from: number; to: number } | null>(null);
    const lastSelectionRef = useRef<{ from: number; to: number; text: string } | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    // Dialog state
    const [showProofread, setShowProofread] = useState(false);
    const [proofreadData, setProofreadData] = useState<{ original: string; corrected: string } | null>(null);
    const [showTable, setShowTable] = useState(false);
    const [tableData, setTableData] = useState<{ headers: string[]; rows: string[][] } | null>(null);

    // Mind map Dialog state
    const [showMindMap, setShowMindMap] = useState(false);
    const [mindMapData, setMindMapData] = useState<MMData | null>(null);
    const [mmSelectedId, setMmSelectedId] = useState<string | null>(null);
    const [mmEditingId, setMmEditingId] = useState<string | null>(null);
    const [mmEditLabel, setMmEditLabel] = useState('');
    const [mmNewLabel, setMmNewLabel] = useState('');
    const mmNewLabelRef = useRef<HTMLInputElement>(null);
    const [mindmapUpdateTarget, setMindmapUpdateTarget] = useState<number | null>(null);

    const editor = useEditor({
      extensions: [StarterKit, ImageBlockExtension, MindMapImage, Table.configure({ resizable: false }), TableRow, TableHeader, TableCell],
      content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
      editable,
      onUpdate: ({ editor: ed }) => {
        onChange?.(ed.getJSON());
      },
      editorProps: {
        attributes: {
          class: 'bb-editor outline-none',
        },
        // ---------------------------------------------------------------
        // handlePaste — runs BEFORE ProseMirror's default paste handling.
        // Return true to prevent default, false to let ProseMirror handle.
        // ---------------------------------------------------------------
        handlePaste: (_view, event) => {
          const clipboardItems = event.clipboardData?.items;
          const html = event.clipboardData?.getData('text/html');

          // 优先检查 HTML：当剪贴板同时包含 text/html 和 image/* 时
          // （Word/网页复制），HTML 包含完整的文字+图片，应优先处理 HTML。
          // 只有纯截图粘贴（没有 HTML）才走直接图片上传分支。

          // 1. Rich text with <img> tags
          if (html) {
            const lowerHtml = html.toLowerCase();
            if (lowerHtml.includes('<img')) {
              console.log('[RichTextEditor] 检测到粘贴 HTML 含 <img> 标签，开始处理...');
              // 提取剪贴板中的图片文件（Word 粘贴时图片以 file 形式存在）
              const imageFiles: File[] = [];
              if (clipboardItems) {
                for (const item of Array.from(clipboardItems)) {
                  if (item.type.startsWith('image/')) {
                    const f = item.getAsFile();
                    if (f) imageFiles.push(f);
                  }
                }
              }
              processPastedHtmlWithImages(html, editorRef.current!, imageFiles).catch((err) =>
                console.error('粘贴图片处理失败:', err),
              );
              return true; // prevent default
            }
            // HTML 不含 <img>，交给 ProseMirror 默认处理
          }

          // 2. Direct image paste (screenshot — no HTML in clipboard)
          if (clipboardItems) {
            for (const item of Array.from(clipboardItems)) {
              if (item.type.startsWith('image/')) {
                const file = item.getAsFile();
                if (file && editorRef.current) {
                  uploadImageFile(file).then((result) => {
                    editorRef.current
                      ?.chain()
                      .focus()
                      .insertContent({
                        type: 'imageBlock',
                        attrs: {
                          src: result.url,
                          alt: '',
                          analysisId: result.analysisId,
                          analysisStatus: result.analysisStatus,
                        },
                      })
                      .run();
                  }).catch((err) => console.error('图片上传失败:', err));
                }
                return true; // prevent default
              }
            }
          }

          return false; // let ProseMirror handle normal text paste
        },

        // ---------------------------------------------------------------
        // handleDrop — intercept dropped image files
        // ---------------------------------------------------------------
        handleDrop: (_view, event) => {
          const files = event.dataTransfer?.files;
          if (!files || files.length === 0) return false;

          for (const file of Array.from(files)) {
            if (file.type.startsWith('image/')) {
              event.preventDefault();
              if (editorRef.current) {
                uploadImageFile(file).then((result) => {
                  editorRef.current
                    ?.chain()
                    .focus()
                    .insertContent({
                      type: 'imageBlock',
                      attrs: {
                        src: result.url,
                        alt: '',
                        analysisId: result.analysisId,
                        analysisStatus: result.analysisStatus,
                      },
                    })
                    .run();
                }).catch((err) => console.error('图片上传失败:', err));
              }
              return true;
            }
          }
          return false;
        },
      },
    });

    // Keep editorRef in sync
    editorRef.current = editor;

    // Track selection changes for right-click fallback
    useEffect(() => {
      if (!editor) return;
      const handleSelectionUpdate = () => {
        const { from, to, empty } = editor.state.selection;
        if (!empty) {
          const text = editor.state.doc.textBetween(from, to, ' ');
          if (text.trim()) {
            lastSelectionRef.current = { from, to, text: text.trim() };
          }
        }
      };
      editor.on('selectionUpdate', handleSelectionUpdate);
      return () => { editor.off('selectionUpdate', handleSelectionUpdate); };
    }, [editor]);

    // AI Context Menu: right-click handler
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
      if (!editor) return;
      const { from, to, empty } = editor.state.selection;
      let selFrom: number, selTo: number, text: string;
      if (!empty) {
        text = editor.state.doc.textBetween(from, to, ' ');
        selFrom = from;
        selTo = to;
      } else if (lastSelectionRef.current) {
        selFrom = lastSelectionRef.current.from;
        selTo = lastSelectionRef.current.to;
        text = lastSelectionRef.current.text;
      } else {
        return;
      }
      if (!text.trim()) return;
      e.preventDefault();
      setSelectedText(text.trim());
      selectionRef.current = { from: selFrom, to: selTo };
      setCtxMenu({ x: e.clientX, y: e.clientY, isLoading: false, loadingAction: null });
    }, [editor]);

    // AI Context Menu: action handler
    const handleMenuAction = useCallback((action: AIActionType, text: string) => {
      const actionLabels: Record<AIActionType, string> = {
        generate: '智能生成', proofread: '智能校对', table: '生成表格', mindmap: '生成脑图',
      };
      setCtxMenu(prev => prev ? { ...prev, isLoading: true, loadingAction: actionLabels[action] } : prev);

      if (action === 'generate') {
        const sel = selectionRef.current;
        if (!editor || !sel) {
          setCtxMenu(null);
          lastSelectionRef.current = null;
          return;
        }
        (async () => {
          try {
            const response = await apiClient.post('/ai/generate', { text });
            const { expandedText, imagePrompt } = response.data.data;

            editor.chain().focus()
              .insertContentAt({ from: sel.from, to: sel.to }, expandedText)
              .run();

            toast.success('智能生成完成');

            if (imagePrompt && imagePrompt.trim()) {
              toast.info(imagePrompt, {
                duration: 8000,
                description: '点击复制图片描述',
                action: {
                  label: '复制',
                  onClick: async () => {
                    try {
                      await navigator.clipboard.writeText(imagePrompt);
                      toast.success('已复制图片描述');
                    } catch {
                      toast.error('复制失败，请手动复制');
                    }
                  },
                },
              });
            }
          } catch {
            toast.error('智能生成失败，请稍后重试');
          } finally {
            setCtxMenu(null);
            lastSelectionRef.current = null;
          }
        })();
        return;
      }

      if (action === 'proofread') {
        const sel = selectionRef.current;
        if (!editor || !sel) {
          setCtxMenu(null);
          lastSelectionRef.current = null;
          return;
        }
        (async () => {
          try {
            const response = await apiClient.post('/ai/proofread', { text });
            const { correctedText } = response.data.data;

            setProofreadData({ original: text, corrected: correctedText });
            setShowProofread(true);
            toast.success('智能校对完成', { description: '请查看校对建议' });
          } catch {
            toast.error('智能校对失败，请稍后重试');
          } finally {
            setCtxMenu(null);
            lastSelectionRef.current = null;
          }
        })();
        return;
      }

      if (action === 'table') {
        const sel = selectionRef.current;
        if (!editor || !sel) {
          setCtxMenu(null);
          lastSelectionRef.current = null;
          return;
        }
        (async () => {
          try {
            const response = await apiClient.post('/ai/generate-table', { text });
            const { table } = response.data.data;

            setTableData({ headers: table.headers, rows: table.rows });
            setShowTable(true);
            toast.success('表格生成完成', { description: `已生成 ${table.rows.length} 行数据` });
          } catch {
            toast.error('表格生成失败，请稍后重试');
          } finally {
            setCtxMenu(null);
            lastSelectionRef.current = null;
          }
        })();
        return;
      }

      if (action === 'mindmap') {
        (async () => {
          try {
            const response = await apiClient.post('/ai/generate-mindmap', { text });
            const { central_topic, nodes } = response.data.data.mindmap;
            const flat = mindmapApiToFlat(central_topic, nodes);
            setMindMapData(flat);
            setMmSelectedId(null);
            setMmEditingId(null);
            setMmNewLabel('');
            setShowMindMap(true);
            toast.success('脑图生成完成', { description: '请预览并编辑后插入文档' });
          } catch {
            toast.error('生成脑图失败，请稍后重试');
          } finally {
            setCtxMenu(null);
            lastSelectionRef.current = null;
          }
        })();
        return;
      }
    }, [editor]);

    // ── Mind map CRUD ─────────────────────────────────────────────────────
    const mmRootId = mindMapData
      ? (mindMapData.nodes.find(n => !mindMapData.links.some(l => l.target === n.id))?.id ?? mindMapData.nodes[0]?.id)
      : undefined;

    const mmPositions = mindMapData ? computeMMPositions(mindMapData.nodes, mindMapData.links) : {};
    const mmSelectedNode = mindMapData?.nodes.find(n => n.id === mmSelectedId) ?? null;
    const posVals = Object.values(mmPositions);
    const mmMinX = posVals.length ? Math.min(...posVals.map(p => p.x)) : -150;
    const mmMinY = posVals.length ? Math.min(...posVals.map(p => p.y)) : -150;
    const mmMaxX = posVals.length ? Math.max(...posVals.map(p => p.x)) : 150;
    const mmMaxY = posVals.length ? Math.max(...posVals.map(p => p.y)) : 150;
    const mmW = Math.max(mmMaxX - mmMinX, 300);
    const mmH = Math.max(mmMaxY - mmMinY, 200);
    const mmViewBox = `${mmMinX - 90} ${mmMinY - 70} ${mmW + 180} ${mmH + 140}`;

    const mmAddNode = useCallback(() => {
      if (!mindMapData) return;
      const parentId = mmSelectedId ?? mmRootId;
      if (!parentId) return;
      const newId = `n${Date.now()}`;
      const label = mmNewLabel.trim() || '新节点';
      setMindMapData(prev => prev ? ({
        nodes: [...prev.nodes, { id: newId, label, type: 'sub' }],
        links: [...prev.links, { source: parentId, target: newId }],
      }) : prev);
      setMmNewLabel('');
      setMmSelectedId(newId);
      setTimeout(() => mmNewLabelRef.current?.focus(), 50);
    }, [mindMapData, mmSelectedId, mmRootId, mmNewLabel]);

    const mmDeleteNode = useCallback((id: string) => {
      if (!mindMapData || id === mmRootId) return;
      const dead = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        mindMapData.links.forEach(l => {
          if (dead.has(l.source) && !dead.has(l.target)) { dead.add(l.target); changed = true; }
        });
      }
      setMindMapData({
        nodes: mindMapData.nodes.filter(n => !dead.has(n.id)),
        links: mindMapData.links.filter(l => !dead.has(l.source) && !dead.has(l.target)),
      });
      if (mmSelectedId && dead.has(mmSelectedId)) setMmSelectedId(null);
      if (mmEditingId && dead.has(mmEditingId)) setMmEditingId(null);
      toast.success('节点已删除');
    }, [mindMapData, mmRootId, mmSelectedId, mmEditingId]);

    const mmStartEdit = useCallback((node: MMNode) => {
      setMmEditingId(node.id);
      setMmEditLabel(node.label);
    }, []);

    const mmSaveEdit = useCallback(() => {
      if (!mindMapData || !mmEditingId) return;
      const label = mmEditLabel.trim();
      if (!label) return;
      setMindMapData(prev => prev ? ({
        ...prev,
        nodes: prev.nodes.map(n => n.id === mmEditingId ? { ...n, label } : n),
      }) : prev);
      setMmEditingId(null);
      toast.success('标签已更新');
    }, [mindMapData, mmEditingId, mmEditLabel]);

    const insertMindMapToDocument = useCallback(() => {
      if (!mindMapData || !editor) return;

      // Determine root node (not targeted by any link)
      const targetIds = new Set(mindMapData.links.map(l => l.target));
      const rootNode = mindMapData.nodes.find(n => !targetIds.has(n.id)) || mindMapData.nodes[0];

      // Compute positions and build SVG
      const positions = computeMMPositionsShared(mindMapData.nodes, mindMapData.links, rootNode.id);
      const svgStr = buildMindMapSVG(mindMapData.nodes, mindMapData.links, positions);

      // Convert SVG to base64 data URL
      const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));

      // Serialize mindmap data for re-editing
      const mindmapJson = JSON.stringify({ nodes: mindMapData.nodes, links: mindMapData.links });

      if (mindmapUpdateTarget !== null) {
        // Update mode: replace existing mindMapImage node in-place
        editor.chain().focus()
          .setNodeSelection(mindmapUpdateTarget)
          .deleteSelection()
          .insertContent({
            type: 'mindMapImage',
            attrs: {
              src: dataUrl,
              'data-mindmap': mindmapJson,
              title: '双击编辑思维导图',
            },
          })
          .run();
      } else {
        // Insert mode: add new mindMapImage node after current block
        editor.chain().focus()
          .command(({ tr, dispatch }) => {
            if (dispatch) {
              // Position cursor at end of document for safe insertion
              const endPos = tr.doc.content.size;
              tr.setSelection(TextSelection.create(tr.doc, endPos));
            }
            return true;
          })
          .insertContent({
            type: 'mindMapImage',
            attrs: {
              src: dataUrl,
              'data-mindmap': mindmapJson,
              title: '双击编辑思维导图',
            },
          })
          .run();
      }

      setShowMindMap(false);
      setMindmapUpdateTarget(null);
      toast.success('思维导图已插入文档');
    }, [mindMapData, editor, mindmapUpdateTarget]);

    // Double-click handler for re-editing inserted mindmaps
    const handleEditorDoubleClick = useCallback((event: React.MouseEvent) => {
      if (!editor) return;
      const target = event.target as HTMLElement;
      const img = target.closest('img[data-mindmap]') || (target.tagName === 'IMG' && target.getAttribute('data-mindmap') ? target : null);
      if (!img) return;
      const data = img.getAttribute('data-mindmap');
      if (!data) return;
      try {
        const parsed = JSON.parse(data);
        setMindMapData({ nodes: parsed.nodes || [], links: parsed.links || [] });
        // Find the position of this node in the editor
        const { state } = editor;
        let pos: number | null = null;
        state.doc.descendants((node, nodePos) => {
          if (node.type.name === 'mindMapImage' && node.attrs['data-mindmap'] === data) {
            pos = nodePos;
            return false;
          }
        });
        setMindmapUpdateTarget(pos);
        setMmSelectedId(null);
        setMmEditingId(null);
        setShowMindMap(true);
      } catch {
        toast.error('思维导图数据损坏，无法打开编辑');
      }
    }, [editor]);

    // AI Context Menu: click-outside to dismiss
    useEffect(() => {
      const handleClickOutside = (e: MouseEvent) => {
        if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
          setCtxMenu(null);
        }
      };
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Expose getJSON / setContent to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        getJSON: () => editor?.getJSON() ?? { type: 'doc', content: [] },
        setContent: (json: object) => {
          editor?.commands.setContent(json);
        },
        getEditor: () => editor,
      }),
      [editor],
    );

    // ------------------------------------------------------------------
    // Toolbar: open file picker
    // ------------------------------------------------------------------
    const handleImageButtonClick = useCallback(() => {
      imageInputRef.current?.click();
    }, []);

    const handleFileChange = useCallback(
      async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
          try {
            const result = await uploadImageFile(file);
            if (editor) {
              editor.chain().focus().insertContent({
                type: 'imageBlock',
                attrs: {
                  src: result.url,
                  alt: '',
                  analysisId: result.analysisId,
                  analysisStatus: result.analysisStatus,
                },
              }).run();
            }
          } catch (err) {
            console.error('图片上传失败:', err);
          }
        }
        if (imageInputRef.current) imageInputRef.current.value = '';
      },
      [editor],
    );

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------
    if (!editor) return null;

    return (
      <>
        <div>
        {/* Toolbar */}
        {editable && (
          <div className="px-12 py-2 border-b border-slate-100 flex items-center gap-0.5 sticky top-0 bg-white z-10">
            <ToolbarButton
              onClick={() => editor.chain().focus().undo().run()}
              title="撤销"
            >
              <Undo2 size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().redo().run()}
              title="重做"
            >
              <Redo2 size={16} />
            </ToolbarButton>

            <div className="w-px h-4 bg-slate-200 mx-1.5" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              isActive={editor.isActive('heading', { level: 1 })}
              title="标题1"
            >
              <span className="text-xs font-bold">H1</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              isActive={editor.isActive('heading', { level: 2 })}
              title="标题2"
            >
              <span className="text-xs font-bold">H2</span>
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              isActive={editor.isActive('heading', { level: 3 })}
              title="标题3"
            >
              <span className="text-xs font-bold">H3</span>
            </ToolbarButton>

            <div className="w-px h-4 bg-slate-200 mx-1.5" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              title="粗体"
            >
              <Bold size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              title="斜体"
            >
              <Italic size={16} />
            </ToolbarButton>

            <div className="w-px h-4 bg-slate-200 mx-1.5" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              title="无序列表"
            >
              <List size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              title="有序列表"
            >
              <ListOrdered size={16} />
            </ToolbarButton>

            <div className="w-px h-4 bg-slate-200 mx-1.5" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              isActive={editor.isActive('blockquote')}
              title="引用"
            >
              <Quote size={16} />
            </ToolbarButton>
            <ToolbarButton
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              title="分割线"
            >
              <Minus size={16} />
            </ToolbarButton>

            <div className="w-px h-4 bg-slate-200 mx-1.5" />

            <ToolbarButton onClick={handleImageButtonClick} title="插入图片">
              <ImageIcon size={16} />
            </ToolbarButton>

            <input
              type="file"
              ref={imageInputRef}
              onChange={handleFileChange}
              className="hidden"
              accept="image/*"
            />
          </div>
        )}

        {/* Editor area — click anywhere to type, like Word */}
        <div
          className="px-12 py-8 bg-white cursor-text"
          onClick={(e) => { if (!(e.target as HTMLElement).closest('.ProseMirror')) editor?.chain().focus().run(); }}
          onContextMenu={handleContextMenu}
          onDoubleClick={handleEditorDoubleClick}
        >
          <style>{`
            .ProseMirror { min-height: 60vh; outline: none; }
            .ProseMirror p.is-editor-empty:first-child::before {
              content: '开始输入内容...';
              color: #cbd5e1;
              float: left;
              height: 0;
              pointer-events: none;
            }
            .ProseMirror h1 { font-size: 2em !important; font-weight: 800 !important; margin: 0.67em 0; color: #1e293b; }
            .ProseMirror h2 { font-size: 1.5em !important; font-weight: 700 !important; margin: 0.83em 0; color: #1e293b; }
            .ProseMirror h3 { font-size: 1.17em !important; font-weight: 600 !important; margin: 1em 0; color: #334155; }
            .ProseMirror p { margin: 0.5em 0; line-height: 1.8; }
            .ProseMirror ul { list-style: disc; padding-left: 1.5em; margin: 0.5em 0; }
            .ProseMirror ol { list-style: decimal; padding-left: 1.5em; margin: 0.5em 0; }
            .ProseMirror ul ul { list-style: circle; }
            .ProseMirror ul ul ul { list-style: square; }
            .ProseMirror li { margin: 0.25em 0; }
            .ProseMirror li p { margin: 0; }
            .ProseMirror blockquote {
              border-left: 3px solid #c4b5fd;
              padding-left: 1em;
              margin: 0.75em 0;
              color: #64748b;
              font-style: italic;
            }
            .ProseMirror hr {
              border: none;
              border-top: 2px solid #e2e8f0;
              margin: 1.5em 0;
            }
            .ProseMirror table { border-collapse: collapse; width: 100%; margin: 1em 0; }
            .ProseMirror th { border: 1px solid #d1d5db; padding: 0.5rem 0.75rem; background-color: #f3e8ff; font-weight: bold; text-align: left; }
            .ProseMirror td { border: 1px solid #d1d5db; padding: 0.5rem 0.75rem; }
            .ProseMirror tr:hover td { background-color: #faf5ff; }
          `}</style>
          <EditorContent
            editor={editor}
            className="prose prose-slate max-w-none text-lg leading-relaxed font-serif"
          />
        </div>
        </div>

        {/* AI Context Menu */}
        <AnimatePresence>
          {ctxMenu && (
            <motion.div
              ref={menuRef}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, zIndex: 50 }}
              className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl border border-slate-200/80 py-1.5 min-w-[180px]"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {ctxMenu.isLoading ? (
                <div className="flex items-center gap-2 px-4 py-3 text-sm text-purple-600">
                  <Loader2 size={16} className="animate-spin" />
                  <span>{ctxMenu.loadingAction || '处理中'}...</span>
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                </div>
              ) : (
                ([
                  { action: 'generate' as AIActionType, label: '智能生成', icon: <Sparkles size={16} /> },
                  { action: 'proofread' as AIActionType, label: '智能校对', icon: <CheckCircle size={16} /> },
                  { action: 'table' as AIActionType, label: '生成表格', icon: <TableIcon size={16} /> },
                  { action: 'mindmap' as AIActionType, label: '生成脑图', icon: <Network size={16} /> },
                ]).map((item) => (
                  <button
                    key={item.action}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-gradient-to-r hover:from-purple-50 hover:to-violet-50 hover:text-purple-700 transition-colors"
                    onClick={() => handleMenuAction(item.action, selectedText)}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Proofreading Dialog */}
        <Dialog open={showProofread} onOpenChange={setShowProofread}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>智能校对</DialogTitle>
              <DialogDescription>AI 已分析您选中的文本，以下是校对建议。</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2">原文</h4>
                <div className="p-3 bg-red-50 rounded-lg text-sm text-slate-700 min-h-[100px]">
                  {proofreadData?.original}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-1">
                  <Sparkles size={14} className="text-purple-500" /> 建议修改
                </h4>
                <div className="p-3 bg-green-50 rounded-lg text-sm text-purple-700 min-h-[100px]">
                  {proofreadData?.corrected}
                  <span className="ml-1 w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse inline-block" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <button className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50" onClick={() => setShowProofread(false)}>
                忽略
              </button>
              <button className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700" onClick={() => {
                if (editor && proofreadData && selectionRef.current) {
                  const { from, to } = selectionRef.current;
                  editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, proofreadData.corrected).run();
                }
                setShowProofread(false);
              }}>
                采纳建议
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Table Dialog */}
        <Dialog open={showTable} onOpenChange={setShowTable}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>生成表格</DialogTitle>
              <DialogDescription>基于选中文本生成的结构化表格。</DialogDescription>
            </DialogHeader>
            {tableData && (
              <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-purple-500 to-violet-500 text-white">
                      {tableData.headers.map((h, i) => (
                        <th key={i} className="px-4 py-2.5 text-left text-sm font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        {row.map((cell, j) => (
                          <td key={j} className="px-4 py-2 text-sm text-slate-700">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <DialogFooter>
              <button className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50" onClick={() => setShowTable(false)}>
                取消
              </button>
              <button className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700" onClick={() => {
                const ed = editorRef.current ?? editor;
                if (ed && tableData) {
                  if (tableData.headers.length === 0) {
                    toast.error('表格数据为空，无法插入');
                    setShowTable(false);
                    return;
                  }
                  // Build JSON content with proper paragraph wrapping for block+ content spec
                  const headerRow = {
                    type: 'tableRow',
                    content: tableData.headers.map(h => ({
                      type: 'tableHeader',
                      content: [{ type: 'paragraph', content: h ? [{ type: 'text', text: h }] : [] }],
                    })),
                  };
                  const bodyRows = tableData.rows.map(row => ({
                    type: 'tableRow',
                    content: row.map(cell => ({
                      type: 'tableCell',
                      content: [{ type: 'paragraph', content: cell ? [{ type: 'text', text: cell }] : [] }],
                    })),
                  }));
                  const tableNode = {
                    type: 'table',
                    content: [headerRow, ...bodyRows],
                  };

                  const savedSelection = selectionRef.current ? { ...selectionRef.current } : null;
                  setShowTable(false);
                  requestAnimationFrame(() => {
                    setTimeout(() => {
                      try {
                        const currentEditor = editorRef.current;
                        if (!currentEditor) {
                          toast.error('插入表格失败：编辑器不可用');
                          return;
                        }
                        if (savedSelection) {
                          currentEditor.chain().focus().deleteRange(savedSelection).insertContentAt(savedSelection.from, tableNode).run();
                        } else {
                          currentEditor.chain().focus('end').insertContent(tableNode).run();
                        }
                        toast.success('已插入表格');
                      } catch (err) {
                        console.error('[insertTable] 插入表格失败:', err);
                        toast.error('插入表格失败');
                      }
                    }, 150);
                  });
                } else {
                  toast.error('插入失败：编辑器或表格数据不可用');
                  setShowTable(false);
                }
              }}>
                插入文档
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Mind Map Dialog */}
        <Dialog
          open={showMindMap}
          onOpenChange={open => {
            setShowMindMap(open);
            if (!open) { setMmSelectedId(null); setMmEditingId(null); setMmNewLabel(''); setMindmapUpdateTarget(null); }
          }}
        >
          <DialogContent className="sm:max-w-5xl flex flex-col" style={{ height: '80vh' }}>
            <DialogHeader className="shrink-0">
              <DialogTitle className="flex items-center gap-2">
                <Network size={17} className="text-purple-600" /> 思维导图
              </DialogTitle>
              <DialogDescription>点击节点选中 · 侧边栏可增删改节点 · 编辑完成后点击「插入文档」</DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 flex-1 overflow-hidden min-h-0">
              {/* Interactive SVG */}
              <div className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden flex items-center justify-center relative">
                <svg
                  viewBox={mmViewBox}
                  className="w-full h-full"
                  onClick={e => { if (e.target === e.currentTarget) setMmSelectedId(null); }}
                >
                  <defs>
                    <filter id="mm-glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge><feMergeNode in="coloredBlur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <radialGradient id="mm-root-grad" cx="38%" cy="38%">
                      <stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#7c3aed" />
                    </radialGradient>
                    <radialGradient id="mm-root-grad-sel" cx="38%" cy="38%">
                      <stop offset="0%" stopColor="#c4b5fd" /><stop offset="100%" stopColor="#8b5cf6" />
                    </radialGradient>
                  </defs>
                  {/* Links */}
                  {mindMapData?.links.map((link, i) => {
                    const s = mmPositions[link.source];
                    const t = mmPositions[link.target];
                    if (!s || !t) return null;
                    const dx = (t.x - s.x) * 0.45;
                    return (
                      <path key={i} d={`M ${s.x} ${s.y} C ${s.x + dx} ${s.y}, ${t.x - dx} ${t.y}, ${t.x} ${t.y}`}
                        stroke="#ddd6fe" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.9" />
                    );
                  })}
                  {/* Nodes */}
                  {mindMapData?.nodes.map(node => {
                    const pos = mmPositions[node.id];
                    if (!pos) return null;
                    const isRoot = node.id === mmRootId;
                    const isSel = node.id === mmSelectedId;
                    return (
                      <g key={node.id} transform={`translate(${pos.x}, ${pos.y})`}
                        onClick={e => { e.stopPropagation(); setMmSelectedId(isSel ? null : node.id); setMmEditingId(null); }}
                        style={{ cursor: 'pointer' }}>
                        {isRoot ? (
                          <>
                            {isSel && <circle r={48} fill="none" stroke="#c4b5fd" strokeWidth="2.5" strokeDasharray="5 3" opacity="0.8" />}
                            <circle r={42} fill={isSel ? 'url(#mm-root-grad-sel)' : 'url(#mm-root-grad)'}
                              filter={isSel ? 'url(#mm-glow)' : undefined} />
                            <text textAnchor="middle" dy=".35em" fontSize={11} fill="white" fontWeight="700">
                              {mmTrunc(node.label, 7)}
                            </text>
                          </>
                        ) : (
                          <>
                            {isSel && <rect x={-59} y={-22} width={118} height={44} rx={13}
                              fill="none" stroke="#a78bfa" strokeWidth="2" strokeDasharray="4 2" opacity="0.8" />}
                            <rect x={-55} y={-18} width={110} height={36} rx={10}
                              fill={isSel ? '#faf5ff' : 'white'} stroke={isSel ? '#8b5cf6' : '#e2e8f0'}
                              strokeWidth={isSel ? 2 : 1.5} filter={isSel ? 'url(#mm-glow)' : undefined} />
                            <text textAnchor="middle" dy=".35em" fontSize={10.5}
                              fill={isSel ? '#6d28d9' : '#475569'} fontWeight={isSel ? '700' : '500'}>
                              {mmTrunc(node.label, 9)}
                            </text>
                          </>
                        )}
                        <title>{node.label}</title>
                      </g>
                    );
                  })}
                </svg>
                {(!mindMapData || mindMapData.nodes.length === 0) && (
                  <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">暂无节点</div>
                )}
              </div>
              {/* Edit Panel */}
              <div className="w-56 shrink-0 flex flex-col gap-3 overflow-y-auto">
                {/* Add node */}
                <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2.5">
                  <div className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Plus size={12} /> 添加节点
                  </div>
                  <input
                    ref={mmNewLabelRef}
                    value={mmNewLabel}
                    onChange={e => setMmNewLabel(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && mmAddNode()}
                    placeholder="节点名称…"
                    className="w-full text-sm px-3 py-2 rounded-lg border border-slate-200 focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all placeholder:text-slate-300"
                  />
                  <button onClick={mmAddNode}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 text-white text-xs font-semibold hover:from-purple-700 hover:to-violet-700 transition-all shadow-sm">
                    <Plus size={13} />
                    {mmSelectedId ? '添加子节点' : '添加一级节点'}
                  </button>
                  {mmSelectedId && mmSelectedNode && (
                    <p className="text-[10px] text-slate-400 text-center leading-relaxed">
                      将作为「{mmTrunc(mmSelectedNode.label, 8)}」的子节点
                    </p>
                  )}
                </div>
                {/* Selected node edit */}
                <AnimatePresence>
                  {mmSelectedNode && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                      className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-2.5">
                      <div className="text-xs font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1.5">
                        <Pencil size={12} /> 编辑节点
                      </div>
                      <div className="flex items-center gap-1.5 bg-white/80 rounded-lg px-2.5 py-1.5 border border-purple-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                        <span className="text-xs text-slate-700 font-medium truncate">{mmSelectedNode.label}</span>
                      </div>
                      {mmEditingId === mmSelectedId ? (
                        <div className="space-y-2">
                          <input autoFocus value={mmEditLabel}
                            onChange={e => setMmEditLabel(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') mmSaveEdit(); if (e.key === 'Escape') setMmEditingId(null); }}
                            className="w-full text-sm px-3 py-2 rounded-lg border border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-200 bg-white transition-all"
                          />
                          <div className="flex gap-1.5">
                            <button onClick={mmSaveEdit}
                              className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-purple-600 text-white text-xs font-semibold hover:bg-purple-700 transition-colors">
                              <Check size={12} /> 保存
                            </button>
                            <button onClick={() => setMmEditingId(null)}
                              className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition-colors">
                              <X size={12} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <button onClick={() => mmStartEdit(mmSelectedNode)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white hover:bg-purple-100 border border-purple-100 text-purple-700 text-xs font-semibold transition-all">
                            <Pencil size={12} /> 修改标签
                          </button>
                          <button onClick={() => mmDeleteNode(mmSelectedId!)} disabled={mmSelectedId === mmRootId}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white hover:bg-red-50 border border-red-100 text-red-500 text-xs font-semibold transition-all disabled:opacity-35 disabled:cursor-not-allowed">
                            <Trash2 size={12} />
                            {mmSelectedId === mmRootId ? '根节点不可删' : '删除节点及子节点'}
                          </button>
                          <button onClick={() => setMmSelectedId(null)}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-slate-600 text-xs transition-colors">
                            <X size={11} /> 取消选中
                          </button>
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
                {!mmSelectedNode && (
                  <div className="text-[11px] text-slate-400 text-center px-3 py-4 border border-dashed border-slate-200 rounded-2xl leading-relaxed">
                    点击导图中的节点<br />进行编辑或删除
                  </div>
                )}
                <div className="text-[10px] text-slate-400 text-center mt-auto">
                  共 {mindMapData?.nodes.length ?? 0} 个节点
                </div>
              </div>
            </div>
            <DialogFooter className="shrink-0 pt-2">
              <button onClick={() => setShowMindMap(false)}
                className="px-4 py-2 rounded-lg text-slate-600 hover:bg-slate-100 text-sm font-medium transition-colors">
                关闭
              </button>
              <button onClick={insertMindMapToDocument}
                className="px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white text-sm font-medium flex items-center gap-2 transition-all shadow-sm">
                <Network size={15} /> 插入文档
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  },
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;
