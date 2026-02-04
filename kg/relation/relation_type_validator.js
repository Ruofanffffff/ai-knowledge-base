/**
 * Relation Type Validator
 * 
 * Validates relation instances against relation type definitions.
 * Ensures entity types, confidence values, and other constraints are met.
 * 
 * Design Reference: Relation Type Expansion
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

/**
 * Validation result structure
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} errors - Array of error messages
 * @property {string[]} warnings - Array of warning messages
 */

/**
 * RelationTypeValidator class
 * Validates relation instances against type definitions
 */
class RelationTypeValidator {
  /**
   * @param {Object} registry - RelationTypeRegistry instance
   */
  constructor(registry) {
    this.registry = registry;
  }

  /**
   * Validate a relation instance against its relation type
   * 
   * @param {Object} relation - Relation instance to validate
   * @param {Object} relationType - RelationTypeDefinition
   * @returns {ValidationResult} Validation result
   */
  validate(relation, relationType) {
    const errors = [];
    const warnings = [];

    // Validate source entity type
    if (!this.validateSourceEntity(relation.sourceEntityType, relationType)) {
      errors.push(
        `Source entity type '${relation.sourceEntityType}' is not allowed for relation type '${relationType.relationTypeId}'. ` +
        `Allowed types: ${relationType.sourceEntityTypes.join(', ')}`
      );
    }

    // Validate target entity type
    if (!this.validateTargetEntity(relation.targetEntityType, relationType)) {
      errors.push(
        `Target entity type '${relation.targetEntityType}' is not allowed for relation type '${relationType.relationTypeId}'. ` +
        `Allowed types: ${relationType.targetEntityTypes.join(', ')}`
      );
    }

    // Validate confidence if present
    if (relation.confidence !== undefined && relation.confidence !== null) {
      if (!this.validateConfidence(relation.confidence, relationType)) {
        errors.push(
          `Confidence value ${relation.confidence} is invalid. Must be between 0 and 1 (inclusive)`
        );
      }
    } else if (relationType.supportsConfidence) {
      warnings.push(
        `Relation type '${relationType.relationTypeId}' supports confidence but no confidence value provided`
      );
    }

    // Validate timestamp if relation type is temporal
    if (relationType.isTemporal) {
      if (relation.timestamp) {
        if (!this.validateTimestamp(relation.timestamp, relationType)) {
          errors.push(
            `Timestamp '${relation.timestamp}' is invalid. Must be a valid date`
          );
        }
      } else {
        warnings.push(
          `Relation type '${relationType.relationTypeId}' is temporal but no timestamp provided`
        );
      }
    }

    // Validate direction
    if (relationType.isDirectional) {
      if (!relation.sourceId || !relation.targetId) {
        errors.push(
          `Directional relation type '${relationType.relationTypeId}' requires both sourceId and targetId`
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate source entity type
   * 
   * @param {string} entityType - Entity type to validate
   * @param {Object} relationType - RelationTypeDefinition
   * @returns {boolean} True if valid
   */
  validateSourceEntity(entityType, relationType) {
    if (!entityType) {
      return false;
    }
    return relationType.sourceEntityTypes.includes(entityType);
  }

  /**
   * Validate target entity type
   * 
   * @param {string} entityType - Entity type to validate
   * @param {Object} relationType - RelationTypeDefinition
   * @returns {boolean} True if valid
   */
  validateTargetEntity(entityType, relationType) {
    if (!entityType) {
      return false;
    }
    return relationType.targetEntityTypes.includes(entityType);
  }

  /**
   * Validate confidence value
   * 
   * @param {number} confidence - Confidence value to validate
   * @param {Object} relationType - RelationTypeDefinition
   * @returns {boolean} True if valid
   */
  validateConfidence(confidence, relationType) {
    if (!relationType.supportsConfidence) {
      return true; // If type doesn't support confidence, any value is acceptable
    }

    if (typeof confidence !== 'number') {
      return false;
    }

    return confidence >= 0 && confidence <= 1;
  }

  /**
   * Validate timestamp
   * 
   * @param {Date|string|number} timestamp - Timestamp to validate
   * @param {Object} relationType - RelationTypeDefinition
   * @returns {boolean} True if valid
   */
  validateTimestamp(timestamp, relationType) {
    if (!relationType.isTemporal) {
      return true; // If type is not temporal, any timestamp is acceptable
    }

    try {
      const date = new Date(timestamp);
      return !isNaN(date.getTime());
    } catch (error) {
      return false;
    }
  }

  /**
   * Validate direction (source and target IDs)
   * 
   * @param {string} sourceId - Source entity ID
   * @param {string} targetId - Target entity ID
   * @param {Object} relationType - RelationTypeDefinition
   * @returns {boolean} True if valid
   */
  validateDirection(sourceId, targetId, relationType) {
    if (!relationType.isDirectional) {
      return true; // Bidirectional relations don't need strict direction
    }

    return Boolean(sourceId) && Boolean(targetId) && sourceId !== targetId;
  }

  /**
   * Validate a relation instance by relation type ID
   * 
   * @param {Object} relation - Relation instance to validate
   * @param {string} relationTypeId - Relation type ID
   * @returns {ValidationResult} Validation result
   */
  validateByTypeId(relation, relationTypeId) {
    const relationType = this.registry.get(relationTypeId);
    
    if (!relationType) {
      return {
        valid: false,
        errors: [`Relation type '${relationTypeId}' not found in registry`],
        warnings: []
      };
    }

    return this.validate(relation, relationType);
  }

  /**
   * Validate multiple relations in batch
   * 
   * @param {Array<Object>} relations - Array of relation instances
   * @param {string} relationTypeId - Relation type ID
   * @returns {Object} Batch validation result
   */
  validateBatch(relations, relationTypeId) {
    const results = {
      valid: 0,
      invalid: 0,
      validations: []
    };

    for (const relation of relations) {
      const validation = this.validateByTypeId(relation, relationTypeId);
      results.validations.push({
        relation,
        validation
      });

      if (validation.valid) {
        results.valid++;
      } else {
        results.invalid++;
      }
    }

    return results;
  }

  /**
   * Check if a relation instance is compatible with a relation type
   * (less strict than validate - only checks entity types)
   * 
   * @param {Object} relation - Relation instance
   * @param {Object} relationType - RelationTypeDefinition
   * @returns {boolean} True if compatible
   */
  isCompatible(relation, relationType) {
    return (
      this.validateSourceEntity(relation.sourceEntityType, relationType) &&
      this.validateTargetEntity(relation.targetEntityType, relationType)
    );
  }

  /**
   * Get suggested relation types for a relation instance
   * 
   * @param {Object} relation - Relation instance
   * @returns {Array<Object>} Array of compatible RelationTypeDefinitions
   */
  getSuggestedTypes(relation) {
    const allTypes = this.registry.getAll();
    return allTypes.filter(type => this.isCompatible(relation, type));
  }
}

module.exports = RelationTypeValidator;
