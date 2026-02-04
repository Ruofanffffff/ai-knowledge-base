/**
 * Cost-Benefit Analyzer Module
 * 
 * Analyzes cost-effectiveness of the knowledge graph system by:
 * - Calculating average Token cost per document
 * - Calculating average processing time per document
 * - Providing optimization recommendations
 * - Tracking cost trends over time
 * 
 * Validates: Requirements 21.19, 21.20
 */

const tokenTracker = require('./token_tracker');
const performanceMonitor = require('./performance_monitor');

// Cost configuration (can be adjusted based on actual LLM pricing)
const COST_CONFIG = {
  // Token costs (USD per 1000 tokens)
  INPUT_TOKEN_COST: 0.0005,   // $0.0005 per 1K input tokens
  OUTPUT_TOKEN_COST: 0.0015,  // $0.0015 per 1K output tokens
  
  // Performance targets
  TARGET_PROCESSING_TIME_MS: 5000,  // 5 seconds per document
  TARGET_TOKEN_COST_PER_DOC: 0.01,  // $0.01 per document
  
  // Thresholds for recommendations
  HIGH_COST_THRESHOLD: 1.5,    // 150% of target
  HIGH_TIME_THRESHOLD: 1.5,    // 150% of target
  EFFICIENCY_THRESHOLD: 0.7    // 70% efficiency
};

// Historical data storage
const history = {
  documents: [],
  aggregates: []
};

/**
 * Record document processing metrics
 * @param {Object} metrics - Document metrics
 * @returns {Object} Recorded entry
 */
function recordDocumentMetrics(metrics) {
  const {
    doc_id,
    processing_time_ms,
    token_usage,
    timestamp = new Date().toISOString()
  } = metrics;

  // Calculate costs
  const inputCost = (token_usage.input_tokens / 1000) * COST_CONFIG.INPUT_TOKEN_COST;
  const outputCost = (token_usage.output_tokens / 1000) * COST_CONFIG.OUTPUT_TOKEN_COST;
  const totalCost = inputCost + outputCost;

  const entry = {
    doc_id,
    timestamp,
    processing_time_ms,
    token_usage: {
      input_tokens: token_usage.input_tokens || 0,
      output_tokens: token_usage.output_tokens || 0,
      total_tokens: token_usage.total_tokens || 0
    },
    costs: {
      input_cost: Math.round(inputCost * 100000) / 100000,
      output_cost: Math.round(outputCost * 100000) / 100000,
      total_cost: Math.round(totalCost * 100000) / 100000
    },
    efficiency: calculateEfficiency(processing_time_ms, totalCost)
  };

  history.documents.push(entry);

  // Keep only last 1000 documents
  if (history.documents.length > 1000) {
    history.documents.shift();
  }

  return entry;
}

/**
 * Calculate efficiency score
 * @param {number} processingTime - Processing time in ms
 * @param {number} cost - Total cost in USD
 * @returns {number} Efficiency score (0-1)
 */
function calculateEfficiency(processingTime, cost) {
  const timeScore = Math.min(COST_CONFIG.TARGET_PROCESSING_TIME_MS / processingTime, 1);
  const costScore = Math.min(COST_CONFIG.TARGET_TOKEN_COST_PER_DOC / cost, 1);
  
  // Weighted average: 60% time, 40% cost
  return Math.round((timeScore * 0.6 + costScore * 0.4) * 100) / 100;
}

/**
 * Get average Token cost per document
 * @param {Object} options - Query options
 * @returns {Object} Average cost statistics
 */
