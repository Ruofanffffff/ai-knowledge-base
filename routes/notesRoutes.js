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
const fragmentCollector = require('../services/fragmentCollector');

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
    const { content, tags, status } = req.body;
    const user = req.user;
    const userId = user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
    }

    // Validate required fields
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    // Create note
    const note = await noteDAL.createNote({
      user,
      content,
      tags,
      status
    });

    res.status(201).json({
      success: true,
      data: note
    });

    // 异步采集 note_create 碎片，不阻塞主请求
    setImmediate(() => {
      const tagsStr = note.tags && note.tags.length > 0 ? ` [标签: ${note.tags.join(', ')}]` : '';
      fragmentCollector.collect({
        userId,
        fragmentType: 'note_create',
        content: note.content + tagsStr,
        sourceId: note.id,
        sourceMeta: { tags: note.tags }
      }).catch(err => console.error('[FragmentCollector] note_create collection error:', err));
    });
  } catch (error) {
    console.error('Error creating note:', error);

    // 常见部署问题兜底：数据库未迁移或表不存在
    if (error?.code === 'P2021' || /table .*notes.* does not exist/i.test(error?.message || '')) {
      return res.status(503).json({
        success: false,
        error: 'Notes storage is not initialized. Please run Prisma migrations.'
      });
    }

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
    const { content, tags, status } = req.body;
    const userId = req.user.id;

    // Validate at least one field to update
    if (content === undefined && tags === undefined && status === undefined) {
      return res.status(400).json({
        success: false,
        error: 'At least one field (content, tags, or status) must be provided'
      });
    }

    // 获取更新前的便签，用于检测标签变更
    const oldNote = await noteDAL.getNoteById(id, userId);

    // Update note
    const note = await noteDAL.updateNote(id, { content, tags, status }, userId);

    res.json({
      success: true,
      data: note
    });

    // 异步采集碎片，不阻塞主请求
    setImmediate(() => {
      // 采集 note_edit 碎片
      const changeSummary = content !== undefined ? '内容已更新' : '';
      const tagsSummary = tags !== undefined ? ` 标签: [${note.tags.join(', ')}]` : '';
      const editContent = (note.content || '') + (changeSummary ? ` [${changeSummary}]` : '') + tagsSummary;

      fragmentCollector.collect({
        userId,
        fragmentType: 'note_edit',
        content: editContent,
        sourceId: note.id,
        sourceMeta: { content: note.content, tags: note.tags }
      }).catch(err => console.error('[FragmentCollector] note_edit collection error:', err));

      // 检测标签变更，采集 tag_add 碎片
      if (oldNote) {
        const oldTags = (oldNote.tags || []).sort().join(',');
        const newTags = (note.tags || []).sort().join(',');
        if (oldTags !== newTags) {
          fragmentCollector.collect({
            userId,
            fragmentType: 'tag_add',
            content: `标签列表: ${note.tags.join(', ')}`,
            sourceId: note.id,
            sourceMeta: { oldTags: oldNote.tags, newTags: note.tags }
          }).catch(err => console.error('[FragmentCollector] tag_add collection error:', err));
        }
      }
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
      status,
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

    // Ensure user exists in DB (sync from Auth) to avoid query issues
    await noteDAL.ensureUserExists(req.user);

    // List notes
    const result = await noteDAL.listNotes({
      userId,
      tags: parsedTags,
      status: typeof status === 'string' ? status : undefined,
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
