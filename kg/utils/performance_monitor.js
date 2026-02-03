/**
 * Performance Monitor Module
 * 
 * Monitors system performance including:
 * - Local processing time (< 1s target)
 * - LLM call timeouts (5-10s)
 * - Total latency (< 30s per document)
 * - Real-time metrics collection
 * - Health score calculation
 * 
 * Validates: Requirements 21.1, 21.2, 21.3, 21.4, 21.5, 21.10
 */

// In-memory storage for metrics (should be replaced with database in production)
const metrics = {
  localProcessing: [],
  llmCalls: [],
  documentProcessing: [],
  errors: []
};

// Performance thresholds
const THRESHOLDS = {
  LOCAL_PROCESSING_MS: 1000,    // < 1s for local processing
  LLM_CALL_MIN_MS: 5000,        // 5s minimum timeout
  LLM_CALL_MAX_MS: 10000,       // 10s maximum timeout
  DOCUMENT_TOTAL_MS: 30000,     // < 30s total per document
  EXTRACT_TIME_MS: 300,         // < 300ms for field extraction
  MATCH_TIME_MS: 200,           // < 200ms for schema matching
  NORMALIZE_TIME_MS: 500        // < 500ms for field normalization (without LLM)
};

// Alert callbacks
const alertCallbacks = [];

/**
 * Record local processing metrics
 * @param {Object} data - Processing metrics
 * @returns {Object} Recorded metric
 */
function recordLocalProcessing(data) {
  const metric = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    ckb_id: data.ckb_id,
    doc_id: data.doc_id,
    extract_time: data.extract_time || 0,
    match_time: data.match_time || 0,
    normalize_time: data.normalize_time || 0,
    total_time: data.total_time || (data.extract_time + data.match_time + data.normalize_time),
    is_within_budget: (data.total_time || 0) < THRESHOLDS.LOCAL_PROCESSING_MS,
    metadata: data.metadata || {}
  };

  metrics.localProcessing.push(metric);

  // Trim old metrics (keep last 1000)
  if (metrics.localProcessing.length > 1000) {
    metrics.localProcessing.shift();
  }

  // Check if exceeded threshold
  if (!metric.is_within_budget) {
    console.warn(`[Performance] Local processing exceeded ${THRESHOLDS.LOCAL_PROCESSING_MS}ms: ${metric.total_time}ms for CKB ${metric.ckb_id}`);
    triggerAlert('local_processing_slow', {
      ckb_id: metric.ckb_id,
      time: metric.total_time,
      threshold: THRESHOLDS.LOCAL_PROCESSING_MS
    });
  }

  return metric;
}

/**
 * Record LLM call metrics
 * @param {Object} data - LLM call metrics
 * @returns {Object} Recorded metric
 */
function recordLLMCall(data) {
  const metric = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    module: data.module,
    operation: data.operation,
    ckb_id: data.ckb_id,
    doc_id: data.doc_id,
    duration: data.duration,
    success: data.success !== false,
    timeout: data.timeout || false,
    error: data.error || null,
    model: data.model || 'unknown',
    tokens: data.tokens || 0,
    metadata: data.metadata || {}
  };

  metrics.llmCalls.push(metric);

  // Trim old metrics
  if (metrics.llmCalls.length > 1000) {
    metrics.llmCalls.shift();
  }

  // Check for timeout
  if (metric.timeout) {
    console.warn(`[Performance] LLM call timeout: ${metric.module}.${metric.operation}`);
    triggerAlert('llm_timeout', {
      module: metric.module,
      operation: metric.operation,
      duration: metric.duration
    });
  }

  // Check for slow calls
  if (metric.duration > THRESHOLDS.LLM_CALL_MAX_MS) {
    console.warn(`[Performance] LLM call exceeded ${THRESHOLDS.LLM_CALL_MAX_MS}ms: ${metric.duration}ms`);
    triggerAlert('llm_call_slow', {
      module: metric.module,
      operation: metric.operation,
      duration: metric.duration,
      threshold: THRESHOLDS.LLM_CALL_MAX_MS
    });
  }

  return metric;
}

