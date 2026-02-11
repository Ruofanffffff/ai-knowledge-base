/**
 * Anchor System Metrics Collector
 * 
 * Collects and tracks metrics for the anchor-driven entity synthesis system.
 * Provides monitoring data for anchor generation, merging, conflicts, and LLM usage.
 */

class AnchorMetrics {
  constructor() {
    this.metrics = {
      anchorGeneration: {
        total: 0,
        successful: 0,
        failed: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0
      },
      merging: {
        total: 0,
        successful: 0,
        failed: 0,
        totalDuration: 0,
        avgDuration: 0,
        entitiesCreated: 0,
        entitiesMerged: 0,
        mergeRatio: 0
      },
      conflicts: {
        total: 0,
        byType: {},
        bySeverity: {
          low: 0,
          medium: 0,
          high: 0
        }
      },
      llm: {
        total: 0,
        successful: 0,
        failed: 0,
        totalDuration: 0,
        avgDuration: 0
      },
      coverage: {
        totalEntities: 0,
        entitiesWithAnchors: 0,
        coveragePercent: 0
      }
    };
    
    this.startTime = Date.now();
  }

  /**
   * Record anchor generation metrics
   */
  recordAnchorGeneration(duration, success = true) {
    const m = this.metrics.anchorGeneration;
    m.total++;
    
    if (success) {
      m.successful++;
      m.totalDuration += duration;
      m.avgDuration = m.totalDuration / m.successful;
      m.minDuration = Math.min(m.minDuration, duration);
      m.maxDuration = Math.max(m.maxDuration, duration);
    } else {
      m.failed++;
    }
  }


  /**
   * Record merging metrics
   */
  recordMerging(duration, entitiesCreated, instancesProcessed, success = true) {
    const m = this.metrics.merging;
    m.total++;
    
    if (success) {
      m.successful++;
      m.totalDuration += duration;
      m.avgDuration = m.totalDuration / m.successful;
      m.entitiesCreated += entitiesCreated;
      m.entitiesMerged += (instancesProcessed - entitiesCreated);
      
      // Calculate merge ratio (instances per entity)
      if (m.entitiesCreated > 0) {
        m.mergeRatio = (m.entitiesCreated + m.entitiesMerged) / m.entitiesCreated;
      }
    } else {
      m.failed++;
    }
  }

  /**
   * Record conflict detection
   */
  recordConflict(conflictType, severity) {
    const m = this.metrics.conflicts;
    m.total++;
    
    // By type
    if (!m.byType[conflictType]) {
      m.byType[conflictType] = 0;
    }
    m.byType[conflictType]++;
    
    // By severity
    if (severity && m.bySeverity[severity] !== undefined) {
      m.bySeverity[severity]++;
    }
  }

  /**
   * Record LLM advisory call
   */
  recordLLMCall(duration, success = true) {
    const m = this.metrics.llm;
    m.total++;
    
    if (success) {
      m.successful++;
      m.totalDuration += duration;
      m.avgDuration = m.totalDuration / m.successful;
    } else {
      m.failed++;
    }
  }

  /**
   * Update coverage metrics
   */
  updateCoverage(totalEntities, entitiesWithAnchors) {
    const m = this.metrics.coverage;
    m.totalEntities = totalEntities;
    m.entitiesWithAnchors = entitiesWithAnchors;
    m.coveragePercent = totalEntities > 0 
      ? (entitiesWithAnchors / totalEntities) * 100 
      : 0;
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Get summary metrics
   */
  getSummary() {
    const m = this.metrics;
    
    return {
      anchorGeneration: {
        total: m.anchorGeneration.total,
        successRate: m.anchorGeneration.total > 0 
          ? (m.anchorGeneration.successful / m.anchorGeneration.total) * 100 
          : 0,
        avgDuration: m.anchorGeneration.avgDuration.toFixed(2) + 'ms',
        performance: m.anchorGeneration.avgDuration < 10 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
      },
      merging: {
        total: m.merging.total,
        successRate: m.merging.total > 0 
          ? (m.merging.successful / m.merging.total) * 100 
          : 0,
        avgDuration: m.merging.avgDuration.toFixed(2) + 'ms',
        mergeRatio: m.merging.mergeRatio.toFixed(2),
        performance: m.merging.avgDuration < 100 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
      },
      conflicts: {
        total: m.conflicts.total,
        rate: m.anchorGeneration.total > 0 
          ? (m.conflicts.total / m.anchorGeneration.total) * 100 
          : 0,
        mostCommon: this._getMostCommonConflict()
      },
      llm: {
        total: m.llm.total,
        successRate: m.llm.total > 0 
          ? (m.llm.successful / m.llm.total) * 100 
          : 0,
        avgDuration: m.llm.avgDuration.toFixed(2) + 'ms'
      },
      coverage: {
        percent: m.coverage.coveragePercent.toFixed(2) + '%',
        status: m.coverage.coveragePercent >= 90 ? 'GOOD' : 'NEEDS_IMPROVEMENT'
      },
      uptime: this._formatUptime(Date.now() - this.startTime)
    };
  }

  /**
   * Get most common conflict type
   */
  _getMostCommonConflict() {
    const byType = this.metrics.conflicts.byType;
    const types = Object.keys(byType);
    
    if (types.length === 0) return 'none';
    
    return types.reduce((a, b) => byType[a] > byType[b] ? a : b);
  }

  /**
   * Format uptime
   */
  _formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      anchorGeneration: {
        total: 0,
        successful: 0,
        failed: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0
      },
      merging: {
        total: 0,
        successful: 0,
        failed: 0,
        totalDuration: 0,
        avgDuration: 0,
        entitiesCreated: 0,
        entitiesMerged: 0,
        mergeRatio: 0
      },
      conflicts: {
        total: 0,
        byType: {},
        bySeverity: {
          low: 0,
          medium: 0,
          high: 0
        }
      },
      llm: {
        total: 0,
        successful: 0,
        failed: 0,
        totalDuration: 0,
        avgDuration: 0
      },
      coverage: {
        totalEntities: 0,
        entitiesWithAnchors: 0,
        coveragePercent: 0
      }
    };
    
    this.startTime = Date.now();
  }

  /**
   * Export metrics to JSON
   */
  toJSON() {
    return this.getMetrics();
  }
}

// Singleton instance
const anchorMetrics = new AnchorMetrics();

module.exports = anchorMetrics;
