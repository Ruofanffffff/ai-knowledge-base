/**
 * Cooccurrence Relation Builder
 * 
 * Generates relations between entities based on statistical co-occurrence patterns.
 * Uses 0 Token consumption (pure statistical method).
 * 
 * Requirements: 6.1-6.10
 */

const relationStore = require('./relation_store');

/**
 * Build cooccurrence relations from CKB data
 * @param {Array} ckbs - List of CKBs with entity mentions
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} Created cooccurrence relations
 */
async function buildCooccurrenceRelations(ckbs, options = {}) {
  const {
    weightThreshold = 0.5,
    minCooccurrences = 2,
    sourceWeight = 1.0
  } = options;

  // Track entity co-occurrences
  const cooccurrenceMap = new Map();

  // Process each CKB
  for (const ckb of ckbs) {
    if (!ckb.entities || ckb.entities.length < 2) {
      continue;
    }

    // Find all entity pairs in this CKB
    const entities = ckb.entities;
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];

        // Create bidirectional pair key
        const pairKey = createPairKey(entity1.id, entity2.id);

        if (!cooccurrenceMap.has(pairKey)) {
          cooccurrenceMap.set(pairKey, {
            entity1_id: entity1.id,
            entity2_id: entity2.id,
            count: 0,
            ckb_ids: [],
            source_weights: []
          });
        }

        const cooccurrence = cooccurrenceMap.get(pairKey);
        cooccurrence.count++;
        cooccurrence.ckb_ids.push(ckb.ckb_id);
        cooccurrence.source_weights.push(ckb.quality?.source_confidence || sourceWeight);
      }
    }
  }

  // Create relations for co-occurrences above threshold
  const relations = [];

  for (const [pairKey, cooccurrence] of cooccurrenceMap.entries()) {
    if (cooccurrence.count < minCooccurrences) {
      continue;
    }

    // Calculate weight: count × average source weight
    const avgSourceWeight = cooccurrence.source_weights.reduce((a, b) => a + b, 0) / cooccurrence.source_weights.length;
    const weight = cooccurrence.count * avgSourceWeight;

    if (weight >= weightThreshold) {
      const relation = {
        source_id: cooccurrence.entity1_id,
        target_id: cooccurrence.entity2_id,
        type: 'co_occurrence',
        weight: weight,
        confidence: Math.min(weight / 10, 1.0), // Normalize to 0-1
        evidence_ckb: cooccurrence.ckb_ids,
        metadata: {
          cooccurrence_count: cooccurrence.count,
          avg_source_weight: avgSourceWeight
        }
      };

      relations.push(relation);
    }
  }

  return relations;
}

/**
 * Update cooccurrence relations when CKB is added
 * @param {Object} ckb - New CKB with entity mentions
 * @param {Object} options - Configuration options
 * @returns {Promise<Array>} Updated or created relations
 */
async function updateCooccurrenceRelations(ckb, options = {}) {
  if (!ckb.entities || ckb.entities.length < 2) {
    return [];
  }

  const {
    weightThreshold = 0.5,
    sourceWeight = ckb.quality?.source_confidence || 1.0
  } = options;

  const updatedRelations = [];
  const entities = ckb.entities;

  // Process all entity pairs
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const entity1 = entities[i];
      const entity2 = entities[j];

      // Check if relation already exists
      let relation = await relationStore.findRelation(
        entity1.id,
        entity2.id,
        'co_occurrence'
      );

      if (relation) {
        // Update existing relation
        relation.evidence_ckb.push(ckb.ckb_id);
        relation.metadata.cooccurrence_count++;
        
        // Recalculate weight
        const totalWeight = relation.metadata.cooccurrence_count * 
          ((relation.metadata.avg_source_weight * (relation.metadata.cooccurrence_count - 1) + sourceWeight) / 
           relation.metadata.cooccurrence_count);
        
        relation.weight = totalWeight;
        relation.confidence = Math.min(totalWeight / 10, 1.0);
        relation.metadata.avg_source_weight = 
          (relation.metadata.avg_source_weight * (relation.metadata.cooccurrence_count - 1) + sourceWeight) / 
          relation.metadata.cooccurrence_count;

        await relationStore.updateRelation(relation.id, relation);
        updatedRelations.push(relation);
      } else {
        // Create new relation if weight meets threshold
        const weight = sourceWeight;
        if (weight >= weightThreshold) {
          const newRelation = {
            source_id: entity1.id,
            target_id: entity2.id,
            type: 'co_occurrence',
            weight: weight,
            confidence: Math.min(weight / 10, 1.0),
            evidence_ckb: [ckb.ckb_id],
            metadata: {
              cooccurrence_count: 1,
              avg_source_weight: sourceWeight
            }
          };

          const created = await relationStore.createRelation(newRelation);
          updatedRelations.push(created);
        }
      }
    }
  }

  return updatedRelations;
}

