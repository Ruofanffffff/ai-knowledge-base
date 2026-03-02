/**
 * MindmapEditor — Full-screen portal modal for interactive mindmap editing.
 *
 * Entry points:
 *  1. AI panel "编辑导图" button  → caller opens with { open: true, initialData }
 *  2. Embedded mindmapBlock tap   → via window CustomEvent 'mindmap:open-editor'
 *
 * On save, calls onSave(newData).
 */
import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, ZoomIn, ZoomOut, RotateCcw, Info } from 'lucide-react';
import {
  MindmapCanvas,
  type MindmapData,
  genId,
} from './MindmapCanvas';

// ─── Props ───────────────────────────────────────────────────────────────────
interface MindmapEditorProps {
  open: boolean;
  initialData: MindmapData | null;
  onSave: (data: MindmapData) => void;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function MindmapEditor({ open, initialData, onSave, onClose }: MindmapEditorProps) {
  const [data, setData] = useState<MindmapData>({ central_topic: '', nodes: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Text editing bottom sheet
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Zoom level (0.6 – 1.4)
  const [zoom, setZoom] = useState(0.9);
  // Tip visibility
  const [showTip, setShowTip] = useState(true);

  // Sync data when modal opens
  useEffect(() => {
    if (open && initialData) {
      setData(JSON.parse(JSON.stringify(initialData))); // deep clone
      setSelectedId(null);
      setEditingId(null);
      setZoom(0.9);
      setShowTip(true);
    }
  }, [open, initialData]);

  // Auto-hide tip after 2.8s
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setShowTip(false), 2800);
    return () => clearTimeout(t);
  }, [open]);

