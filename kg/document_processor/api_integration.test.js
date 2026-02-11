/**
 * Document Processing API Integration Tests
 * 
 * Tests all API endpoints for document processing monitoring and validation
 */

const request = require('supertest');
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const documentProcessingRoutes = require('../../routes/documentProcessingRoutes');

const prisma = new PrismaClient();

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api', documentProcessingRoutes);

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    processingMonitor: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn()
    },
    validationReport: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn()
    },
    document: {
      findUnique: jest.fn()
    }
  };
  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

// Mock document processor modules
jest.mock('../../kg/document_processor/pipeline_monitor', () => ({
  getProgress: jest.fn()
}));

jest.mock('../../kg/document_processor/validation_reporter', () => ({
  getReport: jest.fn()
}));

jest.mock('../../kg/document_processor/segmented_processor', () => ({
  recoverFromFailure: jest.fn()
}));

jest.mock('../../kg/document_processor', () => ({
  processDocumentWithFullProcessing: jest.fn()
}));

const pipelineMonitor = require('../../kg/document_processor/pipeline_monitor');
const validationReporter = require('../../kg/document_processor/validation_reporter');
const segmentedProcessor = require('../../kg/document_processor/segmented_processor');
const { processDocumentWithFullProcessing } = require('../../kg/document_processor');

