/**
 * Knowledge Growth Routes - Unit Tests
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 7.9, 7.10
 */

const express = require('express');
const request = require('supertest');

// --- Mocks ---

const TEST_USER_ID = 'user-test-123';

jest.mock('../services/authService', () => ({
  authMiddleware: (req, res, next) => {
    req.userId = TEST_USER_ID;
    req.user = { id: TEST_USER_ID };
    next();
  },
}));

const mockPrisma = {
  knowledgeBody: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
  },
  cognitiveFragment: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  knowledgeBodyNode: {
    findMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  themeEvolutionLog: {
    findMany: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    deleteMany: jest.fn(),
  },
  $transaction: jest.fn((fn) => fn(mockPrisma)),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

jest.mock('../services/knowledgeGrowthService', () => ({
  checkMatureStatus: jest.fn(),
  exportToDocument: jest.fn(),
  updateExportedDocument: jest.fn(),
}));

jest.mock('../services/structuralCompletion', () => ({
  generateOutline: jest.fn(),
}));

jest.mock('../services/interestConstrainedGeneration', () => ({
  generate: jest.fn(),
}));

jest.mock('../services/themeDiscoveryEngine', () => ({
  discover: jest.fn(),
}));

const knowledgeGrowthService = require('../services/knowledgeGrowthService');
const interestConstrainedGeneration = require('../services/interestConstrainedGeneration');
const themeDiscoveryEngine = require('../services/themeDiscoveryEngine');
const knowledgeGrowthRoutes = require('./knowledgeGrowthRoutes');

let app;

beforeAll(() => {
  app = express();
  app.use(express.json());
  app.use('/api/knowledge-growth', knowledgeGrowthRoutes);
});

beforeEach(() => {
  jest.clearAllMocks();
});

// --- Helper factories ---

function makeBody(overrides = {}) {
  return {
    id: 'body-1',
    userId: TEST_USER_ID,
    themeName: '测试主题',
    themeDescription: '测试描述',
    confidenceScore: 0.5,
    growthPhase: 'discovery',
    bodyType: 'topic',
    parentId: null,
    relatedFragmentIds: '["frag-1","frag-2"]',
    relatedEntityIds: '[]',
    exportedDocId: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    nodes: [],
    children: [],
    ...overrides,
  };
}

function makeNode(overrides = {}) {
  return {
    id: 'node-1',
    bodyId: 'body-1',
    parentNodeId: null,
    title: '节点标题',
    status: 'gap',
    content: null,
    generationMode: null,
    sortOrder: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ============================================
// GET /api/knowledge-growth/bodies
// ============================================

describe('GET /api/knowledge-growth/bodies', () => {
  test('返回当前用户的知识体列表，按 confidenceScore 降序', async () => {
    const bodies = [
      makeBody({ id: 'b1', confidenceScore: 0.9, nodes: [makeNode()], themeEvolutionLogs: [{ id: 'evo-1' }] }),
      makeBody({ id: 'b2', confidenceScore: 0.5, nodes: [], themeEvolutionLogs: [] }),
    ];
    mockPrisma.knowledgeBody.findMany.mockResolvedValue(bodies);

    const res = await request(app).get('/api/knowledge-growth/bodies?flat=true');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].id).toBe('b1');
    expect(res.body.data[0].fragmentCount).toBe(2);
    expect(res.body.data[0].nodeCount).toBe(1);
    expect(res.body.data[0].bodyType).toBe('topic');

    // Verify Prisma was called with correct params (includes lifecycleStatus filter by default)
    expect(mockPrisma.knowledgeBody.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: TEST_USER_ID, lifecycleStatus: { not: 'archived' } }),
        orderBy: { confidenceScore: 'desc' },
      })
    );
  });

  test('支持按 growthPhase 筛选', async () => {
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([]);

    await request(app).get('/api/knowledge-growth/bodies?flat=true&growthPhase=skeleton');

    expect(mockPrisma.knowledgeBody.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ growthPhase: 'skeleton' }),
      })
    );
  });

  test('支持按 confidenceScore 范围筛选', async () => {
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([]);

    await request(app).get('/api/knowledge-growth/bodies?flat=true&minConfidence=0.5&maxConfidence=0.9');

    expect(mockPrisma.knowledgeBody.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          confidenceScore: { gte: 0.5, lte: 0.9 },
        }),
      })
    );
  });

  test('数据库错误返回 500', async () => {
    mockPrisma.knowledgeBody.findMany.mockRejectedValue(new Error('DB error'));

    const res = await request(app).get('/api/knowledge-growth/bodies');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });

  test('默认返回树形结构：意图知识体含 children，独立主题知识体平级', async () => {
    const childTopic1 = makeBody({ id: 'topic-1', themeName: '径山寺祈福', bodyType: 'topic', parentId: 'intent-1', confidenceScore: 0.6, children: [] });
    const childTopic2 = makeBody({ id: 'topic-2', themeName: '西湖骑行', bodyType: 'topic', parentId: 'intent-1', confidenceScore: 0.5, children: [] });
    const intentBody = makeBody({
      id: 'intent-1',
      themeName: '杭州深度游',
      bodyType: 'intent',
      parentId: null,
      confidenceScore: 0.75,
      growthPhase: 'skeleton',
      children: [childTopic1, childTopic2],
    });
    const standaloneBody = makeBody({
      id: 'standalone-1',
      themeName: 'Python学习笔记',
      bodyType: 'topic',
      parentId: null,
      confidenceScore: 0.4,
      children: [],
    });

    mockPrisma.knowledgeBody.findMany.mockResolvedValue([intentBody, standaloneBody]);

    const res = await request(app).get('/api/knowledge-growth/bodies');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);

    // Intent body should have children
    const intent = res.body.data.find(b => b.id === 'intent-1');
    expect(intent).toBeDefined();
    expect(intent.bodyType).toBe('intent');
    expect(intent.children).toHaveLength(2);
    expect(intent.childCount).toBe(2);
    expect(intent.children[0].bodyType).toBe('topic');

    // Standalone topic should not have children
    const standalone = res.body.data.find(b => b.id === 'standalone-1');
    expect(standalone).toBeDefined();
    expect(standalone.bodyType).toBe('topic');
    expect(standalone.children).toBeUndefined();
  });

  test('树形结构顶层节点按 confidenceScore 降序排列', async () => {
    const intentBody = makeBody({
      id: 'intent-1', bodyType: 'intent', parentId: null, confidenceScore: 0.5, children: [],
    });
    const standaloneBody = makeBody({
      id: 'standalone-1', bodyType: 'topic', parentId: null, confidenceScore: 0.9, children: [],
    });

    mockPrisma.knowledgeBody.findMany.mockResolvedValue([intentBody, standaloneBody]);

    const res = await request(app).get('/api/knowledge-growth/bodies');

    expect(res.body.data[0].confidenceScore).toBeGreaterThanOrEqual(res.body.data[1].confidenceScore);
  });

  test('意图知识体所有子知识体均为 mature 时，growthPhase 标记为 mature', async () => {
    const matureChild1 = makeBody({ id: 'c1', bodyType: 'topic', parentId: 'intent-1', growthPhase: 'mature', children: [] });
    const matureChild2 = makeBody({ id: 'c2', bodyType: 'topic', parentId: 'intent-1', growthPhase: 'mature', children: [] });
    const intentBody = makeBody({
      id: 'intent-1', bodyType: 'intent', parentId: null, growthPhase: 'skeleton',
      confidenceScore: 0.7, children: [matureChild1, matureChild2],
    });

    mockPrisma.knowledgeBody.findMany.mockResolvedValue([intentBody]);

    const res = await request(app).get('/api/knowledge-growth/bodies');

    const intent = res.body.data.find(b => b.id === 'intent-1');
    expect(intent.growthPhase).toBe('mature');
  });

  test('树形结构每个知识体包含必需字段', async () => {
    const child = makeBody({ id: 'topic-1', bodyType: 'topic', parentId: 'intent-1', children: [] });
    const intentBody = makeBody({
      id: 'intent-1', bodyType: 'intent', parentId: null, children: [child],
    });

    mockPrisma.knowledgeBody.findMany.mockResolvedValue([intentBody]);

    const res = await request(app).get('/api/knowledge-growth/bodies');

    const requiredFields = ['id', 'themeName', 'themeDescription', 'confidenceScore', 'growthPhase', 'bodyType', 'fragmentCount', 'childCount'];
    const body = res.body.data[0];
    for (const field of requiredFields) {
      expect(body).toHaveProperty(field);
    }
    // Children should also have required fields
    for (const field of requiredFields) {
      expect(body.children[0]).toHaveProperty(field);
    }
  });

  test('树形结构空列表返回空数组', async () => {
    mockPrisma.knowledgeBody.findMany.mockResolvedValue([]);

    const res = await request(app).get('/api/knowledge-growth/bodies');

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});


