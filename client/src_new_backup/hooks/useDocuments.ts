import { useState, useCallback } from 'react';
import { documentsApi } from '../api/documents';
import { Document, CreateDocumentRequest, UpdateDocumentRequest } from '../api/types';
import { useAutoRefresh } from './useAutoRefresh';

export function useDocuments(autoRefresh = true) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await documentsApi.getDocuments();
      setDocuments(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createDocument = useCallback(async (data: CreateDocumentRequest) => {
    const newDoc = await documentsApi.createDocument(data);
    setDocuments((prev) => [newDoc, ...prev]);
    return newDoc;
  }, []);

  const updateDocument = useCallback(async (id: string, data: UpdateDocumentRequest) => {
    const updated = await documentsApi.updateDocument(id, data);
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? updated : doc))
    );
    return updated;
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    await documentsApi.deleteDocument(id);
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  // Auto-refresh every 30 seconds
  const { refresh, pause, resume } = useAutoRefresh({
    enabled: autoRefresh,
    interval: 30000,
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
