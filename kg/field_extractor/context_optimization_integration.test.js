/**
 * Integration Tests for Context Optimization in Field Extractor
 */

// Mock the dependencies BEFORE requiring the module
jest.mock('../utils/qwen_client');
jest.mock('../utils/token_budget_manager');
jest.mock('../ckb/context_optimizer');

describe('Context Optimization Integration', () => {
  let mockQwenClient;
  let mockContextOptimizer;
  let extractFieldsWithLLM;

  beforeEach(() => {
    // Clear all mocks and module cache
    jest.clearAllMocks();
    jest.resetModules();

    // Set environment variables
    process.env.QWEN_API_KEY = 'test-key';
    process.env.ENABLE_CONTEXT_OPTIMIZATION = 'true';
    process.env.CONTEXT_OPTIMIZER_MAX_TOKENS = '2000';

    // Mock QwenClient
    const { createQwenClient } = require('../utils/qwen_client');
    mockQwenClient = {
      call: jest.fn(),
      parseJSON: jest.fn()
    };
    createQwenClient.mockReturnValue(mockQwenClient);

    // Mock token budget manager
    const tokenBudgetManager = require('../utils/token_budget_manager');
    tokenBudgetManager.recordUsage = jest.fn().mockResolvedValue(undefined);

    // Mock ContextOptimizer
    const { ContextOptimizer } = require('../ckb/context_optimizer');
    mockContextOptimizer = {
      optimizeForFieldExtraction: jest.fn()
    };
    ContextOptimizer.mockImplementation(() => mockContextOptimizer);

    // NOW require the module under test
    const llmExtractor = require('./llm_extractor');
    extractFieldsWithLLM = llmExtractor.extractFieldsWithLLM;
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.ENABLE_CONTEXT_OPTIMIZATION;
    delete process.env.QWEN_API_KEY;
  });

  describe('Context Optimization Enabled', () => {
    test('should use optimized context when optimization succeeds', async () => {
      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'This is a long document with many paragraphs about photography. ISO 100 is mentioned here. Aperture f/2.8 is also discussed.'
        }
      };

      const fieldNames = ['ISO', 'Aperture'];

      // Mock successful optimization
      mockContextOptimizer.optimizeForFieldExtraction.mockResolvedValue({
        optimized: true,
        context: 'ISO 100 is mentioned here. Aperture f/2.8 is also discussed.',
        tokenSavings: 50,
        tokenSavingsPercent: '70.00',
        originalTokenCount: 100,
        tokenCount: 50
      });

      // Mock LLM response
      mockQwenClient.call.mockResolvedValue({
        content: JSON.stringify({
          fields: [
            { name: 'ISO', value: '100', type: 'number' },
            { name: 'Aperture', value: 'f/2.8', type: 'indicator' }
          ]
        }),
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50
      });

      mockQwenClient.parseJSON.mockImplementation((str) => JSON.parse(str));

      const fields = await extractFieldsWithLLM(ckb, [], {
        enableContextOptimization: true,
        fieldNames: fieldNames
      });

      // Verify optimization was called
      expect(mockContextOptimizer.optimizeForFieldExtraction).toHaveBeenCalledWith(
        [ckb],
        fieldNames,
        expect.any(Object)
      );

      // Verify LLM was called with optimized text
      expect(mockQwenClient.call).toHaveBeenCalled();
      const callArgs = mockQwenClient.call.mock.calls[0][0];
      expect(callArgs).toContain('ISO 100');
      expect(callArgs).toContain('Aperture f/2.8');

      // Verify fields were extracted
      expect(fields).toHaveLength(2);
      expect(fields[0].name).toBe('ISO');
      expect(fields[1].name).toBe('Aperture');
    });

    test('should fallback to full text when optimization fails', async () => {
      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'Full document text'
        }
      };

      // Mock failed optimization
      mockContextOptimizer.optimizeForFieldExtraction.mockResolvedValue({
        optimized: false,
        reason: 'too_few_chunks',
        context: 'Full document text',
        chunks: [],
        tokenCount: 100,
        originalTokenCount: 100
      });

      // Mock LLM response
      mockQwenClient.call.mockResolvedValue({
        content: JSON.stringify({ fields: [] }),
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50
      });

      mockQwenClient.parseJSON.mockImplementation((str) => JSON.parse(str));

      const fields = await extractFieldsWithLLM(ckb, [], {
        enableContextOptimization: true,
        fieldNames: ['field1']
      });

      // Verify optimization was attempted
      expect(mockContextOptimizer.optimizeForFieldExtraction).toHaveBeenCalled();

      // Verify LLM was still called with full text
      expect(mockQwenClient.call).toHaveBeenCalled();
    });

    test('should handle optimization errors gracefully', async () => {
      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'Document text'
        }
      };

      // Mock optimization error
      mockContextOptimizer.optimizeForFieldExtraction.mockRejectedValue(
        new Error('Optimization failed')
      );

      // Mock LLM response
      mockQwenClient.call.mockResolvedValue({
        content: JSON.stringify({ fields: [] }),
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50
      });

      mockQwenClient.parseJSON.mockImplementation((str) => JSON.parse(str));

      const fields = await extractFieldsWithLLM(ckb, [], {
        enableContextOptimization: true,
        fieldNames: ['field1']
      });

      // Verify LLM was still called (fallback to full text)
      expect(mockQwenClient.call).toHaveBeenCalled();
      expect(fields).toBeDefined();
    });
  });

  describe('Context Optimization Disabled', () => {
    test('should not use optimization when disabled', async () => {
      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'Document text'
        }
      };

      // Mock LLM response
      mockQwenClient.call.mockResolvedValue({
        content: JSON.stringify({ fields: [] }),
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50
      });

      mockQwenClient.parseJSON.mockImplementation((str) => JSON.parse(str));

      const fields = await extractFieldsWithLLM(ckb, [], {
        enableContextOptimization: false,
        fieldNames: ['field1']
      });

      // Verify optimization was NOT called
      expect(mockContextOptimizer.optimizeForFieldExtraction).not.toHaveBeenCalled();

      // Verify LLM was called with full text
      expect(mockQwenClient.call).toHaveBeenCalled();
    });

    test('should not use optimization when no field names provided', async () => {
      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'Document text'
        }
      };

      // Mock LLM response
      mockQwenClient.call.mockResolvedValue({
        content: JSON.stringify({ fields: [] }),
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50
      });

      mockQwenClient.parseJSON.mockImplementation((str) => JSON.parse(str));

      const fields = await extractFieldsWithLLM(ckb, [], {
        enableContextOptimization: true,
        fieldNames: []  // Empty field names
      });

      // Verify optimization was NOT called
      expect(mockContextOptimizer.optimizeForFieldExtraction).not.toHaveBeenCalled();
    });
  });

  describe('Token Metrics Recording', () => {
    test('should record optimization metrics in token usage', async () => {
      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'Document text'
        }
      };

      // Mock successful optimization
      mockContextOptimizer.optimizeForFieldExtraction.mockResolvedValue({
        optimized: true,
        context: 'Optimized text',
        tokenSavings: 50,
        tokenSavingsPercent: '50.00',
        originalTokenCount: 100,
        tokenCount: 50
      });

      // Mock LLM response
      mockQwenClient.call.mockResolvedValue({
        content: JSON.stringify({ fields: [] }),
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50
      });

      mockQwenClient.parseJSON.mockImplementation((str) => JSON.parse(str));

      const tokenBudgetManager = require('../utils/token_budget_manager');
      
      await extractFieldsWithLLM(ckb, [], {
        enableContextOptimization: true,
        fieldNames: ['field1']
      });

      // Verify token usage was recorded with optimization metrics
      expect(tokenBudgetManager.recordUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          contextOptimization: {
            tokenSavings: 50,
            tokenSavingsPercent: '50.00',
            originalTokenCount: 100,
            optimizedTokenCount: 50
          }
        })
      );
    });
  });
});
