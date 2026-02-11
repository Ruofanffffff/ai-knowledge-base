/**
 * Human Readability Validator
 * 
 * Validates the quality of human-readable knowledge graph output.
 * Checks entity names, relationship descriptions, and overall quality.
 * 
 * @module human_readable/human_readability_validator
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} passed - Whether validation passed
 * @property {number} score - Overall quality score (0-1)
 * @property {Object} details - Detailed validation results
 * @property {Array<string>} warnings - List of warnings
 * @property {Array<string>} errors - List of errors
 */

class HumanReadabilityValidator {
  constructor(options = {}) {
    this.strictMode = options.strictMode || false;
    this.minNameLength = options.minNameLength || 2;
    this.maxNameLength = options.maxNameLength || 40;
    this.minDescriptionWords = options.minDescriptionWords || 5;
    this.maxDescriptionWords = options.maxDescriptionWords || 50;
  }

  /**
   * Validate knowledge graph output
   * @param {Object} knowledgeGraph - Knowledge graph object
   * @param {Array<Object>} knowledgeGraph.entities - Entities
   * @param {Array<Object>} knowledgeGraph.relations - Relations
   * @returns {ValidationResult}
   */
  validate(knowledgeGraph) {
    const { entities = [], relations = [] } = knowledgeGraph;
    
    const entityValidation = this.validateEntityNames(entities);
    const relationValidation = this.validateRelationDescriptions(relations);
    
    const warnings = [
      ...entityValidation.warnings,
      ...relationValidation.warnings
    ];
    
    const errors = [
      ...entityValidation.errors,
      ...relationValidation.errors
    ];
    
    const score = (entityValidation.score + relationValidation.score) / 2;
    const passed = errors.length === 0 && (!this.strictMode || warnings.length === 0);
    
    return {
      passed,
      score,
      details: {
        entities: entityValidation,
        relations: relationValidation
      },
      warnings,
      errors
    };
  }

  /**
   * Validate entity names
   * @param {Array<Object>} entities - Entities
   * @returns {Object} Validation result
   */
  validateEntityNames(entities) {
    const warnings = [];
    const errors = [];
    let validCount = 0;
    
    for (const entity of entities) {
      const name = entity.name || entity.canonical_name;
      
      // Check for unknown names (hard requirement)
      if (!name || name.toLowerCase().includes('unknown')) {
        errors.push(`Entity has unknown name: ${name || 'undefined'}`);
        continue;
      }
      
      // Check for empty or whitespace-only names
      if (name.trim().length === 0) {
        errors.push(`Entity has empty name`);
        continue;
      }
      
      // Detect language (Chinese vs English)
      const isChinese = /[\u4e00-\u9fa5]/.test(name);
      const minLength = isChinese ? 2 : 2;
      const maxLength = isChinese ? 20 : 40;
      
      // Check length based on language
      if (name.length < minLength) {
        warnings.push(`Entity name too short (${name.length} < ${minLength}): ${name}`);
        continue;
      }
      
      if (name.length > maxLength) {
        warnings.push(`Entity name too long (${name.length} > ${maxLength}): ${name.substring(0, 20)}...`);
      }
      
      // Check for descriptive terms (not just pure numbers or symbols)
      if (/^[\d.]+$/.test(name)) {
        warnings.push(`Entity name is pure number: ${name}`);
        continue;
      }
      
      // Check for excessive whitespace
      if (/\s{2,}/.test(name)) {
        warnings.push(`Entity name has excessive whitespace: ${name}`);
      }
      
      // Check for special characters (except hyphens, underscores, and slashes)
      if (/[^\w\s\u4e00-\u9fa5\-/]/.test(name)) {
        warnings.push(`Entity name contains special characters: ${name}`);
      }
      
      // Check for descriptive content (at least one letter or Chinese character)
      if (!/[a-zA-Z\u4e00-\u9fa5]/.test(name)) {
        warnings.push(`Entity name lacks descriptive content: ${name}`);
        continue;
      }
      
      validCount++;
    }
    
    const score = entities.length > 0 ? validCount / entities.length : 0;
    
    return {
      score,
      validCount,
      totalCount: entities.length,
      warnings,
      errors
    };
  }

