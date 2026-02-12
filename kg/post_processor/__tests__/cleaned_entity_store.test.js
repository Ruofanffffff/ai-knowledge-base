/**
 * Unit tests for CleanedEntityStore
 * Requirements: 13.1, 13.2
 */

const { PrismaClient } = require('@prisma/client');

// Mock Prisma
jest.mock('@prisma/client', () => {
  const mockCleanedEntity = {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  };
  const mockCleanedRelation = {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn()
  };
  return {
    PrismaClient: jest.fn(() => ({
      cleanedEntity: mockCleanedEntity,
      cleanedRelation: mockCleanedRelation
    }))
  };
});

const CleanedEntityStore = require('../cleaned_entity_store');

describe('CleanedEntityStore', () => {
  let store;
  let prisma;

  beforeEach(() => {
    store = new CleanedEntityStore();
    prisma = new PrismaClient();
    jest.clearAllMocks();
  });

  describe('getAllCleanedEntities', () => {
    it('returns all entities ordered by createdAt desc', async () => {
      const entities = [{ id: '1', cleanedName: '测试' }];
      prisma.cleanedEntity.findMany.mockResolvedValue(entities);

      const result = await store.getAllCleanedEntities();

      expect(result).toEqual(entities);
      expect(prisma.cleanedEntity.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' }
      });
    });

    it('returns empty array on error', async () => {
      prisma.cleanedEntity.findMany.mockRejectedValue(new Error('DB error'));

      const result = await store.getAllCleanedEntities();

      expect(result).toEqual([]);
    });
  });

  describe('getAllCleanedRelations', () => {
    it('returns all relations with source/target included', async () => {
      const relations = [{ id: '1', cleanedName: '属于' }];
      prisma.cleanedRelation.findMany.mockResolvedValue(relations);

      const result = await store.getAllCleanedRelations();

      expect(result).toEqual(relations);
      expect(prisma.cleanedRelation.findMany).toHaveBeenCalledWith({
        include: { source: true, target: true },
        orderBy: { createdAt: 'desc' }
      });
    });

    it('returns empty array on error', async () => {
      prisma.cleanedRelation.findMany.mockRejectedValue(new Error('DB error'));

      const result = await store.getAllCleanedRelations();

      expect(result).toEqual([]);
    });
  });

  describe('createCleanedEntity', () => {
    it('creates entity with array sourceEntityIds serialized to JSON', async () => {
      const created = { id: '1', cleanedName: '人工智能', description: 'AI技术', sourceEntityIds: '["e1","e2"]' };
      prisma.cleanedEntity.create.mockResolvedValue(created);

      const result = await store.createCleanedEntity({
        cleanedName: '人工智能',
        description: 'AI技术',
        sourceEntityIds: ['e1', 'e2']
      });

      expect(result).toEqual(created);
      expect(prisma.cleanedEntity.create).toHaveBeenCalledWith({
        data: {
          cleanedName: '人工智能',
          description: 'AI技术',
          sourceEntityIds: '["e1","e2"]'
        }
      });
    });

    it('passes string sourceEntityIds as-is', async () => {
      prisma.cleanedEntity.create.mockResolvedValue({});

      await store.createCleanedEntity({
        cleanedName: '测试',
        description: '描述',
        sourceEntityIds: '["e1"]'
      });

      expect(prisma.cleanedEntity.create).toHaveBeenCalledWith({
        data: {
          cleanedName: '测试',
          description: '描述',
          sourceEntityIds: '["e1"]'
        }
      });
    });

    it('throws on error', async () => {
      prisma.cleanedEntity.create.mockRejectedValue(new Error('create failed'));

      await expect(store.createCleanedEntity({ cleanedName: 'x', description: 'y' }))
        .rejects.toThrow('create failed');
    });
  });

  describe('updateCleanedEntity', () => {
    it('updates only provided fields', async () => {
      prisma.cleanedEntity.update.mockResolvedValue({ id: '1', description: '新描述' });

      await store.updateCleanedEntity('1', { description: '新描述' });

      expect(prisma.cleanedEntity.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { description: '新描述' }
      });
    });

    it('serializes array sourceEntityIds', async () => {
      prisma.cleanedEntity.update.mockResolvedValue({});

      await store.updateCleanedEntity('1', { sourceEntityIds: ['a', 'b'] });

      expect(prisma.cleanedEntity.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { sourceEntityIds: '["a","b"]' }
      });
    });

    it('throws on error', async () => {
      prisma.cleanedEntity.update.mockRejectedValue(new Error('not found'));

      await expect(store.updateCleanedEntity('bad-id', { description: 'x' }))
        .rejects.toThrow('not found');
    });
  });

  describe('createCleanedRelation', () => {
    it('creates relation with all fields', async () => {
      const data = {
        cleanedName: '属于',
        description: '归属关系',
        sourceEntityId: 'e1',
        targetEntityId: 'e2',
        sourceRelationIds: ['r1', 'r2']
      };
      prisma.cleanedRelation.create.mockResolvedValue({ id: '1', ...data });

      const result = await store.createCleanedRelation(data);

      expect(prisma.cleanedRelation.create).toHaveBeenCalledWith({
        data: {
          cleanedName: '属于',
          description: '归属关系',
          sourceEntityId: 'e1',
          targetEntityId: 'e2',
          sourceRelationIds: '["r1","r2"]'
        }
      });
    });

    it('throws on error', async () => {
      prisma.cleanedRelation.create.mockRejectedValue(new Error('FK error'));

      await expect(store.createCleanedRelation({
        cleanedName: 'x', description: 'y',
        sourceEntityId: 'bad', targetEntityId: 'bad',
        sourceRelationIds: []
      })).rejects.toThrow('FK error');
    });
  });

  describe('updateCleanedRelation', () => {
    it('updates only provided fields', async () => {
      prisma.cleanedRelation.update.mockResolvedValue({});

      await store.updateCleanedRelation('1', { description: '更新描述' });

      expect(prisma.cleanedRelation.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { description: '更新描述' }
      });
    });

    it('serializes array sourceRelationIds', async () => {
      prisma.cleanedRelation.update.mockResolvedValue({});

      await store.updateCleanedRelation('1', { sourceRelationIds: ['r1'] });

      expect(prisma.cleanedRelation.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { sourceRelationIds: '["r1"]' }
      });
    });
  });

  describe('getCleanupStats', () => {
    it('returns entity and relation counts', async () => {
      prisma.cleanedEntity.count.mockResolvedValue(5);
      prisma.cleanedRelation.count.mockResolvedValue(3);

      const stats = await store.getCleanupStats();

      expect(stats).toEqual({ totalEntities: 5, totalRelations: 3 });
    });

    it('returns zeros on error', async () => {
      prisma.cleanedEntity.count.mockRejectedValue(new Error('DB error'));

      const stats = await store.getCleanupStats();

      expect(stats).toEqual({ totalEntities: 0, totalRelations: 0 });
    });
  });
});
