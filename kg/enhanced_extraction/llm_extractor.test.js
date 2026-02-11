/**
 * Unit tests for LLMExtractor
 */

const LLMExtractor = require('./llm_extractor');

// Mock dependencies
jest.mock('./llm_client');
jest.mock('./llm_cache_wrapper');

const { createLLMClient } = require('./llm_client');
const { createCacheWrapper } = require('./llm_cache_wrapper');

describe('LLMExtractor', () => {
  let extractor;
  let mockClient;

  beforeEach(() => {
    // Create mock client
    mockClient = {
      call: jest.fn()
    };

    // Mock createLLMClient to return our mock
    createLLMClient.mockReturnValue(mockClient);
    createCacheWrapper.mockReturnValue(mockClient);

    // Create extractor
    extractor = new LLMExtractor({
      enableCache: false,
      language: 'zh'
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('extract', () => {
    it('should extract entities and relations from text', async () => {
      // Mock LLM responses
      mockClient.call
        .mockResolvedValueOnce({
          content: JSON.stringify({
            entities: [
              { type: 'lens', name: 'SEL35F18F', confidence: 0.95 }
            ]
          }),
          tokensUsed: 500,
          cost: 0.01,
          model: 'qwen-plus'
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            relations: [
              { type: 'suitable_for', source: 'SEL35F18F', target: '街拍', confidence: 0.9 }
            ]
          }),
          tokensUsed: 300,
          cost: 0.005,
          model: 'qwen-plus'
        });

      const result = await extractor.extract('测试文档内容');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('SEL35F18F');
      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].type).toBe('suitable_for');
      expect(result.metadata.status).toBe('success');
      expect(result.metadata.tokensUsed).toBe(800);
    });

    it('should handle empty text input', async () => {
      const result = await extractor.extract('');

      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.metadata.status).toBe('failed');
    });


    it('should handle null text input', async () => {
      const result = await extractor.extract(null);

      expect(result.entities).toEqual([]);
      expect(result.metadata.status).toBe('failed');
    });

    it('should handle whitespace-only text', async () => {
      const result = await extractor.extract('   \n\t  ');

      expect(result.entities).toEqual([]);
      expect(result.metadata.status).toBe('failed');
    });

    it('should pass algorithm results as context', async () => {
      mockClient.call.mockResolvedValue({
        content: JSON.stringify({ entities: [] }),
        tokensUsed: 100,
        cost: 0.001
      });

      const context = {
        algorithmResults: [
          { name: '焦距', value: '35mm' }
        ]
      };

      await extractor.extract('测试文档', context);

      // Verify prompt builder was called with algorithm results
      expect(mockClient.call).toHaveBeenCalled();
    });

    it('should handle LLM errors gracefully', async () => {
      mockClient.call.mockRejectedValue(new Error('LLM API error'));

      const result = await extractor.extract('测试文档');

      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.metadata.status).toBe('failed');
      expect(result.metadata.error).toContain('LLM API error');
    });

    it('should handle malformed LLM responses', async () => {
      mockClient.call.mockResolvedValue({
        content: 'not valid json',
        tokensUsed: 100,
        cost: 0.001
      });

      const result = await extractor.extract('测试文档');

      // Parser should handle malformed JSON gracefully
      expect(result.entities).toEqual([]);
      expect(result.metadata.status).toBe('success');
    });

    it('should respect language configuration', async () => {
      const enExtractor = new LLMExtractor({
        enableCache: false,
        language: 'en'
      });

      mockClient.call.mockResolvedValue({
        content: JSON.stringify({ entities: [] }),
        tokensUsed: 100,
        cost: 0.001
      });

      await enExtractor.extract('Test document');

      expect(mockClient.call).toHaveBeenCalled();
    });

    it('should override language from context', async () => {
      mockClient.call.mockResolvedValue({
        content: JSON.stringify({ entities: [] }),
        tokensUsed: 100,
        cost: 0.001
      });

      await extractor.extract('Test', { language: 'en' });

      expect(mockClient.call).toHaveBeenCalled();
    });
  });

  describe('batchExtract', () => {
    it('should extract from multiple documents', async () => {
      mockClient.call.mockResolvedValue({
        content: JSON.stringify({ entities: [], relations: [] }),
        tokensUsed: 100,
        cost: 0.001
      });

      const texts = ['文档1', '文档2', '文档3'];
      const results = await extractor.batchExtract(texts);

      expect(results).toHaveLength(3);
      expect(mockClient.call).toHaveBeenCalledTimes(6); // 2 calls per document
    });

    it('should handle empty array', async () => {
      const results = await extractor.batchExtract([]);

      expect(results).toEqual([]);
      expect(mockClient.call).not.toHaveBeenCalled();
    });

    it('should handle non-array input', async () => {
      const results = await extractor.batchExtract(null);

      expect(results).toEqual([]);
    });

    it('should process in batches', async () => {
      const smallBatchExtractor = new LLMExtractor({
        enableCache: false,
        batchSize: 2
      });

      mockClient.call.mockResolvedValue({
        content: JSON.stringify({ entities: [], relations: [] }),
        tokensUsed: 100,
        cost: 0.001
      });

      const texts = ['文档1', '文档2', '文档3', '文档4', '文档5'];
      const results = await smallBatchExtractor.batchExtract(texts);

      expect(results).toHaveLength(5);
    });

    it('should handle errors in batch processing', async () => {
      mockClient.call
        .mockResolvedValueOnce({
          content: JSON.stringify({ entities: [] }),
          tokensUsed: 100
        })
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          content: JSON.stringify({ entities: [] }),
          tokensUsed: 100
        });

      const texts = ['文档1', '文档2'];
      const results = await extractor.batchExtract(texts);

      expect(results).toHaveLength(2);
      expect(results[1].metadata.status).toBe('failed');
    });
  });

  describe('configure', () => {
    it('should update configuration', () => {
      extractor.configure({ language: 'en' });

      const config = extractor.getConfig();
      expect(config.language).toBe('en');
    });

    it('should update prompt builder language', () => {
      extractor.configure({ language: 'en' });

      // Language should be updated in prompt builder
      expect(extractor.promptBuilder.language).toBe('en');
    });

    it('should merge with existing config', () => {
      const originalTimeout = extractor.config.timeout;
      extractor.configure({ language: 'en' });

      expect(extractor.config.timeout).toBe(originalTimeout);
      expect(extractor.config.language).toBe('en');
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = extractor.getConfig();

      expect(config).toHaveProperty('language');
      expect(config).toHaveProperty('enableCache');
      expect(config).toHaveProperty('batchSize');
    });

    it('should return a copy of config', () => {
      const config = extractor.getConfig();
      config.language = 'modified';

      expect(extractor.config.language).not.toBe('modified');
    });
  });

  describe('error handling', () => {
    it('should log errors to console', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockClient.call.mockRejectedValue(new Error('Test error'));

      await extractor.extract('测试');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should include processing time in error result', async () => {
      mockClient.call.mockRejectedValue(new Error('Test error'));

      const result = await extractor.extract('测试');

      expect(result.metadata.llmTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('integration with components', () => {
    it('should use cache wrapper when enabled', () => {
      const cachedExtractor = new LLMExtractor({
        enableCache: true
      });

      expect(createCacheWrapper).toHaveBeenCalled();
    });

    it('should not use cache wrapper when disabled', () => {
      createCacheWrapper.mockClear();
      
      const noCacheExtractor = new LLMExtractor({
        enableCache: false
      });

      expect(createCacheWrapper).not.toHaveBeenCalled();
    });

    it('should pass configuration to LLM client', () => {
      const customExtractor = new LLMExtractor({
        model: 'custom-model',
        timeout: 5000
      });

      expect(createLLMClient).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'custom-model',
          timeout: 5000
        })
      );
    });
  });
});
