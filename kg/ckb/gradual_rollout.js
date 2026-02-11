/**
 * Gradual Rollout Manager for CKB Intelligent Chunking
 * 
 * Implements a three-phase rollout strategy:
 * - Phase 1: 10% traffic (1 week)
 * - Phase 2: 50% traffic (1 week)
 * - Phase 3: 100% full rollout
 * 
 * Features:
 * - Traffic splitting based on document ID hash
 * - Automatic rollback on quality degradation
 * - Metrics tracking and reporting
 * - Phase progression controls
 */

const crypto = require('crypto');
const { getTokenMonitor } = require('./token_monitor');
const { getAccuracyMonitor } = require('./accuracy_monitor');
const { getLatencyMonitor } = require('./latency_monitor');

class GradualRolloutManager {
  constructor(options = {}) {
    this.currentPhase = options.initialPhase || 0; // 0=disabled, 1=10%, 2=50%, 3=100%
    this.phaseStartTime = null;
    this.rolloutEnabled = options.enabled !== false;
    
    // Rollout configuration
    this.config = {
      phase1Percentage: options.phase1Percentage || 10,
      phase2Percentage: options.phase2Percentage || 50,
      phase3Percentage: options.phase3Percentage || 100,
      phaseDurationDays: options.phaseDurationDays || 7,
      
      // Emergency rollback triggers
      maxAccuracyDrop: options.maxAccuracyDrop || 0.05, // 5%
      maxErrorRate: options.maxErrorRate || 0.05, // 5%
      maxLatencyIncrease: options.maxLatencyIncrease || 2.0, // 2x
      minTokenSavings: options.minTokenSavings || 0.50, // 50%
    };
    
    // Monitoring
    this.tokenMonitor = getTokenMonitor();
    this.accuracyMonitor = getAccuracyMonitor();
    this.latencyMonitor = getLatencyMonitor();
    
    // Metrics
    this.metrics = {
      totalRequests: 0,
      optimizedRequests: 0,
      baselineRequests: 0,
      errors: 0,
      rollbacks: 0,
    };
    
    // Phase history
    this.phaseHistory = [];
  }
  
  /**
   * Determine if optimization should be used for this request
   * @param {string} documentId - Document ID for consistent hashing
   * @returns {boolean} True if optimization should be used
   */
  shouldUseOptimization(documentId) {
    if (!this.rolloutEnabled || this.currentPhase === 0) {
      return false;
    }
    
    if (this.currentPhase === 3) {
      // Phase 3: 100% rollout
      return true;
    }
    
    // Use consistent hashing for traffic splitting
    const hash = this._hashDocumentId(documentId);
    const percentage = this._getCurrentPercentage();
    
    // Determine if this request should use optimization
    const shouldOptimize = hash < percentage;
    
    // Track metrics
    this.metrics.totalRequests++;
    if (shouldOptimize) {
      this.metrics.optimizedRequests++;
    } else {
      this.metrics.baselineRequests++;
    }
    
    return shouldOptimize;
  }
  
  /**
   * Start a new rollout phase
   * @param {number} phase - Phase number (1, 2, or 3)
   * @returns {Object} Phase start result
   */
  startPhase(phase) {
    if (phase < 1 || phase > 3) {
      throw new Error(`Invalid phase: ${phase}. Must be 1, 2, or 3.`);
    }
    
    if (phase <= this.currentPhase) {
      throw new Error(`Cannot start phase ${phase}. Current phase is ${this.currentPhase}.`);
    }
    
    // Record phase transition
    const previousPhase = this.currentPhase;
    this.currentPhase = phase;
    this.phaseStartTime = Date.now();
    
    this.phaseHistory.push({
      phase,
      startTime: this.phaseStartTime,
      previousPhase,
      metrics: { ...this.metrics },
    });
    
    console.log(`[GradualRollout] Started Phase ${phase} (${this._getCurrentPercentage()}% traffic)`);
    
    return {
      phase,
      percentage: this._getCurrentPercentage(),
      startTime: this.phaseStartTime,
      previousPhase,
    };
  }
  
  /**
   * Check if current phase should progress to next phase
   * @returns {Object} Progress check result
   */
  checkPhaseProgress() {
    if (this.currentPhase === 0 || this.currentPhase === 3) {
      return {
        canProgress: false,
        reason: this.currentPhase === 0 ? 'Rollout not started' : 'Already at 100%',
      };
    }
    
    if (!this.phaseStartTime) {
      return {
        canProgress: false,
        reason: 'Phase start time not set',
      };
    }
    
    // Check if phase duration has elapsed
    const elapsedDays = (Date.now() - this.phaseStartTime) / (1000 * 60 * 60 * 24);
    if (elapsedDays < this.config.phaseDurationDays) {
      return {
        canProgress: false,
        reason: `Phase duration not met (${elapsedDays.toFixed(1)}/${this.config.phaseDurationDays} days)`,
        elapsedDays,
        remainingDays: this.config.phaseDurationDays - elapsedDays,
      };
    }
    
    // Check quality metrics
    const qualityCheck = this.checkQualityMetrics();
    if (!qualityCheck.passed) {
      return {
        canProgress: false,
        reason: 'Quality metrics not met',
        qualityCheck,
      };
    }
    
    return {
      canProgress: true,
      reason: 'Phase duration met and quality metrics passed',
      elapsedDays,
      qualityCheck,
      nextPhase: this.currentPhase + 1,
    };
  }
  
