/**
 * Integration Tests for Entity Name Standardization in Entity Builder
 */

// Mock dependencies BEFORE requiring the module
jest.mock('../utils/performance_monitor');
jest.mock('../utils/token_budget_manager');
jest.mock('../utils/qwen_client');
jest.mock('../human_readable/entity_name_standardizer');

describe('Entity Name Standardization Integration', () => {
  let mockStandardizer;
  let generateCanonicalName;

  beforeEach(() => {
    // Clear all mocks and module cache
    jest.clearAllMocks();
    jest.resetModules();

    // Set environment variable
    process.env.ENABLE_ENTITY_NAME_STANDARDIZATION = 'true';

    // Mock EntityNameStandardizer
    const { EntityNameStandardizer } = require('../human_readable/entity_name_standardizer');
    mockStandardizer = {
      standardizeName: jest.fn()
    };
    EntityNameStandardizer.mockImplementation(() => mockStandardizer);

    // Mock performance monitor
    const performanceMonitor = require('../utils/performance_monitor');
    performanceMonitor.recordOperation = jest.fn();
    performanceMonitor.recordLLMCall = jest.fn();
    performanceMonitor.recordError = jest.fn();

    // NOW require the module under test
    const entityBuilder = require('./entity_builder');
    generateCanonicalName = entityBuilder.generateCanonicalName;
  });

  afterEach(() => {
    delete process.env.ENABLE_ENTITY_NAME_STANDARDIZATION;
    delete process.env.QWEN_API_KEY;
  });

  describe('Standardization Enabled', () => {
    test('should apply name standardization when enabled', async () => {
      const fields = {
        'ISO': '100',
        'Aperture': 'f/2.8',
        'ShutterSpeed': '1/250'
      };

      const schema = {
        schema_name: 'Photography Settings',
        entity_type: 'PhotographyEntity',
        core_fields: [
          { name: 'ISO', weight: 0.8 },
          { name: 'Aperture', weight: 0.7 }
        ]
      };

      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'Camera settings: ISO 100, Aperture f/2.8, Shutter Speed 1/250'
        }
      };

      // Mock standardizer response
      mockStandardizer.standardizeName.mockReturnValue({
        name: 'ISO_100_Aperture_f2.8',
        confidence: 0.95,
        method: 'algorithm'
      });

      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: false,
        enableStandardization: true
      });

      // Verify standardizer was called
      expect(mockStandardizer.standardizeName).toHaveBeenCalledWith(
        expect.any(String),
        ckb.content.text,
        expect.objectContaining({
          entityType: 'PhotographyEntity',
          fields: fields
        })
      );

      // Verify standardized name is used
      expect(result.canonical_name).toBe('ISO_100_Aperture_f2.8');
      expect(result.standardized).toBe(true);
      expect(result.original_name).toBeDefined();
    });

    test('should preserve original name in metadata', async () => {
      const fields = {
        'Location': 'Paris',
        'Time': '2025-01'
      };

      const schema = {
        schema_name: 'Travel Event',
        entity_type: 'TravelEntity',
        core_fields: [
          { name: 'Location', weight: 0.9 }
        ]
      };

      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'Visited Paris in January 2025'
        }
      };

      // Mock standardizer response
      mockStandardizer.standardizeName.mockReturnValue({
        name: 'Paris_Travel_2025-01',
        confidence: 0.9,
        method: 'algorithm'
      });

      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: false,
        enableStandardization: true
      });

      expect(result.original_name).toBe('Paris_2025-01');
      expect(result.canonical_name).toBe('Paris_Travel_2025-01');
      expect(result.standardized).toBe(true);
    });

    test('should handle standardization errors gracefully', async () => {
      const fields = {
        'Entity': 'Test'
      };

      const schema = {
        schema_name: 'Test Schema',
        entity_type: 'GeneralEntity',
        core_fields: [
          { name: 'Entity', weight: 1.0 }
        ]
      };

      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'Test content'
        }
      };

      // Mock standardizer error
      mockStandardizer.standardizeName.mockImplementation(() => {
        throw new Error('Standardization failed');
      });

      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: false,
        enableStandardization: true
      });

      // Should fall back to original name
      expect(result.canonical_name).toBe('Test');
      expect(result.standardized).toBe(true);
    });

    test('should record standardization metrics', async () => {
      const fields = {
        'Camera': 'Sony A7III'
      };

      const schema = {
        schema_name: 'Camera',
        entity_type: 'PhotographyEntity',
        core_fields: [
          { name: 'Camera', weight: 1.0 }
        ]
      };

      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'Using Sony A7III camera'
        }
      };

      // Mock standardizer response
      mockStandardizer.standardizeName.mockReturnValue({
        name: 'Sony_A7III_Camera',
        confidence: 0.95,
        method: 'algorithm'
      });

      const performanceMonitor = require('../utils/performance_monitor');

      await generateCanonicalName(fields, schema, ckb, {
        useLLM: false,
        enableStandardization: true
      });

      // Verify metrics were recorded
      expect(performanceMonitor.recordOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          module: 'entity_builder',
          operation: 'name_standardization',
          success: true,
          metadata: expect.objectContaining({
            original_name: 'Sony A7III',
            standardized_name: 'Sony_A7III_Camera',
            confidence: 0.95,
            method: 'algorithm'
          })
        })
      );
    });
  });

  describe('Standardization Disabled', () => {
    test('should not apply standardization when disabled', async () => {
      const fields = {
        'Entity': 'Test'
      };

      const schema = {
        schema_name: 'Test Schema',
        entity_type: 'GeneralEntity',
        core_fields: [
          { name: 'Entity', weight: 1.0 }
        ]
      };

      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'Test content'
        }
      };

      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: false,
        enableStandardization: false
      });

      // Verify standardizer was NOT called
      expect(mockStandardizer.standardizeName).not.toHaveBeenCalled();

      // Verify original name is used
      expect(result.canonical_name).toBe('Test');
      expect(result.standardized).toBe(false);
    });

    test('should use environment variable by default', async () => {
      delete process.env.ENABLE_ENTITY_NAME_STANDARDIZATION;

      const fields = {
        'Entity': 'Test'
      };

      const schema = {
        schema_name: 'Test Schema',
        entity_type: 'GeneralEntity',
        core_fields: [
          { name: 'Entity', weight: 1.0 }
        ]
      };

      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'Test content'
        }
      };

      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: false
        // enableStandardization not specified, should use env var
      });

      // Verify standardizer was NOT called (env var not set)
      expect(mockStandardizer.standardizeName).not.toHaveBeenCalled();
    });
  });

  describe('Integration with LLM Enhancement', () => {
    test('should apply standardization before LLM enhancement', async () => {
      const fields = {
        'ISO': '100'
      };

      const schema = {
        schema_name: 'Photography',
        entity_type: 'PhotographyEntity',
        core_fields: [
          { name: 'ISO', weight: 1.0 }
        ]
      };

      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'ISO 100 setting'
        }
      };

      // Mock standardizer response
      mockStandardizer.standardizeName.mockReturnValue({
        name: 'ISO_100_Sensitivity',
        confidence: 0.9,
        method: 'algorithm'
      });

      // Mock LLM client with callJSON method
      const { createQwenClient } = require('../utils/qwen_client');
      const mockLLMClient = {
        callJSON: jest.fn().mockResolvedValue({
          canonical_name: 'ISO_100_Sensitivity_Enhanced',
          aliases: ['ISO 100']
        })
      };
      createQwenClient.mockReturnValue(mockLLMClient);

      process.env.QWEN_API_KEY = 'test-key';

      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: true,
        enableStandardization: true
      });

      // Verify standardizer was called first
      expect(mockStandardizer.standardizeName).toHaveBeenCalled();

      // Verify LLM received standardized name
      expect(mockLLMClient.callJSON).toHaveBeenCalled();
      const llmPrompt = mockLLMClient.callJSON.mock.calls[0][0];
      expect(llmPrompt).toContain('ISO_100_Sensitivity');

      // Verify final result uses LLM-enhanced name
      expect(result.canonical_name).toBe('ISO_100_Sensitivity_Enhanced');
      expect(result.llm_enhanced).toBe(true);
      expect(result.standardized).toBe(true);
    });
  });

  describe('Real-World Scenarios', () => {
    test('should standardize numeric parameter names', async () => {
      const fields = {
        'ISO': '100',
        'Aperture': 'f/2.8',
        'ShutterSpeed': '1/250'
      };

      const schema = {
        schema_name: 'Camera Settings',
        entity_type: 'PhotographyEntity',
        core_fields: [
          { name: 'ISO', weight: 0.8 },
          { name: 'Aperture', weight: 0.7 },
          { name: 'ShutterSpeed', weight: 0.6 }
        ]
      };

      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'Camera settings for bright daylight: ISO 100, Aperture f/2.8, Shutter Speed 1/250 second'
        }
      };

      // Mock standardizer to return descriptive names
      mockStandardizer.standardizeName.mockReturnValue({
        name: 'ISO_100_Low_Sensitivity',
        confidence: 0.95,
        method: 'numeric_parameter'
      });

      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: false,
        enableStandardization: true
      });

      expect(result.canonical_name).toContain('ISO_100');
      expect(result.standardized).toBe(true);
    });

    test('should handle travel entity names', async () => {
      const fields = {
        'Location': 'Eiffel Tower',
        'Timestamp': '2025-01-15'
      };

      const schema = {
        schema_name: 'Travel Destination',
        entity_type: 'TravelEntity',
        core_fields: [
          { name: 'Location', weight: 0.9 },
          { name: 'Timestamp', weight: 0.5 }
        ]
      };

      const ckb = {
        ckb_id: 'ckb1',
        doc_id: 'doc1',
        content: {
          text: 'Visited the Eiffel Tower on January 15, 2025'
        }
      };

      // Mock standardizer
      mockStandardizer.standardizeName.mockReturnValue({
        name: 'Eiffel_Tower_Paris_2025-01-15',
        confidence: 0.9,
        method: 'location_enrichment'
      });

      const result = await generateCanonicalName(fields, schema, ckb, {
        useLLM: false,
        enableStandardization: true
      });

      expect(result.canonical_name).toBe('Eiffel_Tower_Paris_2025-01-15');
      expect(result.standardized).toBe(true);
    });
  });
});