// ============================================
// GET /api/knowledge-growth/bodies/:id
// ============================================

describe('GET /api/knowledge-growth/bodies/:id', () => {
  test('discovery 阶段仅返回基本信息', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ growthPhase: 'discovery' })
    );

    const res = await request(app).get('/api/knowledge-growth/bodies/body-1');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('themeName');
    expect(res.body.data).toHaveProperty('fragmentCount');
    expect(res.body.data).not.toHaveProperty('nodes');
    expect(res.body.data).not.toHaveProperty('exportedDocId');
  });

  test('skeleton 阶段返回大纲节点（无 content）', async () => {
    const nodes = [
      makeNode({ id: 'n1', status: 'filled' }),
      makeNode({ id: 'n2', status: 'gap', content: '一些内容' }),
    ];
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ growthPhase: 'skeleton', nodes })
    );

    const res = await request(app).get('/api/knowledge-growth/bodies/body-1');

    expect(res.status).toBe(200);
    expect(res.body.data.nodes).toHaveLength(2);
    expect(res.body.data.nodes[0]).toHaveProperty('status');
    expect(res.body.data.nodes[0]).not.toHaveProperty('content');
  });

  test('flesh 阶段返回完整数据包括 content', async () => {
    const nodes = [
      makeNode({ id: 'n1', status: 'generated', content: '生成的内容' }),
    ];
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ growthPhase: 'flesh', nodes })
    );

    const res = await request(app).get('/api/knowledge-growth/bodies/body-1');

    expect(res.status).toBe(200);
    expect(res.body.data.nodes[0]).toHaveProperty('content', '生成的内容');
    expect(res.body.data).toHaveProperty('exportedDocId');
    expect(res.body.data).toHaveProperty('relatedEntityIds');
  });

  test('mature 阶段返回完整数据', async () => {
    const nodes = [makeNode({ status: 'filled', content: '内容' })];
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ growthPhase: 'mature', nodes, exportedDocId: 'doc-1' })
    );

    const res = await request(app).get('/api/knowledge-growth/bodies/body-1');

    expect(res.status).toBe(200);
    expect(res.body.data.nodes[0]).toHaveProperty('content');
    expect(res.body.data.exportedDocId).toBe('doc-1');
  });

  test('知识体不存在返回 404', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/knowledge-growth/bodies/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('非本人知识体返回 403', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ userId: 'other-user' })
    );

    const res = await request(app).get('/api/knowledge-growth/bodies/body-1');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ============================================
