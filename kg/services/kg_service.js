/**
 * Knowledge Graph Service
 * 
 * Main service for building and managing the knowledge graph.
 * Orchestrates the entire pipeline from CKB to entities and relations.
 * 
 * Requirements: 10.1-10.10
 */

const ckbParser = require('../ckb/ckb_parser');
const ckbStore = require('../ckb/ckb_store');
const fieldExtractor = require('../field_extractor/field_extractor');
const fieldNormalizer = require('../field_normalizer/field_normalizer');
const schemaMatcher = require('../schema/schema_matcher');
const schemaManager = require('../schema/schema_manager');
const entityBuilder = require('../entity/entity_builder');
const entityStore = require('../entity/entity_store');
const builtinRelationBuilder = require('../relation/builtin_relation_builder');
const cooccurrenceRelationBuilder = require('../relation/cooccurrence_relation_builder');
const semanticRelationBuilder = require('../relation/semantic_relation_builder');
const relationStore = require('../relation/relation_store');
const confidenceEngine = require('../confidence/confidence_engine');
const qualityFilter = require('../confidence/quality_filter');
const performanceMonitor = require('../utils/performance_monitor');
const tokenBudgetManager = require('../utils/token_budget_manager');

/**
 * Build knowledge graph from a document
 * @param {string} docId - Document ID
 * @param {string} filePath - File path
 * @param {string} fileType - File type (word, pdf, excel, etc.)
 * @param {Object} options - Build options
 * @returns {Promise<Object>} Build result
 */
