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
          id: n.id,
          title: n.content.split('\n')[0].substring(0, 20), // Simple title extraction
          content: n.content,
          // Infer type from attachments if present
          type: n.attachments && n.attachments.length > 0 
            ? (n.attachments.some((a: any) => a.type === 'image' || a.type === 'IMAGE') ? 'image' : 'mixed') 
            : 'text',
          createdAt: new Date(n.createdAt).getTime(),
          tags: n.tags || [],
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
      // Optimistic update could be implemented here, but for now let's wait for server
      const response = await api.post('/notes', {
        content: note.content,
        tags: note.tags
      });

      if (response.data.success) {
        await fetchNotes(); // Refresh list to get the new note with server ID
        // Try to find the new note in the updated list or return from response if available
        return response.data.data;
      }
    } catch (err) {
      console.error('Failed to add note:', err);
      throw err;
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
        tags: updates.tags
      });
      
      // Update local state
      setNotes((prev) =>
        prev.map((note) => (note.id === id ? { ...note, ...updates } : note))
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