  /**
   * Check if quality metrics meet rollout criteria
   * @returns {Object} Quality check result
   */
  checkQualityMetrics() {
    const checks = {
      passed: true,
      failures: [],
      metrics: {},
    };
    
    // Check accuracy
    const accuracyStatus = this.accuracyMonitor.getAccuracyStatus();
    checks.metrics.accuracy = accuracyStatus;
    
    if (accuracyStatus.accuracyDrop > this.config.maxAccuracyDrop) {
      checks.passed = false;
      checks.failures.push({
        metric: 'accuracy',
        value: accuracyStatus.accuracyDrop,
        threshold: this.config.maxAccuracyDrop,
        message: `Accuracy drop ${(accuracyStatus.accuracyDrop * 100).toFixed(1)}% exceeds threshold ${(this.config.maxAccuracyDrop * 100).toFixed(1)}%`,
      });
    }
    
    // Check error rate
    const errorRate = this.metrics.totalRequests > 0
      ? this.metrics.errors / this.metrics.totalRequests
      : 0;
    checks.metrics.errorRate = errorRate;
    
    if (errorRate > this.config.maxErrorRate) {
      checks.passed = false;
      checks.failures.push({
        metric: 'errorRate',
        value: errorRate,
        threshold: this.config.maxErrorRate,
        message: `Error rate ${(errorRate * 100).toFixed(1)}% exceeds threshold ${(this.config.maxErrorRate * 100).toFixed(1)}%`,
      });
    }
    
    // Check latency
    const latencyStatus = this.latencyMonitor.getLatencyStatus();
    checks.metrics.latency = latencyStatus;
    
    if (latencyStatus.avgOptimized > latencyStatus.avgBaseline * this.config.maxLatencyIncrease) {
      checks.passed = false;
      checks.failures.push({
        metric: 'latency',
        value: latencyStatus.avgOptimized / latencyStatus.avgBaseline,
        threshold: this.config.maxLatencyIncrease,
        message: `Latency increased ${(latencyStatus.avgOptimized / latencyStatus.avgBaseline).toFixed(2)}x exceeds threshold ${this.config.maxLatencyIncrease}x`,
      });
    }
    
    // Check token savings
    const tokenStatus = this.tokenMonitor.getBudgetStatus();
    const tokenSavings = tokenStatus.optimizationRatio
      ? 1 - tokenStatus.optimizationRatio
      : 0;
    checks.metrics.tokenSavings = tokenSavings;
    
    if (tokenSavings < this.config.minTokenSavings) {
      checks.passed = false;
      checks.failures.push({
        metric: 'tokenSavings',
        value: tokenSavings,
        threshold: this.config.minTokenSavings,
        message: `Token savings ${(tokenSavings * 100).toFixed(1)}% below threshold ${(this.config.minTokenSavings * 100).toFixed(1)}%`,
      });
    }
    
    return checks;
  }
  
  /**
   * Trigger emergency rollback
   * @param {string} reason - Reason for rollback
   * @returns {Object} Rollback result
   */
  emergencyRollback(reason) {
    const previousPhase = this.currentPhase;
    this.currentPhase = 0;
    this.rolloutEnabled = false;
    this.metrics.rollbacks++;
    
    const rollbackEvent = {
      timestamp: Date.now(),
      previousPhase,
      reason,
      metrics: { ...this.metrics },
      qualityCheck: this.checkQualityMetrics(),
    };
    
    this.phaseHistory.push({
      phase: 0,
      startTime: Date.now(),
      previousPhase,
      rollback: true,
      reason,
    });
    
    console.error(`[GradualRollout] EMERGENCY ROLLBACK from Phase ${previousPhase}: ${reason}`);
    
    return rollbackEvent;
  }
  
  /**
   * Check if emergency rollback should be triggered
   * @returns {Object|null} Rollback event if triggered, null otherwise
   */
  checkEmergencyRollback() {
    if (this.currentPhase === 0) {
      return null; // Already rolled back
    }
    
    const qualityCheck = this.checkQualityMetrics();
    
    if (!qualityCheck.passed) {
      const reasons = qualityCheck.failures.map(f => f.message).join('; ');
      return this.emergencyRollback(`Quality metrics failed: ${reasons}`);
    }
    
    return null;
  }
  
