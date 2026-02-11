/**
 * Built-in Relation Builder
 * 
 * Generates deterministic relations based on Schema definitions (0 Token cost).
 * Built-in relations are predefined in the Schema and are automatically created
 * when an entity is instantiated.
 */

const entityStore = require('../entity/entity_store');

// Lazy load relation type modules to avoid circular dependencies
let relationTypeRegistry = null;
let relationTypeValidator = null;
let relationDescriptionGenerator = null;

function getRelationTypeRegistry() {
  if (!relationTypeRegistry) {
    const RelationTypeRegistry = require('./relation_type_registry');
    relationTypeRegistry = new RelationTypeRegistry();
  }
  return relationTypeRegistry;
}

function getRelationTypeValidator() {
  if (!relationTypeValidator) {
    const RelationTypeValidator = require('./relation_type_validator');
    const registry = getRelationTypeRegistry();
    relationTypeValidator = new RelationTypeValidator(registry);
  }
  return relationTypeValidator;
}

function getRelationDescriptionGenerator() {
  if (!relationDescriptionGenerator) {
    const { RelationDescriptionGenerator } = require('../human_readable/relation_description_generator');
    relationDescriptionGenerator = new RelationDescriptionGenerator({
      enableLLM: process.env.ENABLE_RELATION_DESCRIPTION_LLM === 'true',
      language: process.env.RELATION_DESCRIPTION_LANGUAGE || 'zh'
    });
  }
  return relationDescriptionGenerator;
}

/**
 * Build built-in relations for an entity based on Schema definition
 * 
 * @param {Object} entity - The entity to build relations for
 * @param {Object} schema - The schema definition containing relation templates
 * @param {Array} fields - The extracted fields from CKB
 * @param {Array} ckbIds - The CKB IDs supporting this entity
 * @param {Object} options - Additional options
 * @returns {Promise<Array>} Array of relation objects
 */
async function buildRelations(entity, schema, fields, ckbIds = [], options = {}) {
  const relations = [];
  
  // Check if schema has relation templates
  if (!schema.relations || schema.relations.length === 0) {
    return relations;
  }
  
  // Process each relation template
  for (const relTemplate of schema.relations) {
    try {
      const relation = await buildRelationFromTemplate(
        entity,
        relTemplate,
        fields,
        ckbIds,
        options
      );
      
      if (relation) {
        relations.push(relation);
      }
    } catch (error) {
      console.error(`Error building relation from template:`, error);
    }
  }
  
  return relations;
}

/**
 * Build a single relation from a template
 * 
 * @param {Object} entity - Source entity
 * @param {Object} relTemplate - Relation template from schema
 * @param {Array} fields - Extracted fields
 * @param {Array} ckbIds - Supporting CKB IDs
 * @param {Object} options - Additional options
 * @returns {Promise<Object|null>} Relation object or null
 */
async function buildRelationFromTemplate(entity, relTemplate, fields, ckbIds, options = {}) {
  const { type, target_field, direction = 'outgoing', relation_type_id } = relTemplate;
  const { enableDescriptions = process.env.ENABLE_RELATION_DESCRIPTIONS === 'true' } = options;
  
  // Validate relation type if specified
  let relationType = null;
  if (relation_type_id) {
    try {
      const registry = getRelationTypeRegistry();
      relationType = registry.get(relation_type_id);
      if (!relationType) {
        console.warn(`Relation type not found: ${relation_type_id}. Using legacy type: ${type}`);
      }
    } catch (error) {
      console.warn(`Could not validate relation type: ${error.message}`);
    }
  }
  
  // Find the target field value
  const targetField = fields.find(f => f.name === target_field);
  if (!targetField || !targetField.value) {
    return null;
  }
  
  // Try to find or create target entity
  const targetEntity = await findOrCreateTargetEntity(
    targetField,
    entity.entity_type
  );
  
  if (!targetEntity) {
    return null;
  }
  
  // Build relation object
  const relation = {
    source_id: direction === 'outgoing' ? entity.entity_id : targetEntity.entity_id,
    target_id: direction === 'outgoing' ? targetEntity.entity_id : entity.entity_id,
    type: 'builtin',
    subtype: relation_type_id || type,  // Use relation_type_id if available
    confidence: 1.0,  // Built-in relations are deterministic
    evidence_ckb: JSON.stringify(ckbIds),
    evidence_text: null,
    metadata: JSON.stringify({
      schema_name: entity.schemas[0]?.schema_name,
      target_field: target_field,
      direction: direction,
      relation_type_id: relation_type_id || null
    })
  };
  
  // Generate description if enabled
  if (enableDescriptions) {
    try {
      const generator = getRelationDescriptionGenerator();
      const sourceEntity = direction === 'outgoing' ? entity : targetEntity;
      const targetEntityForDesc = direction === 'outgoing' ? targetEntity : entity;
      
      const descriptionResult = await generator.generateDescription({
        type: relation_type_id || type,
        source: sourceEntity,
        target: targetEntityForDesc
      }, {
        method: process.env.DESCRIPTION_GENERATION_METHOD || 'auto'
      });
      
      // Add description to metadata
      const metadata = JSON.parse(relation.metadata);
      metadata.description = descriptionResult.description;
      metadata.description_method = descriptionResult.method;
      metadata.description_confidence = descriptionResult.confidence;
      relation.metadata = JSON.stringify(metadata);
    } catch (error) {
      console.warn(`Failed to generate description for relation: ${error.message}`);
    }
  }
  
  // Validate relation against relation type if available
  if (relationType) {
    try {
      const validator = getRelationTypeValidator();
      const validation = validator.validate(
        {
          sourceEntityType: entity.entity_type,
          targetEntityType: targetEntity.entity_type,
          confidence: relation.confidence
        },
        relationType
      );
      
      if (!validation.valid) {
        console.warn(`Relation validation failed for ${relation_type_id}:`, validation.errors);
        // Still create the relation but log the warning for backward compatibility
      }
    } catch (error) {
      console.warn(`Could not validate relation: ${error.message}`);
    }
  }
  
  return relation;
}

