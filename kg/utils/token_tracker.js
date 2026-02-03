/**
 * Token Usage Tracker
 * 
 * Tracks and records LLM token consumption across all modules.
 * Provides statistics and budget management.
 * 
 * Requirements: 11.10-11.15
 */

/**
 * Token usage record structure
 */
class TokenUsageRecord {
  constructor(data) {
    this.id = data.id || generateId();
    this.timestamp = data.timestamp || new Date().toISOString();
    this.module = data.module; // 'field_extraction' | 'entity_building' | 'relation_extraction' | 'field_mapping'
    this.operation = data.operation; // Specific operation name
    this.doc_id = data.doc_id;
    this.ckb_id = data.ckb_id;
    this.input_tokens = data.input_tokens || 0;
    this.output_tokens = data.output_tokens || 0;
    this.total_tokens = data.total_tokens || (data.input_tokens + data.output_tokens);
    this.model = data.model || 'unknown';
    this.cost = data.cost || 0;
    this.metadata = data.metadata || {};
  }
}

// In-memory storage (should be replaced with database in production)
const tokenRecords = [];
let dailyBudget = 100000; // Default daily token budget
let dailyUsage = 0;
let lastResetDate = new Date().toDateString();

/**
 * Record token usage
 * @param {Object} usage - Token usage data
 * @returns {TokenUsageRecord} Created record
 */
function recordTokenUsage(usage) {
  const record = new TokenUsageRecord(usage);
  tokenRecords.push(record);

  // Update daily usage
  checkAndResetDailyUsage();
  dailyUsage += record.total_tokens;

  // Check budget
  if (dailyUsage >= dailyBudget * 0.8) {
    console.warn(`[Token Tracker] Daily token usage at ${Math.round(dailyUsage / dailyBudget * 100)}% of budget`);
  }

  if (dailyUsage >= dailyBudget) {
    console.error(`[Token Tracker] Daily token budget exceeded! Usage: ${dailyUsage}/${dailyBudget}`);
  }

  return record;
}

/**
 * Get token usage statistics
 * @param {Object} filters - Filter options
 * @returns {Object} Statistics
 */
function getTokenStats(filters = {}) {
  const {
    startDate = null,
    endDate = null,
    module = null,
    doc_id = null
  } = filters;

  let filteredRecords = tokenRecords;

  // Apply filters
  if (startDate) {
    filteredRecords = filteredRecords.filter(r => new Date(r.timestamp) >= new Date(startDate));
  }
  if (endDate) {
    filteredRecords = filteredRecords.filter(r => new Date(r.timestamp) <= new Date(endDate));
  }
  if (module) {
    filteredRecords = filteredRecords.filter(r => r.module === module);
  }
  if (doc_id) {
    filteredRecords = filteredRecords.filter(r => r.doc_id === doc_id);
  }

  const stats = {
    total_records: filteredRecords.length,
    total_tokens: 0,
    total_input_tokens: 0,
    total_output_tokens: 0,
    total_cost: 0,
    by_module: {},
    by_operation: {},
    by_model: {},
    daily_usage: dailyUsage,
    daily_budget: dailyBudget,
    budget_percentage: Math.round(dailyUsage / dailyBudget * 100)
  };

  for (const record of filteredRecords) {
    stats.total_tokens += record.total_tokens;
    stats.total_input_tokens += record.input_tokens;
    stats.total_output_tokens += record.output_tokens;
    stats.total_cost += record.cost;

    // By module
    if (!stats.by_module[record.module]) {
      stats.by_module[record.module] = {
        count: 0,
        tokens: 0,
        cost: 0
      };
    }
    stats.by_module[record.module].count++;
    stats.by_module[record.module].tokens += record.total_tokens;
    stats.by_module[record.module].cost += record.cost;

    // By operation
    if (!stats.by_operation[record.operation]) {
      stats.by_operation[record.operation] = {
        count: 0,
        tokens: 0,
        cost: 0
      };
    }
    stats.by_operation[record.operation].count++;
    stats.by_operation[record.operation].tokens += record.total_tokens;
    stats.by_operation[record.operation].cost += record.cost;

    // By model
    if (!stats.by_model[record.model]) {
      stats.by_model[record.model] = {
        count: 0,
        tokens: 0,
        cost: 0
      };
    }
    stats.by_model[record.model].count++;
    stats.by_model[record.model].tokens += record.total_tokens;
    stats.by_model[record.model].cost += record.cost;
  }

  return stats;
}

/**
 * Get token usage by time period
 * @param {string} period - 'hour' | 'day' | 'week' | 'month'
 * @param {number} count - Number of periods
 * @returns {Array} Time series data
 */
function getTokenUsageTimeSeries(period = 'day', count = 7) {
  const now = new Date();
  const timeSeries = [];

  for (let i = count - 1; i >= 0; i--) {
    const periodStart = new Date(now);
    const periodEnd = new Date(now);

    if (period === 'hour') {
      periodStart.setHours(now.getHours() - i - 1);
      periodEnd.setHours(now.getHours() - i);
    } else if (period === 'day') {
      periodStart.setDate(now.getDate() - i - 1);
      periodEnd.setDate(now.getDate() - i);
    } else if (period === 'week') {
      periodStart.setDate(now.getDate() - (i + 1) * 7);
      periodEnd.setDate(now.getDate() - i * 7);
    } else if (period === 'month') {
      periodStart.setMonth(now.getMonth() - i - 1);
      periodEnd.setMonth(now.getMonth() - i);
    }

    const periodRecords = tokenRecords.filter(r => {
      const timestamp = new Date(r.timestamp);
      return timestamp >= periodStart && timestamp < periodEnd;
    });

    const periodStats = {
      period_start: periodStart.toISOString(),
      period_end: periodEnd.toISOString(),
      total_tokens: periodRecords.reduce((sum, r) => sum + r.total_tokens, 0),
      total_cost: periodRecords.reduce((sum, r) => sum + r.cost, 0),
      record_count: periodRecords.length
    };

    timeSeries.push(periodStats);
  }

  return timeSeries;
}

