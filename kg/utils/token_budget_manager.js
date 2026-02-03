/**
 * Token Budget Manager
 * 
 * Manages token usage budgets and alerts:
 * - Daily token limit checking
 * - Per-document token limit checking
 * - Budget alert mechanism (80% warning, 100% alert)
 * - Emergency mode (reduce LLM call frequency)
 * 
 * Validates: Requirements 21.6, 21.7, 21.8, 21.9
 */

const tokenTracker = require('./token_tracker');

// Budget configuration
const BUDGET_CONFIG = {
  DAILY_LIMIT: 100000,           // Daily token limit
  PER_DOCUMENT_LIMIT: 5000,      // Per-document token limit
  WARNING_THRESHOLD: 0.8,        // 80% warning threshold
  ALERT_THRESHOLD: 1.0,          // 100% alert threshold
  EMERGENCY_LLM_RATE: 0.2,       // Emergency mode: reduce to 20%
  NORMAL_LLM_RATE: 0.5           // Normal mode: 50%
};

// State
let currentState = {
  dailyUsage: 0,
  lastResetDate: new Date().toDateString(),
  emergencyMode: false,
  llmParticipationRate: BUDGET_CONFIG.NORMAL_LLM_RATE,
  documentUsage: new Map(),      // docId -> token count
  alerts: []
};

// Alert callbacks
const alertCallbacks = [];

/**
 * Check and reset daily budget if needed
 */
function checkAndResetDaily() {
  const today = new Date().toDateString();
  
  if (today !== currentState.lastResetDate) {
    console.log('[TokenBudget] Daily budget reset');
    
    // Archive yesterday's usage
    const yesterday = {
      date: currentState.lastResetDate,
      usage: currentState.dailyUsage,
      emergencyMode: currentState.emergencyMode
    };
    
    // Reset for new day
    currentState.dailyUsage = 0;
    currentState.lastResetDate = today;
    currentState.emergencyMode = false;
    currentState.llmParticipationRate = BUDGET_CONFIG.NORMAL_LLM_RATE;
    currentState.documentUsage.clear();
    
    return yesterday;
  }
  
  return null;
}

/**
 * Record token usage
 * @param {Object} data - Token usage data
 * @returns {Object} Budget status
 */
async function recordUsage(data) {
  const {
    module,
    operation,
    tokens,
    ckb_id,
    doc_id,
    model_name = 'qwen'
  } = data;
  
  // Check and reset daily if needed
  checkAndResetDaily();
  
  // Update daily usage
  currentState.dailyUsage += tokens;
  
  // Update document usage
  if (doc_id) {
    const docUsage = currentState.documentUsage.get(doc_id) || 0;
    currentState.documentUsage.set(doc_id, docUsage + tokens);
  }
  
  // Record to token tracker
  await tokenTracker.recordTokenUsage({
    module,
    operation,
    ckbId: ckb_id,
    docId: doc_id,
    modelName: model_name,
    inputTokens: data.input_tokens || 0,
    outputTokens: data.output_tokens || 0,
    totalTokens: tokens,
    cost: calculateCost(tokens, model_name)
  });
  
  // Calculate usage rate
  const usageRate = currentState.dailyUsage / BUDGET_CONFIG.DAILY_LIMIT;
  
  // Check budget thresholds
  if (usageRate >= BUDGET_CONFIG.ALERT_THRESHOLD && !currentState.emergencyMode) {
    // 100% - Enable emergency mode
    console.error('[TokenBudget] Daily token budget exceeded!');
    enableEmergencyMode();
    
    triggerAlert('budget_exceeded', {
      usage: currentState.dailyUsage,
      limit: BUDGET_CONFIG.DAILY_LIMIT,
      usageRate: usageRate,
      emergencyMode: true
    });
  } else if (usageRate >= BUDGET_CONFIG.WARNING_THRESHOLD && usageRate < BUDGET_CONFIG.ALERT_THRESHOLD) {
    // 80% - Warning
    console.warn(`[TokenBudget] Token budget at ${(usageRate * 100).toFixed(1)}%`);
    
    triggerAlert('budget_warning', {
      usage: currentState.dailyUsage,
      limit: BUDGET_CONFIG.DAILY_LIMIT,
      remaining: BUDGET_CONFIG.DAILY_LIMIT - currentState.dailyUsage,
      usageRate: usageRate
    });
  }
  
  return {
    allowed: usageRate < BUDGET_CONFIG.ALERT_THRESHOLD,
    remaining: BUDGET_CONFIG.DAILY_LIMIT - currentState.dailyUsage,
    usageRate: usageRate,
    emergencyMode: currentState.emergencyMode,
    llmParticipationRate: currentState.llmParticipationRate
  };
}

