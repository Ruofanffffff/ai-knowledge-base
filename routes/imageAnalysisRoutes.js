/**
 * Image Analysis API Routes
 * 
 * Implements REST API endpoints for image analysis functionality.
 * Validates: Requirements 2.2, 2.3, 2.4
 */

const express = require('express');
const router = express.Router();
const { authMiddleware, requirePermission } = require('../services/authService');
const { reanalyzeAttachment, analyzeImage } = require('../services/notes/imageAnalysisService');
const { getAttachmentById } = require('../services/notes/attachmentDAL');

// ============================================
// Image Analysis Routes
// ============================================

/**
 * Analyze an image
 * POST /api/image-analysis
 * 
 * This endpoint analyzes an existing image attachment or re-analyzes it with different settings.
 * 
 * Request Body:
 * {
 *   imageId: string (required) - Attachment ID of the image
 *   analysisType: 'text' | 'content' | 'full' (optional, default: 'full')
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     imageId: string,
 *     textContent?: string,
 *     description?: string,
 *     tags?: string[],
 *     metadata: {
 *       width?: number,
 *       height?: number,
 *       format?: string,
 *       analysisType: string,
 *       imageType?: string,
 *       elements?: string[],
 *       llmModel?: string,
 *       llmProvider?: string,
 *       tokens?: number,
 *       analyzedAt: string
 *     }
 *   }
 * }
 * 
 * Validates: Requirements 2.2, 2.3, 2.4
 */
router.post('/', authMiddleware, requirePermission('ai:use'), async (req, res) => {
  try {
    const { imageId, analysisType = 'full' } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!imageId) {
      return res.status(400).json({
        success: false,
        error: 'imageId is required'
      });
    }

    // Validate analysis type
    const validAnalysisTypes = ['text', 'content', 'full'];
    if (!validAnalysisTypes.includes(analysisType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid analysisType. Must be one of: ${validAnalysisTypes.join(', ')}`
      });
    }

    // Get attachment to verify it exists and user has access
    const attachment = await getAttachmentById(imageId);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Image attachment not found'
      });
    }

    // Verify attachment is an image
    if (attachment.type !== 'IMAGE') {
      return res.status(400).json({
        success: false,
        error: 'Attachment is not an image. Only IMAGE attachments can be analyzed.'
      });
    }

    // Verify user owns the note
    if (attachment.note && attachment.note.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You do not have permission to analyze this image.'
      });
    }

    // Re-analyze the attachment
    // Requirement 2.2: Use multimodal LLM to process image
    // Requirement 2.3: Use LLM for text recognition and content understanding
    // Requirement 2.4: Analyze visual content and generate detailed description
    const analysis = await reanalyzeAttachment(imageId, analysisType);

    // Format response according to API specification
    const response = {
      imageId: attachment.id,
      textContent: analysis.textContent,
      description: analysis.description,
      tags: analysis.tags || [],
      metadata: {
        // Include image dimensions if available in attachment metadata
        ...(attachment.metadata?.width && { width: attachment.metadata.width }),
        ...(attachment.metadata?.height && { height: attachment.metadata.height }),
        ...(attachment.mimeType && { format: attachment.mimeType.split('/')[1] }),
        // Include analysis metadata
        analysisType: analysis.metadata?.analysisType || analysisType,
        imageType: analysis.metadata?.imageType,
        elements: analysis.metadata?.elements || [],
        llmModel: analysis.metadata?.llmModel,
        llmProvider: analysis.metadata?.llmProvider,
        tokens: analysis.metadata?.tokens || 0,
        analyzedAt: analysis.metadata?.analyzedAt || analysis.createdAt
      }
    };

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error analyzing image:', error);

    // Handle specific error types
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('Only IMAGE attachments')) {
      return res.status(400).json({
        success: false,
        error: error.message
      });
    }

    if (error.message.includes('LLM') || error.message.includes('timeout')) {
      return res.status(502).json({
        success: false,
        error: 'Image analysis service temporarily unavailable. Please try again later.'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to analyze image: ' + error.message
    });
  }
});

/**
 * Get analysis for an image attachment
 * GET /api/image-analysis/:imageId
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     imageId: string,
 *     textContent?: string,
 *     description?: string,
 *     tags?: string[],
 *     metadata: object
 *   }
 * }
 */
router.get('/:imageId', authMiddleware, async (req, res) => {
  try {
    const { imageId } = req.params;
    const userId = req.user.id;

    // Get attachment with analysis
    const attachment = await getAttachmentById(imageId);

    if (!attachment) {
      return res.status(404).json({
        success: false,
        error: 'Image attachment not found'
      });
    }

    // Verify attachment is an image
    if (attachment.type !== 'IMAGE') {
      return res.status(400).json({
        success: false,
        error: 'Attachment is not an image'
      });
    }

    // Verify user owns the note
    if (attachment.note && attachment.note.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Check if analysis exists
    if (!attachment.analysis) {
      return res.status(404).json({
        success: false,
        error: 'No analysis found for this image. Use POST /api/image-analysis to analyze it.'
      });
    }

    // Format response
    const response = {
      imageId: attachment.id,
      textContent: attachment.analysis.textContent,
      description: attachment.analysis.description,
      tags: attachment.analysis.tags || [],
      metadata: {
        ...(attachment.metadata?.width && { width: attachment.metadata.width }),
        ...(attachment.metadata?.height && { height: attachment.metadata.height }),
        ...(attachment.mimeType && { format: attachment.mimeType.split('/')[1] }),
        ...attachment.analysis.metadata
      }
    };

    res.json({
      success: true,
      data: response
    });
  } catch (error) {
    console.error('Error getting image analysis:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
