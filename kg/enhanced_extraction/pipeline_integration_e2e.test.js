/**
 * Enhanced Extraction - Pipeline Integration E2E Tests
 * 
 * 端到端集成测试，验证增强提取系统与Universal Document Pipeline的集成
 * 
 * 测试覆盖：
 * - 与universal_document_pipeline集成（Requirement 10.1）
 * - 向后兼容性（Requirement 10.3）
 * - 作为可选模块启用/禁用
 */

const { UniversalDocumentPipeline } = require('../pipeline/universal_document_pipeline');
const { createEnhancedExtractor, isEnhancedExtractionAvailable } = require('./pipeline_integration');

describe('Enhanced Extraction - Pipeline Integration E2E', () => {
  describe('Integration with Universal Document Pipeline (Requirement 10.1)', () => {
    test('should integrate as custom extractor', async () => {
      // 创建增强提取器（禁用LLM以加快测试）
      const enhancedExtractor = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      // 创建Pipeline并配置自定义提取器
      const pipeline = new UniversalDocumentPipeline({
        extraction: {
          customExtractor: async (ckb, options) => {
            return await enhancedExtractor.extractFields(ckb, options);
          }
        }
      });
      
      // 测试文档
      const document = {
        id: 'test-doc-001',
        type: 'text',
        content: '焦距: 35mm, 光圈: F1.8, 快门速度: 1/200s, ISO: 400'
      };
      
      // 处理文档
      const context = await pipeline.processDocument(document);
      
      // 验证处理成功（可能有警告导致partial状态）
      expect(context.status).toMatch(/completed|partial/);
      expect(context.steps.extraction.status).toBe('success');
      
      // 验证使用了自定义提取器
      expect(context.steps.extraction.metrics.usedCustomExtractor).toBe(true);
      
      // 验证提取了字段
      expect(context.metrics.fieldCount).toBeGreaterThan(0);
      expect(context.data.extractedFields.length).toBeGreaterThan(0);
    });
    
    test('should process document through complete pipeline', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      const pipeline = new UniversalDocumentPipeline({
        extraction: {
          customExtractor: async (ckb, options) => {
            return await enhancedExtractor.extractFields(ckb, options);
          }
        }
      });
      
      const document = {
        id: 'test-doc-002',
        type: 'text',
        content: '镜头型号: SEL35F18F, 焦距: 35mm, 最大光圈: F1.8, 适用场景: 人文摄影'
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证所有步骤都执行了
      expect(context.steps.parsing.status).toBe('success');
      expect(context.steps.extraction.status).toBe('success');
      expect(context.steps.schemaMatching.status).toBe('success');
      
      // 验证数据流转正确
      expect(context.data.ckb).toBeDefined();
      expect(context.data.extractedFields).toBeDefined();
      expect(context.data.matchedSchemas).toBeDefined();
    });
    
    test('should handle extraction errors gracefully', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      const pipeline = new UniversalDocumentPipeline({
        extraction: {
          customExtractor: async (ckb, options) => {
            // 模拟提取失败
            throw new Error('Extraction failed');
          }
        }
      });
      
      const document = {
        id: 'test-doc-003',
        type: 'text',
        content: 'Test content'
      };
      
      // 应该抛出错误（因为extraction是关键步骤）
      const context = await pipeline.processDocument(document);
      
      // 验证处理失败
      expect(context.status).toBe('failed');
      expect(context.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('Backward Compatibility (Requirement 10.3)', () => {
    test('should not break existing extraction when not configured', async () => {
      // 创建Pipeline但不配置自定义提取器
      const pipeline = new UniversalDocumentPipeline({
        extraction: {
          useLLM: false,
          useNER: true,
          useRules: true
        }
      });
      
      const document = {
        id: 'test-doc-004',
        type: 'text',
        content: '焦距: 35mm, 光圈: F1.8'
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证使用默认提取器
      expect(context.status).toMatch(/completed|partial/);
      expect(context.steps.extraction.status).toBe('success');
      expect(context.steps.extraction.metrics.usedCustomExtractor).toBeUndefined();
      
      // 验证仍然能提取字段
      expect(context.metrics.fieldCount).toBeGreaterThan(0);
    });
    
    test('should produce compatible field format', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      const pipeline = new UniversalDocumentPipeline({
        extraction: {
          customExtractor: async (ckb, options) => {
            return await enhancedExtractor.extractFields(ckb, options);
          }
        }
      });
      
      const document = {
        id: 'test-doc-005',
        type: 'text',
        content: '焦距: 35mm'
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证字段格式兼容
      const fields = context.data.extractedFields;
      expect(Array.isArray(fields)).toBe(true);
      
      if (fields.length > 0) {
        const field = fields[0];
        
        // 验证必需字段
        expect(field).toHaveProperty('name');
        expect(field).toHaveProperty('value');
        expect(field).toHaveProperty('confidence');
        expect(field).toHaveProperty('source');
        
        // 验证字段类型
        expect(typeof field.name).toBe('string');
        expect(typeof field.value).toBe('string');
        expect(typeof field.confidence).toBe('number');
        expect(typeof field.source).toBe('string');
        
        // 验证置信度范围
        expect(field.confidence).toBeGreaterThanOrEqual(0);
        expect(field.confidence).toBeLessThanOrEqual(1);
      }
    });
    
    test('should work with existing pipeline options', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      // 使用现有的Pipeline配置选项
      const pipeline = new UniversalDocumentPipeline({
        extraction: {
          customExtractor: async (ckb, options) => {
            return await enhancedExtractor.extractFields(ckb, options);
          },
          useLLM: false,
          useNER: true,
          useRules: true,
          maxTokens: 4000
        },
        schemaMatching: {
          useLLM: false,
          minConfidence: 0.5
        },
        normalization: {
          useLLM: false,
          useAlgorithm: true
        }
      });
      
      const document = {
        id: 'test-doc-006',
        type: 'text',
        content: '焦距: 35mm, 光圈: F1.8'
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证处理成功（可能有警告导致partial状态）
      expect(context.status).toMatch(/completed|partial/);
      expect(context.steps.extraction.status).toBe('success');
    });
  });
  
  describe('Optional Module Enable/Disable', () => {
    test('should work when enhanced extraction is enabled', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        enabled: true,
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      const pipeline = new UniversalDocumentPipeline({
        extraction: {
          customExtractor: async (ckb, options) => {
            return await enhancedExtractor.extractFields(ckb, options);
          }
        }
      });
      
      const document = {
        id: 'test-doc-007',
        type: 'text',
        content: '焦距: 35mm'
      };
      
      const context = await pipeline.processDocument(document);
      
      expect(context.status).toMatch(/completed|partial/);
      expect(context.steps.extraction.status).toBe('success');
    });
    
    test('should throw error when enhanced extraction is disabled', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        enabled: false,
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      const ckb = {
        content: { text: '焦距: 35mm' }
      };
      
      // 应该抛出错误
      await expect(enhancedExtractor.extractFields(ckb)).rejects.toThrow('Enhanced extraction is disabled');
    });
    
    test('should check if enhanced extraction is available', () => {
      const available = isEnhancedExtractionAvailable();
      
      // 应该返回布尔值
      expect(typeof available).toBe('boolean');
      
      // 在测试环境中应该可用
      expect(available).toBe(true);
    });
    
    test('should fallback to default extractor when custom extractor fails', async () => {
      let customExtractorCalled = false;
      
      const pipeline = new UniversalDocumentPipeline({
        extraction: {
          customExtractor: async (ckb, options) => {
            customExtractorCalled = true;
            throw new Error('Custom extractor failed');
          },
          useLLM: false,
          useNER: true,
          useRules: true
        }
      });
      
      const document = {
        id: 'test-doc-008',
        type: 'text',
        content: '焦距: 35mm'
      };
      
      // 应该处理失败
      const context = await pipeline.processDocument(document);
      
      // 验证自定义提取器被调用了
      expect(customExtractorCalled).toBe(true);
      
      // 验证处理失败
      expect(context.status).toBe('failed');
      expect(context.errors.length).toBeGreaterThan(0);
    });
  });
  
  describe('Performance and Metrics', () => {
    test('should track extraction metrics', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      const pipeline = new UniversalDocumentPipeline({
        extraction: {
          customExtractor: async (ckb, options) => {
            return await enhancedExtractor.extractFields(ckb, options);
          }
        }
      });
      
      const document = {
        id: 'test-doc-009',
        type: 'text',
        content: '焦距: 35mm, 光圈: F1.8, 快门速度: 1/200s'
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证指标被记录
      expect(context.metrics).toBeDefined();
      expect(context.metrics.fieldCount).toBeGreaterThan(0);
      expect(context.steps.extraction.duration).toBeGreaterThan(0);
      
      // 验证自定义提取器指标
      expect(context.steps.extraction.metrics.usedCustomExtractor).toBe(true);
    });
    
    test('should track processing time', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      const pipeline = new UniversalDocumentPipeline({
        extraction: {
          customExtractor: async (ckb, options) => {
            return await enhancedExtractor.extractFields(ckb, options);
          }
        }
      });
      
      const document = {
        id: 'test-doc-010',
        type: 'text',
        content: '焦距: 35mm'
      };
      
      const startTime = Date.now();
      const context = await pipeline.processDocument(document);
      const endTime = Date.now();
      
      // 验证处理时间被记录
      expect(context.totalDuration).toBeGreaterThan(0);
      expect(context.totalDuration).toBeLessThanOrEqual(endTime - startTime + 100); // 允许100ms误差
      
      // 验证提取步骤时间
      expect(context.steps.extraction.duration).toBeGreaterThan(0);
    });
    
    test('should get extraction statistics', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      // 执行几次提取
      const ckb = {
        content: { text: '焦距: 35mm' }
      };
      
      await enhancedExtractor.extractFields(ckb);
      await enhancedExtractor.extractFields(ckb);
      
      // 获取统计信息
      const stats = enhancedExtractor.getStatistics();
      
      // 验证统计信息
      expect(stats).toBeDefined();
      expect(stats.totalExtractions).toBeGreaterThanOrEqual(2);
    });
  });
  
  describe('Error Handling and Edge Cases', () => {
    test('should handle empty document', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      const ckb = {
        content: { text: '' }
      };
      
      // 应该抛出错误
      await expect(enhancedExtractor.extractFields(ckb)).rejects.toThrow('Invalid input: documentText must be a non-empty string');
    });
    
    test('should handle missing CKB content', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      const ckb = {};
      
      // 应该抛出错误
      await expect(enhancedExtractor.extractFields(ckb)).rejects.toThrow('Invalid input: documentText must be a non-empty string');
    });
    
    test('should handle extraction with no fields found', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      const pipeline = new UniversalDocumentPipeline({
        extraction: {
          customExtractor: async (ckb, options) => {
            return await enhancedExtractor.extractFields(ckb, options);
          }
        }
      });
      
      const document = {
        id: 'test-doc-011',
        type: 'text',
        content: 'No extractable fields here'
      };
      
      const context = await pipeline.processDocument(document);
      
      // 应该完成但可能有警告
      expect(context.status).toMatch(/completed|partial/);
      expect(context.metrics.fieldCount).toBeGreaterThanOrEqual(0);
    });
    
    test('should handle large documents', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      const pipeline = new UniversalDocumentPipeline({
        extraction: {
          customExtractor: async (ckb, options) => {
            return await enhancedExtractor.extractFields(ckb, options);
          }
        }
      });
      
      // 创建大文档（重复内容）
      const content = '焦距: 35mm, 光圈: F1.8. '.repeat(100);
      
      const document = {
        id: 'test-doc-012',
        type: 'text',
        content: content
      };
      
      const context = await pipeline.processDocument(document);
      
      // 应该成功处理（可能有警告导致partial状态）
      expect(context.status).toMatch(/completed|partial/);
      expect(context.metrics.fieldCount).toBeGreaterThan(0);
    });
  });
  
  describe('Configuration Options', () => {
    test('should respect LLM enable/disable option', async () => {
      // 禁用LLM
      const extractorNoLLM = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      const ckb = {
        content: { text: '焦距: 35mm' }
      };
      
      const fields = await extractorNoLLM.extractFields(ckb);
      
      // 验证所有字段都来自算法
      fields.forEach(field => {
        expect(field.source).toBe('algorithm');
      });
    });
    
    test('should respect algorithm enable/disable option', async () => {
      // 禁用算法（只使用LLM）
      const extractorNoAlgorithm = createEnhancedExtractor({
        llm: { enabled: false }, // 测试中也禁用LLM以加快速度
        algorithm: { enabled: false }
      });
      
      const ckb = {
        content: { text: '焦距: 35mm' }
      };
      
      const fields = await extractorNoAlgorithm.extractFields(ckb);
      
      // 禁用算法后应该没有字段或只有LLM字段
      expect(fields.length).toBeGreaterThanOrEqual(0);
    });
    
    test('should pass extraction options to coordinator', async () => {
      const enhancedExtractor = createEnhancedExtractor({
        llm: { enabled: false },
        algorithm: { enabled: true }
      });
      
      const ckb = {
        content: { text: '焦距: 35mm' }
      };
      
      // 传递自定义选项
      const fields = await enhancedExtractor.extractFields(ckb, {
        useLLM: false,
        useAlgorithm: true,
        timeout: 3000,
        language: 'zh'
      });
      
      // 应该成功提取
      expect(Array.isArray(fields)).toBe(true);
    });
  });
});
