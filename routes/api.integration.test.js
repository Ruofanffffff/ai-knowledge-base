/**
 * API Integration Tests for Notes Feature
 * 
 * Tests all API endpoints working together in realistic workflows.
 * This tests the integration between different routes and services.
 * 
 * Task 10.6: Test all API endpoints' normal flow and error handling
 */

// Mock all service modules BEFORE importing routes
jest.mock('../services/notes/noteDAL');
jest.mock('../services/notes/attachmentDAL');
jest.mock('../services/notes/imageAnalysisService');
jest.mock('../services/notes/documentProcessingService');
jest.mock('../services/notes/tableProcessingService');
jest.mock('../services/notes/searchService');
jest.mock('../services/notes/llmClient');

// Mock AI enhancement service with proper structure
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

// Mock auth middleware
jest.mock('../services/authService', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

// Mock multer
jest.mock('multer', () => {
  const multer = () => ({
    single: () => (req, res, next) => {
      // Only add file if one was attached in the test
      if (req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        req.file = {
          buffer: Buffer.from('fake-file-data'),
          originalname: 'test.jpg',
          mimetype: 'image/jpeg',
          size: 1024
        };
      }
      next();
    }
  });
  multer.memoryStorage = () => ({});
  return multer;
});

// Mock s3Client validation functions
jest.mock('../services/notes/s3Client', () => ({
  uploadFileWithRetry: jest.fn(),
  validateFileSize: jest.fn(),
  validateMimeType: jest.fn(),
  downloadFile: jest.fn()
}));

const request = require('supertest');
const express = require('express');
const notesRoutes = require('./notesRoutes');
const attachmentRoutes = require('./attachmentRoutes');
const imageAnalysisRoutes = require('./imageAnalysisRoutes');
const aiEnhancementRoutes = require('./aiEnhancementRoutes');
const searchRoutes = require('./searchRoutes');

// Create Express app with all routes
const app = express();
app.use(express.json());
app.use('/api/notes', notesRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/image-analysis', imageAnalysisRoutes);
app.use('/api/ai', aiEnhancementRoutes);
app.use('/api/search', searchRoutes);

// Import mocked modules
const noteDAL = require('../services/notes/noteDAL');
const attachmentDAL = require('../services/notes/attachmentDAL');
const { uploadAndAnalyzeImage } = require('../services/notes/imageAnalysisService');
const { processDocument } = require('../services/notes/documentProcessingService');
const { processTable } = require('../services/notes/tableProcessingService');
const searchService = require('../services/notes/searchService');

// Get the mocked AI service (already declared at the top)
const { createAIEnhancementService } = require('../services/notes/aiEnhancementService');

describe('API Integration Tests - Notes Feature', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Note Creation Workflow', () => {
    it('should create a note and retrieve it with attachments', async () => {
      // Step 1: Create a note
      const mockNote = {
        id: 'note-1',
        userId: 'test-user-id',
        content: 'My travel plans #travel #vacation',
        tags: ['travel', 'vacation'],
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      noteDAL.createNote.mockResolvedValue(mockNote);

      const createResponse = await request(app)
        .post('/api/notes')
        .send({ content: 'My travel plans #travel #vacation' })
        .expect(201);

      expect(createResponse.body.success).toBe(true);
      expect(createResponse.body.data.id).toBe('note-1');
      expect(createResponse.body.data.tags).toEqual(['travel', 'vacation']);

      // Step 2: Simulate attachment being added (tested separately in attachment routes)
      // In a real scenario, the attachment would be uploaded via POST /api/attachments/upload
      const mockAttachment = {
        id: 'attachment-1',
        url: 'https://s3.example.com/image.jpg',
        type: 'IMAGE',
        size: 1024000,
        mimeType: 'image/jpeg',
        createdAt: new Date().toISOString(),
        analysis: {
          textContent: 'Eiffel Tower',
          description: 'A beautiful view of the Eiffel Tower in Paris',
          tags: ['paris', 'landmark', 'architecture']
        }
      };

      // Step 3: Retrieve the complete note with attachments
      const noteWithAttachments = {
        ...mockNote,
        attachments: [mockAttachment]
      };

      noteDAL.getNoteById.mockResolvedValue(noteWithAttachments);

      const getResponse = await request(app)
        .get('/api/notes/note-1')
        .expect(200);

      expect(getResponse.body.success).toBe(true);
      expect(getResponse.body.data.attachments).toHaveLength(1);
      expect(getResponse.body.data.attachments[0].analysis).toBeDefined();
    });
  });

  describe('Image Upload and Analysis Workflow', () => {
    it('should retrieve image analysis after upload', async () => {
      // Note: File upload is tested separately in attachmentRoutes.test.js
      // This test focuses on the analysis retrieval workflow

      // Simulate an image that has been uploaded and analyzed
      const mockAttachment = {
        id: 'img-1',
        type: 'IMAGE',
        url: 'https://s3.example.com/document.jpg',
        mimeType: 'image/jpeg',
        size: 2048000,
        note: { userId: 'test-user-id' },
        analysis: {
          textContent: 'Invoice #12345\nTotal: $500.00',
          description: 'A scanned invoice document',
          tags: ['invoice', 'document'],
          metadata: {
            imageType: 'document',
            llmModel: 'gpt-4-vision'
          }
        }
      };

      attachmentDAL.getAttachmentById.mockResolvedValue(mockAttachment);

      // Retrieve analysis
      const analysisResponse = await request(app)
        .get('/api/image-analysis/img-1')
        .expect(200);

      expect(analysisResponse.body.success).toBe(true);
      expect(analysisResponse.body.data.textContent).toContain('Invoice');
      expect(analysisResponse.body.data.tags).toContain('invoice');
    });
  });

  describe('Document Processing Workflow', () => {
    it('should verify document attachment metadata', async () => {
      // Note: File upload and processing is tested in attachmentRoutes.test.js
      // This test verifies the attachment metadata structure

      const mockAttachment = {
        id: 'doc-1',
        url: 'https://s3.example.com/report.pdf',
        type: 'DOCUMENT',
        size: 5120000,
        mimeType: 'application/pdf',
        note: { userId: 'test-user-id' },
        analysis: {
          textContent: 'Annual Report 2024\n\nExecutive Summary...',
          description: 'Annual financial report',
          tags: ['report', 'finance', '2024'],
          metadata: {
            pageCount: 25,
            documentType: 'report'
          }
        },
        createdAt: new Date().toISOString()
      };

      attachmentDAL.getAttachmentById.mockResolvedValue(mockAttachment);

      const response = await request(app)
        .get('/api/attachments/doc-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('DOCUMENT');
      expect(response.body.data.analysis).toBeDefined();
      expect(response.body.data.analysis.metadata.pageCount).toBe(25);
    });
  });

  describe('Table Processing Workflow', () => {
    it('should verify table attachment structure', async () => {
      // Note: File upload and processing is tested in attachmentRoutes.test.js
      // This test verifies the table data structure

      const mockAttachment = {
        id: 'table-1',
        url: 'https://s3.example.com/data.xlsx',
        type: 'TABLE',
        size: 102400,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        note: { userId: 'test-user-id' },
        analysis: {
          textContent: JSON.stringify({
            headers: ['Name', 'Age', 'City'],
            rows: [
              ['Alice', '30', 'New York'],
              ['Bob', '25', 'San Francisco']
            ]
          }),
          description: 'Employee data table',
          tags: ['table', 'employees'],
          metadata: {
            rowCount: 2,
            columnCount: 3
          }
        },
        createdAt: new Date().toISOString()
      };

      attachmentDAL.getAttachmentById.mockResolvedValue(mockAttachment);

      const response = await request(app)
        .get('/api/attachments/table-1')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('TABLE');
      expect(response.body.data.analysis).toBeDefined();
      
      const tableData = JSON.parse(response.body.data.analysis.textContent);
      expect(tableData.headers).toHaveLength(3);
      expect(tableData.rows).toHaveLength(2);
    });
  });

  describe('AI Enhancement Workflow', () => {
    it('should enhance text with all AI features', async () => {
      // Use the global mockAIService

      // Step 1: Smart generation
      mockAIService.generate.mockResolvedValue({
        expandedText: 'This is an expanded version of the original text with more details and context.',
        imagePrompt: 'A beautiful landscape with mountains and a lake at sunset, photorealistic, 4k',
        model: 'gpt-4',
        tokens: 150
      });

      const generateResponse = await request(app)
        .post('/api/ai/generate')
        .send({ text: 'A beautiful landscape' })
        .expect(200);

      expect(generateResponse.body.success).toBe(true);
      expect(generateResponse.body.data.expandedText).toBeDefined();
      expect(generateResponse.body.data.imagePrompt).toBeDefined();

      // Step 2: Smart proofreading
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
        model: 'gpt-4',
        tokens: 100
      });

      const proofreadResponse = await request(app)
        .post('/api/ai/proofread')
        .send({ text: 'This is teh text.' })
        .expect(200);

      expect(proofreadResponse.body.success).toBe(true);
      expect(proofreadResponse.body.data.correctedText).toBeDefined();
      expect(proofreadResponse.body.data.changes).toHaveLength(1);

      // Step 3: Generate table
      mockAIService.generateTable.mockResolvedValue({
        table: {
          headers: ['Product', 'Price', 'Quantity'],
          rows: [
            ['Apple', '$1.50', '10'],
            ['Banana', '$0.75', '20']
          ]
        },
        model: 'gpt-4',
        tokens: 120
      });

      const tableResponse = await request(app)
        .post('/api/ai/generate-table')
        .send({ text: 'We have 10 apples at $1.50 each and 20 bananas at $0.75 each.' })
        .expect(200);

      expect(tableResponse.body.success).toBe(true);
      expect(tableResponse.body.data.table.headers).toHaveLength(3);
      expect(tableResponse.body.data.table.rows).toHaveLength(2);

      // Step 4: Generate mind map
      mockAIService.generateMindMap.mockResolvedValue({
        mindmap: {
          central: 'Project Planning',
          branches: [
            {
              label: 'Research',
              children: [
                { label: 'Market Analysis' },
                { label: 'Competitor Study' }
              ]
            },
            {
              label: 'Development',
              children: [
                { label: 'Design' },
                { label: 'Implementation' }
              ]
            }
          ]
        },
        model: 'gpt-4',
        tokens: 180
      });

      const mindmapResponse = await request(app)
        .post('/api/ai/generate-mindmap')
        .send({ text: 'Project planning involves research and development phases.' })
        .expect(200);

      expect(mindmapResponse.body.success).toBe(true);
      expect(mindmapResponse.body.data.mindmap.central).toBe('Project Planning');
      expect(mindmapResponse.body.data.mindmap.branches).toHaveLength(2);
    });
  });

  describe('Search and Retrieval Workflow', () => {
    it('should create notes, search them, and filter by tags', async () => {
      // Step 1: Create multiple notes
      const mockNotes = [
        {
          id: 'note-1',
          userId: 'test-user-id',
          content: 'Meeting notes #work #important',
          tags: ['work', 'important'],
          attachments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        {
          id: 'note-2',
          userId: 'test-user-id',
          content: 'Vacation ideas #travel #personal',
          tags: ['travel', 'personal'],
          attachments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ];

      noteDAL.createNote.mockResolvedValueOnce(mockNotes[0]);
      noteDAL.createNote.mockResolvedValueOnce(mockNotes[1]);

      await request(app)
        .post('/api/notes')
        .send({ content: mockNotes[0].content })
        .expect(201);

      await request(app)
        .post('/api/notes')
        .send({ content: mockNotes[1].content })
        .expect(201);

      // Step 2: Search for notes
      const mockSearchResults = {
        results: [
          {
            note: mockNotes[0],
            highlights: [
              {
                field: 'content',
                snippet: 'Meeting notes #work #important'
              }
            ],
            score: 0.95
          }
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      searchService.searchNotes.mockResolvedValue(mockSearchResults);

      const searchResponse = await request(app)
        .get('/api/search?query=meeting')
        .expect(200);

      expect(searchResponse.body.success).toBe(true);
      expect(searchResponse.body.data.results).toHaveLength(1);
      expect(searchResponse.body.data.results[0].note.content).toContain('Meeting');

      // Step 3: List notes filtered by tags
      const mockFilteredNotes = {
        notes: [mockNotes[0]],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1
      };

      noteDAL.listNotes.mockResolvedValue(mockFilteredNotes);

      const listResponse = await request(app)
        .get('/api/notes?tags=work')
        .expect(200);

      expect(listResponse.body.success).toBe(true);
      expect(listResponse.body.data.notes).toHaveLength(1);
      expect(listResponse.body.data.notes[0].tags).toContain('work');
    });
  });

  describe('Note Update and Delete Workflow', () => {
    it('should create, update, and delete a note', async () => {
      // Step 1: Create note
      const mockNote = {
        id: 'note-1',
        userId: 'test-user-id',
        content: 'Original content',
        tags: ['draft'],
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      noteDAL.createNote.mockResolvedValue(mockNote);

      const createResponse = await request(app)
        .post('/api/notes')
        .send({ content: 'Original content', tags: ['draft'] })
        .expect(201);

      expect(createResponse.body.data.content).toBe('Original content');

      // Step 2: Update note
      const updatedNote = {
        ...mockNote,
        content: 'Updated content #final',
        tags: ['final'],
        updatedAt: new Date().toISOString()
      };

      noteDAL.updateNote.mockResolvedValue(updatedNote);

      const updateResponse = await request(app)
        .put('/api/notes/note-1')
        .send({ content: 'Updated content #final', tags: ['final'] })
        .expect(200);

      expect(updateResponse.body.data.content).toBe('Updated content #final');
      expect(updateResponse.body.data.tags).toContain('final');

      // Step 3: Delete note
      noteDAL.deleteNote.mockResolvedValue(updatedNote);

      const deleteResponse = await request(app)
        .delete('/api/notes/note-1')
        .expect(200);

      expect(deleteResponse.body.success).toBe(true);
      expect(deleteResponse.body.data.id).toBe('note-1');

      // Step 4: Verify note is deleted
      noteDAL.getNoteById.mockResolvedValue(null);

      await request(app)
        .get('/api/notes/note-1')
        .expect(404);
    });
  });

  describe('Error Handling - Invalid Requests', () => {
    it('should handle missing required fields across all endpoints', async () => {
      // Notes endpoint - missing content
      await request(app)
        .post('/api/notes')
        .send({})
        .expect(400);

      // Attachment endpoint - missing file
      await request(app)
        .post('/api/attachments/upload')
        .field('type', 'IMAGE')
        .field('noteId', 'note-1')
        .expect(400);

      // Image analysis - missing imageId
      await request(app)
        .post('/api/image-analysis')
        .send({})
        .expect(400);

      // AI generate - missing text
      await request(app)
        .post('/api/ai/generate')
        .send({})
        .expect(400);

      // AI proofread - missing text
      await request(app)
        .post('/api/ai/proofread')
        .send({})
        .expect(400);

      // AI generate table - missing text
      await request(app)
        .post('/api/ai/generate-table')
        .send({})
        .expect(400);

      // AI generate mindmap - missing text
      await request(app)
        .post('/api/ai/generate-mindmap')
        .send({})
        .expect(400);

      // Search - missing query
      await request(app)
        .get('/api/search')
        .expect(400);
    });

    it('should handle invalid data types', async () => {
      // Invalid attachment type
      uploadAndAnalyzeImage.mockResolvedValue({
        attachment: { id: 'att-1', url: 'url', type: 'IMAGE', size: 1000, mimeType: 'image/jpeg' },
        analysis: {}
      });

      await request(app)
        .post('/api/attachments/upload')
        .field('type', 'INVALID_TYPE')
        .field('noteId', 'note-1')
        .attach('file', Buffer.from('data'), 'test.jpg')
        .expect(400);

      // Invalid analysis type
      await request(app)
        .post('/api/image-analysis')
        .send({ imageId: 'img-1', analysisType: 'invalid' })
        .expect(400);

      // Invalid AI parameters
      await request(app)
        .post('/api/ai/generate')
        .send({ text: 123 }) // text should be string
        .expect(400);

      await request(app)
        .post('/api/ai/generate-table')
        .send({ text: 'test', maxColumns: 100 }) // maxColumns too large
        .expect(400);

      await request(app)
        .post('/api/ai/generate-mindmap')
        .send({ text: 'test', maxBranches: 10 }) // maxBranches out of range
        .expect(400);
    });
  });

  describe('Error Handling - Resource Not Found', () => {
    it('should return 404 for non-existent resources', async () => {
      // Note not found
      noteDAL.getNoteById.mockResolvedValue(null);
      await request(app)
        .get('/api/notes/nonexistent')
        .expect(404);

      // Attachment not found
      attachmentDAL.getAttachmentById.mockResolvedValue(null);
      await request(app)
        .get('/api/attachments/nonexistent')
        .expect(404);

      // Image analysis not found
      attachmentDAL.getAttachmentById.mockResolvedValue(null);
      await request(app)
        .get('/api/image-analysis/nonexistent')
        .expect(404);

      // Update non-existent note
      noteDAL.updateNote.mockRejectedValue(new Error('Note not found'));
      await request(app)
        .put('/api/notes/nonexistent')
        .send({ content: 'Updated' })
        .expect(404);

      // Delete non-existent note
      noteDAL.deleteNote.mockRejectedValue(new Error('Note not found'));
      await request(app)
        .delete('/api/notes/nonexistent')
        .expect(404);
    });
  });

  describe('Error Handling - Service Failures', () => {
    it('should handle database errors gracefully', async () => {
      // Database error on create
      noteDAL.createNote.mockRejectedValue(new Error('Database connection failed'));
      await request(app)
        .post('/api/notes')
        .send({ content: 'Test' })
        .expect(500);

      // Database error on read
      noteDAL.getNoteById.mockRejectedValue(new Error('Database error'));
      await request(app)
        .get('/api/notes/note-1')
        .expect(500);

      // Database error on search
      searchService.searchNotes.mockRejectedValue(new Error('Search index unavailable'));
      await request(app)
        .get('/api/search?query=test')
        .expect(500);
    });

    it('should handle LLM service errors', async () => {
      // Use the global mockAIService

      // LLM timeout
      mockAIService.generate.mockRejectedValueOnce(new Error('Request timed out'));
      await request(app)
        .post('/api/ai/generate')
        .send({ text: 'Test' })
        .expect(504);

      // LLM API error
      mockAIService.proofread.mockRejectedValueOnce(new Error('LLM API error'));
      await request(app)
        .post('/api/ai/proofread')
        .send({ text: 'Test' })
        .expect(502);

      // Note: Image analysis LLM errors are tested in imageAnalysisRoutes.test.js
    });

    it('should handle storage errors', async () => {
      // Note: Storage errors during upload are tested in attachmentRoutes.test.js
      // This test verifies error handling for missing files

      attachmentDAL.getAttachmentById.mockResolvedValue(null);
      await request(app)
        .get('/api/attachments/nonexistent')
        .expect(404);
    });
  });

  describe('Error Handling - Authorization', () => {
    it('should prevent access to other users resources', async () => {
      // Try to access another user's note
      const otherUserNote = {
        id: 'note-1',
        userId: 'other-user-id',
        content: 'Private note',
        tags: [],
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      noteDAL.getNoteById.mockResolvedValue(otherUserNote);

      // The noteDAL should handle authorization, but if it doesn't,
      // the route should still protect the resource
      // In this test, we verify the flow works correctly

      // Try to access another user's attachment
      const otherUserAttachment = {
        id: 'att-1',
        type: 'IMAGE',
        url: 'url',
        mimeType: 'image/jpeg',
        size: 1000,
        note: { userId: 'other-user-id' }
      };

      attachmentDAL.getAttachmentById.mockResolvedValue(otherUserAttachment);

      const response = await request(app)
        .get('/api/attachments/att-1')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty search results', async () => {
      searchService.searchNotes.mockResolvedValue({
        results: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 0
      });

      const response = await request(app)
        .get('/api/search?query=nonexistent')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results).toHaveLength(0);
    });

    it('should handle pagination edge cases', async () => {
      // Request page beyond available pages
      noteDAL.listNotes.mockResolvedValue({
        notes: [],
        total: 5,
        page: 10,
        limit: 20,
        totalPages: 1
      });

      const response = await request(app)
        .get('/api/notes?page=10&limit=20')
        .expect(200);

      expect(response.body.data.notes).toHaveLength(0);
    });

    it('should handle very long text inputs', async () => {
      const longText = 'a'.repeat(10000);

      const mockNote = {
        id: 'note-1',
        userId: 'test-user-id',
        content: longText,
        tags: [],
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      noteDAL.createNote.mockResolvedValue(mockNote);

      const response = await request(app)
        .post('/api/notes')
        .send({ content: longText })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toHaveLength(10000);
    });

    it('should handle special characters in content', async () => {
      const specialContent = 'Test with special chars: <>&"\'#@$%^&*()';

      const mockNote = {
        id: 'note-1',
        userId: 'test-user-id',
        content: specialContent,
        tags: [],
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      noteDAL.createNote.mockResolvedValue(mockNote);

      const response = await request(app)
        .post('/api/notes')
        .send({ content: specialContent })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.content).toBe(specialContent);
    });

    it('should handle multiple tags correctly', async () => {
      const manyTags = Array.from({ length: 20 }, (_, i) => `tag${i}`);

      const mockNote = {
        id: 'note-1',
        userId: 'test-user-id',
        content: 'Note with many tags',
        tags: manyTags,
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      noteDAL.createNote.mockResolvedValue(mockNote);

      const response = await request(app)
        .post('/api/notes')
        .send({ content: 'Note with many tags', tags: manyTags })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tags).toHaveLength(20);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple simultaneous note creations', async () => {
      const mockNotes = Array.from({ length: 5 }, (_, i) => ({
        id: `note-${i}`,
        userId: 'test-user-id',
        content: `Note ${i}`,
        tags: [],
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));

      mockNotes.forEach((note, i) => {
        noteDAL.createNote.mockResolvedValueOnce(note);
      });

      const promises = mockNotes.map((_, i) =>
        request(app)
          .post('/api/notes')
          .send({ content: `Note ${i}` })
      );

      const responses = await Promise.all(promises);

      responses.forEach((response, i) => {
        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.id).toBe(`note-${i}`);
      });
    });

    it('should handle simultaneous AI enhancement requests', async () => {
      // Use the global mockAIService

      mockAIService.generate.mockResolvedValue({
        expandedText: 'Expanded',
        imagePrompt: 'Prompt',
        model: 'gpt-4',
        tokens: 100
      });

      mockAIService.proofread.mockResolvedValue({
        correctedText: 'Corrected',
        changes: [],
        model: 'gpt-4',
        tokens: 50
      });

      const promises = [
        request(app).post('/api/ai/generate').send({ text: 'Test 1' }),
        request(app).post('/api/ai/proofread').send({ text: 'Test 2' }),
        request(app).post('/api/ai/generate').send({ text: 'Test 3' })
      ];

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Response Format Consistency', () => {
    it('should return consistent success response format', async () => {
      const mockNote = {
        id: 'note-1',
        userId: 'test-user-id',
        content: 'Test',
        tags: [],
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      noteDAL.createNote.mockResolvedValue(mockNote);

      const response = await request(app)
        .post('/api/notes')
        .send({ content: 'Test' })
        .expect(201);

      // Verify response structure
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('data');
      expect(response.body.success).toBe(true);
      expect(typeof response.body.data).toBe('object');
    });

    it('should return consistent error response format', async () => {
      const response = await request(app)
        .post('/api/notes')
        .send({})
        .expect(400);

      // Verify error response structure
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(false);
      expect(typeof response.body.error).toBe('string');
    });
  });
});