/**
 * Record document processing metrics
 * @param {Object} data - Document processing metrics
 * @returns {Object} Recorded metric
 */
function recordDocumentProcessing(data) {
  const metric = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    doc_id: data.doc_id,
    total_time: data.total_time,
    ckb_count: data.ckb_count || 0,
    entity_count: data.entity_count || 0,
    relation_count: data.relation_count || 0,
    is_within_budget: data.total_time < THRESHOLDS.DOCUMENT_TOTAL_MS,
    success: data.success !== false,
    error: data.error || null,
    stages: data.stages || {},
    metadata: data.metadata || {}
  };

  metrics.documentProcessing.push(metric);

  // Trim old metrics
  if (metrics.documentProcessing.length > 1000) {
    metrics.documentProcessing.shift();
  }

  // Check if exceeded threshold
  if (!metric.is_within_budget) {
    console.warn(`[Performance] Document processing exceeded ${THRESHOLDS.DOCUMENT_TOTAL_MS}ms: ${metric.total_time}ms for doc ${metric.doc_id}`);
    triggerAlert('document_processing_slow', {
      doc_id: metric.doc_id,
      time: metric.total_time,
      threshold: THRESHOLDS.DOCUMENT_TOTAL_MS
    });
  }

  return metric;
}

/**
 * Record error
 * @param {Object} data - Error data
 * @returns {Object} Recorded error
 */
function recordError(data) {
  const error = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    type: data.type,
    module: data.module,
    operation: data.operation,
    message: data.message,
    stack: data.stack,
    ckb_id: data.ckb_id,
    doc_id: data.doc_id,
    metadata: data.metadata || {}
  };

  metrics.errors.push(error);

  // Trim old errors
  if (metrics.errors.length > 1000) {
    metrics.errors.shift();
  }

  return error;
}

/**
 * Get performance statistics
 * @param {Object} options - Query options
 * @returns {Object} Performance statistics
 */
function getStats(options = {}) {
  const {
    timeRange = 3600000, // Default: last hour (in ms)
    includeDetails = false
  } = options;

  const since = new Date(Date.now() - timeRange);

  // Filter metrics by time range
  const recentLocal = metrics.localProcessing.filter(m => new Date(m.timestamp) >= since);
  const recentLLM = metrics.llmCalls.filter(m => new Date(m.timestamp) >= since);
  const recentDocs = metrics.documentProcessing.filter(m => new Date(m.timestamp) >= since);
  const recentErrors = metrics.errors.filter(e => new Date(e.timestamp) >= since);

  // Calculate local processing stats
  const localStats = {
    count: recentLocal.length,
    avg_total_time: average(recentLocal.map(m => m.total_time)),
    avg_extract_time: average(recentLocal.map(m => m.extract_time)),
    avg_match_time: average(recentLocal.map(m => m.match_time)),
    avg_normalize_time: average(recentLocal.map(m => m.normalize_time)),
    max_total_time: Math.max(...recentLocal.map(m => m.total_time), 0),
    within_budget_count: recentLocal.filter(m => m.is_within_budget).length,
    within_budget_rate: recentLocal.length > 0 
      ? recentLocal.filter(m => m.is_within_budget).length / recentLocal.length 
      : 1
  };

  // Calculate LLM call stats
  const llmStats = {
    count: recentLLM.length,
    success_count: recentLLM.filter(m => m.success).length,
    timeout_count: recentLLM.filter(m => m.timeout).length,
    avg_duration: average(recentLLM.map(m => m.duration)),
    max_duration: Math.max(...recentLLM.map(m => m.duration), 0),
    success_rate: recentLLM.length > 0 
      ? recentLLM.filter(m => m.success).length / recentLLM.length 
      : 1,
    by_module: groupBy(recentLLM, 'module')
  };

  // Calculate document processing stats
  const docStats = {
    count: recentDocs.length,
    success_count: recentDocs.filter(m => m.success).length,
    avg_total_time: average(recentDocs.map(m => m.total_time)),
    max_total_time: Math.max(...recentDocs.map(m => m.total_time), 0),
    avg_ckb_count: average(recentDocs.map(m => m.ckb_count)),
    avg_entity_count: average(recentDocs.map(m => m.entity_count)),
    within_budget_count: recentDocs.filter(m => m.is_within_budget).length,
    within_budget_rate: recentDocs.length > 0 
      ? recentDocs.filter(m => m.is_within_budget).length / recentDocs.length 
      : 1
  };

  // Calculate error stats
  const errorStats = {
    count: recentErrors.length,
    error_rate: (recentLocal.length + recentLLM.length + recentDocs.length) > 0
      ? recentErrors.length / (recentLocal.length + recentLLM.length + recentDocs.length)
      : 0,
    by_type: groupBy(recentErrors, 'type'),
    by_module: groupBy(recentErrors, 'module')
  };

  // Calculate health score
  const health = calculateHealthScore({
    localProcessing: localStats,
    llmCalls: llmStats,
    documentProcessing: docStats,
    errors: errorStats
  });

  const stats = {
    timeRange: timeRange,
    timestamp: new Date().toISOString(),
    local_processing: localStats,
    llm_calls: llmStats,
    document_processing: docStats,
    errors: errorStats,
    health: health
  };

  if (includeDetails) {
    stats.details = {
      recent_local: recentLocal.slice(-10),
      recent_llm: recentLLM.slice(-10),
      recent_docs: recentDocs.slice(-10),
      recent_errors: recentErrors.slice(-10)
    };
  }

  return stats;
}