async function buildKnowledgeGraph(docId, filePath, fileType, options = {}) {
  const startTime = Date.now();
  
  const {
    llmClient = null,
    enableSemanticRelations = true,
    enableQualityFilter = true
  } = options;

  const result = {
    doc_id: docId,
    ckbs_created: 0,
    entities_created: 0,
    relations_created: {
      builtin: 0,
      cooccurrence: 0,
      semantic: 0
    },
    processing_time: 0,
    errors: []
  };

  try {
    // Check document budget (estimate 5000 tokens per document)
    const budgetCheck = tokenBudgetManager.checkDocumentBudget(docId, 5000);
    if (!budgetCheck.allowed) {
      console.warn(`[KG Service] Document ${docId} may exceed budget:`, budgetCheck);
    }
    
    // Step 1: Parse document to CKBs
    console.log(`[KG Service] Parsing document ${docId}...`);
    const ckbs = await ckbParser.parseDocument(docId, filePath, fileType);
    result.ckbs_created = ckbs.length;
    console.log(`[KG Service] Created ${ckbs.length} CKBs`);

    // Step 2: Extract and normalize fields for each CKB
    console.log(`[KG Service] Extracting fields...`);
    for (const ckb of ckbs) {
      try {
        const rawFields = await fieldExtractor.extractFields(ckb);
        ckb.extracted_fields = rawFields;
      } catch (error) {
        console.error(`[KG Service] Field extraction failed for CKB ${ckb.ckb_id}:`, error);
        result.errors.push({ ckb_id: ckb.ckb_id, step: 'field_extraction', error: error.message });
      }
    }

    // Step 3: Match schemas and build entities
    console.log(`[KG Service] Matching schemas and building entities...`);
    const schemas = await schemaManager.listSchemas({ active: true });
    
    for (const ckb of ckbs) {
      if (!ckb.extracted_fields) continue;

      try {
        // Match schemas
        const schemaMatches = await schemaMatcher.matchSchemas(ckb.extracted_fields, schemas);
        
        // Build entities for schemas above threshold
        for (const match of schemaMatches) {
          if (match.completeness >= match.schema.threshold) {
            // Normalize fields
            const normalizedFields = await fieldNormalizer.normalizeFields(
              ckb.extracted_fields,
              match.schema,
              { llmClient }
            );

            // Build entity
            const entity = await entityBuilder.buildEntity(
              match.schema,
              normalizedFields,
              ckb,
              { llmClient }
            );

            if (entity) {
              result.entities_created++;
              
              // Store entity reference in CKB
              if (!ckb.entities) {
                ckb.entities = [];
              }
              ckb.entities.push(entity);
            }
          }
        }
      } catch (error) {
        console.error(`[KG Service] Entity building failed for CKB ${ckb.ckb_id}:`, error);
        result.errors.push({ ckb_id: ckb.ckb_id, step: 'entity_building', error: error.message });
      }
    }

    console.log(`[KG Service] Created ${result.entities_created} entities`);

    // Step 4: Build builtin relations
    console.log(`[KG Service] Building builtin relations...`);
    for (const ckb of ckbs) {
      if (!ckb.entities || ckb.entities.length === 0) continue;

      try {
        const builtinRelations = await builtinRelationBuilder.buildBuiltinRelations(ckb.entities);
        result.relations_created.builtin += builtinRelations.length;
      } catch (error) {
        console.error(`[KG Service] Builtin relation building failed:`, error);
        result.errors.push({ step: 'builtin_relations', error: error.message });
      }
    }

    // Step 5: Build cooccurrence relations
    console.log(`[KG Service] Building cooccurrence relations...`);
    try {
      const cooccurrenceRelations = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(ckbs);
      result.relations_created.cooccurrence = cooccurrenceRelations.length;
    } catch (error) {
      console.error(`[KG Service] Cooccurrence relation building failed:`, error);
      result.errors.push({ step: 'cooccurrence_relations', error: error.message });
    }

    // Step 6: Build semantic relations (if enabled and LLM available)
    if (enableSemanticRelations && llmClient) {
      console.log(`[KG Service] Building semantic relations...`);
      try {
        const semanticRelations = await semanticRelationBuilder.batchExtractSemanticRelations(
          ckbs,
          llmClient
        );
        result.relations_created.semantic = semanticRelations.length;
      } catch (error) {
        console.error(`[KG Service] Semantic relation building failed:`, error);
        result.errors.push({ step: 'semantic_relations', error: error.message });
      }
    }

    // Step 7: Update confidence scores
    console.log(`[KG Service] Updating confidence scores...`);
    const allEntities = await entityStore.getEntities({ doc_id: docId });
    for (const entity of allEntities) {
      try {
        await confidenceEngine.updateEntityConfidence(entity.id);
      } catch (error) {
        console.error(`[KG Service] Confidence update failed for entity ${entity.id}:`, error);
      }
    }

    // Step 8: Quality filtering (if enabled)
    if (enableQualityFilter) {
      console.log(`[KG Service] Running quality filter...`);
      try {
        await qualityFilter.filterLowQualityEntities({ dryRun: false });
        await qualityFilter.filterLowQualityRelations({ dryRun: false });
      } catch (error) {
        console.error(`[KG Service] Quality filtering failed:`, error);
        result.errors.push({ step: 'quality_filter', error: error.message });
      }
    }

    result.processing_time = Date.now() - startTime;
    console.log(`[KG Service] Knowledge graph built in ${result.processing_time}ms`);

    // Record document processing performance
    performanceMonitor.recordDocumentProcessing({
      doc_id: docId,
      total_time: result.processing_time,
      ckb_count: result.ckbs_created,
      entity_count: result.entities_created,
      relation_count: result.relations_created.builtin + result.relations_created.cooccurrence + result.relations_created.semantic,
      success: true,
      metadata: {
        file_type: fileType,
        errors_count: result.errors.length
      }
    });

    return result;
  } catch (error) {
    console.error(`[KG Service] Knowledge graph building failed:`, error);
    result.errors.push({ step: 'overall', error: error.message });
    result.processing_time = Date.now() - startTime;
    
    // Record failed document processing
    performanceMonitor.recordDocumentProcessing({
      doc_id: docId,
      total_time: result.processing_time,
      success: false,
      error: error.message
    });
    
    performanceMonitor.recordError({
      type: 'kg_build_error',
      module: 'kg_service',
      operation: 'buildKnowledgeGraph',
      message: error.message,
      doc_id: docId
    });
    
    throw error;
  }
}

