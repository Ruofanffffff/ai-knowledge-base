/**
 * Accuracy Monitor
 * 
 * Monitors extraction accuracy on test sets and compares optimized vs baseline performance.
 * Implements automatic degradation when accuracy drops below threshold.
 * 
 * Requirements: 8.1, 8.2, 8.3
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Accuracy Monitor Class
 * 
 * Tracks and monitors accuracy metrics for field extraction, entity recognition,
 * and relation extraction. Compares optimized vs baseline performance.
 */
class AccuracyMonitor {
  constructor(config = {}) {
    this.config = {
      // Accuracy thresholds
      maxAccuracyDrop: config.maxAccuracyDrop || 0.02, // 2% max drop
      warningThreshold: config.warningThreshold || 0.015, // 1.5% warning
      
      // Auto-degradation settings
      autoDegradationEnabled: config.autoDegradationEnabled !== false,
      degradationThreshold: config.degradationThreshold || 0.02,
      
      // Logging settings
      loggingEnabled: config.loggingEnabled !== false,
      
      // Test set settings
      minTestSetSize: config.minTestSetSize || 10,
      
      ...config
    };
    
    // In-memory cache for current session metrics
    this.sessionMetrics = {
      fieldExtraction: { baseline: [], optimized: [] },
      entityRecognition: { baseline: [], optimized: [] },
      relationExtraction: { baseline: [], optimized: [] }
    };
    
    // Degradation state
    this.degradationState = {
      fieldExtraction: false,
      entityRecognition: false,
      relationExtraction: false
    };
    
    // Alerts
    this.alerts = [];
  }
  
