/**
 * Preprocessing Performance Monitor
 * 
 * Specialized monitoring for LLM document index preprocessing operations.
 * Integrates with the existing performance monitor while providing
 * preprocessing-specific metrics and logging.
 * 
 * Requirements: 9.1, 9.2, 9.5
 */

const performanceMonitor = require('../utils/performance_monitor');

// Preprocessing-specific thresholds (in milliseconds)
const PREPROCESSING_THRESHOLDS = {
  INDEX_GENERATION: 30000,      // 30s for index generation
  CBK_CORRECTION: 10000,        // 10s for CBK correction
  FIELD_VALIDATION: 15000,      // 15s for field validation
  SCHEMA_VALIDATION: 10000,     // 10s for schema validation
  MERGE_VALIDATION: 10000,      // 10s for merge validation
  RELATION_VALIDATION: 20000,   // 20s for relation validation
  CONSISTENCY_CHECK: 30000      // 30s for consistency check
};

// In-memory metrics storage
const preprocessingMetrics = {
  indexGeneration: [],
  corrections: [],
  validations: [],
  llmCalls: []
};

/**
 * Record index generation metrics
 * @param {Object} data - Index generation metrics
 * @returns {Object} Recorded metric
 */
function recordIndexGeneration(data) {
  const metric = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    doc_id: data.doc_id,
    duration: data.duration,
    fact_count: data.fact_count || 0,
    token_count: data.token_count || 0,
    success: data.success !== false,
    error: data.error || null,
    is_within_budget: data.duration < PREPROCESSING_THRESHOLDS.INDEX_GENERATION,
    metadata: data.metadata || {}
  };

  preprocessingMetrics.indexGeneration.push(metric);
  trimMetrics(preprocessingMetrics.indexGeneration);

  // Log to console
  if (metric.success) {
    console.log(`[Preprocessing Monitor] Index generated for doc ${data.doc_id}: ${data.fact_count} facts, ${data.duration}ms`);
  } else {
    console.error(`[Preprocessing Monitor] Index generation failed for doc ${data.doc_id}:`, data.error);
  }

  // Check threshold
  if (!metric.is_within_budget) {
    console.warn(`[Preprocessing Monitor] Index generation exceeded ${PREPROCESSING_THRESHOLDS.INDEX_GENERATION}ms: ${metric.duration}ms`);
    performanceMonitor.recordError({
      type: 'preprocessing_slow',
      module: 'index_generator',
      operation: 'generate_index',
      message: `Index generation exceeded threshold: ${metric.duration}ms`,
      doc_id: data.doc_id
    });
  }

  // Record to main performance monitor
  performanceMonitor.recordMetric({
    metric: 'preprocessing_index_generation',
    doc_id: data.doc_id,
    duration: data.duration,
    success: metric.success,
    fact_count: data.fact_count
  });

  return metric;
}

/**
 * Record correction operation metrics
 * @param {Object} data - Correction metrics
 * @returns {Object} Recorded metric
 */
function recordCorrection(data) {
  const metric = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    doc_id: data.doc_id,
    stage: data.stage, // cbk_correction, field_correction, etc.
    duration: data.duration,
    corrections_made: data.corrections_made || 0,
    items_processed: data.items_processed || 0,
    success: data.success !== false,
    error: data.error || null,
    is_within_budget: data.duration < (PREPROCESSING_THRESHOLDS[data.stage.toUpperCase()] || 10000),
    metadata: data.metadata || {}
  };

  preprocessingMetrics.corrections.push(metric);
  trimMetrics(preprocessingMetrics.corrections);

  // Log to console
  if (metric.success) {
    console.log(`[Preprocessing Monitor] ${data.stage}: ${data.corrections_made} corrections, ${data.duration}ms (doc ${data.doc_id})`);
  } else {
    console.error(`[Preprocessing Monitor] ${data.stage} failed for doc ${data.doc_id}:`, data.error);
  }

  // Check threshold
  if (!metric.is_within_budget) {
    const threshold = PREPROCESSING_THRESHOLDS[data.stage.toUpperCase()] || 10000;
    console.warn(`[Preprocessing Monitor] ${data.stage} exceeded ${threshold}ms: ${metric.duration}ms`);
  }

  // Record to main performance monitor
  performanceMonitor.recordMetric({
    metric: `preprocessing_${data.stage}`,
    doc_id: data.doc_id,
    duration: data.duration,
    success: metric.success,
    corrections_made: data.corrections_made
  });

  return metric;
}

