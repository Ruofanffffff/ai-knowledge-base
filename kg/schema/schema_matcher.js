/**
 * Schema Matcher
 * 
 * Calculates completeness scores for schemas based on extracted fields,
 * determines which schemas should be triggered, and integrates with the
 * rule-based completeness calculation from the schema_score prompt module.
 * 
 * Design Reference: Phase 2 - Schema Management Module
 * Validates: Requirements 3.4, 3.5, 3.6, 3.7, 3.9, 3.10
 * Properties: 7 (Schema Completeness Calculation), 8 (Schema Threshold Triggering)
 */

const { calculateRuleBasedCompleteness } = require('../prompts/schema_score');
const performanceMonitor = require('../utils/performance_monitor');

/**
 * Match fields against multiple schemas and calculate completeness scores
 * 
 * This is the primary method for schema matching. It uses pure rule-based
 * calculation (0 Token consumption) to determine which schemas should be
 * triggered based on field completeness.
 * 
 * @param {Array} fields - Extracted fields from CKB
 * @param {Array} schemas - Array of schema definitions
 * @param {number} sourceConfidence - Source confidence from CKB (0-1)
 * @returns {Array<SchemaScore>} Array of schema scores, sorted by completeness (descending)
 * 
 * @example
 * const fields = [
 *   { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
 *   { name: '时间', value: '2025-01', type: 'time', confidence: 0.95 },
 *   { name: '指标', value: '水位', type: 'indicator', confidence: 0.95 }
 * ];
 * const schemas = [waterLevelSchema, environmentSchema];
 * const scores = matchSchemas(fields, schemas, 0.9);
 * // Returns: [
 * //   { schema_name: '地下水位变化事件', completeness: 0.72, matched_fields: [...], ... },
 * //   { schema_name: '区域环境监测', completeness: 0.54, matched_fields: [...], ... }
 * // ]
 */
function matchSchemas(fields, schemas, sourceConfidence = 1.0) {
  const startTime = Date.now();
  
  // Validate inputs
  if (!Array.isArray(fields)) {
    throw new Error('fields must be an array');
  }
  
  if (!Array.isArray(schemas)) {
    throw new Error('schemas must be an array');
  }
  
  if (typeof sourceConfidence !== 'number' || sourceConfidence < 0 || sourceConfidence > 1) {
    throw new Error('sourceConfidence must be a number between 0 and 1');
  }
  
  try {
    // If no schemas, return empty array
    if (schemas.length === 0) {
      return [];
    }
    
    // Calculate completeness for each schema (even with empty fields)
    const schemaScores = schemas.map(schema => {
      return calculateCompleteness(fields, schema, sourceConfidence);
    });
    
    // Sort by completeness score (descending)
    schemaScores.sort((a, b) => b.completeness - a.completeness);
    
    // Record performance
    performanceMonitor.recordLocalProcessing({
      match_time: Date.now() - startTime,
      metadata: {
        method: 'schema_matching',
        schemas_checked: schemas.length,
        matches_found: schemaScores.filter(s => s.meets_threshold).length,
        fields_count: fields.length
      }
    });
    
    return schemaScores;
  } catch (error) {
    // Record error
    performanceMonitor.recordError({
      type: 'matching_error',
      module: 'schema_matcher',
      operation: 'matchSchemas',
      message: error.message
    });
    throw error;
  }
}

