import { describe, it, expect, afterEach, vi } from 'vitest';
import { aiApi } from './ai';
import type { ApiResponse, SearchResult } from './types';

// Mock the API client
vi.mock('./client', () => ({
  default: {
    post: vi.fn(),
  },
}));

describe('aiApi', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('should search documents successfully', async () => {
      const mockSearchResult: SearchResult = {
        documents: [
          {
            id: '1',
            title: 'Test Document',
            content: 'Test content',
            type: 'document',
            fileType: '.md',
            metadata: {},
            tags: ['test'],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
        answer: 'This is the answer',
        sources: ['doc-1'],
      };

      const mockResponse: { data: ApiResponse<SearchResult> } = {
        data: {
          success: true,
          data: mockSearchResult,
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      const result = await aiApi.search({ query: 'test query', topK: 5 });

      expect(result).toEqual(mockSearchResult);
      expect(result.documents).toHaveLength(1);
      expect(result.answer).toBe('This is the answer');
      expect(apiClient.default.post).toHaveBeenCalledWith(
        '/ai/search',
        { query: 'test query', topK: 5 }
      );
    });

    it('should throw error on failed search', async () => {
      const mockResponse: { data: ApiResponse<SearchResult> } = {
        data: {
          success: false,
          error: 'Search service unavailable',
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      await expect(
        aiApi.search({ query: 'test query' })
      ).rejects.toThrow('Search service unavailable');
    });

    it('should throw default error message when no error provided', async () => {
      const mockResponse: { data: ApiResponse<SearchResult> } = {
        data: {
          success: false,
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      await expect(
        aiApi.search({ query: 'test query' })
      ).rejects.toThrow('Search failed');
    });
  });

  describe('summarize', () => {
    it('should summarize document successfully', async () => {
      const mockResponse: { data: ApiResponse<{ summary: string }> } = {
        data: {
          success: true,
          data: {
            summary: 'This is a summary of the document.',
          },
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      const result = await aiApi.summarize('doc-123');

      expect(result).toBe('This is a summary of the document.');
      expect(apiClient.default.post).toHaveBeenCalledWith(
        '/ai/summarize',
        { docId: 'doc-123' }
      );
    });

    it('should throw error on failed summarization', async () => {
      const mockResponse: { data: ApiResponse<{ summary: string }> } = {
        data: {
          success: false,
          error: 'Document not found',
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      await expect(
        aiApi.summarize('invalid-doc')
      ).rejects.toThrow('Document not found');
    });

    it('should throw default error message when no error provided', async () => {
      const mockResponse: { data: ApiResponse<{ summary: string }> } = {
        data: {
          success: false,
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      await expect(
        aiApi.summarize('doc-123')
      ).rejects.toThrow('Summarization failed');
    });
  });

  describe('generateTags', () => {
    it('should generate tags successfully', async () => {
      const mockResponse: { data: ApiResponse<{ tags: string[] }> } = {
        data: {
          success: true,
          data: {
            tags: ['machine-learning', 'ai', 'neural-networks'],
          },
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      const result = await aiApi.generateTags('Content about machine learning and AI');

      expect(result).toEqual(['machine-learning', 'ai', 'neural-networks']);
      expect(result).toHaveLength(3);
      expect(apiClient.default.post).toHaveBeenCalledWith(
        '/ai/generate-tags',
        { content: 'Content about machine learning and AI' }
      );
    });

    it('should throw error on failed tag generation', async () => {
      const mockResponse: { data: ApiResponse<{ tags: string[] }> } = {
        data: {
          success: false,
          error: 'Content too short',
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      await expect(
        aiApi.generateTags('short')
      ).rejects.toThrow('Content too short');
    });

    it('should throw default error message when no error provided', async () => {
      const mockResponse: { data: ApiResponse<{ tags: string[] }> } = {
        data: {
          success: false,
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      await expect(
        aiApi.generateTags('content')
      ).rejects.toThrow('Tag generation failed');
    });

    it('should handle empty tags array', async () => {
      const mockResponse: { data: ApiResponse<{ tags: string[] }> } = {
        data: {
          success: true,
          data: {
            tags: [],
          },
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      const result = await aiApi.generateTags('generic content');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });
  });
});
