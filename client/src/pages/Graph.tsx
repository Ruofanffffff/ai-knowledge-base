import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Search, ZoomIn, ZoomOut, RefreshCw, Loader2, Globe, FileText, BookOpen } from 'lucide-react';
import { motion } from 'framer-motion';
import { useGraph } from '../hooks/useGraph';
import apiClient from '../api/client';
import DocumentIndexDrawer from '../components/DocumentIndexDrawer';

interface Document {
  id: string;
  title: string;
}

// 实体类型颜色方案
const ENTITY_COLORS: Record<string, { fill: string; stroke: string; bg: string; label: string }> = {
  technology: { fill: '#6366f1', stroke: '#4f46e5', bg: 'rgba(99,102,241,0.12)', label: '技术/工具' },
  concept:    { fill: '#8b5cf6', stroke: '#7c3aed', bg: 'rgba(139,92,246,0.12)', label: '概念/理论' },
  person:     { fill: '#f59e0b', stroke: '#d97706', bg: 'rgba(245,158,11,0.12)', label: '人物/组织' },
  action:     { fill: '#10b981', stroke: '#059669', bg: 'rgba(16,185,129,0.12)', label: '方法/行为' },
  target:     { fill: '#ef4444', stroke: '#dc2626', bg: 'rgba(239,68,68,0.12)',  label: '目标/成果' },
  domain:     { fill: '#3b82f6', stroke: '#2563eb', bg: 'rgba(59,130,246,0.12)', label: '领域/场景' },
  data:       { fill: '#14b8a6', stroke: '#0d9488', bg: 'rgba(20,184,166,0.12)', label: '数据/资源' },
  default:    { fill: '#64748b', stroke: '#475569', bg: 'rgba(100,116,139,0.12)', label: '其他' },
};

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
        let dx = nodes[i].x - nodes[j].x;
        let dy = nodes[i].y - nodes[j].y;
        let dist = Math.sqrt(dx * dx + dy * dy) || 1;
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
      let dx = nodes[ti].x - nodes[si].x;
      let dy = nodes[ti].y - nodes[si].y;
      let dist = Math.sqrt(dx * dx + dy * dy) || 1;
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
    graphData, isLoading, error, viewMode, selectedDocId,
    setViewMode, setSelectedDocId, fetchUnifiedGraph, fetchDocGraph
  } = useGraph();
  
  const [graphNodes, setGraphNodes] = useState(graphData.nodes);
  const [graphLinks, setGraphLinks] = useState(graphData.links);
  const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [indexDrawerDocId, setIndexDrawerDocId] = useState<string | null>(null);
  const [indexDrawerDocTitle, setIndexDrawerDocTitle] = useState<string | undefined>(undefined);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgSize, setSvgSize] = useState({ width: 1200, height: 800 });
  
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
  
  const fetchDocuments = async () => {
    try {
      const response = await apiClient.get('/documents');
      const docs = Array.isArray(response.data) ? response.data : (response.data.documents || []);
      setDocuments(docs.map((doc: any) => ({
        id: doc.id,
        title: doc.title || doc.filename || 'Untitled'
      })));
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };
  
  // 当 graphData 更新时，运行力导向布局
  useEffect(() => {
    if (graphData.nodes.length === 0) {
      setGraphNodes([]);
      setGraphLinks([]);
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
      const entityType = inferEntityType(node.label, node.description);
      const colorScheme = ENTITY_COLORS[entityType] || ENTITY_COLORS.default;
      return { ...node, x: pos.x, y: pos.y, color: colorScheme.fill };
    });

    setGraphNodes(newNodes);
    setGraphLinks(graphData.links);
  }, [graphData, svgSize]);

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
      const entityType = inferEntityType(node.label, node.description);
      const colorScheme = ENTITY_COLORS[entityType] || ENTITY_COLORS.default;
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
    return Array.from(types).map(t => ({ type: t, ...ENTITY_COLORS[t] }));
  }, [nodes]);

  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedNode(nodeId);
    setIsDragging(true);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !draggedNode || !svgRef.current) return;
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * svgSize.width;
    const y = ((e.clientY - rect.top) / rect.height) * svgSize.height;
    setGraphNodes(prev => prev.map(n => n.id === draggedNode ? { ...n, x, y } : n));
  }, [isDragging, draggedNode, svgSize]);

  const handleMouseUp = () => { setIsDragging(false); setDraggedNode(null); };

  const handleZoomIn = () => setViewState(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 3) }));
  const handleZoomOut = () => setViewState(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.3) }));
  const handleReset = () => {
    setViewState({ x: 0, y: 0, zoom: 1 });
    if (viewMode === 'unified') fetchUnifiedGraph();
    else if (selectedDocId) fetchDocGraph(selectedDocId);
  };

  const handleViewModeChange = (mode: 'unified' | 'per-document') => {
    setViewMode(mode);
    if (mode === 'unified') { setSelectedDocId(null); fetchUnifiedGraph(); }
    else if (documents.length > 0) {
      const firstDocId = documents[0]?.id;
      if (firstDocId) { setSelectedDocId(firstDocId); fetchDocGraph(firstDocId); }
    }
  };

  const handleDocumentSelect = (docId: string) => { setSelectedDocId(docId); fetchDocGraph(docId); };

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
      
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="text-center">
            <Loader2 size={40} className="animate-spin text-purple-600 mx-auto mb-2" />
            <p className="text-slate-600">加载知识图谱数据...</p>
          </div>
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
      
      {!isLoading && !error && graphData.nodes.length === 0 && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="text-center max-w-md px-4">
            <div className="text-slate-400 mb-2 text-4xl">📭</div>
            <h3 className="text-lg font-semibold text-slate-800 mb-1">暂无图谱数据</h3>
            <p className="text-slate-600">请先上传文档并构建知识图谱</p>
          </div>
        </div>
      )}
      
      {/* SVG Graph */}
      <div ref={containerRef} className="w-full h-full">
         <svg 
           ref={svgRef} width="100%" height="100%" viewBox={`0 0 ${svgSize.width} ${svgSize.height}`} className="w-full h-full"
           onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
           style={{ cursor: isDragging ? 'grabbing' : 'default' }}
         >
            <defs>
               <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="0.8" fill="#e2e8f0" opacity="0.6"/>
               </pattern>
               {/* 为每种类型创建呼吸动画 */}
               {Object.entries(ENTITY_COLORS).map(([type, colors]) => (
                 <radialGradient key={type} id={`grad-${type}`} cx="50%" cy="50%" r="50%">
                   <stop offset="0%" stopColor={colors.fill} stopOpacity="0.3" />
                   <stop offset="100%" stopColor={colors.fill} stopOpacity="0.05" />
                 </radialGradient>
               ))}
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />

            <motion.g
              animate={{ scale: viewState.zoom }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              style={{ transformOrigin: `${svgSize.width / 2}px ${svgSize.height / 2}px` }}
            >
              {/* Links */}
              {graphLinks.map((link, i) => {
                 const source = nodes.find(n => n.id === link.source);
                 const target = nodes.find(n => n.id === link.target);
                 if (!source || !target) return null;
                 
                 const sx = source.x ?? 0, sy = source.y ?? 0;
                 const tx = target.x ?? 0, ty = target.y ?? 0;
                 const midX = (sx + tx) / 2, midY = (sy + ty) / 2;
                 
                 const isHighlighted = hoveredNode && (hoveredNode === source.id || hoveredNode === target.id);
                 const isDimmed = hoveredNode && !isHighlighted;
                 const isSearchDimmed = matchedNodeIds && !matchedNodeIds.has(source.id) && !matchedNodeIds.has(target.id);
                 
                 return (
                    <g key={i} opacity={isDimmed || isSearchDimmed ? 0.1 : 1} style={{ transition: 'opacity 0.3s' }}>
                      <line 
                        x1={sx} y1={sy} x2={tx} y2={ty}
                        stroke={isHighlighted ? '#94a3b8' : '#e2e8f0'}
                        strokeWidth={isHighlighted ? 2 : 1.2}
                        strokeDasharray={isHighlighted ? undefined : '4 2'}
                      />
                      <rect x={midX - 18} y={midY - 9} width="36" height="18" rx="9" fill="white" stroke="#e2e8f0" strokeWidth="0.5" />
                      <text x={midX} y={midY + 4} textAnchor="middle" fontSize="9" fill="#94a3b8" className="pointer-events-none select-none">
                        {link.name}
                      </text>
                    </g>
                 );
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                 const isHovered = hoveredNode === node.id;
                 const isConnected = hoveredNode && graphLinks.some(l => 
                   (l.source === node.id && l.target === hoveredNode) || (l.target === node.id && l.source === hoveredNode)
                 );
                 const isDimmed = hoveredNode && !isHovered && !isConnected;
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
                      style={{ cursor: isDragging && draggedNode === node.id ? 'grabbing' : 'grab', transition: 'opacity 0.3s' }}
                      opacity={isDimmed || isSearchDimmed ? 0.12 : 1}
                    >
                       {/* 呼吸光晕 - 所有节点都有 */}
                       <motion.circle
                         cx={nx} cy={ny}
                         fill={`url(#grad-${node.entityType})`}
                         initial={{ r: node.r + 4 }}
                         animate={{ r: [node.r + 4, node.r + 12, node.r + 4], opacity: [0.6, 0.2, 0.6] }}
                         transition={{ repeat: Infinity, duration: breathDuration, delay: breathDelay, ease: "easeInOut" }}
                       />

                       {/* 外圈 */}
                       <motion.circle 
                          cx={nx} cy={ny} r={node.r} 
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
                          r={Math.max(3, node.r * 0.35)}
                          fill={node.colorScheme.fill}
                          animate={{ r: [Math.max(3, node.r * 0.35), Math.max(4, node.r * 0.42), Math.max(3, node.r * 0.35)] }}
                          transition={{ repeat: Infinity, duration: breathDuration, delay: breathDelay, ease: "easeInOut" }}
                       />
                       
                       {/* 标签 */}
                       <text 
                          x={nx} y={ny + node.r + 16} 
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
            </motion.g>
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
          </div>
        </div>
      )}

      {/* Hover Info Panel - 右下角浅色紧凑浮窗 */}
      {hoveredNode && (() => {
        const node = nodes.find(n => n.id === hoveredNode);
        if (!node) return null;
        const accent = node.colorScheme.fill;
        return (
          <motion.div
            key={node.id}
            className="pointer-events-none"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'fixed', bottom: '20px', right: '16px', zIndex: 31,
              maxWidth: '196px',
            }}
          >
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.92)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(226,232,240,0.8)',
                boxShadow: `0 4px 20px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)`,
              }}
            >
              {/* 左侧色条 */}
              <div className="flex">
                <div className="w-[3px] shrink-0 rounded-l-xl" style={{ background: accent }} />
                <div className="px-3 py-2.5 min-w-0">
                  {/* 类型 + 连接数 */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-semibold" style={{ color: accent }}>
                      {node.colorScheme.label}
                    </span>
                    <span className="text-[9px] text-slate-400">
                      {node.degree} 连接
                    </span>
                  </div>

                  {/* 名称 */}
                  <div className="font-semibold text-slate-700 text-[11px] leading-tight break-words">
                    {node.fullLabel}
                  </div>

                  {/* 描述 */}
                  {node.description && (
                    <p className="text-[10px] text-slate-500 mt-1 leading-snug line-clamp-2">
                      {node.description}
                    </p>
                  )}
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