/**
 * Calculate completeness score for a single schema
 * 
 * Formula: Completeness = Σ(field_match_count × field_weight) × source_confidence
 * 
 * This implements the core completeness calculation as specified in the design:
 * - Each matched field contributes its weight to the total score
 * - The total is multiplied by the source confidence
 * - Result is always between 0 and 1
 * 
 * @param {Array} fields - Extracted fields from CKB
 * @param {Object} schema - Schema definition
 * @param {number} sourceConfidence - Source confidence from CKB (0-1)
 * @returns {Object} Schema score object
 * 
 * @example
 * const fields = [
 *   { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
 *   { name: '时间', value: '2025-01', type: 'time', confidence: 0.95 }
 * ];
 * const schema = {
 *   schema_name: '地下水位变化事件',
 *   core_fields: [
 *     { name: '区域', weight: 0.3, required: true },
 *     { name: '时间', weight: 0.2, required: true },
 *     { name: '指标', weight: 0.2, required: true }
 *   ],
 *   threshold: 0.75
 * };
 * const score = calculateCompleteness(fields, schema, 0.9);
 * // Returns: {
 * //   schema_name: '地下水位变化事件',
 * //   completeness: 0.45,  // (0.3 + 0.2) * 0.9
 * //   matched_fields: ['区域', '时间'],
 * //   missing_fields: ['指标'],
 * //   meets_threshold: false
 * // }
 */
function calculateCompleteness(fields, schema, sourceConfidence = 1.0) {
  // Validate inputs
  if (!Array.isArray(fields)) {
    throw new Error('fields must be an array');
  }
  
  if (!schema || typeof schema !== 'object') {
    throw new Error('schema must be an object');
  }
  
  if (!schema.schema_name) {
    throw new Error('schema must have a schema_name');
  }
  
  if (!Array.isArray(schema.core_fields)) {
    throw new Error('schema.core_fields must be an array');
  }
  
  if (typeof schema.threshold !== 'number') {
    throw new Error('schema.threshold must be a number');
  }
  
  if (typeof sourceConfidence !== 'number' || sourceConfidence < 0 || sourceConfidence > 1) {
    throw new Error('sourceConfidence must be a number between 0 and 1');
  }
  
  // Use the rule-based completeness calculation from schema_score prompt module
  // This ensures consistency between rule-based and LLM-based scoring
  return calculateRuleBasedCompleteness(fields, schema, sourceConfidence);
}

/**
 * Get schemas that meet the threshold for entity instantiation
 * 
 * Filters schema scores to only include those that meet or exceed their
 * defined threshold. These are the schemas that should trigger entity creation.
 * 
 * @param {Array<SchemaScore>} schemaScores - Array of schema scores
 * @returns {Array<SchemaScore>} Schemas that meet threshold
 * 
 * @example
 * const schemaScores = [
 *   { schema_name: 'Schema A', completeness: 0.85, threshold: 0.75, meets_threshold: true },
 *   { schema_name: 'Schema B', completeness: 0.65, threshold: 0.75, meets_threshold: false }
 * ];
 * const triggered = getTriggeredSchemas(schemaScores);
 * // Returns: [{ schema_name: 'Schema A', ... }]
 */
function getTriggeredSchemas(schemaScores) {
  if (!Array.isArray(schemaScores)) {
    throw new Error('schemaScores must be an array');
  }
  
  return schemaScores.filter(score => score.meets_threshold === true);
}

/**
 * Find the best matching schema for given fields
 * 
 * Returns the schema with the highest completeness score that meets its threshold.
 * If no schema meets the threshold, returns null.
 * 
 * @param {Array} fields - Extracted fields from CKB
 * @param {Array} schemas - Array of schema definitions
 * @param {number} sourceConfidence - Source confidence from CKB (0-1)
 * @returns {Object|null} Best matching schema score or null
 * 
 * @example
 * const fields = [...];
 * const schemas = [schema1, schema2, schema3];
 * const best = findBestSchema(fields, schemas, 0.9);
 * // Returns: { schema_name: 'Schema A', completeness: 0.92, ... } or null
 */
function findBestSchema(fields, schemas, sourceConfidence = 1.0) {
  const schemaScores = matchSchemas(fields, schemas, sourceConfidence);
  const triggered = getTriggeredSchemas(schemaScores);
  
  // Return the first (highest scoring) triggered schema, or null if none
  return triggered.length > 0 ? triggered[0] : null;
}

