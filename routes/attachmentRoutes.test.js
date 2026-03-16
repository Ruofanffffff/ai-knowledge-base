/**
 * Attachment Routes Tests
 * 
 * Tests for attachment API endpoints.
 * Validates: Requirements 2.1, 3.1, 4.1
 */

// Mock dependencies BEFORE any imports
jest.mock('../services/authService', () => ({
  authMiddleware: (req, res, next) => {
    req.user = { id: 'test-user-id' };
    next();
  }
}));

jest.mock('../services/notes/noteDAL', () => ({
  getNoteById: jest.fn()
}));

jest.mock('../services/notes/attachmentDAL');
jest.mock('../services/notes/s3Client');
jest.mock('../services/notes/imageAnalysisService', () => ({
  uploadAndAnalyzeImage: jest.fn(),
  analyzeImage: jest.fn(),
  reanalyzeAttachment: jest.fn(),
  getStats: jest.fn(),
  resetStats: jest.fn(),
  ImageAnalysisService: jest.fn(),
  createImageAnalysisService: jest.fn()
}));
jest.mock('../services/notes/documentProcessingService', () => ({
  uploadAndProcessDocument: jest.fn(),
  processDocument: jest.fn()
}));
jest.mock('../services/notes/tableProcessingService', () => ({
  uploadAndProcessTable: jest.fn()
}));
jest.mock('../config/notes.config', () => ({
  notesConfig: {
    attachments: {
      maxSize: 10 * 1024 * 1024, // 10MB
      allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif'],
      allowedDocumentTypes: ['application/pdf', 'application/msword'],
      allowedTableTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv']
    },
    storage: {
      region: 'us-east-1',
      bucketName: 'test-bucket',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      endpoint: null,
      forcePathStyle: false,
      useSSL: true
    },
    retry: {
      maxRetries: 3,
      initialDelay: 100,
      backoffMultiplier: 2
    }
  }
}));

const request = require('supertest');
const express = require('express');
const attachmentRoutes = require('./attachmentRoutes');
const noteDAL = require('../services/notes/noteDAL');
const attachmentDAL = require('../services/notes/attachmentDAL');
const { uploadFileWithRetry, validateFileSize, validateMimeType, downloadFile } = require('../services/notes/s3Client');
const { uploadAndAnalyzeImage } = require('../services/notes/imageAnalysisService');
const { uploadAndProcessDocument } = require('../services/notes/documentProcessingService');
const { uploadAndProcessTable } = require('../services/notes/tableProcessingService');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/api/attachments', attachmentRoutes);