/**
 * Calculate health score (0-100)
 * @param {Object} metrics - Performance metrics
 * @returns {Object} Health score and status
 */
function calculateHealthScore(metrics) {
  let score = 100;
  const issues = [];

  // Local processing performance (weight: 25%)
  if (metrics.localProcessing.within_budget_rate < 0.9) {
    const penalty = (1 - metrics.localProcessing.within_budget_rate) * 25;
    score -= penalty;
    issues.push({
      category: 'local_processing',
      severity: penalty > 15 ? 'high' : 'medium',
      message: `${(metrics.localProcessing.within_budget_rate * 100).toFixed(1)}% of local processing within budget`
    });
  }

  // LLM call success rate (weight: 25%)
  if (metrics.llmCalls.success_rate < 0.95) {
    const penalty = (1 - metrics.llmCalls.success_rate) * 25;
    score -= penalty;
    issues.push({
      category: 'llm_calls',
      severity: penalty > 15 ? 'high' : 'medium',
      message: `LLM success rate: ${(metrics.llmCalls.success_rate * 100).toFixed(1)}%`
    });
  }

  // Document processing performance (weight: 30%)
  if (metrics.documentProcessing.within_budget_rate < 0.9) {
    const penalty = (1 - metrics.documentProcessing.within_budget_rate) * 30;
    score -= penalty;
    issues.push({
      category: 'document_processing',
      severity: penalty > 20 ? 'high' : 'medium',
      message: `${(metrics.documentProcessing.within_budget_rate * 100).toFixed(1)}% of documents within budget`
    });
  }

  // Error rate (weight: 20%)
  if (metrics.errors.error_rate > 0.05) {
    const penalty = Math.min(metrics.errors.error_rate * 100, 20);
    score -= penalty;
    issues.push({
      category: 'errors',
      severity: penalty > 15 ? 'high' : 'medium',
      message: `Error rate: ${(metrics.errors.error_rate * 100).toFixed(2)}%`
    });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));

  let status;
  if (score >= 90) status = 'excellent';
  else if (score >= 75) status = 'good';
  else if (score >= 60) status = 'fair';
  else if (score >= 40) status = 'poor';
  else status = 'critical';

  return {
    score,
    status,
    issues
  };
}

/**
 * Get dashboard metrics
 * @returns {Object} Dashboard metrics
 */
