/**
 * imageRoutes 单元测试
 *
 * 测试图片上传、识别结果查询和代理路由的核心逻辑。
 * 使用 mock 隔离外部依赖（MinIO、Prisma、ImageRecognitionService）。
 *
 * Requirements: 2.3, 2.4, 3.1
 */

const request = require('supertest');
const express = require('express');
const path = require('path');

// Mock dependencies
jest.mock('../services/minioService', () => ({
  uploadFile: jest.fn(),
  getFile: jest.fn(),
}));

jest.mock('../services/imageRecognitionService', () => ({
  getImageRecognitionService: jest.fn(() => ({
    analyzeImage: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('@prisma/client', () => {
  const mockPrisma = {
    imageAnalysis: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
  };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

const minioService = require('../services/minioService');
const { getImageRecognitionService } = require('../services/imageRecognitionService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const imageRoutes = require('./imageRoutes');

// Create test app
function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/images', imageRoutes);
  return app;
}

describe('POST /api/images/upload', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('成功上传图片返回 201 和正确格式', async () => {
    minioService.uploadFile.mockResolvedValue({
      key: 'test-uuid.png',
      url: '/api/images/proxy/test-uuid.png',
    });

    prisma.imageAnalysis.create.mockResolvedValue({
      id: 'analysis-uuid-1',
      imageKey: 'test-uuid.png',
      imageUrl: '/api/images/proxy/test-uuid.png',
      status: 'pending',
    });

    const res = await request(app)
      .post('/api/images/upload')
      .attach('file', Buffer.from('fake-png-data'), {
        filename: 'test.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      url: '/api/images/proxy/test-uuid.png',
      key: 'test-uuid.png',
      analysisId: 'analysis-uuid-1',
      analysisStatus: 'pending',
    });

    // 验证 MinIO 上传被调用
    expect(minioService.uploadFile).toHaveBeenCalledTimes(1);
    // 验证 ImageAnalysis 记录被创建
    expect(prisma.imageAnalysis.create).toHaveBeenCalledWith({
      data: {
        imageKey: 'test-uuid.png',
        imageUrl: '/api/images/proxy/test-uuid.png',
        status: 'pending',
      },
    });
    // 验证上传时不触发识别（保存文档时才触发）
    expect(getImageRecognitionService).not.toHaveBeenCalled();
  });

  test('无文件时返回 400', async () => {
    const res = await request(app)
      .post('/api/images/upload');

    expect(res.status).toBe(400);
  });

  test('非图片文件返回 400', async () => {
    const res = await request(app)
      .post('/api/images/upload')
      .attach('file', Buffer.from('not-an-image'), {
        filename: 'test.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBe(400);
  });

  test('MinIO 不可用时返回 503', async () => {
    minioService.uploadFile.mockRejectedValue(
      new Error('MinIO 存储服务不可用：文件上传失败。')
    );

    const res = await request(app)
      .post('/api/images/upload')
      .attach('file', Buffer.from('fake-png-data'), {
        filename: 'test.png',
        contentType: 'image/png',
      });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('存储服务不可用');
  });
});

describe('POST /api/images/upload-from-url', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('成功从 URL 抓取并上传图片返回 201', async () => {
    // Mock global fetch
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      headers: new Map([['content-type', 'image/jpeg']]),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });
    // Make headers.get work
    global.fetch.mockResolvedValue({
      ok: true,
      headers: { get: (key) => key === 'content-type' ? 'image/jpeg' : null },
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
    });

    minioService.uploadFile.mockResolvedValue({
      key: 'pasted-123.jpeg',
      url: '/api/images/proxy/pasted-123.jpeg',
    });

    prisma.imageAnalysis.create.mockResolvedValue({
      id: 'analysis-url-1',
      imageKey: 'pasted-123.jpeg',
      imageUrl: '/api/images/proxy/pasted-123.jpeg',
      status: 'pending',
    });

    const res = await request(app)
      .post('/api/images/upload-from-url')
      .send({ url: 'https://example.com/photo.jpg' });

    expect(res.status).toBe(201);
    expect(res.body.url).toBe('/api/images/proxy/pasted-123.jpeg');
    expect(res.body.analysisId).toBe('analysis-url-1');
    expect(res.body.analysisStatus).toBe('pending');

    global.fetch = originalFetch;
  });

  test('缺少 URL 参数返回 400', async () => {
    const res = await request(app)
      .post('/api/images/upload-from-url')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('请提供图片 URL');
  });

  test('URL 参数类型错误返回 400', async () => {
    const res = await request(app)
      .post('/api/images/upload-from-url')
      .send({ url: 123 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('请提供图片 URL');
  });
});

describe('GET /api/images/:id/analysis', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('返回已完成的识别结果', async () => {
    prisma.imageAnalysis.findUnique.mockResolvedValue({
      id: 'analysis-1',
      imageKey: 'test.png',
      imageUrl: '/api/images/proxy/test.png',
      description: '一张测试图片',
      elements: '["元素1","元素2"]',
      theme: '测试',
      status: 'completed',
      error: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    });

    const res = await request(app).get('/api/images/analysis-1/analysis');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('analysis-1');
    expect(res.body.description).toBe('一张测试图片');
    expect(res.body.elements).toEqual(['元素1', '元素2']);
    expect(res.body.theme).toBe('测试');
    expect(res.body.status).toBe('completed');
  });

  test('记录不存在时返回 404', async () => {
    prisma.imageAnalysis.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/images/nonexistent/analysis');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('识别记录不存在');
  });

  test('elements 为 null 时返回空数组', async () => {
    prisma.imageAnalysis.findUnique.mockResolvedValue({
      id: 'analysis-2',
      imageKey: 'test.png',
      imageUrl: '/api/images/proxy/test.png',
      description: null,
      elements: null,
      theme: null,
      status: 'pending',
      error: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    });

    const res = await request(app).get('/api/images/analysis-2/analysis');

    expect(res.status).toBe(200);
    expect(res.body.elements).toEqual([]);
  });
});

describe('GET /api/images/proxy/*', () => {
  let app;

  beforeEach(() => {
    app = createApp();
    jest.clearAllMocks();
  });

  test('成功代理返回图片', async () => {
    const { Readable } = require('stream');
    const mockStream = new Readable({
      read() {
        this.push(Buffer.from('fake-image-data'));
        this.push(null);
      },
    });

    minioService.getFile.mockResolvedValue({
      body: mockStream,
      contentType: 'image/png',
    });

    const res = await request(app).get('/api/images/proxy/test-uuid.png');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['cache-control']).toBe('public, max-age=86400');
  });

  test('MinIO 不可用时返回 503', async () => {
    minioService.getFile.mockRejectedValue(
      new Error('MinIO 存储服务不可用：文件获取失败。')
    );

    const res = await request(app).get('/api/images/proxy/test-uuid.png');

    expect(res.status).toBe(503);
  });

  test('文件不存在时返回 404', async () => {
    minioService.getFile.mockRejectedValue(new Error('文件不存在'));

    const res = await request(app).get('/api/images/proxy/nonexistent.png');

    expect(res.status).toBe(404);
  });
});
