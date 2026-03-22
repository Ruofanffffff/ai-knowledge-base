import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, ZoomIn, ZoomOut, RefreshCw, Loader2, Globe, FileText, BookOpen, Zap, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { useGraph } from '../hooks/useGraph';
import apiService from '../services/api';
import DocumentIndexDrawer from '../components/DocumentIndexDrawer';
import { getEntityTypeSemantic } from 'graph-core';

interface Document {
  id: string;
  title: string;
}

// 根据实体描述推断类型
function inferEntityType(label: string, description: string): string {
  const text = `${label} ${description}`.toLowerCase();
  if (/技术|工具|框架|平台|系统|软件|引擎|算法|模型|架构|协议|api|sdk/.test(text)) return 'technology';
  if (/理论|概念|原理|思想|定义|规则|标准|规范|策略|模式/.test(text)) return 'concept';
  if (/人|组织|团队|公司|机构|部门|用户|客户|作者/.test(text)) return 'person';
  if (/方法|流程|步骤|操作|实现|开发|构建|设计|优化|处理|分析|管理|应用|服务/.test(text)) return 'action';
  if (/目标|成果|效果|结果|产出|价值|收益|指标|质量|性能/.test(text)) return 'target';
  if (/领域|场景|行业|市场|环境|背景|方向|趋势/.test(text)) return 'domain';
  if (/数据|资源|文档|信息|内容|知识|文件|库|集/.test(text)) return 'data';
  return 'default';
}

// 力导向布局 — 使用容器实际尺寸
function forceLayout(
  nodes: { id: string; x: number; y: number; r: number }[],
  links: { source: string; target: string }[],
  width: number,
  height: number,
  iterations = 200
) {
  const cx = width / 2, cy = height / 2;
  const padding = 80;
  const n = nodes.length;
  if (n === 0) return;

  // 初始化：均匀圆形分布，半径更大
  const angleStep = (2 * Math.PI) / n;
  const initRadius = Math.min(width, height) * 0.35;
  nodes.forEach((node, i) => {
    node.x = cx + initRadius * Math.cos(angleStep * i + Math.random() * 0.3);
    node.y = cy + initRadius * Math.sin(angleStep * i + Math.random() * 0.3);
  });

  const idMap = new Map(nodes.map((n, i) => [n.id, i]));

  for (let iter = 0; iter < iterations; iter++) {
    const alpha = 1 - iter / iterations;
    const repulsion = 15000 * alpha;
    const attraction = 0.003 * alpha;
    const centerPull = 0.008 * alpha;

    // 斥力
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const minDist = nodes[i].r + nodes[j].r + 60;
        const force = repulsion / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].x += fx;
        nodes[i].y += fy;
        nodes[j].x -= fx;
        nodes[j].y -= fy;

        if (dist < minDist) {
          const overlap = (minDist - dist) / 2;
          nodes[i].x += (dx / dist) * overlap;
          nodes[i].y += (dy / dist) * overlap;
          nodes[j].x -= (dx / dist) * overlap;
          nodes[j].y -= (dy / dist) * overlap;
        }
      }
    }

    // 引力
    for (const link of links) {
      const si = idMap.get(link.source);
      const ti = idMap.get(link.target);
      if (si === undefined || ti === undefined) continue;
      const dx = nodes[ti].x - nodes[si].x;
      const dy = nodes[ti].y - nodes[si].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealDist = 180;
      const force = (dist - idealDist) * attraction;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      nodes[si].x += fx;
      nodes[si].y += fy;
      nodes[ti].x -= fx;
      nodes[ti].y -= fy;
    }

    // 向中心拉
    for (const node of nodes) {
      node.x += (cx - node.x) * centerPull;
      node.y += (cy - node.y) * centerPull;
    }

    // 每次迭代都做边界约束，防止飞出去
    for (const node of nodes) {
      node.x = Math.max(padding + node.r, Math.min(width - padding - node.r, node.x));
      node.y = Math.max(padding + node.r, Math.min(height - padding - node.r, node.y));
    }
  }
}

