/**
 * Relation Store
 * 
 * Handles storage and retrieval of knowledge graph relations.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Lazy load relation type modules to avoid circular dependencies
let relationTypeRegistry = null;
let relationTypeValidator = null;

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

/**
 * Save a single relation to the database
 * 
 * @param {Object} relation - Relation object to save
 * @param {Object} options - Save options
 * @param {boolean} options.validateRelationType - Whether to validate against relation type (default: true)
 * @param {Object} options.sourceEntity - Source entity (for validation)
 * @param {Object} options.targetEntity - Target entity (for validation)
 * @returns {Promise<Object>} Saved relation
 */
async function saveRelation(relation, options = {}) {
  const { validateRelationType = true, sourceEntity, targetEntity } = options;
  
  // Validate relation
  if (!relation.source_id || !relation.target_id) {
    throw new Error('Relation must have source_id and target_id');
  }
  
  // Validate against relation type if enabled and subtype is a relation type ID
  if (validateRelationType && relation.subtype) {
    try {
      const registry = getRelationTypeRegistry();
      const relationType = registry.get(relation.subtype);
      if (relationType && sourceEntity && targetEntity) {
        const validator = getRelationTypeValidator();
        const validation = validator.validate(
          {
            sourceEntityType: sourceEntity.entity_type,
            targetEntityType: targetEntity.entity_type,
            confidence: relation.confidence
          },
          relationType
        );
        
        if (!validation.valid) {
          console.warn(`Relation type validation failed for ${relation.subtype}:`, validation.errors);
          // Log warning but continue for backward compatibility
        }
      }
    } catch (error) {
      // Ignore validation errors if registry is not available
    }
  }
  
  // Check for duplicate
  const existing = await findDuplicate(relation);
  if (existing) {
    console.log(`Relation already exists: ${existing.id}`);
    return existing;
  }
  
  // Prepare data for database
  const data = {
    sourceId: relation.source_id,
    targetId: relation.target_id,
    type: relation.type,
    subtype: relation.subtype || null,
    weight: relation.weight || null,
    confidence: relation.confidence,
    evidenceCkb: typeof relation.evidence_ckb === 'string' 
      ? relation.evidence_ckb 
      : JSON.stringify(relation.evidence_ckb || []),
    evidenceText: relation.evidence_text || null,
    metadata: typeof relation.metadata === 'string'
      ? relation.metadata
      : JSON.stringify(relation.metadata || {})
  };
  
  // Save to database
  const saved = await prisma.kGRelation.create({ data });
  
  return formatRelation(saved);
}

/**
 * Save multiple relations in batch
 * 
 * @param {Array} relations - Array of relation objects
 * @returns {Promise<Array>} Array of saved relations
 */
async function saveRelations(relations) {
  const saved = [];
  
  for (const relation of relations) {
    try {
      const savedRelation = await saveRelation(relation);
      saved.push(savedRelation);
    } catch (error) {
      console.error(`Error saving relation:`, error);
    }
  }
  
  return saved;
}

/**
 * Find duplicate relation
 * 
 * @param {Object} relation - Relation to check
 * @returns {Promise<Object|null>} Existing relation or null
 */
async function findDuplicate(relation) {
  return await prisma.kGRelation.findFirst({
    where: {
      sourceId: relation.source_id,
      targetId: relation.target_id,
      type: relation.type,
      subtype: relation.subtype || null
    }
  });
}

/**
 * Get relation by ID
 * 
 * @param {string} relationId - Relation ID
 * @returns {Promise<Object|null>} Relation or null
 */
async function getRelationById(relationId) {
  const relation = await prisma.kGRelation.findUnique({
    where: { id: relationId },
    include: {
      source: true,
      target: true
    }
  });
  
  return relation ? formatRelation(relation) : null;
}

/**
 * Get all relations for an entity (both incoming and outgoing)
 * 
 * @param {string} entityId - Entity ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of relations
 */
async function getRelationsByEntity(entityId, options = {}) {
  const { type, minConfidence, includeEntities = false } = options;
  
  const where = {
    OR: [
      { sourceId: entityId },
      { targetId: entityId }
    ]
  };
  
  if (type) {
    where.type = type;
  }
  
  if (minConfidence !== undefined) {
    where.confidence = { gte: minConfidence };
  }
  
  const relations = await prisma.kGRelation.findMany({
    where,
    include: includeEntities ? {
      source: true,
      target: true
    } : undefined,
    orderBy: { confidence: 'desc' }
  });
  
  return relations.map(formatRelation);
}

/**
 * Get outgoing relations for an entity
 * 
 * @param {string} entityId - Entity ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of relations
 */
async function getOutgoingRelations(entityId, options = {}) {
  const { type, minConfidence, includeEntities = false } = options;
  
  const where = { sourceId: entityId };
  
  if (type) {
    where.type = type;
  }
  
  if (minConfidence !== undefined) {
    where.confidence = { gte: minConfidence };
  }
  
  const relations = await prisma.kGRelation.findMany({
    where,
    include: includeEntities ? {
      source: true,
      target: true
    } : undefined,
    orderBy: { confidence: 'desc' }
  });
  
  return relations.map(formatRelation);
}

/**
 * Get incoming relations for an entity
 * 
 * @param {string} entityId - Entity ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of relations
 */
async function getIncomingRelations(entityId, options = {}) {
  const { type, minConfidence, includeEntities = false } = options;
  
  const where = { targetId: entityId };
  
  if (type) {
    where.type = type;
  }
  
  if (minConfidence !== undefined) {
    where.confidence = { gte: minConfidence };
  }
  
  const relations = await prisma.kGRelation.findMany({
    where,
    include: includeEntities ? {
      source: true,
      target: true
    } : undefined,
    orderBy: { confidence: 'desc' }
  });
  
  return relations.map(formatRelation);
}

