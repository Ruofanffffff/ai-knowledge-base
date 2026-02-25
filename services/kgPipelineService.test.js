// Mock Prisma Client before requiring the service
const mockTx = {
  cleanedRelation: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue({ id: 'rel-id' }),
  },
  cleanedEntity: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn(),
  },
  docRelation: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue({ id: 'doc-rel-id' }),
  },
  docEntity: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn(),
  },
  docPrinciple: {
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn().mockResolvedValue({ id: 'principle-id' }),
  },
};

const mockPrisma = {
  $transaction: jest.fn((fn) => fn(mockTx)),
  documentIndex: {
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  document: {
    findUnique: jest.fn(),
  },
  cleanedEntity: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  cleanedRelation: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  docEntity: {
    findMany: jest.fn().mockResolvedValue([]),
  },
  docRelation: {
    findMany: jest.fn().mockResolvedValue([]),
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
  pipelineStatus,
  VALID_ENTITY_TYPES,
  VALID_SOURCE_TAGS,
  VALID_LAYERS,
  WEAK_RELATION_NAMES,
  truncateEntityFourLayer,
  truncateRelationFourLayer,
  truncatePrinciple,
  validateAndCleanFourLayerResult,
} = require('./kgPipelineService');

const llmClient = require('./llmClient');
const kgPipelineService = require('./kgPipelineService');

describe('kgPipelineService', () => {
  afterEach(() => {
    jest.clearAllMocks();
    pipelineStatus.clear();
    // Reset mockTx create to default
    mockTx.cleanedEntity.create.mockReset();
    mockTx.cleanedRelation.create.mockReset().mockResolvedValue({ id: 'rel-id' });
    mockTx.cleanedEntity.deleteMany.mockReset().mockResolvedValue({ count: 0 });
    mockTx.cleanedRelation.deleteMany.mockReset().mockResolvedValue({ count: 0 });
    mockTx.docEntity.create.mockReset();
    mockTx.docRelation.create.mockReset().mockResolvedValue({ id: 'doc-rel-id' });
    mockTx.docEntity.deleteMany.mockReset().mockResolvedValue({ count: 0 });
    mockTx.docRelation.deleteMany.mockReset().mockResolvedValue({ count: 0 });
    mockTx.docPrinciple.create.mockReset().mockResolvedValue({ id: 'principle-id' });
    mockTx.docPrinciple.deleteMany.mockReset().mockResolvedValue({ count: 0 });
    mockPrisma.$transaction.mockReset().mockImplementation((fn) => fn(mockTx));
    mockPrisma.documentIndex.findFirst.mockReset();
    mockPrisma.documentIndex.create.mockReset();
    mockPrisma.documentIndex.update.mockReset();
    mockPrisma.document.findUnique.mockReset();
    mockPrisma.cleanedEntity.findMany.mockReset().mockResolvedValue([]);
    mockPrisma.cleanedRelation.findMany.mockReset().mockResolvedValue([]);
    mockPrisma.docEntity.findMany.mockReset().mockResolvedValue([]);
    mockPrisma.docRelation.findMany.mockReset().mockResolvedValue([]);
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

  describe('generateIndex', () => {
    it('calls llmClient.call with correct prompt and returns trimmed result', async () => {
      llmClient.call.mockResolvedValue('  压缩后的索引文本  ');

      const result = await kgPipelineService.generateIndex('文档内容');

      expect(result).toBe('压缩后的索引文本');
      expect(llmClient.call).toHaveBeenCalledTimes(1);

      const prompt = llmClient.call.mock.calls[0][0];
      expect(prompt).toContain('文档压缩专家');
      expect(prompt).toContain('文档内容');
    });

    it('includes docContent in the prompt', async () => {
      llmClient.call.mockResolvedValue('索引');

      await kgPipelineService.generateIndex('这是一篇关于AI的文章');

      const prompt = llmClient.call.mock.calls[0][0];
      expect(prompt).toContain('这是一篇关于AI的文章');
    });

    it('uses low temperature for deterministic output', async () => {
      llmClient.call.mockResolvedValue('索引');

      await kgPipelineService.generateIndex('内容');

      const options = llmClient.call.mock.calls[0][1];
      expect(options.temperature).toBeLessThanOrEqual(0.5);
    });

    it('propagates LLM errors', async () => {
      llmClient.call.mockRejectedValue(new Error('Qwen API error: 500'));

      await expect(kgPipelineService.generateIndex('内容')).rejects.toThrow(
        'Qwen API error: 500'
      );
    });
  });

  describe('extractEntities', () => {
    it('calls llmClient.callJSON with correct prompt containing indexText', async () => {
      llmClient.callJSON.mockResolvedValue([
        { name: '实体A', description: '描述A' },
      ]);

      await kgPipelineService.extractEntities('测试索引文本');

      expect(llmClient.callJSON).toHaveBeenCalledTimes(1);
      const prompt = llmClient.callJSON.mock.calls[0][0];
      expect(prompt).toContain('测试索引文本');
      expect(prompt).toContain('提取所有重要实体');
      expect(prompt).toContain('JSON数组格式');
    });

    it('uses temperature 0.3', async () => {
      llmClient.callJSON.mockResolvedValue([]);

      await kgPipelineService.extractEntities('文本');

      const options = llmClient.callJSON.mock.calls[0][1];
      expect(options.temperature).toBe(0.3);
    });

    it('truncates entity names and descriptions', async () => {
      llmClient.callJSON.mockResolvedValue([
        { name: '一二三四五六七八', description: '一二三四五六七八九十一二三四五六七八九十额外文字' },
      ]);

      const result = await kgPipelineService.extractEntities('文本');

      expect(result).toEqual([
        { name: '一二三四五六', description: '一二三四五六七八九十一二三四五六七八九十' },
      ]);
    });

    it('returns empty array when callJSON returns non-array', async () => {
      llmClient.callJSON.mockResolvedValue({ name: '实体', description: '描述' });

      const result = await kgPipelineService.extractEntities('文本');

      expect(result).toEqual([]);
    });

    it('returns empty array when callJSON returns null', async () => {
      llmClient.callJSON.mockResolvedValue(null);

      const result = await kgPipelineService.extractEntities('文本');

      expect(result).toEqual([]);
    });

    it('propagates LLM errors', async () => {
      llmClient.callJSON.mockRejectedValue(new Error('Qwen API error'));

      await expect(kgPipelineService.extractEntities('文本')).rejects.toThrow('Qwen API error');
    });
  });

  describe('extractRelations', () => {
    const entities = [
      { name: '实体A', description: '描述A' },
      { name: '实体B', description: '描述B' },
    ];

    it('calls llmClient.callJSON with prompt containing entity names and indexText', async () => {
      llmClient.callJSON.mockResolvedValue([
        { source: '实体A', target: '实体B', name: '属于', description: '关系描述' },
      ]);

      await kgPipelineService.extractRelations('测试索引文本', entities);

      expect(llmClient.callJSON).toHaveBeenCalledTimes(1);
      const prompt = llmClient.callJSON.mock.calls[0][0];
      expect(prompt).toContain('测试索引文本');
      expect(prompt).toContain('实体A');
      expect(prompt).toContain('实体B');
      expect(prompt).toContain('提取实体之间的关系');
      expect(prompt).toContain('JSON数组格式');
    });

    it('uses temperature 0.3', async () => {
      llmClient.callJSON.mockResolvedValue([]);

      await kgPipelineService.extractRelations('文本', entities);

      const options = llmClient.callJSON.mock.calls[0][1];
      expect(options.temperature).toBe(0.3);
    });

    it('truncates relation names and descriptions', async () => {
      llmClient.callJSON.mockResolvedValue([
        {
          source: '实体A',
          target: '实体B',
          name: '一二三四五六',
          description: '一二三四五六七八九十一二三四五六七八九十额外文字',
        },
      ]);

      const result = await kgPipelineService.extractRelations('文本', entities);

      expect(result).toEqual([
        {
          source: '实体A',
          target: '实体B',
          name: '一二三四',
          description: '一二三四五六七八九十一二三四五六七八九十',
        },
      ]);
    });

    it('filters out relations with invalid source or target', async () => {
      llmClient.callJSON.mockResolvedValue([
        { source: '实体A', target: '实体B', name: '属于', description: '有效' },
        { source: '不存在', target: '实体B', name: '无效', description: '无效源' },
        { source: '实体A', target: '不存在', name: '无效', description: '无效目标' },
      ]);

      const result = await kgPipelineService.extractRelations('文本', entities);

      expect(result).toHaveLength(1);
      expect(result[0].source).toBe('实体A');
      expect(result[0].target).toBe('实体B');
    });

    it('returns empty array when callJSON returns non-array', async () => {
      llmClient.callJSON.mockResolvedValue({ source: 'A', target: 'B' });

      const result = await kgPipelineService.extractRelations('文本', entities);

      expect(result).toEqual([]);
    });

    it('returns empty array when callJSON returns null', async () => {
      llmClient.callJSON.mockResolvedValue(null);

      const result = await kgPipelineService.extractRelations('文本', entities);

      expect(result).toEqual([]);
    });

    it('propagates LLM errors', async () => {
      llmClient.callJSON.mockRejectedValue(new Error('Qwen API error'));

      await expect(kgPipelineService.extractRelations('文本', entities)).rejects.toThrow('Qwen API error');
    });
  });

  describe('mergeIncremental', () => {
    const docId = 'test-doc-123';
    const newEntities = [
      { name: '实体C', description: '新描述C' },
    ];
    const newRelations = [
      { source: '实体A', target: '实体C', name: '关联', description: '新关系' },
    ];

    beforeEach(() => {
      // Mock existing DocEntity records for the document
      mockPrisma.docEntity.findMany.mockResolvedValue([
        { cleanedName: '实体A', description: '已有描述A' },
        { cleanedName: '实体B', description: '已有描述B' },
      ]);
      
      // Mock existing DocRelation records for the document
      mockPrisma.docRelation.findMany.mockResolvedValue([
        {
          cleanedName: '属于',
          description: '已有关系',
          source: { cleanedName: '实体A' },
          target: { cleanedName: '实体B' },
        },
      ]);
    });

    it('fetches existing entities and relations for the specific docId only', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([{ name: '实体A', description: '更新A' }])
        .mockResolvedValueOnce([]);

      await kgPipelineService.mergeIncremental(newEntities, newRelations, docId);

      expect(mockPrisma.docEntity.findMany).toHaveBeenCalledWith({ where: { docId } });
      expect(mockPrisma.docRelation.findMany).toHaveBeenCalledWith({
        where: { docId },
        include: { source: true, target: true },
      });
    });

    it('builds entity merge prompt with existing and new entities as JSON', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([{ name: '实体A', description: '更新A' }])
        .mockResolvedValueOnce([]);

      await kgPipelineService.mergeIncremental(newEntities, newRelations, docId);

      const entityPrompt = llmClient.callJSON.mock.calls[0][0];
      expect(entityPrompt).toContain('新提取的实体与已有实体进行合并');
      expect(entityPrompt).toContain('"name":"实体A"');
      expect(entityPrompt).toContain('"name":"实体B"');
      expect(entityPrompt).toContain('"name":"实体C"');
    });

    it('builds relation merge prompt with merged entity names and relations', async () => {
      const mergedEntities = [
        { name: '实体A', description: '更新A' },
        { name: '实体B', description: '已有描述B' },
        { name: '实体C', description: '新描述C' },
      ];
      llmClient.callJSON
        .mockResolvedValueOnce(mergedEntities)
        .mockResolvedValueOnce([]);

      await kgPipelineService.mergeIncremental(newEntities, newRelations, docId);

      const relationPrompt = llmClient.callJSON.mock.calls[1][0];
      expect(relationPrompt).toContain('新提取的关系与已有关系进行合并');
      expect(relationPrompt).toContain(JSON.stringify(['实体A', '实体B', '实体C']));
    });

    it('applies truncation to merged entities', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([
          { name: '一二三四五六七八', description: '一二三四五六七八九十一二三四五六七八九十额外' },
        ])
        .mockResolvedValueOnce([]);

      const result = await kgPipelineService.mergeIncremental(newEntities, newRelations, docId);

      expect(result.entities[0].name).toBe('一二三四五六');
      expect(result.entities[0].description).toBe('一二三四五六七八九十一二三四五六七八九十');
    });

    it('applies truncation to merged relations', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([{ name: '实体A', description: '描述' }])
        .mockResolvedValueOnce([
          { source: '实体A', target: '实体A', name: '一二三四五六', description: '一二三四五六七八九十一二三四五六七八九十额外' },
        ]);

      const result = await kgPipelineService.mergeIncremental(newEntities, newRelations, docId);

      expect(result.relations[0].name).toBe('一二三四');
      expect(result.relations[0].description).toBe('一二三四五六七八九十一二三四五六七八九十');
    });

    it('filters out relations referencing entities not in merged list', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([{ name: '实体A', description: '描述A' }])
        .mockResolvedValueOnce([
          { source: '实体A', target: '实体A', name: '自引', description: '有效' },
          { source: '实体A', target: '不存在', name: '无效', description: '无效目标' },
          { source: '不存在', target: '实体A', name: '无效', description: '无效源' },
        ]);

      const result = await kgPipelineService.mergeIncremental(newEntities, newRelations, docId);

      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].name).toBe('自引');
    });

    it('returns empty entities when LLM returns non-array for entities', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce('not an array')
        .mockResolvedValueOnce([]);

      const result = await kgPipelineService.mergeIncremental(newEntities, newRelations, docId);

      expect(result.entities).toEqual([]);
    });

    it('returns empty relations when LLM returns non-array for relations', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([{ name: '实体A', description: '描述' }])
        .mockResolvedValueOnce(null);

      const result = await kgPipelineService.mergeIncremental(newEntities, newRelations, docId);

      expect(result.relations).toEqual([]);
    });

    it('uses temperature 0.3 for both LLM calls', async () => {
      llmClient.callJSON
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      await kgPipelineService.mergeIncremental(newEntities, newRelations, docId);

      expect(llmClient.callJSON.mock.calls[0][1].temperature).toBe(0.3);
      expect(llmClient.callJSON.mock.calls[1][1].temperature).toBe(0.3);
    });

    it('propagates LLM errors', async () => {
      llmClient.callJSON.mockRejectedValue(new Error('Qwen API error'));

      await expect(
        kgPipelineService.mergeIncremental(newEntities, newRelations, docId)
      ).rejects.toThrow('Qwen API error');
    });

    it('handles empty existing entities and relations', async () => {
      mockPrisma.docEntity.findMany.mockResolvedValue([]);
      mockPrisma.docRelation.findMany.mockResolvedValue([]);

      llmClient.callJSON
        .mockResolvedValueOnce([{ name: '实体C', description: '新描述C' }])
        .mockResolvedValueOnce([]);

      const result = await kgPipelineService.mergeIncremental(newEntities, newRelations, docId);

      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('实体C');
    });
  });

  describe('persistToDatabase', () => {
    const docId = 'doc-123';

    beforeEach(() => {
      let entityCounter = 0;
      mockTx.docEntity.create.mockImplementation(({ data }) => {
        entityCounter++;
        return Promise.resolve({ id: `entity-${entityCounter}`, ...data });
      });
      
      // Mock documentIndex for lastPipelineAt update
      mockTx.documentIndex = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'index-1',
          docId,
          metadata: JSON.stringify({}),
        }),
        update: jest.fn().mockResolvedValue({}),
      };
    });

    it('deletes existing relations, entities, and principles inside a transaction', async () => {
      await kgPipelineService.persistToDatabase({ entities: [], relations: [], principles: [] }, docId);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockTx.docRelation.deleteMany).toHaveBeenCalledWith({ where: { docId } });
      expect(mockTx.docEntity.deleteMany).toHaveBeenCalledWith({ where: { docId } });
      expect(mockTx.docPrinciple.deleteMany).toHaveBeenCalledWith({ where: { docId } });
    });

    it('creates entities with correct fields including entityType and source', async () => {
      const entities = [
        { name: '实体A', definition: '描述A', type: 'concept', source: 'fact' },
        { name: '实体B', definition: '描述B', type: 'process', source: 'inferred' },
      ];

      await kgPipelineService.persistToDatabase({ entities, relations: [], principles: [] }, docId);

      expect(mockTx.docEntity.create).toHaveBeenCalledTimes(2);
      expect(mockTx.docEntity.create).toHaveBeenCalledWith({
        data: {
          docId,
          cleanedName: '实体A',
          description: '描述A',
          entityType: 'concept',
          source: 'fact',
        },
      });
      expect(mockTx.docEntity.create).toHaveBeenCalledWith({
        data: {
          docId,
          cleanedName: '实体B',
          description: '描述B',
          entityType: 'process',
          source: 'inferred',
        },
      });
    });

    it('creates relations with correct entity ID references including layer and source', async () => {
      const entities = [
        { name: '实体A', definition: '描述A', type: 'concept', source: 'fact' },
        { name: '实体B', definition: '描述B', type: 'concept', source: 'fact' },
      ];
      const relations = [
        { source: '实体A', target: '实体B', name: '属于', description: '关系描述', layer: 'how', source_tag: 'fact' },
      ];

      await kgPipelineService.persistToDatabase({ entities, relations, principles: [] }, docId);

      expect(mockTx.docRelation.create).toHaveBeenCalledTimes(1);
      expect(mockTx.docRelation.create).toHaveBeenCalledWith({
        data: {
          docId,
          cleanedName: '属于',
          description: '关系描述',
          sourceEntityId: 'entity-1',
          targetEntityId: 'entity-2',
          layer: 'how',
          source: 'fact',
        },
      });
    });

    it('skips relations where source entity is not found', async () => {
      const entities = [{ name: '实体A', definition: '描述A', type: 'concept', source: 'fact' }];
      const relations = [
        { source: '不存在', target: '实体A', name: '无效', description: '无效关系', layer: 'how', source_tag: 'fact' },
      ];

      await kgPipelineService.persistToDatabase({ entities, relations, principles: [] }, docId);

      expect(mockTx.docRelation.create).not.toHaveBeenCalled();
    });

    it('skips relations where target entity is not found', async () => {
      const entities = [{ name: '实体A', definition: '描述A', type: 'concept', source: 'fact' }];
      const relations = [
        { source: '实体A', target: '不存在', name: '无效', description: '无效关系', layer: 'how', source_tag: 'fact' },
      ];

      await kgPipelineService.persistToDatabase({ entities, relations, principles: [] }, docId);

      expect(mockTx.docRelation.create).not.toHaveBeenCalled();
    });

    it('rolls back on transaction error', async () => {
      mockPrisma.$transaction.mockRejectedValue(new Error('DB write failed'));

      await expect(
        kgPipelineService.persistToDatabase({ entities: [], relations: [], principles: [] }, docId)
      ).rejects.toThrow('DB write failed');
    });

    it('handles empty entities, relations, and principles', async () => {
      await kgPipelineService.persistToDatabase({ entities: [], relations: [], principles: [] }, docId);

      expect(mockTx.docEntity.create).not.toHaveBeenCalled();
      expect(mockTx.docRelation.create).not.toHaveBeenCalled();
    });

    it('updates DocumentIndex metadata with lastPipelineAt timestamp', async () => {
      await kgPipelineService.persistToDatabase({ entities: [], relations: [], principles: [] }, docId);

      expect(mockTx.documentIndex.findFirst).toHaveBeenCalledWith({ where: { docId } });
      expect(mockTx.documentIndex.update).toHaveBeenCalledWith({
        where: { id: 'index-1' },
        data: { metadata: expect.stringContaining('lastPipelineAt') },
      });
    });
  });

  describe('saveIndex', () => {
    const docId = 'doc-123';
    const indexText = '压缩后的索引文本';
    const metadata = { llm_model: 'qwen-turbo', token_count: 150 };

    it('creates a new DocumentIndex record when none exists', async () => {
      mockPrisma.documentIndex.findFirst.mockResolvedValue(null);
      mockPrisma.documentIndex.create.mockResolvedValue({ id: 'idx-1', docId, indexedText: indexText, metadata: JSON.stringify(metadata), version: 1 });

      await kgPipelineService.saveIndex(docId, indexText, metadata);

      expect(mockPrisma.documentIndex.findFirst).toHaveBeenCalledWith({ where: { docId } });
      expect(mockPrisma.documentIndex.create).toHaveBeenCalledWith({
        data: {
          docId,
          indexedText: indexText,
          metadata: JSON.stringify(metadata),
        },
      });
      expect(mockPrisma.documentIndex.update).not.toHaveBeenCalled();
    });

    it('updates existing DocumentIndex record when one exists', async () => {
      const existing = { id: 'idx-existing', docId, version: 2 };
      mockPrisma.documentIndex.findFirst.mockResolvedValue(existing);
      mockPrisma.documentIndex.update.mockResolvedValue({ ...existing, indexedText: indexText, version: 3 });

      await kgPipelineService.saveIndex(docId, indexText, metadata);

      expect(mockPrisma.documentIndex.update).toHaveBeenCalledWith({
        where: { id: 'idx-existing' },
        data: {
          indexedText: indexText,
          metadata: JSON.stringify(metadata),
          version: 3,
        },
      });
      expect(mockPrisma.documentIndex.create).not.toHaveBeenCalled();
    });

    it('stringifies the metadata object before saving', async () => {
      mockPrisma.documentIndex.findFirst.mockResolvedValue(null);
      mockPrisma.documentIndex.create.mockResolvedValue({ id: 'idx-1' });

      await kgPipelineService.saveIndex(docId, indexText, { llm_model: 'qwen-plus', token_count: 300, extra: true });

      const savedData = mockPrisma.documentIndex.create.mock.calls[0][0].data;
      const parsed = JSON.parse(savedData.metadata);
      expect(parsed).toEqual({ llm_model: 'qwen-plus', token_count: 300, extra: true });
    });

    it('increments version on update', async () => {
      const existing = { id: 'idx-1', docId, version: 5 };
      mockPrisma.documentIndex.findFirst.mockResolvedValue(existing);
      mockPrisma.documentIndex.update.mockResolvedValue({ ...existing, version: 6 });

      await kgPipelineService.saveIndex(docId, indexText, metadata);

      const updateData = mockPrisma.documentIndex.update.mock.calls[0][0].data;
      expect(updateData.version).toBe(6);
    });

    it('propagates database errors', async () => {
      mockPrisma.documentIndex.findFirst.mockRejectedValue(new Error('DB connection failed'));

      await expect(kgPipelineService.saveIndex(docId, indexText, metadata)).rejects.toThrow('DB connection failed');
    });
  });

  describe('runPipeline', () => {
    const docId = 'doc-pipeline-1';
    const mockDoc = { id: docId, content: '这是一篇测试文档内容', title: '测试文档' };

    function setupSuccessfulPipeline() {
      mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
      // generateIndex → llmClient.call
      llmClient.call.mockResolvedValue('压缩索引文本');
      // saveIndex
      mockPrisma.documentIndex.findFirst.mockResolvedValue(null);
      mockPrisma.documentIndex.create.mockResolvedValue({ id: 'idx-1' });
      // extractEntities → llmClient.callJSON (1st call)
      // extractRelations → llmClient.callJSON (2nd call)
      // mergeIncremental → llmClient.callJSON (3rd entity, 4th relation)
      llmClient.callJSON
        .mockResolvedValueOnce([{ name: '实体A', description: '描述A' }]) // extractEntities
        .mockResolvedValueOnce([{ source: '实体A', target: '实体A', name: '自引', description: '自引关系' }]) // extractRelations
        .mockResolvedValueOnce([{ name: '实体A', description: '合并描述A' }]) // mergeIncremental entities
        .mockResolvedValueOnce([{ source: '实体A', target: '实体A', name: '自引', description: '合并关系' }]); // mergeIncremental relations
      // existing entities/relations for merge
      mockPrisma.docEntity.findMany.mockResolvedValue([]);
      mockPrisma.docRelation.findMany.mockResolvedValue([]);
      // persistToDatabase
      let entityCounter = 0;
      mockTx.docEntity.create.mockImplementation(() => {
        entityCounter++;
        return Promise.resolve({ id: `entity-${entityCounter}` });
      });
      // Mock documentIndex for lastPipelineAt update in persistToDatabase
      mockTx.documentIndex = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'idx-1',
          docId,
          metadata: JSON.stringify({}),
        }),
        update: jest.fn().mockResolvedValue({}),
      };
    }

    it('calls all pipeline steps in correct order', async () => {
      setupSuccessfulPipeline();

      await kgPipelineService.runPipeline(docId);

      // 1. Read document
      expect(mockPrisma.document.findUnique).toHaveBeenCalledWith({ where: { id: docId } });
      // 2. generateIndex (llmClient.call)
      expect(llmClient.call).toHaveBeenCalledTimes(1);
      const indexPrompt = llmClient.call.mock.calls[0][0];
      expect(indexPrompt).toContain('这是一篇测试文档内容');
      // 3. saveIndex
      expect(mockPrisma.documentIndex.findFirst).toHaveBeenCalled();
      expect(mockPrisma.documentIndex.create).toHaveBeenCalled();
      // 4. extractEntities (1st callJSON)
      expect(llmClient.callJSON).toHaveBeenCalledTimes(4);
      // 5. Read existing entities/relations for merge
      expect(mockPrisma.docEntity.findMany).toHaveBeenCalled();
      expect(mockPrisma.docRelation.findMany).toHaveBeenCalledWith({ 
        where: { docId },
        include: { source: true, target: true } 
      });
      // 6. persistToDatabase (transaction)
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('returns result with docId, entityCount, and relationCount', async () => {
      setupSuccessfulPipeline();

      const result = await kgPipelineService.runPipeline(docId);

      expect(result).toEqual({
        docId,
        entityCount: 1,
        relationCount: 1,
      });
    });

    it('updates status through all pipeline stages on success', async () => {
      setupSuccessfulPipeline();

      await kgPipelineService.runPipeline(docId);

      const status = pipelineStatus.get(docId);
      expect(status.status).toBe('completed');
      expect(status.docId).toBe(docId);
      expect(status.entityCount).toBe(1);
      expect(status.relationCount).toBe(1);
      expect(status.completedAt).toBeInstanceOf(Date);
      expect(status.error).toBeNull();
    });

    it('throws error and sets status to failed when document not found', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      await expect(kgPipelineService.runPipeline(docId)).rejects.toThrow('Document not found: doc-pipeline-1');

      const status = pipelineStatus.get(docId);
      expect(status.status).toBe('failed');
      expect(status.error).toContain('Document not found');
      expect(status.completedAt).toBeInstanceOf(Date);
    });

    it('sets status to failed when generateIndex fails', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
      llmClient.call.mockRejectedValue(new Error('LLM API timeout'));

      await expect(kgPipelineService.runPipeline(docId)).rejects.toThrow('LLM API timeout');

      const status = pipelineStatus.get(docId);
      expect(status.status).toBe('failed');
      expect(status.error).toBe('LLM API timeout');
    });

    it('sets status to failed when persistToDatabase fails', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
      llmClient.call.mockResolvedValue('索引');
      mockPrisma.documentIndex.findFirst.mockResolvedValue(null);
      mockPrisma.documentIndex.create.mockResolvedValue({ id: 'idx-1' });
      llmClient.callJSON
        .mockResolvedValueOnce([{ name: '实体A', description: '描述A' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ name: '实体A', description: '描述A' }])
        .mockResolvedValueOnce([]);
      mockPrisma.cleanedEntity.findMany.mockResolvedValue([]);
      mockPrisma.cleanedRelation.findMany.mockResolvedValue([]);
      mockPrisma.$transaction.mockRejectedValue(new Error('DB write failed'));

      await expect(kgPipelineService.runPipeline(docId)).rejects.toThrow('DB write failed');

      const status = pipelineStatus.get(docId);
      expect(status.status).toBe('failed');
      expect(status.error).toBe('DB write failed');
    });

    it('reads existing entities and relations for incremental merge', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
      llmClient.call.mockResolvedValue('索引');
      mockPrisma.documentIndex.findFirst.mockResolvedValue(null);
      mockPrisma.documentIndex.create.mockResolvedValue({ id: 'idx-1' });

      const existingEntities = [
        { id: 'e1', cleanedName: '已有实体', description: '已有描述' },
      ];
      const existingRelations = [
        {
          id: 'r1',
          cleanedName: '已有关系',
          description: '已有关系描述',
          source: { cleanedName: '已有实体' },
          target: { cleanedName: '已有实体' },
        },
      ];
      mockPrisma.docEntity.findMany.mockResolvedValue(existingEntities);
      mockPrisma.docRelation.findMany.mockResolvedValue(existingRelations);

      llmClient.callJSON
        .mockResolvedValueOnce([{ name: '实体A', description: '描述A' }]) // extractEntities
        .mockResolvedValueOnce([]) // extractRelations
        .mockResolvedValueOnce([{ name: '已有实体', description: '更新描述' }]) // mergeIncremental entities
        .mockResolvedValueOnce([]); // mergeIncremental relations

      let entityCounter = 0;
      mockTx.docEntity.create.mockImplementation(() => {
        entityCounter++;
        return Promise.resolve({ id: `entity-${entityCounter}` });
      });
      
      // Mock documentIndex for lastPipelineAt update
      mockTx.documentIndex = {
        findFirst: jest.fn().mockResolvedValue({
          id: 'idx-1',
          docId,
          metadata: JSON.stringify({}),
        }),
        update: jest.fn().mockResolvedValue({}),
      };

      await kgPipelineService.runPipeline(docId);

      // Verify merge prompt includes existing entities
      const mergeEntityPrompt = llmClient.callJSON.mock.calls[2][0];
      expect(mergeEntityPrompt).toContain('已有实体');
    });
  });

  describe('getStatus', () => {
    it('returns null when no status exists for docId', () => {
      expect(kgPipelineService.getStatus('nonexistent')).toBeNull();
    });

    it('returns the current status after pipeline starts', async () => {
      mockPrisma.document.findUnique.mockResolvedValue(null);

      try {
        await kgPipelineService.runPipeline('doc-status-test');
      } catch (e) {
        // expected
      }

      const status = kgPipelineService.getStatus('doc-status-test');
      expect(status).not.toBeNull();
      expect(status.docId).toBe('doc-status-test');
      expect(status.status).toBe('failed');
    });
  });

  describe('truncateEntityFourLayer', () => {
    it('returns valid entity with all fields within limits', () => {
      const result = truncateEntityFourLayer({
        name: '知识图谱',
        type: 'concept',
        definition: '用于表示知识的图结构',
        source: 'fact',
      });
      expect(result).toEqual({
        name: '知识图谱',
        type: 'concept',
        definition: '用于表示知识的图结构',
        source: 'fact',
      });
    });

    it('truncates name to 6 characters', () => {
      const result = truncateEntityFourLayer({ name: '一二三四五六七八', type: 'tool', definition: '描述', source: 'fact' });
      expect(result.name).toBe('一二三四五六');
    });

    it('truncates definition to 30 characters', () => {
      const longDef = 'a'.repeat(50);
      const result = truncateEntityFourLayer({ name: 'test', type: 'concept', definition: longDef, source: 'fact' });
      expect(result.definition).toBe('a'.repeat(30));
    });

    it('falls back type to concept for invalid type', () => {
      const result = truncateEntityFourLayer({ name: 'test', type: 'invalid', definition: 'desc', source: 'fact' });
      expect(result.type).toBe('concept');
    });

    it('falls back source to fact for invalid source', () => {
      const result = truncateEntityFourLayer({ name: 'test', type: 'concept', definition: 'desc', source: 'unknown' });
      expect(result.source).toBe('fact');
    });

    it('handles non-string name gracefully', () => {
      const result = truncateEntityFourLayer({ name: 123, type: 'concept', definition: 'desc', source: 'fact' });
      expect(result.name).toBe('');
    });

    it('handles non-string definition gracefully', () => {
      const result = truncateEntityFourLayer({ name: 'test', type: 'concept', definition: null, source: 'fact' });
      expect(result.definition).toBe('');
    });
  });

  describe('truncateRelationFourLayer', () => {
    it('returns valid relation with all fields within limits', () => {
      const result = truncateRelationFourLayer({
        source: '实体A', target: '实体B', name: '包含', description: '结构性包含关系', layer: 'how', source_tag: 'fact',
      });
      expect(result).toEqual({
        source: '实体A', target: '实体B', name: '包含', description: '结构性包含关系', layer: 'how', source_tag: 'fact',
      });
    });

    it('truncates name to 4 characters', () => {
      const result = truncateRelationFourLayer({ source: 'A', target: 'B', name: '一二三四五', description: 'd', layer: 'how', source_tag: 'fact' });
      expect(result.name).toBe('一二三四');
    });

    it('truncates description to 20 characters', () => {
      const result = truncateRelationFourLayer({ source: 'A', target: 'B', name: 'rel', description: 'a'.repeat(30), layer: 'how', source_tag: 'fact' });
      expect(result.description).toBe('a'.repeat(20));
    });

    it('falls back layer to how for invalid layer', () => {
      const result = truncateRelationFourLayer({ source: 'A', target: 'B', name: 'rel', description: 'd', layer: 'what', source_tag: 'fact' });
      expect(result.layer).toBe('how');
    });

    it('falls back source_tag to fact for invalid source_tag', () => {
      const result = truncateRelationFourLayer({ source: 'A', target: 'B', name: 'rel', description: 'd', layer: 'why', source_tag: 'bad' });
      expect(result.source_tag).toBe('fact');
    });

    it('keeps source and target as-is', () => {
      const result = truncateRelationFourLayer({ source: 'entityA', target: 'entityB', name: 'r', description: 'd', layer: 'how', source_tag: 'fact' });
      expect(result.source).toBe('entityA');
      expect(result.target).toBe('entityB');
    });
  });

  describe('truncatePrinciple', () => {
    it('returns valid principle with all fields within limits', () => {
      const result = truncatePrinciple({
        name: '单一职责', description: '每个模块只负责一个功能', related_entities: ['模块', '功能'], source: 'pattern',
      });
      expect(result).toEqual({
        name: '单一职责', description: '每个模块只负责一个功能', related_entities: ['模块', '功能'], source: 'pattern',
      });
    });

    it('truncates name to 8 characters', () => {
      const result = truncatePrinciple({ name: '一二三四五六七八九十', description: 'd', related_entities: [], source: 'pattern' });
      expect(result.name).toBe('一二三四五六七八');
    });

    it('truncates description to 40 characters', () => {
      const result = truncatePrinciple({ name: 'test', description: 'a'.repeat(50), related_entities: [], source: 'pattern' });
      expect(result.description).toBe('a'.repeat(40));
    });

    it('falls back source to pattern for invalid source', () => {
      const result = truncatePrinciple({ name: 'test', description: 'd', related_entities: [], source: 'invalid' });
      expect(result.source).toBe('pattern');
    });

    it('defaults related_entities to empty array for non-array', () => {
      const result = truncatePrinciple({ name: 'test', description: 'd', related_entities: 'not-array', source: 'pattern' });
      expect(result.related_entities).toEqual([]);
    });
  });

  describe('validateAndCleanFourLayerResult', () => {
    it('handles null input gracefully', () => {
      const result = validateAndCleanFourLayerResult(null);
      expect(result).toEqual({ entities: [], relations: [], principles: [] });
    });

    it('handles undefined input gracefully', () => {
      const result = validateAndCleanFourLayerResult(undefined);
      expect(result).toEqual({ entities: [], relations: [], principles: [] });
    });

    it('handles non-object input gracefully', () => {
      const result = validateAndCleanFourLayerResult(42);
      expect(result).toEqual({ entities: [], relations: [], principles: [] });
    });

    it('filters out entities with empty names', () => {
      const result = validateAndCleanFourLayerResult({
        entities: [
          { name: 'valid', type: 'concept', definition: 'def', source: 'fact' },
          { name: '', type: 'concept', definition: 'def', source: 'fact' },
          { name: 123, type: 'concept', definition: 'def', source: 'fact' },
        ],
        relations: [],
        principles_or_patterns: [],
      });
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].name).toBe('valid');
    });

    it('filters out weak relation names', () => {
      const result = validateAndCleanFourLayerResult({
        entities: [
          { name: 'A', type: 'concept', definition: 'def', source: 'fact' },
          { name: 'B', type: 'concept', definition: 'def', source: 'fact' },
        ],
        relations: [
          { source: 'A', target: 'B', name: '相关', description: 'd', layer: 'how', source_tag: 'fact' },
          { source: 'A', target: 'B', name: '驱动', description: 'd', layer: 'how', source_tag: 'fact' },
          { source: 'A', target: 'B', name: '影响', description: 'd', layer: 'why', source_tag: 'fact' },
        ],
        principles_or_patterns: [],
      });
      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].name).toBe('驱动');
    });

    it('filters out relations with invalid entity references', () => {
      const result = validateAndCleanFourLayerResult({
        entities: [
          { name: 'A', type: 'concept', definition: 'def', source: 'fact' },
          { name: 'B', type: 'concept', definition: 'def', source: 'fact' },
        ],
        relations: [
          { source: 'A', target: 'B', name: '包含', description: 'd', layer: 'how', source_tag: 'fact' },
          { source: 'A', target: 'C', name: '依赖', description: 'd', layer: 'how', source_tag: 'fact' },
        ],
        principles_or_patterns: [],
      });
      expect(result.relations).toHaveLength(1);
      expect(result.relations[0].name).toBe('包含');
    });

    it('filters out principles with no valid related entities', () => {
      const result = validateAndCleanFourLayerResult({
        entities: [
          { name: 'A', type: 'concept', definition: 'def', source: 'fact' },
        ],
        relations: [],
        principles_or_patterns: [
          { name: '原则一', description: 'desc', related_entities: ['A'], source: 'pattern' },
          { name: '原则二', description: 'desc', related_entities: ['X', 'Y'], source: 'pattern' },
        ],
      });
      expect(result.principles).toHaveLength(1);
      expect(result.principles[0].name).toBe('原则一');
    });

    it('returns complete structure with valid data', () => {
      const result = validateAndCleanFourLayerResult({
        entities: [
          { name: 'A', type: 'tool', definition: 'tool A', source: 'fact' },
          { name: 'B', type: 'process', definition: 'process B', source: 'inferred' },
        ],
        relations: [
          { source: 'A', target: 'B', name: '驱动', description: 'A drives B', layer: 'why', source_tag: 'inferred' },
        ],
        principles_or_patterns: [
          { name: '解耦原则', description: '模块间低耦合', related_entities: ['A', 'B'], source: 'pattern' },
        ],
      });
      expect(result.entities).toHaveLength(2);
      expect(result.relations).toHaveLength(1);
      expect(result.principles).toHaveLength(1);
    });
  });

  describe('four-layer constants', () => {
    it('VALID_ENTITY_TYPES contains all 8 types', () => {
      expect(VALID_ENTITY_TYPES).toEqual(['concept', 'object', 'process', 'role', 'rule', 'tool', 'target', 'data']);
    });

    it('VALID_SOURCE_TAGS contains fact, inferred, pattern', () => {
      expect(VALID_SOURCE_TAGS).toEqual(['fact', 'inferred', 'pattern']);
    });

    it('VALID_LAYERS contains how and why', () => {
      expect(VALID_LAYERS).toEqual(['how', 'why']);
    });

    it('WEAK_RELATION_NAMES contains the 4 weak names', () => {
      expect(WEAK_RELATION_NAMES).toEqual(['相关', '有关', '影响', '关联']);
    });
  });
});
