import React, {
  forwardRef,
  useImperativeHandle,
  useCallback,
  useRef,
} from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Image as ImageIcon,
} from 'lucide-react';
import apiClient from '../../api/client';
import ImageBlockExtension from './ImageBlockExtension';

// ============================================================================
// Types
// ============================================================================

export interface RichTextEditorHandle {
  getJSON: () => object;
  setContent: (json: object) => void;
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
// RichTextEditor component
// ============================================================================

const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  ({ content, editable = true, onChange }, ref) => {
    const imageInputRef = useRef<HTMLInputElement>(null);
    // Ref to hold the editor instance for use inside editorProps callbacks
    const editorRef = useRef<ReturnType<typeof useEditor>>(null) as React.MutableRefObject<ReturnType<typeof useEditor>>;

    const editor = useEditor({
      extensions: [StarterKit, ImageBlockExtension],
      content: content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
      editable,
      onUpdate: ({ editor: ed }) => {
        onChange?.(ed.getJSON());
      },
      editorProps: {
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

    // Expose getJSON / setContent to parent via ref
    useImperativeHandle(
      ref,
      () => ({
        getJSON: () => editor?.getJSON() ?? { type: 'doc', content: [] },
        setContent: (json: object) => {
          editor?.commands.setContent(json);
        },
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
      <div>
        {/* Toolbar */}
        {editable && (
          <div className="px-12 py-3 border-b border-slate-100 flex items-center gap-1 sticky top-0 bg-white z-10">
            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBold().run()}
              isActive={editor.isActive('bold')}
              title="加粗"
            >
              <Bold size={18} />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleItalic().run()}
              isActive={editor.isActive('italic')}
              title="斜体"
            >
              <Italic size={18} />
            </ToolbarButton>

            <div className="w-px h-4 bg-slate-200 mx-2" />

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              isActive={editor.isActive('bulletList')}
              title="无序列表"
            >
              <List size={18} />
            </ToolbarButton>

            <ToolbarButton
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              isActive={editor.isActive('orderedList')}
              title="有序列表"
            >
              <ListOrdered size={18} />
            </ToolbarButton>

            <div className="w-px h-4 bg-slate-200 mx-2" />

            <ToolbarButton onClick={handleImageButtonClick} title="插入图片">
              <ImageIcon size={18} />
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
          onClick={() => editor?.chain().focus().run()}
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
          `}</style>
          <EditorContent
            editor={editor}
            className="prose prose-slate max-w-none text-lg leading-relaxed font-serif"
          />
        </div>
      </div>
    );
  },
);

RichTextEditor.displayName = 'RichTextEditor';

export default RichTextEditor;
