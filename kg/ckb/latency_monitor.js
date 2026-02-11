/**
 * Latency Monitor
 * 
 * Monitors end-to-end processing latency and module-level performance.
 * Identifies performance bottlenecks and tracks latency improvements.
 * 
 * Requirements: 9.4, 9.5
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Latency Monitor Class
 * 
 * Tracks latency metrics for document processing, field extraction,
 * entity building, and relation extraction.
 */
class LatencyMonitor {
  constructor(config = {}) {
    this.config = {
      // Latency thresholds (in milliseconds)
      warningThreshold: config.warningThreshold || 5000, // 5 seconds
      criticalThreshold: config.criticalThreshold || 10000, // 10 seconds
      
      // Logging settings
      loggingEnabled: config.loggingEnabled !== false,
      detailedLogging: config.detailedLogging || false,
      
      // Performance targets
      targetLatency: {
        document_processing: config.targetDocumentLatency || 5000,
        field_extraction: config.targetFieldLatency || 2000,
        entity_building: config.targetEntityLatency || 1000,
        relation_extraction: config.targetRelationLatency || 2000
      },
      
      ...config
    };
    
    // In-memory cache for current session metrics
    this.sessionMetrics = {
      documentProcessing: { baseline: [], optimized: [] },
      fieldExtraction: { baseline: [], optimized: [] },
      entityBuilding: { baseline: [], optimized: [] },
      relationExtraction: { baseline: [], optimized: [] }
    };
    
    // Active timers
    this.activeTimers = new Map();
    
    // Alerts
    this.alerts = [];
  }
  
