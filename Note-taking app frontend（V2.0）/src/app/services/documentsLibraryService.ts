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

function getUploadErrorMessage(data: any, fallback: string): string {
  if (!data) return fallback;
  if (typeof data.message === 'string' && data.message.trim()) return data.message;
  if (typeof data.error === 'string' && data.error.trim()) return data.error;
  if (typeof data.details === 'string' && data.details.trim()) return data.details;
  return fallback;
}

function extractDocumentFromUploadResponse(data: any): LibraryDocument | null {
  if (!data) return null;
  const doc = data.document || data.data?.document || data.data;
  if (!doc || typeof doc !== 'object') return null;
  if (!('id' in doc)) return null;
  return doc as LibraryDocument;
}

export const documentsLibraryService = {
  async list(): Promise<LibraryDocument[]> {
    const resp = await api.get('/documents');
    return Array.isArray(resp.data) ? (resp.data as LibraryDocument[]) : [];
  },

  async get(id: string): Promise<LibraryDocument> {
    const resp = await api.get(`/documents/${id}`);
    return resp.data as LibraryDocument;
  },

  async upload(file: File): Promise<LibraryDocument> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const resp = await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = resp.data;
      if (data?.duplicate) {
        throw new Error('检测到重复文档，请在 Web 端处理后重试');
      }

      if (data?.success === false) {
        throw new Error(getUploadErrorMessage(data, '文档上传失败'));
      }

      const doc = extractDocumentFromUploadResponse(data);
      if (!doc) {
        throw new Error('文档上传成功，但未返回文档信息');
      }

      return doc;
    } catch (err: any) {
      const data = err?.response?.data;
      const message =
        (typeof data?.message === 'string' && data.message) ||
        (typeof data?.error === 'string' && data.error) ||
        err?.message ||
        '文档上传失败';
      throw new Error(message);
    }
  },

  async update(id: string, updates: Pick<LibraryDocument, 'title' | 'content'>): Promise<LibraryDocument> {
    const resp = await api.put(`/documents/${id}`, updates);
    return resp.data as LibraryDocument;
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/documents/${id}`);
  },
};
