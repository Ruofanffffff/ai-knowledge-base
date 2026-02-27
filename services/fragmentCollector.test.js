/**
 * FragmentCollector 单元测试
 */

// Mock Prisma - must be before require
const mockPrisma = {
  cognitiveFragment: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// Mock EmbeddingService
jest.mock('./embeddingService', () => ({
  generateEmbedding: jest.fn(),
}));

const fragmentCollector = require('./fragmentCollector');
const { FragmentCollector, FRAGMENT_TYPES } = require('./fragmentCollector');
const embeddingService = require('./embeddingService');

describe('FragmentCollector', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('FRAGMENT_TYPES', () => {
    it('should contain all 14 fragment types', () => {
      expect(FRAGMENT_TYPES).toHaveLength(14);
      expect(FRAGMENT_TYPES).toContain('note_create');
      expect(FRAGMENT_TYPES).toContain('note_edit');
      expect(FRAGMENT_TYPES).toContain('search_query');
      expect(FRAGMENT_TYPES).toContain('doc_edit');
      expect(FRAGMENT_TYPES).toContain('doc_create');
      expect(FRAGMENT_TYPES).toContain('tag_add');
      expect(FRAGMENT_TYPES).toContain('doc_view');
      expect(FRAGMENT_TYPES).toContain('image_analyze');
      expect(FRAGMENT_TYPES).toContain('community_publish');
      expect(FRAGMENT_TYPES).toContain('ai_chat');
      expect(FRAGMENT_TYPES).toContain('community_like');
      expect(FRAGMENT_TYPES).toContain('community_forward');
      expect(FRAGMENT_TYPES).toContain('community_favorite');
      expect(FRAGMENT_TYPES).toContain('community_comment');
    });
  });

  describe('isValidContent', () => {
    it('should return true for content with 5 or more characters', () => {
      expect(fragmentCollector.isValidContent('hello')).toBe(true);
      expect(fragmentCollector.isValidContent('这是有效内容')).toBe(true);
      expect(fragmentCollector.isValidContent('12345')).toBe(true);
    });

    it('should return false for content shorter than 5 characters', () => {
      expect(fragmentCollector.isValidContent('hi')).toBe(false);
      expect(fragmentCollector.isValidContent('abc')).toBe(false);
      expect(fragmentCollector.isValidContent('1234')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(fragmentCollector.isValidContent('')).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(fragmentCollector.isValidContent(null)).toBe(false);
      expect(fragmentCollector.isValidContent(undefined)).toBe(false);
    });

    it('should return false for non-string types', () => {
      expect(fragmentCollector.isValidContent(12345)).toBe(false);
      expect(fragmentCollector.isValidContent({})).toBe(false);
    });

    it('should return true for exactly 5 characters', () => {
      expect(fragmentCollector.isValidContent('abcde')).toBe(true);
    });
  });

  describe('isDuplicate', () => {
    it('should return true when duplicate exists within window', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue({
        id: 'existing-id',
        sourceId: 'src-1',
        fragmentType: 'note_create',
      });

      const result = await fragmentCollector.isDuplicate('src-1', 'note_create');
      expect(result).toBe(true);
    });

    it('should return false when no duplicate exists', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue(null);

      const result = await fragmentCollector.isDuplicate('src-1', 'note_create');
      expect(result).toBe(false);
    });

    it('should use custom window minutes', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue(null);

      await fragmentCollector.isDuplicate('src-1', 'note_create', 10);

      expect(mockPrisma.cognitiveFragment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            sourceId: 'src-1',
            fragmentType: 'note_create',
            createdAt: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        })
      );
    });
  });

  describe('isSearchDuplicate', () => {
    it('should return true when same search query exists within 30 minutes', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue({
        id: 'existing-search',
        content: 'test query',
      });

      const result = await fragmentCollector.isSearchDuplicate('user-1', 'test query');
      expect(result).toBe(true);
    });

    it('should return false when no matching search query exists', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue(null);

      const result = await fragmentCollector.isSearchDuplicate('user-1', 'new query');
      expect(result).toBe(false);
    });

    it('should query with correct parameters', async () => {
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue(null);

      await fragmentCollector.isSearchDuplicate('user-1', 'test query');

      expect(mockPrisma.cognitiveFragment.findFirst).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          fragmentType: 'search_query',
          content: 'test query',
          createdAt: expect.objectContaining({ gte: expect.any(Date) }),
        },
      });
    });
  });

  describe('collect', () => {
    const validParams = {
      userId: 'user-1',
      fragmentType: 'note_create',
      content: 'This is valid content for testing',
      sourceId: 'note-123',
      sourceMeta: { tags: ['test'] },
    };

    it('should return null for content shorter than 5 characters', async () => {
      const result = await fragmentCollector.collect({
        ...validParams,
        content: 'hi',
      });
      expect(result).toBeNull();
      expect(mockPrisma.cognitiveFragment.create).not.toHaveBeenCalled();
    });

    it('should return null for empty content', async () => {
      const result = await fragmentCollector.collect({
        ...validParams,
        content: '',
      });
      expect(result).toBeNull();
    });

    it('should return null for unknown fragment type', async () => {
      const result = await fragmentCollector.collect({
        ...validParams,
        fragmentType: 'unknown_type',
      });
      expect(result).toBeNull();
    });

    it('should create a new fragment with embedding', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      embeddingService.generateEmbedding.mockResolvedValue(mockEmbedding);
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue(null);
      mockPrisma.cognitiveFragment.create.mockResolvedValue({
        id: 'new-fragment-id',
        ...validParams,
        sourceMeta: JSON.stringify(validParams.sourceMeta),
        embedding: JSON.stringify(mockEmbedding),
        createdAt: new Date(),
      });

      const result = await fragmentCollector.collect(validParams);

      expect(result).not.toBeNull();
      expect(result.id).toBe('new-fragment-id');
      expect(mockPrisma.cognitiveFragment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          fragmentType: 'note_create',
          content: validParams.content,
          sourceId: 'note-123',
          sourceMeta: JSON.stringify(validParams.sourceMeta),
          embedding: JSON.stringify(mockEmbedding),
        }),
      });
    });

    it('should create fragment even when embedding fails', async () => {
      embeddingService.generateEmbedding.mockRejectedValue(new Error('API error'));
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue(null);
      mockPrisma.cognitiveFragment.create.mockResolvedValue({
        id: 'fragment-no-embed',
        embedding: null,
      });

      const result = await fragmentCollector.collect(validParams);

      expect(result).not.toBeNull();
      expect(mockPrisma.cognitiveFragment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          embedding: null,
        }),
      });
    });

    it('should update existing fragment when duplicate found in dedup window', async () => {
      const existingFragment = {
        id: 'existing-id',
        sourceId: 'note-123',
        fragmentType: 'note_create',
        sourceMeta: '{"old":"meta"}',
      };
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue(existingFragment);
      mockPrisma.cognitiveFragment.update.mockResolvedValue({
        ...existingFragment,
        content: validParams.content,
      });

      const result = await fragmentCollector.collect(validParams);

      expect(result).not.toBeNull();
      expect(mockPrisma.cognitiveFragment.update).toHaveBeenCalledWith({
        where: { id: 'existing-id' },
        data: {
          content: validParams.content,
          sourceMeta: JSON.stringify(validParams.sourceMeta),
        },
      });
      expect(mockPrisma.cognitiveFragment.create).not.toHaveBeenCalled();
    });

    it('should skip duplicate search queries within 30 minutes', async () => {
      // First call to findFirst is for search dedup (returns existing)
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue({
        id: 'existing-search',
        content: 'search term here',
      });

      const result = await fragmentCollector.collect({
        ...validParams,
        fragmentType: 'search_query',
        content: 'search term here',
      });

      expect(result).toBeNull();
      expect(mockPrisma.cognitiveFragment.create).not.toHaveBeenCalled();
    });

    it('should handle sourceMeta as null when not provided', async () => {
      embeddingService.generateEmbedding.mockResolvedValue(null);
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue(null);
      mockPrisma.cognitiveFragment.create.mockResolvedValue({ id: 'new-id' });

      await fragmentCollector.collect({
        userId: 'user-1',
        fragmentType: 'doc_view',
        content: 'Document title here',
        sourceId: 'doc-1',
      });

      expect(mockPrisma.cognitiveFragment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sourceMeta: null,
        }),
      });
    });

    it('should return null when database write fails', async () => {
      embeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue(null);
      mockPrisma.cognitiveFragment.create.mockRejectedValue(new Error('DB error'));

      const result = await fragmentCollector.collect(validParams);
      expect(result).toBeNull();
    });

    it('should work with all valid fragment types', async () => {
      embeddingService.generateEmbedding.mockResolvedValue([0.1]);
      mockPrisma.cognitiveFragment.findFirst.mockResolvedValue(null);

      for (const type of FRAGMENT_TYPES) {
        mockPrisma.cognitiveFragment.create.mockResolvedValue({
          id: `frag-${type}`,
          fragmentType: type,
        });

        const result = await fragmentCollector.collect({
          ...validParams,
          fragmentType: type,
        });

        expect(result).not.toBeNull();
        expect(result.fragmentType).toBe(type);
      }
    });
  });

  describe('exports', () => {
    it('should export singleton instance', () => {
      expect(fragmentCollector).toBeInstanceOf(FragmentCollector);
    });

    it('should export FragmentCollector class', () => {
      expect(FragmentCollector).toBeDefined();
    });

    it('should export FRAGMENT_TYPES', () => {
      expect(FRAGMENT_TYPES).toBeDefined();
      expect(Array.isArray(FRAGMENT_TYPES)).toBe(true);
    });
  });
});
