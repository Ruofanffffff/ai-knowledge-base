/**
 * Document Processor Index Integration Tests
 * 
 * Tests for the main document processing pipeline
 */

// Mock all dependencies BEFORE requiring the module
jest.mock('./structure_analyzer', () => ({
  analyzeDocument: jest.fn()
}));

jest.mock('./content_filter', () => ({
  applyFilters: jest.fn()
}));

jest.mock('./completeness_validator', () => ({
  validate: jest.fn()
}));

jest.mock('./validation_reporter', () => ({
  generateReport: jest.fn()
}));

jest.mock('./pipeline_monitor', () => ({
  startMonitoring: jest.fn(),
  recordStage: jest.fn(),
  endMonitoring: jest.fn()
}));

jest.mock('./segmented_processor', () => ({
  shouldUseSegmentation: jest.fn(),
  processDocumentWithSegmentation: jest.fn()
}));

jest.mock('./alert_manager', () => ({
  checkCoverageThreshold: jest.fn(),
  checkQualityThreshold: jest.fn()
}));

jest.mock('../ckb/ckb_parser', () => ({
  parseDocument: jest.fn()
}));

jest.mock('fs', () => ({
  promises: {
    stat: jest.fn()
  }
}));

const documentProcessor = require('./index');
const structureAnalyzer = require('./structure_analyzer');
const contentFilter = require('./content_filter');
const completenessValidator = require('./completeness_validator');
const validationReporter = require('./validation_reporter');
const pipelineMonitor = require('./pipeline_monitor');
const segmentedProcessor = require('./segmented_processor');
const alertManager = require('./alert_manager');
const ckbParser = require('../ckb/ckb_parser');
const fs = require('fs').promises;