/**
 * Check if a specific schema meets its threshold for given fields
 * 
 * Convenience method to check if a single schema would be triggered
 * without calculating scores for all schemas.
 * 
 * @param {Array} fields - Extracted fields from CKB
 * @param {Object} schema - Schema definition
 * @param {number} sourceConfidence - Source confidence from CKB (0-1)
 * @returns {boolean} True if schema meets threshold
 * 
 * @example
 * const fields = [...];
 * const schema = waterLevelSchema;
 * const shouldTrigger = shouldTriggerSchema(fields, schema, 0.9);
 * // Returns: true or false
 */
function shouldTriggerSchema(fields, schema, sourceConfidence = 1.0) {
  const score = calculateCompleteness(fields, schema, sourceConfidence);
  return score.meets_threshold;
}

/**
 * Get detailed matching information for a schema
 * 
 * Provides detailed information about which fields matched, which are missing,
 * and the contribution of each field to the completeness score.
 * 
 * @param {Array} fields - Extracted fields from CKB
 * @param {Object} schema - Schema definition
 * @param {number} sourceConfidence - Source confidence from CKB (0-1)
 * @returns {Object} Detailed matching information
 * 
 * @example
 * const details = getMatchingDetails(fields, schema, 0.9);
 * // Returns: {
 * //   schema_name: '地下水位变化事件',
 * //   completeness: 0.72,
 * //   matched_fields: [
 * //     { name: '区域', weight: 0.3, contribution: 0.27 },
 * //     { name: '时间', weight: 0.2, contribution: 0.18 }
 * //   ],
 * //   missing_fields: [
 * //     { name: '指标', weight: 0.2, required: true }
 * //   ],
 * //   meets_threshold: false,
 * //   threshold: 0.75,
 * //   gap: 0.03
 * // }
 */
function getMatchingDetails(fields, schema, sourceConfidence = 1.0) {
  const score = calculateCompleteness(fields, schema, sourceConfidence);
  
  // Build field name set for quick lookup
  const fieldNames = new Set(fields.map(f => f.name));
  
  // Calculate detailed matched fields with contributions
  const matchedFieldsDetails = schema.core_fields
    .filter(cf => fieldNames.has(cf.name))
    .map(cf => ({
      name: cf.name,
      weight: cf.weight,
      required: cf.required,
      contribution: cf.weight * sourceConfidence
    }));
  
  // Calculate detailed missing fields
  const missingFieldsDetails = schema.core_fields
    .filter(cf => !fieldNames.has(cf.name))
    .map(cf => ({
      name: cf.name,
      weight: cf.weight,
      required: cf.required,
      potential_contribution: cf.weight * sourceConfidence
    }));
  
  // Calculate gap to threshold (if not met)
  const gap = score.meets_threshold ? 0 : schema.threshold - score.completeness;
  
  return {
    schema_name: schema.schema_name,
    entity_type: schema.entity_type,
    completeness: score.completeness,
    matched_fields: matchedFieldsDetails,
    missing_fields: missingFieldsDetails,
    meets_threshold: score.meets_threshold,
    threshold: schema.threshold,
    gap: Math.max(0, gap),
    source_confidence: sourceConfidence
  };
}

/**
 * Batch match fields against schemas for multiple CKBs
 * 
 * Efficiently processes multiple CKBs at once, useful for bulk processing.
 * 
 * @param {Array} ckbFieldPairs - Array of {ckb_id, fields, sourceConfidence} objects
 * @param {Array} schemas - Array of schema definitions
 * @returns {Array} Array of {ckb_id, schemaScores} objects
 * 
 * @example
 * const ckbFieldPairs = [
 *   { ckb_id: 'ckb_001', fields: [...], sourceConfidence: 0.9 },
 *   { ckb_id: 'ckb_002', fields: [...], sourceConfidence: 0.85 }
 * ];
 * const results = batchMatchSchemas(ckbFieldPairs, schemas);
 * // Returns: [
 * //   { ckb_id: 'ckb_001', schemaScores: [...] },
 * //   { ckb_id: 'ckb_002', schemaScores: [...] }
 * // ]
 */
