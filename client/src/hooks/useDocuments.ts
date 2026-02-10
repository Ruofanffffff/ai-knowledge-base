import { useState, useCallback, useEffect } from 'react';
import apiClient from '../api/client';
import { Document, CreateDocumentRequest, UpdateDocumentRequest } from '../api/types';
import { useAutoRefresh } from './useAutoRefresh';
import { AUTO_REFRESH_CONFIG } from '../config/constants';

interface UseDocumentsOptions {
  autoRefresh?: boolean;
}

interface UseDocumentsReturn {
  documents: Document[];
  isLoading: boolean;
  error: Error | null;
  fetchDocuments: () => Promise<void>;
  createDocument: (data: CreateDocumentRequest) => Promise<Document>;
  updateDocument: (id: string, data: UpdateDocumentRequest) => Promise<Document>;
  deleteDocument: (id: string) => Promise<void>;
  refresh: () => void;
  pauseAutoRefresh: () => void;
  resumeAutoRefresh: () => void;
}

export function useDocuments(options: UseDocumentsOptions = {}): UseDocumentsReturn {
  const { autoRefresh = true } = options;
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiClient.get('/documents');
      setDocuments(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const createDocument = useCallback(async (data: CreateDocumentRequest) => {
    const response = await apiClient.post('/documents', data);
    const newDoc = response.data;
    setDocuments((prev) => [newDoc, ...prev]);
    return newDoc;
  }, []);

  const updateDocument = useCallback(async (id: string, data: UpdateDocumentRequest) => {
    const response = await apiClient.put(`/documents/${id}`, data);
    const updated = response.data;
    setDocuments((prev) => prev.map((doc) => (doc.id === id ? updated : doc)));
    return updated;
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    await apiClient.delete(`/documents/${id}`);
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  const { refresh, pause, resume } = useAutoRefresh({
    enabled: autoRefresh && AUTO_REFRESH_CONFIG.ENABLED,
    interval: AUTO_REFRESH_CONFIG.DOCUMENTS_INTERVAL,
    onRefresh: fetchDocuments,
  });

  return {
    documents,
    isLoading,
    error,
    fetchDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    refresh,
    pauseAutoRefresh: pause,
    resumeAutoRefresh: resume,
  };
}