// GET /api/knowledge-growth/bodies/:id/outline
// ============================================

describe('GET /api/knowledge-growth/bodies/:id/outline', () => {
  test('返回树形大纲结构', async () => {
    const nodes = [
      makeNode({ id: 'n1', parentNodeId: null, title: '根节点', sortOrder: 0 }),
      makeNode({ id: 'n2', parentNodeId: 'n1', title: '子节点', sortOrder: 1 }),
    ];
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ nodes })
    );

    const res = await request(app).get('/api/knowledge-growth/bodies/body-1/outline');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('根节点');
    expect(res.body.data[0].children).toHaveLength(1);
    expect(res.body.data[0].children[0].title).toBe('子节点');
  });

  test('大纲 JSON 往返一致性', async () => {
    const nodes = [
      makeNode({ id: 'n1', parentNodeId: null, title: '节点A', status: 'filled', content: '内容A' }),
    ];
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(makeBody({ nodes }));

    const res = await request(app).get('/api/knowledge-growth/bodies/body-1/outline');

    const json = JSON.stringify(res.body.data);
    const parsed = JSON.parse(json);
    expect(parsed).toEqual(res.body.data);
  });

  test('知识体不存在返回 404', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(null);

    const res = await request(app).get('/api/knowledge-growth/bodies/nonexistent/outline');

    expect(res.status).toBe(404);
  });
});


