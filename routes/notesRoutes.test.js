/**
 * Notes API Routes Unit Tests
 * 
 * Tests the REST API endpoints for note management.
 */

const request = require('supertest');
const express = require('express');
const notesRoutes = require('./notesRoutes');
const noteDAL = require('../services/notes/noteDAL');

// Mock the noteDAL module
jest.mock('../services/notes/noteDAL');

// Mock auth middleware
jest.mock('../services/authService', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/notes', notesRoutes);

describe('Notes API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/notes', () => {
    it('should create a new note with content', async () => {
      const mockNote = {
        id: 'note-1',
        userId: 'test-user-id',
        content: 'Test note #test',
        tags: ['test'],
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      noteDAL.createNote.mockResolvedValue(mockNote);

      const response = await request(app)
        .post('/api/notes')
        .send({ content: 'Test note #test' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockNote);
      expect(noteDAL.createNote).toHaveBeenCalledWith({
        userId: 'test-user-id',
        content: 'Test note #test',
        tags: undefined
      });
    });

    it('should create a note with explicit tags', async () => {
      const mockNote = {
        id: 'note-1',
        userId: 'test-user-id',
        content: 'Test note',
        tags: ['work', 'important'],
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      noteDAL.createNote.mockResolvedValue(mockNote);

      const response = await request(app)
        .post('/api/notes')
        .send({
          content: 'Test note',
          tags: ['work', 'important']
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toEqual(['work', 'important']);
    });

    it('should return 400 if content is missing', async () => {
      const response = await request(app)
        .post('/api/notes')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Content is required');
      expect(noteDAL.createNote).not.toHaveBeenCalled();
    });

    it('should handle errors from noteDAL', async () => {
      noteDAL.createNote.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/notes')
        .send({ content: 'Test note' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /api/notes/:id', () => {
    it('should get a note by ID', async () => {
      const mockNote = {
        id: 'note-1',
        userId: 'test-user-id',
        content: 'Test note',
        tags: ['test'],
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      noteDAL.getNoteById.mockResolvedValue(mockNote);

      const response = await request(app)
        .get('/api/notes/note-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockNote);
      expect(noteDAL.getNoteById).toHaveBeenCalledWith('note-1', 'test-user-id');
    });

    it('should return 404 if note not found', async () => {
      noteDAL.getNoteById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/notes/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Note not found');
    });

    it('should handle errors from noteDAL', async () => {
      noteDAL.getNoteById.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/notes/note-1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('PUT /api/notes/:id', () => {
    it('should update note content', async () => {
      const mockNote = {
        id: 'note-1',
        userId: 'test-user-id',
        content: 'Updated content',
        tags: ['test'],
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      noteDAL.updateNote.mockResolvedValue(mockNote);

      const response = await request(app)
        .put('/api/notes/note-1')
        .send({ content: 'Updated content' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockNote);
      expect(noteDAL.updateNote).toHaveBeenCalledWith(
        'note-1',
        { content: 'Updated content', tags: undefined },
        'test-user-id'
      );
    });

    it('should update note tags', async () => {
      const mockNote = {
        id: 'note-1',
        userId: 'test-user-id',
        content: 'Test note',
        tags: ['updated', 'tags'],
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      noteDAL.updateNote.mockResolvedValue(mockNote);

      const response = await request(app)
        .put('/api/notes/note-1')
        .send({ tags: ['updated', 'tags'] })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toEqual(['updated', 'tags']);
    });

    it('should return 400 if no fields provided', async () => {
      const response = await request(app)
        .put('/api/notes/note-1')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('At least one field (content or tags) must be provided');
      expect(noteDAL.updateNote).not.toHaveBeenCalled();
    });

    it('should return 404 if note not found', async () => {
      noteDAL.updateNote.mockRejectedValue(new Error('Note not found'));

      const response = await request(app)
        .put('/api/notes/nonexistent')
        .send({ content: 'Updated' })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Note not found');
    });

    it('should handle other errors from noteDAL', async () => {
      noteDAL.updateNote.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .put('/api/notes/note-1')
        .send({ content: 'Updated' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('DELETE /api/notes/:id', () => {
    it('should delete a note', async () => {
      const mockNote = {
        id: 'note-1',
        userId: 'test-user-id',
        content: 'Test note',
        tags: ['test'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      noteDAL.deleteNote.mockResolvedValue(mockNote);

      const response = await request(app)
        .delete('/api/notes/note-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockNote);
      expect(noteDAL.deleteNote).toHaveBeenCalledWith('note-1', 'test-user-id');
    });

    it('should return 404 if note not found', async () => {
      noteDAL.deleteNote.mockRejectedValue(new Error('Note not found'));

      const response = await request(app)
        .delete('/api/notes/nonexistent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Note not found');
    });

    it('should handle errors from noteDAL', async () => {
      noteDAL.deleteNote.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .delete('/api/notes/note-1')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /api/notes', () => {
    it('should list notes with default pagination', async () => {
      const mockResult = {
        notes: [
          {
            id: 'note-1',
            userId: 'test-user-id',
            content: 'Note 1',
            tags: ['test'],
            attachments: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          {
            id: 'note-2',
            userId: 'test-user-id',
            content: 'Note 2',
            tags: ['work'],
            attachments: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      noteDAL.listNotes.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/notes')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResult);
      expect(noteDAL.listNotes).toHaveBeenCalledWith({
        userId: 'test-user-id',
        tags: undefined,
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        order: 'desc'
      });
    });

    it('should list notes with custom pagination', async () => {
      const mockResult = {
        notes: [],
        total: 50,
        page: 2,
        limit: 10,
        totalPages: 5
      };

      noteDAL.listNotes.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/notes?page=2&limit=10')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(noteDAL.listNotes).toHaveBeenCalledWith({
        userId: 'test-user-id',
        tags: undefined,
        page: 2,
        limit: 10,
        sortBy: 'createdAt',
        order: 'desc'
      });
    });

    it('should filter notes by tags', async () => {
      const mockResult = {
        notes: [],
        total: 5,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      noteDAL.listNotes.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/notes?tags=work,important')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(noteDAL.listNotes).toHaveBeenCalledWith({
        userId: 'test-user-id',
        tags: ['work', 'important'],
        page: 1,
        limit: 20,
        sortBy: 'createdAt',
        order: 'desc'
      });
    });

    it('should sort notes by updatedAt', async () => {
      const mockResult = {
        notes: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      };

      noteDAL.listNotes.mockResolvedValue(mockResult);

      const response = await request(app)
        .get('/api/notes?sortBy=updatedAt&order=asc')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(noteDAL.listNotes).toHaveBeenCalledWith({
        userId: 'test-user-id',
        tags: undefined,
        page: 1,
        limit: 20,
        sortBy: 'updatedAt',
        order: 'asc'
      });
    });

    it('should return 400 for invalid sortBy', async () => {
      const response = await request(app)
        .get('/api/notes?sortBy=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid sortBy parameter');
      expect(noteDAL.listNotes).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid order', async () => {
      const response = await request(app)
        .get('/api/notes?order=invalid')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid order parameter');
      expect(noteDAL.listNotes).not.toHaveBeenCalled();
    });

    it('should handle errors from noteDAL', async () => {
      noteDAL.listNotes.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/notes')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /api/notes/tags/all', () => {
    it('should get all user tags', async () => {
      const mockTags = ['work', 'personal', 'important', 'test'];

      noteDAL.getUserTags.mockResolvedValue(mockTags);

      const response = await request(app)
        .get('/api/notes/tags/all')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toEqual(mockTags);
      expect(noteDAL.getUserTags).toHaveBeenCalledWith('test-user-id');
    });

    it('should return empty array if no tags', async () => {
      noteDAL.getUserTags.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/notes/tags/all')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toEqual([]);
    });

    it('should handle errors from noteDAL', async () => {
      noteDAL.getUserTags.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/notes/tags/all')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /api/notes/stats/count', () => {
    it('should get note count', async () => {
      noteDAL.countNotesByUser.mockResolvedValue(42);

      const response = await request(app)
        .get('/api/notes/stats/count')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(42);
      expect(noteDAL.countNotesByUser).toHaveBeenCalledWith('test-user-id');
    });

    it('should return 0 if no notes', async () => {
      noteDAL.countNotesByUser.mockResolvedValue(0);

      const response = await request(app)
        .get('/api/notes/stats/count')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBe(0);
    });

    it('should handle errors from noteDAL', async () => {
      noteDAL.countNotesByUser.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/notes/stats/count')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });
});
