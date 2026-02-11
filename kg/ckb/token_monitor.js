/**
 * Token Monitor
 * 
 * Monitors and tracks token consumption for CKB intelligent chunking optimization.
 * Provides token budget management and alerting capabilities.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Token Monitor class
 */
class TokenMonitor {
  constructor(options = {}) {
    this.options = {
      budgetLimit: options.budgetLimit || 1000000, // Default: 1M tokens per day
      alertThreshold: options.alertThreshold || 0.8, // Alert at 80% of budget
      enableLogging: options.enableLogging !== false,
      enableAlerting: options.enableAlerting !== false,
      ...options
    };
    
    this.dailyUsage = {
      date: new Date().toISOString().split('T')[0],
      totalTokens: 0,
      byModule: {}
    };
    
    this.alerts = [];
  }

  /**
   * Record token usage for a module
   * @param {Object} usage - Token usage data
   * @returns {Promise<Object>} Recorded usage
   */
  async recordUsage(usage) {
    const {
      module,
      ckbId = null,
      modelName = 'unknown',
      inputTokens = 0,
      outputTokens = 0,
      optimized = false,
      baselineTokens = null
    } = usage;

    const totalTokens = inputTokens + outputTokens;
    const cost = this._calculateCost(modelName, inputTokens, outputTokens);

    // Update daily usage
    this._updateDailyUsage(module, totalTokens);

    // Check budget and alert if needed
    if (this.options.enableAlerting) {
      this._checkBudgetAndAlert();
    }

    // Log to database
    if (this.options.enableLogging) {
      try {
        const record = await prisma.kGTokenUsage.create({
          data: {
            module,
            ckbId,
            modelName,
            inputTokens,
            outputTokens,
            totalTokens,
            cost
          }
        });

        return {
          ...record,
          optimized,
          baselineTokens,
          savingsRatio: baselineTokens ? 1 - (totalTokens / baselineTokens) : null
        };
      } catch (error) {
        console.error('Failed to log token usage:', error);
        return {
          module,
          totalTokens,
          cost,
          error: error.message
        };
      }
    }

    return {
      module,
      totalTokens,
      cost,
      optimized,
      baselineTokens,
      savingsRatio: baselineTokens ? 1 - (totalTokens / baselineTokens) : null
    };
  }

