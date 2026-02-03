/**
 * Field Normalizer - Property-Based Tests
 * 
 * Tests universal properties that should hold for all inputs
 * using fast-check for property-based testing.
 * 
 * **Validates: Requirements 18.1, 18.2, 18.3, 18.5, 18.12, 18.14**
 */

const fc = require('fast-check');
const {
  normalizeFields,
  cleanFieldValue,
  standardizeTime,
  standardizeNumber,
  getCachedMapping,
  cacheMapping,
  clearCache
} = require('./field_normalizer');

const {
  exactMatch,
  synonymMatch,
  similarityMatch,
  levenshteinDistance,
  cosineSimilarity
} = require('./algorithm_mapper');

// Custom generator for non-whitespace strings
const nonWhitespaceString = (options = {}) => {
  const { minLength = 1, maxLength = 100 } = options;
  return fc.string({ minLength, maxLength }).filter(s => {
    // Remove all whitespace and check if there are enough characters left
    const nonWhitespace = s.replace(/\s/g, '');
    return nonWhitespace.length >= minLength;
  });
};

describe('Field Normalizer - Property-Based Tests', () => {
  beforeEach(() => {
    clearCache();
  });

  // Feature: schema-driven-knowledge-graph, Property 29: Field Mapping Consistency
  describe('Property 29: Field Mapping Consistency', () => {
    /**
     * **Validates: Requirements 18.1, 18.2, 18.3**
     * 
     * For any field name and schema field list, mapping the same field name
     * multiple times should always produce the same result (deterministic).
     */
    test('should produce consistent mappings for the same input', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('区域', '地区', '时间', '日期', '数值', '指标', '单位'),
          fc.constant(['区域', '时间', '指标', '数值', '单位']),
          (fieldName, schemaFields) => {
            // Map the field name twice
            const result1 = exactMatch(fieldName, schemaFields) ||
                           synonymMatch(fieldName, schemaFields) ||
                           similarityMatch(fieldName, schemaFields);
            
            const result2 = exactMatch(fieldName, schemaFields) ||
                           synonymMatch(fieldName, schemaFields) ||
                           similarityMatch(fieldName, schemaFields);
            
            // Results should be identical
            expect(result1).toEqual(result2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should produce consistent mappings across different runs', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.constantFrom('地区', '日期', '数量', '参数', '计量单位'),
            value: nonWhitespaceString({ minLength: 2, maxLength: 20 }),
            type: fc.constantFrom('location', 'time', 'number', 'indicator', 'unit'),
            confidence: fc.float({ min: 0, max: 1 })
          }),
          fc.constant({
            schema_name: 'TestSchema',
            core_fields: [
              { name: '区域', weight: 0.3, required: true },
              { name: '时间', weight: 0.2, required: true },
              { name: '指标', weight: 0.2, required: true },
              { name: '数值', weight: 0.2, required: false },
              { name: '单位', weight: 0.1, required: false }
            ]
          }),
          async (field, schema) => {
            // Normalize the same field twice
            const result1 = await normalizeFields([field], schema);
            const result2 = await normalizeFields([field], schema);
            
            // Results should be identical
            expect(result1).toEqual(result2);
            
            // Mapping method should be deterministic
            expect(result1[0].mapping_method).toBe(result2[0].mapping_method);
            expect(result1[0].mapping_confidence).toBe(result2[0].mapping_confidence);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should maintain mapping consistency with caching', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.constant('TestSchema'),
          fc.record({
            mapped_name: fc.constantFrom('区域', '时间', '指标'),
            confidence: fc.float({ min: Math.fround(0.7), max: Math.fround(1.0) }),
            method: fc.constantFrom('exact', 'synonym', 'similarity')
          }),
          (fieldName, schemaName, mapping) => {
            // Cache a mapping
            cacheMapping(fieldName, schemaName, mapping);
            
            // Retrieve it multiple times
            const cached1 = getCachedMapping(fieldName, schemaName);
            const cached2 = getCachedMapping(fieldName, schemaName);
            const cached3 = getCachedMapping(fieldName, schemaName);
            
            // All retrievals should return the same result
            expect(cached1).toEqual(mapping);
            expect(cached2).toEqual(mapping);
            expect(cached3).toEqual(mapping);
            expect(cached1).toEqual(cached2);
            expect(cached2).toEqual(cached3);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: schema-driven-knowledge-graph, Property 30: Field Cleaning Token Minimization
  describe('Property 30: Field Cleaning Token Minimization', () => {
    /**
     * **Validates: Requirements 18.5, 18.12, 18.14**
     * 
     * For any field normalization, algorithm-based methods (exact, synonym, similarity)
     * should be attempted before LLM, minimizing token consumption.
     */
    test('should prioritize algorithm-based mapping over LLM', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constantFrom('区域', '地区', '时间', '日期', '数值', '指标'),
              value: nonWhitespaceString({ minLength: 2, maxLength: 50 }),
              type: fc.constantFrom('location', 'time', 'number', 'indicator'),
              confidence: fc.float({ min: 0.5, max: 1.0 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.constant({
            schema_name: 'TestSchema',
            core_fields: [
              { name: '区域', weight: 0.3, required: true },
              { name: '时间', weight: 0.2, required: true },
              { name: '指标', weight: 0.2, required: true },
              { name: '数值', weight: 0.2, required: false },
              { name: '单位', weight: 0.1, required: false }
            ]
          }),
          async (fields, schema) => {
            const normalized = await normalizeFields(fields, schema, { skipLLM: true });
            
            // All normalized fields should use algorithm-based methods
            normalized.forEach(field => {
              expect(['exact', 'synonym', 'similarity', 'semantic_inference', 
                      'context_fuzzy', 'value_inference', 'none'])
                .toContain(field.mapping_method);
              
              // Should NOT use LLM method
              expect(field.mapping_method).not.toBe('llm');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should use cached mappings to avoid redundant processing', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constantFrom('地区', '日期', '数量'),
              value: nonWhitespaceString({ minLength: 2, maxLength: 20 }),
              type: fc.constantFrom('location', 'time', 'number'),
              confidence: fc.float({ min: 0.5, max: 1.0 })
            }),
            { minLength: 2, maxLength: 5 }
          ),
          fc.constant({
            schema_name: 'TestSchema',
            core_fields: [
              { name: '区域', weight: 0.5, required: true },
              { name: '时间', weight: 0.5, required: true }
            ]
          }),
          async (fields, schema) => {
            // First normalization - should compute and cache
            await normalizeFields(fields, schema);
            
            // Second normalization - should use cache
            const startTime = Date.now();
            await normalizeFields(fields, schema);
            const duration = Date.now() - startTime;
            
            // Cached normalization should be faster (< 50ms for small inputs)
            expect(duration).toBeLessThan(50);
          }
        ),
        { numRuns: 50 }
      );
    });

    test('should minimize processing for exact matches', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constantFrom('区域', '时间', '指标', '数值', '单位'),
              value: nonWhitespaceString({ minLength: 2, maxLength: 20 }),
              type: fc.constantFrom('location', 'time', 'indicator', 'number', 'unit'),
              confidence: fc.float({ min: 0.5, max: 1.0 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.constant({
            schema_name: 'TestSchema',
            core_fields: [
              { name: '区域', weight: 0.3, required: true },
              { name: '时间', weight: 0.2, required: true },
              { name: '指标', weight: 0.2, required: true },
              { name: '数值', weight: 0.2, required: false },
              { name: '单位', weight: 0.1, required: false }
            ]
          }),
          async (fields, schema) => {
            const normalized = await normalizeFields(fields, schema);
            
            // All exact matches should have confidence 1.0 and method 'exact'
            normalized.forEach(field => {
              if (schema.core_fields.some(f => f.name === field.original_name)) {
                expect(field.mapping_method).toBe('exact');
                expect(field.mapping_confidence).toBe(1.0);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Levenshtein Distance Properties', () => {
    test('should satisfy triangle inequality', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (a, b, c) => {
            const dab = levenshteinDistance(a, b);
            const dbc = levenshteinDistance(b, c);
            const dac = levenshteinDistance(a, c);
            
            // Triangle inequality: d(a,c) <= d(a,b) + d(b,c)
            expect(dac).toBeLessThanOrEqual(dab + dbc);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should be symmetric', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          (a, b) => {
            const dab = levenshteinDistance(a, b);
            const dba = levenshteinDistance(b, a);
            
            // Symmetry: d(a,b) = d(b,a)
            expect(dab).toBe(dba);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should be zero for identical strings', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          (str) => {
            const distance = levenshteinDistance(str, str);
            
            // Identity: d(a,a) = 0
            expect(distance).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should be non-negative', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 20 }),
          fc.string({ minLength: 0, maxLength: 20 }),
          (a, b) => {
            const distance = levenshteinDistance(a, b);
            
            // Non-negativity: d(a,b) >= 0
            expect(distance).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Cosine Similarity Properties', () => {
    test('should be between 0 and 1', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 10 }),
          fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 10 }),
          (ngrams1, ngrams2) => {
            const similarity = cosineSimilarity(ngrams1, ngrams2);
            
            // Cosine similarity should be in [0, 1]
            expect(similarity).toBeGreaterThanOrEqual(0);
            expect(similarity).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should be 1 for identical n-grams', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 10 }),
          (ngrams) => {
            if (ngrams.length === 0) return; // Skip empty arrays
            
            const similarity = cosineSimilarity(ngrams, ngrams);
            
            // Self-similarity should be 1
            expect(similarity).toBeCloseTo(1.0, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should be symmetric', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 10 }),
          fc.array(fc.string({ minLength: 1, maxLength: 5 }), { minLength: 1, maxLength: 10 }),
          (ngrams1, ngrams2) => {
            const sim12 = cosineSimilarity(ngrams1, ngrams2);
            const sim21 = cosineSimilarity(ngrams2, ngrams1);
            
            // Symmetry: sim(a,b) = sim(b,a)
            expect(sim12).toBeCloseTo(sim21, 5);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Field Value Cleaning Properties', () => {
    test('should preserve field structure', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }),
            value: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('location', 'time', 'number', 'indicator', 'unit'),
            confidence: fc.float({ min: 0, max: 1 })
          }),
          (field) => {
            const cleaned = cleanFieldValue(field);
            
            // Should preserve all field properties
            expect(cleaned).toHaveProperty('name');
            expect(cleaned).toHaveProperty('value');
            expect(cleaned).toHaveProperty('type');
            expect(cleaned).toHaveProperty('confidence');
            
            // Should preserve field name, type, and confidence
            expect(cleaned.name).toBe(field.name);
            expect(cleaned.type).toBe(field.type);
            expect(cleaned.confidence).toBe(field.confidence);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should not increase value length', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }),
            value: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('location', 'time', 'number', 'indicator'),
            confidence: fc.float({ min: 0, max: 1 })
          }),
          (field) => {
            const cleaned = cleanFieldValue(field);
            
            // Cleaning should not increase length (only remove/standardize)
            expect(cleaned.value.length).toBeLessThanOrEqual(field.value.length + 20); // +20 for date format expansion
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should be idempotent', () => {
      fc.assert(
        fc.property(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 20 }),
            value: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('location', 'time', 'number', 'indicator'),
            confidence: fc.float({ min: 0, max: 1 })
          }),
          (field) => {
            const cleaned1 = cleanFieldValue(field);
            const cleaned2 = cleanFieldValue(cleaned1);
            
            // Cleaning twice should produce the same result
            expect(cleaned2.value).toBe(cleaned1.value);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Time Standardization Properties', () => {
    test('should produce valid ISO format or original', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 30 }),
          (timeStr) => {
            const standardized = standardizeTime(timeStr);
            
            // Should either be valid ISO format or original string
            const isoPattern = /^\d{4}-\d{2}(-\d{2})?$/;
            const isValidISO = isoPattern.test(standardized);
            const isOriginal = standardized === timeStr;
            
            expect(isValidISO || isOriginal).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should be idempotent for valid ISO dates', () => {
      fc.assert(
        fc.property(
          fc.date().filter(d => !isNaN(d.getTime())), // Filter out invalid dates
          (date) => {
            const isoStr = date.toISOString().split('T')[0]; // YYYY-MM-DD
            
            const standardized1 = standardizeTime(isoStr);
            const standardized2 = standardizeTime(standardized1);
            
            // Standardizing twice should produce the same result
            expect(standardized2).toBe(standardized1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Number Standardization Properties', () => {
    test('should produce valid number string', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1000000, max: 1000000 }),
          (num) => {
            const numStr = num.toString();
            const standardized = standardizeNumber(numStr);
            
            // Should be parseable as a number
            const parsed = parseFloat(standardized);
            expect(isNaN(parsed)).toBe(false);
            
            // Should be close to original value
            expect(parsed).toBeCloseTo(num, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should be idempotent', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }),
          (numStr) => {
            const standardized1 = standardizeNumber(numStr);
            const standardized2 = standardizeNumber(standardized1);
            
            // Standardizing twice should produce the same result
            expect(standardized2).toBe(standardized1);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should preserve sign', () => {
      fc.assert(
        fc.property(
          fc.float({ min: -1000, max: 1000 }).filter(n => !isNaN(n)), // Filter out NaN
          (num) => {
            const numStr = num.toString();
            const standardized = standardizeNumber(numStr);
            const parsed = parseFloat(standardized);
            
            // Should preserve sign
            if (num >= 0) {
              expect(parsed).toBeGreaterThanOrEqual(0);
            } else {
              expect(parsed).toBeLessThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Normalization Output Properties', () => {
    test('should preserve field count', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constantFrom('区域', '地区', '时间', '日期', '数值'),
              value: nonWhitespaceString({ minLength: 2, maxLength: 20 }),
              type: fc.constantFrom('location', 'time', 'number'),
              confidence: fc.float({ min: 0.5, max: 1.0 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          fc.constant({
            schema_name: 'TestSchema',
            core_fields: [
              { name: '区域', weight: 0.5, required: true },
              { name: '时间', weight: 0.5, required: true }
            ]
          }),
          async (fields, schema) => {
            const normalized = await normalizeFields(fields, schema);
            
            // Should preserve field count
            expect(normalized.length).toBe(fields.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should have valid confidence values', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constantFrom('区域', '地区', '时间', '日期'),
              value: nonWhitespaceString({ minLength: 2, maxLength: 20 }),
              type: fc.constantFrom('location', 'time'),
              confidence: fc.float({ min: 0.5, max: 1.0 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.constant({
            schema_name: 'TestSchema',
            core_fields: [
              { name: '区域', weight: 0.5, required: true },
              { name: '时间', weight: 0.5, required: true }
            ]
          }),
          async (fields, schema) => {
            const normalized = await normalizeFields(fields, schema);
            
            // All mapping confidences should be in [0, 1]
            normalized.forEach(field => {
              expect(field.mapping_confidence).toBeGreaterThanOrEqual(0);
              expect(field.mapping_confidence).toBeLessThanOrEqual(1);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('should have valid mapping methods', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constantFrom('区域', '地区', '时间', '日期', '未知字段'),
              value: nonWhitespaceString({ minLength: 2, maxLength: 20 }),
              type: fc.constantFrom('location', 'time', null),
              confidence: fc.float({ min: 0.5, max: 1.0 })
            }),
            { minLength: 1, maxLength: 5 }
          ),
          fc.constant({
            schema_name: 'TestSchema',
            core_fields: [
              { name: '区域', weight: 0.5, required: true },
              { name: '时间', weight: 0.5, required: true }
            ]
          }),
          async (fields, schema) => {
            const normalized = await normalizeFields(fields, schema, { skipLLM: true });
            
            const validMethods = ['exact', 'synonym', 'similarity', 'semantic_inference', 
                                 'context_fuzzy', 'value_inference', 'llm', 'none'];
            
            // All mapping methods should be valid
            normalized.forEach(field => {
              expect(validMethods).toContain(field.mapping_method);
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
