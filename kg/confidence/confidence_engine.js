/**
 * Confidence Engine
 * 
 * Calculates and manages confidence scores for entities and relations.
 * Supports cascading updates when CKBs are added/removed.
 * 
 * Requirements: 8.1-8.10
 */

const entityStore = require('../entity/entity_store');
const relationStore = require('../relation/relation_store');

/**
 * Calculate entity confidence based on supporting CKBs
 * Formula: Entity.confidence = Σ(CKB.confidence) / CKB count
 * @param {Object} entity - Entity with supported_by array
 * @param {Array} ckbs - Supporting CKBs
 * @returns {number} Confidence score (0-1)
 */
function calculateEntityConfidence(entity, ckbs) {
  if (!ckbs || ckbs.length === 0) {
    return 0;
  }

  const totalConfidence = ckbs.reduce((sum, ckb) => {
    return sum + (ckb.quality?.source_confidence || 0.5);
  }, 0);

  return totalConfidence / ckbs.length;
}

/**
 * Calculate relation confidence based on source and target entities
 * @param {Object} relation - Relation object
 * @param {Object} sourceEntity - Source entity
 * @param {Object} targetEntity - Target entity
 * @returns {number} Confidence score (0-1)
 */
function calculateRelationConfidence(relation, sourceEntity, targetEntity) {
  const entityConfidence = (sourceEntity.confidence + targetEntity.confidence) / 2;
  
  // For builtin relations, use entity confidence directly
  if (relation.type === 'builtin') {
    return entityConfidence;
  }

  // For cooccurrence relations, combine entity confidence with weight
  if (relation.type === 'co_occurrence') {
    const weightFactor = Math.min(relation.weight / 10, 1.0);
    return entityConfidence * 0.7 + weightFactor * 0.3;
  }

  // For semantic relations, use LLM confidence with entity confidence
  if (relation.type === 'semantic') {
    const llmConfidence = relation.metadata?.validation_score || relation.confidence || 0.5;
    return entityConfidence * 0.5 + llmConfidence * 0.5;
  }

  return entityConfidence;
}

/**
 * Update entity confidence and cascade to relations
 * @param {string} entityId - Entity ID
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Update statistics
 */
async function updateEntityConfidence(entityId, options = {}) {
  const {
    lowQualityThreshold = 0.6,
    deleteThreshold = 0.4
  } = options;

  // Get entity and supporting CKBs
  const entity = await entityStore.getEntityById(entityId);
  if (!entity) {
    return { updated: 0, deleted: 0, cascaded: 0 };
  }

  const ckbs = await getCKBsForEntity(entity);

  // Calculate new confidence
  const newConfidence = calculateEntityConfidence(entity, ckbs);
  const oldConfidence = entity.confidence;

  // Update entity
  entity.confidence = newConfidence;

  if (newConfidence < deleteThreshold) {
    // Delete entity if below delete threshold
    await entityStore.deleteEntity(entityId);
    
    // Cascade delete relations
    const deletedRelations = await cascadeDeleteRelations(entityId);
    
    return {
      updated: 0,
      deleted: 1,
      cascaded: deletedRelations,
      reason: 'confidence_below_threshold'
    };
  }

  if (newConfidence < lowQualityThreshold) {
    entity.quality_flag = 'low_quality';
  } else {
    delete entity.quality_flag;
  }

  await entityStore.updateEntity(entityId, entity);

  // Cascade update to relations
  const cascaded = await cascadeUpdateRelations(entityId, options);

  return {
    updated: 1,
    deleted: 0,
    cascaded,
    confidence_change: newConfidence - oldConfidence
  };
}

/**
 * Update relation confidence
 * @param {string} relationId - Relation ID
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Update statistics
 */
async function updateRelationConfidence(relationId, options = {}) {
  const {
    lowQualityThreshold = 0.5,
    deleteThreshold = 0.3
  } = options;

  // Get relation and entities
  const relation = await relationStore.getRelationById(relationId);
  if (!relation) {
    return { updated: 0, deleted: 0 };
  }

  const sourceEntity = await entityStore.getEntityById(relation.source_id);
  const targetEntity = await entityStore.getEntityById(relation.target_id);

  if (!sourceEntity || !targetEntity) {
    // Delete relation if entities don't exist
    await relationStore.deleteRelation(relationId);
    return { updated: 0, deleted: 1, reason: 'entity_not_found' };
  }

  // Calculate new confidence
  const newConfidence = calculateRelationConfidence(relation, sourceEntity, targetEntity);
  const oldConfidence = relation.confidence;

  relation.confidence = newConfidence;

  if (newConfidence < deleteThreshold) {
    // Delete relation if below delete threshold
    await relationStore.deleteRelation(relationId);
    return {
      updated: 0,
      deleted: 1,
      reason: 'confidence_below_threshold'
    };
  }

  if (newConfidence < lowQualityThreshold) {
    relation.quality_flag = 'low_quality';
  } else {
    delete relation.quality_flag;
  }

  await relationStore.updateRelation(relationId, relation);

  return {
    updated: 1,
    deleted: 0,
    confidence_change: newConfidence - oldConfidence
  };
}