/**
 * Remove CKB from cooccurrence relations and update weights
 * @param {string} ckbId - CKB ID to remove
 * @param {Object} options - Configuration options
 * @returns {Promise<Object>} Update statistics
 */
async function removeCooccurrenceRelations(ckbId, options = {}) {
  const { weightThreshold = 0.5 } = options;

  // Find all relations that reference this CKB
  const relations = await relationStore.findRelationsByEvidence(ckbId, 'co_occurrence');

  const stats = {
    updated: 0,
    deleted: 0
  };

  for (const relation of relations) {
    // Remove CKB from evidence
    relation.evidence_ckb = relation.evidence_ckb.filter(id => id !== ckbId);
    relation.metadata.cooccurrence_count = relation.evidence_ckb.length;

    if (relation.metadata.cooccurrence_count === 0) {
      // Delete relation if no evidence remains
      await relationStore.deleteRelation(relation.id);
      stats.deleted++;
    } else {
      // Recalculate weight
      relation.weight = relation.metadata.cooccurrence_count * relation.metadata.avg_source_weight;
      relation.confidence = Math.min(relation.weight / 10, 1.0);

      if (relation.weight < weightThreshold) {
        // Delete if below threshold
        await relationStore.deleteRelation(relation.id);
        stats.deleted++;
      } else {
        // Update relation
        await relationStore.updateRelation(relation.id, relation);
        stats.updated++;
      }
    }
  }

  return stats;
}

/**
 * Create a consistent pair key for entity pairs
 * @param {string} id1 - First entity ID
 * @param {string} id2 - Second entity ID
 * @returns {string} Pair key
 */
function createPairKey(id1, id2) {
  // Sort IDs to ensure consistent key regardless of order
  return id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;
}

/**
 * Get cooccurrence statistics
 * @param {Object} filters - Filter options
 * @returns {Promise<Object>} Statistics
 */
async function getCooccurrenceStats(filters = {}) {
  const relations = await relationStore.getRelations({
    ...filters,
    type: 'co_occurrence'
  });

  const stats = {
    total_relations: relations.length,
    avg_weight: 0,
    avg_cooccurrence_count: 0,
    weight_distribution: {
      low: 0,    // < 1.0
      medium: 0, // 1.0 - 5.0
      high: 0    // > 5.0
    }
  };

  if (relations.length === 0) {
    return stats;
  }

  let totalWeight = 0;
  let totalCount = 0;

  for (const relation of relations) {
    totalWeight += relation.weight;
    totalCount += relation.metadata?.cooccurrence_count || 1;

    if (relation.weight < 1.0) {
      stats.weight_distribution.low++;
    } else if (relation.weight <= 5.0) {
      stats.weight_distribution.medium++;
    } else {
      stats.weight_distribution.high++;
    }
  }

  stats.avg_weight = totalWeight / relations.length;
  stats.avg_cooccurrence_count = totalCount / relations.length;

  return stats;
}

module.exports = {
  buildCooccurrenceRelations,
  buildRelations: buildCooccurrenceRelations,  // Alias for compatibility
  updateCooccurrenceRelations,
  removeCooccurrenceRelations,
  getCooccurrenceStats
};
