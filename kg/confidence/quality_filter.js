/**
 * Quality Filter
 * 
 * Filters low-quality entities and relations based on confidence scores.
 * Implements conflict resolution mechanisms.
 * 
 * Requirements: 8.1-8.10
 */

const entityStore = require('../entity/entity_store');
const relationStore = require('../relation/relation_store');
const confidenceEngine = require('./confidence_engine');

/**
 * Filter entities by quality thresholds
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Filtered entities and statistics
 */
async function filterLowQualityEntities(options = {}) {
  const {
    minConfidence = 0.6,
    deleteThreshold = 0.4,
    dryRun = false
  } = options;

  const allEntities = await entityStore.getEntities({});

  const stats = {
    total: allEntities.length,
    low_quality: 0,
    deleted: 0,
    kept: 0
  };

  const lowQualityEntities = [];
  const deletedEntities = [];

  for (const entity of allEntities) {
    if (entity.confidence < minConfidence) {
      stats.low_quality++;
      lowQualityEntities.push(entity);

      if (entity.confidence < deleteThreshold) {
        if (!dryRun) {
          await entityStore.deleteEntity(entity.id);
          await confidenceEngine.cascadeDeleteRelations(entity.id);
        }
        stats.deleted++;
        deletedEntities.push(entity);
      } else {
        stats.kept++;
      }
    }
  }

  return {
    stats,
    low_quality_entities: lowQualityEntities,
    deleted_entities: deletedEntities
  };
}

/**
 * Filter relations by quality thresholds
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Filtered relations and statistics
 */
async function filterLowQualityRelations(options = {}) {
  const {
    minConfidence = 0.5,
    deleteThreshold = 0.3,
    dryRun = false
  } = options;

  const allRelations = await relationStore.getRelations({});

  const stats = {
    total: allRelations.length,
    low_quality: 0,
    deleted: 0,
    kept: 0
  };

  const lowQualityRelations = [];
  const deletedRelations = [];

  for (const relation of allRelations) {
    if (relation.confidence < minConfidence) {
      stats.low_quality++;
      lowQualityRelations.push(relation);

      if (relation.confidence < deleteThreshold) {
        if (!dryRun) {
          await relationStore.deleteRelation(relation.id);
        }
        stats.deleted++;
        deletedRelations.push(relation);
      } else {
        stats.kept++;
      }
    }
  }

  return {
    stats,
    low_quality_relations: lowQualityRelations,
    deleted_relations: deletedRelations
  };
}

/**
 * Resolve conflicts when multiple CKBs describe the same entity differently
 * @param {Object} entity - Entity with conflicting attributes
 * @param {Array} ckbs - Supporting CKBs
 * @param {Object} options - Resolution options
 * @returns {Promise<Object>} Resolved entity
 */
async function resolveEntityConflicts(entity, ckbs, options = {}) {
  const {
    strategy = 'confidence_weighted' // 'confidence_weighted' | 'voting' | 'latest'
  } = options;

  if (!ckbs || ckbs.length === 0) {
    return entity;
  }

  // Group attributes by key
  const attributeGroups = {};

  for (const ckb of ckbs) {
    if (!ckb.extracted_fields) continue;

    for (const field of ckb.extracted_fields) {
      if (!attributeGroups[field.name]) {
        attributeGroups[field.name] = [];
      }

      attributeGroups[field.name].push({
        value: field.value,
        confidence: ckb.quality?.source_confidence || 0.5,
        timestamp: ckb.timestamps?.created_at
      });
    }
  }

  // Resolve conflicts for each attribute
  const resolvedAttributes = {};

  for (const [key, values] of Object.entries(attributeGroups)) {
    if (values.length === 1) {
      // No conflict
      resolvedAttributes[key] = values[0].value;
      continue;
    }

    // Resolve conflict based on strategy
    if (strategy === 'confidence_weighted') {
      resolvedAttributes[key] = resolveByConfidenceWeighted(values);
    } else if (strategy === 'voting') {
      resolvedAttributes[key] = resolveByVoting(values);
    } else if (strategy === 'latest') {
      resolvedAttributes[key] = resolveByLatest(values);
    }
  }

  entity.attributes = resolvedAttributes;
  entity.conflict_resolution = {
    strategy,
    resolved_at: new Date().toISOString()
  };

  return entity;
}

/**
 * Resolve conflict by confidence-weighted average
 * @param {Array} values - Attribute values with confidence
 * @returns {string} Resolved value
 */
