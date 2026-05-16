import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { GitBranch, X, ChevronRight, FileText, Tag, Check, Sparkles, Search, MapPin, Layers } from 'lucide-react';
import { ParticleBackground } from '../components/ParticleBackground';
import { BottomNav } from '../components/BottomNav';
import { useNotes, Note } from '../components/context/NoteContext';
import { api } from '../services/api';
import { documentsLibraryService, type LibraryDocument } from '../services/documentsLibraryService';
import { reportTelemetryEvent } from '../services/telemetryService';
import {
  normalizeGraphDTOv1,
  type GraphDTOv1Normalized,
  computeMatchedNodeIds,
  getEntityTypeSemantic,
  getLayerSemantic,
  getSourceTagSemantic,
} from 'graph-core';

// ── Imports from sichain modules ──
import { getColor } from './sichain/utils/canvasUtils';
import { type BackendKgEntity, type BackendKgRelation, normalizeNoteTags, mergeNoteTags } from './sichain/data/graphBuilder';
import { type V1Selection, extractGraphPayload } from './sichain/data/graphDTOv1Builder';
import { GraphGenOverlay, GG_KEY, type GraphGenInfo } from './sichain/visualization/GraphGenOverlay';
import { KnowledgeGraphCanvas } from './sichain/visualization/KnowledgeGraphCanvas';
import { GraphDTOv1Canvas } from './sichain/visualization/GraphDTOv1Canvas';

