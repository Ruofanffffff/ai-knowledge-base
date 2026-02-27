/**
 * Tests for parentIdValidator - 数据一致性验证工具
 *
 * Requirements: 9.1, 9.2, 9.4, 9.5, 1.7
 */

// Mock Prisma - must be before require
const mockPrisma = {
  knowledgeBody: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

const { validateParentId, validateChildBodies, validateParentIdMiddleware } = require('./parentIdValidator');

describe('parentIdValidator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateParentId', () => {
    it('should reject when referenced body does not exist (Req 1.7)', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(null);

      const result = await validateParentId('nonexistent-id');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('不存在');
      expect(result.parentBody).toBeNull();
    });

    it('should reject when referenced body bodyType is not "intent" (Req 9.5)', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'topic-body-1',
        bodyType: 'topic',
        parentId: null,
      });

      const result = await validateParentId('topic-body-1');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('bodyType 必须为 "intent"');
      expect(result.parentBody).toBeNull();
    });

    it('should reject when setting parentId would create depth > 2 (Req 9.1, 9.2)', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'nested-intent',
        bodyType: 'intent',
        parentId: 'some-parent-id', // Already has a parent
        parent: { id: 'some-parent-id' },
      });

      const result = await validateParentId('nested-intent');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('超过两层');
      expect(result.parentBody).toBeNull();
    });

    it('should reject self-reference', async () => {
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        bodyType: 'intent',
        parentId: null,
      });

      const result = await validateParentId('body-1', 'body-1');

      expect(result.valid).toBe(false);
      expect(result.error).toContain('自身');
    });

    it('should accept valid intent body as parent', async () => {
      const parentBody = {
        id: 'intent-body-1',
        bodyType: 'intent',
        parentId: null,
      };
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(parentBody);

      const result = await validateParentId('intent-body-1');

      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
      expect(result.parentBody).toEqual(parentBody);
    });
  });

  describe('validateChildBodies', () => {
    it('should filter out children that already have a parent (Req 9.3)', async () => {
      mockPrisma.knowledgeBody.findMany.mockResolvedValue([
        { id: 'child-1', bodyType: 'topic', parentId: null },
        { id: 'child-2', bodyType: 'topic', parentId: 'existing-parent' },
      ]);

      const result = await validateChildBodies('parent-1', ['child-1', 'child-2']);

      expect(result.validChildIds).toEqual(['child-1']);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].id).toBe('child-2');
    });

    it('should filter out intent-type children (Req 9.1)', async () => {
      mockPrisma.knowledgeBody.findMany.mockResolvedValue([
        { id: 'child-1', bodyType: 'topic', parentId: null },
        { id: 'child-2', bodyType: 'intent', parentId: null },
      ]);

      const result = await validateChildBodies('parent-1', ['child-1', 'child-2']);

      expect(result.validChildIds).toEqual(['child-1']);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toContain('intent');
    });

    it('should filter out self-reference', async () => {
      mockPrisma.knowledgeBody.findMany.mockResolvedValue([
        { id: 'parent-1', bodyType: 'topic', parentId: null },
        { id: 'child-1', bodyType: 'topic', parentId: null },
      ]);

      const result = await validateChildBodies('parent-1', ['parent-1', 'child-1']);

      expect(result.validChildIds).toEqual(['child-1']);
      expect(result.skipped).toHaveLength(1);
    });

    it('should return all valid children when no constraints violated', async () => {
      mockPrisma.knowledgeBody.findMany.mockResolvedValue([
        { id: 'child-1', bodyType: 'topic', parentId: null },
        { id: 'child-2', bodyType: 'topic', parentId: null },
        { id: 'child-3', bodyType: 'topic', parentId: null },
      ]);

      const result = await validateChildBodies('parent-1', ['child-1', 'child-2', 'child-3']);

      expect(result.validChildIds).toEqual(['child-1', 'child-2', 'child-3']);
      expect(result.skipped).toHaveLength(0);
    });
  });

  describe('validateParentIdMiddleware', () => {
    let req, res, next;

    beforeEach(() => {
      req = { body: {}, params: {} };
      res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      next = jest.fn();
    });

    it('should call next when parentId is not in request body', async () => {
      const middleware = validateParentIdMiddleware();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('should call next when parentId is null (unlinking)', async () => {
      req.body.parentId = null;
      const middleware = validateParentIdMiddleware();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should return 400 when parentId references non-existent body', async () => {
      req.body.parentId = 'nonexistent';
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(null);

      const middleware = validateParentIdMiddleware();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 400 when parentId references non-intent body', async () => {
      req.body.parentId = 'topic-body';
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'topic-body',
        bodyType: 'topic',
        parentId: null,
      });

      const middleware = validateParentIdMiddleware();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next and attach parentBody when validation passes', async () => {
      const parentBody = { id: 'intent-1', bodyType: 'intent', parentId: null };
      req.body.parentId = 'intent-1';
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue(parentBody);

      const middleware = validateParentIdMiddleware();
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.validatedParentBody).toEqual(parentBody);
    });

    it('should use req.params.id as childId for self-reference check', async () => {
      req.body.parentId = 'body-1';
      req.params.id = 'body-1';
      mockPrisma.knowledgeBody.findUnique.mockResolvedValue({
        id: 'body-1',
        bodyType: 'intent',
        parentId: null,
      });

      const middleware = validateParentIdMiddleware();
      await middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
