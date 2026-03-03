import { useState, useEffect, useRef, useCallback, useMemo, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, Send, Smile, Phone, X, CornerUpLeft,
  Plus, Image as ImageIcon, FileText, ChevronRight, Check, Search,
} from 'lucide-react';
import { chatService, ChatMessage } from '../services/chatService';

// ── Mock gallery ──────────────────────────────────────────────────────────────
interface GalleryPhoto { id: string; url: string; }
const GALLERY_PHOTOS: GalleryPhoto[] = [
  { id: 'g1',  url: 'https://images.unsplash.com/photo-1752087022364-0882c43b1933?w=400&q=80' },
  { id: 'g2',  url: 'https://images.unsplash.com/photo-1750810908078-a4729905bf4b?w=400&q=80' },
  { id: 'g3',  url: 'https://images.unsplash.com/photo-1590579670545-bfbb5b038f86?w=400&q=80' },
  { id: 'g4',  url: 'https://images.unsplash.com/photo-1505209487757-5114235191e5?w=400&q=80' },
  { id: 'g5',  url: 'https://images.unsplash.com/photo-1583124688253-60c350bc90d7?w=400&q=80' },
  { id: 'g6',  url: 'https://images.unsplash.com/photo-1641673132482-e00166fb6f3b?w=400&q=80' },
  { id: 'g7',  url: 'https://images.unsplash.com/photo-1579833472711-fd404a240be7?w=400&q=80' },
  { id: 'g8',  url: 'https://images.unsplash.com/photo-1767433200322-3e999adde555?w=400&q=80' },
  { id: 'g9',  url: 'https://images.unsplash.com/photo-1738082956220-a1f20a8632ce?w=400&q=80' },
  { id: 'g10', url: 'https://images.unsplash.com/photo-1562601555-513820e5d0eb?w=400&q=80' },
  { id: 'g11', url: 'https://images.unsplash.com/photo-1768055104910-8c8d213835fb?w=400&q=80' },
  { id: 'g12', url: 'https://images.unsplash.com/photo-1635895954451-164408ee5461?w=400&q=80' },
];

// ── Mock notes ────────────────────────────────────────────────────────────────
interface NoteItem { id: string; title: string; cover: string; tags: string[]; excerpt: string; }
const MY_NOTES: NoteItem[] = [
  { id: 'note-1', title: 'React 性能优化的 10 个实用技巧', cover: 'https://images.unsplash.com/photo-1505209487757-5114235191e5?w=400&q=80', tags: ['React', '性能优化'], excerpt: '从 useMemo、useCallback 到 React.memo，深度解析每种优化手段的适用场景。' },
  { id: 'note-2', title: '如何搭建个人设计系统', cover: 'https://images.unsplash.com/photo-1562601555-513820e5d0eb?w=400&q=80', tags: ['设计系统', 'UI/UX'], excerpt: '从颜色体系、排版规范到组件库，手把手建立可复用设计框架。' },
  { id: 'note-3', title: '知识图谱：连接思维的桥梁', cover: 'https://images.unsplash.com/photo-1738082956220-a1f20a8632ce?w=400&q=80', tags: ['知识图谱', '思维导图'], excerpt: '知识不是孤立的点，而是彼此连接的网络，用图谱管理复杂知识体系。' },
  { id: 'note-4', title: '一个人的旅行方法论', cover: 'https://images.unsplash.com/photo-1635895954451-164408ee5461?w=400&q=80', tags: ['旅行', '生活方式'], excerpt: '不靠攻略、不走景点，如何用最小预算体验最真实的城市文化？' },
];

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props { userId: string; userName: string; userColor: string; userLetter: string; onClose: () => void; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatMsgTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const d = new Date(timestamp);
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diff < 604800000) return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function groupByDate(messages: ChatMessage[]): { label: string; msgs: ChatMessage[] }[] {
  const map = new Map<string, ChatMessage[]>();
  messages.forEach(msg => {
    const diff = Date.now() - msg.timestamp;
    const d = new Date(msg.timestamp);
    let key: string;
    if (diff < 86400000) key = '今天';
    else if (diff < 172800000) key = '昨天';
    else key = `${d.getMonth() + 1}月${d.getDate()}日`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(msg);
  });
  return Array.from(map.entries()).map(([label, msgs]) => ({ label, msgs }));
}

// ── Emoji Support Detection ────────────────────────────────────────────────────
let _emojiCanvas: HTMLCanvasElement | null = null;
let _emojiCtx: CanvasRenderingContext2D | null = null;
const _emojiCache = new Map<string, boolean>();

function isEmojiSupported(emoji: string): boolean {
  if (_emojiCache.has(emoji)) return _emojiCache.get(emoji)!;
  try {
    if (!_emojiCanvas) {
      _emojiCanvas = document.createElement('canvas');
      _emojiCanvas.width = _emojiCanvas.height = 20;
      _emojiCtx = _emojiCanvas.getContext('2d', { willReadFrequently: true });
      if (_emojiCtx) { _emojiCtx.font = '16px serif'; _emojiCtx.textBaseline = 'top'; }
    }
    const ctx = _emojiCtx;
    if (!ctx) { _emojiCache.set(emoji, true); return true; }
    ctx.clearRect(0, 0, 20, 20);
    ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 20, 20);
    ctx.fillStyle = 'black'; ctx.fillText(emoji, 0, 2);
    const d = ctx.getImageData(0, 0, 20, 20).data;
    let supported = false;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 50 && (Math.abs(d[i] - d[i+1]) > 22 || Math.abs(d[i+1] - d[i+2]) > 22 || Math.abs(d[i] - d[i+2]) > 22)) {
        supported = true; break;
      }
    }
    _emojiCache.set(emoji, supported);
    return supported;
  } catch { _emojiCache.set(emoji, true); return true; }
}

