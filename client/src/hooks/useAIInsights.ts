/**
 * useAIInsights Hook
 *
 * Monitors editor content for changes and sends only new/edited paragraphs
 * to the backend for AI analysis. Implements paragraph-level diff detection
 * with incremental merge: new content appends, edited content replaces.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import apiClient from '../api/client';

export interface InsightsData {
  concepts: Array<{ name: string; keywords?: string[]; description: string }>;
  references: Array<{ title: string; author: string; keywords?: string[]; description: string }>;
  summary: string;
  message?: string;
}

export interface UseAIInsightsOptions {
  editor: Editor | null;
  enabled?: boolean;
  interval?: number;
  initialDelay?: number;
}

export interface UseAIInsightsReturn {
  insights: InsightsData | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

const MIN_CONTENT_LENGTH = 10;
const MAX_CONSECUTIVE_FAILURES = 3;

/**
 * Split text into paragraphs (by newline boundaries).
 */
function splitParagraphs(text: string): string[] {
  return text.split(/\n+/).filter(p => p.trim().length > 0);
}

/**
 * Detect added and edited paragraphs between old and new text.
 * Uses index-based comparison to distinguish additions from edits.
 */
function detectChanges(oldText: string, newText: string): { addedText: string; editedText: string } {
  const oldParas = splitParagraphs(oldText);
  const newParas = splitParagraphs(newText);
  const oldSet = new Set(oldParas);
  const added: string[] = [];
  const edited: string[] = [];
  for (let i = 0; i < newParas.length; i++) {
    if (!oldSet.has(newParas[i])) {
      if (i < oldParas.length) {
        edited.push(newParas[i]);
      } else {
        added.push(newParas[i]);
      }
    }
  }
  return { addedText: added.join('\n\n'), editedText: edited.join('\n\n') };
}

/**
 * Merge new insights into existing insights based on mode.
 * - 'full': replace everything
 * - 'append': add new concepts/references, append to summary
 * - 'replace': replace all (re-analyzed due to edits)
 */
function mergeInsights(
  existing: InsightsData | null,
  incoming: InsightsData,
  mode: string
): InsightsData {
  if (!existing || mode === 'full' || mode === 'replace') {
    return incoming;
  }

  if (mode === 'append') {
    const existingNames = new Set(existing.concepts.map(c => c.name));
    const newConcepts = incoming.concepts.filter(c => !existingNames.has(c.name));
    const existingTitles = new Set(existing.references.map(r => r.title));
    const newRefs = incoming.references.filter(r => !existingTitles.has(r.title));

    return {
      concepts: [...existing.concepts, ...newConcepts].slice(0, 15),
      references: [...existing.references, ...newRefs].slice(0, 8),
      summary: incoming.summary
        ? existing.summary + '\n\n' + incoming.summary
        : existing.summary,
    };
  }

  return incoming;
}

export function useAIInsights(options: UseAIInsightsOptions): UseAIInsightsReturn {
  const {
    editor,
    enabled = true,
    interval = 60000,
    initialDelay = 5000,
  } = options;

  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lastTextRef = useRef<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasTriggeredInitialRef = useRef(false);
  const consecutiveFailuresRef = useRef(0);
  const pausedRef = useRef(false);
  const mountedRef = useRef(true);

  /**
   * Fetch insights from the backend API.
   * Detects added vs edited paragraphs and sends them separately.
   */
  const fetchInsights = useCallback(async () => {
    if (!editor || !enabled || pausedRef.current) return;

    const text = editor.getText();

    if (text.length < MIN_CONTENT_LENGTH) return;
    if (text === lastTextRef.current) return;

    const previousText = lastTextRef.current;

    setLoading(true);
    setError(null);

    try {
      const payload: {
        text: string;
        addedText?: string;
        editedText?: string;
        hasExistingInsights?: boolean;
      } = { text };

      if (previousText) {
        const changes = detectChanges(previousText, text);
        if (changes.addedText.trim()) payload.addedText = changes.addedText;
        if (changes.editedText.trim()) payload.editedText = changes.editedText;
        payload.hasExistingInsights = !!insights;
      }

      const response = await apiClient.post('/ai/insights', payload, { timeout: 120000 });
      const { data } = response;

      if (!mountedRef.current) return;

      if (data.success && data.data) {
        const mode = data.mode || 'full';
        const merged = mergeInsights(insights, data.data, mode);
        setInsights(merged);
        lastTextRef.current = text;
        consecutiveFailuresRef.current = 0;
      }
    } catch (err: any) {
      if (!mountedRef.current) return;

      const message =
        err?.response?.data?.error ||
        err?.message ||
        'AI 服务暂时不可用，将在下次轮询时重试';
      setError(message);

      consecutiveFailuresRef.current += 1;

      if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
        pausedRef.current = true;
        stopPolling();
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [editor, enabled, insights]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    intervalRef.current = setInterval(() => {
      fetchInsights();
    }, interval);
  }, [fetchInsights, interval, stopPolling]);

  const retry = useCallback(() => {
    consecutiveFailuresRef.current = 0;
    pausedRef.current = false;
    setError(null);
    fetchInsights();
    startPolling();
  }, [fetchInsights, startPolling]);

  useEffect(() => {
    if (!editor || !enabled || hasTriggeredInitialRef.current) return;

    const checkInitialContent = () => {
      const text = editor.getText();
      if (text.length >= MIN_CONTENT_LENGTH && !hasTriggeredInitialRef.current) {
        hasTriggeredInitialRef.current = true;
        initialDelayRef.current = setTimeout(() => {
          fetchInsights();
        }, initialDelay);
      }
    };

    editor.on('update', checkInitialContent);
    checkInitialContent();

    return () => {
      editor.off('update', checkInitialContent);
    };
  }, [editor, enabled, initialDelay, fetchInsights]);

  useEffect(() => {
    if (!editor || !enabled) {
      stopPolling();
      return;
    }
    startPolling();
    return () => { stopPolling(); };
  }, [editor, enabled, startPolling, stopPolling]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
      if (initialDelayRef.current) { clearTimeout(initialDelayRef.current); initialDelayRef.current = null; }
    };
  }, []);

  return { insights, loading, error, retry };
}
