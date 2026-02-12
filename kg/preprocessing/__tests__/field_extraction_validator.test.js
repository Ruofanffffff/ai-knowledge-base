/**
 * Unit Tests for Field Extraction Validator
 * 
 * Tests:
 * - 字段完整性验证
 * - 遗漏字段识别
 * - 补充提取
 * - 覆盖率计算
 */

const FieldExtractionValidator = require('../field_extraction_validator');

describe('FieldExtractionValidator', () => {
  let validator;
  let mockLLMClient;
  
  beforeEach(() => {
    validator = new FieldExtractionValidator({
      timeout: 5000,
      maxRetries: 2,
      coverageThreshold: 0.8
    });
    
    // Mock LLM client
    mockLLMClient = {
      chat: jest.fn()
    };
  });
  
  describe('validateFields', () => {
    test('should validate fields successfully with high coverage', async () => {
      const extractedFields = [
        { name: '地点', value: '海南省海口市' },
        { name: '时间', value: '2025年1月' }
      ];
      
      const indexedText = `1. 2025年1月，海南省海口市地下水位监测显示水位为45.2米。
2. 该监测点编号为ALI-C-001。`;
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: {
          text: '2025年1月，海南省海口市地下水位监测显示水位为45.2米。'
        }
      };
      
      // Mock LLM response
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          missing_fields: [],
          coverage_rate: 0.95
        })
      });
      
      const result = await validator.validateFields(
        extractedFields,
        indexedText,
        ckb,
        mockLLMClient
      );
      
      expect(result.isValid).toBe(true);
      expect(result.coverageRate).toBe(0.95);
      expect(result.missingFields).toHaveLength(0);
      expect(mockLLMClient.chat).toHaveBeenCalledTimes(1);
    });
    
    test('should identify missing fields with low coverage', async () => {
      const extractedFields = [
        { name: '地点', value: '海南省海口市' }
      ];
      
      const indexedText = `1. 2025年1月，海南省海口市地下水位监测显示水位为45.2米。
2. 该监测点编号为ALI-C-001，由海南省水文局负责管理。`;
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: {
          text: '2025年1月，海南省海口市地下水位监测显示水位为45.2米。该监测点编号为ALI-C-001，由海南省水文局负责管理。'
        }
      };
      
      // Mock LLM response with missing fields
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          missing_fields: [
            {
              name: '时间',
              value: '2025年1月',
              type: 'time',
              source_index: 1,
              confidence: 0.9
            },
            {
              name: '监测点编号',
              value: 'ALI-C-001',
              type: 'text',
              source_index: 2,
              confidence: 0.95
            },
            {
              name: '管理单位',
              value: '海南省水文局',
              type: 'entity',
              source_index: 2,
              confidence: 0.9
            }
          ],
          coverage_rate: 0.6
        })
      });
      
      const result = await validator.validateFields(
        extractedFields,
        indexedText,
        ckb,
        mockLLMClient
      );
      
      expect(result.isValid).toBe(false); // Below threshold
      expect(result.coverageRate).toBe(0.6);
      expect(result.missingFields).toHaveLength(3);
      expect(result.needsSupplement).toBe(true);
      expect(result.missingFields[0].name).toBe('时间');
      expect(result.missingFields[1].name).toBe('监测点编号');
      expect(result.missingFields[2].name).toBe('管理单位');
    });
    
    test('should handle missing indexedText gracefully', async () => {
      const extractedFields = [
        { name: '地点', value: '海南省海口市' }
      ];
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: { text: 'Some text' }
      };
      
      const result = await validator.validateFields(
        extractedFields,
        null, // No indexed text
        ckb,
        mockLLMClient
      );
      
      expect(result.isValid).toBe(true);
      expect(result.coverageRate).toBe(1.0);
      expect(result.missingFields).toHaveLength(0);
      expect(result.reason).toBe('No indexed text available');
      expect(mockLLMClient.chat).not.toHaveBeenCalled();
    });
    
    test('should handle missing LLM client gracefully', async () => {
      const extractedFields = [
        { name: '地点', value: '海南省海口市' }
      ];
      
      const indexedText = '1. 2025年1月，海南省海口市地下水位监测。';
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: { text: 'Some text' }
      };
      
      const result = await validator.validateFields(
        extractedFields,
        indexedText,
        ckb,
        null // No LLM client
      );
      
      expect(result.isValid).toBe(true);
      expect(result.coverageRate).toBe(1.0);
      expect(result.missingFields).toHaveLength(0);
      expect(result.reason).toBe('No LLM client');
    });
    
    test('should handle LLM errors gracefully', async () => {
      const extractedFields = [
        { name: '地点', value: '海南省海口市' }
      ];
      
      const indexedText = '1. 2025年1月，海南省海口市地下水位监测。';
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: { text: 'Some text' }
      };
      
      // Mock LLM error
      mockLLMClient.chat.mockRejectedValue(new Error('LLM service unavailable'));
      
      const result = await validator.validateFields(
        extractedFields,
        indexedText,
        ckb,
        mockLLMClient
      );
      
      expect(result.isValid).toBe(true); // Graceful fallback
      expect(result.coverageRate).toBe(1.0);
      expect(result.missingFields).toHaveLength(0);
      expect(result.error).toBeDefined();
    });
    
    test('should handle malformed JSON response', async () => {
      const extractedFields = [
        { name: '地点', value: '海南省海口市' }
      ];
      
      const indexedText = '1. 2025年1月，海南省海口市地下水位监测。';
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: { text: 'Some text' }
      };
      
      // Mock malformed response
      mockLLMClient.chat.mockResolvedValue({
        content: 'This is not valid JSON'
      });
      
      const result = await validator.validateFields(
        extractedFields,
        indexedText,
        ckb,
        mockLLMClient
      );
      
      expect(result.isValid).toBe(true); // Graceful fallback
      expect(result.coverageRate).toBe(1.0);
      expect(result.missingFields).toHaveLength(0);
      expect(result.parseError).toBeDefined();
    });
  });
  
  describe('supplementFields', () => {
    test('should supplement missing fields successfully', async () => {
      const missingFields = [
        { name: '时间', value: '2025年1月' },
        { name: '监测点编号', value: 'ALI-C-001' }
      ];
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: {
          text: '2025年1月，海南省海口市地下水位监测显示水位为45.2米。该监测点编号为ALI-C-001。'
        }
      };
      
      // Mock LLM response
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify([
          {
            name: '时间',
            value: '2025年1月',
            confidence: 0.9
          },
          {
            name: '监测点编号',
            value: 'ALI-C-001',
            confidence: 0.95
          }
        ])
      });
      
      const result = await validator.supplementFields(
        missingFields,
        ckb,
        mockLLMClient
      );
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('时间');
      expect(result[0].value).toBe('2025年1月');
      expect(result[0].sources).toContain('llm_supplement');
      expect(result[1].name).toBe('监测点编号');
      expect(result[1].value).toBe('ALI-C-001');
    });
    
    test('should filter out null values', async () => {
      const missingFields = [
        { name: '时间', value: '2025年1月' },
        { name: '单位', value: null }
      ];
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: {
          text: '2025年1月，海南省海口市地下水位监测。'
        }
      };
      
      // Mock LLM response with null value
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify([
          {
            name: '时间',
            value: '2025年1月',
            confidence: 0.9
          },
          {
            name: '单位',
            value: null,
            confidence: 0
          }
        ])
      });
      
      const result = await validator.supplementFields(
        missingFields,
        ckb,
        mockLLMClient
      );
      
      expect(result).toHaveLength(1); // Only non-null field
      expect(result[0].name).toBe('时间');
    });
    
    test('should return empty array when no missing fields', async () => {
      const result = await validator.supplementFields(
        [],
        { ckb_id: 'ckb-1', content: { text: 'text' } },
        mockLLMClient
      );
      
      expect(result).toHaveLength(0);
      expect(mockLLMClient.chat).not.toHaveBeenCalled();
    });
    
    test('should handle missing LLM client', async () => {
      const missingFields = [
        { name: '时间', value: '2025年1月' }
      ];
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: { text: 'text' }
      };
      
      const result = await validator.supplementFields(
        missingFields,
        ckb,
        null // No LLM client
      );
      
      expect(result).toHaveLength(0);
    });
  });
  
  describe('batchValidateFields', () => {
    test('should validate multiple CKBs in batch', async () => {
      const ckbsWithFields = [
        {
          ckb: { ckb_id: 'ckb-1', content: { text: 'text1' } },
          fields: [{ name: '地点', value: '海南' }],
          indexedText: '1. 海南地下水位监测。'
        },
        {
          ckb: { ckb_id: 'ckb-2', content: { text: 'text2' } },
          fields: [{ name: '时间', value: '2025年1月' }],
          indexedText: '1. 2025年1月监测数据。'
        }
      ];
      
      // Mock LLM responses
      mockLLMClient.chat
        .mockResolvedValueOnce({
          content: JSON.stringify({
            missing_fields: [],
            coverage_rate: 0.9
          })
        })
        .mockResolvedValueOnce({
          content: JSON.stringify({
            missing_fields: [
              { name: '地点', value: '海南', type: 'location', confidence: 0.85 }
            ],
            coverage_rate: 0.7
          })
        });
      
      const results = await validator.batchValidateFields(
        ckbsWithFields,
        mockLLMClient
      );
      
      expect(results.size).toBe(2);
      expect(results.get('ckb-1').coverageRate).toBe(0.9);
      expect(results.get('ckb-2').coverageRate).toBe(0.7);
      expect(results.get('ckb-2').missingFields).toHaveLength(1);
    });
  });
  
  describe('getValidationStats', () => {
    test('should calculate validation statistics', () => {
      const validationResults = new Map([
        ['ckb-1', {
          isValid: true,
          coverageRate: 0.9,
          missingFields: []
        }],
        ['ckb-2', {
          isValid: false,
          coverageRate: 0.6,
          missingFields: [
            { name: '时间', value: '2025年1月' },
            { name: '地点', value: '海南' }
          ]
        }],
        ['ckb-3', {
          isValid: true,
          coverageRate: 0.85,
          missingFields: [
            { name: '单位', value: '水文局' }
          ]
        }]
      ]);
      
      const stats = validator.getValidationStats(validationResults);
      
      expect(stats.totalCKBs).toBe(3);
      expect(stats.validCKBs).toBe(2);
      expect(stats.invalidCKBs).toBe(1);
      expect(stats.validRate).toBe('0.67');
      expect(stats.totalMissingFields).toBe(3);
      expect(stats.avgMissingFieldsPerCKB).toBe('1.00');
      expect(parseFloat(stats.avgCoverageRate)).toBeCloseTo(0.78, 1);
    });
  });
  
  describe('_inferFieldType', () => {
    test('should infer location type', () => {
      expect(validator._inferFieldType('地点')).toBe('location');
      expect(validator._inferFieldType('位置')).toBe('location');
      expect(validator._inferFieldType('区域')).toBe('location');
    });
    
    test('should infer entity type', () => {
      expect(validator._inferFieldType('单位')).toBe('entity');
      expect(validator._inferFieldType('公司')).toBe('entity');
      expect(validator._inferFieldType('组织')).toBe('entity');
    });
    
    test('should infer time type', () => {
      expect(validator._inferFieldType('时间')).toBe('time');
      expect(validator._inferFieldType('日期')).toBe('time');
    });
    
    test('should infer number type', () => {
      expect(validator._inferFieldType('数值')).toBe('number');
      expect(validator._inferFieldType('金额')).toBe('number');
      expect(validator._inferFieldType('数量')).toBe('number');
    });
    
    test('should default to text type', () => {
      expect(validator._inferFieldType('描述')).toBe('text');
      expect(validator._inferFieldType('备注')).toBe('text');
    });
  });
  
  describe('Coverage Rate Edge Cases', () => {
    test('should handle zero extracted fields', async () => {
      const extractedFields = [];
      
      const indexedText = `1. 2025年1月，海南省海口市地下水位监测显示水位为45.2米。`;
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: {
          text: '2025年1月，海南省海口市地下水位监测显示水位为45.2米。'
        }
      };
      
      // Mock LLM response indicating all fields are missing
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          missing_fields: [
            {
              name: '时间',
              value: '2025年1月',
              type: 'time',
              source_index: 1,
              confidence: 0.9
            },
            {
              name: '地点',
              value: '海南省海口市',
              type: 'location',
              source_index: 1,
              confidence: 0.9
            }
          ],
          coverage_rate: 1.0  // LLM returns 1.0 even with 0 fields (edge case)
        })
      });
      
      const result = await validator.validateFields(
        extractedFields,
        indexedText,
        ckb,
        mockLLMClient
      );
      
      // Even with 0 extracted fields, if LLM says coverage is 1.0, we trust it
      expect(result.isValid).toBe(true);
      expect(result.coverageRate).toBe(1.0);
      expect(result.missingFields.length).toBe(2); // But we still get missing fields
    });
    
    test('should handle coverage rate at threshold boundary', async () => {
      const extractedFields = [
        { name: '地点', value: '海南省海口市' }
      ];
      
      const indexedText = `1. 2025年1月，海南省海口市地下水位监测。`;
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: { text: 'text' }
      };
      
      // Mock LLM response with coverage exactly at threshold (0.8)
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          missing_fields: [],
          coverage_rate: 0.8
        })
      });
      
      const result = await validator.validateFields(
        extractedFields,
        indexedText,
        ckb,
        mockLLMClient
      );
      
      expect(result.isValid).toBe(true); // Should be valid at threshold
      expect(result.coverageRate).toBe(0.8);
    });
    
    test('should handle coverage rate just below threshold', async () => {
      const extractedFields = [
        { name: '地点', value: '海南省海口市' }
      ];
      
      const indexedText = `1. 2025年1月，海南省海口市地下水位监测。`;
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: { text: 'text' }
      };
      
      // Mock LLM response with coverage just below threshold (0.79)
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          missing_fields: [
            { name: '时间', value: '2025年1月', type: 'time', confidence: 0.9 }
          ],
          coverage_rate: 0.79
        })
      });
      
      const result = await validator.validateFields(
        extractedFields,
        indexedText,
        ckb,
        mockLLMClient
      );
      
      expect(result.isValid).toBe(false); // Should be invalid below threshold
      expect(result.coverageRate).toBe(0.79);
    });
  });
  
  describe('Missing Field Identification Edge Cases', () => {
    test('should filter out missing fields with empty string values', async () => {
      const extractedFields = [
        { name: '地点', value: '海南省海口市' }
      ];
      
      const indexedText = `1. 2025年1月，海南省海口市地下水位监测。`;
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: { text: 'text' }
      };
      
      // Mock LLM response with empty string values
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          missing_fields: [
            {
              name: '时间',
              value: '2025年1月',
              type: 'time',
              confidence: 0.9
            },
            {
              name: '单位',
              value: '',
              type: 'entity',
              confidence: 0.5
            },
            {
              name: '备注',
              value: null,
              type: 'text',
              confidence: 0.3
            }
          ],
          coverage_rate: 0.7
        })
      });
      
      const result = await validator.validateFields(
        extractedFields,
        indexedText,
        ckb,
        mockLLMClient
      );
      
      expect(result.missingFields).toHaveLength(1); // Only non-empty field
      expect(result.missingFields[0].name).toBe('时间');
    });
    
    test('should handle missing fields with various confidence levels', async () => {
      const extractedFields = [];
      
      const indexedText = `1. 2025年1月，海南省海口市地下水位监测。`;
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: { text: 'text' }
      };
      
      // Mock LLM response with different confidence levels
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify({
          missing_fields: [
            {
              name: '时间',
              value: '2025年1月',
              type: 'time',
              confidence: 0.95
            },
            {
              name: '地点',
              value: '海南省海口市',
              type: 'location',
              confidence: 0.5
            },
            {
              name: '单位',
              value: '水文局',
              type: 'entity',
              confidence: 0.3
            }
          ],
          coverage_rate: 0.0
        })
      });
      
      const result = await validator.validateFields(
        extractedFields,
        indexedText,
        ckb,
        mockLLMClient
      );
      
      expect(result.missingFields).toHaveLength(3);
      expect(result.missingFields[0].confidence).toBe(0.95);
      expect(result.missingFields[1].confidence).toBe(0.5);
      expect(result.missingFields[2].confidence).toBe(0.3);
    });
  });
  
  describe('Supplemental Extraction Edge Cases', () => {
    test('should handle supplement with markdown code blocks in response', async () => {
      const missingFields = [
        { name: '时间', value: '2025年1月' }
      ];
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: {
          text: '2025年1月，海南省海口市地下水位监测。'
        }
      };
      
      // Mock LLM response with markdown code blocks
      mockLLMClient.chat.mockResolvedValue({
        content: '```json\n' + JSON.stringify([
          {
            name: '时间',
            value: '2025年1月',
            confidence: 0.9
          }
        ]) + '\n```'
      });
      
      const result = await validator.supplementFields(
        missingFields,
        ckb,
        mockLLMClient
      );
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('时间');
      expect(result[0].value).toBe('2025年1月');
    });
    
    test('should handle supplement with empty array response', async () => {
      const missingFields = [
        { name: '单位', value: '水文局' }
      ];
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: {
          text: '地下水位监测数据。'
        }
      };
      
      // Mock LLM response with empty array
      mockLLMClient.chat.mockResolvedValue({
        content: JSON.stringify([])
      });
      
      const result = await validator.supplementFields(
        missingFields,
        ckb,
        mockLLMClient
      );
      
      expect(result).toHaveLength(0);
    });
    
    test('should handle supplement with malformed JSON gracefully', async () => {
      const missingFields = [
        { name: '时间', value: '2025年1月' }
      ];
      
      const ckb = {
        ckb_id: 'ckb-1',
        content: {
          text: '2025年1月监测数据。'
        }
      };
      
      // Mock LLM response with malformed JSON
      mockLLMClient.chat.mockResolvedValue({
        content: 'Invalid JSON response'
      });
      
      const result = await validator.supplementFields(
        missingFields,
        ckb,
        mockLLMClient
      );
      
      expect(result).toHaveLength(0); // Graceful fallback
    });
  });
});
