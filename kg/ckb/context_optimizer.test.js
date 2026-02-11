/**
 * Unit Tests for Context Optimizer
 */

const { ContextOptimizer } = require('./context_optimizer');
const { ChunkManager } = require('./chunk_manager');
const { RelevanceScorer } = require('./relevance_scorer');

describe('ContextOptimizer', () => {
  let optimizer;
  let mockChunkManager;
  let mockRelevanceScorer;

  beforeEach(() => {
    // Create mock chunk manager
    mockChunkManager = {
      chunkCKB: jest.fn(),
      getAdjacentChunks: jest.fn()
    };

    // Create mock relevance scorer
    mockRelevanceScorer = {
      selectRelevantChunks: jest.fn()
    };

    optimizer = new ContextOptimizer({
      chunkManager: mockChunkManager,
      relevanceScorer: mockRelevanceScorer,
      maxTokens: 2000,
      minChunks: 2,
      maxChunks: 10,
      relevanceThreshold: 0.1
    });
  });

  describe('Constructor', () => {
    test('should initialize with default config', () => {
      const opt = new ContextOptimizer();
      const config = opt.getConfig();
      
      expect(config.maxTokens).toBe(2000);
      expect(config.minChunks).toBe(2);
      expect(config.maxChunks).toBe(10);
      expect(config.relevanceThreshold).toBe(0.1);
      expect(config.includeAdjacent).toBe(true);
    });

    test('should accept custom config', () => {
      const opt = new ContextOptimizer({
        maxTokens: 3000,
        minChunks: 3,
        includeAdjacent: false
      });
      const config = opt.getConfig();
      
      expect(config.maxTokens).toBe(3000);
      expect(config.minChunks).toBe(3);
      expect(config.includeAdjacent).toBe(false);
    });
  });

  describe('optimizeForFieldExtraction', () => {
    test('should return full text when too few chunks', async () => {
      const ckbs = [
        {
          ckb_id: 'ckb1',
          content: { text: 'Short text' }
        }
      ];

      mockChunkManager.chunkCKB.mockResolvedValue([
        {
          chunk_id: 'chunk1',
          text: 'Short text',
          metadata: { token_count: 10 }
        }
      ]);

      const result = await optimizer.optimizeForFieldExtraction(
        ckbs,
        ['field1', 'field2']
      );

      expect(result.optimized).toBe(false);
      expect(result.reason).toBe('too_few_chunks');
      expect(result.context).toBe('Short text');
    });

    test('should select relevant chunks when sufficient', async () => {
      const ckbs = [
        {
          ckb_id: 'ckb1',
          content: { text: 'Long document with multiple paragraphs' }
        }
      ];

      const chunks = [
        {
          chunk_id: 'chunk1',
          ckb_id: 'ckb1',
          chunk_index: 0,
          text: 'Paragraph about field1',
          metadata: { token_count: 50 }
        },
        {
          chunk_id: 'chunk2',
          ckb_id: 'ckb1',
          chunk_index: 1,
          text: 'Paragraph about field2',
          metadata: { token_count: 50 }
        },
        {
          chunk_id: 'chunk3',
          ckb_id: 'ckb1',
          chunk_index: 2,
          text: 'Irrelevant paragraph',
          metadata: { token_count: 50 }
        }
      ];

      mockChunkManager.chunkCKB.mockResolvedValue(chunks);
      mockRelevanceScorer.selectRelevantChunks.mockReturnValue([
        { ...chunks[0], relevance_score: 0.8 },
        { ...chunks[1], relevance_score: 0.7 }
      ]);
      mockChunkManager.getAdjacentChunks.mockResolvedValue([]);

      const result = await optimizer.optimizeForFieldExtraction(
        ckbs,
        ['field1', 'field2']
      );

      expect(result.optimized).toBe(true);
      expect(result.chunks.length).toBe(2);
      expect(result.tokenCount).toBe(100);
      expect(result.originalTokenCount).toBe(150);
      expect(result.tokenSavings).toBe(50);
    });

    test('should include adjacent chunks when enabled', async () => {
      const ckbs = [
        {
          ckb_id: 'ckb1',
          content: { text: 'Document text' }
        }
      ];

      const chunks = [
        {
          chunk_id: 'chunk1',
          ckb_id: 'ckb1',
          chunk_index: 0,
          text: 'Chunk 1',
          metadata: { token_count: 50 }
        },
        {
          chunk_id: 'chunk2',
          ckb_id: 'ckb1',
          chunk_index: 1,
          text: 'Chunk 2',
          metadata: { token_count: 50 }
        },
        {
          chunk_id: 'chunk3',
          ckb_id: 'ckb1',
          chunk_index: 2,
          text: 'Chunk 3',
          metadata: { token_count: 50 }
        }
      ];

      mockChunkManager.chunkCKB.mockResolvedValue(chunks);
      // Return 2 relevant chunks to pass minChunks threshold
      mockRelevanceScorer.selectRelevantChunks.mockReturnValue([
        { ...chunks[0], relevance_score: 0.8 },
        { ...chunks[1], relevance_score: 0.7 }
      ]);
      mockChunkManager.getAdjacentChunks.mockResolvedValue([
        chunks[2]
      ]);

      const result = await optimizer.optimizeForFieldExtraction(
        ckbs,
        ['field1']
      );

      expect(result.optimized).toBe(true);
      expect(result.chunks.length).toBe(3);
      expect(mockChunkManager.getAdjacentChunks).toHaveBeenCalled();
    });

    test('should respect token limit', async () => {
      const ckbs = [
        {
          ckb_id: 'ckb1',
          content: { text: 'Document text' }
        }
      ];

      const chunks = Array.from({ length: 10 }, (_, i) => ({
        chunk_id: `chunk${i}`,
        ckb_id: 'ckb1',
        chunk_index: i,
        text: `Chunk ${i}`,
        metadata: { token_count: 300 },
        relevance_score: 0.5
      }));

      mockChunkManager.chunkCKB.mockResolvedValue(chunks);
      mockRelevanceScorer.selectRelevantChunks.mockReturnValue(chunks);
      mockChunkManager.getAdjacentChunks.mockResolvedValue([]);

      const result = await optimizer.optimizeForFieldExtraction(
        ckbs,
        ['field1'],
        { maxTokens: 1000 }
      );

      expect(result.optimized).toBe(true);
      expect(result.tokenCount).toBeLessThanOrEqual(1000);
      expect(result.chunks.length).toBeLessThanOrEqual(4); // 1000/300 = 3.33
    });

    test('should handle insufficient relevant chunks', async () => {
      const ckbs = [
        {
          ckb_id: 'ckb1',
          content: { text: 'Document text' }
        }
      ];

      const chunks = Array.from({ length: 5 }, (_, i) => ({
        chunk_id: `chunk${i}`,
        ckb_id: 'ckb1',
        chunk_index: i,
        text: `Chunk ${i}`,
        metadata: { token_count: 50 }
      }));

      mockChunkManager.chunkCKB.mockResolvedValue(chunks);
      mockRelevanceScorer.selectRelevantChunks.mockReturnValue([chunks[0]]);

      const result = await optimizer.optimizeForFieldExtraction(
        ckbs,
        ['field1'],
        { minChunks: 2 }
      );

      expect(result.optimized).toBe(false);
      expect(result.reason).toBe('insufficient_relevant_chunks');
      expect(result.chunks.length).toBe(5); // Falls back to all chunks
    });
  });

  describe('optimizeForEntityNaming', () => {
    test('should use mention-based method when entity is mentioned', async () => {
      const entity = {
        name: 'ISO 100',
        type: 'parameter'
      };

      const ckbs = [
        {
          ckb_id: 'ckb1',
          content: { text: 'The camera uses ISO 100 for bright conditions' }
        }
      ];

      const chunks = [
        {
          chunk_id: 'chunk1',
          ckb_id: 'ckb1',
          chunk_index: 0,
          text: 'The camera uses ISO 100 for bright conditions',
          metadata: { token_count: 50 }
        },
        {
          chunk_id: 'chunk2',
          ckb_id: 'ckb1',
          chunk_index: 1,
          text: 'Other unrelated text',
          metadata: { token_count: 50 }
        }
      ];

      mockChunkManager.chunkCKB.mockResolvedValue(chunks);

      const result = await optimizer.optimizeForEntityNaming(entity, ckbs);

      expect(result.optimized).toBe(true);
      expect(result.method).toBe('mention_based');
      expect(result.chunks.length).toBe(1);
      expect(result.chunks[0].text).toContain('ISO 100');
    });

    test('should use relevance-based method when entity not mentioned', async () => {
      const entity = {
        name: 'camera',
        type: 'device'
      };

      const ckbs = [
        {
          ckb_id: 'ckb1',
          content: { text: 'Photography equipment discussion' }
        }
      ];

      const chunks = [
        {
          chunk_id: 'chunk1',
          ckb_id: 'ckb1',
          chunk_index: 0,
          text: 'Photography equipment discussion',
          metadata: { token_count: 50 }
        }
      ];

      mockChunkManager.chunkCKB.mockResolvedValue(chunks);
      mockRelevanceScorer.selectRelevantChunks.mockReturnValue([chunks[0]]);

      const result = await optimizer.optimizeForEntityNaming(entity, ckbs);

      expect(result.optimized).toBe(true);
      expect(result.method).toBe('relevance_based');
      expect(mockRelevanceScorer.selectRelevantChunks).toHaveBeenCalled();
    });

    test('should respect token limit', async () => {
      const entity = {
        name: 'test',
        type: 'entity'
      };

      const ckbs = [
        {
          ckb_id: 'ckb1',
          content: { text: 'test test test' }
        }
      ];

      const chunks = Array.from({ length: 10 }, (_, i) => ({
        chunk_id: `chunk${i}`,
        ckb_id: 'ckb1',
        chunk_index: i,
        text: `test chunk ${i}`,
        metadata: { token_count: 200 }
      }));

      mockChunkManager.chunkCKB.mockResolvedValue(chunks);

      const result = await optimizer.optimizeForEntityNaming(
        entity,
        ckbs,
        { maxTokens: 500 }
      );

      expect(result.optimized).toBe(true);
      expect(result.tokenCount).toBeLessThanOrEqual(500);
    });
  });

  describe('optimizeForRelationExtraction', () => {
    test('should use co-occurrence method when both entities present', async () => {
      const relation = {
        source: 'camera',
        target: 'lens'
      };

      const ckbs = [
        {
          ckb_id: 'ckb1',
          content: { text: 'The camera and lens work together' }
        }
      ];

      const chunks = [
        {
          chunk_id: 'chunk1',
          ckb_id: 'ckb1',
          chunk_index: 0,
          text: 'The camera and lens work together',
          metadata: { token_count: 50 }
        },
        {
          chunk_id: 'chunk2',
          ckb_id: 'ckb1',
          chunk_index: 1,
          text: 'Other text about camera only',
          metadata: { token_count: 50 }
        }
      ];

      mockChunkManager.chunkCKB.mockResolvedValue(chunks);

      const result = await optimizer.optimizeForRelationExtraction(relation, ckbs);

      expect(result.optimized).toBe(true);
      expect(result.method).toBe('co_occurrence');
      expect(result.chunks.length).toBe(1);
      expect(result.chunks[0].text).toContain('camera');
      expect(result.chunks[0].text).toContain('lens');
    });

    test('should use relevance-based method when no co-occurrence', async () => {
      const relation = {
        source: 'camera',
        target: 'lens'
      };

      const ckbs = [
        {
          ckb_id: 'ckb1',
          content: { text: 'Photography equipment' }
        }
      ];

      const chunks = [
        {
          chunk_id: 'chunk1',
          ckb_id: 'ckb1',
          chunk_index: 0,
          text: 'Photography equipment',
          metadata: { token_count: 50 }
        }
      ];

      mockChunkManager.chunkCKB.mockResolvedValue(chunks);
      mockRelevanceScorer.selectRelevantChunks.mockReturnValue([chunks[0]]);

      const result = await optimizer.optimizeForRelationExtraction(relation, ckbs);

      expect(result.optimized).toBe(true);
      expect(result.method).toBe('relevance_based');
      expect(mockRelevanceScorer.selectRelevantChunks).toHaveBeenCalled();
    });
  });

  describe('Configuration Management', () => {
    test('should update config', () => {
      optimizer.updateConfig({
        maxTokens: 3000,
        minChunks: 5
      });

      const config = optimizer.getConfig();
      expect(config.maxTokens).toBe(3000);
      expect(config.minChunks).toBe(5);
      expect(config.maxChunks).toBe(10); // Unchanged
    });

    test('should get current config', () => {
      const config = optimizer.getConfig();
      
      expect(config).toHaveProperty('maxTokens');
      expect(config).toHaveProperty('minChunks');
      expect(config).toHaveProperty('maxChunks');
      expect(config).toHaveProperty('relevanceThreshold');
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty CKB array', async () => {
      const result = await optimizer.optimizeForFieldExtraction(
        [],
        ['field1']
      );

      expect(result.optimized).toBe(false);
      expect(result.chunks.length).toBe(0);
    });

    test('should handle empty field names', async () => {
      const ckbs = [
        {
          ckb_id: 'ckb1',
          content: { text: 'Some text' }
        }
      ];

      mockChunkManager.chunkCKB.mockResolvedValue([
        {
          chunk_id: 'chunk1',
          text: 'Some text',
          metadata: { token_count: 10 }
        }
      ]);

      const result = await optimizer.optimizeForFieldExtraction(ckbs, []);

      expect(result).toBeDefined();
    });

    test('should handle chunks without token counts', async () => {
      const ckbs = [
        {
          ckb_id: 'ckb1',
          content: { text: 'Text' }
        }
      ];

      const chunks = [
        {
          chunk_id: 'chunk1',
          ckb_id: 'ckb1',
          chunk_index: 0,
          text: 'Text',
          metadata: {} // No token_count
        }
      ];

      mockChunkManager.chunkCKB.mockResolvedValue(chunks);
      mockRelevanceScorer.selectRelevantChunks.mockReturnValue([]);

      const result = await optimizer.optimizeForFieldExtraction(ckbs, ['field1']);

      expect(result.tokenCount).toBe(0);
      expect(result.originalTokenCount).toBe(0);
    });
  });
});


