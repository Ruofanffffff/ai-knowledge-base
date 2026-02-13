import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useDocumentIndex } from '../useDocumentIndex';

// Mock apiClient
vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
  },
}));

// Mock parseIndexSections — use the real implementation
vi.mock('../../utils/parseIndexSections', () => ({
  parseIndexSections: vi.fn((text: string) => {
    if (!text || text.trim() === '') return [];
    return [{ type: 'summary', title: '主旨概述', content: text.trim() }];
  }),
}));

import apiClient from '../../api/client';
import { parseIndexSections } from '../../utils/parseIndexSections';

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockParse = parseIndexSections as ReturnType<typeof vi.fn>;

const SAMPLE_RESPONSE = {
  id: 'idx-1',
  docId: 'doc-1',
  indexedText: '这是一段索引文本',
  version: 1,
  metadata: { generated_at: '2024-01-01', llm_model: 'gpt-4', token_count: 500, fact_count: 10 },
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('useDocumentIndex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('should return initial empty state when docId is null', () => {
    const { result } = renderHook(() => useDocumentIndex(null));

    expect(result.current.sections).toEqual([]);
    expect(result.current.metadata).toBeNull();
    expect(result.current.rawData).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(typeof result.current.retry).toBe('function');
  });

  test('should set loading state while fetching', async () => {
    let resolveRequest: (value: any) => void;
    mockGet.mockImplementation(
      () => new Promise((resolve) => { resolveRequest = resolve; })
    );

    const { result } = renderHook(() => useDocumentIndex('doc-1'));

    // Should be loading immediately
    expect(result.current.isLoading).toBe(true);

    // Resolve the request
    await act(async () => {
      resolveRequest!({ data: SAMPLE_RESPONSE });
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  test('should fetch and parse index data on success', async () => {
    mockGet.mockResolvedValue({ data: SAMPLE_RESPONSE });

    const { result } = renderHook(() => useDocumentIndex('doc-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockGet).toHaveBeenCalledWith('/preprocessing/index/doc-1');
    expect(mockParse).toHaveBeenCalledWith('这是一段索引文本');
    expect(result.current.sections).toEqual([
      { type: 'summary', title: '主旨概述', content: '这是一段索引文本' },
    ]);
    expect(result.current.metadata).toEqual(SAMPLE_RESPONSE.metadata);
    expect(result.current.rawData).toEqual(SAMPLE_RESPONSE);
    expect(result.current.error).toBeNull();
  });

  test('should parse metadata from JSON string', async () => {
    const responseWithStringMeta = {
      ...SAMPLE_RESPONSE,
      metadata: JSON.stringify({ llm_model: 'claude-3', token_count: 200 }),
    };
    mockGet.mockResolvedValue({ data: responseWithStringMeta });

    const { result } = renderHook(() => useDocumentIndex('doc-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.metadata).toEqual({ llm_model: 'claude-3', token_count: 200 });
  });

  test('should handle invalid metadata JSON gracefully', async () => {
    const responseWithBadMeta = {
      ...SAMPLE_RESPONSE,
      metadata: '{invalid json',
    };
    mockGet.mockResolvedValue({ data: responseWithBadMeta });

    const { result } = renderHook(() => useDocumentIndex('doc-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.metadata).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test('should handle 404 as empty state (not error)', async () => {
    const error404 = new Error('Not Found') as any;
    error404.response = { status: 404 };
    mockGet.mockRejectedValue(error404);

    const { result } = renderHook(() => useDocumentIndex('doc-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sections).toEqual([]);
    expect(result.current.metadata).toBeNull();
    expect(result.current.rawData).toBeNull();
    expect(result.current.error).toBeNull();
  });

  test('should set error state on non-404 API failure', async () => {
    const error500 = new Error('Internal Server Error') as any;
    error500.response = { status: 500, data: { message: '服务器错误' } };
    mockGet.mockRejectedValue(error500);

    const { result } = renderHook(() => useDocumentIndex('doc-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('服务器错误');
    expect(result.current.sections).toEqual([]);
    expect(result.current.metadata).toBeNull();
  });

  test('should handle network error', async () => {
    mockGet.mockRejectedValue(new Error('Network Error'));

    const { result } = renderHook(() => useDocumentIndex('doc-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Network Error');
  });

  test('should refetch when retry() is called', async () => {
    const error = new Error('Temporary failure') as any;
    error.response = { status: 500, data: { message: '临时错误' } };
    mockGet.mockRejectedValueOnce(error);
    mockGet.mockResolvedValueOnce({ data: SAMPLE_RESPONSE });

    const { result } = renderHook(() => useDocumentIndex('doc-1'));

    // Wait for first (failed) request
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.error).toBe('临时错误');

    // Retry
    act(() => {
      result.current.retry();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    expect(result.current.sections.length).toBeGreaterThan(0);
    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  test('should refetch when docId changes', async () => {
    mockGet.mockResolvedValue({ data: SAMPLE_RESPONSE });

    const { result, rerender } = renderHook(
      ({ docId }) => useDocumentIndex(docId),
      { initialProps: { docId: 'doc-1' as string | null } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(mockGet).toHaveBeenCalledWith('/preprocessing/index/doc-1');

    // Change docId
    rerender({ docId: 'doc-2' });

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/preprocessing/index/doc-2');
    });
  });

  test('should reset state when docId changes to null', async () => {
    mockGet.mockResolvedValue({ data: SAMPLE_RESPONSE });

    const { result, rerender } = renderHook(
      ({ docId }) => useDocumentIndex(docId),
      { initialProps: { docId: 'doc-1' as string | null } }
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.sections.length).toBeGreaterThan(0);

    // Set docId to null
    rerender({ docId: null });

    expect(result.current.sections).toEqual([]);
    expect(result.current.metadata).toBeNull();
    expect(result.current.rawData).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  test('should handle empty indexedText', async () => {
    const emptyResponse = { ...SAMPLE_RESPONSE, indexedText: '' };
    mockGet.mockResolvedValue({ data: emptyResponse });

    const { result } = renderHook(() => useDocumentIndex('doc-1'));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.sections).toEqual([]);
  });
});