// ============================================
// POST /api/knowledge-growth/bodies/:id/generate
// ============================================

describe('POST /api/knowledge-growth/bodies/:id/generate', () => {
  test('成功触发节点内容补全', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(makeBody());
    interestConstrainedGeneration.generate.mockResolvedValue({
      nodeId: 'node-1',
      content: '生成的内容',
      mode: 'full',
    });

    const res = await request(app)
      .post('/api/knowledge-growth/bodies/body-1/generate')
      .send({ nodeId: 'node-1', mode: 'full' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.content).toBe('生成的内容');
    expect(interestConstrainedGeneration.generate).toHaveBeenCalledWith({
      bodyId: 'body-1',
      nodeId: 'node-1',
      mode: 'full',
    });
  });

  test('缺少 nodeId 返回 400', async () => {
    const res = await request(app)
      .post('/api/knowledge-growth/bodies/body-1/generate')
      .send({ mode: 'full' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('nodeId');
  });

  test('无效 mode 返回 400', async () => {
    const res = await request(app)
      .post('/api/knowledge-growth/bodies/body-1/generate')
      .send({ nodeId: 'node-1', mode: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('mode');
  });

  test('知识体不存在返回 404', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/knowledge-growth/bodies/nonexistent/generate')
      .send({ nodeId: 'node-1', mode: 'full' });

    expect(res.status).toBe(404);
  });

  test('非本人知识体返回 403', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ userId: 'other-user' })
    );

    const res = await request(app)
      .post('/api/knowledge-growth/bodies/body-1/generate')
      .send({ nodeId: 'node-1', mode: 'full' });

    expect(res.status).toBe(403);
  });

  test('生成服务抛出许可错误返回 403', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(makeBody());
    interestConstrainedGeneration.generate.mockRejectedValue(
      new Error('No implicit permission granted')
    );

    const res = await request(app)
      .post('/api/knowledge-growth/bodies/body-1/generate')
      .send({ nodeId: 'node-1', mode: 'full' });

    expect(res.status).toBe(403);
  });
});

// ============================================
// POST /api/knowledge-growth/bodies/:id/export
// ============================================

describe('POST /api/knowledge-growth/bodies/:id/export', () => {
  test('首次导出创建新文档', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ exportedDocId: null })
    );
    knowledgeGrowthService.exportToDocument.mockResolvedValue({
      id: 'doc-new',
      title: '测试主题',
    });

    const res = await request(app)
      .post('/api/knowledge-growth/bodies/body-1/export');

    expect(res.status).toBe(200);
    expect(res.body.data.documentId).toBe('doc-new');
    expect(res.body.data.isUpdate).toBe(false);
    expect(knowledgeGrowthService.exportToDocument).toHaveBeenCalledWith('body-1');
  });

  test('已导出过则更新文档', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ exportedDocId: 'doc-existing' })
    );
    knowledgeGrowthService.updateExportedDocument.mockResolvedValue({
      id: 'doc-existing',
      title: '测试主题',
    });

    const res = await request(app)
      .post('/api/knowledge-growth/bodies/body-1/export');

    expect(res.status).toBe(200);
    expect(res.body.data.documentId).toBe('doc-existing');
    expect(res.body.data.isUpdate).toBe(true);
    expect(knowledgeGrowthService.updateExportedDocument).toHaveBeenCalledWith('body-1');
  });

  test('知识体不存在返回 404', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/knowledge-growth/bodies/nonexistent/export');

    expect(res.status).toBe(404);
  });

  test('导出失败返回 500', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ exportedDocId: null })
    );
    knowledgeGrowthService.exportToDocument.mockRejectedValue(
      new Error('Document creation failed')
    );

    const res = await request(app)
      .post('/api/knowledge-growth/bodies/body-1/export');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});


