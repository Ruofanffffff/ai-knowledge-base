/**
 * Unit Tests for Relation Extraction Validator
 * 
 * Tests:
 * 1. 验证关系抽取完整性
 * 2. 识别遗漏的关系
 * 3. 补充提取遗漏的关系
 * 4. 计算覆盖率
 * 5. 错误处理和降级
 */

const RelationExtractionValidator = require('../relation_extraction_validator');

describe('RelationExtractionValidator', () => {
  let validator;
  let mockLLMClient;
  
  beforeEach(() => {
    validator = new RelationExtractionValidator({
      temperature: 0.1,
      timeout: 5000,
      maxRetries: 2,
      coverageThreshold: 0.7
    });
    
    mockLLMClient = {
      chat: jest.fn()
    };
  });
  
  describe('validateRelations', () => {
    test('should validate relations and identify missing ones', async () => {
      const extractedRelations = [
        {
          subject_id: 'entity_1',
          subject_name: '阿里C区',
          relation_type: 'located_in',
          relation_description: '位于',
          object_id: 'entity_2',
          object_name: '海南省'
        }
      ];
      
      const indexedText = `1. 阿里C区位于海南省海口市美兰区。
2. 该监测点由海南省水文局负责管理。
3. 2025年1月水位为45.2米。`;
      
      const entities = [
        { entity_id: 'entity_1', canonical_name: '阿里C区', entity_type: 'Location' },
        { entity_id: 'entity_2', canonical_name: '海南省', entity_type: 'Location' },
        { entity_id: 'entity_3', canonical_name: '海南省水文局', entity_type: 'Organization' }
      ];
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          missing_relations: [
            {
              subject: '阿里C区',
              relation: '管理者',
              object: '海南省水文局',
              type: 'managed_by',
              source_index: 2,
              confidence: 0.85
            }
          ],
          coverage_rate: 0.75
        })
      });
      
      const result = await validator.validateRelations(
        extractedRelations,
        indexedText,
        entities,
        mockLLMClient
      );
      
      expect(result.isValid).toBe(true); // 0.75 >= 0.7
      expect(result.coverageRate).toBe(0.75);
      expect(result.missingRelations).toHaveLength(1);
      expect(result.missingRelations[0].subject).toBe('阿里C区');
      expect(result.missingRelations[0].object).toBe('海南省水文局');
      expect(result.needsSupplement).toBe(true);
    });
    
    test('should return valid when coverage is high', async () => {
      const extractedRelations = [
        {
          subject_id: 'entity_1',
          relation_type: 'located_in',
          object_id: 'entity_2'
        },
        {
          subject_id: 'entity_1',
          relation_type: 'managed_by',
          object_id: 'entity_3'
        }
      ];
      
      const indexedText = '1. 阿里C区位于海南省。\n2. 由水文局管理。';
      const entities = [
        { entity_id: 'entity_1', canonical_name: '阿里C区' },
        { entity_id: 'entity_2', canonical_name: '海南省' },
        { entity_id: 'entity_3', canonical_name: '水文局' }
      ];
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          missing_relations: [],
          coverage_rate: 0.95
        })
      });
      
      const result = await validator.validateRelations(
        extractedRelations,
        indexedText,
        entities,
        mockLLMClient
      );
      
      expect(result.isValid).toBe(true);
      expect(result.coverageRate).toBe(0.95);
      expect(result.missingRelations).toHaveLength(0);
      expect(result.needsSupplement).toBe(false);
    });
    
    test('should handle missing indexedText gracefully', async () => {
      const result = await validator.validateRelations(
        [],
        null,
        [],
        mockLLMClient
      );
      
      expect(result.isValid).toBe(true);
      expect(result.coverageRate).toBe(1.0);
      expect(result.reason).toBe('No indexed text available');
      expect(mockLLMClient.chat).not.toHaveBeenCalled();
    });
    
    test('should handle missing entities gracefully', async () => {
      const result = await validator.validateRelations(
        [],
        'some indexed text',
        [],
        mockLLMClient
      );
      
      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('No entities available');
      expect(mockLLMClient.chat).not.toHaveBeenCalled();
    });
    
    test('should handle missing LLM client gracefully', async () => {
      const result = await validator.validateRelations(
        [],
        'some indexed text',
        [{ entity_id: 'e1' }],
        null
      );
      
      expect(result.isValid).toBe(true);
      expect(result.reason).toBe('No LLM client');
      expect(mockLLMClient.chat).not.toHaveBeenCalled();
    });
    
    test('should handle LLM errors gracefully', async () => {
      mockLLMClient.chat.mockRejectedValue(new Error('LLM service unavailable'));
      
      const result = await validator.validateRelations(
        [],
        'indexed text',
        [{ entity_id: 'e1' }],
        mockLLMClient
      );
      
      expect(result.isValid).toBe(true);
      expect(result.coverageRate).toBe(1.0);
      expect(result.error).toContain('LLM call failed');
    });
    
    test('should handle malformed JSON response', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: 'This is not valid JSON'
      });
      
      const result = await validator.validateRelations(
        [],
        'indexed text',
        [{ entity_id: 'e1' }],
        mockLLMClient
      );
      
      expect(result.isValid).toBe(true);
      expect(result.parseError).toBeDefined();
    });
    
    test('should handle JSON with markdown code blocks', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: '```json\n{"missing_relations": [], "coverage_rate": 0.9}\n```'
      });
      
      const result = await validator.validateRelations(
        [],
        'indexed text',
        [{ entity_id: 'e1' }],
        mockLLMClient
      );
      
      expect(result.isValid).toBe(true);
      expect(result.coverageRate).toBe(0.9);
    });
  });
  
  describe('supplementRelations', () => {
    test('should supplement missing relations', async () => {
      const missingRelations = [
        {
          subject: '阿里C区',
          relation: '管理者',
          object: '海南省水文局',
          type: 'managed_by'
        }
      ];
      
      const entities = [
        { entity_id: 'entity_1', canonical_name: '阿里C区', entity_type: 'Location' },
        { entity_id: 'entity_3', canonical_name: '海南省水文局', entity_type: 'Organization' }
      ];
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify([
          {
            subject_id: 'entity_1',
            subject_name: '阿里C区',
            relation_type: 'managed_by',
            relation_description: '管理者',
            object_id: 'entity_3',
            object_name: '海南省水文局',
            confidence: 0.85
          }
        ])
      });
      
      const result = await validator.supplementRelations(
        missingRelations,
        entities,
        mockLLMClient
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].subject_id).toBe('entity_1');
      expect(result[0].object_id).toBe('entity_3');
      expect(result[0].relation_type).toBe('managed_by');
      expect(result[0].confidence).toBe(0.85);
      expect(result[0].sources).toContain('llm_supplement');
    });
    
    test('should return empty array when no missing relations', async () => {
      const result = await validator.supplementRelations(
        [],
        [],
        mockLLMClient
      );
      
      expect(result).toHaveLength(0);
      expect(mockLLMClient.chat).not.toHaveBeenCalled();
    });
    
    test('should handle missing LLM client', async () => {
      const result = await validator.supplementRelations(
        [{ subject: 'A', relation: 'R', object: 'B' }],
        [],
        null
      );
      
      expect(result).toHaveLength(0);
    });
    
    test('should filter out incomplete relations', async () => {
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify([
          {
            subject_id: 'entity_1',
            relation_type: 'managed_by',
            object_id: 'entity_3',
            confidence: 0.85
          },
          {
            subject_id: 'entity_2',
            // missing object_id
            relation_type: 'located_in',
            confidence: 0.9
          }
        ])
      });
      
      const result = await validator.supplementRelations(
        [{ subject: 'A', relation: 'R', object: 'B' }],
        [{ entity_id: 'e1' }],
        mockLLMClient
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].subject_id).toBe('entity_1');
    });
  });
  
  describe('batchValidateRelations', () => {
    test('should validate multiple documents in parallel', async () => {
      const documentsWithRelations = [
        {
          relations: [{ subject_id: 'e1', relation_type: 'r1', object_id: 'e2' }],
          indexedText: 'text 1',
          entities: [{ entity_id: 'e1' }, { entity_id: 'e2' }]
        },
        {
          relations: [{ subject_id: 'e3', relation_type: 'r2', object_id: 'e4' }],
          indexedText: 'text 2',
          entities: [{ entity_id: 'e3' }, { entity_id: 'e4' }]
        }
      ];
      
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          missing_relations: [],
          coverage_rate: 0.9
        })
      });
      
      const results = await validator.batchValidateRelations(
        documentsWithRelations,
        mockLLMClient,
        { maxConcurrency: 2 }
      );
      
      expect(results.size).toBe(2);
      expect(results.get(0).coverageRate).toBe(0.9);
      expect(results.get(1).coverageRate).toBe(0.9);
    });
    
    test('should return empty map when no documents', async () => {
      const results = await validator.batchValidateRelations(
        [],
        mockLLMClient
      );
      
      expect(results.size).toBe(0);
    });
  });
  
  describe('getValidationStats', () => {
    test('should calculate validation statistics', () => {
      const validationResults = new Map([
        [0, { isValid: true, coverageRate: 0.9, missingRelations: [] }],
        [1, { isValid: false, coverageRate: 0.6, missingRelations: [{ subject: 'A' }, { subject: 'B' }] }],
        [2, { isValid: true, coverageRate: 0.85, missingRelations: [{ subject: 'C' }] }]
      ]);
      
      const stats = validator.getValidationStats(validationResults);
      
      expect(stats.totalDocs).toBe(3);
      expect(stats.validDocs).toBe(2);
      expect(stats.invalidDocs).toBe(1);
      expect(stats.validRate).toBe('0.67');
      expect(stats.totalMissingRelations).toBe(3);
      expect(stats.avgMissingRelationsPerDoc).toBe('1.00');
      expect(stats.avgCoverageRate).toBe('0.78');
    });
  });
  
  describe('shouldCallLLM', () => {
    test('should return false when no indexed text', () => {
      const result = validator.shouldCallLLM(
        [],
        [{ entity_id: 'e1' }],
        {}
      );
      
      expect(result).toBe(false);
    });
    
    test('should return false when no entities', () => {
      const result = validator.shouldCallLLM(
        [],
        [],
        { indexedText: 'text' }
      );
      
      expect(result).toBe(false);
    });
    
    test('should return true when many entities but few relations', () => {
      const entities = Array.from({ length: 10 }, (_, i) => ({ entity_id: `e${i}` }));
      const relations = [{ subject_id: 'e1', object_id: 'e2' }];
      
      const result = validator.shouldCallLLM(
        relations,
        entities,
        { indexedText: 'text' }
      );
      
      expect(result).toBe(true);
    });
    
    test('should return false when relation count is reasonable', () => {
      const entities = Array.from({ length: 10 }, (_, i) => ({ entity_id: `e${i}` }));
      const relations = Array.from({ length: 6 }, (_, i) => ({ 
        subject_id: `e${i}`, 
        object_id: `e${i+1}` 
      }));
      
      const result = validator.shouldCallLLM(
        relations,
        entities,
        { indexedText: 'text' }
      );
      
      expect(result).toBe(false);
    });
    
    test('should return true when force validation is set', () => {
      const result = validator.shouldCallLLM(
        [],
        [{ entity_id: 'e1' }],
        { indexedText: 'text', forceValidation: true }
      );
      
      expect(result).toBe(true);
    });
  });
  
  describe('timeout and retry', () => {
    test('should retry on timeout', async () => {
      let callCount = 0;
      mockLLMClient.chat.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return new Promise((_, reject) => {
            setTimeout(() => {
              const error = new Error('Timeout');
              error.name = 'AbortError';
              reject(error);
            }, 100);
          });
        }
        return Promise.resolve({
          content: JSON.stringify({
            missing_relations: [],
            coverage_rate: 0.9
          })
        });
      });
      
      const result = await validator.validateRelations(
        [],
        'indexed text',
        [{ entity_id: 'e1' }],
        mockLLMClient
      );
      
      expect(callCount).toBe(2);
      expect(result.coverageRate).toBe(0.9);
    });
  });
});