function resolveByConfidenceWeighted(values) {
  // Group by value
  const valueGroups = {};

  for (const item of values) {
    if (!valueGroups[item.value]) {
      valueGroups[item.value] = {
        value: item.value,
        totalConfidence: 0,
        count: 0
      };
    }

    valueGroups[item.value].totalConfidence += item.confidence;
    valueGroups[item.value].count++;
  }

  // Find value with highest weighted confidence
  let maxConfidence = 0;
  let resolvedValue = null;

  for (const group of Object.values(valueGroups)) {
    const weightedConfidence = group.totalConfidence / group.count;
    if (weightedConfidence > maxConfidence) {
      maxConfidence = weightedConfidence;
      resolvedValue = group.value;
    }
  }

  return resolvedValue;
}

/**
 * Resolve conflict by voting (most common value)
 * @param {Array} values - Attribute values
 * @returns {string} Resolved value
 */
function resolveByVoting(values) {
  const valueCounts = {};

  for (const item of values) {
    valueCounts[item.value] = (valueCounts[item.value] || 0) + 1;
  }

  let maxCount = 0;
  let resolvedValue = null;

  for (const [value, count] of Object.entries(valueCounts)) {
    if (count > maxCount) {
      maxCount = count;
      resolvedValue = value;
    }
  }

  return resolvedValue;
}

/**
 * Resolve conflict by latest timestamp
 * @param {Array} values - Attribute values with timestamps
 * @returns {string} Resolved value
 */
function resolveByLatest(values) {
  let latestTimestamp = null;
  let resolvedValue = null;

  for (const item of values) {
    if (!latestTimestamp || item.timestamp > latestTimestamp) {
      latestTimestamp = item.timestamp;
      resolvedValue = item.value;
    }
  }

  return resolvedValue;
}

/**
 * Clean orphaned entities (no CKB support)
 * @param {Object} options - Cleanup options
 * @returns {Promise<Object>} Cleanup statistics
 */
async function cleanOrphanedEntities(options = {}) {
  const { dryRun = false } = options;

  const allEntities = await entityStore.getEntities({});

  const stats = {
    total: allEntities.length,
    orphaned: 0,
    deleted: 0
  };

  const orphanedEntities = [];

  for (const entity of allEntities) {
    if (!entity.supported_by || entity.supported_by.length === 0) {
      stats.orphaned++;
      orphanedEntities.push(entity);

      if (!dryRun) {
        await entityStore.deleteEntity(entity.id);
        await confidenceEngine.cascadeDeleteRelations(entity.id);
        stats.deleted++;
      }
    }
  }

  return {
    stats,
    orphaned_entities: orphanedEntities
  };
}

/**
 * Run comprehensive quality check
 * @param {Object} options - Check options
 * @returns {Promise<Object>} Quality report
 */
async function runQualityCheck(options = {}) {
  const {
    entityMinConfidence = 0.6,
    relationMinConfidence = 0.5,
    dryRun = true
  } = options;

  const report = {
    timestamp: new Date().toISOString(),
    entities: {},
    relations: {},
    orphaned: {},
    recommendations: []
  };

  // Check entities
  const entityResult = await filterLowQualityEntities({
    minConfidence: entityMinConfidence,
    dryRun
  });
  report.entities = entityResult.stats;

  // Check relations
  const relationResult = await filterLowQualityRelations({
    minConfidence: relationMinConfidence,
    dryRun
  });
  report.relations = relationResult.stats;

  // Check orphaned entities
  const orphanedResult = await cleanOrphanedEntities({ dryRun });
  report.orphaned = orphanedResult.stats;

  // Generate recommendations
  if (report.entities.low_quality > report.entities.total * 0.2) {
    report.recommendations.push({
      type: 'high_low_quality_entities',
      message: `${report.entities.low_quality} entities (${Math.round(report.entities.low_quality / report.entities.total * 100)}%) have low quality. Consider reviewing CKB sources.`
    });
  }

  if (report.relations.low_quality > report.relations.total * 0.3) {
    report.recommendations.push({
      type: 'high_low_quality_relations',
      message: `${report.relations.low_quality} relations (${Math.round(report.relations.low_quality / report.relations.total * 100)}%) have low quality. Consider adjusting relation extraction thresholds.`
    });
  }

  if (report.orphaned.orphaned > 0) {
    report.recommendations.push({
      type: 'orphaned_entities',
      message: `${report.orphaned.orphaned} orphaned entities found. Run cleanup to remove them.`
    });
  }

  return report;
}

module.exports = {
  filterLowQualityEntities,
  filterLowQualityRelations,
  resolveEntityConflicts,
  cleanOrphanedEntities,
  runQualityCheck
};
