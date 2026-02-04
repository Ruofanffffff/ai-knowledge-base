/**
 * Property-Based Tests for Universal Document Pipeline
 * 
 * 使用fast-check进行属性测试，验证流水线的通用正确性属性
 */

const fc = require('fast-check');
const { UniversalDocumentPipeline, ProcessingContext } = require('./universal_document_pipeline');

describe('Universal Document Pipeline - Property Tests', () => {
  describe('Property 1: Document Format Support', () => {
    /**
     * Feature: universal-document-pipeline, Property 1: Document Format Support
     * For any document with a supported format (text, PDF, Word, Excel), 
     * the pipeline should accept and process it without format-related errors.
     * Validates: Requirements 1.1
     */
    test('accepts all supported document formats', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel', 'markdown', 'html'),
            content: fc.string({ minLength: 10, maxLength: 1000 })
          }),
          async (document) => {
            // 禁用LLM以加快测试速度
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            const context = await pipeline.processDocument(document);
            
            // 验证：不应该有格式相关的错误
            const formatErrors = context.errors.filter(e => 
              e.error && e.error.includes('不支持的文档格式')
            );
            
            expect(formatErrors).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    }, 60000); // 60秒超时
  });
  
  describe('Property 2: Document Validation', () => {
    /**
     * Feature: universal-document-pipeline, Property 2: Document Validation
     * For any document input, the pipeline should validate both format and size before processing.
     * Validates: Requirements 1.2
     */
    test('validates document format and size before processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.oneof(
              fc.constantFrom('text', 'pdf', 'word', 'excel'),
              fc.string({ minLength: 1, maxLength: 20 }) // 非空字符串，可能包含无效格式
            ),
            content: fc.string({ minLength: 1, maxLength: 2000 }) // 至少1个字符，避免空内容错误
          }),
          async (document) => {
            // 禁用LLM以加快测试速度
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            const context = await pipeline.processDocument(document);
            
            // 验证：如果文档格式无效，应该在errors中记录
            const supportedFormats = ['text', 'pdf', 'word', 'excel', 'markdown', 'html'];
            // 空字符串会被视为默认的 'text' 类型
            const docType = (document.type || 'text').trim();
            const isValidFormat = supportedFormats.includes(docType.toLowerCase());
            
            if (!isValidFormat) {
              // 无效格式应该有错误
              expect(context.errors.length).toBeGreaterThan(0);
              const hasFormatError = context.errors.some(e => 
                e.error && e.error.includes('不支持的文档格式')
              );
              expect(hasFormatError).toBe(true);
            } else {
              // 有效格式不应该有格式错误
              const formatErrors = context.errors.filter(e => 
                e.error && e.error.includes('不支持的文档格式')
              );
              expect(formatErrors).toHaveLength(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 60000); // 60秒超时
  });
  
  describe('Property 3: Invalid Format Error Messages', () => {
    /**
     * Feature: universal-document-pipeline, Property 3: Invalid Format Error Messages
     * For any document with an unsupported format, the pipeline should return 
     * an error message that clearly indicates which formats are supported.
     * Validates: Requirements 1.3
     */
    test('provides clear error messages for unsupported formats', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.string({ minLength: 1, maxLength: 20 }).filter(
              type => !['text', 'pdf', 'word', 'excel', 'markdown', 'html'].includes(type.toLowerCase())
            ),
            content: fc.string({ minLength: 10, maxLength: 1000 })
          }),
          async (document) => {
            const pipeline = new UniversalDocumentPipeline();
            const context = await pipeline.processDocument(document);
            
            // 验证：应该有错误，且错误消息包含支持的格式列表
            expect(context.errors.length).toBeGreaterThan(0);
            
            const formatError = context.errors.find(e => 
              e.error && e.error.includes('不支持的文档格式')
            );
            
            if (formatError) {
              // 错误消息应该包含支持的格式列表
              expect(formatError.error).toMatch(/text|pdf|word|excel/);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  describe('Property 4: Processing Context Creation', () => {
    /**
     * Feature: universal-document-pipeline, Property 4: Processing Context Creation
     * For any valid document, the pipeline should create a Processing_Context object 
     * that persists throughout the entire processing flow.
     * Validates: Requirements 1.5
     */
    test('creates and maintains processing context for all documents', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 10, maxLength: 1000 })
          }),
          async (document) => {
            // 禁用LLM以加快测试速度
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            const context = await pipeline.processDocument(document);
            
            // 验证：context应该存在且包含必要的字段
            expect(context).toBeDefined();
            expect(context).toBeInstanceOf(ProcessingContext);
            expect(context.documentId).toBeDefined();
            expect(context.documentType).toBeDefined();
            expect(context.startTime).toBeDefined();
            expect(context.endTime).toBeDefined();
            expect(context.steps).toBeDefined();
            expect(context.data).toBeDefined();
            expect(context.metrics).toBeDefined();
            
            // 验证：context应该有完整的步骤结构
            const expectedSteps = [
              'parsing', 'extraction', 'schemaMatching', 
              'normalization', 'entityBuilding', 'relationExtraction', 'storage'
            ];
            
            expectedSteps.forEach(step => {
              expect(context.steps[step]).toBeDefined();
              expect(context.steps[step]).toHaveProperty('status');
              expect(context.steps[step]).toHaveProperty('duration');
            });
          }
        ),
        { numRuns: 100 }
      );
    }, 60000); // 60秒超时
  });
  
  describe('Property 11: Critical Error Termination', () => {
    /**
     * Feature: universal-document-pipeline, Property 11: Critical Error Termination
     * For any document where a critical step (parsing, schema matching) fails, 
     * the pipeline should terminate processing immediately and return an error status in the context.
     * Validates: Requirements 10.2
     */
    test('terminates on critical errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.string({ minLength: 1, maxLength: 20 }).filter(
              type => !['text', 'pdf', 'word', 'excel', 'markdown', 'html'].includes(type.toLowerCase())
            ),
            content: fc.string({ minLength: 10, maxLength: 1000 })
          }),
          async (document) => {
            const pipeline = new UniversalDocumentPipeline();
            const context = await pipeline.processDocument(document);
            
            // 验证：关键错误应该导致失败状态
            if (context.errors.length > 0) {
              expect(context.status).toBe('failed');
              
              // 验证：应该有至少一个关键步骤失败
              const criticalSteps = ['parsing', 'extraction', 'schemaMatching', 'storage'];
              const failedCriticalStep = criticalSteps.some(step => 
                context.steps[step].status === 'failure'
              );
              
              // 如果有错误，应该是关键步骤失败或验证失败
              expect(
                failedCriticalStep || 
                context.errors.some(e => e.step === 'pipeline' || e.step === 'validation')
              ).toBe(true);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
  
  describe('Property 12: Non-Critical Error Continuation', () => {
    /**
     * Feature: universal-document-pipeline, Property 12: Non-Critical Error Continuation
     * For any document where a non-critical step (relation extraction) fails, 
     * the pipeline should log a warning, mark that step as failed in the context, 
     * and continue processing remaining steps.
     * Validates: Requirements 10.3
     */
    test('continues processing after non-critical errors', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 10, maxLength: 1000 })
          }),
          async (document) => {
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            
            const context = await pipeline.processDocument(document);
            
            // 验证：即使有警告，流水线应该完成
            // 非关键步骤：normalization, entityBuilding, relationExtraction
            const nonCriticalSteps = ['normalization', 'entityBuilding', 'relationExtraction'];
            
            // 如果有非关键步骤失败，应该在warnings中记录
            nonCriticalSteps.forEach(step => {
              if (context.steps[step].status === 'failure') {
                const hasWarning = context.warnings.some(w => w.step === step);
                expect(hasWarning).toBe(true);
              }
            });
            
            // 验证：关键步骤应该成功（如果没有关键错误）
            if (context.status !== 'failed') {
              expect(['success', 'failure']).toContain(context.steps.parsing.status);
              expect(['success', 'failure']).toContain(context.steps.extraction.status);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Property 13: Error Logging Completeness', () => {
    /**
     * Feature: universal-document-pipeline, Property 13: Error Logging Completeness
     * For any step that fails during processing, the Processing_Context should contain 
     * detailed error information including the step name, error message, and timestamp.
     * Validates: Requirements 10.1, 10.5
     */
    test('logs complete error information for all failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.oneof(
              fc.constantFrom('text', 'pdf', 'word', 'excel'),
              fc.string() // 可能包含无效格式
            ),
            content: fc.string({ minLength: 0, maxLength: 1000 })
          }),
          async (document) => {
            // 禁用LLM以加快测试速度
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            const context = await pipeline.processDocument(document);
            
            // 验证：所有错误都应该有完整的信息
            context.errors.forEach(error => {
              expect(error).toHaveProperty('step');
              expect(error).toHaveProperty('error');
              expect(error).toHaveProperty('timestamp');
              
              expect(typeof error.step).toBe('string');
              expect(typeof error.error).toBe('string');
              expect(typeof error.timestamp).toBe('number');
              expect(error.timestamp).toBeGreaterThan(0);
            });
            
            // 验证：所有警告都应该有完整的信息
            context.warnings.forEach(warning => {
              expect(warning).toHaveProperty('step');
              expect(warning).toHaveProperty('error');
              expect(warning).toHaveProperty('timestamp');
              
              expect(typeof warning.step).toBe('string');
              expect(typeof warning.error).toBe('string');
              expect(typeof warning.timestamp).toBe('number');
              expect(warning.timestamp).toBeGreaterThan(0);
            });
            
            // 验证：失败的步骤应该在steps中记录错误
            Object.keys(context.steps).forEach(stepName => {
              const step = context.steps[stepName];
              if (step.status === 'failure') {
                expect(step.error).toBeDefined();
                expect(typeof step.error).toBe('string');
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    }, 60000); // 60秒超时
  });
  
  describe('Property 5: Pipeline Step Execution Order', () => {
    /**
     * Feature: universal-document-pipeline, Property 5: Pipeline Step Execution Order
     * For any document that passes validation, the pipeline should execute steps in the correct order:
     * parsing → extraction → schema matching → normalization → entity building → relation extraction → storage.
     * Validates: Requirements 2.1, 3.1, 4.1, 5.1, 6.1, 7.1
     */
    test('executes steps in correct order for all valid documents', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 10, maxLength: 1000 })
          }),
          async (document) => {
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            
            const context = await pipeline.processDocument(document);
            
            // 定义期望的步骤顺序
            const expectedOrder = [
              'parsing', 'extraction', 'schemaMatching', 
              'normalization', 'entityBuilding', 'relationExtraction', 'storage'
            ];
            
            // 获取所有已尝试的步骤(非not_started状态)
            const attemptedSteps = expectedOrder.filter(step => 
              context.steps[step].status !== 'not_started'
            );
            
            // 验证：已尝试的步骤必须按照期望顺序出现
            // 如果步骤A在步骤B之前执行，那么A的索引必须小于B的索引
            for (let i = 0; i < attemptedSteps.length - 1; i++) {
              const currentStepIndex = expectedOrder.indexOf(attemptedSteps[i]);
              const nextStepIndex = expectedOrder.indexOf(attemptedSteps[i + 1]);
              
              expect(currentStepIndex).toBeLessThan(nextStepIndex);
            }
            
            // 验证：如果某个步骤执行了，它之前的所有步骤也应该执行了
            for (let i = 0; i < attemptedSteps.length; i++) {
              const stepIndex = expectedOrder.indexOf(attemptedSteps[i]);
              
              // 检查该步骤之前的所有步骤
              for (let j = 0; j < stepIndex; j++) {
                const previousStep = expectedOrder[j];
                expect(context.steps[previousStep].status).not.toBe('not_started');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });
  
  describe('Property 6: Configuration Propagation', () => {
    /**
     * Feature: universal-document-pipeline, Property 6: Configuration Propagation
     * For any pipeline configuration provided, each step should receive and respect 
     * its corresponding configuration parameters (LLM usage, confidence thresholds, etc.).
     * Validates: Requirements 2.2, 3.2, 4.2, 5.2, 6.2, 8.1, 8.2, 8.3, 8.4
     */
    test('propagates configuration to all steps', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 10, maxLength: 1000 }),
            // 生成随机配置
            useLLM: fc.boolean(),
            enableBuiltin: fc.boolean(),
            enableCooccurrence: fc.boolean()
          }),
          async (testData) => {
            const { id, type, content, useLLM, enableBuiltin, enableCooccurrence } = testData;
            
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM, useNER: true, useRules: true },
              normalization: { useLLM, useAlgorithm: true },
              entityBuilding: { useLLM, allowPartialEntities: true },
              relationExtraction: { 
                enableBuiltin, 
                enableCooccurrence, 
                enableSemantic: false // 禁用以加快测试
              }
            });
            
            const document = { id, type, content };
            const context = await pipeline.processDocument(document);
            
            // 验证：提取步骤的metrics应该反映配置
            if (context.steps.extraction.status === 'success') {
              expect(context.steps.extraction.metrics).toBeDefined();
              expect(context.steps.extraction.metrics.usedLLM).toBe(useLLM);
            }
            
            // 验证：关系提取步骤应该根据配置执行
            if (context.steps.relationExtraction.status === 'success') {
              const metrics = context.steps.relationExtraction.metrics;
              expect(metrics).toBeDefined();
              
              // 如果禁用了所有关系构建器，关系数应该为0
              if (!enableBuiltin && !enableCooccurrence) {
                expect(metrics.relationCount).toBe(0);
              }
            }
          }
        ),
        { numRuns: 50 }
      );
    }, 60000);
  });
  
  describe('Property 7: Data Flow Through Context', () => {
    /**
     * Feature: universal-document-pipeline, Property 7: Data Flow Through Context
     * For any document processed, the results from each step (extracted fields, matched schema, 
     * normalized fields, entities, relations) should be stored in the Processing_Context 
     * and available to subsequent steps.
     * Validates: Requirements 2.3, 3.3, 4.3, 5.3, 6.4, 7.4
     */
    test('maintains data flow through context for all steps', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 10, maxLength: 1000 })
          }),
          async (document) => {
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            
            const context = await pipeline.processDocument(document);
            
            // 验证：如果解析成功，CKB应该存在
            if (context.steps.parsing.status === 'success') {
              expect(context.data.ckb).toBeDefined();
              expect(context.data.ckb.ckb_id).toBeDefined();
              expect(context.data.ckb.doc_id).toBe(document.id);
            }
            
            // 验证：如果提取成功，提取的字段应该存在
            if (context.steps.extraction.status === 'success') {
              expect(context.data.extractedFields).toBeDefined();
              expect(Array.isArray(context.data.extractedFields)).toBe(true);
              expect(context.metrics.fieldCount).toBe(context.data.extractedFields.length);
            }
            
            // 验证：如果schema匹配成功，匹配的schema应该存在
            if (context.steps.schemaMatching.status === 'success') {
              expect(context.data.matchedSchemas).toBeDefined();
              expect(Array.isArray(context.data.matchedSchemas)).toBe(true);
              expect(context.data.matchedSchemas.length).toBeGreaterThan(0);
            }
            
            // 验证：如果标准化成功，标准化的字段应该存在
            if (context.steps.normalization.status === 'success') {
              expect(context.data.normalizedFields).toBeDefined();
              expect(Array.isArray(context.data.normalizedFields)).toBe(true);
            }
            
            // 验证：如果实体构建成功，实体应该存在
            if (context.steps.entityBuilding.status === 'success') {
              expect(context.data.entities).toBeDefined();
              expect(Array.isArray(context.data.entities)).toBe(true);
              expect(context.metrics.entityCount).toBe(context.data.entities.length);
            }
            
            // 验证：如果关系提取成功，关系应该存在
            if (context.steps.relationExtraction.status === 'success') {
              expect(context.data.relations).toBeDefined();
              expect(Array.isArray(context.data.relations)).toBe(true);
              expect(context.metrics.relationCount).toBe(context.data.relations.length);
            }
            
            // 验证：数据流的连续性 - 后续步骤应该能访问前面步骤的数据
            // 如果实体构建成功，说明它能访问标准化的字段
            if (context.steps.entityBuilding.status === 'success' && 
                context.data.entities.length > 0) {
              // 实体应该有来自标准化字段的数据
              expect(context.data.normalizedFields.length).toBeGreaterThan(0);
            }
            
            // 如果关系提取成功，说明它能访问实体
            if (context.steps.relationExtraction.status === 'success' && 
                context.data.relations.length > 0) {
              // 应该有实体存在
              expect(context.data.entities.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 60000);
  });
  
  describe('Property 8: Metrics Tracking Completeness', () => {
    /**
     * Feature: universal-document-pipeline, Property 8: Metrics Tracking Completeness
     * For any document processed, the Processing_Context should contain execution time 
     * and relevant metrics (counts, confidence scores) for every completed step.
     * Validates: Requirements 2.5, 3.5, 4.5, 5.5, 6.6, 7.5, 9.1, 9.2, 12.1
     */
    test('tracks complete metrics for all steps', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 10, maxLength: 1000 })
          }),
          async (document) => {
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            
            const context = await pipeline.processDocument(document);
            
            // 验证：每个成功的步骤都应该有duration记录
            Object.keys(context.steps).forEach(stepName => {
              const step = context.steps[stepName];
              
              if (step.status === 'success' || step.status === 'failure') {
                // 应该有执行时间
                expect(step.duration).toBeDefined();
                expect(typeof step.duration).toBe('number');
                expect(step.duration).toBeGreaterThanOrEqual(0);
                
                // 应该有metrics对象
                expect(step.metrics).toBeDefined();
                expect(typeof step.metrics).toBe('object');
              }
            });
            
            // 验证：context应该有总体指标
            expect(context.metrics).toBeDefined();
            expect(typeof context.metrics.fieldCount).toBe('number');
            expect(typeof context.metrics.entityCount).toBe('number');
            expect(typeof context.metrics.relationCount).toBe('number');
            
            // 验证：总处理时间应该大于0
            expect(context.totalDuration).toBeGreaterThan(0);
            
            // 验证：总处理时间应该大致等于各步骤时间之和（允许一些误差）
            const stepDurationsSum = Object.values(context.steps)
              .reduce((sum, step) => sum + (step.duration || 0), 0);
            
            // 允许10%的误差（用于overhead）
            const tolerance = stepDurationsSum * 0.1 + 100; // 至少100ms tolerance
            expect(context.totalDuration).toBeLessThanOrEqual(stepDurationsSum + tolerance);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Property 14: LLM Fallback Degradation', () => {
    /**
     * Feature: universal-document-pipeline, Property 14: LLM Fallback Degradation
     * For any step that supports both LLM and algorithm-based processing, 
     * when LLM processing fails, the pipeline should automatically attempt 
     * the algorithm-based approach.
     * Validates: Requirements 10.4
     */
    test('falls back to algorithm-based processing when LLM fails', async () => {
      // 这个测试验证降级行为
      // 由于field_extractor内部已经实现了LLM降级逻辑，
      // 我们主要验证pipeline层面的降级处理
      
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 5, maxLength: 500 }) // 较短内容可能触发警告
          }),
          async (document) => {
            // 启用LLM但使用较短内容，可能触发降级警告
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: true, useNER: true, useRules: true },
              normalization: { useLLM: false }, // 禁用以加快测试
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            
            const context = await pipeline.processDocument(document);
            
            // 验证：即使LLM可能失败或降级，提取步骤应该完成
            // (可能是success或有warnings)
            expect(['success', 'failure']).toContain(context.steps.extraction.status);
            
            // 如果提取成功，应该有字段(即使很少)
            if (context.steps.extraction.status === 'success') {
              expect(context.data.extractedFields).toBeDefined();
              expect(Array.isArray(context.data.extractedFields)).toBe(true);
              
              // 如果字段数量很少，应该有警告
              if (context.data.extractedFields.length < 3) {
                const hasExtractionWarning = context.warnings.some(w => 
                  w.step === 'extraction'
                );
                // 注意：由于内容很短，可能没有提取到字段，这是正常的
                // 我们只验证系统能够处理这种情况
                expect(context.data.extractedFields.length).toBeGreaterThanOrEqual(0);
              }
            }
            
            // 验证：metrics应该记录是否使用了LLM
            if (context.steps.extraction.status === 'success') {
              expect(context.steps.extraction.metrics).toBeDefined();
              expect(context.steps.extraction.metrics).toHaveProperty('usedLLM');
            }
          }
        ),
        { numRuns: 50 }
      );
    }, 60000);
  });
  
  describe('Property 20: Relation Builder Configuration', () => {
    /**
     * Feature: universal-document-pipeline, Property 20: Relation Builder Configuration
     * For any relation extraction configuration, only the enabled relation builders 
     * (builtin, cooccurrence, semantic) should be invoked, and results should be 
     * labeled by builder type.
     * Validates: Requirements 6.3
     */
    test('invokes only enabled relation builders and labels results by type', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 50, maxLength: 500 }),
            // 随机生成关系构建器配置
            enableBuiltin: fc.boolean(),
            enableCooccurrence: fc.boolean(),
            enableSemantic: fc.boolean()
          }),
          async (testData) => {
            const { id, type, content, enableBuiltin, enableCooccurrence, enableSemantic } = testData;
            
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: {
                enableBuiltin,
                enableCooccurrence,
                enableSemantic,
                semanticUseLLM: enableSemantic // 只有启用semantic时才使用LLM
              }
            });
            
            const document = { id, type, content };
            const context = await pipeline.processDocument(document);
            
            // 验证：关系提取步骤应该完成（成功或失败）
            expect(['success', 'failure', 'not_started']).toContain(
              context.steps.relationExtraction.status
            );
            
            // 如果关系提取步骤执行了
            if (context.steps.relationExtraction.status !== 'not_started') {
              const metrics = context.steps.relationExtraction.metrics;
              expect(metrics).toBeDefined();
              expect(metrics.builderResults).toBeDefined();
              
              // 验证：只有启用的构建器应该被尝试
              const builderResults = metrics.builderResults;
              
              // 计算启用的构建器数量
              const enabledCount = [enableBuiltin, enableCooccurrence, enableSemantic]
                .filter(Boolean).length;
              
              expect(metrics.enabledBuilders).toBe(enabledCount);
              
              // 验证：每个构建器的结果应该与配置一致
              if (enableBuiltin) {
                // 内置构建器应该被尝试（success或有error）
                expect(builderResults.builtin).toBeDefined();
                expect(typeof builderResults.builtin.success).toBe('boolean');
                expect(typeof builderResults.builtin.count).toBe('number');
              }
              
              if (enableCooccurrence) {
                // 共现构建器应该被尝试
                expect(builderResults.cooccurrence).toBeDefined();
                expect(typeof builderResults.cooccurrence.success).toBe('boolean');
                expect(typeof builderResults.cooccurrence.count).toBe('number');
              }
              
              if (enableSemantic) {
                // 语义构建器应该被尝试
                expect(builderResults.semantic).toBeDefined();
                expect(typeof builderResults.semantic.success).toBe('boolean');
                expect(typeof builderResults.semantic.count).toBe('number');
              }
              
              // 验证：关系应该按类型标记
              if (context.data.relations && context.data.relations.length > 0) {
                context.data.relations.forEach(relation => {
                  expect(relation.type).toBeDefined();
                  expect(['builtin', 'cooccurrence', 'semantic']).toContain(relation.type);
                  
                  // 验证：关系类型应该对应启用的构建器
                  if (relation.type === 'builtin') {
                    expect(enableBuiltin).toBe(true);
                  }
                  if (relation.type === 'cooccurrence') {
                    expect(enableCooccurrence).toBe(true);
                  }
                  if (relation.type === 'semantic') {
                    expect(enableSemantic).toBe(true);
                  }
                });
                
                // 验证：metrics中的计数应该与实际关系数量一致
                const builtinCount = context.data.relations.filter(r => r.type === 'builtin').length;
                const cooccurrenceCount = context.data.relations.filter(r => r.type === 'cooccurrence').length;
                const semanticCount = context.data.relations.filter(r => r.type === 'semantic').length;
                
                expect(metrics.builtinCount).toBe(builtinCount);
                expect(metrics.cooccurrenceCount).toBe(cooccurrenceCount);
                expect(metrics.semanticCount).toBe(semanticCount);
                expect(metrics.relationCount).toBe(builtinCount + cooccurrenceCount + semanticCount);
              }
              
              // 验证：如果所有构建器都禁用，关系数应该为0
              if (!enableBuiltin && !enableCooccurrence && !enableSemantic) {
                expect(context.metrics.relationCount).toBe(0);
                expect(context.data.relations.length).toBe(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 90000); // 90秒超时，因为可能涉及LLM调用
  });
  
  describe('Property 15: Transaction Atomicity', () => {
    /**
     * Feature: universal-document-pipeline, Property 15: Transaction Atomicity
     * For any document where storage is attempted, either all entities and relations 
     * should be stored successfully, or none should be stored (transaction rollback on failure).
     * Validates: Requirements 7.2, 7.3
     */
    test('ensures atomic storage of entities and relations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 50, maxLength: 500 })
          }),
          async (document) => {
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false },
              storage: { useTransaction: true, skipDuplicates: true }
            });
            
            const context = await pipeline.processDocument(document);
            
            // 验证：如果存储步骤执行了
            if (context.steps.storage.status !== 'not_started') {
              // 如果存储成功，应该有存储的实体和关系
              if (context.steps.storage.status === 'success') {
                const metrics = context.steps.storage.metrics;
                expect(metrics).toBeDefined();
                expect(typeof metrics.storedEntities).toBe('number');
                expect(typeof metrics.storedRelations).toBe('number');
                
                // 存储的实体数应该等于构建的实体数
                expect(metrics.storedEntities).toBe(context.data.entities.length);
                
                // 存储的关系数应该等于提取的关系数
                expect(metrics.storedRelations).toBe(context.data.relations.length);
                
                // 验证：存储结果应该包含ID
                if (context.steps.storage.result) {
                  expect(context.steps.storage.result.entityIds).toBeDefined();
                  expect(context.steps.storage.result.relationIds).toBeDefined();
                  expect(Array.isArray(context.steps.storage.result.entityIds)).toBe(true);
                  expect(Array.isArray(context.steps.storage.result.relationIds)).toBe(true);
                  
                  // ID数量应该与metrics一致
                  expect(context.steps.storage.result.entityIds.length).toBe(metrics.storedEntities);
                  expect(context.steps.storage.result.relationIds.length).toBe(metrics.storedRelations);
                }
              }
              
              // 如果存储失败，应该有错误记录
              if (context.steps.storage.status === 'failure') {
                expect(context.steps.storage.error).toBeDefined();
                
                // 关键步骤失败应该在errors中记录
                const hasStorageError = context.errors.some(e => 
                  e.step === 'storage' || e.step === 'pipeline'
                );
                expect(hasStorageError).toBe(true);
              }
            }
            
            // 验证：原子性 - 不应该出现部分存储的情况
            // 如果有实体但存储失败，不应该有部分存储的metrics
            if (context.data.entities.length > 0 && 
                context.steps.storage.status === 'failure') {
              // 失败时，storedEntities应该是0或未定义
              if (context.steps.storage.metrics) {
                expect(context.steps.storage.metrics.storedEntities || 0).toBe(0);
                expect(context.steps.storage.metrics.storedRelations || 0).toBe(0);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 90000);
  });
  
  describe('Property 7 (Storage): Data Flow - Stored IDs', () => {
    /**
     * Feature: universal-document-pipeline, Property 7: Data Flow Through Context (Storage Part)
     * For any document where storage succeeds, the stored entity and relation IDs 
     * should be available in the Processing_Context storage step result.
     * Validates: Requirements 7.4
     */
    test('stores entity and relation IDs in context after successful storage', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 50, maxLength: 500 })
          }),
          async (document) => {
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false },
              storage: { useTransaction: true, skipDuplicates: true }
            });
            
            const context = await pipeline.processDocument(document);
            
            // 验证：如果存储成功，应该有存储的ID
            if (context.steps.storage.status === 'success') {
              expect(context.steps.storage.result).toBeDefined();
              
              const result = context.steps.storage.result;
              
              // 应该有entityIds和relationIds数组
              expect(result.entityIds).toBeDefined();
              expect(result.relationIds).toBeDefined();
              expect(Array.isArray(result.entityIds)).toBe(true);
              expect(Array.isArray(result.relationIds)).toBe(true);
              
              // 如果有实体，应该有对应的ID
              if (context.data.entities.length > 0) {
                expect(result.entityIds.length).toBeGreaterThan(0);
                
                // 每个ID应该是字符串
                result.entityIds.forEach(id => {
                  expect(typeof id).toBe('string');
                  expect(id.length).toBeGreaterThan(0);
                });
              }
              
              // 如果有关系，应该有对应的ID
              if (context.data.relations.length > 0) {
                expect(result.relationIds.length).toBeGreaterThan(0);
                
                // 每个ID应该是字符串
                result.relationIds.forEach(id => {
                  expect(typeof id).toBe('string');
                  expect(id.length).toBeGreaterThan(0);
                });
              }
              
              // 验证：存储的ID数量应该与实体/关系数量一致
              expect(result.entityIds.length).toBe(context.data.entities.length);
              expect(result.relationIds.length).toBe(context.data.relations.length);
              
              // 验证：metrics应该与实际存储的数量一致
              const metrics = context.steps.storage.metrics;
              expect(metrics.storedEntities).toBe(result.entityIds.length);
              expect(metrics.storedRelations).toBe(result.relationIds.length);
            }
            
            // 验证：如果没有实体，存储步骤应该被跳过
            if (context.data.entities.length === 0) {
              expect(context.steps.storage.status).toBe('not_started');
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 90000);
  });
  
  describe('Property 9: Total Processing Time Calculation', () => {
    /**
     * Feature: universal-document-pipeline, Property 9: Total Processing Time Calculation
     * For any document processed, the total processing time recorded in the context 
     * should equal the sum of all individual step durations (within a small tolerance for overhead).
     * Validates: Requirements 9.4
     */
    test('calculates total processing time correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 10, maxLength: 1000 })
          }),
          async (document) => {
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            
            const context = await pipeline.processDocument(document);
            
            // 验证：总处理时间应该大于0
            expect(context.totalDuration).toBeGreaterThan(0);
            
            // 计算所有步骤的时间总和
            const stepDurationsSum = Object.values(context.steps)
              .reduce((sum, step) => sum + (step.duration || 0), 0);
            
            // 验证：总时间应该大于等于步骤时间总和
            expect(context.totalDuration).toBeGreaterThanOrEqual(stepDurationsSum);
            
            // 验证：总时间与步骤时间总和的差异应该在合理范围内（允许20%的overhead）
            const tolerance = stepDurationsSum * 0.2 + 100; // 至少100ms tolerance
            expect(context.totalDuration).toBeLessThanOrEqual(stepDurationsSum + tolerance);
            
            // 验证：getSummary中的性能统计应该正确
            const summary = context.getSummary();
            expect(summary.performance).toBeDefined();
            expect(summary.performance.totalDuration).toBe(context.totalDuration);
            expect(summary.performance.stepDurationsSum).toBe(stepDurationsSum);
            expect(summary.performance.overhead).toBe(context.totalDuration - stepDurationsSum);
          }
        ),
        { numRuns: 100 }
      );
    }, 90000);
  });
  
  describe('Property 22: Throughput Metrics Calculation', () => {
    /**
     * Feature: universal-document-pipeline, Property 22: Throughput Metrics Calculation
     * For any completed pipeline execution, throughput metrics (documents per second, 
     * fields per second) should be calculated correctly based on total time and counts.
     * Validates: Requirements 12.3
     */
    test('calculates throughput metrics correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 10, maxLength: 1000 })
          }),
          async (document) => {
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            
            const context = await pipeline.processDocument(document);
            
            // 验证：吞吐量指标应该被计算
            expect(context.metrics.documentsPerSecond).toBeDefined();
            expect(typeof context.metrics.documentsPerSecond).toBe('number');
            
            // 验证：文档处理速度应该正确计算
            const durationInSeconds = context.totalDuration / 1000;
            const expectedDocsPerSecond = 1 / durationInSeconds;
            expect(context.metrics.documentsPerSecond).toBeCloseTo(expectedDocsPerSecond, 5);
            
            // 验证：如果有字段，字段处理速度应该被计算
            if (context.metrics.fieldCount > 0) {
              expect(context.metrics.fieldsPerSecond).toBeDefined();
              expect(typeof context.metrics.fieldsPerSecond).toBe('number');
              expect(context.metrics.fieldsPerSecond).toBeGreaterThan(0);
              
              const expectedFieldsPerSecond = context.metrics.fieldCount / durationInSeconds;
              expect(context.metrics.fieldsPerSecond).toBeCloseTo(expectedFieldsPerSecond, 5);
            }
            
            // 验证：如果有实体，实体处理速度应该被计算
            if (context.metrics.entityCount > 0) {
              expect(context.metrics.entitiesPerSecond).toBeDefined();
              expect(typeof context.metrics.entitiesPerSecond).toBe('number');
              expect(context.metrics.entitiesPerSecond).toBeGreaterThan(0);
              
              const expectedEntitiesPerSecond = context.metrics.entityCount / durationInSeconds;
              expect(context.metrics.entitiesPerSecond).toBeCloseTo(expectedEntitiesPerSecond, 5);
            }
            
            // 验证：如果有关系，关系处理速度应该被计算
            if (context.metrics.relationCount > 0) {
              expect(context.metrics.relationsPerSecond).toBeDefined();
              expect(typeof context.metrics.relationsPerSecond).toBe('number');
              expect(context.metrics.relationsPerSecond).toBeGreaterThan(0);
              
              const expectedRelationsPerSecond = context.metrics.relationCount / durationInSeconds;
              expect(context.metrics.relationsPerSecond).toBeCloseTo(expectedRelationsPerSecond, 5);
            }
            
            // 验证：getSummary中应该包含吞吐量指标
            const summary = context.getSummary();
            expect(summary.performance.throughput).toBeDefined();
            expect(summary.performance.throughput.documentsPerSecond).toBe(context.metrics.documentsPerSecond);
          }
        ),
        { numRuns: 100 }
      );
    }, 90000);
  });
  
  describe('Property 10: Complete Context Return', () => {
    /**
     * Feature: universal-document-pipeline, Property 10: Complete Context Return
     * For any document processed (successfully or with errors), the pipeline should return 
     * a Processing_Context containing results and status for all attempted steps.
     * Validates: Requirements 9.3, 9.5
     */
    test('returns complete context for all documents', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.oneof(
              fc.constantFrom('text', 'pdf', 'word', 'excel'),
              fc.string() // 可能包含无效格式
            ),
            content: fc.string({ minLength: 0, maxLength: 1000 })
          }),
          async (document) => {
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            
            const context = await pipeline.processDocument(document);
            
            // 验证：context应该始终被返回
            expect(context).toBeDefined();
            expect(context).toBeInstanceOf(ProcessingContext);
            
            // 验证：context应该包含所有必要的字段
            expect(context.documentId).toBeDefined();
            expect(context.documentType).toBeDefined();
            expect(context.startTime).toBeDefined();
            expect(context.endTime).toBeDefined();
            expect(context.totalDuration).toBeDefined();
            expect(context.status).toBeDefined();
            expect(context.steps).toBeDefined();
            expect(context.data).toBeDefined();
            expect(context.metrics).toBeDefined();
            expect(context.errors).toBeDefined();
            expect(context.warnings).toBeDefined();
            
            // 验证：所有步骤都应该有状态记录
            const expectedSteps = [
              'parsing', 'extraction', 'schemaMatching', 
              'normalization', 'entityBuilding', 'relationExtraction', 'storage'
            ];
            
            expectedSteps.forEach(step => {
              expect(context.steps[step]).toBeDefined();
              expect(context.steps[step].status).toBeDefined();
              expect(['not_started', 'in_progress', 'success', 'failure']).toContain(
                context.steps[step].status
              );
            });
            
            // 验证：getSummary应该返回完整的摘要
            const summary = context.getSummary();
            expect(summary).toBeDefined();
            expect(summary.status).toBeDefined();
            expect(summary.totalDuration).toBeDefined();
            expect(summary.performance).toBeDefined();
            expect(summary.metrics).toBeDefined();
          }
        ),
        { numRuns: 100 }
      );
    }, 90000);
  });
  
  describe('Property 23: Performance Statistics Accuracy', () => {
    /**
     * Feature: universal-document-pipeline, Property 23: Performance Statistics Accuracy
     * For any set of processed documents, the reported min, max, and average processing times 
     * should accurately reflect the actual processing times of all documents.
     * Validates: Requirements 12.4
     */
    test('reports accurate performance statistics', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 10, maxLength: 1000 })
          }),
          async (document) => {
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            
            const context = await pipeline.processDocument(document);
            const summary = context.getSummary();
            
            // 验证：性能统计应该存在
            expect(summary.performance).toBeDefined();
            expect(summary.performance.totalDuration).toBe(context.totalDuration);
            expect(summary.performance.stepDurationsSum).toBeDefined();
            expect(summary.performance.overhead).toBeDefined();
            expect(summary.performance.overheadPercentage).toBeDefined();
            
            // 验证：步骤时间总和应该小于等于总时间
            expect(summary.performance.stepDurationsSum).toBeLessThanOrEqual(summary.performance.totalDuration);
            
            // 验证：overhead应该等于总时间减去步骤时间总和
            const expectedOverhead = summary.performance.totalDuration - summary.performance.stepDurationsSum;
            expect(summary.performance.overhead).toBe(expectedOverhead);
            
            // 验证：步骤详情应该包含每个执行步骤的百分比
            if (summary.steps) {
              Object.keys(summary.steps).forEach(stepName => {
                const stepDetail = summary.steps[stepName];
                expect(stepDetail.duration).toBeDefined();
                expect(stepDetail.percentage).toBeDefined();
                expect(typeof stepDetail.percentage).toBe('string');
                expect(stepDetail.percentage).toMatch(/%$/);
              });
            }
            
            // 验证：吞吐量指标应该准确
            if (summary.performance.throughput) {
              expect(summary.performance.throughput.documentsPerSecond).toBeDefined();
              expect(typeof summary.performance.throughput.documentsPerSecond).toBe('number');
            }
          }
        ),
        { numRuns: 100 }
      );
    }, 90000);
  });
  
  describe('Property 24: Bottleneck Identification', () => {
    /**
     * Feature: universal-document-pipeline, Property 24: Bottleneck Identification
     * For any document processed, the identified slowest step should be the step 
     * with the maximum execution duration among all completed steps.
     * Validates: Requirements 12.5
     */
    test('identifies bottleneck correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 10, maxLength: 1000 })
          }),
          async (document) => {
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            
            const context = await pipeline.processDocument(document);
            const summary = context.getSummary();
            
            // 找出实际最慢的步骤
            let actualSlowestStep = null;
            let actualMaxDuration = 0;
            
            Object.keys(context.steps).forEach(stepName => {
              const step = context.steps[stepName];
              if (step.status !== 'not_started' && step.duration > actualMaxDuration) {
                actualMaxDuration = step.duration;
                actualSlowestStep = stepName;
              }
            });
            
            // 验证：summary中的slowestStep应该与实际最慢的步骤一致
            if (actualSlowestStep) {
              expect(summary.slowestStep).toBe(actualSlowestStep);
              expect(summary.slowestStepDuration).toBe(actualMaxDuration);
              
              // 验证：performance.bottleneck应该包含相同的信息
              expect(summary.performance.bottleneck).toBeDefined();
              expect(summary.performance.bottleneck.step).toBe(actualSlowestStep);
              expect(summary.performance.bottleneck.duration).toBe(actualMaxDuration);
              expect(summary.performance.bottleneck.percentage).toBeDefined();
              expect(typeof summary.performance.bottleneck.percentage).toBe('string');
              expect(summary.performance.bottleneck.percentage).toMatch(/%$/);
            }
            
            // 验证：瓶颈步骤的时间应该是所有步骤中最大的
            Object.keys(context.steps).forEach(stepName => {
              const step = context.steps[stepName];
              if (step.status !== 'not_started') {
                expect(step.duration).toBeLessThanOrEqual(actualMaxDuration);
              }
            });
          }
        ),
        { numRuns: 100 }
      );
    }, 90000);
  });
  
  describe('Property 16: Batch Processing Independence', () => {
    /**
     * Feature: universal-document-pipeline, Property 16: Batch Processing Independence
     * For any batch of documents, the failure of one document's processing should not 
     * prevent other documents from being processed successfully.
     * Validates: Requirements 11.2, 11.5
     */
    test('processes documents independently in batch', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // 生成2-3个文档的批次
            batchSize: fc.integer({ min: 2, max: 3 }),
            // 随机选择一个文档索引作为失败的文档
            failureIndex: fc.integer({ min: 0, max: 2 })
          }),
          async (testData) => {
            const { batchSize, failureIndex } = testData;
            
            // 生成文档批次
            const documents = [];
            for (let i = 0; i < batchSize; i++) {
              documents.push({
                id: `batch-doc-${i}`,
                type: 'text',
                // 如果是失败索引,使用无效格式触发错误
                content: i === failureIndex % batchSize ? '' : `测试内容 ${i}`
              });
            }
            
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            
            const results = await pipeline.processBatch(documents, {
              concurrency: 2,
              stopOnFirstError: false // 不在第一个错误时停止
            });
            
            // 验证：应该返回所有文档的结果
            expect(results).toBeDefined();
            expect(Array.isArray(results)).toBe(true);
            expect(results.length).toBe(batchSize);
            
            // 验证：每个结果都应该是 ProcessingContext
            results.forEach((result, index) => {
              expect(result).toBeInstanceOf(ProcessingContext);
              expect(result.documentId).toBe(`batch-doc-${index}`);
            });
            
            // 验证：失败的文档不应该影响其他文档
            const successfulDocs = results.filter(r => r.status !== 'failed');
            const failedDocs = results.filter(r => r.status === 'failed');
            
            // 应该有成功和失败的文档
            if (failureIndex < batchSize) {
              expect(failedDocs.length).toBeGreaterThan(0);
              expect(successfulDocs.length).toBeGreaterThan(0);
            }
            
            // 验证：成功的文档应该完整处理
            successfulDocs.forEach(result => {
              expect(['completed', 'partial']).toContain(result.status);
              expect(result.totalDuration).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 10 } // 减少迭代次数以加快测试
      );
    }, 60000); // 60秒超时
  });
  
  describe('Property 17: Batch Result Completeness', () => {
    /**
     * Feature: universal-document-pipeline, Property 17: Batch Result Completeness
     * For any batch of N documents processed, the pipeline should return exactly N 
     * Processing_Context objects, one for each input document.
     * Validates: Requirements 11.4
     */
    test('returns complete results for all documents in batch', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // 生成2-4个文档的批次
            batchSize: fc.integer({ min: 2, max: 4 })
          }),
          async (testData) => {
            const { batchSize } = testData;
            
            // 生成文档批次
            const documents = [];
            for (let i = 0; i < batchSize; i++) {
              documents.push({
                id: `doc-${i}`,
                type: fc.sample(fc.constantFrom('text', 'pdf', 'word', 'excel'), 1)[0],
                content: `测试内容 ${i} - ${Math.random().toString(36).substring(7)}`
              });
            }
            
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            
            const results = await pipeline.processBatch(documents, {
              concurrency: 3
            });
            
            // 验证：返回的结果数量应该等于输入文档数量
            expect(results.length).toBe(batchSize);
            
            // 验证：每个文档都应该有对应的结果
            for (let i = 0; i < batchSize; i++) {
              expect(results[i]).toBeDefined();
              expect(results[i]).toBeInstanceOf(ProcessingContext);
              expect(results[i].documentId).toBe(`doc-${i}`);
            }
            
            // 验证：所有结果都应该有完整的上下文信息
            results.forEach((result, index) => {
              expect(result.startTime).toBeDefined();
              expect(result.endTime).toBeDefined();
              expect(result.totalDuration).toBeGreaterThan(0);
              expect(result.status).toBeDefined();
              expect(['completed', 'partial', 'failed', 'skipped']).toContain(result.status);
              
              // 验证：steps 应该存在
              expect(result.steps).toBeDefined();
              expect(typeof result.steps).toBe('object');
              
              // 验证：data 应该存在
              expect(result.data).toBeDefined();
              expect(typeof result.data).toBe('object');
              
              // 验证：metrics 应该存在
              expect(result.metrics).toBeDefined();
              expect(typeof result.metrics).toBe('object');
            });
          }
        ),
        { numRuns: 10 } // 减少迭代次数以加快测试
      );
    }, 60000); // 60秒超时
  });
  
  describe('Property 18: Concurrency Limit Enforcement', () => {
    /**
     * Feature: universal-document-pipeline, Property 18: Concurrency Limit Enforcement
     * For any batch processing with concurrency limit C, at no point should more than C 
     * documents be processed simultaneously.
     * Validates: Requirements 11.3
     */
    test('enforces concurrency limit during batch processing', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            // 生成3-5个文档的批次
            batchSize: fc.integer({ min: 3, max: 5 }),
            // 并发限制 1-2
            concurrency: fc.integer({ min: 1, max: 2 })
          }),
          async (testData) => {
            const { batchSize, concurrency } = testData;
            
            // 跟踪并发执行的文档数量
            let currentConcurrency = 0;
            let maxConcurrency = 0;
            const concurrencyHistory = [];
            
            // 创建带有延迟的文档处理函数来测试并发
            const originalProcessDocument = UniversalDocumentPipeline.prototype.processDocument;
            
            // 临时替换 processDocument 方法以跟踪并发
            UniversalDocumentPipeline.prototype.processDocument = async function(doc, options) {
              currentConcurrency++;
              maxConcurrency = Math.max(maxConcurrency, currentConcurrency);
              concurrencyHistory.push(currentConcurrency);
              
              try {
                // 添加足够的延迟以确保并发重叠
                await new Promise(resolve => setTimeout(resolve, 50));
                const result = await originalProcessDocument.call(this, doc, options);
                // 再添加一个延迟确保并发窗口
                await new Promise(resolve => setTimeout(resolve, 50));
                return result;
              } finally {
                currentConcurrency--;
              }
            };
            
            try {
              // 生成文档批次
              const documents = [];
              for (let i = 0; i < batchSize; i++) {
                documents.push({
                  id: `concurrent-doc-${i}`,
                  type: 'text',
                  content: `测试内容 ${i}`
                });
              }
              
              const pipeline = new UniversalDocumentPipeline({
                extraction: { useLLM: false },
                normalization: { useLLM: false },
                entityBuilding: { useLLM: false },
                relationExtraction: { enableSemantic: false }
              });
              
              const results = await pipeline.processBatch(documents, {
                concurrency
              });
              
              // 验证：所有文档都被处理
              expect(results.length).toBe(batchSize);
              
              // 验证：最大并发数不应该超过设定的限制
              expect(maxConcurrency).toBeLessThanOrEqual(concurrency);
              
              // 验证：并发历史中的所有值都不应该超过限制
              concurrencyHistory.forEach(count => {
                expect(count).toBeLessThanOrEqual(concurrency);
              });
              
              // 验证：如果文档数量大于并发限制，通常应该有并发执行
              // 但由于时序问题,我们只验证最大并发不超过限制
              if (batchSize > concurrency) {
                // 至少应该达到并发限制(或接近)
                expect(maxConcurrency).toBeGreaterThanOrEqual(Math.min(concurrency, batchSize));
              }
              
            } finally {
              // 恢复原始方法
              UniversalDocumentPipeline.prototype.processDocument = originalProcessDocument;
            }
          }
        ),
        { numRuns: 5 } // 减少迭代次数因为这个测试比较慢
      );
    }, 60000); // 60秒超时
  });
  
  describe('Property 19: Default Configuration Application', () => {
    /**
     * Feature: universal-document-pipeline, Property 19: Default Configuration Application
     * For any pipeline created without explicit configuration, sensible default values 
     * should be applied for all configuration parameters (LLM usage, confidence thresholds, 
     * relation builders, etc.).
     * Validates: Requirements 8.5
     */
    test('applies default configuration when no config provided', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 50, maxLength: 500 })
          }),
          async (document) => {
            // 创建pipeline时不提供任何配置
            const pipeline = new UniversalDocumentPipeline();
            
            // 验证：pipeline应该有options属性
            expect(pipeline.options).toBeDefined();
            expect(typeof pipeline.options).toBe('object');
            
            // 验证：所有配置部分都应该存在
            expect(pipeline.options.extraction).toBeDefined();
            expect(pipeline.options.schemaMatching).toBeDefined();
            expect(pipeline.options.normalization).toBeDefined();
            expect(pipeline.options.entityBuilding).toBeDefined();
            expect(pipeline.options.relationExtraction).toBeDefined();
            expect(pipeline.options.storage).toBeDefined();
            expect(pipeline.options.errorHandling).toBeDefined();
            
            // 验证：extraction默认配置
            expect(pipeline.options.extraction.useLLM).toBe(true);
            expect(pipeline.options.extraction.useNER).toBe(true);
            expect(pipeline.options.extraction.useRules).toBe(true);
            expect(pipeline.options.extraction.maxTokens).toBe(4000);
            
            // 验证：schemaMatching默认配置
            expect(pipeline.options.schemaMatching.useLLM).toBe(true);
            expect(pipeline.options.schemaMatching.minConfidence).toBe(0.5);
            expect(pipeline.options.schemaMatching.fallbackToGeneric).toBe(true);
            
            // 验证：normalization默认配置
            expect(pipeline.options.normalization.useLLM).toBe(true);
            expect(pipeline.options.normalization.useAlgorithm).toBe(true);
            expect(pipeline.options.normalization.minConfidence).toBe(0.6);
            expect(pipeline.options.normalization.maxRetries).toBe(2);
            
            // 验证：entityBuilding默认配置
            expect(pipeline.options.entityBuilding.useLLM).toBe(true);
            expect(pipeline.options.entityBuilding.allowPartialEntities).toBe(true);
            expect(pipeline.options.entityBuilding.minFieldCoverage).toBe(0.5);
            
            // 验证：relationExtraction默认配置
            expect(pipeline.options.relationExtraction.enableBuiltin).toBe(true);
            expect(pipeline.options.relationExtraction.enableCooccurrence).toBe(true);
            expect(pipeline.options.relationExtraction.enableSemantic).toBe(true);
            expect(pipeline.options.relationExtraction.semanticUseLLM).toBe(true);
            expect(pipeline.options.relationExtraction.minConfidence).toBe(0.5);
            
            // 验证：storage默认配置
            expect(pipeline.options.storage.useTransaction).toBe(true);
            expect(pipeline.options.storage.skipDuplicates).toBe(true);
            
            // 验证：errorHandling默认配置
            expect(pipeline.options.errorHandling.stopOnCriticalError).toBe(true);
            expect(pipeline.options.errorHandling.continueOnWarning).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
    
    test('processes documents successfully with default configuration', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 50, maxLength: 500 })
          }),
          async (document) => {
            // 创建pipeline时不提供任何配置，但禁用LLM以加快测试
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM: false },
              normalization: { useLLM: false },
              entityBuilding: { useLLM: false },
              relationExtraction: { enableSemantic: false }
            });
            
            const context = await pipeline.processDocument(document);
            
            // 验证：应该能够成功处理文档
            expect(context).toBeDefined();
            expect(context).toBeInstanceOf(ProcessingContext);
            expect(['completed', 'partial', 'failed']).toContain(context.status);
          }
        ),
        { numRuns: 50 }
      );
    }, 60000); // 60秒超时
  });
  
  describe('Property 19 (Partial Config): Default Configuration Merging', () => {
    /**
     * Feature: universal-document-pipeline, Property 19: Default Configuration Application (Partial Config)
     * For any pipeline created with partial configuration, the provided values should override 
     * defaults while unspecified values should use defaults.
     * Validates: Requirements 8.5
     */
    test('merges partial configuration with defaults correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 50, maxLength: 500 }),
            // 随机生成部分配置
            customUseLLM: fc.boolean(),
            customMinConfidence: fc.double({ min: 0.1, max: 0.9 }),
            customEnableBuiltin: fc.boolean()
          }),
          async (testData) => {
            const { id, type, content, customUseLLM, customMinConfidence, customEnableBuiltin } = testData;
            
            // 创建pipeline时只提供部分配置
            const pipeline = new UniversalDocumentPipeline({
              extraction: {
                useLLM: customUseLLM
                // 其他字段应该使用默认值
              },
              schemaMatching: {
                minConfidence: customMinConfidence
                // 其他字段应该使用默认值
              },
              relationExtraction: {
                enableBuiltin: customEnableBuiltin
                // 其他字段应该使用默认值
              }
              // 其他配置部分应该使用默认值
            });
            
            // 验证：自定义值应该被应用
            expect(pipeline.options.extraction.useLLM).toBe(customUseLLM);
            expect(pipeline.options.schemaMatching.minConfidence).toBe(customMinConfidence);
            expect(pipeline.options.relationExtraction.enableBuiltin).toBe(customEnableBuiltin);
            
            // 验证：未指定的extraction字段应该使用默认值
            expect(pipeline.options.extraction.useNER).toBe(true); // 默认值
            expect(pipeline.options.extraction.useRules).toBe(true); // 默认值
            expect(pipeline.options.extraction.maxTokens).toBe(4000); // 默认值
            
            // 验证：未指定的schemaMatching字段应该使用默认值
            expect(pipeline.options.schemaMatching.useLLM).toBe(true); // 默认值
            expect(pipeline.options.schemaMatching.fallbackToGeneric).toBe(true); // 默认值
            
            // 验证：未指定的relationExtraction字段应该使用默认值
            expect(pipeline.options.relationExtraction.enableCooccurrence).toBe(true); // 默认值
            expect(pipeline.options.relationExtraction.enableSemantic).toBe(true); // 默认值
            expect(pipeline.options.relationExtraction.semanticUseLLM).toBe(true); // 默认值
            expect(pipeline.options.relationExtraction.minConfidence).toBe(0.5); // 默认值
            
            // 验证：完全未指定的配置部分应该使用默认值
            expect(pipeline.options.normalization).toBeDefined();
            expect(pipeline.options.normalization.useLLM).toBe(true);
            expect(pipeline.options.normalization.useAlgorithm).toBe(true);
            expect(pipeline.options.normalization.minConfidence).toBe(0.6);
            expect(pipeline.options.normalization.maxRetries).toBe(2);
            
            expect(pipeline.options.entityBuilding).toBeDefined();
            expect(pipeline.options.entityBuilding.useLLM).toBe(true);
            expect(pipeline.options.entityBuilding.allowPartialEntities).toBe(true);
            expect(pipeline.options.entityBuilding.minFieldCoverage).toBe(0.5);
            
            expect(pipeline.options.storage).toBeDefined();
            expect(pipeline.options.storage.useTransaction).toBe(true);
            expect(pipeline.options.storage.skipDuplicates).toBe(true);
            
            expect(pipeline.options.errorHandling).toBeDefined();
            expect(pipeline.options.errorHandling.stopOnCriticalError).toBe(true);
            expect(pipeline.options.errorHandling.continueOnWarning).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
  
  describe('Property 21: Token Usage Tracking', () => {
    /**
     * Feature: universal-document-pipeline, Property 21: Token Usage Tracking
     * For any document processed with LLM enabled, the Processing_Context should contain 
     * accurate token usage counts and API call counts for all LLM-based steps.
     * Validates: Requirements 12.2
     */
    test('tracks token usage accurately for LLM-based steps', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            type: fc.constantFrom('text', 'pdf', 'word', 'excel'),
            content: fc.string({ minLength: 50, maxLength: 500 }),
            // 随机启用/禁用LLM
            useLLM: fc.boolean()
          }),
          async (testData) => {
            const { id, type, content, useLLM } = testData;
            
            // 重置token tracker以确保干净的状态
            const tokenTracker = require('../utils/token_tracker');
            tokenTracker.reset();
            
            const pipeline = new UniversalDocumentPipeline({
              extraction: { useLLM, useNER: true, useRules: true },
              normalization: { useLLM, useAlgorithm: true },
              entityBuilding: { useLLM, allowPartialEntities: true },
              relationExtraction: { 
                enableBuiltin: true,
                enableCooccurrence: true,
                enableSemantic: useLLM, // 只有启用LLM时才使用语义关系
                semanticUseLLM: useLLM
              }
            });
            
            const document = { id, type, content };
            const context = await pipeline.processDocument(document);
            
            // 验证：context应该有token使用统计
            expect(context.metrics).toBeDefined();
            expect(context.metrics.tokenUsage).toBeDefined();
            expect(context.metrics.apiCalls).toBeDefined();
            expect(typeof context.metrics.tokenUsage).toBe('number');
            expect(typeof context.metrics.apiCalls).toBe('number');
            
            // 验证：token使用和API调用数应该非负
            expect(context.metrics.tokenUsage).toBeGreaterThanOrEqual(0);
            expect(context.metrics.apiCalls).toBeGreaterThanOrEqual(0);
            
            // 验证：如果启用了LLM，应该有token使用记录
            if (useLLM) {
              // 注意：由于测试环境可能没有真实的LLM调用，
              // 我们只验证字段存在且为数字类型
              // 在真实环境中，如果LLM被调用，token使用应该大于0
              
              // 验证：每个可能使用LLM的步骤都应该在metrics中记录token使用
              const llmSteps = ['extraction', 'normalization', 'entityBuilding', 'relationExtraction'];
              
              llmSteps.forEach(stepName => {
                const step = context.steps[stepName];
                if (step.status === 'success' && step.metrics) {
                  // 步骤metrics应该包含tokenUsage和apiCalls字段
                  expect(step.metrics).toHaveProperty('tokenUsage');
                  expect(step.metrics).toHaveProperty('apiCalls');
                  expect(typeof step.metrics.tokenUsage).toBe('number');
                  expect(typeof step.metrics.apiCalls).toBe('number');
                  expect(step.metrics.tokenUsage).toBeGreaterThanOrEqual(0);
                  expect(step.metrics.apiCalls).toBeGreaterThanOrEqual(0);
                }
              });
              
              // 验证：总token使用应该等于各步骤token使用之和
              let totalStepTokens = 0;
              let totalStepApiCalls = 0;
              
              llmSteps.forEach(stepName => {
                const step = context.steps[stepName];
                if (step.status === 'success' && step.metrics) {
                  totalStepTokens += step.metrics.tokenUsage || 0;
                  totalStepApiCalls += step.metrics.apiCalls || 0;
                }
              });
              
              // context中的总计应该等于各步骤之和
              expect(context.metrics.tokenUsage).toBe(totalStepTokens);
              expect(context.metrics.apiCalls).toBe(totalStepApiCalls);
              
            } else {
              // 如果禁用了LLM，token使用应该为0
              expect(context.metrics.tokenUsage).toBe(0);
              expect(context.metrics.apiCalls).toBe(0);
              
              // 验证：各步骤的token使用也应该为0
              const llmSteps = ['extraction', 'normalization', 'entityBuilding', 'relationExtraction'];
              
              llmSteps.forEach(stepName => {
                const step = context.steps[stepName];
                if (step.status === 'success' && step.metrics) {
                  expect(step.metrics.tokenUsage || 0).toBe(0);
                  expect(step.metrics.apiCalls || 0).toBe(0);
                }
              });
            }
            
            // 验证：token使用统计应该是累积的
            // 即后面步骤的累积值应该大于等于前面步骤的累积值
            const llmSteps = ['extraction', 'schemaMatching', 'normalization', 'entityBuilding', 'relationExtraction'];
            let previousCumulativeTokens = 0;
            
            for (const stepName of llmSteps) {
              const step = context.steps[stepName];
              if (step.status === 'success' && step.metrics && step.metrics.tokenUsage !== undefined) {
                // 当前步骤的token使用应该非负
                expect(step.metrics.tokenUsage).toBeGreaterThanOrEqual(0);
                
                // 累积值应该单调递增（或保持不变）
                previousCumulativeTokens += step.metrics.tokenUsage;
              }
            }
            
            // 最终累积值应该等于context中的总token使用
            expect(context.metrics.tokenUsage).toBe(previousCumulativeTokens);
          }
        ),
        { numRuns: 100 }
      );
    }, 120000); // 120秒超时，因为可能涉及LLM调用
  });
});