describe('ContextOptimizer - Batch Optimization', () => {
  let contextOptimizer;
  let chunkManager;
  let relevanceScorer;

  beforeEach(() => {
    chunkManager = new ChunkManager();
    relevanceScorer = new RelevanceScorer();
    contextOptimizer = new ContextOptimizer({
      chunkManager,
      relevanceScorer,
      enableBatchOptimization: true
    });
  });

  describe('batchOptimizeFieldExtraction', () => {
    it('should batch optimize field extraction for multiple CKBs', async () => {
      const ckbs = [
        {
          ckb_id: 'ckb_1',
          content: { text: '阿里C区水位下降10米。监测时间2025年1月。' },
          chunks: [
            {
              chunk_id: 'chunk_1',
              text: '阿里C区水位下降10米',
              ckb_id: 'ckb_1',
              metadata: { token_count: 20 }
            }
          ]
        },
        {
          ckb_id: 'ckb_2',
          content: { text: '阿里D区水位下降12米。监测时间2025年1月。' },
          chunks: [
            {
              chunk_id: 'chunk_2',
              text: '阿里D区水位下降12米',
              ckb_id: 'ckb_2',
              metadata: { token_count: 20 }
            }
          ]
        }
      ];

      const fieldNames = ['区域', '水位变化', '时间'];

      // 预计算IDF
      relevanceScorer.semanticScorer.precomputeIDF([
        '阿里C区水位下降10米',
        '阿里D区水位下降12米'
      ]);

      const result = await contextOptimizer.batchOptimizeFieldExtraction(
        ckbs,
        fieldNames
      );

      expect(result.optimized).toBe(true);
      expect(result.batches).toBeDefined();
      expect(result.totalCKBs).toBe(2);
      expect(result.optimization).toBeDefined();
      expect(result.optimization.baselineLLMCalls).toBe(2);
    });

    it('should return not optimized when batch optimization is disabled', async () => {
      const optimizer = new ContextOptimizer({
        enableBatchOptimization: false
      });

      const ckbs = [
        {
          ckb_id: 'ckb_1',
          chunks: [{ chunk_id: 'chunk_1', text: '文本1', ckb_id: 'ckb_1' }]
        }
      ];

      const result = await optimizer.batchOptimizeFieldExtraction(ckbs, ['字段']);

      expect(result.optimized).toBe(false);
      expect(result.reason).toBe('batch_optimization_disabled_or_no_ckbs');
    });

    it('should handle empty CKB array', async () => {
      const result = await contextOptimizer.batchOptimizeFieldExtraction([], ['字段']);

      expect(result.optimized).toBe(false);
      expect(result.batches).toEqual([]);
    });

    it('should reduce LLM calls for similar CKBs', async () => {
      // 创建5个相似的CKBs
      const ckbs = [];
      for (let i = 0; i < 5; i++) {
        ckbs.push({
          ckb_id: `ckb_${i}`,
          content: { text: '相似的水位监测数据' },
          chunks: [
            {
              chunk_id: `chunk_${i}`,
              text: '相似的水位监测数据',
              ckb_id: `ckb_${i}`,
              metadata: { token_count: 30 }
            }
          ]
        });
      }

      const result = await contextOptimizer.batchOptimizeFieldExtraction(
        ckbs,
        ['水位'],
        { similarityThreshold: 0.9 }
      );

      expect(result.optimized).toBe(true);
      // 应该有优化效果（即使不是完全减少50%）
      expect(result.optimization.optimizedLLMCalls).toBeLessThanOrEqual(
        result.optimization.baselineLLMCalls
      );
    });
  });

  describe('batchOptimizeEntityNaming', () => {
    it('should batch optimize entity naming', async () => {
      const entities = [
        {
          entity_id: 'entity_1',
          name: '阿里C区水位',
          supported_by: ['ckb_1']
        },
        {
          entity_id: 'entity_2',
          name: '阿里D区水位',
          supported_by: ['ckb_2']
        }
      ];

      const ckbs = [
        {
          ckb_id: 'ckb_1',
          content: { text: '阿里C区水位监测数据' },
          chunks: [
            {
              chunk_id: 'chunk_1',
              text: '阿里C区水位监测数据',
              ckb_id: 'ckb_1',
              metadata: { token_count: 20 }
            }
          ]
        },
        {
          ckb_id: 'ckb_2',
          content: { text: '阿里D区水位监测数据' },
          chunks: [
            {
              chunk_id: 'chunk_2',
              text: '阿里D区水位监测数据',
              ckb_id: 'ckb_2',
              metadata: { token_count: 20 }
            }
          ]
        }
      ];

      // 预计算IDF
      relevanceScorer.semanticScorer.precomputeIDF([
        '阿里C区水位监测数据',
        '阿里D区水位监测数据'
      ]);

      const result = await contextOptimizer.batchOptimizeEntityNaming(entities, ckbs);

      expect(result.optimized).toBe(true);
      expect(result.results.length).toBe(2);
      expect(result.totalEntities).toBe(2);
      expect(result.optimization).toBeDefined();
    });

    it('should return not optimized when batch optimization is disabled', async () => {
      const optimizer = new ContextOptimizer({
        enableBatchOptimization: false
      });

      const result = await optimizer.batchOptimizeEntityNaming([], []);

      expect(result.optimized).toBe(false);
      expect(result.reason).toBe('batch_optimization_disabled_or_no_entities');
    });

    it('should handle entities without supported_by', async () => {
      const entities = [
        {
          entity_id: 'entity_1',
          name: '实体1'
          // 没有supported_by字段
        }
      ];

      const ckbs = [
        {
          ckb_id: 'ckb_1',
          chunks: [{ chunk_id: 'chunk_1', text: '文本1', ckb_id: 'ckb_1' }]
        }
      ];

      const result = await contextOptimizer.batchOptimizeEntityNaming(entities, ckbs);

      expect(result.optimized).toBe(true);
      expect(result.results.length).toBe(0); // 没有相关CKBs
    });

    it('should identify shared context across entities', async () => {
      const entities = [
        {
          entity_id: 'entity_1',
          name: '实体1',
          supported_by: ['ckb_1', 'ckb_2']
        },
        {
          entity_id: 'entity_2',
          name: '实体2',
          supported_by: ['ckb_2', 'ckb_3']
        }
      ];

      const ckbs = [
        {
          ckb_id: 'ckb_1',
          chunks: [
            {
              chunk_id: 'chunk_1',
              text: '共享内容',
              ckb_id: 'ckb_1',
              metadata: { token_count: 20 }
            }
          ]
        },
        {
          ckb_id: 'ckb_2',
          chunks: [
            {
              chunk_id: 'chunk_2',
              text: '共享内容',
              ckb_id: 'ckb_2',
              metadata: { token_count: 20 }
            }
          ]
        },
        {
          ckb_id: 'ckb_3',
          chunks: [
            {
              chunk_id: 'chunk_3',
              text: '共享内容',
              ckb_id: 'ckb_3',
              metadata: { token_count: 20 }
            }
          ]
        }
      ];

      // 预计算IDF
      relevanceScorer.semanticScorer.precomputeIDF(['共享内容']);

      const result = await contextOptimizer.batchOptimizeEntityNaming(
        entities,
        ckbs,
        { similarityThreshold: 0.9 }
      );

      expect(result.optimized).toBe(true);
      expect(result.sharedContext).toBeDefined();
    });
  });

  describe('batchOptimizeRelationExtraction', () => {
    it('should batch optimize relation extraction', async () => {
      const relations = [
        {
          relation_id: 'rel_1',
          source: '阿里C区',
          target: '水位'
        },
        {
          relation_id: 'rel_2',
          source: '阿里D区',
          target: '水位'
        }
      ];

      const ckbs = [
        {
          ckb_id: 'ckb_1',
          content: { text: '阿里C区水位下降' },
          chunks: [
            {
              chunk_id: 'chunk_1',
              text: '阿里C区水位下降',
              ckb_id: 'ckb_1',
              metadata: { token_count: 20 }
            }
          ]
        },
        {
          ckb_id: 'ckb_2',
          content: { text: '阿里D区水位下降' },
          chunks: [
            {
              chunk_id: 'chunk_2',
              text: '阿里D区水位下降',
              ckb_id: 'ckb_2',
              metadata: { token_count: 20 }
            }
          ]
        }
      ];

      // 预计算IDF
      relevanceScorer.semanticScorer.precomputeIDF([
        '阿里C区水位下降',
        '阿里D区水位下降'
      ]);

      const result = await contextOptimizer.batchOptimizeRelationExtraction(
        relations,
        ckbs
      );

      expect(result.optimized).toBe(true);
      expect(result.results.length).toBe(2);
      expect(result.totalRelations).toBe(2);
      expect(result.optimization).toBeDefined();
    });

    it('should return not optimized when batch optimization is disabled', async () => {
      const optimizer = new ContextOptimizer({
        enableBatchOptimization: false
      });

      const result = await optimizer.batchOptimizeRelationExtraction([], []);

      expect(result.optimized).toBe(false);
      expect(result.reason).toBe('batch_optimization_disabled_or_no_relations');
    });

    it('should handle relations without relation_id', async () => {
      const relations = [
        {
          source: '实体A',
          target: '实体B'
          // 没有relation_id
        }
      ];

      const ckbs = [
        {
          ckb_id: 'ckb_1',
          content: { text: '实体A和实体B' },
          chunks: [
            {
              chunk_id: 'chunk_1',
              text: '实体A和实体B',
              ckb_id: 'ckb_1',
              metadata: { token_count: 20 }
            }
          ]
        }
      ];

      // 预计算IDF
      relevanceScorer.semanticScorer.precomputeIDF(['实体A和实体B']);

      const result = await contextOptimizer.batchOptimizeRelationExtraction(
        relations,
        ckbs
      );

      expect(result.optimized).toBe(true);
      expect(result.results.length).toBe(1);
      expect(result.results[0].relation_id).toBe('实体A_实体B');
    });
  });

  describe('getBatchOptimizer', () => {
    it('should return batch optimizer instance', () => {
      const batchOptimizer = contextOptimizer.getBatchOptimizer();

      expect(batchOptimizer).toBeDefined();
      expect(batchOptimizer.constructor.name).toBe('BatchOptimizer');
    });

    it('should allow direct access to batch optimizer methods', async () => {
      const batchOptimizer = contextOptimizer.getBatchOptimizer();
      const config = batchOptimizer.getConfig();

      expect(config).toBeDefined();
      expect(config.similarityThreshold).toBeDefined();
      expect(config.maxBatchSize).toBeDefined();
    });
  });

  describe('configuration', () => {
    it('should enable batch optimization by default', () => {
      const optimizer = new ContextOptimizer();
      const config = optimizer.getConfig();

      expect(config.enableBatchOptimization).toBe(true);
    });

    it('should allow disabling batch optimization', () => {
      const optimizer = new ContextOptimizer({
        enableBatchOptimization: false
      });
      const config = optimizer.getConfig();

      expect(config.enableBatchOptimization).toBe(false);
    });

    it('should update batch optimization configuration', () => {
      contextOptimizer.updateConfig({
        enableBatchOptimization: false
      });

      const config = contextOptimizer.getConfig();
      expect(config.enableBatchOptimization).toBe(false);
    });
  });
});
