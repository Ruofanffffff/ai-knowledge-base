/**
 * Performance Optimizer Module
 * 
 * Automatically identifies performance bottlenecks and applies optimizations:
 * - Performance bottleneck identification
 * - Optimization suggestion generation
 * - Automatic optimization application
 * 
 * Validates: Requirement 21.11
 */

const performanceMonitor = require('./performance_monitor');
const tokenBudgetManager = require('./token_budget_manager');

/**
 * Performance thresholds for bottleneck detection
 */
const BOTTLENECK_THRESHOLDS = {
  LOCAL_PROCESSING_SLOW_RATE: 0.3,      // 30% of operations slow
  LLM_TIMEOUT_RATE: 0.1,                // 10% timeout rate
  LLM_FAILURE_RATE: 0.15,               // 15% failure rate
  DOCUMENT_PROCESSING_SLOW_RATE: 0.25,  // 25% of documents slow
  ERROR_RATE: 0.1,                      // 10% error rate
  TOKEN_USAGE_HIGH: 0.8,                // 80% of budget used
  HEALTH_SCORE_LOW: 60                  // Health score below 60
};

/**
 * Optimization strategies
 */
const OPTIMIZATION_STRATEGIES = {
  // Reduce LLM participation rate
  REDUCE_LLM_RATE: {
    name: 'Reduce LLM Participation Rate',
    description: 'Lower the probability of LLM calls to reduce token usage and latency',
    impact: 'medium',
    risk: 'low'
  },
  
  // Increase cache TTL
  INCREASE_CACHE_TTL: {
    name: 'Increase Cache TTL',
    description: 'Extend cache expiration time to improve hit rate',
    impact: 'low',
    risk: 'low'
  },
  
  // Increase algorithm mapping threshold
  INCREASE_ALGO_THRESHOLD: {
    name: 'Increase Algorithm Mapping Threshold',
    description: 'Raise similarity threshold to reduce false positives and LLM calls',
    impact: 'medium',
    risk: 'medium'
  },
  
  // Enable batch processing
  ENABLE_BATCH_PROCESSING: {
    name: 'Enable Batch Processing',
    description: 'Process multiple items in batches to reduce overhead',
    impact: 'high',
    risk: 'low'
  },
  
  // Disable optional features
  DISABLE_OPTIONAL_FEATURES: {
    name: 'Disable Optional Features',
    description: 'Turn off non-critical features like entity enrichment',
    impact: 'high',
    risk: 'medium'
  },
  
  // Increase LLM timeout
  INCREASE_LLM_TIMEOUT: {
    name: 'Increase LLM Timeout',
    description: 'Allow more time for LLM calls to reduce timeout rate',
    impact: 'low',
    risk: 'low'
  },
  
  // Clear old metrics
  CLEAR_OLD_METRICS: {
    name: 'Clear Old Metrics',
    description: 'Remove old performance metrics to free memory',
    impact: 'low',
    risk: 'low'
  }
};

/**
 * Current optimization state
 */
let optimizationState = {
  enabled: true,
  autoApply: false,  // Manual approval by default
  appliedOptimizations: [],
  lastAnalysis: null,
  lastOptimization: null
};

/**
 * Analyze system performance and identify bottlenecks
 * 
 * @param {Object} options - Analysis options
 * @returns {Object} Analysis result with bottlenecks and recommendations
 */
function analyzePerformance(options = {}) {
  const {
    timeRange = 3600000,  // Last hour
    includeDetails = false
  } = options;
  
  // Get performance statistics
  const stats = performanceMonitor.getStats({ timeRange, includeDetails });
  const budgetStatus = tokenBudgetManager.getBudgetStatus();
  
  // Identify bottlenecks
  const bottlenecks = identifyBottlenecks(stats, budgetStatus);
  
  // Generate recommendations
  const recommendations = generateRecommendations(bottlenecks, stats, budgetStatus);
  
  // Calculate priority scores
  const prioritizedRecommendations = prioritizeRecommendations(recommendations);
  
  const analysis = {
    timestamp: new Date().toISOString(),
    timeRange,
    health: stats.health,
    bottlenecks,
    recommendations: prioritizedRecommendations,
    stats: {
      local_processing: stats.local_processing,
      llm_calls: stats.llm_calls,
      document_processing: stats.document_processing,
      errors: stats.errors
    },
    budget: budgetStatus
  };
  
  optimizationState.lastAnalysis = analysis;
  
  return analysis;
}

