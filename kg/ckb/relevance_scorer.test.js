/**
 * Unit tests for RelevanceScorer
 */

const { RelevanceScorer, tokenize, calculateTF, calculateIDF } = require('./relevance_scorer');

describe('RelevanceScorer', () => {
  let scorer;

  beforeEach(() => {
    scorer = new RelevanceScorer();
  });

  describe('tokenize', () => {
    test('should tokenize Chinese text', () => {
      const tokens = tokenize('这是测试');
      expect(tokens).toEqual(['这', '是', '测', '试']);
    });

    test('should tokenize English text', () => {
      const tokens = tokenize('This is a test');
      expect(tokens).toContain('this');
      expect(tokens).toContain('is');
      expect(tokens).toContain('a');
      expect(tokens).toContain('test');
    });

    test('should tokenize mixed text', () => {
      const tokens = tokenize('这是 test 123');
      expect(tokens).toContain('这');
      expect(tokens).toContain('是');
      expect(tokens).toContain('test');
      expect(tokens).toContain('123');
    });

    test('should handle empty text', () => {
      expect(tokenize('')).toEqual([]);
      expect(tokenize(null)).toEqual([]);
    });
  });

  describe('calculateTF', () => {
    test('should calculate term frequency', () => {
      const tokens = ['a', 'b', 'a', 'c'];
      const tf = calculateTF(tokens);
      
      expect(tf.get('a')).toBe(0.5); // 2/4
      expect(tf.get('b')).toBe(0.25); // 1/4
      expect(tf.get('c')).toBe(0.25); // 1/4
    });

    test('should handle single token', () => {
      const tokens = ['a'];
      const tf = calculateTF(tokens);
      
      expect(tf.get('a')).toBe(1.0);
    });
  });

  describe('calculateIDF', () => {
    test('should calculate inverse document frequency', () => {
      const documents = [
        ['a', 'b', 'c'],
        ['a', 'b'],
        ['a', 'c', 'd']
      ];
      const idf = calculateIDF(documents);
      
      expect(idf.get('a')).toBeCloseTo(Math.log(3/3), 5); // appears in all 3 docs
      expect(idf.get('b')).toBeCloseTo(Math.log(3/2), 5); // appears in 2 docs
      expect(idf.get('d')).toBeCloseTo(Math.log(3/1), 5); // appears in 1 doc
    });
  });

  describe('scoreByKeyword', () => {
    test('should score exact match highly', () => {
      const query = '摄影技巧';
      const chunk = {
        chunk_id: 'chunk_1',
        text: '这是关于摄影技巧的内容'
      };
      
      const score = scorer.scoreByKeyword(query, chunk);
      expect(score).toBeGreaterThan(0.3);
    });

    test('should score partial match', () => {
      const query = '摄影技巧教程';
      const chunk = {
        chunk_id: 'chunk_2',
        text: '这是关于摄影的内容'
      };
      
      const score = scorer.scoreByKeyword(query, chunk);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThan(0.5);
    });

    test('should score no match as zero', () => {
      const query = '摄影';
      const chunk = {
        chunk_id: 'chunk_3',
        text: '这是关于旅游的内容'
      };
      
      const score = scorer.scoreByKeyword(query, chunk);
      expect(score).toBe(0);
    });

    test('should handle empty query', () => {
      const query = '';
      const chunk = {
        chunk_id: 'chunk_4',
        text: '任何内容'
      };
      
      const score = scorer.scoreByKeyword(query, chunk);
      expect(score).toBe(0);
    });
  });

  describe('scoreByTFIDF', () => {
    test('should score with precomputed IDF', () => {
      const chunks = [
        { chunk_id: 'c1', text: '摄影技巧教程' },
        { chunk_id: 'c2', text: '摄影器材推荐' },
        { chunk_id: 'c3', text: '旅游攻略分享' }
      ];
      
      scorer.precomputeIDF(chunks);
      
      const query = '摄影';
      const score = scorer.scoreByTFIDF(query, chunks[0], 0);
      
      expect(score).toBeGreaterThan(0);
    });

    test('should use simple TF when no IDF', () => {
      const query = '摄影';
      const chunk = {
        chunk_id: 'chunk_5',
        text: '摄影技巧摄影教程'
      };
      
      const score = scorer.scoreByTFIDF(query, chunk);
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('scoreHybrid', () => {
    test('should combine keyword and TF-IDF scores', () => {
      const query = '摄影技巧';
      const chunk = {
        chunk_id: 'chunk_6',
        text: '这是关于摄影技巧的详细教程'
      };
      
      const score = scorer.scoreHybrid(query, chunk);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should respect custom weights', () => {
      const query = '摄影';
      const chunk = {
        chunk_id: 'chunk_7',
        text: '摄影教程'
      };
      
      const score1 = scorer.scoreHybrid(query, chunk, { 
        keywordWeight: 1.0, 
        tfidfWeight: 0.0 
      });
      const score2 = scorer.scoreHybrid(query, chunk, { 
        keywordWeight: 0.0, 
        tfidfWeight: 1.0 
      });
      
      expect(score1).not.toBe(score2);
    });
  });

  describe('scoreChunks', () => {
    test('should score multiple chunks', async () => {
      const query = '摄影';
      const chunks = [
        { chunk_id: 'c1', text: '摄影技巧教程' },
        { chunk_id: 'c2', text: '旅游攻略' },
        { chunk_id: 'c3', text: '摄影器材推荐' }
      ];
      
      const scored = await scorer.scoreChunks(query, chunks);
      
      expect(scored.length).toBe(3);
      expect(scored[0].relevance_score).toBeDefined();
      expect(scored[0].relevance_score).toBeGreaterThan(scored[1].relevance_score);
    });

    test('should use cache on second call', async () => {
      const query = '摄影';
      const chunks = [
        { chunk_id: 'c1', text: '摄影技巧' }
      ];
      
      const scored1 = await scorer.scoreChunks(query, chunks, { useCache: true });
      const scored2 = await scorer.scoreChunks(query, chunks, { useCache: true });
      
      expect(scored1[0].relevance_score).toBe(scored2[0].relevance_score);
    });

    test('should support different scoring methods', async () => {
      const query = '摄影';
      const chunks = [
        { chunk_id: 'c1', text: '摄影技巧教程' }
      ];
      
      const keywordScored = await scorer.scoreChunks(query, chunks, { method: 'keyword' });
      const tfidfScored = await scorer.scoreChunks(query, chunks, { method: 'tfidf' });
      const hybridScored = await scorer.scoreChunks(query, chunks, { method: 'hybrid' });
      
      expect(keywordScored[0].relevance_score).toBeGreaterThan(0);
      expect(tfidfScored[0].relevance_score).toBeGreaterThan(0);
      expect(hybridScored[0].relevance_score).toBeGreaterThan(0);
    });
  });

  describe('selectRelevantChunks', () => {
    test('should select top K chunks', async () => {
      const query = '摄影';
      const chunks = [
        { chunk_id: 'c1', text: '摄影技巧教程' },
        { chunk_id: 'c2', text: '摄影器材推荐' },
        { chunk_id: 'c3', text: '旅游攻略' },
        { chunk_id: 'c4', text: '摄影后期处理' },
        { chunk_id: 'c5', text: '美食分享' }
      ];
      
      const relevant = await scorer.selectRelevantChunks(query, chunks, { topK: 3 });
      
      expect(relevant.length).toBeLessThanOrEqual(3);
      expect(relevant[0].text).toContain('摄影');
    });

    test('should filter by threshold', async () => {
      const query = '摄影';
      const chunks = [
        { chunk_id: 'c1', text: '摄影技巧' },
        { chunk_id: 'c2', text: '完全无关的内容' }
      ];
      
      const relevant = await scorer.selectRelevantChunks(query, chunks, { 
        topK: 10, 
        threshold: 0.1 
      });
      
      expect(relevant.length).toBeLessThan(chunks.length);
      expect(relevant.every(c => c.relevance_score >= 0.1)).toBe(true);
    });

    test('should sort by relevance', async () => {
      const query = '摄影';
      const chunks = [
        { chunk_id: 'c1', text: '旅游' },
        { chunk_id: 'c2', text: '摄影技巧教程' },
        { chunk_id: 'c3', text: '摄影' }
      ];
      
      const relevant = await scorer.selectRelevantChunks(query, chunks);
      
      for (let i = 1; i < relevant.length; i++) {
        expect(relevant[i-1].relevance_score).toBeGreaterThanOrEqual(relevant[i].relevance_score);
      }
    });
  });

  describe('cache management', () => {
    test('should track cache stats', async () => {
      const query = '摄影';
      const chunks = [
        { chunk_id: 'c1', text: '摄影技巧' }
      ];
      
      await scorer.scoreChunks(query, chunks);
      const stats = scorer.getCacheStats();
      
      expect(stats.cached_queries).toBe(1);
    });

    test('should clear cache', async () => {
      const query = '摄影';
      const chunks = [
        { chunk_id: 'c1', text: '摄影技巧' }
      ];
      
      scorer.precomputeIDF(chunks);
      await scorer.scoreChunks(query, chunks);
      
      scorer.clearCache();
      const stats = scorer.getCacheStats();
      
      expect(stats.cached_queries).toBe(0);
      expect(stats.idf_computed).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle very long text', () => {
      const query = '测试';
      const chunk = {
        chunk_id: 'long',
        text: '测试'.repeat(1000)
      };
      
      const score = scorer.scoreByKeyword(query, chunk);
      expect(score).toBeGreaterThan(0);
    });

    test('should handle special characters', () => {
      const query = '测试@#$';
      const chunk = {
        chunk_id: 'special',
        text: '这是测试内容@#$'
      };
      
      const score = scorer.scoreByKeyword(query, chunk);
      expect(score).toBeGreaterThan(0);
    });

    test('should handle empty chunks array', async () => {
      const query = '测试';
      const chunks = [];
      
      const scored = await scorer.scoreChunks(query, chunks);
      expect(scored.length).toBe(0);
    });
  });

  describe('semantic scoring', () => {
    beforeEach(() => {
      // Initialize with IDF for fallback
      const chunks = [
        { chunk_id: 'c1', text: '机器学习是人工智能的分支' },
        { chunk_id: 'c2', text: '深度学习是机器学习的子领域' },
        { chunk_id: 'c3', text: '今天天气很好' }
      ];
      scorer.semanticScorer.precomputeIDF(chunks.map(c => c.text));
    });

    test('should score by semantic similarity', async () => {
      const query = '人工智能';
      const chunk = {
        chunk_id: 'c1',
        text: '机器学习是人工智能的分支'
      };
      
      const score = await scorer.scoreBySemantic(query, chunk);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should use precomputed embeddings', async () => {
      const query = '人工智能';
      const chunk = {
        chunk_id: 'c1',
        text: '机器学习',
        embedding: [0.1, 0.2, 0.3]
      };
      
      const score = await scorer.scoreBySemantic(query, chunk);
      expect(score).toBeDefined();
    });

    test('should score with hybrid semantic method', async () => {
      const query = '人工智能';
      const chunk = {
        chunk_id: 'c1',
        text: '机器学习是人工智能的分支'
      };
      
      const score = await scorer.scoreHybridWithSemantic(query, chunk);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    test('should score chunks with semantic method', async () => {
      const query = '人工智能';
      const chunks = [
        { chunk_id: 'c1', text: '机器学习是人工智能的分支' },
        { chunk_id: 'c2', text: '今天天气很好' }
      ];
      
      const scored = await scorer.scoreChunks(query, chunks, { method: 'semantic' });
      
      expect(scored.length).toBe(2);
      expect(scored[0].relevance_score).toBeDefined();
      expect(scored[0].embedding).toBeDefined();
    });

    test('should score chunks with hybrid_semantic method', async () => {
      const query = '人工智能';
      const chunks = [
        { chunk_id: 'c1', text: '机器学习是人工智能的分支' },
        { chunk_id: 'c2', text: '深度学习是机器学习的子领域' }
      ];
      
      const scored = await scorer.scoreChunks(query, chunks, { method: 'hybrid_semantic' });
      
      expect(scored.length).toBe(2);
      expect(scored[0].relevance_score).toBeGreaterThan(0);
    });

    test('should select relevant chunks with semantic scoring', async () => {
      const query = '人工智能';
      const chunks = [
        { chunk_id: 'c1', text: '机器学习是人工智能的分支' },
        { chunk_id: 'c2', text: '深度学习是机器学习的子领域' },
        { chunk_id: 'c3', text: '今天天气很好' }
      ];
      
      const relevant = await scorer.selectRelevantChunks(query, chunks, { 
        method: 'semantic',
        topK: 2
      });
      
      expect(relevant.length).toBeLessThanOrEqual(2);
    });

    test('should include semantic stats in cache stats', () => {
      const stats = scorer.getCacheStats();
      
      expect(stats).toHaveProperty('semantic_stats');
      expect(stats.semantic_stats).toHaveProperty('cached_embeddings');
    });
  });
});
