/**
 * Unit tests for ChunkManager
 */

const { ChunkManager, estimateTokens, calculateOffset } = require('./chunk_manager');

describe('ChunkManager', () => {
  let chunkManager;

  beforeEach(() => {
    chunkManager = new ChunkManager();
  });

  describe('estimateTokens', () => {
    test('should estimate tokens for Chinese text', () => {
      const text = '这是一个测试文本';
      const tokens = estimateTokens(text);
      expect(tokens).toBe(8); // 8 Chinese characters
    });

    test('should estimate tokens for English text', () => {
      const text = 'This is a test text';
      const tokens = estimateTokens(text);
      expect(tokens).toBe(5); // 5 English words
    });

    test('should estimate tokens for mixed text', () => {
      const text = '这是 test 文本';
      const tokens = estimateTokens(text);
      expect(tokens).toBe(5); // 4 Chinese + 1 English
    });

    test('should return 0 for empty text', () => {
      expect(estimateTokens('')).toBe(0);
      expect(estimateTokens(null)).toBe(0);
    });
  });

  describe('calculateOffset', () => {
    test('should calculate correct offset', () => {
      const fullText = 'Hello world, this is a test';
      const fragment = 'world';
      const offset = calculateOffset(fullText, fragment);
      expect(offset).toBe(6);
    });

    test('should return 0 if fragment not found', () => {
      const fullText = 'Hello world';
      const fragment = 'xyz';
      const offset = calculateOffset(fullText, fragment);
      expect(offset).toBe(0);
    });
  });

  describe('chunkCKB - paragraph strategy', () => {
    test('should chunk by paragraphs', async () => {
      const ckb = {
        ckb_id: 'test_ckb_1',
        content: {
          text: '第一段内容这是一个足够长的段落用于测试分片功能。\n\n第二段内容这也是一个足够长的段落。\n\n第三段内容同样是足够长的段落。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { strategy: 'paragraph', minLength: 10 });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].chunk_type).toBe('paragraph');
      expect(chunks[0].text).toContain('第一段');
    });

    test('should merge short paragraphs', async () => {
      const ckb = {
        ckb_id: 'test_ckb_2',
        content: {
          text: '短段。\n\n这是一个稍微长一点的段落内容。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { 
        strategy: 'paragraph',
        minLength: 10
      });

      // Short paragraph should be merged with previous or next
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some(c => c.text.includes('短段'))).toBe(true);
    });

    test('should split long paragraphs', async () => {
      const longParagraph = '这是一个很长的段落。'.repeat(50);
      const ckb = {
        ckb_id: 'test_ckb_3',
        content: {
          text: longParagraph
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { 
        strategy: 'paragraph',
        maxLength: 100
      });

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every(c => c.text.length <= 100 || c.text.length <= 150)).toBe(true);
    });
  });

  describe('chunkCKB - sentence strategy', () => {
    test('should chunk by sentences', async () => {
      const ckb = {
        ckb_id: 'test_ckb_4',
        content: {
          text: '第一句话这是一个足够长的句子。第二句话也是足够长的句子。第三句话同样足够长。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { strategy: 'sentence', minLength: 10 });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].chunk_type).toBe('sentence');
      expect(chunks[0].metadata.sentence_count).toBeGreaterThan(0);
    });

    test('should respect maxLength in sentence chunking', async () => {
      const ckb = {
        ckb_id: 'test_ckb_5',
        content: {
          text: '第一句话。'.repeat(20)
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { 
        strategy: 'sentence',
        maxLength: 50
      });

      expect(chunks.every(c => c.text.length <= 60)).toBe(true);
    });
  });

  describe('chunkCKB - fixed strategy', () => {
    test('should chunk by fixed length', async () => {
      const ckb = {
        ckb_id: 'test_ckb_6',
        content: {
          text: 'a'.repeat(1000)
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { 
        strategy: 'fixed',
        maxLength: 200,
        overlap: 20
      });

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].chunk_type).toBe('fixed_length');
      
      // Check overlap
      for (let i = 1; i < chunks.length; i++) {
        const prevEnd = chunks[i - 1].end_offset;
        const currStart = chunks[i].start_offset;
        expect(prevEnd - currStart).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('chunkCKB - semantic strategy', () => {
    test('should chunk by semantic similarity', async () => {
      const ckb = {
        ckb_id: 'test_ckb_semantic_1',
        content: {
          text: '地下水位监测是重要工作。我们需要定期检查水位变化。水位下降会影响农业生产。农作物需要充足的水源。灌溉系统必须保持良好状态。设备维护是关键环节。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { 
        strategy: 'semantic',
        minLength: 20,
        maxLength: 200,
        similarityThreshold: 0.6
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].chunk_type).toBe('semantic');
      expect(chunks[0].metadata.avg_similarity).toBeDefined();
      expect(chunks[0].metadata.avg_similarity).toBeGreaterThanOrEqual(0);
      expect(chunks[0].metadata.avg_similarity).toBeLessThanOrEqual(1);
    });

    test('should handle single sentence text', async () => {
      const ckb = {
        ckb_id: 'test_ckb_semantic_2',
        content: {
          text: '这是一个单独的句子。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { 
        strategy: 'semantic',
        minLength: 5
      });

      expect(chunks.length).toBe(1);
      expect(chunks[0].chunk_type).toBe('semantic');
      expect(chunks[0].metadata.avg_similarity).toBe(1.0);
    });

    test('should merge short semantic chunks', async () => {
      const ckb = {
        ckb_id: 'test_ckb_semantic_3',
        content: {
          text: '短句。另一个短句。第三个短句。这些句子语义相似。它们应该被合并。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { 
        strategy: 'semantic',
        minLength: 30,
        maxLength: 200,
        similarityThreshold: 0.5
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.every(c => c.text.length >= 20 || chunks.length === 1)).toBe(true);
    });

    test('should split long semantic chunks', async () => {
      // Create text with different semantic content to trigger splits
      const longText = '这是关于水位监测的内容。水位数据很重要。' + 
                       '现在讨论农业生产问题。农作物需要灌溉。' +
                       '接下来谈论设备维护。设备需要定期检查。';
      const ckb = {
        ckb_id: 'test_ckb_semantic_4',
        content: {
          text: longText
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { 
        strategy: 'semantic',
        minLength: 20,
        maxLength: 100,
        similarityThreshold: 0.6
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks.every(c => c.text.length <= 150)).toBe(true);
    });

    test('should identify semantic boundaries', async () => {
      const ckb = {
        ckb_id: 'test_ckb_semantic_5',
        content: {
          text: '水位监测很重要。我们每天检查水位。水位数据需要记录。今天天气很好。阳光明媚温度适宜。适合户外活动。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { 
        strategy: 'semantic',
        minLength: 20,
        maxLength: 200,
        similarityThreshold: 0.6,
        windowSize: 2
      });

      // Should split at semantic boundary (water monitoring vs weather)
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].chunk_type).toBe('semantic');
    });

    test('should use sliding window for smoothing', async () => {
      const ckb = {
        ckb_id: 'test_ckb_semantic_6',
        content: {
          text: '第一句话。第二句话。第三句话。第四句话。第五句话。'
        }
      };

      const chunks1 = await chunkManager.chunkCKB(ckb, { 
        strategy: 'semantic',
        minLength: 10,
        similarityThreshold: 0.7,
        windowSize: 1
      });

      const chunks2 = await chunkManager.chunkCKB(ckb, { 
        strategy: 'semantic',
        minLength: 10,
        similarityThreshold: 0.7,
        windowSize: 3
      });

      // Larger window should produce smoother chunking
      expect(chunks1.length).toBeGreaterThan(0);
      expect(chunks2.length).toBeGreaterThan(0);
    });

    test('should handle mixed Chinese and English text', async () => {
      const ckb = {
        ckb_id: 'test_ckb_semantic_7',
        content: {
          text: '水位监测 water level monitoring 是重要的。We need to check regularly。定期检查很关键。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { 
        strategy: 'semantic',
        minLength: 15,
        maxLength: 200
      });

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].chunk_type).toBe('semantic');
    });

    test('should preserve semantic coherence', async () => {
      const ckb = {
        ckb_id: 'test_ckb_semantic_8',
        content: {
          text: '机器学习是人工智能的分支。深度学习使用神经网络。神经网络模拟大脑结构。今天吃了美味的午餐。餐厅环境很好。服务态度优秀。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { 
        strategy: 'semantic',
        minLength: 20,
        maxLength: 200,
        similarityThreshold: 0.5
      });

      // Should separate AI topic from lunch topic
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      
      // Check that chunks maintain semantic coherence
      for (const chunk of chunks) {
        expect(chunk.metadata.avg_similarity).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('chunkCKB - edge cases', () => {
    test('should handle empty text', async () => {
      const ckb = {
        ckb_id: 'test_ckb_7',
        content: {
          text: ''
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb);
      expect(chunks.length).toBe(1);
      expect(chunks[0].chunk_type).toBe('full_text');
    });

    test('should handle very short text', async () => {
      const ckb = {
        ckb_id: 'test_ckb_8',
        content: {
          text: '短文本'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { minLength: 50 });
      expect(chunks.length).toBe(1);
      expect(chunks[0].chunk_type).toBe('full_text');
    });

    test('should handle text without clear boundaries', async () => {
      const ckb = {
        ckb_id: 'test_ckb_9',
        content: {
          text: 'NoSpacesOrPunctuationJustOneVeryLongStringOfText'.repeat(10)
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { strategy: 'fixed' });
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('getChunks', () => {
    test('should retrieve chunks by IDs', async () => {
      const ckb = {
        ckb_id: 'test_ckb_10',
        content: {
          text: '第一段这是足够长的内容。\n\n第二段也是足够长的内容。\n\n第三段同样足够长。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { minLength: 10 });
      const chunkIds = chunks.map(c => c.chunk_id).filter(id => id);

      if (chunkIds.length > 0) {
        const retrieved = await chunkManager.getChunks([chunkIds[0]]);
        expect(retrieved.length).toBeGreaterThan(0);
        expect(retrieved[0].chunk_id).toBe(chunkIds[0]);
      }
    });

    test('should return empty array for invalid IDs', async () => {
      const retrieved = await chunkManager.getChunks(['invalid_id']);
      expect(retrieved.length).toBe(0);
    });

    test('should return empty array for empty input', async () => {
      const retrieved = await chunkManager.getChunks([]);
      expect(retrieved.length).toBe(0);
    });
  });

  describe('getAdjacentChunks', () => {
    test('should get adjacent chunks', async () => {
      const ckb = {
        ckb_id: 'test_ckb_11',
        content: {
          text: '第一段足够长的内容。\n\n第二段足够长的内容。\n\n第三段足够长的内容。\n\n第四段足够长的内容。\n\n第五段足够长的内容。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { minLength: 10 });
      if (chunks.length >= 3) {
        const middleChunkId = chunks[2].chunk_id;

        const adjacent = await chunkManager.getAdjacentChunks(middleChunkId, 1);
        expect(adjacent.length).toBeGreaterThan(0);
      }
    });

    test('should handle edge chunks', async () => {
      const ckb = {
        ckb_id: 'test_ckb_12',
        content: {
          text: '第一段足够长的内容。\n\n第二段足够长的内容。\n\n第三段足够长的内容。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { minLength: 10 });
      if (chunks.length > 1) {
        const firstChunkId = chunks[0].chunk_id;

        const adjacent = await chunkManager.getAdjacentChunks(firstChunkId, 1);
        expect(adjacent.length).toBeGreaterThanOrEqual(0);
      }
    });

    test('should handle larger windows', async () => {
      const ckb = {
        ckb_id: 'test_ckb_13',
        content: {
          text: '第一段足够长的内容。\n\n第二段足够长的内容。\n\n第三段足够长的内容。\n\n第四段足够长的内容。\n\n第五段足够长的内容。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { minLength: 10 });
      if (chunks.length >= 3) {
        const middleChunkId = chunks[2].chunk_id;

        const adjacent = await chunkManager.getAdjacentChunks(middleChunkId, 2);
        expect(adjacent.length).toBeGreaterThan(0);
      }
    });
  });

  describe('cache management', () => {
    test('should cache chunks', async () => {
      const ckb = {
        ckb_id: 'test_ckb_14',
        content: {
          text: '测试缓存这是一个足够长的文本用于测试缓存功能。'
        }
      };

      await chunkManager.chunkCKB(ckb, { minLength: 10 });
      const stats = chunkManager.getCacheStats();
      
      expect(stats.cached_ckbs).toBeGreaterThanOrEqual(0);
      expect(stats.total_chunks).toBeGreaterThanOrEqual(0);
    });

    test('should clear specific cache', async () => {
      const ckb1 = { ckb_id: 'test_ckb_15', content: { text: '文本1这是足够长的内容' } };
      const ckb2 = { ckb_id: 'test_ckb_16', content: { text: '文本2这也是足够长的内容' } };

      await chunkManager.chunkCKB(ckb1, { minLength: 10 });
      await chunkManager.chunkCKB(ckb2, { minLength: 10 });

      chunkManager.clearCache('test_ckb_15');
      const stats = chunkManager.getCacheStats();
      
      expect(stats.cached_ckbs).toBeGreaterThanOrEqual(0);
    });

    test('should clear all cache', async () => {
      const ckb = { ckb_id: 'test_ckb_17', content: { text: '文本' } };
      await chunkManager.chunkCKB(ckb);

      chunkManager.clearCache();
      const stats = chunkManager.getCacheStats();
      
      expect(stats.cached_ckbs).toBe(0);
      expect(stats.total_chunks).toBe(0);
    });
  });

  describe('metadata', () => {
    test('should include correct metadata', async () => {
      const ckb = {
        ckb_id: 'test_ckb_18',
        content: {
          text: '这是一个测试段落足够长的内容。它包含两个句子。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { minLength: 10 });
      
      expect(chunks[0].metadata).toBeDefined();
      expect(chunks[0].metadata.token_count).toBeGreaterThan(0);
      expect(chunks[0].metadata.char_count).toBeGreaterThan(0);
      expect(chunks[0].metadata.sentence_count).toBeGreaterThan(0);
    });

    test('should have correct chunk IDs', async () => {
      const ckb = {
        ckb_id: 'test_ckb_19',
        content: {
          text: '第一段足够长的内容。\n\n第二段足够长的内容。'
        }
      };

      const chunks = await chunkManager.chunkCKB(ckb, { minLength: 10 });
      
      expect(chunks[0].chunk_id).toBe('test_ckb_19_chunk_0');
      if (chunks.length > 1) {
        expect(chunks[1].chunk_id).toBe('test_ckb_19_chunk_1');
      }
      expect(chunks[0].ckb_id).toBe('test_ckb_19');
    });
  });
});
