/**
 * Monitoring Dashboard
 * 
 * Aggregates and displays real-time metrics from token, accuracy, and latency monitors.
 * Provides a unified view of system health and optimization effectiveness.
 * 
 * Requirements: 7.4, 8.5, 9.5
 */

const { TokenMonitor } = require('./token_monitor');
const { AccuracyMonitor } = require('./accuracy_monitor');
const { LatencyMonitor } = require('./latency_monitor');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Monitoring Dashboard Class
 * 
 * Provides real-time monitoring dashboard with aggregated metrics
 */
class MonitoringDashboard {
  constructor(config = {}) {
    this.config = {
      refreshInterval: config.refreshInterval || 5000, // 5 seconds
      historyWindow: config.historyWindow || 3600000, // 1 hour
      enableAutoRefresh: config.enableAutoRefresh !== false,
      ...config
    };
    
    // Initialize monitors
    this.tokenMonitor = new TokenMonitor(config.tokenMonitor || {});
    this.accuracyMonitor = new AccuracyMonitor(config.accuracyMonitor || {});
    this.latencyMonitor = new LatencyMonitor(config.latencyMonitor || {});
    
    // Dashboard state
    this.lastUpdate = null;
    this.autoRefreshTimer = null;
  }
  
  /**
   * Get complete dashboard data
   * 
   * @returns {Promise<Object>} Dashboard data
   */
  async getDashboardData() {
    const [
      tokenMetrics,
      accuracyMetrics,
      latencyMetrics,
      systemHealth
    ] = await Promise.all([
      this.getTokenMetrics(),
      this.getAccuracyMetrics(),
      this.getLatencyMetrics(),
      this.getSystemHealth()
    ]);
    
    return {
      timestamp: new Date().toISOString(),
      tokenMetrics,
      accuracyMetrics,
      latencyMetrics,
      systemHealth,
      alerts: this.getAllAlerts()
    };
  }
  
  /**
   * Get token consumption metrics
   * 
   * @returns {Promise<Object>} Token metrics
   */
  async getTokenMetrics() {
    try {
      const stats = await this.tokenMonitor.getUsageStats();
      const comparison = await this.tokenMonitor.compareOptimization();
      const budgetStatus = this.tokenMonitor.getBudgetStatus();
      
      return {
        current: {
          totalTokens: stats.totalTokens || 0,
          cost: stats.totalCost || 0,
          byModule: stats.byModule || {}
        },
        savings: {
          tokenSavingsRatio: comparison.savingsRatio || 0,
          costSavingsRatio: comparison.costSavingsRatio || 0,
          totalTokensSaved: comparison.totalTokensSaved || 0,
          totalCostSaved: comparison.totalCostSaved || 0
        },
        budget: {
          limit: budgetStatus.budgetLimit,
          used: budgetStatus.used,
          remaining: budgetStatus.remaining,
          utilizationPercent: (budgetStatus.usagePercent || 0) * 100
        },
        trend: await this._getTokenTrend()
      };
    } catch (error) {
      console.error('Error getting token metrics:', error);
      return {
        current: { totalTokens: 0, cost: 0, byModule: {} },
        savings: { tokenSavingsRatio: 0, costSavingsRatio: 0, totalTokensSaved: 0, totalCostSaved: 0 },
        budget: { limit: 1000000, used: 0, remaining: 1000000, utilizationPercent: 0 },
        trend: { data: [], trend: 'stable' }
      };
    }
  }
  
  /**
   * Get accuracy metrics
   * 
   * @returns {Promise<Object>} Accuracy metrics
   */
  async getAccuracyMetrics() {
    try {
      const comparison = await this.accuracyMonitor.compareAccuracy();
      const degradationStatus = this.accuracyMonitor.getDegradationStatus();
      
      return {
        fieldExtraction: {
          baseline: comparison.fieldExtraction?.baseline || { f1: 0, precision: 0, recall: 0 },
          optimized: comparison.fieldExtraction?.optimized || { f1: 0, precision: 0, recall: 0 },
          delta: comparison.fieldExtraction?.delta || 0,
          status: this._getAccuracyStatus(comparison.fieldExtraction?.delta || 0)
        },
        entityRecognition: {
          baseline: comparison.entityRecognition?.baseline || { f1: 0, precision: 0, recall: 0 },
          optimized: comparison.entityRecognition?.optimized || { f1: 0, precision: 0, recall: 0 },
          delta: comparison.entityRecognition?.delta || 0,
          status: this._getAccuracyStatus(comparison.entityRecognition?.delta || 0)
        },
        relationExtraction: {
          baseline: comparison.relationExtraction?.baseline || { f1: 0, precision: 0, recall: 0 },
          optimized: comparison.relationExtraction?.optimized || { f1: 0, precision: 0, recall: 0 },
          delta: comparison.relationExtraction?.delta || 0,
          status: this._getAccuracyStatus(comparison.relationExtraction?.delta || 0)
        },
        degradation: degradationStatus,
        trend: await this._getAccuracyTrend()
      };
    } catch (error) {
      console.error('Error getting accuracy metrics:', error);
      const defaultMetric = { baseline: { f1: 0, precision: 0, recall: 0 }, optimized: { f1: 0, precision: 0, recall: 0 }, delta: 0, status: 'healthy' };
      return {
        fieldExtraction: defaultMetric,
        entityRecognition: defaultMetric,
        relationExtraction: defaultMetric,
        degradation: { fieldExtraction: false, entityRecognition: false, relationExtraction: false },
        trend: { data: [], trend: 'stable' }
      };
    }
  }
  
