import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { BookOpen, Search, Activity, ExternalLink } from 'lucide-react';
import { Modal, message } from 'antd';
import ReactMarkdown from 'react-markdown';
import apiService from '../services/api';
import type { WikiHealth, WikiPage } from '../api/types';

type WikiFilter = 'all' | 'concept' | 'entity' | 'insight' | 'source' | 'meta';

function getPageType(page: WikiPage): Exclude<WikiFilter, 'all'> | null {
  const slug = String(page.slug || '').toLowerCase();
  const title = String(page.title || '').toLowerCase().trim();
  const candidates: Array<Exclude<WikiFilter, 'all'>> = ['concept', 'entity', 'insight', 'source', 'meta'];
  for (const t of candidates) {
    if (slug === t || slug.startsWith(`${t}-`) || slug.startsWith(`${t}/`)) return t;
    if (title === t || title.startsWith(`${t}:`) || title.startsWith(`${t}：`)) return t;
  }
  return null;
}

export default function Wiki() {
  const navigate = useNavigate();
  const { slug } = useParams();

  const [isLoading, setIsLoading] = useState(true);
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<WikiFilter>('all');
  const [selectedSlug, setSelectedSlug] = useState<string | null>(slug || null);

  const [healthOpen, setHealthOpen] = useState(false);
  const [healthLoading, setHealthLoading] = useState(false);
  const [healthData, setHealthData] = useState<WikiHealth | null>(null);

  const [pageOpen, setPageOpen] = useState(false);
  const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);

  const loadPages = async (q?: string) => {
    setIsLoading(true);
    const res = await apiService.getWikiPages({ q, limit: 200, offset: 0 });
    if (res.success) {
      setPages(res.data || []);
    } else {
      message.error(res.error || '加载 Wiki 页面失败');
      setPages([]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadPages();
  }, []);

  useEffect(() => {
    setSelectedSlug(slug || null);
  }, [slug]);

  const filteredPages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return pages.filter((p) => {
      const type = getPageType(p);
      if (filter !== 'all' && type !== filter) return false;
      if (!q) return true;
      return (
        String(p.title || '').toLowerCase().includes(q) ||
        String(p.slug || '').toLowerCase().includes(q) ||
        String(p.summary || '').toLowerCase().includes(q) ||
        String(p.markdown || '').toLowerCase().includes(q)
      );
    });
  }, [pages, searchQuery, filter]);

  const openPage = (p: WikiPage) => {
    setSelectedPage(p);
    setPageOpen(true);
    setSelectedSlug(p.slug);
    navigate(`/wiki/${p.slug}`);
  };

  useEffect(() => {
    if (!selectedSlug) return;
    const p = pages.find(x => x.slug === selectedSlug);
    if (p) {
      setSelectedPage(p);
      setPageOpen(true);
    }
  }, [pages, selectedSlug]);

  const handleHealthCheck = async () => {
    setHealthOpen(true);
    setHealthLoading(true);
    const res = await apiService.wikiHealth();
    if (res.success) {
      setHealthData(res.data || null);
    } else {
      setHealthData(null);
      message.error(res.error || '健康检查失败');
    }
    setHealthLoading(false);
  };

  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col bg-slate-50/50">
      <div className="flex-1 overflow-hidden px-4 md:px-8 py-3 md:py-5">
        <div className="h-full bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-4 md:px-6 py-3 md:py-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl md:text-2xl font-bold text-slate-900">Wiki</h1>
                <p className="text-slate-500 mt-0.5 text-sm">从来源中编译出来的可读知识页</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleHealthCheck}
                  className="flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 bg-slate-50 border border-slate-200 rounded-lg md:rounded-xl hover:bg-slate-100 transition-colors text-sm"
                >
                  <Activity size={16} className="text-slate-500" />
                  <span className="font-medium text-slate-700">健康检查</span>
                </button>
              </div>
            </div>
          </div>

          <div className="p-4 border-b border-slate-100 bg-slate-50/30 shrink-0">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="搜索 Wiki 页面..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar">
                {(['all', 'concept', 'entity', 'insight', 'source', 'meta'] as WikiFilter[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setFilter(t)}
                    className={`px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                      filter === t ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <button
                onClick={() => loadPages(searchQuery.trim() ? searchQuery.trim() : undefined)}
                className="px-3 py-2 rounded-xl text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
              >
                刷新
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent animate-spin rounded-full" />
              </div>
            ) : filteredPages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <BookOpen size={48} className="mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">暂无 Wiki 页面</h3>
                <p className="text-sm">可以在 HiBrain 对话里把结果保存为 Wiki</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPages.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => openPage(p)}
                    className="text-left bg-white rounded-xl border border-slate-200 p-4 cursor-pointer transition-all duration-200 hover:border-purple-300 hover:shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-400">{p.slug}</div>
                        <div className="font-medium text-slate-800 line-clamp-1">{p.title}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-purple-50 text-purple-500 shrink-0">
                        <BookOpen size={16} />
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-500 line-clamp-3">
                      {p.summary || ''}
                    </div>
                    <div className="mt-3 text-xs text-slate-400">
                      {p.updatedAt ? new Date(p.updatedAt).toLocaleString('zh-CN') : ''}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={pageOpen}
        onCancel={() => {
          setPageOpen(false);
          setSelectedPage(null);
          setSelectedSlug(null);
          navigate('/wiki');
        }}
        footer={null}
        width={900}
        title={selectedPage?.title || 'Wiki'}
      >
        {selectedPage && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>{selectedPage.slug}</span>
              <span>·</span>
              <span>v{selectedPage.version}</span>
              {selectedPage.lastCompiledAt && (
                <>
                  <span>·</span>
                  <span>编译于 {new Date(selectedPage.lastCompiledAt).toLocaleString('zh-CN')}</span>
                </>
              )}
              <span className="ml-auto" />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(selectedPage.markdown || '');
                  message.success('已复制 Markdown');
                }}
                className="px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                复制 Markdown
              </button>
              <button
                onClick={() => window.open(`/wiki/${selectedPage.slug}`, '_blank')}
                className="px-2 py-1 rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors inline-flex items-center gap-1"
              >
                <ExternalLink size={14} />
                新窗口
              </button>
            </div>
            <div className="prose prose-slate max-w-none">
              <ReactMarkdown>{selectedPage.markdown || ''}</ReactMarkdown>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={healthOpen}
        onCancel={() => setHealthOpen(false)}
        footer={null}
        width={720}
        title="Wiki 健康检查"
      >
        <div className="space-y-3">
          {healthLoading ? (
            <div className="flex items-center gap-2 text-slate-600">
              <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent animate-spin rounded-full" />
              <span>检查中...</span>
            </div>
          ) : (
            <pre className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs overflow-auto">
              {healthData ? JSON.stringify(healthData, null, 2) : '无数据'}
            </pre>
          )}
        </div>
      </Modal>
    </div>
  );
}