// ============================================
// GET /api/knowledge-growth/fragments
// ============================================

describe('GET /api/knowledge-growth/fragments', () => {
  test('返回当前用户的碎片列表', async () => {
    const fragments = [
      {
        id: 'f1',
        fragmentType: 'note_create',
        content: '测试内容',
        sourceId: 'src-1',
        sourceMeta: '{"tags":["tag1"]}',
        createdAt: new Date('2024-01-01'),
      },
    ];
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue(fragments);
    mockPrisma.cognitiveFragment.count.mockResolvedValue(1);

    const res = await request(app).get('/api/knowledge-growth/fragments');

    expect(res.status).toBe(200);
    expect(res.body.data.fragments).toHaveLength(1);
    expect(res.body.data.fragments[0].sourceMeta).toEqual({ tags: ['tag1'] });
    expect(res.body.data.total).toBe(1);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(20);
  });

  test('支持按 fragmentType 筛选', async () => {
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([]);
    mockPrisma.cognitiveFragment.count.mockResolvedValue(0);

    await request(app).get('/api/knowledge-growth/fragments?fragmentType=search_query');

    expect(mockPrisma.cognitiveFragment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ fragmentType: 'search_query' }),
      })
    );
  });

  test('支持按时间范围筛选', async () => {
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([]);
    mockPrisma.cognitiveFragment.count.mockResolvedValue(0);

    await request(app).get(
      '/api/knowledge-growth/fragments?startDate=2024-01-01&endDate=2024-12-31'
    );

    expect(mockPrisma.cognitiveFragment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: expect.any(Date),
            lte: expect.any(Date),
          },
        }),
      })
    );
  });

  test('支持分页', async () => {
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([]);
    mockPrisma.cognitiveFragment.count.mockResolvedValue(50);

    const res = await request(app).get('/api/knowledge-growth/fragments?page=2&limit=10');

    expect(res.body.data.page).toBe(2);
    expect(res.body.data.limit).toBe(10);
    expect(mockPrisma.cognitiveFragment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
  });

  test('sourceMeta 为 null 时正确处理', async () => {
    mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
      {
        id: 'f1',
        fragmentType: 'doc_view',
        content: '查看文档',
        sourceId: 'src-1',
        sourceMeta: null,
        createdAt: new Date(),
      },
    ]);
    mockPrisma.cognitiveFragment.count.mockResolvedValue(1);

    const res = await request(app).get('/api/knowledge-growth/fragments');

    expect(res.body.data.fragments[0].sourceMeta).toBeNull();
  });
});

// ============================================
// POST /api/knowledge-growth/discover
// ============================================

