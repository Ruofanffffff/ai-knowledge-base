/**
 * Notes API Routes
 * 
 * Implements REST API endpoints for note management.
 * Validates: Requirements 1.1, 1.5
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission } = require('../services/authService');
const noteDAL = require('../services/notes/noteDAL');
const attachmentDAL = require('../services/notes/attachmentDAL');

// ============================================
// Note Routes
// ============================================

/**
 * Create a new note
 * POST /api/notes
 * 
 * Request body:
 * {
 *   content: string (required),
 *   tags: string[] (optional, will be extracted from content if not provided)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     id: string,
 *     userId: string,
 *     content: string,
 *     tags: string[],
 *     attachments: Attachment[],
 *     createdAt: string,
 *     updatedAt: string
 *   }
 * }
 */
router.post('/', authMiddleware, requirePermission('document:write'), async (req, res) => {
  try {
    const { content, tags } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    // Create note
    const note = await noteDAL.createNote({
      userId,
      content,
      tags
    });

    res.status(201).json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error creating note:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get a note by ID
 * GET /api/notes/:id
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     id: string,
 *     userId: string,
 *     content: string,
 *     tags: string[],
 *     attachments: Attachment[],
 *     createdAt: string,
 *     updatedAt: string
 *   }
 * }
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Get note (with user authorization)
    const note = await noteDAL.getNoteById(id, userId);

    if (!note) {
      return res.status(404).json({
        success: false,
        error: 'Note not found'
      });
    }

    res.json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error getting note:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update a note
 * PUT /api/notes/:id
 * 
 * Request body:
 * {
 *   content?: string,
 *   tags?: string[]
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     id: string,
 *     userId: string,
 *     content: string,
 *     tags: string[],
 *     attachments: Attachment[],
 *     createdAt: string,
 *     updatedAt: string
 *   }
 * }
 */
router.put('/:id', authMiddleware, requirePermission('document:write'), async (req, res) => {
  try {
    const { id } = req.params;
    const { content, tags } = req.body;
    const userId = req.user.id;

    // Validate at least one field to update
    if (content === undefined && tags === undefined) {
      return res.status(400).json({
        success: false,
        error: 'At least one field (content or tags) must be provided'
      });
    }

    // Update note
    const note = await noteDAL.updateNote(id, { content, tags }, userId);

    res.json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error updating note:', error);
    
    if (error.message === 'Note not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete a note
 * DELETE /api/notes/:id
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     id: string,
 *     userId: string,
 *     content: string,
 *     tags: string[],
 *     createdAt: string,
 *     updatedAt: string
 *   }
 * }
 */
router.delete('/:id', authMiddleware, requirePermission('document:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Delete note
    const note = await noteDAL.deleteNote(id, userId);

    res.json({
      success: true,
      data: note
    });
  } catch (error) {
    console.error('Error deleting note:', error);
    
    if (error.message === 'Note not found') {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List notes with pagination and filtering
 * GET /api/notes
 * 
 * Query parameters:
 * - page: number (default: 1)
 * - limit: number (default: 20)
 * - tags: string[] (optional, comma-separated)
 * - sortBy: 'createdAt' | 'updatedAt' (default: 'createdAt')
 * - order: 'asc' | 'desc' (default: 'desc')
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     notes: Note[],
 *     total: number,
 *     page: number,
 *     limit: number,
 *     totalPages: number
 *   }
 * }
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      tags,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    // Parse tags if provided (comma-separated string)
    let parsedTags;
    if (tags) {
      parsedTags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
    }

    // Validate sortBy
    if (!['createdAt', 'updatedAt'].includes(sortBy)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sortBy parameter. Must be "createdAt" or "updatedAt"'
      });
    }

    // Validate order
    if (!['asc', 'desc'].includes(order)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order parameter. Must be "asc" or "desc"'
      });
    }

    // List notes
    const result = await noteDAL.listNotes({
      userId,
      tags: parsedTags,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      sortBy,
      order
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error listing notes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get all unique tags for the current user
 * GET /api/notes/tags/all
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     tags: string[]
 *   }
 * }
 */
router.get('/tags/all', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const tags = await noteDAL.getUserTags(userId);

    res.json({
      success: true,
      data: {
        tags
      }
    });
  } catch (error) {
    console.error('Error getting user tags:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get note count for the current user
 * GET /api/notes/stats/count
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     count: number
 *   }
 * }
 */
router.get('/stats/count', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const count = await noteDAL.countNotesByUser(userId);

    res.json({
      success: true,
      data: {
        count
      }
    });
  } catch (error) {
    console.error('Error counting notes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
