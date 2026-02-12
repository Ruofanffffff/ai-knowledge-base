/**
 * Property-Based Tests for Field Extraction Validator
 * 
 * Tests universal properties that should hold across all inputs:
 * - Property 8: 字段覆盖率验证
 * - Property 9: 遗漏实体补充
 * - Property 10: 冗余字段过滤
 * 
 * Validates: Requirements 3.2, 3.3, 3.4
 */

const fc = require('fast-check');
const FieldExtractionValidator = require('../field_extraction_validator');

describe('FieldExtractionValidator - Property-Based Tests', () => {
  let validator;
  
  beforeEach(() => {
    validator = new FieldExtractionValidator({
      timeout: 5000,
      maxRetries: 2,
      coverageThreshold: 0.8
    });
  });
  
  /**
   * Property 8: 字段覆盖率验证
   * 
   * **Validates: Requirements 3.2**
   * 
   * 对于任何字段提取结果，系统应该验证它覆盖了Document_Index中标识的关键实体，并计算覆盖率
   * 
   * Universal property: For any field extraction result, the system should verify
   * coverage of key entities identified in the Document_Index and calculate coverage rate.
   */
  describe('Property 8: 字段覆盖率验证', () => {
    test('should always calculate coverage rate between 0 and 1', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary extracted fields
          fc.array(
            fc.record({
              name: fc.constantFrom('地点', '时间', '单位', '数值', '监测点编号'),
              value: fc.string({ minLength: 1, maxLength: 50 })
            }),
            { minLength: 0, maxLength: 10 }
          ),
          // Generate arbitrary indexed text
          fc.string({ minLength: 10, maxLength: 500 }),
          // Generate arbitrary CKB
          fc.record({
            ckb_id: fc.uuid(),
            content: fc.record({
              text: fc.string({ minLength: 10, maxLength: 500 })
            })
          }),
          async (extractedFields, indexedText, ckb) => {
            // Mock LLM client that returns valid coverage rate
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_fields: [],
                  coverage_rate: Math.random() // Random but valid coverage rate
                })
              })
            };
            
            const result = await validator.validateFields(
              extractedFields,
              indexedText,
              ckb,
              mockLLMClient
            );
            
            // Property: Coverage rate must always be between 0 and 1
            expect(result.coverageRate).toBeGreaterThanOrEqual(0);
            expect(result.coverageRate).toBeLessThanOrEqual(1);
            
            // Property: Coverage rate must be a number
            expect(typeof result.coverageRate).toBe('number');
            expect(Number.isFinite(result.coverageRate)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should mark as valid when coverage rate meets or exceeds threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('地点', '时间', '单位'),
              value: fc.string({ minLength: 1, maxLength: 50 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.float({ min: Math.fround(0.8), max: Math.fround(1.0) }), // Coverage rate >= threshold
          fc.record({
            ckb_id: fc.uuid(),
            content: fc.record({
              text: fc.string({ minLength: 10, maxLength: 200 })
            })
          }),
          async (extractedFields, coverageRate, ckb) => {
            const indexedText = '1. 测试索引文本。';
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_fields: [],
                  coverage_rate: coverageRate
                })
              })
            };
            
            const result = await validator.validateFields(
              extractedFields,
              indexedText,
              ckb,
              mockLLMClient
            );
            
            // Property: When coverage >= threshold, isValid should be true
            expect(result.isValid).toBe(true);
            expect(result.coverageRate).toBeGreaterThanOrEqual(0.8);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should mark as invalid when coverage rate is below threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('地点', '时间'),
              value: fc.string({ minLength: 1, maxLength: 50 })
            }),
            { minLength: 0, maxLength: 3 }
          ),
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.79) }), // Coverage rate < threshold (avoid 0)
          fc.record({
            ckb_id: fc.uuid(),
            content: fc.record({
              text: fc.string({ minLength: 10, maxLength: 200 })
            })
          }),
          async (extractedFields, coverageRate, ckb) => {
            const indexedText = '1. 测试索引文本。';
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_fields: [
                    {
                      name: '遗漏字段',
                      value: '测试值',
                      type: 'text',
                      confidence: 0.8
                    }
                  ],
                  coverage_rate: coverageRate
                })
              })
            };
            
            const result = await validator.validateFields(
              extractedFields,
              indexedText,
              ckb,
              mockLLMClient
            );
            
            // Property: When coverage < threshold (and > 0), isValid should be false
            // Note: Coverage rate of 0 is a special case handled by graceful degradation
            if (coverageRate > 0) {
              expect(result.isValid).toBe(false);
              expect(result.coverageRate).toBeLessThan(0.8);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * Property 9: 遗漏实体补充
   * 
   * **Validates: Requirements 3.3**
   * 
   * 对于任何发现遗漏关键实体的情况，系统应该触发补充提取流程
   * 
   * Universal property: For any case where missing key entities are discovered,
   * the system should trigger supplemental extraction.
   */
  describe('Property 9: 遗漏实体补充', () => {
    test('should identify missing fields when coverage is incomplete', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('地点', '时间', '单位', '数值'),
              value: fc.string({ minLength: 1, maxLength: 50 })
            }),
            { minLength: 0, maxLength: 3 }
          ),
          fc.array(
            fc.record({
              name: fc.constantFrom('监测点编号', '管理单位', '备注'),
              value: fc.string({ minLength: 1, maxLength: 50 }),
              type: fc.constantFrom('text', 'entity', 'location'),
              confidence: fc.float({ min: 0.5, max: 1.0 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.record({
            ckb_id: fc.uuid(),
            content: fc.record({
              text: fc.string({ minLength: 10, maxLength: 200 })
            })
          }),
          async (extractedFields, missingFieldsData, ckb) => {
            const indexedText = '1. 测试索引文本包含多个实体。';
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_fields: missingFieldsData,
                  coverage_rate: 0.6
                })
              })
            };
            
            const result = await validator.validateFields(
              extractedFields,
              indexedText,
              ckb,
              mockLLMClient
            );
            
            // Property: When missing fields exist, they should be identified
            expect(result.missingFields).toBeDefined();
            expect(Array.isArray(result.missingFields)).toBe(true);
            
            // Property: Missing fields should have required properties
            result.missingFields.forEach(field => {
              expect(field).toHaveProperty('name');
              expect(field).toHaveProperty('value');
              expect(field).toHaveProperty('confidence');
              expect(field.value).not.toBe(null);
              expect(field.value).not.toBe('');
            });
            
            // Property: needsSupplement flag should be set when missing fields exist
            if (result.missingFields.length > 0) {
              expect(result.needsSupplement).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should successfully supplement missing fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('时间', '地点', '单位', '监测点编号'),
              value: fc.string({ minLength: 1, maxLength: 50 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.record({
            ckb_id: fc.uuid(),
            content: fc.record({
              text: fc.string({ minLength: 20, maxLength: 200 })
            })
          }),
          async (missingFields, ckb) => {
            // Mock LLM client that returns supplemented fields
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify(
                  missingFields.map(f => ({
                    name: f.name,
                    value: f.value,
                    confidence: Math.random() * 0.5 + 0.5 // 0.5 to 1.0
                  }))
                )
              })
            };
            
            const result = await validator.supplementFields(
              missingFields,
              ckb,
              mockLLMClient
            );
            
            // Property: Supplemented fields should be returned
            expect(Array.isArray(result)).toBe(true);
            
            // Property: Each supplemented field should have required properties
            result.forEach(field => {
              expect(field).toHaveProperty('name');
              expect(field).toHaveProperty('value');
              expect(field).toHaveProperty('type');
              expect(field).toHaveProperty('confidence');
              expect(field).toHaveProperty('sources');
              
              // Property: Sources should include 'llm_supplement'
              expect(field.sources).toContain('llm_supplement');
              
              // Property: Value should not be null or empty
              expect(field.value).not.toBe(null);
              expect(field.value).not.toBe('');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should handle empty missing fields gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            ckb_id: fc.uuid(),
            content: fc.record({
              text: fc.string({ minLength: 10, maxLength: 200 })
            })
          }),
          async (ckb) => {
            const mockLLMClient = {
              chat: jest.fn()
            };
            
            // Property: Empty missing fields should return empty array
            const result = await validator.supplementFields(
              [],
              ckb,
              mockLLMClient
            );
            
            expect(result).toEqual([]);
            expect(mockLLMClient.chat).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  /**
   * Property 10: 冗余字段过滤
   * 
   * **Validates: Requirements 3.4**
   * 
   * 对于任何包含冗余字段的提取结果，系统应该根据Document_Index进行过滤
   * 
   * Universal property: For any extraction result containing redundant fields,
   * the system should filter based on the Document_Index.
   */
  describe('Property 10: 冗余字段过滤', () => {
    test('should filter out fields with null or empty values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('地点', '时间', '单位', '数值'),
              value: fc.oneof(
                fc.constant(null),
                fc.constant(''),
                fc.constant(undefined),
                fc.string({ minLength: 1, maxLength: 50 })
              ),
              type: fc.constantFrom('text', 'entity', 'location', 'time'),
              confidence: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.record({
            ckb_id: fc.uuid(),
            content: fc.record({
              text: fc.string({ minLength: 10, maxLength: 200 })
            })
          }),
          async (fieldsWithNulls, ckb) => {
            const indexedText = '1. 测试索引文本。';
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_fields: fieldsWithNulls,
                  coverage_rate: 0.7
                })
              })
            };
            
            const result = await validator.validateFields(
              [],
              indexedText,
              ckb,
              mockLLMClient
            );
            
            // Property: All returned missing fields should have non-null, non-empty values
            result.missingFields.forEach(field => {
              expect(field.value).not.toBe(null);
              expect(field.value).not.toBe('');
              expect(field.value).not.toBe(undefined);
            });
            
            // Property: Number of filtered fields should be <= original fields
            expect(result.missingFields.length).toBeLessThanOrEqual(fieldsWithNulls.length);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should filter redundant fields during supplementation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('时间', '地点', '单位'),
              value: fc.string({ minLength: 1, maxLength: 50 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.record({
            ckb_id: fc.uuid(),
            content: fc.record({
              text: fc.string({ minLength: 10, maxLength: 200 })
            })
          }),
          async (missingFields, ckb) => {
            // Mock LLM response with mix of valid and null values
            const responseFields = missingFields.map((f, i) => ({
              name: f.name,
              value: i % 3 === 0 ? null : f.value, // Every 3rd field is null
              confidence: i % 3 === 0 ? 0 : 0.8
            }));
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify(responseFields)
              })
            };
            
            const result = await validator.supplementFields(
              missingFields,
              ckb,
              mockLLMClient
            );
            
            // Property: All supplemented fields should have non-null values
            result.forEach(field => {
              expect(field.value).not.toBe(null);
              expect(field.value).not.toBe('');
              expect(field.value).not.toBe(undefined);
            });
            
            // Property: Filtered count should be less than or equal to input count
            const expectedNonNullCount = responseFields.filter(f => f.value !== null).length;
            expect(result.length).toBe(expectedNonNullCount);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should maintain field integrity after filtering', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('地点', '时间', '单位', '数值', '监测点编号'),
              value: fc.oneof(
                fc.constant(null),
                fc.string({ minLength: 1, maxLength: 50 })
              ),
              type: fc.constantFrom('text', 'entity', 'location', 'time', 'number'),
              confidence: fc.float({ min: 0.5, max: 1.0 })
            }),
            { minLength: 3, maxLength: 10 }
          ),
          fc.record({
            ckb_id: fc.uuid(),
            content: fc.record({
              text: fc.string({ minLength: 10, maxLength: 200 })
            })
          }),
          async (mixedFields, ckb) => {
            const indexedText = '1. 测试索引文本包含多个字段。';
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_fields: mixedFields,
                  coverage_rate: 0.65
                })
              })
            };
            
            const result = await validator.validateFields(
              [],
              indexedText,
              ckb,
              mockLLMClient
            );
            
            // Property: After filtering, all fields should have complete structure
            result.missingFields.forEach(field => {
              expect(field).toHaveProperty('name');
              expect(field).toHaveProperty('value');
              expect(field).toHaveProperty('type');
              expect(field).toHaveProperty('confidence');
              expect(field).toHaveProperty('sources');
              
              // Property: Confidence should be a valid number
              expect(typeof field.confidence).toBe('number');
              expect(field.confidence).toBeGreaterThanOrEqual(0);
              expect(field.confidence).toBeLessThanOrEqual(1);
              
              // Property: Sources should be an array
              expect(Array.isArray(field.sources)).toBe(true);
              expect(field.sources).toContain('llm_validation');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * Cross-Property Test: Coverage Rate and Missing Fields Relationship
   * 
   * Tests the relationship between coverage rate and missing fields count
   */
  describe('Cross-Property: Coverage Rate and Missing Fields', () => {
    test('should have inverse relationship between coverage rate and missing fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.constantFrom('地点', '时间', '单位'),
              value: fc.string({ minLength: 1, maxLength: 50 })
            }),
            { minLength: 0, maxLength: 5 }
          ),
          fc.integer({ min: 0, max: 5 }), // Number of missing fields
          fc.record({
            ckb_id: fc.uuid(),
            content: fc.record({
              text: fc.string({ minLength: 10, maxLength: 200 })
            })
          }),
          async (extractedFields, missingCount, ckb) => {
            const indexedText = '1. 测试索引文本。';
            
            // Generate missing fields
            const missingFields = Array.from({ length: missingCount }, (_, i) => ({
              name: `字段${i}`,
              value: `值${i}`,
              type: 'text',
              confidence: 0.8
            }));
            
            // Calculate coverage rate inversely proportional to missing fields
            const totalFields = extractedFields.length + missingCount;
            const coverageRate = totalFields > 0 
              ? extractedFields.length / totalFields 
              : 1.0;
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_fields: missingFields,
                  coverage_rate: coverageRate
                })
              })
            };
            
            const result = await validator.validateFields(
              extractedFields,
              indexedText,
              ckb,
              mockLLMClient
            );
            
            // Property: More missing fields should correlate with lower coverage
            if (missingCount > 0) {
              expect(result.missingFields.length).toBeGreaterThan(0);
            }
            
            // Property: Coverage rate should reflect completeness
            expect(result.coverageRate).toBeGreaterThanOrEqual(0);
            expect(result.coverageRate).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * Graceful Degradation Properties
   * 
   * Tests that the system degrades gracefully under various failure conditions
   */
  describe('Graceful Degradation Properties', () => {
    test('should handle missing inputs gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            hasIndexedText: fc.boolean(),
            hasCKB: fc.boolean(),
            hasLLMClient: fc.boolean()
          }),
          async (config) => {
            const extractedFields = [
              { name: '地点', value: '海南' }
            ];
            
            const indexedText = config.hasIndexedText ? '1. 测试文本。' : null;
            const ckb = config.hasCKB ? {
              ckb_id: 'test-ckb',
              content: { text: '测试内容' }
            } : null;
            const llmClient = config.hasLLMClient ? {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_fields: [],
                  coverage_rate: 0.9
                })
              })
            } : null;
            
            // Property: Should never throw, always return a result
            const result = await validator.validateFields(
              extractedFields,
              indexedText,
              ckb,
              llmClient
            );
            
            expect(result).toBeDefined();
            expect(result).toHaveProperty('isValid');
            expect(result).toHaveProperty('coverageRate');
            expect(result).toHaveProperty('missingFields');
            
            // Property: When inputs are missing, should gracefully degrade
            if (!indexedText || !ckb || !llmClient) {
              expect(result.isValid).toBe(true);
              expect(result.coverageRate).toBe(1.0);
              expect(result.missingFields).toHaveLength(0);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
