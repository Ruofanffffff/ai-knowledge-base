/**
 * Schema Validator
 * 
 * Validates schema definitions including anchor_fields and anchor_config.
 * Ensures schemas are correctly configured for anchor-driven entity synthesis.
 */

/**
 * Valid normalization strategies for anchor fields
 */
const VALID_NORMALIZATION_STRATEGIES = [
  'time_month',
  'time_year',
  'time_day',
  'location',
  'indicator',
  'lowercase',
  'default'
];

/**
 * Valid conflict strategies
 */
const VALID_CONFLICT_STRATEGIES = [
  'auto',
  'llm_advisory',
  'manual'
];

/**
 * Valid time granularities
 */
const VALID_TIME_GRANULARITIES = [
  'day',
  'month',
  'year'
];

/**
 * Validate a complete schema definition
 * 
 * @param {Object} schema - Schema definition to validate
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validateSchema(schema) {
  const errors = [];
  
  // Required fields
  if (!schema.schema_name) {
    errors.push('Missing required field: schema_name');
  }
  
  if (!schema.entity_type) {
    errors.push('Missing required field: entity_type');
  }
  
  if (!schema.core_fields || !Array.isArray(schema.core_fields)) {
    errors.push('Missing or invalid core_fields (must be an array)');
  }
  
  if (typeof schema.threshold !== 'number' || schema.threshold < 0 || schema.threshold > 1) {
    errors.push('Invalid threshold (must be a number between 0 and 1)');
  }
  
  // Validate core_fields structure
  if (schema.core_fields && Array.isArray(schema.core_fields)) {
    schema.core_fields.forEach((field, index) => {
      if (!field.name) {
        errors.push(`core_fields[${index}]: Missing field name`);
      }
      if (typeof field.weight !== 'number' || field.weight < 0 || field.weight > 1) {
        errors.push(`core_fields[${index}]: Invalid weight (must be a number between 0 and 1)`);
      }
      if (typeof field.required !== 'boolean') {
        errors.push(`core_fields[${index}]: Invalid required (must be a boolean)`);
      }
    });
  }
  
  // Validate anchor_fields if present
  if (schema.anchor_fields) {
    const anchorFieldsErrors = validateAnchorFields(schema.anchor_fields, schema.core_fields);
    errors.push(...anchorFieldsErrors);
  }
  
  // Validate anchor_config if present
  if (schema.anchor_config) {
    const anchorConfigErrors = validateAnchorConfig(schema.anchor_config);
    errors.push(...anchorConfigErrors);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate anchor_fields configuration
 * 
 * @param {Array} anchorFields - Anchor fields configuration
 * @param {Array} coreFields - Core fields for reference
 * @returns {Array<string>} Array of error messages
 */
function validateAnchorFields(anchorFields, coreFields = []) {
  const errors = [];
  
  if (!Array.isArray(anchorFields)) {
    errors.push('anchor_fields must be an array');
    return errors;
  }
  
  if (anchorFields.length === 0) {
    errors.push('anchor_fields cannot be empty (at least one field required)');
  }
  
  const coreFieldNames = coreFields.map(f => f.name);
  const seenFieldNames = new Set();
  
  anchorFields.forEach((field, index) => {
    // Validate field structure
    if (!field.name) {
      errors.push(`anchor_fields[${index}]: Missing field name`);
      return;
    }
    
    // Check for duplicates
    if (seenFieldNames.has(field.name)) {
      errors.push(`anchor_fields[${index}]: Duplicate field name "${field.name}"`);
    }
    seenFieldNames.add(field.name);
    
    // Validate field exists in core_fields
    if (coreFieldNames.length > 0 && !coreFieldNames.includes(field.name)) {
      errors.push(`anchor_fields[${index}]: Field "${field.name}" not found in core_fields`);
    }
    
    // Validate normalization_strategy
    if (!field.normalization_strategy) {
      errors.push(`anchor_fields[${index}]: Missing normalization_strategy`);
    } else if (!VALID_NORMALIZATION_STRATEGIES.includes(field.normalization_strategy)) {
      errors.push(
        `anchor_fields[${index}]: Invalid normalization_strategy "${field.normalization_strategy}". ` +
        `Valid values: ${VALID_NORMALIZATION_STRATEGIES.join(', ')}`
      );
    }
    
    // Validate priority (optional)
    if (field.priority !== undefined) {
      if (typeof field.priority !== 'number' || field.priority < 1) {
        errors.push(`anchor_fields[${index}]: Invalid priority (must be a positive number)`);
      }
    }
  });
  
  return errors;
}

