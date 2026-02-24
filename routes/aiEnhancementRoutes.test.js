/**
 * AI Enhancement Routes Tests
 * 
 * Tests for AI enhancement API endpoints.
 * Validates: Requirements 5.2, 6.1, 7.1, 8.1
 */

const request = require('supertest');
const express = require('express');

// Mock dependencies BEFORE requiring the routes
jest.mock('../services/authService', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

// Create mock AI service
const mockAIService = {
  generate: jest.fn(),
  proofread: jest.fn(),
  generateTable: jest.fn(),
  generateMindMap: jest.fn(),
  getStats: jest.fn()
};

jest.mock('../services/notes/aiEnhancementService', () => ({
  createAIEnhancementService: jest.fn(() => mockAIService)
}));

// Now require the routes after mocks are set up
const aiEnhancementRoutes = require('./aiEnhancementRoutes');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/ai', aiEnhancementRoutes);

describe('AI Enhancement Routes', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });

  // ============================================
  // POST /api/ai/generate - Smart Generation
  // ============================================

  describe('POST /api/ai/generate', () => {
    it('should expand text and generate image prompt', async () => {
      // Mock service response
      mockAIService.generate.mockResolvedValue({
        expandedText: 'This is an expanded version of the original text with more details and context.',
        imagePrompt: 'A beautiful landscape with mountains and a lake, photorealistic, 4k',
        tokens: 150,
        model: 'gpt-4'
      });

      const response = await request(app)
        .post('/api/ai/generate')
        .send({
          text: 'A beautiful landscape'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('expandedText');
      expect(response.body.data).toHaveProperty('imagePrompt');
      expect(response.body.data.metadata).toHaveProperty('model');
      expect(response.body.data.metadata).toHaveProperty('tokens');

      expect(mockAIService.generate).toHaveBeenCalledWith({
        text: 'A beautiful landscape',
        context: undefined,
        style: undefined
      });
    });

    it('should accept optional context and style parameters', async () => {
      mockAIService.generate.mockResolvedValue({
        expandedText: 'Professional expanded text',
        imagePrompt: 'Professional image prompt',
        tokens: 100,
        model: 'gpt-4'
      });

      const response = await request(app)
        .post('/api/ai/generate')
        .send({
          text: 'Test text',
          context: 'Business context',
          style: 'professional'
        });

      expect(response.status).toBe(200);
      expect(mockAIService.generate).toHaveBeenCalledWith({
        text: 'Test text',
        context: 'Business context',
        style: 'professional'
      });
    });

    it('should return 400 if text is missing', async () => {
      const response = await request(app)
        .post('/api/ai/generate')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('text is required');
    });

    it('should return 400 if text is not a string', async () => {
      const response = await request(app)
        .post('/api/ai/generate')
        .send({ text: 123 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('text must be a string');
    });

    it('should return 400 if text is empty', async () => {
      const response = await request(app)
        .post('/api/ai/generate')
        .send({ text: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('text cannot be empty');
    });

    it('should return 400 if style is invalid', async () => {
      const response = await request(app)
        .post('/api/ai/generate')
        .send({
          text: 'Test text',
          style: 'invalid-style'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('style must be one of');
    });

    it('should return 504 on timeout', async () => {
      mockAIService.generate.mockRejectedValue(new Error('Operation timed out after 5000ms'));

      const response = await request(app)
        .post('/api/ai/generate')
        .send({ text: 'Test text' });

      expect(response.status).toBe(504);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('timed out');
    });

    it('should return 502 on LLM service error', async () => {
      mockAIService.generate.mockRejectedValue(new Error('LLM API error'));

      const response = await request(app)
        .post('/api/ai/generate')
        .send({ text: 'Test text' });

      expect(response.status).toBe(502);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('AI service temporarily unavailable');
    });
  });

  // ============================================
  // POST /api/ai/proofread - Smart Proofreading
  // ============================================

  describe('POST /api/ai/proofread', () => {
    it('should proofread text and return corrections', async () => {
      // Mock service response
      mockAIService.proofread.mockResolvedValue({
        correctedText: 'This is the corrected text.',
        changes: [
          {
            type: 'spelling',
            original: 'teh',
            corrected: 'the',
            position: { start: 8, end: 11 }
          }
        ],
        tokens: 80,
        model: 'gpt-4'
      });

      const response = await request(app)
        .post('/api/ai/proofread')
        .send({
          text: 'This is teh text.'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('correctedText');
      expect(response.body.data).toHaveProperty('changes');
      expect(Array.isArray(response.body.data.changes)).toBe(true);
      expect(response.body.data.metadata).toHaveProperty('model');
      expect(response.body.data.metadata).toHaveProperty('tokens');

      expect(mockAIService.proofread).toHaveBeenCalledWith({
        text: 'This is teh text.',
        language: undefined
      });
    });

    it('should accept optional language parameter', async () => {
      mockAIService.proofread.mockResolvedValue({
        correctedText: '这是修正后的文本。',
        changes: [],
        tokens: 50,
        model: 'gpt-4'
      });

      const response = await request(app)
        .post('/api/ai/proofread')
        .send({
          text: '这是文本。',
          language: 'zh'
        });

      expect(response.status).toBe(200);
      expect(mockAIService.proofread).toHaveBeenCalledWith({
        text: '这是文本。',
        language: 'zh'
      });
    });

    it('should return 400 if text is missing', async () => {
      const response = await request(app)
        .post('/api/ai/proofread')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('text is required');
    });

    it('should return 400 if text is not a string', async () => {
      const response = await request(app)
        .post('/api/ai/proofread')
        .send({ text: 123 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('text must be a string');
    });

    it('should return 400 if text is empty', async () => {
      const response = await request(app)
        .post('/api/ai/proofread')
        .send({ text: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('text cannot be empty');
    });

    it('should return 504 on timeout', async () => {
      mockAIService.proofread.mockRejectedValue(new Error('Operation timed out after 5000ms'));

      const response = await request(app)
        .post('/api/ai/proofread')
        .send({ text: 'Test text' });

      expect(response.status).toBe(504);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('timed out');
    });
  });

  // ============================================
  // POST /api/ai/generate-table - Table Generation
  // ============================================

  describe('POST /api/ai/generate-table', () => {
    it('should generate table from text', async () => {
      // Mock service response
      mockAIService.generateTable.mockResolvedValue({
        table: {
          headers: ['Name', 'Age', 'City'],
          rows: [
            ['Alice', '30', 'New York'],
            ['Bob', '25', 'London']
          ]
        },
        notes: 'Table generated from text',
        tokens: 120,
        model: 'gpt-4'
      });

      const response = await request(app)
        .post('/api/ai/generate-table')
        .send({
          text: 'Alice is 30 years old and lives in New York. Bob is 25 and lives in London.'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('table');
      expect(response.body.data.table).toHaveProperty('headers');
      expect(response.body.data.table).toHaveProperty('rows');
      expect(Array.isArray(response.body.data.table.headers)).toBe(true);
      expect(Array.isArray(response.body.data.table.rows)).toBe(true);
      expect(response.body.data.metadata).toHaveProperty('model');
      expect(response.body.data.metadata).toHaveProperty('tokens');

      expect(mockAIService.generateTable).toHaveBeenCalledWith({
        text: 'Alice is 30 years old and lives in New York. Bob is 25 and lives in London.',
        maxColumns: undefined
      });
    });

    it('should accept optional maxColumns parameter', async () => {
      mockAIService.generateTable.mockResolvedValue({
        table: {
          headers: ['Name', 'Age'],
          rows: [['Alice', '30']]
        },
        tokens: 80,
        model: 'gpt-4'
      });

      const response = await request(app)
        .post('/api/ai/generate-table')
        .send({
          text: 'Alice is 30',
          maxColumns: 2
        });

      expect(response.status).toBe(200);
      expect(mockAIService.generateTable).toHaveBeenCalledWith({
        text: 'Alice is 30',
        maxColumns: 2
      });
    });

    it('should return 400 if text is missing', async () => {
      const response = await request(app)
        .post('/api/ai/generate-table')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('text is required');
    });

    it('should return 400 if maxColumns is invalid', async () => {
      const response = await request(app)
        .post('/api/ai/generate-table')
        .send({
          text: 'Test text',
          maxColumns: 0
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('maxColumns must be a number between 1 and 20');
    });

    it('should return 504 on timeout', async () => {
      mockAIService.generateTable.mockRejectedValue(new Error('Operation timed out after 5000ms'));

      const response = await request(app)
        .post('/api/ai/generate-table')
        .send({ text: 'Test text' });

      expect(response.status).toBe(504);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('timed out');
    });
  });

  // ============================================
  // POST /api/ai/generate-mindmap - Mind Map Generation
  // ============================================

  describe('POST /api/ai/generate-mindmap', () => {
    it('should generate mind map from text', async () => {
      // Mock service response with new central_topic + nodes format
      mockAIService.generateMindMap.mockResolvedValue({
        mindmap: {
          central_topic: 'Project Planning',
          nodes: [
            {
              id: '1',
              text: 'Research',
              children: [
                { id: '1-1', text: 'Market Analysis' },
                { id: '1-2', text: 'Competitor Study' }
              ]
            },
            {
              id: '2',
              text: 'Development',
              children: [
                { id: '2-1', text: 'Frontend' },
                { id: '2-2', text: 'Backend' }
              ]
            },
            {
              id: '3',
              text: 'Testing'
            }
          ]
        },
        tokens: 150,
        model: 'gpt-4'
      });

      const response = await request(app)
        .post('/api/ai/generate-mindmap')
        .send({
          text: 'We need to plan our project including research, development, and testing phases.'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('mindmap');
      expect(response.body.data.mindmap).toHaveProperty('central_topic');
      expect(response.body.data.mindmap).toHaveProperty('nodes');
      expect(Array.isArray(response.body.data.mindmap.nodes)).toBe(true);
      expect(response.body.data.mindmap.central_topic).toBe('Project Planning');
      expect(response.body.data.mindmap.nodes).toHaveLength(3);
      expect(response.body.data.mindmap.nodes[0]).toHaveProperty('id');
      expect(response.body.data.mindmap.nodes[0]).toHaveProperty('text');
      expect(response.body.data.metadata).toHaveProperty('model');
      expect(response.body.data.metadata).toHaveProperty('tokens');

      expect(mockAIService.generateMindMap).toHaveBeenCalledWith({
        text: 'We need to plan our project including research, development, and testing phases.',
        maxBranches: undefined,
        maxDepth: undefined
      });
    });

    it('should accept optional maxBranches and maxDepth parameters', async () => {
      mockAIService.generateMindMap.mockResolvedValue({
        mindmap: {
          central_topic: 'Topic',
          nodes: [
            { id: '1', text: 'Branch 1' },
            { id: '2', text: 'Branch 2' },
            { id: '3', text: 'Branch 3' }
          ]
        },
        tokens: 100,
        model: 'gpt-4'
      });

      const response = await request(app)
        .post('/api/ai/generate-mindmap')
        .send({
          text: 'Test text',
          maxBranches: 3,
          maxDepth: 2
        });

      expect(response.status).toBe(200);
      expect(mockAIService.generateMindMap).toHaveBeenCalledWith({
        text: 'Test text',
        maxBranches: 3,
        maxDepth: 2
      });
    });

    it('should return 400 if text is missing', async () => {
      const response = await request(app)
        .post('/api/ai/generate-mindmap')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('text is required');
    });

    it('should return 400 if maxBranches is invalid', async () => {
      const response = await request(app)
        .post('/api/ai/generate-mindmap')
        .send({
          text: 'Test text',
          maxBranches: 2
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('maxBranches must be a number between 3 and 6');
    });

    it('should return 400 if maxDepth is invalid', async () => {
      const response = await request(app)
        .post('/api/ai/generate-mindmap')
        .send({
          text: 'Test text',
          maxDepth: 0
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('maxDepth must be a number between 1 and 5');
    });

    it('should return 504 on timeout', async () => {
      mockAIService.generateMindMap.mockRejectedValue(new Error('Operation timed out after 5000ms'));

      const response = await request(app)
        .post('/api/ai/generate-mindmap')
        .send({ text: 'Test text' });

      expect(response.status).toBe(504);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('timed out');
    });
  });

  // ============================================
  // GET /api/ai/stats - Service Statistics
  // ============================================

  describe('GET /api/ai/stats', () => {
    it('should return AI service statistics', async () => {
      mockAIService.getStats.mockReturnValue({
        totalRequests: 100,
        totalTokens: 5000,
        averageLatency: 1500
      });

      const response = await request(app)
        .get('/api/ai/stats');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalRequests');
      expect(response.body.data).toHaveProperty('totalTokens');
      expect(response.body.data).toHaveProperty('averageLatency');
    });

    it('should handle errors gracefully', async () => {
      mockAIService.getStats.mockImplementation(() => {
        throw new Error('Stats unavailable');
      });

      const response = await request(app)
        .get('/api/ai/stats');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  // ============================================
  // Error Handling Tests
  // ============================================

  describe('Error Handling', () => {
    it('should handle validation errors from service', async () => {
      mockAIService.generate.mockRejectedValue(new Error('text must be provided'));

      const response = await request(app)
        .post('/api/ai/generate')
        .send({ text: 'Test' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle generic errors', async () => {
      mockAIService.generate.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .post('/api/ai/generate')
        .send({ text: 'Test' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to generate content');
    });
  });
});