  /**
   * Record accuracy metrics for a test case
   * 
   * @param {Object} params - Recording parameters
   * @param {string} params.module - Module name (field_extraction, entity_recognition, relation_extraction)
   * @param {string} params.testCaseId - Test case identifier
   * @param {Object} params.metrics - Accuracy metrics (precision, recall, f1)
   * @param {boolean} params.optimized - Whether context optimization was used
   * @param {Object} params.metadata - Additional metadata
   * @returns {Promise<Object>} Recorded metrics
   */
  async recordAccuracy(params) {
    const {
      module,
      testCaseId,
      metrics,
      optimized = false,
      metadata = {}
    } = params;
    
    // Validate metrics
    if (!metrics.precision || !metrics.recall || !metrics.f1) {
      throw new Error('Metrics must include precision, recall, and f1');
    }
    
    // Store in session cache
    const moduleKey = this._getModuleKey(module);
    const modeKey = optimized ? 'optimized' : 'baseline';
    
    if (this.sessionMetrics[moduleKey]) {
      this.sessionMetrics[moduleKey][modeKey].push({
        testCaseId,
        metrics,
        timestamp: new Date().toISOString(),
        metadata
      });
    }
    
    // Log to database if enabled
    if (this.config.loggingEnabled) {
      try {
        await prisma.kGAccuracyMetric.create({
          data: {
            id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            module,
            test_case_id: testCaseId,
            precision: metrics.precision,
            recall: metrics.recall,
            f1_score: metrics.f1,
            optimized,
            metadata: JSON.stringify(metadata),
            created_at: new Date()
          }
        });
      } catch (error) {
        console.error('Failed to log accuracy metrics to database:', error.message);
      }
    }
    
    // Check for accuracy degradation
    await this._checkAccuracyDegradation(module);
    
    return {
      module,
      testCaseId,
      metrics,
      optimized,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Get accuracy comparison between baseline and optimized
   * 
   * @param {Object} options - Query options
   * @param {string} options.module - Module to query
   * @param {Date} options.startDate - Start date
   * @param {Date} options.endDate - End date
   * @returns {Promise<Object>} Accuracy comparison
   */
  async getAccuracyComparison(options = {}) {
    const { module, startDate, endDate } = options;
    
    // Get from session cache
    const sessionComparison = this._getSessionComparison(module);
    
    // Get from database if date range specified
    let dbComparison = null;
    if (startDate || endDate) {
      dbComparison = await this._getDbComparison(module, startDate, endDate);
    }
    
    // Merge results
    return {
      session: sessionComparison,
      historical: dbComparison,
      degradationState: module ? 
        this.degradationState[this._getModuleKey(module)] : 
        this.degradationState
    };
  }
  
  /**
   * Get current accuracy status
   * 
   * @returns {Object} Accuracy status for all modules
   */
  getAccuracyStatus() {
    const status = {};
    
    for (const [moduleKey, data] of Object.entries(this.sessionMetrics)) {
      const baselineF1 = this._calculateAverageF1(data.baseline);
      const optimizedF1 = this._calculateAverageF1(data.optimized);
      const drop = baselineF1 > 0 ? (baselineF1 - optimizedF1) / baselineF1 : 0;
      
      status[moduleKey] = {
        baseline: {
          f1: baselineF1,
          count: data.baseline.length
        },
        optimized: {
          f1: optimizedF1,
          count: data.optimized.length
        },
        drop: drop,
        dropPercent: drop * 100,
        isAcceptable: drop <= this.config.maxAccuracyDrop,
        isDegraded: this.degradationState[moduleKey],
        hasWarning: drop > this.config.warningThreshold && drop <= this.config.maxAccuracyDrop
      };
    }
    
    return status;
  }
  
  /**
   * Check if auto-degradation should be triggered
   * 
   * @param {string} module - Module to check
   * @returns {Promise<boolean>} Whether degradation was triggered
   */
  async _checkAccuracyDegradation(module) {
    if (!this.config.autoDegradationEnabled) {
      return false;
    }
    
    const moduleKey = this._getModuleKey(module);
    const data = this.sessionMetrics[moduleKey];
    
    // Need minimum test cases
    if (data.baseline.length < this.config.minTestSetSize || 
        data.optimized.length < this.config.minTestSetSize) {
      return false;
    }
    
    const baselineF1 = this._calculateAverageF1(data.baseline);
    const optimizedF1 = this._calculateAverageF1(data.optimized);
    const drop = baselineF1 > 0 ? (baselineF1 - optimizedF1) / baselineF1 : 0;
    
    // Check if degradation threshold exceeded
    if (drop > this.config.degradationThreshold) {
      if (!this.degradationState[moduleKey]) {
        this.degradationState[moduleKey] = true;
        
        // Create alert
        this._addAlert({
          type: 'accuracy_degradation',
          severity: 'critical',
          module,
          message: `Accuracy drop of ${(drop * 100).toFixed(1)}% detected in ${module}. Auto-degradation triggered.`,
          data: {
            baselineF1,
            optimizedF1,
            drop,
            threshold: this.config.degradationThreshold
          }
        });
        
        return true;
      }
    } else if (drop > this.config.warningThreshold && drop <= this.config.degradationThreshold) {
      // Warning but not critical
      this._addAlert({
        type: 'accuracy_warning',
        severity: 'warning',
        module,
        message: `Accuracy drop of ${(drop * 100).toFixed(1)}% detected in ${module}. Approaching threshold.`,
        data: {
          baselineF1,
          optimizedF1,
          drop,
          threshold: this.config.degradationThreshold
        }
      });
    }
    
    return false;
  }
  
  /**
   * Get degradation state for a module
   * 
   * @param {string} module - Module name
   * @returns {boolean} Whether module is in degraded state
   */
  isDegraded(module) {
    const moduleKey = this._getModuleKey(module);
    return this.degradationState[moduleKey] || false;
  }
  
  /**
   * Reset degradation state for a module
   * 
   * @param {string} module - Module name
   */
  resetDegradation(module) {
    const moduleKey = this._getModuleKey(module);
    this.degradationState[moduleKey] = false;
    
    // Clear related alerts
    this.alerts = this.alerts.filter(alert => 
      alert.module !== module || alert.type !== 'accuracy_degradation'
    );
  }
  
  /**
   * Get current alerts
   * 
   * @returns {Array} Active alerts
   */
  getAlerts() {
    return [...this.alerts];
  }
  
  /**
   * Clear all alerts
   */
  clearAlerts() {
    this.alerts = [];
  }
  
  /**
   * Reset session metrics
   * 
   * @param {string} module - Optional module to reset (resets all if not specified)
   */
  resetSession(module = null) {
    if (module) {
      const moduleKey = this._getModuleKey(module);
      if (this.sessionMetrics[moduleKey]) {
        this.sessionMetrics[moduleKey] = { baseline: [], optimized: [] };
      }
    } else {
      this.sessionMetrics = {
        fieldExtraction: { baseline: [], optimized: [] },
        entityRecognition: { baseline: [], optimized: [] },
        relationExtraction: { baseline: [], optimized: [] }
      };
    }
  }
  
  /**
   * Get accuracy statistics from database
   * 
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Accuracy statistics
   */
  async getAccuracyStats(options = {}) {
    const { module, startDate, endDate } = options;
    
    try {
      const where = {};
      
      if (module) {
        where.module = module;
      }
      
      if (startDate || endDate) {
        where.created_at = {};
        if (startDate) where.created_at.gte = new Date(startDate);
        if (endDate) where.created_at.lte = new Date(endDate);
      }
      
      const metrics = await prisma.kGAccuracyMetric.findMany({
        where,
        orderBy: { created_at: 'desc' }
      });
      
      // Aggregate by module and optimization mode
      const stats = {};
      
      for (const metric of metrics) {
        if (!stats[metric.module]) {
          stats[metric.module] = {
            baseline: { count: 0, totalF1: 0, metrics: [] },
            optimized: { count: 0, totalF1: 0, metrics: [] }
          };
        }
        
        const mode = metric.optimized ? 'optimized' : 'baseline';
        stats[metric.module][mode].count++;
        stats[metric.module][mode].totalF1 += metric.f1_score;
        stats[metric.module][mode].metrics.push({
          testCaseId: metric.test_case_id,
          precision: metric.precision,
          recall: metric.recall,
          f1: metric.f1_score,
          timestamp: metric.created_at
        });
      }
      
      // Calculate averages and drops
      for (const [mod, data] of Object.entries(stats)) {
        data.baseline.avgF1 = data.baseline.count > 0 ? 
          data.baseline.totalF1 / data.baseline.count : 0;
        data.optimized.avgF1 = data.optimized.count > 0 ? 
          data.optimized.totalF1 / data.optimized.count : 0;
        data.drop = data.baseline.avgF1 > 0 ? 
          (data.baseline.avgF1 - data.optimized.avgF1) / data.baseline.avgF1 : 0;
        data.dropPercent = data.drop * 100;
      }
      
      return stats;
    } catch (error) {
      console.error('Failed to get accuracy stats from database:', error.message);
      return {};
    }
  }
  
  // Private helper methods
  
  _getModuleKey(module) {
    const keyMap = {
      'field_extraction': 'fieldExtraction',
      'entity_recognition': 'entityRecognition',
      'relation_extraction': 'relationExtraction'
    };
    return keyMap[module] || module;
  }
  
  _calculateAverageF1(records) {
    if (records.length === 0) return 0;
    const sum = records.reduce((acc, r) => acc + r.metrics.f1, 0);
    return sum / records.length;
  }
  
  _getSessionComparison(module) {
    if (module) {
      const moduleKey = this._getModuleKey(module);
      const data = this.sessionMetrics[moduleKey];
      
      return {
        baseline: {
          avgF1: this._calculateAverageF1(data.baseline),
          count: data.baseline.length
        },
        optimized: {
          avgF1: this._calculateAverageF1(data.optimized),
          count: data.optimized.length
        }
      };
    }
    
    // Return all modules
    const result = {};
    for (const [moduleKey, data] of Object.entries(this.sessionMetrics)) {
      result[moduleKey] = {
        baseline: {
          avgF1: this._calculateAverageF1(data.baseline),
          count: data.baseline.length
        },
        optimized: {
          avgF1: this._calculateAverageF1(data.optimized),
          count: data.optimized.length
        }
      };
    }
    return result;
  }
  
  async _getDbComparison(module, startDate, endDate) {
    const stats = await this.getAccuracyStats({ module, startDate, endDate });
    return stats;
  }
  
  _addAlert(alert) {
    // Check for duplicate alerts
    const isDuplicate = this.alerts.some(a => 
      a.type === alert.type && 
      a.module === alert.module &&
      a.severity === alert.severity
    );
    
    if (!isDuplicate) {
      this.alerts.push({
        ...alert,
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Singleton instance
let monitorInstance = null;

/**
 * Get or create accuracy monitor singleton
 * 
 * @param {Object} config - Configuration options
 * @returns {AccuracyMonitor} Monitor instance
 */
function getAccuracyMonitor(config = {}) {
  if (!monitorInstance) {
    monitorInstance = new AccuracyMonitor(config);
  }
  return monitorInstance;
}

module.exports = {
  AccuracyMonitor,
  getAccuracyMonitor
};
