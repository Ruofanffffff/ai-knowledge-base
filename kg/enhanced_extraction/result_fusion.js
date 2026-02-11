/**
 * Result Fusion for Enhanced Entity Extraction
 * 
 * Fuses algorithm and LLM extraction results into a unified output.
 * Ensures algorithm results are preserved and properly tagged.
 */

const ConflictResolver = require('./conflict_resolver');

class ResultFusion {
  constructor(options = {}) {
    this.conflictResolver = options.conflictResolver || new ConflictResolver();
    this.deduplication = options.deduplication !== false;
  }

  /**
   * Fuse algorithm and LLM extraction results
   * @param {Object} algorithmResult - Algorithm extraction result
   * @param {Object} llmResult - LLM extraction result
   * @returns {Object} Fused result with combined entities, relations, and metadata
   */
  fuse(algorithmResult, llmResult) {
    // Resolve conflicts first
    const resolved = this.conflictResolver.resolve(algorithmResult, llmResult);

    // Merge entities
    const entities = this._mergeEntities(resolved.entities);

    // Merge relations
    const relations = this._mergeRelations(resolved.relations);

    // Merge metadata
    const metadata = this._mergeMetadata(
      algorithmResult.metadata || {},
      llmResult.metadata || {},
      resolved.conflictCount
    );

    return {
      entities,
      relations,
      metadata,
      conflicts: resolved.conflicts
    };
  }

  /**
   * Merge entity lists
   * @private
   */
  _mergeEntities(entities) {
    if (!this.deduplication) {
      return entities;
    }

    // Deduplicate entities by ID
    const entityMap = new Map();
    
    entities.forEach(entity => {
      const key = entity.id || entity.name;
      
      if (!entityMap.has(key)) {
        entityMap.set(key, entity);
      } else {
        // If duplicate, prefer algorithm source
        const existing = entityMap.get(key);
        if (entity.source === 'algorithm' && existing.source !== 'algorithm') {
          entityMap.set(key, entity);
        }
      }
    });

    return Array.from(entityMap.values());
  }

  /**
   * Merge relation lists
   * @private
   */
  _mergeRelations(relations) {
    if (!this.deduplication) {
      return relations;
    }

    // Deduplicate relations by source-target-type combination
    const relationMap = new Map();
    
    relations.forEach(relation => {
      const key = `${relation.source}:${relation.target}:${relation.type}`;
      
      if (!relationMap.has(key)) {
        relationMap.set(key, relation);
      } else {
        // If duplicate, prefer algorithm source
        const existing = relationMap.get(key);
        if (relation.extractionSource === 'algorithm' && existing.extractionSource !== 'algorithm') {
          relationMap.set(key, relation);
        }
      }
    });

    return Array.from(relationMap.values());
  }

  /**
   * Merge metadata from algorithm and LLM results
   * @private
   */
  _mergeMetadata(algorithmMetadata, llmMetadata, conflictCount) {
    return {
      documentId: algorithmMetadata.documentId || llmMetadata.documentId || null,
      language: llmMetadata.language || algorithmMetadata.language || 'auto',
      processingTime: (algorithmMetadata.extractionTime || 0) + (llmMetadata.extractionTime || 0),
      algorithmTime: algorithmMetadata.extractionTime || 0,
      llmTime: llmMetadata.extractionTime || 0,
      tokensUsed: llmMetadata.tokensUsed || 0,
      cost: llmMetadata.cost || 0,
      llmModel: llmMetadata.llmModel || null,
      conflicts: conflictCount,
      status: this._determineStatus(algorithmMetadata, llmMetadata),
      algorithmParametersFound: algorithmMetadata.parametersFound || 0,
      llmEntitiesFound: (llmMetadata.entities || []).length || 0,
      llmRelationsFound: (llmMetadata.relations || []).length || 0
    };
  }

  /**
   * Determine overall processing status
   * @private
   */
  _determineStatus(algorithmMetadata, llmMetadata) {
    const algorithmSuccess = !algorithmMetadata.error;
    const llmSuccess = !llmMetadata.error;

    if (algorithmSuccess && llmSuccess) {
      return 'success';
    } else if (algorithmSuccess || llmSuccess) {
      return 'partial_success';
    } else {
      return 'failed';
    }
  }

  /**
   * Get statistics about the fused result
   * @param {Object} fusedResult - The fused result
   * @returns {Object} Statistics
   */
  getStatistics(fusedResult) {
    const algorithmEntities = fusedResult.entities.filter(e => e.source === 'algorithm');
    const llmEntities = fusedResult.entities.filter(e => e.source === 'llm');
    const algorithmRelations = fusedResult.relations.filter(r => r.extractionSource === 'algorithm');
    const llmRelations = fusedResult.relations.filter(r => r.extractionSource === 'llm');

    return {
      totalEntities: fusedResult.entities.length,
      algorithmEntities: algorithmEntities.length,
      llmEntities: llmEntities.length,
      totalRelations: fusedResult.relations.length,
      algorithmRelations: algorithmRelations.length,
      llmRelations: llmRelations.length,
      conflicts: fusedResult.conflicts?.length || 0,
      processingTime: fusedResult.metadata.processingTime,
      status: fusedResult.metadata.status
    };
  }

  /**
   * Validate that algorithm results are preserved
   * @param {Object} algorithmResult - Original algorithm result
   * @param {Object} fusedResult - Fused result
   * @returns {boolean} True if all algorithm results are preserved
   */
  validateAlgorithmPreservation(algorithmResult, fusedResult) {
    const algorithmEntities = algorithmResult.entities || [];
    const fusedAlgorithmEntities = fusedResult.entities.filter(e => e.source === 'algorithm');

    // Check if all algorithm entities are present
    if (algorithmEntities.length !== fusedAlgorithmEntities.length) {
      return false;
    }

    // Check if all algorithm entity values are unchanged
    for (const algoEntity of algorithmEntities) {
      const fusedEntity = fusedAlgorithmEntities.find(e => e.name === algoEntity.name);
      
      if (!fusedEntity) {
        return false;
      }

      // Check if numerical values are preserved
      if (algoEntity.properties?.value && fusedEntity.properties?.value) {
        if (algoEntity.properties.value !== fusedEntity.properties.value) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Set conflict resolver
   * @param {ConflictResolver} resolver - Conflict resolver instance
   */
  setConflictResolver(resolver) {
    this.conflictResolver = resolver;
  }

  /**
   * Enable or disable deduplication
   * @param {boolean} enabled - Whether to enable deduplication
   */
  setDeduplication(enabled) {
    this.deduplication = enabled;
  }
}

module.exports = ResultFusion;