// ── GraphDTOv1DetailSheet ─────────────────────────────────────────────
function GraphDTOv1DetailSheet({
  graph,
  selection,
  onClose,
}: {
  graph: GraphDTOv1Normalized | null;
  selection: V1Selection | null;
  onClose: () => void;
}) {
  const entity = useMemo(() => {
    if (!graph || selection?.kind !== 'entity') return null;
    return graph.entities.find((e) => e.id === selection.id) ?? null;
  }, [graph, selection]);

  const relation = useMemo(() => {
    if (!graph || selection?.kind !== 'relation') return null;
    return graph.relations.find((r) => r.id === selection.id) ?? null;
  }, [graph, selection]);

  if (!selection || (!entity && !relation)) return null;

  const title = entity ? entity.name : relation ? relation.name : '';
  const subtitle = entity ? '实体节点' : '关系边';
  const chips: Array<{ label: string; value: string; color: string; bg: string }> = [];
  if (entity) {
    const es = getEntityTypeSemantic(entity.entityType);
    const ss = getSourceTagSemantic(entity.source);
    chips.push({ label: 'entityType', value: es.label, color: es.fill, bg: es.bg });
    chips.push({ label: 'source', value: ss.label, color: ss.color, bg: ss.bg });
  }
  if (relation) {
    const ls = getLayerSemantic(relation.layer);
    const ss = getSourceTagSemantic(relation.source_tag);
    chips.push({ label: 'layer', value: ls.label, color: '#6366F1', bg: 'rgba(99,102,241,0.10)' });
    chips.push({ label: 'source_tag', value: ss.label, color: ss.color, bg: ss.bg });
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 flex items-end justify-center"
        style={{ background: 'rgba(30,27,75,0.35)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 26 }}
          className="w-full max-w-lg mx-3 mb-24 rounded-3xl overflow-hidden"
          style={{ background: 'var(--hi-sheet-bg)', backdropFilter: 'blur(20px)' }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p style={{ color: '#9CA3AF', fontSize: '11px', fontWeight: 700 }}>{subtitle}</p>
                <p style={{ color: 'var(--hi-text-primary)', fontSize: '17px', fontWeight: 900, marginTop: 2 }}>
                  {title}
                </p>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
                <X size={14} style={{ color: '#6366F1' }} />
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {chips.map((c) => (
                <div key={c.label} className="px-2 py-1 rounded-full" style={{ background: c.bg, border: `1px solid ${c.color}33` }}>
                  <span style={{ color: c.color, fontSize: '10px', fontWeight: 800 }}>{c.label}</span>
                  <span style={{ color: c.color, fontSize: '10px', fontWeight: 700, marginLeft: 6 }}>{c.value}</span>
                </div>
              ))}
            </div>

            <p style={{ color: '#4B5563', fontSize: '13.5px', lineHeight: 1.7 }} className="whitespace-pre-wrap">
              {(entity?.description || relation?.description || '').trim() || '暂无描述'}
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── GraphDTOv1Legend ───────────────────────────────────────────────────
function GraphDTOv1Legend({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  const layers = (['how', 'why'] as const).map((k) => ({ k, ...getLayerSemantic(k) }));
  const sources = (['fact', 'inferred', 'pattern'] as const).map((k) => ({ k, ...getSourceTagSemantic(k) }));

  return (
    <div className="mx-3 mt-3 rounded-2xl overflow-hidden" style={{ background: 'var(--hi-card-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--hi-card-border)' }}>
      <motion.button
        className="w-full px-4 pt-4 pb-3 flex items-center justify-between"
        style={{ borderBottom: open ? '1px solid rgba(99,102,241,0.07)' : 'none' }}
        onClick={onToggle}
        whileTap={{ scale: 0.98 }}
      >
        <div className="text-left">
          <p style={{ color: '#9CA3AF', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>图例</p>
          <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800, marginTop: '1px' }}>layer / source_tag 语义</p>
        </div>
        <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.08)' }}>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4L6 8L10 4" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        </div>
      </motion.button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="v1-legend"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pt-3 pb-3.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
              <p style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>layer</p>
              <div className="grid grid-cols-2 gap-2">
                {layers.map((l) => (
                  <div key={l.k} className="p-3 rounded-xl" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-2 rounded-full" style={{ background: '#6366F1' }} />
                      <span style={{ color: 'var(--hi-text-primary)', fontSize: '11.5px', fontWeight: 800 }}>{l.label}</span>
                    </div>
                    <p style={{ color: '#9CA3AF', fontSize: '10px', marginTop: 6 }}>{l.k}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-4 pt-3 pb-4">
              <p style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>source_tag</p>
              <div className="grid grid-cols-3 gap-2">
                {sources.map((s) => (
                  <div key={s.k} className="p-3 rounded-xl" style={{ background: s.bg, border: `1px solid ${s.color}22` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                      <span style={{ color: s.color, fontSize: '11.5px', fontWeight: 900 }}>{s.label}</span>
                    </div>
                    <p style={{ color: s.color, fontSize: '10px', marginTop: 6, opacity: 0.8 }}>{s.k}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── LegacySiChain ─────────────────────────────────────────────────────
function LegacySiChain() {
  const navigate = useNavigate();
  const { notes } = useNotes();
  const [noteEntityMap, setNoteEntityMap] = useState<Record<string, string[]>>({});
  const [singleGraphMap, setSingleGraphMap] = useState<Record<string, { entities: BackendKgEntity[]; relations: BackendKgRelation[] }>>({});
  const [mode, setMode] = useState<'all' | string>('all');
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'combined' | 'single'>('combined');
  const [graphGenInfo, setGraphGenInfo] = useState<GraphGenInfo | null>(null);

  // Check for pending graph-gen signal from NoteCreate
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GG_KEY);
      if (!raw) return;
      const info: GraphGenInfo = JSON.parse(raw);
      if (Date.now() - info.ts < 15000) setGraphGenInfo(info);
      localStorage.removeItem(GG_KEY);
    } catch { /* ignore */ }
  }, []);
  const [legendOpen, setLegendOpen] = useState(false);
  const [highlightType, setHighlightType] = useState<'note' | 'tag' | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerHighlight = useCallback((type: 'note' | 'tag') => {
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
    setHighlightType(type);
    highlightTimerRef.current = setTimeout(() => setHighlightType(null), 3000);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCombinedGraph = async () => {
      if (!notes.length) {
        if (!cancelled) setNoteEntityMap({});
        return;
      }
      try {
        const response = await api.get('/kg/notes/graph');
        const serverMap = response.data?.data?.noteEntityMap;
        if (!cancelled && serverMap && typeof serverMap === 'object') {
          setNoteEntityMap(serverMap);
        }
      } catch (error) {
        if (!cancelled) {
          setNoteEntityMap({});
        }
      }
    };
    loadCombinedGraph();
    return () => {
      cancelled = true;
    };
  }, [notes]);

  useEffect(() => {
    let cancelled = false;
    const loadSingleGraph = async () => {
      if (mode === 'all' || singleGraphMap[mode]) return;
      try {
        const response = await api.get(`/kg/note/${mode}/graph`);
        const entities = Array.isArray(response.data?.data?.entities) ? response.data.data.entities : [];
        const relations = Array.isArray(response.data?.data?.relations) ? response.data.data.relations : [];
        if (!cancelled) {
          setSingleGraphMap(prev => ({ ...prev, [mode]: { entities, relations } }));
          if (entities.length > 0) {
            setNoteEntityMap(prev => ({
              ...prev,
              [mode]: Array.from(new Set(entities.map((entity: BackendKgEntity) => String(entity.name || '').trim()).filter(Boolean)))
            }));
          }
        }
      } catch (error) {}
    };
    loadSingleGraph();
    return () => {
      cancelled = true;
    };
  }, [mode, singleGraphMap]);

  const graphNotes = useMemo(() => {
    return notes.map(note => ({
      ...note,
      tags: mergeNoteTags(note, noteEntityMap)
    }));
  }, [notes, noteEntityMap]);

  const selectedNote = selectedNode && !selectedNode.startsWith('tag_')
    ? graphNotes.find(n => n.id === selectedNode)
    : null;

  const handleNodeClick = (id: string) => {
    if (id.startsWith('tag_')) {
      setSelectedNode(id);
    } else {
      setSelectedNode(id);
    }
  };

  const allTags = Array.from(new Set(graphNotes.flatMap(n => normalizeNoteTags(n.tags))));
  const tagStats = allTags.map(tag => ({
    tag,
    count: graphNotes.filter(n => normalizeNoteTags(n.tags).includes(tag)).length,
  })).sort((a, b) => b.count - a.count);

  return (
    <div
      className="h-screen flex flex-col overflow-hidden relative"
      style={{ background: 'var(--hi-page-bg)' }}
    >
      <ParticleBackground count={80} />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] right-[-5%] w-[280px] h-[280px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--hi-glow-top) 0%, transparent 65%)' }} />
      </div>

      {/* Header */}
      <div className="relative z-20 flex-shrink-0"
        style={{
          background: 'var(--hi-header-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--hi-header-border)',
          paddingTop: 'calc(env(safe-area-inset-top) + 8px)'
        }}>
        <div className="px-5 pb-3 pt-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p style={{ color: '#8B5CF6', fontSize: '12px', fontWeight: 500 }}>知识关联可视化</p>
              <h1 style={{ color: 'var(--hi-text-primary)', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>思链</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)' }}>
                <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: 600 }}>{notes.length} 篇 · {allTags.length} 标签</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            {[
              { key: 'combined', label: '综合图谱' },
              { key: 'single', label: '单篇图谱' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => { setActiveTab(t.key as any); if (t.key === 'combined') setMode('all'); }}
                className="px-4 py-1.5 rounded-full transition-all"
                style={activeTab === t.key
                  ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '12.5px', fontWeight: 600, boxShadow: '0 2px 10px rgba(99,102,241,0.3)' }
                  : { background: 'var(--hi-chip-bg)', color: 'var(--hi-text-dim)', fontSize: '12.5px', border: '1px solid var(--hi-card-border)' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto pb-20">
        {activeTab === 'combined' ? (
          <div>
            {/* Graph */}
            <div className="mx-3 mt-3 rounded-3xl overflow-hidden"
              style={{ background: 'var(--hi-card-bg)', backdropFilter: 'blur(14px)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
              {graphNotes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <GitBranch size={40} style={{ color: '#C4B5FD' }} />
                  <p className="mt-3" style={{ color: 'var(--hi-text-primary)', fontSize: '16px', fontWeight: 700 }}>暂无知识图谱</p>
                  <p className="mt-1" style={{ color: '#9CA3AF', fontSize: '13px' }}>先去思库记录一些笔记吧</p>
                  <button onClick={() => navigate('/siku/create')} className="mt-4 px-5 py-2 rounded-2xl"
                    style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '13px', fontWeight: 600 }}>
                    立即创建
                  </button>
                </div>
              ) : (
                <KnowledgeGraphCanvas
                  notes={graphNotes}
                  mode={mode}
                  onNodeClick={handleNodeClick}
                  highlightType={highlightType}
                  noteEntityMap={noteEntityMap}
                  singleGraph={mode === 'all' ? null : (singleGraphMap[mode] || null)}
                />
              )}
            </div>

            {/* Legend */}
            <div className="mx-3 mt-3 rounded-2xl overflow-hidden" style={{ background: 'var(--hi-card-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--hi-card-border)' }}>

              {/* ── Header (toggle) ── */}
              <motion.button
                className="w-full px-4 pt-4 pb-3 flex items-center justify-between"
                style={{ borderBottom: legendOpen ? '1px solid rgba(99,102,241,0.07)' : 'none' }}
                onClick={() => setLegendOpen(v => !v)}
                whileTap={{ scale: 0.98 }}
              >
                <div className="text-left">
                  <p style={{ color: '#9CA3AF', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>图谱说明</p>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800, marginTop: '1px' }}>了解如何与图谱交互</p>
                </div>
                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {!legendOpen && (
                      <motion.div
                        initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 6 }}
                        transition={{ duration: 0.18 }}
                        className="flex items-center gap-1"
                      >
                        {['👆', '✋', '🔍'].map((icon, i) => (
                          <span key={i} style={{ fontSize: '13px' }}>{icon}</span>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(99,102,241,0.08)' }}>
                    <motion.div
                      animate={{ rotate: legendOpen ? 180 : 0 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 4L6 8L10 4" stroke="#6366F1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </motion.div>
                  </div>
                </div>
              </motion.button>

              {/* ── Collapsible body ── */}
              <AnimatePresence initial={false}>
                {legendOpen && (
                  <motion.div
                    key="legend-body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                    style={{ overflow: 'hidden' }}
                  >

              {/* ── Section 1: Node types ── */}
              <div className="px-4 pt-3 pb-3.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
                <p style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>节点类型</p>
                <div className="grid grid-cols-2 gap-2.5">

                  {/* Note node */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
                    className="p-3 rounded-xl cursor-pointer select-none"
                    style={{
                      background: highlightType === 'note' ? 'rgba(99,102,241,0.14)' : 'rgba(99,102,241,0.06)',
                      border: highlightType === 'note' ? '1.5px solid rgba(99,102,241,0.5)' : '1px solid rgba(99,102,241,0.1)',
                      boxShadow: highlightType === 'note' ? '0 0 12px rgba(99,102,241,0.22)' : 'none',
                      transition: 'all 0.22s ease',
                    }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => triggerHighlight('note')}
                  >
                    <div className="flex items-end justify-center gap-1.5 mb-2.5" style={{ height: 32 }}>
                      {[11, 17, 25].map((size, i) => (
                        <motion.div
                          key={i}
                          animate={{ scale: [1, 1.18, 1], opacity: [0.65, 1, 0.65] }}
                          transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.38 }}
                          className="rounded-full flex-shrink-0"
                          style={{ width: size, height: size, background: 'linear-gradient(135deg, #818CF8, #6366F1)' }}
                        />
                      ))}
                    </div>
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '11.5px', fontWeight: 700 }}>笔记节点</p>
                    <p style={{ color: highlightType === 'note' ? '#6366F1' : '#9CA3AF', fontSize: '10px', marginTop: '2px', transition: 'color 0.2s' }}>
                      {highlightType === 'note' ? '▲ 图谱高亮中…' : '点击在图谱高亮'}
                    </p>
                  </motion.div>

                  {/* Tag node */}
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                    className="p-3 rounded-xl cursor-pointer select-none"
                    style={{
                      background: highlightType === 'tag' ? 'rgba(16,185,129,0.14)' : 'rgba(16,185,129,0.06)',
                      border: highlightType === 'tag' ? '1.5px solid rgba(16,185,129,0.5)' : '1px solid rgba(16,185,129,0.12)',
                      boxShadow: highlightType === 'tag' ? '0 0 12px rgba(16,185,129,0.22)' : 'none',
                      transition: 'all 0.22s ease',
                    }}
                    whileTap={{ scale: 0.93 }}
                    onClick={() => triggerHighlight('tag')}
                  >
                    <div className="relative flex items-center justify-center mb-2.5" style={{ height: 32 }}>
                      <motion.div
                        animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 2, repeat: Infinity }}
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #34D399, #10B981)', zIndex: 2, position: 'relative' }}
                      >
                        <span style={{ color: 'white', fontSize: '9px', fontWeight: 800 }}>#</span>
                      </motion.div>
                      {[0, 1, 2].map(i => {
                        const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
                        return (
                          <motion.div
                            key={i}
                            animate={{ opacity: [0.35, 1, 0.35] }}
                            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.52 }}
                            className="absolute w-2.5 h-2.5 rounded-full"
                            style={{
                              background: '#6366F1',
                              left: `calc(50% + ${Math.cos(angle) * 16}px - 5px)`,
                              top: `calc(50% + ${Math.sin(angle) * 16}px - 5px)`,
                            }}
                          />
                        );
                      })}
                    </div>
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '11.5px', fontWeight: 700 }}>标签节点</p>
                    <p style={{ color: highlightType === 'tag' ? '#10B981' : '#9CA3AF', fontSize: '10px', marginTop: '2px', transition: 'color 0.2s' }}>
                      {highlightType === 'tag' ? '▲ 图谱高亮中…' : '点击在图谱高亮'}
                    </p>
                  </motion.div>
                </div>
              </div>

              {/* ── Section 2: Click result previews ── */}
              <div className="px-4 pt-3 pb-3.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
                <p style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>点击节点 → 弹出详情</p>

                {/* Note click mock */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 }}
                  className="mb-2.5 rounded-xl overflow-hidden"
                  style={{ border: '1px solid rgba(99,102,241,0.18)' }}
                >
                  <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(99,102,241,0.08)' }}>
                    <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #818CF8, #6366F1)' }} />
                    <span style={{ color: '#6366F1', fontSize: '10.5px', fontWeight: 700 }}>点击笔记节点</span>
                    <motion.div
                      className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                      animate={{ scale: [1, 1.6, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                      style={{ background: '#6366F1' }}
                    />
                  </div>
                  <div className="px-3 py-2.5" style={{ background: 'var(--hi-msg-ai-bg)' }}>
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '11px', fontWeight: 700 }}>笔记标题</p>
                    <p style={{ color: '#9CA3AF', fontSize: '9.5px', marginTop: '3px', lineHeight: 1.55 }}>笔记内容摘要预览，点击后可阅读全文…</p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <div className="px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)' }}>
                        <span style={{ color: '#6366F1', fontSize: '9px', fontWeight: 500 }}>#标签</span>
                      </div>
                      <div className="px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.1)' }}>
                        <span style={{ color: '#6366F1', fontSize: '9px', fontWeight: 500 }}>#关键词</span>
                      </div>
                      <div className="ml-auto px-2 py-0.5 rounded-full" style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)' }}>
                        <span style={{ color: 'white', fontSize: '9px', fontWeight: 700 }}>打开笔记 →</span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Tag click mock */}
                <motion.div
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.26 }}
                  className="rounded-xl overflow-hidden"
                  style={{ border: '1px solid rgba(16,185,129,0.2)' }}
                >
                  <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'rgba(16,185,129,0.08)' }}>
                    <div className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#10B981' }}>
                      <span style={{ color: 'white', fontSize: '8px', fontWeight: 800 }}>#</span>
                    </div>
                    <span style={{ color: '#059669', fontSize: '10.5px', fontWeight: 700 }}>点击标签节点</span>
                    <motion.div
                      className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                      animate={{ scale: [1, 1.6, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.4, repeat: Infinity, delay: 0.5 }}
                      style={{ background: '#10B981' }}
                    />
                  </div>
                  <div className="px-3 py-2.5" style={{ background: 'var(--hi-msg-ai-bg)' }}>
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '11px', fontWeight: 700 }}>#知识管理</p>
                    <p style={{ color: '#9CA3AF', fontSize: '9.5px', marginTop: '2px' }}>3 篇笔记使用此标签</p>
                    <div className="mt-2 space-y-1">
                      {['读书笔记', 'AI探索', '思考框架'].map((n, i) => (
                        <div key={i} className="px-2 py-1 rounded-lg flex items-center gap-1.5" style={{ background: 'rgba(16,185,129,0.06)' }}>
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#10B981' }} />
                          <span style={{ color: '#374151', fontSize: '9.5px' }}>{n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* ── Section 3: Edge relationship labels ── */}
              <div className="px-4 pt-3 pb-3.5" style={{ borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
                <p style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>连线关系标注</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: '属于', color: '#6366F1' },
                    { label: '共2标签', color: '#3B82F6' },
                    { label: '含标签', color: '#8B5CF6' },
                    { label: '相关笔记', color: '#EC4899' },
                  ].map((pill, i) => (
                    <motion.div
                      key={pill.label}
                      initial={{ opacity: 0, scale: 0.75 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.08 + i * 0.07, type: 'spring', stiffness: 300 }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{ background: `${pill.color}12`, border: `1px solid ${pill.color}38` }}
                    >
                      <div style={{ width: 14, height: 2, background: pill.color, borderRadius: 2, flexShrink: 0 }} />
                      <span style={{ color: pill.color, fontSize: '10px', fontWeight: 600 }}>{pill.label}</span>
                    </motion.div>
                  ))}
                </div>
                <p style={{ color: '#9CA3AF', fontSize: '9.5px', marginTop: '8px', lineHeight: 1.5 }}>
                  连线中点的胶囊标注表示两个节点之间的关系类型
                </p>
              </div>

              {/* ── Section 4: Interaction tips ── */}
              <div className="px-4 pt-3 pb-4">
                <p style={{ color: '#9CA3AF', fontSize: '9.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>交互操作</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { icon: '👆', title: '点击节点', desc: '弹出详情面板', color: '#6366F1' },
                    { icon: '✋', title: '拖拽节点', desc: '自由调整布局', color: '#8B5CF6' },
                    { icon: '🔍', title: '缩放图谱', desc: '右下角 ＋ / − 按钮', color: '#3B82F6' },
                    { icon: '🎯', title: '悬停节点', desc: '虚线高亮 + 变色', color: '#06B6D4' },
                  ].map((tip, i) => (
                    <motion.div
                      key={tip.title}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.08 + i * 0.08 }}
                      whileTap={{ scale: 0.94 }}
                      className="p-2.5 rounded-xl flex items-start gap-2"
                      style={{ background: `${tip.color}08`, border: `1px solid ${tip.color}18` }}
                    >
                      <span style={{ fontSize: '14px', lineHeight: 1, flexShrink: 0 }}>{tip.icon}</span>
                      <div>
                        <p style={{ color: '#374151', fontSize: '11px', fontWeight: 700 }}>{tip.title}</p>
                        <p style={{ color: '#9CA3AF', fontSize: '9.5px', marginTop: '1px' }}>{tip.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Tag stats */}
            {tagStats.length > 0 && (
              <div className="mx-3 mt-3 p-4 rounded-2xl" style={{ background: 'var(--hi-card-bg)', backdropFilter: 'blur(12px)', border: '1px solid var(--hi-card-border)' }}>
                <p style={{ color: '#6B7280', fontSize: '11px', fontWeight: 600, marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>标签热力分布</p>
                <div className="space-y-2.5">
                  {tagStats.slice(0, 6).map((ts, i) => (
                    <div key={ts.tag} className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 w-20 flex-shrink-0">
                        <Tag size={11} style={{ color: getColor(i) }} />
                        <span style={{ color: '#374151', fontSize: '12px', fontWeight: 600 }}>#{ts.tag}</span>
                      </div>
                      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(99,102,241,0.08)' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${(ts.count / Math.max(graphNotes.length, 1)) * 100}%` }}
                          transition={{ delay: i * 0.1, duration: 0.6, ease: 'easeOut' }}
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(to right, ${getColor(i)}, ${getColor(i + 1)})` }}
                        />
                      </div>
                      <span style={{ color: '#9CA3AF', fontSize: '11px', width: '32px', textAlign: 'right' }}>{ts.count}篇</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Single note mode
          <div className="px-3 pt-3 space-y-2.5">
            <p style={{ color: '#6B7280', fontSize: '11.5px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              选择笔记查看单篇图谱
            </p>
            {graphNotes.map((note, i) => (
              <motion.button
                key={note.id}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setMode(note.id)}
                className="w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]"
                style={{
                  background: mode === note.id ? 'rgba(99,102,241,0.08)' : 'var(--hi-card-bg)',
                  backdropFilter: 'blur(12px)',
                  border: mode === note.id ? '1.5px solid rgba(99,102,241,0.3)' : '1px solid var(--hi-card-border)',
                  boxShadow: mode === note.id ? '0 4px 16px rgba(99,102,241,0.12)' : '0 2px 10px rgba(99,102,241,0.05)',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${getColor(i)}20` }}>
                    <FileText size={18} style={{ color: getColor(i) }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 700 }} className="truncate">
                      {note.title || note.content.slice(0, 20) + '…'}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {normalizeNoteTags(note.tags).slice(0, 3).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 rounded-full"
                          style={{ background: `${getColor(i)}15`, color: getColor(i), fontSize: '10px', fontWeight: 500 }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: mode === note.id ? '#6366F1' : '#D1D5DB' }} />
                </div>
              </motion.button>
            ))}

            {/* Graph for selected note */}
            <AnimatePresence>
              {mode !== 'all' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-3xl overflow-hidden mt-2"
                    style={{ background: 'var(--hi-card-bg)', backdropFilter: 'blur(14px)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
                    <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                      <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 700 }}>
                        {notes.find(n => n.id === mode)?.title || '笔记图谱'}
                      </p>
                      <button onClick={() => setMode('all')} className="w-7 h-7 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(99,102,241,0.08)' }}>
                        <X size={13} style={{ color: '#6366F1' }} />
                      </button>
                    </div>
                    <KnowledgeGraphCanvas
                      notes={graphNotes}
                      mode={mode}
                      onNodeClick={handleNodeClick}
                      highlightType={highlightType}
                      noteEntityMap={noteEntityMap}
                      singleGraph={mode === 'all' ? null : (singleGraphMap[mode] || null)}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Node detail popup */}
        <AnimatePresence>
          {selectedNode && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 flex items-end justify-center"
              style={{ background: 'rgba(30,27,75,0.35)', backdropFilter: 'blur(6px)' }}
              onClick={() => setSelectedNode(null)}
            >
              <motion.div
                initial={{ y: 60, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', damping: 26 }}
                className="w-full max-w-lg mx-3 mb-24 rounded-3xl overflow-hidden"
                style={{ background: 'var(--hi-sheet-bg)', backdropFilter: 'blur(20px)' }}
                onClick={e => e.stopPropagation()}
              >
                <div className="p-5">
                  {selectedNode.startsWith('tag_') ? (
                    <>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-11 h-11 rounded-2xl flex items-center justify-center"
                          style={{ background: 'rgba(139,92,246,0.1)' }}>
                          <Tag size={20} style={{ color: '#8B5CF6' }} />
                        </div>
                        <div>
                          <p style={{ color: 'var(--hi-text-primary)', fontSize: '17px', fontWeight: 800 }}>
                            #{selectedNode.replace('tag_', '')}
                          </p>
                          <p style={{ color: '#9CA3AF', fontSize: '12px' }}>
                            {graphNotes.filter(n => normalizeNoteTags(n.tags).includes(selectedNode.replace('tag_', ''))).length} 篇笔记使用此标签
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {graphNotes.filter(n => normalizeNoteTags(n.tags).includes(selectedNode.replace('tag_', ''))).map(n => (
                          <button key={n.id} onClick={() => { navigate(`/siku/${n.id}`); setSelectedNode(null); }}
                            className="w-full text-left p-3 rounded-2xl"
                            style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.1)' }}>
                            <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 600 }}>{n.title || n.content.slice(0, 30) + '…'}</p>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : selectedNote ? (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <p style={{ color: 'var(--hi-text-primary)', fontSize: '17px', fontWeight: 800 }}>
                          {selectedNote.title || '无标题'}
                        </p>
                        <button onClick={() => setSelectedNode(null)}>
                          <X size={16} style={{ color: '#9CA3AF' }} />
                        </button>
                      </div>
                      <p style={{ color: '#4B5563', fontSize: '13.5px', lineHeight: 1.7 }} className="line-clamp-3">
                        {selectedNote.content}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {normalizeNoteTags(selectedNote.tags).map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '11px', fontWeight: 500 }}>
                            #{tag}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => { navigate(`/siku/${selectedNote.id}`); setSelectedNode(null); }}
                        className="mt-4 w-full py-3 rounded-2xl text-center"
                        style={{ background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '14px', fontWeight: 600 }}>
                        打开笔记
                      </button>
                    </>
                  ) : null}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <BottomNav />

      {/* Graph-gen overlay — rendered via portal when a note was just saved */}
      {graphGenInfo && (
        <GraphGenOverlay
          info={graphGenInfo}
          onDone={() => setGraphGenInfo(null)}
        />
      )}
    </div>
  );
}


export function SiChain() {
  const navigate = useNavigate();
  const { notes } = useNotes();

  const [mainTab, setMainTab] = useState<'unified' | 'doc'>('unified');

  const [graphGenInfo, setGraphGenInfo] = useState<GraphGenInfo | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(GG_KEY);
      if (!raw) return;
      const info: GraphGenInfo = JSON.parse(raw);
      if (Date.now() - info.ts < 15000) setGraphGenInfo(info);
      localStorage.removeItem(GG_KEY);
    } catch {}
  }, []);

  const [unifiedGraph, setUnifiedGraph] = useState<GraphDTOv1Normalized | null>(null);
  const [unifiedLoading, setUnifiedLoading] = useState(false);
  const [unifiedError, setUnifiedError] = useState<string | null>(null);
  const [unifiedQuery, setUnifiedQuery] = useState('');
  const [unifiedSelection, setUnifiedSelection] = useState<V1Selection | null>(null);
  const [unifiedLegendOpen, setUnifiedLegendOpen] = useState(false);
  const [unifiedCenterReq, setUnifiedCenterReq] = useState<string | null>(null);

  const loadUnified = useCallback(async (force?: boolean) => {
    if (unifiedLoading) return;
    if (unifiedGraph && !force) return;
    setUnifiedLoading(true);
    setUnifiedError(null);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const resp = await api.get('/kg/unified/graph');
      const payload = extractGraphPayload(resp.data);
      setUnifiedGraph(normalizeGraphDTOv1(payload ?? {}));
    } catch (e) {
      setUnifiedGraph(null);
      setUnifiedError(e instanceof Error ? e.message : '加载失败');
      await reportTelemetryEvent({
        name: 'sichain_mobile_graph_fetch_failed',
        data: { endpoint: '/kg/unified/graph', message: e instanceof Error ? e.message : String(e) },
      });
    } finally {
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
      if (elapsed > 4000) {
        await reportTelemetryEvent({
          name: 'sichain_mobile_graph_fetch_slow',
          data: { endpoint: '/kg/unified/graph', elapsedMs: Math.round(elapsed) },
        });
      }
      setUnifiedLoading(false);
    }
  }, [unifiedGraph, unifiedLoading]);

  useEffect(() => {
    if (mainTab !== 'unified') return;
    loadUnified(false);
  }, [loadUnified, mainTab]);

  const unifiedMatches = useMemo(() => {
    if (!unifiedGraph) return [];
    const set = computeMatchedNodeIds(
      unifiedGraph.entities.map((e) => ({ id: e.id, name: e.name, description: e.description })),
      unifiedQuery
    );
    if (!set || set.size === 0) return [];
    return unifiedGraph.entities.filter((e) => set.has(e.id)).slice(0, 8);
  }, [unifiedGraph, unifiedQuery]);

  type SingleSourceType = 'doc' | 'note';

  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [docPickerOpen, setDocPickerOpen] = useState(false);
  const [docPickerType, setDocPickerType] = useState<SingleSourceType>('doc');
  const [docPickerQuery, setDocPickerQuery] = useState('');
  const [selectedSourceType, setSelectedSourceType] = useState<SingleSourceType>('doc');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const selectedSourceKey = selectedSourceId ? `${selectedSourceType}:${selectedSourceId}` : '';

  const [docGraphMap, setDocGraphMap] = useState<Record<string, GraphDTOv1Normalized>>({});
  const [docErrorMap, setDocErrorMap] = useState<Record<string, string>>({});
  const [docLoadingId, setDocLoadingId] = useState<string | null>(null);
  const [docQuery, setDocQuery] = useState('');
  const [docSelection, setDocSelection] = useState<V1Selection | null>(null);
  const [docLegendOpen, setDocLegendOpen] = useState(false);
  const [docCenterReq, setDocCenterReq] = useState<string | null>(null);

  const selectedDoc = useMemo(() => {
    if (selectedSourceType !== 'doc') return null;
    if (!selectedSourceId) return null;
    return documents.find((d) => String(d.id) === String(selectedSourceId)) ?? null;
  }, [documents, selectedSourceId, selectedSourceType]);

  const selectedNote = useMemo(() => {
    if (selectedSourceType !== 'note') return null;
    if (!selectedSourceId) return null;
    return notes.find((n) => String(n.id) === String(selectedSourceId)) ?? null;
  }, [notes, selectedSourceId, selectedSourceType]);

  const singleGraph = selectedSourceKey ? (docGraphMap[selectedSourceKey] ?? null) : null;
  const singleError = selectedSourceKey ? (docErrorMap[selectedSourceKey] ?? null) : null;
  const singleLoading = Boolean(selectedSourceKey && docLoadingId === selectedSourceKey);

  const loadDocuments = useCallback(async () => {
    if (documentsLoading || documentsLoaded) return;
    setDocumentsLoading(true);
    try {
      const rows = await documentsLibraryService.list();
      setDocuments(Array.isArray(rows) ? rows : []);
      setDocumentsLoaded(true);
    } catch {
      setDocuments([]);
      setDocumentsLoaded(true);
    } finally {
      setDocumentsLoading(false);
    }
  }, [documentsLoaded, documentsLoading]);

  useEffect(() => {
    if (mainTab !== 'doc') return;
    loadDocuments();
  }, [loadDocuments, mainTab]);

  const loadSingleGraph = useCallback(async (sourceType: SingleSourceType, sourceId: string, force?: boolean) => {
    const id = String(sourceId || '').trim();
    if (!id) return;
    const key = `${sourceType}:${id}`;
    if (!force && docGraphMap[key]) return;
    if (docLoadingId === key) return;
    setDocLoadingId(key);
    setDocErrorMap((prev) => ({ ...prev, [key]: '' }));
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    try {
      const endpoint = sourceType === 'doc' ? `/kg/doc/${id}/graph` : `/kg/note/${id}/graph`;
      const resp = await api.get(endpoint, sourceType === 'note' ? { timeout: 60000 } : undefined);
      const payload = extractGraphPayload(resp.data);
      setDocGraphMap((prev) => ({ ...prev, [key]: normalizeGraphDTOv1(payload ?? { scope: sourceType, entities: [], relations: [] }) }));
    } catch (e) {
      setDocGraphMap((prev) => ({ ...prev, [key]: normalizeGraphDTOv1({ scope: sourceType, entities: [], relations: [] }) }));
      setDocErrorMap((prev) => ({ ...prev, [key]: e instanceof Error ? e.message : '加载失败' }));
      await reportTelemetryEvent({
        name: 'sichain_mobile_graph_fetch_failed',
        data: {
          endpoint: sourceType === 'doc' ? '/kg/doc/:docId/graph' : '/kg/note/:noteId/graph',
          sourceType,
          sourceId: id,
          message: e instanceof Error ? e.message : String(e)
        },
      });
    } finally {
      const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startedAt;
      if (elapsed > 4000) {
        await reportTelemetryEvent({
          name: 'sichain_mobile_graph_fetch_slow',
          data: {
            endpoint: sourceType === 'doc' ? '/kg/doc/:docId/graph' : '/kg/note/:noteId/graph',
            sourceType,
            sourceId: id,
            elapsedMs: Math.round(elapsed)
          },
        });
      }
      setDocLoadingId(null);
    }
  }, [docGraphMap, docLoadingId]);

  useEffect(() => {
    if (mainTab !== 'doc') return;
    if (!selectedSourceId) return;
    loadSingleGraph(selectedSourceType, selectedSourceId, false);
  }, [loadSingleGraph, mainTab, selectedSourceId, selectedSourceType]);

  const docMatches = useMemo(() => {
    if (!singleGraph) return [];
    const set = computeMatchedNodeIds(
      singleGraph.entities.map((e) => ({ id: e.id, name: e.name, description: e.description })),
      docQuery
    );
    if (!set || set.size === 0) return [];
    return singleGraph.entities.filter((e) => set.has(e.id)).slice(0, 8);
  }, [docQuery, singleGraph]);

  const headerPill = useMemo(() => {
    if (mainTab === 'unified') return unifiedGraph ? `${unifiedGraph.entities.length} 实体 · ${unifiedGraph.relations.length} 关系` : '全局图谱';
    if (mainTab === 'doc') return singleGraph ? `${singleGraph.entities.length} 实体 · ${singleGraph.relations.length} 关系` : '单篇视角';
    return '';
  }, [mainTab, singleGraph, unifiedGraph]);

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: 'var(--hi-page-bg)' }}>
      <ParticleBackground count={80} />
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-5%] right-[-5%] w-[280px] h-[280px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--hi-glow-top) 0%, transparent 65%)' }} />
      </div>

      <div className="relative z-20 flex-shrink-0"
        style={{
          background: 'var(--hi-header-bg)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid var(--hi-header-border)',
          paddingTop: 'calc(env(safe-area-inset-top) + 8px)'
        }}>
        <div className="px-5 pb-3 pt-1">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p style={{ color: '#8B5CF6', fontSize: '12px', fontWeight: 500 }}>知识关联可视化</p>
              <h1 style={{ color: 'var(--hi-text-primary)', fontSize: '24px', fontWeight: 800, letterSpacing: '-0.02em' }}>思链</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-xl" style={{ background: 'rgba(99,102,241,0.08)' }}>
                <span style={{ color: '#6366F1', fontSize: '12px', fontWeight: 700 }}>{headerPill}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {[
              { key: 'unified', label: '全局图谱' },
              { key: 'doc', label: '单篇视角' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => {
                  setMainTab(t.key as any);
                  setUnifiedSelection(null);
                  setDocSelection(null);
                }}
                className="px-4 py-1.5 rounded-full transition-all"
                style={mainTab === t.key
                  ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '12.5px', fontWeight: 700, boxShadow: '0 2px 10px rgba(99,102,241,0.3)' }
                  : { background: 'var(--hi-chip-bg)', color: 'var(--hi-text-dim)', fontSize: '12.5px', border: '1px solid var(--hi-card-border)' }
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto pb-20">
        {mainTab === 'unified' && (
          <div>
            <div className="mx-3 mt-3 p-4 rounded-3xl" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.10)' }}>
                    <Search size={16} style={{ color: '#6366F1' }} />
                  </div>
                  <div>
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 900 }}>搜索节点</p>
                    <p style={{ color: '#9CA3AF', fontSize: '11px' }}>匹配名称/描述并可定位</p>
                  </div>
                </div>
                <button
                  className="px-3 py-1.5 rounded-xl"
                  style={{ background: 'rgba(99,102,241,0.08)', color: '#6366F1', fontSize: '12px', fontWeight: 800 }}
                  onClick={() => loadUnified(true)}
                >
                  刷新
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)' }}>
                <Search size={14} style={{ color: '#9CA3AF' }} />
                <input
                  value={unifiedQuery}
                  onChange={(e) => setUnifiedQuery(e.target.value)}
                  placeholder="输入关键词，如：概念、流程、因果…"
                  className="flex-1 bg-transparent outline-none"
                  style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 600 }}
                />
                {unifiedQuery.trim() && (
                  <button onClick={() => setUnifiedQuery('')} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.08)' }}>
                    <X size={13} style={{ color: '#6366F1' }} />
                  </button>
                )}
              </div>

              {unifiedQuery.trim() && (
                <div className="mt-3 space-y-2">
                  {unifiedMatches.length === 0 ? (
                    <p style={{ color: '#9CA3AF', fontSize: '12px' }}>无匹配节点</p>
                  ) : (
                    unifiedMatches.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 p-3 rounded-2xl" style={{ background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.10)' }}>
                        <div className="min-w-0">
                          <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800 }}>{e.name}</p>
                          <p className="truncate" style={{ color: '#9CA3AF', fontSize: '11px', marginTop: 2 }}>{e.description || '暂无描述'}</p>
                        </div>
                        <button
                          onClick={() => {
                            setUnifiedSelection({ kind: 'entity', id: e.id });
                            setUnifiedCenterReq(e.id);
                          }}
                          className="px-3 py-2 rounded-xl flex items-center gap-1.5"
                          style={{ background: 'rgba(99,102,241,0.10)', color: '#6366F1', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}
                        >
                          <MapPin size={14} />
                          定位
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="mx-3 mt-3">
              {unifiedLoading ? (
                <div className="rounded-3xl p-6" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <p style={{ color: '#9CA3AF', fontSize: '12px' }}>正在加载 Unified 图谱…</p>
                </div>
              ) : unifiedError ? (
                <div className="rounded-3xl p-6" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>加载失败</p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: 6 }}>{unifiedError}</p>
                </div>
              ) : (
                <GraphDTOv1Canvas
                  graph={unifiedGraph}
                  query={unifiedQuery}
                  selected={unifiedSelection}
                  onSelect={setUnifiedSelection}
                  centerRequestId={unifiedCenterReq}
                  onCentered={() => setUnifiedCenterReq(null)}
                />
              )}
            </div>

            <GraphDTOv1Legend open={unifiedLegendOpen} onToggle={() => setUnifiedLegendOpen((v) => !v)} />
            <GraphDTOv1DetailSheet graph={unifiedGraph} selection={unifiedSelection} onClose={() => setUnifiedSelection(null)} />
          </div>
        )}

        {mainTab === 'doc' && (
          <div>
            <div className="mx-3 mt-3 p-4 rounded-3xl" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)', boxShadow: 'var(--hi-card-shadow)' }}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-2xl flex items-center justify-center" style={{ background: selectedSourceType === 'doc' ? 'rgba(59,130,246,0.10)' : 'rgba(99,102,241,0.10)' }}>
                    {selectedSourceType === 'doc' ? (
                      <FileText size={16} style={{ color: '#3B82F6' }} />
                    ) : (
                      <Layers size={16} style={{ color: '#6366F1' }} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 900 }}>选择内容</p>
                    <p className="truncate" style={{ color: '#9CA3AF', fontSize: '11px' }}>
                      {selectedSourceType === 'doc'
                        ? (selectedDoc ? (selectedDoc.title || selectedDoc.id) : documentsLoading ? '加载中…' : '未选择')
                        : (selectedNote ? (selectedNote.title || selectedNote.content?.slice?.(0, 18) || selectedNote.id) : notes.length ? '未选择' : '暂无笔记')}
                    </p>
                  </div>
                </div>
                <button
                  className="px-3 py-1.5 rounded-xl flex items-center gap-1.5"
                  style={{ background: 'rgba(59,130,246,0.10)', color: '#3B82F6', fontSize: '12px', fontWeight: 800 }}
                  onClick={() => { setDocPickerType(selectedSourceType); setDocPickerOpen(true); }}
                >
                  <ChevronRight size={14} />
                  选择
                </button>
              </div>

              <div className="mt-3 flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)' }}>
                <Search size={14} style={{ color: '#9CA3AF' }} />
                <input
                  value={docQuery}
                  onChange={(e) => setDocQuery(e.target.value)}
                  placeholder="搜索节点（名称/描述）"
                  className="flex-1 bg-transparent outline-none"
                  style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 600 }}
                />
                {docQuery.trim() && (
                  <button onClick={() => setDocQuery('')} className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: 'rgba(59,130,246,0.10)' }}>
                    <X size={13} style={{ color: '#3B82F6' }} />
                  </button>
                )}
              </div>

              {docQuery.trim() && selectedSourceId && (
                <div className="mt-3 space-y-2">
                  {docMatches.length === 0 ? (
                    <p style={{ color: '#9CA3AF', fontSize: '12px' }}>无匹配节点</p>
                  ) : (
                    docMatches.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-2 p-3 rounded-2xl" style={{ background: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.10)' }}>
                        <div className="min-w-0">
                          <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 800 }}>{e.name}</p>
                          <p className="truncate" style={{ color: '#9CA3AF', fontSize: '11px', marginTop: 2 }}>{e.description || '暂无描述'}</p>
                        </div>
                        <button
                          onClick={() => {
                            setDocSelection({ kind: 'entity', id: e.id });
                            setDocCenterReq(e.id);
                          }}
                          className="px-3 py-2 rounded-xl flex items-center gap-1.5"
                          style={{ background: 'rgba(59,130,246,0.10)', color: '#3B82F6', fontSize: '12px', fontWeight: 800, flexShrink: 0 }}
                        >
                          <MapPin size={14} />
                          定位
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="mx-3 mt-3">
              {!selectedSourceId ? (
                <div className="rounded-3xl p-6" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>先选择一条内容</p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: 6 }}>可选择文档或笔记，选择后会加载图谱</p>
                </div>
              ) : singleLoading ? (
                <div className="rounded-3xl p-6" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <p style={{ color: '#9CA3AF', fontSize: '12px' }}>正在加载图谱…</p>
                </div>
              ) : singleError ? (
                <div className="rounded-3xl p-6" style={{ background: 'var(--hi-card-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>加载失败</p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: 6 }}>{singleError}</p>
                  <button
                    className="mt-4 px-4 py-2 rounded-2xl"
                    style={{ background: 'linear-gradient(135deg,#3B82F6,#06B6D4)', color: 'white', fontSize: '13px', fontWeight: 900 }}
                    onClick={() => loadSingleGraph(selectedSourceType, selectedSourceId, true)}
                  >
                    重试
                  </button>
                </div>
              ) : (
                <GraphDTOv1Canvas
                  graph={singleGraph}
                  query={docQuery}
                  selected={docSelection}
                  onSelect={setDocSelection}
                  centerRequestId={docCenterReq}
                  onCentered={() => setDocCenterReq(null)}
                />
              )}
            </div>

            <GraphDTOv1Legend open={docLegendOpen} onToggle={() => setDocLegendOpen((v) => !v)} />
            <GraphDTOv1DetailSheet graph={singleGraph} selection={docSelection} onClose={() => setDocSelection(null)} />
          </div>
        )}

      </div>

      <BottomNav />

      {graphGenInfo && (
        <GraphGenOverlay
          info={graphGenInfo}
          onDone={() => setGraphGenInfo(null)}
        />
      )}

      {docPickerOpen && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-end"
            style={{ background: 'var(--hi-overlay)', backdropFilter: 'blur(10px)' }}
            onClick={() => setDocPickerOpen(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 240 }}
              className="w-full max-w-lg rounded-t-3xl flex flex-col"
              style={{ background: 'var(--hi-sheet-bg)', maxHeight: '86vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full" style={{ background: 'var(--hi-sheet-handle)' }} />
              </div>
              <div className="flex items-center justify-between px-5 pt-3 pb-4 flex-shrink-0">
                <div>
                  <p style={{ color: 'var(--hi-text-primary)', fontSize: '20px', fontWeight: 900, letterSpacing: '-0.02em' }}>选择内容</p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', marginTop: 2 }}>共 {docPickerType === 'doc' ? documents.length : notes.length} 个</p>
                </div>
                <button onClick={() => setDocPickerOpen(false)} className="w-9 h-9 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(59,130,246,0.10)' }}>
                  <X size={16} style={{ color: '#3B82F6' }} />
                </button>
              </div>
              <div className="px-5 pb-3 flex-shrink-0">
                <div className="flex gap-2">
                  {([
                    { key: 'doc', label: '文档' },
                    { key: 'note', label: '笔记' },
                  ] as { key: SingleSourceType; label: string }[]).map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setDocPickerType(t.key)}
                      className="px-4 py-1.5 rounded-full transition-all"
                      style={docPickerType === t.key
                        ? { background: 'linear-gradient(135deg, #6366F1, #8B5CF6)', color: 'white', fontSize: '12.5px', fontWeight: 700, boxShadow: '0 2px 10px rgba(99,102,241,0.3)' }
                        : { background: 'var(--hi-chip-bg)', color: 'var(--hi-text-dim)', fontSize: '12.5px', border: '1px solid var(--hi-card-border)' }
                      }
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="px-5 pb-3 flex-shrink-0">
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-2xl" style={{ background: 'var(--hi-input-bg)', border: '1px solid var(--hi-card-border)' }}>
                  <Search size={14} style={{ color: '#9CA3AF' }} />
                  <input
                    value={docPickerQuery}
                    onChange={(e) => setDocPickerQuery(e.target.value)}
                    placeholder={docPickerType === 'doc' ? '搜索文档标题' : '搜索笔记标题/内容'}
                    className="flex-1 bg-transparent outline-none"
                    style={{ color: 'var(--hi-text-primary)', fontSize: '13px', fontWeight: 600 }}
                  />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-6">
                {docPickerType === 'doc' && documentsLoading ? (
                  <p style={{ color: '#9CA3AF', fontSize: '12px' }}>加载中…</p>
                ) : docPickerType === 'doc' && documents.length === 0 ? (
                  <p style={{ color: '#9CA3AF', fontSize: '12px' }}>暂无文档</p>
                ) : docPickerType === 'note' && notes.length === 0 ? (
                  <p style={{ color: '#9CA3AF', fontSize: '12px' }}>暂无笔记</p>
                ) : (
                  <div className="space-y-2">
                    {docPickerType === 'doc' ? (
                      documents
                        .filter((d) => {
                          const q = docPickerQuery.trim().toLowerCase();
                          if (!q) return true;
                          return String(d.title || '').toLowerCase().includes(q) || String(d.id || '').toLowerCase().includes(q);
                        })
                        .map((d) => {
                          const active = selectedSourceType === 'doc' && String(d.id) === String(selectedSourceId);
                          return (
                            <button
                              key={d.id}
                              onClick={() => {
                                const id = String(d.id);
                                setSelectedSourceType('doc');
                                setSelectedSourceId(id);
                                setDocSelection(null);
                                setDocCenterReq(null);
                                setDocPickerOpen(false);
                                loadSingleGraph('doc', id, false);
                              }}
                              className="w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]"
                              style={{
                                background: active ? 'rgba(59,130,246,0.10)' : 'rgba(59,130,246,0.04)',
                                border: active ? '1.5px solid rgba(59,130,246,0.30)' : '1px solid rgba(59,130,246,0.10)',
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                                  style={{ background: 'rgba(59,130,246,0.10)' }}>
                                  <FileText size={18} style={{ color: '#3B82F6' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>{d.title || d.id}</p>
                                  <p className="truncate" style={{ color: '#9CA3AF', fontSize: '11px', marginTop: 2 }}>{String(d.id)}</p>
                                </div>
                                {active && (
                                  <div className="px-2 py-1 rounded-full flex items-center gap-1"
                                    style={{ background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.25)' }}>
                                    <Check size={12} style={{ color: '#3B82F6' }} />
                                    <span style={{ color: '#3B82F6', fontSize: '10px', fontWeight: 900 }}>已选</span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })
                    ) : (
                      notes
                        .filter((n) => {
                          const q = docPickerQuery.trim().toLowerCase();
                          if (!q) return true;
                          return String(n.title || '').toLowerCase().includes(q)
                            || String(n.content || '').toLowerCase().includes(q)
                            || String(n.id || '').toLowerCase().includes(q);
                        })
                        .map((n) => {
                          const active = selectedSourceType === 'note' && String(n.id) === String(selectedSourceId);
                          const subtitle = String(n.content || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
                          return (
                            <button
                              key={n.id}
                              onClick={() => {
                                const id = String(n.id);
                                setSelectedSourceType('note');
                                setSelectedSourceId(id);
                                setDocSelection(null);
                                setDocCenterReq(null);
                                setDocPickerOpen(false);
                                loadSingleGraph('note', id, false);
                              }}
                              className="w-full text-left p-4 rounded-2xl transition-all active:scale-[0.98]"
                              style={{
                                background: active ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.04)',
                                border: active ? '1.5px solid rgba(99,102,241,0.30)' : '1px solid rgba(99,102,241,0.10)',
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
                                  style={{ background: 'rgba(99,102,241,0.10)' }}>
                                  <Layers size={18} style={{ color: '#6366F1' }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="truncate" style={{ color: 'var(--hi-text-primary)', fontSize: '14px', fontWeight: 900 }}>
                                    {n.title || (subtitle ? `${subtitle.slice(0, 18)}…` : n.id)}
                                  </p>
                                  <p className="truncate" style={{ color: '#9CA3AF', fontSize: '11px', marginTop: 2 }}>
                                    {subtitle ? subtitle.slice(0, 40) : String(n.id)}
                                  </p>
                                </div>
                                {active && (
                                  <div className="px-2 py-1 rounded-full flex items-center gap-1"
                                    style={{ background: 'rgba(99,102,241,0.14)', border: '1px solid rgba(99,102,241,0.25)' }}>
                                    <Check size={12} style={{ color: '#6366F1' }} />
                                    <span style={{ color: '#6366F1', fontSize: '10px', fontWeight: 900 }}>已选</span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
