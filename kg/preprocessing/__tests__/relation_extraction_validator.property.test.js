/**
 * Property-Based Tests for Relation Extraction Validator
 * 
 * Tests universal properties that should hold across all inputs:
 * - Property 14: 关系覆盖率验证
 * - Property 15: 遗漏关系补充
 * - Property 16: 错误关系矫正
 * 
 * Validates: Requirements 6.2, 6.3, 6.4
 */

const fc = require('fast-check');
const RelationExtractionValidator = require('../relation_extraction_validator');

describe('RelationExtractionValidator - Property-Based Tests', () => {
  let validator;
  
  beforeEach(() => {
    validator = new RelationExtractionValidator({
      temperature: 0.1,
      timeout: 5000,
      maxRetries: 2,
      coverageThreshold: 0.7
    });
  });
  
  /**
   * Property 14: 关系覆盖率验证
   * 
   * **Validates: Requirements 6.2**
   * 
   * 对于任何关系抽取结果，系统应该验证它覆盖了Document_Index中标识的关键关系，并计算覆盖率
   * 
   * Universal property: For any relation extraction result, the system should verify
   * coverage of key relations identified in the Document_Index and calculate coverage rate.
   */
  describe('Property 14: 关系覆盖率验证', () => {
    test('should always calculate coverage rate between 0 and 1', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate arbitrary extracted relations
          fc.array(
            fc.record({
              subject_id: fc.uuid(),
              subject_name: fc.constantFrom('阿里C区', '海南省', '水文局', '监测点'),
              relation_type: fc.constantFrom('located_in', 'managed_by', 'monitors', 'belongs_to'),
              relation_description: fc.constantFrom('位于', '管理者', '监测', '属于'),
              object_id: fc.uuid(),
              object_name: fc.constantFrom('海南省', '海口市', '水文局', '美兰区')
            }),
            { minLength: 0, maxLength: 10 }
          ),
          // Generate arbitrary indexed text
          fc.string({ minLength: 20, maxLength: 500 }),
          // Generate arbitrary entities
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.constantFrom('阿里C区', '海南省', '水文局', '监测点', '海口市'),
              entity_type: fc.constantFrom('Location', 'Organization', 'MonitoringPoint')
            }),
            { minLength: 2, maxLength: 10 }
          ),
          async (extractedRelations, indexedText, entities) => {
            // Mock LLM client that returns valid coverage rate
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_relations: [],
                  coverage_rate: Math.random() // Random but valid coverage rate
                })
              })
            };
            
            const result = await validator.validateRelations(
              extractedRelations,
              indexedText,
              entities,
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
              subject_id: fc.uuid(),
              subject_name: fc.constantFrom('实体A', '实体B', '实体C'),
              relation_type: fc.constantFrom('关系1', '关系2', '关系3'),
              object_id: fc.uuid(),
              object_name: fc.constantFrom('实体X', '实体Y', '实体Z')
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.float({ min: Math.fround(0.7), max: Math.fround(1.0) }), // Coverage rate >= threshold
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization', 'Person')
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (extractedRelations, coverageRate, entities) => {
            const indexedText = '1. 测试索引文本包含多个关系。';
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_relations: [],
                  coverage_rate: coverageRate
                })
              })
            };
            
            const result = await validator.validateRelations(
              extractedRelations,
              indexedText,
              entities,
              mockLLMClient
            );
            
            // Property: When coverage >= threshold (0.7), isValid should be true
            // Allow small floating point tolerance
            if (coverageRate >= 0.7) {
              expect(result.isValid).toBe(true);
              expect(result.coverageRate).toBeGreaterThanOrEqual(0.69); // Small tolerance
            }
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
              subject_id: fc.uuid(),
              subject_name: fc.constantFrom('实体A', '实体B'),
              relation_type: fc.constantFrom('关系1', '关系2'),
              object_id: fc.uuid(),
              object_name: fc.constantFrom('实体X', '实体Y')
            }),
            { minLength: 0, maxLength: 3 }
          ),
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.69) }), // Coverage rate < threshold
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization')
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (extractedRelations, coverageRate, entities) => {
            const indexedText = '1. 测试索引文本包含多个关系。';
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_relations: [
                    {
                      subject: '遗漏实体A',
                      relation: '遗漏关系',
                      object: '遗漏实体B',
                      type: 'semantic',
                      confidence: 0.8
                    }
                  ],
                  coverage_rate: coverageRate
                })
              })
            };
            
            const result = await validator.validateRelations(
              extractedRelations,
              indexedText,
              entities,
              mockLLMClient
            );
            
            // Property: When coverage < threshold (and > 0), isValid should be false
            if (coverageRate > 0) {
              expect(result.isValid).toBe(false);
              expect(result.coverageRate).toBeLessThan(0.7);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should calculate coverage based on extracted vs expected relations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }), // Number of extracted relations (at least 1)
          fc.integer({ min: 0, max: 5 }), // Number of missing relations
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization', 'Person')
            }),
            { minLength: 2, maxLength: 8 }
          ),
          async (extractedCount, missingCount, entities) => {
            const extractedRelations = Array.from({ length: extractedCount }, (_, i) => ({
              subject_id: `entity_${i}`,
              subject_name: `实体${i}`,
              relation_type: `关系${i}`,
              object_id: `entity_${i + 1}`,
              object_name: `实体${i + 1}`
            }));
            
            const missingRelations = Array.from({ length: missingCount }, (_, i) => ({
              subject: `遗漏实体${i}`,
              relation: `遗漏关系${i}`,
              object: `遗漏实体${i + 1}`,
              type: 'semantic',
              confidence: 0.8
            }));
            
            const totalRelations = extractedCount + missingCount;
            const expectedCoverage = extractedCount / totalRelations;
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_relations: missingRelations,
                  coverage_rate: expectedCoverage
                })
              })
            };
            
            const result = await validator.validateRelations(
              extractedRelations,
              '1. 测试索引文本。',
              entities,
              mockLLMClient
            );
            
            // Property: Coverage rate should reflect the ratio of extracted to total relations
            expect(result.coverageRate).toBeCloseTo(expectedCoverage, 2);
            
            // Property: Missing relations count should match
            expect(result.missingRelations.length).toBe(missingCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * Property 15: 遗漏关系补充
   * 
   * **Validates: Requirements 6.3**
   * 
   * 对于任何发现遗漏关键关系的情况，系统应该触发补充抽取流程
   * 
   * Universal property: For any case where missing key relations are discovered,
   * the system should trigger supplemental extraction.
   */
  describe('Property 15: 遗漏关系补充', () => {
    test('should identify missing relations when coverage is incomplete', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              subject_id: fc.uuid(),
              subject_name: fc.constantFrom('实体A', '实体B', '实体C'),
              relation_type: fc.constantFrom('关系1', '关系2'),
              object_id: fc.uuid(),
              object_name: fc.constantFrom('实体X', '实体Y')
            }),
            { minLength: 0, maxLength: 3 }
          ),
          fc.array(
            fc.record({
              subject: fc.constantFrom('遗漏实体A', '遗漏实体B', '遗漏实体C'),
              relation: fc.constantFrom('遗漏关系1', '遗漏关系2', '遗漏关系3'),
              object: fc.constantFrom('遗漏实体X', '遗漏实体Y', '遗漏实体Z'),
              type: fc.constantFrom('semantic', 'structural', 'temporal'),
              confidence: fc.float({ min: 0.5, max: 1.0 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization', 'Person')
            }),
            { minLength: 2, maxLength: 8 }
          ),
          async (extractedRelations, missingRelationsData, entities) => {
            const indexedText = '1. 测试索引文本包含多个关系。';
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_relations: missingRelationsData,
                  coverage_rate: 0.5
                })
              })
            };
            
            const result = await validator.validateRelations(
              extractedRelations,
              indexedText,
              entities,
              mockLLMClient
            );
            
            // Property: When missing relations exist, they should be identified
            expect(result.missingRelations).toBeDefined();
            expect(Array.isArray(result.missingRelations)).toBe(true);
            
            // Property: Missing relations should have required properties
            result.missingRelations.forEach(relation => {
              expect(relation).toHaveProperty('subject');
              expect(relation).toHaveProperty('relation');
              expect(relation).toHaveProperty('object');
              expect(relation).toHaveProperty('confidence');
              expect(relation.subject).not.toBe(null);
              expect(relation.subject).not.toBe('');
              expect(relation.object).not.toBe(null);
              expect(relation.object).not.toBe('');
            });
            
            // Property: needsSupplement flag should be set when missing relations exist
            if (result.missingRelations.length > 0) {
              expect(result.needsSupplement).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should successfully supplement missing relations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              subject: fc.constantFrom('阿里C区', '海南省', '水文局'),
              relation: fc.constantFrom('位于', '管理者', '监测'),
              object: fc.constantFrom('海南省', '海口市', '监测点')
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.constantFrom('阿里C区', '海南省', '水文局', '海口市', '监测点'),
              entity_type: fc.constantFrom('Location', 'Organization', 'MonitoringPoint')
            }),
            { minLength: 3, maxLength: 8 }
          ),
          async (missingRelations, entities) => {
            // Mock LLM client that returns supplemented relations
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify(
                  missingRelations.map((r, i) => ({
                    subject_id: entities[i % entities.length].entity_id,
                    subject_name: r.subject,
                    relation_type: r.relation.replace(/\s/g, '_'),
                    relation_description: r.relation,
                    object_id: entities[(i + 1) % entities.length].entity_id,
                    object_name: r.object,
                    confidence: Math.random() * 0.5 + 0.5 // 0.5 to 1.0
                  }))
                )
              })
            };
            
            const result = await validator.supplementRelations(
              missingRelations,
              entities,
              mockLLMClient
            );
            
            // Property: Supplemented relations should be returned
            expect(Array.isArray(result)).toBe(true);
            
            // Property: Each supplemented relation should have required properties
            result.forEach(relation => {
              expect(relation).toHaveProperty('subject_id');
              expect(relation).toHaveProperty('subject_name');
              expect(relation).toHaveProperty('relation_type');
              expect(relation).toHaveProperty('relation_description');
              expect(relation).toHaveProperty('object_id');
              expect(relation).toHaveProperty('object_name');
              expect(relation).toHaveProperty('confidence');
              expect(relation).toHaveProperty('sources');
              
              // Property: Sources should include 'llm_supplement'
              expect(relation.sources).toContain('llm_supplement');
              
              // Property: IDs should not be null or empty
              expect(relation.subject_id).not.toBe(null);
              expect(relation.subject_id).not.toBe('');
              expect(relation.object_id).not.toBe(null);
              expect(relation.object_id).not.toBe('');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should handle empty missing relations gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization')
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (entities) => {
            const mockLLMClient = {
              chat: jest.fn()
            };
            
            // Property: Empty missing relations should return empty array
            const result = await validator.supplementRelations(
              [],
              entities,
              mockLLMClient
            );
            
            expect(result).toEqual([]);
            expect(mockLLMClient.chat).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('should trigger supplement when coverage is below threshold', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              subject_id: fc.uuid(),
              relation_type: fc.constantFrom('关系1', '关系2'),
              object_id: fc.uuid()
            }),
            { minLength: 0, maxLength: 2 }
          ),
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.69) }),
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization')
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (extractedRelations, lowCoverage, entities) => {
            const missingRelations = [
              {
                subject: '遗漏实体A',
                relation: '遗漏关系',
                object: '遗漏实体B',
                type: 'semantic',
                confidence: 0.8
              }
            ];
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_relations: missingRelations,
                  coverage_rate: lowCoverage
                })
              })
            };
            
            const result = await validator.validateRelations(
              extractedRelations,
              '1. 测试索引文本。',
              entities,
              mockLLMClient
            );
            
            // Property: Low coverage should trigger supplement flag
            if (lowCoverage < 0.7 && result.missingRelations.length > 0) {
              expect(result.needsSupplement).toBe(true);
              expect(result.isValid).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * Property 16: 错误关系矫正
   * 
   * **Validates: Requirements 6.4**
   * 
   * 对于任何包含错误关系的抽取结果，系统应该根据Document_Index进行过滤或修正
   * 
   * Universal property: For any extraction result containing incorrect relations,
   * the system should filter or correct based on the Document_Index.
   */
  describe('Property 16: 错误关系矫正', () => {
    test('should filter out relations with null or empty values', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              subject: fc.oneof(
                fc.constant(null),
                fc.constant(''),
                fc.constant(undefined),
                fc.string({ minLength: 1, maxLength: 50 })
              ),
              relation: fc.oneof(
                fc.constant(null),
                fc.constant(''),
                fc.string({ minLength: 1, maxLength: 50 })
              ),
              object: fc.oneof(
                fc.constant(null),
                fc.constant(''),
                fc.constant(undefined),
                fc.string({ minLength: 1, maxLength: 50 })
              ),
              type: fc.constantFrom('semantic', 'structural', 'temporal'),
              confidence: fc.float({ min: 0, max: 1 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization')
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (relationsWithNulls, entities) => {
            const indexedText = '1. 测试索引文本。';
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_relations: relationsWithNulls,
                  coverage_rate: 0.6
                })
              })
            };
            
            const result = await validator.validateRelations(
              [],
              indexedText,
              entities,
              mockLLMClient
            );
            
            // Property: All returned missing relations should have non-null, non-empty values
            result.missingRelations.forEach(relation => {
              expect(relation.subject).not.toBe(null);
              expect(relation.subject).not.toBe('');
              expect(relation.subject).not.toBe(undefined);
              expect(relation.object).not.toBe(null);
              expect(relation.object).not.toBe('');
              expect(relation.object).not.toBe(undefined);
              expect(relation.relation).not.toBe(null);
              expect(relation.relation).not.toBe('');
            });
            
            // Property: Number of filtered relations should be <= original relations
            expect(result.missingRelations.length).toBeLessThanOrEqual(relationsWithNulls.length);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should filter incomplete relations during supplementation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              subject: fc.string({ minLength: 1, maxLength: 50 }),
              relation: fc.string({ minLength: 1, maxLength: 50 }),
              object: fc.string({ minLength: 1, maxLength: 50 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization')
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (missingRelations, entities) => {
            // Mock LLM response with mix of valid and incomplete relations
            const responseRelations = missingRelations.map((r, i) => ({
              subject_id: i % 3 === 0 ? null : entities[0].entity_id, // Every 3rd is null
              subject_name: r.subject,
              relation_type: r.relation,
              relation_description: r.relation,
              object_id: i % 3 === 0 ? null : entities[1].entity_id, // Every 3rd is null
              object_name: r.object,
              confidence: 0.8
            }));
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify(responseRelations)
              })
            };
            
            const result = await validator.supplementRelations(
              missingRelations,
              entities,
              mockLLMClient
            );
            
            // Property: All supplemented relations should have non-null IDs
            result.forEach(relation => {
              expect(relation.subject_id).not.toBe(null);
              expect(relation.subject_id).not.toBe('');
              expect(relation.object_id).not.toBe(null);
              expect(relation.object_id).not.toBe('');
              expect(relation.relation_type).not.toBe(null);
              expect(relation.relation_type).not.toBe('');
            });
            
            // Property: Filtered count should be less than or equal to input count
            const expectedValidCount = responseRelations.filter(
              r => r.subject_id && r.object_id && r.relation_type
            ).length;
            expect(result.length).toBe(expectedValidCount);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should maintain relation integrity after filtering', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              subject: fc.oneof(
                fc.constant(null),
                fc.string({ minLength: 1, maxLength: 50 })
              ),
              relation: fc.oneof(
                fc.constant(null),
                fc.string({ minLength: 1, maxLength: 50 })
              ),
              object: fc.oneof(
                fc.constant(null),
                fc.string({ minLength: 1, maxLength: 50 })
              ),
              type: fc.constantFrom('semantic', 'structural', 'temporal'),
              confidence: fc.float({ min: 0.5, max: 1.0 })
            }),
            { minLength: 3, maxLength: 10 }
          ),
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization', 'Person')
            }),
            { minLength: 2, maxLength: 8 }
          ),
          async (mixedRelations, entities) => {
            const indexedText = '1. 测试索引文本包含多个关系。';
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_relations: mixedRelations,
                  coverage_rate: 0.55
                })
              })
            };
            
            const result = await validator.validateRelations(
              [],
              indexedText,
              entities,
              mockLLMClient
            );
            
            // Property: After filtering, all relations should have complete structure
            result.missingRelations.forEach(relation => {
              expect(relation).toHaveProperty('subject');
              expect(relation).toHaveProperty('relation');
              expect(relation).toHaveProperty('object');
              expect(relation).toHaveProperty('type');
              expect(relation).toHaveProperty('confidence');
              
              // Property: Confidence should be a valid number
              expect(typeof relation.confidence).toBe('number');
              expect(relation.confidence).toBeGreaterThanOrEqual(0);
              expect(relation.confidence).toBeLessThanOrEqual(1);
              
              // Property: All required fields should be non-empty
              expect(relation.subject).not.toBe(null);
              expect(relation.subject).not.toBe('');
              expect(relation.object).not.toBe(null);
              expect(relation.object).not.toBe('');
              expect(relation.relation).not.toBe(null);
              expect(relation.relation).not.toBe('');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should validate relation types are consistent', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              subject_id: fc.uuid(),
              subject_name: fc.string({ minLength: 2, maxLength: 30 }),
              relation_type: fc.constantFrom('located_in', 'managed_by', 'monitors', 'belongs_to', 'part_of'),
              relation_description: fc.string({ minLength: 2, maxLength: 30 }),
              object_id: fc.uuid(),
              object_name: fc.string({ minLength: 2, maxLength: 30 })
            }),
            { minLength: 1, maxLength: 8 }
          ),
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization', 'Person')
            }),
            { minLength: 2, maxLength: 8 }
          ),
          async (extractedRelations, entities) => {
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_relations: [],
                  coverage_rate: 0.9
                })
              })
            };
            
            const result = await validator.validateRelations(
              extractedRelations,
              '1. 测试索引文本。',
              entities,
              mockLLMClient
            );
            
            // Property: All relations should have valid relation types
            extractedRelations.forEach(relation => {
              expect(relation.relation_type).toBeDefined();
              expect(typeof relation.relation_type).toBe('string');
              expect(relation.relation_type.length).toBeGreaterThan(0);
            });
            
            // Property: Result should maintain relation type information
            expect(result).toHaveProperty('coverageRate');
            expect(result).toHaveProperty('missingRelations');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * Cross-Property Test: Coverage Rate and Missing Relations Relationship
   * 
   * Tests the relationship between coverage rate and missing relations count
   */
  describe('Cross-Property: Coverage Rate and Missing Relations', () => {
    test('should have inverse relationship between coverage rate and missing relations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10 }), // Number of extracted relations
          fc.integer({ min: 0, max: 5 }), // Number of missing relations
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization', 'Person')
            }),
            { minLength: 2, maxLength: 8 }
          ),
          async (extractedCount, missingCount, entities) => {
            const extractedRelations = Array.from({ length: extractedCount }, (_, i) => ({
              subject_id: `entity_${i}`,
              subject_name: `实体${i}`,
              relation_type: `关系${i}`,
              object_id: `entity_${i + 1}`,
              object_name: `实体${i + 1}`
            }));
            
            const missingRelations = Array.from({ length: missingCount }, (_, i) => ({
              subject: `遗漏实体${i}`,
              relation: `遗漏关系${i}`,
              object: `遗漏实体${i + 1}`,
              type: 'semantic',
              confidence: 0.8
            }));
            
            const totalRelations = extractedCount + missingCount;
            const expectedCoverage = totalRelations > 0 ? extractedCount / totalRelations : 1.0;
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_relations: missingRelations,
                  coverage_rate: expectedCoverage
                })
              })
            };
            
            const result = await validator.validateRelations(
              extractedRelations,
              '1. 测试索引文本。',
              entities,
              mockLLMClient
            );
            
            // Property: More missing relations should correlate with lower coverage
            if (missingCount > 0) {
              expect(result.missingRelations.length).toBeGreaterThan(0);
            }
            
            // Property: Coverage rate should reflect completeness
            expect(result.coverageRate).toBeGreaterThanOrEqual(0);
            expect(result.coverageRate).toBeLessThanOrEqual(1);
            
            // Property: When no relations exist, coverage should be 1.0 (complete)
            if (extractedCount === 0 && missingCount === 0) {
              expect(result.coverageRate).toBe(1.0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should maintain consistency between needsSupplement flag and missing relations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              subject_id: fc.uuid(),
              relation_type: fc.string({ minLength: 2, maxLength: 20 }),
              object_id: fc.uuid()
            }),
            { minLength: 0, maxLength: 5 }
          ),
          fc.boolean(), // Whether to include missing relations
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization')
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (extractedRelations, hasMissing, entities) => {
            const missingRelations = hasMissing ? [
              {
                subject: '遗漏实体',
                relation: '遗漏关系',
                object: '遗漏对象',
                type: 'semantic',
                confidence: 0.8
              }
            ] : [];
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_relations: missingRelations,
                  coverage_rate: hasMissing ? 0.6 : 1.0
                })
              })
            };
            
            const result = await validator.validateRelations(
              extractedRelations,
              '1. 测试索引文本。',
              entities,
              mockLLMClient
            );
            
            // Property: needsSupplement should be true iff missing relations exist
            if (result.missingRelations.length > 0) {
              expect(result.needsSupplement).toBe(true);
            } else {
              expect(result.needsSupplement).toBeFalsy();
            }
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
            hasEntities: fc.boolean(),
            hasLLMClient: fc.boolean()
          }),
          async (config) => {
            const extractedRelations = [
              { subject_id: 'e1', relation_type: 'r1', object_id: 'e2' }
            ];
            
            const indexedText = config.hasIndexedText ? '1. 测试文本。' : null;
            const entities = config.hasEntities ? [
              { entity_id: 'e1', canonical_name: '实体1' },
              { entity_id: 'e2', canonical_name: '实体2' }
            ] : [];
            const llmClient = config.hasLLMClient ? {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_relations: [],
                  coverage_rate: 0.9
                })
              })
            } : null;
            
            // Property: Should never throw, always return a result
            const result = await validator.validateRelations(
              extractedRelations,
              indexedText,
              entities,
              llmClient
            );
            
            expect(result).toBeDefined();
            expect(result).toHaveProperty('isValid');
            expect(result).toHaveProperty('coverageRate');
            expect(result).toHaveProperty('missingRelations');
            
            // Property: When inputs are missing, should gracefully degrade
            if (!indexedText || !entities || entities.length === 0 || !llmClient) {
              expect(result.isValid).toBe(true);
              expect(result.coverageRate).toBe(1.0);
              expect(result.missingRelations).toHaveLength(0);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('should handle LLM failures gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              subject_id: fc.uuid(),
              relation_type: fc.string({ minLength: 2, maxLength: 20 }),
              object_id: fc.uuid()
            }),
            { minLength: 0, maxLength: 5 }
          ),
          fc.constantFrom(
            'Network error',
            'Timeout',
            'Service unavailable',
            'Rate limit exceeded'
          ),
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization')
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (extractedRelations, errorMessage, entities) => {
            const mockLLMClient = {
              chat: jest.fn().mockRejectedValue(new Error(errorMessage))
            };
            
            // Property: Should handle LLM errors gracefully
            const result = await validator.validateRelations(
              extractedRelations,
              '1. 测试文本。',
              entities,
              mockLLMClient
            );
            
            expect(result).toBeDefined();
            expect(result.isValid).toBe(true); // Fallback to valid
            expect(result.coverageRate).toBe(1.0);
            expect(result.error).toBeDefined();
          }
        ),
        { numRuns: 20, timeout: 30000 } // Reduce runs and increase timeout for retry logic
      );
    }, 35000); // Increase Jest timeout to 35 seconds
    
    test('should handle malformed LLM responses gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              subject_id: fc.uuid(),
              relation_type: fc.string({ minLength: 2, maxLength: 20 }),
              object_id: fc.uuid()
            }),
            { minLength: 0, maxLength: 5 }
          ),
          fc.oneof(
            fc.constant('Not JSON'),
            fc.constant('{"incomplete": '),
            fc.constant(''),
            fc.constant('null'),
            fc.constant('[]')
          ),
          fc.array(
            fc.record({
              entity_id: fc.uuid(),
              canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
              entity_type: fc.constantFrom('Location', 'Organization')
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (extractedRelations, malformedResponse, entities) => {
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: malformedResponse
              })
            };
            
            // Property: Should handle malformed responses gracefully
            const result = await validator.validateRelations(
              extractedRelations,
              '1. 测试文本。',
              entities,
              mockLLMClient
            );
            
            expect(result).toBeDefined();
            expect(result.isValid).toBe(true); // Fallback to safe default
            expect(result.coverageRate).toBe(1.0);
            
            // Only check for parse error if response is truly malformed (not valid JSON)
            if (malformedResponse !== '[]' && malformedResponse !== 'null') {
              expect(result.parseError || result.reason).toBeDefined();
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  /**
   * Batch Validation Properties
   * 
   * Tests properties of batch validation operations
   */
  describe('Batch Validation Properties', () => {
    test('should validate all documents in batch', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              relations: fc.array(
                fc.record({
                  subject_id: fc.uuid(),
                  subject_name: fc.string({ minLength: 2, maxLength: 20 }),
                  relation_type: fc.constantFrom('关系1', '关系2', '关系3'),
                  object_id: fc.uuid(),
                  object_name: fc.string({ minLength: 2, maxLength: 20 })
                }),
                { minLength: 0, maxLength: 5 }
              ),
              indexedText: fc.string({ minLength: 20, maxLength: 200 }),
              entities: fc.array(
                fc.record({
                  entity_id: fc.uuid(),
                  canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
                  entity_type: fc.constantFrom('Location', 'Organization', 'Person')
                }),
                { minLength: 2, maxLength: 8 }
              )
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (documentsWithRelations) => {
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  missing_relations: [],
                  coverage_rate: 0.85
                })
              })
            };
            
            const results = await validator.batchValidateRelations(
              documentsWithRelations,
              mockLLMClient,
              { maxConcurrency: 3 }
            );
            
            // Property: Should return results for all documents
            expect(results.size).toBe(documentsWithRelations.length);
            
            // Property: Each result should have required properties
            results.forEach((result, index) => {
              expect(result).toHaveProperty('isValid');
              expect(result).toHaveProperty('coverageRate');
              expect(result).toHaveProperty('missingRelations');
              expect(typeof result.isValid).toBe('boolean');
              expect(typeof result.coverageRate).toBe('number');
              expect(Array.isArray(result.missingRelations)).toBe(true);
            });
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('should handle empty batch gracefully', async () => {
      const mockLLMClient = {
        chat: jest.fn()
      };
      
      const results = await validator.batchValidateRelations(
        [],
        mockLLMClient
      );
      
      // Property: Empty batch should return empty results
      expect(results.size).toBe(0);
      expect(mockLLMClient.chat).not.toHaveBeenCalled();
    });
  });
  
  /**
   * Validation Statistics Properties
   * 
   * Tests properties of validation statistics calculation
   */
  describe('Validation Statistics Properties', () => {
    test('should calculate accurate statistics from validation results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              isValid: fc.boolean(),
              coverageRate: fc.float({ min: 0, max: 1 }),
              missingRelations: fc.array(
                fc.record({
                  subject: fc.string({ minLength: 1, maxLength: 20 })
                }),
                { minLength: 0, maxLength: 5 }
              )
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (validationResults) => {
            const resultsMap = new Map(
              validationResults.map((result, index) => [index, result])
            );
            
            const stats = validator.getValidationStats(resultsMap);
            
            // Property: Total docs should match input size
            expect(stats.totalDocs).toBe(validationResults.length);
            
            // Property: Valid + invalid should equal total
            expect(stats.validDocs + stats.invalidDocs).toBe(stats.totalDocs);
            
            // Property: Valid rate should be between 0 and 1
            const validRate = parseFloat(stats.validRate);
            expect(validRate).toBeGreaterThanOrEqual(0);
            expect(validRate).toBeLessThanOrEqual(1);
            
            // Property: Average coverage rate should be between 0 and 1
            const avgCoverage = parseFloat(stats.avgCoverageRate);
            expect(avgCoverage).toBeGreaterThanOrEqual(0);
            expect(avgCoverage).toBeLessThanOrEqual(1);
            
            // Property: Total missing relations should be sum of all missing
            const expectedTotal = validationResults.reduce(
              (sum, r) => sum + r.missingRelations.length,
              0
            );
            expect(stats.totalMissingRelations).toBe(expectedTotal);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
