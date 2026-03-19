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

describe('RAGService - overview intent for documents/files', () => {
  beforeEach(() => {
    jest.resetModules();
    mockPrisma = {
      document: {
        findMany: jest.fn()
      },
      attachment: {
        findMany: jest.fn()
      }
    };
  });

  it('should list recent documents when user asks "有哪些文件" without 最近', async () => {
    const ragService = require('../ragService');

    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.attachment.findMany.mockResolvedValue([]);

    ragService.fetchRecentUserDbDocuments = jest.fn().mockResolvedValue([
      {
        id: '101',
        title: '摄影技巧文档',
        content: '这是关于摄影的内容',
        updatedAt: '2026-03-02T00:00:00.000Z'
      },
      {
        id: '102',
        title: 'React开发指南',
        content: 'React相关内容',
        updatedAt: '2026-03-01T00:00:00.000Z'
      }
    ]);

    const result = await ragService.generateResponse('1', '我思库里有哪些文件');

    expect(result.sources.documents).toEqual(['101', '102']);
    expect(result.sources.attachments).toEqual([]);
    expect(result.sourcesDetails.documents.map(d => d.title)).toEqual(['摄影技巧文档', 'React开发指南']);
    expect(result.answer).toContain('摄影技巧文档');
    expect(result.answer).toContain('React开发指南');
  });

  it('should list recent documents and attachments when user asks "最近上传的文档有哪些"', async () => {
    const ragService = require('../ragService');

    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.attachment.findMany.mockResolvedValue([
      {
        id: 'a1',
        type: 'DOCUMENT',
        createdAt: new Date('2026-03-03T00:00:00.000Z'),
        noteId: 'n1',
        analysis: { textContent: '附件解析内容', description: null },
        note: { content: '会议纪要：项目排期', tags: '[]', updatedAt: new Date('2026-03-03T00:00:00.000Z') }
      }
    ]);

    ragService.fetchRecentUserDbDocuments = jest.fn().mockResolvedValue([
      {
        id: '201',
        title: '产品需求说明',
        content: '需求背景与范围',
        updatedAt: '2026-03-04T00:00:00.000Z'
      }
    ]);

    const result = await ragService.generateResponse('1', '最近上传的文档有哪些');

    expect(result.sources.documents).toEqual(['201']);
    expect(result.sources.attachments).toEqual(['a1']);
    expect(result.sourcesDetails.documents[0].title).toBe('产品需求说明');
    expect(result.sourcesDetails.attachments[0].id).toBe('a1');
    expect(result.answer).toContain('产品需求说明');
    expect(result.answer).toContain('DOCUMENT');
  });
});

