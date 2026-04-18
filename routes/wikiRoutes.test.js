const request = require('supertest');
const express = require('express');

jest.mock('../services/authService', () => ({
  authMiddleware: jest.fn(),
}));

jest.mock('../services/wiki/wikiService', () => ({
  compileSource: jest.fn(),
  compileSourceById: jest.fn(),
  listPages: jest.fn(),
  healthcheck: jest.fn(),
  health: jest.fn(),
}));

const wikiRoutes = require('./wikiRoutes');
const { authMiddleware } = require('../services/authService');
const wikiService = require('../services/wiki/wikiService');

describe('Wiki Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/wiki', wikiRoutes);

    authMiddleware.mockImplementation((req, res, next) => {
      req.userId = 'test-user';
      next();
    });

    jest.clearAllMocks();
  });

  it('GET /api/wiki/health should return 200 when ok', async () => {
    wikiService.health.mockResolvedValue({ ok: true, time: 't' });

    const res = await request(app).get('/api/wiki/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ok).toBe(true);
  });

  it('GET /api/wiki/healthcheck should return 200 when ok', async () => {
    wikiService.healthcheck.mockResolvedValue({ ok: true, time: 't' });

    const res = await request(app).get('/api/wiki/healthcheck');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ok).toBe(true);
  });

  it('GET /api/wiki/healthcheck should return 503 when not ok', async () => {
    wikiService.healthcheck.mockResolvedValue({ ok: false, time: 't' });

    const res = await request(app).get('/api/wiki/healthcheck');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(true);
    expect(res.body.data.ok).toBe(false);
  });
});
