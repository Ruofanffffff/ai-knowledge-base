import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Clock, User, FileText } from 'lucide-react';
import { apiService, CommunityPost } from '../services/api';
import { parseIndexSections } from '../utils/parseIndexSections';
import SectionCard from '../components/SectionCard';
import { formatTimeAgo, getAvatarUrl } from '../utils/transformers';

type PostDetail = CommunityPost & {
  indexData: { indexedText: string; version: number; metadata: Record<string, any> } | null;
};

function parseTags(tags: string[] | string | null | undefined): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) return tags;
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function CommunityPostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiService.getCommunityPostDetail(parseInt(id)).then((res) => {
      if (res.success && res.data) {
        setPost(res.data);
      } else {
        setError(res.error || '加载失败');
      }
      setLoading(false);
    });
  }, [id]);

  const toggleLike = async () => {
    if (!post) return;
    setPost(prev => prev ? {
      ...prev,
      isLiked: !prev.isLiked,
      likes: prev.isLiked ? prev.likes - 1 : prev.likes + 1,
    } : prev);
    const res = await apiService.togglePostLike(post.id);
    if (!res.success) {
      setPost(prev => prev ? {
        ...prev,
        isLiked: !prev.isLiked,
        likes: prev.isLiked ? prev.likes - 1 : prev.likes + 1,
      } : prev);
    }
  };

  const sections = post?.indexData?.indexedText
    ? parseIndexSections(post.indexData.indexedText)
    : [];

  const tags = parseTags(post?.tags as any);
  const avatarUrl = post ? getAvatarUrl(post.authorAvatar) : null;

  if (loading) {
    return (
      <div className="flex-1 h-full flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-500 animate-spin" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-white gap-4">
        <p className="text-slate-400 text-sm">{error || '帖子不存在'}</p>
        <button onClick={() => navigate('/community')} className="text-sm text-purple-600 hover:underline">
          返回社区
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* 顶部导航 */}
      <div className="h-14 px-4 md:px-6 flex items-center gap-3 bg-white border-b border-slate-100 shrink-0">
        <button
          onClick={() => navigate('/community')}
          className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h1 className="text-sm font-medium text-slate-800 truncate flex-1">{post.title}</h1>
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${
            post.isLiked
              ? 'text-pink-500 bg-pink-50'
              : 'text-slate-400 hover:text-pink-500 hover:bg-pink-50'
          }`}
        >
          <Heart size={14} fill={post.isLiked ? 'currentColor' : 'none'} />
          <span>{post.likes}</span>
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 md:px-6 py-6">
          {/* 作者信息 */}
          <div className="flex items-center gap-3 mb-5">
            {avatarUrl ? (
              <img src={avatarUrl} alt={post.authorName} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <span className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs text-slate-500">
                {post.authorName?.charAt(0) || <User size={14} />}
              </span>
            )}
            <div>
              <p className="text-sm font-medium text-slate-700">{post.authorName}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Clock size={10} />
                {formatTimeAgo(post.createdAt)}
              </p>
            </div>
          </div>

          {/* 标签 */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-5">
              {tags.map((tag, i) => (
                <span key={i} className="px-2.5 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* 文档索引内容 */}
          {sections.length > 0 ? (
            <div className="flex flex-col gap-4">
              {sections.map((section, i) => (
                <SectionCard key={`${section.type}-${i}`} section={section} index={i} />
              ))}
            </div>
          ) : (
            <div className="py-16 text-center">
              <FileText size={32} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-400">该文档暂无索引数据</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
