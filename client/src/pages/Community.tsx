import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Heart, Share2, SlidersHorizontal,
  Layers, Wand2, X,
  Maximize2, BookOpen, Sparkles, GitFork, Network, Zap,
  ChevronLeft, ChevronRight, Loader2, FileText, MessageCircle, Bookmark,
  MoreHorizontal, Edit2, Trash2, CheckSquare, Square, Upload, MoreVertical
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { apiService, CommunityPost } from '../services/api';
import { getAvatarUrl } from '../utils/transformers';
import { parseIndexSections } from '../utils/parseIndexSections';
import type { IndexSection } from '../types/document-index';

const tabs = ['今日热帖', '已收藏', '我发布的'];
const generatingTexts = ['正在构思...', '绘制轮廓...', '优化细节...'];

const CARD_COLOR_PALETTES = [
  { bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fcd34d 100%)', text: '#92400e', subtext: '#a16207' },
  { bg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 50%, #93c5fd 100%)', text: '#1e40af', subtext: '#1d4ed8' },
  { bg: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 50%, #86efac 100%)', text: '#166534', subtext: '#15803d' },
  { bg: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 50%, #f9a8d4 100%)', text: '#9d174d', subtext: '#be185d' },
  { bg: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 50%, #d8b4fe 100%)', text: '#6b21a8', subtext: '#7c3aed' },
  { bg: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 50%, #a5b4fc 100%)', text: '#3730a3', subtext: '#4338ca' },
  { bg: 'linear-gradient(135deg, #ccfbf1 0%, #99f6e4 50%, #5eead4 100%)', text: '#0f766e', subtext: '#0d9488' },
  { bg: 'linear-gradient(135deg, #ffedd5 0%, #fed7aa 50%, #fdba74 100%)', text: '#9a3412', subtext: '#c2410c' },
  { bg: 'linear-gradient(135deg, #fef9c3 0%, #fef08a 50%, #fde047 100%)', text: '#854d0e', subtext: '#a16207' },
  { bg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 50%, #cbd5e1 100%)', text: '#334155', subtext: '#475569' },
  { bg: 'linear-gradient(135deg, #ffe4e6 0%, #fecdd3 50%, #fda4af 100%)', text: '#9f1239', subtext: '#be123c' },
  { bg: 'linear-gradient(135deg, #ecfccb 0%, #d9f99d 50%, #bef264 100%)', text: '#3f6212', subtext: '#4d7c0f' },
];

function getCardColorPalette(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = ((hash << 5) - hash) + title.charCodeAt(i);
    hash = hash & hash;
  }
  return CARD_COLOR_PALETTES[Math.abs(hash) % CARD_COLOR_PALETTES.length];
}

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
    isGenerating: false,
    postId: post.id,
    documentId: post.documentId,
    authorAvatar: post.authorAvatar,
    generatingText: generatingTexts[0],
  };
}

export function Community() {
  const navigate = useNavigate();
  const [artworks, setArtworks] = useState<ArtWork[]>([]);
  const [activeTab, setActiveTab] = useState('今日热帖');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // Detail modal
  const [selectedDetail, setSelectedDetail] = useState<PostDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Generation State
  const [isGenerating] = useState(false);

  // Selection mode for "我发布的" tab
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Edit modal
  const [editingPost, setEditingPost] = useState<ArtWork | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editSummary, setEditSummary] = useState('');
  const [editLoading, setEditLoading] = useState(false);

  // Delete confirmation
  const [deletingPost, setDeletingPost] = useState<ArtWork | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Batch delete confirmation
  const [showBatchDeleteConfirm, setShowBatchDeleteConfirm] = useState(false);
  const [batchDeleteLoading, setBatchDeleteLoading] = useState(false);

  // Batch publish logic
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [publishLoading, setPublishLoading] = useState(false);

  const handlePublish = async () => {
    if (selectedIds.size === 0) return;
    setPublishLoading(true);
    try {
      const result = await apiService.publishToCommunity(Array.from(selectedIds), isPublic);
      if (result.success) {
        alert(`发布成功 ${result.data?.published?.length || 0} 篇文档`);
        setSelectedIds(new Set());
        setIsSelectMode(false);
        setShowPublishModal(false);
        loadPosts();
      } else {
        alert(result.error || '发布失败');
      }
    } catch (error) {
      console.error('Publish error:', error);
      alert('发布失败，请重试');
    } finally {
      setPublishLoading(false);
    }
  };

  // Dropdown menu
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  // Generating text animation timers
  const generatingTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Polling for cover generation
  const pollTimer = useRef<NodeJS.Timeout | null>(null);

  // ─── Load posts from API ───
  const loadPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params: { page: number; sort?: 'latest' | 'hottest'; search?: string; filter?: 'mine' | 'liked' } = { page: 1 };
      if (activeTab === '已收藏') {
        params.filter = 'liked';
        params.sort = 'latest';
      } else if (activeTab === '我发布的') {
        params.filter = 'mine';
        params.sort = 'latest';
      } else {
        params.sort = 'latest';
      }
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
    } catch (error) {
      console.error('Failed to load community posts:', error);
      setArtworks([]);
    } finally {
      setLoading(false);
    }
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
      if (activeTab === '已收藏') {
        params.filter = 'liked';
        params.sort = 'latest';
      } else if (activeTab === '我发布的') {
        params.filter = 'mine';
        params.sort = 'latest';
      } else {
        params.sort = 'latest';
      }
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

  useEffect(() => {
    const handleClickOutside = () => {
      if (openDropdownId) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdownId]);

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

  // ─── Selection mode handlers ───
  const toggleSelectMode = () => {
    setIsSelectMode(!isSelectMode);
    setSelectedIds(new Set());
    setOpenDropdownId(null);
  };

  const toggleSelectItem = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(artworks.map(a => a.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // ─── Edit handlers ───
  const openEditModal = (art: ArtWork, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingPost(art);
    setEditTitle(art.title);
    setEditSummary(art.prompt);
    setOpenDropdownId(null);
  };

  const closeEditModal = () => {
    setEditingPost(null);
    setEditTitle('');
    setEditSummary('');
    setEditLoading(false);
  };

  const handleEditSave = async () => {
    if (!editingPost?.postId) return;
    setEditLoading(true);
    const result = await apiService.updatePost(editingPost.postId, {
      title: editTitle,
      summary: editSummary,
    });
    if (result.success) {
      setArtworks(prev => prev.map(a =>
        a.id === editingPost.id ? { ...a, title: editTitle, prompt: editSummary } : a
      ));
      closeEditModal();
    } else {
      alert(result.error || '更新失败');
    }
    setEditLoading(false);
  };

  // ─── Delete handlers ───
  const openDeleteConfirm = (art: ArtWork, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeletingPost(art);
    setOpenDropdownId(null);
  };

  const closeDeleteConfirm = () => {
    setDeletingPost(null);
    setDeleteLoading(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPost?.postId) {
      return;
    }
    setDeleteLoading(true);
    const result = await apiService.unpublishPost(deletingPost.postId);
    if (result.success) {
      setArtworks(prev => prev.filter(a => a.id !== deletingPost.id));
      closeDeleteConfirm();
    } else {
      alert(result.error || '删除失败');
    }
    setDeleteLoading(false);
  };

  // ─── Batch delete handlers ───
  const openBatchDeleteConfirm = () => {
    if (selectedIds.size === 0) return;
    setShowBatchDeleteConfirm(true);
  };

  const closeBatchDeleteConfirm = () => {
    setShowBatchDeleteConfirm(false);
    setBatchDeleteLoading(false);
  };

  const handleBatchDeleteConfirm = async () => {
    const postIds = artworks
      .filter(a => selectedIds.has(a.id) && a.postId)
      .map(a => a.postId!);
    
    if (postIds.length === 0) return;
    
    setBatchDeleteLoading(true);
    const result = await apiService.batchDeletePosts(postIds);
    if (result.success) {
      setArtworks(prev => prev.filter(a => !selectedIds.has(a.id)));
      setSelectedIds(new Set());
      setIsSelectMode(false);
      closeBatchDeleteConfirm();
    } else {
      alert(result.error || '批量删除失败');
    }
    setBatchDeleteLoading(false);
  };

  // ─── Dropdown handler ───
  const toggleDropdown = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setOpenDropdownId(prev => prev === id ? null : id);
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
      <div className="px-3 md:px-6 py-2 md:py-0 md:h-16 flex items-center gap-2 md:gap-4 bg-white z-20 shrink-0">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="搜索..."
            className="w-full bg-slate-100 hover:bg-slate-50 focus:bg-white border-transparent focus:border-purple-200 border rounded-full pl-9 pr-4 py-2 md:py-2.5 outline-none transition-all placeholder:text-slate-500 text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          onClick={startGeneration}
          disabled={isGenerating}
          className={`flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full font-medium text-xs md:text-sm transition-all shrink-0 ${
            isGenerating ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          <span className="hidden md:inline">{isGenerating ? '生成中...' : '开始创作'}</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="px-3 md:px-6 pb-2 border-b border-slate-100 flex items-center gap-3 md:gap-6 overflow-x-auto no-scrollbar shrink-0">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => {
              setActiveTab(tab);
              setIsSelectMode(false);
              setSelectedIds(new Set());
            }}
            className={`pb-2 md:pb-3 text-xs md:text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab}
          </button>
        ))}
        
        {activeTab === '我发布的' && filteredArtworks.length > 0 && (
          <div className="ml-auto flex items-center gap-1 md:gap-2 shrink-0">
            {isSelectMode && (
              <>
                <button
                  onClick={selectAll}
                  className="text-[10px] md:text-xs text-slate-500 hover:text-slate-700"
                >
                  全选
                </button>
                <span className="text-slate-300">|</span>
                <button
                  onClick={deselectAll}
                  className="text-[10px] md:text-xs text-slate-500 hover:text-slate-700"
                >
                  取消全选
                </button>
                <span className="text-slate-300">|</span>
              </>
            )}
            <button
              onClick={toggleSelectMode}
              className={`text-[10px] md:text-xs px-2 md:px-3 py-1 md:py-1.5 rounded-full transition-colors ${
                isSelectMode 
                  ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isSelectMode ? '取消选择' : '批量管理'}
            </button>
          </div>
        )}
      </div>

      {/* Grid Layout */}
      <div className="flex-1 overflow-y-auto p-3 md:p-6 bg-white">
        {/* Bulk Action Bar */}
        {isSelectMode && activeTab === '我发布的' && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4 flex items-center justify-between bg-slate-50 p-3 rounded-lg border border-slate-100 sticky top-0 z-20"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">已选择 {selectedIds.size} 项</span>
              {selectedIds.size > 0 && (
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  清空
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPublishModal(true)}
                disabled={selectedIds.size === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedIds.size > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Upload size={14} />
                <span>发布</span>
              </button>
              <button
                onClick={() => setShowBatchDeleteConfirm(true)}
                disabled={selectedIds.size === 0}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  selectedIds.size > 0
                    ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-100'
                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                }`}
              >
                <Trash2 size={14} />
                <span>删除</span>
              </button>
            </div>
          </motion.div>
        )}

        {loading ? (
          <div className="py-8 flex justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
          </div>
        ) : filteredArtworks.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">暂无帖子</div>
        ) : (
          <div className="w-full">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {filteredArtworks.map((art, index) => (
              <motion.div
                key={art.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.4, delay: index * 0.03 }}
                onClick={() => {
                  if (isSelectMode && activeTab === '我发布的') {
                    toggleSelectItem(art.id);
                  } else if (!art.isGenerating && art.postId) {
                    openDetail(art.postId);
                  }
                }}
                className={`bg-white rounded-lg md:rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer w-full relative ${
                  selectedIds.has(art.id) ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                {isSelectMode && activeTab === '我发布的' && (
                  <div 
                    className="absolute top-2 left-2 z-10 p-1 bg-white/80 rounded backdrop-blur-sm"
                    onClick={(e) => toggleSelectItem(art.id, e)}
                  >
                    {selectedIds.has(art.id) ? (
                      <CheckSquare size={20} className="text-blue-500" />
                    ) : (
                      <Square size={20} className="text-slate-400" />
                    )}
                  </div>
                )}
                
                {!isSelectMode && activeTab === '我发布的' && (
                  <div className="absolute top-2 right-2 z-20">
                    <button
                      onClick={(e) => toggleDropdown(art.id, e)}
                      className="p-1.5 bg-white/80 hover:bg-white rounded-full shadow-sm backdrop-blur-sm transition-all"
                    >
                      <MoreVertical size={16} className="text-slate-600" />
                    </button>
                    
                    {openDropdownId === art.id && (
                      <div className="absolute top-8 right-0 w-32 bg-white rounded-lg shadow-lg border border-slate-100 py-1 z-30">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(null);
                            handleEditClick(art);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                        >
                          <Edit2 size={14} />
                          编辑
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenDropdownId(null);
                            handleDeleteClick(art);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 size={14} />
                          删除
                        </button>
                      </div>
                    )}
                  </div>
                )}
                
                {art.url ? (
                  <div className="relative">
                    <img
                      src={art.url}
                      alt={art.title}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  (() => {
                    const palette = getCardColorPalette(art.title || '');
                    return (
                      <div 
                        className="relative w-full min-h-[100px] md:min-h-[120px] flex flex-col items-center justify-center p-3 md:p-4"
                        style={{ background: palette.bg }}
                      >
                        <div className="absolute top-3 right-3 w-10 h-10 md:w-12 md:h-12 rounded-full bg-white/30 blur-xl" />
                        <FileText className="mb-1 md:mb-2 drop-shadow-sm relative z-10" size={20} style={{ color: palette.text }} />
                        <h3 className="font-semibold text-[10px] md:text-xs line-clamp-2 text-center relative z-10" style={{ color: palette.text }}>{art.title}</h3>
                      </div>
                    );
                  })()
                )}
                <div className="p-2 md:p-3">
                  <h3 className="font-medium text-xs md:text-sm text-slate-800 line-clamp-2 mb-1 md:mb-2 leading-snug">{art.title}</h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 md:gap-2">
                      {art.authorAvatar ? (
                        <img src={getAvatarUrl(art.authorAvatar)} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <span className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[10px] text-slate-500">
                          {art.author?.charAt(0) || '?'}
                        </span>
                      )}
                      <span className="text-slate-500 text-xs truncate max-w-[80px]">{art.author}</span>
                    </div>
                    <button
                      onClick={(e) => toggleLike(art.id, e)}
                      className="flex items-center gap-1 text-slate-400 hover:text-pink-500 transition-colors"
                    >
                      <Heart size={14} fill={art.isLiked ? "#ec4899" : "none"} className={art.isLiked ? "text-pink-500" : ""} />
                      <span className="text-xs">{art.likes}</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          </div>
        )}
      </div>

      {/* Batch Delete Floating Button - rendered via portal */}
      {isSelectMode && selectedIds.size > 0 && createPortal(
        <div 
          style={{
            position: 'fixed',
            bottom: '24px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'white',
            borderRadius: '9999px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #e2e8f0',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            zIndex: 99999
          }}
        >
          <span style={{ fontSize: '14px', color: '#475569' }}>已选择 {selectedIds.size} 项</span>
          <button
            onClick={() => setShowBatchDeleteConfirm(true)}
            style={{
              padding: '6px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              fontSize: '14px',
              borderRadius: '9999px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            批量删除
          </button>
        </div>,
        document.body
      )}

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
                          (() => {
                            const palette = getCardColorPalette(selectedDetail?.post.title || '');
                            return (
                              <motion.div 
                                key="no-cover" 
                                initial={{ opacity: 0, scale: 0.95 }} 
                                animate={{ opacity: 1, scale: 1 }} 
                                className="flex flex-col items-center justify-center w-full h-full p-8"
                                style={{ background: palette.bg }}
                              >
                                <div className="absolute top-16 right-16 w-40 h-40 rounded-full bg-white/30 blur-3xl" />
                                <div className="absolute bottom-20 left-20 w-32 h-32 rounded-full bg-white/20 blur-2xl" />
                                <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-md">
                                  <FileText className="mb-6 drop-shadow-lg" size={48} style={{ color: palette.text }} />
                                  <h2 className="font-bold text-xl md:text-2xl leading-relaxed mb-4" style={{ color: palette.text }}>
                                    {selectedDetail?.post.title}
                                  </h2>
                                  {selectedDetail?.post.summary && (
                                    <p className="text-sm leading-relaxed line-clamp-4" style={{ color: palette.subtext }}>
                                      {selectedDetail.post.summary}
                                    </p>
                                  )}
                                  <div className="mt-8 flex items-center gap-2">
                                    <span className="px-4 py-1.5 bg-white/50 rounded-full backdrop-blur-sm text-xs font-medium" style={{ color: palette.text }}>
                                      文档笔记
                                    </span>
                                  </div>
                                </div>
                              </motion.div>
                            );
                          })()
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
                        <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
                          <BookOpen className="mb-4 opacity-50" size={48} />
                          <p>暂无文档索引分析</p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (selectedDetail.post.documentId) {
                                window.open(`/dashboard/documents/${selectedDetail.post.documentId}`, '_blank');
                              } else {
                                alert('文档不存在');
                              }
                            }}
                            className="mt-4 text-blue-600 hover:text-blue-700 text-sm font-medium underline underline-offset-4"
                          >
                            查看原文档
                          </button>
                        </div>
                      )}
                    </div>
                    </div>{/* end scrollable area */}

                    {/* Footer Actions */}
                    <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between gap-4 z-10 shrink-0">
                      <div className="flex gap-4">
                        <button className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${selectedDetail.post.isLiked ? 'text-pink-600' : 'text-slate-600 hover:text-pink-600'}`} onClick={() => toggleLike(String(selectedDetail!.post.id))}>
                          <Heart size={18} className={selectedDetail.post.isLiked ? 'fill-current' : ''} />
                          <span>{selectedDetail.post.likes}</span>
                        </button>
                        <button className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-600 transition-colors">
                          <MessageCircle size={18} />
                          <span>{selectedDetail.commentCount}</span>
                        </button>
                        <button className={`flex items-center gap-1.5 text-sm font-medium transition-colors ${selectedDetail.post.isBookmarked ? 'text-purple-600' : 'text-slate-600 hover:text-purple-600'}`}>
                          <Bookmark size={18} className={selectedDetail.post.isBookmarked ? 'fill-current' : ''} />
                        </button>
                      </div>
                      <button className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
                        <Share2 size={18} />
                        <span>分享</span>
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>,
      document.body
      )}

      {/* Publish Modal */}
      {showPublishModal && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPublishModal(false);
            }
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">发布到社区</h2>
              <p className="text-sm text-slate-600 mb-6">
                确定要发布选中的 {selectedIds.size} 篇文档吗？
              </p>
              
              <div className="flex items-center gap-3 mb-6 p-3 bg-slate-50 rounded-lg border border-slate-100">
                <input
                  type="checkbox"
                  id="public-toggle"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="public-toggle" className="text-sm text-slate-700 select-none cursor-pointer flex-1">
                  <span className="font-medium block">公开原文档</span>
                  <span className="text-xs text-slate-500 block mt-0.5">其他用户可查看文档全文</span>
                </label>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowPublishModal(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-colors"
                  disabled={publishLoading}
                >
                  取消
                </button>
                <button
                  onClick={handlePublish}
                  className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={publishLoading}
                >
                  {publishLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>发布中...</span>
                    </>
                  ) : (
                    <span>确认发布</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Modal */}
      {editingPost && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeEditModal();
            }
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">编辑帖子</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">标题</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="请输入标题"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">摘要</label>
                  <textarea
                    value={editSummary}
                    onChange={(e) => setEditSummary(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="请输入摘要"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeEditModal();
                  }}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditSave();
                  }}
                  disabled={editLoading || !editTitle.trim()}
                  className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editLoading ? '保存中...' : '保存'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {deletingPost && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeDeleteConfirm();
            }
          }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{ 
              maxHeight: '80vh', 
              overflowY: 'auto',
              width: '360px',
              maxWidth: '90vw'
            }}
          >
            <div className="p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">确认删除</h2>
              <p className="text-sm text-slate-600 mb-6 break-words">
                确定要删除「<span className="font-medium text-slate-800">{deletingPost.title.length > 30 ? deletingPost.title.slice(0, 30) + '...' : deletingPost.title}</span>」吗？此操作不可撤销。
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeDeleteConfirm();
                  }}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    color: '#475569',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConfirm();
                  }}
                  disabled={deleteLoading}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    color: '#ffffff',
                    backgroundColor: deleteLoading ? '#9ca3af' : '#ef4444',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: deleteLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {deleteLoading ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Batch Delete Confirmation Modal */}
      {showBatchDeleteConfirm && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)'
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeBatchDeleteConfirm();
            }
          }}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: '360px',
              maxWidth: '90vw',
              margin: '16px',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '24px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#0f172a', marginBottom: '8px' }}>批量删除确认</h2>
              <p style={{ fontSize: '14px', color: '#475569', marginBottom: '24px' }}>
                确定要删除选中的 {selectedIds.size} 个帖子吗？此操作不可撤销。
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeBatchDeleteConfirm();
                  }}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    color: '#475569',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  取消
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleBatchDeleteConfirm();
                  }}
                  disabled={batchDeleteLoading}
                  style={{
                    padding: '8px 16px',
                    fontSize: '14px',
                    color: '#ffffff',
                    backgroundColor: batchDeleteLoading ? '#9ca3af' : '#ef4444',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: batchDeleteLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  {batchDeleteLoading ? '删除中...' : '确认删除'}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
