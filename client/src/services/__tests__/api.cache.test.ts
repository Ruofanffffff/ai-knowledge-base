import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import apiClient from '../../api/client';

// Mock the apiClient before importing apiService
vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
    defaults: {
      baseURL: 'http://localhost:3000/api'
    }
  }
}));

// Import after mocking
import { apiService } from '../api';

describe('API Service Caching', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getKGStatus caching', () => {
    it('should cache status responses for 1 second', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            docId: 'doc-123',
            status: 'completed',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:01:00Z',
            entityCount: 10,
            relationCount: 5
          }
        }
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      // First call - should hit the API
      const result1 = await apiService.getKGStatus('doc-123');
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(result1.success).toBe(true);

      // Second call within 1 second - should use cache
      const result2 = await apiService.getKGStatus('doc-123');
      expect(apiClient.get).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect(result2.success).toBe(true);
      expect(result2.data).toEqual(result1.data);
    });

    it('should not cache error responses', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      // First call - should hit the API and fail
      const result1 = await apiService.getKGStatus('doc-456');
      expect(apiClient.get).toHaveBeenCalledTimes(1);
      expect(result1.success).toBe(false);

      // Second call - should hit the API again (errors not cached)
      const result2 = await apiService.getKGStatus('doc-456');
      expect(apiClient.get).toHaveBeenCalledTimes(2);
      expect(result2.success).toBe(false);
    });

    it('should expire cache after 1 second', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            docId: 'doc-789',
            status: 'completed',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:01:00Z'
          }
        }
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      // First call
      await apiService.getKGStatus('doc-789');
      expect(apiClient.get).toHaveBeenCalledTimes(1);

      // Wait for cache to expire (1100ms to be safe)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Second call after expiration - should hit the API again
      await apiService.getKGStatus('doc-789');
      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('getBatchKGStatus caching', () => {
    it('should cache batch status responses', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            {
              docId: 'doc-1',
              status: 'completed',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:01:00Z'
            },
            {
              docId: 'doc-2',
              status: 'building',
              createdAt: '2024-01-01T00:00:00Z',
              updatedAt: '2024-01-01T00:01:00Z'
            }
          ]
        }
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      // First call
      const result1 = await apiService.getBatchKGStatus(['doc-1', 'doc-2']);
      expect(apiClient.post).toHaveBeenCalledTimes(1);
      expect(result1.success).toBe(true);

      // Second call with same IDs - should use cache
      const result2 = await apiService.getBatchKGStatus(['doc-1', 'doc-2']);
      expect(apiClient.post).toHaveBeenCalledTimes(1); // Still 1
      expect(result2.data).toEqual(result1.data);
    });

    it('should use same cache for different order of docIds', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: [
            { docId: 'doc-a', status: 'completed', createdAt: '2024-01-01', updatedAt: '2024-01-01' },
            { docId: 'doc-b', status: 'building', createdAt: '2024-01-01', updatedAt: '2024-01-01' }
          ]
        }
      };

      vi.mocked(apiClient.post).mockResolvedValue(mockResponse);

      // First call with order: doc-a, doc-b
      await apiService.getBatchKGStatus(['doc-a', 'doc-b']);
      expect(apiClient.post).toHaveBeenCalledTimes(1);

      // Second call with order: doc-b, doc-a - should use same cache
      await apiService.getBatchKGStatus(['doc-b', 'doc-a']);
      expect(apiClient.post).toHaveBeenCalledTimes(1); // Still 1
    });
  });

  describe('rebuildKG cache invalidation', () => {
    it('should invalidate cache when rebuild is triggered', async () => {
      const statusResponse = {
        data: {
          success: true,
          data: {
            docId: 'doc-rebuild',
            status: 'completed',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:01:00Z'
          }
        }
      };

      const rebuildResponse = {
        data: {
          success: true,
          message: 'Rebuild triggered'
        }
      };

      vi.mocked(apiClient.get).mockResolvedValue(statusResponse);
      vi.mocked(apiClient.post).mockResolvedValue(rebuildResponse);

      // First call - cache the status
      await apiService.getKGStatus('doc-rebuild');
      expect(apiClient.get).toHaveBeenCalledTimes(1);

      // Trigger rebuild - should invalidate cache
      await apiService.rebuildKG('doc-rebuild');

      // Next status call should hit the API again (cache invalidated)
      await apiService.getKGStatus('doc-rebuild');
      expect(apiClient.get).toHaveBeenCalledTimes(2);
    });
  });
});
