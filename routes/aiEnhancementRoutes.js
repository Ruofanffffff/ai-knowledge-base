/**
 * AI Enhancement API Routes
 * 
 * Implements REST API endpoints for AI-powered text enhancement features.
 * Validates: Requirements 5.2, 6.1, 7.1, 8.1
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../services/authService');
const { createAIEnhancementService } = require('../services/notes/aiEnhancementService');

// Create AI enhancement service instance
const aiService = createAIEnhancementService();

// ============================================
// AI Enhancement Routes
// ============================================

/**
 * Smart generation: Expand text and generate image prompt
 * POST /api/ai/generate
 * 
 * Request Body:
 * {
 *   text: string (required) - Text to expand
 *   context?: string (optional) - Additional context
 *   style?: string (optional) - Desired style (creative, professional, casual)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     expandedText: string,
 *     imagePrompt: string,
 *     metadata: {
 *       model: string,
 *       tokens: number
 *     }
 *   }
 * }
 * 
 * Validates: Requirement 5.2 - AI enhancer expands text and generates image prompts
 */
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { text, context, style } = req.body;

    // Validate required fields
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required'
      });
    }

    if (typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'text must be a string'
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'text cannot be empty'
      });
    }

    // Validate optional parameters
    if (context !== undefined && typeof context !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'context must be a string'
      });
    }

    if (style !== undefined && !['creative', 'professional', 'casual'].includes(style)) {
      return res.status(400).json({
        success: false,
        error: 'style must be one of: creative, professional, casual'
      });
    }

    // Call AI enhancement service
    // Requirement 5.2: Expand text and generate image prompts
    // Requirement 5.5: Complete within 5 seconds (handled by service timeout)
    const result = await aiService.generate({
      text,
      context,
      style
    });

    res.json({
      success: true,
      data: {
        expandedText: result.expandedText,
        imagePrompt: result.imagePrompt,
        metadata: {
          model: result.model,
          tokens: result.tokens
        }
      }
    });
  } catch (error) {
    console.error('Error in smart generation:', error);

    // Handle timeout errors
    if (error.message.includes('timed out')) {
      return res.status(504).json({
        success: false,
        error: 'Smart generation request timed out. Please try again.'
      });
    }

    // Handle LLM service errors
    if (error.message.includes('LLM') || error.message.includes('API')) {
      return res.status(502).json({
        success: false,
        error: 'AI service temporarily unavailable. Please try again later.'
      });
    }

    // Handle validation errors
    if (error.message.includes('must') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to generate content: ' + error.message
    });
  }
});

/**
 * Smart proofreading: Correct errors while preserving meaning and style
 * POST /api/ai/proofread
 * 
 * Request Body:
 * {
 *   text: string (required) - Text to proofread
 *   language?: string (optional) - Language code (zh, en)
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     correctedText: string,
 *     changes: Array<{
 *       type: 'spelling' | 'grammar' | 'punctuation' | 'word-choice',
 *       original: string,
 *       corrected: string,
 *       position?: { start: number, end: number }
 *     }>,
 *     metadata: {
 *       model: string,
 *       tokens: number
 *     }
 *   }
 * }
 * 
 * Validates: Requirement 6.1 - AI enhancer corrects spelling, grammar, punctuation, and word choice
 */
router.post('/proofread', authMiddleware, async (req, res) => {
  try {
    const { text, language } = req.body;

    // Validate required fields
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required'
      });
    }

    if (typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'text must be a string'
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'text cannot be empty'
      });
    }

    // Validate optional parameters
    if (language !== undefined && typeof language !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'language must be a string'
      });
    }

    // Call AI enhancement service
    // Requirement 6.1: Correct spelling, grammar, punctuation errors
    // Requirement 6.2: Correct obvious word choice errors
    // Requirement 6.5: Preserve original meaning, writing style, and sentence structure
    const result = await aiService.proofread({
      text,
      language
    });

    res.json({
      success: true,
      data: {
        correctedText: result.correctedText,
        changes: result.changes,
        metadata: {
          model: result.model,
          tokens: result.tokens
        }
      }
    });
  } catch (error) {
    console.error('Error in smart proofreading:', error);

    // Handle timeout errors
    if (error.message.includes('timed out')) {
      return res.status(504).json({
        success: false,
        error: 'Smart proofreading request timed out. Please try again.'
      });
    }

    // Handle LLM service errors
    if (error.message.includes('LLM') || error.message.includes('API')) {
      return res.status(502).json({
        success: false,
        error: 'AI service temporarily unavailable. Please try again later.'
      });
    }

    // Handle validation errors
    if (error.message.includes('must') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to proofread text: ' + error.message
    });
  }
});