/**
 * Cascade update relations when entity confidence changes
 * @param {string} entityId - Entity ID
 * @param {Object} options - Configuration options
 * @returns {Promise<number>} Number of relations updated
 */
async function cascadeUpdateRelations(entityId, options = {}) {
  // Find all relations involving this entity
  const relations = await relationStore.getAllRelations();
  // Filter relations involving this entity
  const entityRelations = relations.filter(relation => 
    relation.source_id === entityId || relation.target_id === entityId
  );

  let updated = 0;
  let deleted = 0;

  for (const relation of entityRelations) {
    const result = await updateRelationConfidence(relation.relation_id, options);
    updated += result.updated;
    deleted += result.deleted;
  }

  return { updated, deleted };
}

/**
 * Cascade delete relations when entity is deleted
 * @param {string} entityId - Entity ID
 * @returns {Promise<number>} Number of relations deleted
 */
async function cascadeDeleteRelations(entityId) {
  const relations = await relationStore.getAllRelations();
  // Filter relations involving this entity
  const entityRelations = relations.filter(relation => 
    relation.source_id === entityId || relation.target_id === entityId
  );

  for (const relation of entityRelations) {
    await relationStore.deleteRelation(relation.relation_id);
  }

  return entityRelations.length;
}

/**
 * Batch update confidence for multiple entities
 * @param {Array} entityIds - List of entity IDs
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Batch update statistics
 */
async function batchUpdateEntityConfidence(entityIds, options = {}) {
  const stats = {
    total: entityIds.length,
    updated: 0,
    deleted: 0,
    cascaded: { updated: 0, deleted: 0 },
    errors: 0
  };

  for (const entityId of entityIds) {
    try {
      const result = await updateEntityConfidence(entityId, options);
      stats.updated += result.updated;
      stats.deleted += result.deleted;
      stats.cascaded.updated += result.cascaded?.updated || 0;
      stats.cascaded.deleted += result.cascaded?.deleted || 0;
    } catch (error) {
      console.error(`Failed to update confidence for entity ${entityId}:`, error);
      stats.errors++;
    }
  }

  return stats;
}

/**
 * Get CKBs for entity
 * @param {Object} entity - Entity with supported_by array
 * @returns {Promise<Array>} CKBs
 */
async function getCKBsForEntity(entity) {
  // This would query the CKB store
  // For now, return mock data based on supported_by
  const ckbStore = require('../ckb/ckb_store');
  
  if (!entity.supported_by || entity.supported_by.length === 0) {
    return [];
  }

  const ckbs = [];
  for (const ckbId of entity.supported_by) {
    if (!ckbId) continue; // Skip null/undefined entries
    try {
      const ckb = await ckbStore.getCKB(ckbId);
      if (ckb) {
        ckbs.push(ckb);
      }
    } catch (error) {
      console.error(`Failed to get CKB ${ckbId}:`, error);
    }
  }

  return ckbs;
}

/**
 * Get confidence statistics
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Statistics
 */
async function getConfidenceStats(filters = {}) {
  const entities = await entityStore.getAllEntities(filters);
  const relations = await relationStore.getAllRelations(filters);

  const stats = {
    entities: {
      total: entities.length,
      avg_confidence: 0,
      low_quality: 0,
      distribution: {
        high: 0,   // >= 0.8
        medium: 0, // 0.6 - 0.8
        low: 0     // < 0.6
      }
    },
    relations: {
      total: relations.length,
      avg_confidence: 0,
      low_quality: 0,
      distribution: {
        high: 0,
        medium: 0,
        low: 0
      }
    }
  };

  // Calculate entity stats
  if (entities.length > 0) {
    let totalConfidence = 0;
    for (const entity of entities) {
      totalConfidence += entity.confidence || 0;
      
      if (entity.quality_flag === 'low_quality') {
        stats.entities.low_quality++;
      }

      if (entity.confidence >= 0.8) {
        stats.entities.distribution.high++;
      } else if (entity.confidence >= 0.6) {
        stats.entities.distribution.medium++;
      } else {
        stats.entities.distribution.low++;
      }
    }
    stats.entities.avg_confidence = totalConfidence / entities.length;
  }

  // Calculate relation stats
  if (relations.length > 0) {
    let totalConfidence = 0;
    for (const relation of relations) {
      totalConfidence += relation.confidence || 0;
      
      if (relation.quality_flag === 'low_quality') {
        stats.relations.low_quality++;
      }

      if (relation.confidence >= 0.8) {
        stats.relations.distribution.high++;
      } else if (relation.confidence >= 0.6) {
        stats.relations.distribution.medium++;
      } else {
        stats.relations.distribution.low++;
      }
    }
    stats.relations.avg_confidence = totalConfidence / relations.length;
  }

  return stats;
}

module.exports = {
  calculateEntityConfidence,
  calculateRelationConfidence,
  updateEntityConfidence,
  updateRelationConfidence,
  cascadeUpdateRelations,
  cascadeDeleteRelations,
  batchUpdateEntityConfidence,
  getConfidenceStats
};