export function Graph() {
  const { 
    graphData, graphMeta, isLoading, error, viewMode, selectedDocId,
    setViewMode, setSelectedDocId, fetchUnifiedGraph, fetchDocGraph,
    unifiedStatus, unifiedStatusLoading, unifiedStatusError, fetchUnifiedStatus, triggerUnified
  } = useGraph();
  
  const loading = isLoading;
  const [graphNodes, setGraphNodes] = useState(graphData.nodes);
  const [graphLinks, setGraphLinks] = useState(graphData.links);
  const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [isNodeDragging, setIsNodeDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const nodeDragStartRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const panStartRef = useRef<{ clientX: number; clientY: number; startX: number; startY: number; startZoom: number } | null>(null);
  const interactionRef = useRef<{ type: 'none' | 'node' | 'pan'; moved: boolean } | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [indexDrawerDocId, setIndexDrawerDocId] = useState<string | null>(null);
  const [indexDrawerDocTitle, setIndexDrawerDocTitle] = useState<string | undefined>(undefined);
  const [unifiedActionMessage, setUnifiedActionMessage] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgSize, setSvgSize] = useState({ width: 1200, height: 800 });
  const prevUnifiedStatusRef = useRef<string | null>(null);
  
  // 监听容器尺寸变化
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setSvgSize({ width: Math.round(rect.width), height: Math.round(rect.height) });
        }
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);
  
  useEffect(() => {
    fetchUnifiedGraph();
    fetchDocuments();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchUnifiedStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (unifiedStatus?.status !== 'running') return;
    const id = window.setInterval(() => {
      fetchUnifiedStatus();
    }, 2500);
    return () => window.clearInterval(id);
  }, [unifiedStatus?.status, fetchUnifiedStatus]);

  useEffect(() => {
    const prev = prevUnifiedStatusRef.current;
    const next = unifiedStatus?.status || null;
    if (prev === 'running' && next === 'completed' && viewMode === 'unified') {
      fetchUnifiedGraph();
    }
    prevUnifiedStatusRef.current = next;
  }, [unifiedStatus?.status, viewMode, fetchUnifiedGraph]);
  
  const fetchDocuments = async () => {
    try {
      const response = await apiService.getDocuments();
      const docs = response.success ? (response.data || []) : [];
      setDocuments(docs.map((doc: any) => ({
        id: doc.id,
        title: doc.title || doc.name || 'Untitled'
      })));
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  useEffect(() => {
    if (viewMode !== 'per-document') return;
    if (selectedDocId) return;
    const firstDocId = documents[0]?.id;
    if (!firstDocId) return;
    setSelectedDocId(firstDocId);
    fetchDocGraph(firstDocId);
  }, [viewMode, selectedDocId, documents, setSelectedDocId, fetchDocGraph]);

  
  // 当 graphData 更新时，运行力导向布局
  useEffect(() => {
    if (graphData.nodes.length === 0) {
      // 只有在非加载状态下才清空节点，避免加载时的闪烁
      // 或者如果是首次加载（当前没有任何节点），也允许清空（保持空状态）
      if (!loading || graphNodes.length === 0) {
        setGraphNodes([]);
        setGraphLinks([]);
      }
      return;
    }

    // 计算度数
    const degree: Record<string, number> = {};
    graphData.links.forEach(link => {
      degree[link.source] = (degree[link.source] || 0) + 1;
      degree[link.target] = (degree[link.target] || 0) + 1;
    });

    // 准备布局节点
    const layoutNodes = graphData.nodes.map(node => {
      const count = degree[node.id] || 0;
      const r = 20 + count * 6;
      return { id: node.id, x: 0, y: 0, r };
    });

    // 运行力导向布局 — 使用实际容器尺寸
    forceLayout(layoutNodes, graphData.links, svgSize.width, svgSize.height);

    // 合并布局结果
    const posMap = new Map(layoutNodes.map(n => [n.id, { x: n.x, y: n.y, r: n.r }]));
    const newNodes = graphData.nodes.map(node => {
      const pos = posMap.get(node.id)!;
      const entityType = node.entityType || inferEntityType(node.label, node.description);
      const colorScheme = getEntityTypeSemantic(entityType);
      return { ...node, x: pos.x, y: pos.y, color: colorScheme.fill };
    });

    setGraphNodes(newNodes);
    setGraphLinks(graphData.links);
  }, [graphData, svgSize, loading, graphNodes.length]);

  // 计算节点增强数据
  const nodes = useMemo(() => {
    const degree: Record<string, number> = {};
    graphLinks.forEach(link => {
      degree[link.source] = (degree[link.source] || 0) + 1;
      degree[link.target] = (degree[link.target] || 0) + 1;
    });

    return graphNodes.map(node => {
      const count = degree[node.id] || 0;
      const r = 20 + count * 6;
      const entityType = node.entityType || inferEntityType(node.label, node.description);
      const colorScheme = getEntityTypeSemantic(entityType);
      const label = node.label.length > 8 ? node.label.substring(0, 8) + '…' : node.label;
      return { ...node, r, degree: count, entityType, colorScheme, displayLabel: label, fullLabel: node.label };
    });
  }, [graphNodes, graphLinks]);

  // 搜索过滤高亮
  const matchedNodeIds = useMemo(() => {
    if (!searchQuery.trim()) return null;
    const q = searchQuery.toLowerCase();
    return new Set(nodes.filter(n => n.fullLabel.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)).map(n => n.id));
  }, [searchQuery, nodes]);

  // 获取当前使用的颜色类型（用于图例）
  const usedTypes = useMemo(() => {
    const types = new Set(nodes.map(n => n.entityType));
    return Array.from(types).map(t => ({ type: t, ...getEntityTypeSemantic(t) }));
  }, [nodes]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

  const clientToWorld = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const viewW = svgSize.width / viewState.zoom;
    const viewH = svgSize.height / viewState.zoom;
    return {
      x: viewState.x + px * viewW,
      y: viewState.y + py * viewH,
    };
  }, [svgSize, viewState]);

  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    interactionRef.current = { type: 'node', moved: false };
    nodeDragStartRef.current = { clientX: e.clientX, clientY: e.clientY };
    setDraggedNode(nodeId);
    setIsNodeDragging(true);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (interactionRef.current && !interactionRef.current.moved) {
      const start =
        interactionRef.current.type === 'pan'
          ? panStartRef.current
          : interactionRef.current.type === 'node'
            ? nodeDragStartRef.current
            : null;
      if (start) {
        const dx = e.clientX - start.clientX;
        const dy = e.clientY - start.clientY;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          interactionRef.current = { ...interactionRef.current, moved: true };
        }
      }
    }

    if (isNodeDragging && draggedNode) {
      const p = clientToWorld(e.clientX, e.clientY);
      setGraphNodes(prev => prev.map(n => n.id === draggedNode ? { ...n, x: p.x, y: p.y } : n));
      return;
    }

    if (isPanning && panStartRef.current) {
      const start = panStartRef.current;
      const dx = e.clientX - start.clientX;
      const dy = e.clientY - start.clientY;
      setViewState(prev => ({
        ...prev,
        x: start.startX - dx / start.startZoom,
        y: start.startY - dy / start.startZoom,
      }));
    }
  }, [clientToWorld, draggedNode, isNodeDragging, isPanning]);

  const stopInteractions = useCallback(() => {
    setIsNodeDragging(false);
    setDraggedNode(null);
    setIsPanning(false);
    panStartRef.current = null;
    nodeDragStartRef.current = null;
    interactionRef.current = null;
  }, []);

  const handleMouseDownBackground = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    if (isNodeDragging) return;
    interactionRef.current = { type: 'pan', moved: false };
    panStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: viewState.x,
      startY: viewState.y,
      startZoom: viewState.zoom,
    };
    setIsPanning(true);
  }, [isNodeDragging, viewState.x, viewState.y, viewState.zoom]);

  const zoomAt = useCallback((clientX: number, clientY: number, factor: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;

    setViewState(prev => {
      const nextZoom = clamp(prev.zoom * factor, 0.3, 3);
      const prevViewW = svgSize.width / prev.zoom;
      const prevViewH = svgSize.height / prev.zoom;
      const worldX = prev.x + px * prevViewW;
      const worldY = prev.y + py * prevViewH;

      const nextViewW = svgSize.width / nextZoom;
      const nextViewH = svgSize.height / nextZoom;
      const nextX = worldX - px * nextViewW;
      const nextY = worldY - py * nextViewH;

      return { x: nextX, y: nextY, zoom: nextZoom };
    });
  }, [svgSize.width, svgSize.height]);

  const handleWheel = useCallback((e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.002);
      zoomAt(e.clientX, e.clientY, factor);
      return;
    }
    setViewState(prev => ({
      ...prev,
      x: prev.x + e.deltaX / prev.zoom,
      y: prev.y + e.deltaY / prev.zoom,
    }));
  }, [zoomAt]);

  const handleZoomIn = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1.2);
  };

  const handleZoomOut = () => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, 1 / 1.2);
  };

  const handleReset = () => {
    setViewState({ x: 0, y: 0, zoom: 1 });
    if (viewMode === 'unified') fetchUnifiedGraph();
    else if (selectedDocId) fetchDocGraph(selectedDocId);
  };

  const handleViewModeChange = (mode: 'unified' | 'per-document') => {
    setViewMode(mode);
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    setHoveredNode(null);
    setIndexDrawerDocId(null);
    setIndexDrawerDocTitle(undefined);
    if (mode === 'unified') { setSelectedDocId(null); fetchUnifiedGraph(); }
    else if (documents.length > 0) {
      const firstDocId = documents[0]?.id;
      if (firstDocId) { setSelectedDocId(firstDocId); fetchDocGraph(firstDocId); }
    }
  };

  const handleDocumentSelect = (docId: string) => {
    setSelectedDocId(docId);
    setSelectedNodeId(null);
    setSelectedLinkId(null);
    setHoveredNode(null);
    fetchDocGraph(docId);
    const doc = documents.find(d => d.id === docId);
    setIndexDrawerDocTitle(doc?.title);
  };

  const focusNodeId = selectedNodeId ?? hoveredNode;
  const focusLink = selectedLinkId ? (graphLinks.find(l => l.id === selectedLinkId) || null) : null;

  return (
    <>
    <div className="flex-1 h-full flex flex-col bg-slate-50 relative overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 right-4 md:right-6 z-10 flex justify-between pointer-events-none">
         <div className="flex gap-2">
           <div className="bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-xl p-1 flex gap-1 pointer-events-auto">
             <button 
               onClick={() => handleViewModeChange('unified')}
               className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'unified' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
             >
               <Globe size={16} /><span>统一图谱</span>
             </button>
             <button 
               onClick={() => handleViewModeChange('per-document')}
               className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${viewMode === 'per-document' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
             >
               <FileText size={16} /><span>分文章图谱</span>
             </button>
           </div>

           {viewMode === 'per-document' && (
             <div className="bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-xl pointer-events-auto flex items-center">
               <select
                 value={selectedDocId || ''}
                 onChange={(e) => handleDocumentSelect(e.target.value)}
                 className="px-4 py-2 rounded-xl text-sm outline-none bg-transparent cursor-pointer min-w-[200px]"
                 disabled={documents.length === 0}
               >
                 {documents.length === 0 ? (
                   <option value="">暂无文档</option>
                 ) : (
                   <>
                     <option value="" disabled>选择文档...</option>
                     {documents.map(doc => <option key={doc.id} value={doc.id}>{doc.title}</option>)}
                   </>
                 )}
               </select>
               {selectedDocId && (
                 <button
                   title="查看索引"
                   onClick={() => {
                     const doc = documents.find(d => d.id === selectedDocId);
                     setIndexDrawerDocId(selectedDocId);
                     setIndexDrawerDocTitle(doc?.title);
                   }}
                   className="p-2 mr-1 hover:bg-purple-50 rounded-lg text-slate-400 hover:text-purple-600 transition-colors"
                 >
                   <BookOpen size={16} />
                 </button>
               )}
             </div>
           )}

           <div className="bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-xl px-3 py-2 pointer-events-auto flex items-center gap-3 min-w-[220px]">
             <div className="min-w-0">
               <div className="flex items-center gap-2">
                 <span
                   className="text-xs font-semibold"
                   style={{
                     color:
                       unifiedStatus?.status === 'running'
                         ? '#2563eb'
                         : unifiedStatus?.status === 'completed'
                           ? '#059669'
                           : unifiedStatus?.status === 'failed'
                             ? '#dc2626'
                             : '#64748b',
                   }}
                   title={unifiedStatus?.error || unifiedStatusError || undefined}
                 >
                   {unifiedStatus?.status === 'running'
                     ? '统一归纳中…'
                     : unifiedStatus?.status === 'completed'
                       ? '统一归纳已完成'
                       : unifiedStatus?.status === 'failed'
                         ? '统一归纳失败'
                         : '统一归纳未运行'}
                 </span>
                 {unifiedStatus?.status === 'completed' && (
                   <span className="text-[10px] text-slate-400 whitespace-nowrap">
                     {unifiedStatus.entityCount || 0} 实体 · {unifiedStatus.relationCount || 0} 关系
                   </span>
                 )}
               </div>
               {(unifiedStatusError || unifiedActionMessage) && (
                 <div
                   className="text-[10px] mt-0.5 truncate"
                   style={{ color: unifiedStatusError ? '#dc2626' : '#64748b' }}
                   title={unifiedStatusError || unifiedActionMessage || undefined}
                 >
                   {unifiedStatusError || unifiedActionMessage}
                 </div>
               )}
             </div>

             <button
               onClick={async () => {
                 setUnifiedActionMessage(null);
                 const res = await triggerUnified();
                 if (!res.ok) {
                   setUnifiedActionMessage(res.message || (res.conflict ? '统一归纳正在执行中' : '触发失败'));
                   return;
                 }
                 setUnifiedActionMessage(res.message || '已触发统一归纳');
               }}
               disabled={unifiedStatusLoading || unifiedStatus?.status === 'running'}
               className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                 unifiedStatusLoading || unifiedStatus?.status === 'running'
                   ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                   : 'bg-purple-600 text-white hover:bg-purple-700'
               }`}
               title={unifiedStatus?.status === 'running' ? '统一归纳正在执行中' : '触发统一归纳'}
             >
               {unifiedStatusLoading ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
               <span>触发</span>
             </button>
           </div>

           <div className="bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-xl p-2 flex gap-2 pointer-events-auto">
              <button onClick={handleZoomIn} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600" title="放大"><ZoomIn size={16} /></button>
              <button onClick={handleZoomOut} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600" title="缩小"><ZoomOut size={16} /></button>
              <button onClick={handleReset} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600" title="重置">
                {isLoading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              </button>
           </div>
         </div>
         
         <div className="bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2 pointer-events-auto w-48 md:w-64">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              placeholder="搜索节点..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-transparent outline-none text-sm w-full"
            />
         </div>
      </div>
      
      {/* 仅在无数据时显示全屏加载 - 已移除，改为非阻塞 */}
      {/* {isLoading && graphNodes.length === 0 && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="text-center">
            <Loader2 size={40} className="animate-spin text-purple-600 mx-auto mb-2" />
            <p className="text-slate-600">加载知识图谱数据...</p>
          </div>
        </div>
      )} */}

      {/* 有数据时的非阻塞加载提示 */}
      {isLoading && (
        <div className="absolute top-20 right-6 z-20 bg-white/90 backdrop-blur-sm shadow-sm border border-purple-100 rounded-full px-4 py-1.5 flex items-center gap-2 pointer-events-none">
          <Loader2 size={14} className="animate-spin text-purple-600" />
          <span className="text-xs text-purple-600 font-medium">更新数据中...</span>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="text-center max-w-md px-4">
            <div className="text-red-500 mb-2">❌</div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">加载失败</h3>
            <p className="text-slate-600 mb-4">无法加载知识图谱数据</p>
            <button onClick={handleReset} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">重试</button>
          </div>
        </div>
      )}
      
      {/* 暂无图谱数据遮罩层 - 已移除，确保不阻塞操作 */}
      {/* {!isLoading && !error && graphData.nodes.length === 0 && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="text-center max-w-md px-4">
            <div className="text-slate-400 mb-2 text-4xl">📭</div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">暂无图谱数据</h3>
            <p className="text-slate-600">请先上传文档并构建知识图谱</p>
          </div>
        </div>
      )} */}
      
      {/* SVG Graph */}
      <div ref={containerRef} className="w-full h-full">
         <svg 
           ref={svgRef}
           width="100%"
           height="100%"
           viewBox={`${viewState.x} ${viewState.y} ${svgSize.width / viewState.zoom} ${svgSize.height / viewState.zoom}`}
           className="w-full h-full"
           onMouseDown={handleMouseDownBackground}
           onMouseMove={handleMouseMove}
           onMouseUp={stopInteractions}
           onMouseLeave={stopInteractions}
           onWheel={handleWheel}
           onClick={() => {
             const moved = interactionRef.current?.moved;
             const type = interactionRef.current?.type;
             if (type === 'pan' && moved) {
               interactionRef.current = null;
               return;
             }
             setSelectedNodeId(null);
             setSelectedLinkId(null);
             setHoveredNode(null);
           }}
           style={{ cursor: isPanning ? 'grabbing' : isNodeDragging ? 'grabbing' : 'default', touchAction: 'none' }}
         >
            <defs>
               <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="0.8" fill="#e2e8f0" opacity="0.6"/>
               </pattern>
               {/* 为每种类型创建呼吸动画 */}
               {Array.from(new Set([...nodes.map(n => n.entityType), 'default'])).map((type) => {
                 const colors = getEntityTypeSemantic(type);
                 return (
                   <radialGradient key={type} id={`grad-${type}`} cx="50%" cy="50%" r="50%">
                     <stop offset="0%" stopColor={colors.fill} stopOpacity="0.3" />
                     <stop offset="100%" stopColor={colors.fill} stopOpacity="0.05" />
                   </radialGradient>
                 );
               })}
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <g>
              {/* Links */}
              {graphLinks.map((link, i) => {
                 const source = nodes.find(n => n.id === link.source);
                 const target = nodes.find(n => n.id === link.target);
                 if (!source || !target) return null;
                 
                 const sx = source.x ?? 0, sy = source.y ?? 0;
                 const tx = target.x ?? 0, ty = target.y ?? 0;
                 const midX = (sx + tx) / 2, midY = (sy + ty) / 2;
                 
                const isHighlighted = Boolean(
                  (focusLink && focusLink.id === link.id) ||
                  (!focusLink && focusNodeId && (focusNodeId === source.id || focusNodeId === target.id))
                );
                const isDimmed = Boolean((focusLink || focusNodeId) && !isHighlighted);
                 const isSearchDimmed = matchedNodeIds && !matchedNodeIds.has(source.id) && !matchedNodeIds.has(target.id);

                 // Task 10.2 & 10.5: layer-based line style (why=dashed, how/missing=solid)
                 const layer = link.layer || 'how';
                 const layerDash = layer === 'why' ? '6 3' : undefined;
                 // Task 10.5: source fallback to "fact"
                 const linkSourceTag = link.linkSource || 'fact';
                 
                 return (
                    <g
                      key={i}
                      opacity={isDimmed || isSearchDimmed ? 0.1 : 1}
                      style={{ transition: 'opacity 0.3s', cursor: 'pointer' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (interactionRef.current?.type === 'pan' && interactionRef.current.moved) return;
                        setSelectedLinkId(link.id);
                        setSelectedNodeId(null);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <line 
                        x1={sx} y1={sy} x2={tx} y2={ty}
                        stroke={isHighlighted ? '#94a3b8' : '#e2e8f0'}
                        strokeWidth={isHighlighted ? 2.2 : 1.2}
                        strokeDasharray={layerDash}
                      />
                      <rect x={midX - 18} y={midY - 9} width="36" height="18" rx="9" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
                      <text x={midX} y={midY + 4} textAnchor="middle" fontSize="9" fill="#94a3b8" className="pointer-events-none select-none">
                        {link.name}
                      </text>
                      {/* Task 10.3: source tag indicator on edge */}
                      {linkSourceTag !== 'fact' && (
                        <circle
                          cx={midX + 22}
                          cy={midY}
                          r="3"
                          fill={linkSourceTag === 'inferred' ? '#f59e0b' : '#8b5cf6'}
                          opacity={0.7}
                        />
                      )}
                    </g>
                 );
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                 const isHovered = hoveredNode === node.id;
                 const isSelected = selectedNodeId === node.id;
                 const isConnected = focusNodeId && graphLinks.some(l => 
                   (l.source === node.id && l.target === focusNodeId) || (l.target === node.id && l.source === focusNodeId)
                 );
                 const isLinkEndpoint = focusLink ? (node.id === focusLink.source || node.id === focusLink.target) : false;
                 const isDimmed = Boolean(
                   focusLink
                     ? !isLinkEndpoint
                     : focusNodeId
                       ? !isSelected && node.id !== focusNodeId && !isConnected
                       : false
                 );
                 const isSearchMatch = matchedNodeIds ? matchedNodeIds.has(node.id) : true;
                 const isSearchDimmed = matchedNodeIds && !isSearchMatch;
                 const nx = node.x ?? 0, ny = node.y ?? 0;
                 const breathDuration = 3 + (node.degree % 3);
                 const breathDelay = (parseInt(node.id, 36) % 10) * 0.3;
                 
                 return (
                    <g 
                      key={node.id}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (interactionRef.current?.type === 'node' && interactionRef.current.moved) return;
                        setSelectedNodeId(node.id);
                        setSelectedLinkId(null);
                      }}
                      style={{ cursor: isNodeDragging && draggedNode === node.id ? 'grabbing' : 'grab', transition: 'opacity 0.3s' }}
                      opacity={isDimmed || isSearchDimmed ? 0.12 : 1}
                    >
                       {/* 呼吸光晕 - 所有节点都有 */}
                       <motion.circle
                         cx={nx} cy={ny}
                         fill={`url(#grad-${node.entityType})`}
                         initial={{ r: (node.r || 20) + 4 }}
                         animate={{ r: [(node.r || 20) + 4, (node.r || 20) + 12, (node.r || 20) + 4], opacity: [0.6, 0.2, 0.6] }}
                         transition={{ repeat: Infinity, duration: breathDuration, delay: breathDelay, ease: "easeInOut" }}
                       />

                       {/* 外圈 */}
                       <motion.circle 
                          cx={nx} cy={ny} r={node.r || 20} 
                          fill={node.colorScheme.bg}
                          stroke={node.colorScheme.stroke}
                          strokeWidth={isHovered ? 2.5 : 1.5}
                          strokeOpacity={isHovered ? 1 : 0.6}
                          animate={{ scale: isHovered ? 1.12 : 1 }}
                          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                          style={{ transformOrigin: `${nx}px ${ny}px` }}
                       />
                       
                       {/* 内核 */}
                       <motion.circle 
                          cx={nx} cy={ny}
                          r={Math.max(3, (node.r || 20) * 0.35)}
                          fill={node.colorScheme.fill}
                          animate={{ r: [Math.max(3, (node.r || 20) * 0.35), Math.max(4, (node.r || 20) * 0.42), Math.max(3, (node.r || 20) * 0.35)] }}
                          transition={{ repeat: Infinity, duration: breathDuration, delay: breathDelay, ease: "easeInOut" }}
                       />
                       
                       {/* 标签 */}
                       <text 
                          x={nx} y={ny + (node.r || 20) + 16} 
                          textAnchor="middle" 
                          fill={isHovered ? node.colorScheme.stroke : '#64748b'}
                          fontSize={isHovered ? 13 : 11}
                          fontWeight={isHovered ? '700' : '500'}
                          className="pointer-events-none select-none"
                          style={{ transition: 'all 0.2s' }}
                       >
                          {node.displayLabel}
                       </text>
                    </g>
                 );
              })}

            </g>
         </svg>
      </div>

      {/* 图例 - 左下角竖排 */}
      {usedTypes.length > 0 && (
        <div
          className="pointer-events-none"
          style={{ position: 'fixed', bottom: '16px', left: '90px', zIndex: 30 }}
        >
          <div
            className="flex flex-col gap-1 px-2.5 py-2 rounded-xl backdrop-blur-md"
            style={{
              background: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(226,232,240,0.5)',
            }}
          >
            {usedTypes.map(t => (
              <div key={t.type} className="flex items-center gap-1.5">
                <div
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: t.fill }}
                />
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{t.label}</span>
              </div>
            ))}

            {/* 分隔线 */}
            <div className="border-t border-slate-200/50 my-0.5" />

            {/* Layer 图例 */}
            <div className="flex items-center gap-1.5">
              <svg width="14" height="6" className="shrink-0">
                <line x1="0" y1="3" x2="14" y2="3" stroke="#94a3b8" strokeWidth="1.2" />
              </svg>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">how 结构层</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width="14" height="6" className="shrink-0">
                <line x1="0" y1="3" x2="14" y2="3" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 1.5" />
              </svg>
              <span className="text-[10px] text-slate-400 whitespace-nowrap">why 因果层</span>
            </div>

            {/* 分隔线 */}
            <div className="border-t border-slate-200/50 my-0.5" />

            {/* Source 图例 */}
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#10b981' }} />
              <span className="text-[10px] text-slate-400 whitespace-nowrap">fact 事实</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#f59e0b' }} />
              <span className="text-[10px] text-slate-400 whitespace-nowrap">inferred 推断</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#8b5cf6' }} />
              <span className="text-[10px] text-slate-400 whitespace-nowrap">pattern 模式</span>
            </div>

          </div>
        </div>
      )}

      {(selectedNodeId || selectedLinkId) && (() => {
        const sourceDocId =
          (graphMeta?.scope === 'doc' && graphMeta.docId) ||
          (viewMode === 'per-document' ? selectedDocId : null) ||
          null;

        if (selectedNodeId) {
          const node = nodes.find(n => n.id === selectedNodeId);
          if (!node) return null;
          const accent = node.colorScheme.fill;
          return (
            <motion.div
              key={`node:${node.id}`}
              className="pointer-events-auto"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                bottom: '16px',
                right: '16px',
                zIndex: 40,
                width: 'min(360px, calc(100vw - 32px))',
              }}
            >
              <div
                className="rounded-2xl overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.94)',
                  backdropFilter: 'blur(14px)',
                  border: '1px solid rgba(226,232,240,0.9)',
                  boxShadow: `0 10px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)`,
                }}
              >
                <div className="flex items-start gap-3 px-4 py-3 border-b border-slate-100">
                  <div className="w-[4px] h-10 rounded-full shrink-0" style={{ background: accent }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-800 break-words">{node.fullLabel}</div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: node.colorScheme.bg, color: accent }}>
                            {node.entityType}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                            background: (node.source || 'fact') === 'fact' ? 'rgba(16,185,129,0.1)' : (node.source || 'fact') === 'inferred' ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.1)',
                            color: (node.source || 'fact') === 'fact' ? '#059669' : (node.source || 'fact') === 'inferred' ? '#d97706' : '#7c3aed',
                          }}>
                            {(node.source || 'fact') === 'fact' ? 'fact' : (node.source || 'fact') === 'inferred' ? 'inferred' : 'pattern'}
                          </span>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">{node.degree} 连接</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setSelectedNodeId(null)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                        title="关闭"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3">
                  {node.description ? (
                    <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{node.description}</div>
                  ) : (
                    <div className="text-sm text-slate-400">暂无描述</div>
                  )}

                  <div className="mt-3 flex items-center gap-2">
                    {sourceDocId && (
                      <button
                        onClick={() => {
                          const url = `/documents/${sourceDocId}`;
                          window.open(url, '_blank');
                        }}
                        className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 flex items-center gap-2"
                        title="打开来源文档"
                      >
                        <FileText size={14} />
                        <span>打开来源文档</span>
                      </button>
                    )}
                    {sourceDocId && (
                      <button
                        onClick={() => {
                          const doc = documents.find(d => d.id === sourceDocId);
                          setIndexDrawerDocId(sourceDocId);
                          setIndexDrawerDocTitle(doc?.title);
                        }}
                        className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 flex items-center gap-2"
                        title="查看索引"
                      >
                        <BookOpen size={14} />
                        <span>索引</span>
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSearchQuery(node.fullLabel);
                      }}
                      className="ml-auto px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50"
                      title="按该节点搜索"
                    >
                      搜索
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          );
        }

        const link = graphLinks.find(l => l.id === selectedLinkId);
        if (!link) return null;
        const layer = link.layer || 'how';
        const sourceTag = link.linkSource || 'fact';
        const sourceNode = nodes.find(n => n.id === link.source);
        const targetNode = nodes.find(n => n.id === link.target);

        return (
          <motion.div
            key={`link:${link.id}`}
            className="pointer-events-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed',
              bottom: '16px',
              right: '16px',
              zIndex: 40,
              width: 'min(360px, calc(100vw - 32px))',
            }}
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.94)',
                backdropFilter: 'blur(14px)',
                border: '1px solid rgba(226,232,240,0.9)',
                boxShadow: `0 10px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)`,
              }}
            >
              <div className="flex items-start justify-between gap-2 px-4 py-3 border-b border-slate-100">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-slate-800 break-words">{link.name || '关系'}</div>
                  <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      layer: {layer}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{
                      background: sourceTag === 'fact' ? 'rgba(16,185,129,0.1)' : sourceTag === 'inferred' ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.1)',
                      color: sourceTag === 'fact' ? '#059669' : sourceTag === 'inferred' ? '#d97706' : '#7c3aed',
                    }}>
                      source_tag: {sourceTag}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-500 break-words">
                    {sourceNode?.fullLabel || link.source} → {targetNode?.fullLabel || link.target}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLinkId(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  title="关闭"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="px-4 py-3">
                {link.description ? (
                  <div className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{link.description}</div>
                ) : (
                  <div className="text-sm text-slate-400">暂无描述</div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  {sourceDocId && (
                    <button
                      onClick={() => {
                        window.open(`/documents/${sourceDocId}`, '_blank');
                      }}
                      className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 flex items-center gap-2"
                      title="打开来源文档"
                    >
                      <FileText size={14} />
                      <span>打开来源文档</span>
                    </button>
                  )}
                  {sourceDocId && (
                    <button
                      onClick={() => {
                        const doc = documents.find(d => d.id === sourceDocId);
                        setIndexDrawerDocId(sourceDocId);
                        setIndexDrawerDocTitle(doc?.title);
                      }}
                      className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-medium hover:bg-slate-50 flex items-center gap-2"
                      title="查看索引"
                    >
                      <BookOpen size={14} />
                      <span>索引</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      if (sourceNode?.fullLabel) setSearchQuery(sourceNode.fullLabel);
                    }}
                    disabled={!sourceNode}
                    className={`ml-auto px-3 py-2 rounded-xl text-xs font-medium ${
                      sourceNode ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}
                    title="按源节点搜索"
                  >
                    搜索源
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })()}

    </div>

    <DocumentIndexDrawer
      docId={indexDrawerDocId}
      docTitle={indexDrawerDocTitle}
      onClose={() => {
        setIndexDrawerDocId(null);
        setIndexDrawerDocTitle(undefined);
      }}
    />
    </>
  );
}
