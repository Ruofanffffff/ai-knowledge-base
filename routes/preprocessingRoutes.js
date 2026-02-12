/**
 * LLM Document Index Preprocessing API Routes
 * 
 * Provides endpoints for:
 * - Querying document indices
 * - Querying correction statistics
 * - Regenerating document indices
 * 
 * Requirements: 9.4, 10.5
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../services/authService');
const { PrismaClient } = require('@prisma/client');
const { IndexGenerator } = require('../kg/preprocessing/index_generator');
const CorrectionStatsCollector = require('../kg/preprocessing/correction_stats_collector');
const preprocessingMonitor = require('../kg/preprocessing/preprocessing_monitor');
const { VersionManager } = require('../kg/preprocessing/version_manager');

// Initialize Prisma client
const prisma = new PrismaClient();

// Initialize services
const indexGenerator = new IndexGenerator();
const statsCollector = new CorrectionStatsCollector({ prisma });
const versionManager = new VersionManager({ prisma });

// ============================================
// Document Index Routes
// ============================================

/**
 * Get document index by document ID
 * GET /api/preprocessing/index/:docId
 * 
 * Query params:
 *   - version: Specific version number (optional, defaults to latest)
 */
router.get('/index/:docId', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    const { version } = req.query;
    
    if (!docId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }
    
    // Build query
    const where = { docId };
    const orderBy = { version: 'desc' };
    
    let documentIndex;
    
    if (version) {
      // Get specific version
      where.version = parseInt(version);
      documentIndex = await prisma.documentIndex.findFirst({ where });
    } else {
      // Get latest version
      documentIndex = await prisma.documentIndex.findFirst({
        where,
        orderBy
      });
    }
    
    if (!documentIndex) {
      return res.status(404).json({
        success: false,
        error: `No document index found for document ${docId}${version ? ` version ${version}` : ''}`
      });
    }
    
    // Parse metadata
    const metadata = documentIndex.metadata ? JSON.parse(documentIndex.metadata) : {};
    
    res.json({
      success: true,
      data: {
        id: documentIndex.id,
        docId: documentIndex.docId,
        indexedText: documentIndex.indexedText,
        version: documentIndex.version,
        metadata,
        createdAt: documentIndex.createdAt,
        updatedAt: documentIndex.updatedAt
      }
    });
  } catch (error) {
    console.error('[PreprocessingRoutes] Error getting document index:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Get all versions of document index
 * GET /api/preprocessing/index/:docId/versions
 */
router.get('/index/:docId/versions', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    
    if (!docId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }
    
    const versions = await versionManager.getAllVersions(docId);
    
    if (versions.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No document indices found for document ${docId}`
      });
    }
    
    res.json({
      success: true,
      data: {
        docId,
        count: versions.length,
        versions: versions.map(v => ({
          id: v.id,
          version: v.version,
          metadata: v.metadata,
          createdAt: v.createdAt,
          updatedAt: v.updatedAt
        }))
      }
    });
  } catch (error) {
    console.error('[PreprocessingRoutes] Error getting document index versions:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Get version history summary for a document
 * GET /api/preprocessing/index/:docId/history
 */
router.get('/index/:docId/history', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    
    if (!docId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }
    
    const history = await versionManager.getVersionHistory(docId);
    
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error('[PreprocessingRoutes] Error getting version history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Compare two versions of document index
 * GET /api/preprocessing/index/:docId/compare
 * 
 * Query params:
 *   - version1: First version number (required)
 *   - version2: Second version number (required)
 */
router.get('/index/:docId/compare', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    const { version1, version2 } = req.query;
    
    if (!docId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }
    
    if (!version1 || !version2) {
      return res.status(400).json({
        success: false,
        error: 'Both version1 and version2 are required'
      });
    }
    
    const v1 = parseInt(version1);
    const v2 = parseInt(version2);
    
    if (isNaN(v1) || isNaN(v2)) {
      return res.status(400).json({
        success: false,
        error: 'Version numbers must be valid integers'
      });
    }
    
    const comparison = await versionManager.compareVersions(docId, v1, v2);
    
    res.json({
      success: true,
      data: comparison
    });
  } catch (error) {
    console.error('[PreprocessingRoutes] Error comparing versions:', error);
    
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Delete a specific version
 * DELETE /api/preprocessing/index/:docId/version/:version
 */
router.delete('/index/:docId/version/:version', authMiddleware, async (req, res) => {
  try {
    const { docId, version } = req.params;
    
    if (!docId || !version) {
      return res.status(400).json({
        success: false,
        error: 'Document ID and version are required'
      });
    }
    
    const versionNum = parseInt(version);
    
    if (isNaN(versionNum)) {
      return res.status(400).json({
        success: false,
        error: 'Version must be a valid integer'
      });
    }
    
    const deleted = await versionManager.deleteVersion(docId, versionNum);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: `Version ${versionNum} not found for document ${docId}`
      });
    }
    
    res.json({
      success: true,
      message: `Version ${versionNum} deleted successfully`
    });
  } catch (error) {
    console.error('[PreprocessingRoutes] Error deleting version:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Regenerate document index
 * POST /api/preprocessing/index/:docId/regenerate
 * 
 * Body:
 *   - text: Document text content (required)
 *   - llmConfig: LLM configuration (optional)
 */
router.post('/index/:docId/regenerate', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    const { text, llmConfig } = req.body;
    
    if (!docId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }
    
    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'Document text is required'
      });
    }
    
    // Get LLM client
    const llmClient = await getLLMClient(llmConfig);
    
    // Generate new index
    const documentIndex = await indexGenerator.generateIndexedText(
      docId,
      text,
      llmClient,
      llmConfig
    );
    
    // Save using version manager (automatically increments version)
    const savedIndex = await versionManager.createVersion(docId, documentIndex);
    
    res.json({
      success: true,
      message: `Document index regenerated successfully`,
      data: {
        id: savedIndex.id,
        docId: savedIndex.docId,
        version: savedIndex.version,
        metadata: savedIndex.metadata,
        createdAt: savedIndex.createdAt
      }
    });
  } catch (error) {
    console.error('[PreprocessingRoutes] Error regenerating document index:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to regenerate document index',
      details: error.message
    });
  }
});

// ============================================
// Correction Statistics Routes
// ============================================

/**
 * Get correction statistics for a document
 * GET /api/preprocessing/stats/:docId
 * 
 * Query params:
 *   - stage: Filter by specific stage (optional)
 */
router.get('/stats/:docId', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    const { stage } = req.query;
    
    if (!docId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }
    
    // Build query
    const where = { docId };
    if (stage) {
      where.stage = stage;
    }
    
    const stats = await prisma.correctionStats.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    
    if (stats.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No correction statistics found for document ${docId}${stage ? ` stage ${stage}` : ''}`
      });
    }
    
    // Format response
    const formattedStats = stats.map(stat => ({
      id: stat.id,
      docId: stat.docId,
      stage: stat.stage,
      totalCorrections: stat.totalCorrections,
      accuracyBefore: stat.accuracyBefore,
      accuracyAfter: stat.accuracyAfter,
      accuracyImprovement: stat.accuracyAfter && stat.accuracyBefore 
        ? stat.accuracyAfter - stat.accuracyBefore 
        : null,
      recallBefore: stat.recallBefore,
      recallAfter: stat.recallAfter,
      recallImprovement: stat.recallAfter && stat.recallBefore
        ? stat.recallAfter - stat.recallBefore
        : null,
      precisionBefore: stat.precisionBefore,
      precisionAfter: stat.precisionAfter,
      precisionImprovement: stat.precisionAfter && stat.precisionBefore
        ? stat.precisionAfter - stat.precisionBefore
        : null,
      metadata: stat.metadata ? JSON.parse(stat.metadata) : {},
      createdAt: stat.createdAt,
      updatedAt: stat.updatedAt
    }));
    
    res.json({
      success: true,
      data: {
        docId,
        stage: stage || 'all',
        count: formattedStats.length,
        stats: formattedStats
      }
    });
  } catch (error) {
    console.error('[PreprocessingRoutes] Error getting correction statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Get correction records for a document
 * GET /api/preprocessing/corrections/:docId
 * 
 * Query params:
 *   - stage: Filter by specific stage (optional)
 *   - type: Filter by correction type (optional)
 *   - skip: Pagination offset (default: 0)
 *   - take: Number of results (default: 100)
 */
router.get('/corrections/:docId', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    const { stage, type, skip, take } = req.query;
    
    if (!docId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }
    
    // Build query
    const where = { docId };
    if (stage) {
      where.stage = stage;
    }
    if (type) {
      where.correctionType = type;
    }
    
    const options = {
      skip: skip ? parseInt(skip) : 0,
      take: take ? parseInt(take) : 100,
      orderBy: { createdAt: 'desc' }
    };
    
    const [corrections, total] = await Promise.all([
      prisma.correctionRecord.findMany({
        where,
        ...options
      }),
      prisma.correctionRecord.count({ where })
    ]);
    
    // Format response
    const formattedCorrections = corrections.map(correction => ({
      id: correction.id,
      docId: correction.docId,
      stage: correction.stage,
      correctionType: correction.correctionType,
      originalValue: correction.originalValue ? JSON.parse(correction.originalValue) : null,
      correctedValue: correction.correctedValue ? JSON.parse(correction.correctedValue) : null,
      confidenceBefore: correction.confidenceBefore,
      confidenceAfter: correction.confidenceAfter,
      confidenceImprovement: correction.confidenceAfter && correction.confidenceBefore
        ? correction.confidenceAfter - correction.confidenceBefore
        : null,
      metadata: correction.metadata ? JSON.parse(correction.metadata) : {},
      createdAt: correction.createdAt
    }));
    
    res.json({
      success: true,
      data: {
        docId,
        total,
        count: formattedCorrections.length,
        corrections: formattedCorrections
      }
    });
  } catch (error) {
    console.error('[PreprocessingRoutes] Error getting correction records:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Get aggregated correction statistics across all documents
 * GET /api/preprocessing/stats/aggregate
 * 
 * Query params:
 *   - stage: Filter by specific stage (optional)
 */
router.get('/stats/aggregate', authMiddleware, async (req, res) => {
  try {
    const { stage } = req.query;
    
    // Build query
    const where = {};
    if (stage) {
      where.stage = stage;
    }
    
    const stats = await prisma.correctionStats.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    
    if (stats.length === 0) {
      return res.json({
        success: true,
        data: {
          stage: stage || 'all',
          totalDocuments: 0,
          totalCorrections: 0,
          averageAccuracyImprovement: null,
          averageRecallImprovement: null,
          averagePrecisionImprovement: null
        }
      });
    }
    
    // Calculate aggregates
    const totalDocuments = new Set(stats.map(s => s.docId)).size;
    const totalCorrections = stats.reduce((sum, s) => sum + s.totalCorrections, 0);
    
    const accuracyImprovements = stats
      .filter(s => s.accuracyBefore != null && s.accuracyAfter != null)
      .map(s => s.accuracyAfter - s.accuracyBefore);
    
    const recallImprovements = stats
      .filter(s => s.recallBefore != null && s.recallAfter != null)
      .map(s => s.recallAfter - s.recallBefore);
    
    const precisionImprovements = stats
      .filter(s => s.precisionBefore != null && s.precisionAfter != null)
      .map(s => s.precisionAfter - s.precisionBefore);
    
    const average = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    
    res.json({
      success: true,
      data: {
        stage: stage || 'all',
        totalDocuments,
        totalCorrections,
        averageAccuracyImprovement: average(accuracyImprovements),
        averageRecallImprovement: average(recallImprovements),
        averagePrecisionImprovement: average(precisionImprovements),
        byStage: stage ? null : getStatsByStage(stats)
      }
    });
  } catch (error) {
    console.error('[PreprocessingRoutes] Error getting aggregated statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

// ============================================
// Helper Functions
// ============================================

/**
 * Get LLM client instance
 * @param {Object} config - LLM configuration
 * @returns {Promise<Object>} LLM client
 */
async function getLLMClient(config = {}) {
  // Use the existing LLM client from the system
  const { LLMClient } = require('../kg/enhanced_extraction/llm_client');
  return new LLMClient(config);
}

/**
 * Group statistics by stage
 * @param {Array} stats - Statistics array
 * @returns {Object} Statistics grouped by stage
 */
function getStatsByStage(stats) {
  const stages = ['cbk_correction', 'field_correction', 'schema_correction', 'merge_correction', 'relation_correction'];
  const result = {};
  
  for (const stage of stages) {
    const stageStats = stats.filter(s => s.stage === stage);
    
    if (stageStats.length === 0) {
      result[stage] = null;
      continue;
    }
    
    const totalCorrections = stageStats.reduce((sum, s) => sum + s.totalCorrections, 0);
    
    const accuracyImprovements = stageStats
      .filter(s => s.accuracyBefore != null && s.accuracyAfter != null)
      .map(s => s.accuracyAfter - s.accuracyBefore);
    
    const average = (arr) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    
    result[stage] = {
      documentCount: stageStats.length,
      totalCorrections,
      averageAccuracyImprovement: average(accuracyImprovements)
    };
  }
  
  return result;
}

// ============================================
// Performance Monitoring Routes
// ============================================

/**
 * Get preprocessing performance statistics
 * GET /api/preprocessing/performance/stats
 * 
 * Query params:
 *   - timeRange: Time range in milliseconds (default: 3600000 = 1 hour)
 *   - docId: Filter by specific document (optional)
 */
router.get('/performance/stats', authMiddleware, async (req, res) => {
  try {
    const { timeRange, docId } = req.query;
    
    const options = {
      timeRange: timeRange ? parseInt(timeRange) : 3600000,
      docId: docId || null
    };
    
    const stats = preprocessingMonitor.getPreprocessingStats(options);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('[PreprocessingRoutes] Error getting performance stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Get preprocessing summary for a specific document
 * GET /api/preprocessing/performance/document/:docId/summary
 */
router.get('/performance/document/:docId/summary', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    
    const summary = preprocessingMonitor.getDocumentSummary(docId);
    
    if (!summary) {
      return res.status(404).json({
        success: false,
        error: 'No preprocessing performance data found for this document'
      });
    }
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('[PreprocessingRoutes] Error getting document performance summary:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Clear old performance metrics
 * DELETE /api/preprocessing/performance/metrics/old
 * 
 * Query params:
 *   - olderThan: Clear metrics older than this (in ms, default: 86400000 = 24 hours)
 */
router.delete('/performance/metrics/old', authMiddleware, async (req, res) => {
  try {
    const { olderThan } = req.query;
    const olderThanMs = olderThan ? parseInt(olderThan) : 86400000;
    
    const cleared = preprocessingMonitor.clearOldMetrics(olderThanMs);
    
    res.json({
      success: true,
      message: 'Old metrics cleared successfully',
      data: cleared
    });
  } catch (error) {
    console.error('[PreprocessingRoutes] Error clearing old metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error.message
    });
  }
});

module.exports = router;
