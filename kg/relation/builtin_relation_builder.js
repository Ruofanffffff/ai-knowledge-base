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
 * Find target field with optimized matching logic
 * Priority: exact match -> aliases -> content extraction
 * 
 * @param {Array} fields - Available fields
 * @param {string} targetFieldName - Target field name to find
 * @param {Array} aliases - Field aliases to try
 * @returns {Object|null} Found field or null
 */
function findTargetField(fields, targetFieldName, aliases = []) {
  // Priority 1: Exact field name match
  let field = fields.find(f => f.name === targetFieldName);
  if (field && field.value) {
    console.log(`[FieldMatch] Exact match found: ${targetFieldName}`);
    return field;
  }
  
  // Priority 2: Try aliases
  if (aliases && aliases.length > 0) {
    for (const alias of aliases) {
      field = fields.find(f => f.name === alias);
      if (field && field.value) {
        console.log(`[FieldMatch] Alias match found: ${alias} (for ${targetFieldName})`);
        return field;
      }
    }
  }
  
  // Priority 3: Try extracting from content field
  const contentField = fields.find(f => f.name === 'content');
  if (contentField && contentField.value) {
    // Try to extract information from content using simple pattern matching
    const extracted = extractFromContent(contentField.value, targetFieldName, aliases);
    if (extracted) {
      console.log(`[FieldMatch] Extracted from content: ${targetFieldName} = ${extracted}`);
      return {
        name: targetFieldName,
        value: extracted,
        type: 'text',
        source: 'content_extraction'
      };
    }
  }
  
  console.log(`[FieldMatch] No match found for: ${targetFieldName}`);
  return null;
}

/**
 * Extract field value from content text
 * 
 * @param {string} content - Content text
 * @param {string} fieldName - Field name to extract
 * @param {Array} aliases - Field aliases
 * @returns {string|null} Extracted value or null
 */
function extractFromContent(content, fieldName, aliases = []) {
  // Simple pattern matching for common field types
  const patterns = {
    '地点': /(?:地点|位置|区域)[：:]\s*([^\n，。；]+)/,
    '位置': /(?:地点|位置|区域)[：:]\s*([^\n，。；]+)/,
    '执行单位': /(?:执行单位|实施单位|承办单位)[：:]\s*([^\n，。；]+)/,
    '单位': /(?:单位|公司|企业|组织)[：:]\s*([^\n，。；]+)/,
    '时间': /(?:时间|日期)[：:]\s*([^\n，。；]+)/,
    '金额': /(?:金额|费用|预算)[：:]\s*([^\n，。；]+)/
  };
  
  // Try field name
  if (patterns[fieldName]) {
    const match = content.match(patterns[fieldName]);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  // Try aliases
  for (const alias of aliases) {
    if (patterns[alias]) {
      const match = content.match(patterns[alias]);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
  }
  
  return null;
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
  
  console.log(`[BuiltinRelation] Building relations for entity ${entity.entity_id}, schema: ${schema.name || 'unknown'}`);
  
  // Check if schema has relation templates
  if (!schema.relations || schema.relations.length === 0) {
    console.log(`[BuiltinRelation] No relation templates defined in schema`);
    return relations;
  }
  
  console.log(`[BuiltinRelation] Processing ${schema.relations.length} relation templates`);
  
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
        console.log(`[BuiltinRelation] Successfully built relation: ${relTemplate.relation_type_id || relTemplate.type}`);
        relations.push(relation);
      } else {
        console.log(`[BuiltinRelation] Skipped relation (missing target field): ${relTemplate.relation_type_id || relTemplate.type}`);
      }
    } catch (error) {
      console.error(`[BuiltinRelation] Error building relation from template:`, error);
    }
  }
  
  console.log(`[BuiltinRelation] Built ${relations.length}/${schema.relations.length} relations`);
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
  const { type, target_field, direction = 'outgoing', relation_type_id, field_aliases = [] } = relTemplate;
  const { enableDescriptions = process.env.ENABLE_RELATION_DESCRIPTIONS === 'true' } = options;
  
  console.log(`[BuiltinRelation] Building relation type: ${relation_type_id || type}, target_field: ${target_field}`);
  
  // Validate relation type if specified
  let relationType = null;
  if (relation_type_id) {
    try {
      const registry = getRelationTypeRegistry();
      relationType = registry.get(relation_type_id);
      if (!relationType) {
        console.warn(`[BuiltinRelation] Relation type not found: ${relation_type_id}. Using legacy type: ${type}`);
      }
    } catch (error) {
      console.warn(`[BuiltinRelation] Could not validate relation type: ${error.message}`);
    }
  }
  
  // Find the target field value with optimized matching logic
  const targetField = findTargetField(fields, target_field, field_aliases);
  if (!targetField || !targetField.value) {
    console.log(`[BuiltinRelation] Target field not found. Searched for: ${target_field}, aliases: ${field_aliases.join(', ')}`);
    console.log(`[BuiltinRelation] Available fields: ${fields.map(f => f.name).join(', ')}`);
    return null;
  }
  
  console.log(`[BuiltinRelation] Found target field: ${targetField.name} = ${targetField.value}`);
  
  // Try to find or create target entity
  const targetEntity = await findOrCreateTargetEntity(
    targetField,
    entity.entity_type
  );
  
  if (!targetEntity) {
    console.log(`[BuiltinRelation] Failed to find or create target entity for field: ${targetField.name}`);
    return null;
  }
  
  console.log(`[BuiltinRelation] Target entity: ${targetEntity.entity_id} (${targetEntity.canonical_name})`);
  
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
  
  console.log(`[TargetEntity] Looking for entity with value: ${fieldValue}`);
  
  // Try to find existing entity by canonical name or alias
  let targetEntity = await entityStore.getEntityByCanonicalName(fieldValue);
  
  if (targetEntity) {
    console.log(`[TargetEntity] Found existing entity by canonical name: ${targetEntity.entity_id}`);
    return targetEntity;
  }
  
  // Search by alias
  const entities = await entityStore.searchEntities(fieldValue, { take: 1 });
  if (entities.length > 0) {
    targetEntity = entities[0];
    console.log(`[TargetEntity] Found existing entity by search: ${targetEntity.entity_id}`);
    return targetEntity;
  }
  
  // If not found, create a simple entity
  console.log(`[TargetEntity] Creating new simple entity for: ${fieldValue}`);
  targetEntity = await createSimpleEntity(fieldName, fieldValue, fieldType);
  console.log(`[TargetEntity] Created new entity: ${targetEntity.entity_id}`);
  
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

