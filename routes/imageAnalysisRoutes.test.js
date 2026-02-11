/**
 * Image Analysis Routes Tests
 * 
 * Tests for image analysis API endpoints.
 * Validates: Requirements 2.2, 2.3, 2.4
 */

// Mock dependencies BEFORE requiring the routes
jest.mock('../services/authService', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

jest.mock('../services/notes/imageAnalysisService', () => ({
  reanalyzeAttachment: jest.fn(),
  analyzeImage: jest.fn()
}));

jest.mock('../services/notes/attachmentDAL', () => ({
  getAttachmentById: jest.fn()
}));

const request = require('supertest');
const express = require('express');
const imageAnalysisRoutes = require('./imageAnalysisRoutes');
const { reanalyzeAttachment } = require('../services/notes/imageAnalysisService');
const { getAttachmentById } = require('../services/notes/attachmentDAL');

// Create test app
const app = express();
app.use(express.json());
app.use('/api/image-analysis', imageAnalysisRoutes);

describe('Image Analysis Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/image-analysis', () => {
    const mockAttachment = {
      id: 'attachment-1',
      type: 'IMAGE',
      url: 'https://s3.example.com/image.jpg',
      mimeType: 'image/jpeg',
      note: {
        userId: 'test-user-id'
      },
      metadata: {
        width: 1920,
        height: 1080
      }
    };

    const mockAnalysis = {
      id: 'analysis-1',
      textContent: 'Recognized text from image',
      description: 'A beautiful landscape photo',
      tags: ['landscape', 'nature'],
      metadata: {
        analysisType: 'full',
        imageType: 'general',
        elements: ['sky', 'mountains', 'trees'],
        llmModel: 'gpt-4-vision',
        llmProvider: 'openai',
        tokens: 150,
        analyzedAt: '2024-01-01T00:00:00.000Z'
      },
      createdAt: '2024-01-01T00:00:00.000Z'
    };

    it('should analyze an image successfully with default analysisType', async () => {
      getAttachmentById.mockResolvedValue(mockAttachment);
      reanalyzeAttachment.mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .post('/api/image-analysis')
        .send({ imageId: 'attachment-1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        imageId: 'attachment-1',
        textContent: 'Recognized text from image',
        description: 'A beautiful landscape photo',
        tags: ['landscape', 'nature']
      });
      expect(response.body.data.metadata).toMatchObject({
        width: 1920,
        height: 1080,
        format: 'jpeg',
        analysisType: 'full',
        imageType: 'general',
        llmModel: 'gpt-4-vision'
      });

      expect(getAttachmentById).toHaveBeenCalledWith('attachment-1');
      expect(reanalyzeAttachment).toHaveBeenCalledWith('attachment-1', 'full');
    });

    it('should analyze an image with specific analysisType', async () => {
      getAttachmentById.mockResolvedValue(mockAttachment);
      reanalyzeAttachment.mockResolvedValue({
        ...mockAnalysis,
        textContent: 'Only text content',
        description: null,
        metadata: {
          ...mockAnalysis.metadata,
          analysisType: 'text'
        }
      });

      const response = await request(app)
        .post('/api/image-analysis')
        .send({ 
          imageId: 'attachment-1',
          analysisType: 'text'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.textContent).toBe('Only text content');
      expect(response.body.data.description).toBeNull();
      expect(reanalyzeAttachment).toHaveBeenCalledWith('attachment-1', 'text');
    });

    it('should return 400 if imageId is missing', async () => {
      const response = await request(app)
        .post('/api/image-analysis')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('imageId is required');
    });

    it('should return 400 if analysisType is invalid', async () => {
      const response = await request(app)
        .post('/api/image-analysis')
        .send({ 
          imageId: 'attachment-1',
          analysisType: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid analysisType');
    });

    it('should return 404 if attachment not found', async () => {
      getAttachmentById.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/image-analysis')
        .send({ imageId: 'nonexistent' });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Image attachment not found');
    });

    it('should return 400 if attachment is not an image', async () => {
      getAttachmentById.mockResolvedValue({
        ...mockAttachment,
        type: 'DOCUMENT'
      });

      const response = await request(app)
        .post('/api/image-analysis')
        .send({ imageId: 'attachment-1' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not an image');
    });

    it('should return 403 if user does not own the attachment', async () => {
      getAttachmentById.mockResolvedValue({
        ...mockAttachment,
        note: {
          userId: 'different-user-id'
        }
      });

      const response = await request(app)
        .post('/api/image-analysis')
        .send({ imageId: 'attachment-1' });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Access denied');
    });

    it('should return 502 if LLM service fails', async () => {
      getAttachmentById.mockResolvedValue(mockAttachment);
      reanalyzeAttachment.mockRejectedValue(new Error('LLM service timeout'));

      const response = await request(app)
        .post('/api/image-analysis')
        .send({ imageId: 'attachment-1' });

      expect(response.status).toBe(502);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('temporarily unavailable');
    });

    it('should handle analysis without metadata gracefully', async () => {
      getAttachmentById.mockResolvedValue({
        ...mockAttachment,
        metadata: null
      });
      reanalyzeAttachment.mockResolvedValue({
        ...mockAnalysis,
        metadata: {}
      });

      const response = await request(app)
        .post('/api/image-analysis')
        .send({ imageId: 'attachment-1' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.metadata).toBeDefined();
      expect(response.body.data.metadata.format).toBe('jpeg');
    });

    it('should support all valid analysisTypes', async () => {
      const validTypes = ['text', 'content', 'full'];
      
      for (const analysisType of validTypes) {
        getAttachmentById.mockResolvedValue(mockAttachment);
        reanalyzeAttachment.mockResolvedValue(mockAnalysis);

        const response = await request(app)
          .post('/api/image-analysis')
          .send({ 
            imageId: 'attachment-1',
            analysisType
          });

        expect(response.status).toBe(200);
        expect(reanalyzeAttachment).toHaveBeenCalledWith('attachment-1', analysisType);
      }
    });
  });

  describe('GET /api/image-analysis/:imageId', () => {
    const mockAttachment = {
      id: 'attachment-1',
      type: 'IMAGE',
      url: 'https://s3.example.com/image.jpg',
      mimeType: 'image/png',
      note: {
        userId: 'test-user-id'
      },
      metadata: {
        width: 800,
        height: 600
      },
      analysis: {
        id: 'analysis-1',
        textContent: 'Some text',
        description: 'A description',
        tags: ['tag1', 'tag2'],
        metadata: {
          analysisType: 'full',
          tokens: 100
        }
      }
    };

    it('should get existing analysis successfully', async () => {
      getAttachmentById.mockResolvedValue(mockAttachment);

      const response = await request(app)
        .get('/api/image-analysis/attachment-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        imageId: 'attachment-1',
        textContent: 'Some text',
        description: 'A description',
        tags: ['tag1', 'tag2']
      });
      expect(response.body.data.metadata).toMatchObject({
        width: 800,
        height: 600,
        format: 'png',
        analysisType: 'full',
        tokens: 100
      });
    });

    it('should return 404 if attachment not found', async () => {
      getAttachmentById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/image-analysis/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Image attachment not found');
    });

    it('should return 400 if attachment is not an image', async () => {
      getAttachmentById.mockResolvedValue({
        ...mockAttachment,
        type: 'TABLE',
        analysis: null
      });

      const response = await request(app)
        .get('/api/image-analysis/attachment-1');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not an image');
    });

    it('should return 403 if user does not own the attachment', async () => {
      getAttachmentById.mockResolvedValue({
        ...mockAttachment,
        note: {
          userId: 'different-user-id'
        }
      });

      const response = await request(app)
        .get('/api/image-analysis/attachment-1');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');
    });

    it('should return 404 if analysis does not exist', async () => {
      getAttachmentById.mockResolvedValue({
        ...mockAttachment,
        analysis: null
      });

      const response = await request(app)
        .get('/api/image-analysis/attachment-1');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('No analysis found');
    });

    it('should handle missing metadata gracefully', async () => {
      getAttachmentById.mockResolvedValue({
        ...mockAttachment,
        metadata: null,
        analysis: {
          ...mockAttachment.analysis,
          metadata: null
        }
      });

      const response = await request(app)
        .get('/api/image-analysis/attachment-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.metadata.format).toBe('png');
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      getAttachmentById.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/image-analysis')
        .send({ imageId: 'attachment-1' });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to analyze image');
    });

    it('should handle unexpected errors in GET endpoint', async () => {
      getAttachmentById.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .get('/api/image-analysis/attachment-1');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Integration with Requirements', () => {
    it('should validate Requirement 2.2: Use multimodal LLM to process image', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        type: 'IMAGE',
        url: 'https://s3.example.com/image.jpg',
        mimeType: 'image/jpeg',
        note: { userId: 'test-user-id' }
      };

      getAttachmentById.mockResolvedValue(mockAttachment);
      reanalyzeAttachment.mockResolvedValue({
        id: 'analysis-1',
        textContent: 'Text from LLM',
        description: 'Description from LLM',
        tags: [],
        metadata: {
          llmModel: 'gpt-4-vision',
          llmProvider: 'openai'
        }
      });

      const response = await request(app)
        .post('/api/image-analysis')
        .send({ imageId: 'attachment-1' });

      expect(response.status).toBe(200);
      expect(reanalyzeAttachment).toHaveBeenCalled();
      // Validates that LLM is used for processing
      expect(response.body.data.metadata.llmModel).toBeDefined();
    });

    it('should validate Requirement 2.3: Use LLM for text recognition and content understanding', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        type: 'IMAGE',
        url: 'https://s3.example.com/document.jpg',
        mimeType: 'image/jpeg',
        note: { userId: 'test-user-id' }
      };

      getAttachmentById.mockResolvedValue(mockAttachment);
      reanalyzeAttachment.mockResolvedValue({
        id: 'analysis-1',
        textContent: 'Recognized text content',
        description: 'Document image with text',
        tags: ['document', 'text'],
        metadata: {
          analysisType: 'text',
          imageType: 'document'
        }
      });

      const response = await request(app)
        .post('/api/image-analysis')
        .send({ 
          imageId: 'attachment-1',
          analysisType: 'text'
        });

      expect(response.status).toBe(200);
      // Validates text recognition capability
      expect(response.body.data.textContent).toBe('Recognized text content');
    });

    it('should validate Requirement 2.4: Analyze visual content and generate detailed description', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        type: 'IMAGE',
        url: 'https://s3.example.com/photo.jpg',
        mimeType: 'image/jpeg',
        note: { userId: 'test-user-id' }
      };

      getAttachmentById.mockResolvedValue(mockAttachment);
      reanalyzeAttachment.mockResolvedValue({
        id: 'analysis-1',
        textContent: null,
        description: 'A detailed description of the visual content including colors, objects, and composition',
        tags: ['landscape', 'sunset', 'mountains'],
        metadata: {
          analysisType: 'content',
          elements: ['sky', 'mountains', 'clouds', 'sun']
        }
      });

      const response = await request(app)
        .post('/api/image-analysis')
        .send({ 
          imageId: 'attachment-1',
          analysisType: 'content'
        });

      expect(response.status).toBe(200);
      // Validates visual content analysis
      expect(response.body.data.description).toBeTruthy();
      expect(response.body.data.tags.length).toBeGreaterThan(0);
      expect(response.body.data.metadata.elements).toBeDefined();
    });
  });
});
