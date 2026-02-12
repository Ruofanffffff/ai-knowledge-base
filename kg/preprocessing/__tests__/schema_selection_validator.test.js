/**
 * Schema Selection Validator Tests
 * 
 * Tests for the Schema Selection Validator module
 * 
 * Requirements: 4.1, 4.2, 4.3
 */

const SchemaSelectionValidator = require('../schema_selection_validator');

describe('SchemaSelectionValidator', () => {
  let validator;
  let mockLLMClient;
  
  beforeEach(() => {
    validator = new SchemaSelectionValidator({
      temperature: 0.1,
      timeout: 5000,
      maxRetries: 2,
      confidenceThreshold: 0.75
    });
    
    mockLLMClient = {
      chat: jest.fn()
    };
  });
  
  describe('constructor', () => {
    it('should initialize with default options', () => {
      const v = new SchemaSelectionValidator();
      expect(v.temperature).toBe(0.1);
      expect(v.timeout).toBe(10000);
      expect(v.maxRetries).toBe(2);
      expect(v.confidenceThreshold).toBe(0.75);
    });
    
    it('should initialize with custom options', () => {
      const v = new SchemaSelectionValidator({
        temperature: 0.2,
        timeout: 15000,
        maxRetries: 3,
        confidenceThreshold: 0.8
      });
      expect(v.temperature).toBe(0.2);
      expect(v.timeout).toBe(15000);
      expect(v.maxRetries).toBe(3);
      expect(v.confidenceThreshold).toBe(0.8);
    });
  });
  
  describe('validateSchemaSelection', () => {
    const indexedText = `1. 2025年1月，阿里C区地下水位监测显示水位为45.2米。
2. 阿里C区位于海南省海口市美兰区。
3. 该监测点编号为ALI-C-001，由海南省水文局负责管理。`;
    
    const highConfidenceMatch = {
      schema: {
        schema_name: '地下水位变化事件',
        entity_type: 'WaterLevelEvent',
        scene: '地下水位监测',
        core_fields: [
          { name: '区域', weight: 0.3, required: true },
          { name: '时间', weight: 0.2, required: true },
          { name: '水位', weight: 0.2, required: true }
        ]
      },
      completeness: 0.85,
      matched_fields: ['区域', '时间', '水位'],
      missing_fields: []
    };
    
    const lowConfidenceMatch = {
      schema: {
        schema_name: '环境监测事件',
        entity_type: 'EnvironmentEvent',
        scene: '环境监测',
        core_fields: [
          { name: '区域', weight: 0.3, required: true },
          { name: '时间', weight: 0.2, required: true },
          { name: '污染物', weight: 0.3, required: true }
        ]
      },
      completeness: 0.65,
      matched_fields: ['区域', '时间'],
      missing_fields: ['污染物']
    };
    
    it('should skip validation for high confidence matches', async () => {
      const result = await validator.validateSchemaSelection(
        highConfidenceMatch,
        indexedText,
        mockLLMClient
      );
      
      expect(result.isAppropriate).toBe(true);
      expect(result.needsRevalidation).toBe(false);
      expect(result.reason).toContain('High confidence');
      expect(mockLLMClient.chat).not.toHaveBeenCalled();
    });
    
    it('should validate low confidence matches', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          is_appropriate: false,
          reason: '索引文本描述的是水位监测，不是环境污染监测',
          confidence: 0.3,
          supported_fields: ['区域', '时间'],
          unsupported_fields: ['污染物']
        })
      });
      
      const result = await validator.validateSchemaSelection(
        lowConfidenceMatch,
        indexedText,
        mockLLMClient
      );
      
      expect(result.isAppropriate).toBe(false);
      expect(result.validated).toBe(true);
      expect(result.reason).toContain('水位监测');
      expect(result.confidence).toBe(0.3);
      expect(result.supportedFields).toEqual(['区域', '时间']);
      expect(result.unsupportedFields).toEqual(['污染物']);
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(1);
    });
    
    it('should handle missing indexed text', async () => {
      const result = await validator.validateSchemaSelection(
        lowConfidenceMatch,
        null,
        mockLLMClient
      );
      
      expect(result.isAppropriate).toBe(true);
      expect(result.reason).toContain('No indexed text');
      expect(mockLLMClient.chat).not.toHaveBeenCalled();
    });
    
    it('should handle missing schema match', async () => {
      const result = await validator.validateSchemaSelection(
        null,
        indexedText,
        mockLLMClient
      );
      
      expect(result.isAppropriate).toBe(true);
      expect(result.reason).toContain('No schema match');
      expect(mockLLMClient.chat).not.toHaveBeenCalled();
    });
    
    it('should handle missing LLM client for low confidence match', async () => {
      const result = await validator.validateSchemaSelection(
        lowConfidenceMatch,
        indexedText,
        null
      );
      
      expect(result.isAppropriate).toBe(true);
      expect(result.needsRevalidation).toBe(true);
      expect(result.skipped).toBe(true);
      expect(result.reason).toContain('No LLM client');
    });
    
    it('should handle LLM validation errors gracefully', async () => {
      mockLLMClient.chat.mockRejectedValue(new Error('LLM service unavailable'));
      
      const result = await validator.validateSchemaSelection(
        lowConfidenceMatch,
        indexedText,
        mockLLMClient
      );
      
      expect(result.isAppropriate).toBe(true);
      expect(result.error).toContain('LLM service unavailable');
      expect(result.reason).toContain('Validation failed');
    });
    
    it('should validate matches with missing required fields', async () => {
      const matchWithMissingRequired = {
        schema: {
          schema_name: '水质监测事件',
          entity_type: 'WaterQualityEvent',
          core_fields: [
            { name: '区域', weight: 0.3, required: true },
            { name: '时间', weight: 0.2, required: true },
            { name: 'pH值', weight: 0.3, required: true }
          ]
        },
        completeness: 0.70, // Below threshold with missing required field
        matched_fields: ['区域', '时间'],
        missing_fields: [
          { name: 'pH值', required: true }
        ]
      };
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          is_appropriate: false,
          reason: '缺少必需的pH值字段',
          confidence: 0.5,
          supported_fields: ['区域', '时间'],
          unsupported_fields: ['pH值']
        })
      });
      
      const result = await validator.validateSchemaSelection(
        matchWithMissingRequired,
        indexedText,
        mockLLMClient
      );
      
      expect(result.validated).toBe(true);
      expect(result.isAppropriate).toBe(false);
      expect(mockLLMClient.chat).toHaveBeenCalled();
    });
    
    it('should parse validation response with markdown code blocks', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: '```json\n' + JSON.stringify({
          is_appropriate: true,
          reason: '匹配正确',
          confidence: 0.9,
          supported_fields: ['区域', '时间'],
          unsupported_fields: []
        }) + '\n```'
      });
      
      const result = await validator.validateSchemaSelection(
        lowConfidenceMatch,
        indexedText,
        mockLLMClient
      );
      
      expect(result.isAppropriate).toBe(true);
      expect(result.confidence).toBe(0.9);
    });
    
    it('should handle malformed JSON response', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: 'This is not JSON'
      });
      
      const result = await validator.validateSchemaSelection(
        lowConfidenceMatch,
        indexedText,
        mockLLMClient
      );
      
      expect(result.isAppropriate).toBe(true);
      expect(result.parseError).toBeDefined();
      expect(result.reason).toContain('Failed to parse');
    });
  });
  
  describe('_needsRevalidation', () => {
    it('should return true for low confidence matches', () => {
      const match = {
        completeness: 0.65,
        missing_fields: []
      };
      
      expect(validator._needsRevalidation(match)).toBe(true);
    });
    
    it('should return false for high confidence matches', () => {
      const match = {
        completeness: 0.85,
        missing_fields: []
      };
      
      expect(validator._needsRevalidation(match)).toBe(false);
    });
    
    it('should return true when missing required fields', () => {
      const match = {
        completeness: 0.80,
        missing_fields: ['field1', 'field2']
      };
      
      // Mock the missing fields to have required flag
      match.missing_fields = [
        { name: 'field1', required: true }
      ];
      
      expect(validator._needsRevalidation(match)).toBe(true);
    });
    
    it('should return false when only optional fields are missing', () => {
      const match = {
        completeness: 0.80,
        missing_fields: [
          { name: 'field1', required: false }
        ]
      };
      
      expect(validator._needsRevalidation(match)).toBe(false);
    });
  });
  
  describe('shouldCallLLM', () => {
    it('should return true for low confidence matches', () => {
      const match = {
        completeness: 0.65,
        missing_fields: []
      };
      
      expect(validator.shouldCallLLM(match)).toBe(true);
    });
    
    it('should return false for high confidence matches', () => {
      const match = {
        completeness: 0.85,
        missing_fields: []
      };
      
      expect(validator.shouldCallLLM(match)).toBe(false);
    });
  });
  
  describe('batchValidateSchemas', () => {
    it('should validate multiple schema matches', async () => {
      const schemaMatches = [
        {
          schemaMatch: {
            schema: {
              schema_name: 'Schema1',
              entity_type: 'Type1',
              core_fields: []
            },
            completeness: 0.65,
            matched_fields: [],
            missing_fields: []
          },
          indexedText: '1. Test fact 1.'
        },
        {
          schemaMatch: {
            schema: {
              schema_name: 'Schema2',
              entity_type: 'Type2',
              core_fields: []
            },
            completeness: 0.70,
            matched_fields: [],
            missing_fields: []
          },
          indexedText: '1. Test fact 2.'
        }
      ];
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          is_appropriate: true,
          reason: 'Valid',
          confidence: 0.8,
          supported_fields: [],
          unsupported_fields: []
        })
      });
      
      const results = await validator.batchValidateSchemas(
        schemaMatches,
        mockLLMClient,
        { maxConcurrency: 2 }
      );
      
      expect(results.size).toBe(2);
      expect(results.get('Schema1')).toBeDefined();
      expect(results.get('Schema2')).toBeDefined();
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(2);
    });
    
    it('should return empty map for empty input', async () => {
      const results = await validator.batchValidateSchemas([], mockLLMClient);
      expect(results.size).toBe(0);
    });
    
    it('should return empty map when no LLM client', async () => {
      const schemaMatches = [
        {
          schemaMatch: {
            schema: { schema_name: 'Schema1', core_fields: [] },
            completeness: 0.65,
            matched_fields: [],
            missing_fields: []
          },
          indexedText: '1. Test'
        }
      ];
      
      const results = await validator.batchValidateSchemas(schemaMatches, null);
      expect(results.size).toBe(0);
    });
  });
  
  describe('getValidationStats', () => {
    it('should calculate statistics correctly', () => {
      const results = new Map([
        ['Schema1', {
          isAppropriate: true,
          confidence: 0.9,
          validated: true
        }],
        ['Schema2', {
          isAppropriate: false,
          confidence: 0.6,
          validated: true
        }],
        ['Schema3', {
          isAppropriate: true,
          confidence: 0.85,
          validated: false
        }]
      ]);
      
      const stats = validator.getValidationStats(results);
      
      expect(stats.totalSchemas).toBe(3);
      expect(stats.appropriateSchemas).toBe(2);
      expect(stats.inappropriateSchemas).toBe(1);
      expect(stats.appropriateRate).toBe('0.67');
      expect(stats.revalidatedSchemas).toBe(2);
      expect(stats.revalidationRate).toBe('0.67');
      expect(parseFloat(stats.avgConfidence)).toBeCloseTo(0.78, 1);
    });
    
    it('should handle empty results', () => {
      const stats = validator.getValidationStats(new Map());
      
      expect(stats.totalSchemas).toBe(0);
      expect(stats.appropriateSchemas).toBe(0);
      expect(stats.inappropriateSchemas).toBe(0);
      expect(stats.appropriateRate).toBe(0);
      expect(stats.revalidatedSchemas).toBe(0);
      expect(stats.revalidationRate).toBe(0);
      expect(stats.avgConfidence).toBe(0);
    });
  });
  
  describe('LLM retry logic', () => {
    it('should retry on failure', async () => {
      mockLLMClient.chat
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({
          content: JSON.stringify({
            is_appropriate: true,
            reason: 'Success on retry',
            confidence: 0.8,
            supported_fields: [],
            unsupported_fields: []
          })
        });
      
      const lowConfidenceMatch = {
        schema: {
          schema_name: 'TestSchema',
          entity_type: 'Test',
          core_fields: []
        },
        completeness: 0.65,
        matched_fields: [],
        missing_fields: []
      };
      
      const result = await validator.validateSchemaSelection(
        lowConfidenceMatch,
        '1. Test fact.',
        mockLLMClient
      );
      
      expect(result.isAppropriate).toBe(true);
      expect(result.reason).toContain('Success on retry');
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(2);
    });
    
    it('should fail after max retries', async () => {
      mockLLMClient.chat.mockRejectedValue(new Error('Persistent failure'));
      
      const lowConfidenceMatch = {
        schema: {
          schema_name: 'TestSchema',
          entity_type: 'Test',
          core_fields: []
        },
        completeness: 0.65,
        matched_fields: [],
        missing_fields: []
      };
      
      const result = await validator.validateSchemaSelection(
        lowConfidenceMatch,
        '1. Test fact.',
        mockLLMClient
      );
      
      expect(result.error).toBeDefined();
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(2); // maxRetries = 2
    });
  });
});
