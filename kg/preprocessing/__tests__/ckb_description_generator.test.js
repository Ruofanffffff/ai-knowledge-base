/**
 * Unit tests for CKBDescriptionGenerator
 * 
 * Tests CKB generation from indexed text
 * Requirements: 2.1
 */

const { CKBDescriptionGenerator } = require('../ckb_description_generator');

describe('CKBDescriptionGenerator', () => {
  let generator;
  let mockLLMClient;

  beforeEach(() => {
    generator = new CKBDescriptionGenerator();
    
    // Mock LLM client
    mockLLMClient = {
      call: jest.fn()
    };
  });

  describe('generateCKBDescriptions', () => {
    it('should generate CKBs from indexed text', async () => {
      const indexedText = `1. 2025年1月，阿里C区地下水位监测显示水位为45.2米。
2. 阿里C区位于海南省海口市美兰区。
3. 该监测点编号为ALI-C-001。`;
      
      const docId = 'doc-123';
      
      mockLLMClient.call.mockResolvedValue({
        content: `{
  "ckbs": [
    {
      "ckb_text": "2025年1月，阿里C区地下水位监测显示水位为45.2米。",
      "source_index": 1
    },
    {
      "ckb_text": "阿里C区位于海南省海口市美兰区。",
      "source_index": 2
    },
    {
      "ckb_text": "该监测点编号为ALI-C-001。",
      "source_index": 3
    }
  ]
}`,
        model: 'qwen-plus'
      });

      const ckbs = await generator.generateCKBDescriptions(indexedText, docId, mockLLMClient);

      expect(ckbs).toHaveLength(3);
      expect(ckbs[0].doc_id).toBe(docId);
      expect(ckbs[0].source_type).toBe('llm_generated');
      
      // Check content
      expect(ckbs[0].content.text).toContain('45.2米');
      
      // Check source meta
      const sourceMeta0 = typeof ckbs[0].source_meta === 'string'
        ? JSON.parse(ckbs[0].source_meta)
        : ckbs[0].source_meta;
      expect(sourceMeta0.source_index).toBe(1);
    });

    it('should handle empty indexed text', async () => {
      const indexedText = '';
      const docId = 'doc-123';

      await expect(
        generator.generateCKBDescriptions(indexedText, docId, mockLLMClient)
      ).rejects.toThrow('Indexed text and document ID are required');
    });

    it('should handle missing LLM client', async () => {
      const indexedText = '1. Test fact.';
      const docId = 'doc-123';

      await expect(
        generator.generateCKBDescriptions(indexedText, docId, null)
      ).rejects.toThrow('LLM client is required');
    });

    it('should handle LLM call failure', async () => {
      const indexedText = '1. Test fact.';
      const docId = 'doc-123';
      
      mockLLMClient.call.mockRejectedValue(new Error('LLM service unavailable'));

      await expect(
        generator.generateCKBDescriptions(indexedText, docId, mockLLMClient)
      ).rejects.toThrow('LLM service unavailable');
    });

    it('should handle LLM timeout', async () => {
      const indexedText = '1. Test fact.';
      const docId = 'doc-123';
      
      mockLLMClient.call.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 20000))
      );

      await expect(
        generator.generateCKBDescriptions(indexedText, docId, mockLLMClient, { timeout: 1000 })
      ).rejects.toThrow('timeout');
    }, 10000);

    it('should handle invalid JSON response', async () => {
      const indexedText = '1. Test fact.';
      const docId = 'doc-123';
      
      mockLLMClient.call.mockResolvedValue({
        content: 'This is not JSON',
        model: 'qwen-plus'
      });

      await expect(
        generator.generateCKBDescriptions(indexedText, docId, mockLLMClient)
      ).rejects.toThrow('Failed to parse LLM response');
    });

    it('should handle malformed CKB data', async () => {
      const indexedText = '1. Test fact.';
      const docId = 'doc-123';
      
      mockLLMClient.call.mockResolvedValue({
        content: '{"ckbs": [{"invalid": "data"}]}',
        model: 'qwen-plus'
      });

      await expect(
        generator.generateCKBDescriptions(indexedText, docId, mockLLMClient)
      ).rejects.toThrow('missing or invalid');
    });
  });

  describe('validateCKBDescriptions', () => {
    it('should validate correct CKB descriptions', () => {
      const indexedText = `1. First fact.
2. Second fact.
3. Third fact.`;

      const ckbs = [
        {
          doc_id: 'doc-123',
          source_meta: JSON.stringify({ source_index: 1 })
        },
        {
          doc_id: 'doc-123',
          source_meta: JSON.stringify({ source_index: 2 })
        },
        {
          doc_id: 'doc-123',
          source_meta: JSON.stringify({ source_index: 3 })
        }
      ];

      const result = generator.validateCKBDescriptions(ckbs, indexedText);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.ckb_count).toBe(3);
      expect(result.fact_count).toBe(3);
      expect(result.coverage).toBe(1);
    });

    it('should detect CKB count mismatch', () => {
      const indexedText = `1. First fact.
2. Second fact.
3. Third fact.`;

      const ckbs = [
        {
          doc_id: 'doc-123',
          source_meta: JSON.stringify({ source_index: 1 })
        },
        {
          doc_id: 'doc-123',
          source_meta: JSON.stringify({ source_index: 2 })
        }
      ];

      const result = generator.validateCKBDescriptions(ckbs, indexedText);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('does not match'))).toBe(true);
    });

    it('should detect invalid source_index', () => {
      const indexedText = `1. First fact.
2. Second fact.`;

      const ckbs = [
        {
          doc_id: 'doc-123',
          source_meta: JSON.stringify({ source_index: 1 })
        },
        {
          doc_id: 'doc-123',
          source_meta: JSON.stringify({ source_index: 5 })
        }
      ];

      const result = generator.validateCKBDescriptions(ckbs, indexedText);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('invalid source_index'))).toBe(true);
    });

    it('should detect duplicate source_index', () => {
      const indexedText = `1. First fact.
2. Second fact.`;

      const ckbs = [
        {
          doc_id: 'doc-123',
          source_meta: JSON.stringify({ source_index: 1 })
        },
        {
          doc_id: 'doc-123',
          source_meta: JSON.stringify({ source_index: 1 })
        }
      ];

      const result = generator.validateCKBDescriptions(ckbs, indexedText);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('Duplicate source_index'))).toBe(true);
    });

    it('should handle object sourceMeta', () => {
      const indexedText = `1. First fact.`;

      const ckbs = [
        {
          doc_id: 'doc-123',
          source_meta: { source_index: 1 }
        }
      ];

      const result = generator.validateCKBDescriptions(ckbs, indexedText);

      expect(result.valid).toBe(true);
    });
  });

  describe('_parseIndexedText', () => {
    it('should parse numbered list correctly', () => {
      const indexedText = `1. First fact.
2. Second fact.
3. Third fact.`;

      const facts = generator._parseIndexedText(indexedText);

      expect(facts).toHaveLength(3);
      expect(facts[0]).toEqual({ index: 1, text: 'First fact.' });
      expect(facts[1].index).toBe(2);
      expect(facts[2].index).toBe(3);
    });

    it('should handle parenthesis format', () => {
      const indexedText = `1) First fact.
2) Second fact.`;

      const facts = generator._parseIndexedText(indexedText);

      expect(facts).toHaveLength(2);
      expect(facts[0].text).toBe('First fact.');
    });

    it('should handle empty text', () => {
      const facts = generator._parseIndexedText('');

      expect(facts).toHaveLength(0);
    });

    it('should handle text without numbers', () => {
      const indexedText = 'Just plain text without numbers.';

      const facts = generator._parseIndexedText(indexedText);

      expect(facts).toHaveLength(0);
    });
  });

  describe('_parseLLMResponse', () => {
    it('should parse valid JSON response', () => {
      const content = `{
  "ckbs": [
    {
      "ckb_text": "Test fact.",
      "source_index": 1
    }
  ]
}`;

      const data = generator._parseLLMResponse(content);

      expect(data.ckbs).toHaveLength(1);
      expect(data.ckbs[0].ckb_text).toBe('Test fact.');
      expect(data.ckbs[0].source_index).toBe(1);
    });

    it('should extract JSON from mixed content', () => {
      const content = `Here is the result:
{
  "ckbs": [
    {
      "ckb_text": "Test fact.",
      "source_index": 1
    }
  ]
}
End of result.`;

      const data = generator._parseLLMResponse(content);

      expect(data.ckbs).toHaveLength(1);
    });

    it('should throw on invalid JSON', () => {
      const content = 'This is not JSON';

      expect(() => {
        generator._parseLLMResponse(content);
      }).toThrow('No JSON found');
    });

    it('should throw on missing ckbs array', () => {
      const content = '{"invalid": "structure"}';

      expect(() => {
        generator._parseLLMResponse(content);
      }).toThrow('Invalid CKB data structure');
    });

    it('should throw on invalid CKB structure', () => {
      const content = '{"ckbs": [{"invalid": "data"}]}';

      expect(() => {
        generator._parseLLMResponse(content);
      }).toThrow('missing or invalid');
    });
  });
});
