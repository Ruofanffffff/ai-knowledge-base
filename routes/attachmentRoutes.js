/**
 * Attachment API Routes
 * 
 * Implements REST API endpoints for attachment management.
 * Validates: Requirements 2.1, 3.1, 4.1
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { authMiddleware } = require('../services/authService');
const attachmentDAL = require('../services/notes/attachmentDAL');
const noteDAL = require('../services/notes/noteDAL');
const { uploadFileWithRetry, validateFileSize, validateMimeType, downloadFile } = require('../services/notes/s3Client');
const { uploadAndAnalyzeImage } = require('../services/notes/imageAnalysisService');
const { uploadAndProcessDocument } = require('../services/notes/documentProcessingService');
const { uploadAndProcessTable } = require('../services/notes/tableProcessingService');
const { notesConfig } = require('../config/notes.config');

// Configure multer for memory storage (files will be uploaded to S3)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: notesConfig.attachments.maxSize
  }
});

function inferMimeTypeByFilename(filename = '') {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.pdf':
      return 'application/pdf';
    case '.doc':
      return 'application/msword';
    case '.docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.txt':
      return 'text/plain';
    case '.xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.xls':
      return 'application/vnd.ms-excel';
    case '.csv':
      return 'text/csv';
    default:
      return '';
  }
}

function resolveUploadMimeType(file, type) {
  const rawMimeType = (file?.mimetype || '').trim().toLowerCase();
  if (rawMimeType) {
    if (type !== 'DOCUMENT') return rawMimeType;
    // Some clients upload Word/PDF as octet-stream; infer by extension for DOCUMENT.
    if (rawMimeType !== 'application/octet-stream') {
      return rawMimeType;
    }
  }

  return inferMimeTypeByFilename(file?.originalname);
}

// ============================================
// Attachment Routes
// ============================================

/**
 * Upload an attachment
 * POST /api/attachments/upload
 * 
 * Request (multipart/form-data):
 * - file: File (required)
 * - type: 'IMAGE' | 'DOCUMENT' | 'TABLE' (required)
 * - noteId: string (required)
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     id: string,
 *     url: string,
 *     type: string,
 *     size: number,
 *     mimeType: string,
 *     analysis?: {
 *       textContent?: string,
 *       description?: string,
 *       tags?: string[],
 *       metadata?: object
 *     }
 *   }
 * }
 */
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { type, noteId } = req.body;
    const userId = req.user.id;
    const file = req.file;

    // Validate required fields
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'File is required'
      });
    }

    if (!type) {
      return res.status(400).json({
        success: false,
        error: 'Attachment type is required'
      });
    }

    if (!noteId) {
      return res.status(400).json({
        success: false,
        error: 'Note ID is required'
      });
    }

    const note = await noteDAL.getNoteById(noteId, userId);
    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    // Validate attachment type
    const validTypes = ['IMAGE', 'DOCUMENT', 'TABLE'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        error: `Invalid attachment type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    // Validate file size
    try {
      validateFileSize(file.size);
    } catch (error) {
      return res.status(413).json({
        success: false,
        error: error.message
      });
    }

    const effectiveMimeType = resolveUploadMimeType(file, type);

    // Validate MIME type
    try {
      validateMimeType(effectiveMimeType, type);
    } catch (error) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    let result;

    // Process based on attachment type
    switch (type) {
      case 'IMAGE':
        // Upload and analyze image
        // Requirement 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
        result = await uploadAndAnalyzeImage({
          fileData: file.buffer,
          originalFilename: file.originalname,
          userId,
          noteId,
          mimeType: effectiveMimeType,
          analysisType: 'full'
        });
        break;

      case 'DOCUMENT':
        // Upload and process document
        // Requirement 3.1, 3.2, 3.3
        result = await uploadAndProcessDocument({
          fileData: file.buffer,
          originalFilename: file.originalname,
          userId,
          noteId,
          mimeType: effectiveMimeType
        });
        break;

      case 'TABLE':
        // Upload and process table
        // Requirement 4.1, 4.2, 4.3
        result = await uploadAndProcessTable({
          fileData: file.buffer,
          originalFilename: file.originalname,
          userId,
          noteId,
          mimeType: effectiveMimeType
        });
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Unsupported attachment type'
        });
    }

    // Format response
    const response = {
      id: result.attachment.id,
      url: result.attachment.url,
      type: result.attachment.type,
      size: result.attachment.size,
      mimeType: result.attachment.mimeType,
      createdAt: result.attachment.createdAt
    };

    // Include degradation info (storage fallback) if available
    if (result.attachment.degraded) {
      response.degraded = true;
      response.degradationMode = result.attachment.degradationMode || 'LOCAL_CACHE';
      response.fallbackId = result.attachment.fallbackId || null;
    }

    // Include analysis if available
    if (result.analysis) {
      response.analysis = {
        textContent: result.analysis.textContent,
        description: result.analysis.description,
        tags: result.analysis.tags,
        metadata: result.analysis.metadata
      };
    }

    res.status(201).json({
      success: true,
      data: response
    });
  } catch (error) {
    const errorId = `att_upload_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const statusCode = Number(error.statusCode) || 500;
    const isStorageError = String(error.code || '').startsWith('STORAGE_');
    const normalizedStatusCode = isStorageError
      ? (statusCode >= 400 && statusCode < 600 ? statusCode : 503)
      : statusCode;

    const safeErrorContext = {
      errorId,
      route: 'POST /api/attachments/upload',
      code: error.code || 'ATTACHMENT_UPLOAD_FAILED',
      statusCode: normalizedStatusCode,
      retryable: error.retryable,
      operation: error.operation,
      noteId: req.body?.noteId,
      type: req.body?.type,
      userId: req.user?.id,
      fileName: req.file?.originalname,
      fileSize: req.file?.size,
      mimeType: req.file?.mimetype,
      retryErrors: Array.isArray(error.retryErrors) ? error.retryErrors : undefined,
      context: error.context
    };

    console.error('Error uploading attachment:', safeErrorContext, error);
    
    // Handle specific error types
    if (error.message.includes('Note not found')) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    if (error.message.includes('File size') || error.message.includes('MIME type')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    const isDbNotInitialized =
      error?.code === 'P2021' ||
      /no such table/i.test(error?.message || '') ||
      /table .* (notes|attachments|attachment_analysis) .* does not exist/i.test(error?.message || '');

    if (isDbNotInitialized) {
      return res.status(503).json({
        success: false,
        error: 'Notes storage is not initialized. Please run Prisma migrations.',
        errorCode: error.code || 'NOTES_STORAGE_NOT_INITIALIZED',
        errorId
      });
    }

    res.status(normalizedStatusCode).json({
      success: false,
      error: error.message,
      errorCode: error.code || 'ATTACHMENT_UPLOAD_FAILED',
      errorId
    });
  }
});

