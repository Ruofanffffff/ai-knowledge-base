/**
 * Search Routes Tests
 * 
 * Tests for search API endpoints.
 * Validates: Requirements 9.2, 9.3, 9.4, 9.5
 */

const request = require('supertest');
const express = require('express');
const searchRoutes = require('./searchRoutes');
const searchService = require('../services/notes/searchService');
const { authMiddleware } = require('../services/authService');

// Mock dependencies
jest.mock('../services/notes/searchService');
jest.mock('../services/authService');

describe('Search Routes', () => {
  let app;

  beforeEach(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/search', searchRoutes);

    // Mock auth middleware to inject user
    authMiddleware.mockImplementation((req, res, next) => {
      req.user = { id: 'test-user-id' };
      next();
    });

    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('GET /api/search', () => {
    it('should search notes successfully', async () => {
      const mockResults = {
        results: [
          {
            note: {
              id: 'note-1',
              content: 'Test note with keyword',
              tags: ['test'],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            highlights: [
              {
                field: 'content',
                snippet: 'Test note with <mark>keyword</mark>'
              }
            ],
            score: 50
          }
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      searchService.searchNotes.mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/api/search')
        .query({ query: 'keyword' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockResults);
      expect(searchService.searchNotes).toHaveBeenCalledWith({
        query: 'keyword',
        userId: 'test-user-id',
        tags: undefined,
        page: 1,
        limit: 20
      });
    });

    it('should search with tag filters', async () => {
      const mockResults = {
        results: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      };

      searchService.searchNotes.mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/api/search')
        .query({ 
          query: 'test',
          tags: 'work,important'
        });

      expect(response.status).toBe(200);
      expect(searchService.searchNotes).toHaveBeenCalledWith({
        query: 'test',
        userId: 'test-user-id',
        tags: ['work', 'important'],
        page: 1,
        limit: 20
      });
    });

    it('should search with custom pagination', async () => {
      const mockResults = {
        results: [],
        total: 50,
        page: 2,
        limit: 10,
        totalPages: 5
      };

      searchService.searchNotes.mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/api/search')
        .query({ 
          query: 'test',
          page: 2,
          limit: 10
        });

      expect(response.status).toBe(200);
      expect(searchService.searchNotes).toHaveBeenCalledWith({
        query: 'test',
        userId: 'test-user-id',
        tags: undefined,
        page: 2,
        limit: 10
      });
    });

    it('should return 400 if query is missing', async () => {
      const response = await request(app)
        .get('/api/search');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Query parameter is required');
      expect(searchService.searchNotes).not.toHaveBeenCalled();
    });

    it('should return 400 if query is empty', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ query: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Query parameter is required');
      expect(searchService.searchNotes).not.toHaveBeenCalled();
    });

    it('should return 400 if page is invalid', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ 
          query: 'test',
          page: 0
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Page must be a positive integer');
      expect(searchService.searchNotes).not.toHaveBeenCalled();
    });

    it('should return 400 if page is not a number', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ 
          query: 'test',
          page: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Page must be a positive integer');
      expect(searchService.searchNotes).not.toHaveBeenCalled();
    });

    it('should return 400 if limit is invalid', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ 
          query: 'test',
          limit: 0
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Limit must be a positive integer');
      expect(searchService.searchNotes).not.toHaveBeenCalled();
    });

    it('should return 400 if limit exceeds maximum', async () => {
      const response = await request(app)
        .get('/api/search')
        .query({ 
          query: 'test',
          limit: 101
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Limit must be a positive integer between 1 and 100');
      expect(searchService.searchNotes).not.toHaveBeenCalled();
    });

    it('should return 500 if search service throws error', async () => {
      searchService.searchNotes.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/search')
        .query({ query: 'test' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });

    it('should handle search with multiple results and highlights', async () => {
      const mockResults = {
        results: [
          {
            note: {
              id: 'note-1',
              content: 'First test note',
              tags: ['test', 'important'],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            highlights: [
              {
                field: 'content',
                snippet: 'First <mark>test</mark> note'
              },
              {
                field: 'tags',
                snippet: '#<mark>test</mark>'
              }
            ],
            score: 75
          },
          {
            note: {
              id: 'note-2',
              content: 'Second test note',
              tags: ['test'],
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            },
            highlights: [
              {
                field: 'content',
                snippet: 'Second <mark>test</mark> note'
              }
            ],
            score: 50
          }
        ],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      searchService.searchNotes.mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/api/search')
        .query({ query: 'test' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(2);
      expect(response.body.data.results[0].highlights).toHaveLength(2);
      expect(response.body.data.results[1].highlights).toHaveLength(1);
    });

    it('should log warning if search exceeds 500ms', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Mock slow search (> 500ms)
      searchService.searchNotes.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              results: [],
              total: 0,
              page: 1,
              limit: 20,
              totalPages: 0
            });
          }, 600);
        });
      });

      const response = await request(app)
        .get('/api/search')
        .query({ query: 'test' });

      expect(response.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Search took \d+ms, exceeding 500ms requirement/)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('GET /api/search/suggestions', () => {
    it('should get search suggestions successfully', async () => {
      const mockSuggestions = ['work', 'personal', 'important'];
      searchService.getSearchSuggestions.mockResolvedValue(mockSuggestions);

      const response = await request(app)
        .get('/api/search/suggestions');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toEqual(mockSuggestions);
      expect(searchService.getSearchSuggestions).toHaveBeenCalledWith('test-user-id', '');
    });

    it('should get suggestions with prefix filter', async () => {
      const mockSuggestions = ['work', 'workout'];
      searchService.getSearchSuggestions.mockResolvedValue(mockSuggestions);

      const response = await request(app)
        .get('/api/search/suggestions')
        .query({ prefix: 'wo' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toEqual(mockSuggestions);
      expect(searchService.getSearchSuggestions).toHaveBeenCalledWith('test-user-id', 'wo');
    });

    it('should return empty array if no suggestions found', async () => {
      searchService.getSearchSuggestions.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/search/suggestions')
        .query({ prefix: 'xyz' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.suggestions).toEqual([]);
    });

    it('should return 500 if service throws error', async () => {
      searchService.getSearchSuggestions.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/search/suggestions');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('Authentication', () => {
    it('should require authentication for search', async () => {
      authMiddleware.mockImplementation((req, res, next) => {
        res.status(401).json({ success: false, error: 'Unauthorized' });
      });

      const response = await request(app)
        .get('/api/search')
        .query({ query: 'test' });

      expect(response.status).toBe(401);
      expect(searchService.searchNotes).not.toHaveBeenCalled();
    });

    it('should require authentication for suggestions', async () => {
      authMiddleware.mockImplementation((req, res, next) => {
        res.status(401).json({ success: false, error: 'Unauthorized' });
      });

      const response = await request(app)
        .get('/api/search/suggestions');

      expect(response.status).toBe(401);
      expect(searchService.getSearchSuggestions).not.toHaveBeenCalled();
    });
  });
});
