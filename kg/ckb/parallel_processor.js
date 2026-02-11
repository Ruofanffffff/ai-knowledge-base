/**
 * Parallel Processor - Utility for parallel processing with concurrency control
 * 
 * Provides efficient parallel processing with configurable concurrency limits
 */

const performanceConfig = require('./performance_config');

class ParallelProcessor {
  constructor(options = {}) {
    this.maxConcurrency = options.maxConcurrency || performanceConfig.parallel.maxConcurrency;
    this.timeout = options.timeout || performanceConfig.parallel.timeout;
    this.activeCount = 0;
    this.queue = [];
  }

  /**
   * Process items in parallel with concurrency control
   * @param {Array} items - Items to process
   * @param {Function} processor - Async function to process each item
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} Results array
   */
  async processInParallel(items, processor, options = {}) {
    const {
      maxConcurrency = this.maxConcurrency,
      timeout = this.timeout,
      onProgress = null,
      stopOnError = false,
    } = options;

    if (!items || items.length === 0) {
      return [];
    }

    const results = new Array(items.length);
    const errors = [];
    let completed = 0;

    // Create processing tasks
    const tasks = items.map((item, index) => ({
      item,
      index,
      processor,
    }));

    // Process tasks with concurrency control
    const workers = [];
    for (let i = 0; i < Math.min(maxConcurrency, tasks.length); i++) {
      workers.push(this._worker(tasks, results, errors, {
        timeout,
        onProgress: (progress) => {
          completed++;
          if (onProgress) {
            onProgress({
              completed,
              total: items.length,
              percent: (completed / items.length) * 100,
            });
          }
        },
        stopOnError,
      }));
    }

    // Wait for all workers to complete
    await Promise.all(workers);

    // Check for errors
    if (errors.length > 0 && stopOnError) {
      throw new Error(`Parallel processing failed: ${errors[0].message}`);
    }

    return {
      results,
      errors,
      successCount: results.filter(r => r !== undefined).length,
      errorCount: errors.length,
    };
  }

  /**
   * Process items in batches
   * @param {Array} items - Items to process
   * @param {Function} batchProcessor - Async function to process each batch
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} Results array
   */
  async processInBatches(items, batchProcessor, options = {}) {
    const {
      batchSize = performanceConfig.parallel.batchSize,
      onProgress = null,
    } = options;

    if (!items || items.length === 0) {
      return [];
    }

    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    const results = [];
    let completed = 0;

    for (const batch of batches) {
      const batchResults = await batchProcessor(batch);
      results.push(...batchResults);
      
      completed += batch.length;
      if (onProgress) {
        onProgress({
          completed,
          total: items.length,
          percent: (completed / items.length) * 100,
        });
      }
    }

    return results;
  }

  /**
   * Map items in parallel
   * @param {Array} items - Items to map
   * @param {Function} mapper - Async mapping function
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} Mapped results
   */
  async map(items, mapper, options = {}) {
    const result = await this.processInParallel(items, mapper, options);
    return result.results;
  }

  /**
   * Filter items in parallel
   * @param {Array} items - Items to filter
   * @param {Function} predicate - Async predicate function
   * @param {Object} options - Processing options
   * @returns {Promise<Array>} Filtered items
   */
  async filter(items, predicate, options = {}) {
    const result = await this.processInParallel(items, predicate, options);
    return items.filter((item, index) => result.results[index]);
  }

  /**
   * Worker function for parallel processing
   * @private
   */
  async _worker(tasks, results, errors, options) {
    while (tasks.length > 0) {
      const task = tasks.shift();
      if (!task) break;

      try {
        // Process with timeout
        const result = await this._processWithTimeout(
          task.processor(task.item, task.index),
          options.timeout
        );
        
        results[task.index] = result;
        
        if (options.onProgress) {
          options.onProgress({ index: task.index });
        }
      } catch (error) {
        errors.push({
          index: task.index,
          item: task.item,
          error,
          message: error.message,
        });

        if (options.stopOnError) {
          // Clear remaining tasks
          tasks.length = 0;
          break;
        }
      }
    }
  }

  /**
   * Process with timeout
   * @private
   */
  async _processWithTimeout(promise, timeout) {
    if (!timeout) {
      return promise;
    }

    return Promise.race([
      promise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      ),
    ]);
  }

  /**
   * Get processor statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      maxConcurrency: this.maxConcurrency,
      activeCount: this.activeCount,
      queueLength: this.queue.length,
      timeout: this.timeout,
    };
  }
}

module.exports = { ParallelProcessor };
