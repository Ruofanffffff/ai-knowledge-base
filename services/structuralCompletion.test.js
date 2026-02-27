/**
 * StructuralCompletion 单元测试
 */

// Mock Prisma - must be before require
const mockPrisma = {
  knowledgeBody: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  cognitiveFragment: {
    findMany: jest.fn(),
  },
  unifiedEntity: {
    findMany: jest.fn(),
  },
  unifiedRelation: {
    findMany: jest.fn(),
  },
  knowledgeBodyNode: {
    deleteMany: jest.fn(),
    create: jest.fn(),
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

const { StructuralCompletion } = require('./structuralCompletion');
const llmClient = require('./llmClient');

describe('StructuralCompletion', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StructuralCompletion();
  });

  describe('buildOutlinePrompt', () => {
    it('should include fragment contents in the prompt', () => {
      const fragments = [
        { fragmentType: 'note_create', content: '学习React Hooks' },
        { fragmentType: 'doc_edit', content: 'Redux状态管理' },
      ];

      const prompt = service.buildOutlinePrompt(fragments);

      expect(prompt).toContain('学习React Hooks');
      expect(prompt).toContain('Redux状态管理');
      expect(prompt).toContain('[note_create]');
      expect(prompt).toContain('[doc_edit]');
    });

    it('should include four-layer cognition framework', () => {
      const fragments = [{ fragmentType: 'note_create', content: 'test' }];

      const prompt = service.buildOutlinePrompt(fragments);

      expect(prompt).toContain('What');
      expect(prompt).toContain('How');
      expect(prompt).toContain('Why');
      expect(prompt).toContain('So What');
      expect(prompt).toContain('核心节点');
      expect(prompt).toContain('逻辑连接');
      expect(prompt).toContain('深度结构');
      expect(prompt).toContain('总结节点');
    });

    it('should include constraint instructions', () => {
      const fragments = [{ fragmentType: 'note_create', content: 'test' }];

      const prompt = service.buildOutlinePrompt(fragments);

      expect(prompt).toContain('仅基于用户已有碎片推断缺失结构');
      expect(prompt).toContain('禁止添加用户未涉及的主题分支');
      expect(prompt).toContain('禁止生成与用户碎片无关的发散性内容');
    });

    it('should include entity context when entities are provided', () => {
      const fragments = [{ fragmentType: 'note_create', content: 'test' }];
      const entities = [
        { cleanedName: 'React', description: '前端框架' },
        { cleanedName: 'Hooks', description: '函数组件状态管理' },
      ];

      const prompt = service.buildOutlinePrompt(fragments, entities);

      expect(prompt).toContain('React: 前端框架');
      expect(prompt).toContain('Hooks: 函数组件状态管理');
      expect(prompt).toContain('关联实体');
    });

    it('should include relation context when relations are provided', () => {
      const fragments = [{ fragmentType: 'note_create', content: 'test' }];
      const entities = [{ cleanedName: 'React', description: '前端框架' }];
      const relations = [
        { cleanedName: '使用', description: 'React使用Hooks' },
      ];

      const prompt = service.buildOutlinePrompt(fragments, entities, relations);

      expect(prompt).toContain('使用: React使用Hooks');
      expect(prompt).toContain('实体关系');
    });

    it('should not include entity section when entities array is empty', () => {
      const fragments = [{ fragmentType: 'note_create', content: 'test' }];

      const prompt = service.buildOutlinePrompt(fragments, []);

      expect(prompt).not.toContain('关联实体');
    });

    it('should not include relation section when relations array is empty', () => {
      const fragments = [{ fragmentType: 'note_create', content: 'test' }];

      const prompt = service.buildOutlinePrompt(fragments, [], []);

      expect(prompt).not.toContain('实体关系');
    });

    it('should handle undefined entities and relations', () => {
      const fragments = [{ fragmentType: 'note_create', content: 'test' }];

      const prompt = service.buildOutlinePrompt(fragments);

      expect(prompt).not.toContain('关联实体');
      expect(prompt).not.toContain('实体关系');
    });
  });

  describe('markNodeStatuses', () => {
    it('should mark nodes as filled when fragment content contains node title', () => {
      const outline = [
        { id: 'n1', title: 'React' },
        { id: 'n2', title: 'Vue' },
      ];
      const fragments = [
        { content: '学习React框架的基础知识' },
      ];

      const result = service.markNodeStatuses(outline, fragments);

      expect(result[0].status).toBe('filled');
      expect(result[1].status).toBe('gap');
    });

    it('should perform case-insensitive matching', () => {
      const outline = [{ id: 'n1', title: 'react' }];
      const fragments = [{ content: 'Learning REACT hooks' }];

      const result = service.markNodeStatuses(outline, fragments);

      expect(result[0].status).toBe('filled');
    });

    it('should recursively mark children nodes', () => {
      const outline = [
        {
          id: 'n1',
          title: 'React',
          children: [
            { id: 'n1-1', title: 'Hooks' },
            { id: 'n1-2', title: 'Context' },
          ],
        },
      ];
      const fragments = [
        { content: '学习React和Hooks的使用方法' },
      ];

      const result = service.markNodeStatuses(outline, fragments);

      expect(result[0].status).toBe('filled');
      expect(result[0].children[0].status).toBe('filled');
      expect(result[0].children[1].status).toBe('gap');
    });

    it('should return empty array for non-array input', () => {
      const result = service.markNodeStatuses(null, []);
      expect(result).toEqual([]);
    });

    it('should return empty array for undefined input', () => {
      const result = service.markNodeStatuses(undefined, []);
      expect(result).toEqual([]);
    });

    it('should handle nodes with empty title as gap', () => {
      const outline = [{ id: 'n1', title: '' }];
      const fragments = [{ content: 'some content' }];

      const result = service.markNodeStatuses(outline, fragments);

      expect(result[0].status).toBe('gap');
    });

    it('should handle fragments with empty content', () => {
      const outline = [{ id: 'n1', title: 'React' }];
      const fragments = [{ content: '' }, { content: null }];

      const result = service.markNodeStatuses(outline, fragments);

      expect(result[0].status).toBe('gap');
    });

    it('should preserve other node properties', () => {
      const outline = [{ id: 'n1', title: 'React', content: 'existing content' }];
      const fragments = [{ content: 'React basics' }];

      const result = service.markNodeStatuses(outline, fragments);

      expect(result[0].id).toBe('n1');
      expect(result[0].content).toBe('existing content');
      expect(result[0].status).toBe('filled');
    });

    it('should mark all nodes as gap when no fragments match', () => {
      const outline = [
        { id: 'n1', title: 'React' },
        { id: 'n2', title: 'Vue' },
      ];
      const fragments = [{ content: '完全无关的内容' }];

      const result = service.markNodeStatuses(outline, fragments);

      expect(result[0].status).toBe('gap');
      expect(result[1].status).toBe('gap');
    });

    it('should mark all nodes as filled when all match', () => {
      const outline = [
        { id: 'n1', title: 'React' },
        { id: 'n2', title: 'Vue' },
      ];
      const fragments = [{ content: '学习React和Vue框架' }];

      const result = service.markNodeStatuses(outline, fragments);

      expect(result[0].status).toBe('filled');
      expect(result[1].status).toBe('filled');
    });
  });

  describe('generateOutline', () => {
    it('should throw when body not found', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(null);

      await expect(service.generateOutline('nonexistent')).rejects.toThrow('KnowledgeBody not found');
    });

    it('should return empty array when no fragment IDs', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        relatedFragmentIds: '[]',
        relatedEntityIds: '[]',
      });

      const result = await service.generateOutline('body-1');

      expect(result).toEqual([]);
      expect(llmClient.callJSON).not.toHaveBeenCalled();
    });

    it('should return empty array when fragments not found in DB', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        relatedFragmentIds: '["f1", "f2"]',
        relatedEntityIds: '[]',
      });
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([]);

      const result = await service.generateOutline('body-1');

      expect(result).toEqual([]);
    });

    it('should call LLM and return marked outline', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        relatedFragmentIds: '["f1"]',
        relatedEntityIds: '[]',
      });
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
        { id: 'f1', fragmentType: 'note_create', content: 'React Hooks 学习笔记' },
      ]);
      mockPrisma.knowledgeBodyNode.deleteMany.mockResolvedValue({});
      mockPrisma.knowledgeBodyNode.create.mockResolvedValue({});

      llmClient.callJSON.mockResolvedValue([
        { id: 'node-1', title: 'React', children: [{ id: 'node-1-1', title: 'Hooks' }] },
        { id: 'node-2', title: '总结' },
      ]);

      const result = await service.generateOutline('body-1');

      expect(result).toHaveLength(2);
      expect(result[0].title).toBe('React');
      expect(result[0].status).toBe('filled'); // 'react' is in fragment content
      expect(result[0].children[0].title).toBe('Hooks');
      expect(result[0].children[0].status).toBe('filled'); // 'hooks' is in fragment content
      expect(result[1].title).toBe('总结');
      expect(result[1].status).toBe('gap');
    });

    it('should save nodes to KnowledgeBodyNode table', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        relatedFragmentIds: '["f1"]',
        relatedEntityIds: '[]',
      });
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
        { id: 'f1', fragmentType: 'note_create', content: 'test content' },
      ]);
      mockPrisma.knowledgeBodyNode.deleteMany.mockResolvedValue({});
      mockPrisma.knowledgeBodyNode.create.mockResolvedValue({});

      llmClient.callJSON.mockResolvedValue([
        { id: 'node-1', title: 'Topic A', children: [{ id: 'node-1-1', title: 'Sub A1' }] },
      ]);

      await service.generateOutline('body-1');

      // Should delete existing nodes first
      expect(mockPrisma.knowledgeBodyNode.deleteMany).toHaveBeenCalledWith({
        where: { bodyId: 'body-1' },
      });

      // Should create 2 nodes (parent + child)
      expect(mockPrisma.knowledgeBodyNode.create).toHaveBeenCalledTimes(2);

      // First node: parent
      expect(mockPrisma.knowledgeBodyNode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'node-1',
          bodyId: 'body-1',
          parentNodeId: null,
          title: 'Topic A',
          sortOrder: 0,
        }),
      });

      // Second node: child
      expect(mockPrisma.knowledgeBodyNode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: 'node-1-1',
          bodyId: 'body-1',
          parentNodeId: 'node-1',
          title: 'Sub A1',
          sortOrder: 1,
        }),
      });
    });

    it('should return empty array and not change phase when LLM fails', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        relatedFragmentIds: '["f1"]',
        relatedEntityIds: '[]',
      });
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
        { id: 'f1', fragmentType: 'note_create', content: 'test content' },
      ]);

      llmClient.callJSON.mockRejectedValue(new Error('LLM timeout'));

      const result = await service.generateOutline('body-1');

      expect(result).toEqual([]);
      // Should NOT update growthPhase
      expect(mockPrisma.knowledgeBody.update).not.toHaveBeenCalled();
      expect(mockPrisma.knowledgeBodyNode.deleteMany).not.toHaveBeenCalled();
    });

    it('should return empty array when LLM returns non-array', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        relatedFragmentIds: '["f1"]',
        relatedEntityIds: '[]',
      });
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
        { id: 'f1', fragmentType: 'note_create', content: 'test content' },
      ]);

      llmClient.callJSON.mockResolvedValue({ error: 'invalid' });

      const result = await service.generateOutline('body-1');

      expect(result).toEqual([]);
    });

    it('should fetch related entities and relations when entityIds exist', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        relatedFragmentIds: '["f1"]',
        relatedEntityIds: '["e1"]',
      });
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
        { id: 'f1', fragmentType: 'note_create', content: 'React学习' },
      ]);
      mockPrisma.unifiedEntity.findMany.mockResolvedValue([
        { id: 'e1', cleanedName: 'React', description: '前端框架' },
      ]);
      mockPrisma.unifiedRelation.findMany.mockResolvedValue([
        { cleanedName: '使用', description: 'React使用JSX' },
      ]);
      mockPrisma.knowledgeBodyNode.deleteMany.mockResolvedValue({});
      mockPrisma.knowledgeBodyNode.create.mockResolvedValue({});

      llmClient.callJSON.mockResolvedValue([
        { id: 'node-1', title: 'React基础' },
      ]);

      await service.generateOutline('body-1');

      expect(mockPrisma.unifiedEntity.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['e1'] } },
      });
      expect(mockPrisma.unifiedRelation.findMany).toHaveBeenCalled();

      // Verify prompt includes entity info
      const promptArg = llmClient.callJSON.mock.calls[0][0];
      expect(promptArg).toContain('React: 前端框架');
      expect(promptArg).toContain('使用: React使用JSX');
    });

    it('should handle entity/relation fetch failure gracefully', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        relatedFragmentIds: '["f1"]',
        relatedEntityIds: '["e1"]',
      });
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
        { id: 'f1', fragmentType: 'note_create', content: 'test' },
      ]);
      mockPrisma.unifiedEntity.findMany.mockRejectedValue(new Error('DB error'));
      mockPrisma.knowledgeBodyNode.deleteMany.mockResolvedValue({});
      mockPrisma.knowledgeBodyNode.create.mockResolvedValue({});

      llmClient.callJSON.mockResolvedValue([
        { id: 'node-1', title: 'Topic' },
      ]);

      // Should not throw, should continue without entities
      const result = await service.generateOutline('body-1');

      expect(result).toHaveLength(1);
    });

    it('should handle null relatedEntityIds', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        relatedFragmentIds: '["f1"]',
        relatedEntityIds: null,
      });
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
        { id: 'f1', fragmentType: 'note_create', content: 'test' },
      ]);
      mockPrisma.knowledgeBodyNode.deleteMany.mockResolvedValue({});
      mockPrisma.knowledgeBodyNode.create.mockResolvedValue({});

      llmClient.callJSON.mockResolvedValue([
        { id: 'node-1', title: 'Topic' },
      ]);

      const result = await service.generateOutline('body-1');

      expect(result).toHaveLength(1);
      expect(mockPrisma.unifiedEntity.findMany).not.toHaveBeenCalled();
    });

    it('should use low temperature for LLM call', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        relatedFragmentIds: '["f1"]',
        relatedEntityIds: '[]',
      });
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([
        { id: 'f1', fragmentType: 'note_create', content: 'test' },
      ]);
      mockPrisma.knowledgeBodyNode.deleteMany.mockResolvedValue({});
      mockPrisma.knowledgeBodyNode.create.mockResolvedValue({});

      llmClient.callJSON.mockResolvedValue([]);

      await service.generateOutline('body-1');

      expect(llmClient.callJSON).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ temperature: 0.3 })
      );
    });
  });

  describe('_saveOutlineNodes', () => {
    it('should flatten nested tree into sequential nodes', async () => {
      mockPrisma.knowledgeBodyNode.deleteMany.mockResolvedValue({});
      mockPrisma.knowledgeBodyNode.create.mockResolvedValue({});

      const outline = [
        {
          id: 'n1',
          title: 'Root',
          status: 'gap',
          children: [
            { id: 'n1-1', title: 'Child 1', status: 'filled' },
            {
              id: 'n1-2',
              title: 'Child 2',
              status: 'gap',
              children: [
                { id: 'n1-2-1', title: 'Grandchild', status: 'gap' },
              ],
            },
          ],
        },
      ];

      await service._saveOutlineNodes('body-1', outline);

      // Should create 4 nodes total
      expect(mockPrisma.knowledgeBodyNode.create).toHaveBeenCalledTimes(4);

      // Verify parent-child relationships
      const calls = mockPrisma.knowledgeBodyNode.create.mock.calls;
      expect(calls[0][0].data.parentNodeId).toBeNull(); // Root
      expect(calls[1][0].data.parentNodeId).toBe('n1'); // Child 1
      expect(calls[2][0].data.parentNodeId).toBe('n1'); // Child 2
      expect(calls[3][0].data.parentNodeId).toBe('n1-2'); // Grandchild
    });

    it('should assign sequential sortOrder', async () => {
      mockPrisma.knowledgeBodyNode.deleteMany.mockResolvedValue({});
      mockPrisma.knowledgeBodyNode.create.mockResolvedValue({});

      const outline = [
        { id: 'n1', title: 'A', status: 'gap' },
        { id: 'n2', title: 'B', status: 'gap' },
        { id: 'n3', title: 'C', status: 'gap' },
      ];

      await service._saveOutlineNodes('body-1', outline);

      const calls = mockPrisma.knowledgeBodyNode.create.mock.calls;
      expect(calls[0][0].data.sortOrder).toBe(0);
      expect(calls[1][0].data.sortOrder).toBe(1);
      expect(calls[2][0].data.sortOrder).toBe(2);
    });
  });

  describe('exports', () => {
    it('should export singleton instance', () => {
      const instance = require('./structuralCompletion');
      expect(instance).toBeDefined();
      expect(typeof instance.generateOutline).toBe('function');
      expect(typeof instance.buildOutlinePrompt).toBe('function');
      expect(typeof instance.markNodeStatuses).toBe('function');
    });

    it('should export StructuralCompletion class', () => {
      expect(StructuralCompletion).toBeDefined();
    });
  });
});
