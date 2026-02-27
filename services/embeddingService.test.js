/**
 * EmbeddingService 单元测试
 * 验证从 server.js 抽取的 generateEmbedding、cosineSimilarity、findSimilar 方法
 */

const { EmbeddingService } = require('./embeddingService');

describe('EmbeddingService', () => {
  let service;

  beforeEach(() => {
    service = new EmbeddingService();
  });

  describe('cosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const vec = [1, 2, 3, 4, 5];
      expect(service.cosineSimilarity(vec, vec)).toBeCloseTo(1.0);
    });

    it('should return -1 for opposite vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [-1, 0, 0];
      expect(service.cosineSimilarity(vecA, vecB)).toBeCloseTo(-1.0);
    });

    it('should return 0 for orthogonal vectors', () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      expect(service.cosineSimilarity(vecA, vecB)).toBeCloseTo(0.0);
    });

    it('should handle arbitrary vectors correctly', () => {
      const vecA = [1, 2, 3];
      const vecB = [4, 5, 6];
      // dot = 4+10+18 = 32, normA = sqrt(14), normB = sqrt(77)
      const expected = 32 / (Math.sqrt(14) * Math.sqrt(77));
      expect(service.cosineSimilarity(vecA, vecB)).toBeCloseTo(expected);
    });
  });

  describe('findSimilar', () => {
    it('should return candidates above threshold sorted by similarity', async () => {
      const embedding = [1, 0, 0];
      const candidates = [
        { id: 'a', embedding: [1, 0, 0] },       // similarity = 1.0
        { id: 'b', embedding: [0, 1, 0] },       // similarity = 0.0
        { id: 'c', embedding: [0.8, 0.6, 0] },   // similarity ~0.8
      ];

      const results = await service.findSimilar(embedding, candidates, 0.7);
      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('a');
      expect(results[0].similarity).toBeCloseTo(1.0);
      expect(results[1].id).toBe('c');
      expect(results[1].similarity).toBeGreaterThanOrEqual(0.7);
    });

    it('should return empty array when no candidates exceed threshold', async () => {
      const embedding = [1, 0, 0];
      const candidates = [
        { id: 'a', embedding: [0, 1, 0] },
        { id: 'b', embedding: [0, 0, 1] },
      ];

      const results = await service.findSimilar(embedding, candidates, 0.5);
      expect(results).toHaveLength(0);
    });

    it('should skip candidates with null or invalid embeddings', async () => {
      const embedding = [1, 0, 0];
      const candidates = [
        { id: 'a', embedding: null },
        { id: 'b', embedding: 'not-an-array' },
        { id: 'c', embedding: [1, 0, 0] },
      ];

      const results = await service.findSimilar(embedding, candidates, 0.5);
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('c');
    });

    it('should return empty array for empty candidates', async () => {
      const results = await service.findSimilar([1, 0, 0], [], 0.5);
      expect(results).toHaveLength(0);
    });
  });

  describe('generateEmbedding', () => {
    it('should return null when API key is not configured', async () => {
      const svc = new EmbeddingService();
      svc.modelConfig.apiKey = '';
      const result = await svc.generateEmbedding('test text');
      expect(result).toBeNull();
    });
  });

  describe('module exports', () => {
    it('should export a singleton instance', () => {
      const embeddingService = require('./embeddingService');
      expect(embeddingService).toBeDefined();
      expect(typeof embeddingService.generateEmbedding).toBe('function');
      expect(typeof embeddingService.cosineSimilarity).toBe('function');
      expect(typeof embeddingService.findSimilar).toBe('function');
    });

    it('should export the EmbeddingService class', () => {
      const { EmbeddingService: ES } = require('./embeddingService');
      expect(ES).toBeDefined();
      expect(typeof ES).toBe('function');
    });
  });
});