/**
 * Generate table: Convert text to structured table
 * POST /api/ai/generate-table
 * 
 * Request Body:
 * {
 *   text: string (required) - Text to convert to table
 *   maxColumns?: number (optional) - Maximum number of columns
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     table: {
 *       headers: string[],
 *       rows: string[][]
 *     },
 *     notes?: string,
 *     metadata: {
 *       model: string,
 *       tokens: number
 *     }
 *   }
 * }
 * 
 * Validates: Requirement 7.1 - AI enhancer extracts information and creates table structure
 */
router.post('/generate-table', authMiddleware, async (req, res) => {
  try {
    const { text, maxColumns } = req.body;

    // Validate required fields
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required'
      });
    }

    if (typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'text must be a string'
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'text cannot be empty'
      });
    }

    // Validate optional parameters
    if (maxColumns !== undefined) {
      if (typeof maxColumns !== 'number' || maxColumns < 1 || maxColumns > 20) {
        return res.status(400).json({
          success: false,
          error: 'maxColumns must be a number between 1 and 20'
        });
      }
    }

    // Call AI enhancement service
    // Requirement 7.1: Extract information from text
    // Requirement 7.2: Determine most appropriate table structure
    // Requirement 7.3: Create clear, accurate, and readable table data
    // Requirement 7.4: Output table in JSON format
    const result = await aiService.generateTable({
      text,
      maxColumns
    });

    res.json({
      success: true,
      data: {
        table: result.table,
        notes: result.notes,
        metadata: {
          model: result.model,
          tokens: result.tokens
        }
      }
    });
  } catch (error) {
    console.error('Error in table generation:', error);

    // Handle timeout errors
    if (error.message.includes('timed out')) {
      return res.status(504).json({
        success: false,
        error: 'Table generation request timed out. Please try again.'
      });
    }

    // Handle LLM service errors
    if (error.message.includes('LLM') || error.message.includes('API')) {
      return res.status(502).json({
        success: false,
        error: 'AI service temporarily unavailable. Please try again later.'
      });
    }

    // Handle validation errors
    if (error.message.includes('must') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to generate table: ' + error.message
    });
  }
});

/**
 * Generate mind map: Convert text to hierarchical mind map
 * POST /api/ai/generate-mindmap
 * 
 * Request Body:
 * {
 *   text: string (required) - Text to convert to mind map
 *   maxBranches?: number (optional) - Maximum number of first-level branches (3-6)
 *   maxDepth?: number (optional) - Maximum depth of branches
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     mindmap: {
 *       central: string,
 *       branches: Array<{
 *         label: string,
 *         children?: Array<Branch>
 *       }>
 *     },
 *     metadata: {
 *       model: string,
 *       tokens: number
 *     }
 *   }
 * }
 * 
 * Validates: Requirement 8.1 - AI enhancer identifies central theme and creates branches
 */
router.post('/generate-mindmap', authMiddleware, async (req, res) => {
  try {
    const { text, maxBranches, maxDepth } = req.body;

    // Validate required fields
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required'
      });
    }

    if (typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'text must be a string'
      });
    }

    if (text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'text cannot be empty'
      });
    }

    // Validate optional parameters
    if (maxBranches !== undefined) {
      if (typeof maxBranches !== 'number' || maxBranches < 3 || maxBranches > 6) {
        return res.status(400).json({
          success: false,
          error: 'maxBranches must be a number between 3 and 6'
        });
      }
    }

    if (maxDepth !== undefined) {
      if (typeof maxDepth !== 'number' || maxDepth < 1 || maxDepth > 5) {
        return res.status(400).json({
          success: false,
          error: 'maxDepth must be a number between 1 and 5'
        });
      }
    }

    // Call AI enhancement service
    // Requirement 8.1: Identify central theme from text
    // Requirement 8.2: Create 3-6 first-level branches
    // Requirement 8.3: Generate clear hierarchical structure
    // Requirement 8.4: Use keywords instead of long sentences for branch labels
    // Requirement 8.5: Output mind map in JSON format
    const result = await aiService.generateMindMap({
      text,
      maxBranches,
      maxDepth
    });

    res.json({
      success: true,
      data: {
        mindmap: result.mindmap,
        metadata: {
          model: result.model,
          tokens: result.tokens
        }
      }
    });
  } catch (error) {
    console.error('Error in mind map generation:', error);

    // Handle timeout errors
    if (error.message.includes('timed out')) {
      return res.status(504).json({
        success: false,
        error: 'Mind map generation request timed out. Please try again.'
      });
    }

    // Handle LLM service errors
    if (error.message.includes('LLM') || error.message.includes('API')) {
      return res.status(502).json({
        success: false,
        error: 'AI service temporarily unavailable. Please try again later.'
      });
    }

    // Handle validation errors
    if (error.message.includes('must') || error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to generate mind map: ' + error.message
    });
  }
});

/**
 * Get AI service statistics
 * GET /api/ai/stats
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     totalRequests: number,
 *     totalTokens: number,
 *     averageLatency: number
 *   }
 * }
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const stats = aiService.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting AI service stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
