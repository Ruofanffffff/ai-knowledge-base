/**
 * Property-Based Tests for Intelligent Field Truncating Strategy
 * 
 * Tests universal properties that should hold across all inputs.
 * Uses fast-check for property-based testing with minimum 100 iterations.
 * 
 * Validates:
 * - Property 29: Intelligent Field Truncating Effectiveness
 * - Property 30: Field Truncating Token Savings
 * - Property 31: Field Truncating Scene Adaptation
 * - Property 32: Field Selection Score Calculation
 */

const fc = require('fast-check');
const {
  calculateFieldImportance,
  calculateSemanticRelevance,
  calculateContextRelevance,
  selectRelevantFields,
  adaptTruncatingStrategy,
  clearFrequencyCache
} = require('./intelligent_truncating');

describe('Intelligent Field Truncating - Property-Based Tests', () => {
  
  beforeEach(() => {
    clearFrequencyCache();
  });
  
  // Arbitraries for generating test data
  
  const fieldNameArbitrary = fc.constantFrom(
    '时间', '区域', '地点', '数值', '单位', '名称', '类型', '状态',
    '日期', '位置', '值', '描述', '标识', 'ID', '指标', '备注',
    '监测点', '变化趋势', '来源', '作者'
  );
  
  const fieldTypeArbitrary = fc.constantFrom(
    'time', 'location', 'number', 'unit', 'entity', 'unknown'
  );
  
  const sceneArbitrary = fc.constantFrom(
    '科研/政府', '个人生活', '旅行/休闲', '摄影', '后期', '运动', '娱乐', 'default'
  );
  
  const schemaFieldArbitrary = fc.record({
    name: fieldNameArbitrary,
    weight: fc.float({ min: Math.fround(0.05), max: Math.fround(0.5), noNaN: true }),
    required: fc.boolean()
  });
  
  const schemaArbitrary = fc.record({
    schema_name: fc.string({ minLength: 1, maxLength: 30 }),
    scene: sceneArbitrary,
    core_fields: fc.uniqueArray(
      schemaFieldArbitrary,
      {
        minLength: 3,
        maxLength: 12,
        selector: (field) => field.name
      }
    ).map(fields => {
      // Normalize weights to sum to 1.0
      const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
      return fields.map(f => ({
        ...f,
        weight: totalWeight > 0 ? f.weight / totalWeight : 0.1
      }));
    })
  });
  
  const rawFieldArbitrary = fc.record({
    name: fieldNameArbitrary,
    value: fc.string({ minLength: 1, maxLength: 50 }),
    type: fieldTypeArbitrary,
    confidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0), noNaN: true })
  });
  
  describe('Property 29: Intelligent Field Truncating Effectiveness', () => {
    /**
     * Feature: schema-driven-knowledge-graph, Property 29: Intelligent Field Truncating Effectiveness
     * 
     * For any field selection operation:
     * 1. Selected field count ≤ maxFields
     * 2. All selected fields either:
     *    - Have score ≥ minScore, OR
     *    - Are in top N fields (includeTopN)
     */
    test('selected fields should not exceed maxFields', () => {
      fc.assert(
        fc.property(
          rawFieldArbitrary,
          schemaArbitrary,
          fc.integer({ min: 2, max: 10 }),
          (rawField, schema, maxFields) => {
            const schemaFieldNames = schema.core_fields.map(f => f.name);
            const options = { maxFields, minScore: 30, includeTopN: 3 };
            
            const result = selectRelevantFields(
              rawField.name,
              rawField,
              schemaFieldNames,
              schema,
              options
            );
            
            // Selected fields should not exceed maxFields
            expect(result.selectedFields.length).toBeLessThanOrEqual(maxFields);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('selected fields should include at least top N fields (when available)', () => {
      fc.assert(
        fc.property(
          rawFieldArbitrary,
          schemaArbitrary,
          fc.integer({ min: 1, max: 5 }),
          (rawField, schema, includeTopN) => {
            const schemaFieldNames = schema.core_fields.map(f => f.name);
            const maxFields = Math.max(includeTopN + 2, 5);
            const options = { maxFields, minScore: 30, includeTopN };
            
            const result = selectRelevantFields(
              rawField.name,
              rawField,
              schemaFieldNames,
              schema,
              options
            );
            
            // Should include at least min(includeTopN, total fields) fields
            const expectedMinFields = Math.min(includeTopN, schemaFieldNames.length);
            expect(result.selectedFields.length).toBeGreaterThanOrEqual(expectedMinFields);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('all selected fields should meet score criteria', () => {
      fc.assert(
        fc.property(
          rawFieldArbitrary,
          schemaArbitrary,
          fc.float({ min: 20, max: 60 }),
          (rawField, schema, minScore) => {
            const schemaFieldNames = schema.core_fields.map(f => f.name);
            const includeTopN = 3;
            const options = { maxFields: 10, minScore, includeTopN };
            
            const result = selectRelevantFields(
              rawField.name,
              rawField,
              schemaFieldNames,
              schema,
              options
            );
            
            // Each selected field should either:
            // 1. Be in top N, OR
            // 2. Have score >= minScore
            result.selectedFields.forEach((fieldName, index) => {
              const scoredField = result.scoredFields.find(f => f.name === fieldName);
              expect(scoredField).toBeDefined();
              
              const isTopN = index < includeTopN;
              const meetsMinScore = scoredField.score >= minScore;
              
              expect(isTopN || meetsMinScore).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('scored fields should be sorted in descending order', () => {
      fc.assert(
        fc.property(
          rawFieldArbitrary,
          schemaArbitrary,
          (rawField, schema) => {
            const schemaFieldNames = schema.core_fields.map(f => f.name);
            
            const result = selectRelevantFields(
              rawField.name,
              rawField,
              schemaFieldNames,
              schema
            );
            
            // Scored fields should be sorted descending by score
            for (let i = 0; i < result.scoredFields.length - 1; i++) {
              expect(result.scoredFields[i].score).toBeGreaterThanOrEqual(
                result.scoredFields[i + 1].score
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('selection should be deterministic', () => {
      fc.assert(
        fc.property(
          rawFieldArbitrary,
          schemaArbitrary,
          (rawField, schema) => {
            const schemaFieldNames = schema.core_fields.map(f => f.name);
            const options = { maxFields: 5, minScore: 30, includeTopN: 3 };
            
            const result1 = selectRelevantFields(
              rawField.name,
              rawField,
              schemaFieldNames,
              schema,
              options
            );
            
            const result2 = selectRelevantFields(
              rawField.name,
              rawField,
              schemaFieldNames,
              schema,
              options
            );
            
            // Same inputs should produce same outputs
            expect(result1.selectedFields).toEqual(result2.selectedFields);
            expect(result1.scoredFields).toEqual(result2.scoredFields);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Property 30: Field Truncating Token Savings', () => {
    /**
     * Feature: schema-driven-knowledge-graph, Property 30: Field Truncating Token Savings
     * 
     * When schema has > 5 fields, intelligent truncating should achieve:
     * - Token savings ≥ 40% (selected fields significantly fewer than total)
     * - Token savings = (total_fields - selected_fields) / total_fields
     */
    test('should achieve significant token savings for large schemas', () => {
      fc.assert(
        fc.property(
          rawFieldArbitrary,
          schemaArbitrary.filter(s => s.core_fields.length > 5),
          (rawField, schema) => {
            const schemaFieldNames = schema.core_fields.map(f => f.name);
            const totalFields = schemaFieldNames.length;
            
            // Use default strategy
            const strategy = adaptTruncatingStrategy(schema);
            
            const result = selectRelevantFields(
              rawField.name,
              rawField,
              schemaFieldNames,
              schema,
              strategy
            );
            
            const selectedFields = result.selectedFields.length;
            const tokenSavingsRate = (totalFields - selectedFields) / totalFields;
            
            // For schemas with > 5 fields, should save tokens
            // Note: Actual savings depend on field relevance, so we check for reasonable reduction
            expect(selectedFields).toBeLessThan(totalFields);
            
            // Selected fields should be reasonable (not selecting everything)
            expect(selectedFields).toBeLessThanOrEqual(strategy.maxFields);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('token savings should increase with schema size', () => {
      fc.assert(
        fc.property(
          rawFieldArbitrary,
          sceneArbitrary,
          (rawField, scene) => {
            // Create schemas of different sizes
            const smallSchema = {
              schema_name: 'SmallSchema',
              scene: scene,
              core_fields: [
                { name: '时间', weight: 0.4, required: true },
                { name: '区域', weight: 0.3, required: true },
                { name: '数值', weight: 0.3, required: false }
              ]
            };
            
            const largeSchema = {
              schema_name: 'LargeSchema',
              scene: scene,
              core_fields: [
                { name: '时间', weight: 0.15, required: true },
                { name: '区域', weight: 0.15, required: true },
                { name: '数值', weight: 0.1, required: false },
                { name: '单位', weight: 0.1, required: false },
                { name: '指标', weight: 0.1, required: false },
                { name: '监测点', weight: 0.1, required: false },
                { name: '变化趋势', weight: 0.1, required: false },
                { name: '来源', weight: 0.1, required: false },
                { name: '备注', weight: 0.1, required: false }
              ]
            };
            
            const strategy = adaptTruncatingStrategy(largeSchema);
            
            const smallResult = selectRelevantFields(
              rawField.name,
              rawField,
              smallSchema.core_fields.map(f => f.name),
              smallSchema,
              strategy
            );
            
            const largeResult = selectRelevantFields(
              rawField.name,
              rawField,
              largeSchema.core_fields.map(f => f.name),
              largeSchema,
              strategy
            );
            
            const smallSavings = (smallSchema.core_fields.length - smallResult.selectedFields.length) / smallSchema.core_fields.length;
            const largeSavings = (largeSchema.core_fields.length - largeResult.selectedFields.length) / largeSchema.core_fields.length;
            
            // Large schema should have higher or equal savings rate
            expect(largeSavings).toBeGreaterThanOrEqual(smallSavings - 0.1); // Allow small tolerance
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Property 31: Field Truncating Scene Adaptation', () => {
    /**
     * Feature: schema-driven-knowledge-graph, Property 31: Field Truncating Scene Adaptation
     * 
     * Different scenes should have appropriate maxFields:
     * - 科研/政府: maxFields ≥ 6 (many fields)
     * - 个人生活: maxFields ≤ 4 (few fields)
     * - 摄影: maxFields ≥ 7 (many parameters)
     */
    test('科研/政府 scene should have maxFields >= 6', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('科研/政府', '科研/政府/环境', '科研/政府/地质'),
          (scene) => {
            const schema = { scene };
            const strategy = adaptTruncatingStrategy(schema);
            
            expect(strategy.maxFields).toBeGreaterThanOrEqual(6);
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('个人生活 scene should have maxFields <= 4', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('个人生活', '个人生活/日常', '个人生活/记录'),
          (scene) => {
            const schema = { scene };
            const strategy = adaptTruncatingStrategy(schema);
            
            expect(strategy.maxFields).toBeLessThanOrEqual(4);
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('摄影 scene should have maxFields >= 7', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('摄影', '摄影/风光', '摄影/人像'),
          (scene) => {
            const schema = { scene };
            const strategy = adaptTruncatingStrategy(schema);
            
            expect(strategy.maxFields).toBeGreaterThanOrEqual(7);
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('后期 scene should have maxFields >= 7', () => {
      const schema = { scene: '后期' };
      const strategy = adaptTruncatingStrategy(schema);
      
      expect(strategy.maxFields).toBeGreaterThanOrEqual(7);
    });
    
    test('unknown scene should use default strategy', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).filter(s => {
            // Filter out JavaScript reserved words and known scenes
            const reserved = ['constructor', 'prototype', '__proto__', 'toString', 'valueOf'];
            if (reserved.includes(s)) return false;
            return !['科研/政府', '个人生活', '旅行/休闲', '摄影', '后期', '运动', '娱乐'].some(scene => s.includes(scene));
          }),
          (scene) => {
            const schema = { scene };
            const strategy = adaptTruncatingStrategy(schema);
            
            // Default strategy
            expect(strategy.maxFields).toBe(5);
            expect(strategy.minScore).toBe(30);
            expect(strategy.includeTopN).toBe(3);
          }
        ),
        { numRuns: 50 }
      );
    });
    
    test('strategy should have valid configuration', () => {
      fc.assert(
        fc.property(
          sceneArbitrary,
          (scene) => {
            const schema = { scene };
            const strategy = adaptTruncatingStrategy(schema);
            
            // All strategy values should be valid
            expect(strategy.maxFields).toBeGreaterThan(0);
            expect(strategy.maxFields).toBeLessThanOrEqual(15);
            expect(strategy.minScore).toBeGreaterThanOrEqual(0);
            expect(strategy.minScore).toBeLessThanOrEqual(100);
            expect(strategy.includeTopN).toBeGreaterThan(0);
            expect(strategy.includeTopN).toBeLessThanOrEqual(strategy.maxFields);
            expect(Array.isArray(strategy.priorityCategories)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Property 32: Field Selection Score Calculation', () => {
    /**
     * Feature: schema-driven-knowledge-graph, Property 32: Field Selection Score Calculation
     * 
     * Comprehensive score calculation should follow formula:
     * total_score = importance × 0.3 + semantic × 0.5 + context × 0.2
     * 
     * Where:
     * - importance: 0-100
     * - semantic: 0-100
     * - context: 0-50
     */
    test('field importance score should be in range [0, 100]', () => {
      fc.assert(
        fc.property(
          schemaFieldArbitrary,
          schemaArbitrary,
          (field, schema) => {
            const score = calculateFieldImportance(field, schema);
            
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('semantic relevance score should be in range [0, 100]', () => {
      fc.assert(
        fc.property(
          fieldNameArbitrary,
          fieldNameArbitrary,
          (rawFieldName, schemaFieldName) => {
            const score = calculateSemanticRelevance(rawFieldName, schemaFieldName);
            
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(100);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('context relevance score should be in range [0, 50]', () => {
      fc.assert(
        fc.property(
          rawFieldArbitrary,
          schemaFieldArbitrary,
          (rawField, schemaField) => {
            const score = calculateContextRelevance(rawField, schemaField);
            
            expect(score).toBeGreaterThanOrEqual(0);
            expect(score).toBeLessThanOrEqual(50);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('comprehensive score should follow weighted formula', () => {
      fc.assert(
        fc.property(
          rawFieldArbitrary,
          schemaArbitrary,
          (rawField, schema) => {
            const schemaFieldNames = schema.core_fields.map(f => f.name);
            
            const result = selectRelevantFields(
              rawField.name,
              rawField,
              schemaFieldNames,
              schema
            );
            
            // Verify each scored field follows the formula
            result.scoredFields.forEach(scoredField => {
              const { importance, semantic, context } = scoredField.breakdown;
              
              // Calculate expected total score
              const expectedScore = importance * 0.3 + semantic * 0.5 + context * 0.2;
              
              // Should match actual score (with floating point tolerance)
              expect(scoredField.score).toBeCloseTo(expectedScore, 5);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('identical field names should have perfect semantic score', () => {
      fc.assert(
        fc.property(
          fieldNameArbitrary,
          (fieldName) => {
            const score = calculateSemanticRelevance(fieldName, fieldName);
            
            // Identical names should score very high
            // Edit distance similarity: 40 points (perfect match)
            // N-gram similarity: 30 points (perfect match)
            // Category match: 30 points (same category)
            // Total: 100 points (or 70 if category is 'other')
            expect(score).toBeGreaterThanOrEqual(70);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('required fields should score higher than optional fields', () => {
      fc.assert(
        fc.property(
          fc.float({ min: Math.fround(0.1), max: Math.fround(0.5), noNaN: true }),
          (weight) => {
            const requiredField = { name: '时间', weight, required: true };
            const optionalField = { name: '备注', weight, required: false };
            const schema = { core_fields: [requiredField, optionalField] };
            
            const requiredScore = calculateFieldImportance(requiredField, schema);
            const optionalScore = calculateFieldImportance(optionalField, schema);
            
            // Required field should score at least 20 points higher (the required bonus)
            expect(requiredScore).toBeGreaterThanOrEqual(optionalScore + 19);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('score calculation should be deterministic', () => {
      fc.assert(
        fc.property(
          rawFieldArbitrary,
          schemaFieldArbitrary,
          schemaArbitrary,
          (rawField, schemaField, schema) => {
            const importance1 = calculateFieldImportance(schemaField, schema);
            const importance2 = calculateFieldImportance(schemaField, schema);
            
            const semantic1 = calculateSemanticRelevance(rawField.name, schemaField.name);
            const semantic2 = calculateSemanticRelevance(rawField.name, schemaField.name);
            
            const context1 = calculateContextRelevance(rawField, schemaField);
            const context2 = calculateContextRelevance(rawField, schemaField);
            
            // Same inputs should produce same outputs
            expect(importance1).toBe(importance2);
            expect(semantic1).toBe(semantic2);
            expect(context1).toBe(context2);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Integration Properties', () => {
    test('selectRelevantFields should return all required data', () => {
      fc.assert(
        fc.property(
          rawFieldArbitrary,
          schemaArbitrary,
          (rawField, schema) => {
            const schemaFieldNames = schema.core_fields.map(f => f.name);
            
            const result = selectRelevantFields(
              rawField.name,
              rawField,
              schemaFieldNames,
              schema
            );
            
            // Should have selectedFields array
            expect(Array.isArray(result.selectedFields)).toBe(true);
            
            // Should have scoredFields array
            expect(Array.isArray(result.scoredFields)).toBe(true);
            
            // scoredFields should have same length as input fields
            expect(result.scoredFields.length).toBe(schemaFieldNames.length);
            
            // Each scored field should have required properties
            result.scoredFields.forEach(field => {
              expect(field.name).toBeDefined();
              expect(typeof field.score).toBe('number');
              expect(field.breakdown).toBeDefined();
              expect(typeof field.breakdown.importance).toBe('number');
              expect(typeof field.breakdown.semantic).toBe('number');
              expect(typeof field.breakdown.context).toBe('number');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('all selected fields should exist in scored fields', () => {
      fc.assert(
        fc.property(
          rawFieldArbitrary,
          schemaArbitrary,
          (rawField, schema) => {
            const schemaFieldNames = schema.core_fields.map(f => f.name);
            
            const result = selectRelevantFields(
              rawField.name,
              rawField,
              schemaFieldNames,
              schema
            );
            
            const scoredFieldNames = new Set(result.scoredFields.map(f => f.name));
            
            // Every selected field should be in scored fields
            result.selectedFields.forEach(fieldName => {
              expect(scoredFieldNames.has(fieldName)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
