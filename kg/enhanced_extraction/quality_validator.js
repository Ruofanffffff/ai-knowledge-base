/**
 * Quality Validator for Enhanced Entity Extraction
 * 
 * Validates extraction results and calculates quality metrics.
 * Ensures entities and relations meet completeness and validity requirements.
 */

class QualityValidator {
  constructor(options = {}) {
    this.config = {
      minEntities: options.minEntities || 0,
      minRelations: options.minRelations || 0,
      minConfidence: options.minConfidence || 0.0,
      requiredFields: options.requiredFields || [],
      strictMode: options.strictMode || false,
      ...options
    };
  }

  /**
   * Validate extraction result
   * @param {Object} result - Extraction result to validate
   * @returns {Object} Validation report
   */
  validate(result) {
    const warnings = [];
    const errors = [];

    // Validate entities
    const entityValidation = this._validateEntities(result.entities || []);
    warnings.push(...entityValidation.warnings);
    errors.push(...entityValidation.errors);

    // Validate relations
    const relationValidation = this._validateRelations(
      result.relations || [],
      result.entities || []
    );
    warnings.push(...relationValidation.warnings);
    errors.push(...relationValidation.errors);

    // Validate metadata
    const metadataValidation = this._validateMetadata(result.metadata || {});
    warnings.push(...metadataValidation.warnings);
    errors.push(...metadataValidation.errors);

    // Determine overall validity
    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      entityValidation: entityValidation.summary,
      relationValidation: relationValidation.summary,
      metadataValidation: metadataValidation.summary
    };
  }

  /**
   * Calculate quality metrics for extraction result
   * @param {Object} result - Extraction result
   * @returns {Object} Quality metrics
   */
  calculateMetrics(result) {
    const entities = result.entities || [];
    const relations = result.relations || [];

    // Entity completeness
    const entityCompleteness = this._calculateEntityCompleteness(entities);

    // Relation completeness
    const relationCompleteness = this._calculateRelationCompleteness(relations, entities);

    // Average confidence
    const averageConfidence = this._calculateAverageConfidence(entities, relations);

    // Field completeness
    const fieldCompleteness = this._calculateFieldCompleteness(entities);

    return {
      entityCompleteness,
      relationCompleteness,
      averageConfidence,
      fieldCompleteness,
      totalEntities: entities.length,
      totalRelations: relations.length,
      algorithmEntities: entities.filter(e => e.source === 'algorithm').length,
      llmEntities: entities.filter(e => e.source === 'llm').length,
      algorithmRelations: relations.filter(r => r.extractionSource === 'algorithm').length,
      llmRelations: relations.filter(r => r.extractionSource === 'llm').length
    };
  }

  /**
   * Validate entities
   * @private
   */
  _validateEntities(entities) {
    const warnings = [];
    const errors = [];

    // Check minimum entity count
    if (entities.length < this.config.minEntities) {
      warnings.push({
        type: 'entity_count',
        message: `Entity count (${entities.length}) is below minimum (${this.config.minEntities})`
      });
    }

    // Validate each entity
    entities.forEach((entity, index) => {
      // Check required fields
      if (!entity.name) {
        errors.push({
          type: 'missing_field',
          entity: index,
          field: 'name',
          message: `Entity at index ${index} is missing required field: name`
        });
      }

      if (!entity.type) {
        errors.push({
          type: 'missing_field',
          entity: index,
          field: 'type',
          message: `Entity at index ${index} is missing required field: type`
        });
      }

      if (entity.confidence === undefined || entity.confidence === null) {
        errors.push({
          type: 'missing_field',
          entity: index,
          field: 'confidence',
          message: `Entity at index ${index} is missing required field: confidence`
        });
      }

      if (!entity.source) {
        errors.push({
          type: 'missing_field',
          entity: index,
          field: 'source',
          message: `Entity at index ${index} is missing required field: source`
        });
      }

      // Validate confidence range
      if (entity.confidence !== undefined && entity.confidence !== null) {
        if (entity.confidence < 0 || entity.confidence > 1) {
          errors.push({
            type: 'invalid_confidence',
            entity: index,
            value: entity.confidence,
            message: `Entity at index ${index} has invalid confidence: ${entity.confidence} (must be 0-1)`
          });
        }

        // Check minimum confidence
        if (entity.confidence < this.config.minConfidence) {
          warnings.push({
            type: 'low_confidence',
            entity: index,
            value: entity.confidence,
            message: `Entity at index ${index} has low confidence: ${entity.confidence}`
          });
        }
      }

      // Check custom required fields
      this.config.requiredFields.forEach(field => {
        if (!entity[field] && !entity.properties?.[field]) {
          warnings.push({
            type: 'missing_custom_field',
            entity: index,
            field,
            message: `Entity at index ${index} is missing custom required field: ${field}`
          });
        }
      });
    });

    return {
      warnings,
      errors,
      summary: {
        total: entities.length,
        valid: entities.length - errors.filter(e => e.type !== 'low_confidence').length,
        withWarnings: warnings.length
      }
    };
  }

  /**
   * Validate relations
   * @private
   */
  _validateRelations(relations, entities) {
    const warnings = [];
    const errors = [];

    // Check minimum relation count
    if (relations.length < this.config.minRelations) {
      warnings.push({
        type: 'relation_count',
        message: `Relation count (${relations.length}) is below minimum (${this.config.minRelations})`
      });
    }

    // Build entity name set for validation
    const entityNames = new Set(entities.map(e => e.name));

    // Validate each relation
    relations.forEach((relation, index) => {
      // Check required fields
      if (!relation.type) {
        errors.push({
          type: 'missing_field',
          relation: index,
          field: 'type',
          message: `Relation at index ${index} is missing required field: type`
        });
      }

      if (!relation.source) {
        errors.push({
          type: 'missing_field',
          relation: index,
          field: 'source',
          message: `Relation at index ${index} is missing required field: source`
        });
      }

      if (!relation.target) {
        errors.push({
          type: 'missing_field',
          relation: index,
          field: 'target',
          message: `Relation at index ${index} is missing required field: target`
        });
      }

      if (relation.confidence === undefined || relation.confidence === null) {
        errors.push({
          type: 'missing_field',
          relation: index,
          field: 'confidence',
          message: `Relation at index ${index} is missing required field: confidence`
        });
      }

      // Validate confidence range
      if (relation.confidence !== undefined && relation.confidence !== null) {
        if (relation.confidence < 0 || relation.confidence > 1) {
          errors.push({
            type: 'invalid_confidence',
            relation: index,
            value: relation.confidence,
            message: `Relation at index ${index} has invalid confidence: ${relation.confidence} (must be 0-1)`
          });
        }

        // Check minimum confidence
        if (relation.confidence < this.config.minConfidence) {
          warnings.push({
            type: 'low_confidence',
            relation: index,
            value: relation.confidence,
            message: `Relation at index ${index} has low confidence: ${relation.confidence}`
          });
        }
      }

      // Validate entity references
      if (relation.source && !entityNames.has(relation.source)) {
        errors.push({
          type: 'invalid_entity_reference',
          relation: index,
          entity: relation.source,
          message: `Relation at index ${index} references non-existent source entity: ${relation.source}`
        });
      }

      if (relation.target && !entityNames.has(relation.target)) {
        errors.push({
          type: 'invalid_entity_reference',
          relation: index,
          entity: relation.target,
          message: `Relation at index ${index} references non-existent target entity: ${relation.target}`
        });
      }
    });

    return {
      warnings,
      errors,
      summary: {
        total: relations.length,
        valid: relations.length - errors.filter(e => e.type !== 'low_confidence').length,
        withWarnings: warnings.length
      }
    };
  }

  /**
   * Validate metadata
   * @private
   */
  _validateMetadata(metadata) {
    const warnings = [];
    const errors = [];

    // Check required metadata fields
    const requiredMetadataFields = ['processingTime', 'status'];
    
    requiredMetadataFields.forEach(field => {
      if (metadata[field] === undefined || metadata[field] === null) {
        warnings.push({
          type: 'missing_metadata',
          field,
          message: `Metadata is missing field: ${field}`
        });
      }
    });

    // Validate processing time
    if (metadata.processingTime !== undefined && metadata.processingTime < 0) {
      errors.push({
        type: 'invalid_metadata',
        field: 'processingTime',
        value: metadata.processingTime,
        message: `Invalid processing time: ${metadata.processingTime} (must be >= 0)`
      });
    }

    // Validate status
    const validStatuses = ['success', 'partial_success', 'failed'];
    if (metadata.status && !validStatuses.includes(metadata.status)) {
      errors.push({
        type: 'invalid_metadata',
        field: 'status',
        value: metadata.status,
        message: `Invalid status: ${metadata.status} (must be one of: ${validStatuses.join(', ')})`
      });
    }

    return {
      warnings,
      errors,
      summary: {
        hasRequiredFields: requiredMetadataFields.every(f => metadata[f] !== undefined),
        fieldsPresent: Object.keys(metadata).length
      }
    };
  }

  /**
   * Calculate entity completeness
   * @private
   */
  _calculateEntityCompleteness(entities) {
    if (entities.length === 0) return 0;

    const expectedMinimum = this.config.minEntities || 1;
    return Math.min(entities.length / expectedMinimum, 1.0);
  }

  /**
   * Calculate relation completeness
   * @private
   */
  _calculateRelationCompleteness(relations, entities) {
    if (relations.length === 0 && entities.length === 0) return 1.0;
    if (entities.length === 0) return 0;

    const expectedMinimum = this.config.minRelations || Math.max(1, entities.length - 1);
    return Math.min(relations.length / expectedMinimum, 1.0);
  }

  /**
   * Calculate average confidence
   * @private
   */
  _calculateAverageConfidence(entities, relations) {
    const allItems = [...entities, ...relations];
    
    if (allItems.length === 0) return 0;

    const validConfidences = allItems
      .map(item => item.confidence)
      .filter(c => c !== undefined && c !== null && !isNaN(c));

    if (validConfidences.length === 0) return 0;

    const sum = validConfidences.reduce((acc, c) => acc + c, 0);
    return sum / validConfidences.length;
  }

  /**
   * Calculate field completeness
   * @private
   */
  _calculateFieldCompleteness(entities) {
    if (entities.length === 0) return 1.0;

    const requiredFields = ['name', 'type', 'confidence', 'source'];
    let totalFields = 0;
    let presentFields = 0;

    entities.forEach(entity => {
      requiredFields.forEach(field => {
        totalFields++;
        if (entity[field] !== undefined && entity[field] !== null) {
          presentFields++;
        }
      });
    });

    return totalFields > 0 ? presentFields / totalFields : 1.0;
  }

  /**
   * Update configuration
   * @param {Object} newConfig - New configuration options
   */
  configure(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current configuration
   * @returns {Object} Current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

module.exports = QualityValidator;