/**
 * Get an attachment by ID
 * GET /api/attachments/:id
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     id: string,
 *     url: string,
 *     type: string,
 *     size: number,
 *     mimeType: string,
 *     storageKey: string,
 *     noteId: string,
 *     createdAt: string,
 *     analysis?: {
 *       id: string,
 *       textContent?: string,
 *       description?: string,
 *       tags?: string[],
 *       metadata?: object,
 *       createdAt: string
 *     }
 *   }
 * }
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get attachment
    const attachment = await attachmentDAL.getAttachmentById(id);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found'
      });
    }

    // Verify user owns the note
    if (attachment.note && attachment.note.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Format response
    const response = {
      id: attachment.id,
      url: attachment.url,
      type: attachment.type,
      size: attachment.size,
      mimeType: attachment.mimeType,
      storageKey: attachment.storageKey,
      noteId: attachment.noteId,
      createdAt: attachment.createdAt
    };

    // Include analysis if available
    if (attachment.analysis) {
      response.analysis = {
        id: attachment.analysis.id,
        textContent: attachment.analysis.textContent,
        description: attachment.analysis.description,
        tags: attachment.analysis.tags,
        metadata: attachment.analysis.metadata,
        createdAt: attachment.analysis.createdAt
      };
    }

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error getting attachment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Download attachment file
 * GET /api/attachments/:id/download
 * 
 * Response: Binary file data
 */
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get attachment
    const attachment = await attachmentDAL.getAttachmentById(id);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found'
      });
    }

    // Verify user owns the note
    if (attachment.note && attachment.note.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Download file from S3
    const fileData = await downloadFile(attachment.storageKey);

    // Set response headers
    res.setHeader('Content-Type', fileData.contentType || attachment.mimeType);
    res.setHeader('Content-Length', fileData.contentLength || attachment.size);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.storageKey.split('/').pop()}"`);

    // Send file data
    res.send(fileData.data);
  } catch (error) {
    console.error('Error downloading attachment:', error);
    
    if (error.message.includes('File not found')) {
      return res.status(404).json({
        success: false,
        error: 'File not found in storage'
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete an attachment
 * DELETE /api/attachments/:id
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     id: string,
 *     deleted: boolean
 *   }
 * }
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get attachment first to verify ownership
    const attachment = await attachmentDAL.getAttachmentById(id);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Attachment not found'
      });
    }

    // Verify user owns the note
    if (attachment.note && attachment.note.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Delete from database (cascade will delete analysis)
    await attachmentDAL.deleteAttachment(id);

    // Note: We don't delete from S3 immediately for data recovery purposes
    // A background job should handle S3 cleanup for orphaned files

    res.json({
      success: true,
      data: {
        id,
        deleted: true
      }
    });
  } catch (error) {
    console.error('Error deleting attachment:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get attachments for a note
 * GET /api/attachments/note/:noteId
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     attachments: Attachment[]
 *   }
 * }
 */
router.get('/note/:noteId', authMiddleware, async (req, res) => {
  try {
    const { noteId } = req.params;
    const userId = req.user.id;

    // Get attachments
    const attachments = await attachmentDAL.getAttachmentsByNoteId(noteId);

    // Verify user owns the note (check first attachment)
    if (attachments.length > 0 && attachments[0].note && attachments[0].note.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Format response
    const formattedAttachments = attachments.map(att => ({
      id: att.id,
      url: att.url,
      type: att.type,
      size: att.size,
      mimeType: att.mimeType,
      createdAt: att.createdAt,
      analysis: att.analysis ? {
        textContent: att.analysis.textContent,
        description: att.analysis.description,
        tags: att.analysis.tags,
        metadata: att.analysis.metadata
      } : null
    }));

    res.json({
      success: true,
      data: {
        attachments: formattedAttachments
      }
    });
  } catch (error) {
    console.error('Error getting attachments for note:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Multer error handler for attachment upload
 * Ensures upload validation errors return 4xx instead of unhandled 500.
 */
router.use((err, req, res, next) => {
  if (!(err instanceof multer.MulterError)) {
    return next(err);
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      success: false,
      error: `File size exceeds maximum allowed size (${Math.round(notesConfig.attachments.maxSize / (1024 * 1024))}MB)`
    });
  }

  return res.status(400).json({
    success: false,
    error: err.message || 'Invalid upload request'
  });
});

module.exports = router;