/**
 * Set daily token budget
 * @param {number} budget - Daily token budget
 */
function setDailyBudget(budget) {
  dailyBudget = budget;
  console.log(`[Token Tracker] Daily budget set to ${budget} tokens`);
}

/**
 * Get daily token budget status
 * @returns {Object} Budget status
 */
function getDailyBudgetStatus() {
  checkAndResetDailyUsage();

  return {
    budget: dailyBudget,
    used: dailyUsage,
    remaining: Math.max(0, dailyBudget - dailyUsage),
    percentage: Math.round(dailyUsage / dailyBudget * 100),
    status: dailyUsage >= dailyBudget ? 'exceeded' :
            dailyUsage >= dailyBudget * 0.8 ? 'warning' : 'ok'
  };
}

/**
 * Check and reset daily usage if new day
 */
function checkAndResetDailyUsage() {
  const today = new Date().toDateString();
  if (today !== lastResetDate) {
    console.log(`[Token Tracker] Resetting daily usage. Previous: ${dailyUsage} tokens`);
    dailyUsage = 0;
    lastResetDate = today;
  }
}

/**
 * Get token usage recommendations
 * @returns {Array} Recommendations
 */
function getOptimizationRecommendations() {
  const stats = getTokenStats();
  const recommendations = [];

  // Check if any module is consuming too many tokens
  for (const [module, data] of Object.entries(stats.by_module)) {
    const percentage = data.tokens / stats.total_tokens * 100;
    if (percentage > 40) {
      recommendations.push({
        type: 'high_module_usage',
        module,
        percentage: Math.round(percentage),
        message: `Module "${module}" is consuming ${Math.round(percentage)}% of total tokens. Consider optimizing this module.`
      });
    }
  }

  // Check if approaching budget
  if (stats.budget_percentage >= 80) {
    recommendations.push({
      type: 'budget_warning',
      percentage: stats.budget_percentage,
      message: `Daily token usage at ${stats.budget_percentage}%. Consider reducing LLM call frequency.`
    });
  }

  // Check average tokens per operation
  for (const [operation, data] of Object.entries(stats.by_operation)) {
    const avgTokens = data.tokens / data.count;
    if (avgTokens > 1000) {
      recommendations.push({
        type: 'high_operation_tokens',
        operation,
        avg_tokens: Math.round(avgTokens),
        message: `Operation "${operation}" uses ${Math.round(avgTokens)} tokens on average. Consider prompt optimization.`
      });
    }
  }

  return recommendations;
}

/**
 * Export token usage data
 * @param {Object} filters - Filter options
 * @param {string} format - 'json' | 'csv'
 * @returns {string} Exported data
 */
function exportTokenUsage(filters = {}, format = 'json') {
  const stats = getTokenStats(filters);

  if (format === 'json') {
    return JSON.stringify(stats, null, 2);
  } else if (format === 'csv') {
    let csv = 'timestamp,module,operation,doc_id,input_tokens,output_tokens,total_tokens,cost\n';
    
    let filteredRecords = tokenRecords;
    if (filters.startDate) {
      filteredRecords = filteredRecords.filter(r => new Date(r.timestamp) >= new Date(filters.startDate));
    }
    if (filters.endDate) {
      filteredRecords = filteredRecords.filter(r => new Date(r.timestamp) <= new Date(filters.endDate));
    }
    if (filters.module) {
      filteredRecords = filteredRecords.filter(r => r.module === filters.module);
    }

    for (const record of filteredRecords) {
      csv += `${record.timestamp},${record.module},${record.operation},${record.doc_id || ''},${record.input_tokens},${record.output_tokens},${record.total_tokens},${record.cost}\n`;
    }

    return csv;
  }

  throw new Error(`Unsupported export format: ${format}`);
}

/**
 * Clear old token records
 * @param {number} daysToKeep - Number of days to keep
 * @returns {number} Number of records deleted
 */
function clearOldRecords(daysToKeep = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  const initialLength = tokenRecords.length;
  
  for (let i = tokenRecords.length - 1; i >= 0; i--) {
    if (new Date(tokenRecords[i].timestamp) < cutoffDate) {
      tokenRecords.splice(i, 1);
    }
  }

  const deleted = initialLength - tokenRecords.length;
  console.log(`[Token Tracker] Cleared ${deleted} old records (older than ${daysToKeep} days)`);
  
  return deleted;
}

/**
 * Generate unique ID
 * @returns {string} Unique ID
 */
function generateId() {
  return `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Reset tracker state (for testing)
 */
function reset() {
  tokenRecords.length = 0;
  dailyUsage = 0;
  lastResetDate = new Date().toDateString();
  console.log('[Token Tracker] State reset');
}

module.exports = {
  recordTokenUsage,
  getTokenStats,
  getTokenUsageTimeSeries,
  setDailyBudget,
  getDailyBudgetStatus,
  getOptimizationRecommendations,
  exportTokenUsage,
  clearOldRecords,
  reset
};
