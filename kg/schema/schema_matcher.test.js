/**
 * Unit Tests for Schema Matcher
 * 
 * Tests the schema matching and completeness calculation functionality.
 * Validates Requirements 3.4, 3.5, 3.6, 3.7, 3.9, 3.10
 */

const {
  matchSchemas,
  calculateCompleteness,
  getTriggeredSchemas,
  findBestSchema,
  shouldTriggerSchema,
  getMatchingDetails,
  batchMatchSchemas,
  getMatchingStats,
  validateSchemaScore
} = require('./schema_matcher');

describe('Schema Matcher', () => {
  // Test data
  const waterLevelSchema = {
    schema_name: '地下水位变化事件',
    entity_type: 'EventEntity',
    core_fields: [
      { name: '区域', weight: 0.3, required: true },
      { name: '时间', weight: 0.2, required: true },
      { name: '指标', weight: 0.2, required: true },
      { name: '数值', weight: 0.2, required: false },
      { name: '单位', weight: 0.1, required: false }
    ],
    threshold: 0.75
  };

  const environmentSchema = {
    schema_name: '区域环境监测',
    entity_type: 'EventEntity',
    core_fields: [
      { name: '区域', weight: 0.4, required: true },
      { name: '指标', weight: 0.3, required: true },
      { name: '数值', weight: 0.3, required: false }
    ],
    threshold: 0.7
  };

  const personSchema = {
    schema_name: '人物实体',
    entity_type: 'PersonEntity',
    core_fields: [
      { name: '人名', weight: 0.5, required: true },
      { name: '职位', weight: 0.3, required: false },
      { name: '组织', weight: 0.2, required: false }
    ],
    threshold: 0.6
  };

  const completeFields = [
    { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
    { name: '时间', value: '2025-01', type: 'time', confidence: 0.95 },
    { name: '指标', value: '水位', type: 'indicator', confidence: 0.95 },
    { name: '数值', value: '10', type: 'number', confidence: 0.95 },
    { name: '单位', value: '米', type: 'unit', confidence: 0.95 }
  ];

  const partialFields = [
    { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
    { name: '时间', value: '2025-01', type: 'time', confidence: 0.95 }
  ];

  const minimalFields = [
    { name: '数值', value: '42', type: 'number', confidence: 0.8 }
  ];

  describe('calculateCompleteness', () => {
    test('should calculate completeness for complete field match', () => {
      const result = calculateCompleteness(completeFields, waterLevelSchema, 0.9);
      
      expect(result).toHaveProperty('schema_name', '地下水位变化事件');
      expect(result).toHaveProperty('completeness');
      expect(result.completeness).toBeCloseTo(0.9, 2); // All fields matched: 1.0 * 0.9
      expect(result).toHaveProperty('matched_fields');
      expect(result.matched_fields).toHaveLength(5);
      expect(result).toHaveProperty('missing_fields');
      expect(result.missing_fields).toHaveLength(0);
      expect(result).toHaveProperty('meets_threshold');
      expect(result.meets_threshold).toBe(true);
    });

    test('should calculate completeness for partial field match', () => {
      const result = calculateCompleteness(partialFields, waterLevelSchema, 0.9);
      
      expect(result.schema_name).toBe('地下水位变化事件');
      expect(result.completeness).toBeCloseTo(0.45, 2); // (0.3 + 0.2) * 0.9
      expect(result.matched_fields).toEqual(['区域', '时间']);
      expect(result.missing_fields).toEqual(['指标', '数值', '单位']);
      expect(result.meets_threshold).toBe(false);
    });

    test('should calculate completeness for minimal field match', () => {
      const result = calculateCompleteness(minimalFields, waterLevelSchema, 0.9);
      
      expect(result.completeness).toBeCloseTo(0.18, 2); // 0.2 * 0.9
      expect(result.matched_fields).toEqual(['数值']);
      expect(result.missing_fields).toHaveLength(4);
      expect(result.meets_threshold).toBe(false);
    });

    test('should handle source confidence correctly', () => {
      const highConfidence = calculateCompleteness(completeFields, waterLevelSchema, 1.0);
      const lowConfidence = calculateCompleteness(completeFields, waterLevelSchema, 0.5);
      
      expect(highConfidence.completeness).toBeCloseTo(1.0, 2);
      expect(lowConfidence.completeness).toBeCloseTo(0.5, 2);
    });

    test('should handle empty fields', () => {
      const result = calculateCompleteness([], waterLevelSchema, 0.9);
      
      expect(result.completeness).toBe(0);
      expect(result.matched_fields).toHaveLength(0);
      expect(result.missing_fields).toHaveLength(5);
      expect(result.meets_threshold).toBe(false);
    });

    test('should throw error for invalid inputs', () => {
      expect(() => calculateCompleteness(null, waterLevelSchema, 0.9))
        .toThrow('fields must be an array');
      
      expect(() => calculateCompleteness(completeFields, null, 0.9))
        .toThrow('schema must be an object');
      
      expect(() => calculateCompleteness(completeFields, {}, 0.9))
        .toThrow('schema must have a schema_name');
      
      expect(() => calculateCompleteness(completeFields, waterLevelSchema, 1.5))
        .toThrow('sourceConfidence must be a number between 0 and 1');
    });

    test('should handle completeness at threshold boundary', () => {
      // Create fields that exactly meet threshold
      const boundaryFields = [
        { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
        { name: '时间', value: '2025-01', type: 'time', confidence: 0.95 },
        { name: '指标', value: '水位', type: 'indicator', confidence: 0.95 },
        { name: '数值', value: '10', type: 'number', confidence: 0.95 }
      ];
      
      // (0.3 + 0.2 + 0.2 + 0.2) * 0.9 = 0.81, which is > 0.75 threshold
      const result = calculateCompleteness(boundaryFields, waterLevelSchema, 0.9);
      
      expect(result.completeness).toBeGreaterThanOrEqual(waterLevelSchema.threshold);
      expect(result.meets_threshold).toBe(true);
    });
  });

  describe('matchSchemas', () => {
    test('should match fields against multiple schemas', () => {
      const schemas = [waterLevelSchema, environmentSchema];
      const results = matchSchemas(completeFields, schemas, 0.9);
      
      expect(results).toHaveLength(2);
      // Both schemas should be present (order depends on completeness scores)
      const schemaNames = results.map(r => r.schema_name);
      expect(schemaNames).toContain('地下水位变化事件');
      expect(schemaNames).toContain('区域环境监测');
      // Results should be sorted by completeness
      expect(results[0].completeness).toBeGreaterThanOrEqual(results[1].completeness);
    });

    test('should sort results by completeness (descending)', () => {
      const schemas = [waterLevelSchema, environmentSchema];
      const results = matchSchemas(completeFields, schemas, 0.9);
      
      // waterLevelSchema should score higher (all fields match)
      expect(results[0].completeness).toBeGreaterThanOrEqual(results[1].completeness);
    });

    test('should handle empty fields array', () => {
      const schemas = [waterLevelSchema, environmentSchema];
      const results = matchSchemas([], schemas, 0.9);
      
      expect(results).toHaveLength(2);
      results.forEach(result => {
        expect(result.completeness).toBe(0);
        expect(result.meets_threshold).toBe(false);
      });
    });

    test('should handle empty schemas array', () => {
      const results = matchSchemas(completeFields, [], 0.9);
      
      expect(results).toHaveLength(0);
    });

    test('should throw error for invalid inputs', () => {
      expect(() => matchSchemas(null, [waterLevelSchema], 0.9))
        .toThrow('fields must be an array');
      
      expect(() => matchSchemas(completeFields, null, 0.9))
        .toThrow('schemas must be an array');
      
      expect(() => matchSchemas(completeFields, [waterLevelSchema], -0.1))
        .toThrow('sourceConfidence must be a number between 0 and 1');
    });

    test('should handle multiple schemas with different thresholds', () => {
      const schemas = [waterLevelSchema, environmentSchema, personSchema];
      const results = matchSchemas(partialFields, schemas, 0.9);
      
      expect(results).toHaveLength(3);
      // All should have calculated completeness
      results.forEach(result => {
        expect(result).toHaveProperty('completeness');
        expect(result).toHaveProperty('meets_threshold');
      });
    });
  });

  describe('getTriggeredSchemas', () => {
    test('should filter schemas that meet threshold', () => {
      const schemas = [waterLevelSchema, environmentSchema];
      const schemaScores = matchSchemas(completeFields, schemas, 0.9);
      const triggered = getTriggeredSchemas(schemaScores);
      
      expect(triggered.length).toBeGreaterThan(0);
      triggered.forEach(schema => {
        expect(schema.meets_threshold).toBe(true);
      });
    });

    test('should return empty array when no schemas meet threshold', () => {
      const schemas = [waterLevelSchema, environmentSchema];
      const schemaScores = matchSchemas(minimalFields, schemas, 0.9);
      const triggered = getTriggeredSchemas(schemaScores);
      
      expect(triggered).toHaveLength(0);
    });

    test('should throw error for invalid input', () => {
      expect(() => getTriggeredSchemas(null))
        .toThrow('schemaScores must be an array');
    });
  });

  describe('findBestSchema', () => {
    test('should return highest scoring schema that meets threshold', () => {
      const schemas = [waterLevelSchema, environmentSchema];
      const best = findBestSchema(completeFields, schemas, 0.9);
      
      expect(best).not.toBeNull();
      expect(best.meets_threshold).toBe(true);
      // Best should be one of the schemas that meets threshold
      expect(['地下水位变化事件', '区域环境监测']).toContain(best.schema_name);
    });

    test('should return null when no schema meets threshold', () => {
      const schemas = [waterLevelSchema, environmentSchema];
      const best = findBestSchema(minimalFields, schemas, 0.9);
      
      expect(best).toBeNull();
    });

    test('should handle single schema', () => {
      const best = findBestSchema(completeFields, [waterLevelSchema], 0.9);
      
      expect(best).not.toBeNull();
      expect(best.schema_name).toBe('地下水位变化事件');
    });
  });

  describe('shouldTriggerSchema', () => {
    test('should return true when schema meets threshold', () => {
      const result = shouldTriggerSchema(completeFields, waterLevelSchema, 0.9);
      
      expect(result).toBe(true);
    });

    test('should return false when schema does not meet threshold', () => {
      const result = shouldTriggerSchema(minimalFields, waterLevelSchema, 0.9);
      
      expect(result).toBe(false);
    });

    test('should handle boundary cases', () => {
      // Create fields that exactly meet threshold
      const boundaryFields = [
        { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
        { name: '时间', value: '2025-01', type: 'time', confidence: 0.95 },
        { name: '指标', value: '水位', type: 'indicator', confidence: 0.95 },
        { name: '数值', value: '10', type: 'number', confidence: 0.95 }
      ];
      
      const result = shouldTriggerSchema(boundaryFields, waterLevelSchema, 0.9);
      
      expect(result).toBe(true);
    });
  });

  describe('getMatchingDetails', () => {
    test('should provide detailed matching information', () => {
      const details = getMatchingDetails(partialFields, waterLevelSchema, 0.9);
      
      expect(details).toHaveProperty('schema_name', '地下水位变化事件');
      expect(details).toHaveProperty('entity_type', 'EventEntity');
      expect(details).toHaveProperty('completeness');
      expect(details).toHaveProperty('matched_fields');
      expect(details).toHaveProperty('missing_fields');
      expect(details).toHaveProperty('meets_threshold');
      expect(details).toHaveProperty('threshold');
      expect(details).toHaveProperty('gap');
      expect(details).toHaveProperty('source_confidence');
    });

    test('should include field contributions in matched fields', () => {
      const details = getMatchingDetails(partialFields, waterLevelSchema, 0.9);
      
      expect(details.matched_fields).toHaveLength(2);
      details.matched_fields.forEach(field => {
        expect(field).toHaveProperty('name');
        expect(field).toHaveProperty('weight');
        expect(field).toHaveProperty('required');
        expect(field).toHaveProperty('contribution');
      });
    });

    test('should include potential contributions in missing fields', () => {
      const details = getMatchingDetails(partialFields, waterLevelSchema, 0.9);
      
      expect(details.missing_fields).toHaveLength(3);
      details.missing_fields.forEach(field => {
        expect(field).toHaveProperty('name');
        expect(field).toHaveProperty('weight');
        expect(field).toHaveProperty('required');
        expect(field).toHaveProperty('potential_contribution');
      });
    });

    test('should calculate gap to threshold correctly', () => {
      const details = getMatchingDetails(partialFields, waterLevelSchema, 0.9);
      
      expect(details.gap).toBeGreaterThan(0);
      expect(details.gap).toBeCloseTo(
        waterLevelSchema.threshold - details.completeness,
        2
      );
    });

    test('should have zero gap when threshold is met', () => {
      const details = getMatchingDetails(completeFields, waterLevelSchema, 0.9);
      
      expect(details.meets_threshold).toBe(true);
      expect(details.gap).toBe(0);
    });
  });

  describe('batchMatchSchemas', () => {
    test('should process multiple CKBs at once', () => {
      const ckbFieldPairs = [
        { ckb_id: 'ckb_001', fields: completeFields, sourceConfidence: 0.9 },
        { ckb_id: 'ckb_002', fields: partialFields, sourceConfidence: 0.85 },
        { ckb_id: 'ckb_003', fields: minimalFields, sourceConfidence: 0.8 }
      ];
      
      const schemas = [waterLevelSchema, environmentSchema];
      const results = batchMatchSchemas(ckbFieldPairs, schemas);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toHaveProperty('ckb_id');
        expect(result).toHaveProperty('schemaScores');
        expect(result).toHaveProperty('triggeredSchemas');
        expect(Array.isArray(result.schemaScores)).toBe(true);
        expect(Array.isArray(result.triggeredSchemas)).toBe(true);
      });
    });

    test('should handle different source confidences', () => {
      const ckbFieldPairs = [
        { ckb_id: 'ckb_001', fields: completeFields, sourceConfidence: 1.0 },
        { ckb_id: 'ckb_002', fields: completeFields, sourceConfidence: 0.5 }
      ];
      
      const results = batchMatchSchemas(ckbFieldPairs, [waterLevelSchema]);
      
      expect(results[0].schemaScores[0].completeness).toBeGreaterThan(
        results[1].schemaScores[0].completeness
      );
    });

    test('should throw error for invalid inputs', () => {
      expect(() => batchMatchSchemas(null, [waterLevelSchema]))
        .toThrow('ckbFieldPairs must be an array');
      
      expect(() => batchMatchSchemas([{ fields: [] }], [waterLevelSchema]))
        .toThrow('Each ckbFieldPair must have a ckb_id');
    });

    test('should handle empty fields in batch', () => {
      const ckbFieldPairs = [
        { ckb_id: 'ckb_001', fields: [], sourceConfidence: 0.9 }
      ];
      
      const results = batchMatchSchemas(ckbFieldPairs, [waterLevelSchema]);
      
      expect(results).toHaveLength(1);
      expect(results[0].schemaScores).toHaveLength(1);
      expect(results[0].schemaScores[0].completeness).toBe(0);
    });
  });

  describe('getMatchingStats', () => {
    test('should calculate statistics for schema scores', () => {
      const schemas = [waterLevelSchema, environmentSchema, personSchema];
      const schemaScores = matchSchemas(completeFields, schemas, 0.9);
      const stats = getMatchingStats(schemaScores);
      
      expect(stats).toHaveProperty('total_schemas');
      expect(stats).toHaveProperty('triggered_schemas');
      expect(stats).toHaveProperty('trigger_rate');
      expect(stats).toHaveProperty('avg_completeness');
      expect(stats).toHaveProperty('max_completeness');
      expect(stats).toHaveProperty('min_completeness');
      
      expect(stats.total_schemas).toBe(3);
      expect(stats.trigger_rate).toBeGreaterThanOrEqual(0);
      expect(stats.trigger_rate).toBeLessThanOrEqual(1);
    });

    test('should handle empty schema scores', () => {
      const stats = getMatchingStats([]);
      
      expect(stats.total_schemas).toBe(0);
      expect(stats.triggered_schemas).toBe(0);
      expect(stats.trigger_rate).toBe(0);
      expect(stats.avg_completeness).toBe(0);
    });

    test('should calculate correct averages', () => {
      const schemaScores = [
        { completeness: 0.8, meets_threshold: true },
        { completeness: 0.6, meets_threshold: false },
        { completeness: 0.4, meets_threshold: false }
      ];
      
      const stats = getMatchingStats(schemaScores);
      
      expect(stats.avg_completeness).toBeCloseTo(0.6, 2);
      expect(stats.max_completeness).toBe(0.8);
      expect(stats.min_completeness).toBe(0.4);
      expect(stats.triggered_schemas).toBe(1);
      expect(stats.trigger_rate).toBeCloseTo(1/3, 2);
    });

    test('should throw error for invalid input', () => {
      expect(() => getMatchingStats(null))
        .toThrow('schemaScores must be an array');
    });
  });

  describe('validateSchemaScore', () => {
    test('should validate correct schema score', () => {
      const validScore = {
        schema_name: 'Test Schema',
        completeness: 0.85,
        matched_fields: ['field1', 'field2'],
        missing_fields: ['field3'],
        meets_threshold: true
      };
      
      expect(() => validateSchemaScore(validScore)).not.toThrow();
      expect(validateSchemaScore(validScore)).toBe(true);
    });

    test('should reject invalid schema score', () => {
      expect(() => validateSchemaScore(null))
        .toThrow('schemaScore must be an object');
      
      expect(() => validateSchemaScore({}))
        .toThrow('schemaScore must have a schema_name');
      
      expect(() => validateSchemaScore({ schema_name: 'Test' }))
        .toThrow('schemaScore.completeness must be a number between 0 and 1');
      
      expect(() => validateSchemaScore({ 
        schema_name: 'Test', 
        completeness: 1.5 
      })).toThrow('schemaScore.completeness must be a number between 0 and 1');
    });

    test('should validate all required fields', () => {
      const invalidScore = {
        schema_name: 'Test',
        completeness: 0.85,
        matched_fields: ['field1'],
        missing_fields: ['field2']
        // missing meets_threshold
      };
      
      expect(() => validateSchemaScore(invalidScore))
        .toThrow('schemaScore.meets_threshold must be a boolean');
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete workflow from fields to triggered schemas', () => {
      // Step 1: Match schemas
      const schemas = [waterLevelSchema, environmentSchema];
      const schemaScores = matchSchemas(completeFields, schemas, 0.9);
      
      // Step 2: Get triggered schemas
      const triggered = getTriggeredSchemas(schemaScores);
      
      // Step 3: Get best schema
      const best = findBestSchema(completeFields, schemas, 0.9);
      
      // Step 4: Get detailed information
      const details = getMatchingDetails(completeFields, waterLevelSchema, 0.9);
      
      // Assertions
      expect(schemaScores.length).toBeGreaterThan(0);
      expect(triggered.length).toBeGreaterThan(0);
      expect(best).not.toBeNull();
      expect(details.meets_threshold).toBe(true);
    });

    test('should handle workflow with no triggered schemas', () => {
      const schemas = [waterLevelSchema, environmentSchema];
      const schemaScores = matchSchemas(minimalFields, schemas, 0.9);
      const triggered = getTriggeredSchemas(schemaScores);
      const best = findBestSchema(minimalFields, schemas, 0.9);
      
      expect(schemaScores.length).toBeGreaterThan(0);
      expect(triggered).toHaveLength(0);
      expect(best).toBeNull();
    });

    test('should maintain consistency across different methods', () => {
      const schemas = [waterLevelSchema];
      
      // Method 1: Using matchSchemas + getTriggeredSchemas
      const schemaScores = matchSchemas(completeFields, schemas, 0.9);
      const triggered = getTriggeredSchemas(schemaScores);
      
      // Method 2: Using shouldTriggerSchema
      const shouldTrigger = shouldTriggerSchema(completeFields, waterLevelSchema, 0.9);
      
      // Method 3: Using findBestSchema
      const best = findBestSchema(completeFields, schemas, 0.9);
      
      // All methods should agree
      expect(triggered.length > 0).toBe(shouldTrigger);
      expect(best !== null).toBe(shouldTrigger);
    });
  });
});
