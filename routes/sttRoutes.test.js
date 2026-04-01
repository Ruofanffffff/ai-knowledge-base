process.env.STT_JWT_SECRET = 'test-stt-secret';

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

jest.mock('../services/authService', () => ({
  authMiddleware: jest.fn((req, res, next) => {
    req.userId = 'test-user';
    next();
  }),
}));

jest.mock('openai', () => {
  const create = jest.fn();
  const client = { audio: { transcriptions: { create } } };
  const OpenAI = jest.fn(() => client);
  OpenAI.toFile = jest.fn(async () => ({ mocked: true }));
  OpenAI.__create = create;
  return OpenAI;
});

describe('STT Routes', () => {
  let app;
  let sttRoutes;

  beforeEach(() => {
    process.env.QWEN_API_KEY = 'test-qwen-key';
    sttRoutes = require('./sttRoutes');
    app = express();
    app.use(express.json({ limit: '50mb' }));
    app.use('/api/stt', sttRoutes);
  });

  afterEach(() => {
    jest.resetModules();
    delete process.env.QWEN_API_KEY;
  });

  it('POST /api/stt/token should return short-lived stt jwt', async () => {
    const res = await request(app)
      .post('/api/stt/token')
      .set('Authorization', 'Bearer user-token')
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeTruthy();

    const decoded = jwt.verify(res.body.data.token, process.env.STT_JWT_SECRET);
    expect(decoded.typ).toBe('stt');
    expect(decoded.userId).toBe('test-user');
  });

  it('POST /api/stt/chunk should transcribe wav converted from pcm16le', async () => {
    const OpenAI = require('openai');
    OpenAI.__create.mockResolvedValue({ text: 'hello' });

    const tokenRes = await request(app)
      .post('/api/stt/token')
      .set('Authorization', 'Bearer user-token')
      .send({});
    const token = tokenRes.body.data.token;

    const pcm = Buffer.alloc(3200, 0);
    const res = await request(app)
      .post('/api/stt/chunk')
      .set('Authorization', `Bearer ${token}`)
      .send({
        pcm16leBase64: pcm.toString('base64'),
        sampleRate: 16000,
        channels: 1,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.text).toBe('hello');
    expect(OpenAI.__create).toHaveBeenCalled();
  });

  it('POST /api/stt/chunk should reject missing audio', async () => {
    const tokenRes = await request(app)
      .post('/api/stt/token')
      .set('Authorization', 'Bearer user-token')
      .send({});
    const token = tokenRes.body.data.token;

    const res = await request(app)
      .post('/api/stt/chunk')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
