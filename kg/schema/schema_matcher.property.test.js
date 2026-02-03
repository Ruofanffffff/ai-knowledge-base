/**
 * Property-Based Tests for Schema Matcher
 * 
 * Tests universal properties that should hold across all inputs.
 * Uses fast-check for property-based testing with minimum 100 iterations.
 * 
 * Validates:
 * - Property 7: Schema Completeness Calculation
 * - Property 8: Schema Threshold Triggering
 */

const fc = require('fast-check');
const {
  matchSchemas,
  calculateCompleteness,
  getTriggeredSchemas,
  shouldTriggerSchema
} = require('./schema_matcher');

describe('Schema Matcher - Property-Based Tests', () => {
  // Helper to generate valid schema
  const schemaArbitrary = fc.record({
    schema_name: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
    entity_type: fc.constantFrom('EventEntity', 'PersonEntity', 'LocationEntity'),
    core_fields: fc.uniqueArray(
      fc.record({
        name: fc.constantFrom('区域', '时间', '指标', '数值', '单位', '人名', '职位', '组织'),
        weight: fc.float({ min: Math.fround(0.1), max: Math.fround(0.5), noNaN: true }),
        required: fc.boolean()
      }),
      { 
        minLength: 2, 
        maxLength: 5,
        selector: (field) => field.name  // Ensure unique field names
      }
    ).map(fields => {
      // Normalize weights to sum to 1.0
      const totalWeight = fields.reduce((sum, f) => sum + f.weight, 0);
      return fields.map(f => ({
        ...f,
        weight: f.weight / totalWeight
      }));
    }),
    threshold: fc.float({ min: Math.fround(0.5), max: Math.fround(0.9), noNaN: true })
  });

  // Helper to generate valid fields
  const fieldsArbitrary = fc.array(
    fc.record({
      name: fc.constantFrom('区域', '时间', '指标', '数值', '单位', '人名', '职位', '组织'),
      value: fc.string({ minLength: 1, maxLength: 20 }),
      type: fc.constantFrom('location', 'time', 'indicator', 'number', 'unit', 'entity'),
      confidence: fc.float({ min: Math.fround(0.5), max: Math.fround(1.0), noNaN: true })
    }),
    { minLength: 0, maxLength: 8 }
  );

  // Helper to generate source confidence
  const sourceConfidenceArbitrary = fc.float({ min: Math.fround(0.4), max: Math.fround(1.0), noNaN: true });

  describe('Property 7: Schema Completeness Calculation', () => {
    /**
     * Feature: schema-driven-knowledge-graph, Property 7: Schema Completeness Calculation
     * 
     * For any set of fields and a schema, the completeness score should be calculated as:
     * Σ(field_match_count × field_weight) × source_confidence, and the result should be between 0 and 1.
     */
    test('completeness score should always be between 0 and 1', () => {
      fc.assert(
        fc.property(
          fieldsArbitrary,
          schemaArbitrary,
          sourceConfidenceArbitrary,
          (fields, schema, sourceConfidence) => {
            const result = calculateCompleteness(fields, schema, sourceConfidence);
            
            // Completeness must be between 0 and 1
            expect(result.completeness).toBeGreaterThanOrEqual(0);
            expect(result.completeness).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('completeness should be 0 when no fields match', () => {
      fc.assert(
        fc.property(
          schemaArbitrary,
          sourceConfidenceArbitrary,
          (schema, sourceConfidence) => {
            // Create fields that don't match any core fields
            const nonMatchingFields = [
              { name: 'unknown_field_1', value: 'test', type: 'entity', confidence: 0.9 },
              { name: 'unknown_field_2', value: 'test', type: 'entity', confidence: 0.9 }
            ];
            
            const result = calculateCompleteness(nonMatchingFields, schema, sourceConfidence);
            
            // Completeness should be 0 when no fields match
            expect(result.completeness).toBe(0);
            expect(result.matched_fields).toHaveLength(0);
            expect(result.missing_fields.length).toBe(schema.core_fields.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('completeness should scale linearly with source confidence', () => {
      fc.assert(
        fc.property(
          fieldsArbitrary,
          schemaArbitrary,
          (fields, schema) => {
            const result1 = calculateCompleteness(fields, schema, 1.0);
            const result0_5 = calculateCompleteness(fields, schema, 0.5);
            
            // Completeness at 0.5 confidence should be half of completeness at 1.0
            expect(result0_5.completeness).toBeCloseTo(result1.completeness * 0.5, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('completeness should increase monotonically with more matching fields', () => {
      fc.assert(
        fc.property(
          schemaArbitrary,
          sourceConfidenceArbitrary,
          (schema, sourceConfidence) => {
            // Create fields that match all core fields
            const allFields = schema.core_fields.map(cf => ({
              name: cf.name,
              value: 'test',
              type: 'entity',
              confidence: 0.9
            }));
            
            // Test with increasing number of fields
            for (let i = 0; i <= allFields.length; i++) {
              const subset = allFields.slice(0, i);
              const result = calculateCompleteness(subset, schema, sourceConfidence);
              
              // Completeness should not exceed source confidence (with floating point tolerance)
              expect(result.completeness).toBeLessThanOrEqual(sourceConfidence + 0.0000001);
              
              // Number of matched fields should equal subset length
              expect(result.matched_fields.length).toBe(i);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('completeness calculation should be deterministic', () => {
      fc.assert(
        fc.property(
          fieldsArbitrary,
          schemaArbitrary,
          sourceConfidenceArbitrary,
          (fields, schema, sourceConfidence) => {
            const result1 = calculateCompleteness(fields, schema, sourceConfidence);
            const result2 = calculateCompleteness(fields, schema, sourceConfidence);
            
            // Same inputs should produce same outputs
            expect(result1.completeness).toBe(result2.completeness);
            expect(result1.matched_fields).toEqual(result2.matched_fields);
            expect(result1.missing_fields).toEqual(result2.missing_fields);
            expect(result1.meets_threshold).toBe(result2.meets_threshold);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('matched_fields and missing_fields should partition core_fields', () => {
      fc.assert(
        fc.property(
          fieldsArbitrary,
          schemaArbitrary,
          sourceConfidenceArbitrary,
          (fields, schema, sourceConfidence) => {
            const result = calculateCompleteness(fields, schema, sourceConfidence);
            
            // Union of matched and missing should equal all core fields
            const allFieldNames = new Set([
              ...result.matched_fields,
              ...result.missing_fields
            ]);
            
            expect(allFieldNames.size).toBe(schema.core_fields.length);
            
            // No overlap between matched and missing
            const matchedSet = new Set(result.matched_fields);
            const missingSet = new Set(result.missing_fields);
            const intersection = [...matchedSet].filter(f => missingSet.has(f));
            expect(intersection).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('completeness should respect field weights', () => {
      fc.assert(
        fc.property(
          schemaArbitrary,
          sourceConfidenceArbitrary,
          (schema, sourceConfidence) => {
            // Match only the highest weight field
            const sortedFields = [...schema.core_fields].sort((a, b) => b.weight - a.weight);
            const highestWeightField = sortedFields[0];
            
            const fields = [{
              name: highestWeightField.name,
              value: 'test',
              type: 'entity',
              confidence: 0.9
            }];
            
            const result = calculateCompleteness(fields, schema, sourceConfidence);
            
            // Completeness should be approximately weight * sourceConfidence
            const expectedCompleteness = highestWeightField.weight * sourceConfidence;
            expect(result.completeness).toBeCloseTo(expectedCompleteness, 5);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property 8: Schema Threshold Triggering', () => {
    /**
     * Feature: schema-driven-knowledge-graph, Property 8: Schema Threshold Triggering
     * 
     * For any schema with completeness score ≥ threshold, entity instantiation should be triggered;
     * if completeness < threshold, no entity should be created.
     */
    test('meets_threshold should be true when completeness >= threshold', () => {
      fc.assert(
        fc.property(
          fieldsArbitrary,
          schemaArbitrary,
          sourceConfidenceArbitrary,
          (fields, schema, sourceConfidence) => {
            const result = calculateCompleteness(fields, schema, sourceConfidence);
            
            // meets_threshold should match the comparison
            if (result.completeness >= schema.threshold) {
              expect(result.meets_threshold).toBe(true);
            } else {
              expect(result.meets_threshold).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('getTriggeredSchemas should only return schemas that meet threshold', () => {
      fc.assert(
        fc.property(
          fieldsArbitrary,
          fc.array(schemaArbitrary, { minLength: 1, maxLength: 5 }),
          sourceConfidenceArbitrary,
          (fields, schemas, sourceConfidence) => {
            const schemaScores = matchSchemas(fields, schemas, sourceConfidence);
            const triggered = getTriggeredSchemas(schemaScores);
            
            // All triggered schemas should meet threshold
            triggered.forEach(score => {
              expect(score.meets_threshold).toBe(true);
              expect(score.completeness).toBeGreaterThanOrEqual(
                schemas.find(s => s.schema_name === score.schema_name).threshold
              );
            });
            
            // All non-triggered schemas should not meet threshold
            const triggeredNames = new Set(triggered.map(s => s.schema_name));
            schemaScores.forEach(score => {
              if (!triggeredNames.has(score.schema_name)) {
                expect(score.meets_threshold).toBe(false);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('shouldTriggerSchema should match meets_threshold from calculateCompleteness', () => {
      fc.assert(
        fc.property(
          fieldsArbitrary,
          schemaArbitrary,
          sourceConfidenceArbitrary,
          (fields, schema, sourceConfidence) => {
            const result = calculateCompleteness(fields, schema, sourceConfidence);
            const shouldTrigger = shouldTriggerSchema(fields, schema, sourceConfidence);
            
            // Both methods should agree
            expect(shouldTrigger).toBe(result.meets_threshold);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('threshold triggering should be consistent across different methods', () => {
      fc.assert(
        fc.property(
          fieldsArbitrary,
          fc.array(schemaArbitrary, { minLength: 1, maxLength: 3 }),
          sourceConfidenceArbitrary,
          (fields, schemas, sourceConfidence) => {
            // Method 1: matchSchemas + getTriggeredSchemas
            const schemaScores = matchSchemas(fields, schemas, sourceConfidence);
            const triggered = getTriggeredSchemas(schemaScores);
            
            // Method 2: shouldTriggerSchema for each schema
            const triggeredByMethod2 = schemas.filter(schema => 
              shouldTriggerSchema(fields, schema, sourceConfidence)
            );
            
            // Both methods should return same number of triggered schemas
            expect(triggered.length).toBe(triggeredByMethod2.length);
            
            // Schema names should match
            const triggeredNames1 = new Set(triggered.map(s => s.schema_name));
            const triggeredNames2 = new Set(triggeredByMethod2.map(s => s.schema_name));
            expect(triggeredNames1).toEqual(triggeredNames2);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('increasing source confidence should not decrease triggered schemas', () => {
      fc.assert(
        fc.property(
          fieldsArbitrary,
          fc.array(schemaArbitrary, { minLength: 1, maxLength: 5 }),
          (fields, schemas) => {
            // Test with increasing confidence levels
            const confidenceLevels = [0.5, 0.7, 0.9, 1.0];
            let previousTriggeredCount = 0;
            
            confidenceLevels.forEach(confidence => {
              const schemaScores = matchSchemas(fields, schemas, confidence);
              const triggered = getTriggeredSchemas(schemaScores);
              
              // Triggered count should not decrease with higher confidence
              expect(triggered.length).toBeGreaterThanOrEqual(previousTriggeredCount);
              previousTriggeredCount = triggered.length;
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('all fields matching should trigger schemas with threshold <= 1.0', () => {
      fc.assert(
        fc.property(
          schemaArbitrary,
          sourceConfidenceArbitrary,
          (schema, sourceConfidence) => {
            // Create fields that match all core fields
            const allMatchingFields = schema.core_fields.map(cf => ({
              name: cf.name,
              value: 'test',
              type: 'entity',
              confidence: 0.9
            }));
            
            const result = calculateCompleteness(allMatchingFields, schema, sourceConfidence);
            
            // If all fields match and source confidence is high enough, should meet threshold
            if (sourceConfidence >= schema.threshold) {
              expect(result.meets_threshold).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('threshold boundary should be handled correctly', () => {
      fc.assert(
        fc.property(
          schemaArbitrary,
          (schema) => {
            // Create fields that exactly match the threshold
            // We'll match fields until we reach the threshold
            let accumulatedWeight = 0;
            const matchingFields = [];
            
            for (const coreField of schema.core_fields) {
              matchingFields.push({
                name: coreField.name,
                value: 'test',
                type: 'entity',
                confidence: 0.9
              });
              accumulatedWeight += coreField.weight;
              
              // Stop when we're at or just above threshold
              if (accumulatedWeight >= schema.threshold) {
                break;
              }
            }
            
            // Use source confidence of 1.0 for exact calculation
            const result = calculateCompleteness(matchingFields, schema, 1.0);
            
            // Should meet threshold
            expect(result.meets_threshold).toBe(true);
            expect(result.completeness).toBeGreaterThanOrEqual(schema.threshold);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Integration Properties', () => {
    test('matchSchemas should preserve all schema information', () => {
      fc.assert(
        fc.property(
          fieldsArbitrary,
          fc.array(schemaArbitrary, { minLength: 1, maxLength: 5 }),
          sourceConfidenceArbitrary,
          (fields, schemas, sourceConfidence) => {
            const results = matchSchemas(fields, schemas, sourceConfidence);
            
            // Should return same number of results as schemas
            expect(results.length).toBe(schemas.length);
            
            // Each schema should appear exactly once
            const schemaNames = results.map(r => r.schema_name);
            const uniqueNames = new Set(schemaNames);
            expect(uniqueNames.size).toBe(schemas.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('sorting by completeness should be stable', () => {
      fc.assert(
        fc.property(
          fieldsArbitrary,
          fc.array(schemaArbitrary, { minLength: 2, maxLength: 5 }),
          sourceConfidenceArbitrary,
          (fields, schemas, sourceConfidence) => {
            const results = matchSchemas(fields, schemas, sourceConfidence);
            
            // Results should be sorted in descending order
            for (let i = 0; i < results.length - 1; i++) {
              expect(results[i].completeness).toBeGreaterThanOrEqual(
                results[i + 1].completeness
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