/**
 * Validate anchor_config configuration
 * 
 * @param {Object} anchorConfig - Anchor configuration
 * @returns {Array<string>} Array of error messages
 */
function validateAnchorConfig(anchorConfig) {
  const errors = [];
  
  if (typeof anchorConfig !== 'object' || anchorConfig === null) {
    errors.push('anchor_config must be an object');
    return errors;
  }
  
  // Validate time_granularity (optional)
  if (anchorConfig.time_granularity !== undefined) {
    if (!VALID_TIME_GRANULARITIES.includes(anchorConfig.time_granularity)) {
      errors.push(
        `Invalid time_granularity "${anchorConfig.time_granularity}". ` +
        `Valid values: ${VALID_TIME_GRANULARITIES.join(', ')}`
      );
    }
  }
  
  // Validate allow_fuzzy_match (optional)
  if (anchorConfig.allow_fuzzy_match !== undefined) {
    if (typeof anchorConfig.allow_fuzzy_match !== 'boolean') {
      errors.push('allow_fuzzy_match must be a boolean');
    }
  }
  
  // Validate conflict_strategy (optional)
  if (anchorConfig.conflict_strategy !== undefined) {
    if (!VALID_CONFLICT_STRATEGIES.includes(anchorConfig.conflict_strategy)) {
      errors.push(
        `Invalid conflict_strategy "${anchorConfig.conflict_strategy}". ` +
        `Valid values: ${VALID_CONFLICT_STRATEGIES.join(', ')}`
      );
    }
  }
  
  return errors;
}

/**
 * Validate that anchor fields are appropriate for the entity type
 * 
 * @param {string} entityType - Entity type
 * @param {Array} anchorFields - Anchor fields configuration
 * @returns {Object} Validation result with warnings
 */
function validateAnchorFieldsForEntityType(entityType, anchorFields) {
  const warnings = [];
  
  // EventEntity should typically have time-based anchors
  if (entityType === 'EventEntity') {
    const hasTimeField = anchorFields.some(f => 
      f.normalization_strategy.startsWith('time_')
    );
    if (!hasTimeField) {
      warnings.push('EventEntity typically requires a time-based anchor field');
    }
  }
  
  // LocationEntity should have location-based anchors
  if (entityType === 'LocationEntity') {
    const hasLocationField = anchorFields.some(f => 
      f.normalization_strategy === 'location'
    );
    if (!hasLocationField) {
      warnings.push('LocationEntity typically requires a location-based anchor field');
    }
  }
  
  return {
    valid: true,
    warnings
  };
}

/**
 * Validate a batch of schemas
 * 
 * @param {Array<Object>} schemas - Array of schema definitions
 * @returns {Object} Validation results
 */
function validateSchemas(schemas) {
  const results = {
    valid: true,
    totalSchemas: schemas.length,
    validSchemas: 0,
    invalidSchemas: 0,
    errors: []
  };
  
  schemas.forEach((schema, index) => {
    const validation = validateSchema(schema);
    
    if (validation.valid) {
      results.validSchemas++;
    } else {
      results.valid = false;
      results.invalidSchemas++;
      results.errors.push({
        schemaIndex: index,
        schemaName: schema.schema_name || 'Unknown',
        errors: validation.errors
      });
    }
  });
  
  return results;
}

module.exports = {
  validateSchema,
  validateAnchorFields,
  validateAnchorConfig,
  validateAnchorFieldsForEntityType,
  validateSchemas,
  VALID_NORMALIZATION_STRATEGIES,
  VALID_CONFLICT_STRATEGIES,
  VALID_TIME_GRANULARITIES
};
