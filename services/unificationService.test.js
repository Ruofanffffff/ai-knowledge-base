// Mock Prisma Client before requiring the service
const mockTx = {
  unifiedRelation: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue({ id: 'unified-rel-id' }),
  },
  unifiedEntity: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn(),
  },
  unifiedPrinciple: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue({ id: 'unified-prin-id' }),
  },
  unificationLog: {
    create: jest.fn().mockResolvedValue({ id: 'log-id' }),
    update: jest.fn().mockResolvedValue({ id: 'log-id' }),
  },
};

const mockPrisma = {
  $transaction: jest.fn((fn) => fn(mockTx)),
  docEntity: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  docRelation: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  docPrinciple: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  unificationLog: {
    create: jest.fn().mockResolvedValue({ id: 'log-id' }),
    update: jest.fn().mockResolvedValue({ id: 'log-id' }),
    findFirst: jest.fn().mockResolvedValue(null),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Mock llmClient before requiring the service
jest.mock('./llmClient', () => ({
  call: jest.fn(),
  callJSON: jest.fn(),
}));

const {
  truncateEntity,
  truncateRelation,
  filterValidRelations,
} = require('./unificationService');

const llmClient = require('./llmClient');
const unificationService = require('./unificationService');

describe('unificationService', () => {
  afterEach(() => {
    jest.clearAllMocks();
    llmClient.callJSON.mockReset();
    mockTx.unifiedEntity.create.mockReset();
    mockTx.unifiedRelation.create.mockReset().mockResolvedValue({ id: 'unified-rel-id' });
    mockTx.unifiedPrinciple.create.mockReset().mockResolvedValue({ id: 'unified-prin-id' });
    mockTx.unifiedEntity.deleteMany.mockReset().mockResolvedValue({ count: 0 });
    mockTx.unifiedRelation.deleteMany.mockReset().mockResolvedValue({ count: 0 });
    mockTx.unifiedPrinciple.deleteMany.mockReset().mockResolvedValue({ count: 0 });
    mockTx.unificationLog.create.mockReset().mockResolvedValue({ id: 'log-id' });
    mockTx.unificationLog.update.mockReset().mockResolvedValue({ id: 'log-id' });
    mockPrisma.$transaction.mockReset().mockImplementation((fn) => fn(mockTx));
    mockPrisma.docEntity.findMany.mockReset().mockResolvedValue([]);
    mockPrisma.docRelation.findMany.mockReset().mockResolvedValue([]);
    mockPrisma.docPrinciple.findMany.mockReset().mockResolvedValue([]);
    mockPrisma.unificationLog.create.mockReset().mockResolvedValue({ id: 'log-id' });
    mockPrisma.unificationLog.update.mockReset().mockResolvedValue({ id: 'log-id' });
    mockPrisma.unificationLog.findFirst.mockReset().mockResolvedValue(null);
  });

  describe('truncateEntity', () => {
    it('returns unchanged values when within limits', () => {
      expect(truncateEntity('实体名', '这是描述')).toEqual({
        name: '实体名',
        description: '这是描述',
      });
    });

    it('truncates name to 6 characters', () => {
      expect(truncateEntity('一二三四五六七八', '描述')).toEqual({
        name: '一二三四五六',
        description: '描述',
      });
    });

    it('truncates description to 20 characters', () => {
      const longDesc = '一二三四五六七八九十一二三四五六七八九十额外';
      expect(truncateEntity('名', longDesc)).toEqual({
        name: '名',
        description: '一二三四五六七八九十一二三四五六七八九十',
      });
    });

    it('handles non-string inputs gracefully', () => {
      expect(truncateEntity(null, undefined)).toEqual({
        name: '',
        description: '',
      });
    });
  });

  describe('truncateRelation', () => {
    it('returns unchanged values when within limits', () => {
      expect(truncateRelation('属于', '描述信息')).toEqual({
        name: '属于',
        description: '描述信息',
      });
    });

    it('truncates name to 4 characters', () => {
      expect(truncateRelation('一二三四五六', '描述')).toEqual({
        name: '一二三四',
        description: '描述',
      });
    });

    it('truncates description to 20 characters', () => {
      const longDesc = '一二三四五六七八九十一二三四五六七八九十额外';
      expect(truncateRelation('名', longDesc)).toEqual({
        name: '名',
        description: '一二三四五六七八九十一二三四五六七八九十',
      });
    });

    it('handles non-string inputs gracefully', () => {
      expect(truncateRelation(123, null)).toEqual({
        name: '',
        description: '',
      });
    });
  });

  describe('filterValidRelations', () => {
    it('keeps relations where both source and target exist', () => {
      const relations = [
        { source: 'A', target: 'B', name: '关系', description: '描述' },
      ];
      expect(filterValidRelations(relations, ['A', 'B'])).toEqual(relations);
    });

    it('removes relations with missing source', () => {
      const relations = [
        { source: 'X', target: 'B', name: '关系', description: '描述' },
      ];
      expect(filterValidRelations(relations, ['A', 'B'])).toEqual([]);
    });

    it('removes relations with missing target', () => {
      const relations = [
        { source: 'A', target: 'X', name: '关系', description: '描述' },
      ];
      expect(filterValidRelations(relations, ['A', 'B'])).toEqual([]);
    });

    it('returns empty array when no relations are valid', () => {
      const relations = [
        { source: 'X', target: 'Y', name: '关系', description: '描述' },
      ];
      expect(filterValidRelations(relations, ['A', 'B'])).toEqual([]);
    });

    it('returns empty array for empty input', () => {
      expect(filterValidRelations([], ['A'])).toEqual([]);
    });
  });

  describe('loadAllDocGraphData', () => {
    it('fetches all DocEntity, DocRelation, and DocPrinciple records', async () => {
      const mockDocEntities = [
        { id: 'e1', docId: 'doc1', cleanedName: '实体A', description: '描述A', entityType: 'concept', source: 'fact' },
        { id: 'e2', docId: 'doc2', cleanedName: '实体B', description: '描述B', entityType: 'tool', source: 'inferred' },
      ];
      const mockDocRelations = [
        {
          id: 'r1',
          docId: 'doc1',
          cleanedName: '关系1',
          description: '关系描述1',
          layer: 'how',
          source: 'fact',
          sourceEntity: { cleanedName: '实体A' },
          targetEntity: { cleanedName: '实体B' },
        },
      ];
      const mockDocPrinciples = [
        { id: 'p1', docId: 'doc1', name: '原则A', description: '原则描述A', relatedEntityIds: '["e1"]', source: 'pattern' },
      ];

      mockPrisma.docEntity.findMany.mockResolvedValue(mockDocEntities);
      mockPrisma.docRelation.findMany.mockResolvedValue(mockDocRelations);
      mockPrisma.docPrinciple.findMany.mockResolvedValue(mockDocPrinciples);

      const result = await unificationService.loadAllDocGraphData();

      expect(mockPrisma.docEntity.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrisma.docRelation.findMany).toHaveBeenCalledWith({
        include: {
          sourceEntity: true,
          targetEntity: true,
        },
      });
      expect(mockPrisma.docPrinciple.findMany).toHaveBeenCalledTimes(1);

      expect(result.entities).toHaveLength(2);
      expect(result.entities[0]).toEqual({
        id: 'e1',
        docId: 'doc1',
        name: '实体A',
        description: '描述A',
        entityType: 'concept',
        source: 'fact',
      });

      expect(result.relations).toHaveLength(1);
      expect(result.relations[0]).toEqual({
        id: 'r1',
        docId: 'doc1',
        source: '实体A',
        target: '实体B',
        name: '关系1',
        description: '关系描述1',
        layer: 'how',
        source_tag: 'fact',
      });

      expect(result.principles).toHaveLength(1);
      expect(result.principles[0]).toEqual({
        id: 'p1',
        docId: 'doc1',
        name: '原则A',
        description: '原则描述A',
        relatedEntityIds: '["e1"]',
        source: 'pattern',
      });
    });

    it('returns empty arrays when no data exists', async () => {
      mockPrisma.docEntity.findMany.mockResolvedValue([]);
      mockPrisma.docRelation.findMany.mockResolvedValue([]);
      mockPrisma.docPrinciple.findMany.mockResolvedValue([]);

      const result = await unificationService.loadAllDocGraphData();

      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.principles).toEqual([]);
    });
  });

  describe('unifyWithLLM', () => {
    const allDocEntities = [
      { id: 'e1', docId: 'doc1', name: '垂直拍摄', description: '从上方拍摄' },
      { id: 'e2', docId: 'doc2', name: '光圈控制', description: '调整光圈大小' },
    ];
    const allDocRelations = [
      { id: 'r1', docId: 'doc1', source: '垂直拍摄', target: '光圈控制', name: '需要', description: '拍摄需要光圈' },
    ];

    it('calls LLM to unify entities, relations, and principles', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([
          { name: '拍摄手法', description: '涵盖各种拍摄技巧', entityType: 'process', source: 'fact', sourceEntityIds: ['e1', 'e2'] },
        ])
        .mockResolvedValueOnce([
          { source: '拍摄手法', target: '拍摄手法', name: '包含', description: '技巧包含关系', layer: 'how', source_tag: 'fact', sourceRelationIds: ['r1'] },
        ])
        .mockResolvedValueOnce([]); // principles LLM call (no doc principles provided)

      const result = await unificationService.unifyWithLLM(allDocEntities, allDocRelations);

      expect(llmClient.callJSON).toHaveBeenCalledTimes(2); // entity + relation (no principles call when empty)

      // Check entity unification prompt
      const entityPrompt = llmClient.callJSON.mock.calls[0][0];
      expect(entityPrompt).toContain('语义归纳合并');
      expect(entityPrompt).toContain('垂直拍摄');
      expect(entityPrompt).toContain('光圈控制');
      expect(entityPrompt).toContain('entityType');
      expect(entityPrompt).toContain('source');

      // Check relation unification prompt
      const relationPrompt = llmClient.callJSON.mock.calls[1][0];
      expect(relationPrompt).toContain('统一实体列表');
      expect(relationPrompt).toContain('拍摄手法');
      expect(relationPrompt).toContain('layer');
      expect(relationPrompt).toContain('source_tag');

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('拍摄手法');
      expect(result.entities[0].entityType).toBe('process');
      expect(result.entities[0].source).toBe('fact');
      expect(result.entities[0].sourceDocEntityIds).toEqual(['e1', 'e2']);

      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].name).toBe('包含');
      expect(result.relations[0].layer).toBe('how');
      expect(result.relations[0].source_tag).toBe('fact');
      expect(result.relations[0].sourceDocRelationIds).toEqual(['r1']);

      expect(result.principles).toEqual([]);
    });

    it('truncates entity names and descriptions', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([
          { name: '一二三四五六七八', description: '一二三四五六七八九十一二三四五六七八九十额外', sourceEntityIds: [] },
        ])
        .mockResolvedValueOnce([]);

      const result = await unificationService.unifyWithLLM(allDocEntities, allDocRelations);

      expect(result.entities[0].name).toBe('一二三四五六');
      expect(result.entities[0].description).toBe('一二三四五六七八九十一二三四五六七八九十');
    });

    it('truncates relation names and descriptions', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([
          { name: '实体A', description: '描述', sourceEntityIds: [] },
        ])
        .mockResolvedValueOnce([
          {
            source: '实体A',
            target: '实体A',
            name: '一二三四五六',
            description: '一二三四五六七八九十一二三四五六七八九十额外',
            sourceRelationIds: [],
          },
        ]);

      const result = await unificationService.unifyWithLLM(allDocEntities, allDocRelations);

      expect(result.relations[0].name).toBe('一二三四');
      expect(result.relations[0].description).toBe('一二三四五六七八九十一二三四五六七八九十');
    });

    it('defaults entityType and source when invalid', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([
          { name: '实体A', description: '描述', entityType: 'invalid', source: 'unknown', sourceEntityIds: [] },
        ])
        .mockResolvedValueOnce([]);

      const result = await unificationService.unifyWithLLM(allDocEntities, allDocRelations);

      expect(result.entities[0].entityType).toBe('concept');
      expect(result.entities[0].source).toBe('fact');
    });

    it('defaults layer and source_tag when invalid', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([
          { name: '实体A', description: '描述', sourceEntityIds: [] },
        ])
        .mockResolvedValueOnce([
          { source: '实体A', target: '实体A', name: '关系', description: '描述', layer: 'invalid', source_tag: 'unknown', sourceRelationIds: [] },
        ]);

      const result = await unificationService.unifyWithLLM(allDocEntities, allDocRelations);

      expect(result.relations[0].layer).toBe('how');
      expect(result.relations[0].source_tag).toBe('fact');
    });

    it('filters out relations with invalid source or target', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([
          { name: '实体A', description: '描述', sourceEntityIds: [] },
        ])
        .mockResolvedValueOnce([
          { source: '实体A', target: '实体A', name: '有效', description: '有效关系', sourceRelationIds: [] },
          { source: '不存在', target: '实体A', name: '无效', description: '无效源', sourceRelationIds: [] },
          { source: '实体A', target: '不存在', name: '无效', description: '无效目标', sourceRelationIds: [] },
        ]);

      const result = await unificationService.unifyWithLLM(allDocEntities, allDocRelations);

      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].name).toBe('有效');
    });

    it('handles empty sourceEntityIds and sourceRelationIds', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([
          { name: '实体A', description: '描述' }, // missing sourceEntityIds
        ])
        .mockResolvedValueOnce([
          { source: '实体A', target: '实体A', name: '关系', description: '描述' }, // missing sourceRelationIds
        ]);

      const result = await unificationService.unifyWithLLM(allDocEntities, allDocRelations);

      expect(result.entities[0].sourceDocEntityIds).toEqual([]);
      expect(result.relations[0].sourceDocRelationIds).toEqual([]);
    });

    it('filters out entities with empty name or description', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([
          { name: '', description: '描述', sourceEntityIds: [] },
          { name: '实体A', description: '', sourceEntityIds: [] },
          { name: '实体B', description: '有效描述', sourceEntityIds: [] },
        ])
        .mockResolvedValueOnce([]);

      const result = await unificationService.unifyWithLLM(allDocEntities, allDocRelations);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('实体B');
    });

    it('returns empty arrays when LLM returns non-array', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce('not an array')
        .mockResolvedValueOnce(null);

      const result = await unificationService.unifyWithLLM(allDocEntities, allDocRelations);

      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.principles).toEqual([]);
    });

    it('uses correct temperature and maxTokens', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await unificationService.unifyWithLLM(allDocEntities, allDocRelations);

      expect(llmClient.callJSON.mock.calls[0][1]).toEqual({ temperature: 0.3, maxTokens: 4000 });
      expect(llmClient.callJSON.mock.calls[1][1]).toEqual({ temperature: 0.3, maxTokens: 4000 });
    });

    it('unifies principles when provided', async () => {
      const allDocPrinciples = [
        { id: 'p1', docId: 'doc1', name: '原则A', description: '原则描述A', source: 'pattern' },
      ];

      llmClient.callJSON
        .mockResolvedValueOnce([
          { name: '拍摄手法', description: '涵盖各种技巧', sourceEntityIds: ['e1'] },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { name: '统一原则', description: '归纳后的原则', source: 'pattern', sourcePrincipleIds: ['p1'] },
        ]);

      const result = await unificationService.unifyWithLLM(allDocEntities, allDocRelations, allDocPrinciples);

      expect(llmClient.callJSON).toHaveBeenCalledTimes(3);
      expect(result.principles).toHaveLength(1);
      expect(result.principles[0].name).toBe('统一原则');
      expect(result.principles[0].source).toBe('pattern');
      expect(result.principles[0].sourceDocPrincipleIds).toEqual(['p1']);
    });
  });

  describe('saveUnifiedGraph', () => {
    const triggeredBy = 'manual';

    beforeEach(() => {
      let entityCounter = 0;
      mockTx.unifiedEntity.create.mockImplementation(({ data }) => {
        entityCounter++;
        return Promise.resolve({ id: `unified-entity-${entityCounter}`, ...data });
      });
    });

    it('deletes all existing unified entities, relations, and principles', async () => {
      await unificationService.saveUnifiedGraph([], [], [], triggeredBy);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.unifiedRelation.deleteMany).toHaveBeenCalledWith({});
      expect(mockTx.unifiedEntity.deleteMany).toHaveBeenCalledWith({});
      expect(mockTx.unifiedPrinciple.deleteMany).toHaveBeenCalledWith({});
    });

    it('creates unified entities with correct fields including entityType and source', async () => {
      const entities = [
        { name: '拍摄手法', description: '涵盖各种技巧', entityType: 'process', source: 'fact', sourceDocEntityIds: ['e1', 'e2'] },
      ];

      await unificationService.saveUnifiedGraph(entities, [], [], triggeredBy);

      expect(mockTx.unifiedEntity.create).toHaveBeenCalledWith({
        data: {
          cleanedName: '拍摄手法',
          description: '涵盖各种技巧',
          entityType: 'process',
          source: 'fact',
          sourceDocEntityIds: JSON.stringify(['e1', 'e2']),
        },
      });
    });

    it('creates unified relations with correct entity ID references and layer/source', async () => {
      const entities = [
        { name: '实体A', description: '描述A', entityType: 'concept', source: 'fact', sourceDocEntityIds: [] },
        { name: '实体B', description: '描述B', entityType: 'tool', source: 'inferred', sourceDocEntityIds: [] },
      ];
      const relations = [
        { source: '实体A', target: '实体B', name: '关系', description: '关系描述', layer: 'why', source_tag: 'inferred', sourceDocRelationIds: ['r1'] },
      ];

      await unificationService.saveUnifiedGraph(entities, relations, [], triggeredBy);

      expect(mockTx.unifiedRelation.create).toHaveBeenCalledWith({
        data: {
          cleanedName: '关系',
          description: '关系描述',
          layer: 'why',
          source: 'inferred',
          sourceEntityId: 'unified-entity-1',
          targetEntityId: 'unified-entity-2',
          sourceDocRelationIds: JSON.stringify(['r1']),
        },
      });
    });

    it('creates unified principles', async () => {
      const principles = [
        { name: '原则A', description: '原则描述', source: 'pattern', sourceDocPrincipleIds: ['p1'] },
      ];

      await unificationService.saveUnifiedGraph([], [], principles, triggeredBy);

      expect(mockTx.unifiedPrinciple.create).toHaveBeenCalledWith({
        data: {
          name: '原则A',
          description: '原则描述',
          source: 'pattern',
          sourceDocPrincipleIds: JSON.stringify(['p1']),
        },
      });
    });

    it('skips relations where source entity is not found', async () => {
      const entities = [{ name: '实体A', description: '描述A', sourceDocEntityIds: [] }];
      const relations = [
        { source: '不存在', target: '实体A', name: '无效', description: '无效关系', sourceDocRelationIds: [] },
      ];

      await unificationService.saveUnifiedGraph(entities, relations, [], triggeredBy);

      expect(mockTx.unifiedRelation.create).not.toHaveBeenCalled();
    });

    it('skips relations where target entity is not found', async () => {
      const entities = [{ name: '实体A', description: '描述A', sourceDocEntityIds: [] }];
      const relations = [
        { source: '实体A', target: '不存在', name: '无效', description: '无效关系', sourceDocRelationIds: [] },
      ];

      await unificationService.saveUnifiedGraph(entities, relations, [], triggeredBy);

      expect(mockTx.unifiedRelation.create).not.toHaveBeenCalled();
    });

    it('creates UnificationLog with completed status and principleCount', async () => {
      const entities = [{ name: '实体A', description: '描述', sourceDocEntityIds: [] }];
      const relations = [{ source: '实体A', target: '实体A', name: '关系', description: '描述', sourceDocRelationIds: [] }];
      const principles = [{ name: '原则', description: '描述', source: 'pattern', sourceDocPrincipleIds: [] }];

      await unificationService.saveUnifiedGraph(entities, relations, principles, triggeredBy);

      expect(mockTx.unificationLog.create).toHaveBeenCalledWith({
        data: {
          status: 'completed',
          entityCount: 1,
          relationCount: 1,
          principleCount: 1,
          triggeredBy,
          completedAt: expect.any(Date),
        },
      });
    });

    it('handles empty entities, relations, and principles', async () => {
      await unificationService.saveUnifiedGraph([], [], [], triggeredBy);

      expect(mockTx.unifiedEntity.create).not.toHaveBeenCalled();
      expect(mockTx.unifiedRelation.create).not.toHaveBeenCalled();
      expect(mockTx.unifiedPrinciple.create).not.toHaveBeenCalled();
      expect(mockTx.unificationLog.create).toHaveBeenCalledWith({
        data: {
          status: 'completed',
          entityCount: 0,
          relationCount: 0,
          principleCount: 0,
          triggeredBy,
          completedAt: expect.any(Date),
        },
      });
    });
  });

  describe('runUnification', () => {
    const triggeredBy = 'scheduler';

    beforeEach(() => {
      let entityCounter = 0;
      mockTx.unifiedEntity.create.mockImplementation(() => {
        entityCounter++;
        return Promise.resolve({ id: `unified-entity-${entityCounter}` });
      });
    });

    it('creates initial log with running status', async () => {
      mockPrisma.docEntity.findMany.mockResolvedValue([]);
      mockPrisma.docRelation.findMany.mockResolvedValue([]);

      await unificationService.runUnification(triggeredBy);

      expect(mockPrisma.unificationLog.create).toHaveBeenCalledWith({
        data: {
          status: 'running',
          triggeredBy,
        },
      });
    });

    it('returns zero counts when no doc entities exist', async () => {
      mockPrisma.docEntity.findMany.mockResolvedValue([]);
      mockPrisma.docRelation.findMany.mockResolvedValue([]);
      mockPrisma.docPrinciple.findMany.mockResolvedValue([]);
      mockPrisma.unificationLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrisma.unificationLog.update.mockResolvedValue({ id: 'log-1' });

      const result = await unificationService.runUnification(triggeredBy);

      expect(result).toEqual({ entityCount: 0, relationCount: 0, principleCount: 0 });
      expect(mockPrisma.unificationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          status: 'completed',
          entityCount: 0,
          relationCount: 0,
          principleCount: 0,
          completedAt: expect.any(Date),
        },
      });
    });

    it('executes full unification pipeline when data exists', async () => {
      const mockDocEntities = [
        { id: 'e1', docId: 'doc1', cleanedName: '实体A', description: '描述A', entityType: 'concept', source: 'fact' },
      ];
      const mockDocRelations = [
        {
          id: 'r1',
          docId: 'doc1',
          cleanedName: '关系',
          description: '关系描述',
          layer: 'how',
          source: 'fact',
          sourceEntity: { cleanedName: '实体A' },
          targetEntity: { cleanedName: '实体A' },
        },
      ];

      mockPrisma.docEntity.findMany.mockResolvedValue(mockDocEntities);
      mockPrisma.docRelation.findMany.mockResolvedValue(mockDocRelations);
      mockPrisma.docPrinciple.findMany.mockResolvedValue([]);
      mockPrisma.unificationLog.create.mockResolvedValue({ id: 'log-1' });

      llmClient.callJSON
        .mockResolvedValueOnce([
          { name: '统一实体', description: '统一描述', entityType: 'concept', source: 'fact', sourceEntityIds: ['e1'] },
        ])
        .mockResolvedValueOnce([
          { source: '统一实体', target: '统一实体', name: '统一关系', description: '统一关系描述', layer: 'how', source_tag: 'fact', sourceRelationIds: ['r1'] },
        ]);

      const result = await unificationService.runUnification(triggeredBy);

      expect(mockPrisma.docEntity.findMany).toHaveBeenCalled();
      expect(mockPrisma.docRelation.findMany).toHaveBeenCalled();
      expect(mockPrisma.docPrinciple.findMany).toHaveBeenCalled();
      expect(llmClient.callJSON).toHaveBeenCalledTimes(2);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      expect(result.entityCount).toBe(1);
      expect(result.relationCount).toBe(1);
      expect(result.principleCount).toBe(0);
    });

    it('updates log to failed status on error', async () => {
      mockPrisma.unificationLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrisma.docEntity.findMany.mockRejectedValue(new Error('DB connection failed'));

      await expect(unificationService.runUnification(triggeredBy)).rejects.toThrow('DB connection failed');

      expect(mockPrisma.unificationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          status: 'failed',
          error: 'DB connection failed',
          completedAt: expect.any(Date),
        },
      });
    });

    it('propagates LLM errors', async () => {
      mockPrisma.unificationLog.create.mockResolvedValue({ id: 'log-1' });
      mockPrisma.docEntity.findMany.mockResolvedValue([{ id: 'e1', cleanedName: '实体', description: '描述', entityType: 'concept', source: 'fact' }]);
      mockPrisma.docRelation.findMany.mockResolvedValue([]);
      mockPrisma.docPrinciple.findMany.mockResolvedValue([]);
      llmClient.callJSON.mockRejectedValue(new Error('Qwen API error'));

      await expect(unificationService.runUnification(triggeredBy)).rejects.toThrow('Qwen API error');

      expect(mockPrisma.unificationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-1' },
        data: {
          status: 'failed',
          error: 'Qwen API error',
          completedAt: expect.any(Date),
        },
      });
    });
  });

  describe('getLatestLog', () => {
    it('returns the most recent UnificationLog', async () => {
      const mockLog = {
        id: 'log-1',
        status: 'completed',
        entityCount: 10,
        relationCount: 15,
        triggeredBy: 'scheduler',
        startedAt: new Date('2024-01-01T00:00:00Z'),
        completedAt: new Date('2024-01-01T00:05:00Z'),
      };

      mockPrisma.unificationLog.findFirst.mockResolvedValue(mockLog);

      const result = await unificationService.getLatestLog();

      expect(mockPrisma.unificationLog.findFirst).toHaveBeenCalledWith({
        orderBy: {
          startedAt: 'desc',
        },
      });
      expect(result).toEqual(mockLog);
    });

    it('returns null when no logs exist', async () => {
      mockPrisma.unificationLog.findFirst.mockResolvedValue(null);

      const result = await unificationService.getLatestLog();

      expect(result).toBeNull();
    });
  });
});