// ── Emoji Data ─────────────────────────────────────────────────────────────────
const EMOJI_CATS = [
  { id: 'smileys',    icon: '😀', label: '表情' },
  { id: 'gestures',  icon: '👋', label: '手势' },
  { id: 'hearts',    icon: '❤️', label: '爱心' },
  { id: 'nature',    icon: '🐱', label: '自然' },
  { id: 'food',      icon: '🍎', label: '食物' },
  { id: 'activities',icon: '⚽', label: '活动' },
  { id: 'travel',    icon: '✈️', label: '旅行' },
  { id: 'objects',   icon: '💡', label: '物品' },
  { id: 'symbols',   icon: '⭐', label: '符号' },
] as const;

const EMOJI_DATA: Record<string, string[]> = {
  smileys:    ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😲','😳','🥺','😢','😭','😱','😠','😡','🤬','😤','🤡','👻','💀','👽','👾','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
  gestures:   ['👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','🤙','👌','🤌','🤏','👈','👉','👆','👇','☝️','🫵','👋','🤚','🖐️','✋','🖖','🫱','🫲','💪','🙏','🤲','🙌','👐','🤝','✍️','💅','🤳','🫶','🫰','👁️','👀','👅','👄','🦶','🦵','🦾','🦻','👃','🧠','🫀','🫁'],
  hearts:     ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','❤️‍🔥','❤️‍🩹','💋','😻','💑','👫','👬','👭','🫂','🥰','😍','😘'],
  nature:     ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐒','🦆','🦅','🦉','🦇','🐺','🐴','🦄','🐝','🦋','🐌','🐞','🐜','🐢','🐍','🦎','🐙','🦑','🦐','🦞','🦀','🐠','🐟','🐬','🐋','🦈','🐊','🐅','🐆','🦓','🦒','🐘','🦛','🦏','🦘','🐕','🐈','🌸','🌺','🌻','🌹','🌷','🌿','🍀','🌱','🌳','🌴','🌵','🌊','🌈','☀️','🌙','⭐','❄️','🍄'],
  food:       ['🍎','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🍆','🥦','🌽','🥕','🍠','🥐','🍞','🧀','🥚','🍳','🥞','🧇','🥓','🍔','🍟','🍕','🌭','🌮','🌯','🥗','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🍤','🍙','🍚','🧁','🍰','🎂','🍫','🍬','🍭','🍿','🍩','🍪','☕','🍵','🧋','🍺','🍷','🥂','🍸','🍹','🧃','🥤'],
  activities: ['⚽','🏀','🏈','⚾','🎾','🏐','🏉','🥏','🎱','🏓','🏸','⛳','🎯','🎮','🕹️','🎲','♟️','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🎷','🎺','🎸','🎻','🏆','🥇','🥈','🥉','🏅','🎖️','🎪','🎠','🎡','🎢','✨','🎉','🎊','🎁','🎀','🎃','🎄','🎆','🎇'],
  travel:     ['✈️','🚀','🛸','🚁','⛵','🚢','🚂','🚄','🚇','🚗','🚕','🚙','🛻','🚌','🚑','🚒','🏎️','🏍️','🛵','🚲','🛴','🏔️','⛰️','🌋','🏝️','🏖️','🏕️','🏜️','🏛️','🏰','🗼','🗽','⛩️','🌁','🌃','🏙️','🌇','🌌','🗺️','🧭','🌍','🌎','🌏','🌐'],
  objects:    ['💎','💍','👑','🎩','🪄','🧿','🔮','🧸','📱','💻','🖥️','⌨️','🖱️','💾','💿','📷','📸','📹','🎥','📺','📻','🧭','⏰','🕰️','📡','🔋','🔌','💡','🔦','🕯️','🧲','💰','💳','📝','📚','📖','📰','🔑','🗝️','🔒','🔓','🔨','⚙️','🔧','🔩','🧪','🔬','🔭','💊','💉','🧹','🛒','📦','📫','🎁'],
  symbols:    ['❤️','⭐','🌟','💫','✨','🔥','💥','❄️','🌊','💨','⚡','🎯','✅','❌','⭕','❓','❗','💯','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','🔶','🔷','🔸','🔹','🔺','🔻','💠','♻️','🚩','🔈','🔊','🔔','🔕','💤','🔄','🔙','🔚','🔛','🔜','🔝','🆗','🆕','🆙','🆒','🆓','🆘','🅰️','🅱️','🅾️','⚜️'],
};

