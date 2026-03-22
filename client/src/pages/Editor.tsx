import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table';
import Image from '@tiptap/extension-image';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { Save, MoreHorizontal, Bold, Italic, List, ChevronRight, Clock, ChevronLeft, Undo2, Redo2, ListOrdered, Quote, Minus, Loader2, Sparkles, CheckCircle, TableIcon, Network, Check, Plus, Trash2, Pencil, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';
import { MindMapImage, computeMMPositions, buildMindMapSVG } from '../components/editor/mindmap-svg-utils';
import { InsightPanel } from '../components/editor/InsightPanel';
export { MindMapImage, computeMMPositions, buildMindMapSVG, type MMNode, type MMLink } from '../components/editor/mindmap-svg-utils';

// --- Task 2.1: ToolBtn component ---
interface ToolBtnProps {
  icon?: React.ReactNode;
  label?: string;
  active?: boolean;
  onClick: () => void;
  title?: string;
  children?: React.ReactNode;
}

export function ToolBtn({ icon, label, active, onClick, title: titleProp, children }: ToolBtnProps) {
  return (
    <button
      title={titleProp || label}
      onClick={onClick}
      className={`p-1 rounded ${active ? 'bg-purple-100 text-purple-700 shadow-inner' : 'hover:bg-slate-100 text-slate-600'}`}
    >
      {children || icon}
    </button>
  );
}

// --- Task 4.1: AI action type ---
export type AIActionType = 'generate' | 'proofread' | 'table' | 'mindmap';

// --- Task 6.1: buildTableHTML pure function ---
export function buildTableHTML(headers: string[], rows: string[][]): string {
  const headerCells = headers.map(h => `<th>${h}</th>`).join('');
  const bodyRows = rows.map(row =>
    `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`
  ).join('');
  return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
}

// --- Task 9.1: addChildNode pure function ---
export function addChildNode(
  nodes: { id: string; label: string }[],
  links: { source: string; target: string }[],
  parentId: string
): { nodes: { id: string; label: string }[]; links: { source: string; target: string }[] } {
  const newId = String(Math.max(...nodes.map(n => Number(n.id)), 0) + 1);
  return {
    nodes: [...nodes, { id: newId, label: '新节点' }],
    links: [...links, { source: parentId, target: newId }],
  };
}

// --- Task 9.1: deleteNodeCascade pure function ---
export function deleteNodeCascade(
  nodes: { id: string; label: string }[],
  links: { source: string; target: string }[],
  nodeId: string
): { nodes: { id: string; label: string }[]; links: { source: string; target: string }[] } {
  const toDelete = new Set<string>();
  const queue = [nodeId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    toDelete.add(current);
    for (const link of links) {
      if (link.source === current && !toDelete.has(link.target)) {
        queue.push(link.target);
      }
    }
  }
  return {
    nodes: nodes.filter(n => !toDelete.has(n.id)),
    links: links.filter(l => !toDelete.has(l.source) && !toDelete.has(l.target)),
  };
}

// --- Helper: truncate label for SVG display ---
function mmTrunc(s: string, max = 8): string {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

// --- Rich text initial content for the editor ---
const INITIAL_CONTENT = `
<h2>简介</h2>
<p>AI 正在改变世界。本文档概述了人工智能研究的关键方向和战略规划。</p>
<h2>关键概念</h2>
<ul>
  <li>机器学习</li>
  <li>神经网络</li>
  <li>深度学习</li>
</ul>
<h3>技术对比</h3>
<table>
  <thead>
    <tr><th>技术</th><th>优势</th><th>应用场景</th></tr>
  </thead>
  <tbody>
    <tr><td>机器学习</td><td>数据驱动</td><td>推荐系统</td></tr>
    <tr><td>深度学习</td><td>特征自动提取</td><td>图像识别</td></tr>
    <tr><td>强化学习</td><td>自主决策</td><td>游戏AI</td></tr>
  </tbody>
</table>
<blockquote><p>技术的价值在于它如何被应用来解决真实世界的问题。</p></blockquote>
`;

interface EditorProps {
  onNavigate?: (page: string) => void;
}

export function Editor({ onNavigate }: EditorProps) {
  // --- Task 1.3: Initialize Tiptap editor ---
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Image,
      MindMapImage,
    ],
    content: INITIAL_CONTENT,
    editorProps: {
      attributes: {
        class: 'bb-editor outline-none',
      },
    },
  });

  // --- Task 11.1: Controlled title state ---
  const [title, setTitle] = useState('人工智能研究战略');

  // --- Task 4.1: AI Context Menu state (enhanced) ---
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; isLoading: boolean; loadingAction: string | null } | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const selectionRef = useRef<{ from: number; to: number } | null>(null);
  const lastSelectionRef = useRef<{ from: number; to: number; text: string } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- Task 4.1: Dialog state ---
  const [showProofread, setShowProofread] = useState(false);
  const [proofreadData, setProofreadData] = useState<{ original: string; corrected: string } | null>(null);
  const [showTable, setShowTable] = useState(false);
  const [tableData, setTableData] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [showMindMap, setShowMindMap] = useState(false);
  const [mindmapNodes, setMindmapNodes] = useState<{ id: string; label: string }[]>([]);
  const [mindmapLinks, setMindmapLinks] = useState<{ source: string; target: string }[]>([]);
  // --- Mind Map enhanced states ---
  const [mmSelectedId, setMmSelectedId] = useState<string | null>(null);
  const [mmEditingId, setMmEditingId] = useState<string | null>(null);
  const [mmEditLabel, setMmEditLabel] = useState('');
  const [mmNewLabel, setMmNewLabel] = useState('');
  const mmNewLabelRef = useRef<HTMLInputElement>(null);
  const editingSrcRef = useRef<number | null>(null);
  const [mindmapUpdateTarget, setMindmapUpdateTarget] = useState<number | null>(null);

  // --- Derived root id ---
  const mmRootId = useCallback(() => mindmapNodes[0]?.id || '1', [mindmapNodes]);

  // --- Mind Map helper functions ---
  const mmDeleteNode = useCallback(() => {
    if (!mmSelectedId || mmSelectedId === mmRootId()) return;
    const result = deleteNodeCascade(mindmapNodes, mindmapLinks, mmSelectedId);
    setMindmapNodes(result.nodes);
    setMindmapLinks(result.links);
    setMmSelectedId(null);
  }, [mmSelectedId, mmRootId, mindmapNodes, mindmapLinks]);

  const mmStartEdit = useCallback((id: string) => {
    const node = mindmapNodes.find(n => n.id === id);
    if (!node) return;
    setMmEditingId(id);
    setMmEditLabel(node.label);
  }, [mindmapNodes]);

  const mmSaveEdit = useCallback(() => {
    if (!mmEditingId) return;
    setMindmapNodes(prev => prev.map(n => n.id === mmEditingId ? { ...n, label: mmEditLabel } : n));
    setMmEditingId(null);
    setMmEditLabel('');
  }, [mmEditingId, mmEditLabel]);

  // --- Insert mind map to document (with update-in-place support) ---
  const insertMindMapToDocument = useCallback(() => {
    if (!editor || mindmapNodes.length === 0) return;
    const positions = computeMMPositions(mindmapNodes, mindmapLinks, mmRootId());
    const svgStr = buildMindMapSVG(mindmapNodes, mindmapLinks, positions);
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)));
    const mindmapData = JSON.stringify({ nodes: mindmapNodes, links: mindmapLinks });

    if (editingSrcRef.current !== null) {
      editor.chain().focus().setNodeSelection(editingSrcRef.current).deleteSelection().insertContent({
        type: 'mindMapImage',
        attrs: { src: dataUrl, 'data-mindmap': mindmapData, title: '双击编辑思维导图' },
      }).run();
    } else if (mindmapUpdateTarget !== null) {
      editor.chain().focus().setNodeSelection(mindmapUpdateTarget).deleteSelection().insertContent({
        type: 'mindMapImage',
        attrs: { src: dataUrl, 'data-mindmap': mindmapData, title: '双击编辑思维导图' },
      }).run();
    } else {
      const insertPos = selectionRef.current?.to ?? editor.state.selection.to;
      editor.chain().focus().insertContentAt(insertPos, {
        type: 'mindMapImage',
        attrs: { src: dataUrl, 'data-mindmap': mindmapData, title: '双击编辑思维导图' },
      }).run();
    }
    setShowMindMap(false);
    setMindmapUpdateTarget(null);
    editingSrcRef.current = null;
  }, [editor, mindmapNodes, mindmapLinks, mmRootId, mindmapUpdateTarget]);

  // --- Task 4.1: handleMenuAction (enhanced AI action handler) ---
  const handleMenuAction = (action: AIActionType, text: string) => {
    const actionLabels: Record<AIActionType, string> = {
      generate: '智能生成',
      proofread: '智能校对',
      table: '生成表格',
      mindmap: '生成脑图',
    };
    setCtxMenu(prev => prev ? { ...prev, isLoading: true, loadingAction: actionLabels[action] } : prev);

    setTimeout(() => {
      try {
        const sel = selectionRef.current;
        switch (action) {
          case 'generate':
            if (editor && sel) {
              editor.chain().focus().insertContentAt(sel.to,
                '<p><strong>AI 扩展内容：</strong>基于您选中的文本，以下是深入分析和扩展...</p>'
              ).run();
              toast.success('智能生成完成', { description: '已在选中文本后插入扩展内容' });
            }
            break;
          case 'proofread':
            setProofreadData({ original: text, corrected: text + '（已优化表达）' });
            setShowProofread(true);
            toast.success('智能校对完成', { description: '请查看校对建议' });
            break;
          case 'table': {
            const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const headers = ['项目', '描述', '状态'];
            const rows = lines.length > 0
              ? lines.map((line, i) => [line, `描述${i + 1}`, '待定'])
              : [['任务一', '数据分析', '进行中'], ['任务二', '模型训练', '已完成']];
            setTableData({ headers, rows });
            setShowTable(true);
            toast.success('表格生成完成', { description: `已解析 ${rows.length} 行数据` });
            break;
          }
          case 'mindmap': {
            const mmLines = text.split('\n').map(l => l.trim()).filter(Boolean);
            const mmNodes: { id: string; label: string; type?: string }[] = [{ id: '1', label: mmLines[0] || '中心主题', type: 'root' }];
            const mmLnks: { source: string; target: string }[] = [];
            mmLines.slice(1).forEach((line, i) => {
              const nid = String(i + 2);
              mmNodes.push({ id: nid, label: line, type: 'child' });
              mmLnks.push({ source: '1', target: nid });
            });
            setMindmapNodes(mmNodes);
            setMindmapLinks(mmLnks);
            setMmSelectedId(null);
            setMmEditingId(null);
            editingSrcRef.current = null;
            setShowMindMap(true);
            toast.success('脑图生成完成', { description: `已生成 ${mmNodes.length} 个节点` });
            break;
          }
        }
      } catch {
        const errorMessages: Record<AIActionType, string> = {
          generate: 'AI 生成失败，请稍后重试',
          proofread: 'AI 校对失败，请稍后重试',
          table: '表格生成失败，请稍后重试',
          mindmap: '脑图生成失败，请稍后重试',
        };
        toast.error(errorMessages[action]);
      } finally {
        setCtxMenu(null);
        lastSelectionRef.current = null;
      }
    }, 1500);
  };

  // --- Track selection changes so right-click fallback works ---
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

  // --- Task 4.1: Context menu handler (uses editor state selection) ---
  const handleContextMenu = (e: React.MouseEvent) => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;

    let selFrom: number, selTo: number, text: string;

    if (!empty) {
      text = editor.state.doc.textBetween(from, to, ' ');
      selFrom = from;
      selTo = to;
    } else if (lastSelectionRef.current) {
      // Fallback: use the last known selection (right-click may have collapsed it)
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
  };

  // --- Task 4.1: Click outside to close context menu ---
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setCtxMenu(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // --- Task 1.4: Inject enhanced WYSIWYG styles ---
  useEffect(() => {
    if (document.getElementById('bb-editor-styles')) return;
    const style = document.createElement('style');
    style.id = 'bb-editor-styles';
    style.textContent = `
      .bb-editor { outline: none; }
      .bb-editor h1 { font-size: 2em; font-weight: 800; margin: 0.67em 0; color: #1e293b; }
      .bb-editor h2 { font-size: 1.5em; font-weight: 700; margin: 0.83em 0; color: #1e293b; }
      .bb-editor h3 { font-size: 1.17em; font-weight: 600; margin: 1em 0; color: #334155; }
      .bb-editor ul { list-style: disc; padding-left: 1.5em; }
      .bb-editor ol { list-style: decimal; padding-left: 1.5em; }
      .bb-editor li { margin: 0.25em 0; }
      .bb-editor blockquote { border-left: 3px solid #a78bfa; padding-left: 1em; color: #6b7280; background: #faf5ff; border-radius: 0 8px 8px 0; padding: 0.5em 1em; }
      .bb-editor table { border-collapse: collapse; width: 100%; border-radius: 8px; overflow: hidden; }
      .bb-editor th, .bb-editor td { border: 1px solid #e2e8f0; padding: 8px 12px; }
      .bb-editor th { background: linear-gradient(135deg, #f8fafc, #f1f5f9); font-weight: 600; }
      .bb-editor p { margin: 0.5em 0; line-height: 1.8; }
      .bb-editor img { max-width: 100%; height: auto; border-radius: 8px; }
      .bb-editor hr { border: none; border-top: 2px solid #e2e8f0; margin: 1.5em 0; }
      .bb-editor code { background: #f1f5f9; padding: 0.15em 0.4em; border-radius: 4px; font-size: 0.9em; }
      .bb-editor pre { background: #1e293b; color: #e2e8f0; padding: 1em; border-radius: 8px; overflow-x: auto; }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById('bb-editor-styles');
      if (el) document.head.removeChild(el);
    };
  }, []);

  // --- Task 9.4: Double-click MindMapImage to reopen in update mode ---
  const handleEditorDoubleClick = useCallback((event: React.MouseEvent) => {
    if (!editor) return;
    const target = event.target as HTMLElement;
    const img = target.closest('img[data-mindmap]') || (target.tagName === 'IMG' && target.getAttribute('data-mindmap') ? target : null);
    if (!img) return;
    const data = img.getAttribute('data-mindmap');
    if (!data) return;
    try {
      const parsed = JSON.parse(data);
      setMindmapNodes(parsed.nodes || []);
      setMindmapLinks(parsed.links || []);
      // Find the position of this node in the editor
      const { state } = editor;
      let pos: number | null = null;
      state.doc.descendants((node, nodePos) => {
        if (node.type.name === 'mindMapImage' && node.attrs['data-mindmap'] === data) {
          pos = nodePos;
          return false;
        }
      });
      editingSrcRef.current = pos;
      setMindmapUpdateTarget(pos);
      setMmSelectedId(null);
      setMmEditingId(null);
      setShowMindMap(true);
    } catch {
      toast.error('思维导图数据损坏，无法打开编辑');
    }
  }, [editor]);

  return (
    <div className="flex-1 h-full flex flex-col bg-white">
      {/* Top Bar */}
      <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 bg-white shrink-0">
        <div className="flex items-center gap-2 text-sm text-slate-500">
           {onNavigate && (
             <button onClick={() => onNavigate('documents')} className="p-1 hover:bg-slate-100 rounded-lg mr-1 text-slate-400">
               <ChevronLeft size={20} />
             </button>
           )}
           <span className="cursor-pointer hover:text-purple-600" onClick={() => onNavigate && onNavigate('documents')}>文档</span>
           <ChevronRight size={16} />
           <span className="text-slate-900 font-medium">{title}</span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="text-xs text-slate-400 mr-2 flex items-center gap-1">
             <Clock size={12} /> 已保存 2分钟前
          </div>
          <button className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
            导出
          </button>
          <button className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-violet-600 text-white text-sm font-medium hover:from-purple-700 hover:to-violet-700 flex items-center gap-2">
            <Save size={16} /> 保存
          </button>
          <button className="p-2 rounded-lg text-slate-400 hover:bg-slate-50">
             <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Editor */}
        <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full border-r border-slate-200/50 bg-white">
          {/* Toolbar */}
          <div className="px-8 py-2 border-b border-slate-100 flex items-center gap-0.5 sticky top-0 bg-white z-10">
             <ToolBtn title="撤销" onClick={() => { if (!editor) return; editor.chain().focus().undo().run(); }}><Undo2 size={16} /></ToolBtn>
             <ToolBtn title="重做" onClick={() => { if (!editor) return; editor.chain().focus().redo().run(); }}><Redo2 size={16} /></ToolBtn>
             <div className="w-px h-4 bg-slate-200 mx-1.5" />
             <ToolBtn title="标题1" active={editor?.isActive('heading', { level: 1 })} onClick={() => { if (!editor) return; editor.chain().focus().toggleHeading({ level: 1 }).run(); }}><span className="text-xs font-bold">H1</span></ToolBtn>
             <ToolBtn title="标题2" active={editor?.isActive('heading', { level: 2 })} onClick={() => { if (!editor) return; editor.chain().focus().toggleHeading({ level: 2 }).run(); }}><span className="text-xs font-bold">H2</span></ToolBtn>
             <ToolBtn title="标题3" active={editor?.isActive('heading', { level: 3 })} onClick={() => { if (!editor) return; editor.chain().focus().toggleHeading({ level: 3 }).run(); }}><span className="text-xs font-bold">H3</span></ToolBtn>
             <div className="w-px h-4 bg-slate-200 mx-1.5" />
             <ToolBtn title="粗体" active={editor?.isActive('bold')} onClick={() => { if (!editor) return; editor.chain().focus().toggleBold().run(); }}><Bold size={16} /></ToolBtn>
             <ToolBtn title="斜体" active={editor?.isActive('italic')} onClick={() => { if (!editor) return; editor.chain().focus().toggleItalic().run(); }}><Italic size={16} /></ToolBtn>
             <div className="w-px h-4 bg-slate-200 mx-1.5" />
             <ToolBtn title="无序列表" active={editor?.isActive('bulletList')} onClick={() => { if (!editor) return; editor.chain().focus().toggleBulletList().run(); }}><List size={16} /></ToolBtn>
             <ToolBtn title="有序列表" active={editor?.isActive('orderedList')} onClick={() => { if (!editor) return; editor.chain().focus().toggleOrderedList().run(); }}><ListOrdered size={16} /></ToolBtn>
             <div className="w-px h-4 bg-slate-200 mx-1.5" />
             <ToolBtn title="引用" active={editor?.isActive('blockquote')} onClick={() => { if (!editor) return; editor.chain().focus().toggleBlockquote().run(); }}><Quote size={16} /></ToolBtn>
             <ToolBtn title="分割线" onClick={() => { if (!editor) return; editor.chain().focus().setHorizontalRule().run(); }}><Minus size={16} /></ToolBtn>
          </div>

          <div className="flex-1 overflow-y-auto px-12 py-8" onContextMenu={handleContextMenu} onDoubleClick={handleEditorDoubleClick}>
             <input 
               type="text" 
               value={title}
               onChange={(e) => setTitle(e.target.value)}
               className="w-full text-4xl font-bold text-slate-900 outline-none placeholder:text-slate-300 mb-8"
               placeholder="无标题文档"
             />
             <EditorContent editor={editor} className="w-full text-lg text-slate-700 leading-relaxed pb-24" />
          </div>
          
          {/* Status Bar */}
          <div className="px-6 py-2 border-t border-slate-100 text-xs text-slate-400 flex justify-between">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
              {editor?.getText().trim().split(/\s+/).filter(Boolean).length || 0} 字
            </span>
            <span>富文本模式</span>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-72 shrink-0">
          <InsightPanel editor={editor} />
        </div>
      </div>

      {/* --- Task 4.1: AI Context Menu (enhanced with loading, backdrop-blur, gradient hover) --- */}
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

      {/* Proofreading Dialog (enhanced) */}
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
            <button
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50"
              onClick={() => setShowProofread(false)}
            >
              忽略
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700"
              onClick={() => {
                if (editor && proofreadData && selectionRef.current) {
                  const { from, to } = selectionRef.current;
                  editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, proofreadData.corrected).run();
                }
                setShowProofread(false);
              }}
            >
              采纳建议
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Table Dialog (enhanced) */}
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
            <button
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50"
              onClick={() => setShowTable(false)}
            >
              取消
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700"
              onClick={() => {
                if (editor && tableData) {
                  if (tableData.headers.length === 0) {
                    toast.error('表格数据为空，无法插入');
                    setShowTable(false);
                    return;
                  }
                  // Build JSON content with proper paragraph wrapping for block+ content spec
                  const headerRow = {
                    type: 'tableRow',
                    content: tableData.headers.map((h: string) => ({
                      type: 'tableHeader',
                      content: [{ type: 'paragraph', content: h ? [{ type: 'text', text: h }] : [] }],
                    })),
                  };
                  const bodyRows = tableData.rows.map((row: string[]) => ({
                    type: 'tableRow',
                    content: row.map((cell: string) => ({
                      type: 'tableCell',
                      content: [{ type: 'paragraph', content: cell ? [{ type: 'text', text: cell }] : [] }],
                    })),
                  }));
                  const tableNode = {
                    type: 'table',
                    content: [headerRow, ...bodyRows],
                  };

                  const savedSelection = selectionRef.current ? { ...selectionRef.current } : null;
                  const capturedEditor = editor;
                  setShowTable(false);
                  requestAnimationFrame(() => {
                    setTimeout(() => {
                      try {
                        if (!capturedEditor) {
                          toast.error('插入表格失败：编辑器不可用');
                          return;
                        }
                        if (savedSelection) {
                          capturedEditor.chain().focus().deleteRange(savedSelection).insertContentAt(savedSelection.from, tableNode).run();
                        } else {
                          capturedEditor.chain().focus('end').insertContent(tableNode).run();
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
              }}
            >
              插入文档
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MindMap Dialog (major upgrade) */}
      <Dialog open={showMindMap} onOpenChange={setShowMindMap}>
        <DialogContent className="sm:max-w-5xl" style={{ height: '86vh', maxHeight: '86vh' }}>
          <DialogHeader>
            <DialogTitle>思维导图编辑器</DialogTitle>
            <DialogDescription>点击节点选中，双击编辑标签。右侧面板可添加或删除节点。</DialogDescription>
          </DialogHeader>
          <div className="flex gap-4 flex-1 overflow-hidden" style={{ minHeight: 0 }}>
            {/* SVG Area */}
            <div className="flex-1 bg-slate-50 rounded-lg overflow-hidden relative">
              <svg viewBox="0 0 800 600" className="w-full h-full">
                <defs>
                  <radialGradient id="mmRootGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#a78bfa" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </radialGradient>
                  <filter id="mmGlow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge>
                      <feMergeNode in="blur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                {(() => {
                  const positions = computeMMPositions(mindmapNodes, mindmapLinks, mmRootId());
                  const colors = ['#7c3aed', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                  // Compute depth map
                  const childrenMap: Record<string, string[]> = {};
                  for (const link of mindmapLinks) {
                    if (!childrenMap[link.source]) childrenMap[link.source] = [];
                    childrenMap[link.source].push(link.target);
                  }
                  const depthMap: Record<string, number> = {};
                  const bfsQ: Array<{ id: string; depth: number }> = [];
                  bfsQ.push({ id: mmRootId(), depth: 0 });
                  while (bfsQ.length > 0) {
                    const { id, depth } = bfsQ.shift()!;
                    depthMap[id] = depth;
                    for (const cid of (childrenMap[id] || [])) {
                      bfsQ.push({ id: cid, depth: depth + 1 });
                    }
                  }
                  return (
                    <>
                      {mindmapLinks.map((link, i) => {
                        const source = positions[link.source];
                        const target = positions[link.target];
                        if (!source || !target) return null;
                        const mx = (source.x + target.x) / 2;
                        return (
                          <path
                            key={i}
                            d={`M${source.x},${source.y} C${mx},${source.y} ${mx},${target.y} ${target.x},${target.y}`}
                            fill="none"
                            stroke="#cbd5e1"
                            strokeWidth={2}
                          />
                        );
                      })}
                      {mindmapNodes.map(node => {
                        const pos = positions[node.id];
                        if (!pos) return null;
                        const isSelected = node.id === mmSelectedId;
                        const depth = depthMap[node.id] ?? 0;
                        const color = colors[depth % colors.length];
                        const isRoot = depth === 0;
                        return (
                          <g key={node.id} onClick={() => setMmSelectedId(node.id)} onDoubleClick={() => mmStartEdit(node.id)} style={{ cursor: 'pointer' }}>
                            {isSelected && (
                              isRoot
                                ? <circle cx={pos.x} cy={pos.y} r={42} fill="none" stroke={color} strokeWidth={2} strokeDasharray="6 3" opacity={0.6} />
                                : <rect x={pos.x - Math.max(node.label.length * 6, 30) - 6} y={pos.y - 22} width={Math.max(node.label.length * 12, 60) + 12} height={44} rx={12} fill="none" stroke={color} strokeWidth={2} strokeDasharray="6 3" opacity={0.6} />
                            )}
                            {isRoot ? (
                              <>
                                <circle cx={pos.x} cy={pos.y} r={36} fill="url(#mmRootGrad)" filter={isSelected ? 'url(#mmGlow)' : undefined} />
                                <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={14} fontWeight="bold">{mmTrunc(node.label, 6)}</text>
                              </>
                            ) : (
                              <>
                                <rect x={pos.x - Math.max(node.label.length * 6, 30)} y={pos.y - 16} width={Math.max(node.label.length * 12, 60)} height={32} rx={8} fill={color} opacity={0.9} filter={isSelected ? 'url(#mmGlow)' : undefined} />
                                <text x={pos.x} y={pos.y} textAnchor="middle" dominantBaseline="central" fill="white" fontSize={12}>{mmTrunc(node.label)}</text>
                              </>
                            )}
                          </g>
                        );
                      })}
                    </>
                  );
                })()}
              </svg>
            </div>

            {/* Right Edit Panel */}
            <div className="w-56 space-y-4 overflow-y-auto">
              {/* Add node section */}
              <div className="space-y-2">
                <label className="text-xs text-slate-500 font-medium">添加节点</label>
                <div className="flex gap-1.5">
                  <input
                    ref={mmNewLabelRef}
                    type="text"
                    className="flex-1 px-2 py-1.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-300"
                    placeholder="节点名称"
                    value={mmNewLabel}
                    onChange={(e) => setMmNewLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && mmNewLabel.trim()) {
                        const parentId = mmSelectedId || mmRootId();
                        const newId = String(Math.max(...mindmapNodes.map(n => Number(n.id)), 0) + 1);
                        setMindmapNodes(prev => [...prev, { id: newId, label: mmNewLabel.trim() }]);
                        setMindmapLinks(prev => [...prev, { source: parentId, target: newId }]);
                        setMmNewLabel('');
                      }
                    }}
                  />
                  <button
                    className="px-2 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                    disabled={!mmNewLabel.trim()}
                    onClick={() => {
                      if (!mmNewLabel.trim()) return;
                      const parentId = mmSelectedId || mmRootId();
                      const newId = String(Math.max(...mindmapNodes.map(n => Number(n.id)), 0) + 1);
                      setMindmapNodes(prev => [...prev, { id: newId, label: mmNewLabel.trim() }]);
                      setMindmapLinks(prev => [...prev, { source: parentId, target: newId }]);
                      setMmNewLabel('');
                    }}
                  >
                    <Plus size={16} />
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  {mmSelectedId ? `添加子节点到「${mindmapNodes.find(n => n.id === mmSelectedId)?.label || ''}」` : '添加一级节点'}
                </p>
              </div>

              {/* Selected node edit section */}
              <AnimatePresence>
                {mmSelectedId && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600">选中节点</span>
                      <button className="text-slate-400 hover:text-slate-600" onClick={() => setMmSelectedId(null)}>
                        <X size={14} />
                      </button>
                    </div>
                    {mmEditingId === mmSelectedId ? (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          className="flex-1 px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-1 focus:ring-purple-300"
                          value={mmEditLabel}
                          onChange={(e) => setMmEditLabel(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') mmSaveEdit(); }}
                          autoFocus
                        />
                        <button className="px-1.5 py-1 bg-purple-600 text-white rounded hover:bg-purple-700" onClick={mmSaveEdit}>
                          <Check size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-slate-700 flex-1 truncate">{mindmapNodes.find(n => n.id === mmSelectedId)?.label}</span>
                        <button className="p-1 text-slate-400 hover:text-purple-600 rounded" onClick={() => mmStartEdit(mmSelectedId)}>
                          <Pencil size={14} />
                        </button>
                      </div>
                    )}
                    <button
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={mmSelectedId === mmRootId()}
                      onClick={mmDeleteNode}
                    >
                      <Trash2 size={12} /> 删除节点
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Node count */}
              <div className="text-[10px] text-slate-400 text-center pt-2 border-t border-slate-100">
                共 {mindmapNodes.length} 个节点
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50"
              onClick={() => { setShowMindMap(false); editingSrcRef.current = null; setMindmapUpdateTarget(null); }}
            >
              取消
            </button>
            <button
              className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm hover:bg-purple-700"
              onClick={insertMindMapToDocument}
            >
              {(editingSrcRef.current !== null || mindmapUpdateTarget !== null) ? '更新文档' : '插入文档'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
