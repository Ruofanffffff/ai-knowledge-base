/**
 * Knowledge Graph Module Entry Point
 * 
 * This module implements a Schema-driven knowledge graph system with:
 * - CKB (Contextual Knowledge Block) layer
 * - Schema & Rule layer
 * - KG (Knowledge Graph) layer
 * - Reasoning/Application layer
 */

// 尝试加载各个模块，处理模块加载失败的情况
let ckbParser;
let ckbStore;
let fieldExtractor;
let schemaManager;
let schemaMatcher;
let schemaStartupCheck;
let entityBuilder;
let entityStore;
let builtinRelationBuilder;
let cooccurrenceRelationBuilder;
let semanticRelationBuilder;
let relationStore;
let confidenceEngine;
let qualityFilter;
let kgService;
let graphTraversal;
let tokenTracker;
let llmCache;
let performanceMonitor;
let tokenBudgetManager;
let documentProcessor;
let UniversalDocumentPipeline;

try {
  ckbParser = require('./ckb/ckb_parser');
} catch (error) {
  console.warn('CKB Parser module not available:', error.message);
  ckbParser = null;
}

try {
  ckbStore = require('./ckb/ckb_store');
} catch (error) {
  console.warn('CKB Store module not available:', error.message);
  ckbStore = null;
}

try {
  fieldExtractor = require('./field_extractor/field_extractor');
} catch (error) {
  console.warn('Field Extractor module not available:', error.message);
  fieldExtractor = null;
}

try {
  schemaManager = require('./schema/schema_manager');
} catch (error) {
  console.warn('Schema Manager module not available:', error.message);
  schemaManager = null;
}

try {
  schemaMatcher = require('./schema/schema_matcher');
} catch (error) {
  console.warn('Schema Matcher module not available:', error.message);
  schemaMatcher = null;
}

try {
  schemaStartupCheck = require('./schema/schema_startup_check');
} catch (error) {
  console.warn('Schema Startup Check module not available:', error.message);
  schemaStartupCheck = null;
}

try {
  entityBuilder = require('./entity/entity_builder');
} catch (error) {
  console.warn('Entity Builder module not available:', error.message);
  entityBuilder = null;
}

try {
  entityStore = require('./entity/entity_store');
} catch (error) {
  console.warn('Entity Store module not available:', error.message);
  entityStore = null;
}

try {
  builtinRelationBuilder = require('./relation/builtin_relation_builder');
} catch (error) {
  console.warn('Builtin Relation Builder module not available:', error.message);
  builtinRelationBuilder = null;
}

try {
  cooccurrenceRelationBuilder = require('./relation/cooccurrence_relation_builder');
} catch (error) {
  console.warn('Cooccurrence Relation Builder module not available:', error.message);
  cooccurrenceRelationBuilder = null;
}

try {
  semanticRelationBuilder = require('./relation/semantic_relation_builder');
} catch (error) {
  console.warn('Semantic Relation Builder module not available:', error.message);
  semanticRelationBuilder = null;
}

try {
  relationStore = require('./relation/relation_store');
} catch (error) {
  console.warn('Relation Store module not available:', error.message);
  relationStore = null;
}

try {
  confidenceEngine = require('./confidence/confidence_engine');
} catch (error) {
  console.warn('Confidence Engine module not available:', error.message);
  confidenceEngine = null;
}

try {
  qualityFilter = require('./confidence/quality_filter');
} catch (error) {
  console.warn('Quality Filter module not available:', error.message);
  qualityFilter = null;
}

try {
  kgService = require('./services/kg_service');
} catch (error) {
  console.warn('KG Service module not available:', error.message);
  kgService = null;
}

try {
  graphTraversal = require('./services/graph_traversal');
} catch (error) {
  console.warn('Graph Traversal module not available:', error.message);
  graphTraversal = null;
}

try {
  tokenTracker = require('./utils/token_tracker');
} catch (error) {
  console.warn('Token Tracker module not available:', error.message);
  tokenTracker = null;
}

try {
  llmCache = require('./utils/llm_cache');
} catch (error) {
  console.warn('LLM Cache module not available:', error.message);
  llmCache = null;
}

try {
  performanceMonitor = require('./utils/performance_monitor');
} catch (error) {
  console.warn('Performance Monitor module not available:', error.message);
  performanceMonitor = null;
}

try {
  tokenBudgetManager = require('./utils/token_budget_manager');
} catch (error) {
  console.warn('Token Budget Manager module not available:', error.message);
  tokenBudgetManager = null;
}

try {
  documentProcessor = require('./document_processor');
} catch (error) {
  console.warn('Document Processor module not available:', error.message);
  documentProcessor = null;
}

try {
  const pipelineModule = require('./pipeline/universal_document_pipeline');
  UniversalDocumentPipeline = pipelineModule.UniversalDocumentPipeline;
} catch (error) {
  console.warn('Universal Document Pipeline module not available:', error.message);
  UniversalDocumentPipeline = null;
}

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
  processDocumentWithFullProcessing: documentProcessor ? documentProcessor.processDocumentWithFullProcessing : null,
  
  // Universal Document Pipeline
  UniversalDocumentPipeline,
  
  // Startup initialization
  initialize: async function() {
    console.log('[KG Module] Initializing Knowledge Graph system...');
    
    // Perform schema startup check
    let schemaCheckResult = { success: true };
    if (schemaStartupCheck) {
      try {
        schemaCheckResult = await schemaStartupCheck.performStartupCheck();
      } catch (error) {
        console.warn('Schema startup check failed:', error.message);
        schemaCheckResult = { success: false };
      }
    } else {
      console.warn('Schema Startup Check not available, skipping initialization');
    }
    
    if (!schemaCheckResult.success) {
      console.warn('[KG Module] Schema startup check failed, but system will continue');
    }
    
    console.log('[KG Module] Knowledge Graph system initialized');
    return schemaCheckResult;
  }
};
