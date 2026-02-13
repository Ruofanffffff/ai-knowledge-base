/**
 * Test for KGPipelineService DocEntity/DocRelation persistence
 * Feature: kg-dual-layer-graph, Task 2.1
 */

const { KGPipelineService, prisma } = require('../kgPipelineService');

describe('KGPipelineService - DocGraph Persistence', () => {
  let service;

  beforeEach(() => {
    service = new KGPipelineService();
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.docRelation.deleteMany();
    await prisma.docEntity.deleteMany();
    await prisma.documentIndex.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('persistToDatabase', () => {
    it('should save entities and relations to DocEntity/DocRelation tables with docId', async () => {
      const docId = 'test-doc-001';
      const entities = [
        { name: '实体A', description: '这是实体A的描述' },
        { name: '实体B', description: '这是实体B的描述' },
      ];
      const relations = [
        { source: '实体A', target: '实体B', name: '关联', description: '实体A关联实体B' },
      ];

      await service.persistToDatabase(entities, relations, docId);

      // Verify entities were saved
      const savedEntities = await prisma.docEntity.findMany({ where: { docId } });
      expect(savedEntities).toHaveLength(2);
      expect(savedEntities.map(e => e.cleanedName)).toContain('实体A');
      expect(savedEntities.map(e => e.cleanedName)).toContain('实体B');

      // Verify relations were saved
      const savedRelations = await prisma.docRelation.findMany({ 
        where: { docId },
        include: { source: true, target: true }
      });
      expect(savedRelations).toHaveLength(1);
      expect(savedRelations[0].cleanedName).toBe('关联');
      expect(savedRelations[0].source.cleanedName).toBe('实体A');
      expect(savedRelations[0].target.cleanedName).toBe('实体B');
    });

    it('should delete existing DocEntity/DocRelation for the same docId before saving', async () => {
      const docId = 'test-doc-002';
      
      // First save
      const entities1 = [{ name: '旧实体', description: '旧描述' }];
      const relations1 = [];
      await service.persistToDatabase(entities1, relations1, docId);

      // Verify first save
      let savedEntities = await prisma.docEntity.findMany({ where: { docId } });
      expect(savedEntities).toHaveLength(1);
      expect(savedEntities[0].cleanedName).toBe('旧实体');

      // Second save with different data
      const entities2 = [{ name: '新实体', description: '新描述' }];
      const relations2 = [];
      await service.persistToDatabase(entities2, relations2, docId);

      // Verify old data was deleted and new data was saved
      savedEntities = await prisma.docEntity.findMany({ where: { docId } });
      expect(savedEntities).toHaveLength(1);
      expect(savedEntities[0].cleanedName).toBe('新实体');
      expect(savedEntities.map(e => e.cleanedName)).not.toContain('旧实体');
    });

    it('should update DocumentIndex metadata with lastPipelineAt timestamp', async () => {
      const docId = 'test-doc-003';
      
      // Create a DocumentIndex first
      await prisma.documentIndex.create({
        data: {
          docId,
          indexedText: 'Test index',
          metadata: JSON.stringify({ test: 'data' }),
        },
      });

      const beforeTime = new Date();
      
      // Save entities/relations
      const entities = [{ name: '测试', description: '测试描述' }];
      const relations = [];
      await service.persistToDatabase(entities, relations, docId);

      const afterTime = new Date();

      // Verify metadata was updated
      const updatedIndex = await prisma.documentIndex.findFirst({ where: { docId } });
      expect(updatedIndex).not.toBeNull();
      
      const metadata = JSON.parse(updatedIndex.metadata);
      expect(metadata.lastPipelineAt).toBeDefined();
      
      const lastPipelineAt = new Date(metadata.lastPipelineAt);
      expect(lastPipelineAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(lastPipelineAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });

    it('should isolate data by docId', async () => {
      const docId1 = 'test-doc-004';
      const docId2 = 'test-doc-005';

      // Save data for doc1
      const entities1 = [{ name: '文档1', description: '文档1的实体' }];
      await service.persistToDatabase(entities1, [], docId1);

      // Save data for doc2
      const entities2 = [{ name: '文档2', description: '文档2的实体' }];
      await service.persistToDatabase(entities2, [], docId2);

      // Verify isolation
      const doc1Entities = await prisma.docEntity.findMany({ where: { docId: docId1 } });
      expect(doc1Entities).toHaveLength(1);
      expect(doc1Entities[0].cleanedName).toBe('文档1');

      const doc2Entities = await prisma.docEntity.findMany({ where: { docId: docId2 } });
      expect(doc2Entities).toHaveLength(1);
      expect(doc2Entities[0].cleanedName).toBe('文档2');
    });
  });
});
