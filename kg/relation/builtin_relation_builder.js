/**
 * Built-in Relation Builder
 * 
 * Generates deterministic relations based on Schema definitions (0 Token cost).
 * Built-in relations are predefined in the Schema and are automatically created
 * when an entity is instantiated.
 */

const entityStore = require('../entity/entity_store');

/**
 * Build built-in relations for an entity based on Schema definition
 * 
 * @param {Object} entity - The entity to build relations for
 * @param {Object} schema - The schema definition containing relation templates
 * @param {Array} fields - The extracted fields from CKB
 * @param {Array} ckbIds - The CKB IDs supporting this entity
 * @returns {Promise<Array>} Array of relation objects
 */
async function buildRelations(entity, schema, fields, ckbIds = []) {
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
        ckbIds
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
 * @returns {Promise<Object|null>} Relation object or null
 */
async function buildRelationFromTemplate(entity, relTemplate, fields, ckbIds) {
  const { type, target_field, direction = 'outgoing' } = relTemplate;
  
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
    subtype: type,
    confidence: 1.0,  // Built-in relations are deterministic
    evidence_ckb: JSON.stringify(ckbIds),
    evidence_text: null,
    metadata: JSON.stringify({
      schema_name: entity.schemas[0]?.schema_name,
      target_field: target_field,
      direction: direction
    })
  };
  
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
 * @returns {boolean} True if valid
 */
function validateRelation(relation) {
  // Check required fields
  if (!relation.source_id || !relation.target_id) {
    return false;
  }
  
  // Check that source and target are different
  if (relation.source_id === relation.target_id) {
    return false;
  }
  
  // Check confidence range
  if (relation.confidence < 0 || relation.confidence > 1) {
    return false;
  }
  
  return true;
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
