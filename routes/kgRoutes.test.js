/**
 * KG Routes Tests
 *
 * Tests for the redesigned KG API endpoints.
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5
 */

const request = require('supertest');
const express = require('express');
const kgRoutes = require('./kgRoutes');

// Mock dependencies
jest.mock('../services/authService');
jest.mock('../services/kgPipelineService', () => {
  const pipelineStatus = new Map();
  const service = {
    runPipeline: jest.fn(),
    getStatus: jest.fn((docId) => pipelineStatus.get(docId) || null),
  };
  service.pipelineStatus = pipelineStatus;
  service.prisma = {
    cleanedEntity: { findMany: jest.fn() },
    cleanedRelation: { findMany: jest.fn() },
  };
  // Default export is the service instance; named exports attached
  module.exports = service;
  module.exports.pipelineStatus = pipelineStatus;
  module.exports.prisma = service.prisma;
  return service;
});

const { authMiddleware } = require('../services/authService');
const kgPipelineService = require('../services/kgPipelineService');
const { pipelineStatus, prisma } = require('../services/kgPipelineService');

describe('KG Routes', () => {
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
    pipelineStatus.clear();
  });

  // --- POST /api/kg/build ---

  describe('POST /api/kg/build', () => {
    it('should start pipeline and return pending status', async () => {
      kgPipelineService.runPipeline.mockResolvedValue({ docId: 'doc-1', entityCount: 3, relationCount: 2 });

      const res = await request(app)
        .post('/api/kg/build')
        .send({ docId: 'doc-1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        docId: 'doc-1',
        status: 'pending',
        message: '图谱构建已启动',
      });
      expect(kgPipelineService.runPipeline).toHaveBeenCalledWith('doc-1');
    });

    it('should return 400 when docId is missing', async () => {
      const res = await request(app)
        .post('/api/kg/build')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should return 409 when pipeline is already active for docId', async () => {
      pipelineStatus.set('doc-1', { docId: 'doc-1', status: 'extracting_entities' });

      const res = await request(app)
        .post('/api/kg/build')
        .send({ docId: 'doc-1' });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.data.status).toBe('extracting_entities');
    });

    it('should allow rebuild after pipeline completed', async () => {
      pipelineStatus.set('doc-1', { docId: 'doc-1', status: 'completed' });
      kgPipelineService.runPipeline.mockResolvedValue({});

      const res = await request(app)
        .post('/api/kg/build')
        .send({ docId: 'doc-1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should allow rebuild after pipeline failed', async () => {
      pipelineStatus.set('doc-1', { docId: 'doc-1', status: 'failed' });
      kgPipelineService.runPipeline.mockResolvedValue({});

      const res = await request(app)
        .post('/api/kg/build')
        .send({ docId: 'doc-1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // --- GET /api/kg/graph ---

  describe('GET /api/kg/graph', () => {
    it('should return mapped entities and relations', async () => {
      prisma.cleanedEntity.findMany.mockResolvedValue([
        { id: 'e1', cleanedName: '实体A', description: '描述A' },
        { id: 'e2', cleanedName: '实体B', description: '描述B' },
      ]);
      prisma.cleanedRelation.findMany.mockResolvedValue([
        { id: 'r1', sourceEntityId: 'e1', targetEntityId: 'e2', cleanedName: '关系', description: '关系描述' },
      ]);

      const res = await request(app).get('/api/kg/graph');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entities).toEqual([
        { id: 'e1', name: '实体A', description: '描述A' },
        { id: 'e2', name: '实体B', description: '描述B' },
      ]);
      expect(res.body.data.relations).toEqual([
        { id: 'r1', source: 'e1', target: 'e2', name: '关系', description: '关系描述' },
      ]);
    });

    it('should return empty arrays when no data exists', async () => {
      prisma.cleanedEntity.findMany.mockResolvedValue([]);
      prisma.cleanedRelation.findMany.mockResolvedValue([]);

      const res = await request(app).get('/api/kg/graph');

      expect(res.status).toBe(200);
      expect(res.body.data.entities).toEqual([]);
      expect(res.body.data.relations).toEqual([]);
    });

    it('should return 500 on database error', async () => {
      prisma.cleanedEntity.findMany.mockRejectedValue(new Error('DB error'));

      const res = await request(app).get('/api/kg/graph');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // --- GET /api/kg/status/:docId ---

  describe('GET /api/kg/status/:docId', () => {
    it('should return pipeline status for a known docId', async () => {
      pipelineStatus.set('doc-1', {
        docId: 'doc-1',
        status: 'extracting_entities',
        entityCount: 5,
        relationCount: 0,
      });

      const res = await request(app).get('/api/kg/status/doc-1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        docId: 'doc-1',
        status: 'extracting_entities',
        entityCount: 5,
        relationCount: 0,
      });
    });

    it('should return 404 when no status exists for docId', async () => {
      const res = await request(app).get('/api/kg/status/unknown-doc');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
