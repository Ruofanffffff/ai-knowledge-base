import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "../../services/api";

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

  const fetchNotes = async () => {
    // Prevent fetching if no token is present (e.g. on login screen)
    const token = localStorage.getItem('access_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      // Backend returns { success: true, data: { notes: [], total: ... } }
      const response = await api.get('/notes');
      
      if (response.data.success && response.data.data.notes) {
        const fetchedNotes = response.data.data.notes.map((n: any) => ({
          content: normalizeContent(n.content),
          tags: normalizeTags(n.tags),
          id: n.id,
          title: normalizeContent(n.content).split('\n')[0]?.substring(0, 20) || '无标题',
          // Infer type from attachments if present
          type: n.attachments && n.attachments.length > 0 
            ? (n.attachments.some((a: any) => a.type === 'image' || a.type === 'IMAGE') ? 'image' : 'mixed') 
            : 'text',
          createdAt: new Date(n.createdAt).getTime(),
          // Map first image attachment to imageUrl if exists
          imageUrl: n.attachments?.find((a: any) => a.type === 'image' || a.type === 'IMAGE')?.url,
          structuredData: n.structuredData
        }));
        setNotes(fetchedNotes);
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

      // Optimistic update could be implemented here, but for now let's wait for server
      const response = await api.post('/notes', {
        content: normalizedContent,
        tags: normalizeTags(note.tags)
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
      await api.delete(`/notes/${id}`);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Failed to delete note:', err);
      throw err;
    }
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    try {
      await api.put(`/notes/${id}`, {
        content: updates.content,
        tags: normalizeTags(updates.tags)
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