/**
 * Update knowledge graph incrementally for a document
 * @param {string} docId - Document ID
 * @param {Object} options - Update options
 * @returns {Promise<Object>} Update result
 */
async function updateKnowledgeGraph(docId, options = {}) {
  const {
    llmClient = null,
    enableSemanticRelations = true
  } = options;

  const result = {
    doc_id: docId,
    ckbs_updated: 0,
    entities_updated: 0,
    entities_deleted: 0,
    relations_updated: 0,
    processing_time: 0,
    errors: []
  };

  const startTime = Date.now();

  try {
    // Get existing CKBs for this document
    const existingCkbs = await ckbStore.getCKBsByDocument(docId);
    
    // Re-extract fields and rebuild entities
    for (const ckb of existingCkbs) {
      try {
        const rawFields = await fieldExtractor.extractFields(ckb);
        ckb.extracted_fields = rawFields;
        result.ckbs_updated++;
      } catch (error) {
        console.error(`[KG Service] Field extraction failed for CKB ${ckb.ckb_id}:`, error);
        result.errors.push({ ckb_id: ckb.ckb_id, error: error.message });
      }
    }

    // Get affected entities
    const affectedEntities = await entityStore.getEntities({ doc_id: docId });
    
    // Update confidence for affected entities
    for (const entity of affectedEntities) {
      try {
        const updateResult = await confidenceEngine.updateEntityConfidence(entity.id);
        result.entities_updated += updateResult.updated;
        result.entities_deleted += updateResult.deleted;
        result.relations_updated += (updateResult.cascaded?.updated || 0);
      } catch (error) {
        console.error(`[KG Service] Entity update failed for ${entity.id}:`, error);
        result.errors.push({ entity_id: entity.id, error: error.message });
      }
    }

    result.processing_time = Date.now() - startTime;
    console.log(`[KG Service] Knowledge graph updated in ${result.processing_time}ms`);

    return result;
  } catch (error) {
    console.error(`[KG Service] Knowledge graph update failed:`, error);
    result.errors.push({ step: 'overall', error: error.message });
    result.processing_time = Date.now() - startTime;
    throw error;
  }
}

/**
 * Rebuild entire knowledge graph from scratch
 * @param {Object} options - Rebuild options
 * @returns {Promise<Object>} Rebuild result
 */
async function rebuildKnowledgeGraph(options = {}) {
  const {
    llmClient = null,
    enableSemanticRelations = true,
    enableQualityFilter = true
  } = options;

  const result = {
    documents_processed: 0,
    total_ckbs: 0,
    total_entities: 0,
    total_relations: 0,
    processing_time: 0,
    errors: []
  };

  const startTime = Date.now();

  try {
    console.log(`[KG Service] Starting full knowledge graph rebuild...`);

    // Clear existing KG data
    console.log(`[KG Service] Clearing existing knowledge graph...`);
    await clearKnowledgeGraph();

    // Get all documents
    const documents = await getAllDocuments();
    console.log(`[KG Service] Found ${documents.length} documents to process`);

    // Process each document
    for (const doc of documents) {
      try {
        const buildResult = await buildKnowledgeGraph(
          doc.id,
          doc.file_path,
          doc.file_type,
          { llmClient, enableSemanticRelations, enableQualityFilter }
        );

        result.documents_processed++;
        result.total_ckbs += buildResult.ckbs_created;
        result.total_entities += buildResult.entities_created;
        result.total_relations += 
          buildResult.relations_created.builtin +
          buildResult.relations_created.cooccurrence +
          buildResult.relations_created.semantic;

        if (buildResult.errors.length > 0) {
          result.errors.push(...buildResult.errors);
        }
      } catch (error) {
        console.error(`[KG Service] Failed to process document ${doc.id}:`, error);
        result.errors.push({ doc_id: doc.id, error: error.message });
      }
    }

    result.processing_time = Date.now() - startTime;
    console.log(`[KG Service] Knowledge graph rebuilt in ${result.processing_time}ms`);
    console.log(`[KG Service] Processed ${result.documents_processed} documents`);
    console.log(`[KG Service] Created ${result.total_entities} entities and ${result.total_relations} relations`);

    return result;
  } catch (error) {
    console.error(`[KG Service] Knowledge graph rebuild failed:`, error);
    result.errors.push({ step: 'overall', error: error.message });
    result.processing_time = Date.now() - startTime;
    throw error;
  }
}

