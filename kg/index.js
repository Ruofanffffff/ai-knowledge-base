/**
 * Knowledge Graph Module Entry Point
 * 
 * This module implements a Schema-driven knowledge graph system with:
 * - CKB (Contextual Knowledge Block) layer
 * - Schema & Rule layer
 * - KG (Knowledge Graph) layer
 * - Reasoning/Application layer
 */

const ckbParser = require('./ckb/ckb_parser');
const ckbStore = require('./ckb/ckb_store');
const fieldExtractor = require('./field_extractor/field_extractor');
const schemaManager = require('./schema/schema_manager');
const schemaMatcher = require('./schema/schema_matcher');
const schemaStartupCheck = require('./schema/schema_startup_check');
const entityBuilder = require('./entity/entity_builder');
const entityStore = require('./entity/entity_store');
const builtinRelationBuilder = require('./relation/builtin_relation_builder');
const cooccurrenceRelationBuilder = require('./relation/cooccurrence_relation_builder');
const semanticRelationBuilder = require('./relation/semantic_relation_builder');
const relationStore = require('./relation/relation_store');
const confidenceEngine = require('./confidence/confidence_engine');
const qualityFilter = require('./confidence/quality_filter');
const kgService = require('./services/kg_service');
const graphTraversal = require('./services/graph_traversal');
const tokenTracker = require('./utils/token_tracker');
const llmCache = require('./utils/llm_cache');
const performanceMonitor = require('./utils/performance_monitor');
const tokenBudgetManager = require('./utils/token_budget_manager');

// Document Full Processing System
const documentProcessor = require('./document_processor');

// Universal Document Pipeline
const { UniversalDocumentPipeline } = require('./pipeline/universal_document_pipeline');

module.exports = {
  // CKB Layer
  ckbParser,
  ckbStore,
  
  // Field Extraction
  fieldExtractor,
  
  // Schema Layer
  schemaManager,
  schemaMatcher,
  schemaStartupCheck,
  
  // Entity Layer
  entityBuilder,
  entityStore,
  
  // Relation Layer
  builtinRelationBuilder,
  cooccurrenceRelationBuilder,
  semanticRelationBuilder,
  relationStore,
  
  // Confidence & Quality
  confidenceEngine,
  qualityFilter,
  
  // Services
  kgService,
  graphTraversal,
  
  // Utils
  tokenTracker,
  llmCache,
  performanceMonitor,
  tokenBudgetManager,
  
  // Document Full Processing
  documentProcessor,
  processDocumentWithFullProcessing: documentProcessor.processDocumentWithFullProcessing,
  
  // Universal Document Pipeline
  UniversalDocumentPipeline,
  
  // Startup initialization
  initialize: async function() {
    console.log('[KG Module] Initializing Knowledge Graph system...');
    
    // Perform schema startup check
    const schemaCheckResult = await schemaStartupCheck.performStartupCheck();
    
    if (!schemaCheckResult.success) {
      console.warn('[KG Module] Schema startup check failed, but system will continue');
    }
    
    console.log('[KG Module] Knowledge Graph system initialized');
    return schemaCheckResult;
  }
};