  /**
   * Get token usage statistics
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Usage statistics
   */
  async getUsageStats(options = {}) {
    const {
      startDate = null,
      endDate = null,
      module = null,
      groupBy = 'module' // 'module' | 'date' | 'model'
    } = options;

    try {
      const where = {};
      
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }
      
      if (module) {
        where.module = module;
      }

      const records = await prisma.kGTokenUsage.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      return this._aggregateStats(records, groupBy);
    } catch (error) {
      console.error('Failed to get usage stats:', error);
      return {
        error: error.message,
        totalTokens: 0,
        totalCost: 0,
        records: []
      };
    }
  }

  /**
   * Compare optimized vs baseline token usage
   * @param {Object} options - Comparison options
   * @returns {Promise<Object>} Comparison results
   */
  async compareOptimization(options = {}) {
    const {
      startDate = null,
      endDate = null,
      module = null
    } = options;

    const stats = await this.getUsageStats({ startDate, endDate, module });

    // Calculate optimization metrics
    const optimizationMetrics = {
      totalTokens: stats.totalTokens,
      totalCost: stats.totalCost,
      recordCount: stats.recordCount,
      averageTokensPerCall: stats.recordCount > 0 ? stats.totalTokens / stats.recordCount : 0,
      byModule: stats.byModule || {}
    };

    return optimizationMetrics;
  }

  /**
   * Get current budget status
   * @returns {Object} Budget status
   */
  getBudgetStatus() {
    const usagePercent = this.dailyUsage.totalTokens / this.options.budgetLimit;
    const remaining = Math.max(0, this.options.budgetLimit - this.dailyUsage.totalTokens);

    return {
      date: this.dailyUsage.date,
      budgetLimit: this.options.budgetLimit,
      used: this.dailyUsage.totalTokens,
      remaining,
      usagePercent,
      alertThreshold: this.options.alertThreshold,
      isOverBudget: usagePercent >= 1.0,
      isNearLimit: usagePercent >= this.options.alertThreshold,
      byModule: this.dailyUsage.byModule
    };
  }

  /**
   * Get active alerts
   * @returns {Array} Active alerts
   */
  getAlerts() {
    return this.alerts.filter(alert => alert.status === 'active');
  }

  /**
   * Clear alerts
   */
  clearAlerts() {
    this.alerts = [];
  }

  /**
   * Reset daily usage (call at midnight)
   */
  resetDailyUsage() {
    const today = new Date().toISOString().split('T')[0];
    
    if (this.dailyUsage.date !== today) {
      this.dailyUsage = {
        date: today,
        totalTokens: 0,
        byModule: {}
      };
      this.clearAlerts();
    }
  }

  /**
   * Update daily usage
   * @private
   */
  _updateDailyUsage(module, tokens) {
    this.resetDailyUsage(); // Auto-reset if new day

    this.dailyUsage.totalTokens += tokens;
    
    if (!this.dailyUsage.byModule[module]) {
      this.dailyUsage.byModule[module] = 0;
    }
    this.dailyUsage.byModule[module] += tokens;
  }

  /**
   * Check budget and create alerts if needed
   * @private
   */
  _checkBudgetAndAlert() {
    const status = this.getBudgetStatus();

    // Alert if over budget
    if (status.isOverBudget) {
      this._createAlert({
        type: 'budget_exceeded',
        severity: 'critical',
        message: `Token budget exceeded: ${status.used} / ${status.budgetLimit} tokens used`,
        data: status
      });
    }
    // Alert if near limit
    else if (status.isNearLimit) {
      const existingAlert = this.alerts.find(
        a => a.type === 'budget_warning' && a.status === 'active'
      );
      
      if (!existingAlert) {
        this._createAlert({
          type: 'budget_warning',
          severity: 'warning',
          message: `Token budget at ${(status.usagePercent * 100).toFixed(1)}% (${status.used} / ${status.budgetLimit} tokens)`,
          data: status
        });
      }
    }
  }

  /**
   * Create an alert
   * @private
   */
  _createAlert(alert) {
    const newAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      status: 'active',
      ...alert
    };

    this.alerts.push(newAlert);

    // Log alert
    if (this.options.enableLogging) {
      console.warn(`[TokenMonitor Alert] ${alert.severity.toUpperCase()}: ${alert.message}`);
    }

    return newAlert;
  }

  /**
   * Calculate cost based on model and token usage
   * @private
   */
  _calculateCost(modelName, inputTokens, outputTokens) {
    // Pricing per 1K tokens (example rates, adjust as needed)
    const pricing = {
      'gpt-4': { input: 0.03, output: 0.06 },
      'gpt-4-turbo': { input: 0.01, output: 0.03 },
      'gpt-3.5-turbo': { input: 0.0015, output: 0.002 },
      'qwen': { input: 0.001, output: 0.001 },
      'unknown': { input: 0.002, output: 0.002 }
    };

    const rates = pricing[modelName] || pricing['unknown'];
    const inputCost = (inputTokens / 1000) * rates.input;
    const outputCost = (outputTokens / 1000) * rates.output;

    return inputCost + outputCost;
  }

  /**
   * Aggregate statistics
   * @private
   */
  _aggregateStats(records, groupBy) {
    const stats = {
      totalTokens: 0,
      totalCost: 0,
      recordCount: records.length,
      byModule: {},
      byDate: {},
      byModel: {}
    };

    for (const record of records) {
      stats.totalTokens += record.totalTokens;
      stats.totalCost += record.cost || 0;

      // Group by module
      if (!stats.byModule[record.module]) {
        stats.byModule[record.module] = {
          totalTokens: 0,
          totalCost: 0,
          count: 0
        };
      }
      stats.byModule[record.module].totalTokens += record.totalTokens;
      stats.byModule[record.module].totalCost += record.cost || 0;
      stats.byModule[record.module].count += 1;

      // Group by date
      const date = record.createdAt.toISOString().split('T')[0];
      if (!stats.byDate[date]) {
        stats.byDate[date] = {
          totalTokens: 0,
          totalCost: 0,
          count: 0
        };
      }
      stats.byDate[date].totalTokens += record.totalTokens;
      stats.byDate[date].totalCost += record.cost || 0;
      stats.byDate[date].count += 1;

      // Group by model
      if (!stats.byModel[record.modelName]) {
        stats.byModel[record.modelName] = {
          totalTokens: 0,
          totalCost: 0,
          count: 0
        };
      }
      stats.byModel[record.modelName].totalTokens += record.totalTokens;
      stats.byModel[record.modelName].totalCost += record.cost || 0;
      stats.byModel[record.modelName].count += 1;
    }

    return stats;
  }
}

// Singleton instance
let monitorInstance = null;

/**
 * Get or create token monitor instance
 * @param {Object} options - Monitor options
 * @returns {TokenMonitor} Monitor instance
 */
function getTokenMonitor(options = {}) {
  if (!monitorInstance) {
    monitorInstance = new TokenMonitor(options);
  }
  return monitorInstance;
}

module.exports = {
  TokenMonitor,
  getTokenMonitor
};