  /**
   * Get current rollout status
   * @returns {Object} Rollout status
   */
  getStatus() {
    const qualityCheck = this.checkQualityMetrics();
    const progressCheck = this.checkPhaseProgress();
    
    return {
      enabled: this.rolloutEnabled,
      currentPhase: this.currentPhase,
      percentage: this._getCurrentPercentage(),
      phaseStartTime: this.phaseStartTime,
      phaseDuration: this.phaseStartTime
        ? (Date.now() - this.phaseStartTime) / (1000 * 60 * 60 * 24)
        : 0,
      metrics: {
        ...this.metrics,
        errorRate: this.metrics.totalRequests > 0
          ? this.metrics.errors / this.metrics.totalRequests
          : 0,
        optimizationRate: this.metrics.totalRequests > 0
          ? this.metrics.optimizedRequests / this.metrics.totalRequests
          : 0,
      },
      qualityCheck,
      progressCheck,
      phaseHistory: this.phaseHistory,
    };
  }
  
  /**
   * Generate rollout report
   * @returns {Object} Detailed rollout report
   */
  generateReport() {
    const status = this.getStatus();
    const tokenStatus = this.tokenMonitor.getBudgetStatus();
    const accuracyStatus = this.accuracyMonitor.getAccuracyStatus();
    const latencyStatus = this.latencyMonitor.getLatencyStatus();
    
    return {
      summary: {
        phase: status.currentPhase,
        percentage: status.percentage,
        duration: status.phaseDuration.toFixed(1) + ' days',
        totalRequests: status.metrics.totalRequests,
        optimizedRequests: status.metrics.optimizedRequests,
        errorRate: (status.metrics.errorRate * 100).toFixed(2) + '%',
      },
      performance: {
        tokenSavings: tokenStatus.optimizationRatio
          ? ((1 - tokenStatus.optimizationRatio) * 100).toFixed(1) + '%'
          : 'N/A',
        accuracyDrop: (accuracyStatus.accuracyDrop * 100).toFixed(2) + '%',
        latencyImprovement: latencyStatus.avgBaseline && latencyStatus.avgOptimized
          ? ((1 - latencyStatus.avgOptimized / latencyStatus.avgBaseline) * 100).toFixed(1) + '%'
          : 'N/A',
      },
      quality: {
        passed: status.qualityCheck.passed,
        failures: status.qualityCheck.failures,
      },
      progress: {
        canProgress: status.progressCheck.canProgress,
        reason: status.progressCheck.reason,
        nextPhase: status.progressCheck.nextPhase,
      },
      history: status.phaseHistory.map(h => ({
        phase: h.phase,
        startTime: new Date(h.startTime).toISOString(),
        rollback: h.rollback || false,
        reason: h.reason,
      })),
    };
  }
  
  /**
   * Record an error
   */
  recordError() {
    this.metrics.errors++;
  }
  
  /**
   * Reset metrics (for testing or new phase)
   */
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      optimizedRequests: 0,
      baselineRequests: 0,
      errors: 0,
      rollbacks: this.metrics.rollbacks, // Preserve rollback count
    };
  }
  
  /**
   * Hash document ID to percentage (0-100)
   * @private
   */
  _hashDocumentId(documentId) {
    const hash = crypto.createHash('md5').update(documentId).digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    return (hashInt % 100) + 1; // 1-100
  }
  
  /**
   * Get current rollout percentage
   * @private
   */
  _getCurrentPercentage() {
    switch (this.currentPhase) {
      case 0: return 0;
      case 1: return this.config.phase1Percentage;
      case 2: return this.config.phase2Percentage;
      case 3: return this.config.phase3Percentage;
      default: return 0;
    }
  }
}

// Singleton instance
let rolloutManager = null;

/**
 * Get or create the gradual rollout manager
 * @param {Object} options - Configuration options
 * @returns {GradualRolloutManager}
 */
function getGradualRolloutManager(options = {}) {
  if (!rolloutManager) {
    rolloutManager = new GradualRolloutManager({
      enabled: process.env.ENABLE_GRADUAL_ROLLOUT === 'true',
      initialPhase: parseInt(process.env.ROLLOUT_INITIAL_PHASE) || 0,
      phase1Percentage: parseInt(process.env.ROLLOUT_PHASE1_PERCENTAGE) || 10,
      phase2Percentage: parseInt(process.env.ROLLOUT_PHASE2_PERCENTAGE) || 50,
      phase3Percentage: parseInt(process.env.ROLLOUT_PHASE3_PERCENTAGE) || 100,
      phaseDurationDays: parseInt(process.env.ROLLOUT_PHASE_DURATION_DAYS) || 7,
      maxAccuracyDrop: parseFloat(process.env.ROLLOUT_MAX_ACCURACY_DROP) || 0.05,
      maxErrorRate: parseFloat(process.env.ROLLOUT_MAX_ERROR_RATE) || 0.05,
      maxLatencyIncrease: parseFloat(process.env.ROLLOUT_MAX_LATENCY_INCREASE) || 2.0,
      minTokenSavings: parseFloat(process.env.ROLLOUT_MIN_TOKEN_SAVINGS) || 0.50,
      ...options,
    });
  }
  return rolloutManager;
}

/**
 * Reset the singleton instance (for testing)
 */
function resetGradualRolloutManager() {
  rolloutManager = null;
}

module.exports = {
  GradualRolloutManager,
  getGradualRolloutManager,
  resetGradualRolloutManager,
};
