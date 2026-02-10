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
    
    // Clean file type: remove dot and convert to lowercase
    let cleanFileType = fileType || '';
    if (cleanFileType.startsWith('.')) {
      cleanFileType = cleanFileType.substring(1).toLowerCase();
    }
    
    // Step 1: Parse document to CKBs
    console.log(`[KG Service] Parsing document ${docId} (type: ${cleanFileType})...`);
    const ckbs = await ckbParser.parseDocument(docId, filePath, cleanFileType);
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
    const allEntities = await entityStore.getAllEntities();
    // Filter entities by document ID
    const docEntities = allEntities.filter(entity => {
      const supportedBy = entity.supported_by || [];
      return supportedBy.some(source => source.doc_id === docId);
    });
    for (const entity of docEntities) {
      try {
        await confidenceEngine.updateEntityConfidence(entity.entity_id);
      } catch (error) {
        console.error(`[KG Service] Confidence update failed for entity ${entity.entity_id}:`, error);
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
    const allEntities = await entityStore.getAllEntities();
    // Filter entities by document ID
    const affectedEntities = allEntities.filter(entity => {
      const supportedBy = entity.supported_by || [];
      return supportedBy.some(source => source.doc_id === docId);
    });
    
    // Update confidence for affected entities
    for (const entity of affectedEntities) {
      try {
        const updateResult = await confidenceEngine.updateEntityConfidence(entity.entity_id);
        result.entities_updated += updateResult.updated || 0;
        result.entities_deleted += updateResult.deleted || 0;
        result.relations_updated += (updateResult.cascaded?.updated || 0);
      } catch (error) {
        console.error(`[KG Service] Entity update failed for ${entity.entity_id}:`, error);
        result.errors.push({ entity_id: entity.entity_id, error: error.message });
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

    // Get all documents from users.db
    const documents = await getAllDocuments();
    console.log(`[KG Service] Found ${documents.length} documents to process`);
    
    // Copy documents to knowledge-base.db for foreign key constraint
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    for (const doc of documents) {
      try {
        // Check if document already exists in knowledge-base.db
        const existingDoc = await prisma.document.findUnique({
          where: { id: doc.id }
        });
        
        if (!existingDoc) {
          // Create document in knowledge-base.db
          await prisma.document.create({
            data: {
              id: doc.id,
              title: doc.title,
              content: doc.content,
              type: doc.type,
              fileType: doc.file_type,
              metadata: JSON.stringify(doc.metadata)
            }
          });
          console.log(`[KG Service] Copied document ${doc.id} to knowledge-base.db`);
        }
      } catch (error) {
        console.error(`[KG Service] Failed to copy document ${doc.id}:`, error);
      }
    }
    
    await prisma.$disconnect();

    // Process each document
    for (const doc of documents) {
      try {
        // Get raw file type from document
        let rawFileType = doc.file_type || '';
        console.log(`Processing document ${doc.id} (raw type: ${rawFileType}, path: ${doc.file_path})`);
        
        // Process all documents regardless of file type
        // For text-based files, use parseTextFile directly
        const ckbParser = require('../ckb/ckb_parser');
        const ckbs = await ckbParser.parseTextFile(doc.id, doc.file_path, rawFileType);
        
        result.documents_processed++;
        result.total_ckbs += ckbs.length;
        console.log(`Parsed ${ckbs.length} CKBs for document ${doc.id}`);
        
        // Store CKBs in database
        const ckbStore = require('../ckb/ckb_store');
        for (const ckb of ckbs) {
          await ckbStore.saveCKB(ckb);
        }
        
        // Build entities and relations
        const fieldExtractor = require('../field_extractor/field_extractor');
        const schemaManager = require('../schema/schema_manager');
        const schemaMatcher = require('../schema/schema_matcher');
        const fieldNormalizer = require('../field_normalizer/field_normalizer');
        const entityBuilder = require('../entity/entity_builder');
        const entityStore = require('../entity/entity_store');
        const builtinRelationBuilder = require('../relation/builtin_relation_builder');
        const cooccurrenceRelationBuilder = require('../relation/cooccurrence_relation_builder');
        const semanticRelationBuilder = require('../relation/semantic_relation_builder');
        const relationStore = require('../relation/relation_store');
        const confidenceEngine = require('../confidence/confidence_engine');
        
        // Extract and normalize fields for each CKB
        for (const ckb of ckbs) {
          try {
            const rawFields = await fieldExtractor.extractFields(ckb);
            ckb.extracted_fields = rawFields;
          } catch (error) {
            console.error(`Field extraction failed for CKB ${ckb.ckb_id}:`, error);
          }
        }
        
        // Match schemas and build entities
        const schemas = await schemaManager.listSchemas({ active: true });
        const entities = [];
        
        for (const ckb of ckbs) {
          if (!ckb.extracted_fields) continue;
          
          try {
            const schemaMatches = await schemaMatcher.matchSchemas(ckb.extracted_fields, schemas);
            
            for (const match of schemaMatches) {
              if (match.completeness >= match.schema.threshold) {
                const normalizedFields = await fieldNormalizer.normalizeFields(
                  ckb.extracted_fields,
                  match.schema,
                  { llmClient }
                );
                
                const entity = await entityBuilder.buildEntity(
                  match,
                  normalizedFields,
                  ckb,
                  { llmClient }
                );
                
                if (entity) {
                  entities.push(entity);
                  await entityStore.saveEntity(entity);
                  result.total_entities++;
                }
              }
            }
          } catch (error) {
            console.error(`Entity building failed for CKB ${ckb.ckb_id}:`, error);
          }
        }
        
        // Build relations
        if (entities.length > 0) {
          // Build builtin relations
          const builtinRelations = await builtinRelationBuilder.buildBuiltinRelations(entities);
          for (const relation of builtinRelations) {
            await relationStore.createRelation(relation);
            result.total_relations++;
          }
          
          // Build cooccurrence relations
          const cooccurrenceRelations = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(ckbs);
          for (const relation of cooccurrenceRelations) {
            await relationStore.createRelation(relation);
            result.total_relations++;
          }
          
          // Build semantic relations if LLM is available
          if (llmClient && enableSemanticRelations) {
            const semanticRelations = await semanticRelationBuilder.batchExtractSemanticRelations(
              ckbs,
              llmClient
            );
            for (const relation of semanticRelations) {
              await relationStore.createRelation(relation);
              result.total_relations++;
            }
          }
        }
        
        console.log(`Built ${entities.length} entities and ${result.total_relations} relations for document ${doc.id}`);
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
      await ckbStore.deleteCKB(ckb.id);
      result.ckbs_deleted++;

      // Remove CKB from cooccurrence relations
      const cooccurrenceStats = await cooccurrenceRelationBuilder.removeCooccurrenceRelations(ckb.id);
      result.relations_deleted += cooccurrenceStats.deleted;
    }

    // Get affected entities
    const allEntities = await entityStore.getAllEntities();
    // Filter entities by document ID
    const entities = allEntities.filter(entity => {
      const supportedBy = entity.supported_by || [];
      return supportedBy.some(source => source.doc_id === docId);
    });
    
    // Update or delete entities
    for (const entity of entities) {
      const updateResult = await confidenceEngine.updateEntityConfidence(entity.entity_id);
      result.entities_deleted += updateResult.deleted || 0;
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
    const entities = await entityStore.getAllEntities();
    for (const entity of entities) {
      await entityStore.deleteEntity(entity.entity_id);
    }

    // Delete all relations
    const relations = await relationStore.getAllRelations();
    for (const relation of relations) {
      await relationStore.deleteRelation(relation.relation_id);
    }

    // Delete all CKBs
    const ckbs = await ckbStore.getAllCKBs();
    for (const ckb of ckbs) {
      await ckbStore.deleteCKB(ckb.id);
    }

    console.log(`[KG Service] Knowledge graph cleared`);
  } catch (error) {
    console.error(`[KG Service] Failed to clear knowledge graph:`, error);
    throw error;
  }
}

/**
 * Get all documents from database
 * @returns {Promise<Array>} Documents
 */
async function getAllDocuments() {
  const sqlite3 = require('sqlite3').verbose();
  const path = require('path');
  const DB_PATH = path.join(__dirname, '../../data/users.db');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
        return reject(err);
      }
    });
    
    db.all('SELECT id, title, content, type, file_type, metadata FROM documents', [], (err, rows) => {
      db.close();
      
      if (err) {
        console.error('Error fetching documents:', err.message);
        return reject(err);
      }
      
      const documents = rows.map(row => {
        const metadata = row.metadata ? JSON.parse(row.metadata) : {};
        // Clean file type: remove dot and convert to lowercase
        let cleanFileType = row.file_type || '';
        if (cleanFileType.startsWith('.')) {
          cleanFileType = cleanFileType.substring(1).toLowerCase();
        }
        return {
          id: row.id.toString(),
          title: row.title,
          content: row.content,
          type: row.type,
          file_type: cleanFileType,
          file_path: metadata.filePath || '',
          metadata: metadata
        };
      });
      
      resolve(documents);
    });
  });
}

/**
 * Get knowledge graph statistics
 * @returns {Promise<Object>} Statistics
 */
async function getKnowledgeGraphStats() {
  try {
    const entityCount = await entityStore.countEntities();
    const relationCount = await relationStore.countRelations();
    const ckbCount = await ckbStore.countCKBs();

    const stats = {
      ckb_count: ckbCount,
      entity_count: entityCount,
      relation_count: relationCount,
      entity_types: {},
      relation_types: {},
      confidence_stats: await confidenceEngine.getConfidenceStats()
    };

    // Get all entities for type counting (limit to 1000 for performance)
    const entities = await entityStore.getAllEntities({ take: 1000 });
    
    // Count entity types
    for (const entity of entities) {
      const type = entity.entity_type || 'unknown';
      stats.entity_types[type] = (stats.entity_types[type] || 0) + 1;
    }

    // Get all relations for type counting (limit to 1000 for performance)
    const relations = await relationStore.getAllRelations({ take: 1000 });
    
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
