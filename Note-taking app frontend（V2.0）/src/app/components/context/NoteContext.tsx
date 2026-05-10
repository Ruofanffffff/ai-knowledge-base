import { createContext, useContext, useState, useEffect, ReactNode, useRef } from "react";
import { api } from "../../services/api";

export type Note = {
  id: string;
  title?: string;
  content: string;
  type: "text" | "image" | "mixed";
  status?: "inbox" | "archived";
  createdAt: number;
  tags?: string[];
  imageUrl?: string;
  structuredData?: any;
  localOnly?: boolean;
  pendingSync?: boolean;
};

interface NoteContextType {
  notes: Note[];
  loading: boolean;
  error: string | null;
  addNote: (note: Omit<Note, "id" | "createdAt">) => Promise<Note | undefined>;
  deleteNote: (id: string) => Promise<void>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  refreshNotes: () => Promise<void>;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

function normalizeContent(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw === null || raw === undefined) return "";
  return String(raw);
}

function stripHtmlToPlainText(raw: unknown): string {
  const content = normalizeContent(raw);
  return content
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function deriveDisplayTitle(inputTitle: unknown, content: unknown): string {
  const titleText = stripHtmlToPlainText(inputTitle);
  if (titleText) return titleText.slice(0, 20);
  const contentText = stripHtmlToPlainText(content);
  return contentText ? contentText.slice(0, 20) : '无标题';
}

function normalizeTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((tag) => (typeof tag === "string" ? tag.trim() : String(tag ?? "").trim()))
      .filter(Boolean);
  }

  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return [];

    // 兼容后端返回 JSON 字符串数组（如: '["AI","知识图谱"]'）
    if ((text.startsWith("[") && text.endsWith("]")) || (text.startsWith("\"[") && text.endsWith("]\""))) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) return normalizeTags(parsed);
      } catch {
        // ignore and fallback to split
      }
    }

    return text
      .split(/[，,\s|/]+/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

export function NoteProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const syncingLocalRef = useRef(false);

  const LOCAL_NOTES_KEY = 'shisi_local_notes_v1';

  const safeParseArray = (raw: any): any[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return [];
  };

  const loadLocalNotes = (): Note[] => {
    try {
      const text = localStorage.getItem(LOCAL_NOTES_KEY);
      if (!text) return [];
      const parsed = JSON.parse(text);
      const arr = safeParseArray(parsed);
      return arr
        .map((n: any) => ({
          id: String(n?.id || ''),
          title: typeof n?.title === 'string' ? n.title : undefined,
          content: normalizeContent(n?.content),
          type: (n?.type === 'image' || n?.type === 'mixed') ? n.type : 'text',
          status: (n?.status === 'inbox' || n?.status === 'archived') ? n.status : 'inbox',
          createdAt: Number(n?.createdAt || Date.now()),
          tags: normalizeTags(n?.tags),
          imageUrl: typeof n?.imageUrl === 'string' ? n.imageUrl : undefined,
          structuredData: n?.structuredData,
          localOnly: true,
          pendingSync: true,
        }))
        .filter((n: Note) => Boolean(n.id) && Boolean(n.content));
    } catch {
      return [];
    }
  };

  const saveLocalNotes = (localNotes: Note[]) => {
    try {
      const toSave = localNotes
        .filter((n) => n.localOnly)
        .map((n) => ({
          id: n.id,
          title: n.title,
          content: n.content,
          type: n.type,
          status: n.status,
          createdAt: n.createdAt,
          tags: n.tags || [],
          imageUrl: n.imageUrl,
          structuredData: n.structuredData,
        }));
      localStorage.setItem(LOCAL_NOTES_KEY, JSON.stringify(toSave));
    } catch {}
  };

  const isLocalId = (id: string) => String(id || '').startsWith('local-');

  const genLocalId = () => `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const fetchNotes = async () => {
    // Prevent fetching if no token is present (e.g. on login screen)
    const token = localStorage.getItem('access_token');
    if (!token) {
      const local = loadLocalNotes();
      setNotes(local.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // Backend returns { success: true, data: { notes: [], total: ... } }
      const response = await api.get('/notes');
      
      if (response.data.success && response.data.data.notes) {
        const local = loadLocalNotes();
        const fetchedNotes = response.data.data.notes.map((n: any) => ({
          content: normalizeContent(n.content),
          tags: normalizeTags(n.tags),
          id: String(n.id),
          title: deriveDisplayTitle(n.title, n.content),
          status: (n.status === 'inbox' || n.status === 'archived') ? n.status : 'archived',
          // Infer type from attachments if present
          type: n.attachments && n.attachments.length > 0 
            ? (n.attachments.some((a: any) => a.type === 'image' || a.type === 'IMAGE') ? 'image' : 'mixed') 
            : 'text',
          createdAt: new Date(n.createdAt).getTime(),
          // Map first image attachment to imageUrl if exists
          imageUrl: n.attachments?.find((a: any) => a.type === 'image' || a.type === 'IMAGE')?.url,
          structuredData: n.structuredData
        }));
        const byId = new Map<string, Note>();
        for (const n of fetchedNotes) byId.set(n.id, n);
        for (const n of local) if (!byId.has(n.id)) byId.set(n.id, n);
        const merged = Array.from(byId.values()).sort((a, b) => b.createdAt - a.createdAt);
        setNotes(merged);

        if (local.length > 0 && !syncingLocalRef.current) {
          syncingLocalRef.current = true;
          (async () => {
            try {
              for (const ln of local) {
                try {
                  await api.post('/notes', {
                    content: ln.content,
                    tags: normalizeTags(ln.tags),
                    status: ln.status || 'inbox',
                  });
                } catch {}
              }
              saveLocalNotes([]);
            } finally {
              syncingLocalRef.current = false;
              fetchNotes().catch(() => {});
            }
          })();
        }
      }
    } catch (err) {
      console.error('Failed to fetch notes:', err);
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const addNote = async (note: Omit<Note, "id" | "createdAt">): Promise<Note | undefined> => {
    try {
      const normalizedContent = note.content?.trim();
      if (!normalizedContent) {
        throw new Error('笔记内容不能为空');
      }

      const token = localStorage.getItem('access_token');
      if (!token) {
        const localNote: Note = {
          id: genLocalId(),
          title: deriveDisplayTitle(note.title, normalizedContent),
          content: normalizedContent,
          tags: normalizeTags(note.tags),
          status: note.status || 'inbox',
          type: note.type || 'text',
          createdAt: Date.now(),
          imageUrl: (note as any)?.imageUrl,
          structuredData: (note as any)?.structuredData,
          localOnly: true,
          pendingSync: true,
        };
        setNotes((prev) => [localNote, ...prev].sort((a, b) => b.createdAt - a.createdAt));
        const local = loadLocalNotes();
        saveLocalNotes([localNote, ...local].sort((a, b) => b.createdAt - a.createdAt));
        return localNote;
      }

      // Optimistic update could be implemented here, but for now let's wait for server
      const response = await api.post('/notes', {
        content: normalizedContent,
        tags: normalizeTags(note.tags),
        status: note.status
      });

      if (response.data.success) {
        await fetchNotes(); // Refresh list to get the new note with server ID
        // Try to find the new note in the updated list or return from response if available
        return response.data.data;
      }
    } catch (err) {
      console.error('Failed to add note:', err);
      const message =
        (err as any)?.response?.data?.error ||
        (err as Error)?.message ||
        '创建笔记失败';
      throw new Error(message);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      if (isLocalId(id)) {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        const local = loadLocalNotes().filter((n) => n.id !== id);
        saveLocalNotes(local);
        return;
      }
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Failed to delete note:', err);
      throw err;
    }
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    try {
      if (isLocalId(id)) {
        setNotes((prev) =>
          prev.map((note) => (
            note.id === id
              ? {
                  ...note,
                  ...updates,
                  content: updates.content !== undefined ? normalizeContent(updates.content) : note.content,
                  tags: updates.tags !== undefined ? normalizeTags(updates.tags) : note.tags,
                }
              : note
          ))
        );
        const local = loadLocalNotes().map((n) => {
          if (n.id !== id) return n;
          return {
            ...n,
            ...updates,
            content: updates.content !== undefined ? normalizeContent(updates.content) : n.content,
            tags: updates.tags !== undefined ? normalizeTags(updates.tags) : n.tags,
          };
        });
        saveLocalNotes(local);
        return;
      }
      await api.put(`/notes/${id}`, {
        content: updates.content,
        tags: updates.tags !== undefined ? normalizeTags(updates.tags) : undefined,
        status: updates.status
      });
      
      // Update local state
      setNotes((prev) =>
        prev.map((note) => (
          note.id === id
            ? {
                ...note,
                ...updates,
                content: updates.content !== undefined ? normalizeContent(updates.content) : note.content,
                tags: updates.tags !== undefined ? normalizeTags(updates.tags) : note.tags,
              }
            : note
        ))
      );
    } catch (err) {
      console.error('Failed to update note:', err);
      throw err;
    }
  };

  return (
    <NoteContext.Provider value={{ notes, loading, error, addNote, deleteNote, updateNote, refreshNotes: fetchNotes }}>
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
