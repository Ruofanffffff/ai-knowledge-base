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
const { DocumentClassifier } = require('./document_classifier');
const SchemaAwareExtractor = require('../field_extractor/schema_aware_extractor');
const LLMFieldExtractor = require('../field_extractor/llm_extractor');

// LLM Preprocessing modules
const { IndexGenerator } = require('../preprocessing/index_generator');
const { CKBDescriptionGenerator } = require('../preprocessing/ckb_description_generator');
const { FieldExtractionValidator } = require('../preprocessing/field_extraction_validator');
const { SchemaSelectionValidator } = require('../preprocessing/schema_selection_validator');
const { EntityMergeValidator } = require('../preprocessing/entity_merge_validator');
const { RelationExtractionValidator } = require('../preprocessing/relation_extraction_validator');
const { KGConsistencyChecker } = require('../preprocessing/kg_consistency_checker');
const CorrectionStatsCollector = require('../preprocessing/correction_stats_collector');

// LLM Post-Processing modules (Req 16)
const LLMPostProcessor = require('../post_processor/llm_post_processor');
const CleanedEntityStore = require('../post_processor/cleaned_entity_store');

/**
 * 标点符号归一化函数
 * 将中文标点统一为对应的 ASCII 标点，用于 Phase 1 去重时的名称比较。
 * 注意：双破折号（——）替换必须在单破折号（—）之前，避免部分匹配。
 * @param {string} name - 原始名称
 * @returns {string} 归一化后的名称
 */
