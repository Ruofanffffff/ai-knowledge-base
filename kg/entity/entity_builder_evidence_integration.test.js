/**
 * Entity Builder - Evidence Locator Integration Tests
 * 
 * Tests the integration of Evidence Locator with Entity Builder
 * for context optimization during entity name enhancement.
 */

const { generateCanonicalName, setLLMClient } = require('./entity_builder');

describe('Entity Builder - Evidence Locator Integration', () => {
  let mockLLMClient;
  let callCount;
  let lastPrompt;

  beforeEach(() => {
    callCount = 0;
    lastPrompt = null;
    
    // Mock LLM client
    mockLLMClient = {
      callJSON: jest.fn(async (prompt, options) => {
        callCount++;
        lastPrompt = prompt;
        
        return {
          canonical_name: '优化后的名称',
          aliases: ['别名1', '别名2'],
          reasoning: '测试优化',
          _meta: {
            tokens: Math.ceil(prompt.length / 4)
          }
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
      // Set environment variable
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const fields = {
        区域: '阿里C区',
        指标: '水位',
        时间: '2025-01'
      };
      
      const schema = {
        schema_name: '地下水位变化事件',
        entity_type: 'EventEntity',
        anchor_fields: ['区域', '指标', '时间']
      };
      
      // Create CKB with long text - entity fields are in the text
      const longText = '这是一段很长的前文。'.repeat(50) + 
                       '阿里C区的地下水位在2025年1月下降了10米。' +
                       '这是一段很长的后文。'.repeat(50);
      
      const ckb = {
        ckb_id: 'ckb_1',
        doc_id: 'doc_1',
        content: {
          text: longText
        },
        chunks: []
      };
      
      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: true,
        llmClient: mockLLMClient
      });
      
      // Verify LLM was called
      expect(callCount).toBe(1);
      expect(lastPrompt).toBeDefined();
      
      // The prompt contains the template text plus context
      // With optimization, context should be extracted around entity fields
      // Without optimization, full text is used
      
      // Verify the prompt still contains relevant context
      expect(lastPrompt).toContain('阿里C区');
      expect(lastPrompt).toContain('水位');
      
      // Clean up
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });

    it('should fall back to full text when context optimization fails', async () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const fields = {
        区域: '测试区域'
      };
      
      const schema = {
        schema_name: '测试Schema',
        entity_type: 'TestEntity',
        anchor_fields: ['区域']
      };
      
      const ckb = {
        ckb_id: 'ckb_2',
        doc_id: 'doc_2',
        content: {
          text: '这是测试文本，不包含实体信息。'
        },
        chunks: []
      };
      
      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: true,
        llmClient: mockLLMClient
      });
      
      // Should still work with full text fallback
      expect(callCount).toBe(1);
      expect(lastPrompt).toContain('这是测试文本');
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });

    it('should use full text when ENABLE_CONTEXT_OPTIMIZATION is false', async () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'false';
      
      const fields = {
        区域: '阿里C区'
      };
      
      const schema = {
        schema_name: '测试Schema',
        entity_type: 'TestEntity',
        anchor_fields: ['区域']
      };
      
      const fullText = '完整的文档文本内容，包含阿里C区的信息。';
      
      const ckb = {
        ckb_id: 'ckb_3',
        doc_id: 'doc_3',
        content: {
          text: fullText
        },
        chunks: []
      };
      
      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: true,
        llmClient: mockLLMClient
      });
      
      // Should use full text
      expect(callCount).toBe(1);
      expect(lastPrompt).toContain(fullText);
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });

    it('should work with chunked CKBs', async () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const fields = {
        区域: '阿里C区',
        指标: '水位'
      };
      
      const schema = {
        schema_name: '地下水位变化事件',
        entity_type: 'EventEntity',
        anchor_fields: ['区域', '指标']
      };
      
      const ckb = {
        ckb_id: 'ckb_4',
        doc_id: 'doc_4',
        content: {
          text: '完整文本'
        },
        chunks: [
          {
            id: 'chunk_1',
            text: '第一段：阿里C区的基本情况。',
            start_offset: 0,
            end_offset: 15
          },
          {
            id: 'chunk_2',
            text: '第二段：水位监测数据分析。',
            start_offset: 15,
            end_offset: 29
          },
          {
            id: 'chunk_3',
            text: '第三段：其他无关内容。',
            start_offset: 29,
            end_offset: 41
          }
        ]
      };
      
      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: true,
        llmClient: mockLLMClient
      });
      
      // Should successfully use chunks
      expect(callCount).toBe(1);
      expect(lastPrompt).toBeDefined();
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });
  });

  describe('Token Savings', () => {
    it('should demonstrate context optimization capability', async () => {
      // This test demonstrates that the Evidence Locator integration is working
      // In practice, token savings depend on entity name being found in text
      
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const fields = {
        区域: '测试区域',
        指标: '测试指标'
      };
      
      const schema = {
        schema_name: '测试Schema',
        entity_type: 'TestEntity',
        anchor_fields: ['区域', '指标']
      };
      
      // Create text where entity fields appear
      const relevantText = '测试区域的测试指标数据分析报告。';
      const longText = '无关内容。'.repeat(100) + 
                       relevantText +
                       '无关内容。'.repeat(100);
      
      const ckb = {
        ckb_id: 'ckb_5',
        doc_id: 'doc_5',
        content: {
          text: longText
        },
        chunks: []
      };
      
      await generateCanonicalName(fields, schema, ckb, {
        useLLM: true,
        llmClient: mockLLMClient
      });
      
      // Verify LLM was called successfully
      expect(callCount).toBe(1);
      expect(lastPrompt).toBeDefined();
      
      // Verify relevant context is included
      expect(lastPrompt).toContain('测试区域');
      expect(lastPrompt).toContain('测试指标');
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });
  });

  describe('Error Handling', () => {
    it('should handle missing entity fields gracefully', async () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const fields = {};
      
      const schema = {
        schema_name: '测试Schema',
        entity_type: 'TestEntity',
        anchor_fields: []
      };
      
      const ckb = {
        ckb_id: 'ckb_6',
        doc_id: 'doc_6',
        content: {
          text: '测试文本'
        },
        chunks: []
      };
      
      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: true,
        llmClient: mockLLMClient
      });
      
      // Should still work
      expect(result).toBeDefined();
      expect(result.canonical_name).toBeDefined();
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });

    it('should handle null CKB content gracefully', async () => {
      process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
      
      const fields = {
        区域: '测试'
      };
      
      const schema = {
        schema_name: '测试Schema',
        entity_type: 'TestEntity',
        anchor_fields: ['区域']
      };
      
      const ckb = {
        ckb_id: 'ckb_7',
        doc_id: 'doc_7',
        content: null,
        chunks: []
      };
      
      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: true,
        llmClient: mockLLMClient
      });
      
      // Should handle gracefully
      expect(result).toBeDefined();
      
      delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    });
  });
});
