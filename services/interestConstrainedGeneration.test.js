/**
 * InterestConstrainedGeneration 单元测试
 */

// Mock Prisma - must be before require
const mockPrisma = {
  knowledgeBody: {
    findUnique: jest.fn(),
  },
  knowledgeBodyNode: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  cognitiveFragment: {
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Mock LLMClient
jest.mock('./llmClient', () => ({
  call: jest.fn(),
  callJSON: jest.fn(),
}));

// Mock EmbeddingService
jest.mock('./embeddingService', () => ({
  generateEmbedding: jest.fn(),
  findSimilar: jest.fn(),
  cosineSimilarity: jest.fn(),
}));

const { InterestConstrainedGeneration, VALID_MODES, MIN_CONTENT_LENGTH, MAX_CONTENT_LENGTH } = require('./interestConstrainedGeneration');
const llmClient = require('./llmClient');
const embeddingService = require('./embeddingService');

describe('InterestConstrainedGeneration', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InterestConstrainedGeneration();
  });

  describe('validateContentLength', () => {
    it('should return true for content within valid range', () => {
      const content = 'a'.repeat(200);
      expect(service.validateContentLength(content)).toBe(true);
    });

    it('should return true for content at minimum boundary (200)', () => {
      expect(service.validateContentLength('a'.repeat(200))).toBe(true);
    });

    it('should return true for content at maximum boundary (800)', () => {
      expect(service.validateContentLength('a'.repeat(800))).toBe(true);
    });

    it('should return false for content below minimum', () => {
      expect(service.validateContentLength('a'.repeat(199))).toBe(false);
    });

    it('should return false for content above maximum', () => {
      expect(service.validateContentLength('a'.repeat(801))).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(service.validateContentLength('')).toBe(false);
    });

    it('should return false for null', () => {
      expect(service.validateContentLength(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      expect(service.validateContentLength(undefined)).toBe(false);
    });

    it('should return false for non-string', () => {
      expect(service.validateContentLength(123)).toBe(false);
    });

    it('should return true for content at 500 chars (mid-range)', () => {
      expect(service.validateContentLength('a'.repeat(500))).toBe(true);
    });
  });

  describe('buildConstrainedPrompt', () => {
    const baseParams = {
      relatedFragments: [
        { fragmentType: 'note_create', content: 'React Hooks 学习笔记' },
        { fragmentType: 'doc_edit', content: 'Redux 状态管理实践' },
      ],
      outline: [
        { id: 'n1', title: 'React基础', status: 'filled', parentNodeId: null },
        { id: 'n2', title: 'Hooks详解', status: 'gap', parentNodeId: 'n1' },
      ],
      targetNode: { id: 'n2', title: 'Hooks详解', status: 'gap', parentNodeId: 'n1', content: null },
      mode: 'full',
    };

    it('should include user interest context from fragments', () => {
      const prompt = service.buildConstrainedPrompt(baseParams);

      expect(prompt).toContain('React Hooks 学习笔记');
      expect(prompt).toContain('Redux 状态管理实践');
      expect(prompt).toContain('[note_create]');
      expect(prompt).toContain('[doc_edit]');
    });

    it('should include three constraints', () => {
      const prompt = service.buildConstrainedPrompt(baseParams);

      expect(prompt).toContain('用户历史兴趣偏好');
      expect(prompt).toContain('写作风格');
      expect(prompt).toContain('节点角色定位');
    });

    it('should include target node info', () => {
      const prompt = service.buildConstrainedPrompt(baseParams);

      expect(prompt).toContain('Hooks详解');
      expect(prompt).toContain('gap');
    });

    it('should include content length constraints', () => {
      const prompt = service.buildConstrainedPrompt(baseParams);

      expect(prompt).toContain('200');
      expect(prompt).toContain('800');
    });

    it('should include full mode instructions', () => {
      const prompt = service.buildConstrainedPrompt(baseParams);

      expect(prompt).toContain('full');
      expect(prompt).toContain('首次生成');
    });

    it('should include append mode instructions with existing content', () => {
      const params = {
        ...baseParams,
        mode: 'append',
        targetNode: { ...baseParams.targetNode, status: 'generated', content: '已有内容文本' },
      };

      const prompt = service.buildConstrainedPrompt(params);

      expect(prompt).toContain('append');
      expect(prompt).toContain('追加模式');
      expect(prompt).toContain('已有内容文本');
    });

    it('should include replace mode instructions with user-edited content', () => {
      const params = {
        ...baseParams,
        mode: 'replace',
        targetNode: { ...baseParams.targetNode, status: 'user_edited', content: '用户编辑后的内容' },
      };

      const prompt = service.buildConstrainedPrompt(params);

      expect(prompt).toContain('replace');
      expect(prompt).toContain('替换模式');
      expect(prompt).toContain('用户编辑后的内容');
    });

    it('should handle empty fragments list', () => {
      const params = { ...baseParams, relatedFragments: [] };

      const prompt = service.buildConstrainedPrompt(params);

      expect(prompt).toContain('暂无相关碎片');
    });

    it('should include style hints from fragment types', () => {
      const prompt = service.buildConstrainedPrompt(baseParams);

      expect(prompt).toContain('便签笔记');
      expect(prompt).toContain('文档编辑');
    });

    it('should include outline structure context', () => {
      const prompt = service.buildConstrainedPrompt(baseParams);

      expect(prompt).toContain('React基础');
      expect(prompt).toContain('Hooks详解');
    });
  });

  describe('generate', () => {
    const mockBody = {
      id: 'body-1',
      userId: 'user-1',
      growthPhase: 'flesh',
      relatedFragmentIds: '["f1", "f2"]',
      relatedEntityIds: '[]',
    };

    const mockNode = {
      id: 'node-1',
      bodyId: 'body-1',
      parentNodeId: null,
      title: 'React Hooks',
      status: 'gap',
      content: null,
      sortOrder: 0,
    };

    const mockFragments = [
      { id: 'f1', fragmentType: 'note_create', content: 'React Hooks 学习笔记', embedding: JSON.stringify([0.1, 0.2]) },
      { id: 'f2', fragmentType: 'doc_edit', content: 'Redux 状态管理', embedding: JSON.stringify([0.3, 0.4]) },
    ];

    const generatedText = 'a'.repeat(300); // Valid length content

    beforeEach(() => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(mockBody);
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue(mockNode);
      mockPrisma.knowledgeBodyNode.findMany.mockResolvedValue([mockNode]);
      mockPrisma.knowledgeBodyNode.update.mockResolvedValue({ ...mockNode, content: generatedText, status: 'generated' });
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue(mockFragments);
      embeddingService.generateEmbedding.mockResolvedValue([0.1, 0.2]);
      embeddingService.findSimilar.mockResolvedValue([
        { id: 'f1', similarity: 0.9 },
        { id: 'f2', similarity: 0.8 },
      ]);
      llmClient.call.mockResolvedValue(generatedText);
    });

    it('should generate content in full mode for gap node', async () => {
      const result = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'full' });

      expect(result.nodeId).toBe('node-1');
      expect(result.bodyId).toBe('body-1');
      expect(result.mode).toBe('full');
      expect(result.status).toBe('generated');
      expect(result.content).toBe(generatedText);
    });

    it('should update node status to generated', async () => {
      await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'full' });

      expect(mockPrisma.knowledgeBodyNode.update).toHaveBeenCalledWith({
        where: { id: 'node-1' },
        data: expect.objectContaining({
          status: 'generated',
          generationMode: 'full',
        }),
      });
    });

    it('should throw 400 for invalid mode', async () => {
      await expect(service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'invalid' }))
        .rejects.toThrow('Invalid mode');
    });

    it('should throw 404 when body not found', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(null);

      const error = await service.generate({ bodyId: 'nonexistent', nodeId: 'node-1', mode: 'full' }).catch(e => e);
      expect(error.message).toContain('KnowledgeBody not found');
      expect(error.statusCode).toBe(404);
    });

    it('should throw 403 when body is not in flesh phase', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({ ...mockBody, growthPhase: 'skeleton' });

      const error = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'full' }).catch(e => e);
      expect(error.message).toContain('Implicit permission denied');
      expect(error.statusCode).toBe(403);
    });

    it('should throw 403 when body is in discovery phase', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({ ...mockBody, growthPhase: 'discovery' });

      const error = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'full' }).catch(e => e);
      expect(error.statusCode).toBe(403);
    });

    it('should throw 404 when node not found', async () => {
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue(null);

      const error = await service.generate({ bodyId: 'body-1', nodeId: 'nonexistent', mode: 'full' }).catch(e => e);
      expect(error.statusCode).toBe(404);
    });

    it('should throw 400 when node does not belong to body', async () => {
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue({ ...mockNode, bodyId: 'other-body' });

      const error = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'full' }).catch(e => e);
      expect(error.statusCode).toBe(400);
    });

    it('should throw 400 for full mode on non-gap node', async () => {
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue({ ...mockNode, status: 'generated' });

      const error = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'full' }).catch(e => e);
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('Invalid node status');
    });

    it('should throw 400 for append mode on gap node', async () => {
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue({ ...mockNode, status: 'gap' });

      const error = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'append' }).catch(e => e);
      expect(error.statusCode).toBe(400);
    });

    it('should allow append mode on generated node', async () => {
      const generatedNode = { ...mockNode, status: 'generated', content: '已有内容' };
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue(generatedNode);

      const result = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'append' });

      expect(result.status).toBe('generated');
      // Append mode should prepend existing content
      expect(result.content).toContain('已有内容');
    });

    it('should allow replace mode on generated node', async () => {
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue({ ...mockNode, status: 'generated', content: 'old' });

      const result = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'replace' });

      expect(result.status).toBe('generated');
    });

    it('should allow replace mode on user_edited node', async () => {
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue({ ...mockNode, status: 'user_edited', content: 'edited' });

      const result = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'replace' });

      expect(result.status).toBe('generated');
    });

    it('should throw 400 for replace mode on gap node', async () => {
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue({ ...mockNode, status: 'gap' });

      const error = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'replace' }).catch(e => e);
      expect(error.statusCode).toBe(400);
    });

    it('should collect top 5 related fragments by semantic similarity', async () => {
      await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'full' });

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith('React Hooks');
      expect(embeddingService.findSimilar).toHaveBeenCalled();
    });

    it('should fallback to first N fragments when embedding fails', async () => {
      embeddingService.generateEmbedding.mockResolvedValue(null);

      const result = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'full' });

      expect(result.status).toBe('generated');
    });

    it('should call LLM with constrained prompt', async () => {
      await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'full' });

      expect(llmClient.call).toHaveBeenCalledWith(
        expect.stringContaining('三重约束'),
        expect.objectContaining({ temperature: 0.5 })
      );
    });

    it('should throw 500 when LLM call fails', async () => {
      llmClient.call.mockRejectedValue(new Error('LLM timeout'));

      const error = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'full' }).catch(e => e);
      expect(error.statusCode).toBe(500);
      expect(error.message).toContain('Content generation failed');
    });

    it('should truncate content exceeding max length', async () => {
      const longContent = 'a'.repeat(1000);
      llmClient.call.mockResolvedValue(longContent);

      const result = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'full' });

      expect(result.generatedContent.length).toBeLessThanOrEqual(MAX_CONTENT_LENGTH);
    });

    it('should prepend existing content in append mode', async () => {
      const existingContent = '这是已有的内容';
      const newContent = 'b'.repeat(300);
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue({
        ...mockNode,
        status: 'generated',
        content: existingContent,
      });
      llmClient.call.mockResolvedValue(newContent);

      const result = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'append' });

      expect(result.content).toMatch(new RegExp(`^${existingContent}`));
      expect(result.content).toContain(newContent);
    });

    it('should handle empty relatedFragmentIds', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({ ...mockBody, relatedFragmentIds: '[]' });

      const result = await service.generate({ bodyId: 'body-1', nodeId: 'node-1', mode: 'full' });

      expect(result.status).toBe('generated');
    });
  });

  describe('markAsUserEdited', () => {
    it('should update generated node to user_edited', async () => {
      const node = { id: 'node-1', status: 'generated', content: 'old content' };
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue(node);
      mockPrisma.knowledgeBodyNode.update.mockResolvedValue({ ...node, status: 'user_edited', content: 'new content' });

      const result = await service.markAsUserEdited('node-1', 'new content');

      expect(mockPrisma.knowledgeBodyNode.update).toHaveBeenCalledWith({
        where: { id: 'node-1' },
        data: { content: 'new content', status: 'user_edited' },
      });
      expect(result.status).toBe('user_edited');
    });

    it('should throw 404 when node not found', async () => {
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue(null);

      const error = await service.markAsUserEdited('nonexistent', 'content').catch(e => e);
      expect(error.statusCode).toBe(404);
    });

    it('should throw 400 when node is not in generated status', async () => {
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue({ id: 'node-1', status: 'gap' });

      const error = await service.markAsUserEdited('node-1', 'content').catch(e => e);
      expect(error.statusCode).toBe(400);
      expect(error.message).toContain('Cannot mark as user_edited');
    });

    it('should throw 400 when node is already user_edited', async () => {
      mockPrisma.knowledgeBodyNode.findUnique.mockResolvedValue({ id: 'node-1', status: 'user_edited' });

      const error = await service.markAsUserEdited('node-1', 'content').catch(e => e);
      expect(error.statusCode).toBe(400);
    });
  });

  describe('_validateNodeStatus', () => {
    it('should accept gap status for full mode', () => {
      expect(() => service._validateNodeStatus({ status: 'gap' }, 'full')).not.toThrow();
    });

    it('should reject generated status for full mode', () => {
      expect(() => service._validateNodeStatus({ status: 'generated' }, 'full')).toThrow();
    });

    it('should accept generated status for append mode', () => {
      expect(() => service._validateNodeStatus({ status: 'generated' }, 'append')).not.toThrow();
    });

    it('should reject gap status for append mode', () => {
      expect(() => service._validateNodeStatus({ status: 'gap' }, 'append')).toThrow();
    });

    it('should accept generated status for replace mode', () => {
      expect(() => service._validateNodeStatus({ status: 'generated' }, 'replace')).not.toThrow();
    });

    it('should accept user_edited status for replace mode', () => {
      expect(() => service._validateNodeStatus({ status: 'user_edited' }, 'replace')).not.toThrow();
    });

    it('should reject gap status for replace mode', () => {
      expect(() => service._validateNodeStatus({ status: 'gap' }, 'replace')).toThrow();
    });

    it('should reject filled status for all modes', () => {
      expect(() => service._validateNodeStatus({ status: 'filled' }, 'full')).toThrow();
      expect(() => service._validateNodeStatus({ status: 'filled' }, 'append')).toThrow();
      expect(() => service._validateNodeStatus({ status: 'filled' }, 'replace')).toThrow();
    });
  });

  describe('_truncateToSentence', () => {
    it('should return content as-is when within limit', () => {
      const content = 'Short content.';
      expect(service._truncateToSentence(content, 800)).toBe(content);
    });

    it('should truncate at sentence boundary', () => {
      // '这是一个比较长的第一句话。' is 12 chars, 。at index 11
      // maxLength=20, 50% = 10, lastPeriod=11 > 10, so it truncates at sentence
      const content = '这是一个比较长的第一句话。' + 'a'.repeat(800);
      const result = service._truncateToSentence(content, 20);

      expect(result.length).toBeLessThanOrEqual(20);
      expect(result).toMatch(/。$/);
      expect(result).toBe('这是一个比较长的第一句话。');
    });

    it('should truncate at max length when no sentence boundary found', () => {
      const content = 'a'.repeat(1000);
      const result = service._truncateToSentence(content, 800);

      expect(result.length).toBe(800);
    });
  });

  describe('exports', () => {
    it('should export singleton instance', () => {
      const instance = require('./interestConstrainedGeneration');
      expect(instance).toBeDefined();
      expect(typeof instance.generate).toBe('function');
      expect(typeof instance.buildConstrainedPrompt).toBe('function');
      expect(typeof instance.validateContentLength).toBe('function');
    });

    it('should export InterestConstrainedGeneration class', () => {
      expect(InterestConstrainedGeneration).toBeDefined();
    });

    it('should export constants', () => {
      expect(VALID_MODES).toEqual(['full', 'append', 'replace']);
      expect(MIN_CONTENT_LENGTH).toBe(200);
      expect(MAX_CONTENT_LENGTH).toBe(800);
    });
  });
});
