import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { noteService, Note as BackendNote } from "../../services/noteService";
import { authService } from "../../services/authService";

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
  addNote: (note: Omit<Note, "id" | "createdAt">) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;
  updateNote: (id: string, updates: Partial<Note>) => Promise<void>;
  refreshNotes: () => Promise<void>;
}

const NoteContext = createContext<NoteContextType | undefined>(undefined);

// Helper to convert BackendNote to Frontend Note
const mapBackendNote = (bn: BackendNote): Note => {
  // Simple heuristic: First line is title if it's short, else just content
  const lines = bn.content.split('\n');
  const potentialTitle = lines[0].length < 50 ? lines[0] : undefined;
  const contentBody = potentialTitle ? lines.slice(1).join('\n') : bn.content;

  // Try to find image attachment
  const imgAttachment = bn.attachments?.find(a => a.type?.startsWith('image/'));

  return {
    id: bn.id,
    title: potentialTitle,
    content: contentBody || bn.content, // Fallback to full content if no title split
    type: imgAttachment ? "image" : "text", // Simplified type logic
    createdAt: new Date(bn.createdAt).getTime(),
    tags: bn.tags,
    imageUrl: imgAttachment?.url,
    // structuredData: not supported by backend yet
  };
};

export function NoteProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchNotes = useCallback(async () => {
    if (!authService.isAuthenticated()) {
      setNotes([]);
      return;
    }
    
    setLoading(true);
    try {
      const response = await noteService.getNotes({ limit: 100 }); // Get last 100 notes
      const mappedNotes = response.notes.map(mapBackendNote);
      setNotes(mappedNotes);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
      // Fallback to local notes if needed, or just show empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();

    const handleAuthChange = () => fetchNotes();
    window.addEventListener('auth_login', handleAuthChange);
    window.addEventListener('auth_logout', handleAuthChange);

    return () => {
      window.removeEventListener('auth_login', handleAuthChange);
      window.removeEventListener('auth_logout', handleAuthChange);
    };
  }, [fetchNotes]);

  const addNote = async (note: Omit<Note, "id" | "createdAt">) => {
    try {
      // Combine title and content for backend
      const fullContent = note.title ? `${note.title}\n${note.content}` : note.content;
      
      const newNote = await noteService.createNote({
        content: fullContent,
        tags: note.tags
      });
      
      setNotes((prev) => [mapBackendNote(newNote), ...prev]);
    } catch (error) {
      console.error("Failed to create note:", error);
      throw error;
    }
  };

  const deleteNote = async (id: string) => {
    try {
      await noteService.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error("Failed to delete note:", error);
      throw error;
    }
  };

  const updateNote = async (id: string, updates: Partial<Note>) => {
    try {
      // We need the current note to merge content if needed
      const currentNote = notes.find(n => n.id === id);
      if (!currentNote) return;

      const mergedTitle = updates.title !== undefined ? updates.title : currentNote.title;
      const mergedContent = updates.content !== undefined ? updates.content : currentNote.content;
      
      const fullContent = mergedTitle ? `${mergedTitle}\n${mergedContent}` : mergedContent;
      
      const updatedBackendNote = await noteService.updateNote(id, {
        content: fullContent,
        tags: updates.tags
      });

      setNotes((prev) =>
        prev.map((note) => (note.id === id ? mapBackendNote(updatedBackendNote) : note))
      );
    } catch (error) {
      console.error("Failed to update note:", error);
      throw error;
    }
  };

  return (
    <NoteContext.Provider value={{ notes, loading, addNote, deleteNote, updateNote, refreshNotes: fetchNotes }}>
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