  /**
   * Get latency metrics
   * 
   * @returns {Promise<Object>} Latency metrics
   */
  async getLatencyMetrics() {
    try {
      const comparison = await this.latencyMonitor.compareLatency();
      const bottlenecks = await this.latencyMonitor.identifyBottlenecks();
      
      return {
        documentProcessing: {
          baseline: comparison.documentProcessing?.baseline || 0,
          optimized: comparison.documentProcessing?.optimized || 0,
          improvement: comparison.documentProcessing?.improvement || 0,
          status: this._getLatencyStatus(comparison.documentProcessing?.optimized || 0)
        },
        fieldExtraction: {
          baseline: comparison.fieldExtraction?.baseline || 0,
          optimized: comparison.fieldExtraction?.optimized || 0,
          improvement: comparison.fieldExtraction?.improvement || 0,
          status: this._getLatencyStatus(comparison.fieldExtraction?.optimized || 0)
        },
        entityBuilding: {
          baseline: comparison.entityBuilding?.baseline || 0,
          optimized: comparison.entityBuilding?.optimized || 0,
          improvement: comparison.entityBuilding?.improvement || 0,
          status: this._getLatencyStatus(comparison.entityBuilding?.optimized || 0)
        },
        relationExtraction: {
          baseline: comparison.relationExtraction?.baseline || 0,
          optimized: comparison.relationExtraction?.optimized || 0,
          improvement: comparison.relationExtraction?.improvement || 0,
          status: this._getLatencyStatus(comparison.relationExtraction?.optimized || 0)
        },
        bottlenecks,
        trend: await this._getLatencyTrend()
      };
    } catch (error) {
      console.error('Error getting latency metrics:', error);
      const defaultMetric = { baseline: 0, optimized: 0, improvement: 0, status: 'healthy' };
      return {
        documentProcessing: defaultMetric,
        fieldExtraction: defaultMetric,
        entityBuilding: defaultMetric,
        relationExtraction: defaultMetric,
        bottlenecks: [],
        trend: { data: [], trend: 'stable' }
      };
    }
  }
  
  /**
   * Get system health status
   * 
   * @returns {Promise<Object>} System health
   */
  async getSystemHealth() {
    const tokenHealth = await this._getTokenHealth();
    const accuracyHealth = await this._getAccuracyHealth();
    const latencyHealth = await this._getLatencyHealth();
    
    // Overall health score (0-100)
    const overallScore = (
      tokenHealth.score * 0.3 +
      accuracyHealth.score * 0.4 +
      latencyHealth.score * 0.3
    );
    
    return {
      overall: {
        score: Math.round(overallScore),
        status: this._getHealthStatus(overallScore),
        message: this._getHealthMessage(overallScore)
      },
      components: {
        tokenUsage: tokenHealth,
        accuracy: accuracyHealth,
        latency: latencyHealth
      },
      uptime: process.uptime(),
      lastUpdate: this.lastUpdate
    };
  }
  