  /**
   * Start timing an operation
   * 
   * @param {string} operationId - Unique operation identifier
   * @param {Object} metadata - Operation metadata
   * @returns {string} Timer ID
   */
  startTimer(operationId, metadata = {}) {
    const timerId = `${operationId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.activeTimers.set(timerId, {
      operationId,
      startTime: Date.now(),
      metadata
    });
    
    return timerId;
  }
  
  /**
   * Stop timing an operation and record latency
   * 
   * @param {string} timerId - Timer ID from startTimer
   * @param {Object} params - Recording parameters
   * @returns {Promise<Object>} Recorded latency
   */
  async stopTimer(timerId, params = {}) {
    const timer = this.activeTimers.get(timerId);
    
    if (!timer) {
      throw new Error(`Timer not found: ${timerId}`);
    }
    
    const endTime = Date.now();
    const latency = endTime - timer.startTime;
    
    // Remove timer
    this.activeTimers.delete(timerId);
    
    // Record latency
    const result = await this.recordLatency({
      module: params.module || timer.metadata.module,
      operationId: timer.operationId,
      latency,
      optimized: params.optimized !== undefined ? params.optimized : timer.metadata.optimized,
      metadata: {
        ...timer.metadata,
        ...params.metadata
      }
    });
    
    return result;
  }
  
  /**
   * Record latency for an operation
   * 
   * @param {Object} params - Recording parameters
   * @returns {Promise<Object>} Recorded latency
   */
  async recordLatency(params) {
    const {
      module,
      operationId,
      latency,
      optimized = false,
      metadata = {}
    } = params;
    
    if (!module || latency === undefined) {
      throw new Error('Module and latency are required');
    }
    
    // Store in session cache
    const moduleKey = this._getModuleKey(module);
    const modeKey = optimized ? 'optimized' : 'baseline';
    
    if (this.sessionMetrics[moduleKey]) {
      this.sessionMetrics[moduleKey][modeKey].push({
        operationId,
        latency,
        timestamp: new Date().toISOString(),
        metadata
      });
    }
    
    // Log to database if enabled
    if (this.config.loggingEnabled) {
      try {
        await prisma.kGLatencyMetric.create({
          data: {
            id: `lat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            module,
            operation_id: operationId || 'unknown',
            latency_ms: latency,
            optimized,
            metadata: JSON.stringify(metadata),
            created_at: new Date()
          }
        });
      } catch (error) {
        console.error('Failed to log latency metrics to database:', error.message);
      }
    }
    
    // Check for performance issues
    this._checkPerformanceIssues(module, latency);
    
    return {
      module,
      operationId,
      latency,
      optimized,
      timestamp: new Date().toISOString()
    };
  }
  
  /**
   * Get latency status for all modules
   * 
   * @returns {Object} Latency status
   */
  getLatencyStatus() {
    const status = {};
    
    for (const [moduleKey, data] of Object.entries(this.sessionMetrics)) {
      const baselineLatency = this._calculateAverageLatency(data.baseline);
      const optimizedLatency = this._calculateAverageLatency(data.optimized);
      const improvement = baselineLatency > 0 ? 
        (baselineLatency - optimizedLatency) / baselineLatency : 0;
      
      const targetLatency = this.config.targetLatency[this._getModuleName(moduleKey)];
      
      status[moduleKey] = {
        baseline: {
          avgLatency: baselineLatency,
          count: data.baseline.length,
          min: this._getMinLatency(data.baseline),
          max: this._getMaxLatency(data.baseline),
          p50: this._getPercentile(data.baseline, 0.5),
          p95: this._getPercentile(data.baseline, 0.95),
          p99: this._getPercentile(data.baseline, 0.99)
        },
        optimized: {
          avgLatency: optimizedLatency,
          count: data.optimized.length,
          min: this._getMinLatency(data.optimized),
          max: this._getMaxLatency(data.optimized),
          p50: this._getPercentile(data.optimized, 0.5),
          p95: this._getPercentile(data.optimized, 0.95),
          p99: this._getPercentile(data.optimized, 0.99)
        },
        improvement: improvement,
        improvementPercent: improvement * 100,
        targetLatency: targetLatency,
        meetsTarget: optimizedLatency <= targetLatency,
        hasWarning: optimizedLatency > this.config.warningThreshold,
        isCritical: optimizedLatency > this.config.criticalThreshold
      };
    }
    
    return status;
  }
  
  /**
   * Get latency breakdown by operation
   * 
   * @param {Object} options - Query options
   * @returns {Object} Latency breakdown
   */
  getLatencyBreakdown(options = {}) {
    const { module } = options;
    
    if (module) {
      const moduleKey = this._getModuleKey(module);
      const data = this.sessionMetrics[moduleKey];
      
      if (!data) {
        return {};
      }
      
      return this._calculateBreakdown(data);
    }
    
    // Return breakdown for all modules
    const breakdown = {};
    for (const [moduleKey, data] of Object.entries(this.sessionMetrics)) {
      breakdown[moduleKey] = this._calculateBreakdown(data);
    }
    return breakdown;
  }
  
  /**
   * Identify performance bottlenecks
   * 
   * @returns {Array} List of bottlenecks
   */
  identifyBottlenecks() {
    const bottlenecks = [];
    const status = this.getLatencyStatus();
    
    for (const [moduleKey, data] of Object.entries(status)) {
      // Check if module exceeds target
      if (!data.meetsTarget && data.optimized.count > 0) {
        bottlenecks.push({
          module: this._getModuleName(moduleKey),
          type: 'target_exceeded',
          severity: data.isCritical ? 'critical' : 'warning',
          currentLatency: data.optimized.avgLatency,
          targetLatency: data.targetLatency,
          excess: data.optimized.avgLatency - data.targetLatency,
          excessPercent: ((data.optimized.avgLatency - data.targetLatency) / data.targetLatency) * 100
        });
      }
      
      // Check for high p95/p99 latency
      if (data.optimized.p95 > data.targetLatency * 2) {
        bottlenecks.push({
          module: this._getModuleName(moduleKey),
          type: 'high_p95',
          severity: 'warning',
          p95Latency: data.optimized.p95,
          targetLatency: data.targetLatency,
          message: 'P95 latency is more than 2x target'
        });
      }
      
      // Check for high variance
      const variance = data.optimized.max - data.optimized.min;
      if (variance > data.optimized.avgLatency * 2) {
        bottlenecks.push({
          module: this._getModuleName(moduleKey),
          type: 'high_variance',
          severity: 'info',
          variance: variance,
          avgLatency: data.optimized.avgLatency,
          message: 'High latency variance detected'
        });
      }
    }
    
    return bottlenecks.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
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
   * @param {string} module - Optional module to reset
   */
  resetSession(module = null) {
    if (module) {
      const moduleKey = this._getModuleKey(module);
      if (this.sessionMetrics[moduleKey]) {
        this.sessionMetrics[moduleKey] = { baseline: [], optimized: [] };
      }
    } else {
      this.sessionMetrics = {
        documentProcessing: { baseline: [], optimized: [] },
        fieldExtraction: { baseline: [], optimized: [] },
        entityBuilding: { baseline: [], optimized: [] },
        relationExtraction: { baseline: [], optimized: [] }
      };
    }
  }
  
  /**
   * Get latency statistics from database
   * 
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Latency statistics
   */
  async getLatencyStats(options = {}) {
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
      
      const metrics = await prisma.kGLatencyMetric.findMany({
        where,
        orderBy: { created_at: 'desc' }
      });
      
      // Aggregate by module and optimization mode
      const stats = {};
      
      for (const metric of metrics) {
        if (!stats[metric.module]) {
          stats[metric.module] = {
            baseline: { count: 0, totalLatency: 0, latencies: [] },
            optimized: { count: 0, totalLatency: 0, latencies: [] }
          };
        }
        
        const mode = metric.optimized ? 'optimized' : 'baseline';
        stats[metric.module][mode].count++;
        stats[metric.module][mode].totalLatency += metric.latency_ms;
        stats[metric.module][mode].latencies.push(metric.latency_ms);
      }
      
      // Calculate statistics
      for (const [mod, data] of Object.entries(stats)) {
        data.baseline.avgLatency = data.baseline.count > 0 ? 
          data.baseline.totalLatency / data.baseline.count : 0;
        data.optimized.avgLatency = data.optimized.count > 0 ? 
          data.optimized.totalLatency / data.optimized.count : 0;
        
        data.improvement = data.baseline.avgLatency > 0 ? 
          (data.baseline.avgLatency - data.optimized.avgLatency) / data.baseline.avgLatency : 0;
        data.improvementPercent = data.improvement * 100;
        
        // Calculate percentiles
        data.baseline.p50 = this._calculatePercentile(data.baseline.latencies, 0.5);
        data.baseline.p95 = this._calculatePercentile(data.baseline.latencies, 0.95);
        data.baseline.p99 = this._calculatePercentile(data.baseline.latencies, 0.99);
        
        data.optimized.p50 = this._calculatePercentile(data.optimized.latencies, 0.5);
        data.optimized.p95 = this._calculatePercentile(data.optimized.latencies, 0.95);
        data.optimized.p99 = this._calculatePercentile(data.optimized.latencies, 0.99);
      }
      
      return stats;
    } catch (error) {
      console.error('Failed to get latency stats from database:', error.message);
      return {};
    }
  }
  
  // Private helper methods
  
  _getModuleKey(module) {
    const keyMap = {
      'document_processing': 'documentProcessing',
      'field_extraction': 'fieldExtraction',
      'entity_building': 'entityBuilding',
      'relation_extraction': 'relationExtraction'
    };
    return keyMap[module] || module;
  }
  
  _getModuleName(moduleKey) {
    const nameMap = {
      'documentProcessing': 'document_processing',
      'fieldExtraction': 'field_extraction',
      'entityBuilding': 'entity_building',
      'relationExtraction': 'relation_extraction'
    };
    return nameMap[moduleKey] || moduleKey;
  }
  
  _calculateAverageLatency(records) {
    if (records.length === 0) return 0;
    const sum = records.reduce((acc, r) => acc + r.latency, 0);
    return sum / records.length;
  }
  
  _getMinLatency(records) {
    if (records.length === 0) return 0;
    return Math.min(...records.map(r => r.latency));
  }
  
  _getMaxLatency(records) {
    if (records.length === 0) return 0;
    return Math.max(...records.map(r => r.latency));
  }
  
  _getPercentile(records, percentile) {
    if (records.length === 0) return 0;
    const latencies = records.map(r => r.latency).sort((a, b) => a - b);
    return this._calculatePercentile(latencies, percentile);
  }
  
  _calculatePercentile(sortedArray, percentile) {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil(sortedArray.length * percentile) - 1;
    return sortedArray[Math.max(0, index)];
  }
  
  _calculateBreakdown(data) {
    const breakdown = {
      baseline: {},
      optimized: {}
    };
    
    // Group by operation ID
    for (const mode of ['baseline', 'optimized']) {
      const operations = {};
      
      for (const record of data[mode]) {
        const opId = record.operationId || 'unknown';
        if (!operations[opId]) {
          operations[opId] = [];
        }
        operations[opId].push(record.latency);
      }
      
      // Calculate stats for each operation
      for (const [opId, latencies] of Object.entries(operations)) {
        breakdown[mode][opId] = {
          count: latencies.length,
          avgLatency: latencies.reduce((a, b) => a + b, 0) / latencies.length,
          minLatency: Math.min(...latencies),
          maxLatency: Math.max(...latencies)
        };
      }
    }
    
    return breakdown;
  }
  
  _checkPerformanceIssues(module, latency) {
    const targetLatency = this.config.targetLatency[module];
    
    if (latency > this.config.criticalThreshold) {
      this._addAlert({
        type: 'critical_latency',
        severity: 'critical',
        module,
        message: `Critical latency detected: ${latency}ms (threshold: ${this.config.criticalThreshold}ms)`,
        data: {
          latency,
          threshold: this.config.criticalThreshold,
          targetLatency
        }
      });
    } else if (latency > this.config.warningThreshold) {
      this._addAlert({
        type: 'high_latency',
        severity: 'warning',
        module,
        message: `High latency detected: ${latency}ms (threshold: ${this.config.warningThreshold}ms)`,
        data: {
          latency,
          threshold: this.config.warningThreshold,
          targetLatency
        }
      });
    }
  }
  
  _addAlert(alert) {
    // Check for duplicate alerts
    const isDuplicate = this.alerts.some(a => 
      a.type === alert.type && 
      a.module === alert.module &&
      a.severity === alert.severity &&
      Date.now() - new Date(a.timestamp).getTime() < 60000 // Within 1 minute
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
 * Get or create latency monitor singleton
 * 
 * @param {Object} config - Configuration options
 * @returns {LatencyMonitor} Monitor instance
 */
function getLatencyMonitor(config = {}) {
  if (!monitorInstance) {
    monitorInstance = new LatencyMonitor(config);
  }
  return monitorInstance;
}

module.exports = {
  LatencyMonitor,
  getLatencyMonitor
};
