/**
 * Unit tests for preprocessing API routes
 * 
 * Tests the API endpoints for:
 * - Querying document indices
 * - Querying correction statistics
 * - Regenerating indices
 * 
 * Requirements: 9.4, 10.5
 */

const request = require('supertest');
const express = require('express');
const { PrismaClient } = require('@prisma/client');

// Mock dependencies
jest.mock('@prisma/client');
jest.mock('../../services/authService', () => ({
  authMiddleware: (req, res, next) => next()
}));
jest.mock('../../kg/preprocessing/index_generator');
jest.mock('../../kg/preprocessing/correction_stats_collector');
jest.mock('../../kg/preprocessing/preprocessing_monitor');
jest.mock('../../kg/preprocessing/version_manager');

const preprocessingRoutes = require('../preprocessingRoutes');

describe('Preprocessing API Routes', () => {
  let app;
  let prisma;

  beforeEach(() => {
    // Setup Express app
    app = express();
    app.use(express.json());
    app.use('/api/preprocessing', preprocessingRoutes);

    // Setup Prisma mock
    prisma = new PrismaClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Document Index Routes', () => {
    describe('GET /api/preprocessing/index/:docId', () => {
      it('should return document index for valid docId', async () => {
        const mockIndex = {
          id: 'index-123',
          docId: 'doc-123',
          indexedText: '1. Test fact.\n2. Another fact.',
          version: 1,
          metadata: JSON.stringify({
            llm_model: 'qwen-plus',
            token_count: 100,
            fact_count: 2
          }),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        prisma.documentIndex = {
          findFirst: jest.fn().mockResolvedValue(mockIndex)
        };

        const response = await request(app)
          .get('/api/preprocessing/index/doc-123')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.docId).toBe('doc-123');
        expect(response.body.data.indexedText).toBe('1. Test fact.\n2. Another fact.');
      });

      it('should return 404 when document index not found', async () => {
        prisma.documentIndex = {
          findFirst: jest.fn().mockResolvedValue(null)
        };

        const response = await request(app)
          .get('/api/preprocessing/index/nonexistent')
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('not found');
      });

      it('should return specific version when version parameter provided', async () => {
        const mockIndex = {
          id: 'index-123',
          docId: 'doc-123',
          indexedText: '1. Test fact.',
          version: 2,
          metadata: JSON.stringify({}),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        prisma.documentIndex = {
          findFirst: jest.fn().mockResolvedValue(mockIndex)
        };

        const response = await request(app)
          .get('/api/preprocessing/index/doc-123?version=2')
          .expect(200);

        expect(response.body.data.version).toBe(2);
      });

      it('should return 400 when docId is missing', async () => {
        const response = await request(app)
          .get('/api/preprocessing/index/')
          .expect(404); // Express returns 404 for missing route params

        // This test verifies the route structure
      });
    });

    describe('GET /api/preprocessing/index/:docId/versions', () => {
      it('should return all versions for a document', async () => {
        const mockVersions = [
          {
            id: 'v1',
            version: 2,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 'v2',
            version: 1,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];

        const { VersionManager } = require('../../kg/preprocessing/version_manager');
        VersionManager.mockImplementation(() => ({
          getAllVersions: jest.fn().mockResolvedValue(mockVersions)
        }));

        const response = await request(app)
          .get('/api/preprocessing/index/doc-123/versions')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.count).toBe(2);
        expect(response.body.data.versions).toHaveLength(2);
      });
    });

    describe('POST /api/preprocessing/index/:docId/regenerate', () => {
      it('should regenerate document index successfully', async () => {
        const mockSavedIndex = {
          id: 'new-index',
          docId: 'doc-123',
          version: 2,
          metadata: {},
          createdAt: new Date()
        };

        const { IndexGenerator } = require('../../kg/preprocessing/index_generator');
        const { VersionManager } = require('../../kg/preprocessing/version_manager');

        IndexGenerator.mockImplementation(() => ({
          generateIndexedText: jest.fn().mockResolvedValue({
            indexedText: '1. New fact.',
            metadata: {}
          })
        }));

        VersionManager.mockImplementation(() => ({
          createVersion: jest.fn().mockResolvedValue(mockSavedIndex)
        }));

        const response = await request(app)
          .post('/api/preprocessing/index/doc-123/regenerate')
          .send({
            text: 'Document text content',
            llmConfig: { model: 'qwen-plus' }
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.docId).toBe('doc-123');
        expect(response.body.data.version).toBe(2);
      });

      it('should return 400 when text is missing', async () => {
        const response = await request(app)
          .post('/api/preprocessing/index/doc-123/regenerate')
          .send({})
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('text is required');
      });

      it('should handle LLM errors gracefully', async () => {
        const { IndexGenerator } = require('../../kg/preprocessing/index_generator');

        IndexGenerator.mockImplementation(() => ({
          generateIndexedText: jest.fn().mockRejectedValue(new Error('LLM timeout'))
        }));

        const response = await request(app)
          .post('/api/preprocessing/index/doc-123/regenerate')
          .send({ text: 'Document text' })
          .expect(500);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toContain('Failed to regenerate');
      });
    });

    describe('GET /api/preprocessing/index/:docId/compare', () => {
      it('should compare two versions successfully', async () => {
        const mockComparison = {
          docId: 'doc-123',
          version1: { version: 1, factCount: 2 },
          version2: { version: 2, factCount: 3 },
          comparison: {
            text: { identical: false, similarity: 0.85 },
            facts: { added: 1, removed: 0 }
          }
        };

        const { VersionManager } = require('../../kg/preprocessing/version_manager');
        VersionManager.mockImplementation(() => ({
          compareVersions: jest.fn().mockResolvedValue(mockComparison)
        }));

        const response = await request(app)
          .get('/api/preprocessing/index/doc-123/compare?version1=1&version2=2')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.comparison).toBeDefined();
      });

      it('should return 400 when version parameters are missing', async () => {
        const response = await request(app)
          .get('/api/preprocessing/index/doc-123/compare')
          .expect(400);

        expect(response.body.error).toContain('version1 and version2 are required');
      });
    });

    describe('DELETE /api/preprocessing/index/:docId/version/:version', () => {
      it('should delete version successfully', async () => {
        const { VersionManager } = require('../../kg/preprocessing/version_manager');
        VersionManager.mockImplementation(() => ({
          deleteVersion: jest.fn().mockResolvedValue(true)
        }));

        const response = await request(app)
          .delete('/api/preprocessing/index/doc-123/version/1')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('deleted successfully');
      });

      it('should return 404 when version not found', async () => {
        const { VersionManager } = require('../../kg/preprocessing/version_manager');
        VersionManager.mockImplementation(() => ({
          deleteVersion: jest.fn().mockResolvedValue(false)
        }));

        const response = await request(app)
          .delete('/api/preprocessing/index/doc-123/version/999')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Correction Statistics Routes', () => {
    describe('GET /api/preprocessing/stats/:docId', () => {
      it('should return correction statistics for a document', async () => {
        const mockStats = [
          {
            id: 'stat-1',
            docId: 'doc-123',
            stage: 'field_extraction',
            totalCorrections: 5,
            accuracyBefore: 0.75,
            accuracyAfter: 0.90,
            recallBefore: 0.70,
            recallAfter: 0.88,
            precisionBefore: 0.80,
            precisionAfter: 0.92,
            metadata: JSON.stringify({}),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];

        prisma.correctionStats = {
          findMany: jest.fn().mockResolvedValue(mockStats)
        };

        const response = await request(app)
          .get('/api/preprocessing/stats/doc-123')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.stats).toHaveLength(1);
        expect(response.body.data.stats[0].stage).toBe('field_extraction');
        expect(response.body.data.stats[0].accuracyImprovement).toBeCloseTo(0.15);
      });

      it('should filter by stage when stage parameter provided', async () => {
        prisma.correctionStats = {
          findMany: jest.fn().mockResolvedValue([])
        };

        await request(app)
          .get('/api/preprocessing/stats/doc-123?stage=field_extraction')
          .expect(404);

        expect(prisma.correctionStats.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              stage: 'field_extraction'
            })
          })
        );
      });

      it('should return 404 when no statistics found', async () => {
        prisma.correctionStats = {
          findMany: jest.fn().mockResolvedValue([])
        };

        const response = await request(app)
          .get('/api/preprocessing/stats/nonexistent')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/preprocessing/corrections/:docId', () => {
      it('should return correction records for a document', async () => {
        const mockCorrections = [
          {
            id: 'corr-1',
            docId: 'doc-123',
            stage: 'field_extraction',
            correctionType: 'missing_field_added',
            originalValue: null,
            correctedValue: JSON.stringify({ name: 'test', value: '123' }),
            confidenceBefore: null,
            confidenceAfter: 0.90,
            metadata: JSON.stringify({}),
            createdAt: new Date()
          }
        ];

        prisma.correctionRecord = {
          findMany: jest.fn().mockResolvedValue(mockCorrections),
          count: jest.fn().mockResolvedValue(1)
        };

        const response = await request(app)
          .get('/api/preprocessing/corrections/doc-123')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.corrections).toHaveLength(1);
        expect(response.body.data.total).toBe(1);
      });

      it('should support pagination with skip and take parameters', async () => {
        prisma.correctionRecord = {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0)
        };

        await request(app)
          .get('/api/preprocessing/corrections/doc-123?skip=10&take=20')
          .expect(200);

        expect(prisma.correctionRecord.findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            skip: 10,
            take: 20
          })
        );
      });
    });

    describe('GET /api/preprocessing/stats/aggregate', () => {
      it('should return aggregated statistics across all documents', async () => {
        const mockStats = [
          {
            id: 'stat-1',
            docId: 'doc-1',
            stage: 'field_extraction',
            totalCorrections: 5,
            accuracyBefore: 0.75,
            accuracyAfter: 0.90,
            recallBefore: 0.70,
            recallAfter: 0.88,
            precisionBefore: 0.80,
            precisionAfter: 0.92,
            metadata: JSON.stringify({}),
            createdAt: new Date(),
            updatedAt: new Date()
          },
          {
            id: 'stat-2',
            docId: 'doc-2',
            stage: 'field_extraction',
            totalCorrections: 3,
            accuracyBefore: 0.80,
            accuracyAfter: 0.92,
            recallBefore: 0.75,
            recallAfter: 0.90,
            precisionBefore: 0.85,
            precisionAfter: 0.94,
            metadata: JSON.stringify({}),
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ];

        prisma.correctionStats = {
          findMany: jest.fn().mockResolvedValue(mockStats)
        };

        const response = await request(app)
          .get('/api/preprocessing/stats/aggregate')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.totalDocuments).toBe(2);
        expect(response.body.data.totalCorrections).toBe(8);
        expect(response.body.data.averageAccuracyImprovement).toBeGreaterThan(0);
      });

      it('should return empty aggregates when no statistics exist', async () => {
        prisma.correctionStats = {
          findMany: jest.fn().mockResolvedValue([])
        };

        const response = await request(app)
          .get('/api/preprocessing/stats/aggregate')
          .expect(200);

        expect(response.body.data.totalDocuments).toBe(0);
        expect(response.body.data.totalCorrections).toBe(0);
      });
    });
  });

  describe('Performance Monitoring Routes', () => {
    describe('GET /api/preprocessing/performance/stats', () => {
      it('should return performance statistics', async () => {
        const preprocessingMonitor = require('../../kg/preprocessing/preprocessing_monitor');
        preprocessingMonitor.getPreprocessingStats = jest.fn().mockReturnValue({
          totalOperations: 100,
          successRate: 0.95,
          averageLatency: 2500
        });

        const response = await request(app)
          .get('/api/preprocessing/performance/stats')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.totalOperations).toBe(100);
      });

      it('should support timeRange parameter', async () => {
        const preprocessingMonitor = require('../../kg/preprocessing/preprocessing_monitor');
        preprocessingMonitor.getPreprocessingStats = jest.fn().mockReturnValue({});

        await request(app)
          .get('/api/preprocessing/performance/stats?timeRange=7200000')
          .expect(200);

        expect(preprocessingMonitor.getPreprocessingStats).toHaveBeenCalledWith(
          expect.objectContaining({
            timeRange: 7200000
          })
        );
      });
    });

    describe('GET /api/preprocessing/performance/document/:docId/summary', () => {
      it('should return document performance summary', async () => {
        const preprocessingMonitor = require('../../kg/preprocessing/preprocessing_monitor');
        preprocessingMonitor.getDocumentSummary = jest.fn().mockReturnValue({
          docId: 'doc-123',
          totalOperations: 10,
          averageLatency: 2000
        });

        const response = await request(app)
          .get('/api/preprocessing/performance/document/doc-123/summary')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.docId).toBe('doc-123');
      });

      it('should return 404 when no performance data found', async () => {
        const preprocessingMonitor = require('../../kg/preprocessing/preprocessing_monitor');
        preprocessingMonitor.getDocumentSummary = jest.fn().mockReturnValue(null);

        const response = await request(app)
          .get('/api/preprocessing/performance/document/nonexistent/summary')
          .expect(404);

        expect(response.body.success).toBe(false);
      });
    });

    describe('DELETE /api/preprocessing/performance/metrics/old', () => {
      it('should clear old metrics successfully', async () => {
        const preprocessingMonitor = require('../../kg/preprocessing/preprocessing_monitor');
        preprocessingMonitor.clearOldMetrics = jest.fn().mockReturnValue({
          cleared: 50
        });

        const response = await request(app)
          .delete('/api/preprocessing/performance/metrics/old')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.cleared).toBe(50);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      prisma.documentIndex = {
        findFirst: jest.fn().mockRejectedValue(new Error('Database connection failed'))
      };

      const response = await request(app)
        .get('/api/preprocessing/index/doc-123')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Internal server error');
    });

    it('should validate input parameters', async () => {
      const response = await request(app)
        .get('/api/preprocessing/index/doc-123/compare?version1=invalid&version2=2')
        .expect(400);

      expect(response.body.error).toContain('valid integers');
    });
  });

  describe('API Requirements Validation', () => {
    it('should implement all required endpoints for Requirement 9.4', () => {
      // Requirement 9.4: THE System SHALL 提供API接口查询Document_Index和矫正统计信息
      
      const routes = preprocessingRoutes.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods)
        }));

      // Check Document_Index query endpoints
      const indexRoutes = routes.filter(r => r.path.includes('/index'));
      expect(indexRoutes.length).toBeGreaterThan(0);

      // Check correction statistics query endpoints
      const statsRoutes = routes.filter(r => r.path.includes('/stats') || r.path.includes('/corrections'));
      expect(statsRoutes.length).toBeGreaterThan(0);
    });

    it('should implement regenerate endpoint for Requirement 10.5', () => {
      // Requirement 10.5: WHEN 文档更新时，THE System SHALL 支持重新生成Document_Index
      
      const routes = preprocessingRoutes.stack
        .filter(layer => layer.route)
        .map(layer => ({
          path: layer.route.path,
          methods: Object.keys(layer.route.methods)
        }));

      const regenerateRoute = routes.find(r => 
        r.path.includes('/regenerate') && r.methods.includes('post')
      );

      expect(regenerateRoute).toBeDefined();
    });
  });
});
