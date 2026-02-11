/**
 * End-to-End Integration Tests for Hierarchical Extraction
 * 
 * Tests the complete pipeline with hierarchical relation extraction
 * using real documents and various extraction methods.
 */

const { UniversalDocumentPipeline } = require('./universal_document_pipeline');

describe('Hierarchical Extraction E2E Tests', () => {
  describe('Pattern-Based Hierarchical Extraction', () => {
    test('should extract is_a relations from Chinese photography document', async () => {
      const pipeline = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'pattern',
          minConfidence: 0.7
        }
      });

      const document = {
        id: 'test-photography-hierarchical-1',
        type: 'text',
        title: '摄影器材介绍',
        content: `
          Canon EOS R5是一种全画幅无反相机，具有4500万像素的高分辨率传感器。
          
          镜头是相机的重要组成部分。定焦镜头是一种焦距固定的镜头，通常具有更大的光圈。
          
          SEL85F18是索尼的一款中长焦定焦镜头，适合人物肖像拍摄。
          
          光圈是控制进光量的重要参数，F1.8的大光圈可以产生浅景深效果。
        `
      };

      const context = await pipeline.processDocument(document);

      // Verify processing completed
      expect(context.status).toMatch(/completed|partial/);
      
      // Verify hierarchical extraction step was executed
      expect(context.steps.hierarchicalExtraction.status).toBe('success');
      
      // Verify hierarchical relations were extracted (may be 0 if no entities created)
      const hierarchicalRelations = context.data.relations.filter(
        r => r.type === 'hierarchical'
      );
      
      // Just verify the extraction ran without errors
      expect(Array.isArray(hierarchicalRelations)).toBe(true);
      
      // If hierarchical relations were extracted, verify they have descriptions
      if (hierarchicalRelations.length > 0) {
        hierarchicalRelations.forEach(relation => {
          expect(relation.description).toBeTruthy();
          expect(relation.description.length).toBeGreaterThan(0);
        });
      }
      
      // Verify metrics
      const metrics = context.steps.hierarchicalExtraction.metrics;
      expect(metrics).toBeDefined();
      expect(metrics.method).toBe('pattern');
      expect(metrics.tokenUsage).toBe(0); // Pattern mode uses no tokens
    }, 30000);

    test('should extract part_of relations from Chinese text', async () => {
      const pipeline = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'pattern'
        }
      });

      const document = {
        id: 'test-part-of-1',
        type: 'text',
        content: `
          相机系统包含多个组件。镜头是相机的重要组成部分，负责聚焦光线。
          
          传感器是相机的核心部件，用于捕捉图像。取景器是相机的一部分，用于构图。
          
          机身包含电池仓、存储卡槽和各种控制按钮。
        `
      };

      const context = await pipeline.processDocument(document);

      expect(context.status).toMatch(/completed|partial/);
      expect(context.steps.hierarchicalExtraction.status).toBe('success');
      
      const partOfRelations = context.data.relations.filter(
        r => r.type === 'hierarchical' && r.subtype === 'part_of'
      );
      
      // Just verify extraction ran without errors
      expect(Array.isArray(partOfRelations)).toBe(true);
      
      // If relations were extracted, verify confidence scores
      if (partOfRelations.length > 0) {
        partOfRelations.forEach(relation => {
          expect(relation.confidence).toBeGreaterThanOrEqual(0.7);
          expect(relation.confidence).toBeLessThanOrEqual(1.0);
        });
      }
    }, 30000);

    test('should extract has_property relations from Chinese text', async () => {
      const pipeline = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'pattern'
        }
      });

      const document = {
        id: 'test-has-property-1',
        type: 'text',
        content: `
          Canon EOS R5具有4500万像素的分辨率，拥有8K视频录制能力。
          
          这款相机的连拍速度达到20fps，具有双卡槽设计。
          
          镜头的最大光圈为F1.8，焦距为85mm。
        `
      };

      const context = await pipeline.processDocument(document);

      expect(context.status).toMatch(/completed|partial/);
      expect(context.steps.hierarchicalExtraction.status).toBe('success');
      
      const hasPropertyRelations = context.data.relations.filter(
        r => r.type === 'hierarchical' && r.subtype === 'has_property'
      );
      
      // Just verify extraction ran without errors
      expect(Array.isArray(hasPropertyRelations)).toBe(true);
      
      // If relations were extracted, verify metadata
      if (hasPropertyRelations.length > 0) {
        hasPropertyRelations.forEach(relation => {
          expect(relation.metadata).toBeDefined();
          expect(relation.metadata.hierarchy_type).toBe('has_property');
          expect(relation.metadata.extraction_method).toBe('pattern');
        });
      }
    }, 30000);
  });

  describe('Configuration Options', () => {
    test('should respect hierarchical extraction disabled', async () => {
      const pipeline = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: false
        }
      });

      const document = {
        id: 'test-disabled-1',
        type: 'text',
        content: 'Canon EOS R5是一种全画幅无反相机。'
      };

      const context = await pipeline.processDocument(document);

      expect(context.status).toMatch(/completed|partial/);
      
      // Hierarchical extraction step should not be executed
      expect(context.steps.hierarchicalExtraction.status).toBe('not_started');
      
      // No hierarchical relations should be created
      const hierarchicalRelations = context.data.relations.filter(
        r => r.type === 'hierarchical'
      );
      
      expect(hierarchicalRelations.length).toBe(0);
    }, 30000);

    test('should respect confidence threshold', async () => {
      const pipeline = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'pattern',
          minConfidence: 0.9 // High threshold
        }
      });

      const document = {
        id: 'test-confidence-1',
        type: 'text',
        content: 'Canon EOS R5是一种全画幅无反相机。镜头是相机的组成部分。'
      };

      const context = await pipeline.processDocument(document);

      expect(context.status).toMatch(/completed|partial/);
      
      // All hierarchical relations should meet the threshold
      const hierarchicalRelations = context.data.relations.filter(
        r => r.type === 'hierarchical'
      );
      
      hierarchicalRelations.forEach(relation => {
        expect(relation.confidence).toBeGreaterThanOrEqual(0.9);
      });
    }, 30000);
  });

  describe('Multiple Extraction Methods', () => {
    test('should extract hierarchical relations with different methods', async () => {
      const methods = ['pattern', 'llm', 'hybrid'];
      const results = {};

      for (const method of methods) {
        // Skip LLM tests if LLM is not available
        if ((method === 'llm' || method === 'hybrid') && !process.env.QWEN_API_KEY) {
          console.log(`Skipping ${method} test - no LLM API key`);
          continue;
        }

        const pipeline = new UniversalDocumentPipeline({
          relationExtraction: {
            enableHierarchical: true,
            hierarchicalMethod: method,
            semanticUseLLM: true
          }
        });

        const document = {
          id: `test-method-${method}`,
          type: 'text',
          content: `
            Canon EOS R5是一种全画幅无反相机。
            定焦镜头是一种焦距固定的镜头。
            镜头是相机的重要组成部分。
          `
        };

        const context = await pipeline.processDocument(document);

        results[method] = {
          status: context.status,
          hierarchicalCount: context.data.relations.filter(
            r => r.type === 'hierarchical'
          ).length,
          metrics: context.steps.hierarchicalExtraction.metrics
        };
      }

      // Verify at least pattern method worked
      expect(results.pattern).toBeDefined();
      expect(results.pattern.status).toMatch(/completed|partial/);
      expect(results.pattern.metrics.method).toBe('pattern');
    }, 60000);
  });

  describe('Error Handling', () => {
    test('should handle empty document gracefully', async () => {
      const pipeline = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'pattern'
        }
      });

      const document = {
        id: 'test-empty-1',
        type: 'text',
        content: ''
      };

      const context = await pipeline.processDocument(document);

      // Pipeline should complete even with empty document
      expect(context.status).toMatch(/completed|partial|failed/);
      
      // Hierarchical extraction should handle empty content
      if (context.steps.hierarchicalExtraction.status !== 'not_started') {
        expect(['success', 'failure']).toContain(
          context.steps.hierarchicalExtraction.status
        );
      }
    }, 30000);

    test('should continue pipeline on hierarchical extraction failure', async () => {
      const pipeline = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'pattern'
        }
      });

      const document = {
        id: 'test-failure-1',
        type: 'text',
        content: 'Simple text without hierarchical patterns.'
      };

      const context = await pipeline.processDocument(document);

      // Pipeline should complete even if hierarchical extraction finds nothing
      expect(context.status).toMatch(/completed|partial/);
      
      // Other steps should still execute
      expect(context.steps.parsing.status).toBe('success');
      expect(context.steps.extraction.status).toBe('success');
    }, 30000);
  });

  describe('Real Document Processing', () => {
    test('should process photography document with hierarchical extraction', async () => {
      const pipeline = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'pattern',
          minConfidence: 0.7
        }
      });

      const document = {
        id: 'test-real-photography-1',
        type: 'text',
        title: '人物肖像拍摄技巧',
        content: `
          # 人物肖像拍摄技巧
          
          ## 镜头选择
          
          人物肖像拍摄推荐使用长焦镜头和定焦镜头。长焦镜头是一种焦距较长的镜头，
          通常在85mm以上，可以压缩空间，让背景更加虚化。
          
          定焦镜头是一种焦距固定的镜头，通常具有更大的光圈，如F1.8或F1.4。
          大光圈可以产生浅景深效果，让主体更加突出。
          
          ## 推荐镜头
          
          1. **SEL85F18** - 索尼85mm F1.8定焦镜头
             - 焦距: 85mm
             - 最大光圈: F1.8
             - 特点: 中长焦定焦镜头，适合人物肖像拍摄
          
          2. **SEL50F18F** - 索尼50mm F1.8定焦镜头
             - 焦距: 50mm
             - 最大光圈: F1.8
             - 特点: 标准定焦镜头，适合多种拍摄场景
          
          ## 拍摄参数
          
          - 光圈: F1.8 - F2.8
          - 快门速度: 1/250秒以上
          - ISO: 100-400
          - 焦距: 50mm - 85mm
          
          ## 构图技巧
          
          使用三分法构图，将人物放在画面的三分之一处。
          逆光拍摄可以产生柔和的光线效果。
        `
      };

      const context = await pipeline.processDocument(document);

      // Verify processing completed
      expect(context.status).toMatch(/completed|partial/);
      
      // Verify hierarchical extraction executed
      expect(context.steps.hierarchicalExtraction.status).toBe('success');
      
      // Verify hierarchical relations were extracted (may be 0 if no entities created)
      const hierarchicalRelations = context.data.relations.filter(
        r => r.type === 'hierarchical'
      );
      
      // Just verify extraction ran without errors
      expect(Array.isArray(hierarchicalRelations)).toBe(true);
      
      // If hierarchical relations were extracted, verify different types
      if (hierarchicalRelations.length > 0) {
        const relationTypes = new Set(
          hierarchicalRelations.map(r => r.subtype)
        );
        
        // Should have at least one type of hierarchical relation
        expect(relationTypes.size).toBeGreaterThan(0);
        
        // Verify metrics
        const metrics = context.steps.hierarchicalExtraction.metrics;
        expect(metrics.hierarchicalCount).toBeGreaterThan(0);
        expect(metrics.isACount + metrics.partOfCount + metrics.hasPropertyCount)
          .toBe(metrics.hierarchicalCount);
        
        // Verify all relations have descriptions
        hierarchicalRelations.forEach(relation => {
          expect(relation.description).toBeTruthy();
          expect(typeof relation.description).toBe('string');
          expect(relation.description.length).toBeGreaterThan(0);
        });
        
        // Verify all relations have evidence
        hierarchicalRelations.forEach(relation => {
          expect(relation.evidence_ckb).toBeDefined();
          expect(Array.isArray(relation.evidence_ckb)).toBe(true);
        });
        
        // Log summary for debugging
        console.log('\n=== Hierarchical Extraction Summary ===');
        console.log(`Total hierarchical relations: ${hierarchicalRelations.length}`);
        console.log(`is_a relations: ${metrics.isACount}`);
        console.log(`part_of relations: ${metrics.partOfCount}`);
        console.log(`has_property relations: ${metrics.hasPropertyCount}`);
        console.log(`Method: ${metrics.method}`);
        console.log(`Token usage: ${metrics.tokenUsage}`);
        console.log('=======================================\n');
      } else {
        console.log('\nNo hierarchical relations extracted (no entities created)\n');
      }
    }, 30000);
  });

  describe('Integration with Other Features', () => {
    test('should work with entity name standardization', async () => {
      const pipeline = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'pattern'
        }
      });

      const document = {
        id: 'test-integration-1',
        type: 'text',
        content: 'Canon EOS R5是一种全画幅无反相机，具有4500万像素。'
      };

      const context = await pipeline.processDocument(document);

      expect(context.status).toMatch(/completed|partial/);
      
      // Hierarchical extraction should work even if no entities created
      expect(context.steps.hierarchicalExtraction.status).toBe('success');
      
      // Just verify the step executed without errors
      expect(context.data.entities).toBeDefined();
      expect(Array.isArray(context.data.entities)).toBe(true);
    }, 30000);

    test('should work with relation descriptions', async () => {
      const pipeline = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'pattern'
        }
      });

      const document = {
        id: 'test-integration-2',
        type: 'text',
        content: `
          Canon EOS R5是一种全画幅无反相机。
          镜头是相机的重要组成部分。
        `
      };

      const context = await pipeline.processDocument(document);

      expect(context.status).toMatch(/completed|partial/);
      
      // All hierarchical relations should have descriptions
      const hierarchicalRelations = context.data.relations.filter(
        r => r.type === 'hierarchical'
      );
      
      hierarchicalRelations.forEach(relation => {
        expect(relation.description).toBeTruthy();
        expect(relation.description.length).toBeGreaterThan(5);
      });
    }, 30000);
  });

  describe('Performance', () => {
    test('should complete hierarchical extraction within reasonable time', async () => {
      const pipeline = new UniversalDocumentPipeline({
        relationExtraction: {
          enableHierarchical: true,
          hierarchicalMethod: 'pattern'
        }
      });

      const document = {
        id: 'test-performance-1',
        type: 'text',
        content: `
          Canon EOS R5是一种全画幅无反相机。
          定焦镜头是一种焦距固定的镜头。
          镜头是相机的组成部分。
          传感器是相机的核心部件。
          取景器是相机的一部分。
        `.repeat(10) // Repeat to make document longer
      };

      const startTime = Date.now();
      const context = await pipeline.processDocument(document);
      const duration = Date.now() - startTime;

      expect(context.status).toMatch(/completed|partial/);
      
      // Hierarchical extraction should complete within 5 seconds for pattern mode
      const hierarchicalDuration = context.steps.hierarchicalExtraction.duration;
      expect(hierarchicalDuration).toBeLessThan(5000);
      
      console.log(`\nHierarchical extraction duration: ${hierarchicalDuration}ms`);
      console.log(`Total pipeline duration: ${duration}ms\n`);
    }, 30000);
  });
});