/**
 * Build built-in relations for multiple entities
 * 
 * @param {Array} entities - Array of entities
 * @returns {Promise<Array>} Array of built-in relations
 */
async function buildBuiltinRelations(entities) {
  console.log(`[BuiltinRelationBuilder] Processing ${entities.length} entities`);
  const allRelations = [];
  const schemaManager = require('../schema/schema_manager');
  
  // Load all schemas once (cache)
  const schemaCache = {};
  
  for (const entity of entities) {
    try {
      // Get schema name for this entity
      const schemaInfo = entity.schemas && entity.schemas.length > 0 
        ? entity.schemas[0] 
        : null;
      
      if (!schemaInfo || !schemaInfo.schema_name) {
        console.log(`[BuiltinRelationBuilder] Entity ${entity.entity_id} has no schema info`);
        continue;
      }
      
      console.log(`[BuiltinRelationBuilder] Processing entity ${entity.entity_id} with schema ${schemaInfo.schema_name}`);
      
      // Load full schema from database (with relations)
      let schema = schemaCache[schemaInfo.schema_name];
      if (!schema) {
        schema = await schemaManager.getSchemaByName(schemaInfo.schema_name);
        if (schema) {
          schemaCache[schemaInfo.schema_name] = schema;
          console.log(`[BuiltinRelationBuilder] Loaded schema ${schemaInfo.schema_name}, has relations: ${!!schema.relations}`);
        }
      }
      
      if (!schema) {
        console.log(`[BuiltinRelationBuilder] Schema ${schemaInfo.schema_name} not found in database`);
        continue;
      }
      
      // Parse relations if it's a JSON string
      if (typeof schema.relations === 'string') {
        try {
          schema.relations = JSON.parse(schema.relations);
          console.log(`[BuiltinRelationBuilder] Parsed ${schema.relations.length} relations from schema`);
        } catch (e) {
          console.warn(`Failed to parse relations for schema ${schema.name}`);
          schema.relations = [];
        }
      }
      
      // Skip if no relations defined
      if (!schema.relations || schema.relations.length === 0) {
        console.log(`[BuiltinRelationBuilder] Schema ${schemaInfo.schema_name} has no relations defined`);
        continue;
      }
      
      // Get fields from entity attributes
      const fields = Object.entries(entity.attributes).map(([name, value]) => ({
        name,
        value,
        type: 'text'
      }));
      
      console.log(`[BuiltinRelationBuilder] Entity has ${fields.length} fields: ${fields.map(f => f.name).join(', ')}`);
      
      // Build relations
      const relations = await buildRelations(entity, schema, fields, entity.supported_by);
      console.log(`[BuiltinRelationBuilder] Built ${relations.length} relations for entity ${entity.entity_id}`);
      allRelations.push(...relations);
    } catch (error) {
      console.error(`Error building built-in relations for entity ${entity.entity_id}:`, error);
    }
  }
  
  console.log(`[BuiltinRelationBuilder] Total relations built: ${allRelations.length}`);
  return allRelations;
}

module.exports = {
  buildRelations,
  buildRelationFromTemplate,
  buildRelationsBatch,
  buildBuiltinRelations,
  validateRelation,
  // Export for testing
  findOrCreateTargetEntity,
  createSimpleEntity,
  findTargetField,
  extractFromContent
};
