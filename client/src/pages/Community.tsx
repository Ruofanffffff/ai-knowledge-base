import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
// @ts-ignore - no types for react-responsive-masonry
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import {
  Search, Heart, Share2, MoreHorizontal, SlidersHorizontal,
  Image as ImageIcon, Video, Layers, Wand2, X,
  Maximize2, BookOpen, Sparkles, GitFork, Network, Zap,
  ChevronLeft, ChevronRight, Loader2, FileText, MessageCircle, Bookmark
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { apiService, CommunityPost } from '../services/api';
import { getAvatarUrl } from '../utils/transformers';
import { parseIndexSections } from '../utils/parseIndexSections';
import type { IndexSection } from '../types/document-index';

const tabs = ['Top Day', 'Likes', 'Styles', 'Images', 'Videos'];
const generatingTexts = ['正在构思...', '绘制轮廓...', '优化细节...'];

interface ArtWork {
  id: string;
  url: string;
  title: string;
  author: string;
  avatar: string;
  likes: number;
  isLiked: boolean;
  isBookmarked: boolean;
  commentCount: number;
  prompt: string;
  isGenerating?: boolean;
  postId?: number;
  documentId?: number;
  authorAvatar?: string | null;
  generatingText?: string;
}

interface PostDetail {
  post: CommunityPost;
  indexSections: IndexSection[];
}

function mapPostToArtwork(post: CommunityPost): ArtWork {
  return {
    id: String(post.id),
    url: post.coverImage || '',
    title: post.title,
    author: post.authorName || '匿名',
    avatar: post.authorAvatar || '',
    likes: post.likes,
    isLiked: post.isLiked,
    isBookmarked: post.isBookmarked ?? false,
    commentCount: post.commentCount ?? 0,
    prompt: post.summary || '',
    isGenerating: !post.coverImage,
    postId: post.id,
    documentId: post.documentId,
    authorAvatar: post.authorAvatar,
    generatingText: generatingTexts[0],
  };
}

export function Community() {
  const navigate = useNavigate();
  const [artworks, setArtworks] = useState<ArtWork[]>([]);
  const [activeTab, setActiveTab] = useState('Top Day');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Detail modal
  const [selectedDetail, setSelectedDetail] = useState<PostDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Generation State
  const [isGenerating] = useState(false);

  // Generating text animation timers
  const generatingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Polling for cover generation
  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  // ─── Load posts from API ───
  const loadPosts = useCallback(async () => {
    setLoading(true);
    const params: { page: number; sort?: 'latest' | 'hottest'; search?: string } = { page: 1 };
    if (activeTab === 'Likes') params.sort = 'hottest';
    else params.sort = 'latest';
    if (searchQuery.trim()) params.search = searchQuery.trim();

    const result = await apiService.getCommunityPosts(params);
    if (result.success && result.data) {
      const items = result.data.posts.map(mapPostToArtwork);
      setArtworks(items);
      items.forEach(item => {
        if (item.isGenerating) startGeneratingAnimation(item.id);
      });
    } else {
      setArtworks([]);
    }
    setLoading(false);
  }, [activeTab, searchQuery]);

  // ─── Cycle generating text for a card ───
  const startGeneratingAnimation = useCallback((artId: string) => {
    if (generatingTimers.current.has(artId)) {
      clearInterval(generatingTimers.current.get(artId)!);
    }
    let idx = 0;
    const timer = setInterval(() => {
      idx = (idx + 1) % generatingTexts.length;
      setArtworks(prev => prev.map(a =>
        a.id === artId && a.isGenerating ? { ...a, generatingText: generatingTexts[idx] } : a
      ));
    }, 2000);
    generatingTimers.current.set(artId, timer);
  }, []);

  // ─── Poll for cover generation completion ───
  const startPolling = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    pollTimer.current = setInterval(async () => {
      const generatingIds = artworks.filter(a => a.isGenerating).map(a => a.postId);
      if (generatingIds.length === 0) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        return;
      }
      const params: any = { page: 1 };
      if (activeTab === 'Likes') params.sort = 'hottest';
      else params.sort = 'latest';
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const result = await apiService.getCommunityPosts(params);
      if (result.success && result.data) {
        setArtworks(prev => prev.map(artwork => {
          const updated = result.data!.posts.find(p => p.id === artwork.postId);
          if (updated && updated.coverImage && artwork.isGenerating) {
            if (generatingTimers.current.has(artwork.id)) {
              clearInterval(generatingTimers.current.get(artwork.id)!);
              generatingTimers.current.delete(artwork.id);
            }
            return { ...artwork, url: updated.coverImage!, isGenerating: false, generatingText: '', likes: updated.likes, isLiked: updated.isLiked };
          }
          return artwork;
        }));
      }
    }, 5000);
  }, [artworks, activeTab, searchQuery]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  useEffect(() => {
    if (artworks.some(a => a.isGenerating)) startPolling();
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [artworks.filter(a => a.isGenerating).length]);

  useEffect(() => {
    return () => {
      generatingTimers.current.forEach(t => clearInterval(t));
      generatingTimers.current.clear();
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const toggleLike = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const art = artworks.find(a => a.id === id);
    if (!art?.postId) return;
    setArtworks(prev => prev.map(a =>
      a.id === id ? { ...a, isLiked: !a.isLiked, likes: a.isLiked ? a.likes - 1 : a.likes + 1 } : a
    ));
    if (selectedDetail && String(selectedDetail.post.id) === id) {
      setSelectedDetail(prev => prev ? {
        ...prev, post: { ...prev.post, isLiked: !prev.post.isLiked, likes: prev.post.isLiked ? prev.post.likes - 1 : prev.post.likes + 1 }
      } : null);
    }
    const result = await apiService.togglePostLike(art.postId);
    if (!result.success) {
      setArtworks(prev => prev.map(a =>
        a.id === id ? { ...a, isLiked: !a.isLiked, likes: a.isLiked ? a.likes - 1 : a.likes + 1 } : a
      ));
    }
  };

  const startGeneration = () => {
    if (isGenerating) return;
    navigate('/documents/new');
  };

  // ─── Detail modal ───
  const openDetail = async (postId: number) => {
    setDetailLoading(true);
    setSelectedDetail(null);
    setCurrentImageIndex(0);
    const result = await apiService.getCommunityPostDetail(postId);
    if (result.success && result.data) {
      const post = result.data;
      const indexSections = post.indexData?.indexedText ? parseIndexSections(post.indexData.indexedText) : [];
      setSelectedDetail({ post, indexSections });
    }
    setDetailLoading(false);
  };

  const closeDetail = () => setSelectedDetail(null);

  // ─── Compute images array for carousel (coverImage + contentImages merged) ───
  const images = [
    ...(selectedDetail?.post.coverImage ? [selectedDetail.post.coverImage] : []),
    ...(selectedDetail?.post.contentImages ?? []),
  ];

  // ─── Carousel navigation (switch between images within a post) ───
  const handlePrev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (images.length === 0) return;
    setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const handleNext = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (images.length === 0) return;
    setCurrentImageIndex(prev => (prev + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedDetail) return;
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'Escape') closeDetail();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDetail, handleNext, handlePrev]);

  const filteredArtworks = artworks.filter(art =>
    art.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    art.prompt.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 h-full flex flex-col bg-white overflow-hidden relative">
      {/* Header / Search */}
      <div className="h-16 px-6 flex items-center gap-4 bg-white z-20 shrink-0">
        <div className="flex-1 relative max-w-4xl">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="搜索提示词、风格或创作者..."
            className="w-full bg-slate-100 hover:bg-slate-50 focus:bg-white border-transparent focus:border-purple-200 border rounded-full pl-10 pr-4 py-2.5 outline-none transition-all placeholder:text-slate-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-slate-200 rounded-full text-slate-500">
            <SlidersHorizontal size={16} />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={startGeneration}
            disabled={isGenerating}
            className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium text-sm transition-all ${
              isGenerating ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
            {isGenerating ? '生成中...' : '开始创作'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pb-2 border-b border-slate-100 flex items-center gap-6 overflow-x-auto no-scrollbar shrink-0">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
        <div className="h-4 w-px bg-slate-200 mx-2" />
        <button className="pb-3 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2">
          <ImageIcon size={16} /> Styles
        </button>
        <button className="pb-3 text-sm font-medium text-slate-500 hover:text-slate-700 flex items-center gap-2">
          <Video size={16} /> Videos
        </button>
      </div>

      {/* Masonry Grid */}
      <div className="flex-1 overflow-y-auto p-6 bg-white">
        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
          </div>
        ) : filteredArtworks.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">暂无帖子</div>
        ) : (
          <ResponsiveMasonry columnsCountBreakPoints={{350: 1, 750: 2, 1100: 3, 1500: 4}}>
            <Masonry gutter="16px">
              {filteredArtworks.map((art, index) => (
                <motion.div
                  key={art.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  onClick={() => !art.isGenerating && art.postId && openDetail(art.postId)}
                  className={`relative group rounded-xl overflow-hidden cursor-pointer ${art.isGenerating ? 'cursor-default' : ''}`}
                  style={{ backgroundColor: art.isGenerating ? 'transparent' : '#f1f5f9' }}
                >
                  {art.isGenerating ? (
                    <div
                      className="relative w-full h-[220px]"
                      style={{ background: art.url
                        ? `url(${art.url}) center/cover no-repeat`
                        : 'linear-gradient(135deg, #a855f7, #f9a8d4, #60a5fa)'
                      }}
                    >
                      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                        <div className="relative mb-3">
                          <div className="w-12 h-12 rounded-full border-[3px] border-white/20 border-t-white border-r-white/50 animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Sparkles className="text-white drop-shadow-md animate-pulse" size={18} />
                          </div>
                        </div>
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={art.generatingText}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="text-white font-bold text-sm tracking-wide drop-shadow-md"
                          >
                            {art.generatingText || '正在构思...'}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                    </div>
                  ) : (
                    <div className="relative overflow-hidden">
                      <img
                        src={art.url}
                        alt={art.title}
                        className="w-full h-auto object-cover transition-all duration-700 group-hover:scale-105"
                        loading="lazy"
                      />
                    </div>
                  )}
                  {!art.isGenerating && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={(e) => toggleLike(art.id, e)}
                          className={`p-2 rounded-full backdrop-blur-md transition-colors ${art.isLiked ? 'bg-pink-500/20 text-pink-500 hover:bg-pink-500/30' : 'bg-black/20 text-white hover:bg-white/20'}`}
                        >
                          <Heart size={16} fill={art.isLiked ? "currentColor" : "none"} />
                        </button>
                        <button className="p-2 rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-white/20 transition-colors">
                          <MoreHorizontal size={16} />
                        </button>
                      </div>
                      <div>
                        <h3 className="text-white font-medium text-sm mb-1 truncate">{art.title}</h3>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {art.authorAvatar ? (
                                <img src={getAvatarUrl(art.authorAvatar)} alt="" className="w-5 h-5 rounded-full object-cover" />
                              ) : (
                                <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-[10px] text-white">
                                  {art.author?.charAt(0) || '?'}
                                </span>
                              )}
                            </span>
                            <span className="text-slate-300 text-xs hover:text-white transition-colors">{art.author}</span>
                          </div>
                          <span className="text-slate-300 text-xs">{art.likes}</span>
                        </div>
                        <div className="mt-3 text-[10px] text-slate-400 line-clamp-2 leading-relaxed opacity-80">{art.prompt}</div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </Masonry>
          </ResponsiveMasonry>
        )}
        {!loading && filteredArtworks.length > 0 && (
          <div className="py-8 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
          </div>
        )}
      </div>

      {/* Artwork Detail Modal - rendered via portal to escape overflow-hidden */}
      {(selectedDetail || detailLoading) && createPortal(
          <div
            style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
            onClick={closeDetail}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{ display: 'flex', flexDirection: 'row', width: '100%', maxWidth: '80rem', height: '85vh', borderRadius: '1.5rem', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', backgroundColor: 'white' }}
            >
              {detailLoading ? (
                <div className="flex-1 flex items-center justify-center py-20">
                  <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
                </div>
              ) : selectedDetail ? (
                <>
                  {/* LEFT Section - Image Carousel */}
                  <div style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="group">
                    <div className="relative w-full h-full flex items-center justify-center p-4 md:p-8">
                      <AnimatePresence mode="wait">
                        {images.length > 0 ? (
                          <motion.img
                            key={`${selectedDetail.post.id}-${currentImageIndex}`}
                            src={images[currentImageIndex]}
                            alt={`${selectedDetail.post.title} - ${currentImageIndex + 1}`}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            transition={{ duration: 0.2 }}
                            className="max-w-full max-h-full object-contain shadow-2xl"
                          />
                        ) : (
                          <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-3 text-white/60">
                            <Sparkles size={32} />
                            <span className="text-sm">封面生成中...</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {/* Navigation Buttons - always visible */}
                    <button onClick={handlePrev} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 text-white hover:bg-white/20 rounded-full backdrop-blur-md transition-all md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 z-20">
                      <ChevronLeft size={24} />
                    </button>
                    <button onClick={handleNext} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 text-white hover:bg-white/20 rounded-full backdrop-blur-md transition-all md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 z-20">
                      <ChevronRight size={24} />
                    </button>
                    <div className="absolute top-6 right-6 flex items-center gap-3 z-20">
                      <button className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition-colors"><Maximize2 size={18} /></button>
                      <button className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-md transition-colors"><Share2 size={18} /></button>
                    </div>
                    <button onClick={closeDetail} className="absolute top-4 left-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 md:hidden z-20"><X size={20} /></button>
                    {/* Image Counter - image index / total images */}
                    {images.length > 1 && (
                      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white/80 font-mono">
                        {currentImageIndex + 1} / {images.length}
                      </div>
                    )}
                  </div>

                  {/* RIGHT Section - Sidebar Content Analysis */}
                  <div style={{ width: '450px', flexShrink: 0, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #e2e8f0', height: '100%' }} className="bg-white">
                    {/* Scrollable area: Header + Analysis Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-white/80 backdrop-blur sticky top-0 z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl shadow-inner">
                          {selectedDetail.post.authorAvatar ? (
                            <img src={getAvatarUrl(selectedDetail.post.authorAvatar)} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <span>{selectedDetail.post.authorName?.charAt(0) || '?'}</span>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 leading-tight">分析报告</h3>
                          <p className="text-xs text-slate-500 mt-0.5">Generated by BrainBase AI</p>
                        </div>
                      </div>
                      <button onClick={closeDetail} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hidden md:block transition-colors"><X size={20} /></button>
                    </div>

                    {/* Analysis Content */}
                    <div className="p-6 space-y-6">
                      {selectedDetail.indexSections.length > 0 ? (
                        selectedDetail.indexSections.map((section, idx) => {
                          if (section.type === 'summary') {
                            return (
                              <div key={idx} className="space-y-3">
                                <div className="flex items-center gap-2 text-purple-700">
                                  <BookOpen size={18} />
                                  <h4 className="font-bold text-sm uppercase tracking-wider">主旨概述</h4>
                                </div>
                                <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                                  <p className="text-slate-700 leading-relaxed text-sm">{section.content}</p>
                                </div>
                              </div>
                            );
                          }
                          if (section.type === 'concepts' && section.items) {
                            return (
                              <div key={idx} className="space-y-3">
                                <div className="flex items-center gap-2 text-orange-700">
                                  <Sparkles size={18} />
                                  <h4 className="font-bold text-sm uppercase tracking-wider">核心概念及其角色</h4>
                                </div>
                                <div className="space-y-2">
                                  {section.items.map((item, i) => (
                                    <div key={i} className="bg-white p-3 rounded-xl border border-orange-100 shadow-sm flex gap-3 items-start">
                                      <div className="mt-1 w-2 h-2 rounded-full bg-orange-400 shrink-0" />
                                      <div>
                                        <div className="flex items-center gap-2 mb-1">
                                          <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">{item.role}</span>
                                        </div>
                                        <p className="text-slate-500 text-xs leading-relaxed">{item.description}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          }
                          if (section.type === 'relations' && section.relationItems) {
                            return (
                              <div key={idx} className="space-y-3">
                                <div className="flex items-center gap-2 text-teal-700">
                                  <GitFork size={18} />
                                  <h4 className="font-bold text-sm uppercase tracking-wider">关键关系</h4>
                                </div>
                                <div className="grid gap-3">
                                  {section.relationItems.map((rel, i) => {
                                    const icons = [Zap, Network, Layers];
                                    const Icon = icons[i % icons.length];
                                    return (
                                      <div key={i} className="group p-4 rounded-xl border border-slate-100 bg-white hover:border-teal-200 hover:shadow-md transition-all cursor-default">
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="p-1 rounded bg-teal-100 text-teal-600"><Icon size={12} /></div>
                                          <h5 className="font-bold text-slate-800 text-xs">{rel.label}</h5>
                                        </div>
                                        <p className="text-slate-600 text-xs leading-relaxed pl-7 border-l-2 border-slate-100 group-hover:border-teal-100 transition-colors">{rel.description}</p>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div key={idx} className="space-y-3">
                              <div className="flex items-center gap-2 text-slate-600">
                                <BookOpen size={18} />
                                <h4 className="font-bold text-sm uppercase tracking-wider">{section.title}</h4>
                              </div>
                              <p className="text-slate-600 text-sm leading-relaxed">{section.content}</p>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center text-slate-400 text-sm py-8">暂无文档索引分析</div>
                      )}
                    </div>
                    </div>{/* end scrollable area */}

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-4 z-10 shrink-0">
                      <button
                        onClick={() => {
                          closeDetail();
                          navigate(`/documents/${selectedDetail!.post.documentId}`);
                        }}
                        className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm"
                      >
                        <FileText size={14} /> 查看原文档
                      </button>
                      <div className="flex gap-2">
                        <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors" title="Comment">
                          <MessageCircle size={18} />
                        </button>
                        <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors" title="Favorite">
                          <Bookmark size={18} />
                        </button>
                        <button
                          onClick={() => toggleLike(String(selectedDetail!.post.id))}
                          className={`p-2 rounded-lg border transition-colors ${
                            selectedDetail.post.isLiked
                              ? 'border-pink-200 bg-pink-50 text-pink-600'
                              : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                          }`}
                          title="Like"
                        >
                          <Heart size={18} fill={selectedDetail.post.isLiked ? "currentColor" : "none"} />
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>,
      document.body
      )}
    </div>
  );
}
