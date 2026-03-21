import { api } from './api';

export type LibraryDocument = {
  id: string;
  title: string;
  content: string;
  type?: string;
  fileType?: string;
  metadata?: Record<string, any>;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  lastViewedAt?: string;
  summaries?: Array<{
    id: string;
    model: string;
    content: string;
    createdAt: string;
  }>;
};

export const documentsLibraryService = {
  async list(): Promise<LibraryDocument[]> {
    const resp = await api.get('/documents');
    return Array.isArray(resp.data) ? (resp.data as LibraryDocument[]) : [];
  },

  async get(id: string): Promise<LibraryDocument> {
    const resp = await api.get(`/documents/${id}`);
    return resp.data as LibraryDocument;
  },
};

