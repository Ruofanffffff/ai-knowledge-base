/**
 * Document Processing API Routes
 * 
 * Provides REST API endpoints for document processing monitoring and validation
 */

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import document processor modules
const validationReporter = require('../kg/document_processor/validation_reporter');
const pipelineMonitor = require('../kg/document_processor/pipeline_monitor');
const alertManager = require('../kg/document_processor/alert_manager');

/**
 * GET /api/documents/:id/processing-status
 * 查询文档处理状态
 */
router.get('/documents/:id/processing-status', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查找最新的监控记录
    const monitor = await prisma.processingMonitor.findFirst({
      where: { docId: id },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!monitor) {
      return res.status(404).json({
        success: false,
        error: 'No processing record found for this document'
      });
    }
    
    // 获取进度信息
    const progress = await pipelineMonitor.getProgress(monitor.monitorId);
    
    res.json({
      success: true,
      data: {
        doc_id: id,
        monitor_id: monitor.monitorId,
        status: progress.status,
        current_stage: progress.current_stage,
        progress_percentage: progress.progress_percentage,
        estimated_remaining_time_ms: progress.estimated_remaining_time_ms,
        completed_stages: progress.completed_stages,
        total_stages: progress.total_stages
      }
    });
  } catch (error) {
    console.error('Error fetching processing status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:id/validation-report
 * 查询验证报告
 */
router.get('/documents/:id/validation-report', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查找最新的验证报告
    const reportRecord = await prisma.validationReport.findFirst({
      where: { docId: id },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!reportRecord) {
      return res.status(404).json({
        success: false,
        error: 'No validation report found for this document'
      });
    }
    
    // 获取完整报告
    const report = await validationReporter.getReport(reportRecord.reportId);
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching validation report:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:id/coverage
 * 查询覆盖率统计
 */
router.get('/documents/:id/coverage', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查找最新的验证报告
    const reportRecord = await prisma.validationReport.findFirst({
      where: { docId: id },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!reportRecord) {
      return res.status(404).json({
        success: false,
        error: 'No coverage data found for this document'
      });
    }
    
    const summary = reportRecord.summary;
    const missingUnits = reportRecord.missingUnits || [];
    
    res.json({
      success: true,
      data: {
        doc_id: id,
        coverage_rate: summary.coverage_rate,
        total_structural_units: summary.total_structural_units,
        ckb_count: summary.ckb_count,
        skipped_count: summary.skipped_count,
        missing_count: missingUnits.length,
        is_complete: summary.is_complete,
        quality_score: summary.quality_score
      }
    });
  } catch (error) {
    console.error('Error fetching coverage data:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/documents/:id/reprocess
 * 重新处理文档
 */
router.post('/documents/:id/reprocess', async (req, res) => {
  try {
    const { id } = req.params;
    const { force = false, segments_only = [] } = req.body;
    
    // 检查文档是否存在
    const doc = await prisma.document.findUnique({
      where: { id }
    });
    
    if (!doc) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }
    
    // 检查是否正在处理中
    const activeMonitor = await prisma.processingMonitor.findFirst({
      where: {
        docId: id,
        endTime: null
      }
    });
    
    if (activeMonitor && !force) {
      return res.status(409).json({
        success: false,
        error: 'Document is currently being processed. Use force=true to override.'
      });
    }
    
    // 如果指定了特定分段，仅重新处理这些分段
    if (segments_only.length > 0) {
      const segmentedProcessor = require('../kg/document_processor/segmented_processor');
      
      for (const segmentId of segments_only) {
        await segmentedProcessor.recoverFromFailure(segmentId);
      }
      
      return res.json({
        success: true,
        data: {
          doc_id: id,
          message: `Reprocessing ${segments_only.length} segments`,
          segments: segments_only
        }
      });
    }
    
    // 重新处理整个文档
    const { processDocumentWithFullProcessing } = require('../kg/document_processor');
    const result = await processDocumentWithFullProcessing(id, doc.filePath, doc.fileType);
    
    res.json({
      success: true,
      data: {
        doc_id: id,
        monitor_id: result.monitor_id,
        message: 'Document reprocessing completed',
        coverage_rate: result.validation_result.coverage_rate
      }
    });
  } catch (error) {
    console.error('Error reprocessing document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/batch-processing/:batchId/status
 * 查询批量处理状态
 */
router.get('/batch-processing/:batchId/status', async (req, res) => {
  try {
    const { batchId } = req.params;
    
    // 查找批次中的所有文档
    const monitors = await prisma.processingMonitor.findMany({
      where: {
        metadata: {
          path: ['batch_id'],
          equals: batchId
        }
      }
    });
    
    if (monitors.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Batch not found'
      });
    }
    
    // 统计批次状态
    const totalDocuments = monitors.length;
    const completedDocuments = monitors.filter(m => m.endTime !== null).length;
    const failedDocuments = monitors.filter(m => {
      const stages = m.stages || [];
      return stages.some(s => s.status === 'failed');
    }).length;
    
    // 计算平均覆盖率
    const reports = await prisma.validationReport.findMany({
      where: {
        docId: {
          in: monitors.map(m => m.docId)
        }
      }
    });
    
    const avgCoverageRate = reports.length > 0
      ? reports.reduce((sum, r) => sum + r.summary.coverage_rate, 0) / reports.length
      : 0;
    
    res.json({
      success: true,
      data: {
        batch_id: batchId,
        total_documents: totalDocuments,
        completed_documents: completedDocuments,
        failed_documents: failedDocuments,
        progress_percentage: (completedDocuments / totalDocuments) * 100,
        average_coverage_rate: avgCoverageRate
      }
    });
  } catch (error) {
    console.error('Error fetching batch status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:id/processing-history
 * 查询处理历史
 */
router.get('/documents/:id/processing-history', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10, offset = 0 } = req.query;
    
    // 查找所有处理记录
    const monitors = await prisma.processingMonitor.findMany({
      where: { docId: id },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit),
      skip: parseInt(offset)
    });
    
    if (monitors.length === 0) {
      return res.json({
        success: true,
        data: {
          doc_id: id,
          history: []
        }
      });
    }
    
    // 获取对应的验证报告
    const history = await Promise.all(
      monitors.map(async (monitor) => {
        const report = await prisma.validationReport.findFirst({
          where: { docId: id, createdAt: { gte: monitor.startTime } },
          orderBy: { createdAt: 'asc' }
        });
        
        const durationMs = monitor.endTime
          ? new Date(monitor.endTime) - new Date(monitor.startTime)
          : null;
        
        return {
          monitor_id: monitor.monitorId,
          start_time: monitor.startTime,
          end_time: monitor.endTime,
          duration_ms: durationMs,
          coverage_rate: report ? report.summary.coverage_rate : null,
          status: monitor.endTime ? 'completed' : 'in_progress'
        };
      })
    );
    
    res.json({
      success: true,
      data: {
        doc_id: id,
        history
      }
    });
  } catch (error) {
    console.error('Error fetching processing history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:id/quality-assessment
 * 查询质量评估
 */
router.get('/documents/:id/quality-assessment', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查找最新的验证报告
    const reportRecord = await prisma.validationReport.findFirst({
      where: { docId: id },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!reportRecord) {
      return res.status(404).json({
        success: false,
        error: 'No quality assessment found for this document'
      });
    }
    
    const summary = reportRecord.summary;
    const lowQualityCkbs = reportRecord.lowQualityCkbs || [];
    const missingUnits = reportRecord.missingUnits || [];
    
    // 计算质量指标
    const lowQualityCkbRate = summary.ckb_count > 0
      ? lowQualityCkbs.length / summary.ckb_count
      : 0;
    
    const missingUnitRate = summary.total_structural_units > 0
      ? missingUnits.length / summary.total_structural_units
      : 0;
    
    res.json({
      success: true,
      data: {
        doc_id: id,
        quality_score: summary.quality_score,
        coverage_rate: summary.coverage_rate,
        low_quality_ckb_rate: lowQualityCkbRate,
        missing_unit_rate: missingUnitRate,
        recommendations: reportRecord.recommendations || []
      }
    });
  } catch (error) {
    console.error('Error fetching quality assessment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