function normalizePunctuation(name) {
  if (!name) return '';
  return name
    .replace(/：/g, ':')
    .replace(/——/g, '-')
    .replace(/—/g, '-')
    .replace(/；/g, ';')
    .replace(/，/g, ',')
    .replace(/。/g, '.');
}

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
    
    // Step 0: LLM Document Index Preprocessing (if enabled)
    let documentIndex = null;
    let statsCollector = null;
    const enablePreprocessing = process.env.ENABLE_LLM_PREPROCESSING === 'true' && llmClient;
    
    if (enablePreprocessing) {
      console.log(`[KG Service] Starting LLM document index preprocessing...`);
      const preprocessingStartTime = Date.now();
      
      try {
        // Initialize stats collector
        statsCollector = new CorrectionStatsCollector();
        
        // Read document content
        const fs = require('fs').promises;
        let documentText = '';
        
        try {
          documentText = await fs.readFile(filePath, 'utf-8');
        } catch (error) {
          console.warn(`[KG Service] Failed to read document file, will use CKB content:`, error.message);
        }
        
        // Generate document index
        const indexGenerator = new IndexGenerator();
        // generateIndexedText returns documentIndex object directly, throws on error
        documentIndex = await indexGenerator.generateIndexedText(
          docId,
          documentText,
          llmClient,
          {
            timeout: parseInt(process.env.LLM_PREPROCESSING_TIMEOUT || '60000'),
            temperature: parseFloat(process.env.LLM_PREPROCESSING_TEMPERATURE || '0.1')
          }
        );
        
        const preprocessingDuration = Date.now() - preprocessingStartTime;
        console.log(`[KG Service] Document index generated in ${preprocessingDuration}ms`);
        console.log(`[KG Service] Index contains ${documentIndex.metadata?.fact_count || 0} facts`);
        
        result.preprocessing = {
          enabled: true,
          success: true,
          duration_ms: preprocessingDuration,
          fact_count: documentIndex.metadata?.fact_count || 0
        };
      } catch (error) {
        console.error(`[KG Service] LLM preprocessing failed:`, error);
        result.errors.push({ step: 'preprocessing', error: error.message });
        result.preprocessing = {
          enabled: true,
          success: false,
          error: error.message
        };
        // Continue with original flow
      }
    } else {
      console.log(`[KG Service] LLM preprocessing disabled or no LLM client provided`);
      result.preprocessing = {
        enabled: false
      };
    }
    
    // Step 1: Parse document to CKBs
    console.log(`[KG Service] Parsing document ${docId} (type: ${cleanFileType})...`);
    const ckbs = await ckbParser.parseDocument(docId, filePath, cleanFileType);
    result.ckbs_created = ckbs.length;
    console.log(`[KG Service] Created ${ckbs.length} CKBs`);
    
    // Save CKBs to database (batch save for performance)
    const ckbStore = require('../ckb/ckb_store');
    try {
      await ckbStore.saveCKBs(ckbs);
      console.log(`[KG Service] Saved ${ckbs.length} CKBs to database`);
    } catch (error) {
      console.error(`[KG Service] Failed to save CKBs:`, error);
      // Continue processing even if save fails
    }
    
    // Step 1.5: CKB Description Generation (if preprocessing enabled)
    if (enablePreprocessing && documentIndex) {
      console.log(`[KG Service] Generating CKB descriptions from index...`);
      const ckbGenStartTime = Date.now();
      
      try {
        const ckbGenerator = new CKBDescriptionGenerator();
        // generateCKBDescriptions returns CKB array directly, throws on error
        const generatedCKBs = await ckbGenerator.generateCKBDescriptions(
          documentIndex.indexed_text,
          docId,
          llmClient,
          {
            timeout: parseInt(process.env.LLM_PREPROCESSING_TIMEOUT || '60000')
          }
        );
        
        if (generatedCKBs && generatedCKBs.length > 0) {
          const ckbGenDuration = Date.now() - ckbGenStartTime;
          console.log(`[KG Service] Generated ${generatedCKBs.length} CKB descriptions in ${ckbGenDuration}ms`);
          
          // Replace original CKBs with LLM-generated ones (core design: CKB from index, not raw text)
          const originalCKBCount = ckbs.length;
          ckbs = generatedCKBs;
          
          // Save generated CKBs to database
          try {
            await ckbStore.saveCKBs(ckbs);
            console.log(`[KG Service] Saved ${ckbs.length} LLM-generated CKBs to database`);
          } catch (saveError) {
            console.error(`[KG Service] Failed to save generated CKBs:`, saveError);
          }
          
          // Record correction stats
          if (statsCollector) {
            statsCollector.recordCorrection('ckb_generation', {
              doc_id: docId,
              original_count: originalCKBCount,
              generated_count: generatedCKBs.length,
              duration_ms: ckbGenDuration
            });
          }
          
          result.preprocessing.ckb_generation = {
            success: true,
            duration_ms: ckbGenDuration,
            original_count: originalCKBCount,
            generated_count: generatedCKBs.length
          };
        } else {
          console.warn(`[KG Service] CKB description generation returned empty, keeping original CKBs`);
        }
      } catch (error) {
        console.error(`[KG Service] CKB description generation error, keeping original CKBs:`, error);
        result.errors.push({ step: 'ckb_generation', error: error.message });
      }
    }

    // Step 1.5: Document Classification and Schema Activation
    console.log(`[KG Service] Classifying document...`);
    const classifier = new DocumentClassifier();
    
    // Use first few CKBs for classification (sample)
    const sampleText = ckbs.slice(0, Math.min(5, ckbs.length))
      .map(ckb => ckb.content?.text || '')
      .join('\n');
    
    const classification = classifier.classifyDocument(sampleText, { returnScores: true });
    console.log(`[KG Service] Document classified as: ${classification.documentType} (confidence: ${classification.confidence.toFixed(2)})`);
    console.log(`[KG Service] Matched keywords: ${classification.matchedKeywords.join(', ')}`);
    console.log(`[KG Service] Activating entity types: ${classification.entityTypes.join(', ')}`);
    
    // Record classification in result
    result.classification = {
      documentType: classification.documentType,
      confidence: classification.confidence,
      entityTypes: classification.entityTypes,
      matchedKeywords: classification.matchedKeywords
    };

    // Load schemas early for schema-aware extraction
    const allSchemas = await schemaManager.listSchemas({ active: true, take: 1000 });
    console.log(`[KG Service] Loaded ${allSchemas.length} total schemas`);
    
    // Filter schemas using document classifier
    const schemas = classifier.getRelevantSchemas(sampleText, allSchemas);
    
    console.log(`[KG Service] Filtered to ${schemas.length} relevant schemas (from ${allSchemas.length} total)`);
    console.log(`[KG Service] Schema types: ${[...new Set(schemas.map(s => s.entityType))].join(', ')}`);
    console.log(`[KG Service] Schema scenes: ${[...new Set(schemas.map(s => s.scene).filter(Boolean))].join(', ')}`);

    // Step 2: Schema-aware field extraction (PARALLEL PROCESSING)
    console.log(`[KG Service] Extracting fields (schema-aware)...`);
    const schemaAwareExtractor = new SchemaAwareExtractor();
    const ckbsNeedingLLM = [];  // Collect CKBs that need LLM enhancement
    
    const fieldExtractionBatchSize = 20; // Process 20 CKBs at a time
    for (let i = 0; i < ckbs.length; i += fieldExtractionBatchSize) {
      const batch = ckbs.slice(i, i + fieldExtractionBatchSize);
      
      await Promise.all(
        batch.map(async (ckb) => {
          try {
            // Use schema-aware extraction
            // Pass enableLLM=true to mark missing fields, but don't provide llmClient yet
            const rawFields = await schemaAwareExtractor.extractFields(
              ckb,
              schemas,
              { 
                enableLLM: process.env.ENABLE_LLM_FIELD_EXTRACTION === 'true',
                llmClient: null  // Don't call LLM yet, just mark missing fields
              }
            );
            ckb.extracted_fields = rawFields;
            
            // Check if this CKB needs LLM enhancement
            if (ckb._missingCriticalFields && ckb._missingCriticalFields.length > 0) {
              ckbsNeedingLLM.push({
                ckb,
                missingFields: ckb._missingCriticalFields
              });
            }
          } catch (error) {
            console.error(`[KG Service] Field extraction failed for CKB ${ckb.ckb_id}:`, error);
            result.errors.push({ ckb_id: ckb.ckb_id, step: 'field_extraction', error: error.message });
          }
        })
      );
      
      console.log(`[KG Service] Field extraction batch ${Math.floor(i / fieldExtractionBatchSize) + 1}/${Math.ceil(ckbs.length / fieldExtractionBatchSize)} completed`);
    }
    
    // Log extraction statistics
    if (ckbs.length > 0 && ckbs[0].extracted_fields) {
      const stats = schemaAwareExtractor.getExtractionStats(ckbs[0].extracted_fields);
      console.log(`[KG Service] Extraction stats (sample): ${JSON.stringify(stats)}`);
    }
    
    // Log LLM needs
    if (ckbsNeedingLLM.length > 0) {
      console.log(`[KG Service] ${ckbsNeedingLLM.length} CKBs need LLM enhancement (${(ckbsNeedingLLM.length / ckbs.length * 100).toFixed(1)}%)`);
    }
    
    // Step 2.4: Field Extraction Validation (if preprocessing enabled)
    if (enablePreprocessing && documentIndex) {
      console.log(`[KG Service] Validating field extraction completeness...`);
      const fieldValidationStartTime = Date.now();
      
      try {
        const fieldValidator = new FieldExtractionValidator();
        let totalMissingFields = 0;
        let totalSupplementedFields = 0;
        
        // Validate fields for each CKB
        for (const ckb of ckbs) {
          if (!ckb.extracted_fields) continue;
          
          try {
            // validateFields returns {isValid, coverageRate, missingFields}
            const validationResult = await fieldValidator.validateFields(
              ckb.extracted_fields,
              documentIndex.indexed_text,
              ckb,
              llmClient
            );
            
            totalMissingFields += validationResult.missingFields?.length || 0;
            
            // Supplement missing fields if any
            if (validationResult.missingFields && validationResult.missingFields.length > 0) {
              try {
                const supplementedFields = await fieldValidator.supplementFields(
                  validationResult.missingFields,
                  ckb,
                  llmClient
                );
                
                if (supplementedFields && supplementedFields.length > 0) {
                  ckb.extracted_fields.push(...supplementedFields);
                  totalSupplementedFields += supplementedFields.length;
                }
              } catch (suppError) {
                console.error(`[KG Service] Field supplementation failed for CKB ${ckb.ckb_id}:`, suppError);
              }
            }
            
            // Record correction stats
            if (statsCollector) {
              statsCollector.recordCorrection('field_extraction', {
                ckb_id: ckb.ckb_id,
                coverage_rate: validationResult.coverageRate,
                missing_count: validationResult.missingFields?.length || 0,
                supplemented_count: totalSupplementedFields
              });
            }
          } catch (error) {
            console.error(`[KG Service] Field validation failed for CKB ${ckb.ckb_id}:`, error);
          }
        }
        
        const fieldValidationDuration = Date.now() - fieldValidationStartTime;
        console.log(`[KG Service] Field validation completed in ${fieldValidationDuration}ms`);
        console.log(`[KG Service] Found ${totalMissingFields} missing fields, supplemented ${totalSupplementedFields}`);
        
        result.preprocessing.field_validation = {
          success: true,
          duration_ms: fieldValidationDuration,
          missing_fields: totalMissingFields,
          supplemented_fields: totalSupplementedFields
        };
      } catch (error) {
        console.error(`[KG Service] Field validation error:`, error);
        result.errors.push({ step: 'field_validation', error: error.message });
      }
    }
    
    // Step 2.5: LLM batch enhancement
    const enableLLM = process.env.ENABLE_LLM_FIELD_EXTRACTION === 'true' && llmClient && ckbsNeedingLLM.length > 0;
    
    if (enableLLM) {
      console.log(`[KG Service] Starting LLM batch enhancement for ${ckbsNeedingLLM.length} CKBs...`);
      const llmStartTime = Date.now();
      
      try {
        const llmExtractor = new LLMFieldExtractor();
        const llmResults = await llmExtractor.batchExtractMissingFields(ckbsNeedingLLM, llmClient);
        
        // Merge LLM results back to CKBs
        llmResults.forEach((llmFields, ckbId) => {
          const ckb = ckbs.find(c => c.ckb_id === ckbId);
          if (ckb && ckb.extracted_fields) {
            // Add LLM fields to extracted_fields
            llmFields.forEach(llmField => {
              // Check if field already exists
              const existing = ckb.extracted_fields.find(f => f.name === llmField.name);
              if (!existing) {
                ckb.extracted_fields.push(llmField);
              } else {
                // Update existing field if LLM has higher confidence
                if (llmField.confidence > (existing.confidence || 0)) {
                  existing.value = llmField.value;
                  existing.confidence = llmField.confidence;
                  if (!existing.sources.includes('llm')) {
                    existing.sources.push('llm');
                  }
                }
              }
            });
          }
        });
        
        const llmDuration = Date.now() - llmStartTime;
        const llmStats = llmExtractor.getStats(llmResults);
        
        console.log(`[KG Service] LLM enhancement completed in ${llmDuration}ms`);
        console.log(`[KG Service] LLM stats:`, JSON.stringify(llmStats));
        
        // Record LLM usage in result
        result.llm_enhancement = {
          ckbs_processed: llmStats.ckbsProcessed,
          fields_extracted: llmStats.totalFields,
          duration_ms: llmDuration
        };
      } catch (error) {
        console.error(`[KG Service] LLM enhancement failed:`, error.message);
        result.errors.push({ step: 'llm_enhancement', error: error.message });
        // Continue with rule+NER results
      }
    } else {
      if (!llmClient) {
        console.log(`[KG Service] Skipping LLM enhancement (no LLM client provided)`);
      } else if (process.env.ENABLE_LLM_FIELD_EXTRACTION !== 'true') {
        console.log(`[KG Service] Skipping LLM enhancement (disabled in config)`);
      } else {
        console.log(`[KG Service] Skipping LLM enhancement (no CKBs need enhancement)`);
      }
    }

    // Step 3: Match schemas and build entities (PARALLEL PROCESSING)
    console.log(`[KG Service] Matching schemas and building entities...`);
    
    // Pre-filter schemas to reduce matching overhead (only if we have many schemas)
    let relevantSchemas = schemas;
    if (schemas.length > 50) {
      console.log(`[KG Service] Pre-filtering schemas based on document classification...`);
      relevantSchemas = schemas.filter(schema => {
        // Keep schemas that match the document's entity types or scenes
        return classification.entityTypes.includes(schema.entityType) ||
               (schema.scene && classification.matchedKeywords.some(kw => 
                 schema.scene.toLowerCase().includes(kw.toLowerCase())
               ));
      });
      
      // If filtering is too aggressive, keep all schemas
      if (relevantSchemas.length === 0) {
        console.log(`[KG Service] Pre-filtering too aggressive, keeping all schemas`);
        relevantSchemas = schemas;
      } else {
        console.log(`[KG Service] Filtered from ${schemas.length} to ${relevantSchemas.length} relevant schemas (${((relevantSchemas.length / schemas.length) * 100).toFixed(1)}%)`);
      }
    }
    
    const allEntities = []; // Collect all entities for batch save
    
    // Process CKBs in parallel batches
    const batchSize = 10; // Process 10 CKBs at a time
    for (let i = 0; i < ckbs.length; i += batchSize) {
      const batch = ckbs.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (ckb) => {
        if (!ckb.extracted_fields) return [];

        try {
          // Match schemas (using pre-filtered relevant schemas)
          const schemaMatches = await schemaMatcher.matchSchemas(ckb.extracted_fields, relevantSchemas);
          
          // Step 3.5: Schema Selection Validation (if preprocessing enabled)
          if (enablePreprocessing && documentIndex) {
            const schemaValidator = new SchemaSelectionValidator();
            
            for (const match of schemaMatches) {
              try {
                // validateSchemaSelection returns {isAppropriate, confidence, reason}
                const validationResult = await schemaValidator.validateSchemaSelection(
                  match,
                  documentIndex.indexed_text,
                  llmClient
                );
                
                // Update match confidence based on validation
                if (validationResult.isAppropriate !== undefined) {
                  const originalCompleteness = match.completeness;
                  
                  if (validationResult.isAppropriate) {
                    // Boost confidence if validated as appropriate
                    match.completeness = Math.min(1.0, match.completeness + 0.1);
                  } else {
                    // Reduce confidence if not appropriate
                    match.completeness = Math.max(0, match.completeness - 0.2);
                  }
                  
                  // Record correction stats
                  if (statsCollector) {
                    statsCollector.recordCorrection('schema_selection', {
                      ckb_id: ckb.ckb_id,
                      schema_name: match.schema.name,
                      original_confidence: originalCompleteness,
                      adjusted_confidence: match.completeness,
                      is_appropriate: validationResult.isAppropriate
                    });
                  }
                }
              } catch (error) {
                console.error(`[KG Service] Schema validation failed for match:`, error);
              }
            }
          }
          
          const ckbEntities = [];
          
          // Build entities for schemas above threshold
          for (const match of schemaMatches) {
            if (match.completeness >= match.schema.threshold) {
              // Normalize fields
              const normalizedFields = await fieldNormalizer.normalizeFields(
                ckb.extracted_fields,
                match.schema,
                { llmClient }
              );

              // Build entity - pass the entire match object (schemaScore)
              const entity = await entityBuilder.buildEntity(
                match,  // Pass the entire schemaScore object, not just match.schema
                normalizedFields,
                ckb,
                { llmClient }
              );

              if (entity) {
                ckbEntities.push(entity);
                
                // Store entity reference in CKB
                if (!ckb.entities) {
                  ckb.entities = [];
                }
                ckb.entities.push(entity);
              }
            }
          }
          
          return ckbEntities;
        } catch (error) {
          console.error(`[KG Service] Entity building failed for CKB ${ckb.ckb_id}:`, error);
          result.errors.push({ ckb_id: ckb.ckb_id, step: 'entity_building', error: error.message });
          return [];
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      
      // Flatten and collect entities
      for (const entities of batchResults) {
        allEntities.push(...entities);
        result.entities_created += entities.length;
      }
      
      console.log(`[KG Service] Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(ckbs.length / batchSize)}, entities: ${result.entities_created}`);
    }

    // Step 3.5: Entity deduplication — merge similar entities before saving
    console.log(`[KG Service] Deduplicating ${allEntities.length} entities...`);
    let deduplicatedEntities = allEntities;
    
    if (allEntities.length > 1) {
      // Phase 1: Simple rule-based dedup (normalized name match, regardless of type)
      // Uses normalizePunctuation so that names differing only in punctuation are merged.
      // Same normalized name = same entity, keep the one with highest confidence.
      const entityMap = new Map(); // key: normalized canonical_name -> entity
      const mergedEntities = [];
      
      for (const entity of allEntities) {
        const key = normalizePunctuation(entity.canonical_name);
        
        if (entityMap.has(key)) {
          // Merge into existing entity
          const existing = entityMap.get(key);
          
          // Add original name variant to aliases if different from existing canonical_name
          if (entity.canonical_name !== existing.canonical_name) {
            existing.aliases = [...new Set([...(existing.aliases || []), entity.canonical_name])];
          }
          
          // Merge supported_by CKBs
          if (entity.supported_by) {
            existing.supported_by = [...new Set([...(existing.supported_by || []), ...entity.supported_by])];
          }
          // Keep higher confidence — swap canonical_name to the higher-confidence variant
          if (entity.confidence > existing.confidence) {
            // Preserve the old canonical_name as an alias before replacing
            existing.aliases = [...new Set([...(existing.aliases || []), existing.canonical_name])];
            existing.canonical_name = entity.canonical_name;
            existing.confidence = entity.confidence;
          }
          // Merge aliases
          if (entity.aliases) {
            existing.aliases = [...new Set([...(existing.aliases || []), ...entity.aliases])];
          }
          // Merge schemas
          if (entity.schemas) {
            const existingSchemaNames = new Set((existing.schemas || []).map(s => s.schema_name));
            for (const schema of entity.schemas) {
              if (!existingSchemaNames.has(schema.schema_name)) {
                existing.schemas.push(schema);
              }
            }
          }
        } else {
          entityMap.set(key, { ...entity });
          mergedEntities.push(entityMap.get(key));
        }
      }
      
      const simpleDeduped = mergedEntities.length;
      console.log(`[KG Service] Simple dedup: ${allEntities.length} → ${simpleDeduped} (removed ${allEntities.length - simpleDeduped} exact duplicates)`);
      
      // Phase 2: LLM-based disambiguation for similar (but not exact) matches
      try {
        const conflictResult = await entityBuilder.resolveEntityConflicts(mergedEntities, {
          similarityThreshold: 0.8,
          useLLM: !!llmClient,
          llmClient
        });
        
        deduplicatedEntities = conflictResult.resolvedEntities;
        const llmDeduped = mergedEntities.length - deduplicatedEntities.length;
        
        if (llmDeduped > 0) {
          console.log(`[KG Service] LLM dedup: ${mergedEntities.length} → ${deduplicatedEntities.length} (merged ${llmDeduped} similar entities)`);
        }
      } catch (error) {
        console.error(`[KG Service] LLM deduplication failed, using simple dedup results:`, error.message);
        deduplicatedEntities = mergedEntities;
      }
      
      // Update entity references in CKBs
      const entityIdMap = new Map();
      for (const entity of allEntities) {
        const key = normalizePunctuation(entity.canonical_name);
        const canonical = entityMap.get(key);
        if (canonical && canonical.entity_id !== entity.entity_id) {
          entityIdMap.set(entity.entity_id, canonical.entity_id);
        }
      }
      
      for (const ckb of ckbs) {
        if (ckb.entities) {
          ckb.entities = ckb.entities.map(e => {
            const canonicalId = entityIdMap.get(e.entity_id);
            if (canonicalId) {
              return deduplicatedEntities.find(de => de.entity_id === canonicalId) || e;
            }
            return e;
          }).filter((e, i, arr) => arr.findIndex(x => x.entity_id === e.entity_id) === i);
        }
      }
      
      result.entities_created = deduplicatedEntities.length;
      console.log(`[KG Service] Final entity count: ${deduplicatedEntities.length} (from ${allEntities.length} raw)`);
    }

    // Batch save all entities
    if (deduplicatedEntities.length > 0) {
      try {
        await entityStore.saveEntities(deduplicatedEntities);
        console.log(`[KG Service] Saved ${deduplicatedEntities.length} entities to database`);
      } catch (error) {
        console.error(`[KG Service] Failed to batch save entities:`, error);
        // Fallback to individual saves
        for (const entity of deduplicatedEntities) {
          try {
            await entityStore.saveEntity(entity);
          } catch (err) {
            console.error(`[KG Service] Failed to save entity ${entity.entity_id}:`, err);
          }
        }
      }
    }

    console.log(`[KG Service] Created ${result.entities_created} entities (after deduplication)`);

    // Collect all relations for LLM post-processing (Req 16.1)
    const allRelationsForPostProcessing = [];

    // Step 4: Build builtin relations (PARALLEL + BATCH SAVE)
    console.log(`[KG Service] Building builtin relations...`);
    const allBuiltinRelations = []; // Collect for batch save
    
    // 🆕 并行构建关系而不是串行
    const builtinRelationPromises = ckbs
      .filter(ckb => ckb.entities && ckb.entities.length > 0)
      .map(async (ckb) => {
        try {
          const builtinRelations = await builtinRelationBuilder.buildBuiltinRelations(ckb.entities);
          return builtinRelations;
        } catch (error) {
          console.error(`[KG Service] Builtin relation building failed for CKB ${ckb.ckb_id}:`, error);
          result.errors.push({ ckb_id: ckb.ckb_id, step: 'builtin_relations', error: error.message });
          return [];
        }
      });
    
    const builtinRelationResults = await Promise.all(builtinRelationPromises);
    
    // 合并所有关系
    for (const relations of builtinRelationResults) {
      allBuiltinRelations.push(...relations);
      result.relations_created.builtin += relations.length;
    }
    
    // Batch save builtin relations (NEW: Use batch method if available)
    if (allBuiltinRelations.length > 0) {
      try {
        // Check if batch method exists
        if (typeof relationStore.createRelations === 'function') {
          await relationStore.createRelations(allBuiltinRelations);
        } else {
          // Fallback to individual saves
          await Promise.all(
            allBuiltinRelations.map(relation => relationStore.createRelation(relation))
          );
        }
        console.log(`[KG Service] Saved ${allBuiltinRelations.length} builtin relations`);
      } catch (error) {
        console.error(`[KG Service] Failed to batch save builtin relations:`, error);
        // Fallback to individual saves
        for (const relation of allBuiltinRelations) {
          try {
            await relationStore.createRelation(relation);
          } catch (err) {
            console.error(`[KG Service] Failed to save builtin relation:`, err);
          }
        }
      }
      // Collect for post-processing
      allRelationsForPostProcessing.push(...allBuiltinRelations);
    }

    // Step 5: Build cooccurrence relations (BATCH SAVE)
    console.log(`[KG Service] Building cooccurrence relations...`);
    try {
      const cooccurrenceRelations = await cooccurrenceRelationBuilder.buildCooccurrenceRelations(ckbs);
      result.relations_created.cooccurrence = cooccurrenceRelations.length;
      
      // Batch save relations to database
      if (cooccurrenceRelations.length > 0) {
        try {
          // Check if batch method exists
          if (typeof relationStore.createRelations === 'function') {
            await relationStore.createRelations(cooccurrenceRelations);
          } else {
            // Fallback to parallel individual saves
            await Promise.all(
              cooccurrenceRelations.map(relation => relationStore.createRelation(relation))
            );
          }
          console.log(`[KG Service] Saved ${cooccurrenceRelations.length} cooccurrence relations`);
        } catch (error) {
          console.error(`[KG Service] Failed to batch save cooccurrence relations:`, error);
          // Fallback to individual saves
          for (const relation of cooccurrenceRelations) {
            try {
              await relationStore.createRelation(relation);
            } catch (err) {
              console.error(`[KG Service] Failed to save cooccurrence relation:`, err);
            }
          }
        }
      }
      // Collect for post-processing
      allRelationsForPostProcessing.push(...cooccurrenceRelations);
    } catch (error) {
      console.error(`[KG Service] Cooccurrence relation building failed:`, error);
      result.errors.push({ step: 'cooccurrence_relations', error: error.message });
    }

    // Step 6: Build semantic relations (if enabled and LLM available) (BATCH SAVE)
    if (enableSemanticRelations && llmClient) {
      console.log(`[KG Service] Building semantic relations...`);
      try {
        const semanticRelations = await semanticRelationBuilder.batchExtractSemanticRelations(
          ckbs,
          llmClient
        );
        result.relations_created.semantic = semanticRelations.length;
        
        // Step 6.5: Relation Extraction Validation (if preprocessing enabled)
        if (enablePreprocessing && documentIndex) {
          console.log(`[KG Service] Validating relation extraction completeness...`);
          const relationValidationStartTime = Date.now();
          
          try {
            const relationValidator = new RelationExtractionValidator();
            
            // Collect all entities for validation
            const allEntitiesForValidation = ckbs
              .filter(ckb => ckb.entities && ckb.entities.length > 0)
              .flatMap(ckb => ckb.entities);
            
            // validateRelations returns {isValid, coverageRate, missingRelations}
            const validationResult = await relationValidator.validateRelations(
              semanticRelations,
              documentIndex.indexed_text,
              allEntitiesForValidation,
              llmClient
            );
            
            console.log(`[KG Service] Relation coverage: ${(validationResult.coverageRate * 100).toFixed(1)}%`);
            
            let supplementedCount = 0;
            
            // Supplement missing relations if any
            if (validationResult.missingRelations && validationResult.missingRelations.length > 0) {
              console.log(`[KG Service] Found ${validationResult.missingRelations.length} missing relations, supplementing...`);
              
              // supplementRelations returns array directly
              const supplementedRelations = await relationValidator.supplementRelations(
                validationResult.missingRelations,
                allEntitiesForValidation,
                llmClient
              );
              
              if (supplementedRelations && supplementedRelations.length > 0) {
                semanticRelations.push(...supplementedRelations);
                result.relations_created.semantic += supplementedRelations.length;
                supplementedCount = supplementedRelations.length;
                console.log(`[KG Service] Supplemented ${supplementedRelations.length} missing relations`);
              }
            }
            
            const relationValidationDuration = Date.now() - relationValidationStartTime;
            
            // Record correction stats
            if (statsCollector) {
              statsCollector.recordCorrection('relation_extraction', {
                doc_id: docId,
                coverage_rate: validationResult.coverageRate,
                missing_count: validationResult.missingRelations?.length || 0,
                supplemented_count: supplementedCount,
                duration_ms: relationValidationDuration
              });
            }
            
            result.preprocessing.relation_validation = {
              success: true,
              duration_ms: relationValidationDuration,
              coverage_rate: validationResult.coverageRate,
              missing_relations: validationResult.missingRelations?.length || 0,
              supplemented_relations: supplementedCount
            };
          } catch (error) {
            console.error(`[KG Service] Relation validation error:`, error);
            result.errors.push({ step: 'relation_validation', error: error.message });
          }
        }
        
        // Batch save relations to database
        if (semanticRelations.length > 0) {
          try {
            // Check if batch method exists
            if (typeof relationStore.createRelations === 'function') {
              await relationStore.createRelations(semanticRelations);
            } else {
              // Fallback to parallel individual saves
              await Promise.all(
                semanticRelations.map(relation => relationStore.createRelation(relation))
              );
            }
            console.log(`[KG Service] Saved ${semanticRelations.length} semantic relations`);
          } catch (error) {
            console.error(`[KG Service] Failed to batch save semantic relations:`, error);
            // Fallback to individual saves
            for (const relation of semanticRelations) {
              try {
                await relationStore.createRelation(relation);
              } catch (err) {
                console.error(`[KG Service] Failed to save semantic relation:`, err);
              }
            }
          }
        }
        // Collect for post-processing
        allRelationsForPostProcessing.push(...semanticRelations);
      } catch (error) {
        console.error(`[KG Service] Semantic relation building failed:`, error);
        result.errors.push({ step: 'semantic_relations', error: error.message });
      }
    }

    // Step 7: Update confidence scores (OPTIMIZED - Skip for now, will be done in batch later)
    if (enableQualityFilter) {
      console.log(`[KG Service] Skipping confidence update (will be done in batch later for performance)`);
      // Note: Confidence scores will be updated in a separate batch process
      // This significantly improves performance for individual document processing
    } else {
      console.log(`[KG Service] Skipping confidence update (disabled)`);
    }

    // Step 8: Quality filtering (OPTIMIZED - Skip for now, will be done in batch later)
    if (enableQualityFilter) {
      console.log(`[KG Service] Skipping quality filter (will be done in batch later for performance)`);
      // Note: Quality filtering will be done in a separate batch process
      // This significantly improves performance for individual document processing
    }
    
    // Step 9: Knowledge Graph Consistency Check (if preprocessing enabled)
    if (enablePreprocessing && documentIndex) {
      console.log(`[KG Service] Performing knowledge graph consistency check...`);
      const consistencyCheckStartTime = Date.now();
      
      try {
        const consistencyChecker = new KGConsistencyChecker();
        
        // Build graph object for consistency check
        const graph = {
          doc_id: docId,
          entities: allEntities,
          relations: [
            ...allBuiltinRelations,
            // Add other relations if available
          ],
          ckbs: ckbs
        };
        
        const consistencyResult = await consistencyChecker.checkConsistency(
          graph,
          documentIndex.indexed_text,
          llmClient,
          {
            timeout: parseInt(process.env.LLM_PREPROCESSING_TIMEOUT || '30000')
          }
        );
        
        // checkConsistency returns { consistencyScore, isConsistent, items, issues } directly
        const consistencyDuration = Date.now() - consistencyCheckStartTime;
        console.log(`[KG Service] Consistency check completed in ${consistencyDuration}ms`);
        console.log(`[KG Service] Consistency score: ${(consistencyResult.consistencyScore * 100).toFixed(1)}%`);
        
        if (consistencyResult.issues && consistencyResult.issues.length > 0) {
          console.log(`[KG Service] Found ${consistencyResult.issues.length} consistency issues`);
        }
        
        // Generate graph description
        const graphDescription = consistencyChecker.generateGraphDescription(graph);
        
        // Record correction stats
        if (statsCollector) {
          statsCollector.recordCorrection('consistency_check', {
            doc_id: docId,
            consistency_score: consistencyResult.consistencyScore,
            issues_count: consistencyResult.issues?.length || 0,
            duration_ms: consistencyDuration
          });
        }
        
        result.preprocessing.consistency_check = {
          success: true,
          duration_ms: consistencyDuration,
          consistency_score: consistencyResult.consistencyScore,
          issues_count: consistencyResult.issues?.length || 0,
          graph_description: graphDescription
        };
      } catch (error) {
        console.error(`[KG Service] Consistency check error:`, error);
        result.errors.push({ step: 'consistency_check', error: error.message });
      }
    }
    
    // Save correction stats if preprocessing was enabled
    if (enablePreprocessing && statsCollector) {
      try {
        const stats = statsCollector.getStats(docId);
        console.log(`[KG Service] Preprocessing correction stats:`, JSON.stringify(stats, null, 2));
        
        // Save stats to database (if needed)
        // await savePreprocessingStats(docId, stats);
      } catch (error) {
        console.error(`[KG Service] Failed to save preprocessing stats:`, error);
      }
    }

    // Step 10: LLM Post-Processing Cleanup (Req 16.1, 16.2, 16.3, 16.4)
    // This step MUST NOT cause the pipeline to fail — wrapped in try/catch.
    if (llmClient) {
      try {
        console.log(`[KG Service] Starting LLM post-processing cleanup...`);
        const postProcessStartTime = Date.now();

        const postProcessor = new LLMPostProcessor();
        const cleanedEntityStore = new CleanedEntityStore();

        // Get existing CleanedEntity/CleanedRelation for incremental merge (Req 15.1)
        const existingCleanedEntities = await cleanedEntityStore.getAllCleanedEntities();
        const existingCleanedRelations = await cleanedEntityStore.getAllCleanedRelations();

        // Get DocumentIndex text if available
        const documentIndexText = documentIndex ? documentIndex.indexed_text : null;

        // Call cleanup (Req 16.1)
        const cleanupResult = await postProcessor.cleanup({
          entities: deduplicatedEntities,
          relations: allRelationsForPostProcessing,
          documentIndexText,
          existingCleanedEntities,
          existingCleanedRelations,
          llmClient
        });

        // Persist cleanup results to database (Req 16.2)
        // Persist created entities
        const createdEntityMap = new Map(); // name -> db record, for relation FK resolution
        for (const entity of cleanupResult.entities.created) {
          try {
            const created = await cleanedEntityStore.createCleanedEntity(entity);
            createdEntityMap.set(entity.cleanedName, created);
          } catch (err) {
            console.error(`[KG Service] Failed to create cleaned entity:`, err.message);
          }
        }

        // Persist updated entities
        for (const entity of cleanupResult.entities.updated) {
          try {
            await cleanedEntityStore.updateCleanedEntity(entity.id, entity);
          } catch (err) {
            console.error(`[KG Service] Failed to update cleaned entity ${entity.id}:`, err.message);
          }
        }

        // Persist created relations
        for (const relation of cleanupResult.relations.created) {
          try {
            await cleanedEntityStore.createCleanedRelation(relation);
          } catch (err) {
            console.error(`[KG Service] Failed to create cleaned relation:`, err.message);
          }
        }

        // Persist updated relations
        for (const relation of cleanupResult.relations.updated) {
          try {
            await cleanedEntityStore.updateCleanedRelation(relation.id, relation);
          } catch (err) {
            console.error(`[KG Service] Failed to update cleaned relation ${relation.id}:`, err.message);
          }
        }

        const postProcessDuration = Date.now() - postProcessStartTime;
        console.log(`[KG Service] LLM post-processing completed in ${postProcessDuration}ms`);

        // Add cleanup stats to result (Req 16.4)
        result.postProcessing = {
          success: true,
          duration_ms: postProcessDuration,
          entitiesCreated: cleanupResult.stats.entitiesCreated,
          entitiesUpdated: cleanupResult.stats.entitiesUpdated,
          relationsCreated: cleanupResult.stats.relationsCreated,
          relationsUpdated: cleanupResult.stats.relationsUpdated
        };
      } catch (error) {
        // Req 16.3: Log error but do NOT affect pipeline result
        console.error(`[KG Service] LLM post-processing failed (non-fatal):`, error);
        result.postProcessing = {
          success: false,
          error: error.message
        };
      }
    } else {
      console.log(`[KG Service] Skipping LLM post-processing (no LLM client provided)`);
      result.postProcessing = { enabled: false };
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
    
    // 同步文档到 knowledge_graph.db（复用 syncDocumentToKGDB）
    for (const doc of documents) {
      try {
        await syncDocumentToKGDB({
          id: doc.id,
          title: doc.title,
          content: doc.content,
          type: doc.type,
          fileType: doc.file_type,
          metadata: doc.metadata
        });
      } catch (error) {
        console.error(`[KG Service] Failed to sync document ${doc.id}:`, error);
      }
    }

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

/**
 * 将文档记录同步到 knowledge_graph.db
 * @param {Object} doc - 文档对象
 * @param {string} doc.id - 文档ID
 * @param {string} doc.title - 文档标题
 * @param {string} doc.content - 文档内容
 * @param {string} [doc.type] - 文档类型
 * @param {string} [doc.fileType] - 文件类型
 * @param {Object|string} [doc.metadata] - 文档元数据
 * @returns {Promise<Object>} Prisma upsert 结果
 * @throws {Error} 同步失败时抛出错误（不静默吞掉）
 */
async function syncDocumentToKGDB(doc) {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();

  try {
    const result = await prisma.document.upsert({
      where: { id: doc.id },
      update: {
        title: doc.title || 'Untitled',
        content: doc.content || '',
        type: doc.type || 'document',
        fileType: doc.fileType || null,
        metadata: typeof doc.metadata === 'string'
          ? doc.metadata
          : JSON.stringify(doc.metadata || {})
      },
      create: {
        id: doc.id,
        title: doc.title || 'Untitled',
        content: doc.content || '',
        type: doc.type || 'document',
        fileType: doc.fileType || null,
        metadata: typeof doc.metadata === 'string'
          ? doc.metadata
          : JSON.stringify(doc.metadata || {})
      }
    });

    console.log(`[KG Service] 文档同步成功: ${doc.id}`);
    return result;
  } finally {
    await prisma.$disconnect();
  }
}


module.exports = {
  buildKnowledgeGraph,
  updateKnowledgeGraph,
  rebuildKnowledgeGraph,
  deleteKnowledgeGraph,
  clearKnowledgeGraph,
  getKnowledgeGraphStats,
  syncDocumentToKGDB,
  normalizePunctuation
};