/**
 * Identify performance bottlenecks
 * 
 * @param {Object} stats - Performance statistics
 * @param {Object} budgetStatus - Token budget status
 * @returns {Array} List of identified bottlenecks
 */
function identifyBottlenecks(stats, budgetStatus) {
  const bottlenecks = [];
  
  // Check local processing performance
  if (stats.local_processing.within_budget_rate < (1 - BOTTLENECK_THRESHOLDS.LOCAL_PROCESSING_SLOW_RATE)) {
    bottlenecks.push({
      type: 'local_processing_slow',
      severity: 'high',
      metric: 'within_budget_rate',
      current: stats.local_processing.within_budget_rate,
      threshold: (1 - BOTTLENECK_THRESHOLDS.LOCAL_PROCESSING_SLOW_RATE),
      description: `${(stats.local_processing.within_budget_rate * 100).toFixed(1)}% of local processing within budget (target: ${((1 - BOTTLENECK_THRESHOLDS.LOCAL_PROCESSING_SLOW_RATE) * 100).toFixed(0)}%)`
    });
  }
  
  // Check LLM timeout rate
  if (stats.llm_calls.count > 0) {
    const timeoutRate = stats.llm_calls.timeout_count / stats.llm_calls.count;
    if (timeoutRate > BOTTLENECK_THRESHOLDS.LLM_TIMEOUT_RATE) {
      bottlenecks.push({
        type: 'llm_timeout_high',
        severity: 'medium',
        metric: 'timeout_rate',
        current: timeoutRate,
        threshold: BOTTLENECK_THRESHOLDS.LLM_TIMEOUT_RATE,
        description: `${(timeoutRate * 100).toFixed(1)}% LLM timeout rate (target: <${(BOTTLENECK_THRESHOLDS.LLM_TIMEOUT_RATE * 100).toFixed(0)}%)`
      });
    }
  }
  
  // Check LLM failure rate
  if (stats.llm_calls.success_rate < (1 - BOTTLENECK_THRESHOLDS.LLM_FAILURE_RATE)) {
    bottlenecks.push({
      type: 'llm_failure_high',
      severity: 'high',
      metric: 'success_rate',
      current: stats.llm_calls.success_rate,
      threshold: (1 - BOTTLENECK_THRESHOLDS.LLM_FAILURE_RATE),
      description: `${(stats.llm_calls.success_rate * 100).toFixed(1)}% LLM success rate (target: >${((1 - BOTTLENECK_THRESHOLDS.LLM_FAILURE_RATE) * 100).toFixed(0)}%)`
    });
  }
  
  // Check document processing performance
  if (stats.document_processing.within_budget_rate < (1 - BOTTLENECK_THRESHOLDS.DOCUMENT_PROCESSING_SLOW_RATE)) {
    bottlenecks.push({
      type: 'document_processing_slow',
      severity: 'high',
      metric: 'within_budget_rate',
      current: stats.document_processing.within_budget_rate,
      threshold: (1 - BOTTLENECK_THRESHOLDS.DOCUMENT_PROCESSING_SLOW_RATE),
      description: `${(stats.document_processing.within_budget_rate * 100).toFixed(1)}% of documents within budget (target: ${((1 - BOTTLENECK_THRESHOLDS.DOCUMENT_PROCESSING_SLOW_RATE) * 100).toFixed(0)}%)`
    });
  }
  
  // Check error rate
  if (stats.errors.error_rate > BOTTLENECK_THRESHOLDS.ERROR_RATE) {
    bottlenecks.push({
      type: 'error_rate_high',
      severity: 'critical',
      metric: 'error_rate',
      current: stats.errors.error_rate,
      threshold: BOTTLENECK_THRESHOLDS.ERROR_RATE,
      description: `${(stats.errors.error_rate * 100).toFixed(2)}% error rate (target: <${(BOTTLENECK_THRESHOLDS.ERROR_RATE * 100).toFixed(0)}%)`
    });
  }
  
  // Check token usage
  if (budgetStatus.daily.usageRate > BOTTLENECK_THRESHOLDS.TOKEN_USAGE_HIGH) {
    bottlenecks.push({
      type: 'token_usage_high',
      severity: budgetStatus.emergencyMode ? 'critical' : 'high',
      metric: 'usage_rate',
      current: budgetStatus.daily.usageRate,
      threshold: BOTTLENECK_THRESHOLDS.TOKEN_USAGE_HIGH,
      description: `${(budgetStatus.daily.usageRate * 100).toFixed(1)}% of daily token budget used (target: <${(BOTTLENECK_THRESHOLDS.TOKEN_USAGE_HIGH * 100).toFixed(0)}%)`
    });
  }
  
  // Check overall health score
  if (stats.health.score < BOTTLENECK_THRESHOLDS.HEALTH_SCORE_LOW) {
    bottlenecks.push({
      type: 'health_score_low',
      severity: 'high',
      metric: 'health_score',
      current: stats.health.score,
      threshold: BOTTLENECK_THRESHOLDS.HEALTH_SCORE_LOW,
      description: `Health score ${stats.health.score} (target: >${BOTTLENECK_THRESHOLDS.HEALTH_SCORE_LOW})`
    });
  }
  
  return bottlenecks;
}

