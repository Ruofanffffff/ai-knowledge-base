/**
 * LifecycleService 单元测试
 *
 * 测试衰减因子计算、碎片时间加权、原始置信度计算
 * Requirements: 2.1, 7.1, 7.2, 7.3
 */

// Mock Prisma - must be before require
const mockPrisma = {
  knowledgeBody: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  cognitiveFragment: {
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const { LifecycleService } = require('./lifecycleService');

describe('LifecycleService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new LifecycleService();
  });

  describe('calculateDecayFactor', () => {
    it('should return 1 when lastActiveAt is now (0 days)', () => {
      const now = new Date();
      const result = service.calculateDecayFactor(now);
      expect(result).toBeCloseTo(1, 1);
    });

    it('should return 0.5 when lastActiveAt is 90 days ago', () => {
      const date = new Date();
      date.setDate(date.getDate() - 90);
      const result = service.calculateDecayFactor(date);
      expect(result).toBeCloseTo(0.5, 1);
    });

    it('should return 0.1 when lastActiveAt is exactly 180 days ago', () => {
      const date = new Date();
      date.setDate(date.getDate() - 180);
      const result = service.calculateDecayFactor(date);
      // At exactly 180 days: 1 - 180/180 = 0, clamped to 0.1
      expect(result).toBeCloseTo(0.1, 1);
    });

    it('should return 0.1 when lastActiveAt is 365 days ago (clamped)', () => {
      const date = new Date();
      date.setDate(date.getDate() - 365);
      const result = service.calculateDecayFactor(date);
      expect(result).toBeCloseTo(0.1, 1);
    });

    it('should always return a value in [0.1, 1]', () => {
      // Very old date
      const veryOld = new Date('2000-01-01');
      expect(service.calculateDecayFactor(veryOld)).toBeGreaterThanOrEqual(0.1);
      expect(service.calculateDecayFactor(veryOld)).toBeLessThanOrEqual(1);

      // Future date treated as 0 days
      const future = new Date();
      future.setDate(future.getDate() + 10);
      expect(service.calculateDecayFactor(future)).toBeGreaterThanOrEqual(0.1);
      expect(service.calculateDecayFactor(future)).toBeLessThanOrEqual(1);
    });
  });

  describe('calculateWeightedFragmentCount', () => {
    it('should return 0 for empty fragment list', () => {
      expect(service.calculateWeightedFragmentCount([])).toBe(0);
    });

    it('should return 0 for null/undefined input', () => {
      expect(service.calculateWeightedFragmentCount(null)).toBe(0);
      expect(service.calculateWeightedFragmentCount(undefined)).toBe(0);
    });

    it('should return close to fragment count for brand new fragments', () => {
      const now = new Date();
      const fragments = [
        { createdAt: now },
        { createdAt: now },
        { createdAt: now },
      ];
      const result = service.calculateWeightedFragmentCount(fragments);
      // Each weight ≈ 1, so sum ≈ 3
      expect(result).toBeCloseTo(3, 0);
    });

    it('should return fragments.length * 0.1 when all fragments are older than 180 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 365);
      const fragments = [
        { createdAt: oldDate },
        { createdAt: oldDate },
        { createdAt: oldDate },
        { createdAt: oldDate },
        { createdAt: oldDate },
      ];
      const result = service.calculateWeightedFragmentCount(fragments);
      // Each weight = 0.1 (clamped), sum = 0.5, min = 5 * 0.1 = 0.5
      expect(result).toBeCloseTo(0.5, 1);
    });

    it('should weight recent fragments higher than old ones', () => {
      const now = new Date();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 150);

      const recentFragments = [{ createdAt: now }, { createdAt: now }];
      const oldFragments = [{ createdAt: oldDate }, { createdAt: oldDate }];

      const recentResult = service.calculateWeightedFragmentCount(recentFragments);
      const oldResult = service.calculateWeightedFragmentCount(oldFragments);

      expect(recentResult).toBeGreaterThan(oldResult);
    });
  });

  describe('calculateOriginalConfidence', () => {
    it('should return 0 when all inputs are 0', () => {
      const result = service.calculateOriginalConfidence({
        weightedCount: 0,
        timeSpanDays: 0,
        avgSimilarity: 0,
      });
      expect(result).toBe(0);
    });

    it('should return 0.2 when weightedCount=5, timeSpanDays=0, avgSimilarity=0', () => {
      const result = service.calculateOriginalConfidence({
        weightedCount: 5,
        timeSpanDays: 0,
        avgSimilarity: 0,
      });
      // 0.4 * min(5/10, 1) + 0.3 * 0 + 0.3 * 0 = 0.4 * 0.5 = 0.2
      expect(result).toBeCloseTo(0.2, 5);
    });

    it('should return 0.4 when weightedCount=10, timeSpanDays=0, avgSimilarity=0', () => {
      const result = service.calculateOriginalConfidence({
        weightedCount: 10,
        timeSpanDays: 0,
        avgSimilarity: 0,
      });
      // 0.4 * min(10/10, 1) = 0.4
      expect(result).toBeCloseTo(0.4, 5);
    });

    it('should cap weightedCount contribution at 0.4 for weightedCount=20', () => {
      const result = service.calculateOriginalConfidence({
        weightedCount: 20,
        timeSpanDays: 0,
        avgSimilarity: 0,
      });
      // 0.4 * min(20/10, 1) = 0.4 * 1 = 0.4 (capped)
      expect(result).toBeCloseTo(0.4, 5);
    });

    it('should return 1.0 when all inputs are at maximum', () => {
      const result = service.calculateOriginalConfidence({
        weightedCount: 10,
        timeSpanDays: 14,
        avgSimilarity: 1,
      });
      // 0.4 * 1 + 0.3 * 1 + 0.3 * 1 = 1.0
      expect(result).toBeCloseTo(1.0, 5);
    });

    it('should clamp avgSimilarity to [0, 1]', () => {
      const result = service.calculateOriginalConfidence({
        weightedCount: 0,
        timeSpanDays: 0,
        avgSimilarity: 2.0,
      });
      // avgSimilarity clamped to 1: 0.3 * 1 = 0.3
      expect(result).toBeCloseTo(0.3, 5);
    });

    it('should handle negative inputs gracefully', () => {
      const result = service.calculateOriginalConfidence({
        weightedCount: -5,
        timeSpanDays: -3,
        avgSimilarity: -0.5,
      });
      // All clamped to 0
      expect(result).toBe(0);
    });
  });

  describe('detectStale', () => {
    const userId = 'user-1';

    it('should return 0 when no active bodies exceed staleDays', async () => {
      mockPrisma.knowledgeBody.findMany.mockResolvedValue([]);

      const result = await service.detectStale(userId, 30);

      expect(result).toBe(0);
      expect(mockPrisma.knowledgeBody.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId,
            lifecycleStatus: 'active',
            lastActiveAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
        })
      );
      expect(mockPrisma.knowledgeBody.updateMany).not.toHaveBeenCalled();
    });

    it('should mark active bodies older than staleDays as stale', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 45);

      const staleBodies = [
        { id: 'body-1', themeName: 'Theme A', lastActiveAt: oldDate },
        { id: 'body-2', themeName: 'Theme B', lastActiveAt: oldDate },
      ];

      mockPrisma.knowledgeBody.findMany.mockResolvedValue(staleBodies);
      mockPrisma.knowledgeBody.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.detectStale(userId, 30);

      expect(result).toBe(2);
      expect(mockPrisma.knowledgeBody.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['body-1', 'body-2'] } },
        data: { lifecycleStatus: 'stale' },
      });
    });

    it('should only query active bodies (skip archived)', async () => {
      mockPrisma.knowledgeBody.findMany.mockResolvedValue([]);

      await service.detectStale(userId, 30);

      expect(mockPrisma.knowledgeBody.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            lifecycleStatus: 'active',
          }),
        })
      );
    });

    it('should use default staleDays of 30 when not specified', async () => {
      mockPrisma.knowledgeBody.findMany.mockResolvedValue([]);

      await service.detectStale(userId);

      const callArgs = mockPrisma.knowledgeBody.findMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.lastActiveAt.lt;
      const now = new Date();
      const diffDays = (now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(30, 0);
    });

    it('should log state changes with timestamps', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 40);

      mockPrisma.knowledgeBody.findMany.mockResolvedValue([
        { id: 'body-1', themeName: 'Theme A', lastActiveAt: oldDate },
      ]);
      mockPrisma.knowledgeBody.updateMany.mockResolvedValue({ count: 1 });

      await service.detectStale(userId, 30);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('marked as stale')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('body-1')
      );

      consoleSpy.mockRestore();
    });

    it('should handle custom staleDays parameter', async () => {
      mockPrisma.knowledgeBody.findMany.mockResolvedValue([]);

      await service.detectStale(userId, 15);

      const callArgs = mockPrisma.knowledgeBody.findMany.mock.calls[0][0];
      const cutoffDate = callArgs.where.lastActiveAt.lt;
      const now = new Date();
      const diffDays = (now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24);
      expect(diffDays).toBeCloseTo(15, 0);
    });
  });

  describe('reactivateBody', () => {
    it('should throw error when bodyId not found', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(null);

      await expect(service.reactivateBody('nonexistent-id')).rejects.toThrow('KnowledgeBody not found');
    });

    it('should only update lastActiveAt when body is already active (idempotent)', async () => {
      const activeBody = {
        id: 'body-active',
        themeName: 'Active Theme',
        lifecycleStatus: 'active',
        relatedFragmentIds: '[]',
        parentId: null,
        lastActiveAt: new Date('2024-01-01'),
      };
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(activeBody);
      mockPrisma.knowledgeBody.update.mockResolvedValue({ ...activeBody, lastActiveAt: new Date() });

      const result = await service.reactivateBody('body-active');

      expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledWith({
        where: { id: 'body-active' },
        data: { lastActiveAt: expect.any(Date) },
      });
      expect(result.lastActiveAt).toBeDefined();
    });

    it('should reactivate stale body to active with recalculated confidence', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const staleBody = {
        id: 'body-stale',
        themeName: 'Stale Theme',
        lifecycleStatus: 'stale',
        relatedFragmentIds: '["frag-1","frag-2"]',
        parentId: null,
        lastActiveAt: new Date('2024-01-01'),
      };
      const fragments = [
        { id: 'frag-1', createdAt: new Date() },
        { id: 'frag-2', createdAt: new Date() },
      ];

      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(staleBody);
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue(fragments);
      mockPrisma.knowledgeBody.update.mockResolvedValue({
        ...staleBody,
        lifecycleStatus: 'active',
        lastActiveAt: new Date(),
        confidenceScore: 0.23,
      });

      const result = await service.reactivateBody('body-stale');

      expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledWith({
        where: { id: 'body-stale' },
        data: {
          lifecycleStatus: 'active',
          lastActiveAt: expect.any(Date),
          confidenceScore: expect.any(Number),
        },
      });
      expect(result.lifecycleStatus).toBe('active');
      consoleSpy.mockRestore();
    });

    it('should reactivate archived body to active', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const archivedBody = {
        id: 'body-archived',
        themeName: 'Archived Theme',
        lifecycleStatus: 'archived',
        relatedFragmentIds: '[]',
        parentId: null,
        lastActiveAt: new Date('2023-06-01'),
      };

      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(archivedBody);
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([]);
      mockPrisma.knowledgeBody.update.mockResolvedValue({
        ...archivedBody,
        lifecycleStatus: 'active',
        lastActiveAt: new Date(),
        confidenceScore: 0.15,
      });

      const result = await service.reactivateBody('body-archived');

      expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledWith({
        where: { id: 'body-archived' },
        data: {
          lifecycleStatus: 'active',
          lastActiveAt: expect.any(Date),
          confidenceScore: expect.any(Number),
        },
      });
      expect(result.lifecycleStatus).toBe('active');
      consoleSpy.mockRestore();
    });

    it('should cascade activate parent intent body when not active', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const childBody = {
        id: 'child-body',
        themeName: 'Child Theme',
        lifecycleStatus: 'stale',
        relatedFragmentIds: '[]',
        parentId: 'parent-intent',
        lastActiveAt: new Date('2024-01-01'),
      };
      const parentBody = {
        id: 'parent-intent',
        themeName: 'Parent Intent',
        lifecycleStatus: 'archived',
        bodyType: 'intent',
      };

      mockPrisma.knowledgeBody.findUnique
        .mockResolvedValueOnce(childBody)   // first call: find child
        .mockResolvedValueOnce(parentBody); // second call: find parent
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([]);
      mockPrisma.knowledgeBody.update.mockResolvedValue({
        ...childBody,
        lifecycleStatus: 'active',
        lastActiveAt: new Date(),
        confidenceScore: 0.15,
      });

      await service.reactivateBody('child-body');

      // Should have updated parent too
      expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledTimes(2);
      expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledWith({
        where: { id: 'parent-intent' },
        data: {
          lifecycleStatus: 'active',
          lastActiveAt: expect.any(Date),
        },
      });
      consoleSpy.mockRestore();
    });

    it('should not cascade activate parent when parent is already active', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const childBody = {
        id: 'child-body-2',
        themeName: 'Child Theme 2',
        lifecycleStatus: 'stale',
        relatedFragmentIds: '[]',
        parentId: 'parent-active',
        lastActiveAt: new Date('2024-01-01'),
      };
      const parentBody = {
        id: 'parent-active',
        themeName: 'Active Parent',
        lifecycleStatus: 'active',
        bodyType: 'intent',
      };

      mockPrisma.knowledgeBody.findUnique
        .mockResolvedValueOnce(childBody)
        .mockResolvedValueOnce(parentBody);
      mockPrisma.cognitiveFragment.findMany.mockResolvedValue([]);
      mockPrisma.knowledgeBody.update.mockResolvedValue({
        ...childBody,
        lifecycleStatus: 'active',
        lastActiveAt: new Date(),
        confidenceScore: 0.15,
      });

      await service.reactivateBody('child-body-2');

      // Should only update the child, not the parent
      expect(mockPrisma.knowledgeBody.update).toHaveBeenCalledTimes(1);
      consoleSpy.mockRestore();
    });

    it('should handle invalid relatedFragmentIds JSON gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const body = {
        id: 'body-bad-json',
        themeName: 'Bad JSON Theme',
        lifecycleStatus: 'stale',
        relatedFragmentIds: 'not-valid-json',
        parentId: null,
        lastActiveAt: new Date('2024-01-01'),
      };

      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(body);
      mockPrisma.knowledgeBody.update.mockResolvedValue({
        ...body,
        lifecycleStatus: 'active',
        lastActiveAt: new Date(),
        confidenceScore: 0.15,
      });

      // Should not throw
      const result = await service.reactivateBody('body-bad-json');
      expect(result.lifecycleStatus).toBe('active');
      consoleSpy.mockRestore();
    });
  });

  describe('runLifecycleScan', () => {
    const userId = 'user-scan-1';

    it('should execute all four stages and return staleCount and archivedCount', async () => {
      // Mock the sub-methods
      service.applyDecay = jest.fn().mockResolvedValue(undefined);
      service.detectStale = jest.fn().mockResolvedValue(3);
      service.autoArchive = jest.fn().mockResolvedValue(1);
      service.cascadeArchiveIntentBodies = jest.fn().mockResolvedValue(undefined);

      const result = await service.runLifecycleScan(userId);

      expect(result).toEqual({ staleCount: 3, archivedCount: 1 });
      expect(service.applyDecay).toHaveBeenCalledWith(userId);
      expect(service.detectStale).toHaveBeenCalledWith(userId);
      expect(service.autoArchive).toHaveBeenCalledWith(userId);
      expect(service.cascadeArchiveIntentBodies).toHaveBeenCalledWith(userId);
    });

    it('should execute stages in order: applyDecay → detectStale → autoArchive → cascadeArchiveIntentBodies', async () => {
      const callOrder = [];
      service.applyDecay = jest.fn().mockImplementation(async () => { callOrder.push('applyDecay'); });
      service.detectStale = jest.fn().mockImplementation(async () => { callOrder.push('detectStale'); return 0; });
      service.autoArchive = jest.fn().mockImplementation(async () => { callOrder.push('autoArchive'); return 0; });
      service.cascadeArchiveIntentBodies = jest.fn().mockImplementation(async () => { callOrder.push('cascadeArchiveIntentBodies'); });

      await service.runLifecycleScan(userId);

      expect(callOrder).toEqual(['applyDecay', 'detectStale', 'autoArchive', 'cascadeArchiveIntentBodies']);
    });

    it('should continue to detectStale when applyDecay fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      service.applyDecay = jest.fn().mockRejectedValue(new Error('decay db error'));
      service.detectStale = jest.fn().mockResolvedValue(2);
      service.autoArchive = jest.fn().mockResolvedValue(1);
      service.cascadeArchiveIntentBodies = jest.fn().mockResolvedValue(undefined);

      const result = await service.runLifecycleScan(userId);

      expect(result).toEqual({ staleCount: 2, archivedCount: 1 });
      expect(service.detectStale).toHaveBeenCalledWith(userId);
      expect(service.autoArchive).toHaveBeenCalledWith(userId);
      expect(service.cascadeArchiveIntentBodies).toHaveBeenCalledWith(userId);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('applyDecay failed'),
        'decay db error'
      );
      consoleSpy.mockRestore();
    });

    it('should continue to autoArchive when detectStale fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      service.applyDecay = jest.fn().mockResolvedValue(undefined);
      service.detectStale = jest.fn().mockRejectedValue(new Error('stale detection error'));
      service.autoArchive = jest.fn().mockResolvedValue(5);
      service.cascadeArchiveIntentBodies = jest.fn().mockResolvedValue(undefined);

      const result = await service.runLifecycleScan(userId);

      expect(result).toEqual({ staleCount: 0, archivedCount: 5 });
      expect(service.autoArchive).toHaveBeenCalledWith(userId);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('detectStale failed'),
        'stale detection error'
      );
      consoleSpy.mockRestore();
    });

    it('should continue to cascadeArchiveIntentBodies when autoArchive fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      service.applyDecay = jest.fn().mockResolvedValue(undefined);
      service.detectStale = jest.fn().mockResolvedValue(4);
      service.autoArchive = jest.fn().mockRejectedValue(new Error('archive error'));
      service.cascadeArchiveIntentBodies = jest.fn().mockResolvedValue(undefined);

      const result = await service.runLifecycleScan(userId);

      expect(result).toEqual({ staleCount: 4, archivedCount: 0 });
      expect(service.cascadeArchiveIntentBodies).toHaveBeenCalledWith(userId);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('autoArchive failed'),
        'archive error'
      );
      consoleSpy.mockRestore();
    });

    it('should return partial results when cascadeArchiveIntentBodies fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      service.applyDecay = jest.fn().mockResolvedValue(undefined);
      service.detectStale = jest.fn().mockResolvedValue(2);
      service.autoArchive = jest.fn().mockResolvedValue(3);
      service.cascadeArchiveIntentBodies = jest.fn().mockRejectedValue(new Error('cascade error'));

      const result = await service.runLifecycleScan(userId);

      expect(result).toEqual({ staleCount: 2, archivedCount: 3 });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('cascadeArchiveIntentBodies failed'),
        'cascade error'
      );
      consoleSpy.mockRestore();
    });

    it('should return {staleCount: 0, archivedCount: 0} when all stages fail', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      service.applyDecay = jest.fn().mockRejectedValue(new Error('err1'));
      service.detectStale = jest.fn().mockRejectedValue(new Error('err2'));
      service.autoArchive = jest.fn().mockRejectedValue(new Error('err3'));
      service.cascadeArchiveIntentBodies = jest.fn().mockRejectedValue(new Error('err4'));

      const result = await service.runLifecycleScan(userId);

      expect(result).toEqual({ staleCount: 0, archivedCount: 0 });
      expect(consoleSpy).toHaveBeenCalledTimes(4);
      consoleSpy.mockRestore();
    });

    it('should return {staleCount: 0, archivedCount: 0} when no bodies need processing', async () => {
      service.applyDecay = jest.fn().mockResolvedValue(undefined);
      service.detectStale = jest.fn().mockResolvedValue(0);
      service.autoArchive = jest.fn().mockResolvedValue(0);
      service.cascadeArchiveIntentBodies = jest.fn().mockResolvedValue(undefined);

      const result = await service.runLifecycleScan(userId);

      expect(result).toEqual({ staleCount: 0, archivedCount: 0 });
    });
  });
});