/**
 * Record validation operation metrics
 * @param {Object} data - Validation metrics
 * @returns {Object} Recorded metric
 */
function recordValidation(data) {
  const metric = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    doc_id: data.doc_id,
    stage: data.stage,
    duration: data.duration,
    items_validated: data.items_validated || 0,
    validation_passed: data.validation_passed || 0,
    validation_failed: data.validation_failed || 0,
    coverage_rate: data.coverage_rate || 1.0,
    success: data.success !== false,
    error: data.error || null,
    metadata: data.metadata || {}
  };

  preprocessingMetrics.validations.push(metric);
  trimMetrics(preprocessingMetrics.validations);

  // Log to console
  if (metric.success) {
    console.log(`[Preprocessing Monitor] ${data.stage} validation: ${data.items_validated} items, coverage=${(data.coverage_rate * 100).toFixed(1)}%, ${data.duration}ms`);
  } else {
    console.error(`[Preprocessing Monitor] ${data.stage} validation failed:`, data.error);
  }

  // Record to main performance monitor
  performanceMonitor.recordMetric({
    metric: `preprocessing_validation_${data.stage}`,
    doc_id: data.doc_id,
    duration: data.duration,
    success: metric.success,
    coverage_rate: data.coverage_rate
  });

  return metric;
}

/**
 * Record preprocessing LLM call metrics
 * @param {Object} data - LLM call metrics
 * @returns {Object} Recorded metric
 */
function recordPreprocessingLLMCall(data) {
  const metric = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    doc_id: data.doc_id,
    stage: data.stage,
    operation: data.operation,
    duration: data.duration,
    success: data.success !== false,
    timeout: data.timeout || false,
    error: data.error || null,
    model: data.model || 'unknown',
    tokens: data.tokens || 0,
    input_tokens: data.input_tokens || 0,
    output_tokens: data.output_tokens || 0,
    metadata: data.metadata || {}
  };

  preprocessingMetrics.llmCalls.push(metric);
  trimMetrics(preprocessingMetrics.llmCalls);

  // Log to console
  if (metric.success) {
    console.log(`[Preprocessing Monitor] LLM call (${data.stage}.${data.operation}): ${data.duration}ms, ${data.tokens} tokens`);
  } else if (metric.timeout) {
    console.error(`[Preprocessing Monitor] LLM call timeout (${data.stage}.${data.operation}): ${data.duration}ms`);
  } else {
    console.error(`[Preprocessing Monitor] LLM call failed (${data.stage}.${data.operation}):`, data.error);
  }

  // Record to main performance monitor
  performanceMonitor.recordLLMCall({
    module: `preprocessing_${data.stage}`,
    operation: data.operation,
    doc_id: data.doc_id,
    duration: data.duration,
    success: metric.success,
    timeout: metric.timeout,
    error: data.error,
    model: data.model,
    tokens: data.tokens
  });

  return metric;
}

/**
 * Record preprocessing decision point
 * @param {Object} data - Decision data
 */
function recordDecision(data) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    doc_id: data.doc_id,
    stage: data.stage,
    decision: data.decision,
    reason: data.reason,
    confidence: data.confidence,
    metadata: data.metadata || {}
  };

  // Log decision to console
  console.log(`[Preprocessing Decision] ${data.stage}: ${data.decision} (confidence=${data.confidence}, reason=${data.reason})`);

  // Record as metric
  performanceMonitor.recordMetric({
    metric: 'preprocessing_decision',
    doc_id: data.doc_id,
    stage: data.stage,
    decision: data.decision,
    confidence: data.confidence
  });

  return logEntry;
}

/**
 * Get preprocessing statistics
 * @param {Object} options - Query options
 * @returns {Object} Preprocessing statistics
 */