function getDashboardMetrics() {
  const stats = getStats({ timeRange: 86400000 }); // Last 24 hours

  return {
    timestamp: new Date().toISOString(),
    health: stats.health,
    performance: {
      local_processing: {
        avg_time: stats.local_processing.avg_total_time,
        within_budget_rate: stats.local_processing.within_budget_rate,
        threshold: THRESHOLDS.LOCAL_PROCESSING_MS
      },
      llm_calls: {
        avg_duration: stats.llm_calls.avg_duration,
        success_rate: stats.llm_calls.success_rate,
        timeout_count: stats.llm_calls.timeout_count
      },
      document_processing: {
        avg_time: stats.document_processing.avg_total_time,
        within_budget_rate: stats.document_processing.within_budget_rate,
        threshold: THRESHOLDS.DOCUMENT_TOTAL_MS
      }
    },
    throughput: {
      ckbs_processed: stats.local_processing.count,
      documents_processed: stats.document_processing.count,
      llm_calls: stats.llm_calls.count
    },
    errors: {
      count: stats.errors.count,
      rate: stats.errors.error_rate,
      by_type: stats.errors.by_type
    }
  };
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

  // Call all registered callbacks
  alertCallbacks.forEach(callback => {
    try {
      callback(alert);
    } catch (error) {
      console.error('[Performance] Alert callback error:', error);
    }
  });

  // Log alert
  console.warn(`[Performance Alert] ${type}:`, data);
}

/**
 * Clear old metrics
 * @param {number} olderThan - Clear metrics older than this (in ms)
 * @returns {Object} Cleared counts
 */
function clearOldMetrics(olderThan = 86400000) { // Default: 24 hours
  const cutoff = new Date(Date.now() - olderThan);

  const initialCounts = {
    localProcessing: metrics.localProcessing.length,
    llmCalls: metrics.llmCalls.length,
    documentProcessing: metrics.documentProcessing.length,
    errors: metrics.errors.length
  };

  metrics.localProcessing = metrics.localProcessing.filter(m => new Date(m.timestamp) >= cutoff);
  metrics.llmCalls = metrics.llmCalls.filter(m => new Date(m.timestamp) >= cutoff);
  metrics.documentProcessing = metrics.documentProcessing.filter(m => new Date(m.timestamp) >= cutoff);
  metrics.errors = metrics.errors.filter(e => new Date(e.timestamp) >= cutoff);

  const cleared = {
    localProcessing: initialCounts.localProcessing - metrics.localProcessing.length,
    llmCalls: initialCounts.llmCalls - metrics.llmCalls.length,
    documentProcessing: initialCounts.documentProcessing - metrics.documentProcessing.length,
    errors: initialCounts.errors - metrics.errors.length
  };

  console.log(`[Performance] Cleared old metrics:`, cleared);

  return cleared;
}

/**
 * Reset all metrics (for testing)
 */
function reset() {
  metrics.localProcessing = [];
  metrics.llmCalls = [];
  metrics.documentProcessing = [];
  metrics.errors = [];
  console.log('[Performance] Metrics reset');
}

// Helper functions

function generateId() {
  return `perf_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function groupBy(arr, key) {
  const grouped = {};
  arr.forEach(item => {
    const value = item[key] || 'unknown';
    if (!grouped[value]) {
      grouped[value] = { count: 0, items: [] };
    }
    grouped[value].count++;
    grouped[value].items.push(item);
  });
  return grouped;
}

/**
 * Record general metric
 * @param {Object} data - Metric data
 * @returns {Object} Recorded metric
 */
function recordMetric(data) {
  const metric = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    metric: data.metric,
    ckb_id: data.ckb_id,
    doc_id: data.doc_id,
    ...data
  };

  // Store in appropriate category based on metric type
  const metricType = data.metric || 'general';
  if (!metrics[metricType]) {
    metrics[metricType] = [];
  }
  
  metrics[metricType].push(metric);

  // Trim old metrics (keep last 1000 per type)
  if (metrics[metricType].length > 1000) {
    metrics[metricType].shift();
  }

  return metric;
}

module.exports = {
  recordLocalProcessing,
  recordLLMCall,
  recordDocumentProcessing,
  recordError,
  recordMetric,
  getStats,
  getDashboardMetrics,
  calculateHealthScore,
  onAlert,
  clearOldMetrics,
  reset,
  THRESHOLDS
};
