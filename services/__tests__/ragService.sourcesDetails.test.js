let mockPrisma;

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma)
}));

jest.mock('../llmClient', () => ({
  call: jest.fn()
}));

jest.mock('../memoryService', () => ({
  searchMemories: jest.fn()
}));

describe('RAGService - sourcesDetails', () => {
  beforeEach(() => {
    jest.resetModules();
    mockPrisma = {};
  });

  it('should return sourcesDetails and source-backed answer when sources hit but LLM is empty', async () => {
    const llmClient = require('../llmClient');
    const memoryService = require('../memoryService');
    const ragService = require('../ragService');

    llmClient.call.mockResolvedValue('');
    memoryService.searchMemories.mockResolvedValue([]);

    const noteUpdatedAt = new Date('2026-03-01T00:00:00.000Z');
    const docUpdatedAt = new Date('2026-03-02T00:00:00.000Z');
    const attUpdatedAt = new Date('2026-03-03T00:00:00.000Z');

    ragService.searchKnowledgeGraph = jest.fn().mockResolvedValue('');
    ragService.searchUserNotes = jest.fn().mockResolvedValue([
      {
        id: 'n1',
        title: '日本旅行计划',
        excerpt: '包含行程安排与预算要点。',
        tags: ['日本', '旅行'],
        score: 10,
        updatedAt: noteUpdatedAt
      }
    ]);
    ragService.searchUserDocuments = jest.fn().mockResolvedValue([
      {
        id: 'd1',
        title: '北海道攻略',
        excerpt: '整理了交通、住宿与拍摄点。',
        score: 9,
        updatedAt: docUpdatedAt
      }
    ]);
    ragService.searchUserAttachmentAnalyses = jest.fn().mockResolvedValue([
      {
        id: 'a1',
        type: 'IMAGE',
        noteId: 'n2',
        noteTitle: '札幌拍摄参考',
        excerpt: '图片解析：夜景与构图建议。',
        tags: ['摄影'],
        score: 8,
        updatedAt: attUpdatedAt
      }
    ]);

    const result = await ragService.generateResponse('u1', '帮我整理日本旅行的重点');

    expect(result.sources).toEqual({
      memories: [],
      notes: ['n1'],
      documents: ['d1'],
      attachments: ['a1'],
      kg_entities: []
    });

    expect(result.sourcesDetails.notes).toEqual([
      {
        id: 'n1',
        title: '日本旅行计划',
        excerpt: '包含行程安排与预算要点。',
        tags: ['日本', '旅行'],
        updatedAt: noteUpdatedAt.toISOString()
      }
    ]);
    expect(result.sourcesDetails.documents[0].id).toBe('d1');
    expect(result.sourcesDetails.documents[0].updatedAt).toBe(docUpdatedAt.toISOString());
    expect(result.sourcesDetails.attachments[0].id).toBe('a1');
    expect(result.sourcesDetails.attachments[0].updatedAt).toBe(attUpdatedAt.toISOString());

    expect(result.answer).toContain('日本旅行计划');
    expect(result.answer).not.toMatch(/未同步|没有相关内容|无相关内容|没有相关|暂时没有检索到|找不到相关/);
  });

  it('should not output negative no-source wording when sources hit but LLM says no content', async () => {
    const llmClient = require('../llmClient');
    const memoryService = require('../memoryService');
    const ragService = require('../ragService');

    llmClient.call.mockResolvedValue('没有相关内容。');
    memoryService.searchMemories.mockResolvedValue([]);

    ragService.searchKnowledgeGraph = jest.fn().mockResolvedValue('');
    ragService.searchUserNotes = jest.fn().mockResolvedValue([
      {
        id: 'n1',
        title: '旅行预算清单',
        excerpt: '机票、住宿、餐饮、交通、门票的分配建议。',
        tags: [],
        score: 10,
        updatedAt: new Date('2026-03-01T00:00:00.000Z')
      }
    ]);
    ragService.searchUserDocuments = jest.fn().mockResolvedValue([]);
    ragService.searchUserAttachmentAnalyses = jest.fn().mockResolvedValue([]);

    const result = await ragService.generateResponse('u1', '预算怎么分配更合理？');

    expect(result.sources.notes).toHaveLength(1);
    expect(result.answer).toContain('旅行预算清单');
    expect(result.answer).not.toContain('没有相关内容');
  });

  it('should return stable sourcesDetails and generic answer with explicit no-source notice when sources miss and LLM is empty', async () => {
    const llmClient = require('../llmClient');
    const memoryService = require('../memoryService');
    const ragService = require('../ragService');

    llmClient.call.mockResolvedValue('');
    memoryService.searchMemories.mockResolvedValue([]);

    ragService.searchKnowledgeGraph = jest.fn().mockResolvedValue('');
    ragService.searchUserNotes = jest.fn().mockResolvedValue([]);
    ragService.searchUserDocuments = jest.fn().mockResolvedValue([]);
    ragService.searchUserAttachmentAnalyses = jest.fn().mockResolvedValue([]);

    const result = await ragService.generateResponse('u1', '怎么更高效地学习一门新技能？');

    expect(result.sources).toEqual({
      memories: [],
      notes: [],
      documents: [],
      attachments: [],
      kg_entities: []
    });

    expect(result.sourcesDetails).toEqual({
      notes: [],
      documents: [],
      attachments: []
    });

    expect(result.answer).toContain('通用知识');
    expect(result.answer).toContain('未引用思库来源');
  });

  it('should append explicit no-source notice when sources miss but LLM returns an answer', async () => {
    const llmClient = require('../llmClient');
    const memoryService = require('../memoryService');
    const ragService = require('../ragService');

    llmClient.call.mockResolvedValue('你可以从一个小项目开始，把它拆成可执行的任务。');
    memoryService.searchMemories.mockResolvedValue([]);

    ragService.searchKnowledgeGraph = jest.fn().mockResolvedValue('');
    ragService.searchUserNotes = jest.fn().mockResolvedValue([]);
    ragService.searchUserDocuments = jest.fn().mockResolvedValue([]);
    ragService.searchUserAttachmentAnalyses = jest.fn().mockResolvedValue([]);

    const result = await ragService.generateResponse('u1', '怎么开始学习编程？');

    expect(result.answer).toContain('小项目');
    expect(result.answer).toContain('未引用思库来源');
    expect(result.answer).toContain('仅基于通用知识');
  });
});