  /**
   * Validate relationship descriptions
   * @param {Array<Object>} relations - Relations
   * @returns {Object} Validation result
   */
  validateRelationDescriptions(relations) {
    const warnings = [];
    const errors = [];
    let validCount = 0;
    
    for (const relation of relations) {
      const description = relation.description;
      const sourceEntity = relation.source || relation.source_id;
      const targetEntity = relation.target || relation.target_id;
      
      // Check for missing description (hard requirement)
      if (!description || description.trim().length === 0) {
        errors.push(`Relation missing description: ${sourceEntity} -> ${targetEntity}`);
        continue;
      }
      
      // Check word count (5-50 words)
      const words = description.split(/\s+/).filter(w => w.length > 0);
      
      if (words.length < this.minDescriptionWords) {
        warnings.push(`Description too short (${words.length} words): ${description}`);
        // Don't continue - still count as processed
      }
      
      if (words.length > this.maxDescriptionWords) {
        warnings.push(`Description too long (${words.length} words): ${description.substring(0, 50)}...`);
      }
      
      // Check for entity references (should mention source or target)
      const hasEntityReference = description.includes(sourceEntity) || 
                                 description.includes(targetEntity);
      
      if (!hasEntityReference) {
        warnings.push(`Description doesn't reference entities: ${description.substring(0, 50)}...`);
      }
      
      // Check for natural language format (not just codes or IDs)
      if (/^[A-Z0-9_]+$/.test(description) && description.length < 30) {
        warnings.push(`Description appears to be code/ID: ${description}`);
        // Don't continue - still count as processed
      }
      
      // Check for complete sentences or clear phrases
      const hasProperPunctuation = /[。！？.!?]$/.test(description.trim());
      const hasVerb = /[\u4e00-\u9fa5]{2,}|[a-z]{3,}/i.test(description);
      
      if (!hasProperPunctuation && !hasVerb) {
        warnings.push(`Description may not be natural language: ${description.substring(0, 50)}...`);
      }
      
      validCount++;
    }
    
    const score = relations.length > 0 ? validCount / relations.length : 0;
    
    return {
      score,
      validCount,
      totalCount: relations.length,
      warnings,
      errors
    };
  }

  /**
   * Generate quality report
   * @param {Object} knowledgeGraph - Knowledge graph object
   * @returns {Object} Quality report
   */
  generateQualityReport(knowledgeGraph) {
    const validation = this.validate(knowledgeGraph);
    const { entities = [], relations = [] } = knowledgeGraph;
    
    // Calculate statistics
    const entityStats = this._calculateEntityStats(entities);
    const relationStats = this._calculateRelationStats(relations);
    const hierarchicalStats = this._calculateHierarchicalStats(relations);
    
    // Calculate percentages
    const standardizedEntityPercentage = entities.length > 0
      ? (entities.filter(e => e.name_standardization || e.standardized).length / entities.length) * 100
      : 0;
    
    const relationsWithDescriptionsPercentage = relations.length > 0
      ? (relations.filter(r => r.description && r.description.length > 0).length / relations.length) * 100
      : 0;
    
    return {
      summary: {
        overallScore: validation.score,
        passed: validation.passed,
        totalEntities: entities.length,
        totalRelations: relations.length,
        validEntities: validation.details.entities.validCount,
        validRelations: validation.details.relations.validCount,
        standardizedEntityPercentage: Math.round(standardizedEntityPercentage * 10) / 10,
        relationsWithDescriptionsPercentage: Math.round(relationsWithDescriptionsPercentage * 10) / 10
      },
      entityStats,
      relationStats,
      hierarchicalStats,
      validation,
      recommendations: this._generateRecommendations(validation, entityStats, relationStats)
    };
  }

  /**
   * Calculate entity statistics
   * @private
   */
  _calculateEntityStats(entities) {
    const nameLengths = entities.map(e => (e.name || e.canonical_name || '').length);
    const avgLength = nameLengths.length > 0
      ? nameLengths.reduce((a, b) => a + b, 0) / nameLengths.length
      : 0;
    
    return {
      totalCount: entities.length,
      averageNameLength: Math.round(avgLength * 10) / 10,
      minNameLength: Math.min(...nameLengths, 0),
      maxNameLength: Math.max(...nameLengths, 0)
    };
  }

  /**
   * Calculate relation statistics
   * @private
   */
  _calculateRelationStats(relations) {
    const descLengths = relations
      .filter(r => r.description)
      .map(r => r.description.split(/\s+/).length);
    
    const avgLength = descLengths.length > 0
      ? descLengths.reduce((a, b) => a + b, 0) / descLengths.length
      : 0;
    
    const withDescriptions = relations.filter(r => r.description && r.description.length > 0).length;
    const percentage = relations.length > 0 ? (withDescriptions / relations.length) * 100 : 0;
    
    return {
      totalCount: relations.length,
      withDescriptions,
      descriptionPercentage: Math.round(percentage * 10) / 10,
      averageDescriptionLength: Math.round(avgLength * 10) / 10,
      minDescriptionLength: Math.min(...descLengths, 0),
      maxDescriptionLength: Math.max(...descLengths, 0)
    };
  }

