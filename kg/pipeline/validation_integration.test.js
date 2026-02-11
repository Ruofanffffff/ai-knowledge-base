/**
 * Integration tests for Human Readability Validator in Pipeline
 * 
 * Tests the integration of HumanReadabilityValidator with the universal document pipeline.
 * Validates that quality reports are generated and validation results are included in output.
 */

const { UniversalDocumentPipeline } = require('./universal_document_pipeline');

describe('Human Readability Validator - Pipeline Integration', () => {
  let pipeline;
  
  beforeEach(() => {
    pipeline = new UniversalDocumentPipeline({
      extraction: { useLLM: false, useNER: false, useRules: true },
      schemaMatching: { useLLM: false },
      normalization: { useLLM: false },
      entityBuilding: { useLLM: false },
      relationExtraction: {
        enableBuiltin: true,
        enableCooccurrence: false,
        enableSemantic: false,
        enableHierarchical: false
      }
    });
  });
  
  describe('Validation Step Execution', () => {
    test('should execute validation step after relation extraction', async () => {
      const document = {
        id: 'test-doc-001',
        type: 'text',
        title: '测试文档',
        content: '项目名称：北京故宫修缮工程。项目地点：北京市东城区。预算金额：5000万元。'
      };
      
      const context = await pipeline.processDocument(document);
      
      // Validation step should be executed
      expect(context.steps.validation).toBeDefined();
      expect(context.steps.validation.status).toBe('success');
      
      // Validation result should be in context data
      expect(context.data.validationResult).toBeDefined();
    });
    
    test('should include validation metrics in context', async () => {
      const document = {
        id: 'test-doc-002',
        type: 'text',
        title: '摄影文档',
        content: 'Canon EOS R5相机，ISO 100，快门速度1/125秒，光圈F2.8。拍摄地点：北京故宫。'
      };
      
      const context = await pipeline.processDocument(document);
      
      // Validation metrics should be recorded if validation was executed
      if (context.steps.validation.status === 'success') {
        expect(context.steps.validation.metrics).toBeDefined();
        expect(context.steps.validation.metrics.entityNameScore).toBeGreaterThanOrEqual(0);
        expect(context.steps.validation.metrics.entityNameScore).toBeLessThanOrEqual(1);
        expect(context.steps.validation.metrics.overallScore).toBeGreaterThanOrEqual(0);
        expect(context.steps.validation.metrics.overallScore).toBeLessThanOrEqual(1);
      } else {
        // If validation was not executed, it should be because there were no entities
        expect(context.data.entities.length).toBe(0);
      }
    });
    
    test('should skip validation if no entities or relations', async () => {
      const document = {
        id: 'test-doc-003',
        type: 'text',
        title: '空文档',
        content: ''
      };
      
      const context = await pipeline.processDocument(document);
      
      // Validation step should not be executed
      expect(context.steps.validation.status).toBe('not_started');
    });
  });
  
  describe('Validation Results', () => {
    test('should validate entity names', async () => {
      const document = {
        id: 'test-doc-004',
        type: 'text',
        title: '实体测试',
        content: '项目名称：测试项目。项目地点：北京。预算：1000万。'
      };
      
      const context = await pipeline.processDocument(document);
      
      if (context.data.validationResult) {
        const entityValidation = context.data.validationResult.details.entities;
        
        expect(entityValidation).toBeDefined();
        expect(entityValidation.totalCount).toBeGreaterThan(0);
        expect(entityValidation.validCount).toBeGreaterThanOrEqual(0);
        expect(entityValidation.score).toBeGreaterThanOrEqual(0);
        expect(entityValidation.score).toBeLessThanOrEqual(1);
        expect(Array.isArray(entityValidation.errors)).toBe(true);
        expect(Array.isArray(entityValidation.warnings)).toBe(true);
      }
    });
    
    test('should validate relation descriptions', async () => {
      const document = {
        id: 'test-doc-005',
        type: 'text',
        title: '关系测试',
        content: 'Canon EOS R5拍摄于北京故宫。使用ISO 100进行拍摄。'
      };
      
      const context = await pipeline.processDocument(document);
      
      if (context.data.validationResult && context.data.relations.length > 0) {
        const relationValidation = context.data.validationResult.details.relations;
        
        expect(relationValidation).toBeDefined();
        expect(relationValidation.totalCount).toBeGreaterThan(0);
        expect(relationValidation.validCount).toBeGreaterThanOrEqual(0);
        expect(relationValidation.score).toBeGreaterThanOrEqual(0);
        expect(relationValidation.score).toBeLessThanOrEqual(1);
        expect(Array.isArray(relationValidation.errors)).toBe(true);
        expect(Array.isArray(relationValidation.warnings)).toBe(true);
      }
    });
    
    test('should generate quality report', async () => {
      const document = {
        id: 'test-doc-006',
        type: 'text',
        title: '质量报告测试',
        content: '项目：北京地铁建设。地点：北京市。预算：10亿元。工期：3年。'
      };
      
      const context = await pipeline.processDocument(document);
      
      if (context.data.validationResult) {
        expect(context.data.validationResult.score).toBeGreaterThanOrEqual(0);
        expect(context.data.validationResult.score).toBeLessThanOrEqual(1);
        expect(context.data.validationResult.details).toBeDefined();
        expect(context.data.validationResult.details.entities).toBeDefined();
        expect(context.data.validationResult.details.relations).toBeDefined();
        expect(context.data.validationResult.passed).toBeDefined();
        expect(Array.isArray(context.data.validationResult.warnings)).toBe(true);
        expect(Array.isArray(context.data.validationResult.errors)).toBe(true);
      }
    });
  });
  
  describe('Quality Warnings', () => {
    test('should add warning if quality score is low', async () => {
      // Create a document that will likely produce low quality entities
      const document = {
        id: 'test-doc-007',
        type: 'text',
        title: '低质量文档',
        content: 'unknown unknown unknown'
      };
      
      const context = await pipeline.processDocument(document);
      
      // Check if validation was executed
      if (context.steps.validation.status === 'success' && context.data.validationResult) {
        const overallScore = context.data.validationResult.score;
        
        // If score is low, there should be a warning
        if (overallScore < 0.7) {
          const validationWarnings = context.warnings.filter(w => w.step === 'validation');
          expect(validationWarnings.length).toBeGreaterThan(0);
        }
      }
    });
    
    test('should not fail pipeline if validation fails', async () => {
      const document = {
        id: 'test-doc-008',
        type: 'text',
        title: '正常文档',
        content: '项目名称：测试项目。项目地点：北京市。'
      };
      
      const context = await pipeline.processDocument(document);
      
      // Pipeline should complete successfully even if validation has issues
      expect(context.status).not.toBe('failed');
      expect(['completed', 'partial']).toContain(context.status);
    });
  });
  
  describe('Validation Output in Summary', () => {
    test('should include validation metrics in summary', async () => {
      const document = {
        id: 'test-doc-009',
        type: 'text',
        title: '摘要测试',
        content: 'Canon EOS R5相机，拍摄地点：北京故宫，ISO 100。项目名称：测试项目。'
      };
      
      const context = await pipeline.processDocument(document);
      const summary = context.getSummary();
      
      // Summary should include validation step if it was executed
      if (context.data.entities.length > 0 || context.data.relations.length > 0) {
        expect(summary.steps.validation).toBeDefined();
        
        if (summary.steps.validation.status === 'success') {
          expect(summary.steps.validation.metrics).toBeDefined();
          expect(summary.steps.validation.metrics.overallScore).toBeDefined();
        }
      }
    });
    
    test('should include validation duration in performance metrics', async () => {
      const document = {
        id: 'test-doc-010',
        type: 'text',
        title: '性能测试',
        content: '项目：测试。地点：北京。预算：1000万。'
      };
      
      const context = await pipeline.processDocument(document);
      const summary = context.getSummary();
      
      if (summary.steps.validation && summary.steps.validation.status === 'success') {
        expect(summary.steps.validation.duration).toBeGreaterThanOrEqual(0);
        expect(summary.steps.validation.percentage).toBeDefined();
      }
    });
  });
  
  describe('Validation with Different Document Types', () => {
    test('should validate photography documents', async () => {
      const document = {
        id: 'test-doc-011',
        type: 'text',
        title: '摄影文档',
        content: `
          Canon EOS R5全画幅无反相机
          镜头：RF 24-70mm F2.8
          拍摄参数：ISO 100, 快门1/125s, 光圈F2.8
          拍摄地点：北京故宫
        `
      };
      
      const context = await pipeline.processDocument(document);
      
      if (context.data.validationResult) {
        expect(context.data.validationResult.details.entities.totalCount).toBeGreaterThan(0);
        expect(context.data.validationResult.score).toBeGreaterThan(0);
      }
    });
    
    test('should validate construction documents', async () => {
      const document = {
        id: 'test-doc-012',
        type: 'text',
        title: '建设文档',
        content: `
          项目名称：北京地铁15号线建设工程
          项目地点：北京市朝阳区
          建设单位：北京市地铁建设有限公司
          预算金额：50亿元
          工期：36个月
        `
      };
      
      const context = await pipeline.processDocument(document);
      
      if (context.data.validationResult) {
        expect(context.data.validationResult.details.entities.totalCount).toBeGreaterThan(0);
        expect(context.data.validationResult.score).toBeGreaterThan(0);
      }
    });
  });
});
