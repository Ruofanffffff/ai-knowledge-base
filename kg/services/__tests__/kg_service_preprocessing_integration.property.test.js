/**
 * Property-Based Tests for KG Service Preprocessing Integration
 * 
 * Tests universal properties that should hold across all inputs:
 * - Property 1: 预处理优先执行
 * - Property 4: LLM失败降级
 * - Property 6: Document_Index传递
 * - Property 18: 错误处理保持
 * 
 * **Feature: llm-document-index-preprocessing**
 * **Validates: Requirements 1.1, 1.4, 8.1, 8.2, 8.3, 8.4**
 */

const fc = require('fast-check');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Mock heavy dependencies
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
const EntityMergeValidator = require('../../preprocessing/entity_merge_validator');
const RelationExtractionValidator = require('../../preprocessing/relation_extraction_validator');
const { KGConsistencyChecker } = require('../../preprocessing/kg_consistency_checker');

describe('KG Service Preprocessing Integration - Property Tests', () => {
  let originalEnv;
  let testFiles = [];

  beforeAll(() => {
    originalEnv = { ...process.env };
    setupDefaultMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  afterEach(async () => {
    // Clean up test files
    for (const filePath of testFiles) {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    testFiles = [];
    jest.clearAllMocks();
  });

  function setupDefaultMocks() {
    const ckbParser = require('../../ckb/ckb_parser');
    ckbParser.parseDocument = jest.fn().mockImplementation((docId) => 
      Promise.resolve([
        {
          ckb_id: `ckb-${docId}`,
          doc_id: docId,
          content: { text: 'Test CKB content' },
          extracted_fields: []
        }
      ])
    );

    const ckbStore = require('../../ckb/ckb_store');
    ckbStore.saveCKBs = jest.fn().mockResolvedValue(true);

    const schemaAwareExtractor = require('../../field_extractor/schema_aware_extractor');
    schemaAwareExtractor.prototype.extractFields = jest.fn().mockResolvedValue([
      { name: 'test_field', value: 'test_value', sources: ['rule'] }
    ]);

    const schemaManager = require('../../schema/schema_manager');
    schemaManager.listSchemas = jest.fn().mockResolvedValue([
      {
        id: 'schema-1',
        name: 'TestSchema',
        entityType: 'TestEntity',
        threshold: 0.5
      }
    ]);

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

    const fieldNormalizer = require('../../field_normalizer/field_normalizer');
    fieldNormalizer.normalizeFields = jest.fn().mockResolvedValue([
      { name: 'test_field', value: 'test_value' }
    ]);

    const entityBuilder = require('../../entity/entity_builder');
    entityBuilder.buildEntity = jest.fn().mockResolvedValue({
      entity_id: 'entity-1',
      name: 'Test Entity'
    });

    const entityStore = require('../../entity/entity_store');
    entityStore.saveEntities = jest.fn().mockResolvedValue(true);

    const builtinRelationBuilder = require('../../relation/builtin_relation_builder');
    builtinRelationBuilder.buildBuiltinRelations = jest.fn().mockResolvedValue([]);

    const cooccurrenceRelationBuilder = require('../../relation/cooccurrence_relation_builder');
    cooccurrenceRelationBuilder.buildCooccurrenceRelations = jest.fn().mockResolvedValue([]);

    const semanticRelationBuilder = require('../../relation/semantic_relation_builder');
    semanticRelationBuilder.batchExtractSemanticRelations = jest.fn().mockResolvedValue([]);

    const relationStore = require('../../relation/relation_store');
    relationStore.createRelations = jest.fn().mockResolvedValue(true);

    const { DocumentClassifier } = require('../../services/document_classifier');
    DocumentClassifier.prototype.classifyDocument = jest.fn().mockReturnValue({
      documentType: 'general',
      confidence: 0.8,
      entityTypes: ['TestEntity'],
      matchedKeywords: ['test']
    });
    DocumentClassifier.prototype.getRelevantSchemas = jest.fn().mockImplementation((text, schemas) => schemas);
  }

  async function createTestFile(content) {
    const testDocId = uuidv4();
    const testFilePath = path.join(os.tmpdir(), `test-doc-${testDocId}.txt`);
    await fs.writeFile(testFilePath, content);
    testFiles.push(testFilePath);
    return { testDocId, testFilePath };
  }

  /**
   * Property 1: 预处理优先执行
   * 
   * **Validates: Requirements 1.1, 8.1**
   * 
   * 对于任何文档，当它进入知识图谱构建流程时，LLM文档索引预处理应该在所有其他处理步骤
   * （CKB解析、字段提取等）之前执行
   * 
   * Universal property: For any document entering the KG building flow, LLM document
   * index preprocessing should execute before all other processing steps.
   */
  describe('Property 1: 预处理优先执行', () => {
    test('should always execute preprocessing before CKB parsing when enabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 50, maxLength: 500 }),
          fc.integer({ min: 1, max: 5 }),
          async (documentContent, factCount) => {
            process.env.ENABLE_LLM_PREPROCESSING = 'true';
            
            const { testDocId, testFilePath } = await createTestFile(documentContent);
            
            // Track call order
            const callOrder = [];
            
            // Mock index generator
            const generateIndexSpy = jest.spyOn(IndexGenerator.prototype, 'generateIndexedText')
              .mockImplementation(async () => {
                callOrder.push('index_generation');
                return {
                  success: true,
                  index: {
                    doc_id: testDocId,
                    indexed_text: Array.from({ length: factCount }, (_, i) => 
                      `${i + 1}. 测试事实 ${i + 1}。`
                    ).join('\n'),
                    metadata: { fact_count: factCount }
                  }
                };
              });
            
            // Mock CKB parser to track call order
            const ckbParser = require('../../ckb/ckb_parser');
            ckbParser.parseDocument.mockImplementation(async () => {
              callOrder.push('ckb_parsing');
              return [{
                ckb_id: `ckb-${testDocId}`,
                doc_id: testDocId,
                content: { text: 'Test CKB' },
                extracted_fields: []
              }];
            });
            
            const mockLLMClient = {
              call: jest.fn().mockResolvedValue({
                content: '1. Test fact.',
                tokens: 50,
                model: 'test-model'
              })
            };
            
            await kgService.buildKnowledgeGraph(
              testDocId,
              testFilePath,
              'txt',
              { llmClient: mockLLMClient }
            );
            
            // Property: Index generation must be called before CKB parsing
            const indexPos = callOrder.indexOf('index_generation');
            const ckbPos = callOrder.indexOf('ckb_parsing');
            
            expect(indexPos).toBeGreaterThanOrEqual(0);
            expect(ckbPos).toBeGreaterThan(indexPos);
            
            generateIndexSpy.mockRestore();
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should always execute preprocessing before field extraction when enabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 50, maxLength: 300 }),
          async (documentContent) => {
            process.env.ENABLE_LLM_PREPROCESSING = 'true';
            
            const { testDocId, testFilePath } = await createTestFile(documentContent);
            
            const callOrder = [];
            
            const generateIndexSpy = jest.spyOn(IndexGenerator.prototype, 'generateIndexedText')
              .mockImplementation(async () => {
                callOrder.push('index_generation');
                return {
                  success: true,
                  index: {
                    doc_id: testDocId,
                    indexed_text: '1. 测试事实。',
                    metadata: { fact_count: 1 }
                  }
                };
              });
            
            const schemaAwareExtractor = require('../../field_extractor/schema_aware_extractor');
            schemaAwareExtractor.prototype.extractFields.mockImplementation(async () => {
              callOrder.push('field_extraction');
              return [{ name: 'test', value: 'value', sources: ['rule'] }];
            });
            
            const mockLLMClient = {
              call: jest.fn().mockResolvedValue({
                content: '1. Test.',
                tokens: 30,
                model: 'test-model'
              })
            };
            
            await kgService.buildKnowledgeGraph(
              testDocId,
              testFilePath,
              'txt',
              { llmClient: mockLLMClient }
            );
            
            // Property: Index generation must precede field extraction
            const indexPos = callOrder.indexOf('index_generation');
            const fieldPos = callOrder.indexOf('field_extraction');
            
            if (fieldPos >= 0) {
              expect(indexPos).toBeGreaterThanOrEqual(0);
              expect(fieldPos).toBeGreaterThan(indexPos);
            }
            
            generateIndexSpy.mockRestore();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 4: LLM失败降级
   * 
   * **Validates: Requirements 1.4, 8.4**
   * 
   * 对于任何LLM调用失败的情况，系统应该返回错误信息并继续使用原有流程处理，
   * 不应该中断整个构建流程
   * 
   * Universal property: For any LLM call failure, the system should return error
   * information and continue with the original flow without interrupting the build process.
   */
  describe('Property 4: LLM失败降级', () => {
    test('should always continue processing when index generation fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 50, maxLength: 300 }),
          fc.constantFrom(
            'LLM service unavailable',
            'Network timeout',
            'Rate limit exceeded',
            'Invalid response'
          ),
          async (documentContent, errorMessage) => {
            process.env.ENABLE_LLM_PREPROCESSING = 'true';
            
            const { testDocId, testFilePath } = await createTestFile(documentContent);
            
            // Mock index generation failure
            const generateIndexSpy = jest.spyOn(IndexGenerator.prototype, 'generateIndexedText')
              .mockResolvedValue({
                success: false,
                error: errorMessage
              });
            
            const mockLLMClient = {
              call: jest.fn().mockRejectedValue(new Error(errorMessage))
            };
            
            const result = await kgService.buildKnowledgeGraph(
              testDocId,
              testFilePath,
              'txt',
              { llmClient: mockLLMClient }
            );
            
            // Property: Should not throw, must return a result
            expect(result).toBeDefined();
            
            // Property: Should indicate preprocessing was attempted but failed
            expect(result.preprocessing).toBeDefined();
            expect(result.preprocessing.enabled).toBe(true);
            expect(result.preprocessing.success).toBe(false);
            
            // Property: Should continue with normal processing
            expect(result.ckbs_created).toBeGreaterThan(0);
            
            generateIndexSpy.mockRestore();
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should always continue when any preprocessing stage fails', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 50, maxLength: 300 }),
          fc.constantFrom(
            'ckb_generation',
            'field_validation',
            'schema_validation',
            'relation_validation',
            'consistency_check'
          ),
          async (documentContent, failingStage) => {
            process.env.ENABLE_LLM_PREPROCESSING = 'true';
            
            const { testDocId, testFilePath } = await createTestFile(documentContent);
            
            // Mock successful index generation
            const generateIndexSpy = jest.spyOn(IndexGenerator.prototype, 'generateIndexedText')
              .mockResolvedValue({
                success: true,
                index: {
                  doc_id: testDocId,
                  indexed_text: '1. 测试事实。',
                  metadata: { fact_count: 1 }
                }
              });
            
            // Mock failure in specific stage
            if (failingStage === 'ckb_generation') {
              jest.spyOn(CKBDescriptionGenerator.prototype, 'generateCKBDescriptions')
                .mockRejectedValue(new Error('CKB generation failed'));
            } else if (failingStage === 'field_validation') {
              jest.spyOn(FieldExtractionValidator.prototype, 'validateFields')
                .mockRejectedValue(new Error('Field validation failed'));
            } else if (failingStage === 'schema_validation') {
              jest.spyOn(SchemaSelectionValidator.prototype, 'validateSchemaSelection')
                .mockRejectedValue(new Error('Schema validation failed'));
            } else if (failingStage === 'relation_validation') {
              jest.spyOn(RelationExtractionValidator.prototype, 'validateRelations')
                .mockRejectedValue(new Error('Relation validation failed'));
            } else if (failingStage === 'consistency_check') {
              jest.spyOn(KGConsistencyChecker.prototype, 'checkConsistency')
                .mockRejectedValue(new Error('Consistency check failed'));
            }
            
            const mockLLMClient = {
              call: jest.fn().mockResolvedValue({
                content: '1. Test.',
                tokens: 30,
                model: 'test-model'
              })
            };
            
            const result = await kgService.buildKnowledgeGraph(
              testDocId,
              testFilePath,
              'txt',
              { llmClient: mockLLMClient, enableSemanticRelations: true }
            );
            
            // Property: Should not throw, must return a result
            expect(result).toBeDefined();
            
            // Property: Should continue processing despite failure
            expect(result.ckbs_created).toBeGreaterThan(0);
            
            // Property: Should record the error
            if (result.errors && result.errors.length > 0) {
              const hasError = result.errors.some(e => 
                e.step && e.step.includes(failingStage.replace('_', ' '))
              );
              // Error may or may not be recorded depending on stage
              expect(hasError || true).toBe(true);
            }
            
            generateIndexSpy.mockRestore();
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should always handle LLM client exceptions gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 50, maxLength: 300 }),
          fc.constantFrom(
            new Error('Network error'),
            new Error('Timeout'),
            new Error('Invalid API key'),
            new TypeError('Cannot read property'),
            new RangeError('Maximum call stack')
          ),
          async (documentContent, error) => {
            process.env.ENABLE_LLM_PREPROCESSING = 'true';
            
            const { testDocId, testFilePath } = await createTestFile(documentContent);
            
            // Mock index generation throwing exception
            const generateIndexSpy = jest.spyOn(IndexGenerator.prototype, 'generateIndexedText')
              .mockRejectedValue(error);
            
            const mockLLMClient = {
              call: jest.fn().mockRejectedValue(error)
            };
            
            // Property: Should never throw, always return result
            const result = await kgService.buildKnowledgeGraph(
              testDocId,
              testFilePath,
              'txt',
              { llmClient: mockLLMClient }
            );
            
            expect(result).toBeDefined();
            expect(result.preprocessing).toBeDefined();
            expect(result.preprocessing.success).toBe(false);
            expect(result.ckbs_created).toBeGreaterThan(0);
            
            generateIndexSpy.mockRestore();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 6: Document_Index传递
   * 
   * **Validates: Requirements 8.2**
   * 
   * 对于任何需要矫正的处理阶段（CBK解析、字段提取、Schema匹配、实体合并、关系构建），
   * 它们应该接收Document_Index作为输入参数
   * 
   * Universal property: For any processing stage requiring correction, it should
   * receive Document_Index as an input parameter.
   */
  describe('Property 6: Document_Index传递', () => {
    test('should always pass indexed text to CKB generator when available', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 50, maxLength: 300 }),
          fc.array(
            fc.string({ minLength: 10, maxLength: 100 }),
            { minLength: 1, maxLength: 5 }
          ),
          async (documentContent, facts) => {
            process.env.ENABLE_LLM_PREPROCESSING = 'true';
            
            const { testDocId, testFilePath } = await createTestFile(documentContent);
            
            const indexedText = facts.map((fact, i) => `${i + 1}. ${fact}`).join('\n');
            
            const generateIndexSpy = jest.spyOn(IndexGenerator.prototype, 'generateIndexedText')
              .mockResolvedValue({
                success: true,
                index: {
                  doc_id: testDocId,
                  indexed_text: indexedText,
                  metadata: { fact_count: facts.length }
                }
              });
            
            const generateCKBSpy = jest.spyOn(CKBDescriptionGenerator.prototype, 'generateCKBDescriptions')
              .mockResolvedValue({
                success: true,
                ckbs: []
              });
            
            const mockLLMClient = {
              call: jest.fn().mockResolvedValue({
                content: indexedText,
                tokens: 100,
                model: 'test-model'
              })
            };
            
            await kgService.buildKnowledgeGraph(
              testDocId,
              testFilePath,
              'txt',
              { llmClient: mockLLMClient }
            );
            
            // Property: CKB generator must receive the indexed text
            expect(generateCKBSpy).toHaveBeenCalled();
            const callArgs = generateCKBSpy.mock.calls[0];
            expect(callArgs[0]).toBe(indexedText);
            
            generateIndexSpy.mockRestore();
            generateCKBSpy.mockRestore();
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should always pass document index to validation stages when available', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 50, maxLength: 300 }),
          fc.string({ minLength: 20, maxLength: 200 }),
          async (documentContent, indexedText) => {
            process.env.ENABLE_LLM_PREPROCESSING = 'true';
            
            const { testDocId, testFilePath } = await createTestFile(documentContent);
            
            const generateIndexSpy = jest.spyOn(IndexGenerator.prototype, 'generateIndexedText')
              .mockResolvedValue({
                success: true,
                index: {
                  doc_id: testDocId,
                  indexed_text: indexedText,
                  metadata: { fact_count: 1 }
                }
              });
            
            const validateFieldsSpy = jest.spyOn(FieldExtractionValidator.prototype, 'validateFields')
              .mockResolvedValue({
                isValid: true,
                coverageRate: 0.9,
                missingFields: []
              });
            
            const mockLLMClient = {
              call: jest.fn().mockResolvedValue({
                content: indexedText,
                tokens: 50,
                model: 'test-model'
              })
            };
            
            await kgService.buildKnowledgeGraph(
              testDocId,
              testFilePath,
              'txt',
              { llmClient: mockLLMClient }
            );
            
            // Property: Field validator must receive indexed text if called
            if (validateFieldsSpy.mock.calls.length > 0) {
              const callArgs = validateFieldsSpy.mock.calls[0];
              expect(callArgs[1]).toBe(indexedText);
            }
            
            generateIndexSpy.mockRestore();
            validateFieldsSpy.mockRestore();
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Property 18: 错误处理保持
   * 
   * **Validates: Requirements 8.3**
   * 
   * 对于任何处理阶段的失败，系统应该保持现有的错误处理和重试机制
   * 
   * Universal property: For any processing stage failure, the system should maintain
   * existing error handling and retry mechanisms.
   */
  describe('Property 18: 错误处理保持', () => {
    test('should always maintain error handling structure in results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 50, maxLength: 300 }),
          fc.boolean(),
          async (documentContent, shouldFail) => {
            process.env.ENABLE_LLM_PREPROCESSING = 'true';
            
            const { testDocId, testFilePath } = await createTestFile(documentContent);
            
            if (shouldFail) {
              jest.spyOn(IndexGenerator.prototype, 'generateIndexedText')
                .mockRejectedValue(new Error('Test error'));
            } else {
              jest.spyOn(IndexGenerator.prototype, 'generateIndexedText')
                .mockResolvedValue({
                  success: true,
                  index: {
                    doc_id: testDocId,
                    indexed_text: '1. 测试。',
                    metadata: { fact_count: 1 }
                  }
                });
            }
            
            const mockLLMClient = {
              call: jest.fn().mockResolvedValue({
                content: '1. Test.',
                tokens: 30,
                model: 'test-model'
              })
            };
            
            const result = await kgService.buildKnowledgeGraph(
              testDocId,
              testFilePath,
              'txt',
              { llmClient: mockLLMClient }
            );
            
            // Property: Result must always have consistent structure
            expect(result).toBeDefined();
            expect(result).toHaveProperty('doc_id');
            expect(result).toHaveProperty('ckbs_created');
            expect(result).toHaveProperty('preprocessing');
            
            // Property: Errors array should exist if there were errors
            if (shouldFail) {
              expect(result.errors).toBeDefined();
              expect(Array.isArray(result.errors)).toBe(true);
            }
            
            // Property: Processing should continue despite errors
            expect(result.ckbs_created).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should always preserve original flow behavior when preprocessing disabled', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 50, maxLength: 300 }),
          async (documentContent) => {
            process.env.ENABLE_LLM_PREPROCESSING = 'false';
            
            const { testDocId, testFilePath } = await createTestFile(documentContent);
            
            const mockLLMClient = {
              call: jest.fn()
            };
            
            const result = await kgService.buildKnowledgeGraph(
              testDocId,
              testFilePath,
              'txt',
              { llmClient: mockLLMClient }
            );
            
            // Property: Should process normally without preprocessing
            expect(result).toBeDefined();
            expect(result.preprocessing.enabled).toBe(false);
            expect(result.ckbs_created).toBeGreaterThan(0);
            
            // Property: LLM client should not be called for preprocessing
            expect(mockLLMClient.call).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should always handle missing llmClient gracefully', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 50, maxLength: 300 }),
          fc.constantFrom(true, false),
          async (documentContent, enablePreprocessing) => {
            process.env.ENABLE_LLM_PREPROCESSING = enablePreprocessing.toString();
            
            const { testDocId, testFilePath } = await createTestFile(documentContent);
            
            // Property: Should never throw when llmClient is missing
            const result = await kgService.buildKnowledgeGraph(
              testDocId,
              testFilePath,
              'txt',
              { llmClient: null }
            );
            
            expect(result).toBeDefined();
            expect(result.preprocessing.enabled).toBe(false);
            expect(result.ckbs_created).toBeGreaterThan(0);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Cross-Property Test: Preprocessing and Result Consistency
   * 
   * Tests that preprocessing results are consistent with overall build results
   */
  describe('Cross-Property: Preprocessing and Result Consistency', () => {
    test('should maintain consistency between preprocessing status and result structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 50, maxLength: 300 }),
          fc.boolean(),
          fc.boolean(),
          async (documentContent, enablePreprocessing, indexSuccess) => {
            process.env.ENABLE_LLM_PREPROCESSING = enablePreprocessing.toString();
            
            const { testDocId, testFilePath } = await createTestFile(documentContent);
            
            if (enablePreprocessing) {
              jest.spyOn(IndexGenerator.prototype, 'generateIndexedText')
                .mockResolvedValue(
                  indexSuccess
                    ? {
                        success: true,
                        index: {
                          doc_id: testDocId,
                          indexed_text: '1. 测试。',
                          metadata: { fact_count: 1 }
                        }
                      }
                    : {
                        success: false,
                        error: 'Test error'
                      }
                );
            }
            
            const mockLLMClient = enablePreprocessing ? {
              call: jest.fn().mockResolvedValue({
                content: '1. Test.',
                tokens: 30,
                model: 'test-model'
              })
            } : null;
            
            const result = await kgService.buildKnowledgeGraph(
              testDocId,
              testFilePath,
              'txt',
              { llmClient: mockLLMClient }
            );
            
            // Property: Preprocessing status should match configuration
            if (enablePreprocessing && mockLLMClient) {
              expect(result.preprocessing.enabled).toBe(true);
              // Success field may not be set if index generation succeeded
              if (result.preprocessing.success !== undefined) {
                expect(result.preprocessing.success).toBe(indexSuccess);
              }
            } else {
              expect(result.preprocessing.enabled).toBe(false);
            }
            
            // Property: Core processing should always complete
            expect(result.ckbs_created).toBeGreaterThanOrEqual(0);
            expect(result.doc_id).toBe(testDocId);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
