import React, { useState, useMemo, useRef } from 'react';
import { Search, Filter, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { useApiData } from '../hooks/useApiData';
import { apiService, type GraphNode as ApiGraphNode, type GraphLink as ApiGraphLink } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorDisplay from '../components/ErrorDisplay';
import EmptyState from '../components/EmptyState';

interface Node extends ApiGraphNode {
  x: number;
  y: number;
  r?: number;
  degree?: number;
}

interface Link extends ApiGraphLink {
}

export function Graph() {
  // 1. Fetch graph data using our custom hook
  const { 
    data: nodesData, 
    loading: nodesLoading, 
    error: nodesError,
    refetch: refetchNodes
  } = useApiData(() => apiService.getGraphNodes(), []);

  const { 
    data: linksData, 
    loading: linksLoading, 
    error: linksError,
    refetch: refetchLinks
  } = useApiData(() => apiService.getGraphLinks(), []);

  // 2. Helper functions (must be defined before useMemo)
  const getColorByType = (type: string): string => {
    const colorMap: Record<string, string> = {
      'main': '#8b5cf6',
      'sub': '#ec4899',
      'leaf': '#a855f7',
      'concept': '#3b82f6',
      'entity': '#10b981',
      'EventEntity': '#3b82f6',
      'LocationEntity': '#10b981',
      'PersonEntity': '#f59e0b',
      'OrganizationEntity': '#8b5cf6',
      'default': '#6b7280'
    };
    return colorMap[type] || colorMap['default'];
  };

  // 3. Local state for UI interactions
  const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 4. Transform API data to include positions
  const graphNodes = useMemo<Node[]>(() => {
    if (!nodesData) return [];
    
    return nodesData.map((node) => ({
      ...node,
      x: node.x || 400 + (Math.random() - 0.5) * 400,
      y: node.y || 300 + (Math.random() - 0.5) * 300,
      color: node.color || getColorByType(node.type),
    }));
  }, [nodesData]);

  const graphLinks = useMemo<Link[]>(() => {
    return linksData || [];
  }, [linksData]);

  const loading = nodesLoading || linksLoading;
  const error = nodesError || linksError;

  // 5. Calculate dynamic radius and combine with state
  const nodes = useMemo(() => {
    const degree: Record<string, number> = {};
    graphLinks.forEach(link => {
      degree[link.source] = (degree[link.source] || 0) + 1;
      degree[link.target] = (degree[link.target] || 0) + 1;
    });

    return graphNodes.map(node => {
      const count = degree[node.id] || 0;
      const r = 25 + (count * 8); 
      return { ...node, r, degree: count };
    });
  }, [graphNodes, graphLinks]);

  // Handle node mouse down
  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggedNode(nodeId);
    setIsDragging(true);
  };

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || !draggedNode || !svgRef.current) return;

    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 800;
    const y = ((e.clientY - rect.top) / rect.height) * 600;

    // Update node position in local state (not persisted)
    // In a real app, you might want to save positions to backend
  };

  // Handle mouse up
  const handleMouseUp = () => {
    setIsDragging(false);
    setDraggedNode(null);
  };

  const handleZoomIn = () => setViewState(prev => ({ ...prev, zoom: Math.min(prev.zoom * 1.2, 3) }));
  const handleZoomOut = () => setViewState(prev => ({ ...prev, zoom: Math.max(prev.zoom / 1.2, 0.2) }));
  const handleReset = () => {
    setViewState({ x: 0, y: 0, zoom: 1 });
    refetchNodes();
    refetchLinks();
  };

  // 6. Loading and error states
  if (loading) {
    return <LoadingSpinner size="large" message="加载知识图谱中..." />;
  }

  if (error) {
    return (
      <ErrorDisplay 
        title="加载失败"
        message={error} 
        onRetry={() => {
          refetchNodes();
          refetchLinks();
        }} 
      />
    );
  }

  if (!nodes || nodes.length === 0) {
    return (
      <EmptyState 
        message="知识图谱为空。请上传文档以构建知识图谱。上传文档后,系统会自动提取实体和关系。"
      />
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-50 relative overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-10 flex justify-between pointer-events-none">
         <div className="bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-xl p-2 flex gap-2 pointer-events-auto">
            <button onClick={handleZoomIn} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600" title="放大"><ZoomIn size={20} /></button>
            <button onClick={handleZoomOut} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600" title="缩小"><ZoomOut size={20} /></button>
            <button onClick={handleReset} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600" title="重置"><RefreshCw size={20} /></button>
            <div className="w-px h-6 bg-slate-200 my-auto" />
            <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-600" title="筛选"><Filter size={20} /></button>
         </div>
         
         <div className="bg-white/90 backdrop-blur shadow-sm border border-slate-200 rounded-xl px-4 py-2 flex items-center gap-2 pointer-events-auto w-64">
            <Search size={16} className="text-slate-400" />
            <input type="text" placeholder="搜索节点..." className="bg-transparent outline-none text-sm w-full" />
         </div>
      </div>

      {/* Graph Area */}
      <div className="w-full h-full">
         <svg 
           ref={svgRef}
           width="100%" 
           height="100%" 
           viewBox="0 0 800 600" 
           className="w-full h-full"
           onMouseMove={handleMouseMove}
           onMouseUp={handleMouseUp}
           onMouseLeave={handleMouseUp}
           style={{ cursor: isDragging ? 'grabbing' : 'default' }}
         >
            {/* Background Dot Grid for reference */}
            <defs>
               <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <circle cx="2" cy="2" r="1" fill="#cbd5e1" opacity="0.5"/>
               </pattern>
               <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
                  <feMerge>
                     <feMergeNode in="coloredBlur"/>
                     <feMergeNode in="SourceGraphic"/>
                  </feMerge>
               </filter>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" opacity="0.5" />

            {/* Viewport Group */}
            <motion.g
              animate={{ scale: viewState.zoom }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {/* Links and Labels */}
              {graphLinks.map((link, i) => {
                 const source = nodes.find(n => n.id === link.source)!;
                 const target = nodes.find(n => n.id === link.target)!;
                 
                 const midX = (source.x + target.x) / 2;
                 const midY = (source.y + target.y) / 2;
                 
                 return (
                    <g key={i}>
                      {/* Connection Line */}
                      <motion.line 
                        x1={source.x} y1={source.y}
                        x2={target.x} y2={target.y}
                        stroke="#cbd5e1"
                        strokeWidth="1.5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: hoveredNode && (hoveredNode !== source.id && hoveredNode !== target.id) ? 0.2 : 1 }}
                      />
                      
                      {/* Relation Label Background */}
                      <rect 
                        x={midX - 16} 
                        y={midY - 8} 
                        width="32" 
                        height="16" 
                        rx="4" 
                        fill="#f1f5f9"
                        opacity={hoveredNode && (hoveredNode !== source.id && hoveredNode !== target.id) ? 0.2 : 0.9}
                      />
                      
                      {/* Relation Label Text */}
                      <text
                        x={midX}
                        y={midY}
                        dy="3"
                        textAnchor="middle"
                        fontSize="10"
                        fill="#64748b"
                        className="pointer-events-none select-none font-sans font-medium"
                        opacity={hoveredNode && (hoveredNode !== source.id && hoveredNode !== target.id) ? 0.2 : 1}
                      >
                        {link.relation}
                      </text>
                    </g>
                 );
              })}

              {/* Nodes */}
              {nodes.map((node) => {
                 const isHovered = hoveredNode === node.id;
                 const isDimmed = hoveredNode && hoveredNode !== node.id && !graphLinks.some(l => (l.source === node.id && l.target === hoveredNode) || (l.target === node.id && l.source === hoveredNode));
                 
                 return (
                    <g 
                      key={node.id}
                      onMouseEnter={() => setHoveredNode(node.id)}
                      onMouseLeave={() => setHoveredNode(null)}
                      onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                      style={{ cursor: isDragging && draggedNode === node.id ? 'grabbing' : 'grab' }}
                      opacity={isDimmed ? 0.2 : 1}
                    >
                       {/* Pulse Effect */}
                       {node.degree > 3 && (
                          <motion.circle
                            cx={node.x} cy={node.y} r={node.r + 5}
                            stroke={node.color}
                            strokeWidth="1"
                            fill="none"
                            animate={{ r: [node.r + 5, node.r + 15, node.r + 5], opacity: [0.5, 0, 0.5] }}
                            transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                          />
                       )}

                       <motion.circle 
                          cx={node.x} cy={node.y} r={node.r} 
                          fill={node.color} 
                          fillOpacity="0.2"
                          stroke={node.color}
                          strokeWidth="2"
                          animate={{ scale: isHovered ? 1.1 : 1 }}
                          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                       />
                       
                       <circle 
                          cx={node.x} cy={node.y} r={Math.max(4, node.r / 3)} 
                          fill={node.color} 
                       />
                       
                       <text 
                          x={node.x} y={node.y + node.r + 20} 
                          textAnchor="middle" 
                          fill="#475569" 
                          fontSize="12"
                          fontWeight="600"
                          className="pointer-events-none select-none font-sans"
                       >
                          {node.label}
                       </text>
                    </g>
                 );
              })}
            </motion.g>
         </svg>
      </div>

      {/* Info Panel */}
      {hoveredNode && (
         <div className="absolute bottom-6 right-6 w-64 bg-white/90 backdrop-blur rounded-xl shadow-lg border border-slate-200 p-4 animate-in fade-in slide-in-from-bottom-4 pointer-events-none">
            <h3 className="font-bold text-slate-800">
               {nodes.find(n => n.id === hoveredNode)?.label}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
               {nodes.find(n => n.id === hoveredNode)?.type === 'main' ? '核心概念' : '相关主题'}
            </p>
            <div className="mt-2 text-xs text-slate-400">
               连接数: {nodes.find(n => n.id === hoveredNode)?.degree}
            </div>
         </div>
      )}
    </div>
  );
}
