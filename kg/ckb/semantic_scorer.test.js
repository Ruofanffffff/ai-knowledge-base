/**
 * Unit tests for SemanticScorer
 */

const { SemanticScorer, cosineSimilarity, tfidfVectorize } = require('./semantic_scorer');

describe('SemanticScorer', () => {
  describe('cosineSimilarity', () => {
    test('should calculate cosine similarity correctly', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(1.0);
    });

    test('should return 0 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(0.0);
    });

    test('should handle negative values', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];
      expect(cosineSimilarity(vec1, vec2)).toBeCloseTo(-1.0);
    });

    test('should return 0 for empty vectors', () => {
      expect(cosineSimilarity([], [])).toBe(0);
      expect(cosineSimilarity([1, 2], [])).toBe(0);
    });

    test('should return 0 for mismatched dimensions', () => {
      const vec1 = [1, 0];
      const vec2 = [1, 0, 0];
      expect(cosineSimilarity(vec1, vec2)).toBe(0);
    });
  });

  describe('tfidfVectorize', () => {
    test('should create TF-IDF vector', () => {
      // Create IDF map with individual Chinese characters
      const idfMap = new Map([
        ['测', 1.0],
        ['试', 1.0],
        ['文', 1.5],
        ['本', 1.5]
      ]);
      
      const text = '测试文本测试';
      const vector = tfidfVectorize(text, idfMap);
      
      expect(vector).toHaveLength(4);
      // Vector should have non-zero values for characters that appear
      const sum = vector.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0);
    });

    test('should handle empty text', () => {
      const idfMap = new Map([['test', 1.0]]);
      const vector = tfidfVectorize('', idfMap);
      expect(vector).toHaveLength(1);
      expect(vector[0]).toBe(0);
    });
  });

  describe('SemanticScorer with fallback', () => {
    let scorer;

    beforeEach(() => {
      scorer = new SemanticScorer();
      // Precompute IDF for fallback with more comprehensive corpus
      scorer.precomputeIDF([
        '这是第一个测试文档',
        '这是第二个测试文档',
        '这是第三个文档',
        '机器学习是人工智能的一个分支',
        '深度学习是机器学习的子领域',
        '今天天气很好'
      ]);
    });

    test('should use TF-IDF fallback when no embedding model', async () => {
      const embedding = await scorer.getEmbedding('测试文档');
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding.length).toBeGreaterThan(0);
    });

    test('should compute similarity using fallback', async () => {
      // Use text that exists in the corpus
      const text1 = '这是测试文档';
      const text2 = '这是测试文档';
      const similarity = await scorer.computeSimilarity(text1, text2);
      
      // Same text should have high similarity (may not be perfect due to TF-IDF)
      expect(similarity).toBeGreaterThan(0.5);
    });

    test('should cache embeddings', async () => {
      await scorer.getEmbedding('测试', true);
      await scorer.getEmbedding('测试', true);
      
      const stats = scorer.getCacheStats();
      expect(stats.cached_embeddings).toBe(1);
    });

    test('should handle batch embeddings', async () => {
      const texts = ['文本1', '文本2', '文本3'];
      const embeddings = await scorer.getBatchEmbeddings(texts);
      
      expect(embeddings).toHaveLength(3);
      expect(Array.isArray(embeddings[0])).toBe(true);
    });

    test('should precompute chunk embeddings', async () => {
      const chunks = [
        { chunk_id: 'c1', text: '第一个chunk' },
        { chunk_id: 'c2', text: '第二个chunk' }
      ];
      
      const chunksWithEmbeddings = await scorer.precomputeChunkEmbeddings(chunks);
      
      expect(chunksWithEmbeddings).toHaveLength(2);
      expect(chunksWithEmbeddings[0].embedding).toBeDefined();
      expect(chunksWithEmbeddings[1].embedding).toBeDefined();
    });

    test('should find similar chunks', async () => {
      const chunks = [
        { chunk_id: 'c1', text: '机器学习是人工智能的一个分支' },
        { chunk_id: 'c2', text: '深度学习是机器学习的子领域' },
        { chunk_id: 'c3', text: '今天天气很好' }
      ];
      
      const chunksWithEmbeddings = await scorer.precomputeChunkEmbeddings(chunks);
      const similar = await scorer.findSimilarChunks(
        '人工智能和机器学习',
        chunksWithEmbeddings,
        { topK: 2, threshold: 0 }
      );
      
      expect(similar.length).toBeGreaterThan(0);
      expect(similar[0]).toHaveProperty('semantic_similarity');
    });

    test('should clear cache', () => {
      scorer.getEmbedding('test');
      scorer.clearCache();
      
      const stats = scorer.getCacheStats();
      expect(stats.cached_embeddings).toBe(0);
    });
  });

  describe('SemanticScorer with mock embedding model', () => {
    let scorer;
    let mockModel;

    beforeEach(() => {
      mockModel = {
        embed: jest.fn(async (text) => {
          // Mock embedding: simple hash-based vector
          const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
          return [hash % 10, (hash * 2) % 10, (hash * 3) % 10];
        }),
        embedBatch: jest.fn(async (texts) => {
          return texts.map(text => {
            const hash = text.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
            return [hash % 10, (hash * 2) % 10, (hash * 3) % 10];
          });
        })
      };
      
      scorer = new SemanticScorer({ embeddingModel: mockModel });
    });

    test('should use embedding model when available', async () => {
      const embedding = await scorer.getEmbedding('test');
      
      expect(mockModel.embed).toHaveBeenCalledWith('test');
      expect(Array.isArray(embedding)).toBe(true);
      expect(embedding).toHaveLength(3);
    });

    test('should use batch embedding when available', async () => {
      const texts = ['text1', 'text2'];
      const embeddings = await scorer.getBatchEmbeddings(texts);
      
      expect(mockModel.embedBatch).toHaveBeenCalledWith(texts);
      expect(embeddings).toHaveLength(2);
    });

    test('should compute similarity using embedding model', async () => {
      const similarity = await scorer.computeSimilarity('test', 'test');
      
      expect(similarity).toBeGreaterThan(0.9); // Same text should be very similar
    });

    test('should handle embedding model errors gracefully', async () => {
      mockModel.embed = jest.fn().mockRejectedValue(new Error('Model error'));
      
      // Should fallback to TF-IDF
      scorer.precomputeIDF(['test document']);
      const embedding = await scorer.getEmbedding('test');
      
      expect(Array.isArray(embedding)).toBe(true);
    });
  });

  describe('SemanticScorer cache behavior', () => {
    let scorer;

    beforeEach(() => {
      scorer = new SemanticScorer();
      scorer.precomputeIDF(['test document']);
    });

    test('should use cache when enabled', async () => {
      const text = 'test text';
      
      await scorer.getEmbedding(text, true);
      const stats1 = scorer.getCacheStats();
      
      await scorer.getEmbedding(text, true);
      const stats2 = scorer.getCacheStats();
      
      expect(stats1.cached_embeddings).toBe(1);
      expect(stats2.cached_embeddings).toBe(1); // Should not increase
    });

    test('should not use cache when disabled', async () => {
      const text = 'test text';
      
      await scorer.getEmbedding(text, false);
      const stats = scorer.getCacheStats();
      
      expect(stats.cached_embeddings).toBe(0);
    });

    test('should report correct cache stats', () => {
      const stats = scorer.getCacheStats();
      
      expect(stats).toHaveProperty('cached_embeddings');
      expect(stats).toHaveProperty('using_fallback');
      expect(stats).toHaveProperty('has_idf');
      expect(stats.using_fallback).toBe(true);
      expect(stats.has_idf).toBe(true);
    });
  });
});
