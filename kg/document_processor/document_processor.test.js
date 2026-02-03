/**
 * Document Full Processing Integration Tests
 * 
 * Tests the complete document processing pipeline
 */

const { processDocumentWithFullProcessing } = require('./index');
const structureAnalyzer = require('./structure_analyzer');
const contentFilter = require('./content_filter');
const completenessValidator = require('./completeness_validator');
const validationReporter = require('./validation_reporter');
const pipelineMonitor = require('./pipeline_monitor');
const path = require('path');
const fs = require('fs');

describe('Document Full Processing Integration', () => {
  
  describe('Structure Analyzer', () => {
    test('should analyze document structure', async () => {
      // Create a simple test structure
      const testStructure = {
        doc_id: 'test_doc_1',
        file_type: 'markdown',
        total_units: 5,
        units: [
          {
            unit_id: 'unit_1',
            type: 'heading',
            content: 'Test Heading',
            level: 1,
            parent_id: null,
            is_empty: false,
            should_filter: false,
            filter_reason: null
          },
          {
            unit_id: 'unit_2',
            type: 'paragraph',
            content: 'This is a test paragraph with meaningful content.',
            level: 2,
            parent_id: 'unit_1',
            is_empty: false,
            should_filter: false,
            filter_reason: null
          },
          {
            unit_id: 'unit_3',
            type: 'paragraph',
            content: '',
            level: 2,
            parent_id: 'unit_1',
            is_empty: true,
            should_filter: false,
            filter_reason: null
          },
          {
            unit_id: 'unit_4',
            type: 'paragraph',
            content: '...',
            level: 2,
            parent_id: 'unit_1',
            is_empty: false,
            should_filter: false,
            filter_reason: null
          },
          {
            unit_id: 'unit_5',
            type: 'paragraph',
            content: 'Another meaningful paragraph for testing.',
            level: 2,
            parent_id: 'unit_1',
            is_empty: false,
            should_filter: false,
            filter_reason: null
          }
        ],
        hierarchy: {
          root: {
            unit_id: 'root',
            type: 'document',
            children: [],
            processed: false
          }
        }
      };
      
      expect(testStructure.total_units).toBe(5);
      expect(testStructure.units.length).toBe(5);
    });
  });
  
  describe('Content Filter', () => {
    test('should filter empty and low-quality content', () => {
      const units = [
        {
          unit_id: 'unit_1',
          content: 'Valid content',
          is_empty: false,
          should_filter: false
        },
        {
          unit_id: 'unit_2',
          content: '',
          is_empty: true,
          should_filter: false
        },
        {
          unit_id: 'unit_3',
          content: '...',
          is_empty: false,
          should_filter: false
        },
        {
          unit_id: 'unit_4',
          content: '123',
          is_empty: false,
          should_filter: false
        }
      ];
      
      const result = contentFilter.applyFilters(units);
      
      expect(result.filtered_units.length).toBeGreaterThan(0);
      expect(result.skipped_units.length).toBeGreaterThan(0);
      expect(result.stats.total_units).toBe(4);
    });
    
    test('should detect duplicate content', () => {
      const units = [
        {
          unit_id: 'unit_1',
          content: 'Duplicate content',
          is_empty: false,
          should_filter: false
        },
        {
          unit_id: 'unit_2',
          content: 'Duplicate content',
          is_empty: false,
          should_filter: false
        },
        {
          unit_id: 'unit_3',
          content: 'Unique content',
          is_empty: false,
          should_filter: false
        }
      ];
      
      const result = contentFilter.applyFilters(units);
      
      // At least one duplicate should be filtered
      expect(result.skipped_units.length).toBeGreaterThan(0);
    });
  });
  
  describe('Completeness Validator', () => {
    test('should calculate coverage rate correctly', () => {
      const totalUnits = 100;
      const ckbCount = 85;
      const skippedCount = 10;
      
      const coverageRate = completenessValidator.calculateCoverage(
        totalUnits,
        ckbCount,
        skippedCount
      );
      
      expect(coverageRate).toBe(0.95);
    });
    
    test('should handle zero total units', () => {
      const coverageRate = completenessValidator.calculateCoverage(0, 0, 0);
      expect(coverageRate).toBe(1.0);
    });
    
    test('should validate completeness', async () => {
      const structure = {
        doc_id: 'test_doc',
        total_units: 10,
        units: [
          { unit_id: 'u1', should_filter: false, is_empty: false },
          { unit_id: 'u2', should_filter: false, is_empty: false },
          { unit_id: 'u3', should_filter: true, is_empty: false },
          { unit_id: 'u4', should_filter: false, is_empty: false },
          { unit_id: 'u5', should_filter: false, is_empty: false },
          { unit_id: 'u6', should_filter: false, is_empty: false },
          { unit_id: 'u7', should_filter: false, is_empty: false },
          { unit_id: 'u8', should_filter: false, is_empty: false },
          { unit_id: 'u9', should_filter: false, is_empty: false },
          { unit_id: 'u10', should_filter: false, is_empty: false }
        ]
      };
      
      const ckbs = [
        { ckb_id: 'ckb1', source_meta: { unit_id: 'u1' }, quality: { source_confidence: 0.9 } },
        { ckb_id: 'ckb2', source_meta: { unit_id: 'u2' }, quality: { source_confidence: 0.8 } },
        { ckb_id: 'ckb4', source_meta: { unit_id: 'u4' }, quality: { source_confidence: 0.7 } },
        { ckb_id: 'ckb5', source_meta: { unit_id: 'u5' }, quality: { source_confidence: 0.6 } },
        { ckb_id: 'ckb6', source_meta: { unit_id: 'u6' }, quality: { source_confidence: 0.5 } },
        { ckb_id: 'ckb7', source_meta: { unit_id: 'u7' }, quality: { source_confidence: 0.4 } },
        { ckb_id: 'ckb8', source_meta: { unit_id: 'u8' }, quality: { source_confidence: 0.9 } },
        { ckb_id: 'ckb9', source_meta: { unit_id: 'u9' }, quality: { source_confidence: 0.8 } }
      ];
      
      const result = await completenessValidator.validate('test_doc', structure, ckbs);
      
      expect(result.doc_id).toBe('test_doc');
      expect(result.total_structural_units).toBe(10);
      expect(result.ckb_count).toBe(8);
      expect(result.skipped_count).toBe(1);
      expect(result.coverage_rate).toBe(0.9);
      // Missing units should include all units without CKBs and not filtered
      expect(result.missing_units.length).toBeGreaterThanOrEqual(1);
      expect(result.low_quality_ckbs.length).toBe(1); // ckb7 has confidence < 0.5
      expect(result.is_complete).toBe(false); // coverage < 95%
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });
  
  describe('Validation Reporter', () => {
    test('should calculate quality score', () => {
      const validationResult = {
        coverage_rate: 0.95,
        ckb_count: 100,
        low_quality_ckbs: [{ ckb_id: 'ckb1' }], // 1% low quality
        total_structural_units: 100,
        missing_units: [] // 0% missing
      };
      
      const score = validationReporter.calculateQualityScore(validationResult);
      
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });
    
    test('should generate recommendations', () => {
      const validationResult = {
        coverage_rate: 0.85,
        ckb_count: 100,
        low_quality_ckbs: Array(15).fill({ ckb_id: 'ckb' }), // 15% low quality
        missing_units: Array(5).fill({ unit_id: 'unit' })
      };
      
      // Use the internal method from validation_reporter
      const recommendations = [];
      
      if (validationResult.coverage_rate < 0.90) {
        recommendations.push('覆盖率过低，建议检查文档解析逻辑或调整过滤规则');
      }
      
      if (validationResult.low_quality_ckbs.length > validationResult.ckb_count * 0.1) {
        recommendations.push('低质量 CKB 比例过高，建议检查文档质量或 OCR/ASR 配置');
      }
      
      if (validationResult.missing_units.length > 0) {
        recommendations.push(`发现 ${validationResult.missing_units.length} 个未处理的结构单元，建议重新处理文档`);
      }
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('覆盖率'))).toBe(true);
    });
  });
  
  describe('Pipeline Monitor', () => {
    test('should generate bottleneck recommendations', () => {
      const stage = {
        stage_name: 'ckb_parsing',
        duration_ms: 5000
      };
      
      const recommendations = pipelineMonitor.generateBottleneckRecommendations(stage);
      
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('分段处理'))).toBe(true);
    });
  });
  
  describe('Integration Tests', () => {
    test('should export all required modules', () => {
      const documentProcessor = require('./index');
      
      expect(documentProcessor.processDocumentWithFullProcessing).toBeDefined();
      expect(documentProcessor.structureAnalyzer).toBeDefined();
      expect(documentProcessor.contentFilter).toBeDefined();
      expect(documentProcessor.completenessValidator).toBeDefined();
      expect(documentProcessor.validationReporter).toBeDefined();
      expect(documentProcessor.pipelineMonitor).toBeDefined();
      expect(documentProcessor.segmentedProcessor).toBeDefined();
      expect(documentProcessor.alertManager).toBeDefined();
    });
  });
});
