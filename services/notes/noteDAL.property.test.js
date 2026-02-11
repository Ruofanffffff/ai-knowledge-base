/**
 * Property-Based Tests for Note Data Access Layer
 * 
 * Feature: notes-feature, Property 1: 标签识别和存储
 * **Validates: Requirements 1.2, 1.3**
 * 
 * Property: For any note with tags, the system should correctly store tags
 * and retrieve them with the note, maintaining tag integrity.
 */

const fc = require('fast-check');
const {
  createNote,
  getNoteById,
  updateNote,
  listNotes,
  getUserTags,
  searchNotes,
  disconnect,
  _prisma: prisma
} = require('./noteDAL');

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    note: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    $disconnect: jest.fn()
  };
  
  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

describe('Note DAL - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await disconnect();
  });

  describe('Property 1: Tag Identification and Storage', () => {
    /**
     * Property: Creating a note should store tags as an array
     */
    it('should store tags as an array when creating a note', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
          async (userId, content, tags) => {
            // Deduplicate tags as the DAL should do
            const uniqueTags = [...new Set(tags)];
            const mockNote = {
              id: 'note-id',
              userId,
              content,
              tags: uniqueTags,
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments: []
            };

            prisma.note.create.mockResolvedValue(mockNote);

            const result = await createNote({ userId, content, tags });

            expect(Array.isArray(result.tags)).toBe(true);
            const resultUniqueTags = new Set(result.tags);
            expect(result.tags.length).toBe(resultUniqueTags.size);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Retrieved note should have same tags as stored
     */
    it('should retrieve notes with same tags as stored', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
          async (userId, content, tags) => {
            const uniqueTags = [...new Set(tags)];
            const mockNote = {
              id: 'note-id',
              userId,
              content,
              tags: uniqueTags,
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments: []
            };

            prisma.note.findUnique.mockResolvedValue(mockNote);

            const result = await getNoteById('note-id', userId);

            expect(result.tags).toEqual(uniqueTags);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: getUserTags should return all unique tags
     */
    it('should return all unique tags for a user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
            { minLength: 1, maxLength: 10 }
          ),
          async (userId, notesTagArrays) => {
            const mockNotes = notesTagArrays.map(tags => ({ tags }));
            
            prisma.note.findMany.mockResolvedValue(mockNotes);

            const result = await getUserTags(userId);

            expect(Array.isArray(result)).toBe(true);
            
            const allTags = new Set();
            notesTagArrays.forEach(tags => {
              tags.forEach(tag => allTags.add(tag));
            });
            
            expect(result.length).toBe(allTags.size);
            
            const uniqueResult = new Set(result);
            expect(result.length).toBe(uniqueResult.size);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Listing notes should return array
     */
    it('should return array when listing notes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 1, max: 100 }),
          async (userId, page, limit) => {
            const mockNotes = [];
            prisma.note.findMany.mockResolvedValue(mockNotes);
            prisma.note.count.mockResolvedValue(0);

            const result = await listNotes({ userId, page, limit });

            expect(Array.isArray(result.notes)).toBe(true);
            expect(result.page).toBe(page);
            expect(result.limit).toBe(limit);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Searching should return results with query
     */
    it('should return search results for any query', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (userId, query) => {
            const mockNotes = [];
            prisma.note.findMany.mockResolvedValue(mockNotes);
            prisma.note.count.mockResolvedValue(0);

            const result = await searchNotes({ query, userId });

            expect(Array.isArray(result.notes)).toBe(true);
            expect(result.total).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Empty tags array should be handled correctly
     */
    it('should handle empty tags array', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1 }),
          async (userId, content) => {
            const mockNote = {
              id: 'note-id',
              userId,
              content,
              tags: [],
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments: []
            };

            prisma.note.create.mockResolvedValue(mockNote);

            const result = await createNote({ userId, content, tags: [] });

            expect(Array.isArray(result.tags)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Updating note should maintain tag array structure
     */
    it('should maintain tag array structure when updating', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1 }),
          fc.array(fc.string({ minLength: 1, maxLength: 20 }), { maxLength: 5 }),
          async (userId, content, newTags) => {
            const existingNote = {
              id: 'note-id',
              userId,
              content: 'old content',
              tags: ['old']
            };

            const updatedNote = {
              id: 'note-id',
              userId,
              content,
              tags: newTags,
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments: []
            };

            prisma.note.findUnique.mockResolvedValue(existingNote);
            prisma.note.update.mockResolvedValue(updatedNote);

            const result = await updateNote('note-id', { tags: newTags }, userId);

            expect(Array.isArray(result.tags)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    /**
     * Property: Count should return non-negative number
     */
    it('should return non-negative count for any user', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 0, max: 1000 }),
          async (userId, count) => {
            prisma.note.count.mockResolvedValue(count);

            const result = await require('./noteDAL').countNotesByUser(userId);

            expect(result).toBeGreaterThanOrEqual(0);
            expect(Number.isInteger(result)).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
