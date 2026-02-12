/**
 * Unit tests for Version Manager
 * 
 * Tests version management functionality including:
 * - Version creation
 * - Version querying
 * - Version comparison
 * - Version history
 * 
 * Requirements: 10.4
 */

const { VersionManager } = require('../version_manager');

describe('VersionManager', () => {
  let versionManager;
  let mockPrisma;

  beforeEach(() => {
    // Mock Prisma client
    mockPrisma = {
      documentIndex: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        deleteMany: jest.fn()
      }
    };

    versionManager = new VersionManager({ prisma: mockPrisma });
  });

  describe('getLatestVersion', () => {
    test('should return latest version number', async () => {
      mockPrisma.documentIndex.findFirst.mockResolvedValue({
        version: 5
      });

      const version = await versionManager.getLatestVersion('doc-123');

      expect(version).toBe(5);
      expect(mockPrisma.documentIndex.findFirst).toHaveBeenCalledWith({
        where: { docId: 'doc-123' },
        orderBy: { version: 'desc' },
        select: { version: true }
      });
    });

    test('should return 0 when no versions exist', async () => {
      mockPrisma.documentIndex.findFirst.mockResolvedValue(null);

      const version = await versionManager.getLatestVersion('doc-123');

      expect(version).toBe(0);
    });
  });

  describe('getVersion', () => {
    test('should return specific version', async () => {
      const mockIndex = {
        id: 'index-1',
        docId: 'doc-123',
        indexedText: '1. Fact one\n2. Fact two',
        version: 2,
        metadata: JSON.stringify({ fact_count: 2 }),
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      };

      mockPrisma.documentIndex.findFirst.mockResolvedValue(mockIndex);

      const result = await versionManager.getVersion('doc-123', 2);

      expect(result).toEqual({
        id: 'index-1',
        docId: 'doc-123',
        indexedText: '1. Fact one\n2. Fact two',
        version: 2,
        metadata: { fact_count: 2 },
        createdAt: mockIndex.createdAt,
        updatedAt: mockIndex.updatedAt
      });
    });

    test('should return null when version not found', async () => {
      mockPrisma.documentIndex.findFirst.mockResolvedValue(null);

      const result = await versionManager.getVersion('doc-123', 99);

      expect(result).toBeNull();
    });
  });

  describe('getAllVersions', () => {
    test('should return all versions in descending order', async () => {
      const mockIndices = [
        {
          id: 'index-3',
          docId: 'doc-123',
          indexedText: '1. Version 3',
          version: 3,
          metadata: JSON.stringify({ fact_count: 1 }),
          createdAt: new Date('2025-01-03'),
          updatedAt: new Date('2025-01-03')
        },
        {
          id: 'index-2',
          docId: 'doc-123',
          indexedText: '1. Version 2',
          version: 2,
          metadata: JSON.stringify({ fact_count: 1 }),
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02')
        }
      ];

      mockPrisma.documentIndex.findMany.mockResolvedValue(mockIndices);

      const result = await versionManager.getAllVersions('doc-123');

      expect(result).toHaveLength(2);
      expect(result[0].version).toBe(3);
      expect(result[1].version).toBe(2);
    });

    test('should support pagination options', async () => {
      mockPrisma.documentIndex.findMany.mockResolvedValue([]);

      await versionManager.getAllVersions('doc-123', {
        skip: 10,
        take: 5,
        orderBy: 'asc'
      });

      expect(mockPrisma.documentIndex.findMany).toHaveBeenCalledWith({
        where: { docId: 'doc-123' },
        orderBy: { version: 'asc' },
        skip: 10,
        take: 5
      });
    });
  });

  describe('compareVersions', () => {
    test('should compare two versions successfully', async () => {
      const index1 = {
        id: 'index-1',
        docId: 'doc-123',
        indexedText: '1. Fact one\n2. Fact two',
        version: 1,
        metadata: JSON.stringify({ 
          fact_count: 2, 
          token_count: 100,
          llm_model: 'model-a'
        }),
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      };

      const index2 = {
        id: 'index-2',
        docId: 'doc-123',
        indexedText: '1. Fact one modified\n2. Fact two\n3. Fact three',
        version: 2,
        metadata: JSON.stringify({ 
          fact_count: 3, 
          token_count: 150,
          llm_model: 'model-b'
        }),
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02')
      };

      mockPrisma.documentIndex.findFirst
        .mockResolvedValueOnce(index1)
        .mockResolvedValueOnce(index2);

      const result = await versionManager.compareVersions('doc-123', 1, 2);

      expect(result.docId).toBe('doc-123');
      expect(result.version1.version).toBe(1);
      expect(result.version2.version).toBe(2);
      expect(result.comparison.text.identical).toBe(false);
      expect(result.comparison.metadata.factCountDiff).toBe(1);
      expect(result.comparison.metadata.tokenCountDiff).toBe(50);
      expect(result.comparison.metadata.modelChanged).toBe(true);
      expect(result.comparison.facts.added).toBe(1);
      expect(result.comparison.facts.modified).toBe(1);
    });

    test('should throw error when version1 not found', async () => {
      mockPrisma.documentIndex.findFirst
        .mockResolvedValueOnce(null);

      await expect(
        versionManager.compareVersions('doc-123', 1, 2)
      ).rejects.toThrow('Version 1 not found');
    });

    test('should throw error when version2 not found', async () => {
      const index1 = {
        id: 'index-1',
        docId: 'doc-123',
        indexedText: '1. Fact',
        version: 1,
        metadata: JSON.stringify({ fact_count: 1 }),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.documentIndex.findFirst
        .mockResolvedValueOnce(index1)
        .mockResolvedValueOnce(null);

      await expect(
        versionManager.compareVersions('doc-123', 1, 2)
      ).rejects.toThrow('Version 2 not found');
    });

    test('should detect identical versions', async () => {
      const sameText = '1. Fact one\n2. Fact two';
      const index1 = {
        id: 'index-1',
        docId: 'doc-123',
        indexedText: sameText,
        version: 1,
        metadata: JSON.stringify({ fact_count: 2 }),
        createdAt: new Date('2025-01-01'),
        updatedAt: new Date('2025-01-01')
      };

      const index2 = {
        id: 'index-2',
        docId: 'doc-123',
        indexedText: sameText,
        version: 2,
        metadata: JSON.stringify({ fact_count: 2 }),
        createdAt: new Date('2025-01-02'),
        updatedAt: new Date('2025-01-02')
      };

      mockPrisma.documentIndex.findFirst
        .mockResolvedValueOnce(index1)
        .mockResolvedValueOnce(index2);

      const result = await versionManager.compareVersions('doc-123', 1, 2);

      expect(result.comparison.text.identical).toBe(true);
      expect(result.comparison.text.similarity).toBe(1.0);
      expect(result.comparison.facts.added).toBe(0);
      expect(result.comparison.facts.removed).toBe(0);
      expect(result.comparison.facts.modified).toBe(0);
    });
  });

  describe('createVersion', () => {
    test('should create new version with incremented version number', async () => {
      mockPrisma.documentIndex.findFirst.mockResolvedValue({
        version: 2
      });

      const indexData = {
        id: 'new-index',
        indexed_text: '1. New fact',
        metadata: { fact_count: 1 }
      };

      const createdIndex = {
        id: 'new-index',
        docId: 'doc-123',
        indexedText: '1. New fact',
        version: 3,
        metadata: JSON.stringify({ fact_count: 1 }),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.documentIndex.create.mockResolvedValue(createdIndex);

      const result = await versionManager.createVersion('doc-123', indexData);

      expect(result.version).toBe(3);
      expect(mockPrisma.documentIndex.create).toHaveBeenCalledWith({
        data: {
          id: 'new-index',
          docId: 'doc-123',
          indexedText: '1. New fact',
          metadata: JSON.stringify({ fact_count: 1 }),
          version: 3
        }
      });
    });

    test('should create version 1 when no previous versions exist', async () => {
      mockPrisma.documentIndex.findFirst.mockResolvedValue(null);

      const indexData = {
        id: 'first-index',
        indexed_text: '1. First fact',
        metadata: { fact_count: 1 }
      };

      const createdIndex = {
        id: 'first-index',
        docId: 'doc-123',
        indexedText: '1. First fact',
        version: 1,
        metadata: JSON.stringify({ fact_count: 1 }),
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.documentIndex.create.mockResolvedValue(createdIndex);

      const result = await versionManager.createVersion('doc-123', indexData);

      expect(result.version).toBe(1);
    });
  });

  describe('deleteVersion', () => {
    test('should delete specific version', async () => {
      mockPrisma.documentIndex.deleteMany.mockResolvedValue({ count: 1 });

      const result = await versionManager.deleteVersion('doc-123', 2);

      expect(result).toBe(true);
      expect(mockPrisma.documentIndex.deleteMany).toHaveBeenCalledWith({
        where: {
          docId: 'doc-123',
          version: 2
        }
      });
    });

    test('should return false when version not found', async () => {
      mockPrisma.documentIndex.deleteMany.mockResolvedValue({ count: 0 });

      const result = await versionManager.deleteVersion('doc-123', 99);

      expect(result).toBe(false);
    });
  });

  describe('getVersionHistory', () => {
    test('should return version history summary', async () => {
      const mockIndices = [
        {
          id: 'index-3',
          docId: 'doc-123',
          indexedText: '1. Version 3',
          version: 3,
          metadata: JSON.stringify({ 
            fact_count: 5, 
            token_count: 200,
            llm_model: 'model-c'
          }),
          createdAt: new Date('2025-01-03'),
          updatedAt: new Date('2025-01-03')
        },
        {
          id: 'index-2',
          docId: 'doc-123',
          indexedText: '1. Version 2',
          version: 2,
          metadata: JSON.stringify({ 
            fact_count: 3, 
            token_count: 150,
            llm_model: 'model-b'
          }),
          createdAt: new Date('2025-01-02'),
          updatedAt: new Date('2025-01-02')
        },
        {
          id: 'index-1',
          docId: 'doc-123',
          indexedText: '1. Version 1',
          version: 1,
          metadata: JSON.stringify({ 
            fact_count: 2, 
            token_count: 100,
            llm_model: 'model-a'
          }),
          createdAt: new Date('2025-01-01'),
          updatedAt: new Date('2025-01-01')
        }
      ];

      mockPrisma.documentIndex.findMany.mockResolvedValue(mockIndices);

      const result = await versionManager.getVersionHistory('doc-123');

      expect(result.docId).toBe('doc-123');
      expect(result.totalVersions).toBe(3);
      expect(result.latestVersion).toBe(3);
      expect(result.firstCreated).toEqual(new Date('2025-01-01'));
      expect(result.lastUpdated).toEqual(new Date('2025-01-03'));
      expect(result.versions).toHaveLength(3);
      expect(result.versions[0].version).toBe(3);
      expect(result.versions[0].factCount).toBe(5);
    });

    test('should return empty history when no versions exist', async () => {
      mockPrisma.documentIndex.findMany.mockResolvedValue([]);

      const result = await versionManager.getVersionHistory('doc-123');

      expect(result.docId).toBe('doc-123');
      expect(result.totalVersions).toBe(0);
      expect(result.latestVersion).toBe(0);
      expect(result.firstCreated).toBeNull();
      expect(result.lastUpdated).toBeNull();
      expect(result.versions).toEqual([]);
    });
  });

  describe('_extractFacts', () => {
    test('should extract facts from indexed text', () => {
      const text = '1. First fact\n2. Second fact\n3. Third fact';
      const facts = versionManager._extractFacts(text);

      expect(facts).toHaveLength(3);
      expect(facts[0]).toEqual({ index: 1, text: 'First fact' });
      expect(facts[1]).toEqual({ index: 2, text: 'Second fact' });
      expect(facts[2]).toEqual({ index: 3, text: 'Third fact' });
    });

    test('should handle different numbering formats', () => {
      const text = '1) First fact\n2) Second fact';
      const facts = versionManager._extractFacts(text);

      expect(facts).toHaveLength(2);
      expect(facts[0].text).toBe('First fact');
    });

    test('should ignore non-numbered lines', () => {
      const text = '1. First fact\nSome text\n2. Second fact';
      const facts = versionManager._extractFacts(text);

      expect(facts).toHaveLength(2);
    });
  });

  describe('_calculateSimilarity', () => {
    test('should return 1 for identical strings', () => {
      const similarity = versionManager._calculateSimilarity('hello', 'hello');
      expect(similarity).toBe(1);
    });

    test('should return low similarity for completely different strings', () => {
      const similarity = versionManager._calculateSimilarity('abc', 'xyz');
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThan(1);
    });

    test('should return value between 0 and 1 for similar strings', () => {
      const similarity = versionManager._calculateSimilarity('hello', 'hallo');
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1);
    });

    test('should handle empty strings', () => {
      const similarity = versionManager._calculateSimilarity('', '');
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('_compareFacts', () => {
    test('should detect added facts', () => {
      const text1 = '1. Fact one\n2. Fact two';
      const text2 = '1. Fact one\n2. Fact two\n3. Fact three';

      const comparison = versionManager._compareFacts(text1, text2);

      expect(comparison.added).toBe(1);
      expect(comparison.removed).toBe(0);
      expect(comparison.modified).toBe(0);
      expect(comparison.addedFacts[0].index).toBe(3);
    });

    test('should detect removed facts', () => {
      const text1 = '1. Fact one\n2. Fact two\n3. Fact three';
      const text2 = '1. Fact one\n2. Fact two';

      const comparison = versionManager._compareFacts(text1, text2);

      expect(comparison.added).toBe(0);
      expect(comparison.removed).toBe(1);
      expect(comparison.modified).toBe(0);
      expect(comparison.removedFacts[0].index).toBe(3);
    });

    test('should detect modified facts', () => {
      const text1 = '1. Fact one\n2. Fact two';
      const text2 = '1. Fact one modified\n2. Fact two';

      const comparison = versionManager._compareFacts(text1, text2);

      expect(comparison.added).toBe(0);
      expect(comparison.removed).toBe(0);
      expect(comparison.modified).toBe(1);
      expect(comparison.modifiedFacts[0].index).toBe(1);
      expect(comparison.modifiedFacts[0].oldText).toBe('Fact one');
      expect(comparison.modifiedFacts[0].newText).toBe('Fact one modified');
    });

    test('should detect unchanged facts', () => {
      const text1 = '1. Fact one\n2. Fact two';
      const text2 = '1. Fact one\n2. Fact two';

      const comparison = versionManager._compareFacts(text1, text2);

      expect(comparison.unchanged).toBe(2);
      expect(comparison.added).toBe(0);
      expect(comparison.removed).toBe(0);
      expect(comparison.modified).toBe(0);
    });
  });
});