/**
 * Find or create a target entity for a relation
 * 
 * @param {Object} field - The field containing target entity information
 * @param {string} sourceEntityType - Type of the source entity
 * @returns {Promise<Object|null>} Target entity or null
 */
async function findOrCreateTargetEntity(field, sourceEntityType) {
  const { name: fieldName, value: fieldValue, type: fieldType } = field;
  
  // Try to find existing entity by canonical name or alias
  let targetEntity = await entityStore.getEntityByCanonicalName(fieldValue);
  
  if (!targetEntity) {
    // Search by alias
    const entities = await entityStore.searchEntities(fieldValue, { take: 1 });
    if (entities.length > 0) {
      targetEntity = entities[0];
    }
  }
  
  // If not found, create a simple entity
  if (!targetEntity) {
    targetEntity = await createSimpleEntity(fieldName, fieldValue, fieldType);
  }
  
  return targetEntity;
}

/**
 * Create a simple entity from a field value
 * 
 * @param {string} fieldName - Field name (e.g., "区域", "时间")
 * @param {string} fieldValue - Field value
 * @param {string} fieldType - Field type (location, time, etc.)
 * @returns {Promise<Object>} Created entity
 */
async function createSimpleEntity(fieldName, fieldValue, fieldType) {
  // Determine entity type based on field type
  const entityTypeMap = {
    location: 'LocationEntity',
    time: 'TimeEntity',
    entity: 'GeneralEntity',
    indicator: 'IndicatorEntity',
    default: 'AttributeEntity'
  };
  
  const entityType = entityTypeMap[fieldType] || entityTypeMap.default;
  
  // Create simple entity
  const entity = {
    entity_id: `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    entity_type: entityType,
    canonical_name: fieldValue,
    aliases: [],
    schemas: [{
      schema_name: `Simple_${fieldName}`,
      confidence: 0.8
    }],
    supported_by: [],
    attributes: {
      [fieldName]: fieldValue,
      source: 'builtin_relation'
    },
    confidence: 0.8,
    llm_enriched: false
  };
  
  // Save to database
  return await entityStore.saveEntity(entity);
}

/**
 * Build relations for multiple entities in batch
 * 
 * @param {Array} entities - Array of entities with their schemas and fields
 * @returns {Promise<Array>} Array of all generated relations
 */
async function buildRelationsBatch(entities) {
  const allRelations = [];
  
  for (const entityData of entities) {
    const { entity, schema, fields, ckbIds } = entityData;
    
    try {
      const relations = await buildRelations(entity, schema, fields, ckbIds);
      allRelations.push(...relations);
    } catch (error) {
      console.error(`Error building relations for entity ${entity.entity_id}:`, error);
    }
  }
  
  return allRelations;
}

/**
 * Validate a relation before creation
 * 
 * @param {Object} relation - Relation to validate
 * @param {Object} options - Validation options
 * @param {Object} options.sourceEntity - Source entity (for type validation)
 * @param {Object} options.targetEntity - Target entity (for type validation)
 * @returns {Object} Validation result with valid flag and errors
 */
function validateRelation(relation, options = {}) {
  const errors = [];
  
  // Check required fields
  if (!relation.source_id || !relation.target_id) {
    errors.push('Missing source_id or target_id');
  }
  
  // Check that source and target are different
  if (relation.source_id === relation.target_id) {
    errors.push('Source and target cannot be the same');
  }
  
  // Check confidence range
  if (relation.confidence < 0 || relation.confidence > 1) {
    errors.push('Confidence must be between 0 and 1');
  }
  
  // Validate against relation type if available
  if (relation.subtype && options.sourceEntity && options.targetEntity) {
    try {
      const registry = getRelationTypeRegistry();
      const relationType = registry.get(relation.subtype);
      if (relationType) {
        const validator = getRelationTypeValidator();
        const validation = validator.validate(
          {
            sourceEntityType: options.sourceEntity.entity_type,
            targetEntityType: options.targetEntity.entity_type,
            confidence: relation.confidence
          },
          relationType
        );
        
        if (!validation.valid) {
          errors.push(...validation.errors);
        }
      }
    } catch (error) {
      // Ignore validation errors if registry is not available
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  buildRelations,
  buildRelationFromTemplate,
  buildRelationsBatch,
  validateRelation,
  // Export for testing
  findOrCreateTargetEntity,
  createSimpleEntity
};