  /**
   * Get all active alerts
   * 
   * @returns {Array} Alerts
   */
  getAllAlerts() {
    const alerts = [
      ...this.tokenMonitor.getAlerts(),
      ...this.accuracyMonitor.getAlerts(),
      ...this.latencyMonitor.getAlerts()
    ];
    
    // Sort by severity and timestamp
    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      if (severityOrder[a.severity] !== severityOrder[b.severity]) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return new Date(b.timestamp) - new Date(a.timestamp);
    });
  }
  
  /**
   * Get summary statistics
   * 
   * @returns {Promise<Object>} Summary stats
   */
  async getSummaryStats() {
    try {
      const tokenStats = await this.tokenMonitor.getUsageStats();
      const accuracyComparison = await this.accuracyMonitor.compareAccuracy();
      const latencyComparison = await this.latencyMonitor.compareLatency();
      
      return {
        optimization: {
          tokenSavings: tokenStats.savingsRatio || 0,
          latencyImprovement: latencyComparison.documentProcessing?.improvement || 0,
          accuracyImpact: accuracyComparison.fieldExtraction?.delta || 0
        },
        performance: {
          avgLatency: latencyComparison.documentProcessing?.optimized || 0,
          throughput: this._calculateThroughput(latencyComparison.documentProcessing?.optimized || 0),
          errorRate: 0 // TODO: Implement error tracking
        },
        usage: {
          totalDocuments: tokenStats.documentCount || 0,
          totalTokens: tokenStats.totalTokens || 0,
          totalCost: tokenStats.totalCost || 0
        }
      };
    } catch (error) {
      console.error('Error getting summary stats:', error);
      return {
        optimization: { tokenSavings: 0, latencyImprovement: 0, accuracyImpact: 0 },
        performance: { avgLatency: 0, throughput: 0, errorRate: 0 },
        usage: { totalDocuments: 0, totalTokens: 0, totalCost: 0 }
      };
    }
  }
  
  /**
   * Start auto-refresh
   */
  startAutoRefresh() {
    if (this.autoRefreshTimer) {
      return;
    }
    
    this.autoRefreshTimer = setInterval(async () => {
      try {
        await this.getDashboardData();
        this.lastUpdate = new Date().toISOString();
      } catch (error) {
        console.error('Dashboard auto-refresh error:', error);
      }
    }, this.config.refreshInterval);
  }
  
  /**
   * Stop auto-refresh
   */
  stopAutoRefresh() {
    if (this.autoRefreshTimer) {
      clearInterval(this.autoRefreshTimer);
      this.autoRefreshTimer = null;
    }
  }
  
  /**
   * Export dashboard data
   * 
   * @param {string} format - Export format (json, csv)
   * @returns {Promise<string>} Exported data
   */
  async exportData(format = 'json') {
    const data = await this.getDashboardData();
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    } else if (format === 'csv') {
      return this._convertToCSV(data);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }
  }
  
  // Private helper methods
  
  async _getTokenTrend() {
    const windowStart = new Date(Date.now() - this.config.historyWindow);
    
    try {
      const records = await prisma.kGTokenUsage.findMany({
        where: {
          createdAt: {
            gte: windowStart
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
      
      // Group by hour
      const hourlyData = this._groupByHour(records, 'totalTokens');
      
      return {
        data: hourlyData,
        trend: this._calculateTrend(hourlyData)
      };
    } catch (error) {
      console.error('Error fetching token trend:', error);
      return { data: [], trend: 'stable' };
    }
  }
  
  async _getAccuracyTrend() {
    const windowStart = new Date(Date.now() - this.config.historyWindow);
    
    try {
      const records = await prisma.kGAccuracyMetric.findMany({
        where: {
          createdAt: {
            gte: windowStart
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
      
      // Group by hour
      const hourlyData = this._groupByHour(records, 'f1Score');
      
      return {
        data: hourlyData,
        trend: this._calculateTrend(hourlyData)
      };
    } catch (error) {
      console.error('Error fetching accuracy trend:', error);
      return { data: [], trend: 'stable' };
    }
  }
  
  async _getLatencyTrend() {
    const windowStart = new Date(Date.now() - this.config.historyWindow);
    
    try {
      const records = await prisma.kGLatencyMetric.findMany({
        where: {
          createdAt: {
            gte: windowStart
          }
        },
        orderBy: {
          createdAt: 'asc'
        }
      });
      
      // Group by hour
      const hourlyData = this._groupByHour(records, 'latency');
      
      return {
        data: hourlyData,
        trend: this._calculateTrend(hourlyData)
      };
    } catch (error) {
      console.error('Error fetching latency trend:', error);
      return { data: [], trend: 'stable' };
    }
  }
  
  async _getTokenHealth() {
    try {
      const stats = await this.tokenMonitor.getUsageStats();
      const budgetStatus = this.tokenMonitor.getBudgetStatus();
      const budgetUtilization = (budgetStatus.usagePercent || 0) * 100;
      
      let score = 100;
      if (budgetUtilization > 90) score = 20;
      else if (budgetUtilization > 80) score = 50;
      else if (budgetUtilization > 70) score = 70;
      else if (budgetUtilization > 50) score = 85;
      
      return {
        score,
        status: this._getHealthStatus(score),
        message: `Token budget utilization: ${budgetUtilization.toFixed(1)}%`
      };
    } catch (error) {
      console.error('Error getting token health:', error);
      return {
        score: 100,
        status: 'healthy',
        message: 'Token monitoring unavailable'
      };
    }
  }
  
  async _getAccuracyHealth() {
    try {
      const comparison = await this.accuracyMonitor.compareAccuracy();
      const avgDelta = (
        (comparison.fieldExtraction?.delta || 0) +
        (comparison.entityRecognition?.delta || 0) +
        (comparison.relationExtraction?.delta || 0)
      ) / 3;
      
      let score = 100;
      if (avgDelta < -0.05) score = 20; // > 5% drop
      else if (avgDelta < -0.03) score = 50; // > 3% drop
      else if (avgDelta < -0.02) score = 70; // > 2% drop
      else if (avgDelta < -0.01) score = 85; // > 1% drop
      
      return {
        score,
        status: this._getHealthStatus(score),
        message: `Average accuracy delta: ${(avgDelta * 100).toFixed(2)}%`
      };
    } catch (error) {
      console.error('Error getting accuracy health:', error);
      return {
        score: 100,
        status: 'healthy',
        message: 'Accuracy monitoring unavailable'
      };
    }
  }
  
  async _getLatencyHealth() {
    try {
      const comparison = await this.latencyMonitor.compareLatency();
      const avgLatency = (
        (comparison.documentProcessing?.optimized || 0) +
        (comparison.fieldExtraction?.optimized || 0) +
        (comparison.entityBuilding?.optimized || 0) +
        (comparison.relationExtraction?.optimized || 0)
      ) / 4;
      
      let score = 100;
      if (avgLatency > 10000) score = 20; // > 10s
      else if (avgLatency > 7000) score = 50; // > 7s
      else if (avgLatency > 5000) score = 70; // > 5s
      else if (avgLatency > 3000) score = 85; // > 3s
      
      return {
        score,
        status: this._getHealthStatus(score),
        message: `Average latency: ${avgLatency.toFixed(0)}ms`
      };
    } catch (error) {
      console.error('Error getting latency health:', error);
      return {
        score: 100,
        status: 'healthy',
        message: 'Latency monitoring unavailable'
      };
    }
  }
  
  _getAccuracyStatus(delta) {
    if (delta < -0.02) return 'critical';
    if (delta < -0.015) return 'warning';
    if (delta < -0.01) return 'caution';
    return 'healthy';
  }
  
  _getLatencyStatus(latency) {
    if (latency > 10000) return 'critical';
    if (latency > 7000) return 'warning';
    if (latency > 5000) return 'caution';
    return 'healthy';
  }
  
  _getHealthStatus(score) {
    if (score >= 85) return 'healthy';
    if (score >= 70) return 'caution';
    if (score >= 50) return 'warning';
    return 'critical';
  }
  
  _getHealthMessage(score) {
    if (score >= 85) return 'System is operating normally';
    if (score >= 70) return 'System performance is acceptable with minor issues';
    if (score >= 50) return 'System has performance issues that need attention';
    return 'System has critical issues requiring immediate attention';
  }
  
  _calculateThroughput(avgLatency) {
    if (!avgLatency || avgLatency === 0) return 0;
    return Math.round(1000 / avgLatency); // documents per second
  }
  
  _groupByHour(records, valueField) {
    const hourlyMap = new Map();
    
    for (const record of records) {
      const hour = new Date(record.createdAt).setMinutes(0, 0, 0);
      const hourKey = new Date(hour).toISOString();
      
      if (!hourlyMap.has(hourKey)) {
        hourlyMap.set(hourKey, { timestamp: hourKey, values: [] });
      }
      
      hourlyMap.get(hourKey).values.push(record[valueField]);
    }
    
    // Calculate averages
    return Array.from(hourlyMap.values()).map(hour => ({
      timestamp: hour.timestamp,
      value: hour.values.reduce((a, b) => a + b, 0) / hour.values.length
    }));
  }
  
  _calculateTrend(data) {
    if (data.length < 2) return 'stable';
    
    const recent = data.slice(-3);
    const older = data.slice(0, -3);
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((a, b) => a + b.value, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b.value, 0) / older.length;
    
    const change = (recentAvg - olderAvg) / olderAvg;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }
  
  _convertToCSV(data) {
    // Simple CSV conversion for summary stats
    const rows = [
      ['Metric', 'Value'],
      ['Token Savings Ratio', data.tokenMetrics.savings.tokenSavingsRatio],
      ['Cost Savings Ratio', data.tokenMetrics.savings.costSavingsRatio],
      ['Field Extraction F1 (Baseline)', data.accuracyMetrics.fieldExtraction.baseline.f1],
      ['Field Extraction F1 (Optimized)', data.accuracyMetrics.fieldExtraction.optimized.f1],
      ['Document Processing Latency (Baseline)', data.latencyMetrics.documentProcessing.baseline],
      ['Document Processing Latency (Optimized)', data.latencyMetrics.documentProcessing.optimized],
      ['System Health Score', data.systemHealth.overall.score]
    ];
    
    return rows.map(row => row.join(',')).join('\n');
  }
}

module.exports = { MonitoringDashboard };
