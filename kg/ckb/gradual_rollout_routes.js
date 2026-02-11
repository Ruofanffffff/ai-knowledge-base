/**
 * API Routes for Gradual Rollout Management
 */

const express = require('express');
const { getGradualRolloutManager } = require('./gradual_rollout');

const router = express.Router();

/**
 * GET /api/rollout/status
 * Get current rollout status
 */
router.get('/status', (req, res) => {
  try {
    const rolloutManager = getGradualRolloutManager();
    const status = rolloutManager.getStatus();
    
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rollout/report
 * Generate comprehensive rollout report
 */
router.get('/report', (req, res) => {
  try {
    const rolloutManager = getGradualRolloutManager();
    const report = rolloutManager.generateReport();
    
    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rollout/phase/start
 * Start a new rollout phase
 * Body: { phase: 1|2|3 }
 */
router.post('/phase/start', (req, res) => {
  try {
    const { phase } = req.body;
    
    if (!phase || ![1, 2, 3].includes(phase)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phase. Must be 1, 2, or 3.',
      });
    }
    
    const rolloutManager = getGradualRolloutManager();
    const result = rolloutManager.startPhase(phase);
    
    res.json({
      success: true,
      message: `Phase ${phase} started successfully`,
      data: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rollout/phase/progress
 * Check if current phase can progress to next phase
 */
router.get('/phase/progress', (req, res) => {
  try {
    const rolloutManager = getGradualRolloutManager();
    const progressCheck = rolloutManager.checkPhaseProgress();
    
    res.json({
      success: true,
      data: progressCheck,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rollout/quality
 * Check quality metrics
 */
router.get('/quality', (req, res) => {
  try {
    const rolloutManager = getGradualRolloutManager();
    const qualityCheck = rolloutManager.checkQualityMetrics();
    
    res.json({
      success: true,
      data: qualityCheck,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rollout/rollback
 * Trigger emergency rollback
 * Body: { reason: string }
 */
router.post('/rollback', (req, res) => {
  try {
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({
        success: false,
        error: 'Reason is required for rollback',
      });
    }
    
    const rolloutManager = getGradualRolloutManager();
    const result = rolloutManager.emergencyRollback(reason);
    
    res.json({
      success: true,
      message: 'Emergency rollback triggered',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rollout/check-emergency
 * Check if emergency rollback should be triggered
 */
router.get('/check-emergency', (req, res) => {
  try {
    const rolloutManager = getGradualRolloutManager();
    const rollbackEvent = rolloutManager.checkEmergencyRollback();
    
    if (rollbackEvent) {
      res.json({
        success: true,
        triggered: true,
        message: 'Emergency rollback triggered',
        data: rollbackEvent,
      });
    } else {
      res.json({
        success: true,
        triggered: false,
        message: 'No emergency rollback needed',
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/rollout/metrics/reset
 * Reset rollout metrics
 */
router.post('/metrics/reset', (req, res) => {
  try {
    const rolloutManager = getGradualRolloutManager();
    rolloutManager.resetMetrics();
    
    res.json({
      success: true,
      message: 'Metrics reset successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/rollout/history
 * Get phase history
 */
router.get('/history', (req, res) => {
  try {
    const rolloutManager = getGradualRolloutManager();
    const status = rolloutManager.getStatus();
    
    res.json({
      success: true,
      data: {
        history: status.phaseHistory,
        currentPhase: status.currentPhase,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