describe('Document Processing API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/documents/:id/processing-status', () => {
    it('should return processing status for a document', async () => {
      const mockMonitor = {
        monitorId: 'mon_123',
        docId: 'doc_123',
        startTime: new Date(),
        endTime: null,
        stages: [],
        createdAt: new Date()
      };

      const mockProgress = {
        status: 'processing',
        current_stage: 'ckb_parsing',
        progress_percentage: 50,
        estimated_remaining_time_ms: 30000,
        completed_stages: ['structure_analysis', 'content_filtering'],
        total_stages: 4
      };

      prisma.processingMonitor.findFirst.mockResolvedValue(mockMonitor);
      pipelineMonitor.getProgress.mockResolvedValue(mockProgress);

      const response = await request(app)
        .get('/api/documents/doc_123/processing-status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.doc_id).toBe('doc_123');
      expect(response.body.data.monitor_id).toBe('mon_123');
      expect(response.body.data.status).toBe('processing');
      expect(response.body.data.progress_percentage).toBe(50);
    });

    it('should return 404 when no processing record found', async () => {
      prisma.processingMonitor.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/documents/doc_999/processing-status')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No processing record found');
    });

    it('should handle errors gracefully', async () => {
      prisma.processingMonitor.findFirst.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/documents/doc_123/processing-status')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Database error');
    });
  });

  describe('GET /api/documents/:id/validation-report', () => {
    it('should return validation report for a document', async () => {
      const mockReportRecord = {
        reportId: 'report_123',
        docId: 'doc_123',
        summary: {
          total_structural_units: 100,
          ckb_count: 95,
          skipped_count: 5,
          coverage_rate: 1.0,
          is_complete: true,
          quality_score: 95
        },
        createdAt: new Date()
      };

      const mockReport = {
        report_id: 'report_123',
        doc_id: 'doc_123',
        summary: mockReportRecord.summary,
        structure_tree: {},
        skipped_content: [],
        low_quality_ckbs: [],
        missing_units: [],
        recommendations: []
      };

      prisma.validationReport.findFirst.mockResolvedValue(mockReportRecord);
      validationReporter.getReport.mockResolvedValue(mockReport);

      const response = await request(app)
        .get('/api/documents/doc_123/validation-report')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.report_id).toBe('report_123');
      expect(response.body.data.summary.coverage_rate).toBe(1.0);
    });

    it('should return 404 when no validation report found', async () => {
      prisma.validationReport.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/documents/doc_999/validation-report')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No validation report found');
    });

    it('should handle errors gracefully', async () => {
      prisma.validationReport.findFirst.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/documents/doc_123/validation-report')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/documents/:id/coverage', () => {
    it('should return coverage statistics for a document', async () => {
      const mockReportRecord = {
        reportId: 'report_123',
        docId: 'doc_123',
        summary: {
          total_structural_units: 100,
          ckb_count: 90,
          skipped_count: 8,
          coverage_rate: 0.98,
          is_complete: true,
          quality_score: 92
        },
        missingUnits: [{ unit_id: 'unit_1' }, { unit_id: 'unit_2' }],
        createdAt: new Date()
      };

      prisma.validationReport.findFirst.mockResolvedValue(mockReportRecord);

      const response = await request(app)
        .get('/api/documents/doc_123/coverage')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.doc_id).toBe('doc_123');
      expect(response.body.data.coverage_rate).toBe(0.98);
      expect(response.body.data.total_structural_units).toBe(100);
      expect(response.body.data.ckb_count).toBe(90);
      expect(response.body.data.skipped_count).toBe(8);
      expect(response.body.data.missing_count).toBe(2);
      expect(response.body.data.is_complete).toBe(true);
      expect(response.body.data.quality_score).toBe(92);
    });

    it('should return 404 when no coverage data found', async () => {
      prisma.validationReport.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/documents/doc_999/coverage')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No coverage data found');
    });

    it('should handle missing units array gracefully', async () => {
      const mockReportRecord = {
        reportId: 'report_123',
        docId: 'doc_123',
        summary: {
          total_structural_units: 100,
          ckb_count: 100,
          skipped_count: 0,
          coverage_rate: 1.0,
          is_complete: true,
          quality_score: 100
        },
        missingUnits: null,
        createdAt: new Date()
      };

      prisma.validationReport.findFirst.mockResolvedValue(mockReportRecord);

      const response = await request(app)
        .get('/api/documents/doc_123/coverage')
        .expect(200);

      expect(response.body.data.missing_count).toBe(0);
    });
  });

  describe('POST /api/documents/:id/reprocess', () => {
    it('should reprocess a document successfully', async () => {
      const mockDoc = {
        id: 'doc_123',
        filePath: '/path/to/doc.pdf',
        fileType: 'pdf'
      };

      const mockResult = {
        doc_id: 'doc_123',
        monitor_id: 'mon_456',
        validation_result: {
          coverage_rate: 0.98
        }
      };

      prisma.document.findUnique.mockResolvedValue(mockDoc);
      prisma.processingMonitor.findFirst.mockResolvedValue(null);
      processDocumentWithFullProcessing.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/documents/doc_123/reprocess')
        .send({ force: false })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.doc_id).toBe('doc_123');
      expect(response.body.data.monitor_id).toBe('mon_456');
      expect(response.body.data.coverage_rate).toBe(0.98);
    });

    it('should return 404 when document not found', async () => {
      prisma.document.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/documents/doc_999/reprocess')
        .send({})
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Document not found');
    });

    it('should return 409 when document is being processed without force', async () => {
      const mockDoc = {
        id: 'doc_123',
        filePath: '/path/to/doc.pdf',
        fileType: 'pdf'
      };

      const mockActiveMonitor = {
        monitorId: 'mon_123',
        docId: 'doc_123',
        endTime: null
      };

      prisma.document.findUnique.mockResolvedValue(mockDoc);
      prisma.processingMonitor.findFirst.mockResolvedValue(mockActiveMonitor);

      const response = await request(app)
        .post('/api/documents/doc_123/reprocess')
        .send({ force: false })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('currently being processed');
    });

    it('should reprocess specific segments only', async () => {
      const mockDoc = {
        id: 'doc_123',
        filePath: '/path/to/doc.pdf',
        fileType: 'pdf'
      };

      prisma.document.findUnique.mockResolvedValue(mockDoc);
      prisma.processingMonitor.findFirst.mockResolvedValue(null);
      segmentedProcessor.recoverFromFailure.mockResolvedValue({});

      const response = await request(app)
        .post('/api/documents/doc_123/reprocess')
        .send({ segments_only: ['seg_1', 'seg_2'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.segments).toEqual(['seg_1', 'seg_2']);
      expect(segmentedProcessor.recoverFromFailure).toHaveBeenCalledTimes(2);
    });

    it('should force reprocess when document is being processed', async () => {
      const mockDoc = {
        id: 'doc_123',
        filePath: '/path/to/doc.pdf',
        fileType: 'pdf'
      };

      const mockActiveMonitor = {
        monitorId: 'mon_123',
        docId: 'doc_123',
        endTime: null
      };

      const mockResult = {
        doc_id: 'doc_123',
        monitor_id: 'mon_456',
        validation_result: {
          coverage_rate: 0.98
        }
      };

      prisma.document.findUnique.mockResolvedValue(mockDoc);
      prisma.processingMonitor.findFirst.mockResolvedValue(mockActiveMonitor);
      processDocumentWithFullProcessing.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/documents/doc_123/reprocess')
        .send({ force: true })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/batch-processing/:batchId/status', () => {
    it('should return batch processing status', async () => {
      const mockMonitors = [
        {
          monitorId: 'mon_1',
          docId: 'doc_1',
          startTime: new Date(),
          endTime: new Date(),
          stages: [{ status: 'completed' }]
        },
        {
          monitorId: 'mon_2',
          docId: 'doc_2',
          startTime: new Date(),
          endTime: new Date(),
          stages: [{ status: 'failed' }]
        },
        {
          monitorId: 'mon_3',
          docId: 'doc_3',
          startTime: new Date(),
          endTime: null,
          stages: []
        }
      ];

      const mockReports = [
        {
          docId: 'doc_1',
          summary: { coverage_rate: 0.95 }
        },
        {
          docId: 'doc_2',
          summary: { coverage_rate: 0.85 }
        }
      ];

      prisma.processingMonitor.findMany.mockResolvedValue(mockMonitors);
      prisma.validationReport.findMany.mockResolvedValue(mockReports);

      const response = await request(app)
        .get('/api/batch-processing/batch_123/status')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.batch_id).toBe('batch_123');
      expect(response.body.data.total_documents).toBe(3);
      expect(response.body.data.completed_documents).toBe(2);
      expect(response.body.data.failed_documents).toBe(1);
      expect(response.body.data.progress_percentage).toBeCloseTo(66.67, 1);
      expect(response.body.data.average_coverage_rate).toBeCloseTo(0.90, 2);
    });

    it('should return 404 when batch not found', async () => {
      prisma.processingMonitor.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/batch-processing/batch_999/status')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Batch not found');
    });

    it('should handle batch with no reports', async () => {
      const mockMonitors = [
        {
          monitorId: 'mon_1',
          docId: 'doc_1',
          startTime: new Date(),
          endTime: null,
          stages: []
        }
      ];

      prisma.processingMonitor.findMany.mockResolvedValue(mockMonitors);
      prisma.validationReport.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/batch-processing/batch_123/status')
        .expect(200);

      expect(response.body.data.average_coverage_rate).toBe(0);
    });
  });

  describe('GET /api/documents/:id/processing-history', () => {
    it('should return processing history for a document', async () => {
      const mockMonitors = [
        {
          monitorId: 'mon_1',
          docId: 'doc_123',
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:05:00Z'),
          createdAt: new Date('2024-01-01T10:00:00Z')
        },
        {
          monitorId: 'mon_2',
          docId: 'doc_123',
          startTime: new Date('2024-01-02T10:00:00Z'),
          endTime: new Date('2024-01-02T10:03:00Z'),
          createdAt: new Date('2024-01-02T10:00:00Z')
        }
      ];

      const mockReports = [
        {
          docId: 'doc_123',
          summary: { coverage_rate: 0.95 },
          createdAt: new Date('2024-01-01T10:05:00Z')
        },
        {
          docId: 'doc_123',
          summary: { coverage_rate: 0.98 },
          createdAt: new Date('2024-01-02T10:03:00Z')
        }
      ];

      prisma.processingMonitor.findMany.mockResolvedValue(mockMonitors);
      prisma.validationReport.findFirst
        .mockResolvedValueOnce(mockReports[0])
        .mockResolvedValueOnce(mockReports[1]);

      const response = await request(app)
        .get('/api/documents/doc_123/processing-history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.doc_id).toBe('doc_123');
      expect(response.body.data.history).toHaveLength(2);
      expect(response.body.data.history[0].monitor_id).toBe('mon_1');
      expect(response.body.data.history[0].coverage_rate).toBe(0.95);
      expect(response.body.data.history[0].status).toBe('completed');
    });

    it('should return empty history when no records found', async () => {
      prisma.processingMonitor.findMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/documents/doc_999/processing-history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toEqual([]);
    });

    it('should respect limit and offset parameters', async () => {
      prisma.processingMonitor.findMany.mockResolvedValue([]);

      await request(app)
        .get('/api/documents/doc_123/processing-history?limit=5&offset=10')
        .expect(200);

      expect(prisma.processingMonitor.findMany).toHaveBeenCalledWith({
        where: { docId: 'doc_123' },
        orderBy: { createdAt: 'desc' },
        take: 5,
        skip: 10
      });
    });

    it('should handle in-progress processing', async () => {
      const mockMonitors = [
        {
          monitorId: 'mon_1',
          docId: 'doc_123',
          startTime: new Date(),
          endTime: null,
          createdAt: new Date()
        }
      ];

      prisma.processingMonitor.findMany.mockResolvedValue(mockMonitors);
      prisma.validationReport.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/documents/doc_123/processing-history')
        .expect(200);

      expect(response.body.data.history[0].status).toBe('in_progress');
      expect(response.body.data.history[0].duration_ms).toBeNull();
    });
  });

  describe('GET /api/documents/:id/quality-assessment', () => {
    it('should return quality assessment for a document', async () => {
      const mockReportRecord = {
        reportId: 'report_123',
        docId: 'doc_123',
        summary: {
          total_structural_units: 100,
          ckb_count: 90,
          skipped_count: 8,
          coverage_rate: 0.98,
          is_complete: true,
          quality_score: 92
        },
        lowQualityCkbs: [
          { ckb_id: 'ckb_1' },
          { ckb_id: 'ckb_2' }
        ],
        missingUnits: [
          { unit_id: 'unit_1' },
          { unit_id: 'unit_2' }
        ],
        recommendations: [
          '建议检查低质量 CKB',
          '建议重新处理遗漏的结构单元'
        ],
        createdAt: new Date()
      };

      prisma.validationReport.findFirst.mockResolvedValue(mockReportRecord);

      const response = await request(app)
        .get('/api/documents/doc_123/quality-assessment')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.doc_id).toBe('doc_123');
      expect(response.body.data.quality_score).toBe(92);
      expect(response.body.data.coverage_rate).toBe(0.98);
      expect(response.body.data.low_quality_ckb_rate).toBeCloseTo(0.0222, 3);
      expect(response.body.data.missing_unit_rate).toBe(0.02);
      expect(response.body.data.recommendations).toHaveLength(2);
    });

    it('should return 404 when no quality assessment found', async () => {
      prisma.validationReport.findFirst.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/documents/doc_999/quality-assessment')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No quality assessment found');
    });

    it('should handle missing arrays gracefully', async () => {
      const mockReportRecord = {
        reportId: 'report_123',
        docId: 'doc_123',
        summary: {
          total_structural_units: 100,
          ckb_count: 100,
          skipped_count: 0,
          coverage_rate: 1.0,
          is_complete: true,
          quality_score: 100
        },
        lowQualityCkbs: null,
        missingUnits: null,
        recommendations: null,
        createdAt: new Date()
      };

      prisma.validationReport.findFirst.mockResolvedValue(mockReportRecord);

      const response = await request(app)
        .get('/api/documents/doc_123/quality-assessment')
        .expect(200);

      expect(response.body.data.low_quality_ckb_rate).toBe(0);
      expect(response.body.data.missing_unit_rate).toBe(0);
      expect(response.body.data.recommendations).toEqual([]);
    });

    it('should handle zero CKB count', async () => {
      const mockReportRecord = {
        reportId: 'report_123',
        docId: 'doc_123',
        summary: {
          total_structural_units: 100,
          ckb_count: 0,
          skipped_count: 100,
          coverage_rate: 1.0,
          is_complete: true,
          quality_score: 50
        },
        lowQualityCkbs: [],
        missingUnits: [],
        recommendations: [],
        createdAt: new Date()
      };

      prisma.validationReport.findFirst.mockResolvedValue(mockReportRecord);

      const response = await request(app)
        .get('/api/documents/doc_123/quality-assessment')
        .expect(200);

      expect(response.body.data.low_quality_ckb_rate).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      prisma.processingMonitor.findFirst.mockRejectedValue(
        new Error('Connection timeout')
      );

      const response = await request(app)
        .get('/api/documents/doc_123/processing-status')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    it('should handle malformed request data', async () => {
      const mockDoc = {
        id: 'doc_123',
        filePath: '/path/to/doc.pdf',
        fileType: 'pdf'
      };

      prisma.document.findUnique.mockResolvedValue(mockDoc);
      prisma.processingMonitor.findFirst.mockResolvedValue(null);
      processDocumentWithFullProcessing.mockRejectedValue(
        new Error('Invalid file format')
      );

      const response = await request(app)
        .post('/api/documents/doc_123/reprocess')
        .send({ force: 'invalid' })
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});
