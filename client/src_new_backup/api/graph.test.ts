import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { graphApi } from './graph';
import type { BackendEntity, BackendRelation } from './types';

// Mock the API client
vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('graphApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getGraphData', () => {
    it('should fetch and combine entities and relations', async () => {
      const mockEntities: BackendEntity[] = [
        {
          id: 'e1',
          canonical_name: 'Entity 1',
          type: 'Type1',
          confidence: 0.9,
          schemas: [],
        },
        {
          id: 'e2',
          canonical_name: 'Entity 2',
          type: 'Type2',
          confidence: 0.85,
          schemas: [],
        },
      ];

      const mockRelations: BackendRelation[] = [
        {
          id: 'r1',
          source_id: 'e1',
          target_id: 'e2',
          type: 'builtin',
          confidence: 0.88,
        },
      ];

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get)
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: { entities: mockEntities, total: 2, count: 2 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: { relations: mockRelations, total: 1, count: 1 },
          },
        });

      const result = await graphApi.getGraphData();

      expect(result).toEqual({
        entities: mockEntities,
        relations: mockRelations,
      });
      expect(apiClient.default.get).toHaveBeenCalledTimes(2);
      expect(apiClient.default.get).toHaveBeenNthCalledWith(1, '/knowledge-graph/entities', { params: undefined });
      expect(apiClient.default.get).toHaveBeenNthCalledWith(2, '/knowledge-graph/relations', { params: undefined });
    });

    it('should pass filter parameters to both endpoints', async () => {
      const params = {
        minConfidence: 0.8,
        entityType: 'ConceptEntity',
        relationType: 'semantic',
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get)
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: { entities: [], total: 0, count: 0 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: { relations: [], total: 0, count: 0 },
          },
        });

      await graphApi.getGraphData(params);

      expect(apiClient.default.get).toHaveBeenNthCalledWith(1, '/knowledge-graph/entities', { params });
      expect(apiClient.default.get).toHaveBeenNthCalledWith(2, '/knowledge-graph/relations', { params });
    });

    it('should handle empty graph data', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get)
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: { entities: [], total: 0, count: 0 },
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
            data: { relations: [], total: 0, count: 0 },
          },
        });

      const result = await graphApi.getGraphData();

      expect(result).toEqual({
        entities: [],
        relations: [],
      });
    });

    it('should handle missing data field in response', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get)
        .mockResolvedValueOnce({
          data: {
            success: true,
          },
        })
        .mockResolvedValueOnce({
          data: {
            success: true,
          },
        });

      const result = await graphApi.getGraphData();

      expect(result).toEqual({
        entities: [],
        relations: [],
      });
    });

    it('should handle API errors', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockRejectedValue(new Error('Network error'));

      await expect(graphApi.getGraphData()).rejects.toThrow('Network error');
    });
  });

  describe('getEntities', () => {
    it('should fetch entities using correct endpoint', async () => {
      const mockEntities: BackendEntity[] = [
        {
          id: 'e1',
          canonical_name: '人工智能',
          type: 'ConceptEntity',
          confidence: 0.95,
          schemas: [{ schema_name: 'Concept', confidence: 0.9 }],
        },
      ];

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: {
          success: true,
          data: { entities: mockEntities, total: 1, count: 1 },
        },
      });

      const result = await graphApi.getEntities();

      expect(result).toEqual(mockEntities);
      expect(apiClient.default.get).toHaveBeenCalledWith('/knowledge-graph/entities', { params: undefined });
    });

    it('should pass filter parameters', async () => {
      const params = {
        type: 'ConceptEntity',
        minConfidence: 0.8,
        skip: 0,
        take: 10,
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: {
          success: true,
          data: { entities: [], total: 0, count: 0 },
        },
      });

      await graphApi.getEntities(params);

      expect(apiClient.default.get).toHaveBeenCalledWith('/knowledge-graph/entities', { params });
    });

    it('should handle empty entities array', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: {
          success: true,
          data: { entities: [], total: 0, count: 0 },
        },
      });

      const result = await graphApi.getEntities();

      expect(result).toEqual([]);
    });

    it('should handle missing data field', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: {
          success: true,
        },
      });

      const result = await graphApi.getEntities();

      expect(result).toEqual([]);
    });

    it('should handle pagination parameters', async () => {
      const params = {
        skip: 20,
        take: 50,
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: {
          success: true,
          data: { entities: [], total: 100, count: 0 },
        },
      });

      await graphApi.getEntities(params);

      expect(apiClient.default.get).toHaveBeenCalledWith('/knowledge-graph/entities', { params });
    });
  });

  describe('getRelations', () => {
    it('should fetch relations using correct endpoint', async () => {
      const mockRelations: BackendRelation[] = [
        {
          id: 'r1',
          source_id: 'e1',
          target_id: 'e2',
          type: 'semantic',
          subtype: 'similar',
          confidence: 0.85,
          weight: 0.9,
        },
      ];

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: {
          success: true,
          data: { relations: mockRelations, total: 1, count: 1 },
        },
      });

      const result = await graphApi.getRelations();

      expect(result).toEqual(mockRelations);
      expect(apiClient.default.get).toHaveBeenCalledWith('/knowledge-graph/relations', { params: undefined });
    });

    it('should pass filter parameters', async () => {
      const params = {
        type: 'builtin',
        minConfidence: 0.7,
        skip: 0,
        take: 20,
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: {
          success: true,
          data: { relations: [], total: 0, count: 0 },
        },
      });

      await graphApi.getRelations(params);

      expect(apiClient.default.get).toHaveBeenCalledWith('/knowledge-graph/relations', { params });
    });

    it('should handle empty relations array', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: {
          success: true,
          data: { relations: [], total: 0, count: 0 },
        },
      });

      const result = await graphApi.getRelations();

      expect(result).toEqual([]);
    });

    it('should handle missing data field', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: {
          success: true,
        },
      });

      const result = await graphApi.getRelations();

      expect(result).toEqual([]);
    });
  });

  describe('buildGraph', () => {
    it('should trigger graph building using correct endpoint', async () => {
      const mockResult = {
        success: true,
        entitiesCreated: 10,
        relationsCreated: 5,
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue({
        data: {
          success: true,
          data: mockResult,
        },
      });

      const result = await graphApi.buildGraph('doc-123', '/path/to/doc.pdf', '.pdf');

      expect(result).toEqual(mockResult);
      expect(apiClient.default.post).toHaveBeenCalledWith('/knowledge-graph/build', {
        docId: 'doc-123',
        filePath: '/path/to/doc.pdf',
        fileType: '.pdf',
      });
    });

    it('should handle different file types', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue({
        data: {
          success: true,
          data: {},
        },
      });

      await graphApi.buildGraph('doc-1', '/path/file.md', '.md');
      expect(apiClient.default.post).toHaveBeenCalledWith('/knowledge-graph/build', {
        docId: 'doc-1',
        filePath: '/path/file.md',
        fileType: '.md',
      });

      await graphApi.buildGraph('doc-2', '/path/file.txt', '.txt');
      expect(apiClient.default.post).toHaveBeenCalledWith('/knowledge-graph/build', {
        docId: 'doc-2',
        filePath: '/path/file.txt',
        fileType: '.txt',
      });
    });

    it('should handle build errors', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockRejectedValue(new Error('Build failed'));

      await expect(
        graphApi.buildGraph('doc-123', '/path/to/doc.pdf', '.pdf')
      ).rejects.toThrow('Build failed');
    });

    it('should handle Chinese file paths', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue({
        data: {
          success: true,
          data: {},
        },
      });

      await graphApi.buildGraph('doc-cn', '/路径/中文文档.pdf', '.pdf');

      expect(apiClient.default.post).toHaveBeenCalledWith('/knowledge-graph/build', {
        docId: 'doc-cn',
        filePath: '/路径/中文文档.pdf',
        fileType: '.pdf',
      });
    });
  });

  describe('getCKBs', () => {
    it('should fetch CKBs using correct endpoint', async () => {
      const mockCKBs = [
        {
          id: 'ckb-1',
          content: 'CKB Content 1',
          metadata: { source: 'doc-1' },
        },
        {
          id: 'ckb-2',
          content: 'CKB Content 2',
          metadata: { source: 'doc-2' },
        },
      ];

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: {
          success: true,
          data: { ckbs: mockCKBs, total: 2, count: 2 },
        },
      });

      const result = await graphApi.getCKBs();

      expect(result).toEqual(mockCKBs);
      expect(apiClient.default.get).toHaveBeenCalledWith('/knowledge-graph/ckb', { params: undefined });
    });

    it('should pass pagination parameters', async () => {
      const params = {
        skip: 10,
        take: 25,
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: {
          success: true,
          data: { ckbs: [], total: 0, count: 0 },
        },
      });

      await graphApi.getCKBs(params);

      expect(apiClient.default.get).toHaveBeenCalledWith('/knowledge-graph/ckb', { params });
    });

    it('should handle empty CKBs array', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: {
          success: true,
          data: { ckbs: [], total: 0, count: 0 },
        },
      });

      const result = await graphApi.getCKBs();

      expect(result).toEqual([]);
    });

    it('should handle missing data field', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: {
          success: true,
        },
      });

      const result = await graphApi.getCKBs();

      expect(result).toEqual([]);
    });
  });

  describe('API endpoint correctness', () => {
    it('should use correct endpoint for getGraphData entities', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get)
        .mockResolvedValueOnce({
          data: { success: true, data: { entities: [], total: 0, count: 0 } },
        })
        .mockResolvedValueOnce({
          data: { success: true, data: { relations: [], total: 0, count: 0 } },
        });

      await graphApi.getGraphData();

      expect(apiClient.default.get).toHaveBeenNthCalledWith(1, '/knowledge-graph/entities', { params: undefined });
    });

    it('should use correct endpoint for getGraphData relations', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get)
        .mockResolvedValueOnce({
          data: { success: true, data: { entities: [], total: 0, count: 0 } },
        })
        .mockResolvedValueOnce({
          data: { success: true, data: { relations: [], total: 0, count: 0 } },
        });

      await graphApi.getGraphData();

      expect(apiClient.default.get).toHaveBeenNthCalledWith(2, '/knowledge-graph/relations', { params: undefined });
    });

    it('should use correct endpoint for getEntities', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: { success: true, data: { entities: [], total: 0, count: 0 } },
      });

      await graphApi.getEntities();

      expect(apiClient.default.get).toHaveBeenCalledWith('/knowledge-graph/entities', { params: undefined });
    });

    it('should use correct endpoint for getRelations', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: { success: true, data: { relations: [], total: 0, count: 0 } },
      });

      await graphApi.getRelations();

      expect(apiClient.default.get).toHaveBeenCalledWith('/knowledge-graph/relations', { params: undefined });
    });

    it('should use correct endpoint for buildGraph', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue({
        data: { success: true, data: {} },
      });

      await graphApi.buildGraph('doc-id', '/path', '.pdf');

      expect(apiClient.default.post).toHaveBeenCalledWith('/knowledge-graph/build', {
        docId: 'doc-id',
        filePath: '/path',
        fileType: '.pdf',
      });
    });

    it('should use correct endpoint for getCKBs', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: { success: true, data: { ckbs: [], total: 0, count: 0 } },
      });

      await graphApi.getCKBs();

      expect(apiClient.default.get).toHaveBeenCalledWith('/knowledge-graph/ckb', { params: undefined });
    });
  });
});
