/**
 * Unit tests for ExtractionCoordinator
 */

const ExtractionCoordinator = require('./extraction_coordinator');
const { PROCESSING_STATUS } = require('./constants');

describe('ExtractionCoordinator', () => {
  let coordinator;
  let mockAlgorithmExtractor;
  let mockLLMExtractor;
  let mockResultFusion;
  let mockConflictResolver;
  let mockQualityValidator;
  let mockErrorHandler;
  let mockConfig;

  beforeEach(() => {
    // Mock algorithm extractor
    mockAlgorithmExtractor = {
      extract: jest.fn().mockResolvedValue({
        entities: [{ name: 'param1', type: 'numerical_parameter', source: 'algorithm' }],
        relations: [],
        metadata: { extractionTime: 100 }
      })
    };

    // Mock LLM extractor
    mockLLMExtractor = {
      extract: jest.fn().mockResolvedValue({
        entities: [{ name: 'concept1', type: 'concept', source: 'llm' }],
        relations: [{ type: 'suitable_for', source: 'entity1', target: 'entity2' }],
        metadata: { extractionTime: 2000, tokensUsed: 500 }
      })
    };

    // Mock result fusion
    mockResultFusion = {
      fuse: jest.fn().mockImplementation((algoResult, llmResult) => ({
        entities: [...algoResult.entities, ...llmResult.entities],
        relations: llmResult.relations,
        metadata: {
          ...algoResult.metadata,
          ...llmResult.metadata
        }
      }))
    };

    // Mock conflict resolver
    mockConflictResolver = {
      resolve: jest.fn()
    };

    // Mock quality validator
    mockQualityValidator = {
      validate: jest.fn().mockReturnValue({
        isValid: true,
        warnings: []
      }),
      calculateMetrics: jest.fn().mockReturnValue({
        entityCompleteness: 0.9,
        relationCompleteness: 0.8,
        averageConfidence: 0.85,
        fieldCompleteness: 0.95
      })
    };

    // Mock error handler
    mockErrorHandler = {
      logError: jest.fn(),
      getMetrics: jest.fn().mockReturnValue({ total: 0 }),
      resetMetrics: jest.fn()
    };

    // Mock config
    mockConfig = {
      llm: { enabled: true },
      algorithm: { enabled: true },
      performance: { maxProcessingTime: 5000 },
      language: { default: 'zh' },
      fusion: { conflictStrategy: 'prefer_algorithm' }
    };

    coordinator = new ExtractionCoordinator({
      algorithmExtractor: mockAlgorithmExtractor,
      llmExtractor: mockLLMExtractor,
      resultFusion: mockResultFusion,
      conflictResolver: mockConflictResolver,
      qualityValidator: mockQualityValidator,
      errorHandler: mockErrorHandler,
      config: mockConfig
    });
  });

  describe('Configuration', () => {
    test('should initialize with default configuration', () => {
      // Provide all mocked components to avoid initialization issues
      const coord = new ExtractionCoordinator({
        algorithmExtractor: mockAlgorithmExtractor,
        llmExtractor: mockLLMExtractor,
        resultFusion: mockResultFusion,
        conflictResolver: mockConflictResolver,
        qualityValidator: mockQualityValidator,
        errorHandler: mockErrorHandler,
        config: mockConfig
      });
      
      expect(coord.enableLLM).toBeDefined();
      expect(coord.enableAlgorithm).toBeDefined();
    });

    test('should allow configuration updates', () => {
      coordinator.configure({
        enableLLM: false,
        enableAlgorithm: true,
        timeout: 3000,
        language: 'en'
      });

      expect(coordinator.enableLLM).toBe(false);
      expect(coordinator.enableAlgorithm).toBe(true);
      expect(coordinator.timeout).toBe(3000);
      expect(coordinator.language).toBe('en');
    });

    test('should preserve unspecified configuration', () => {
      const originalTimeout = coordinator.timeout;
      coordinator.configure({ enableLLM: false });
      
      expect(coordinator.enableLLM).toBe(false);
      expect(coordinator.timeout).toBe(originalTimeout);
    });
  });

  describe('Input Validation', () => {
    test('should reject null document text', async () => {
      await expect(coordinator.extract(null)).rejects.toThrow('Invalid input');
    });

    test('should reject undefined document text', async () => {
      await expect(coordinator.extract(undefined)).rejects.toThrow('Invalid input');
    });

    test('should reject non-string document text', async () => {
      await expect(coordinator.extract(123)).rejects.toThrow('Invalid input');
    });

    test('should reject empty document text', async () => {
      await expect(coordinator.extract('')).rejects.toThrow('Invalid input');
    });

    test('should reject whitespace-only document text', async () => {
      await expect(coordinator.extract('   ')).rejects.toThrow('Invalid input');
    });
  });

  describe('Complete Extraction Flow', () => {
    test('should execute full extraction with both extractors', async () => {
      const result = await coordinator.extract('Test document');

      expect(mockAlgorithmExtractor.extract).toHaveBeenCalledWith('Test document');
      expect(mockLLMExtractor.extract).toHaveBeenCalled();
      expect(mockResultFusion.fuse).toHaveBeenCalled();
      expect(mockQualityValidator.validate).toHaveBeenCalled();
      expect(mockQualityValidator.calculateMetrics).toHaveBeenCalled();
      
      expect(result.entities).toHaveLength(2);
      expect(result.metadata.status).toBe(PROCESSING_STATUS.SUCCESS);
    });

    test('should include processing time in metadata', async () => {
      // Add small delay to ensure time passes
      mockAlgorithmExtractor.extract.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({
          entities: [{ name: 'param1', type: 'numerical_parameter', source: 'algorithm' }],
          relations: [],
          metadata: { extractionTime: 100 }
        }), 10))
      );

      const result = await coordinator.extract('Test document');

      expect(result.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.algorithmTime).toBeGreaterThanOrEqual(0);
      expect(result.metadata.llmTime).toBeGreaterThanOrEqual(0);
    });

    test('should include quality metrics', async () => {
      const result = await coordinator.extract('Test document');

      expect(result.quality).toBeDefined();
      expect(result.quality.entityCompleteness).toBe(0.9);
      expect(result.quality.relationCompleteness).toBe(0.8);
    });

    test('should include validation report', async () => {
      const result = await coordinator.extract('Test document');

      expect(result.validation).toBeDefined();
      expect(result.validation.isValid).toBe(true);
    });

    test('should pass document ID to result', async () => {
      const result = await coordinator.extract('Test document', { documentId: 'doc123' });

      expect(result.metadata.documentId).toBe('doc123');
    });

    test('should use specified language', async () => {
      const result = await coordinator.extract('Test document', { language: 'en' });

      expect(result.metadata.language).toBe('en');
    });
  });

  describe('LLM Disabled Scenario', () => {
    test('should work with only algorithm extraction', async () => {
      coordinator.configure({ enableLLM: false });

      const result = await coordinator.extract('Test document');

      expect(mockAlgorithmExtractor.extract).toHaveBeenCalled();
      expect(mockLLMExtractor.extract).not.toHaveBeenCalled();
      expect(mockResultFusion.fuse).not.toHaveBeenCalled();
      
      expect(result.entities).toHaveLength(1);
      expect(result.metadata.status).toBe(PROCESSING_STATUS.PARTIAL_SUCCESS);
    });

    test('should fail if algorithm fails when LLM disabled', async () => {
      coordinator.configure({ enableLLM: false });
      mockAlgorithmExtractor.extract.mockRejectedValue(new Error('Algorithm failed'));

      const result = await coordinator.extract('Test document');

      expect(result.metadata.status).toBe(PROCESSING_STATUS.FAILED);
      expect(result.entities).toHaveLength(0);
    });
  });

  describe('Algorithm Disabled Scenario', () => {
    test('should work with only LLM extraction', async () => {
      coordinator.configure({ enableAlgorithm: false });

      const result = await coordinator.extract('Test document');

      expect(mockAlgorithmExtractor.extract).not.toHaveBeenCalled();
      expect(mockLLMExtractor.extract).toHaveBeenCalled();
      expect(mockResultFusion.fuse).not.toHaveBeenCalled();
      
      expect(result.entities).toHaveLength(1);
      expect(result.metadata.status).toBe(PROCESSING_STATUS.PARTIAL_SUCCESS);
    });

    test('should fail if LLM fails when algorithm disabled', async () => {
      coordinator.configure({ enableAlgorithm: false });
      mockLLMExtractor.extract.mockRejectedValue(new Error('LLM failed'));

      const result = await coordinator.extract('Test document');

      expect(result.metadata.status).toBe(PROCESSING_STATUS.FAILED);
      expect(result.entities).toHaveLength(0);
    });
  });

  describe('Error Handling and Degradation', () => {
    test('should degrade gracefully when LLM fails', async () => {
      mockLLMExtractor.extract.mockRejectedValue(new Error('LLM timeout'));

      const result = await coordinator.extract('Test document');

      expect(mockErrorHandler.logError).toHaveBeenCalled();
      expect(result.metadata.status).toBe(PROCESSING_STATUS.PARTIAL_SUCCESS);
      expect(result.entities).toHaveLength(1); // Only algorithm results
      expect(result.metadata.errors).toBeDefined();
    });

    test('should degrade gracefully when algorithm fails', async () => {
      mockAlgorithmExtractor.extract.mockRejectedValue(new Error('Algorithm error'));

      const result = await coordinator.extract('Test document');

      expect(mockErrorHandler.logError).toHaveBeenCalled();
      expect(result.metadata.status).toBe(PROCESSING_STATUS.PARTIAL_SUCCESS);
      expect(result.entities).toHaveLength(1); // Only LLM results
    });

    test('should fail completely when both extractors fail', async () => {
      mockAlgorithmExtractor.extract.mockRejectedValue(new Error('Algorithm failed'));
      mockLLMExtractor.extract.mockRejectedValue(new Error('LLM failed'));

      const result = await coordinator.extract('Test document');

      expect(result.metadata.status).toBe(PROCESSING_STATUS.FAILED);
      expect(result.entities).toHaveLength(0);
      expect(result.quality.warnings).toContain('Extraction failed completely');
    });

    test('should log errors during extraction', async () => {
      mockLLMExtractor.extract.mockRejectedValue(new Error('Test error'));

      await coordinator.extract('Test document');

      expect(mockErrorHandler.logError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ phase: 'llm_extraction' })
      );
    });
  });

  describe('Timeout Handling', () => {
    test('should timeout algorithm extraction', async () => {
      mockAlgorithmExtractor.extract.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      const result = await coordinator.extract('Test document', { timeout: 100 });

      expect(result.metadata.status).toBe(PROCESSING_STATUS.PARTIAL_SUCCESS);
    });

    test('should timeout LLM extraction', async () => {
      mockLLMExtractor.extract.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000))
      );

      const result = await coordinator.extract('Test document', { timeout: 100 });

      expect(result.metadata.status).toBe(PROCESSING_STATUS.PARTIAL_SUCCESS);
    });
  });

  describe('Options Override', () => {
    test('should override enableLLM from options', async () => {
      coordinator.configure({ enableLLM: true });

      await coordinator.extract('Test document', { enableLLM: false });

      expect(mockLLMExtractor.extract).not.toHaveBeenCalled();
    });

    test('should override enableAlgorithm from options', async () => {
      coordinator.configure({ enableAlgorithm: true });

      await coordinator.extract('Test document', { enableAlgorithm: false });

      expect(mockAlgorithmExtractor.extract).not.toHaveBeenCalled();
    });

    test('should override timeout from options', async () => {
      coordinator.configure({ timeout: 5000 });

      // This test just verifies the option is accepted
      await coordinator.extract('Test document', { timeout: 1000 });

      expect(mockAlgorithmExtractor.extract).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    test('should return statistics', () => {
      const stats = coordinator.getStatistics();

      expect(stats).toHaveProperty('errorMetrics');
      expect(stats).toHaveProperty('config');
      expect(stats.config.enableLLM).toBe(true);
      expect(stats.config.enableAlgorithm).toBe(true);
    });

    test('should reset statistics', () => {
      coordinator.resetStatistics();

      expect(mockErrorHandler.resetMetrics).toHaveBeenCalled();
    });
  });

  describe('Context Passing', () => {
    test('should pass algorithm result as context to LLM', async () => {
      await coordinator.extract('Test document');

      expect(mockLLMExtractor.extract).toHaveBeenCalledWith(
        'Test document',
        expect.objectContaining({
          algorithmResult: expect.any(Object)
        })
      );
    });

    test('should not pass context when algorithm is disabled', async () => {
      coordinator.configure({ enableAlgorithm: false });

      await coordinator.extract('Test document');

      expect(mockLLMExtractor.extract).toHaveBeenCalledWith(
        'Test document',
        {}
      );
    });
  });
});
