/**
 * useDocumentIndex Hook
 *
 * Fetches and parses document compressed index data.
 * Manages loading, error, and empty states with retry support.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api/client';
import { parseIndexSections } from '../utils/parseIndexSections';
import type {
  DocumentIndexResponse,
  IndexSection,
  IndexMetadata,
} from '../types/document-index';

export interface UseDocumentIndexReturn {
  sections: IndexSection[];
  metadata: IndexMetadata | null;
  rawData: DocumentIndexResponse | null;
  isLoading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Safely parse metadata from a JSON string or return the object as-is.
 * Returns null if parsing fails.
 */
function parseMetadata(raw: unknown): IndexMetadata | null {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw as IndexMetadata;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as IndexMetadata;
    } catch {
      return null;
    }
  }
  return null;
}

export function useDocumentIndex(docId: string | null): UseDocumentIndexReturn {
  const [sections, setSections] = useState<IndexSection[]>([]);
  const [metadata, setMetadata] = useState<IndexMetadata | null>(null);
  const [rawData, setRawData] = useState<DocumentIndexResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Track the current docId to avoid stale responses
  const currentDocIdRef = useRef<string | null>(docId);
  // Retry trigger counter
  const retryCountRef = useRef(0);
  const [retryTrigger, setRetryTrigger] = useState(0);

  const fetchIndex = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/preprocessing/index/${id}`);
      // API returns { success, data: { ... } } — unwrap the nested data
      const body = response.data;
      const data: DocumentIndexResponse = body?.data ?? body;

      // Guard against stale responses
      if (currentDocIdRef.current !== id) return;

      setRawData(data);

      // Parse sections from indexedText
      const parsed = data.indexedText
        ? parseIndexSections(data.indexedText)
        : [];
      setSections(parsed);

      // Parse metadata
      setMetadata(parseMetadata(data.metadata));
    } catch (err: any) {
      // Guard against stale responses
      if (currentDocIdRef.current !== id) return;

      const status = err?.response?.status;

      if (status === 404) {
        // 404 → empty state, not an error
        setSections([]);
        setMetadata(null);
        setRawData(null);
        setError(null);
      } else {
        const message =
          err?.response?.data?.message ||
          err?.response?.data?.error ||
          err?.message ||
          '获取索引数据失败';
        setError(message);
        setSections([]);
        setMetadata(null);
        setRawData(null);
      }
    } finally {
      if (currentDocIdRef.current === id) {
        setIsLoading(false);
      }
    }
  }, []);

  // Fetch when docId changes or retry is triggered
  useEffect(() => {
    currentDocIdRef.current = docId;

    if (!docId) {
      setSections([]);
      setMetadata(null);
      setRawData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    fetchIndex(docId);
  }, [docId, retryTrigger, fetchIndex]);

  const retry = useCallback(() => {
    retryCountRef.current += 1;
    setRetryTrigger((prev) => prev + 1);
  }, []);

  return {
    sections,
    metadata,
    rawData,
    isLoading,
    error,
    retry,
  };
}
