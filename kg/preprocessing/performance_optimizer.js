/**
 * Performance Optimizer for LLM Preprocessing
 * 
 * Implements performance optimization strategies:
 * 1. Batch processing for multiple CKBs
 * 2. Adaptive timeout adjustment
 * 3. Smart caching strategies
 * 4. Dynamic concurrency control
 * 
 * Task 18: 性能优化和调优
 * Requirements: 9.1
 */

const { getGlobalInstance } = require('./latency_control_manager');
const preprocessingMonitor = require('./preprocessing_monitor');

/**
 * Batch Processor for CKB corrections
 * Groups multiple CKBs and processes them in parallel batches
 */
class BatchProcessor {
  constructor(options = {}) {
    this.batchSize = options.batchSize || 10;
    this.maxConcurrency = options.maxConcurrency || 5;
  }

  /**
   * Process multiple CKBs in batches
   * 
   * @param {Array} ckbs - Array of CKB objects
   * @param {Function} processFn - Processing function for each CKB
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} Processing results
   */
  async processBatch(ckbs, processFn, options = {}) {
    if (!ckbs || ckbs.length === 0) {
      return [];
    }

    const startTime = Date.now();
    const results = [];
    
    // Split into batches
    const batches = this._createBatches(ckbs, this.batchSize);
    
    console.log(`[Batch Processor] Processing ${ckbs.length} items in ${batches.length} batches`);
    
    // Process each batch
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      const batchStartTime = Date.now();
      
      try {
        // Process items in batch concurrently
        const batchResults = await Promise.all(
          batch.map(item => this._processWithErrorHandling(item, processFn, options))
        );
        
        results.push(...batchResults);
        
        const batchDuration = Date.now() - batchStartTime;
        console.log(`[Batch Processor] Batch ${i + 1}/${batches.length} completed in ${batchDuration}ms`);
      } catch (error) {
        console.error(`[Batch Processor] Batch ${i + 1} failed:`, error.message);
        // Continue with next batch even if this one fails
      }
    }
    
    const totalDuration = Date.now() - startTime;
    console.log(`[Batch Processor] All batches completed in ${totalDuration}ms`);
    
    return results;
  }

  /**
   * Process single item with error handling
   * @private
   */
  async _processWithErrorHandling(item, processFn, options) {
    try {
      return await processFn(item, options);
    } catch (error) {
      console.error(`[Batch Processor] Item processing failed:`, error.message);
      return {
        success: false,
        error: error.message,
        item
      };
    }
  }

  /**
   * Create batches from array
   * @private
   */
  _createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}

/**
 * Adaptive Timeout Manager
 * Dynamically adjusts timeouts based on historical performance
 */
class AdaptiveTimeoutManager {
  constructor(options = {}) {
    this.latencyManager = getGlobalInstance();
    this.adjustmentFactor = options.adjustmentFactor || 1.2;
    this.minTimeout = options.minTimeout || 5000;
    this.maxTimeout = options.maxTimeout || 60000;
  }

  /**
   * Get recommended timeout for operation based on historical data
   * 
   * @param {string} operation - Operation type
   * @returns {number} Recommended timeout in milliseconds
   */
  getRecommendedTimeout(operation) {
    const metrics = this.latencyManager.getMetrics();
    const operationStats = metrics.operationLatencies[operation];
    
    if (!operationStats || operationStats.count < 5) {
      // Not enough data, use default
      return this.latencyManager.getTimeout(operation);
    }
    
    // Calculate recommended timeout based on max latency + buffer
    const recommendedTimeout = Math.ceil(operationStats.max * this.adjustmentFactor);
    
    // Clamp to min/max bounds
    return Math.max(this.minTimeout, Math.min(this.maxTimeout, recommendedTimeout));
  }

  /**
   * Adjust timeout for operation
   * 
   * @param {string} operation - Operation type
   */
  adjustTimeout(operation) {
    const currentTimeout = this.latencyManager.getTimeout(operation);
    const recommendedTimeout = this.getRecommendedTimeout(operation);
    
    if (recommendedTimeout !== currentTimeout) {
      console.log(`[Adaptive Timeout] Adjusting ${operation} timeout: ${currentTimeout}ms -> ${recommendedTimeout}ms`);
      this.latencyManager.setTimeout(operation, recommendedTimeout);
      return true;
    }
    
    return false;
  }

  /**
   * Adjust all timeouts based on performance data
   */
  adjustAllTimeouts() {
    const operations = [
      'document_index',
      'cbk_correction',
      'field_correction',
      'schema_correction',
      'merge_correction',
      'relation_correction',
      'graph_description'
    ];
    
    let adjustedCount = 0;
    operations.forEach(operation => {
      if (this.adjustTimeout(operation)) {
        adjustedCount++;
      }
    });
    
    console.log(`[Adaptive Timeout] Adjusted ${adjustedCount} timeouts`);
    return adjustedCount;
  }
}

