/**
 * Property-Based Tests for Note Storage Integrity
 * 
 * Feature: notes-feature, Property 3: 便签存储完整性
 * **Validates: Requirements 1.5**
 * 
 * Property: For any created note, saving it to the database and then
 * querying it back should return the same content, tags, and metadata.
 */

const fc = require('fast-check');
const {
  createNote,
  getNoteById,
  updateNote,
  listNotes,
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

describe('Note Storage Integrity - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await disconnect();
  });

  describe('Property 3: Note Storage Integrity', () => {
    /**
     * Property: Created note should be retrievable with same content
     */
    it('should retrieve note with same content after creation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 5000 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
          async (userId, content, tags) => {
            const noteId = 'test-note-id';
            const createdAt = new Date();
            const updatedAt = new Date();
            
            const mockNote = {
              id: noteId,
              userId,
              content,
              tags,
              createdAt,
              updatedAt,
              attachments: []
            };

            // Mock create
            prisma.note.create.mockResolvedValue(mockNote);
            
            // Mock findUnique
            prisma.note.findUnique.mockResolvedValue(mockNote);

            // Create note
            const created = await createNote({ userId, content, tags });
            
            // Retrieve note
            const retrieved = await getNoteById(noteId, userId);

            // Verify integrity
            expect(retrieved.content).toBe(created.content);
            expect(retrieved.tags).toEqual(created.tags);
            expect(retrieved.userId).toBe(created.userId);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Retrieved note should have all required fields
     */
    it('should retrieve note with all required fields', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 5000 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
          async (userId, content, tags) => {
            const mockNote = {
              id: 'test-note-id',
              userId,
              content,
              tags,
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments: []
            };

            prisma.note.create.mockResolvedValue(mockNote);
            prisma.note.findUnique.mockResolvedValue(mockNote);

            const created = await createNote({ userId, content, tags });
            const retrieved = await getNoteById(created.id, userId);

            // Verify all required fields exist
            expect(retrieved).toHaveProperty('id');
            expect(retrieved).toHaveProperty('userId');
            expect(retrieved).toHaveProperty('content');
            expect(retrieved).toHaveProperty('tags');
            expect(retrieved).toHaveProperty('createdAt');
            expect(retrieved).toHaveProperty('updatedAt');
            expect(retrieved).toHaveProperty('attachments');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Updated note should reflect changes when retrieved
     */
    it('should retrieve updated content after update', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 5000 }),
          fc.string({ minLength: 1, maxLength: 5000 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
          async (userId, originalContent, newContent, tags) => {
            const noteId = 'test-note-id';
            
            const originalNote = {
              id: noteId,
              userId,
              content: originalContent,
              tags,
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments: []
            };

            const updatedNote = {
              ...originalNote,
              content: newContent,
              updatedAt: new Date()
            };

            prisma.note.findUnique.mockResolvedValue(originalNote);
            prisma.note.update.mockResolvedValue(updatedNote);

            // Update note
            const updated = await updateNote(noteId, { content: newContent }, userId);
            
            // Mock retrieval of updated note
            prisma.note.findUnique.mockResolvedValue(updatedNote);
            const retrieved = await getNoteById(noteId, userId);

            // Verify updated content is retrieved
            expect(retrieved.content).toBe(newContent);
            expect(retrieved.id).toBe(noteId);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Tags should be preserved exactly as stored
     */
    it('should preserve tags exactly as stored', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 15 }),
          async (userId, content, tags) => {
            const mockNote = {
              id: 'test-note-id',
              userId,
              content,
              tags,
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments: []
            };

            prisma.note.create.mockResolvedValue(mockNote);
            prisma.note.findUnique.mockResolvedValue(mockNote);

            const created = await createNote({ userId, content, tags });
            const retrieved = await getNoteById(created.id, userId);

            // Tags should be exactly the same
            expect(retrieved.tags).toEqual(created.tags);
            expect(retrieved.tags.length).toBe(created.tags.length);
            
            // Each tag should match
            created.tags.forEach((tag, index) => {
              expect(retrieved.tags[index]).toBe(tag);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Empty tags array should be preserved
     */
    it('should preserve empty tags array', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          async (userId, content) => {
            const mockNote = {
              id: 'test-note-id',
              userId,
              content,
              tags: [],
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments: []
            };

            prisma.note.create.mockResolvedValue(mockNote);
            prisma.note.findUnique.mockResolvedValue(mockNote);

            const created = await createNote({ userId, content, tags: [] });
            const retrieved = await getNoteById(created.id, userId);

            expect(retrieved.tags).toEqual([]);
            expect(Array.isArray(retrieved.tags)).toBe(true);
            expect(retrieved.tags.length).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Metadata timestamps should be preserved
     */
    it('should preserve createdAt and updatedAt timestamps', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
          async (userId, content, tags) => {
            const createdAt = new Date();
            const updatedAt = new Date();
            
            const mockNote = {
              id: 'test-note-id',
              userId,
              content,
              tags,
              createdAt,
              updatedAt,
              attachments: []
            };

            prisma.note.create.mockResolvedValue(mockNote);
            prisma.note.findUnique.mockResolvedValue(mockNote);

            const created = await createNote({ userId, content, tags });
            const retrieved = await getNoteById(created.id, userId);

            expect(retrieved.createdAt).toEqual(created.createdAt);
            expect(retrieved.updatedAt).toEqual(created.updatedAt);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Attachments array should be preserved
     */
    it('should preserve attachments array structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
          fc.array(
            fc.record({
              id: fc.uuid(),
              type: fc.constantFrom('IMAGE', 'DOCUMENT', 'TABLE'),
              storageKey: fc.string({ minLength: 10, maxLength: 100 }),
              url: fc.webUrl(),
              size: fc.integer({ min: 0, max: 10000000 }),
              mimeType: fc.constantFrom('image/jpeg', 'image/png', 'application/pdf')
            }),
            { maxLength: 5 }
          ),
          async (userId, content, tags, attachments) => {
            const mockNote = {
              id: 'test-note-id',
              userId,
              content,
              tags,
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments
            };

            prisma.note.create.mockResolvedValue(mockNote);
            prisma.note.findUnique.mockResolvedValue(mockNote);

            const created = await createNote({ userId, content, tags });
            const retrieved = await getNoteById(created.id, userId);

            expect(Array.isArray(retrieved.attachments)).toBe(true);
            expect(retrieved.attachments.length).toBe(created.attachments.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: List operation should return notes with same data
     */
    it('should return notes with same data in list operation', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.record({
              content: fc.string({ minLength: 1, maxLength: 1000 }),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (userId, notesData) => {
            const mockNotes = notesData.map((data, index) => ({
              id: `note-${index}`,
              userId,
              content: data.content,
              tags: data.tags,
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments: []
            }));

            prisma.note.findMany.mockResolvedValue(mockNotes);
            prisma.note.count.mockResolvedValue(mockNotes.length);

            const result = await listNotes({ userId });

            expect(result.notes.length).toBe(mockNotes.length);
            
            result.notes.forEach((note, index) => {
              expect(note.content).toBe(mockNotes[index].content);
              expect(note.tags).toEqual(mockNotes[index].tags);
              expect(note.userId).toBe(userId);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Pagination should not affect data integrity
     */
    it('should maintain data integrity across pagination', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 5 }),
          fc.integer({ min: 1, max: 20 }),
          fc.array(
            fc.record({
              content: fc.string({ minLength: 1, maxLength: 1000 }),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
            }),
            { minLength: 1, maxLength: 10 }
          ),
          async (userId, page, limit, notesData) => {
            const mockNotes = notesData.map((data, index) => ({
              id: `note-${index}`,
              userId,
              content: data.content,
              tags: data.tags,
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments: []
            }));

            prisma.note.findMany.mockResolvedValue(mockNotes);
            prisma.note.count.mockResolvedValue(mockNotes.length);

            const result = await listNotes({ userId, page, limit });

            // Each note should have complete data
            result.notes.forEach(note => {
              expect(note).toHaveProperty('id');
              expect(note).toHaveProperty('content');
              expect(note).toHaveProperty('tags');
              expect(Array.isArray(note.tags)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Special characters in content should be preserved
     */
    it('should preserve special characters in content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 1000 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
          async (userId, content, tags) => {
            // Add special characters
            const specialContent = content + '\n\t"quotes" \'apostrophes\' & <html> 你好 🎉';
            
            const mockNote = {
              id: 'test-note-id',
              userId,
              content: specialContent,
              tags,
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments: []
            };

            prisma.note.create.mockResolvedValue(mockNote);
            prisma.note.findUnique.mockResolvedValue(mockNote);

            const created = await createNote({ userId, content: specialContent, tags });
            const retrieved = await getNoteById(created.id, userId);

            expect(retrieved.content).toBe(specialContent);
            expect(retrieved.content.length).toBe(specialContent.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Large content should be stored and retrieved correctly
     */
    it('should handle large content correctly', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 5000, maxLength: 10000 }),
          fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
          async (userId, content, tags) => {
            const mockNote = {
              id: 'test-note-id',
              userId,
              content,
              tags,
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments: []
            };

            prisma.note.create.mockResolvedValue(mockNote);
            prisma.note.findUnique.mockResolvedValue(mockNote);

            const created = await createNote({ userId, content, tags });
            const retrieved = await getNoteById(created.id, userId);

            expect(retrieved.content).toBe(content);
            expect(retrieved.content.length).toBe(content.length);
            expect(retrieved.tags).toEqual(tags);
          }
        ),
        { numRuns: 50 } // Fewer runs for large content
      );
    });

    /**
     * Property: Multiple notes should maintain individual integrity
     */
    it('should maintain integrity for multiple notes', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.array(
            fc.record({
              content: fc.string({ minLength: 1, maxLength: 1000 }),
              tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (userId, notesData) => {
            const mockNotes = notesData.map((data, index) => ({
              id: `note-${index}`,
              userId,
              content: data.content,
              tags: data.tags,
              createdAt: new Date(),
              updatedAt: new Date(),
              attachments: []
            }));

            // Mock creation and retrieval for each note
            for (let i = 0; i < mockNotes.length; i++) {
              prisma.note.create.mockResolvedValueOnce(mockNotes[i]);
              prisma.note.findUnique.mockResolvedValueOnce(mockNotes[i]);
            }

            // Create and retrieve each note
            for (let i = 0; i < notesData.length; i++) {
              const created = await createNote({
                userId,
                content: notesData[i].content,
                tags: notesData[i].tags
              });
              
              const retrieved = await getNoteById(created.id, userId);

              // Each note should maintain its own data
              expect(retrieved.content).toBe(notesData[i].content);
              expect(retrieved.tags).toEqual(notesData[i].tags);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
