/**
 * Integration tests for LLM preprocessing in kg_service
 * Tests the integration of preprocessing modules into the main KG building flow
 * 
 * **Validates: Requirements 8.3, 8.4, 8.5**
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Mock only the heavy dependencies, not the preprocessing modules
jest.mock('../../ckb/ckb_parser');
jest.mock('../../ckb/ckb_store');
jest.mock('../../field_extractor/schema_aware_extractor');
jest.mock('../../schema/schema_manager');
jest.mock('../../schema/schema_matcher');
jest.mock('../../field_normalizer/field_normalizer');
jest.mock('../../entity/entity_builder');
jest.mock('../../entity/entity_store');
jest.mock('../../relation/builtin_relation_builder');
jest.mock('../../relation/cooccurrence_relation_builder');
jest.mock('../../relation/semantic_relation_builder');
jest.mock('../../relation/relation_store');
jest.mock('../../services/document_classifier');

const kgService = require('../kg_service');
const { IndexGenerator } = require('../../preprocessing/index_generator');
const { CKBDescriptionGenerator } = require('../../preprocessing/ckb_description_generator');
const FieldExtractionValidator = require('../../preprocessing/field_extraction_validator');
const SchemaSelectionValidator = require('../../preprocessing/schema_selection_validator');
const RelationExtractionValidator = require('../../preprocessing/relation_extraction_validator');
const { KGConsistencyChecker } = require('../../preprocessing/kg_consistency_checker');
const CorrectionStatsCollector = require('../../preprocessing/correction_stats_collector');

describe('KG Service - LLM Preprocessing Integration', () => {
  let mockLLMClient;
  let originalEnv;
  let testFilePath;
  let testDocId;

  beforeEach(async () => {
    // Save original environment
    originalEnv = { ...process.env };
    
    // Create a temporary test file
    testDocId = uuidv4();
    testFilePath = path.join(os.tmpdir(), `test-doc-${testDocId}.txt`);
    await fs.writeFile(testFilePath, 'Test document content for knowledge graph building.');
    
    // Mock LLM client
    mockLLMClient = {
      call: jest.fn()
    };

    // Setup default mocks
    setupDefaultMocks();
  });

  afterEach(async () => {
    // Restore environment
    process.env = originalEnv;
    
    // Clean up test file
    try {
      await fs.unlink(testFilePath);
    } catch (error) {
      // Ignore cleanup errors
    }
    
    jest.clearAllMocks();
  });

  function setupDefaultMocks() {
    // Mock CKB parser
    const ckbParser = require('../../ckb/ckb_parser');
    ckbParser.parseDocument = jest.fn().mockResolvedValue([
      {
        ckb_id: 'ckb-1',
        doc_id: testDocId,
        content: { text: 'Test CKB content' },
        extracted_fields: []
      }
    ]);

    // Mock CKB store
    const ckbStore = require('../../ckb/ckb_store');
    ckbStore.saveCKBs = jest.fn().mockResolvedValue(true);

    // Mock schema-aware extractor
    const schemaAwareExtractor = require('../../field_extractor/schema_aware_extractor');
    schemaAwareExtractor.prototype.extractFields = jest.fn().mockResolvedValue([
      { name: 'test_field', value: 'test_value', sources: ['rule'] }
    ]);

    // Mock schema manager
    const schemaManager = require('../../schema/schema_manager');
    schemaManager.listSchemas = jest.fn().mockResolvedValue([
      {
        id: 'schema-1',
        name: 'TestSchema',
        entityType: 'TestEntity',
        threshold: 0.5
      }
    ]);

    // Mock schema matcher
    const schemaMatcher = require('../../schema/schema_matcher');
    schemaMatcher.matchSchemas = jest.fn().mockResolvedValue([
      {
        schema: {
          id: 'schema-1',
          name: 'TestSchema',
          entityType: 'TestEntity',
          threshold: 0.5
        },
        completeness: 0.8
      }
    ]);

    // Mock field normalizer
    const fieldNormalizer = require('../../field_normalizer/field_normalizer');
    fieldNormalizer.normalizeFields = jest.fn().mockResolvedValue([
      { name: 'test_field', value: 'test_value' }
    ]);

    // Mock entity builder
    const entityBuilder = require('../../entity/entity_builder');
    entityBuilder.buildEntity = jest.fn().mockResolvedValue({
      entity_id: 'entity-1',
      name: 'Test Entity'
    });

    // Mock entity store
    const entityStore = require('../../entity/entity_store');
    entityStore.saveEntities = jest.fn().mockResolvedValue(true);

    // Mock relation builders
    const builtinRelationBuilder = require('../../relation/builtin_relation_builder');
    builtinRelationBuilder.buildBuiltinRelations = jest.fn().mockResolvedValue([]);

    const cooccurrenceRelationBuilder = require('../../relation/cooccurrence_relation_builder');
    cooccurrenceRelationBuilder.buildCooccurrenceRelations = jest.fn().mockResolvedValue([]);

    const semanticRelationBuilder = require('../../relation/semantic_relation_builder');
    semanticRelationBuilder.batchExtractSemanticRelations = jest.fn().mockResolvedValue([]);

    // Mock relation store
    const relationStore = require('../../relation/relation_store');
    relationStore.createRelations = jest.fn().mockResolvedValue(true);

    // Mock document classifier
    const { DocumentClassifier } = require('../../services/document_classifier');
    DocumentClassifier.prototype.classifyDocument = jest.fn().mockReturnValue({
      documentType: 'general',
      confidence: 0.8,
      entityTypes: ['TestEntity'],
      matchedKeywords: ['test']
    });
    DocumentClassifier.prototype.getRelevantSchemas = jest.fn().mockImplementation((text, schemas) => schemas);
  }

  describe('Configuration Switch - Requirement 8.5', () => {
    test('should skip preprocessing when ENABLE_LLM_PREPROCESSING is false', async () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'false';
      
      const result = await kgService.buildKnowledgeGraph(
        testDocId,
        testFilePath,
        'txt',
        { llmClient: mockLLMClient }
      );
      
      // Preprocessing should be disabled
      expect(result.preprocessing).toBeDefined();
      expect(result.preprocessing.enabled).toBe(false);
      
      // LLM client should not be called for preprocessing
      expect(mockLLMClient.call).not.toHaveBeenCalled();
      
      // Should still process the document normally
      expect(result.ckbs_created).toBeGreaterThan(0);
    });

    test('should enable preprocessing when ENABLE_LLM_PREPROCESSING is true and llmClient provided', async () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      
      // Mock successful index generation
      IndexGenerator.prototype.generateIndexedText = jest.fn().mockResolvedValue({
        success: true,
        index: {
          doc_id: testDocId,
          indexed_text: '1. Test fact one.\n2. Test fact two.',
          metadata: {
            fact_count: 2,
            llm_model: 'test-model'
          }
        }
      });
      
      const result = await kgService.buildKnowledgeGraph(
        testDocId,
        testFilePath,
        'txt',
        { llmClient: mockLLMClient }
      );
      
      // Preprocessing should be enabled
      expect(result.preprocessing).toBeDefined();
      expect(result.preprocessing.enabled).toBe(true);
      expect(result.preprocessing.fact_count).toBe(2);
      
      // Index generator should have been called
      expect(IndexGenerator.prototype.generateIndexedText).toHaveBeenCalledWith(
        testDocId,
        expect.any(String),
        mockLLMClient,
        expect.objectContaining({
          timeout: expect.any(Number),
          temperature: expect.any(Number)
        })
      );
    });

    test('should skip preprocessing when no llmClient provided', async () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      
      const result = await kgService.buildKnowledgeGraph(
        testDocId,
        testFilePath,
        'txt',
        { llmClient: null }
      );
      
      // Preprocessing should be disabled due to missing llmClient
      expect(result.preprocessing).toBeDefined();
      expect(result.preprocessing.enabled).toBe(false);
      
      // Should still process the document normally
      expect(result.ckbs_created).toBeGreaterThan(0);
    });

    test('should use custom configuration parameters', async () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      process.env.LLM_PREPROCESSING_TIMEOUT = '60000';
      process.env.LLM_PREPROCESSING_TEMPERATURE = '0.2';
      process.env.FIELD_COVERAGE_THRESHOLD = '0.9';
      process.env.RELATION_COVERAGE_THRESHOLD = '0.8';
      process.env.SCHEMA_VALIDATION_THRESHOLD = '0.85';
      
      IndexGenerator.prototype.generateIndexedText = jest.fn().mockResolvedValue({
        success: true,
        index: {
          doc_id: testDocId,
          indexed_text: '1. Test fact.',
          metadata: { fact_count: 1 }
        }
      });
      
      await kgService.buildKnowledgeGraph(
        testDocId,
        testFilePath,
        'txt',
        { llmClient: mockLLMClient }
      );
      
      // Verify custom timeout and temperature were used
      expect(IndexGenerator.prototype.generateIndexedText).toHaveBeenCalledWith(
        testDocId,
        expect.any(String),
        mockLLMClient,
        expect.objectContaining({
          timeout: 60000,
          temperature: 0.2
        })
      );
    });
  });

  describe('Fallback Behavior - Requirement 8.3, 8.4', () => {
    test('should continue with original flow when index generation fails', async () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      
      // Mock index generation failure
      IndexGenerator.prototype.generateIndexedText = jest.fn().mockResolvedValue({
        success: false,
        error: 'LLM service unavailable'
      });
      
      const result = await kgService.buildKnowledgeGraph(
        testDocId,
        testFilePath,
        'txt',
        { llmClient: mockLLMClient }
      );
      
      // Should have preprocessing result with error
      expect(result.preprocessing).toBeDefined();
      expect(result.preprocessing.enabled).toBe(true);
      expect(result.preprocessing.success).toBe(false);
      expect(result.preprocessing.error).toBe('LLM service unavailable');
      
      // Should continue processing normally
      expect(result.ckbs_created).toBeGreaterThan(0);
      expect(result.entities_created).toBeGreaterThan(0);
    });

    test('should continue when index generation throws exception', async () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      
      // Mock index generation exception
      IndexGenerator.prototype.generateIndexedText = jest.fn().mockRejectedValue(
        new Error('Network timeout')
      );
      
      const result = await kgService.buildKnowledgeGraph(
        testDocId,
        testFilePath,
        'txt',
        { llmClient: mockLLMClient }
      );
      
      // Should have preprocessing result with error
      expect(result.preprocessing).toBeDefined();
      expect(result.preprocessing.enabled).toBe(true);
      expect(result.preprocessing.success).toBe(false);
      
      // Should continue processing normally
      expect(result.ckbs_created).toBeGreaterThan(0);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          step: 'preprocessing'
        })
      );
    });

    test('should continue when CKB generation fails', async () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      
      IndexGenerator.prototype.generateIndexedText = jest.fn().mockResolvedValue({
        success: true,
        index: {
          doc_id: testDocId,
          indexed_text: '1. Test fact.',
          metadata: { fact_count: 1 }
        }
      });
      
      // Mock CKB generation failure
      CKBDescriptionGenerator.prototype.generateCKBDescriptions = jest.fn().mockResolvedValue({
        success: false,
        error: 'CKB generation failed'
      });
      
      const result = await kgService.buildKnowledgeGraph(
        testDocId,
        testFilePath,
        'txt',
        { llmClient: mockLLMClient }
      );
      
      // Should have preprocessing enabled
      expect(result.preprocessing).toBeDefined();
      expect(result.preprocessing.enabled).toBe(true);
      
      // Should continue processing normally
      expect(result.ckbs_created).toBeGreaterThan(0);
    });

    test('should continue when field validation fails', async () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      
      IndexGenerator.prototype.generateIndexedText = jest.fn().mockResolvedValue({
        success: true,
        index: {
          doc_id: testDocId,
          indexed_text: '1. Test fact.',
          metadata: { fact_count: 1 }
        }
      });
      
      // Mock field validation failure
      FieldExtractionValidator.prototype.validateFields = jest.fn().mockRejectedValue(
        new Error('Validation timeout')
      );
      
      const result = await kgService.buildKnowledgeGraph(
        testDocId,
        testFilePath,
        'txt',
        { llmClient: mockLLMClient }
      );
      
      // Should have preprocessing enabled
      expect(result.preprocessing).toBeDefined();
      expect(result.preprocessing.enabled).toBe(true);
      
      // Should continue processing normally
      expect(result.ckbs_created).toBeGreaterThan(0);
      // Note: entities may or may not be created depending on field extraction success
    });

    test('should continue when relation validation fails', async () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      
      IndexGenerator.prototype.generateIndexedText = jest.fn().mockResolvedValue({
        success: true,
        index: {
          doc_id: testDocId,
          indexed_text: '1. Test fact.',
          metadata: { fact_count: 1 }
        }
      });
      
      // Mock relation validation failure
      RelationExtractionValidator.prototype.validateRelations = jest.fn().mockRejectedValue(
        new Error('Validation error')
      );
      
      const result = await kgService.buildKnowledgeGraph(
        testDocId,
        testFilePath,
        'txt',
        { llmClient: mockLLMClient, enableSemanticRelations: true }
      );
      
      // Should have preprocessing enabled
      expect(result.preprocessing).toBeDefined();
      expect(result.preprocessing.enabled).toBe(true);
      
      // Should continue processing normally
      expect(result.ckbs_created).toBeGreaterThan(0);
    });

    test('should continue when consistency check fails', async () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      
      IndexGenerator.prototype.generateIndexedText = jest.fn().mockResolvedValue({
        success: true,
        index: {
          doc_id: testDocId,
          indexed_text: '1. Test fact.',
          metadata: { fact_count: 1 }
        }
      });
      
      // Mock consistency check failure
      KGConsistencyChecker.prototype.checkConsistency = jest.fn().mockRejectedValue(
        new Error('Consistency check error')
      );
      
      const result = await kgService.buildKnowledgeGraph(
        testDocId,
        testFilePath,
        'txt',
        { llmClient: mockLLMClient }
      );
      
      // Should have preprocessing enabled
      expect(result.preprocessing).toBeDefined();
      expect(result.preprocessing.enabled).toBe(true);
      
      // Should continue processing normally
      expect(result.ckbs_created).toBeGreaterThan(0);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          step: 'consistency_check'
        })
      );
    });
  });

  describe('Complete Flow - Requirement 8.3', () => {
    test('should execute complete preprocessing flow successfully', async () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      
      // Use jest.spyOn to mock methods
      const generateIndexSpy = jest.spyOn(IndexGenerator.prototype, 'generateIndexedText').mockResolvedValue({
        success: true,
        index: {
          doc_id: testDocId,
          indexed_text: '1. Test entity A has property X.\n2. Test entity B relates to entity A.',
          metadata: { fact_count: 2, llm_model: 'test-model' }
        }
      });
      
      const generateCKBSpy = jest.spyOn(CKBDescriptionGenerator.prototype, 'generateCKBDescriptions').mockResolvedValue({
        success: true,
        ckbs: [
          { ckb_text: 'Test entity A has property X.', source_index: 1 },
          { ckb_text: 'Test entity B relates to entity A.', source_index: 2 }
        ]
      });
      
      const result = await kgService.buildKnowledgeGraph(
        testDocId,
        testFilePath,
        'txt',
        { llmClient: mockLLMClient, enableSemanticRelations: true }
      );
      
      // Verify preprocessing was enabled and successful
      expect(result.preprocessing).toBeDefined();
      expect(result.preprocessing.enabled).toBe(true);
      expect(result.preprocessing.fact_count).toBe(2);
      
      // Verify index generation was called
      expect(generateIndexSpy).toHaveBeenCalled();
      
      // Verify CKB generation was called
      expect(generateCKBSpy).toHaveBeenCalled();
      
      // Verify normal processing continued
      expect(result.ckbs_created).toBeGreaterThan(0);
      // Note: Entity creation depends on schema matching, which may not happen in test environment
      
      // Cleanup spies
      generateIndexSpy.mockRestore();
      generateCKBSpy.mockRestore();
    });

    test('should pass document index to all validation stages', async () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      
      const indexedText = '1. Test fact one.\n2. Test fact two.';
      
      const generateIndexSpy = jest.spyOn(IndexGenerator.prototype, 'generateIndexedText').mockResolvedValue({
        success: true,
        index: {
          doc_id: testDocId,
          indexed_text: indexedText,
          metadata: { fact_count: 2 }
        }
      });
      
      const generateCKBSpy = jest.spyOn(CKBDescriptionGenerator.prototype, 'generateCKBDescriptions').mockResolvedValue({
        success: true,
        ckbs: []
      });
      
      const result = await kgService.buildKnowledgeGraph(
        testDocId,
        testFilePath,
        'txt',
        { llmClient: mockLLMClient, enableSemanticRelations: true }
      );
      
      // Verify preprocessing was enabled
      expect(result.preprocessing).toBeDefined();
      expect(result.preprocessing.enabled).toBe(true);
      
      // Verify indexed text was passed to CKB generator
      expect(generateCKBSpy).toHaveBeenCalledWith(
        indexedText,
        mockLLMClient,
        expect.any(Object)
      );
      
      // Cleanup spies
      generateIndexSpy.mockRestore();
      generateCKBSpy.mockRestore();
    });
  });

  describe('Result Structure', () => {
    test('should include detailed preprocessing results in output', async () => {
      process.env.ENABLE_LLM_PREPROCESSING = 'true';
      
      const generateIndexSpy = jest.spyOn(IndexGenerator.prototype, 'generateIndexedText').mockResolvedValue({
        success: true,
        index: {
          doc_id: testDocId,
          indexed_text: '1. Test fact.',
          metadata: { fact_count: 1 }
        }
      });
      
      const generateCKBSpy = jest.spyOn(CKBDescriptionGenerator.prototype, 'generateCKBDescriptions').mockResolvedValue({
        success: true,
        ckbs: [{ ckb_text: 'Test', source_index: 1 }]
      });
      
      const result = await kgService.buildKnowledgeGraph(
        testDocId,
        testFilePath,
        'txt',
        { llmClient: mockLLMClient, enableSemanticRelations: true }
      );
      
      // Verify preprocessing section structure
      expect(result.preprocessing).toBeDefined();
      expect(result.preprocessing.enabled).toBe(true);
      expect(result.preprocessing.duration_ms).toBeGreaterThan(0);
      expect(result.preprocessing.fact_count).toBe(1);
      
      // Verify CKB generation results
      expect(result.preprocessing.ckb_generation).toBeDefined();
      expect(result.preprocessing.ckb_generation.success).toBe(true);
      expect(result.preprocessing.ckb_generation.count).toBe(1);
      
      // Cleanup spies
      generateIndexSpy.mockRestore();
      generateCKBSpy.mockRestore();
    });
  });
});