/**
 * Check if document is within budget
 * @param {string} docId - Document ID
 * @param {number} estimatedTokens - Estimated token usage
 * @returns {Object} Budget check result
 */
function checkDocumentBudget(docId, estimatedTokens) {
  const currentUsage = currentState.documentUsage.get(docId) || 0;
  const totalEstimated = currentUsage + estimatedTokens;
  
  if (totalEstimated > BUDGET_CONFIG.PER_DOCUMENT_LIMIT) {
    console.warn(`[TokenBudget] Document ${docId} estimated tokens ${totalEstimated} exceeds limit ${BUDGET_CONFIG.PER_DOCUMENT_LIMIT}`);
    
    triggerAlert('document_budget_exceeded', {
      doc_id: docId,
      current: currentUsage,
      estimated: estimatedTokens,
      total: totalEstimated,
      limit: BUDGET_CONFIG.PER_DOCUMENT_LIMIT
    });
    
    return {
      allowed: false,
      current: currentUsage,
      estimated: estimatedTokens,
      total: totalEstimated,
      limit: BUDGET_CONFIG.PER_DOCUMENT_LIMIT,
      exceeded: totalEstimated - BUDGET_CONFIG.PER_DOCUMENT_LIMIT
    };
  }
  
  return {
    allowed: true,
    current: currentUsage,
    estimated: estimatedTokens,
    total: totalEstimated,
    limit: BUDGET_CONFIG.PER_DOCUMENT_LIMIT,
    remaining: BUDGET_CONFIG.PER_DOCUMENT_LIMIT - totalEstimated
  };
}

/**
 * Enable emergency mode
 */
function enableEmergencyMode() {
  if (currentState.emergencyMode) {
    return; // Already in emergency mode
  }
  
  currentState.emergencyMode = true;
  currentState.llmParticipationRate = BUDGET_CONFIG.EMERGENCY_LLM_RATE;
  
  console.log('[TokenBudget] Emergency mode enabled');
  console.log(`[TokenBudget] LLM participation rate reduced: ${BUDGET_CONFIG.NORMAL_LLM_RATE} → ${BUDGET_CONFIG.EMERGENCY_LLM_RATE}`);
  
  // Log emergency mode activation
  currentState.alerts.push({
    type: 'emergency_mode_enabled',
    timestamp: new Date().toISOString(),
    data: {
      dailyUsage: currentState.dailyUsage,
      dailyLimit: BUDGET_CONFIG.DAILY_LIMIT,
      llmRate: currentState.llmParticipationRate
    }
  });
}

/**
 * Disable emergency mode (manual override)
 */
function disableEmergencyMode() {
  if (!currentState.emergencyMode) {
    return; // Not in emergency mode
  }
  
  currentState.emergencyMode = false;
  currentState.llmParticipationRate = BUDGET_CONFIG.NORMAL_LLM_RATE;
  
  console.log('[TokenBudget] Emergency mode disabled');
  console.log(`[TokenBudget] LLM participation rate restored: ${BUDGET_CONFIG.EMERGENCY_LLM_RATE} → ${BUDGET_CONFIG.NORMAL_LLM_RATE}`);
}

/**
 * Get current budget status
 * @returns {Object} Budget status
 */
function getBudgetStatus() {
  checkAndResetDaily();
  
  const usageRate = currentState.dailyUsage / BUDGET_CONFIG.DAILY_LIMIT;
  
  return {
    daily: {
      usage: currentState.dailyUsage,
      limit: BUDGET_CONFIG.DAILY_LIMIT,
      remaining: BUDGET_CONFIG.DAILY_LIMIT - currentState.dailyUsage,
      usageRate: usageRate,
      status: getUsageStatus(usageRate)
    },
    emergencyMode: currentState.emergencyMode,
    llmParticipationRate: currentState.llmParticipationRate,
    lastResetDate: currentState.lastResetDate,
    documentCount: currentState.documentUsage.size,
    topDocuments: getTopDocuments(5)
  };
}

/**
 * Get usage status based on rate
 * @param {number} rate - Usage rate (0-1)
 * @returns {string} Status
 */
function getUsageStatus(rate) {
  if (rate >= 1.0) return 'exceeded';
  if (rate >= 0.8) return 'warning';
  if (rate >= 0.6) return 'caution';
  return 'normal';
}

/**
 * Get top documents by token usage
 * @param {number} limit - Number of documents to return
 * @returns {Array} Top documents
 */
function getTopDocuments(limit = 5) {
  const docs = Array.from(currentState.documentUsage.entries())
    .map(([docId, tokens]) => ({ docId, tokens }))
    .sort((a, b) => b.tokens - a.tokens)
    .slice(0, limit);
  
  return docs;
}

