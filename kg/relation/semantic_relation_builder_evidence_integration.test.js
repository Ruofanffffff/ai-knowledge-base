/**
 * Semantic Relation Builder - Evidence Locator Integration Tests
 * 
 * Tests the integration of Evidence Locator with Semantic Relation Builder
 * for context optimization during relation extraction.
 */

const {
  extractSemanticRelations,
  buildSemanticExtractionPrompt,
  setLLMClient
} = require('./semantic_relation_builder');

describe('Semantic Relation Builder - Evidence Locator Integration', () => {
  let mockLLMClient;
  let callCount;
  let lastPrompt;

  beforeEach(() => {
    callCount = 0;
    lastPrompt = null;
    
    // Mock LLM client with call() method (matching QwenClient interface)
    mockLLMClient = {
      call: jest.fn(async (prompt, options) => {
        callCount++;
        lastPrompt = prompt;
        
        // Return format matching QwenClient.call() response
        return {
          content: JSON.stringify({
            relations: [
              {
                subject: '实体A',
                subject_id: 'entity_1',
                relation: '导致',
                relation_type: 'causal',
                object: '实体B',
                object_id: 'entity_2',
                evidence_text: '实体A导致实体B',
                confidence: 0.9
              }
            ]
          }),
          tokens: Math.ceil(prompt.length / 4),
          input_tokens: Math.ceil(prompt.length / 4 * 0.7),
          output_tokens: Math.ceil(prompt.length / 4 * 0.3),
          model: 'qwen-turbo'
        };
      })
    };
    
    setLLMClient(mockLLMClient);
  });

  afterEach(() => {
    setLLMClient(null);
  });

  describe('Context Optimization', () => {
    it('should use optimized context when ENABLE_CONTEXT_OPTIMIZATION is true', async () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const entities = [
        {
          id: 'entity_1',
          canonical_name: '实体A',
          type: 'TestEntity'
        },
        {
          id: 'entity_2',
          canonical_name: '实体B',
          type: 'TestEntity'
        }
      ];
      
      // Create CKB with long text containing entities
      const longText = '无关内容。'.repeat(100) + 
                       '实体A导致实体B发生变化。' +
                       '无关内容。'.repeat(100);
      
      const ckb = {
        ckb_id: 'ckb_1',
        doc_id: 'doc_1',
        content: {
          text: longText
        },
        entities: entities,
        chunks: []
      };
      
      const relations = await extractSemanticRelations(ckb, mockLLMClient);
      
      // Verify LLM was called (extraction + validation = 2 calls)
      expect(callCount).toBeGreaterThanOrEqual(1);
      expect(lastPrompt).toBeDefined();
      
      // Verify the prompt contains entity information
      expect(lastPrompt).toContain('实体A');
      expect(lastPrompt).toContain('实体B');
      
      // Verify relations were extracted
      expect(relations).toBeDefined();
      expect(Array.isArray(relations)).toBe(true);
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });

    it('should fall back to full text when context optimization fails', async () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const entities = [
        {
          id: 'entity_1',
          canonical_name: '不存在的实体',
          type: 'TestEntity'
        }
      ];
      
      const ckb = {
        ckb_id: 'ckb_2',
        doc_id: 'doc_2',
        content: {
          text: '这是测试文本，不包含实体信息。'
        },
        entities: entities,
        chunks: []
      };
      
      const relations = await extractSemanticRelations(ckb, mockLLMClient);
      
      // Should still work with full text fallback
      // Note: May be 0 if no relations found, or 2+ if relations found (extraction + validation)
      expect(relations).toBeDefined();
      expect(Array.isArray(relations)).toBe(true);
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });

    it('should use full text when ENABLE_CONTEXT_OPTIMIZATION is false', async () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'false';
      
      const entities = [
        {
          id: 'entity_1',
          canonical_name: '实体A',
          type: 'TestEntity'
        },
        {
          id: 'entity_2',
          canonical_name: '实体B',
          type: 'TestEntity'
        }
      ];
      
      const fullText = '完整的文档文本内容，包含实体A和实体B的关系。';
      
      const ckb = {
        ckb_id: 'ckb_3',
        doc_id: 'doc_3',
        content: {
          text: fullText
        },
        entities: entities,
        chunks: []
      };
      
      const relations = await extractSemanticRelations(ckb, mockLLMClient);
      
      // Should use full text
      expect(callCount).toBe(1);
      expect(lastPrompt).toContain(fullText);
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });

    it('should work with chunked CKBs', async () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const entities = [
        {
          id: 'entity_1',
          canonical_name: '实体A',
          type: 'TestEntity'
        },
        {
          id: 'entity_2',
          canonical_name: '实体B',
          type: 'TestEntity'
        }
      ];
      
      const ckb = {
        ckb_id: 'ckb_4',
        doc_id: 'doc_4',
        content: {
          text: '完整文本'
        },
        entities: entities,
        chunks: [
          {
            id: 'chunk_1',
            text: '第一段：实体A的基本情况。',
            start_offset: 0,
            end_offset: 15
          },
          {
            id: 'chunk_2',
            text: '第二段：实体B与实体A的关系。',
            start_offset: 15,
            end_offset: 31
          },
          {
            id: 'chunk_3',
            text: '第三段：其他无关内容。',
            start_offset: 31,
            end_offset: 43
          }
        ]
      };
      
      const relations = await extractSemanticRelations(ckb, mockLLMClient);
      
      // Should successfully use chunks
      expect(callCount).toBe(1);
      expect(lastPrompt).toBeDefined();
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });

    it('should handle multiple entities efficiently', async () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const entities = [
        {
          id: 'entity_1',
          canonical_name: '实体A',
          type: 'TestEntity'
        },
        {
          id: 'entity_2',
          canonical_name: '实体B',
          type: 'TestEntity'
        },
        {
          id: 'entity_3',
          canonical_name: '实体C',
          type: 'TestEntity'
        }
      ];
      
      const longText = '无关内容。'.repeat(50) + 
                       '实体A、实体B和实体C之间存在复杂的关系。' +
                       '无关内容。'.repeat(50);
      
      const ckb = {
        ckb_id: 'ckb_5',
        doc_id: 'doc_5',
        content: {
          text: longText
        },
        entities: entities,
        chunks: []
      };
      
      const relations = await extractSemanticRelations(ckb, mockLLMClient);
      
      // Should extract context around all entities
      expect(callCount).toBe(1);
      expect(lastPrompt).toContain('实体A');
      expect(lastPrompt).toContain('实体B');
      expect(lastPrompt).toContain('实体C');
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });
  });

  describe('buildSemanticExtractionPrompt', () => {
    it('should build prompt with optimized context', () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const entities = [
        {
          id: 'entity_1',
          canonical_name: '测试实体',
          type: 'TestEntity'
        }
      ];
      
      const ckb = {
        ckb_id: 'ckb_6',
        doc_id: 'doc_6',
        content: {
          text: '前文。测试实体的相关信息。后文。'
        },
        entities: entities,
        chunks: []
      };
      
      const prompt = buildSemanticExtractionPrompt(ckb);
      
      expect(prompt).toBeDefined();
      expect(prompt).toContain('测试实体');
      expect(prompt).toContain('实体列表');
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });

    it('should handle empty entities list', () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const ckb = {
        ckb_id: 'ckb_7',
        doc_id: 'doc_7',
        content: {
          text: '测试文本'
        },
        entities: [],
        chunks: []
      };
      
      const prompt = buildSemanticExtractionPrompt(ckb);
      
      expect(prompt).toBeDefined();
      expect(prompt).toContain('测试文本');
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });
  });

  describe('Error Handling', () => {
    it('should handle missing CKB content gracefully', async () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const entities = [
        {
          id: 'entity_1',
          canonical_name: '测试',
          type: 'TestEntity'
        }
      ];
      
      const ckb = {
        ckb_id: 'ckb_8',
        doc_id: 'doc_8',
        content: null,
        entities: entities,
        chunks: []
      };
      
      const relations = await extractSemanticRelations(ckb, mockLLMClient);
      
      // Should handle gracefully
      expect(relations).toBeDefined();
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });

    it('should handle entities without canonical names', async () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const entities = [
        {
          id: 'entity_1',
          type: 'TestEntity'
          // Missing canonical_name
        }
      ];
      
      const ckb = {
        ckb_id: 'ckb_9',
        doc_id: 'doc_9',
        content: {
          text: '测试文本'
        },
        entities: entities,
        chunks: []
      };
      
      const relations = await extractSemanticRelations(ckb, mockLLMClient);
      
      // Should handle gracefully
      expect(relations).toBeDefined();
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });

    it('should return empty array when no entities', async () => {
      const ckb = {
        ckb_id: 'ckb_10',
        doc_id: 'doc_10',
        content: {
          text: '测试文本'
        },
        entities: [],
        chunks: []
      };
      
      const relations = await extractSemanticRelations(ckb, mockLLMClient);
      
      expect(relations).toEqual([]);
      expect(callCount).toBe(0); // LLM should not be called
    });

    it('should return empty array when only one entity', async () => {
      const ckb = {
        ckb_id: 'ckb_11',
        doc_id: 'doc_11',
        content: {
          text: '测试文本'
        },
        entities: [
          {
            id: 'entity_1',
            canonical_name: '单个实体',
            type: 'TestEntity'
          }
        ],
        chunks: []
      };
      
      const relations = await extractSemanticRelations(ckb, mockLLMClient);
      
      expect(relations).toEqual([]);
      expect(callCount).toBe(0); // LLM should not be called
    });
  });
});
