/**
 * Relation Type Definition
 * 
 * Defines the data structure and validation functions for relation types.
 * Relation types define the semantic connections between entities in the knowledge graph.
 * 
 * Design Reference: Relation Type Expansion
 * Validates: Requirements 7.1-7.10
 */

/**
 * Valid domain values for relation types
 */
const VALID_DOMAINS = ['life', 'work', 'travel', 'shopping', 'government', 'management'];

/**
 * Create a new RelationTypeDefinition
 * 
 * @param {Object} config - Configuration object
 * @returns {Object} RelationTypeDefinition object
 */
function createRelationTypeDefinition(config) {
  const {
    relationTypeId,
    name,
    displayName,
    description = '',
    domain,
    category,
    sourceEntityTypes = [],
    targetEntityTypes = [],
    isDirectional = true,
    isTemporal = false,
    supportsConfidence = true,
    parentType = null,
    metadata = {},
    version = '1.0.0',
    active = true
  } = config;

  return {
    relationTypeId,
    name,
    displayName,
    description,
    domain,
    category,
    sourceEntityTypes,
    targetEntityTypes,
    isDirectional,
    isTemporal,
    supportsConfidence,
    parentType,
    metadata,
    version,
    active,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

/**
 * Validate a RelationTypeDefinition
 * 
 * @param {Object} relationType - RelationTypeDefinition to validate
 * @returns {Object} Validation result with { valid: boolean, errors: string[] }
 */
function validateRelationTypeDefinition(relationType) {
  const errors = [];

  // Required fields validation
  const requiredFields = [
    'relationTypeId',
    'name',
    'displayName',
    'description',
    'domain',
    'category',
    'sourceEntityTypes',
    'targetEntityTypes',
    'isDirectional',
    'isTemporal',
    'supportsConfidence'
  ];

  for (const field of requiredFields) {
    if (relationType[field] === undefined || relationType[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Type validation
  if (relationType.relationTypeId && typeof relationType.relationTypeId !== 'string') {
    errors.push('relationTypeId must be a string');
  }

  if (relationType.name && typeof relationType.name !== 'string') {
    errors.push('name must be a string');
  }

  if (relationType.displayName && typeof relationType.displayName !== 'string') {
    errors.push('displayName must be a string');
  }

  if (relationType.description && typeof relationType.description !== 'string') {
    errors.push('description must be a string');
  }

  if (relationType.domain && typeof relationType.domain !== 'string') {
    errors.push('domain must be a string');
  }

  if (relationType.category && typeof relationType.category !== 'string') {
    errors.push('category must be a string');
  }

  if (relationType.sourceEntityTypes && !Array.isArray(relationType.sourceEntityTypes)) {
    errors.push('sourceEntityTypes must be an array');
  }

  if (relationType.targetEntityTypes && !Array.isArray(relationType.targetEntityTypes)) {
    errors.push('targetEntityTypes must be an array');
  }

  if (relationType.isDirectional !== undefined && typeof relationType.isDirectional !== 'boolean') {
    errors.push('isDirectional must be a boolean');
  }

  if (relationType.isTemporal !== undefined && typeof relationType.isTemporal !== 'boolean') {
    errors.push('isTemporal must be a boolean');
  }

  if (relationType.supportsConfidence !== undefined && typeof relationType.supportsConfidence !== 'boolean') {
    errors.push('supportsConfidence must be a boolean');
  }

  // Domain validation
  if (relationType.domain && !VALID_DOMAINS.includes(relationType.domain)) {
    errors.push(`Invalid domain: ${relationType.domain}. Must be one of: ${VALID_DOMAINS.join(', ')}`);
  }

  // Entity types validation
  if (relationType.sourceEntityTypes && relationType.sourceEntityTypes.length === 0) {
    errors.push('sourceEntityTypes must contain at least one entity type');
  }

  if (relationType.targetEntityTypes && relationType.targetEntityTypes.length === 0) {
    errors.push('targetEntityTypes must contain at least one entity type');
  }

  // ID format validation
  if (relationType.relationTypeId && relationType.relationTypeId.length < 3) {
    errors.push('relationTypeId must be at least 3 characters long');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check if a relation type definition has all required metadata fields
 * 
 * @param {Object} relationType - RelationTypeDefinition to check
 * @returns {boolean} True if all required fields are present
 */
function hasRequiredMetadata(relationType) {
  const requiredFields = [
    'relationTypeId',
    'name',
    'displayName',
    'description',
    'domain',
    'sourceEntityTypes',
    'targetEntityTypes',
    'isDirectional',
    'isTemporal',
    'supportsConfidence'
  ];

  return requiredFields.every(field => 
    relationType.hasOwnProperty(field) && 
    relationType[field] !== null && 
    relationType[field] !== undefined
  );
}

/**
 * Normalize a relation type definition
 * Ensures all fields have proper defaults and types
 * 
 * @param {Object} relationType - RelationTypeDefinition to normalize
 * @returns {Object} Normalized RelationTypeDefinition
 */
function normalizeRelationTypeDefinition(relationType) {
  return {
    relationTypeId: relationType.relationTypeId || '',
    name: relationType.name || '',
    displayName: relationType.displayName || '',
    description: relationType.description || '',
    domain: relationType.domain || '',
    category: relationType.category || '',
    sourceEntityTypes: Array.isArray(relationType.sourceEntityTypes) ? relationType.sourceEntityTypes : [],
    targetEntityTypes: Array.isArray(relationType.targetEntityTypes) ? relationType.targetEntityTypes : [],
    isDirectional: relationType.isDirectional !== undefined ? relationType.isDirectional : true,
    isTemporal: relationType.isTemporal !== undefined ? relationType.isTemporal : false,
    supportsConfidence: relationType.supportsConfidence !== undefined ? relationType.supportsConfidence : true,
    parentType: relationType.parentType || null,
    metadata: relationType.metadata || {},
    version: relationType.version || '1.0.0',
    active: relationType.active !== undefined ? relationType.active : true,
    createdAt: relationType.createdAt || new Date(),
    updatedAt: relationType.updatedAt || new Date()
  };
}

/**
 * Check if two relation type definitions are equal
 * 
 * @param {Object} type1 - First RelationTypeDefinition
 * @param {Object} type2 - Second RelationTypeDefinition
 * @returns {boolean} True if equal
 */
function areRelationTypesEqual(type1, type2) {
  if (!type1 || !type2) return false;
  
  return type1.relationTypeId === type2.relationTypeId &&
         type1.name === type2.name &&
         type1.displayName === type2.displayName &&
         type1.domain === type2.domain &&
         type1.category === type2.category;
}

module.exports = {
  VALID_DOMAINS,
  createRelationTypeDefinition,
  validateRelationTypeDefinition,
  hasRequiredMetadata,
  normalizeRelationTypeDefinition,
  areRelationTypesEqual
};
