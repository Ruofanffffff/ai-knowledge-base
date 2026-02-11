/**
 * Search API Routes
 * 
 * Implements REST API endpoints for note search functionality.
 * Validates: Requirements 9.2
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../services/authService');
const searchService = require('../services/notes/searchService');

// ============================================
// Search Routes
// ============================================

/**
 * Search notes
 * GET /api/search
 * 
 * Query parameters:
 * - query: string (required) - Search query
 * - tags: string[] (optional, comma-separated) - Filter by tags
 * - page: number (default: 1) - Page number
 * - limit: number (default: 20) - Items per page
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     results: Array<{
 *       note: Note,
 *       highlights: Array<{
 *         field: 'content' | 'tags',
 *         snippet: string
 *       }>,
 *       score: number
 *     }>,
 *     total: number,
 *     page: number,
 *     limit: number,
 *     totalPages: number
 *   }
 * }
 * 
 * Validates: Requirements 9.2, 9.3, 9.4, 9.5
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      query,
      tags,
      page = 1,
      limit = 20
    } = req.query;

    // Validate required query parameter
    if (!query || query.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required and cannot be empty'
      });
    }

    // Parse tags if provided (comma-separated string)
    let parsedTags;
    if (tags) {
      parsedTags = typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : tags;
    }

    // Validate pagination parameters
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum < 1) {
      return res.status(400).json({
        success: false,
        error: 'Page must be a positive integer'
      });
    }

    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be a positive integer between 1 and 100'
      });
    }

    // Perform search
    const startTime = Date.now();
    const result = await searchService.searchNotes({
      query,
      userId,
      tags: parsedTags,
      page: pageNum,
      limit: limitNum
    });
    const duration = Date.now() - startTime;

    // Log performance warning if search takes too long (> 500ms per requirement 9.6)
    if (duration > 500) {
      console.warn(`Search took ${duration}ms, exceeding 500ms requirement`);
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error searching notes:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get search suggestions based on existing tags
 * GET /api/search/suggestions
 * 
 * Query parameters:
 * - prefix: string (optional) - Tag prefix to filter suggestions
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     suggestions: string[]
 *   }
 * }
 */
router.get('/suggestions', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { prefix = '' } = req.query;

    const suggestions = await searchService.getSearchSuggestions(userId, prefix);

    res.json({
      success: true,
      data: {
        suggestions
      }
    });
  } catch (error) {
    console.error('Error getting search suggestions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
