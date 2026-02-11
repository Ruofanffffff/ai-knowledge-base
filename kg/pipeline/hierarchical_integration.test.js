/**
 * Integration Test: Hierarchical Relation Extraction in Pipeline
 * 
 * Tests the integration of HierarchicalRelationExtractor into the universal document pipeline.
 */

const { UniversalDocumentPipeline } = require('./universal_document_pipeline');

describe('Hierarchical Relation Extraction Integration', () => {
  let pipeline;
  
  beforeEach(() => {
    // Create pipeline with hierarchical extraction enabled
    pipeline = new UniversalDocumentPipeline({
      relationExtraction: {
        enableBuiltin: true,
        enableCooccurrence: false,
        enableSemantic: false,
        enableHierarchical: true,
        hierarchicalMethod: 'pattern'
      }
    });
  });
  
  describe('Pattern-based Hierarchical Extraction', () => {
    test('should extract is_a relations from Chinese text', async () => {
      const document = {
        id: 'test-hierarchical-1',
        type: 'text',
        title: '摄影设备介绍',
        content: `
          Canon EOS R5是一种全画幅无反相机。
          这款相机配备了4500万像素传感器。
          它属于佳能的专业级相机系列。
        `
      };
      
      const context = await pipeline.processDocument(document);
      
      // Verify hierarchical extraction step was executed
      expect(context.steps.hierarchicalExtraction).toBeDefined();
      expect(context.steps.hierarchicalExtraction.status).toBe('success');
      
      // Verify hierarchical relations were extracted
      const hierarchicalRelations = context.data.relations.filter(
        r => r.type === 'hierarchical' && r.subtype === 'is_a'
      );
      
      expect(hierarchicalRelations.length).toBeGreaterThan(0);
      
      // Verify relation structure
      const relation = hierarchicalRelations[0];
      expect(relation).toHaveProperty('source_id');
      expect(relation).toHaveProperty('target_id');
      expect(relation).toHaveProperty('type', 'hierarchical');
      expect(relation).toHaveProperty('subtype', 'is_a');
      expect(relation).toHaveProperty('description');
      expect(relation).toHaveProperty('confidence');
      expect(relation.confidence).toBeGreaterThanOrEqual(0.5);
    });
    
    test('should extract part_of relations from Chinese text', async () => {
      const document = {
        id: 'test-hierarchical-2',
        type: 'text',
        title: '相机组成',
        content: `
          镜头是相机的重要组成部分。
          传感器是相机的核心部件。
          相机包含快门、光圈和对焦系统。
        `
      };
      
      const context = await pipeline.processDocument(document);
      
      // Verify part_of relations were extracted
      const partOfRelations = context.data.relations.filter(
        r => r.type === 'hierarchical' && r.subtype === 'part_of'
      );
      
      expect(partOfRelations.length).toBeGreaterThan(0);
    });
    
    test('should extract has_property relations from Chinese text', async () => {
      const document = {
        id: 'test-hierarchical-3',
        type: 'text',
        title: '相机参数',
        content: `
          Canon EOS R5具有4500万像素。
          这款相机的ISO范围是100-51200。
          相机拥有8K视频录制能力。
        `
      };
      
      const context = await pipeline.processDocument(document);
      
      // Verify has_property relations were extracted
      const hasPropertyRelations = context.data.relations.filter(
        r => r.type === 'hierarchical' && r.subtype === 'has_property'
      );
      
      expect(hasPropertyRelations.length).toBeGreaterThan(0);
    });
  });
  
  describe('Configuration Options', () => {
    test('should skip hierarchical extraction when disabled', async () => {
      const pipelineDisabled = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: false
        }
      });
      
      const document = {
        id: 'test-hierarchical-disabled',
        type: 'text',
        content: 'Canon EOS R5是一种全画幅无反相机。'
      };
      
      const context = await pipelineDisabled.processDocument(document);
      
      // Verify hierarchical extraction step was not executed
      expect(context.steps.hierarchicalExtraction.status).toBe('not_started');
      
      // Verify no hierarchical relations were extracted
      const hierarchicalRelations = context.data.relations.filter(
        r => r.type === 'hierarchical'
      );
      
      expect(hierarchicalRelations.length).toBe(0);
    });
    
    test('should use specified extraction method', async () => {
      const pipelinePattern = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'pattern'
        }
      });
      
      const document = {
        id: 'test-hierarchical-method',
        type: 'text',
        content: 'Canon EOS R5是一种全画幅无反相机。'
      };
      
      const context = await pipelinePattern.processDocument(document);
      
      // Verify method was recorded in metrics
      expect(context.steps.hierarchicalExtraction.metrics.method).toBe('pattern');
    });
  });
  
  describe('Error Handling', () => {
    test('should handle empty document gracefully', async () => {
      const document = {
        id: 'test-hierarchical-empty',
        type: 'text',
        content: ''
      };
      
      const context = await pipeline.processDocument(document);
      
      // Should complete with warning
      expect(context.status).toBe('partial');
      expect(context.warnings.some(w => w.step === 'hierarchicalExtraction')).toBe(true);
    });
    
    test('should continue pipeline on hierarchical extraction failure', async () => {
      const document = {
        id: 'test-hierarchical-continue',
        type: 'text',
        content: '这是一个测试文档。'
      };
      
      const context = await pipeline.processDocument(document);
      
      // Pipeline should complete even if hierarchical extraction fails or finds nothing
      expect(['completed', 'partial']).toContain(context.status);
    });
  });
  
  describe('Metrics and Reporting', () => {
    test('should record hierarchical extraction metrics', async () => {
      const document = {
        id: 'test-hierarchical-metrics',
        type: 'text',
        content: `
          Canon EOS R5是一种全画幅无反相机。
          镜头是相机的重要组成部分。
          相机具有4500万像素。
        `
      };
      
      const context = await pipeline.processDocument(document);
      
      // Verify metrics were recorded
      const metrics = context.steps.hierarchicalExtraction.metrics;
      expect(metrics).toHaveProperty('hierarchicalCount');
      expect(metrics).toHaveProperty('isACount');
      expect(metrics).toHaveProperty('partOfCount');
      expect(metrics).toHaveProperty('hasPropertyCount');
      expect(metrics).toHaveProperty('method');
      
      // Verify counts are non-negative
      expect(metrics.hierarchicalCount).toBeGreaterThanOrEqual(0);
      expect(metrics.isACount).toBeGreaterThanOrEqual(0);
      expect(metrics.partOfCount).toBeGreaterThanOrEqual(0);
      expect(metrics.hasPropertyCount).toBeGreaterThanOrEqual(0);
    });
    
    test('should include hierarchical relations in total relation count', async () => {
      const document = {
        id: 'test-hierarchical-total',
        type: 'text',
        content: 'Canon EOS R5是一种全画幅无反相机。'
      };
      
      const context = await pipeline.processDocument(document);
      
      // Total relation count should include hierarchical relations
      const hierarchicalCount = context.steps.hierarchicalExtraction.metrics.hierarchicalCount || 0;
      const totalRelations = context.data.relations.length;
      
      expect(totalRelations).toBeGreaterThanOrEqual(hierarchicalCount);
    });
  });
});
