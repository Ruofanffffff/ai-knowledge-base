/**
 * KnowledgeGrowthService 单元测试
 *
 * 测试成熟度判定和导出逻辑
 * 需求: 5.6, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

// Mock Prisma - must be before require
const mockPrisma = {
  knowledgeBody: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  knowledgeBodyNode: {
    findMany: jest.fn(),
  },
  document: {
    create: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const { KnowledgeGrowthService } = require('./knowledgeGrowthService');

describe('KnowledgeGrowthService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KnowledgeGrowthService();
  });

  describe('checkMatureStatus', () => {
    it('should throw when body not found', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(null);

      await expect(service.checkMatureStatus('nonexistent')).rejects.toThrow('KnowledgeBody not found');
    });

    it('should return not mature when no nodes exist', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({ id: 'body-1' });
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue([]);

      const result = await service.checkMatureStatus('body-1');

      expect(result).toEqual({ isMature: false, totalNodes: 0, filledNodes: 0 });
      expect(mockPrisma.knowledgeBody.update).not.toHaveBeenCalled();
    });

    it('should return mature and update phase when all nodes are filled or user_edited', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({ id: 'body-1' });
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue([
        { id: 'n1', status: 'filled' },
        { id: 'n2', status: 'user_edited' },
        { id: 'n3', status: 'filled' },
      ]);
      mockPrisma.knowledgeBody.update.mockResolvedValue({});

      const result = await service.checkMatureStatus('body-1');

      expect(result).toEqual({ isMature: true, totalNodes: 3, filledNodes: 3 });
      expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledWith({
        where: { id: 'body-1' },
        data: { growthPhase: 'mature' },
      });
    });

    it('should return not mature when some nodes are gap', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({ id: 'body-1' });
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue([
        { id: 'n1', status: 'filled' },
        { id: 'n2', status: 'gap' },
        { id: 'n3', status: 'user_edited' },
      ]);

      const result = await service.checkMatureStatus('body-1');

      expect(result).toEqual({ isMature: false, totalNodes: 3, filledNodes: 2 });
      expect(mockPrisma.knowledgeBody.update).not.toHaveBeenCalled();
    });

    it('should return not mature when some nodes are generated', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({ id: 'body-1' });
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue([
        { id: 'n1', status: 'filled' },
        { id: 'n2', status: 'generated' },
      ]);

      const result = await service.checkMatureStatus('body-1');

      expect(result).toEqual({ isMature: false, totalNodes: 2, filledNodes: 1 });
      expect(mockPrisma.knowledgeBody.update).not.toHaveBeenCalled();
    });

    it('should handle all filled nodes', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({ id: 'body-1' });
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue([
        { id: 'n1', status: 'filled' },
        { id: 'n2', status: 'filled' },
      ]);
      mockPrisma.knowledgeBody.update.mockResolvedValue({});

      const result = await service.checkMatureStatus('body-1');

      expect(result.isMature).toBe(true);
    });

    it('should handle all user_edited nodes', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({ id: 'body-1' });
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue([
        { id: 'n1', status: 'user_edited' },
        { id: 'n2', status: 'user_edited' },
      ]);
      mockPrisma.knowledgeBody.update.mockResolvedValue({});

      const result = await service.checkMatureStatus('body-1');

      expect(result.isMature).toBe(true);
    });
  });

  describe('exportToDocument', () => {
    const mockBody = {
      id: 'body-1',
      userId: 'user-1',
      themeName: '前端开发指南',
      exportedDocId: null,
    };

    const mockNodes = [
      { id: 'n1', parentNodeId: null, title: '基础概念', status: 'filled', content: 'HTML/CSS/JS 是前端三大基础', sortOrder: 0 },
      { id: 'n2', parentNodeId: 'n1', title: 'HTML', status: 'filled', content: 'HTML 是超文本标记语言', sortOrder: 1 },
      { id: 'n3', parentNodeId: 'n1', title: 'CSS', status: 'user_edited', content: 'CSS 用于样式控制', sortOrder: 2 },
      { id: 'n4', parentNodeId: null, title: '框架', status: 'filled', content: '现代前端框架概述', sortOrder: 3 },
    ];

    it('should throw when body not found', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(null);

      await expect(service.exportToDocument('nonexistent')).rejects.toThrow('KnowledgeBody not found');
    });

    it('should throw when body already has exported document', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        ...mockBody,
        exportedDocId: 'doc-existing',
      });

      await expect(service.exportToDocument('body-1')).rejects.toThrow('already has an exported document');
    });

    it('should create document with correct title and content', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(mockBody);
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue(mockNodes);
      const createdDoc = { id: 'doc-new', title: '前端开发指南', content: '{}' };
      mockPrisma.document.create.mockResolvedValue(createdDoc);
      mockPrisma.knowledgeBody.update.mockResolvedValue({});

      const result = await service.exportToDocument('body-1');

      expect(result).toEqual(createdDoc);

      // Verify document.create was called with correct data
      const createCall = mockPrisma.document.create.mock.calls[0][0];
      expect(createCall.data.title).toBe('前端开发指南');
      expect(createCall.data.type).toBe('document');
      expect(createCall.data.userId).toBe('user-1');

      // Verify content is valid JSON
      const content = JSON.parse(createCall.data.content);
      expect(content.type).toBe('doc');
      expect(Array.isArray(content.content)).toBe(true);
    });

    it('should record exportedDocId after successful export', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(mockBody);
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue(mockNodes);
      mockPrisma.document.create.mockResolvedValue({ id: 'doc-new' });
      mockPrisma.knowledgeBody.update.mockResolvedValue({});

      await service.exportToDocument('body-1');

      expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledWith({
        where: { id: 'body-1' },
        data: { exportedDocId: 'doc-new' },
      });
    });

    it('should preserve knowledge body data when document creation fails', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(mockBody);
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue(mockNodes);
      mockPrisma.document.create.mockRejectedValue(new Error('DB write failed'));

      await expect(service.exportToDocument('body-1')).rejects.toThrow('Failed to export document');

      // Should NOT update exportedDocId
      expect(mockPrisma.knowledgeBody.update).not.toHaveBeenCalled();
    });

    it('should assemble content in depth-first order', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(mockBody);
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue(mockNodes);
      mockPrisma.document.create.mockResolvedValue({ id: 'doc-new' });
      mockPrisma.knowledgeBody.update.mockResolvedValue({});

      await service.exportToDocument('body-1');

      const createCall = mockPrisma.document.create.mock.calls[0][0];
      const content = JSON.parse(createCall.data.content);
      const blocks = content.content;

      // First block: main title (h1)
      expect(blocks[0].type).toBe('heading');
      expect(blocks[0].attrs.level).toBe(1);
      expect(blocks[0].content[0].text).toBe('前端开发指南');

      // Second block: "基础概念" heading (h2)
      expect(blocks[1].type).toBe('heading');
      expect(blocks[1].attrs.level).toBe(2);
      expect(blocks[1].content[0].text).toBe('基础概念');

      // Third block: "基础概念" content
      expect(blocks[2].type).toBe('paragraph');
      expect(blocks[2].content[0].text).toBe('HTML/CSS/JS 是前端三大基础');

      // Fourth block: "HTML" heading (h3, child of 基础概念)
      expect(blocks[3].type).toBe('heading');
      expect(blocks[3].attrs.level).toBe(3);
      expect(blocks[3].content[0].text).toBe('HTML');

      // Fifth block: "HTML" content
      expect(blocks[4].type).toBe('paragraph');

      // Sixth block: "CSS" heading (h3, child of 基础概念)
      expect(blocks[5].type).toBe('heading');
      expect(blocks[5].attrs.level).toBe(3);
      expect(blocks[5].content[0].text).toBe('CSS');

      // Eighth block: "框架" heading (h2, root level)
      expect(blocks[7].type).toBe('heading');
      expect(blocks[7].attrs.level).toBe(2);
      expect(blocks[7].content[0].text).toBe('框架');
    });

    it('should handle nodes without content', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(mockBody);
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue([
        { id: 'n1', parentNodeId: null, title: 'Empty Node', status: 'gap', content: null, sortOrder: 0 },
      ]);
      mockPrisma.document.create.mockResolvedValue({ id: 'doc-new' });
      mockPrisma.knowledgeBody.update.mockResolvedValue({});

      await service.exportToDocument('body-1');

      const createCall = mockPrisma.document.create.mock.calls[0][0];
      const content = JSON.parse(createCall.data.content);
      const blocks = content.content;

      // Should have title heading + node heading, but no paragraph for empty content
      expect(blocks.length).toBe(2); // h1 title + h2 node title
    });

    it('should handle empty nodes list', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(mockBody);
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue([]);
      mockPrisma.document.create.mockResolvedValue({ id: 'doc-new' });
      mockPrisma.knowledgeBody.update.mockResolvedValue({});

      await service.exportToDocument('body-1');

      const createCall = mockPrisma.document.create.mock.calls[0][0];
      const content = JSON.parse(createCall.data.content);

      // Should only have the title heading
      expect(content.content.length).toBe(1);
      expect(content.content[0].content[0].text).toBe('前端开发指南');
    });
  });

  describe('updateExportedDocument', () => {
    it('should throw when body not found', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(null);

      await expect(service.updateExportedDocument('nonexistent')).rejects.toThrow('KnowledgeBody not found');
    });

    it('should throw when no exported document exists', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        exportedDocId: null,
      });

      await expect(service.updateExportedDocument('body-1')).rejects.toThrow('has no exported document');
    });

    it('should update existing document content', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        userId: 'user-1',
        themeName: '测试主题',
        exportedDocId: 'doc-existing',
      });
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue([
        { id: 'n1', parentNodeId: null, title: '节点A', status: 'filled', content: '内容A', sortOrder: 0 },
      ]);
      const updatedDoc = { id: 'doc-existing', content: '{}' };
      mockPrisma.document.update.mockResolvedValue(updatedDoc);

      const result = await service.updateExportedDocument('body-1');

      expect(result).toEqual(updatedDoc);
      expect(mockPrisma.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-existing' },
        data: { content: expect.any(String) },
      });
    });

    it('should throw when document update fails', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        userId: 'user-1',
        themeName: '测试主题',
        exportedDocId: 'doc-existing',
      });
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue([]);
      mockPrisma.document.update.mockRejectedValue(new Error('Document not found'));

      await expect(service.updateExportedDocument('body-1')).rejects.toThrow('Failed to update exported document');
    });
  });

  describe('_buildRichTextContent', () => {
    it('should produce valid TipTap JSON', () => {
      const nodes = [
        { id: 'n1', parentNodeId: null, title: 'Root', content: 'Root content', sortOrder: 0 },
      ];

      const result = service._buildRichTextContent('Test Theme', nodes);
      const parsed = JSON.parse(result);

      expect(parsed.type).toBe('doc');
      expect(Array.isArray(parsed.content)).toBe(true);
    });

    it('should include all node titles and content', () => {
      const nodes = [
        { id: 'n1', parentNodeId: null, title: 'Section A', content: 'Content A', sortOrder: 0 },
        { id: 'n2', parentNodeId: null, title: 'Section B', content: 'Content B', sortOrder: 1 },
      ];

      const result = service._buildRichTextContent('Theme', nodes);

      expect(result).toContain('Section A');
      expect(result).toContain('Content A');
      expect(result).toContain('Section B');
      expect(result).toContain('Content B');
    });

    it('should cap heading level at 6', () => {
      // Create deeply nested nodes (5 levels deep)
      const nodes = [
        { id: 'n1', parentNodeId: null, title: 'L1', content: null, sortOrder: 0 },
        { id: 'n2', parentNodeId: 'n1', title: 'L2', content: null, sortOrder: 1 },
        { id: 'n3', parentNodeId: 'n2', title: 'L3', content: null, sortOrder: 2 },
        { id: 'n4', parentNodeId: 'n3', title: 'L4', content: null, sortOrder: 3 },
        { id: 'n5', parentNodeId: 'n4', title: 'L5', content: null, sortOrder: 4 },
        { id: 'n6', parentNodeId: 'n5', title: 'L6', content: null, sortOrder: 5 },
      ];

      const result = service._buildRichTextContent('Theme', nodes);
      const parsed = JSON.parse(result);

      // Find all heading levels
      const headings = parsed.content.filter(b => b.type === 'heading');
      const levels = headings.map(h => h.attrs.level);

      // h1 for theme, h2-h6 for nodes, last node should be capped at 6
      expect(levels).toContain(1); // theme
      expect(levels).toContain(6); // deepest nodes capped at 6
      expect(Math.max(...levels)).toBe(6);
    });
  });

  describe('_buildTree', () => {
    it('should build tree from flat nodes', () => {
      const nodes = [
        { id: 'n1', parentNodeId: null, title: 'Root', sortOrder: 0 },
        { id: 'n2', parentNodeId: 'n1', title: 'Child 1', sortOrder: 1 },
        { id: 'n3', parentNodeId: 'n1', title: 'Child 2', sortOrder: 2 },
      ];

      const tree = service._buildTree(nodes);

      expect(tree.length).toBe(1);
      expect(tree[0].title).toBe('Root');
      expect(tree[0].children.length).toBe(2);
      expect(tree[0].children[0].title).toBe('Child 1');
      expect(tree[0].children[1].title).toBe('Child 2');
    });

    it('should handle multiple root nodes', () => {
      const nodes = [
        { id: 'n1', parentNodeId: null, title: 'Root 1', sortOrder: 0 },
        { id: 'n2', parentNodeId: null, title: 'Root 2', sortOrder: 1 },
      ];

      const tree = service._buildTree(nodes);

      expect(tree.length).toBe(2);
    });

    it('should handle empty nodes list', () => {
      const tree = service._buildTree([]);
      expect(tree).toEqual([]);
    });

    it('should treat orphan nodes as roots', () => {
      const nodes = [
        { id: 'n1', parentNodeId: 'nonexistent', title: 'Orphan', sortOrder: 0 },
      ];

      const tree = service._buildTree(nodes);

      expect(tree.length).toBe(1);
      expect(tree[0].title).toBe('Orphan');
    });
  });

  describe('exports', () => {
    it('should export singleton instance', () => {
      const instance = require('./knowledgeGrowthService');
      expect(instance).toBeDefined();
      expect(typeof instance.checkMatureStatus).toBe('function');
      expect(typeof instance.exportToDocument).toBe('function');
      expect(typeof instance.updateExportedDocument).toBe('function');
    });

    it('should export KnowledgeGrowthService class', () => {
      expect(KnowledgeGrowthService).toBeDefined();
    });
  });
});