/**
 * Get all relations with optional filtering
 * 
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of relations
 */
async function getAllRelations(options = {}) {
  const { 
    type, 
    minConfidence, 
    skip = 0, 
    take = 100,
    includeEntities = false 
  } = options;
  
  const where = {};
  
  if (type) {
    where.type = type;
  }
  
  if (minConfidence !== undefined) {
    where.confidence = { gte: minConfidence };
  }
  
  const relations = await prisma.kGRelation.findMany({
    where,
    skip,
    take,
    include: includeEntities ? {
      source: true,
      target: true
    } : undefined,
    orderBy: { createdAt: 'desc' }
  });
  
  return relations.map(formatRelation);
}

/**
 * Count relations with optional filtering
 * 
 * @param {Object} filters - Filter options
 * @returns {Promise<number>} Count of relations
 */
async function countRelations(filters = {}) {
  const where = {};
  
  if (filters.type) {
    where.type = filters.type;
  }
  
  if (filters.minConfidence !== undefined) {
    where.confidence = { gte: filters.minConfidence };
  }
  
  return await prisma.kGRelation.count({ where });
}

/**
 * Get relation statistics
 * 
 * @returns {Promise<Object>} Statistics object
 */
async function getRelationStats() {
  const total = await prisma.kGRelation.count();
  
  // Count by type
  const byType = await prisma.kGRelation.groupBy({
    by: ['type'],
    _count: { id: true }
  });
  
  const typeStats = {};
  byType.forEach(item => {
    typeStats[item.type] = item._count.id;
  });
  
  // Average confidence
  const avgConfidence = await prisma.kGRelation.aggregate({
    _avg: { confidence: true }
  });
  
  return {
    total,
    by_type: typeStats,
    average_confidence: avgConfidence._avg.confidence || 0
  };
}

/**
 * Delete a relation
 * 
 * @param {string} relationId - Relation ID
 * @returns {Promise<void>}
 */
async function deleteRelation(relationId) {
  await prisma.kGRelation.delete({
    where: { id: relationId }
  });
}

/**
 * Delete all relations for an entity
 * 
 * @param {string} entityId - Entity ID
 * @returns {Promise<number>} Number of deleted relations
 */
async function deleteRelationsByEntity(entityId) {
  const result = await prisma.kGRelation.deleteMany({
    where: {
      OR: [
        { sourceId: entityId },
        { targetId: entityId }
      ]
    }
  });
  
  return result.count;
}

/**
 * Update relation confidence
 * 
 * @param {string} relationId - Relation ID
 * @param {number} confidence - New confidence value
 * @returns {Promise<Object>} Updated relation
 */
async function updateRelationConfidence(relationId, confidence) {
  const updated = await prisma.kGRelation.update({
    where: { id: relationId },
    data: { confidence }
  });
  
  return formatRelation(updated);
}

/**
 * Format relation object for API response
 * 
 * @param {Object} relation - Raw relation from database
 * @returns {Object} Formatted relation
 */
function formatRelation(relation) {
  return {
    relation_id: relation.id,
    source_id: relation.sourceId,
    target_id: relation.targetId,
    type: relation.type,
    subtype: relation.subtype,
    weight: relation.weight,
    confidence: relation.confidence,
    evidence_ckb: tryParseJSON(relation.evidenceCkb, []),
    evidence_text: relation.evidenceText,
    metadata: tryParseJSON(relation.metadata, {}),
    created_at: relation.createdAt,
    updated_at: relation.updatedAt,
    // Include entities if loaded
    source: relation.source ? formatEntity(relation.source) : undefined,
    target: relation.target ? formatEntity(relation.target) : undefined
  };
}

/**
 * Format entity object (simplified)
 * 
 * @param {Object} entity - Raw entity from database
 * @returns {Object} Formatted entity
 */
function formatEntity(entity) {
  return {
    entity_id: entity.id,
    entity_type: entity.entityType,
    canonical_name: entity.canonicalName,
    confidence: entity.confidence
  };
}

/**
 * Get relations by relation type
 * 
 * @param {string} relationTypeId - Relation type ID
 * @param {Object} options - Query options
 * @returns {Promise<Array>} Array of relations
 */
async function getByRelationType(relationTypeId, options = {}) {
  const { 
    minConfidence, 
    skip = 0, 
    take = 100,
    includeEntities = false 
  } = options;
  
  const where = { subtype: relationTypeId };
  
  if (minConfidence !== undefined) {
    where.confidence = { gte: minConfidence };
  }
  
  const relations = await prisma.kGRelation.findMany({
    where,
    skip,
    take,
    include: includeEntities ? {
      source: true,
      target: true
    } : undefined,
    orderBy: { confidence: 'desc' }
  });
  
  return relations.map(formatRelation);
}

/**
 * Try to parse JSON string, return default value on error
 * 
 * @param {string} jsonString - JSON string
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} Parsed value or default
 */
function tryParseJSON(jsonString, defaultValue) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return defaultValue;
  }
}

module.exports = {
  saveRelation,
  saveRelations,
  getRelationById,
  getRelationsByEntity,
  getOutgoingRelations,
  getIncomingRelations,
  getAllRelations,
  getByRelationType,
  countRelations,
  getRelationStats,
  deleteRelation,
  deleteRelationsByEntity,
  updateRelationConfidence
};