describe('POST /api/knowledge-growth/discover', () => {
  test('成功触发主题发现，返回完整 DiscoverResult 结构', async () => {
    themeDiscoveryEngine.discover.mockResolvedValue({
      status: 'completed',
      themesFound: 2,
      fragmentsScanned: 15,
      triggeredBy: 'manual',
      logId: 'log-123',
    });

    const res = await request(app).post('/api/knowledge-growth/discover');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.themesFound).toBe(2);
    expect(res.body.data.fragmentsScanned).toBe(15);
    expect(res.body.data.triggeredBy).toBe('manual');
    expect(res.body.data.logId).toBe('log-123');
    expect(themeDiscoveryEngine.discover).toHaveBeenCalledWith('manual');
  });

  test('无新碎片时返回 skipped 状态', async () => {
    themeDiscoveryEngine.discover.mockResolvedValue({
      status: 'skipped',
      fragmentsScanned: 0,
      triggeredBy: 'manual',
      logId: 'log-skip-1',
      reason: '无新碎片，跳过',
    });

    const res = await request(app).post('/api/knowledge-growth/discover');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('skipped');
    expect(res.body.data.reason).toBe('无新碎片，跳过');
    expect(res.body.data.fragmentsScanned).toBe(0);
    expect(res.body.data.logId).toBe('log-skip-1');
  });

  test('发现引擎内部失败时返回 failed 状态', async () => {
    themeDiscoveryEngine.discover.mockResolvedValue({
      status: 'failed',
      triggeredBy: 'manual',
      logId: 'log-fail-1',
      reason: 'LLM 主题分析失败',
    });

    const res = await request(app).post('/api/knowledge-growth/discover');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('failed');
    expect(res.body.data.reason).toBe('LLM 主题分析失败');
    expect(res.body.data.logId).toBe('log-fail-1');
  });

  test('已有任务执行中时返回 409 rejected', async () => {
    themeDiscoveryEngine.discover.mockResolvedValue({
      status: 'rejected',
      reason: 'Discovery is already running',
      triggeredBy: 'manual',
    });

    const res = await request(app).post('/api/knowledge-growth/discover');

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.data.status).toBe('rejected');
    expect(res.body.data.reason).toBe('Discovery is already running');
  });

  test('发现引擎抛出异常返回 500', async () => {
    themeDiscoveryEngine.discover.mockRejectedValue(new Error('Engine error'));

    const res = await request(app).post('/api/knowledge-growth/discover');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});

// ============================================
// DELETE /api/knowledge-growth/bodies/:id
// ============================================

describe('DELETE /api/knowledge-growth/bodies/:id', () => {
  test('删除 intent 知识体时，子知识体 parentId 设为 null', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ id: 'intent-1', bodyType: 'intent' })
    );
    mockPrisma.knowledgeBody.updateMany.mockResolvedValue({ count: 2 });
    mockPrisma.knowledgeBodyNode.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.themeEvolutionLog.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.knowledgeBody.delete.mockResolvedValue({});

    const res = await request(app).delete('/api/knowledge-growth/bodies/intent-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('intent-1');

    // Verify children were unlinked
    expect(mockPrisma.knowledgeBody.updateMany).toHaveBeenCalledWith({
      where: { parentId: 'intent-1' },
      data: { parentId: null },
    });

    // Verify the body was deleted
    expect(mockPrisma.knowledgeBody.delete).toHaveBeenCalledWith({
      where: { id: 'intent-1' },
    });
  });

  test('删除 topic 知识体时，不执行 updateMany 解除父子关系', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ id: 'topic-1', bodyType: 'topic' })
    );
    mockPrisma.knowledgeBodyNode.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.themeEvolutionLog.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.knowledgeBody.delete.mockResolvedValue({});

    const res = await request(app).delete('/api/knowledge-growth/bodies/topic-1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Should NOT call updateMany for topic bodies
    expect(mockPrisma.knowledgeBody.updateMany).not.toHaveBeenCalled();
  });

  test('知识体不存在返回 404', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(null);

    const res = await request(app).delete('/api/knowledge-growth/bodies/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('非本人知识体返回 403', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ userId: 'other-user' })
    );

    const res = await request(app).delete('/api/knowledge-growth/bodies/body-1');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('事务失败返回 500', async () => {
    mockPrisma.knowledgeBody.findUnique.mockResolvedValue(
      makeBody({ id: 'body-1', bodyType: 'intent' })
    );
    mockPrisma.$transaction.mockRejectedValue(new Error('Transaction failed'));

    const res = await request(app).delete('/api/knowledge-growth/bodies/body-1');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
