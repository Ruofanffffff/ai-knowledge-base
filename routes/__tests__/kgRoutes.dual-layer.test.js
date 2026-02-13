/**
 * KG Routes Dual-Layer Tests
 *
 * Tests for the dual-layer graph API endpoints.
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */

const request = require('supertest');
const express = require('express');
const kgRoutes = require('../kgRoutes');

// Mock dependencies
jest.mock('../../services/authService');
jest.mock('../../services/kgPipelineService', () => {
  const pipelineStatus = new Map();
  const service = {
    runPipeline: jest.fn(),
    getStatus: jest.fn((docId) => pipelineStatus.get(docId) || null),
  };
  service.pipelineStatus = pipelineStatus;
  service.prisma = {
    cleanedEntity: { findMany: jest.fn() },
    cleanedRelation: { findMany: jest.fn() },
    unifiedEntity: { findMany: jest.fn() },
    unifiedRelation: { findMany: jest.fn() },
    docEntity: { findMany: jest.fn() },
    docRelation: { findMany: jest.fn() },
  };
  module.exports = service;
  module.exports.pipelineStatus = pipelineStatus;
  module.exports.prisma = service.prisma;
  return service;
});

jest.mock('../../services/unificationService', () => ({
  runUnification: jest.fn(),
  getLatestLog: jest.fn(),
}));

const { authMiddleware } = require('../../services/authService');
const { prisma } = require('../../services/kgPipelineService');
const unificationService = require('../../services/unificationService');

