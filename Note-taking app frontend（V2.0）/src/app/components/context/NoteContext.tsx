import { createContext, useContext, useState, useEffect, ReactNode } from "react";

export type Note = {
  id: string;
  title?: string;
  content: string;
  type: "text" | "image" | "mixed";
  createdAt: number;
  tags?: string[];
  imageUrl?: string;
  structuredData?: any;
};

interface NoteContextType {
  notes: Note[];
  addNote: (note: Omit<Note, "id" | "createdAt">) => void;
  deleteNote: (id: string) => void;
  updateNote: (id: string, updates: Partial<Note>) => void;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

const STORAGE_KEY = 'inspiration_notes_v2';

const DEFAULT_NOTES: Note[] = [
  {
    id: "demo1",
    title: "产品设计灵感",
    content: "简约的布局配合大胆的排版，使用渐变色彩营造现代感，保持界面清爽与易用性的平衡。留白是设计的语言。",
    type: "text",
    createdAt: Date.now() - 1000 * 60 * 30,
    tags: ["设计", "灵感"],
  },
  {
    id: "demo2",
    title: "读书笔记 · 心流",
    content: "当一个人能全身心投入某项活动，忘却时间流逝，这种状态就是心流。专注本身就是一种奖励。米哈里·契克森米哈伊的核心观点：挑战与技能的匹配。",
    type: "text",
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    tags: ["读书", "心理学"],
    structuredData: {
      mindmapData: {
        central_topic: "心流",
        nodes: [
          { text: "心流状态" },
          { text: "挑战匹配" },
          { text: "专注奖励" },
          { text: "忘却时间" },
          { text: "内在动机" },
        ],
      },
    },
  },
  {
    id: "demo3",
    title: "周末计划",
    content: "周六早上跑步 5km，下午去图书馆。周日整理家里，晚上和朋友吃饭。",
    type: "text",
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
    tags: ["生活"],
  },
  {
    id: "demo4",
    title: "创业想法",
    content: "AI驱动的个人知识管理工具，能够自动提取文章要点，建立知识图谱，实现\"第二大脑\"。核心差异化：本地优先，隐私保护，离线可用。",
    type: "text",
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    tags: ["创业", "AI"],
  },
  {
    id: "demo5",
    title: "引人深思的话",
    content: "「我们看见的不是事物本身，而是我们自己。」—— 普鲁斯特",
    type: "text",
    createdAt: Date.now() - 1000 * 60 * 60 * 36,
    tags: ["摘录"],
  },
  {
    id: "demo6",
    title: "技术调研",
    content: "React Server Components 的优势：减少客户端 JS 体积，服务端直接访问数据库，自动代码分割。配合 Suspense 实现流式渲染。需要深入了解边界划分原则。",
    type: "text",
    createdAt: Date.now() - 1000 * 60 * 60 * 48,
    tags: ["技术", "React"],
  },
  {
    id: "demo7",
    title: "购物清单",
    content: "牛奶 × 2、有机鸡蛋、全麦面包、希腊酸奶、蓝莓、羽衣甘蓝、橄榄油",
    type: "text",
    createdAt: Date.now() - 1000 * 60 * 60 * 72,
    tags: ["生活"],
  },
];

const DEMO2_MINDMAP = {
  central_topic: "心流",
  nodes: [
    { text: "心流状态" },
    { text: "挑战匹配" },
    { text: "专注奖励" },
    { text: "忘却时间" },
    { text: "内在动机" },
  ],
};

const loadNotes = (): Note[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: Note[] = JSON.parse(stored);
      if (parsed && parsed.length > 0) {
        // Backfill mindmap data for demo2 if missing
        return parsed.map(n =>
          n.id === 'demo2' && !n.structuredData?.mindmapData
            ? { ...n, structuredData: { ...(n.structuredData ?? {}), mindmapData: DEMO2_MINDMAP } }
            : n
        );
      }
    }
  } catch (error) {
    console.error('Failed to load notes:', error);
  }
  return DEFAULT_NOTES;
};

const saveNotes = (notes: Note[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch (error) {
    console.error('Failed to save notes:', error);
  }
};

export function NoteProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>(loadNotes);

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  const addNote = (note: Omit<Note, "id" | "createdAt">) => {
    const newNote: Note = {
      ...note,
      id: Date.now().toString(36) + Math.random().toString(36).substring(2),
      createdAt: Date.now(),
    };
    setNotes((prev) => [newNote, ...prev]);
  };

  const deleteNote = (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const updateNote = (id: string, updates: Partial<Note>) => {
    setNotes((prev) =>
      prev.map((note) => (note.id === id ? { ...note, ...updates } : note))
    );
  };

  return (
    <NoteContext.Provider value={{ notes, addNote, deleteNote, updateNote }}>
      {children}
    </NoteContext.Provider>
  );
}

export function useNotes() {
  const context = useContext(NoteContext);
  if (context === undefined) {
    throw new Error("useNotes must be used within a NoteProvider");
  }
  return context;
}