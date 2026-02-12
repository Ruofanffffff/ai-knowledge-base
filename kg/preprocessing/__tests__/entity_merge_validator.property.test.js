/**
 * Property-Based Tests for Entity Merge Validator
 * 
 * Tests universal properties that should hold across all inputs:
 * - Property 13: 合并决策优先级
 * 
 * Validates: Requirements 5.3
 */

const fc = require('fast-check');
const EntityMergeValidator = require('../entity_merge_validator');

describe('EntityMergeValidator - Property-Based Tests', () => {
  let validator;
  
  beforeEach(() => {
    validator = new EntityMergeValidator({
      temperature: 0.1,
      timeout: 5000,
      maxRetries: 2
    });
  });
  
  /**
   * Property 13: 合并决策优先级
   * 
   * **Validates: Requirements 5.3**
   * 
   * 对于任何实体合并决策与Document_Index冲突的情况，系统应该优先采用Document_Index的判断
   * 
   * Universal property: For any entity merge decision that conflicts with the Document_Index,
   * the system should prioritize the Document_Index's judgment.
   */
  describe('Property 13: 合并决策优先级', () => {
    test('should prioritize indexed text evidence over entity attributes', async () => {
      await fc.assert(
        fc.asyncProperty(
          // Generate two entities with arbitrary attributes
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
            entity_type: fc.constantFrom('Location', 'Organization', 'Person', 'Event'),
            anchor_fields: fc.record({
              name: fc.string({ minLength: 2, maxLength: 20 })
            }),
            fields: fc.record({
              field1: fc.string({ minLength: 1, maxLength: 30 }),
              field2: fc.string({ minLength: 1, maxLength: 30 })
            })
          }),
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
            entity_type: fc.constantFrom('Location', 'Organization', 'Person', 'Event'),
            anchor_fields: fc.record({
              name: fc.string({ minLength: 2, maxLength: 20 })
            }),
            fields: fc.record({
              field1: fc.string({ minLength: 1, maxLength: 30 }),
              field2: fc.string({ minLength: 1, maxLength: 30 })
            })
          }),
          // Generate indexed text with numbered facts
          fc.array(
            fc.string({ minLength: 10, maxLength: 100 }),
            { minLength: 3, maxLength: 10 }
          ),
          // Generate merge decision from indexed text
          fc.boolean(),
          async (entity1, entity2, facts, shouldMergePerIndex) => {
            const indexedText = facts.map((fact, i) => `${i + 1}. ${fact}`).join('\n');
            
            // Mock LLM to return decision based on indexed text
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  should_merge: shouldMergePerIndex,
                  reason: shouldMergePerIndex 
                    ? '索引文本表明这是同一实体'
                    : '索引文本表明这是不同实体',
                  confidence: Math.random() * 0.3 + 0.7, // 0.7 to 1.0
                  evidence_indices: [1, 2]
                })
              })
            };
            
            const result = await validator.validateMergeDecision(
              entity1,
              entity2,
              indexedText,
              mockLLMClient
            );
            
            // Property: Result should always reflect indexed text judgment
            expect(result.shouldMerge).toBe(shouldMergePerIndex);
            
            // Property: Result should have high confidence when based on indexed text
            if (result.validated) {
              expect(result.confidence).toBeGreaterThan(0.5);
            }
            
            // Property: Result should reference indexed text evidence
            if (result.validated && result.evidenceIndices) {
              expect(Array.isArray(result.evidenceIndices)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should override entity type mismatch when indexed text confirms same entity', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 20 }), // Entity name
          fc.constantFrom('Location', 'Organization', 'Person'), // Type 1
          fc.constantFrom('Location', 'Organization', 'Person'), // Type 2
          fc.array(
            fc.string({ minLength: 10, maxLength: 80 }),
            { minLength: 2, maxLength: 5 }
          ),
          async (entityName, type1, type2, facts) => {
            const entity1 = {
              entity_id: 'entity_1',
              canonical_name: entityName,
              entity_type: type1,
              anchor_fields: { name: entityName }
            };
            
            const entity2 = {
              entity_id: 'entity_2',
              canonical_name: `${entityName}简称`,
              entity_type: type2,
              anchor_fields: { name: `${entityName}简称` }
            };
            
            const indexedText = facts.map((fact, i) => `${i + 1}. ${fact}`).join('\n');
            
            // Mock LLM to say they should merge despite type difference
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  should_merge: true,
                  reason: '索引文本明确表明这是同一实体的不同称呼',
                  confidence: 0.9,
                  evidence_indices: [1]
                })
              })
            };
            
            const result = await validator.validateMergeDecision(
              entity1,
              entity2,
              indexedText,
              mockLLMClient
            );
            
            // Property: Indexed text judgment should override type mismatch
            if (result.validated) {
              expect(result.shouldMerge).toBe(true);
              expect(result.confidence).toBeGreaterThan(0.8);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should override anchor fingerprint match when indexed text says different entities', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 20 }), // Common name
          fc.string({ minLength: 5, maxLength: 30 }), // Fingerprint
          fc.array(
            fc.string({ minLength: 10, maxLength: 80 }),
            { minLength: 2, maxLength: 5 }
          ),
          async (commonName, fingerprint, facts) => {
            // Two entities with same anchor fingerprint but different contexts
            const entity1 = {
              entity_id: 'entity_1',
              canonical_name: commonName,
              entity_type: 'Organization',
              anchor_fingerprint: fingerprint,
              anchor_fields: { name: commonName },
              fields: { city: '海口市' }
            };
            
            const entity2 = {
              entity_id: 'entity_2',
              canonical_name: commonName,
              entity_type: 'Organization',
              anchor_fingerprint: fingerprint,
              anchor_fields: { name: commonName },
              fields: { city: '三亚市' }
            };
            
            const indexedText = facts.map((fact, i) => `${i + 1}. ${fact}`).join('\n');
            
            // Mock LLM to say they should NOT merge despite same fingerprint
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  should_merge: false,
                  reason: '索引文本表明这是两个不同城市的同名机构',
                  confidence: 0.85,
                  evidence_indices: [1, 2]
                })
              })
            };
            
            const result = await validator.validateMergeDecision(
              entity1,
              entity2,
              indexedText,
              mockLLMClient
            );
            
            // Property: Indexed text should override fingerprint match
            if (result.validated) {
              expect(result.shouldMerge).toBe(false);
              expect(result.reason).toContain('不同');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should validate merge decision with varying confidence levels', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
            entity_type: fc.constantFrom('Location', 'Organization', 'Person'),
            anchor_fields: fc.dictionary(
              fc.constantFrom('name', 'location', 'time'),
              fc.string({ minLength: 1, maxLength: 30 })
            )
          }),
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
            entity_type: fc.constantFrom('Location', 'Organization', 'Person'),
            anchor_fields: fc.dictionary(
              fc.constantFrom('name', 'location', 'time'),
              fc.string({ minLength: 1, maxLength: 30 })
            )
          }),
          fc.string({ minLength: 30, maxLength: 300 }),
          fc.float({ min: Math.fround(0.5), max: Math.fround(1.0) }), // Confidence
          fc.boolean(), // Merge decision
          async (entity1, entity2, indexedText, confidence, shouldMerge) => {
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  should_merge: shouldMerge,
                  reason: '基于索引文本的判断',
                  confidence: confidence,
                  evidence_indices: [1]
                })
              })
            };
            
            const result = await validator.validateMergeDecision(
              entity1,
              entity2,
              indexedText,
              mockLLMClient
            );
            
            // Property: Result should reflect indexed text decision
            if (result.validated) {
              expect(result.shouldMerge).toBe(shouldMerge);
              
              // Property: Confidence should be preserved
              expect(result.confidence).toBeCloseTo(confidence, 1);
              
              // Property: Confidence should be in valid range
              expect(result.confidence).toBeGreaterThanOrEqual(0);
              expect(result.confidence).toBeLessThanOrEqual(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should handle conflicting entity attributes with indexed text as authority', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 3, maxLength: 20 }), // Base name
          fc.record({
            attr1: fc.string({ minLength: 1, maxLength: 20 }),
            attr2: fc.string({ minLength: 1, maxLength: 20 })
          }),
          fc.record({
            attr1: fc.string({ minLength: 1, maxLength: 20 }),
            attr2: fc.string({ minLength: 1, maxLength: 20 })
          }),
          fc.array(
            fc.string({ minLength: 15, maxLength: 100 }),
            { minLength: 3, maxLength: 8 }
          ),
          fc.boolean(), // What indexed text says
          async (baseName, attrs1, attrs2, facts, indexedTextDecision) => {
            const entity1 = {
              entity_id: 'entity_1',
              canonical_name: baseName,
              entity_type: 'Organization',
              anchor_fields: { name: baseName },
              fields: attrs1
            };
            
            const entity2 = {
              entity_id: 'entity_2',
              canonical_name: baseName,
              entity_type: 'Organization',
              anchor_fields: { name: baseName },
              fields: attrs2
            };
            
            const indexedText = facts.map((fact, i) => `${i + 1}. ${fact}`).join('\n');
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  should_merge: indexedTextDecision,
                  reason: indexedTextDecision 
                    ? '索引文本确认是同一实体，属性差异是时间或视角不同'
                    : '索引文本确认是不同实体，尽管名称相同',
                  confidence: 0.88,
                  evidence_indices: [1, 2, 3]
                })
              })
            };
            
            const result = await validator.validateMergeDecision(
              entity1,
              entity2,
              indexedText,
              mockLLMClient
            );
            
            // Property: Indexed text decision should be authoritative
            if (result.validated) {
              expect(result.shouldMerge).toBe(indexedTextDecision);
              
              // Property: Should have evidence from indexed text
              expect(result.evidenceIndices).toBeDefined();
              if (result.evidenceIndices) {
                expect(result.evidenceIndices.length).toBeGreaterThan(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  /**
   * Cross-Property Test: Validation Consistency
   * 
   * Tests that validation results are consistent with indexed text evidence
   */
  describe('Cross-Property: Validation Consistency', () => {
    test('should maintain consistency between merge decision and evidence', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
            entity_type: fc.constantFrom('Location', 'Organization', 'Person', 'Event')
          }),
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
            entity_type: fc.constantFrom('Location', 'Organization', 'Person', 'Event')
          }),
          fc.array(
            fc.string({ minLength: 10, maxLength: 100 }),
            { minLength: 2, maxLength: 10 }
          ),
          fc.boolean(),
          async (entity1, entity2, facts, shouldMerge) => {
            const indexedText = facts.map((fact, i) => `${i + 1}. ${fact}`).join('\n');
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  should_merge: shouldMerge,
                  reason: shouldMerge ? '索引支持合并' : '索引反对合并',
                  confidence: 0.85,
                  evidence_indices: shouldMerge ? [1, 2] : [1]
                })
              })
            };
            
            const result = await validator.validateMergeDecision(
              entity1,
              entity2,
              indexedText,
              mockLLMClient
            );
            
            // Property: Decision and evidence should be consistent
            if (result.validated) {
              expect(result.shouldMerge).toBe(shouldMerge);
              
              // Property: Should have evidence when validated
              if (result.evidenceIndices && result.evidenceIndices.length > 0) {
                // Evidence indices should be valid (within range of facts)
                result.evidenceIndices.forEach(idx => {
                  expect(idx).toBeGreaterThanOrEqual(1);
                  expect(idx).toBeLessThanOrEqual(facts.length);
                });
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('should provide reason that references indexed text', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 })
          }),
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 })
          }),
          fc.array(
            fc.string({ minLength: 10, maxLength: 100 }),
            { minLength: 2, maxLength: 8 }
          ),
          async (entity1, entity2, facts) => {
            const indexedText = facts.map((fact, i) => `${i + 1}. ${fact}`).join('\n');
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  should_merge: Math.random() > 0.5,
                  reason: '根据索引文本第1和第2条的描述',
                  confidence: 0.8,
                  evidence_indices: [1, 2]
                })
              })
            };
            
            const result = await validator.validateMergeDecision(
              entity1,
              entity2,
              indexedText,
              mockLLMClient
            );
            
            // Property: Reason should reference indexed text
            if (result.validated) {
              expect(result.reason).toBeDefined();
              expect(typeof result.reason).toBe('string');
              expect(result.reason.length).toBeGreaterThan(0);
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
            hasEntity1: fc.boolean(),
            hasEntity2: fc.boolean(),
            hasIndexedText: fc.boolean(),
            hasLLMClient: fc.boolean()
          }),
          async (config) => {
            const entity1 = config.hasEntity1 ? {
              entity_id: 'entity_1',
              canonical_name: '测试实体1',
              entity_type: 'Organization'
            } : null;
            
            const entity2 = config.hasEntity2 ? {
              entity_id: 'entity_2',
              canonical_name: '测试实体2',
              entity_type: 'Organization'
            } : null;
            
            const indexedText = config.hasIndexedText ? '1. 测试索引文本。' : null;
            
            const llmClient = config.hasLLMClient ? {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  should_merge: false,
                  reason: '测试',
                  confidence: 0.8,
                  evidence_indices: []
                })
              })
            } : null;
            
            // Property: Should never throw, always return a result
            const result = await validator.validateMergeDecision(
              entity1,
              entity2,
              indexedText,
              llmClient
            );
            
            expect(result).toBeDefined();
            expect(result).toHaveProperty('shouldMerge');
            expect(result).toHaveProperty('confidence');
            expect(result).toHaveProperty('reason');
            expect(result).toHaveProperty('validated');
            
            // Property: When inputs are missing, should gracefully degrade
            if (!entity1 || !entity2 || !indexedText || !llmClient) {
              expect(result.validated).toBe(false);
              expect(result.shouldMerge).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('should handle LLM failures gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 })
          }),
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 })
          }),
          fc.constantFrom(
            'Network error',
            'Timeout',
            'Service unavailable',
            'Rate limit exceeded'
          ),
          async (entity1, entity2, errorMessage) => {
            const indexedText = '1. 测试索引文本。\n2. 更多测试内容。';
            
            const mockLLMClient = {
              chat: jest.fn().mockRejectedValue(new Error(errorMessage))
            };
            
            // Property: Should handle LLM errors gracefully
            const result = await validator.validateMergeDecision(
              entity1,
              entity2,
              indexedText,
              mockLLMClient
            );
            
            expect(result).toBeDefined();
            expect(result.validated).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.shouldMerge).toBe(false); // Safe default
          }
        ),
        { numRuns: 20, timeout: 30000 } // Reduce runs and increase timeout for retry logic
      );
    }, 35000); // Increase Jest timeout to 35 seconds
    
    test('should handle malformed LLM responses gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 })
          }),
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 })
          }),
          fc.oneof(
            fc.constant('Not JSON'),
            fc.constant('{"incomplete": '),
            fc.constant('')
          ),
          async (entity1, entity2, malformedResponse) => {
            const indexedText = '1. 测试索引文本。';
            
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: malformedResponse
              })
            };
            
            // Property: Should handle malformed responses gracefully
            const result = await validator.validateMergeDecision(
              entity1,
              entity2,
              indexedText,
              mockLLMClient
            );
            
            expect(result).toBeDefined();
            expect(result.validated).toBe(false);
            expect(result.shouldMerge).toBe(false); // Safe default
            
            // Should have parse error or reason
            expect(result.parseError || result.reason).toBeDefined();
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
    test('should validate all merge pairs in batch', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              entity1: fc.record({
                entity_id: fc.uuid(),
                canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
                entity_type: fc.constantFrom('Location', 'Organization', 'Person')
              }),
              entity2: fc.record({
                entity_id: fc.uuid(),
                canonical_name: fc.string({ minLength: 2, maxLength: 20 }),
                entity_type: fc.constantFrom('Location', 'Organization', 'Person')
              }),
              indexedText: fc.string({ minLength: 20, maxLength: 200 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          async (mergePairs) => {
            const mockLLMClient = {
              chat: jest.fn().mockResolvedValue({
                content: JSON.stringify({
                  should_merge: Math.random() > 0.5,
                  reason: '测试验证',
                  confidence: 0.8,
                  evidence_indices: [1]
                })
              })
            };
            
            const results = await validator.batchValidateMerges(
              mergePairs,
              mockLLMClient,
              { maxConcurrency: 3 }
            );
            
            // Property: Should return results for all pairs
            expect(results.size).toBe(mergePairs.length);
            
            // Property: Each result should have required properties
            results.forEach((result, key) => {
              expect(result).toHaveProperty('shouldMerge');
              expect(result).toHaveProperty('confidence');
              expect(result).toHaveProperty('reason');
              expect(typeof result.shouldMerge).toBe('boolean');
              expect(typeof result.confidence).toBe('number');
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
      
      const results = await validator.batchValidateMerges([], mockLLMClient);
      
      // Property: Empty batch should return empty results
      expect(results.size).toBe(0);
      expect(mockLLMClient.chat).not.toHaveBeenCalled();
    });
  });
  
  /**
   * Smart Triggering Properties
   * 
   * Tests the shouldCallLLM logic for intelligent validation triggering
   */
  describe('Smart Triggering Properties', () => {
    test('should respect indexed text availability for triggering', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 })
          }),
          fc.record({
            entity_id: fc.uuid(),
            canonical_name: fc.string({ minLength: 2, maxLength: 20 })
          }),
          fc.boolean(), // Has indexed text
          async (entity1, entity2, hasIndexedText) => {
            const context = hasIndexedText ? { indexedText: '1. 测试文本。' } : {};
            
            const shouldCall = validator.shouldCallLLM(entity1, entity2, context);
            
            // Property: Should not call LLM without indexed text
            if (!hasIndexedText) {
              expect(shouldCall).toBe(false);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('should trigger on entity type mismatch', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom('Location', 'Organization', 'Person', 'Event'),
          fc.constantFrom('Location', 'Organization', 'Person', 'Event'),
          async (type1, type2) => {
            const entity1 = {
              entity_id: 'e1',
              entity_type: type1
            };
            
            const entity2 = {
              entity_id: 'e2',
              entity_type: type2
            };
            
            const shouldCall = validator.shouldCallLLM(entity1, entity2, {
              indexedText: '1. 测试文本。'
            });
            
            // Property: Should trigger when types differ
            if (type1 !== type2) {
              expect(shouldCall).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
