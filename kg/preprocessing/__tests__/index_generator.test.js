/**
 * Unit tests for IndexGenerator
 * 
 * Tests normal document processing, edge cases, and error handling
 */

const { IndexGenerator } = require('../index_generator');

describe('IndexGenerator', () => {
  let generator;
  let mockLLMClient;

  beforeEach(() => {
    generator = new IndexGenerator();
    
    // Mock LLM client
    mockLLMClient = {
      call: jest.fn()
    };
  });

  describe('generateIndexedText', () => {
    it('should generate indexed text for normal document', async () => {
      const docId = 'doc-123';
      const text = '2025年1月，阿里C区地下水位监测显示水位为45.2米。该区域位于海南省海口市美兰区。';
      
      mockLLMClient.call.mockResolvedValue({
        content: `【索引叙述文本】
1. 2025年1月，阿里C区地下水位监测显示水位为45.2米。
2. 阿里C区位于海南省海口市美兰区。`,
        tokens: 150,
        input_tokens: 100,
        output_tokens: 50,
        model: 'qwen-plus'
      });

      const result = await generator.generateIndexedText(docId, text, mockLLMClient);

      expect(result).toHaveProperty('id');
      expect(result.doc_id).toBe(docId);
      expect(result.indexed_text).toContain('1. 2025年1月');
      expect(result.indexed_text).toContain('2. 阿里C区位于');
      expect(result.metadata.fact_count).toBe(2);
      expect(result.metadata.token_count).toBe(150);
      expect(result.version).toBe(1);
    });

    it('should handle empty document', async () => {
      const docId = 'doc-empty';
      const text = '';

      await expect(
        generator.generateIndexedText(docId, text, mockLLMClient)
      ).rejects.toThrow('Document ID and text are required');
    });

    it('should handle missing LLM client', async () => {
      const docId = 'doc-123';
      const text = 'Some text';

      await expect(
        generator.generateIndexedText(docId, text, null)
      ).rejects.toThrow('LLM client is required');
    });

    it('should handle LLM call failure', async () => {
      const docId = 'doc-123';
      const text = 'Some text';
      
      mockLLMClient.call.mockRejectedValue(new Error('LLM service unavailable'));

      await expect(
        generator.generateIndexedText(docId, text, mockLLMClient)
      ).rejects.toThrow('LLM service unavailable');
    });

    it('should handle LLM timeout', async () => {
      const docId = 'doc-123';
      const text = 'Some text';
      
      mockLLMClient.call.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 35000))
      );

      await expect(
        generator.generateIndexedText(docId, text, mockLLMClient, { timeout: 1000 })
      ).rejects.toThrow('timeout');
    }, 10000);

    it('should handle very long document', async () => {
      const docId = 'doc-long';
      const text = 'A'.repeat(10000);
      
      mockLLMClient.call.mockResolvedValue({
        content: `【索引叙述文本】
1. 长文档内容摘要。`,
        tokens: 200,
        model: 'qwen-plus'
      });

      const result = await generator.generateIndexedText(docId, text, mockLLMClient);

      expect(result).toHaveProperty('id');
      expect(result.metadata.fact_count).toBeGreaterThan(0);
    });
  });

  describe('validateIndexedText', () => {
    it('should validate correct indexed text', () => {
      const indexedText = `1. 2025年1月，阿里C区地下水位监测显示水位为45.2米。
2. 阿里C区位于海南省海口市美兰区。
3. 该监测点编号为ALI-C-001。`;

      const result = generator.validateIndexedText(indexedText);

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.fact_count).toBe(3);
    });

    it('should detect empty text', () => {
      const result = generator.validateIndexedText('');

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Indexed text is empty');
    });

    it('should detect missing numbered list format', () => {
      const indexedText = 'This is just plain text without numbers.';

      const result = generator.validateIndexedText(indexedText);

      expect(result.valid).toBe(false);
      expect(result.issues).toContain('Indexed text does not contain numbered list format');
    });

    it('should detect overly long facts', () => {
      const longFact = 'A'.repeat(250);
      const indexedText = `1. ${longFact}`;

      const result = generator.validateIndexedText(indexedText);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('exceed 200 characters'))).toBe(true);
    });

    it('should detect excessive vague references', () => {
      const indexedText = `1. 这个地方很好。
2. 该区域有这些特点。
3. 其中包含这些内容。
4. 该系统使用这种方法。`;

      const result = generator.validateIndexedText(indexedText);

      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.includes('vague references'))).toBe(true);
    });
  });

  describe('parseIndexedText', () => {
    it('should parse numbered list correctly', () => {
      const indexedText = `1. First fact.
2. Second fact.
3. Third fact.`;

      const facts = generator.parseIndexedText(indexedText);

      expect(facts).toHaveLength(3);
      expect(facts[0]).toEqual({
        index: 1,
        text: 'First fact.',
        length: 11
      });
      expect(facts[1].index).toBe(2);
      expect(facts[2].index).toBe(3);
    });

    it('should handle parenthesis format', () => {
      const indexedText = `1) First fact.
2) Second fact.`;

      const facts = generator.parseIndexedText(indexedText);

      expect(facts).toHaveLength(2);
      expect(facts[0].text).toBe('First fact.');
    });

    it('should handle empty text', () => {
      const facts = generator.parseIndexedText('');

      expect(facts).toHaveLength(0);
    });

    it('should handle text without numbers', () => {
      const indexedText = 'Just plain text without numbers.';

      const facts = generator.parseIndexedText(indexedText);

      expect(facts).toHaveLength(0);
    });

    it('should handle mixed content', () => {
      const indexedText = `Some header text
1. First fact.
Some middle text
2. Second fact.
Some footer text`;

      const facts = generator.parseIndexedText(indexedText);

      expect(facts).toHaveLength(2);
      expect(facts[0].text).toBe('First fact.');
      expect(facts[1].text).toBe('Second fact.');
    });
  });

  describe('extractKeyEntities', () => {
    it('should extract time entities', () => {
      const indexedText = `1. 2025年1月，水位为45.2米。
2. 2024年12月同期水位为55.8米。`;

      const entities = generator.extractKeyEntities(indexedText);

      const timeEntities = entities.filter(e => e.type === 'time');
      expect(timeEntities.length).toBeGreaterThan(0);
      expect(timeEntities[0].value).toContain('2025年1月');
    });

    it('should extract location entities', () => {
      const indexedText = `1. 阿里C区位于海南省海口市美兰区。`;

      const entities = generator.extractKeyEntities(indexedText);

      const locationEntities = entities.filter(e => e.type === 'location');
      expect(locationEntities.length).toBeGreaterThan(0);
    });

    it('should extract number entities', () => {
      const indexedText = `1. 水位为45.2米，下降了10.6米。`;

      const entities = generator.extractKeyEntities(indexedText);

      const numberEntities = entities.filter(e => e.type === 'number');
      expect(numberEntities.length).toBeGreaterThan(0);
    });

    it('should extract organization entities', () => {
      const indexedText = `1. 由海南省水文局负责管理。`;

      const entities = generator.extractKeyEntities(indexedText);

      const orgEntities = entities.filter(e => e.type === 'organization');
      expect(orgEntities.length).toBeGreaterThan(0);
    });

    it('should handle text without entities', () => {
      const indexedText = `1. 这是一个简单的事实。`;

      const entities = generator.extractKeyEntities(indexedText);

      expect(entities).toHaveLength(0);
    });
  });

  describe('extractKeyRelations', () => {
    it('should extract located_in relations', () => {
      const indexedText = `1. 阿里C区位于海南省海口市美兰区。`;

      const relations = generator.extractKeyRelations(indexedText);

      const locatedIn = relations.filter(r => r.type === 'located_in');
      expect(locatedIn.length).toBeGreaterThan(0);
      expect(locatedIn[0].subject).toContain('阿里C区');
    });

    it('should extract managed_by relations', () => {
      const indexedText = `1. 该监测点由海南省水文局负责管理。`;

      const relations = generator.extractKeyRelations(indexedText);

      const managedBy = relations.filter(r => r.type === 'managed_by');
      expect(managedBy.length).toBeGreaterThan(0);
    });

    it('should extract causes relations', () => {
      const indexedText = `1. 降雨量减少导致水位下降。`;

      const relations = generator.extractKeyRelations(indexedText);

      const causes = relations.filter(r => r.type === 'causes');
      expect(causes.length).toBeGreaterThan(0);
    });

    it('should handle text without relations', () => {
      const indexedText = `1. 这是一个简单的事实。`;

      const relations = generator.extractKeyRelations(indexedText);

      expect(relations).toHaveLength(0);
    });
  });
});