describe('KG Routes - Dual Layer', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/kg', kgRoutes);

    authMiddleware.mockImplementation((req, res, next) => {
      req.userId = 'test-user';
      next();
    });

    jest.clearAllMocks();
  });

  // --- GET /api/kg/unified/graph ---

  describe('GET /api/kg/unified/graph', () => {
    it('should return unified entities and relations', async () => {
      prisma.unifiedEntity.findMany.mockResolvedValue([
        { id: 'ue1', cleanedName: '拍摄手法', description: '涵盖垂直拍摄等技巧' },
        { id: 'ue2', cleanedName: '摄影器材', description: '相机和镜头等设备' },
      ]);
      prisma.unifiedRelation.findMany.mockResolvedValue([
        { id: 'ur1', sourceEntityId: 'ue1', targetEntityId: 'ue2', cleanedName: '使用', description: '手法使用器材' },
      ]);

      const res = await request(app).get('/api/kg/unified/graph');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entities).toEqual([
        { id: 'ue1', name: '拍摄手法', description: '涵盖垂直拍摄等技巧' },
        { id: 'ue2', name: '摄影器材', description: '相机和镜头等设备' },
      ]);
      expect(res.body.data.relations).toEqual([
        { id: 'ur1', source: 'ue1', target: 'ue2', name: '使用', description: '手法使用器材' },
      ]);
    });

    it('should return empty arrays when no unified data exists', async () => {
      prisma.unifiedEntity.findMany.mockResolvedValue([]);
      prisma.unifiedRelation.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/kg/unified/graph');

      expect(res.status).toBe(200);
      expect(res.body.data.entities).toEqual([]);
      expect(res.body.data.relations).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      prisma.unifiedEntity.findMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/kg/unified/graph');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // --- GET /api/kg/doc/:docId/graph ---

  describe('GET /api/kg/doc/:docId/graph', () => {
    it('should return doc-specific entities and relations', async () => {
      prisma.docEntity.findMany.mockResolvedValue([
        { id: 'de1', cleanedName: '垂直拍摄', description: '从上方垂直角度拍摄' },
        { id: 'de2', cleanedName: '光圈控制', description: '调整光圈大小' },
      ]);
      prisma.docRelation.findMany.mockResolvedValue([
        { id: 'dr1', sourceEntityId: 'de1', targetEntityId: 'de2', cleanedName: '需要', description: '拍摄需要控制' },
      ]);

      const res = await request(app).get('/api/kg/doc/doc-123/graph');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.docId).toBe('doc-123');
      expect(res.body.data.entities).toEqual([
        { id: 'de1', name: '垂直拍摄', description: '从上方垂直角度拍摄' },
        { id: 'de2', name: '光圈控制', description: '调整光圈大小' },
      ]);
      expect(res.body.data.relations).toEqual([
        { id: 'dr1', source: 'de1', target: 'de2', name: '需要', description: '拍摄需要控制' },
      ]);
      expect(prisma.docEntity.findMany).toHaveBeenCalledWith({ where: { docId: 'doc-123' } });
      expect(prisma.docRelation.findMany).toHaveBeenCalledWith({ where: { docId: 'doc-123' } });
    });

    it('should return empty arrays when no doc data exists', async () => {
      prisma.docEntity.findMany.mockResolvedValue([]);
      prisma.docRelation.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/kg/doc/unknown-doc/graph');

      expect(res.status).toBe(200);
      expect(res.body.data.entities).toEqual([]);
      expect(res.body.data.relations).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      prisma.docEntity.findMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/kg/doc/doc-123/graph');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // --- POST /api/kg/unified/trigger ---

  describe('POST /api/kg/unified/trigger', () => {
    it('should start unification and return running status', async () => {
      unificationService.getLatestLog.mockResolvedValue(null);
      unificationService.runUnification.mockResolvedValue({ entityCount: 10, relationCount: 15 });

      const res = await request(app).post('/api/kg/unified/trigger');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('running');
      expect(res.body.data.message).toBe('统一归纳已启动');
      expect(unificationService.runUnification).toHaveBeenCalledWith('manual');
    });

    it('should return 409 when unification is already running', async () => {
      unificationService.getLatestLog.mockResolvedValue({
        status: 'running',
        startedAt: new Date(),
      });

      const res = await request(app).post('/api/kg/unified/trigger');

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('正在执行中');
      expect(unificationService.runUnification).not.toHaveBeenCalled();
    });

    it('should allow trigger after previous unification completed', async () => {
      unificationService.getLatestLog.mockResolvedValue({
        status: 'completed',
        completedAt: new Date(),
      });
      unificationService.runUnification.mockResolvedValue({ entityCount: 10, relationCount: 15 });

      const res = await request(app).post('/api/kg/unified/trigger');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow trigger after previous unification failed', async () => {
      unificationService.getLatestLog.mockResolvedValue({
        status: 'failed',
        error: 'Some error',
        completedAt: new Date(),
      });
      unificationService.runUnification.mockResolvedValue({ entityCount: 10, relationCount: 15 });

      const res = await request(app).post('/api/kg/unified/trigger');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // --- GET /api/kg/unified/status ---

  describe('GET /api/kg/unified/status', () => {
    it('should return latest unification log', async () => {
      const mockLog = {
        status: 'completed',
        entityCount: 10,
        relationCount: 15,
        triggeredBy: 'scheduler',
        startedAt: new Date('2024-01-01T00:00:00Z'),
        completedAt: new Date('2024-01-01T00:01:30Z'),
        error: null,
      };
      unificationService.getLatestLog.mockResolvedValue(mockLog);

      const res = await request(app).get('/api/kg/unified/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('completed');
      expect(res.body.data.entityCount).toBe(10);
      expect(res.body.data.relationCount).toBe(15);
      expect(res.body.data.triggeredBy).toBe('scheduler');
    });

    it('should return idle status when no log exists', async () => {
      unificationService.getLatestLog.mockResolvedValue(null);

      const res = await request(app).get('/api/kg/unified/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('idle');
      expect(res.body.data.message).toBe('尚未执行过统一归纳');
    });

    it('should return running status when unification is in progress', async () => {
      const mockLog = {
        status: 'running',
        entityCount: 0,
        relationCount: 0,
        triggeredBy: 'manual',
        startedAt: new Date(),
        completedAt: null,
        error: null,
      };
      unificationService.getLatestLog.mockResolvedValue(mockLog);

      const res = await request(app).get('/api/kg/unified/status');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('running');
    });

    it('should return 500 on database error', async () => {
      unificationService.getLatestLog.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/kg/unified/status');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // --- GET /api/kg/graph (兼容性测试) ---

  describe('GET /api/kg/graph (compatibility)', () => {
    it('should return unified graph data for backward compatibility', async () => {
      prisma.unifiedEntity.findMany.mockResolvedValue([
        { id: 'ue1', cleanedName: '实体A', description: '描述A' },
      ]);
      prisma.unifiedRelation.findMany.mockResolvedValue([
        { id: 'ur1', sourceEntityId: 'ue1', targetEntityId: 'ue1', cleanedName: '关系', description: '关系描述' },
      ]);

      const res = await request(app).get('/api/kg/graph');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entities).toHaveLength(1);
      expect(res.body.data.relations).toHaveLength(1);
    });
  });
});
