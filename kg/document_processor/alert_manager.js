/**
 * Alert Manager
 * 
 * Monitors metrics and triggers alerts
 * Manages alert history and notifications
 */

const { v4: uuidv4 } = require('uuid');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Alert types
const ALERT_TYPES = {
  LOW_COVERAGE: 'low_coverage',
  LOW_QUALITY: 'low_quality',
  PROCESSING_TIMEOUT: 'processing_timeout',
  HIGH_FAILURE_RATE: 'high_failure_rate',
  MISSING_CONTENT: 'missing_content'
};

// Severity levels
const SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
};

class AlertManager {
  /**
   * Trigger an alert
   * @param {string} alertType - Alert type
   * @param {Object} metadata - Alert metadata
   */
  async trigger(alertType, metadata) {
    const alert = {
      alertId: uuidv4(),
      alertType: alertType,
      severity: this.determineSeverity(alertType, metadata),
      message: this.generateMessage(alertType, metadata),
      metadata: JSON.stringify(metadata),
      triggeredAt: new Date(),
      resolvedAt: null,
      status: 'active'
    };
    
    // Save alert to database
    await prisma.alert.create({ data: alert });
    
    // Send notification
    await this.sendNotification(alert);
    
    console.log(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.message}`);
    
    return alert.alertId;
  }
  
  /**
   * Determine alert severity
   * @param {string} alertType - Alert type
   * @param {Object} metadata - Alert metadata
   * @returns {string} Severity level
   */
  determineSeverity(alertType, metadata) {
    switch (alertType) {
      case ALERT_TYPES.LOW_COVERAGE:
        if (metadata.coverage_rate < 0.90) {
          return SEVERITY.ERROR;
        }
        return SEVERITY.WARNING;
      
      case ALERT_TYPES.LOW_QUALITY:
        if (metadata.quality_score < 70) {
          return SEVERITY.ERROR;
        }
        return SEVERITY.WARNING;
      
      case ALERT_TYPES.PROCESSING_TIMEOUT:
        return SEVERITY.WARNING;
      
      case ALERT_TYPES.HIGH_FAILURE_RATE:
        return SEVERITY.CRITICAL;
      
      case ALERT_TYPES.MISSING_CONTENT:
        if (metadata.missing_count > 10) {
          return SEVERITY.ERROR;
        }
        return SEVERITY.WARNING;
      
      default:
        return SEVERITY.INFO;
    }
  }
  
  /**
   * Generate alert message
   * @param {string} alertType - Alert type
   * @param {Object} metadata - Alert metadata
   * @returns {string} Alert message
   */
  generateMessage(alertType, metadata) {
    switch (alertType) {
      case ALERT_TYPES.LOW_COVERAGE:
        return `文档 ${metadata.doc_id} 覆盖率 ${(metadata.coverage_rate * 100).toFixed(1)}% 低于阈值`;
      
      case ALERT_TYPES.LOW_QUALITY:
        return `文档 ${metadata.doc_id} 质量评分 ${metadata.quality_score.toFixed(1)} 低于阈值`;
      
      case ALERT_TYPES.PROCESSING_TIMEOUT:
        return `文档处理超时: ${metadata.monitor_id}, 阶段: ${metadata.stage}, 耗时: ${metadata.duration_ms}ms (阈值: ${metadata.threshold_ms}ms)`;
      
      case ALERT_TYPES.HIGH_FAILURE_RATE:
        return `处理失败率 ${(metadata.failure_rate * 100).toFixed(1)}% 超过 10%`;
      
      case ALERT_TYPES.MISSING_CONTENT:
        return `文档 ${metadata.doc_id} 发现 ${metadata.missing_count} 个未处理的结构单元`;
      
      default:
        return `告警: ${alertType}`;
    }
  }
  
  /**
   * Send alert notification
   * @param {Object} alert - Alert object
   */
  async sendNotification(alert) {
    // In a real implementation, this would send emails, Slack messages, etc.
    // For now, we just log to console
    
    if (alert.severity === SEVERITY.CRITICAL || alert.severity === SEVERITY.ERROR) {
      console.error(`[NOTIFICATION] ${alert.message}`);
      // await emailService.send(adminEmail, alert.message);
      // await slackService.send(alertChannel, alert.message);
    } else if (alert.severity === SEVERITY.WARNING) {
      console.warn(`[NOTIFICATION] ${alert.message}`);
    }
  }
  
  /**
   * Check coverage threshold
   * @param {number} coverageRate - Coverage rate (0-1)
   * @param {string} docId - Document ID
   */
  async checkCoverageThreshold(coverageRate, docId) {
    if (coverageRate < 0.90) {
      await this.trigger(ALERT_TYPES.LOW_COVERAGE, {
        doc_id: docId,
        coverage_rate: coverageRate
      });
    }
  }
  
  /**
   * Check quality threshold
   * @param {number} qualityScore - Quality score (0-100)
   * @param {string} docId - Document ID
   */
  async checkQualityThreshold(qualityScore, docId) {
    if (qualityScore < 80) {
      await this.trigger(ALERT_TYPES.LOW_QUALITY, {
        doc_id: docId,
        quality_score: qualityScore
      });
    }
  }
  
  /**
   * Check failure rate
   * @param {number} failureRate - Failure rate (0-1)
   */
  async checkFailureRate(failureRate) {
    if (failureRate > 0.1) {
      await this.trigger(ALERT_TYPES.HIGH_FAILURE_RATE, {
        failure_rate: failureRate
      });
    }
  }
  
  /**
   * Get alert history
   * @param {Object} filters - Filter options
   * @returns {Promise<Array>} Array of alerts
   */
  async getAlertHistory(filters = {}) {
    const where = {};
    
    if (filters.alert_type) {
      where.alertType = filters.alert_type;
    }
    
    if (filters.severity) {
      where.severity = filters.severity;
    }
    
    if (filters.status) {
      where.status = filters.status;
    }
    
    if (filters.from_date || filters.to_date) {
      where.triggeredAt = {};
      if (filters.from_date) {
        where.triggeredAt.gte = new Date(filters.from_date);
      }
      if (filters.to_date) {
        where.triggeredAt.lte = new Date(filters.to_date);
      }
    }
    
    const alerts = await prisma.alert.findMany({
      where,
      orderBy: { triggeredAt: 'desc' },
      take: filters.limit || 100
    });
    
    return alerts.map(alert => ({
      alert_id: alert.alertId,
      alert_type: alert.alertType,
      severity: alert.severity,
      message: alert.message,
      metadata: JSON.parse(alert.metadata),
      triggered_at: alert.triggeredAt.toISOString(),
      resolved_at: alert.resolvedAt ? alert.resolvedAt.toISOString() : null,
      status: alert.status
    }));
  }
  
  /**
   * Resolve an alert
   * @param {string} alertId - Alert ID
   */
  async resolveAlert(alertId) {
    await prisma.alert.update({
      where: { alertId: alertId },
      data: {
        status: 'resolved',
        resolvedAt: new Date()
      }
    });
  }
  
  /**
   * Ignore an alert
   * @param {string} alertId - Alert ID
   */
  async ignoreAlert(alertId) {
    await prisma.alert.update({
      where: { alertId: alertId },
      data: {
        status: 'ignored'
      }
    });
  }
  
  /**
   * Get alert statistics
   * @param {Object} filters - Filter options
   * @returns {Promise<Object>} Alert statistics
   */
  async getAlertStatistics(filters = {}) {
    const where = {};
    
    if (filters.from_date || filters.to_date) {
      where.triggeredAt = {};
      if (filters.from_date) {
        where.triggeredAt.gte = new Date(filters.from_date);
      }
      if (filters.to_date) {
        where.triggeredAt.lte = new Date(filters.to_date);
      }
    }
    
    const alerts = await prisma.alert.findMany({ where });
    
    const stats = {
      total: alerts.length,
      by_type: {},
      by_severity: {},
      by_status: {},
      active_count: 0,
      resolved_count: 0
    };
    
    for (const alert of alerts) {
      // By type
      stats.by_type[alert.alertType] = (stats.by_type[alert.alertType] || 0) + 1;
      
      // By severity
      stats.by_severity[alert.severity] = (stats.by_severity[alert.severity] || 0) + 1;
      
      // By status
      stats.by_status[alert.status] = (stats.by_status[alert.status] || 0) + 1;
      
      if (alert.status === 'active') {
        stats.active_count++;
      } else if (alert.status === 'resolved') {
        stats.resolved_count++;
      }
    }
    
    return stats;
  }
}

// Singleton instance
const alertManager = new AlertManager();

module.exports = alertManager;
module.exports.ALERT_TYPES = ALERT_TYPES;
module.exports.SEVERITY = SEVERITY;