// ── EmojiPickerPanel ───────────────────────────────────────────────────────────
function EmojiPickerPanel({
  onPickEmoji, onDelete, recentEmojis,
}: {
  onPickEmoji: (e: string) => void;
  onDelete: () => void;
  recentEmojis: string[];
}) {
  const [activeCategory, setActiveCategory] = useState('smileys');
  const [search, setSearch] = useState('');
  const gridRef = useRef<HTMLDivElement>(null);

  const filteredData = useMemo(() => {
    const result: Record<string, string[]> = {};
    Object.entries(EMOJI_DATA).forEach(([cat, emojis]) => {
      result[cat] = emojis.filter(isEmojiSupported);
    });
    return result;
  }, []);

  const allEmojis = useMemo(() => Object.values(filteredData).flat(), [filteredData]);

  const displayEmojis = search
    ? allEmojis.filter(e => e.includes(search)).slice(0, 48)
    : activeCategory === 'recent'
      ? (recentEmojis.length > 0 ? recentEmojis.filter(isEmojiSupported) : filteredData.smileys?.slice(0, 32) ?? [])
      : filteredData[activeCategory] || [];

  const handleCatChange = (id: string) => {
    setActiveCategory(id);
    setSearch('');
    if (gridRef.current) gridRef.current.scrollTop = 0;
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#F4F4F7', userSelect: 'none' }}>
      {/* Search */}
      <div style={{ padding: '8px 12px 5px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', background: 'rgba(60,60,67,0.12)', borderRadius: '10px', padding: '7px 11px' }}>
          <Search size={13} color="#8E8E93" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索表情…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: '14px', color: '#1C1C1E', caretColor: '#6366F1', fontFamily: 'inherit' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '99px', background: 'rgba(60,60,67,0.3)' }}>
                <X size={10} color="white" strokeWidth={3} />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Section label */}
      {!search && (
        <p style={{ fontSize: '11px', color: '#8E8E93', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', padding: '0 16px 3px', flexShrink: 0 }}>
          {activeCategory === 'recent'
            ? (recentEmojis.length > 0 ? '最近使用' : '常用')
            : EMOJI_CATS.find(c => c.id === activeCategory)?.label}
        </p>
      )}

      {/* Emoji grid */}
      <div ref={gridRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '2px 8px 4px' }}>
        {displayEmojis.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80px', color: '#8E8E93', fontSize: '13px' }}>
            没有找到相关表情 😕
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)' }}>
            {displayEmojis.map((emoji, i) => (
              <button
                key={`${emoji}-${i}`}
                onClick={() => onPickEmoji(emoji)}
                style={{
                  aspectRatio: '1', border: 'none', cursor: 'pointer',
                  background: 'transparent', fontSize: '26px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  lineHeight: 1, borderRadius: '10px',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseDown={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.13)')}
                onMouseUp={e => (e.currentTarget.style.background = 'transparent')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                onTouchStart={e => (e.currentTarget.style.background = 'rgba(99,102,241,0.13)')}
                onTouchEnd={e => (e.currentTarget.style.background = 'transparent')}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Category tab bar */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center',
        borderTop: '0.5px solid rgba(0,0,0,0.14)',
        background: 'linear-gradient(180deg,#DEDEE4 0%,#D8D8DE 100%)',
        padding: '3px 4px 5px',
      }}>
        <button onClick={() => handleCatChange('recent')}
          style={{ flex: 1, aspectRatio: '1', border: 'none', cursor: 'pointer', borderRadius: '7px', background: activeCategory === 'recent' ? 'rgba(255,255,255,0.75)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', WebkitTapHighlightColor: 'transparent', boxShadow: activeCategory === 'recent' ? '0 1px 3px rgba(0,0,0,0.15)' : 'none', transition: 'all 0.15s' }}
        >🕐</button>
        {EMOJI_CATS.map(cat => (
          <button key={cat.id} onClick={() => handleCatChange(cat.id)}
            style={{ flex: 1, aspectRatio: '1', border: 'none', cursor: 'pointer', borderRadius: '7px', background: activeCategory === cat.id ? 'rgba(255,255,255,0.75)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', WebkitTapHighlightColor: 'transparent', boxShadow: activeCategory === cat.id ? '0 1px 3px rgba(0,0,0,0.15)' : 'none', transition: 'all 0.15s' }}
          >{cat.icon}</button>
        ))}
        <div style={{ width: '0.5px', height: '20px', background: 'rgba(0,0,0,0.18)', margin: '0 2px', flexShrink: 0 }} />
        <button onClick={onDelete}
          style={{ flexShrink: 0, width: '38px', aspectRatio: '1', border: 'none', cursor: 'pointer', borderRadius: '7px', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', WebkitTapHighlightColor: 'transparent', color: '#3C3C43' }}
          onMouseDown={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.10)')}
          onMouseUp={e => (e.currentTarget.style.background = 'transparent')}
          onTouchStart={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.10)')}
          onTouchEnd={e => (e.currentTarget.style.background = 'transparent')}
        >⌫</button>
      </div>
    </div>
  );
}

// ── ReplyQuoteBlock ───────────────────────────────────────────────────────────
function ReplyQuoteBlock({ replyTo, fromMe, userName }: { replyTo: { text: string; fromMe: boolean }; fromMe: boolean; userName: string }) {
  return (
    <div style={{ marginBottom: '6px', padding: '6px 12px', borderRadius: '10px', background: fromMe ? 'rgba(255,255,255,0.18)' : 'rgba(99,102,241,0.07)', borderLeft: `3px solid ${fromMe ? 'rgba(255,255,255,0.55)' : '#6366F1'}` }}>
      <p style={{ fontSize: '11px', fontWeight: 700, marginBottom: '2px', color: fromMe ? 'rgba(255,255,255,0.75)' : '#6366F1' }}>
        <CornerUpLeft size={10} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
        {replyTo.fromMe ? '我' : userName}
      </p>
      <p style={{ fontSize: '12px', color: fromMe ? 'rgba(255,255,255,0.65)' : '#9CA3AF', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {replyTo.text || '[图片/笔记]'}
      </p>
    </div>
  );
}

// ── PhotoBubble ───────────────────────────────────────────────────────────────
function PhotoBubble({ photoUrls, fromMe }: { photoUrls: string[]; fromMe: boolean }) {
  const shadow = fromMe ? '0 3px 14px rgba(99,102,241,0.32)' : '0 2px 10px rgba(0,0,0,0.1)';
  if (photoUrls.length === 1) return (
    <div style={{ maxWidth: '200px', borderRadius: '16px', overflow: 'hidden', boxShadow: shadow }}>
      <img src={photoUrls[0]} alt="" style={{ width: '100%', maxHeight: '240px', objectFit: 'cover', display: 'block' }} />
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px', maxWidth: '200px', borderRadius: '16px', overflow: 'hidden', boxShadow: shadow }}>
      {photoUrls.slice(0, 4).map((url, i) => (
        <img key={i} src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
      ))}
    </div>
  );
}

// ── NoteBubble ────────────────────────────────────────────────────────────────
function NoteBubble({ noteData, fromMe }: { noteData: NonNullable<ChatMessage['noteData']>; fromMe: boolean }) {
  return (
    <div style={{ maxWidth: '220px', borderRadius: '16px', overflow: 'hidden', background: 'white', border: '1px solid rgba(99,102,241,0.12)', boxShadow: fromMe ? '0 3px 14px rgba(99,102,241,0.22)' : '0 2px 10px rgba(0,0,0,0.08)' }}>
      <img src={noteData.cover} alt={noteData.title} style={{ width: '100%', height: '100px', objectFit: 'cover', display: 'block' }} />
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '6px' }}>
          <FileText size={12} style={{ color: '#6366F1', flexShrink: 0, marginTop: '2px' }} />
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#1E1B4B', lineHeight: 1.3 }}>{noteData.title}</p>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
          {noteData.tags.slice(0, 2).map(tag => (
            <span key={tag} style={{ fontSize: '10px', color: '#6366F1', background: 'rgba(99,102,241,0.08)', padding: '2px 7px', borderRadius: '99px', fontWeight: 600 }}>{tag}</span>
          ))}
        </div>
        <p style={{ fontSize: '11px', color: '#9CA3AF', lineHeight: 1.5, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{noteData.excerpt}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px', color: '#6366F1', fontSize: '12px', fontWeight: 600 }}>
          <span>查看笔记</span><ChevronRight size={11} />
        </div>
      </div>
    </div>
  );
}

// ── MessageBubble ─────────────────────────────────────────────────────────────
function MessageBubble({ msg, userColor, userLetter, userName, isNew, onLongPress }: {
  msg: ChatMessage; userColor: string; userLetter: string; userName: string; isNew?: boolean; onLongPress: (m: ChatMessage) => void;
}) {
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pressing, setPressing] = useState(false);
  const start = useCallback(() => { setPressing(true); pressTimer.current = setTimeout(() => { onLongPress(msg); setPressing(false); }, 420); }, [msg, onLongPress]);
  const cancel = useCallback(() => { if (pressTimer.current) clearTimeout(pressTimer.current); setPressing(false); }, []);
  const isPhoto = msg.type === 'photo' && msg.photoUrls && msg.photoUrls.length > 0;
  const isNote  = msg.type === 'note'  && msg.noteData;

  return (
    <motion.div
      initial={isNew ? { opacity: 0, y: 10, scale: 0.94 } : false}
      animate={{ opacity: 1, y: 0, scale: pressing ? 0.95 : 1 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '10px', userSelect: 'none', flexDirection: msg.fromMe ? 'row-reverse' : 'row' }}
      onTouchStart={start} onTouchEnd={cancel} onTouchMove={cancel}
      onContextMenu={e => { e.preventDefault(); onLongPress(msg); }}
      onMouseDown={start} onMouseUp={cancel} onMouseLeave={cancel}
    >
      {!msg.fromMe && (
        <div style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginBottom: '4px', background: `${userColor}18` }}>
          <span style={{ color: userColor, fontSize: '12px', fontWeight: 800 }}>{userLetter}</span>
        </div>
      )}
      <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', alignItems: msg.fromMe ? 'flex-end' : 'flex-start', gap: '2px' }}>
        {msg.replyTo && <ReplyQuoteBlock replyTo={msg.replyTo} fromMe={msg.fromMe} userName={userName} />}
        {isPhoto && msg.photoUrls ? (
          <PhotoBubble photoUrls={msg.photoUrls} fromMe={msg.fromMe} />
        ) : isNote && msg.noteData ? (
          <NoteBubble noteData={msg.noteData} fromMe={msg.fromMe} />
        ) : (
          <div style={{
            padding: '10px 16px', borderRadius: msg.fromMe ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
            ...(msg.fromMe ? { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: 'white', boxShadow: '0 3px 14px rgba(99,102,241,0.32)' } : { background: '#F3F4F6', color: '#1E1B4B' })
          }}>
            <p style={{ fontSize: '14px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{msg.text}</p>
          </div>
        )}
        <span style={{ fontSize: '10px', color: '#C4C9D4', padding: '0 2px' }}>{formatMsgTime(msg.timestamp)}</span>
      </div>
    </motion.div>
  );
}

// ── ContextMenu ──────────────────────────────────────────────────────────────
function ContextMenu({ msg, userName, userColor, userLetter, onReply, onCopy, onDelete, onDismiss }: {
  msg: ChatMessage; userName: string; userColor: string; userLetter: string;
  onReply: () => void; onCopy: () => void; onDelete: () => void; onDismiss: () => void;
}) {
  const isPhoto = msg.type === 'photo' && msg.photoUrls?.length;
  const isNote  = msg.type === 'note'  && msg.noteData;
  const actions = [
    { emoji: '↩️', label: '回复',  handler: onReply,  color: '#6366F1', bg: 'rgba(99,102,241,0.13)' },
    { emoji: isPhoto ? '🖼️' : isNote ? '📌' : '📋', label: isPhoto ? '保存' : isNote ? '收藏' : '复制', handler: onCopy, color: '#3B82F6', bg: 'rgba(59,130,246,0.13)' },
    { emoji: '🗑️', label: '删除', handler: onDelete, color: '#EF4444', bg: 'rgba(239,68,68,0.13)' },
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
      style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px', background: 'rgba(10,8,30,0.68)', backdropFilter: 'blur(18px)' }}
      onClick={onDismiss}
    >
      <motion.div initial={{ scale: 0.86, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: '300px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', flexDirection: msg.fromMe ? 'row-reverse' : 'row' }}>
          {!msg.fromMe && <div style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `${userColor}22` }}><span style={{ color: userColor, fontSize: '12px', fontWeight: 800 }}>{userLetter}</span></div>}
          <div style={{ maxWidth: '78%' }}>
            {isPhoto && msg.photoUrls ? (
              <div style={{ maxWidth: '180px', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.28)' }}>
                <img src={msg.photoUrls[0]} alt="" style={{ width: '100%', height: '140px', objectFit: 'cover', display: 'block' }} />
                {msg.photoUrls.length > 1 && <div style={{ background: 'rgba(0,0,0,0.62)', color: 'white', textAlign: 'center', padding: '5px', fontSize: '12px', fontWeight: 600 }}>共 {msg.photoUrls.length} 张</div>}
              </div>
            ) : isNote && msg.noteData ? (
              <div style={{ maxWidth: '200px', borderRadius: '16px', overflow: 'hidden', background: 'rgba(255,255,255,0.96)', boxShadow: '0 4px 20px rgba(0,0,0,0.22)' }}>
                <img src={msg.noteData.cover} alt="" style={{ width: '100%', height: '80px', objectFit: 'cover', display: 'block' }} />
                <div style={{ padding: '8px 12px' }}><p style={{ color: '#1E1B4B', fontSize: '12px', fontWeight: 700 }}>{msg.noteData.title}</p></div>
              </div>
            ) : (
              <div style={{ padding: '10px 16px', borderRadius: msg.fromMe ? '18px 4px 18px 18px' : '4px 18px 18px 18px', ...(msg.fromMe ? { background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: 'white', boxShadow: '0 4px 18px rgba(99,102,241,0.4)' } : { background: 'rgba(255,255,255,0.95)', color: '#1E1B4B' }) }}>
                <p style={{ fontSize: '14px', lineHeight: 1.6 }}>{msg.text}</p>
              </div>
            )}
            <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)', marginTop: '4px', padding: '0 2px', textAlign: msg.fromMe ? 'right' : 'left' }}>{formatMsgTime(msg.timestamp)}</p>
          </div>
        </div>
      </motion.div>
      <motion.div initial={{ scale: 0.86, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 28, delay: 0.06 }}
        onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: '12px' }}>
        {actions.map(item => (
          <motion.button key={item.label} whileTap={{ scale: 0.86 }} onClick={item.handler}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '14px 20px', borderRadius: '16px', background: item.bg, minWidth: '76px', border: `1px solid ${item.color}28`, cursor: 'pointer' }}>
            <span style={{ fontSize: '24px', lineHeight: 1 }}>{item.emoji}</span>
            <span style={{ color: item.color, fontSize: '12px', fontWeight: 700 }}>{item.label}</span>
          </motion.button>
        ))}
      </motion.div>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px', marginTop: '20px' }}>轻触空白处关闭</motion.p>
    </motion.div>
  );
}