function getAverageTokenCost(options = {}) {
  const {
    timeRange = 86400000, // Default: last 24 hours
    minDocuments = 1
  } = options;

  const since = new Date(Date.now() - timeRange);
  const recentDocs = history.documents.filter(d => 
    new Date(d.timestamp) >= since
  );

  if (recentDocs.length < minDocuments) {
    return {
      avg_input_tokens: 0,
      avg_output_tokens: 0,
      avg_total_tokens: 0,
      avg_input_cost: 0,
      avg_output_cost: 0,
      avg_total_cost: 0,
      document_count: 0,
      target_cost: COST_CONFIG.TARGET_TOKEN_COST_PER_DOC,
      is_within_target: true
    };
  }

  const totalInputTokens = recentDocs.reduce((sum, d) => sum + d.token_usage.input_tokens, 0);
  const totalOutputTokens = recentDocs.reduce((sum, d) => sum + d.token_usage.output_tokens, 0);
  const totalTokens = recentDocs.reduce((sum, d) => sum + d.token_usage.total_tokens, 0);
  const totalInputCost = recentDocs.reduce((sum, d) => sum + d.costs.input_cost, 0);
  const totalOutputCost = recentDocs.reduce((sum, d) => sum + d.costs.output_cost, 0);
  const totalCost = recentDocs.reduce((sum, d) => sum + d.costs.total_cost, 0);

  const avgTotalCost = totalCost / recentDocs.length;

  return {
    avg_input_tokens: Math.round(totalInputTokens / recentDocs.length),
    avg_output_tokens: Math.round(totalOutputTokens / recentDocs.length),
    avg_total_tokens: Math.round(totalTokens / recentDocs.length),
    avg_input_cost: Math.round(totalInputCost / recentDocs.length * 100000) / 100000,
    avg_output_cost: Math.round(totalOutputCost / recentDocs.length * 100000) / 100000,
    avg_total_cost: Math.round(avgTotalCost * 100000) / 100000,
    document_count: recentDocs.length,
    target_cost: COST_CONFIG.TARGET_TOKEN_COST_PER_DOC,
    is_within_target: avgTotalCost <= COST_CONFIG.TARGET_TOKEN_COST_PER_DOC,
    cost_vs_target_percent: Math.round((avgTotalCost / COST_CONFIG.TARGET_TOKEN_COST_PER_DOC) * 10000) / 100
  };
}

/**
 * Get average processing time per document
 * @param {Object} options - Query options
 * @returns {Object} Average time statistics
 */
function getAverageProcessingTime(options = {}) {
  const {
    timeRange = 86400000,
    minDocuments = 1
  } = options;

  const since = new Date(Date.now() - timeRange);
  const recentDocs = history.documents.filter(d => 
    new Date(d.timestamp) >= since
  );

  if (recentDocs.length < minDocuments) {
    return {
      avg_processing_time_ms: 0,
      avg_processing_time_seconds: 0,
      min_processing_time_ms: 0,
      max_processing_time_ms: 0,
      document_count: 0,
      target_time_ms: COST_CONFIG.TARGET_PROCESSING_TIME_MS,
      is_within_target: true
    };
  }

  const times = recentDocs.map(d => d.processing_time_ms);
  const avgTime = times.reduce((sum, t) => sum + t, 0) / times.length;

  return {
    avg_processing_time_ms: Math.round(avgTime),
    avg_processing_time_seconds: Math.round(avgTime / 1000 * 100) / 100,
    min_processing_time_ms: Math.min(...times),
    max_processing_time_ms: Math.max(...times),
    document_count: recentDocs.length,
    target_time_ms: COST_CONFIG.TARGET_PROCESSING_TIME_MS,
    is_within_target: avgTime <= COST_CONFIG.TARGET_PROCESSING_TIME_MS,
    time_vs_target_percent: Math.round((avgTime / COST_CONFIG.TARGET_PROCESSING_TIME_MS) * 10000) / 100
  };
}

/**
 * Get cost-benefit analysis
 * @param {Object} options - Query options
 * @returns {Object} Cost-benefit analysis
 */
function getCostBenefitAnalysis(options = {}) {
  const costStats = getAverageTokenCost(options);
  const timeStats = getAverageProcessingTime(options);

  const recentDocs = history.documents.filter(d => 
    new Date(d.timestamp) >= new Date(Date.now() - (options.timeRange || 86400000))
  );

  const avgEfficiency = recentDocs.length > 0
    ? recentDocs.reduce((sum, d) => sum + d.efficiency, 0) / recentDocs.length
    : 0;

  return {
    timestamp: new Date().toISOString(),
    cost_analysis: costStats,
    time_analysis: timeStats,
    efficiency: {
      avg_efficiency: Math.round(avgEfficiency * 100) / 100,
      target_efficiency: COST_CONFIG.EFFICIENCY_THRESHOLD,
      is_efficient: avgEfficiency >= COST_CONFIG.EFFICIENCY_THRESHOLD
    },
    overall_health: {
      cost_healthy: costStats.is_within_target,
      time_healthy: timeStats.is_within_target,
      efficiency_healthy: avgEfficiency >= COST_CONFIG.EFFICIENCY_THRESHOLD,
      overall_healthy: costStats.is_within_target && 
                      timeStats.is_within_target && 
                      avgEfficiency >= COST_CONFIG.EFFICIENCY_THRESHOLD
    }
  };
}