/**
 * Smart Cache Strategy Manager
 * Implements intelligent caching strategies
 */
class SmartCacheStrategy {
  constructor(options = {}) {
    this.priorityOperations = options.priorityOperations || [
      'document_index',
      'field_correction',
      'relation_correction'
    ];
  }

  /**
   * Determine if result should be cached based on operation priority
   * 
   * @param {string} operation - Operation type
   * @param {Object} context - Operation context
   * @returns {boolean} Whether to cache
   */
  shouldCache(operation, context = {}) {
    // Always cache high-priority operations
    if (this.priorityOperations.includes(operation)) {
      return true;
    }
    
    // Cache if operation is slow
    const latencyManager = getGlobalInstance();
    const metrics = latencyManager.getMetrics();
    const operationStats = metrics.operationLatencies[operation];
    
    if (operationStats && operationStats.avg > 5000) {
      return true;
    }
    
    // Cache if result is likely to be reused
    if (context.isCommonPattern || context.isFrequentQuery) {
      return true;
    }
    
    return false;
  }

  /**
   * Generate optimized cache key
   * 
   * @param {string} operation - Operation type
   * @param {Object} params - Operation parameters
   * @returns {string} Cache key
   */
  generateCacheKey(operation, params) {
    // For document index, use doc_id as key
    if (operation === 'document_index' && params.doc_id) {
      return `idx:${params.doc_id}`;
    }
    
    // For corrections, use combination of doc_id and stage
    if (params.doc_id && params.stage) {
      return `corr:${params.doc_id}:${params.stage}`;
    }
    
    // Default: hash of parameters
    return `op:${operation}:${JSON.stringify(params)}`;
  }

  /**
   * Warm up cache with common patterns
   * 
   * @param {Array} commonPatterns - Array of common operation patterns
   */
  async warmupCache(commonPatterns) {
    console.log(`[Smart Cache] Warming up cache with ${commonPatterns.length} patterns`);
    
    // This would be implemented based on actual usage patterns
    // For now, just log the intent
    commonPatterns.forEach(pattern => {
      console.log(`[Smart Cache] Would warm up: ${pattern.operation}`);
    });
  }
}

/**
 * Dynamic Concurrency Controller
 * Adjusts concurrency based on system load and performance
 */
class DynamicConcurrencyController {
  constructor(options = {}) {
    this.latencyManager = getGlobalInstance();
    this.minConcurrency = options.minConcurrency || 2;
    this.maxConcurrency = options.maxConcurrency || 15;
    this.targetQueueRatio = options.targetQueueRatio || 1.5;
  }

  /**
   * Calculate recommended concurrency based on queue status
   * 
   * @returns {number} Recommended concurrency
   */
  getRecommendedConcurrency() {
    const queueStatus = this.latencyManager.getQueueStatus();
    const currentConcurrency = queueStatus.concurrency;
    const queueSize = queueStatus.size;
    const pending = queueStatus.pending;
    
    // If queue is growing, increase concurrency
    if (queueSize > currentConcurrency * this.targetQueueRatio) {
      const recommended = Math.min(
        currentConcurrency + 2,
        this.maxConcurrency
      );
      return recommended;
    }
    
    // If queue is empty and pending is low, decrease concurrency
    if (queueSize === 0 && pending < currentConcurrency / 2) {
      const recommended = Math.max(
        currentConcurrency - 1,
        this.minConcurrency
      );
      return recommended;
    }
    
    return currentConcurrency;
  }

  /**
   * Adjust concurrency if needed
   * 
   * @returns {boolean} Whether concurrency was adjusted
   */
  adjustConcurrency() {
    const queueStatus = this.latencyManager.getQueueStatus();
    const currentConcurrency = queueStatus.concurrency;
    const recommendedConcurrency = this.getRecommendedConcurrency();
    
    if (recommendedConcurrency !== currentConcurrency) {
      console.log(`[Dynamic Concurrency] Adjusting concurrency: ${currentConcurrency} -> ${recommendedConcurrency}`);
      // Note: Actual adjustment would require recreating the queue
      // This is logged for monitoring purposes
      return true;
    }
    
    return false;
  }
}

/**
 * Performance Optimizer
 * Main class that coordinates all optimization strategies
 */
