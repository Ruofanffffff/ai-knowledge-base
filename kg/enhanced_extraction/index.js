/**
 * LLM-Enhanced Entity Extraction System
 * 
 * Main entry point for the enhanced extraction system that combines
 * algorithm-based extraction with LLM-powered semantic understanding.
 */

const { createEntity, createRelation, createExtractionResult } = require('./types');
const {
  ENTITY_TYPES,
  RELATION_TYPES,
  EXTRACTION_SOURCES,
  PROCESSING_STATUS,
  DEFAULT_CONFIG
} = require('./constants');
const Configuration = require('./configuration');
const AlgorithmExtractor = require('./algorithm_extractor');
const { PromptBuilder } = require('./prompt_builder');
const { LLMClient, createLLMClient } = require('./llm_client');
const { LLMCacheWrapper, createCacheWrapper } = require('./llm_cache_wrapper');
const ResultParser = require('./result_parser');
const LLMExtractor = require('./llm_extractor');
const ConflictResolver = require('./conflict_resolver');
const ResultFusion = require('./result_fusion');
const QualityValidator = require('./quality_validator');
const ErrorHandler = require('./error_handler');
const ExtractionCoordinator = require('./extraction_coordinator');
const { 
  EnhancedExtractionAdapter, 
  createEnhancedExtractor, 
  isEnhancedExtractionAvailable 
} = require('./pipeline_integration');

module.exports = {
  // Data models
  createEntity,
  createRelation,
  createExtractionResult,
  
  // Constants
  ENTITY_TYPES,
  RELATION_TYPES,
  EXTRACTION_SOURCES,
  PROCESSING_STATUS,
  DEFAULT_CONFIG,
  
  // Configuration
  Configuration,
  
  // Extractors
  AlgorithmExtractor,
  LLMExtractor,
  
  // LLM Client
  LLMClient,
  createLLMClient,
  
  // Cache
  LLMCacheWrapper,
  createCacheWrapper,
  
  // Utilities
  PromptBuilder,
  ResultParser,
  ConflictResolver,
  ResultFusion,
  QualityValidator,
  ErrorHandler,
  
  // Coordinator
  ExtractionCoordinator,
  
  // Pipeline Integration
  EnhancedExtractionAdapter,
  createEnhancedExtractor,
  isEnhancedExtractionAvailable
};