/**
 * Generate optimization recommendations based on bottlenecks
 * 
 * @param {Array} bottlenecks - Identified bottlenecks
 * @param {Object} stats - Performance statistics
 * @param {Object} budgetStatus - Token budget status
 * @returns {Array} List of recommendations
 */
function generateRecommendations(bottlenecks, stats, budgetStatus) {
  const recommendations = [];
  
  bottlenecks.forEach(bottleneck => {
    switch (bottleneck.type) {
      case 'local_processing_slow':
        recommendations.push({
          strategy: 'ENABLE_BATCH_PROCESSING',
          ...OPTIMIZATION_STRATEGIES.ENABLE_BATCH_PROCESSING,
          reason: bottleneck.description,
          bottleneck: bottleneck.type,
          expectedImprovement: '20-30% faster processing'
        });
        break;
        
      case 'llm_timeout_high':
        recommendations.push({
          strategy: 'INCREASE_LLM_TIMEOUT',
          ...OPTIMIZATION_STRATEGIES.INCREASE_LLM_TIMEOUT,
          reason: bottleneck.description,
          bottleneck: bottleneck.type,
          expectedImprovement: `Reduce timeout rate from ${(bottleneck.current * 100).toFixed(1)}% to <${(BOTTLENECK_THRESHOLDS.LLM_TIMEOUT_RATE * 100).toFixed(0)}%`
        });
        break;
        
      case 'llm_failure_high':
        recommendations.push({
          strategy: 'REDUCE_LLM_RATE',
          ...OPTIMIZATION_STRATEGIES.REDUCE_LLM_RATE,
          reason: bottleneck.description,
          bottleneck: bottleneck.type,
          expectedImprovement: 'Reduce failed LLM calls by 30-40%'
        });
        break;
        
      case 'document_processing_slow':
        recommendations.push({
          strategy: 'DISABLE_OPTIONAL_FEATURES',
          ...OPTIMIZATION_STRATEGIES.DISABLE_OPTIONAL_FEATURES,
          reason: bottleneck.description,
          bottleneck: bottleneck.type,
          expectedImprovement: '30-50% faster document processing'
        });
        break;
        
      case 'token_usage_high':
        recommendations.push({
          strategy: 'REDUCE_LLM_RATE',
          ...OPTIMIZATION_STRATEGIES.REDUCE_LLM_RATE,
          reason: bottleneck.description,
          bottleneck: bottleneck.type,
          expectedImprovement: `Reduce token usage by 20-30%`
        });
        recommendations.push({
          strategy: 'INCREASE_CACHE_TTL',
          ...OPTIMIZATION_STRATEGIES.INCREASE_CACHE_TTL,
          reason: bottleneck.description,
          bottleneck: bottleneck.type,
          expectedImprovement: 'Improve cache hit rate by 10-15%'
        });
        break;
        
      case 'error_rate_high':
        recommendations.push({
          strategy: 'INCREASE_ALGO_THRESHOLD',
          ...OPTIMIZATION_STRATEGIES.INCREASE_ALGO_THRESHOLD,
          reason: bottleneck.description,
          bottleneck: bottleneck.type,
          expectedImprovement: 'Reduce errors by 20-30%'
        });
        break;
        
      case 'health_score_low':
        // Add general recommendations
        recommendations.push({
          strategy: 'CLEAR_OLD_METRICS',
          ...OPTIMIZATION_STRATEGIES.CLEAR_OLD_METRICS,
          reason: bottleneck.description,
          bottleneck: bottleneck.type,
          expectedImprovement: 'Free memory and improve performance'
        });
        break;
    }
  });
  
  // Remove duplicates
  const uniqueRecommendations = [];
  const seen = new Set();
  
  recommendations.forEach(rec => {
    if (!seen.has(rec.strategy)) {
      seen.add(rec.strategy);
      uniqueRecommendations.push(rec);
    }
  });
  
  return uniqueRecommendations;
}