class PerformanceOptimizer {
  constructor(options = {}) {
    this.batchProcessor = new BatchProcessor(options.batch);
    this.timeoutManager = new AdaptiveTimeoutManager(options.timeout);
    this.cacheStrategy = new SmartCacheStrategy(options.cache);
    this.concurrencyController = new DynamicConcurrencyController(options.concurrency);
    
    this.optimizationInterval = options.optimizationInterval || 300000; // 5 minutes
    this.autoOptimize = options.autoOptimize !== false;
    
    if (this.autoOptimize) {
      this.startAutoOptimization();
    }
  }

  /**
   * Start automatic optimization
   */
  startAutoOptimization() {
    console.log('[Performance Optimizer] Starting auto-optimization');
    
    this.optimizationTimer = setInterval(() => {
      this.optimize();
    }, this.optimizationInterval);
  }

  /**
   * Stop automatic optimization
   */
  stopAutoOptimization() {
    if (this.optimizationTimer) {
      clearInterval(this.optimizationTimer);
      this.optimizationTimer = null;
      console.log('[Performance Optimizer] Stopped auto-optimization');
    }
  }

  /**
   * Run optimization cycle
   */
  optimize() {
    console.log('[Performance Optimizer] Running optimization cycle');
    
    const results = {
      timestamp: new Date().toISOString(),
      timeouts_adjusted: 0,
      concurrency_adjusted: false
    };
    
    try {
      // Adjust timeouts based on performance
      results.timeouts_adjusted = this.timeoutManager.adjustAllTimeouts();
      
      // Adjust concurrency based on queue status
      results.concurrency_adjusted = this.concurrencyController.adjustConcurrency();
      
      // Log results
      console.log('[Performance Optimizer] Optimization results:', results);
    } catch (error) {
      console.error('[Performance Optimizer] Optimization failed:', error.message);
    }
    
    return results;
  }

  /**
   * Get batch processor
   */
  getBatchProcessor() {
    return this.batchProcessor;
  }

  /**
   * Get cache strategy
   */
  getCacheStrategy() {
    return this.cacheStrategy;
  }

  /**
   * Get performance report
   */
  getPerformanceReport() {
    const latencyManager = getGlobalInstance();
    const metrics = latencyManager.getMetrics();
    const prepStats = preprocessingMonitor.getPreprocessingStats({ timeRange: 3600000 });
    
    return {
      timestamp: new Date().toISOString(),
      llm_calls: {
        total: metrics.totalCalls,
        success_rate: metrics.successRate,
        cache_hit_rate: metrics.cacheHitRate,
        avg_latency: metrics.avgLatency
      },
      preprocessing: {
        index_generation: prepStats.index_generation,
        corrections: prepStats.corrections,
        validations: prepStats.validations
      },
      queue_status: latencyManager.getQueueStatus(),
      recommendations: this._generateRecommendations(metrics, prepStats)
    };
  }

  /**
   * Generate optimization recommendations
   * @private
   */
  _generateRecommendations(metrics, prepStats) {
    const recommendations = [];
    
    // Check cache hit rate
    const cacheHitRate = parseFloat(metrics.cacheHitRate);
    if (cacheHitRate < 30) {
      recommendations.push({
        type: 'CACHE',
        priority: 'MEDIUM',
        message: `Low cache hit rate (${cacheHitRate}%). Consider increasing cache size.`
      });
    }
    
    // Check timeout rate
    if (metrics.timeoutCalls > 0) {
      const timeoutRate = (metrics.timeoutCalls / metrics.totalCalls) * 100;
      if (timeoutRate > 5) {
        recommendations.push({
          type: 'TIMEOUT',
          priority: 'HIGH',
          message: `High timeout rate (${timeoutRate.toFixed(2)}%). Consider increasing timeouts.`
        });
      }
    }
    
    // Check queue congestion
    const queueStatus = getGlobalInstance().getQueueStatus();
    if (queueStatus.size > queueStatus.concurrency * 2) {
      recommendations.push({
        type: 'CONCURRENCY',
        priority: 'HIGH',
        message: `Queue congestion detected. Consider increasing concurrency.`
      });
    }
    
    return recommendations;
  }
}

// Create global instance
let globalOptimizer = null;

/**
 * Get global optimizer instance
 */
function getGlobalOptimizer(options = {}) {
  if (!globalOptimizer) {
    globalOptimizer = new PerformanceOptimizer(options);
  }
  return globalOptimizer;
}

/**
 * Reset global optimizer
 */
function resetGlobalOptimizer() {
  if (globalOptimizer) {
    globalOptimizer.stopAutoOptimization();
    globalOptimizer = null;
  }
}

module.exports = {
  PerformanceOptimizer,
  BatchProcessor,
  AdaptiveTimeoutManager,
  SmartCacheStrategy,
  DynamicConcurrencyController,
  getGlobalOptimizer,
  resetGlobalOptimizer
};
