/**
 * Backward Compatibility Module
 * 
 * Ensures that enhanced knowledge graph output maintains backward compatibility
 * with existing systems by preserving all original fields and adding new fields
 * as additional properties.
 * 
 * Design Reference: Requirements 5.1-5.4
 * Validates: Requirements 5.1, 5.2, 5.3
 * 
 * Key Features:
 * - Field preservation validation
 * - Schema structure validation
 * - Safe field addition
 * - Compatibility reporting
 */

/**
 * Original entity schema fields (must be preserved)
 */
const ORIGINAL_ENTITY_FIELDS = [
  'entity_id',
  'entity_type',
  'canonical_name',
  'aliases',
  'schemas',
  'supported_by',
  'attributes',
  'confidence',
  'created_at',
  'updated_at'
];

/**
 * Original relation schema fields (must be preserved)
 */
const ORIGINAL_RELATION_FIELDS = [
  'source_id',
  'target_id',
  'type',
  'subtype',
  'confidence',
  'evidence_ckb',
  'evidence_text',
  'metadata'
];

/**
 * Enhanced entity fields (new fields added by human-readable enhancements)
 */
const ENHANCED_ENTITY_FIELDS = [
  'llm_enriched',
  'name_standardization',
  'original_name',
  'standardized',
  'schema_name',
  'fields'
];

/**
 * Enhanced relation fields (new fields added by human-readable enhancements)
 */
const ENHANCED_RELATION_FIELDS = [
  'description',
  'description_method',
  'description_confidence',
  'hierarchical_type',
  'extraction_method',
  'domain'
];

/**
 * Validate that all original fields are preserved in enhanced entity
 * 
 * @param {Object} originalEntity - Original entity object
 * @param {Object} enhancedEntity - Enhanced entity object
 * @returns {Object} Validation result
 */
function validateEntityFieldPreservation(originalEntity, enhancedEntity) {
  const missingFields = [];
  const modifiedFields = [];
  
  for (const field of ORIGINAL_ENTITY_FIELDS) {
    // Check if field exists in enhanced entity
    if (!(field in enhancedEntity)) {
      missingFields.push(field);
      continue;
    }
    
    // Check if field value was modified (for non-object fields)
    if (originalEntity[field] !== undefined && 
        typeof originalEntity[field] !== 'object' &&
        originalEntity[field] !== enhancedEntity[field]) {
      modifiedFields.push({
        field: field,
        original: originalEntity[field],
        enhanced: enhancedEntity[field]
      });
    }
  }
  
  return {
    valid: missingFields.length === 0 && modifiedFields.length === 0,
    missingFields: missingFields,
    modifiedFields: modifiedFields,
    preservedFields: ORIGINAL_ENTITY_FIELDS.filter(f => 
      f in enhancedEntity && !missingFields.includes(f)
    )
  };
}

/**
 * Validate that all original fields are preserved in enhanced relation
 * 
 * @param {Object} originalRelation - Original relation object
 * @param {Object} enhancedRelation - Enhanced relation object
 * @returns {Object} Validation result
 */
function validateRelationFieldPreservation(originalRelation, enhancedRelation) {
  const missingFields = [];
  const modifiedFields = [];
  
  for (const field of ORIGINAL_RELATION_FIELDS) {
    // Check if field exists in enhanced relation
    if (!(field in enhancedRelation)) {
      missingFields.push(field);
      continue;
    }
    
    // Special handling for metadata field - it can be extended with new fields
    if (field === 'metadata') {
      // Parse both metadata objects
      let originalMetadata = {};
      let enhancedMetadata = {};
      
      try {
        originalMetadata = typeof originalRelation.metadata === 'string' 
          ? JSON.parse(originalRelation.metadata) 
          : originalRelation.metadata || {};
      } catch (error) {
        // If original metadata is invalid, skip validation
        continue;
      }
      
      try {
        enhancedMetadata = typeof enhancedRelation.metadata === 'string'
          ? JSON.parse(enhancedRelation.metadata)
          : enhancedRelation.metadata || {};
      } catch (error) {
        // If enhanced metadata is invalid, mark as modified
        modifiedFields.push({
          field: field,
          original: originalRelation[field],
          enhanced: enhancedRelation[field]
        });
        continue;
      }
      
      // Check if all original metadata fields are preserved
      for (const key of Object.keys(originalMetadata)) {
        if (!(key in enhancedMetadata)) {
          modifiedFields.push({
            field: `metadata.${key}`,
            original: originalMetadata[key],
            enhanced: undefined
          });
        } else if (originalMetadata[key] !== enhancedMetadata[key]) {
          modifiedFields.push({
            field: `metadata.${key}`,
            original: originalMetadata[key],
            enhanced: enhancedMetadata[key]
          });
        }
      }
      
      continue;
    }
    
    // Check if field value was modified (for non-object fields)
    if (originalRelation[field] !== undefined && 
        typeof originalRelation[field] !== 'object' &&
        originalRelation[field] !== enhancedRelation[field]) {
      modifiedFields.push({
        field: field,
        original: originalRelation[field],
        enhanced: enhancedRelation[field]
      });
    }
  }
  
  return {
    valid: missingFields.length === 0 && modifiedFields.length === 0,
    missingFields: missingFields,
    modifiedFields: modifiedFields,
    preservedFields: ORIGINAL_RELATION_FIELDS.filter(f => 
      f in enhancedRelation && !missingFields.includes(f)
    )
  };
}