/**
 * Prioritize recommendations by impact and risk
 * 
 * @param {Array} recommendations - List of recommendations
 * @returns {Array} Prioritized recommendations
 */
function prioritizeRecommendations(recommendations) {
  const impactScores = { high: 3, medium: 2, low: 1 };
  const riskScores = { low: 3, medium: 2, high: 1 };
  
  return recommendations.map(rec => {
    const impactScore = impactScores[rec.impact] || 1;
    const riskScore = riskScores[rec.risk] || 1;
    const priorityScore = impactScore * riskScore;
    
    return {
      ...rec,
      priorityScore,
      priority: priorityScore >= 6 ? 'high' : priorityScore >= 4 ? 'medium' : 'low'
    };
  }).sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Apply optimization strategy
 * 
 * @param {string} strategy - Strategy name
 * @param {Object} options - Strategy options
 * @returns {Object} Application result
 */
function applyOptimization(strategy, options = {}) {
  const result = {
    strategy,
    applied: false,
    timestamp: new Date().toISOString(),
    changes: [],
    error: null
  };
  
  try {
    switch (strategy) {
      case 'REDUCE_LLM_RATE':
        // Reduce LLM participation rate by 10%
        const currentRate = tokenBudgetManager.BUDGET_CONFIG.NORMAL_LLM_RATE;
        const newRate = Math.max(0.2, currentRate - 0.1);
        tokenBudgetManager.updateConfig({ normalLlmRate: newRate });
        result.changes.push({
          parameter: 'llm_participation_rate',
          before: currentRate,
          after: newRate
        });
        result.applied = true;
        break;
        
      case 'INCREASE_CACHE_TTL':
        // This would require cache module integration
        result.changes.push({
          parameter: 'cache_ttl',
          before: '1 hour',
          after: '2 hours',
          note: 'Manual cache configuration required'
        });
        result.applied = false;
        result.error = 'Cache TTL adjustment requires manual configuration';
        break;
        
      case 'INCREASE_ALGO_THRESHOLD':
        // This would require algorithm mapper integration
        result.changes.push({
          parameter: 'similarity_threshold',
          before: 0.7,
          after: 0.8,
          note: 'Manual threshold configuration required'
        });
        result.applied = false;
        result.error = 'Algorithm threshold adjustment requires manual configuration';
        break;
        
      case 'ENABLE_BATCH_PROCESSING':
        // This would require system-wide configuration
        result.changes.push({
          parameter: 'batch_processing',
          before: false,
          after: true,
          note: 'Manual batch processing configuration required'
        });
        result.applied = false;
        result.error = 'Batch processing requires manual configuration';
        break;
        
      case 'DISABLE_OPTIONAL_FEATURES':
        // This would require feature flag system
        result.changes.push({
          parameter: 'optional_features',
          before: 'enabled',
          after: 'disabled',
          note: 'Manual feature configuration required'
        });
        result.applied = false;
        result.error = 'Feature disabling requires manual configuration';
        break;
        
      case 'INCREASE_LLM_TIMEOUT':
        // This would require LLM client configuration
        result.changes.push({
          parameter: 'llm_timeout',
          before: '5s',
          after: '10s',
          note: 'Manual timeout configuration required'
        });
        result.applied = false;
        result.error = 'LLM timeout adjustment requires manual configuration';
        break;
        
      case 'CLEAR_OLD_METRICS':
        // Clear metrics older than 24 hours
        const cleared = performanceMonitor.clearOldMetrics(86400000);
        result.changes.push({
          parameter: 'metrics_cleared',
          value: cleared
        });
        result.applied = true;
        break;
        
      default:
        result.error = `Unknown strategy: ${strategy}`;
    }
    
    if (result.applied) {
      optimizationState.appliedOptimizations.push(result);
      optimizationState.lastOptimization = result;
    }
    
  } catch (error) {
    result.error = error.message;
  }
  
  return result;
}

/**
 * Auto-apply recommended optimizations
 * 
 * @param {Object} options - Auto-apply options
 * @returns {Object} Application results
 */
function autoApplyOptimizations(options = {}) {
  const {
    maxOptimizations = 3,
    minPriority = 'medium',
    dryRun = false
  } = options;
  
  if (!optimizationState.enabled) {
    return {
      success: false,
      message: 'Optimization is disabled'
    };
  }
  
  // Analyze performance
  const analysis = analyzePerformance();
  
  // Filter recommendations by priority
  const priorityFilter = {
    high: ['high'],
    medium: ['high', 'medium'],
    low: ['high', 'medium', 'low']
  };
  
  const eligibleRecommendations = analysis.recommendations
    .filter(rec => priorityFilter[minPriority].includes(rec.priority))
    .slice(0, maxOptimizations);
  
  if (eligibleRecommendations.length === 0) {
    return {
      success: true,
      message: 'No optimizations needed',
      analysis
    };
  }
  
  const results = [];
  
  if (dryRun) {
    return {
      success: true,
      message: 'Dry run - no optimizations applied',
      analysis,
      recommendations: eligibleRecommendations
    };
  }
  
  // Apply optimizations
  eligibleRecommendations.forEach(rec => {
    const result = applyOptimization(rec.strategy);
    results.push({
      recommendation: rec,
      result
    });
  });
  
  return {
    success: true,
    message: `Applied ${results.filter(r => r.result.applied).length} of ${results.length} optimizations`,
    analysis,
    results
  };
}

/**
 * Get optimization state
 * 
 * @returns {Object} Current optimization state
 */
function getOptimizationState() {
  return {
    ...optimizationState,
    appliedOptimizations: optimizationState.appliedOptimizations.slice(-10)  // Last 10
  };
}

/**
 * Enable/disable optimizer
 * 
 * @param {boolean} enabled - Enable state
 */
function setEnabled(enabled) {
  optimizationState.enabled = enabled;
  console.log(`[PerformanceOptimizer] ${enabled ? 'Enabled' : 'Disabled'}`);
}

/**
 * Enable/disable auto-apply
 * 
 * @param {boolean} autoApply - Auto-apply state
 */
function setAutoApply(autoApply) {
  optimizationState.autoApply = autoApply;
  console.log(`[PerformanceOptimizer] Auto-apply ${autoApply ? 'enabled' : 'disabled'}`);
}

/**
 * Reset optimization state (for testing)
 */
function reset() {
  optimizationState = {
    enabled: true,
    autoApply: false,
    appliedOptimizations: [],
    lastAnalysis: null,
    lastOptimization: null
  };
  console.log('[PerformanceOptimizer] State reset');
}

module.exports = {
  analyzePerformance,
  identifyBottlenecks,
  generateRecommendations,
  applyOptimization,
  autoApplyOptimizations,
  getOptimizationState,
  setEnabled,
  setAutoApply,
  reset,
  BOTTLENECK_THRESHOLDS,
  OPTIMIZATION_STRATEGIES
};
