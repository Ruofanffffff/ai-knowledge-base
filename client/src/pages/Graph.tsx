import React, { useState, useMemo, useRef } from 'react';
import { Search, Filter, ZoomIn, ZoomOut, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

export function Graph() {
  // 1. Initial State
  const initialNodes = [
    { id: '1', x: 400, y: 300, label: '人工智能', type: 'main', color: '#8b5cf6' },
    { id: '2', x: 600, y: 200, label: '机器学习', type: 'sub', color: '#ec4899' },
    { id: '3', x: 650, y: 400, label: '深度学习', type: 'sub', color: '#ec4899' },
    { id: '4', x: 250, y: 200, label: '自然语言处理', type: 'sub', color: '#3b82f6' },
    { id: '5', x: 200, y: 400, label: '计算机视觉', type: 'sub', color: '#3b82f6' },
    { id: '6', x: 750, y: 250, label: '神经网络', type: 'leaf', color: '#a855f7' },
    { id: '7', x: 700, y: 150, label: '支持向量机', type: 'leaf', color: '#f472b6' },
    { id: '8', x: 300, y: 150, label: 'Transformer', type: 'leaf', color: '#60a5fa' },
  ];

  const initialLinks = [
    { source: '1', target: '2', relation: '包含' },
    { source: '1', target: '3', relation: '包含' },
    { source: '1', target: '4', relation: '包含' },
    { source: '1', target: '5', relation: '包含' },
    { source: '2', target: '6', relation: '依赖' },
    { source: '2', target: '7', relation: '算法' },
    { source: '3', target: '6', relation: '核心' },
    { source: '4', target: '8', relation: '架构' },
    { source: '3', target: '2', relation: '子集' }, 
    { source: '5', target: '3', relation: '应用' },
  ];

  const [graphNodes, setGraphNodes] = useState(initialNodes);
  const [viewState, setViewState] = useState({ x: 0, y: 0, zoom: 1 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 2. Calculate dynamic radius and combine with state
  const nodes = useMemo(() => {
    const degree: Record<string, number> = {};
    initialLinks.forEach(link => {
      degree[link.source] = (degree[link.source] || 0) + 1;
      degree[link.target] = (degree[link.target] || 0) + 1;
    });

    return graphNodes.map(node => {
      const count = degree[node.id] || 0;
      const r = 25 + (count * 8); 
      return { ...node, r, degree: count };
    });
  }, [graphNodes]);

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

    setGraphNodes(prev => prev.map(n => 
      n.id === draggedNode ? { ...n, x, y } : n
    ));
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
    setGraphNodes(initialNodes);
  };

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
              {initialLinks.map((link, i) => {
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
                 const isDimmed = hoveredNode && hoveredNode !== node.id && !initialLinks.some(l => (l.source === node.id && l.target === hoveredNode) || (l.target === node.id && l.source === hoveredNode));
                 
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