function getPreprocessingStats(options = {}) {
  const {
    timeRange = 3600000, // Default: last hour
    docId = null
  } = options;

  const since = new Date(Date.now() - timeRange);

  // Filter metrics
  let indexMetrics = preprocessingMetrics.indexGeneration.filter(m => new Date(m.timestamp) >= since);
  let correctionMetrics = preprocessingMetrics.corrections.filter(m => new Date(m.timestamp) >= since);
  let validationMetrics = preprocessingMetrics.validations.filter(m => new Date(m.timestamp) >= since);
  let llmMetrics = preprocessingMetrics.llmCalls.filter(m => new Date(m.timestamp) >= since);

  // Filter by docId if specified
  if (docId) {
    indexMetrics = indexMetrics.filter(m => m.doc_id === docId);
    correctionMetrics = correctionMetrics.filter(m => m.doc_id === docId);
    validationMetrics = validationMetrics.filter(m => m.doc_id === docId);
    llmMetrics = llmMetrics.filter(m => m.doc_id === docId);
  }

  // Calculate index generation stats
  const indexStats = {
    count: indexMetrics.length,
    success_count: indexMetrics.filter(m => m.success).length,
    success_rate: indexMetrics.length > 0 ? indexMetrics.filter(m => m.success).length / indexMetrics.length : 1,
    avg_duration: average(indexMetrics.map(m => m.duration)),
    avg_fact_count: average(indexMetrics.map(m => m.fact_count)),
    avg_token_count: average(indexMetrics.map(m => m.token_count)),
    within_budget_rate: indexMetrics.length > 0 ? indexMetrics.filter(m => m.is_within_budget).length / indexMetrics.length : 1
  };

  // Calculate correction stats by stage
  const correctionsByStage = groupBy(correctionMetrics, 'stage');
  const correctionStats = {
    total_count: correctionMetrics.length,
    by_stage: {}
  };

  Object.entries(correctionsByStage).forEach(([stage, metrics]) => {
    correctionStats.by_stage[stage] = {
      count: metrics.length,
      success_rate: metrics.filter(m => m.success).length / metrics.length,
      avg_duration: average(metrics.map(m => m.duration)),
      total_corrections: metrics.reduce((sum, m) => sum + m.corrections_made, 0),
      avg_corrections_per_doc: average(metrics.map(m => m.corrections_made))
    };
  });

  // Calculate validation stats by stage
  const validationsByStage = groupBy(validationMetrics, 'stage');
  const validationStats = {
    total_count: validationMetrics.length,
    by_stage: {}
  };

  Object.entries(validationsByStage).forEach(([stage, metrics]) => {
    validationStats.by_stage[stage] = {
      count: metrics.length,
      success_rate: metrics.filter(m => m.success).length / metrics.length,
      avg_duration: average(metrics.map(m => m.duration)),
      avg_coverage_rate: parseFloat((average(metrics.map(m => m.coverage_rate * 100)) / 100).toFixed(2)),
      total_items_validated: metrics.reduce((sum, m) => sum + m.items_validated, 0)
    };
  });

  // Calculate LLM call stats
  const llmStats = {
    count: llmMetrics.length,
    success_count: llmMetrics.filter(m => m.success).length,
    timeout_count: llmMetrics.filter(m => m.timeout).length,
    success_rate: llmMetrics.length > 0 ? llmMetrics.filter(m => m.success).length / llmMetrics.length : 1,
    avg_duration: average(llmMetrics.map(m => m.duration)),
    total_tokens: llmMetrics.reduce((sum, m) => sum + m.tokens, 0),
    by_stage: groupBy(llmMetrics, 'stage')
  };

  return {
    timeRange,
    timestamp: new Date().toISOString(),
    docId,
    index_generation: indexStats,
    corrections: correctionStats,
    validations: validationStats,
    llm_calls: llmStats
  };
}

/**
 * Get preprocessing summary for a document
 * @param {string} docId - Document ID
 * @returns {Object} Preprocessing summary
 */