/**
 * Get optimization recommendations
 * @param {Object} options - Query options
 * @returns {Array} Recommendations
 */
function getOptimizationRecommendations(options = {}) {
  const recommendations = [];
  const analysis = getCostBenefitAnalysis(options);

  // Recommendation 1: High Token cost
  if (!analysis.cost_analysis.is_within_target) {
    const costOverage = analysis.cost_analysis.cost_vs_target_percent - 100;
    
    recommendations.push({
      priority: costOverage > 50 ? 'high' : 'medium',
      category: 'cost',
      issue: `Average Token cost per document ($${analysis.cost_analysis.avg_total_cost}) exceeds target ($${COST_CONFIG.TARGET_TOKEN_COST_PER_DOC}) by ${Math.round(costOverage)}%`,
      recommendation: 'Reduce LLM call frequency, increase cache hit rate, or use more rule-based processing',
      impact: 'high',
      effort: 'medium',
      estimated_savings: `$${Math.round((analysis.cost_analysis.avg_total_cost - COST_CONFIG.TARGET_TOKEN_COST_PER_DOC) * analysis.cost_analysis.document_count * 100) / 100} over ${analysis.cost_analysis.document_count} documents`
    });
  }

  // Recommendation 2: High processing time
  if (!analysis.time_analysis.is_within_target) {
    const timeOverage = analysis.time_analysis.time_vs_target_percent - 100;
    
    recommendations.push({
      priority: timeOverage > 50 ? 'high' : 'medium',
      category: 'performance',
      issue: `Average processing time (${analysis.time_analysis.avg_processing_time_seconds}s) exceeds target (${COST_CONFIG.TARGET_PROCESSING_TIME_MS / 1000}s) by ${Math.round(timeOverage)}%`,
      recommendation: 'Optimize database queries, reduce LLM timeout, or implement parallel processing',
      impact: 'high',
      effort: 'high'
    });
  }

  // Recommendation 3: Low efficiency
  if (!analysis.efficiency.is_efficient) {
    recommendations.push({
      priority: 'medium',
      category: 'efficiency',
      issue: `System efficiency (${Math.round(analysis.efficiency.avg_efficiency * 100)}%) is below target (${Math.round(COST_CONFIG.EFFICIENCY_THRESHOLD * 100)}%)`,
      recommendation: 'Balance cost and performance by adjusting LLM sampling rates and cache strategies',
      impact: 'medium',
      effort: 'medium'
    });
  }

  // Recommendation 4: High input/output token ratio
  if (analysis.cost_analysis.avg_output_tokens > analysis.cost_analysis.avg_input_tokens * 2) {
    recommendations.push({
      priority: 'low',
      category: 'optimization',
      issue: `Output tokens (${analysis.cost_analysis.avg_output_tokens}) are significantly higher than input tokens (${analysis.cost_analysis.avg_input_tokens})`,
      recommendation: 'Optimize LLM prompts to reduce output verbosity, use more structured output formats',
      impact: 'medium',
      effort: 'low'
    });
  }

  // Recommendation 5: Cost trend analysis
  if (history.documents.length >= 10) {
    const recentCosts = history.documents.slice(-10).map(d => d.costs.total_cost);
    const trend = calculateTrend(recentCosts);
    
    if (trend === 'increasing') {
      recommendations.push({
        priority: 'medium',
        category: 'trend',
        issue: 'Token costs are trending upward',
        recommendation: 'Review recent changes and implement cost control measures',
        impact: 'high',
        effort: 'medium'
      });
    }
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

/**
 * Calculate trend from values
 * @param {Array} values - Array of values
 * @returns {string} Trend direction
 */
function calculateTrend(values) {
  if (values.length < 2) return 'stable';

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));

  const firstAvg = firstHalf.reduce((sum, v) => sum + v, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((sum, v) => sum + v, 0) / secondHalf.length;

  const changeRate = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

  if (Math.abs(changeRate) < 10) {
    return 'stable';
  } else if (changeRate > 0) {
    return 'increasing';
  } else {
    return 'decreasing';
  }
}

/**
 * Get cost trends over time
 * @param {Object} options - Query options
 * @returns {Object} Cost trends
 */
function getCostTrends(options = {}) {
  const {
    timeRange = 86400000,
    bucketSize = 3600000 // 1 hour buckets
  } = options;

  const since = new Date(Date.now() - timeRange);
  const recentDocs = history.documents.filter(d => 
    new Date(d.timestamp) >= since
  );

  if (recentDocs.length === 0) {
    return {
      buckets: [],
      trend: 'stable',
      total_cost: 0,
      total_documents: 0
    };
  }

  // Group by time buckets
  const buckets = {};
  recentDocs.forEach(doc => {
    const bucketTime = Math.floor(new Date(doc.timestamp).getTime() / bucketSize) * bucketSize;
    const bucketKey = new Date(bucketTime).toISOString();
    
    if (!buckets[bucketKey]) {
      buckets[bucketKey] = {
        timestamp: bucketKey,
        documents: [],
        total_cost: 0,
        total_tokens: 0,
        avg_processing_time: 0
      };
    }
    
    buckets[bucketKey].documents.push(doc);
    buckets[bucketKey].total_cost += doc.costs.total_cost;
    buckets[bucketKey].total_tokens += doc.token_usage.total_tokens;
  });

  // Calculate averages for each bucket
  const bucketArray = Object.values(buckets).map(bucket => ({
    timestamp: bucket.timestamp,
    document_count: bucket.documents.length,
    avg_cost: Math.round(bucket.total_cost / bucket.documents.length * 100000) / 100000,
    total_cost: Math.round(bucket.total_cost * 100000) / 100000,
    avg_tokens: Math.round(bucket.total_tokens / bucket.documents.length),
    avg_processing_time: Math.round(
      bucket.documents.reduce((sum, d) => sum + d.processing_time_ms, 0) / bucket.documents.length
    )
  }));

  // Sort by timestamp
  bucketArray.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const costs = bucketArray.map(b => b.avg_cost);
  const trend = calculateTrend(costs);

  return {
    buckets: bucketArray,
    trend,
    total_cost: Math.round(recentDocs.reduce((sum, d) => sum + d.costs.total_cost, 0) * 100000) / 100000,
    total_documents: recentDocs.length,
    avg_cost_per_document: Math.round(
      (recentDocs.reduce((sum, d) => sum + d.costs.total_cost, 0) / recentDocs.length) * 100000
    ) / 100000
  };
}

/**
 * Get comprehensive cost-benefit report
 * @param {Object} options - Query options
 * @returns {Object} Comprehensive report
 */
function getComprehensiveReport(options = {}) {
  return {
    timestamp: new Date().toISOString(),
    analysis: getCostBenefitAnalysis(options),
    recommendations: getOptimizationRecommendations(options),
    trends: getCostTrends(options),
    configuration: {
      input_token_cost: COST_CONFIG.INPUT_TOKEN_COST,
      output_token_cost: COST_CONFIG.OUTPUT_TOKEN_COST,
      target_processing_time_ms: COST_CONFIG.TARGET_PROCESSING_TIME_MS,
      target_token_cost_per_doc: COST_CONFIG.TARGET_TOKEN_COST_PER_DOC
    }
  };
}

/**
 * Clear all historical data (for testing)
 */
function reset() {
  history.documents = [];
  history.aggregates = [];
  console.log('[Cost-Benefit Analyzer] Reset complete');
}

/**
 * Get historical data count
 * @returns {number} Number of documents in history
 */
function getHistoryCount() {
  return history.documents.length;
}

module.exports = {
  recordDocumentMetrics,
  getAverageTokenCost,
  getAverageProcessingTime,
  getCostBenefitAnalysis,
  getOptimizationRecommendations,
  getCostTrends,
  getComprehensiveReport,
  reset,
  getHistoryCount,
  COST_CONFIG
};
