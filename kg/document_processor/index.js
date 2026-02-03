/**
 * Document Full Processing Module Entry Point
 * 
 * This module implements a document full processing system that ensures:
 * - Complete document structure analysis
 * - Content filtering with traceability
 * - Completeness validation and coverage monitoring
 * - Processing pipeline monitoring
 * - Segmented processing for large documents
 * - Quality assessment and alerting
 */

// Core modules
const structureAnalyzer = require('./structure_analyzer');
const contentFilter = require('./content_filter');
const completenessValidator = require('./completeness_validator');
const validationReporter = require('./validation_reporter');
const pipelineMonitor = require('./pipeline_monitor');
const segmentedProcessor = require('./segmented_processor');
const alertManager = require('./alert_manager');

/**
 * Process document with full processing pipeline
 * @param {string} docId - Document ID
 * @param {string} filePath - File path
 * @param {string} fileType - File type (word, pdf, excel, markdown)
 * @returns {Promise<Object>} Processing result with validation report
 */
async function processDocumentWithFullProcessing(docId, filePath, fileType) {
  const ckbParser = require('../ckb/ckb_parser');
  
  // 1. 启动监控
  const monitorId = await pipelineMonitor.startMonitoring(docId);
  
  try {
    // 2. 结构分析
    await pipelineMonitor.recordStage(monitorId, 'structure_analysis', 'started');
    const structure = await structureAnalyzer.analyzeDocument(docId, filePath, fileType);
    await pipelineMonitor.recordStage(monitorId, 'structure_analysis', 'completed', {
      total_units: structure.total_units
    });
    
    // 3. 内容过滤
    await pipelineMonitor.recordStage(monitorId, 'content_filtering', 'started');
    const filterResult = contentFilter.applyFilters(structure.units);
    await pipelineMonitor.recordStage(monitorId, 'content_filtering', 'completed', {
      filtered_units: filterResult.filtered_units.length,
      skipped_units: filterResult.skipped_units.length
    });
    
    // 4. 判断是否需要分段处理
    const docSize = await getDocumentSize(filePath);
    const useSegmentation = segmentedProcessor.shouldUseSegmentation(docSize, structure.total_units);
    
    let ckbs = [];
    let validationResult = null;
    
    if (useSegmentation) {
      // 分段处理
      await pipelineMonitor.recordStage(monitorId, 'segmented_processing', 'started');
      const result = await segmentedProcessor.processDocumentWithSegmentation(docId, structure);
      ckbs = result.ckbs;
      validationResult = result.merged_validation;
      await pipelineMonitor.recordStage(monitorId, 'segmented_processing', 'completed', {
        segment_count: result.segment_count,
        total_ckbs: result.total_ckbs
      });
    } else {
      // 5. CKB 解析（现有系统）
      await pipelineMonitor.recordStage(monitorId, 'ckb_parsing', 'started');
      ckbs = await ckbParser.parseDocument(docId, filePath, fileType);
      await pipelineMonitor.recordStage(monitorId, 'ckb_parsing', 'completed', {
        ckb_count: ckbs.length
      });
      
      // 6. 完整性验证
      await pipelineMonitor.recordStage(monitorId, 'completeness_validation', 'started');
      validationResult = await completenessValidator.validate(docId, structure, ckbs);
      await pipelineMonitor.recordStage(monitorId, 'completeness_validation', 'completed', {
        coverage_rate: validationResult.coverage_rate,
        is_complete: validationResult.is_complete
      });
    }
    
    // 7. 生成验证报告
    await pipelineMonitor.recordStage(monitorId, 'report_generation', 'started');
    const report = await validationReporter.generateReport(validationResult, structure);
    await pipelineMonitor.recordStage(monitorId, 'report_generation', 'completed', {
      report_id: report.report_id
    });
    
    // 8. 检查告警条件
    await alertManager.checkCoverageThreshold(validationResult.coverage_rate, docId);
    await alertManager.checkQualityThreshold(report.summary.quality_score, docId);
    
    // 9. 结束监控
    await pipelineMonitor.endMonitoring(monitorId);
    
    return {
      doc_id: docId,
      monitor_id: monitorId,
      ckbs,
      validation_result: validationResult,
      report
    };
  } catch (error) {
    await pipelineMonitor.recordStage(monitorId, 'error', 'failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Get document file size in bytes
 * @param {string} filePath - File path
 * @returns {Promise<number>} File size in bytes
 */
async function getDocumentSize(filePath) {
  const fs = require('fs').promises;
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    console.error(`Error getting file size for ${filePath}:`, error);
    return 0;
  }
}

module.exports = {
  // Main processing function
  processDocumentWithFullProcessing,
  
  // Core modules
  structureAnalyzer,
  contentFilter,
  completenessValidator,
  validationReporter,
  pipelineMonitor,
  segmentedProcessor,
  alertManager
};