/**
 * Ensure entity has all required original fields
 * 
 * Adds missing fields with default values if they don't exist.
 * 
 * @param {Object} entity - Entity object
 * @returns {Object} Entity with all required fields
 */
function ensureEntityFields(entity) {
  const ensuredEntity = { ...entity };
  
  // Ensure required fields exist
  if (!ensuredEntity.entity_id) {
    ensuredEntity.entity_id = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  if (!ensuredEntity.entity_type) {
    ensuredEntity.entity_type = 'GeneralEntity';
  }
  
  if (!ensuredEntity.canonical_name) {
    ensuredEntity.canonical_name = 'unnamed_entity';
  }
  
  if (!ensuredEntity.aliases) {
    ensuredEntity.aliases = [];
  }
  
  if (!ensuredEntity.schemas) {
    ensuredEntity.schemas = [];
  }
  
  if (!ensuredEntity.supported_by) {
    ensuredEntity.supported_by = [];
  }
  
  if (!ensuredEntity.attributes) {
    ensuredEntity.attributes = {};
  }
  
  if (ensuredEntity.confidence === undefined) {
    ensuredEntity.confidence = 0.5;
  }
  
  if (!ensuredEntity.created_at) {
    ensuredEntity.created_at = new Date().toISOString();
  }
  
  if (!ensuredEntity.updated_at) {
    ensuredEntity.updated_at = new Date().toISOString();
  }
  
  return ensuredEntity;
}

/**
 * Ensure relation has all required original fields
 * 
 * Adds missing fields with default values if they don't exist.
 * 
 * @param {Object} relation - Relation object
 * @returns {Object} Relation with all required fields
 */
function ensureRelationFields(relation) {
  const ensuredRelation = { ...relation };
  
  // Ensure required fields exist
  if (!ensuredRelation.source_id) {
    throw new Error('Relation must have source_id');
  }
  
  if (!ensuredRelation.target_id) {
    throw new Error('Relation must have target_id');
  }
  
  if (!ensuredRelation.type) {
    ensuredRelation.type = 'unknown';
  }
  
  if (!ensuredRelation.subtype) {
    ensuredRelation.subtype = 'unknown';
  }
  
  if (ensuredRelation.confidence === undefined) {
    ensuredRelation.confidence = 0.5;
  }
  
  if (!ensuredRelation.evidence_ckb) {
    ensuredRelation.evidence_ckb = JSON.stringify([]);
  }
  
  if (ensuredRelation.evidence_text === undefined) {
    ensuredRelation.evidence_text = null;
  }
  
  if (!ensuredRelation.metadata) {
    ensuredRelation.metadata = JSON.stringify({});
  }
  
  return ensuredRelation;
}

/**
 * Add enhanced fields to entity safely
 * 
 * Only adds fields that don't already exist.
 * 
 * @param {Object} entity - Entity object
 * @param {Object} enhancements - Enhanced fields to add
 * @returns {Object} Entity with enhanced fields
 */
function addEnhancedEntityFields(entity, enhancements) {
  const enhancedEntity = { ...entity };
  
  // Add enhanced fields only if they don't exist
  for (const [key, value] of Object.entries(enhancements)) {
    if (!(key in enhancedEntity)) {
      enhancedEntity[key] = value;
    }
  }
  
  return enhancedEntity;
}

/**
 * Add enhanced fields to relation safely
 * 
 * Enhanced fields are typically stored in metadata JSON.
 * This function parses metadata, adds fields, and re-serializes.
 * 
 * @param {Object} relation - Relation object
 * @param {Object} enhancements - Enhanced fields to add
 * @returns {Object} Relation with enhanced fields
 */
function addEnhancedRelationFields(relation, enhancements) {
  const enhancedRelation = { ...relation };
  
  // Parse metadata if it's a string
  let metadata = {};
  if (typeof enhancedRelation.metadata === 'string') {
    try {
      metadata = JSON.parse(enhancedRelation.metadata);
    } catch (error) {
      console.warn('[BackwardCompatibility] Failed to parse relation metadata:', error);
      metadata = {};
    }
  } else if (typeof enhancedRelation.metadata === 'object') {
    metadata = { ...enhancedRelation.metadata };
  }
  
  // Add enhanced fields to metadata
  for (const [key, value] of Object.entries(enhancements)) {
    if (!(key in metadata)) {
      metadata[key] = value;
    }
  }
  
  // Re-serialize metadata
  enhancedRelation.metadata = JSON.stringify(metadata);
  
  return enhancedRelation;
}

/**
 * Validate knowledge graph schema structure
 * 
 * Ensures the knowledge graph output conforms to the expected schema.
 * 
 * @param {Object} knowledgeGraph - Knowledge graph object
 * @returns {Object} Validation result
 */
function validateKnowledgeGraphSchema(knowledgeGraph) {
  const errors = [];
  const warnings = [];
  
  // Check top-level structure
  if (!knowledgeGraph || typeof knowledgeGraph !== 'object') {
    errors.push('Knowledge graph must be an object');
    return { valid: false, errors, warnings };
  }
  
  // Check entities array
  if (!Array.isArray(knowledgeGraph.entities)) {
    errors.push('Knowledge graph must have entities array');
  } else {
    // Validate each entity
    knowledgeGraph.entities.forEach((entity, index) => {
      const validation = validateEntitySchema(entity);
      if (!validation.valid) {
        errors.push(`Entity ${index} (${entity.entity_id || 'unknown'}): ${validation.errors.join(', ')}`);
      }
      if (validation.warnings.length > 0) {
        warnings.push(`Entity ${index} (${entity.entity_id || 'unknown'}): ${validation.warnings.join(', ')}`);
      }
    });
  }
  
  // Check relations array
  if (!Array.isArray(knowledgeGraph.relations)) {
    errors.push('Knowledge graph must have relations array');
  } else {
    // Validate each relation
    knowledgeGraph.relations.forEach((relation, index) => {
      const validation = validateRelationSchema(relation);
      if (!validation.valid) {
        errors.push(`Relation ${index}: ${validation.errors.join(', ')}`);
      }
      if (validation.warnings.length > 0) {
        warnings.push(`Relation ${index}: ${validation.warnings.join(', ')}`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

/**
 * Validate entity schema
 * 
 * @param {Object} entity - Entity object
 * @returns {Object} Validation result
 */
function validateEntitySchema(entity) {
  const errors = [];
  const warnings = [];
  
  // Check required fields
  for (const field of ORIGINAL_ENTITY_FIELDS) {
    if (!(field in entity)) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Check field types
  if (entity.entity_id && typeof entity.entity_id !== 'string') {
    errors.push('entity_id must be a string');
  }
  
  if (entity.entity_type && typeof entity.entity_type !== 'string') {
    errors.push('entity_type must be a string');
  }
  
  if (entity.canonical_name && typeof entity.canonical_name !== 'string') {
    errors.push('canonical_name must be a string');
  }
  
  if (entity.aliases && !Array.isArray(entity.aliases)) {
    errors.push('aliases must be an array');
  }
  
  if (entity.schemas && !Array.isArray(entity.schemas)) {
    errors.push('schemas must be an array');
  }
  
  if (entity.supported_by && !Array.isArray(entity.supported_by)) {
    errors.push('supported_by must be an array');
  }
  
  if (entity.attributes && typeof entity.attributes !== 'object') {
    errors.push('attributes must be an object');
  }
  
  if (entity.confidence !== undefined && 
      (typeof entity.confidence !== 'number' || entity.confidence < 0 || entity.confidence > 1)) {
    errors.push('confidence must be a number between 0 and 1');
  }
  
  // Check for enhanced fields (warnings only)
  for (const field of ENHANCED_ENTITY_FIELDS) {
    if (field in entity) {
      warnings.push(`Enhanced field present: ${field}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

/**
 * Validate relation schema
 * 
 * @param {Object} relation - Relation object
 * @returns {Object} Validation result
 */
function validateRelationSchema(relation) {
  const errors = [];
  const warnings = [];
  
  // Check required fields
  for (const field of ORIGINAL_RELATION_FIELDS) {
    if (!(field in relation)) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Check field types
  if (relation.source_id && typeof relation.source_id !== 'string') {
    errors.push('source_id must be a string');
  }
  
  if (relation.target_id && typeof relation.target_id !== 'string') {
    errors.push('target_id must be a string');
  }
  
  if (relation.type && typeof relation.type !== 'string') {
    errors.push('type must be a string');
  }
  
  if (relation.subtype && typeof relation.subtype !== 'string') {
    errors.push('subtype must be a string');
  }
  
  if (relation.confidence !== undefined && 
      (typeof relation.confidence !== 'number' || relation.confidence < 0 || relation.confidence > 1)) {
    errors.push('confidence must be a number between 0 and 1');
  }
  
  // Check metadata is valid JSON string
  if (relation.metadata && typeof relation.metadata === 'string') {
    try {
      const metadata = JSON.parse(relation.metadata);
      
      // Check for enhanced fields in metadata (warnings only)
      for (const field of ENHANCED_RELATION_FIELDS) {
        if (field in metadata) {
          warnings.push(`Enhanced field present in metadata: ${field}`);
        }
      }
    } catch (error) {
      errors.push('metadata must be valid JSON string');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

/**
 * Generate compatibility report
 * 
 * Compares original and enhanced knowledge graphs and generates a report.
 * 
 * @param {Object} originalKG - Original knowledge graph
 * @param {Object} enhancedKG - Enhanced knowledge graph
 * @returns {Object} Compatibility report
 */
function generateCompatibilityReport(originalKG, enhancedKG) {
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalEntities: enhancedKG.entities?.length || 0,
      totalRelations: enhancedKG.relations?.length || 0,
      entitiesPreserved: 0,
      relationsPreserved: 0,
      entitiesWithIssues: 0,
      relationsWithIssues: 0
    },
    entityIssues: [],
    relationIssues: [],
    schemaValidation: null
  };
  
  // Validate entities
  if (originalKG.entities && enhancedKG.entities) {
    for (let i = 0; i < Math.min(originalKG.entities.length, enhancedKG.entities.length); i++) {
      const validation = validateEntityFieldPreservation(
        originalKG.entities[i],
        enhancedKG.entities[i]
      );
      
      if (validation.valid) {
        report.summary.entitiesPreserved++;
      } else {
        report.summary.entitiesWithIssues++;
        report.entityIssues.push({
          entityId: enhancedKG.entities[i].entity_id,
          missingFields: validation.missingFields,
          modifiedFields: validation.modifiedFields
        });
      }
    }
  }
  
  // Validate relations
  if (originalKG.relations && enhancedKG.relations) {
    for (let i = 0; i < Math.min(originalKG.relations.length, enhancedKG.relations.length); i++) {
      const validation = validateRelationFieldPreservation(
        originalKG.relations[i],
        enhancedKG.relations[i]
      );
      
      if (validation.valid) {
        report.summary.relationsPreserved++;
      } else {
        report.summary.relationsWithIssues++;
        report.relationIssues.push({
          relationIndex: i,
          missingFields: validation.missingFields,
          modifiedFields: validation.modifiedFields
        });
      }
    }
  }
  
  // Validate schema structure
  report.schemaValidation = validateKnowledgeGraphSchema(enhancedKG);
  
  return report;
}

module.exports = {
  // Constants
  ORIGINAL_ENTITY_FIELDS,
  ORIGINAL_RELATION_FIELDS,
  ENHANCED_ENTITY_FIELDS,
  ENHANCED_RELATION_FIELDS,
  
  // Validation functions
  validateEntityFieldPreservation,
  validateRelationFieldPreservation,
  validateKnowledgeGraphSchema,
  validateEntitySchema,
  validateRelationSchema,
  
  // Field management functions
  ensureEntityFields,
  ensureRelationFields,
  addEnhancedEntityFields,
  addEnhancedRelationFields,
  
  // Reporting functions
  generateCompatibilityReport
};