/**
 * Calculate token cost
 * @param {number} tokens - Token count
 * @param {string} modelName - Model name
 * @returns {number} Cost in USD
 */
function calculateCost(tokens, modelName = 'qwen') {
  const pricing = {
    'qwen': 0.002 / 1000,      // $0.002 per 1K tokens
    'deepseek': 0.001 / 1000,  // $0.001 per 1K tokens
    'gpt-4': 0.03 / 1000       // $0.03 per 1K tokens
  };
  
  return tokens * (pricing[modelName] || pricing['qwen']);
}

/**
 * Get budget recommendations
 * @returns {Array} Recommendations
 */
function getRecommendations() {
  const status = getBudgetStatus();
  const recommendations = [];
  
  if (status.daily.usageRate >= 0.8) {
    recommendations.push({
      priority: 'high',
      category: 'budget',
      message: 'Daily token usage is high',
      actions: [
        'Increase algorithm mapping threshold to reduce LLM calls',
        'Extend cache expiration time',
        'Reduce LLM participation rate',
        'Disable non-critical entity enrichment'
      ]
    });
  }
  
  if (status.emergencyMode) {
    recommendations.push({
      priority: 'critical',
      category: 'emergency',
      message: 'Emergency mode is active',
      actions: [
        'LLM participation rate reduced to 20%',
        'Consider increasing daily budget',
        'Review token-intensive operations',
        'Optimize prompts to reduce token usage'
      ]
    });
  }
  
  // Check for high-usage documents
  const topDocs = status.topDocuments;
  if (topDocs.length > 0 && topDocs[0].tokens > BUDGET_CONFIG.PER_DOCUMENT_LIMIT * 0.8) {
    recommendations.push({
      priority: 'medium',
      category: 'document',
      message: `Document ${topDocs[0].docId} has high token usage`,
      actions: [
        'Review document complexity',
        'Consider splitting large documents',
        'Optimize field extraction strategy'
      ]
    });
  }
  
  return recommendations;
}

/**
 * Register alert callback
 * @param {Function} callback - Alert callback function
 */
function onAlert(callback) {
  if (typeof callback === 'function') {
    alertCallbacks.push(callback);
  }
}

/**
 * Trigger alert
 * @param {string} type - Alert type
 * @param {Object} data - Alert data
 */
function triggerAlert(type, data) {
  const alert = {
    type,
    timestamp: new Date().toISOString(),
    data
  };
  
  // Store alert
  currentState.alerts.push(alert);
  
  // Trim old alerts (keep last 100)
  if (currentState.alerts.length > 100) {
    currentState.alerts.shift();
  }
  
  // Call all registered callbacks
  alertCallbacks.forEach(callback => {
    try {
      callback(alert);
    } catch (error) {
      console.error('[TokenBudget] Alert callback error:', error);
    }
  });
  
  // Log alert
  console.warn(`[TokenBudget Alert] ${type}:`, data);
}

/**
 * Get recent alerts
 * @param {number} limit - Number of alerts to return
 * @returns {Array} Recent alerts
 */
function getRecentAlerts(limit = 10) {
  return currentState.alerts.slice(-limit);
}

/**
 * Reset budget state (for testing)
 */
function reset() {
  currentState = {
    dailyUsage: 0,
    lastResetDate: new Date().toDateString(),
    emergencyMode: false,
    llmParticipationRate: BUDGET_CONFIG.NORMAL_LLM_RATE,
    documentUsage: new Map(),
    alerts: []
  };
  console.log('[TokenBudget] State reset');
}

/**
 * Update budget configuration
 * @param {Object} config - New configuration
 */
function updateConfig(config) {
  if (config.dailyLimit !== undefined) {
    BUDGET_CONFIG.DAILY_LIMIT = config.dailyLimit;
  }
  if (config.perDocumentLimit !== undefined) {
    BUDGET_CONFIG.PER_DOCUMENT_LIMIT = config.perDocumentLimit;
  }
  if (config.warningThreshold !== undefined) {
    BUDGET_CONFIG.WARNING_THRESHOLD = config.warningThreshold;
  }
  if (config.emergencyLlmRate !== undefined) {
    BUDGET_CONFIG.EMERGENCY_LLM_RATE = config.emergencyLlmRate;
  }
  if (config.normalLlmRate !== undefined) {
    BUDGET_CONFIG.NORMAL_LLM_RATE = config.normalLlmRate;
  }
  
  console.log('[TokenBudget] Configuration updated:', config);
}

module.exports = {
  recordUsage,
  checkDocumentBudget,
  enableEmergencyMode,
  disableEmergencyMode,
  getBudgetStatus,
  getRecommendations,
  onAlert,
  getRecentAlerts,
  reset,
  updateConfig,
  BUDGET_CONFIG
};
