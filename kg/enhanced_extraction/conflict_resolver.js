/**
 * Conflict Resolver for Enhanced Entity Extraction
 * 
 * Resolves conflicts between algorithm and LLM extraction results.
 * Implements conflict detection and resolution strategies.
 */

class ConflictResolver {
  constructor(options = {}) {
    this.strategy = options.strategy || 'prefer_algorithm';
    this.logConflicts = options.logConflicts !== false;
    this.conflicts = [];
  }

  /**
   * Resolve conflicts between algorithm and LLM results
   * @param {Object} algorithmResult - Algorithm extraction result
   * @param {Object} llmResult - LLM extraction result
   * @returns {Object} Resolved result with conflict information
   */
  resolve(algorithmResult, llmResult) {
    this.conflicts = [];

    // Detect and resolve entity conflicts
    const resolvedEntities = this._resolveEntityConflicts(
      algorithmResult.entities || [],
      llmResult.entities || []
    );

    // Detect and resolve relation conflicts
    const resolvedRelations = this._resolveRelationConflicts(
      algorithmResult.relations || [],
      llmResult.relations || []
    );

    return {
      entities: resolvedEntities,
      relations: resolvedRelations,
      conflicts: this.conflicts,
      conflictCount: this.conflicts.length
    };
  }

  /**
   * Resolve entity conflicts
   * @private
   */
  _resolveEntityConflicts(algorithmEntities, llmEntities) {
    const resolved = [];
    const processedLLMEntities = new Set();

    // First, add all algorithm entities (they have priority)
    algorithmEntities.forEach(algoEntity => {
      resolved.push(algoEntity);

      // Check for conflicts with LLM entities
      llmEntities.forEach((llmEntity, index) => {
        if (this._entitiesConflict(algoEntity, llmEntity)) {
          this._logConflict({
            type: 'entity_conflict',
            algorithmEntity: algoEntity.name,
            llmEntity: llmEntity.name,
            resolution: 'kept_algorithm',
            reason: 'Algorithm extraction has priority for numerical parameters'
          });
          processedLLMEntities.add(index);
        }
      });
    });

    // Add non-conflicting LLM entities
    llmEntities.forEach((llmEntity, index) => {
      if (!processedLLMEntities.has(index)) {
        resolved.push(llmEntity);
      }
    });

    return resolved;
  }

  /**
   * Resolve relation conflicts
   * @private
   */
  _resolveRelationConflicts(algorithmRelations, llmRelations) {
    const resolved = [];
    const relationMap = new Map();

    // Add algorithm relations first
    algorithmRelations.forEach(rel => {
      const key = this._getRelationKey(rel);
      relationMap.set(key, rel);
      resolved.push(rel);
    });

    // Add LLM relations, checking for conflicts
    llmRelations.forEach(llmRel => {
      const key = this._getRelationKey(llmRel);
      
      if (relationMap.has(key)) {
        const algoRel = relationMap.get(key);
        
        // Check if they conflict (different types for same entity pair)
        if (algoRel.type !== llmRel.type) {
          this._logConflict({
            type: 'relation_conflict',
            source: llmRel.source,
            target: llmRel.target,
            algorithmType: algoRel.type,
            llmType: llmRel.type,
            resolution: 'kept_algorithm',
            reason: 'Algorithm relation has priority'
          });
        }
      } else {
        // No conflict, add LLM relation
        resolved.push(llmRel);
        relationMap.set(key, llmRel);
      }
    });

    return resolved;
  }

  /**
   * Check if two entities conflict
   * @private
   */
  _entitiesConflict(entity1, entity2) {
    // Entities conflict if they have the same name
    if (entity1.name === entity2.name) {
      // Check for numerical value conflicts
      if (entity1.properties?.value && entity2.properties?.value) {
        // If values are different, it's a conflict
        // If values are the same, it's also a conflict (duplicate) but we keep algorithm version
        return true;
      }
      return false;
    }
    return false;
  }

  /**
   * Get unique key for a relation
   * @private
   */
  _getRelationKey(relation) {
    return `${relation.source}:${relation.target}`;
  }

  /**
   * Log a conflict
   * @private
   */
  _logConflict(conflict) {
    this.conflicts.push({
      ...conflict,
      timestamp: new Date().toISOString()
    });

    if (this.logConflicts) {
      console.warn('[ConflictResolver] Conflict detected:', conflict);
    }
  }

  /**
   * Get all detected conflicts
   * @returns {Array} List of conflicts
   */
  getConflicts() {
    return [...this.conflicts];
  }

  /**
   * Clear conflict history
   */
  clearConflicts() {
    this.conflicts = [];
  }

  /**
   * Set resolution strategy
   * @param {string} strategy - 'prefer_algorithm', 'prefer_llm', or 'merge'
   */
  setStrategy(strategy) {
    this.strategy = strategy;
  }

  /**
   * Get current strategy
   * @returns {string} Current resolution strategy
   */
  getStrategy() {
    return this.strategy;
  }
}

module.exports = ConflictResolver;