describe('Attachment Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    noteDAL.getNoteById.mockResolvedValue({
      id: 'note-1',
      userId: 'test-user-id',
      content: 'test',
      tags: []
    });
  });

  describe('POST /api/attachments/upload', () => {
    it('should upload and analyze an image attachment', async () => {
      const mockResult = {
        attachment: {
          id: 'attachment-1',
          url: 'https://s3.example.com/image.jpg',
          type: 'IMAGE',
          size: 1024,
          mimeType: 'image/jpeg',
          createdAt: new Date().toISOString()
        },
        analysis: {
          textContent: 'Sample text',
          description: 'A sample image',
          tags: ['sample', 'test'],
          metadata: {}
        }
      };

      validateFileSize.mockReturnValue(true);
      validateMimeType.mockReturnValue(true);
      uploadAndAnalyzeImage.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'IMAGE')
        .field('noteId', 'note-1')
        .attach('file', Buffer.from('fake image data'), 'test.jpg');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: 'attachment-1',
        url: 'https://s3.example.com/image.jpg',
        type: 'IMAGE',
        size: 1024,
        mimeType: 'image/jpeg'
      });
      expect(response.body.data.analysis).toBeDefined();
      expect(response.body.data.analysis.textContent).toBe('Sample text');
    });

    it('should upload and process a document attachment', async () => {
      const mockResult = {
        attachment: {
          id: 'attachment-2',
          url: 'https://s3.example.com/document.pdf',
          type: 'DOCUMENT',
          size: 2048,
          mimeType: 'application/pdf',
          createdAt: new Date().toISOString()
        },
        analysis: {
          textContent: 'Document content',
          description: null,
          tags: [],
          metadata: {}
        }
      };

      validateFileSize.mockReturnValue(true);
      validateMimeType.mockReturnValue(true);
      uploadAndProcessDocument.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'DOCUMENT')
        .field('noteId', 'note-1')
        .attach('file', Buffer.from('fake pdf data'), 'test.pdf');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('DOCUMENT');
      expect(uploadAndProcessDocument).toHaveBeenCalled();
    });

    it('should infer PDF mime type when client sends application/octet-stream', async () => {
      const mockResult = {
        attachment: {
          id: 'attachment-pdf-1',
          url: 'https://s3.example.com/document.pdf',
          type: 'DOCUMENT',
          size: 2048,
          mimeType: 'application/pdf',
          createdAt: new Date().toISOString()
        },
        analysis: {
          textContent: 'PDF content',
          description: null,
          tags: [],
          metadata: {}
        }
      };

      validateFileSize.mockReturnValue(true);
      validateMimeType.mockReturnValue(true);
      uploadAndProcessDocument.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'DOCUMENT')
        .field('noteId', 'note-1')
        .attach('file', Buffer.from('fake pdf data'), {
          filename: 'test.pdf',
          contentType: 'application/octet-stream'
        });

      expect(response.status).toBe(201);
      expect(validateMimeType).toHaveBeenCalledWith('application/pdf', 'DOCUMENT');
      expect(uploadAndProcessDocument).toHaveBeenCalledWith(expect.objectContaining({
        mimeType: 'application/pdf'
      }));
    });

    it('should infer DOCX mime type when client sends application/octet-stream', async () => {
      const mockResult = {
        attachment: {
          id: 'attachment-docx-1',
          url: 'https://s3.example.com/document.docx',
          type: 'DOCUMENT',
          size: 4096,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          createdAt: new Date().toISOString()
        },
        analysis: {
          textContent: 'DOCX content',
          description: null,
          tags: [],
          metadata: {}
        }
      };

      validateFileSize.mockReturnValue(true);
      validateMimeType.mockReturnValue(true);
      uploadAndProcessDocument.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'DOCUMENT')
        .field('noteId', 'note-1')
        .attach('file', Buffer.from('fake docx data'), {
          filename: 'test.docx',
          contentType: 'application/octet-stream'
        });

      expect(response.status).toBe(201);
      expect(validateMimeType).toHaveBeenCalledWith(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'DOCUMENT'
      );
      expect(uploadAndProcessDocument).toHaveBeenCalledWith(expect.objectContaining({
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }));
    });

    it('should include degradation fields when storage fallback is used', async () => {
      const mockResult = {
        attachment: {
          id: 'attachment-degraded-1',
          url: 'local://notes-fallback/fallback-1/test.pdf',
          type: 'DOCUMENT',
          size: 2048,
          mimeType: 'application/pdf',
          createdAt: new Date().toISOString(),
          degraded: true,
          degradationMode: 'LOCAL_CACHE',
          fallbackId: 'fallback-1'
        },
        analysis: {
          textContent: 'PDF content',
          description: null,
          tags: [],
          metadata: { storageDegraded: true }
        }
      };

      validateFileSize.mockReturnValue(true);
      validateMimeType.mockReturnValue(true);
      uploadAndProcessDocument.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'DOCUMENT')
        .field('noteId', 'note-1')
        .attach('file', Buffer.from('fake pdf data'), 'test.pdf');

      expect(response.status).toBe(201);
      expect(response.body.data.degraded).toBe(true);
      expect(response.body.data.degradationMode).toBe('LOCAL_CACHE');
      expect(response.body.data.fallbackId).toBe('fallback-1');
    });

    it('should upload and process a table attachment', async () => {
      const mockResult = {
        attachment: {
          id: 'attachment-3',
          url: 'https://s3.example.com/table.xlsx',
          type: 'TABLE',
          size: 3072,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          createdAt: new Date().toISOString()
        },
        analysis: {
          textContent: null,
          description: 'Table data',
          tags: [],
          metadata: { rows: 10, columns: 5 }
        }
      };

      validateFileSize.mockReturnValue(true);
      validateMimeType.mockReturnValue(true);
      uploadAndProcessTable.mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'TABLE')
        .field('noteId', 'note-1')
        .attach('file', Buffer.from('fake excel data'), 'test.xlsx');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('TABLE');
      expect(uploadAndProcessTable).toHaveBeenCalled();
    });

    it('should return 400 if file is missing', async () => {
      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'IMAGE')
        .field('noteId', 'note-1');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('File is required');
    });

    it('should return 400 if type is missing', async () => {
      const response = await request(app)
        .post('/api/attachments/upload')
        .field('noteId', 'note-1')
        .attach('file', Buffer.from('fake data'), 'test.jpg');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Attachment type is required');
    });

    it('should return 400 if noteId is missing', async () => {
      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'IMAGE')
        .attach('file', Buffer.from('fake data'), 'test.jpg');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Note ID is required');
    });

    it('should return 400 if type is invalid', async () => {
      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'INVALID')
        .field('noteId', 'note-1')
        .attach('file', Buffer.from('fake data'), 'test.jpg');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Invalid attachment type');
    });

    it('should return 413 if file size exceeds limit', async () => {
      validateFileSize.mockImplementation(() => {
        throw new Error('File size exceeds maximum allowed size');
      });

      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'IMAGE')
        .field('noteId', 'note-1')
        .attach('file', Buffer.from('fake data'), 'test.jpg');

      expect(response.status).toBe(413);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('File size');
    });

    it('should return 400 if MIME type is invalid', async () => {
      validateFileSize.mockReturnValue(true);
      validateMimeType.mockImplementation(() => {
        throw new Error('MIME type not allowed');
      });

      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'IMAGE')
        .field('noteId', 'note-1')
        .attach('file', Buffer.from('fake data'), 'test.txt');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('MIME type');
    });

    it('should return 404 if note not found', async () => {
      validateFileSize.mockReturnValue(true);
      validateMimeType.mockReturnValue(true);
      uploadAndAnalyzeImage.mockRejectedValue(new Error('Note not found'));

      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'IMAGE')
        .field('noteId', 'nonexistent-note')
        .attach('file', Buffer.from('fake data'), 'test.jpg');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Note not found');
    });

    it('should return storage error metadata for S3 retry exhaustion', async () => {
      validateFileSize.mockReturnValue(true);
      validateMimeType.mockReturnValue(true);
      const storageError = new Error('Failed to upload file after retries');
      storageError.code = 'STORAGE_UPLOAD_RETRY_EXHAUSTED';
      storageError.statusCode = 503;
      uploadAndProcessDocument.mockRejectedValue(storageError);

      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'DOCUMENT')
        .field('noteId', 'note-1')
        .attach('file', Buffer.from('fake pdf data'), 'test.pdf');

      expect(response.status).toBe(503);
      expect(response.body.success).toBe(false);
      expect(response.body.errorCode).toBe('STORAGE_UPLOAD_RETRY_EXHAUSTED');
      expect(response.body.errorId).toMatch(/^att_upload_/);
    });

    it('should return 413 when multer rejects oversized upload', async () => {
      const oversizedBuffer = Buffer.alloc((10 * 1024 * 1024) + 1, 'a');

      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'IMAGE')
        .field('noteId', 'note-1')
        .attach('file', oversizedBuffer, 'oversized.jpg');

      expect(response.status).toBe(413);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('File size exceeds maximum allowed size');
      expect(uploadAndAnalyzeImage).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/attachments/:id', () => {
    it('should get an attachment by ID', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        url: 'https://s3.example.com/image.jpg',
        type: 'IMAGE',
        size: 1024,
        mimeType: 'image/jpeg',
        storageKey: 'images/test.jpg',
        noteId: 'note-1',
        createdAt: new Date().toISOString(),
        note: {
          userId: 'test-user-id'
        },
        analysis: {
          id: 'analysis-1',
          textContent: 'Sample text',
          description: 'A sample image',
          tags: ['sample'],
          metadata: {},
          createdAt: new Date().toISOString()
        }
      };

      attachmentDAL.getAttachmentById.mockResolvedValue(mockAttachment);

      const response = await request(app)
        .get('/api/attachments/attachment-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: 'attachment-1',
        url: 'https://s3.example.com/image.jpg',
        type: 'IMAGE',
        size: 1024,
        mimeType: 'image/jpeg',
        storageKey: 'images/test.jpg',
        noteId: 'note-1'
      });
      expect(response.body.data.analysis).toBeDefined();
    });

    it('should return 404 if attachment not found', async () => {
      attachmentDAL.getAttachmentById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/attachments/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Attachment not found');
    });

    it('should return 403 if user does not own the note', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        note: {
          userId: 'other-user-id'
        }
      };

      attachmentDAL.getAttachmentById.mockResolvedValue(mockAttachment);

      const response = await request(app)
        .get('/api/attachments/attachment-1');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access denied');
    });
  });

  describe('GET /api/attachments/:id/download', () => {
    it('should download an attachment file', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        storageKey: 'images/test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        note: {
          userId: 'test-user-id'
        }
      };

      const mockFileData = {
        data: Buffer.from('fake image data'),
        contentType: 'image/jpeg',
        contentLength: 1024
      };

      attachmentDAL.getAttachmentById.mockResolvedValue(mockAttachment);
      downloadFile.mockResolvedValue(mockFileData);

      const response = await request(app)
        .get('/api/attachments/attachment-1/download');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/jpeg');
      // Content-length will be the actual buffer size, not the mock value
      expect(response.headers['content-length']).toBeDefined();
      expect(downloadFile).toHaveBeenCalledWith('images/test.jpg');
    });

    it('should return 404 if attachment not found', async () => {
      attachmentDAL.getAttachmentById.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/attachments/nonexistent/download');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 if user does not own the note', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        note: {
          userId: 'other-user-id'
        }
      };

      attachmentDAL.getAttachmentById.mockResolvedValue(mockAttachment);

      const response = await request(app)
        .get('/api/attachments/attachment-1/download');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 if file not found in storage', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        storageKey: 'images/test.jpg',
        note: {
          userId: 'test-user-id'
        }
      };

      attachmentDAL.getAttachmentById.mockResolvedValue(mockAttachment);
      downloadFile.mockRejectedValue(new Error('File not found'));

      const response = await request(app)
        .get('/api/attachments/attachment-1/download');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('File not found in storage');
    });
  });

  describe('DELETE /api/attachments/:id', () => {
    it('should delete an attachment', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        note: {
          userId: 'test-user-id'
        }
      };

      attachmentDAL.getAttachmentById.mockResolvedValue(mockAttachment);
      attachmentDAL.deleteAttachment.mockResolvedValue(mockAttachment);

      const response = await request(app)
        .delete('/api/attachments/attachment-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual({
        id: 'attachment-1',
        deleted: true
      });
      expect(attachmentDAL.deleteAttachment).toHaveBeenCalledWith('attachment-1');
    });

    it('should return 404 if attachment not found', async () => {
      attachmentDAL.getAttachmentById.mockResolvedValue(null);

      const response = await request(app)
        .delete('/api/attachments/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 403 if user does not own the note', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        note: {
          userId: 'other-user-id'
        }
      };

      attachmentDAL.getAttachmentById.mockResolvedValue(mockAttachment);

      const response = await request(app)
        .delete('/api/attachments/attachment-1');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/attachments/note/:noteId', () => {
    it('should get all attachments for a note', async () => {
      const mockAttachments = [
        {
          id: 'attachment-1',
          url: 'https://s3.example.com/image1.jpg',
          type: 'IMAGE',
          size: 1024,
          mimeType: 'image/jpeg',
          createdAt: new Date().toISOString(),
          note: {
            userId: 'test-user-id'
          },
          analysis: {
            textContent: 'Text 1',
            description: 'Desc 1',
            tags: ['tag1'],
            metadata: {}
          }
        },
        {
          id: 'attachment-2',
          url: 'https://s3.example.com/doc.pdf',
          type: 'DOCUMENT',
          size: 2048,
          mimeType: 'application/pdf',
          createdAt: new Date().toISOString(),
          note: {
            userId: 'test-user-id'
          },
          analysis: null
        }
      ];

      attachmentDAL.getAttachmentsByNoteId.mockResolvedValue(mockAttachments);

      const response = await request(app)
        .get('/api/attachments/note/note-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.attachments).toHaveLength(2);
      expect(response.body.data.attachments[0].id).toBe('attachment-1');
      expect(response.body.data.attachments[0].analysis).toBeDefined();
      expect(response.body.data.attachments[1].analysis).toBeNull();
    });

    it('should return empty array if no attachments found', async () => {
      attachmentDAL.getAttachmentsByNoteId.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/attachments/note/note-1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.attachments).toEqual([]);
    });

    it('should return 403 if user does not own the note', async () => {
      const mockAttachments = [
        {
          id: 'attachment-1',
          note: {
            userId: 'other-user-id'
          }
        }
      ];

      attachmentDAL.getAttachmentsByNoteId.mockResolvedValue(mockAttachments);

      const response = await request(app)
        .get('/api/attachments/note/note-1');

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Error handling', () => {
    it('should handle unexpected errors gracefully', async () => {
      validateFileSize.mockReturnValue(true);
      validateMimeType.mockReturnValue(true);
      uploadAndAnalyzeImage.mockRejectedValue(new Error('Unexpected error'));

      const response = await request(app)
        .post('/api/attachments/upload')
        .field('type', 'IMAGE')
        .field('noteId', 'note-1')
        .attach('file', Buffer.from('fake data'), 'test.jpg');

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Unexpected error');
    });
  });
});