  /**
   * Calculate hierarchical relation statistics
   * @private
   */
  _calculateHierarchicalStats(relations) {
    const hierarchicalRelations = relations.filter(r => 
      r.type === 'hierarchical' || 
      r.subtype === 'is_a' || 
      r.subtype === 'part_of' || 
      r.subtype === 'has_property'
    );
    
    const isACount = hierarchicalRelations.filter(r => r.subtype === 'is_a').length;
    const partOfCount = hierarchicalRelations.filter(r => r.subtype === 'part_of').length;
    const hasPropertyCount = hierarchicalRelations.filter(r => r.subtype === 'has_property').length;
    
    return {
      totalHierarchical: hierarchicalRelations.length,
      isACount,
      partOfCount,
      hasPropertyCount,
      hierarchicalPercentage: relations.length > 0 
        ? Math.round((hierarchicalRelations.length / relations.length) * 1000) / 10
        : 0
    };
  }

  /**
   * Generate recommendations
   * @private
   */
  _generateRecommendations(validation, entityStats, relationStats) {
    const recommendations = [];
    
    // Entity name recommendations
    if (validation.details.entities.score < 0.8) {
      recommendations.push({
        priority: 'high',
        category: 'entity_names',
        message: 'Consider improving entity name standardization',
        details: `Only ${Math.round(validation.details.entities.score * 100)}% of entities have valid names`
      });
    }
    
    if (validation.details.entities.score < 0.95 && validation.details.entities.score >= 0.8) {
      recommendations.push({
        priority: 'medium',
        category: 'entity_names',
        message: 'Entity names are good but could be improved',
        details: `${validation.details.entities.validCount}/${validation.details.entities.totalCount} entities have valid names`
      });
    }
    
    // Relationship description recommendations
    if (validation.details.relations.score < 0.8) {
      recommendations.push({
        priority: 'high',
        category: 'relation_descriptions',
        message: 'Consider improving relationship descriptions',
        details: `Only ${Math.round(validation.details.relations.score * 100)}% of relations have valid descriptions`
      });
    }
    
    if (relationStats.descriptionPercentage < 100) {
      recommendations.push({
        priority: 'high',
        category: 'relation_descriptions',
        message: 'Not all relations have descriptions',
        details: `${relationStats.withDescriptions}/${relationStats.totalCount} relations have descriptions (${relationStats.descriptionPercentage}%)`
      });
    }
    
    // Critical errors
    if (validation.errors.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'errors',
        message: `Fix ${validation.errors.length} critical error${validation.errors.length > 1 ? 's' : ''}`,
        details: validation.errors.slice(0, 3).join('; ')
      });
    }
    
    // Warnings
    if (validation.warnings.length > 5) {
      recommendations.push({
        priority: 'medium',
        category: 'warnings',
        message: `Address ${validation.warnings.length} warning${validation.warnings.length > 1 ? 's' : ''}`,
        details: `Review warnings to improve overall quality`
      });
    }
    
    // Name length recommendations
    if (entityStats.averageNameLength < 3) {
      recommendations.push({
        priority: 'low',
        category: 'entity_names',
        message: 'Entity names are very short',
        details: `Average name length is ${entityStats.averageNameLength} characters`
      });
    }
    
    if (entityStats.averageNameLength > 30) {
      recommendations.push({
        priority: 'low',
        category: 'entity_names',
        message: 'Entity names are very long',
        details: `Average name length is ${entityStats.averageNameLength} characters`
      });
    }
    
    // Description length recommendations
    if (relationStats.averageDescriptionLength < 8) {
      recommendations.push({
        priority: 'medium',
        category: 'relation_descriptions',
        message: 'Relationship descriptions are too brief',
        details: `Average description length is ${relationStats.averageDescriptionLength} words`
      });
    }
    
    // Success message
    if (validation.passed && validation.errors.length === 0 && validation.warnings.length === 0) {
      recommendations.push({
        priority: 'info',
        category: 'success',
        message: 'Knowledge graph meets all quality standards',
        details: 'No improvements needed'
      });
    }
    
    return recommendations;
  }
}

module.exports = {
  HumanReadabilityValidator
};