  // Focus input when text edit sheet opens
  useEffect(() => {
    if (editingId) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [editingId]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleEditText = useCallback((nodeId: string, currentText: string) => {
    setEditingId(nodeId);
    setEditText(currentText);
    setSelectedId(null); // hide action menu while editing
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingId) return;
    const trimmed = editText.trim() || '未命名';
    setData(prev => {
      if (editingId === 'central') {
        return { ...prev, central_topic: trimmed };
      }
      return {
        ...prev,
        nodes: prev.nodes.map(b => {
          if (b.id === editingId) return { ...b, text: trimmed };
          return {
            ...b,
            children: (b.children ?? []).map(c =>
              c.id === editingId ? { ...c, text: trimmed } : c
            ),
          };
        }),
      };
    });
    setEditingId(null);
  }, [editingId, editText]);

  const handleAddChild = useCallback((parentId: string) => {
    const newId = genId();
    setData(prev => {
      if (parentId === 'central') {
        // Add new branch
        return {
          ...prev,
          nodes: [
            ...prev.nodes,
            { id: newId, text: '新节点', children: [] },
          ],
        };
      }
      return {
        ...prev,
        nodes: prev.nodes.map(b => {
          if (b.id !== parentId) return b;
          return { ...b, children: [...(b.children ?? []), { id: newId, text: '新节点' }] };
        }),
      };
    });
    // Immediately open edit for new node
    setSelectedId(null);
    setTimeout(() => {
      setEditingId(newId);
      setEditText('新节点');
    }, 60);
  }, []);

  const handleDelete = useCallback((nodeId: string) => {
    setSelectedId(null);
    setData(prev => {
      // Is it a branch?
      if (prev.nodes.some(b => b.id === nodeId)) {
        return { ...prev, nodes: prev.nodes.filter(b => b.id !== nodeId) };
      }
      // It's a child
      return {
        ...prev,
        nodes: prev.nodes.map(b => ({
          ...b,
          children: (b.children ?? []).filter(c => c.id !== nodeId),
        })),
      };
    });
  }, []);

  const handleSave = useCallback(() => {
    onSave(data);
  }, [data, onSave]);

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0"
            style={{ zIndex: 9950, background: 'rgba(8,6,18,0.72)', backdropFilter: 'blur(6px)' }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 40 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="fixed inset-0 flex flex-col"
            style={{
              zIndex: 9960,
              background: 'linear-gradient(160deg, #FDFDFF 0%, #F8F5FF 50%, #F3F8FF 100%)',
            }}
          >
            {/* ── Top bar ── */}
            <div
              className="flex items-center justify-between px-4 pt-12 pb-3 flex-shrink-0"
              style={{
                borderBottom: '1px solid rgba(99,102,241,0.1)',
                background: 'rgba(253,253,255,0.9)',
                backdropFilter: 'blur(14px)',
              }}
            >
              <button
                onClick={onClose}
                className="flex items-center justify-center w-9 h-9 rounded-2xl active:scale-95 transition-transform"
                style={{ background: 'rgba(99,102,241,0.08)' }}
              >
                <X size={17} style={{ color: '#6366F1' }} />
              </button>

              <div className="flex flex-col items-center">
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a2e' }}>
                  编辑思维导图
                </span>
                <span style={{ fontSize: '11px', color: '#aaa', marginTop: 1 }}>
                  {data.nodes.length} 个主节点 · {data.nodes.reduce((s, b) => s + (b.children?.length ?? 0), 0)} 个子节点
                </span>
              </div>

              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl active:scale-95 transition-transform"
                style={{
                  background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 600,
                  boxShadow: '0 3px 12px rgba(99,102,241,0.35)',
                }}
              >
                <Check size={14} />
                完成
              </button>
            </div>

            {/* ── Tip banner ── */}
            <AnimatePresence>
              {showTip && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2 px-4 py-2 flex-shrink-0 overflow-hidden"
                  style={{ background: 'rgba(99,102,241,0.06)', borderBottom: '1px solid rgba(99,102,241,0.07)' }}
                >
                  <Info size={12} style={{ color: '#8B5CF6', flexShrink: 0 }} />
                  <span style={{ fontSize: '11.5px', color: '#7C6FB0' }}>
                    点击节点 → 出现操作菜单 · <b>编</b>辑文字 · <b>+</b>添加子节点 · <b>×</b>删除
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Canvas area ── */}
            <div className="flex-1 relative overflow-hidden" style={{ minHeight: 0 }}>
              <motion.div
                animate={{ scale: zoom }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                className="absolute inset-0 flex items-center justify-center"
                style={{ transformOrigin: 'center center' }}
              >
                <div style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}>
                  <MindmapCanvas
                    data={data}
                    editable
                    selectedId={selectedId}
                    onNodeSelect={setSelectedId}
                    onEditText={handleEditText}
                    onAddChild={handleAddChild}
                    onDeleteNode={handleDelete}
                  />
                </div>
              </motion.div>

              {/* Zoom controls */}
              <div
                className="absolute right-4 bottom-4 flex flex-col gap-1.5"
                style={{ zIndex: 10 }}
              >
                {[
                  { icon: ZoomIn,   action: () => setZoom(z => Math.min(z + 0.15, 1.5)),  key: 'zi' },
                  { icon: ZoomOut,  action: () => setZoom(z => Math.max(z - 0.15, 0.5)),  key: 'zo' },
                  { icon: RotateCcw, action: () => setZoom(0.9), key: 'zr' },
                ].map(({ icon: Icon, action, key }) => (
                  <button
                    key={key}
                    onClick={action}
                    className="flex items-center justify-center w-9 h-9 rounded-2xl active:scale-90 transition-transform"
                    style={{
                      background: 'rgba(255,255,255,0.88)',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      border: '1px solid rgba(99,102,241,0.12)',
                    }}
                  >
                    <Icon size={15} style={{ color: '#6366F1' }} />
                  </button>
                ))}
              </div>

              {/* "Add Branch" floating button (always accessible) */}
              <button
                onClick={() => handleAddChild('central')}
                className="absolute left-4 bottom-4 flex items-center gap-1.5 px-4 py-2 rounded-2xl active:scale-95 transition-all"
                style={{
                  background: 'rgba(255,255,255,0.88)',
                  boxShadow: '0 2px 8px rgba(99,102,241,0.14)',
                  border: '1px solid rgba(99,102,241,0.18)',
                  color: '#6366F1',
                  fontSize: '12px',
                  fontWeight: 600,
                }}
              >
                <span style={{ fontSize: '16px', lineHeight: 1 }}>+</span>
                添加主节点
              </button>
            </div>

            {/* ── Text edit bottom sheet ── */}
            <AnimatePresence>
              {editingId && (
                <>
                  {/* Sheet backdrop */}
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0"
                    style={{ zIndex: 20, background: 'rgba(0,0,0,0.25)' }}
                    onClick={() => setEditingId(null)}
                  />
                  {/* Sheet */}
                  <motion.div
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ type: 'spring', damping: 28, stiffness: 340 }}
                    className="absolute bottom-0 left-0 right-0 rounded-t-3xl flex-shrink-0"
                    style={{
                      zIndex: 21,
                      background: 'rgba(255,255,255,0.98)',
                      boxShadow: '0 -10px 36px rgba(99,102,241,0.18)',
                      backdropFilter: 'blur(20px)',
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    {/* Handle */}
                    <div className="flex justify-center pt-3 pb-1">
                      <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(99,102,241,0.18)' }} />
                    </div>

                    <div className="px-5 pb-2">
                      <p style={{ fontSize: '12px', color: '#999', marginBottom: 10, fontWeight: 500 }}>
                        {editingId === 'central' ? '编辑中心主题' : '编辑节点文字'}
                      </p>
                      <div className="flex gap-3">
                        <input
                          ref={inputRef}
                          type="text"
                          value={editText}
                          onChange={e => setEditText(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { e.preventDefault(); commitEdit(); }
                            if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); }
                          }}
                          maxLength={20}
                          placeholder="节点文字…"
                          className="flex-1 px-4 py-3 rounded-2xl outline-none"
                          style={{
                            background: 'rgba(99,102,241,0.06)',
                            border: '1.5px solid rgba(99,102,241,0.2)',
                            fontSize: '15px',
                            color: '#1a1a2e',
                          }}
                        />
                        <button
                          onClick={commitEdit}
                          className="flex items-center justify-center w-12 h-12 rounded-2xl active:scale-95 transition-transform flex-shrink-0"
                          style={{
                            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                            boxShadow: '0 3px 12px rgba(99,102,241,0.32)',
                          }}
                        >
                          <Check size={18} style={{ color: 'white' }} />
                        </button>
                      </div>
                      {/* Character count */}
                      <div className="flex justify-end mt-2">
                        <span style={{ fontSize: '11px', color: editText.length > 15 ? '#EF4444' : '#bbb' }}>
                          {editText.length}/20
                        </span>
                      </div>
                    </div>

                    {/* Safe area spacer */}
                    <div style={{ height: 'env(safe-area-inset-bottom, 16px)', minHeight: 16 }} />
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
