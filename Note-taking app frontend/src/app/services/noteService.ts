import { api } from './api';

export interface Note {
  id: string;
  userId: string;
  content: string;
  tags: string[];
  attachments?: any[]; // Define Attachment type if needed
  createdAt: string;
  updatedAt: string;
}

export interface NotesListResponse {
  notes: Note[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const noteService = {
  async getNotes(params?: { page?: number; limit?: number; tags?: string[]; sortBy?: string; order?: string }): Promise<NotesListResponse> {
    const response = await api.get<{ success: boolean; data: NotesListResponse }>('/notes', { params });
    return response.data.data;
  },

  async getNote(id: string): Promise<Note> {
    const response = await api.get<{ success: boolean; data: Note }>(`/notes/${id}`);
    return response.data.data;
  },

  async createNote(data: { content: string; tags?: string[] }): Promise<Note> {
    const response = await api.post<{ success: boolean; data: Note }>('/notes', data);
    return response.data.data;
  },

  async updateNote(id: string, data: { content?: string; tags?: string[] }): Promise<Note> {
    const response = await api.put<{ success: boolean; data: Note }>(`/notes/${id}`, data);
    return response.data.data;
  },

  async deleteNote(id: string): Promise<Note> {
    const response = await api.delete<{ success: boolean; data: Note }>(`/notes/${id}`);
    return response.data.data;
  },

  async getAllTags(): Promise<string[]> {
    const response = await api.get<{ success: boolean; data: { tags: string[] } }>('/notes/tags/all');
    return response.data.data.tags;
  },

  async getStats(): Promise<{ count: number }> {
    const response = await api.get<{ success: boolean; data: { count: number } }>('/notes/stats/count');
    return response.data.data;
  }
};