describe('Document Processor Index', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Module Exports', () => {
    test('should export processDocumentWithFullProcessing function', () => {
      expect(documentProcessor.processDocumentWithFullProcessing).toBeDefined();
      expect(typeof documentProcessor.processDocumentWithFullProcessing).toBe('function');
    });

    test('should export all core modules', () => {
      expect(documentProcessor.structureAnalyzer).toBeDefined();
      expect(documentProcessor.contentFilter).toBeDefined();
      expect(documentProcessor.completenessValidator).toBeDefined();
      expect(documentProcessor.validationReporter).toBeDefined();
      expect(documentProcessor.pipelineMonitor).toBeDefined();
      expect(documentProcessor.segmentedProcessor).toBeDefined();
      expect(documentProcessor.alertManager).toBeDefined();
    });
  });

  describe('processDocumentWithFullProcessing', () => {
    test('should process document through full pipeline', async () => {
      // Setup mocks
      const mockStructure = {
        doc_id: 'test_doc',
        file_type: 'markdown',
        total_units: 10,
        units: [{ unit_id: 'u1', content: 'Test', is_empty: false, should_filter: false }],
        hierarchy: { root: { unit_id: 'root', type: 'document', children: [], processed: false } }
      };
      structureAnalyzer.analyzeDocument.mockResolvedValue(mockStructure);

      const mockFilterResult = {
        filtered_units: mockStructure.units,
        skipped_units: [],
        stats: { total_units: 10, filtered_units: 10, skipped_by_rule: {} }
      };
      contentFilter.applyFilters.mockReturnValue(mockFilterResult);

      const mockCKBs = [{ ckb_id: 'ckb1', content: { text: 'Test' }, quality: { source_confidence: 0.9 } }];
      ckbParser.parseDocument.mockResolvedValue(mockCKBs);

      const mockValidation = {
        doc_id: 'test_doc',
        total_structural_units: 10,
        ckb_count: 1,
        skipped_count: 0,
        coverage_rate: 0.1,
        missing_units: [],
        low_quality_ckbs: [],
        is_complete: false,
        warnings: ['覆盖率 10.0% 低于 95%']
      };
      completenessValidator.validate.mockResolvedValue(mockValidation);

      const mockReport = {
        report_id: 'report_1',
        doc_id: 'test_doc',
        summary: { coverage_rate: 0.1, quality_score: 50 }
      };
      validationReporter.generateReport.mockResolvedValue(mockReport);

      pipelineMonitor.startMonitoring.mockResolvedValue('monitor_1');
      pipelineMonitor.recordStage.mockResolvedValue(undefined);
      pipelineMonitor.endMonitoring.mockResolvedValue(undefined);
      segmentedProcessor.shouldUseSegmentation.mockReturnValue(false);
      alertManager.checkCoverageThreshold.mockResolvedValue(undefined);
      alertManager.checkQualityThreshold.mockResolvedValue(undefined);
      fs.stat.mockResolvedValue({ size: 1024 });

      // Execute
      const result = await documentProcessor.processDocumentWithFullProcessing('test_doc', '/path/to/file.md', 'markdown');

      // Verify
      expect(result.doc_id).toBe('test_doc');
      expect(result.monitor_id).toBe('monitor_1');
      expect(result.ckbs).toEqual(mockCKBs);
      expect(result.validation_result).toEqual(mockValidation);
      expect(result.report).toEqual(mockReport);
      expect(pipelineMonitor.startMonitoring).toHaveBeenCalledWith('test_doc');
    });

    test('should use segmented processing for large documents', async () => {
      const mockStructure = {
        doc_id: 'large_doc',
        file_type: 'pdf',
        total_units: 6000,
        units: [],
        hierarchy: { root: { unit_id: 'root', type: 'document', children: [], processed: false } }
      };
      structureAnalyzer.analyzeDocument.mockResolvedValue(mockStructure);

      contentFilter.applyFilters.mockReturnValue({
        filtered_units: [],
        skipped_units: [],
        stats: { total_units: 6000, filtered_units: 6000, skipped_by_rule: {} }
      });

      segmentedProcessor.shouldUseSegmentation.mockReturnValue(true);
      segmentedProcessor.processDocumentWithSegmentation.mockResolvedValue({
        doc_id: 'large_doc',
        total_ckbs: 5500,
        ckbs: [],
        merged_validation: { doc_id: 'large_doc', coverage_rate: 0.95, is_complete: true },
        segment_count: 6
      });

      validationReporter.generateReport.mockResolvedValue({
        report_id: 'report_2',
        doc_id: 'large_doc',
        summary: { quality_score: 90 }
      });

      pipelineMonitor.startMonitoring.mockResolvedValue('monitor_2');
      pipelineMonitor.recordStage.mockResolvedValue(undefined);
      pipelineMonitor.endMonitoring.mockResolvedValue(undefined);
      alertManager.checkCoverageThreshold.mockResolvedValue(undefined);
      alertManager.checkQualityThreshold.mockResolvedValue(undefined);
      fs.stat.mockResolvedValue({ size: 11 * 1024 * 1024 });

      const result = await documentProcessor.processDocumentWithFullProcessing('large_doc', '/path/to/large.pdf', 'pdf');

      expect(segmentedProcessor.shouldUseSegmentation).toHaveBeenCalled();
      expect(segmentedProcessor.processDocumentWithSegmentation).toHaveBeenCalled();
      expect(result.validation_result.coverage_rate).toBe(0.95);
    });

    test('should handle processing errors', async () => {
      structureAnalyzer.analyzeDocument.mockRejectedValue(new Error('Structure analysis failed'));
      pipelineMonitor.startMonitoring.mockResolvedValue('monitor_3');
      pipelineMonitor.recordStage.mockResolvedValue(undefined);
      fs.stat.mockResolvedValue({ size: 1024 });

      await expect(
        documentProcessor.processDocumentWithFullProcessing('error_doc', '/path/to/file.md', 'markdown')
      ).rejects.toThrow('Structure analysis failed');

      expect(pipelineMonitor.recordStage).toHaveBeenCalledWith(
        'monitor_3',
        'error',
        'failed',
        expect.objectContaining({ error: 'Structure analysis failed' })
      );
    });

    test('should trigger alerts for low coverage', async () => {
      const mockStructure = {
        doc_id: 'low_coverage_doc',
        file_type: 'word',
        total_units: 100,
        units: [],
        hierarchy: { root: { unit_id: 'root', type: 'document', children: [], processed: false } }
      };
      structureAnalyzer.analyzeDocument.mockResolvedValue(mockStructure);

      contentFilter.applyFilters.mockReturnValue({
        filtered_units: [],
        skipped_units: [],
        stats: { total_units: 100, filtered_units: 100, skipped_by_rule: {} }
      });

      ckbParser.parseDocument.mockResolvedValue([]);

      completenessValidator.validate.mockResolvedValue({
        doc_id: 'low_coverage_doc',
        coverage_rate: 0.85,
        is_complete: false,
        warnings: ['覆盖率 85.0% 低于 95%']
      });

      validationReporter.generateReport.mockResolvedValue({
        report_id: 'report_3',
        doc_id: 'low_coverage_doc',
        summary: { quality_score: 70 }
      });

      pipelineMonitor.startMonitoring.mockResolvedValue('monitor_4');
      pipelineMonitor.recordStage.mockResolvedValue(undefined);
      pipelineMonitor.endMonitoring.mockResolvedValue(undefined);
      segmentedProcessor.shouldUseSegmentation.mockReturnValue(false);
      alertManager.checkCoverageThreshold.mockResolvedValue(undefined);
      alertManager.checkQualityThreshold.mockResolvedValue(undefined);
      fs.stat.mockResolvedValue({ size: 1024 });

      await documentProcessor.processDocumentWithFullProcessing('low_coverage_doc', '/path/to/file.docx', 'word');

      expect(alertManager.checkCoverageThreshold).toHaveBeenCalledWith(0.85, 'low_coverage_doc');
      expect(alertManager.checkQualityThreshold).toHaveBeenCalledWith(70, 'low_coverage_doc');
    });
  });
});
