/**
 * Unit tests for Note Data Access Layer
 * 
 * Tests database operations for Note model.
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5
 */

const {
  createNote,
  getNoteById,
  updateNote,
  deleteNote,
  listNotes,
  getUserTags,
  countNotesByUser,
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
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn()
    },
    $disconnect: jest.fn()
  };
  
  return {
    PrismaClient: jest.fn(() => mockPrisma)
  };
});

describe('Note DAL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue(null);
  });

  afterAll(async () => {
    await disconnect();
  });

  describe('createNote', () => {
    it('should create a note with extracted tags', async () => {
      const mockNote = {
        id: 'note-1',
        userId: 'user-1',
        content: 'Test note #work #important',
        tags: ['work', 'important'],
        createdAt: new Date(),
        updatedAt: new Date(),
        attachments: []
      };

      prisma.note.create.mockResolvedValue(mockNote);

      const result = await createNote({
        userId: 'user-1',
        content: 'Test note #work #important'
      });

      expect(result).toMatchObject(mockNote);
      expect(result.title).toEqual(expect.any(String));
      expect(prisma.note.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          content: 'Test note #work #important',
          tags: JSON.stringify(['work', 'important'])
        },
        include: {
          attachments: true
        }
      });
    });

    it('should create a note with provided tags', async () => {
      const mockNote = {
        id: 'note-1',
        userId: 'user-1',
        content: 'Test note',
        tags: ['custom', 'tags'],
        createdAt: new Date(),
        updatedAt: new Date(),
        attachments: []
      };

      prisma.note.create.mockResolvedValue(mockNote);

      const result = await createNote({
        userId: 'user-1',
        content: 'Test note',
        tags: ['custom', 'tags']
      });

      expect(result).toMatchObject(mockNote);
      expect(result.title).toEqual(expect.any(String));
      expect(prisma.note.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          content: 'Test note',
          tags: JSON.stringify(['custom', 'tags'])
        },
        include: {
          attachments: true
        }
      });
    });

    it('should create a note and ensure user exists when user object is provided', async () => {
      const mockUser = {
        id: 'user-1',
        username: 'testuser',
        email: 'test@example.com'
      };
      
      const mockNote = {
        id: 'note-1',
        userId: 'user-1',
        content: 'Test note',
        tags: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        attachments: []
      };

      prisma.user.upsert.mockResolvedValue(mockUser);
      prisma.note.create.mockResolvedValue(mockNote);

      const result = await createNote({
        user: mockUser,
        content: 'Test note'
      });

      expect(result).toMatchObject(mockNote);
      expect(result.title).toEqual(expect.any(String));
      expect(prisma.user.upsert).toHaveBeenCalled();
      expect(prisma.note.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1' })
      }));
    });


    it('should throw error if userId is missing', async () => {
      await expect(createNote({ content: 'Test' })).rejects.toThrow(
        'user object or userId is required'
      );
    });

    it('should throw error if content is missing', async () => {
      await expect(createNote({ userId: 'user-1' })).rejects.toThrow(
        'content is required'
      );
    });
  });

  describe('getNoteById', () => {
    it('should get a note by ID', async () => {
      const mockNote = {
        id: 'note-1',
        userId: 'user-1',
        content: 'Test note',
        tags: ['work'],
        createdAt: new Date(),
        updatedAt: new Date(),
        attachments: []
      };

      prisma.note.findUnique.mockResolvedValue(mockNote);

      const result = await getNoteById('note-1');

      expect(result).toMatchObject(mockNote);
      expect(result.title).toEqual(expect.any(String));
      expect(prisma.note.findUnique).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        include: {
          attachments: true
        }
      });
    });

    it('should derive plain-text title from html content', async () => {
      const mockNote = {
        id: 'note-html-1',
        userId: 'user-1',
        content: '<h1>测试标题</h1><p>正文内容</p>',
        tags: '[]',
        createdAt: new Date(),
        updatedAt: new Date(),
        attachments: []
      };

      prisma.note.findUnique.mockResolvedValue(mockNote);

      const result = await getNoteById('note-html-1');
      expect(result?.title).toBe('测试标题 正文内容');
    });

    it('should get a note by ID with user filter', async () => {
      const mockNote = {
        id: 'note-1',
        userId: 'user-1',
        content: 'Test note',
        tags: ['work'],
        createdAt: new Date(),
        updatedAt: new Date(),
        attachments: []
      };

      prisma.note.findUnique.mockResolvedValue(mockNote);

      const result = await getNoteById('note-1', 'user-1');

      expect(result).toMatchObject(mockNote);
      expect(result.title).toEqual(expect.any(String));
      expect(prisma.note.findUnique).toHaveBeenCalledWith({
        where: { id: 'note-1', userId: 'user-1' },
        include: {
          attachments: true
        }
      });
    });

    it('should return null if note not found', async () => {
      prisma.note.findUnique.mockResolvedValue(null);

      const result = await getNoteById('non-existent');

      expect(result).toBeNull();
    });

    it('should throw error if noteId is missing', async () => {
      await expect(getNoteById()).rejects.toThrow('noteId is required');
    });
  });

  describe('updateNote', () => {
    it('should update note content and re-extract tags', async () => {
      const existingNote = {
        id: 'note-1',
        userId: 'user-1',
        content: 'Old content',
        tags: ['old']
      };

      const updatedNote = {
        id: 'note-1',
        userId: 'user-1',
        content: 'New content #new #tags',
        tags: ['new', 'tags'],
        createdAt: new Date(),
        updatedAt: new Date(),
        attachments: []
      };

      prisma.note.findUnique.mockResolvedValue(existingNote);
      prisma.note.update.mockResolvedValue(updatedNote);

      const result = await updateNote('note-1', {
        content: 'New content #new #tags'
      });

      expect(result).toMatchObject(updatedNote);
      expect(result.title).toEqual(expect.any(String));
      expect(prisma.note.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: {
          content: 'New content #new #tags',
          tags: JSON.stringify(['new', 'tags'])
        },
        include: {
          attachments: true
        }
      });
    });

    it('should update note with explicit tags', async () => {
      const existingNote = {
        id: 'note-1',
        userId: 'user-1',
        content: 'Content',
        tags: ['old']
      };

      const updatedNote = {
        id: 'note-1',
        userId: 'user-1',
        content: 'Content',
        tags: ['custom', 'tags'],
        createdAt: new Date(),
        updatedAt: new Date(),
        attachments: []
      };

      prisma.note.findUnique.mockResolvedValue(existingNote);
      prisma.note.update.mockResolvedValue(updatedNote);

      const result = await updateNote('note-1', {
        tags: ['custom', 'tags']
      });

      expect(result).toMatchObject(updatedNote);
      expect(result.title).toEqual(expect.any(String));
      expect(prisma.note.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: {
          tags: JSON.stringify(['custom', 'tags'])
        },
        include: {
          attachments: true
        }
      });
    });

    it('should throw error if note not found', async () => {
      prisma.note.findUnique.mockResolvedValue(null);

      await expect(updateNote('non-existent', { content: 'New' })).rejects.toThrow(
        'Note not found'
      );
    });

    it('should throw error if noteId is missing', async () => {
      await expect(updateNote(null, { content: 'New' })).rejects.toThrow(
        'noteId is required'
      );
    });
  });

  describe('deleteNote', () => {
    it('should delete a note', async () => {
      const existingNote = {
        id: 'note-1',
        userId: 'user-1',
        content: 'Test note',
        tags: ['work']
      };

      const deletedNote = { ...existingNote };

      prisma.note.findUnique.mockResolvedValue(existingNote);
      prisma.note.delete.mockResolvedValue(deletedNote);

      const result = await deleteNote('note-1');

      expect(result).toMatchObject(deletedNote);
      expect(result.title).toEqual(expect.any(String));
      expect(prisma.note.delete).toHaveBeenCalledWith({
        where: { id: 'note-1' }
      });
    });

    it('should throw error if note not found', async () => {
      prisma.note.findUnique.mockResolvedValue(null);

      await expect(deleteNote('non-existent')).rejects.toThrow('Note not found');
    });

    it('should throw error if noteId is missing', async () => {
      await expect(deleteNote()).rejects.toThrow('noteId is required');
    });
  });

  describe('listNotes', () => {
    it('should list notes with default pagination', async () => {
      const mockNotes = [
        {
          id: 'note-1',
          userId: 'user-1',
          content: 'Note 1',
          tags: ['work'],
          createdAt: new Date(),
          updatedAt: new Date(),
          attachments: []
        },
        {
          id: 'note-2',
          userId: 'user-1',
          content: 'Note 2',
          tags: ['personal'],
          createdAt: new Date(),
          updatedAt: new Date(),
          attachments: []
        }
      ];

      prisma.note.findMany.mockResolvedValue(mockNotes);
      prisma.note.count.mockResolvedValue(2);

      const result = await listNotes({ userId: 'user-1' });

      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.notes).toHaveLength(2);
      result.notes.forEach(note => {
        expect(note.title).toEqual(expect.any(String));
      });
    });

    it('should list notes with custom pagination', async () => {
      const mockNotes = [
        {
          id: 'note-3',
          userId: 'user-1',
          content: 'Note 3',
          tags: ['work'],
          createdAt: new Date(),
          updatedAt: new Date(),
          attachments: []
        }
      ];

      prisma.note.findMany.mockResolvedValue(mockNotes);
      prisma.note.count.mockResolvedValue(25);

      const result = await listNotes({
        userId: 'user-1',
        page: 2,
        limit: 10
      });

      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3);
      expect(result.notes).toHaveLength(1);
      expect(result.notes[0].title).toEqual(expect.any(String));

      expect(prisma.note.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        skip: 10,
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          attachments: true
        }
      });
    });

    it('should filter notes by tags', async () => {
      const mockNotes = [
        {
          id: 'note-1',
          userId: 'user-1',
          content: 'Note 1',
          tags: ['work', 'important'],
          createdAt: new Date(),
          updatedAt: new Date(),
          attachments: []
        }
      ];

      prisma.note.findMany.mockResolvedValue(mockNotes);
      prisma.note.count.mockResolvedValue(1);

      const result = await listNotes({
        userId: 'user-1',
        tags: ['work']
      });

      expect(result.notes).toMatchObject(mockNotes);
      expect(result.notes[0].title).toEqual(expect.any(String));
      expect(prisma.note.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          OR: [{ tags: { contains: '"work"' } }]
        },
        skip: 0,
        take: 20,
        orderBy: { createdAt: 'desc' },
        include: {
          attachments: true
        }
      });
    });
  });

  describe('getUserTags', () => {
    it('should get all unique tags for a user', async () => {
      const mockNotes = [
        { tags: ['work', 'important'] },
        { tags: ['personal', 'work'] },
        { tags: ['project'] }
      ];

      prisma.note.findMany.mockResolvedValue(mockNotes);

      const result = await getUserTags('user-1');

      expect(result).toEqual(['important', 'personal', 'project', 'work']);
    });

    it('should return empty array if no notes', async () => {
      prisma.note.findMany.mockResolvedValue([]);

      const result = await getUserTags('user-1');

      expect(result).toEqual([]);
    });

    it('should throw error if userId is missing', async () => {
      await expect(getUserTags()).rejects.toThrow('userId is required');
    });
  });

  describe('countNotesByUser', () => {
    it('should count notes for a user', async () => {
      prisma.note.count.mockResolvedValue(5);

      const result = await countNotesByUser('user-1');

      expect(result).toBe(5);
      expect(prisma.note.count).toHaveBeenCalledWith({
        where: { userId: 'user-1' }
      });
    });

    it('should throw error if userId is missing', async () => {
      await expect(countNotesByUser()).rejects.toThrow('userId is required');
    });
  });

  describe('searchNotes', () => {
    it('should search notes by content', async () => {
      const mockNotes = [
        {
          id: 'note-1',
          userId: 'user-1',
          content: 'This contains the search term',
          tags: ['work'],
          createdAt: new Date(),
          updatedAt: new Date(),
          attachments: []
        }
      ];

      prisma.note.findMany.mockResolvedValue(mockNotes);
      prisma.note.count.mockResolvedValue(1);

      const result = await searchNotes({
        query: 'search',
        userId: 'user-1'
      });

      expect(result.notes).toMatchObject(mockNotes);
      expect(result.notes[0].title).toEqual(expect.any(String));
      expect(result.total).toBe(1);
    });

    it('should search notes by tags', async () => {
      const mockNotes = [
        {
          id: 'note-1',
          userId: 'user-1',
          content: 'Note content',
          tags: ['work', 'important'],
          createdAt: new Date(),
          updatedAt: new Date(),
          attachments: []
        }
      ];

      prisma.note.findMany.mockResolvedValue(mockNotes);
      prisma.note.count.mockResolvedValue(1);

      const result = await searchNotes({
        query: 'work',
        userId: 'user-1'
      });

      expect(result.notes).toMatchObject(mockNotes);
      expect(result.notes[0].title).toEqual(expect.any(String));
    });

    it('should throw error if query is missing', async () => {
      await expect(searchNotes({ userId: 'user-1' })).rejects.toThrow(
        'query is required'
      );
    });
  });
});