// ── TypingIndicator ───────────────────────────────────────────────────────────
function TypingIndicator({ userColor, userLetter }: { userColor: string; userLetter: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10, scale: 0.92 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.96 }} transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', marginBottom: '10px' }}>
      <div style={{ width: '32px', height: '32px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `${userColor}18` }}>
        <span style={{ color: userColor, fontSize: '12px', fontWeight: 800 }}>{userLetter}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '12px 16px', borderRadius: '4px 18px 18px 18px', background: '#F3F4F6' }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i} animate={{ y: [0, -5, 0] }} transition={{ duration: 0.65, delay: i * 0.18, repeat: Infinity, ease: 'easeInOut' }}
            style={{ width: '6px', height: '6px', borderRadius: '99px', background: '#9CA3AF' }} />
        ))}
      </div>
    </motion.div>
  );
}

// ── PhotoPicker ───────────────────────────────────────────────────────────────
function PhotoPicker({ selected, onToggle, onSend, onClose }: { selected: Set<string>; onToggle: (id: string) => void; onSend: () => void; onClose: () => void }) {
  const count = selected.size;
  const orderedIds = [...selected];
  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#FDFDFF 0%,#F9F8FF 100%)', borderRadius: 'inherit', zIndex: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 16px 12px', borderBottom: '1px solid rgba(99,102,241,0.08)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.08)', border: 'none', cursor: 'pointer' }}>
          <ChevronLeft size={18} color="#6366F1" />
        </button>
        <p style={{ flex: 1, color: '#1E1B4B', fontSize: '16px', fontWeight: 800 }}>选择照片</p>
        {count > 0 && (
          <button onClick={onSend} style={{ padding: '8px 16px', borderRadius: '12px', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', color: 'white', fontSize: '14px', fontWeight: 700, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.38)' }}>
            发送 {count}
          </button>
        )}
      </div>
      <p style={{ color: '#C4C9D4', fontSize: '12px', padding: '8px 16px 0', flexShrink: 0 }}>可多选，最多 9 张</p>
      {/* Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '2px' }}>
          {GALLERY_PHOTOS.map((photo, i) => {
            const isSel = selected.has(photo.id);
            const selIdx = isSel ? orderedIds.indexOf(photo.id) + 1 : 0;
            return (
              <motion.div key={photo.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.025, type: 'spring', stiffness: 400, damping: 28 }}
                onClick={() => onToggle(photo.id)} style={{ position: 'relative', aspectRatio: '1', overflow: 'hidden', borderRadius: '8px', cursor: 'pointer' }}>
                <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: isSel ? 'scale(0.92)' : 'scale(1)', transition: 'transform 0.18s' }} />
                {isSel && <div style={{ position: 'absolute', inset: 0, borderRadius: '8px', background: 'rgba(99,102,241,0.34)' }} />}
                <div style={{ position: 'absolute', top: '6px', right: '6px', width: '24px', height: '24px', borderRadius: '99px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isSel ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'rgba(255,255,255,0.78)', border: isSel ? 'none' : '1.5px solid rgba(255,255,255,0.9)', boxShadow: '0 1px 5px rgba(0,0,0,0.22)' }}>
                  {isSel && <span style={{ color: 'white', fontSize: '11px', fontWeight: 800 }}>{selIdx}</span>}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
      {/* Bottom */}
      <div style={{ flexShrink: 0, padding: '12px 16px 16px', borderTop: '1px solid rgba(99,102,241,0.07)', background: 'rgba(253,253,255,0.97)' }}>
        <button onClick={count > 0 ? onSend : undefined}
          style={{ width: '100%', padding: '14px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: count > 0 ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'rgba(0,0,0,0.06)', color: count > 0 ? 'white' : '#C4C9D4', border: 'none', cursor: count > 0 ? 'pointer' : 'default', boxShadow: count > 0 ? '0 4px 16px rgba(99,102,241,0.38)' : 'none', transition: 'all 0.2s', fontSize: '15px', fontWeight: 700 }}>
          <ImageIcon size={16} />
          {count > 0 ? `发送 ${count} 张照片` : '请选择照片'}
        </button>
      </div>
    </motion.div>
  );
}

// ── NotePicker ────────────────────────────────────────────────────────────────
function NotePicker({ selectedId, onSelect, onSend, onClose }: { selectedId: string | null; onSelect: (id: string) => void; onSend: () => void; onClose: () => void }) {
  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg,#FDFDFF 0%,#F9F8FF 100%)', borderRadius: 'inherit', zIndex: 10 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 16px 12px', borderBottom: '1px solid rgba(99,102,241,0.08)', flexShrink: 0 }}>
        <button onClick={onClose} style={{ width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.08)', border: 'none', cursor: 'pointer' }}>
          <ChevronLeft size={18} color="#6366F1" />
        </button>
        <div>
          <p style={{ color: '#1E1B4B', fontSize: '16px', fontWeight: 800 }}>分享笔记</p>
          <p style={{ color: '#9CA3AF', fontSize: '11px' }}>选择一篇笔记发给对方</p>
        </div>
      </div>
      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {MY_NOTES.map((note, i) => {
          const isSel = note.id === selectedId;
          return (
            <motion.div key={note.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06, type: 'spring', stiffness: 400, damping: 28 }}
              onClick={() => onSelect(note.id)} style={{ display: 'flex', gap: '12px', padding: '12px', borderRadius: '16px', cursor: 'pointer', background: isSel ? 'rgba(99,102,241,0.06)' : 'white', border: `1.5px solid ${isSel ? 'rgba(99,102,241,0.28)' : 'rgba(0,0,0,0.06)'}`, boxShadow: isSel ? '0 4px 18px rgba(99,102,241,0.14)' : '0 2px 10px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}>
              <img src={note.cover} alt={note.title} style={{ width: '64px', height: '64px', borderRadius: '12px', objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ color: '#1E1B4B', fontSize: '13px', fontWeight: 700, marginBottom: '4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{note.title}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
                  {note.tags.slice(0, 2).map(tag => <span key={tag} style={{ fontSize: '10px', color: '#6366F1', background: 'rgba(99,102,241,0.08)', padding: '1px 6px', borderRadius: '99px', fontWeight: 600 }}>{tag}</span>)}
                </div>
                <p style={{ color: '#9CA3AF', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note.excerpt}</p>
              </div>
              <div style={{ width: '24px', height: '24px', borderRadius: '99px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, alignSelf: 'center', background: isSel ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'rgba(0,0,0,0.06)', transition: 'all 0.2s' }}>
                {isSel && <Check size={13} color="white" />}
              </div>
            </motion.div>
          );
        })}
      </div>
      {/* Bottom */}
      <div style={{ flexShrink: 0, padding: '12px 16px 16px', borderTop: '1px solid rgba(99,102,241,0.07)', background: 'rgba(253,253,255,0.97)' }}>
        <button onClick={selectedId ? onSend : undefined}
          style={{ width: '100%', padding: '14px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: selectedId ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'rgba(0,0,0,0.06)', color: selectedId ? 'white' : '#C4C9D4', border: 'none', cursor: selectedId ? 'pointer' : 'default', boxShadow: selectedId ? '0 4px 16px rgba(99,102,241,0.38)' : 'none', transition: 'all 0.2s', fontSize: '15px', fontWeight: 700 }}>
          <FileText size={16} />
          {selectedId ? '发送笔记' : '请选择笔记'}
        </button>
      </div>
    </motion.div>
  );
}

// ── DirectMessageSheet ────────────────────────────────────────────────────────
export function DirectMessageSheet({ userId, userName, userColor, userLetter, onClose }: Props) {
  const [messages, setMessages]               = useState<ChatMessage[]>([]);
  const [newMsgIds, setNewMsgIds]             = useState<Set<string | number>>(new Set());
  const [inputText, setInputText]             = useState('');
  const [isTyping, setIsTyping]               = useState(false);
  const [replyTarget, setReplyTarget]         = useState<ChatMessage | null>(null);
  const [contextMsg, setContextMsg]           = useState<ChatMessage | null>(null);
  const [showAttachPanel, setShowAttachPanel] = useState(false);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [showNotePicker,  setShowNotePicker]  = useState(false);
  const [selectedPhotos,  setSelectedPhotos]  = useState<Set<string>>(new Set());
  const [selectedNoteId,  setSelectedNoteId]  = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [recentEmojis,    setRecentEmojis]    = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('hibrain_recent_emojis') || '[]'); }
    catch { return []; }
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef    = useRef<HTMLTextAreaElement>(null);
  const typingTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const replyTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollToBottom = useCallback(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, []);
  
  const loadMessages = useCallback(async () => {
    try {
      const { messages } = await chatService.getConversationMessages(userId);
      setMessages(messages);
    } catch (e) { console.error(e); }
  }, [userId]);

  useEffect(() => { setTimeout(scrollToBottom, 120); }, [messages.length, scrollToBottom]);
  
  useEffect(() => {
    loadMessages();
    const handler = () => loadMessages();
    window.addEventListener('hibrain_dm_new_message', handler);
    return () => window.removeEventListener('hibrain_dm_new_message', handler);
  }, [loadMessages]);

  useEffect(() => () => { if (typingTimer.current) clearTimeout(typingTimer.current); if (replyTimer.current) clearTimeout(replyTimer.current); }, []);

  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInputText(e.target.value);
    const ta = e.target; ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    if (e.target.value && showAttachPanel) setShowAttachPanel(false);
  };

  const handleLongPress = useCallback((msg: ChatMessage) => { setContextMsg(msg); setShowAttachPanel(false); }, []);
  const handleReply = useCallback(() => { if (!contextMsg) return; setReplyTarget(contextMsg); setContextMsg(null); setTimeout(() => textareaRef.current?.focus(), 80); }, [contextMsg]);
  const handleCopy  = useCallback(() => { if (!contextMsg) return; navigator.clipboard.writeText(contextMsg.text || contextMsg.noteData?.title || '[图片]').catch(() => {}); setContextMsg(null); }, [contextMsg]);
  const handleDelete = useCallback(() => {
    if (!contextMsg) return;
    // deleteMessage(userId, contextMsg.id); // TODO: Implement delete in chatService
    // loadMessages();
    if (replyTarget?.id === contextMsg.id) setReplyTarget(null);
    setContextMsg(null);
  }, [contextMsg, userId, replyTarget]);

  const insertEmoji = useCallback((emoji: string) => {
    const ta = textareaRef.current;
    const start = ta ? (ta.selectionStart ?? inputText.length) : inputText.length;
    const end   = ta ? (ta.selectionEnd   ?? inputText.length) : inputText.length;
    const newText = inputText.slice(0, start) + emoji + inputText.slice(end);
    setInputText(newText);
    // Auto-resize textarea
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
    // Restore cursor position
    const newPos = start + [...emoji].length;
    setTimeout(() => {
      if (textareaRef.current) textareaRef.current.setSelectionRange(newPos, newPos);
    }, 0);
    // Persist recent emojis
    setRecentEmojis(prev => {
      const updated = [emoji, ...prev.filter(e => e !== emoji)].slice(0, 32);
      localStorage.setItem('hibrain_recent_emojis', JSON.stringify(updated));
      return updated;
    });
  }, [inputText]);

  const deleteEmoji = useCallback(() => {
    setInputText(prev => {
      if (!prev) return prev;
      try {
        const seg = new (Intl as any).Segmenter();
        const segs = [...seg.segment(prev)].map((s: any) => s.segment);
        return segs.slice(0, -1).join('');
      } catch {
        return [...prev].slice(0, -1).join('');
      }
    });
  }, []);

  const handleSend = async () => {
    const text = inputText.trim(); if (!text) return;
    const replyTo = replyTarget ? { text: replyTarget.text || (replyTarget.type === 'photo' ? '[图片]' : replyTarget.noteData?.title || '[笔记]'), fromMe: replyTarget.fromMe } : undefined;
    setInputText(''); setReplyTarget(null); setShowEmojiPicker(false);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    
    try {
      const sent = await chatService.sendMessage(userId, text, { replyTo });
      setNewMsgIds(p => new Set([...p, sent.id]));
      loadMessages();
    } catch (e) { console.error(e); }
  };

  const handleSendPhotos = async () => {
    if (!selectedPhotos.size) return;
    const photoUrls = [...selectedPhotos].map(id => GALLERY_PHOTOS.find(p => p.id === id)!.url);
    try {
      const sent = await chatService.sendMessage(userId, '', { type: 'photo', photoUrls });
      setNewMsgIds(p => new Set([...p, sent.id])); 
      loadMessages();
    } catch (e) { console.error(e); }
    setSelectedPhotos(new Set()); setShowPhotoPicker(false);
  };

  const handleSendNote = async () => {
    const note = MY_NOTES.find(n => n.id === selectedNoteId); if (!note) return;
    try {
      const sent = await chatService.sendMessage(userId, '', { type: 'note', noteData: { id: note.id, title: note.title, cover: note.cover, tags: note.tags, excerpt: note.excerpt } });
      setNewMsgIds(p => new Set([...p, sent.id]));
      loadMessages();
    } catch (e) { console.error(e); }
    setSelectedNoteId(null); setShowNotePicker(false);
  };

  const groups = groupByDate(messages);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
        style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'flex-end', background: 'rgba(10,8,30,0.52)', backdropFilter: 'blur(10px)' }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 310, damping: 34 }}
          style={{ width: '100%', maxWidth: '480px', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', height: '88vh', background: 'linear-gradient(180deg,#FDFDFF 0%,#F9F8FF 100%)', borderRadius: '28px 28px 0 0', boxShadow: '0 -8px 40px rgba(99,102,241,0.14)' }}
          onClick={e => e.stopPropagation()}
          drag="y" dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.16 }}
          onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 500) onClose(); }}
        >
          {/* Drag handle */}
          <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px', flexShrink: 0, cursor: 'grab' }}>
            <div style={{ width: '40px', height: '4px', borderRadius: '99px', background: 'rgba(30,27,75,0.13)' }} />
          </div>

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px 12px', flexShrink: 0, borderBottom: '1px solid rgba(99,102,241,0.08)' }}>
            <motion.button whileTap={{ scale: 0.87 }} onClick={onClose} style={{ width: '36px', height: '36px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '10px', background: 'rgba(99,102,241,0.08)', border: 'none', cursor: 'pointer' }}>
              <ChevronLeft size={18} color="#6366F1" />
            </motion.button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${userColor}20` }}>
                  <span style={{ color: userColor, fontSize: '15px', fontWeight: 800 }}>{userLetter}</span>
                </div>
                <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                  style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '14px', height: '14px', borderRadius: '99px', border: '2px solid white', background: '#22C55E' }} />
              </div>
              <div>
                <p style={{ color: '#1E1B4B', fontSize: '15px', fontWeight: 800 }}>{userName}</p>
                <p style={{ color: '#22C55E', fontSize: '11px', fontWeight: 600 }}>在线中</p>
              </div>
            </div>

          </div>

          {/* ── Messages area ── */}
          <div
            style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 16px 6px' }}
            onClick={() => setShowAttachPanel(false)}
          >
            {groups.map(group => (
              <div key={group.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '12px 0' }}>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.06)' }} />
                  <span style={{ color: '#C4C9D4', fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em' }}>{group.label}</span>
                  <div style={{ flex: 1, height: '1px', background: 'rgba(0,0,0,0.06)' }} />
                </div>
                {group.msgs.map(msg => (
                  <MessageBubble key={msg.id} msg={msg} userColor={userColor} userLetter={userLetter} userName={userName} isNew={newMsgIds.has(msg.id)} onLongPress={handleLongPress} />
                ))}
              </div>
            ))}
            <AnimatePresence>
              {isTyping && <TypingIndicator key="typing" userColor={userColor} userLetter={userLetter} />}
            </AnimatePresence>
            <div ref={messagesEndRef} style={{ height: '4px' }} />
          </div>

          {/* ── Emoji picker panel ── */}
          <AnimatePresence>
            {showEmojiPicker && (
              <motion.div
                key="emoji-panel"
                initial={{ height: 0 }}
                animate={{ height: 286 }}
                exit={{ height: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 38, mass: 0.75 }}
                style={{ flexShrink: 0, overflow: 'hidden' }}
              >
                <EmojiPickerPanel
                  onPickEmoji={insertEmoji}
                  onDelete={deleteEmoji}
                  recentEmojis={recentEmojis}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Input area ── */}
          <div style={{ flexShrink: 0, borderTop: '1px solid rgba(99,102,241,0.07)', background: 'white' }}>

            {/* Attach panel (no AnimatePresence — just conditional render) */}
            {showAttachPanel && (
              <div style={{ display: 'flex', gap: '12px', padding: '12px 16px 6px' }}>
                <button onClick={() => { setShowAttachPanel(false); setShowPhotoPicker(true); }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '14px 0', borderRadius: '16px', background: 'rgba(236,72,153,0.07)', border: '1.5px solid rgba(236,72,153,0.15)', cursor: 'pointer' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#EC4899,#F97316)' }}>
                    <ImageIcon size={22} color="white" />
                  </div>
                  <span style={{ color: '#1E1B4B', fontSize: '13px', fontWeight: 700 }}>发照片</span>
                  <span style={{ color: '#9CA3AF', fontSize: '11px' }}>从相册选择</span>
                </button>
                <button onClick={() => { setShowAttachPanel(false); setShowNotePicker(true); }}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '14px 0', borderRadius: '16px', background: 'rgba(99,102,241,0.07)', border: '1.5px solid rgba(99,102,241,0.15)', cursor: 'pointer' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)' }}>
                    <FileText size={22} color="white" />
                  </div>
                  <span style={{ color: '#1E1B4B', fontSize: '13px', fontWeight: 700 }}>发笔记</span>
                  <span style={{ color: '#9CA3AF', fontSize: '11px' }}>分享我的笔记</span>
                </button>
              </div>
            )}

            {/* Reply banner */}
            {replyTarget && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px 0' }}>
                <div style={{ width: '2px', height: '32px', borderRadius: '99px', background: '#6366F1', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: '#6366F1', fontSize: '11px', fontWeight: 700, marginBottom: '2px' }}>
                    <CornerUpLeft size={10} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                    回复 {replyTarget.fromMe ? '自己' : userName}
                  </p>
                  <p style={{ color: '#9CA3AF', fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {replyTarget.text || (replyTarget.type === 'photo' ? '[图片]' : replyTarget.noteData?.title || '[笔记]')}
                  </p>
                </div>
                <button onClick={() => setReplyTarget(null)} style={{ width: '24px', height: '24px', borderRadius: '99px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.07)', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                  <X size={12} color="#9CA3AF" />
                </button>
              </div>
            )}

            {/* ── Input row ── */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', padding: '10px 16px 14px' }}>

              {/* ＋ Attach */}
              <button
                onClick={() => { setShowAttachPanel(v => !v); setShowEmojiPicker(false); }}
                style={{ width: '36px', height: '36px', borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: showAttachPanel ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'rgba(99,102,241,0.09)', border: 'none', cursor: 'pointer', transform: showAttachPanel ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.22s ease, background 0.2s' }}
              >
                <Plus size={18} color={showAttachPanel ? 'white' : '#6366F1'} />
              </button>

              {/* Textarea */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', background: replyTarget ? 'rgba(99,102,241,0.07)' : '#F5F5F8', border: `1.5px solid ${replyTarget ? 'rgba(99,102,241,0.28)' : 'rgba(99,102,241,0.12)'}`, borderRadius: '14px', padding: '9px 14px', transition: 'border-color 0.2s' }}>
                <textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={handleTextareaChange}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={replyTarget ? '回复消息…' : '发送消息…'}
                  rows={1}
                  style={{ flex: 1, width: '100%', background: 'transparent', border: 'none', outline: 'none', resize: 'none', color: '#1E1B4B', fontSize: '14px', lineHeight: '1.5', maxHeight: '120px', overflow: 'auto', display: 'block', fontFamily: 'inherit' }}
                />
              </div>

              {/* 😊 Emoji — toggles picker */}
              <button
                onClick={() => { setShowEmojiPicker(v => !v); setShowAttachPanel(false); }}
                style={{
                  width: '36px', height: '36px', borderRadius: '12px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: showEmojiPicker ? 'linear-gradient(135deg,#6366F1,#8B5CF6)' : 'rgba(99,102,241,0.09)',
                  border: 'none', cursor: 'pointer', transition: 'background 0.2s',
                }}
              >
                <Smile size={18} color={showEmojiPicker ? 'white' : '#6366F1'} />
              </button>

              {/* Send / Like */}
              {inputText.trim() ? (
                <button onClick={handleSend}
                  style={{ width: '36px', height: '36px', borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', border: 'none', cursor: 'pointer', boxShadow: '0 3px 12px rgba(99,102,241,0.42)' }}>
                  <Send size={16} color="white" />
                </button>
              ) : (
                <button
                  onClick={async () => { 
                    try {
                      const sent = await chatService.sendMessage(userId, '👍', {}); 
                      setNewMsgIds(p=>new Set([...p,sent.id])); 
                      loadMessages(); 
                    } catch(e) { console.error(e); }
                  }}
                  style={{ width: '36px', height: '36px', borderRadius: '12px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(99,102,241,0.09)', border: 'none', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>
                  👍
                </button>
              )}
            </div>
          </div>

          {/* ── Pickers ── */}
          <AnimatePresence>
            {showPhotoPicker && (
              <PhotoPicker key="photo" selected={selectedPhotos}
                onToggle={id => setSelectedPhotos(p => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; })}
                onSend={handleSendPhotos} onClose={() => { setShowPhotoPicker(false); setSelectedPhotos(new Set()); }} />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {showNotePicker && (
              <NotePicker key="note" selectedId={selectedNoteId} onSelect={setSelectedNoteId}
                onSend={handleSendNote} onClose={() => { setShowNotePicker(false); setSelectedNoteId(null); }} />
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMsg && (
          <ContextMenu key={contextMsg.id} msg={contextMsg} userName={userName} userColor={userColor} userLetter={userLetter}
            onReply={handleReply} onCopy={handleCopy} onDelete={handleDelete} onDismiss={() => setContextMsg(null)} />
        )}
      </AnimatePresence>
    </>
  );
}
