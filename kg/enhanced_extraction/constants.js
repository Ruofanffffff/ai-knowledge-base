/**
 * Constants for LLM-enhanced entity extraction system
 */

// Entity types
const ENTITY_TYPES = {
  LENS: 'lens',
  TECHNIQUE: 'technique',
  CONCEPT: 'concept',
  SCENE: 'scene',
  NUMERICAL_PARAMETER: 'numerical_parameter'
};

// Relation types
const RELATION_TYPES = {
  SUITABLE_FOR: 'suitable_for',
  RECOMMENDED_FOR: 'recommended_for',
  APPLIES_TO: 'applies_to',
  AFFECTS: 'affects',
  CO_OCCURRENCE: 'co_occurrence'
};

// Extraction sources
const EXTRACTION_SOURCES = {
  ALGORITHM: 'algorithm',
  LLM: 'llm'
};

// Processing status
const PROCESSING_STATUS = {
  SUCCESS: 'success',
  PARTIAL_SUCCESS: 'partial_success',
  FAILED: 'failed'
};

// Default configuration
const DEFAULT_CONFIG = {
  llm: {
    enabled: true,
    model: 'qwen-plus',
    timeout: 30000,
    maxRetries: 3,
    temperature: 0.1,
    maxTokens: 4000
  },
  algorithm: {
    enabled: true,
    extractorType: 'universal'
  },
  fusion: {
    conflictStrategy: 'prefer_algorithm',
    deduplication: true,
    confidenceThreshold: 0.5
  },
  performance: {
    enableCache: true,
    cacheExpiry: 3600,
    batchSize: 5,
    maxProcessingTime: 5000
  },
  quality: {
    minEntities: 1,
    minRelations: 0,
    minConfidence: 0.3,
    requiredFields: []
  },
  language: {
    default: 'zh',
    supported: ['zh', 'en'],
    autoDetect: true
  }
};

module.exports = {
  ENTITY_TYPES,
  RELATION_TYPES,
  EXTRACTION_SOURCES,
  PROCESSING_STATUS,
  DEFAULT_CONFIG
};
