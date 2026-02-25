/**
 * AI Insights API Routes
 * 
 * Implements REST API endpoint for AI-powered content insights
 * with incremental merge support (append/replace/full modes).
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../services/authService');
const { createAIInsightsService } = require('../services/aiInsightsService');
const { PrismaClient } = require('@prisma/client');

const aiInsightsService = createAIInsightsService();
const prisma = new PrismaClient();

/**
 * Analyze content and return AI insights
 * POST /api/ai/insights
 * 
 * Request Body:
 * {
 *   text: string (required) - Full editor content
 *   addedText?: string - Newly added paragraphs
 *   editedText?: string - Edited paragraphs
 *   hasExistingInsights?: boolean - Whether client has existing insights
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   mode: 'full' | 'append' | 'replace',
 *   data: { concepts, references, summary, message? }
 * }
 */
router.post('/insights', authMiddleware, async (req, res) => {
  try {
    const { text, addedText, editedText, hasExistingInsights } = req.body;

    // Validate required fields
    if (text === undefined || text === null) {
      return res.status(400).json({ success: false, error: 'text is required' });
    }
    if (typeof text !== 'string') {
      return res.status(400).json({ success: false, error: 'text must be a string' });
    }
    if (text.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'text cannot be empty' });
    }

    const result = await aiInsightsService.analyzeContent({
      text,
      addedText,
      editedText,
      hasExistingInsights: !!hasExistingInsights
    });

    res.json({
      success: true,
      mode: result.mode,
      data: {
        concepts: result.data.concepts,
        references: result.data.references,
        summary: result.data.summary,
        ...(result.data.message && { message: result.data.message })
      }
    });
  } catch (error) {
    console.error('Error in AI insights analysis:', error);

    if (error.message.includes('timed out')) {
      return res.status(504).json({ success: false, error: 'AI insights request timed out' });
    }

    if (error.message.includes('LLM') || error.message.includes('API') ||
        error.message.includes('parse') || error.message.includes('Parse')) {
      return res.status(502).json({
        success: false,
        error: error.message.includes('parse') || error.message.includes('Parse')
          ? 'Failed to parse AI response'
          : error.message.includes('Invalid') || error.message.includes('structure')
            ? 'Invalid AI response structure'
            : 'AI service temporarily unavailable'
      });
    }

    if (error.message.includes('Invalid') || error.message.includes('structure')) {
      return res.status(502).json({ success: false, error: 'Invalid AI response structure' });
    }

    if (error.message.includes('must') || error.message.includes('required')) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.status(500).json({ success: false, error: 'Failed to generate insights: ' + error.message });
  }
});

/**
 * Get saved insights for a document
 * GET /api/ai/insights/:docId
 */
router.get('/insights/:docId', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    const record = await prisma.documentInsight.findUnique({ where: { docId } });
    if (!record) {
      return res.json({ success: true, data: null });
    }
    res.json({
      success: true,
      data: {
        concepts: JSON.parse(record.concepts),
        references: JSON.parse(record.references),
        summary: record.summary,
      }
    });
  } catch (error) {
    console.error('Error loading insights:', error);
    res.status(500).json({ success: false, error: 'Failed to load insights' });
  }
});

/**
 * Save/update insights for a document
 * PUT /api/ai/insights/:docId
 */
router.put('/insights/:docId', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    const { concepts, references, summary } = req.body;

    if (!concepts || !references || summary === undefined) {
      return res.status(400).json({ success: false, error: 'concepts, references, summary are required' });
    }

    await prisma.documentInsight.upsert({
      where: { docId },
      create: {
        docId,
        concepts: JSON.stringify(concepts),
        references: JSON.stringify(references),
        summary: summary || '',
      },
      update: {
        concepts: JSON.stringify(concepts),
        references: JSON.stringify(references),
        summary: summary || '',
      },
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving insights:', error);
    res.status(500).json({ success: false, error: 'Failed to save insights' });
  }
});

module.exports = router;
