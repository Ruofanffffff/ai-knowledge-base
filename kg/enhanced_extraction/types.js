/**
 * Core data models and type definitions for LLM-enhanced entity extraction system
 * 
 * This module defines the data structures used throughout the extraction pipeline,
 * including extraction results, configurations, and quality metrics.
 */

/**
 * @typedef {Object} Entity
 * @property {string} id - Unique entity identifier
 * @property {string} type - Entity type: 'lens', 'technique', 'concept', 'scene', 'numerical_parameter'
 * @property {string} name - Entity name
 * @property {Object} properties - Entity-specific properties
 * @property {number} confidence - Confidence score [0, 1]
 * @property {string} source - Extraction source: 'algorithm' | 'llm'
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} Relation
 * @property {string} id - Unique relation identifier
 * @property {string} type - Relation type: 'suitable_for', 'recommended_for', 'applies_to', 'affects', 'co_occurrence'
 * @property {string} source - Source entity ID or name
 * @property {string} target - Target entity ID or name
 * @property {number} confidence - Confidence score [0, 1]
 * @property {string} extractionSource - Extraction source: 'algorithm' | 'llm'
 * @property {Object} metadata - Additional metadata
 */

/**
 * @typedef {Object} ExtractionResult
 * @property {Entity[]} entities - List of extracted entities
 * @property {Relation[]} relations - List of extracted relations
 * @property {Object} metadata - Extraction metadata
 * @property {Object} quality - Quality metrics
 */

/**
 * @typedef {Object} Configuration
 * @property {Object} llm - LLM configuration
 * @property {Object} algorithm - Algorithm configuration
 * @property {Object} fusion - Fusion configuration
 * @property {Object} performance - Performance configuration
 * @property {Object} quality - Quality configuration
 * @property {Object} language - Language configuration
 */

/**
 * Create a new entity
 */
function createEntity({
  id,
  type,
  name,
  properties = {},
  confidence = 1.0,
  source = 'algorithm',
  metadata = {}
}) {
  return {
    id: id || `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    name,
    properties,
    confidence: Math.max(0, Math.min(1, confidence)),
    source,
    metadata: {
      extractedAt: new Date().toISOString(),
      ...metadata
    }
  };
}

/**
 * Create a new relation
 */
function createRelation({
  id,
  type,
  source,
  target,
  confidence = 1.0,
  extractionSource = 'algorithm',
  metadata = {}
}) {
  return {
    id: id || `relation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type,
    source,
    target,
    confidence: Math.max(0, Math.min(1, confidence)),
    extractionSource,
    metadata: {
      extractedAt: new Date().toISOString(),
      ...metadata
    }
  };
}

/**
 * Create an extraction result
 */
function createExtractionResult({
  entities = [],
  relations = [],
  metadata = {},
  quality = {}
}) {
  return {
    entities,
    relations,
    metadata: {
      documentId: null,
      language: 'auto',
      processingTime: 0,
      algorithmTime: 0,
      llmTime: 0,
      tokensUsed: 0,
      cost: 0,
      llmModel: null,
      conflicts: 0,
      status: 'success',
      ...metadata
    },
    quality: {
      entityCompleteness: 0,
      relationCompleteness: 0,
      averageConfidence: 0,
      fieldCompleteness: 0,
      warnings: [],
      ...quality
    }
  };
}

module.exports = {
  createEntity,
  createRelation,
  createExtractionResult
};
