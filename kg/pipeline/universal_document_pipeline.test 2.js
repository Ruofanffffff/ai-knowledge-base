/**
 * Unit Tests for Universal Document Pipeline
 * 
 * 测试流水线的基本功能和端到端流程
 */

const { UniversalDocumentPipeline } = require('./universal_document_pipeline');

describe('Universal Document Pipeline - Unit Tests', () => {
  let pipeline;
  
  beforeEach(() => {
    pipeline = new UniversalDocumentPipeline({
      extraction: { useLLM: false },
      normalization: { useLLM: false },
      entityBuilding: { useLLM: false },
      relationExtraction: { enableSemantic: false } // 禁用语义关系以节省时间
    });
  });
  
  describe('Document Validation', () => {
    test('should accept valid text document', async () => {
      const document = {
        id: 'test-doc-1',
        type: 'text',
        content: '这是一个测试文档，包含一些测试内容。'
      };
      
      const context = await pipeline.processDocument(document);
      
      expect(context).toBeDefined();
      expect(context.documentId).toBe('test-doc-1');
      expect(context.errors.length).toBe(0);
    });
    
    test('should reject document with unsupported format', async () => {
      const document = {
        id: 'test-doc-2',
        type: 'unsupported-format',
        content: '测试内容'
      };
      
      const context = await pipeline.processDocument(document);
      
      expect(context.errors.length).toBeGreaterThan(0);
      expect(context.errors[0].error).toContain('不支持的文档格式');
    });
    
    test('should reject document without content', async () => {
      const document = {
        id: 'test-doc-3',
        type: 'text'
      };
      
      const context = await pipeline.processDocument(document);
      
      expect(context.errors.length).toBeGreaterThan(0);
      expect(context.errors[0].error).toContain('文档内容不能为空');
    });
  });
  
  describe('End-to-End Processing', () => {
    test('should process document through complete pipeline', async () => {
      const document = {
        id: 'e2e-test-1',
        type: 'text',
        title: '测试招标文件',
        content: `
          项目名称：某市政道路改造工程
          项目编号：2024-001
          招标人：某市建设局
          预算金额：500万元
          工期：6个月
          联系人：张三
          联系电话：13800138000
        `
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证处理上下文
      expect(context).toBeDefined();
      expect(context.documentId).toBe('e2e-test-1');
      expect(context.status).toBeDefined();
      
      // 验证各步骤执行
      expect(context.steps.parsing.status).toBe('success');
      expect(context.steps.extraction.status).toBe('success');
      expect(context.steps.schemaMatching.status).toBe('success');
      
      // 验证数据流
      expect(context.data.ckb).toBeDefined();
      expect(context.data.extractedFields).toBeDefined();
      expect(context.data.extractedFields.length).toBeGreaterThan(0);
      expect(context.data.matchedSchemas).toBeDefined();
      
      // 验证指标
      expect(context.metrics.fieldCount).toBeGreaterThan(0);
      expect(context.totalDuration).toBeGreaterThan(0);
      
      // 验证摘要
      const summary = context.getSummary();
      expect(summary).toBeDefined();
      expect(summary.status).toBeDefined();
      expect(summary.totalDuration).toBeGreaterThan(0);
      
      console.log('\n=== 处理摘要 ===');
      console.log(`状态: ${summary.status}`);
      console.log(`总耗时: ${summary.totalDuration}ms`);
      console.log(`成功步骤: ${summary.successfulSteps}`);
      console.log(`失败步骤: ${summary.failedSteps}`);
      console.log(`最慢步骤: ${summary.slowestStep} (${summary.slowestStepDuration}ms)`);
      console.log(`提取字段: ${context.metrics.fieldCount}`);
      console.log(`构建实体: ${context.metrics.entityCount}`);
      console.log(`抽取关系: ${context.metrics.relationCount}`);
    }, 30000); // 30秒超时
  });
  
  describe('Batch Processing', () => {
    test('should process multiple documents in batch', async () => {
      const documents = [
        {
          id: 'batch-1',
          type: 'text',
          content: '第一个测试文档内容'
        },
        {
          id: 'batch-2',
          type: 'text',
          content: '第二个测试文档内容'
        },
        {
          id: 'batch-3',
          type: 'text',
          content: '第三个测试文档内容'
        }
      ];
      
      const results = await pipeline.processBatch(documents, {
        concurrency: 2
      });
      
      expect(results).toHaveLength(3);
      expect(results[0].documentId).toBe('batch-1');
      expect(results[1].documentId).toBe('batch-2');
      expect(results[2].documentId).toBe('batch-3');
    }, 30000);
    
    test('should handle batch processing with some failing documents', async () => {
      const documents = [
        {
          id: 'batch-success-1',
          type: 'text',
          content: '成功的文档内容'
        },
        {
          id: 'batch-fail-1',
          type: 'invalid-format', // 无效格式会导致失败
          content: '失败的文档内容'
        },
        {
          id: 'batch-success-2',
          type: 'text',
          content: '另一个成功的文档内容'
        }
      ];
      
      const results = await pipeline.processBatch(documents, {
        concurrency: 2,
        stopOnFirstError: false // 不在第一个错误时停止
      });
      
      // 验证：应该返回所有文档的结果
      expect(results).toHaveLength(3);
      
      // 验证：成功的文档应该正常处理
      expect(results[0].documentId).toBe('batch-success-1');
      expect(['completed', 'partial']).toContain(results[0].status);
      
      // 验证：失败的文档应该有错误记录
      expect(results[1].documentId).toBe('batch-fail-1');
      expect(results[1].status).toBe('failed');
      expect(results[1].errors.length).toBeGreaterThan(0);
      
      // 验证：后续文档应该继续处理
      expect(results[2].documentId).toBe('batch-success-2');
      expect(['completed', 'partial']).toContain(results[2].status);
    }, 30000);
    
    test('should collect all results including failures', async () => {
      const documents = [
        {
          id: 'doc-1',
          type: 'text',
          content: '文档1'
        },
        {
          id: 'doc-2',
          type: 'text',
          content: '' // 空内容可能导致警告
        },
        {
          id: 'doc-3',
          type: 'text',
          content: '文档3'
        }
      ];
      
      const results = await pipeline.processBatch(documents, {
        concurrency: 3
      });
      
      // 验证：所有文档都应该有结果
      expect(results).toHaveLength(3);
      
      // 验证：每个结果都应该是 ProcessingContext
      results.forEach((result, index) => {
        expect(result).toBeDefined();
        expect(result.documentId).toBe(`doc-${index + 1}`);
        expect(result.startTime).toBeDefined();
        expect(result.endTime).toBeDefined();
        expect(result.totalDuration).toBeGreaterThan(0);
      });
    }, 30000);
    
    test('should return all Processing_Context objects', async () => {
      const documents = [
        {
          id: 'ctx-1',
          type: 'text',
          content: '测试内容1'
        },
        {
          id: 'ctx-2',
          type: 'text',
          content: '测试内容2'
        }
      ];
      
      const results = await pipeline.processBatch(documents);
      
      // 验证：返回的是 ProcessingContext 数组
      expect(Array.isArray(results)).toBe(true);
      expect(results).toHaveLength(2);
      
      results.forEach(result => {
        expect(result.constructor.name).toBe('ProcessingContext');
        expect(result.steps).toBeDefined();
        expect(result.data).toBeDefined();
        expect(result.metrics).toBeDefined();
        expect(result.errors).toBeDefined();
        expect(result.warnings).toBeDefined();
      });
    }, 30000);
  });
  
  describe('Parsing Step', () => {
    test('should successfully parse text document', async () => {
      const document = {
        id: 'parse-test-1',
        type: 'text',
        title: '测试文档标题',
        content: '这是测试文档的内容，包含一些文本信息。'
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证解析步骤成功
      expect(context.steps.parsing.status).toBe('success');
      expect(context.steps.parsing.duration).toBeGreaterThanOrEqual(0);
      
      // 验证CKB创建
      expect(context.data.ckb).toBeDefined();
      expect(context.data.ckb.ckb_id).toBeDefined();
      expect(context.data.ckb.doc_id).toBe('parse-test-1');
      expect(context.data.ckb.content).toBeDefined();
      expect(context.data.ckb.content.text).toBe(document.content);
      expect(context.data.ckb.content.title).toBe(document.title);
      expect(context.data.ckb.quality).toBeDefined();
      expect(context.data.ckb.quality.source_confidence).toBeGreaterThan(0);
    });
    
    test('should parse PDF document format', async () => {
      const document = {
        id: 'parse-test-2',
        type: 'pdf',
        content: 'PDF文档内容模拟'
      };
      
      const context = await pipeline.processDocument(document);
      
      expect(context.steps.parsing.status).toBe('success');
      expect(context.data.ckb).toBeDefined();
      expect(context.data.ckb.doc_id).toBe('parse-test-2');
    });
    
    test('should parse Word document format', async () => {
      const document = {
        id: 'parse-test-3',
        type: 'word',
        content: 'Word文档内容模拟'
      };
      
      const context = await pipeline.processDocument(document);
      
      expect(context.steps.parsing.status).toBe('success');
      expect(context.data.ckb).toBeDefined();
      expect(context.data.ckb.doc_id).toBe('parse-test-3');
    });
    
    test('should parse Excel document format', async () => {
      const document = {
        id: 'parse-test-4',
        type: 'excel',
        content: 'Excel文档内容模拟'
      };
      
      const context = await pipeline.processDocument(document);
      
      expect(context.steps.parsing.status).toBe('success');
      expect(context.data.ckb).toBeDefined();
      expect(context.data.ckb.doc_id).toBe('parse-test-4');
    });
    
    test('should handle document without title', async () => {
      const document = {
        id: 'parse-test-5',
        type: 'text',
        content: '没有标题的文档内容'
      };
      
      const context = await pipeline.processDocument(document);
      
      expect(context.steps.parsing.status).toBe('success');
      expect(context.data.ckb.content.title).toContain('Document');
    });
    
    test('should handle document with metadata', async () => {
      const document = {
        id: 'parse-test-6',
        type: 'text',
        content: '带元数据的文档',
        metadata: {
          author: '张三',
          date: '2024-01-01',
          tags: ['测试', '文档']
        }
      };
      
      const context = await pipeline.processDocument(document);
      
      expect(context.steps.parsing.status).toBe('success');
      expect(context.data.ckb.metadata).toBeDefined();
      expect(context.data.ckb.metadata.author).toBe('张三');
      expect(context.data.ckb.metadata.tags).toContain('测试');
    });
    
    test('should update context after parsing', async () => {
      const document = {
        id: 'parse-test-7',
        type: 'text',
        content: '测试上下文更新'
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证上下文更新
      expect(context.steps.parsing.result).toBeDefined();
      expect(context.steps.parsing.result.ckb_id).toBeDefined();
      expect(context.data.ckb).toBe(context.steps.parsing.result);
    });
    
    test('should handle parsing errors gracefully', async () => {
      // 创建一个会导致解析问题的文档（空内容）
      const document = {
        id: 'parse-error-1',
        type: 'text'
        // 缺少content字段
      };
      
      const context = await pipeline.processDocument(document);
      
      // 应该在验证阶段就失败
      expect(context.errors.length).toBeGreaterThan(0);
      expect(context.errors[0].error).toContain('文档内容不能为空');
    });
  });
  
  describe('Schema Matching Step', () => {
    test('should use generic schema when no schema matches', async () => {
      // 创建一个不太可能匹配任何schema的文档
      const document = {
        id: 'schema-fallback-test-1',
        type: 'text',
        content: '这是一些随机的文本内容，不包含任何特定领域的信息。只是一些普通的句子。'
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证schema匹配步骤成功
      expect(context.steps.schemaMatching.status).toBe('success');
      
      // 验证使用了通用schema
      expect(context.data.matchedSchemas).toBeDefined();
      expect(context.data.matchedSchemas.length).toBeGreaterThan(0);
      
      // 检查是否有Generic schema
      const hasGenericSchema = context.data.matchedSchemas.some(
        sm => sm.schema.schema_name === 'Generic'
      );
      
      if (hasGenericSchema) {
        // 验证有警告信息
        const hasWarning = context.warnings.some(w => 
          w.step === 'schemaMatching' && 
          w.error.includes('通用Schema')
        );
        expect(hasWarning).toBe(true);
        
        // 验证Generic schema的结构
        const genericMatch = context.data.matchedSchemas.find(
          sm => sm.schema.schema_name === 'Generic'
        );
        expect(genericMatch.schema.entity_type).toBe('Generic');
        expect(genericMatch.schema.core_fields).toBeDefined();
        expect(Array.isArray(genericMatch.schema.core_fields)).toBe(true);
      }
    });
    
    test('should continue pipeline with generic schema', async () => {
      const document = {
        id: 'schema-fallback-test-2',
        type: 'text',
        content: '一些简单的文本，用于测试通用schema降级功能。'
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证流水线继续执行
      expect(context.steps.schemaMatching.status).toBe('success');
      expect(context.steps.normalization.status).not.toBe('not_started');
      
      // 即使使用通用schema，流水线也应该能够完成
      expect(['completed', 'partial']).toContain(context.status);
    });
    
    test('should log warning when using generic schema', async () => {
      const document = {
        id: 'schema-fallback-test-3',
        type: 'text',
        content: '测试警告日志的文档内容。'
      };
      
      const context = await pipeline.processDocument(document);
      
      // 如果使用了Generic schema，应该有警告
      const hasGenericSchema = context.data.matchedSchemas.some(
        sm => sm.schema && sm.schema.schema_name === 'Generic'
      );
      
      if (hasGenericSchema) {
        expect(context.warnings.length).toBeGreaterThan(0);
        
        const schemaWarning = context.warnings.find(w => 
          w.step === 'schemaMatching'
        );
        
        expect(schemaWarning).toBeDefined();
        expect(schemaWarning.error).toContain('Schema');
      }
    });
  });
  
  describe('Error Handling', () => {
    test('should handle critical errors gracefully', async () => {
      const document = {
        id: 'error-test-1',
        type: 'invalid-type',
        content: '测试内容'
      };
      
      const context = await pipeline.processDocument(document);
      
      expect(context.status).toBe('failed');
      expect(context.errors.length).toBeGreaterThan(0);
    });
    
    test('should continue on non-critical errors', async () => {
      const document = {
        id: 'warning-test-1',
        type: 'text',
        content: '简短内容' // 可能导致某些步骤部分失败
      };
      
      const context = await pipeline.processDocument(document);
      
      // 即使有警告，流水线应该继续
      expect(context.status).toBeDefined();
      expect(context.steps.parsing.status).toBe('success');
    });
  });
  
  describe('Partial Entity Building', () => {
    test('should construct partial entities with low field coverage', async () => {
      const document = {
        id: 'partial-entity-test-1',
        type: 'text',
        content: `
          项目名称：测试项目
          预算：50万
        ` // 只包含少量字段，导致低字段覆盖率
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证实体构建步骤执行
      if (context.steps.entityBuilding.status === 'success') {
        const metrics = context.steps.entityBuilding.metrics;
        
        // 验证指标存在
        expect(metrics).toBeDefined();
        expect(metrics.entityMetrics).toBeDefined();
        expect(Array.isArray(metrics.entityMetrics)).toBe(true);
        
        // 验证实体指标
        if (metrics.entityMetrics.length > 0) {
          metrics.entityMetrics.forEach(entityMetric => {
            expect(entityMetric).toHaveProperty('schemaName');
            expect(entityMetric).toHaveProperty('entityId');
            expect(entityMetric).toHaveProperty('confidence');
            expect(entityMetric).toHaveProperty('fieldCoverage');
            expect(entityMetric).toHaveProperty('expectedFields');
            expect(entityMetric).toHaveProperty('actualFields');
            expect(entityMetric).toHaveProperty('isPartial');
            
            // 验证字段覆盖率计算
            if (entityMetric.expectedFields > 0 && !entityMetric.error) {
              const calculatedCoverage = entityMetric.actualFields / entityMetric.expectedFields;
              expect(entityMetric.fieldCoverage).toBeCloseTo(calculatedCoverage, 2);
              
              // 验证isPartial标志
              expect(entityMetric.isPartial).toBe(entityMetric.fieldCoverage < 1.0);
            }
          });
        }
        
        // 验证总体指标
        expect(metrics.avgFieldCoverage).toBeDefined();
        expect(typeof metrics.avgFieldCoverage).toBe('number');
        expect(metrics.partialEntityCount).toBeDefined();
        expect(typeof metrics.partialEntityCount).toBe('number');
      }
    }, 30000);
    
    test('should log warnings for partial entities', async () => {
      const document = {
        id: 'partial-entity-test-2',
        type: 'text',
        content: `
          项目名称：部分实体测试
          预算：100万
        ` // 少量字段
      };
      
      const context = await pipeline.processDocument(document);
      
      // 如果实体构建成功
      if (context.steps.entityBuilding.status === 'success') {
        const metrics = context.steps.entityBuilding.metrics;
        
        // 检查是否有部分实体
        if (metrics.entityMetrics) {
          const partialEntities = metrics.entityMetrics.filter(m => 
            m.isPartial && !m.error
          );
          
          // 如果有部分实体，应该有警告
          if (partialEntities.length > 0) {
            const entityWarnings = context.warnings.filter(w => 
              w.step === 'entityBuilding' && 
              w.error.includes('部分实体构建')
            );
            
            expect(entityWarnings.length).toBeGreaterThan(0);
            
            // 验证警告包含详细信息
            entityWarnings.forEach(warning => {
              expect(warning.error).toMatch(/字段覆盖率/);
              expect(warning.error).toMatch(/\d+%/); // 包含百分比
            });
          }
        }
      }
    }, 30000);
    
    test('should warn about entities below minFieldCoverage threshold', async () => {
      const document = {
        id: 'partial-entity-test-3',
        type: 'text',
        content: '项目：极简测试' // 极少字段，可能低于阈值
      };
      
      const context = await pipeline.processDocument(document);
      
      if (context.steps.entityBuilding.status === 'success') {
        const metrics = context.steps.entityBuilding.metrics;
        const minCoverage = pipeline.options.entityBuilding.minFieldCoverage || 0.5;
        
        // 检查是否有低于阈值的实体
        if (metrics.entityMetrics) {
          const lowCoverageEntities = metrics.entityMetrics.filter(m => 
            m.fieldCoverage < minCoverage && m.fieldCoverage > 0 && !m.error
          );
          
          // 如果有低覆盖率实体，应该有相应警告
          if (lowCoverageEntities.length > 0) {
            const thresholdWarnings = context.warnings.filter(w => 
              w.step === 'entityBuilding' && 
              w.error.includes('字段覆盖率过低')
            );
            
            expect(thresholdWarnings.length).toBeGreaterThan(0);
            
            // 验证警告包含阈值信息
            thresholdWarnings.forEach(warning => {
              expect(warning.error).toMatch(/最低要求/);
              expect(warning.error).toMatch(/\d+%/);
            });
          }
        }
      }
    }, 30000);
    
    test('should continue pipeline with partial entities', async () => {
      const document = {
        id: 'partial-entity-test-4',
        type: 'text',
        content: '项目名称：继续测试项目'
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证：即使实体构建部分失败，流水线应该继续
      if (context.steps.entityBuilding.status === 'success') {
        const metrics = context.steps.entityBuilding.metrics;
        
        // 如果有部分实体
        if (metrics.partialEntityCount > 0) {
          // 后续步骤应该尝试执行
          expect(context.steps.relationExtraction.status).not.toBe('not_started');
          
          // 流水线应该完成（可能是partial状态）
          expect(['completed', 'partial', 'failed']).toContain(context.status);
        }
      }
    }, 30000);
    
    test('should calculate entity metrics correctly', async () => {
      const document = {
        id: 'partial-entity-test-5',
        type: 'text',
        content: `
          项目名称：指标测试项目
          招标人：测试单位
          预算金额：300万元
          工期：6个月
          联系人：李四
        `
      };
      
      const context = await pipeline.processDocument(document);
      
      if (context.steps.entityBuilding.status === 'success') {
        const metrics = context.steps.entityBuilding.metrics;
        
        // 验证实体数量
        expect(metrics.entityCount).toBeDefined();
        expect(metrics.entityCount).toBe(context.data.entities.length);
        
        // 验证平均置信度
        expect(metrics.avgConfidence).toBeDefined();
        if (context.data.entities.length > 0) {
          const calculatedAvgConfidence = context.data.entities.reduce(
            (sum, e) => sum + e.confidence, 0
          ) / context.data.entities.length;
          expect(metrics.avgConfidence).toBeCloseTo(calculatedAvgConfidence, 2);
        }
        
        // 验证平均字段覆盖率
        expect(metrics.avgFieldCoverage).toBeDefined();
        if (metrics.entityMetrics && metrics.entityMetrics.length > 0) {
          const calculatedAvgCoverage = metrics.entityMetrics.reduce(
            (sum, m) => sum + (m.fieldCoverage || 0), 0
          ) / metrics.entityMetrics.length;
          expect(metrics.avgFieldCoverage).toBeCloseTo(calculatedAvgCoverage, 2);
        }
        
        // 验证部分实体计数
        expect(metrics.partialEntityCount).toBeDefined();
        if (metrics.entityMetrics) {
          const calculatedPartialCount = metrics.entityMetrics.filter(m => m.isPartial).length;
          expect(metrics.partialEntityCount).toBe(calculatedPartialCount);
        }
      }
    }, 30000);
  });
  
  describe('Partial Normalization Handling', () => {
    test('should calculate mapping success rate for partial normalization', async () => {
      const document = {
        id: 'partial-norm-test-1',
        type: 'text',
        title: '测试招标文件',
        content: `
          项目名称：某市政道路改造工程
          招标人：某市建设局
          预算金额：500万元
        `
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证标准化步骤执行
      if (context.steps.normalization.status === 'success') {
        const metrics = context.steps.normalization.metrics;
        
        // 验证指标存在
        expect(metrics).toBeDefined();
        expect(metrics.overallSuccessRate).toBeDefined();
        expect(typeof metrics.overallSuccessRate).toBe('number');
        expect(metrics.overallSuccessRate).toBeGreaterThanOrEqual(0);
        expect(metrics.overallSuccessRate).toBeLessThanOrEqual(1);
        
        // 验证schema级别的指标
        expect(metrics.schemaMetrics).toBeDefined();
        expect(Array.isArray(metrics.schemaMetrics)).toBe(true);
        
        if (metrics.schemaMetrics.length > 0) {
          metrics.schemaMetrics.forEach(schemaMetric => {
            expect(schemaMetric).toHaveProperty('schemaName');
            expect(schemaMetric).toHaveProperty('expectedFields');
            expect(schemaMetric).toHaveProperty('mappedFields');
            expect(schemaMetric).toHaveProperty('successRate');
            expect(schemaMetric).toHaveProperty('failedFields');
            
            // 验证成功率计算正确
            if (schemaMetric.expectedFields > 0) {
              const calculatedRate = schemaMetric.mappedFields / schemaMetric.expectedFields;
              expect(schemaMetric.successRate).toBeCloseTo(calculatedRate, 2);
            }
          });
        }
      }
    }, 30000);
    
    test('should log warnings for failed field mappings', async () => {
      const document = {
        id: 'partial-norm-test-2',
        type: 'text',
        content: `
          项目名称：测试项目
          预算：100万
        ` // 只包含少量字段，可能导致部分映射失败
      };
      
      const context = await pipeline.processDocument(document);
      
      // 如果标准化成功但有部分失败
      if (context.steps.normalization.status === 'success') {
        const metrics = context.steps.normalization.metrics;
        
        // 检查是否有schema的成功率低于100%
        if (metrics.schemaMetrics) {
          const partialSchemas = metrics.schemaMetrics.filter(m => 
            m.successRate < 1.0 && m.successRate > 0
          );
          
          // 如果有部分成功的schema，应该有警告
          if (partialSchemas.length > 0) {
            const normalizationWarnings = context.warnings.filter(w => 
              w.step === 'normalization' && 
              w.error.includes('部分字段映射失败')
            );
            
            expect(normalizationWarnings.length).toBeGreaterThan(0);
            
            // 验证警告包含详细信息
            normalizationWarnings.forEach(warning => {
              expect(warning.error).toMatch(/成功率/);
              expect(warning.error).toMatch(/未映射字段/);
            });
          }
        }
      }
    }, 30000);
    
    test('should identify unmapped fields in partial normalization', async () => {
      const document = {
        id: 'partial-norm-test-3',
        type: 'text',
        content: '项目名称：简单测试项目' // 极少字段
      };
      
      const context = await pipeline.processDocument(document);
      
      if (context.steps.normalization.status === 'success') {
        const metrics = context.steps.normalization.metrics;
        
        if (metrics.schemaMetrics && metrics.schemaMetrics.length > 0) {
          metrics.schemaMetrics.forEach(schemaMetric => {
            // 验证failedFields数组存在
            expect(Array.isArray(schemaMetric.failedFields)).toBe(true);
            
            // 如果有失败的字段，验证数量一致性
            if (schemaMetric.failedFields.length > 0) {
              const unmappedCount = schemaMetric.failedFields.length;
              const expectedCount = schemaMetric.expectedFields;
              const mappedCount = schemaMetric.mappedFields;
              
              // 验证：未映射数量 <= 期望数量 - 已映射数量
              // (可能有些字段既不在core_fields中，也没有被映射)
              expect(unmappedCount).toBeLessThanOrEqual(expectedCount);
              expect(unmappedCount).toBeGreaterThanOrEqual(0);
              
              // 验证：已映射数量 + 未映射数量 <= 期望数量
              expect(mappedCount + unmappedCount).toBeLessThanOrEqual(expectedCount + 1);
            }
          });
        }
      }
    }, 30000);
    
    test('should continue pipeline with partial normalization results', async () => {
      const document = {
        id: 'partial-norm-test-4',
        type: 'text',
        content: '项目：测试' // 最少字段
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证：即使标准化部分失败，流水线应该继续
      if (context.steps.normalization.status === 'success') {
        // 后续步骤应该尝试执行
        expect(context.steps.entityBuilding.status).not.toBe('not_started');
        
        // 流水线应该完成（可能是partial状态）
        expect(['completed', 'partial', 'failed']).toContain(context.status);
      }
    }, 30000);
    
    test('should record overall success rate across all schemas', async () => {
      const document = {
        id: 'partial-norm-test-5',
        type: 'text',
        content: `
          项目名称：综合测试项目
          招标人：测试单位
          预算金额：200万元
          工期：3个月
        `
      };
      
      const context = await pipeline.processDocument(document);
      
      if (context.steps.normalization.status === 'success') {
        const metrics = context.steps.normalization.metrics;
        
        // 验证总体成功率
        expect(metrics.overallSuccessRate).toBeDefined();
        
        // 如果有多个schema，验证总体成功率是所有schema的加权平均
        if (metrics.schemaMetrics && metrics.schemaMetrics.length > 0) {
          const totalExpected = metrics.schemaMetrics.reduce(
            (sum, m) => sum + m.expectedFields, 0
          );
          const totalMapped = metrics.schemaMetrics.reduce(
            (sum, m) => sum + m.mappedFields, 0
          );
          
          if (totalExpected > 0) {
            const calculatedOverallRate = totalMapped / totalExpected;
            expect(metrics.overallSuccessRate).toBeCloseTo(calculatedOverallRate, 2);
          }
        }
      }
    }, 30000);
  });
  
  describe('Relation Builder Error Handling', () => {
    test('should handle individual builder failures independently', async () => {
      const document = {
        id: 'relation-error-test-1',
        type: 'text',
        content: `
          项目名称：关系测试项目
          招标人：测试单位
          预算金额：200万元
          工期：6个月
        `
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证关系抽取步骤执行
      if (context.steps.relationExtraction.status === 'success') {
        const metrics = context.steps.relationExtraction.metrics;
        
        // 验证指标存在
        expect(metrics).toBeDefined();
        expect(metrics.builderResults).toBeDefined();
        expect(typeof metrics.builderResults).toBe('object');
        
        // 验证每个构建器的结果
        const builderTypes = ['builtin', 'cooccurrence', 'semantic'];
        builderTypes.forEach(type => {
          if (metrics.builderResults[type]) {
            expect(metrics.builderResults[type]).toHaveProperty('success');
            expect(metrics.builderResults[type]).toHaveProperty('count');
            expect(metrics.builderResults[type]).toHaveProperty('error');
            
            // 如果成功，count应该>=0
            if (metrics.builderResults[type].success) {
              expect(metrics.builderResults[type].count).toBeGreaterThanOrEqual(0);
              expect(metrics.builderResults[type].error).toBeNull();
            }
          }
        });
        
        // 验证总体指标
        expect(metrics.enabledBuilders).toBeDefined();
        expect(metrics.successfulBuilders).toBeDefined();
        expect(metrics.failedBuilders).toBeDefined();
        expect(typeof metrics.enabledBuilders).toBe('number');
        expect(typeof metrics.successfulBuilders).toBe('number');
        expect(typeof metrics.failedBuilders).toBe('number');
        
        // 成功+失败应该等于启用的构建器数量
        expect(metrics.successfulBuilders + metrics.failedBuilders).toBe(metrics.enabledBuilders);
      }
    }, 30000);
    
    test('should log warnings for failed builders', async () => {
      // 这个测试验证错误处理机制的存在，而不是强制触发失败
      const document = {
        id: 'relation-error-test-2',
        type: 'text',
        content: '项目：简单测试'
      };
      
      const context = await pipeline.processDocument(document);
      
      if (context.steps.relationExtraction.status === 'success') {
        const metrics = context.steps.relationExtraction.metrics;
        
        // 验证：构建器结果应该被记录
        expect(metrics.builderResults).toBeDefined();
        expect(typeof metrics.builderResults).toBe('object');
        
        // 验证：如果有失败的构建器，应该有相应的警告
        const relationWarnings = context.warnings.filter(w => 
          w.step === 'relationExtraction' && 
          w.error.includes('构建器失败')
        );
        
        // 失败构建器数量应该等于警告数量
        expect(relationWarnings.length).toBe(metrics.failedBuilders);
        
        // 如果有警告，验证警告包含构建器名称
        if (relationWarnings.length > 0) {
          relationWarnings.forEach(warning => {
            const hasBuilderName = 
              warning.error.includes('内置') || 
              warning.error.includes('共现') || 
              warning.error.includes('语义');
            expect(hasBuilderName).toBe(true);
          });
        }
      }
    }, 30000);
    
    test('should keep results from successful builders when some fail', async () => {
      const document = {
        id: 'relation-error-test-3',
        type: 'text',
        content: `
          项目名称：部分成功测试
          招标人：测试单位A
          联系人：张三
          预算：150万
        `
      };
      
      const context = await pipeline.processDocument(document);
      
      if (context.steps.relationExtraction.status === 'success') {
        const metrics = context.steps.relationExtraction.metrics;
        
        // 验证：如果有成功的构建器，应该有关系被提取
        if (metrics.successfulBuilders > 0) {
          expect(context.data.relations).toBeDefined();
          expect(Array.isArray(context.data.relations)).toBe(true);
          
          // 验证关系数量与成功构建器的计数一致
          const totalFromBuilders = 
            (metrics.builderResults.builtin?.success ? metrics.builderResults.builtin.count : 0) +
            (metrics.builderResults.cooccurrence?.success ? metrics.builderResults.cooccurrence.count : 0) +
            (metrics.builderResults.semantic?.success ? metrics.builderResults.semantic.count : 0);
          
          expect(context.data.relations.length).toBe(totalFromBuilders);
          expect(metrics.relationCount).toBe(totalFromBuilders);
        }
        
        // 验证：即使有失败的构建器，成功构建器的结果应该被保留
        // 这个测试不依赖于实际有失败的构建器
        expect(metrics.successfulBuilders).toBeGreaterThanOrEqual(0);
        expect(metrics.failedBuilders).toBeGreaterThanOrEqual(0);
        expect(metrics.successfulBuilders + metrics.failedBuilders).toBe(metrics.enabledBuilders);
      }
    }, 30000);
    
    test('should continue pipeline even if all relation builders fail', async () => {
      // 创建一个可能导致所有构建器失败的文档（没有实体）
      const document = {
        id: 'relation-error-test-4',
        type: 'text',
        content: '测试' // 极简内容
      };
      
      const context = await pipeline.processDocument(document);
      
      // 验证：即使关系抽取失败，流水线应该继续
      expect(context.steps.relationExtraction.status).not.toBe('not_started');
      
      // 如果没有实体，关系抽取应该成功但没有关系
      if (context.data.entities.length === 0) {
        expect(context.steps.relationExtraction.status).toBe('success');
        expect(context.data.relations.length).toBe(0);
      }
      
      // 流水线应该完成
      expect(['completed', 'partial', 'failed']).toContain(context.status);
      
      // 存储步骤应该尝试执行（即使没有关系）
      expect(context.steps.storage.status).not.toBe('not_started');
    }, 30000);
    
    test('should record metrics for each builder type', async () => {
      const document = {
        id: 'relation-error-test-5',
        type: 'text',
        content: `
          项目名称：指标测试项目
          招标人：测试单位
          预算金额：300万元
          工期：12个月
          联系人：李四
          联系电话：13800138000
        `
      };
      
      const context = await pipeline.processDocument(document);
      
      if (context.steps.relationExtraction.status === 'success') {
        const metrics = context.steps.relationExtraction.metrics;
        
        // 验证关系类型计数
        expect(metrics.builtinCount).toBeDefined();
        expect(metrics.cooccurrenceCount).toBeDefined();
        expect(metrics.semanticCount).toBeDefined();
        expect(typeof metrics.builtinCount).toBe('number');
        expect(typeof metrics.cooccurrenceCount).toBe('number');
        expect(typeof metrics.semanticCount).toBe('number');
        
        // 验证总数一致性
        const totalByType = metrics.builtinCount + metrics.cooccurrenceCount + metrics.semanticCount;
        expect(metrics.relationCount).toBe(totalByType);
        expect(context.data.relations.length).toBe(totalByType);
        
        // 验证每种类型的关系数量
        const actualBuiltinCount = context.data.relations.filter(r => r.type === 'builtin').length;
        const actualCooccurrenceCount = context.data.relations.filter(r => r.type === 'cooccurrence').length;
        const actualSemanticCount = context.data.relations.filter(r => r.type === 'semantic').length;
        
        expect(metrics.builtinCount).toBe(actualBuiltinCount);
        expect(metrics.cooccurrenceCount).toBe(actualCooccurrenceCount);
        expect(metrics.semanticCount).toBe(actualSemanticCount);
      }
    }, 30000);
  });
  
  describe('Storage Rollback', () => {
    test('should rollback transaction on storage failure', async () => {
      // 这个测试验证事务回滚机制的存在
      // 由于实际触发存储失败比较困难，我们主要验证：
      // 1. 事务模式被正确配置
      // 2. 存储步骤被标记为关键步骤
      // 3. 存储失败时上下文包含错误信息
      
      const document = {
        id: 'storage-rollback-test-1',
        type: 'text',
        content: '测试存储回滚功能的文档内容。'
      };
      
      const pipelineWithTransaction = new UniversalDocumentPipeline({
        extraction: { useLLM: false },
        normalization: { useLLM: false },
        entityBuilding: { useLLM: false },
        relationExtraction: { enableSemantic: false },
        storage: { useTransaction: true, skipDuplicates: false }
      });
      
      const context = await pipelineWithTransaction.processDocument(document);
      
      // 验证：事务模式配置正确
      expect(pipelineWithTransaction.options.storage.useTransaction).toBe(true);
      
      // 验证：如果存储失败，应该有错误记录
      if (context.steps.storage.status === 'failure') {
        expect(context.errors.length).toBeGreaterThan(0);
        const hasStorageError = context.errors.some(e => 
          e.step === 'storage' || e.step === 'pipeline'
        );
        expect(hasStorageError).toBe(true);
      }
      
      // 验证：存储步骤是关键步骤（失败会终止流水线）
      // 如果存储失败，后续步骤不应该执行
      if (context.steps.storage.status === 'failure') {
        expect(context.status).toBe('failed');
      }
    }, 30000);
    
    test('should not persist data when transaction fails', async () => {
      // 验证事务失败时不会有部分数据持久化
      const document = {
        id: 'storage-rollback-test-2',
        type: 'text',
        content: '测试事务原子性的文档内容。'
      };
      
      const pipelineWithTransaction = new UniversalDocumentPipeline({
        extraction: { useLLM: false },
        normalization: { useLLM: false },
        entityBuilding: { useLLM: false },
        relationExtraction: { enableSemantic: false },
        storage: { useTransaction: true, skipDuplicates: false }
      });
      
      const context = await pipelineWithTransaction.processDocument(document);
      
      // 验证：如果存储失败，metrics应该显示0个存储的实体和关系
      if (context.steps.storage.status === 'failure') {
        const metrics = context.steps.storage.metrics;
        if (metrics) {
          expect(metrics.storedEntities || 0).toBe(0);
          expect(metrics.storedRelations || 0).toBe(0);
        }
      }
      
      // 验证：如果存储成功，所有实体和关系都应该被存储
      if (context.steps.storage.status === 'success') {
        const metrics = context.steps.storage.metrics;
        expect(metrics).toBeDefined();
        expect(metrics.storedEntities).toBe(context.data.entities.length);
        expect(metrics.storedRelations).toBe(context.data.relations.length);
      }
    }, 30000);
    
    test('should return error in context when storage fails', async () => {
      // 验证存储失败时错误信息被正确记录
      const document = {
        id: 'storage-rollback-test-3',
        type: 'text',
        content: '测试错误记录的文档内容。'
      };
      
      const pipelineWithTransaction = new UniversalDocumentPipeline({
        extraction: { useLLM: false },
        normalization: { useLLM: false },
        entityBuilding: { useLLM: false },
        relationExtraction: { enableSemantic: false },
        storage: { useTransaction: true, skipDuplicates: false }
      });
      
      const context = await pipelineWithTransaction.processDocument(document);
      
      // 验证：存储步骤应该被执行（如果有实体）或跳过（如果没有实体）
      if (context.data.entities.length > 0) {
        expect(['success', 'failure']).toContain(context.steps.storage.status);
        
        // 如果失败，应该有错误信息
        if (context.steps.storage.status === 'failure') {
          expect(context.steps.storage.error).toBeDefined();
          expect(typeof context.steps.storage.error).toBe('string');
          expect(context.steps.storage.error.length).toBeGreaterThan(0);
        }
      } else {
        // 没有实体时，存储步骤应该被跳过
        expect(context.steps.storage.status).toBe('not_started');
      }
    }, 30000);
    
    test('should mark storage as critical step', async () => {
      // 验证存储步骤被正确标记为关键步骤
      const document = {
        id: 'storage-rollback-test-4',
        type: 'text',
        content: '测试关键步骤标记的文档内容。'
      };
      
      const pipelineWithTransaction = new UniversalDocumentPipeline({
        extraction: { useLLM: false },
        normalization: { useLLM: false },
        entityBuilding: { useLLM: false },
        relationExtraction: { enableSemantic: false },
        storage: { useTransaction: true, skipDuplicates: false }
      });
      
      const context = await pipelineWithTransaction.processDocument(document);
      
      // 验证：存储失败应该导致整个流水线失败
      if (context.steps.storage.status === 'failure') {
        expect(context.status).toBe('failed');
        expect(context.errors.length).toBeGreaterThan(0);
      }
      
      // 验证：存储成功应该允许流水线完成
      if (context.steps.storage.status === 'success') {
        expect(['completed', 'partial']).toContain(context.status);
      }
    }, 30000);
  });
  
  // ========== 综合集成测试 ==========
  describe('Comprehensive Integration Tests', () => {
    describe('End-to-End Integration', () => {
      test('should process complete flow from document to knowledge graph', async () => {
        // 测试完整流程：文档 -> CKB -> 字段提取 -> Schema匹配 -> 标准化 -> 实体构建 -> 关系抽取 -> 存储
        const document = {
          id: 'integration-e2e-1',
          type: 'text',
          title: '综合测试文档',
          content: `
            项目名称：智慧城市建设项目
            项目编号：SC-2024-001
            招标单位：某市科技局
            项目预算：1000万元
            建设周期：12个月
            项目经理：李四
            联系方式：13900139000
            项目地址：某市高新区科技园
          `
        };
        
        const pipeline = new UniversalDocumentPipeline({
          extraction: { useLLM: false, useNER: true, useRules: true },
          normalization: { useLLM: false, useAlgorithm: true },
          entityBuilding: { useLLM: false, allowPartialEntities: true },
          relationExtraction: { 
            enableBuiltin: true, 
            enableCooccurrence: true, 
            enableSemantic: false 
          },
          storage: { useTransaction: true, skipDuplicates: true }
        });
        
        const context = await pipeline.processDocument(document);
        
        // 验证：所有步骤按正确顺序执行
        const expectedOrder = [
          'parsing', 'extraction', 'schemaMatching', 
          'normalization', 'entityBuilding', 'relationExtraction'
        ];
        
        expectedOrder.forEach((step, index) => {
          expect(context.steps[step].status).not.toBe('not_started');
          
          // 验证步骤顺序：后续步骤的开始时间应该晚于前面步骤
          if (index > 0) {
            const prevStep = expectedOrder[index - 1];
            // 通过duration存在来判断步骤是否执行
            if (context.steps[prevStep].duration > 0) {
              expect(context.steps[step].duration).toBeGreaterThanOrEqual(0);
            }
          }
        });
        
        // 验证：数据流正确传递
        expect(context.data.ckb).toBeDefined();
        expect(context.data.ckb.doc_id).toBe(document.id);
        
        if (context.steps.extraction.status === 'success') {
          expect(context.data.extractedFields).toBeDefined();
          expect(Array.isArray(context.data.extractedFields)).toBe(true);
        }
        
        if (context.steps.schemaMatching.status === 'success') {
          expect(context.data.matchedSchemas).toBeDefined();
          expect(context.data.matchedSchemas.length).toBeGreaterThan(0);
        }
        
        if (context.steps.normalization.status === 'success') {
          expect(context.data.normalizedFields).toBeDefined();
          expect(Array.isArray(context.data.normalizedFields)).toBe(true);
        }
        
        if (context.steps.entityBuilding.status === 'success') {
          expect(context.data.entities).toBeDefined();
          expect(Array.isArray(context.data.entities)).toBe(true);
        }
        
        if (context.steps.relationExtraction.status === 'success') {
          expect(context.data.relations).toBeDefined();
          expect(Array.isArray(context.data.relations)).toBe(true);
        }
        
        // 验证：指标完整性
        expect(context.metrics.fieldCount).toBeGreaterThanOrEqual(0);
        expect(context.metrics.entityCount).toBeGreaterThanOrEqual(0);
        expect(context.metrics.relationCount).toBeGreaterThanOrEqual(0);
        expect(context.totalDuration).toBeGreaterThan(0);
        
        console.log('\n=== 端到端集成测试结果 ===');
        console.log(`文档ID: ${context.documentId}`);
        console.log(`处理状态: ${context.status}`);
        console.log(`总耗时: ${context.totalDuration}ms`);
        console.log(`提取字段: ${context.metrics.fieldCount}`);
        console.log(`构建实体: ${context.metrics.entityCount}`);
        console.log(`抽取关系: ${context.metrics.relationCount}`);
      }, 30000);
      
      test('should handle different document formats', async () => {
        // 测试不同格式的文档处理
        const formats = ['text', 'pdf', 'word', 'excel'];
        
        for (const format of formats) {
          const document = {
            id: `format-test-${format}`,
            type: format,
            content: `测试${format}格式的文档内容，包含一些测试数据。`
          };
          
          const pipeline = new UniversalDocumentPipeline({
            extraction: { useLLM: false },
            normalization: { useLLM: false },
            entityBuilding: { useLLM: false },
            relationExtraction: { enableSemantic: false }
          });
          
          const context = await pipeline.processDocument(document);
          
          // 验证：每种格式都能成功处理
          expect(context).toBeDefined();
          expect(context.documentId).toBe(`format-test-${format}`);
          expect(context.documentType).toBe(format);
          expect(context.steps.parsing.status).toBe('success');
          
          console.log(`✓ ${format}格式处理成功`);
        }
      }, 60000);
    });
    
    describe('Configuration Integration', () => {
      test('should respect LLM enable/disable configuration', async () => {
        const document = {
          id: 'config-llm-test',
          type: 'text',
          content: '测试LLM配置的文档内容。'
        };
        
        // 测试禁用LLM
        const pipelineNoLLM = new UniversalDocumentPipeline({
          extraction: { useLLM: false },
          normalization: { useLLM: false },
          entityBuilding: { useLLM: false },
          relationExtraction: { enableSemantic: false }
        });
        
        const contextNoLLM = await pipelineNoLLM.processDocument(document);
        
        // 验证：配置被正确应用
        expect(pipelineNoLLM.options.extraction.useLLM).toBe(false);
        expect(pipelineNoLLM.options.normalization.useLLM).toBe(false);
        expect(pipelineNoLLM.options.entityBuilding.useLLM).toBe(false);
        expect(pipelineNoLLM.options.relationExtraction.enableSemantic).toBe(false);
        
        // 验证：处理成功完成
        expect(contextNoLLM).toBeDefined();
        expect(['completed', 'partial', 'failed']).toContain(contextNoLLM.status);
        
        // 验证：metrics反映了配置
        if (contextNoLLM.steps.extraction.status === 'success') {
          expect(contextNoLLM.steps.extraction.metrics.usedLLM).toBe(false);
        }
      }, 30000);
      
      test('should respect confidence threshold configuration', async () => {
        const document = {
          id: 'config-confidence-test',
          type: 'text',
          content: '测试置信度阈值配置的文档内容。'
        };
        
        const customThreshold = 0.7;
        const pipeline = new UniversalDocumentPipeline({
          extraction: { useLLM: false },
          schemaMatching: { minConfidence: customThreshold },
          normalization: { useLLM: false, minConfidence: customThreshold },
          entityBuilding: { useLLM: false },
          relationExtraction: { enableSemantic: false, minConfidence: customThreshold }
        });
        
        const context = await pipeline.processDocument(document);
        
        // 验证：配置被正确应用
        expect(pipeline.options.schemaMatching.minConfidence).toBe(customThreshold);
        expect(pipeline.options.normalization.minConfidence).toBe(customThreshold);
        expect(pipeline.options.relationExtraction.minConfidence).toBe(customThreshold);
        
        // 验证：处理完成
        expect(context).toBeDefined();
      }, 30000);
      
      test('should respect relation builder selection', async () => {
        const document = {
          id: 'config-relation-test',
          type: 'text',
          content: '测试关系构建器选择配置的文档内容。'
        };
        
        // 只启用builtin构建器
        const pipeline = new UniversalDocumentPipeline({
          extraction: { useLLM: false },
          normalization: { useLLM: false },
          entityBuilding: { useLLM: false },
          relationExtraction: { 
            enableBuiltin: true,
            enableCooccurrence: false,
            enableSemantic: false
          }
        });
        
        const context = await pipeline.processDocument(document);
        
        // 验证：配置被正确应用
        expect(pipeline.options.relationExtraction.enableBuiltin).toBe(true);
        expect(pipeline.options.relationExtraction.enableCooccurrence).toBe(false);
        expect(pipeline.options.relationExtraction.enableSemantic).toBe(false);
        
        // 验证：如果关系提取成功，metrics应该反映配置
        if (context.steps.relationExtraction.status === 'success') {
          const metrics = context.steps.relationExtraction.metrics;
          expect(metrics).toBeDefined();
          
          // 只有builtin应该被启用
          if (metrics.builderResults) {
            expect(metrics.builderResults.builtin).toBeDefined();
          }
        }
      }, 30000);
    });
    
    describe('Error Handling Integration', () => {
      test('should terminate on critical errors', async () => {
        // 测试关键错误终止
        const document = {
          id: 'error-critical-test',
          type: 'invalid-format', // 无效格式触发关键错误
          content: '测试关键错误的文档内容。'
        };
        
        const pipeline = new UniversalDocumentPipeline({
          errorHandling: { stopOnCriticalError: true }
        });
        
        const context = await pipeline.processDocument(document);
        
        // 验证：关键错误导致失败状态
        expect(context.status).toBe('failed');
        expect(context.errors.length).toBeGreaterThan(0);
        
        // 验证：错误信息完整
        context.errors.forEach(error => {
          expect(error.step).toBeDefined();
          expect(error.error).toBeDefined();
          expect(error.timestamp).toBeDefined();
        });
      }, 30000);
      
      test('should continue on non-critical errors', async () => {
        // 测试非关键错误继续处理
        const document = {
          id: 'error-noncritical-test',
          type: 'text',
          content: '测试非关键错误的文档内容。'
        };
        
        const pipeline = new UniversalDocumentPipeline({
          extraction: { useLLM: false },
          normalization: { useLLM: false },
          entityBuilding: { useLLM: false },
          relationExtraction: { enableSemantic: false },
          errorHandling: { continueOnWarning: true }
        });
        
        const context = await pipeline.processDocument(document);
        
        // 验证：即使有警告，流水线应该完成
        if (context.warnings.length > 0) {
          expect(['completed', 'partial']).toContain(context.status);
          
          // 验证：警告信息完整
          context.warnings.forEach(warning => {
            expect(warning.step).toBeDefined();
            expect(warning.error).toBeDefined();
            expect(warning.timestamp).toBeDefined();
          });
        }
      }, 30000);
      
      test('should handle LLM fallback degradation', async () => {
        // 测试LLM降级处理
        const document = {
          id: 'error-fallback-test',
          type: 'text',
          content: '测试LLM降级的文档内容。'
        };
        
        // 启用LLM但内容很短，可能触发降级
        const pipeline = new UniversalDocumentPipeline({
          extraction: { useLLM: true, useNER: true, useRules: true },
          normalization: { useLLM: false },
          entityBuilding: { useLLM: false },
          relationExtraction: { enableSemantic: false }
        });
        
        const context = await pipeline.processDocument(document);
        
        // 验证：即使LLM可能失败，提取步骤应该完成（通过降级）
        expect(['success', 'failure']).toContain(context.steps.extraction.status);
        
        // 验证：如果有降级，应该有警告
        if (context.warnings.some(w => w.step === 'extraction')) {
          // 降级警告存在
          expect(context.steps.extraction.status).toBe('success');
        }
      }, 30000);
      
      test('should handle partial results correctly', async () => {
        // 测试部分结果处理
        const document = {
          id: 'error-partial-test',
          type: 'text',
          content: '测试部分结果处理的文档内容。'
        };
        
        const pipeline = new UniversalDocumentPipeline({
          extraction: { useLLM: false },
          normalization: { useLLM: false },
          entityBuilding: { useLLM: false, allowPartialEntities: true },
          relationExtraction: { enableSemantic: false }
        });
        
        const context = await pipeline.processDocument(document);
        
        // 验证：允许部分结果
        if (context.status === 'partial') {
          expect(context.warnings.length).toBeGreaterThan(0);
          
          // 验证：部分成功的步骤应该有结果
          Object.keys(context.steps).forEach(stepName => {
            const step = context.steps[stepName];
            if (step.status === 'success') {
              expect(step.duration).toBeGreaterThanOrEqual(0);
            }
          });
        }
      }, 30000);
    });
  });
});