function getDocumentSummary(docId) {
  if (!docId) {
    return null;
  }

  const indexMetric = preprocessingMetrics.indexGeneration.find(m => m.doc_id === docId);
  const corrections = preprocessingMetrics.corrections.filter(m => m.doc_id === docId);
  const validations = preprocessingMetrics.validations.filter(m => m.doc_id === docId);
  const llmCalls = preprocessingMetrics.llmCalls.filter(m => m.doc_id === docId);

  if (!indexMetric && corrections.length === 0 && validations.length === 0) {
    return null;
  }

  const totalDuration = (indexMetric?.duration || 0) + 
    corrections.reduce((sum, c) => sum + c.duration, 0) +
    validations.reduce((sum, v) => sum + v.duration, 0);

  const totalCorrections = corrections.reduce((sum, c) => sum + c.corrections_made, 0);

  return {
    doc_id: docId,
    timestamp: new Date().toISOString(),
    index_generation: indexMetric ? {
      success: indexMetric.success,
      duration: indexMetric.duration,
      fact_count: indexMetric.fact_count,
      token_count: indexMetric.token_count
    } : null,
    corrections: {
      total_count: corrections.length,
      total_corrections_made: totalCorrections,
      by_stage: groupBy(corrections, 'stage')
    },
    validations: {
      total_count: validations.length,
      by_stage: groupBy(validations, 'stage')
    },
    llm_calls: {
      total_count: llmCalls.length,
      success_count: llmCalls.filter(c => c.success).length,
      total_tokens: llmCalls.reduce((sum, c) => sum + c.tokens, 0)
    },
    total_duration: totalDuration,
    completed_at: new Date().toISOString()
  };
}

/**
 * Clear old preprocessing metrics
 * @param {number} olderThan - Clear metrics older than this (in ms)
 * @returns {Object} Cleared counts
 */
function clearOldMetrics(olderThan = 86400000) { // Default: 24 hours
  const cutoff = new Date(Date.now() - olderThan);

  const initialCounts = {
    indexGeneration: preprocessingMetrics.indexGeneration.length,
    corrections: preprocessingMetrics.corrections.length,
    validations: preprocessingMetrics.validations.length,
    llmCalls: preprocessingMetrics.llmCalls.length
  };

  preprocessingMetrics.indexGeneration = preprocessingMetrics.indexGeneration.filter(m => new Date(m.timestamp) >= cutoff);
  preprocessingMetrics.corrections = preprocessingMetrics.corrections.filter(m => new Date(m.timestamp) >= cutoff);
  preprocessingMetrics.validations = preprocessingMetrics.validations.filter(m => new Date(m.timestamp) >= cutoff);
  preprocessingMetrics.llmCalls = preprocessingMetrics.llmCalls.filter(m => new Date(m.timestamp) >= cutoff);

  const cleared = {
    indexGeneration: initialCounts.indexGeneration - preprocessingMetrics.indexGeneration.length,
    corrections: initialCounts.corrections - preprocessingMetrics.corrections.length,
    validations: initialCounts.validations - preprocessingMetrics.validations.length,
    llmCalls: initialCounts.llmCalls - preprocessingMetrics.llmCalls.length
  };

  console.log(`[Preprocessing Monitor] Cleared old metrics:`, cleared);

  return cleared;
}

/**
 * Reset all preprocessing metrics (for testing)
 */
function reset() {
  preprocessingMetrics.indexGeneration = [];
  preprocessingMetrics.corrections = [];
  preprocessingMetrics.validations = [];
  preprocessingMetrics.llmCalls = [];
  console.log('[Preprocessing Monitor] Metrics reset');
}

// Helper functions

function generateId() {
  return `prep_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function average(arr) {
  if (arr.length === 0) return 0;
  return Math.round(arr.reduce((sum, val) => sum + val, 0) / arr.length);
}

function groupBy(arr, key) {
  const grouped = {};
  arr.forEach(item => {
    const value = item[key] || 'unknown';
    if (!grouped[value]) {
      grouped[value] = [];
    }
    grouped[value].push(item);
  });
  return grouped;
}

function trimMetrics(metricsArray, maxSize = 1000) {
  while (metricsArray.length > maxSize) {
    metricsArray.shift();
  }
}

module.exports = {
  recordIndexGeneration,
  recordCorrection,
  recordValidation,
  recordPreprocessingLLMCall,
  recordDecision,
  getPreprocessingStats,
  getDocumentSummary,
  clearOldMetrics,
  reset,
  PREPROCESSING_THRESHOLDS
};
