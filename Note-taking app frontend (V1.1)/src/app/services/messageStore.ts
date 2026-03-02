// ── Message data store (localStorage-backed) ─────────────────────────────────

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
  replyTo?: { text: string; fromMe: boolean };
  type?: 'text' | 'photo' | 'note';
  photoUrls?: string[];
  noteData?: { id: string; title: string; cover: string; tags: string[]; excerpt: string };
}

export interface Conversation {
  userId: string;
  messages: ChatMessage[];
}

const STORE_KEY = 'hibrain_dm_v1';

function loadStore(): Record<string, Conversation> {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveStore(data: Record<string, Conversation>): void {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('hibrain_dm_update'));
}

// ── Seed initial conversations ────────────────────────────────────────────────
const SEED: Record<string, Conversation> = {
  '1': {
    userId: '1',
    messages: [
      { id: 's1-1', fromMe: false, text: '你好！看了你关于设计系统的文章，太有共鸣了 🙌', timestamp: Date.now() - 86400000 },
      { id: 's1-2', fromMe: true, text: '谢谢！你的知识图谱方法论也很棒，我也在探索这个方向', timestamp: Date.now() - 82800000 },
      { id: 's1-3', fromMe: false, text: '有机会可以深入交流一下吗？感觉能碰撞出很多火花 ✨', timestamp: Date.now() - 7200000 },
    ],
  },
  '3': {
    userId: '3',
    messages: [
      { id: 's3-1', fromMe: false, text: '你的 React RSC 文章写得很清晰，直接收藏了！', timestamp: Date.now() - 172800000 },
      { id: 's3-2', fromMe: true, text: '哈哈多谢，后续还会出 TypeScript 系列，敬请期待', timestamp: Date.now() - 169200000 },
      { id: 's3-3', fromMe: true, text: '你有在用思链管理技术知识体系吗？', timestamp: Date.now() - 168000000 },
    ],
  },
  '4': {
    userId: '4',
    messages: [
      { id: 's4-1', fromMe: false, text: '你有没有用过 Hi Brain 整理旅行笔记？效果怎么样？', timestamp: Date.now() - 600000 },
      { id: 's4-2', fromMe: false, text: '我最近在用，感觉还不错但想问问你的使用技巧', timestamp: Date.now() - 300000 },
    ],
  },
};

function seedIfEmpty(): void {
  const existing = loadStore();
  if (Object.keys(existing).length === 0) saveStore(SEED);
}

seedIfEmpty();

// ── Public API ────────────────────────────────────────────────────────────────

export function getConversation(userId: string): Conversation {
  return loadStore()[userId] || { userId, messages: [] };
}

export function getAllConversations(): Conversation[] {
  return Object.values(loadStore()).filter(c => c.messages.length > 0);
}

export function sendMessage(
  userId: string,
  text: string,
  options?: {
    replyTo?: { text: string; fromMe: boolean };
    type?: 'text' | 'photo' | 'note';
    photoUrls?: string[];
    noteData?: { id: string; title: string; cover: string; tags: string[]; excerpt: string };
  },
): ChatMessage {
  const store = loadStore();
  const conv = store[userId] || { userId, messages: [] };
  const msg: ChatMessage = {
    id: `snt-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fromMe: true,
    text,
    timestamp: Date.now(),
    ...(options?.replyTo ? { replyTo: options.replyTo } : {}),
    ...(options?.type ? { type: options.type } : {}),
    ...(options?.photoUrls ? { photoUrls: options.photoUrls } : {}),
    ...(options?.noteData ? { noteData: options.noteData } : {}),
  };
  conv.messages = [...conv.messages, msg];
  store[userId] = conv;
  saveStore(store);
  return msg;
}

export function receiveMessage(userId: string, text: string): ChatMessage {
  const store = loadStore();
  const conv = store[userId] || { userId, messages: [] };
  const msg: ChatMessage = {
    id: `rcv-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    fromMe: false,
    text,
    timestamp: Date.now(),
  };
  conv.messages = [...conv.messages, msg];
  store[userId] = conv;
  saveStore(store);
  return msg;
}

export function deleteMessage(userId: string, msgId: string): void {
  const store = loadStore();
  const conv = store[userId];
  if (!conv) return;
  conv.messages = conv.messages.filter(m => m.id !== msgId);
  store[userId] = conv;
  saveStore(store);
}

/** Returns number of conversations whose last message is incoming (= has unread) */
export function getUnreadCount(): number {
  return getAllConversations().filter(c => {
    const last = c.messages[c.messages.length - 1];
    return last && !last.fromMe;
  }).length;
}

export function formatMsgTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const d = new Date(timestamp);
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (diff < 604800000) return ['周日','周一','周二','周三','周四','周五','周六'][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function groupByDate(messages: ChatMessage[]): { label: string; msgs: ChatMessage[] }[] {
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