function batchMatchSchemas(ckbFieldPairs, schemas) {
  if (!Array.isArray(ckbFieldPairs)) {
    throw new Error('ckbFieldPairs must be an array');
  }
  
  if (!Array.isArray(schemas)) {
    throw new Error('schemas must be an array');
  }
  
  return ckbFieldPairs.map(pair => {
    const { ckb_id, fields, sourceConfidence = 1.0 } = pair;
    
    if (!ckb_id) {
      throw new Error('Each ckbFieldPair must have a ckb_id');
    }
    
    const schemaScores = matchSchemas(fields || [], schemas, sourceConfidence);
    
    return {
      ckb_id,
      schemaScores,
      triggeredSchemas: getTriggeredSchemas(schemaScores)
    };
  });
}

/**
 * Get statistics about schema matching results
 * 
 * Provides aggregate statistics useful for monitoring and optimization.
 * 
 * @param {Array<SchemaScore>} schemaScores - Array of schema scores
 * @returns {Object} Statistics object
 * 
 * @example
 * const stats = getMatchingStats(schemaScores);
 * // Returns: {
 * //   total_schemas: 5,
 * //   triggered_schemas: 2,
 * //   trigger_rate: 0.4,
 * //   avg_completeness: 0.65,
 * //   max_completeness: 0.92,
 * //   min_completeness: 0.15
 * // }
 */
function getMatchingStats(schemaScores) {
  if (!Array.isArray(schemaScores)) {
    throw new Error('schemaScores must be an array');
  }
  
  if (schemaScores.length === 0) {
    return {
      total_schemas: 0,
      triggered_schemas: 0,
      trigger_rate: 0,
      avg_completeness: 0,
      max_completeness: 0,
      min_completeness: 0
    };
  }
  
  const triggered = schemaScores.filter(s => s.meets_threshold);
  const completenessValues = schemaScores.map(s => s.completeness);
  const avgCompleteness = completenessValues.reduce((a, b) => a + b, 0) / completenessValues.length;
  
  return {
    total_schemas: schemaScores.length,
    triggered_schemas: triggered.length,
    trigger_rate: triggered.length / schemaScores.length,
    avg_completeness: avgCompleteness,
    max_completeness: Math.max(...completenessValues),
    min_completeness: Math.min(...completenessValues)
  };
}

/**
 * Validate schema score object structure
 * 
 * @param {Object} schemaScore - Schema score to validate
 * @returns {boolean} True if valid
 * @throws {Error} If invalid
 */
function validateSchemaScore(schemaScore) {
  if (!schemaScore || typeof schemaScore !== 'object') {
    throw new Error('schemaScore must be an object');
  }
  
  if (!schemaScore.schema_name || typeof schemaScore.schema_name !== 'string') {
    throw new Error('schemaScore must have a schema_name (string)');
  }
  
  if (typeof schemaScore.completeness !== 'number' || 
      schemaScore.completeness < 0 || 
      schemaScore.completeness > 1) {
    throw new Error('schemaScore.completeness must be a number between 0 and 1');
  }
  
  if (!Array.isArray(schemaScore.matched_fields)) {
    throw new Error('schemaScore.matched_fields must be an array');
  }
  
  if (!Array.isArray(schemaScore.missing_fields)) {
    throw new Error('schemaScore.missing_fields must be an array');
  }
  
  if (typeof schemaScore.meets_threshold !== 'boolean') {
    throw new Error('schemaScore.meets_threshold must be a boolean');
  }
  
  return true;
}

module.exports = {
  matchSchemas,
  calculateCompleteness,
  getTriggeredSchemas,
  findBestSchema,
  shouldTriggerSchema,
  getMatchingDetails,
  batchMatchSchemas,
  getMatchingStats,
  validateSchemaScore
};