/**
 * Delete knowledge graph data for a document
 * @param {string} docId - Document ID
 * @returns {Promise<Object>} Deletion result
 */
async function deleteKnowledgeGraph(docId) {
  const result = {
    doc_id: docId,
    ckbs_deleted: 0,
    entities_deleted: 0,
    relations_deleted: 0
  };

  try {
    // Get CKBs for this document
    const ckbs = await ckbStore.getCKBsByDocument(docId);
    
    // Delete each CKB and cascade
    for (const ckb of ckbs) {
      await ckbStore.deleteCKB(ckb.ckb_id);
      result.ckbs_deleted++;

      // Remove CKB from cooccurrence relations
      const cooccurrenceStats = await cooccurrenceRelationBuilder.removeCooccurrenceRelations(ckb.ckb_id);
      result.relations_deleted += cooccurrenceStats.deleted;
    }

    // Get affected entities
    const entities = await entityStore.getEntities({ doc_id: docId });
    
    // Update or delete entities
    for (const entity of entities) {
      const updateResult = await confidenceEngine.updateEntityConfidence(entity.id);
      result.entities_deleted += updateResult.deleted;
      result.relations_deleted += updateResult.cascaded || 0;
    }

    console.log(`[KG Service] Deleted KG data for document ${docId}`);
    return result;
  } catch (error) {
    console.error(`[KG Service] Failed to delete KG data for document ${docId}:`, error);
    throw error;
  }
}

/**
 * Clear entire knowledge graph
 * @returns {Promise<void>}
 */
async function clearKnowledgeGraph() {
  try {
    // Delete all entities (will cascade to relations)
    const entities = await entityStore.getEntities({});
    for (const entity of entities) {
      await entityStore.deleteEntity(entity.id);
    }

    // Delete all relations
    const relations = await relationStore.getRelations({});
    for (const relation of relations) {
      await relationStore.deleteRelation(relation.id);
    }

    // Delete all CKBs
    const ckbs = await ckbStore.getAllCKBs();
    for (const ckb of ckbs) {
      await ckbStore.deleteCKB(ckb.ckb_id);
    }

    console.log(`[KG Service] Knowledge graph cleared`);
  } catch (error) {
    console.error(`[KG Service] Failed to clear knowledge graph:`, error);
    throw error;
  }
}

/**
 * Get all documents (placeholder - should query document store)
 * @returns {Promise<Array>} Documents
 */
async function getAllDocuments() {
  // This should query the actual document store
  // For now, return empty array
  return [];
}

/**
 * Get knowledge graph statistics
 * @returns {Promise<Object>} Statistics
 */
async function getKnowledgeGraphStats() {
  try {
    const entities = await entityStore.getAllEntities({});
    const relations = await relationStore.getAllRelations({});
    const ckbs = await ckbStore.getAllCKBs();

    const stats = {
      ckb_count: ckbs.length,
      entity_count: entities.length,
      relation_count: relations.length,
      entity_types: {},
      relation_types: {},
      confidence_stats: await confidenceEngine.getConfidenceStats()
    };

    // Count entity types
    for (const entity of entities) {
      const type = entity.entity_type || 'unknown';
      stats.entity_types[type] = (stats.entity_types[type] || 0) + 1;
    }

    // Count relation types
    for (const relation of relations) {
      const type = relation.type || 'unknown';
      stats.relation_types[type] = (stats.relation_types[type] || 0) + 1;
    }

    return stats;
  } catch (error) {
    console.error(`[KG Service] Failed to get statistics:`, error);
    throw error;
  }
}

module.exports = {
  buildKnowledgeGraph,
  updateKnowledgeGraph,
  rebuildKnowledgeGraph,
  deleteKnowledgeGraph,
  clearKnowledgeGraph,
  getKnowledgeGraphStats
};
