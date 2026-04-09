const express = require('express');
const request = require('supertest');

jest.mock('../services/authService', () => ({
  authMiddleware: (req, _res, next) => {
    req.user = { id: 'u1', username: 'u1' };
    next();
  },
  requirePermission: () => (_req, _res, next) => next(),
}));

jest.mock('../services/shortVideo/shortVideoUrlService', () => ({
  normalizeUrl: (url) => ({
    platform: 'douyin',
    originalUrl: url,
    normalizedUrl: 'https://v.douyin.com/abc/',
  }),
}));

const shortVideoDAL = require('../services/shortVideo/shortVideoDAL');
jest.mock('../services/shortVideo/shortVideoDAL', () => ({
  findLatestByUrl: jest.fn(),
  countSourcesSince: jest.fn(),
  createSource: jest.fn(),
  upsertDigestSetting: jest.fn().mockResolvedValue({}),
  getSourceById: jest.fn(),
  listArtifacts: jest.fn(),
  cancelSource: jest.fn(),
  retrySource: jest.fn(),
  listSourcesByUser: jest.fn(),
  getDigestSetting: jest.fn(),
  getDailyDigest: jest.fn(),
  deleteSource: jest.fn(),
}));

const noteDAL = require('../services/notes/noteDAL');
jest.mock('../services/notes/noteDAL', () => ({
  deleteNote: jest.fn(),
}));

describe('Short Video Routes', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/short-videos', require('./shortVideoRoutes'));
    jest.clearAllMocks();
    delete process.env.SHORT_VIDEO_DAILY_LIMIT;
  });

  test('POST /ingest creates source', async () => {
    shortVideoDAL.findLatestByUrl.mockResolvedValue(null);
    shortVideoDAL.countSourcesSince.mockResolvedValue(0);
    shortVideoDAL.createSource.mockResolvedValue({ id: 's1', status: 'queued' });

    const res = await request(app).post('/api/short-videos/ingest').send({ url: 'https://v.douyin.com/xxx/' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('s1');
  });

  test('POST /ingest enforces daily limit', async () => {
    process.env.SHORT_VIDEO_DAILY_LIMIT = '1';
    shortVideoDAL.findLatestByUrl.mockResolvedValue(null);
    shortVideoDAL.countSourcesSince.mockResolvedValue(1);

    const res = await request(app).post('/api/short-videos/ingest').send({ url: 'https://v.douyin.com/xxx/' });
    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
  });

  test('POST /ingest returns existing source if already queued/running/succeeded', async () => {
    shortVideoDAL.findLatestByUrl.mockResolvedValue({ id: 's_old', status: 'running' });

    const res = await request(app).post('/api/short-videos/ingest').send({ url: 'https://v.douyin.com/xxx/' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('s_old');
  });

  test('DELETE /sources/:id deletes derived notes and source', async () => {
    shortVideoDAL.getSourceById.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      noteQuickId: 'n1',
      noteRefinedId: 'n2',
    });
    shortVideoDAL.deleteSource.mockResolvedValue({ id: 's1' });

    const res = await request(app).delete('/api/short-videos/sources/s1');
    expect(res.status).toBe(200);
    expect(noteDAL.deleteNote).toHaveBeenCalledWith('n2', 'u1');
    expect(noteDAL.deleteNote).toHaveBeenCalledWith('n1', 'u1');
    expect(shortVideoDAL.deleteSource).toHaveBeenCalledWith('s1', 'u1');
  });
});
