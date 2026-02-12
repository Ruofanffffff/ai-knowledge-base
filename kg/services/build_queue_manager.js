/**
 * Knowledge Graph Build Queue Manager
 * 
 * Manages concurrent knowledge graph builds with a queue system.
 * Limits concurrent builds to prevent resource exhaustion.
 * Implements FIFO (First-In-First-Out) scheduling algorithm.
 */

const EventEmitter = require('events');

/**
 * BuildQueueManager class
 * 
 * Manages a queue of KG build tasks with concurrency control.
 * Maximum concurrent builds: 3 (configurable via environment variable)
 */
class BuildQueueManager extends EventEmitter {
  constructor(maxConcurrent = 3) {
    super();
    
    // Maximum number of concurrent builds
    this.maxConcurrent = maxConcurrent;
    
    // Queue of pending build tasks
    this.queue = [];
    
    // Set of currently running document IDs
    this.running = new Set();
    
    // Map of document ID to task info
    this.tasks = new Map();
    
    console.log(`[BuildQueueManager] Initialized with max concurrent builds: ${this.maxConcurrent}`);
  }

  /**
   * Add a build task to the queue
   * 
   * @param {string} docId - Document ID
   * @param {Function} buildFn - Async function that performs the build
   * @param {Object} options - Additional options
   * @returns {Promise<any>} Promise that resolves when build completes
   */
  async enqueue(docId, buildFn, options = {}) {
    if (!docId) {
      throw new Error('Document ID is required');
    }

    if (typeof buildFn !== 'function') {
      throw new Error('Build function is required');
    }

    // Check if already queued or running
    if (this.tasks.has(docId)) {
      const existingTask = this.tasks.get(docId);
      console.log(`[BuildQueueManager] Build for doc ${docId} already ${existingTask.status}`);
      
      // Return the existing promise
      return existingTask.promise;
    }

    // Create task object
    const task = {
      docId,
      buildFn,
      options,
      status: 'queued',
      queuedAt: new Date(),
      startedAt: null,
      completedAt: null
    };

    // Create promise that will be resolved/rejected when build completes
    task.promise = new Promise((resolve, reject) => {
      task.resolve = resolve;
      task.reject = reject;
    });

    // Add to queue and task map
    this.queue.push(task);
    this.tasks.set(docId, task);

    console.log(`[BuildQueueManager] Queued build for doc ${docId}. Queue size: ${this.queue.length}, Running: ${this.running.size}`);
    
    // Emit queued event
    this.emit('queued', { docId, queueSize: this.queue.length });

    // Try to process queue
    this._processQueue();

    return task.promise;
  }

  /**
   * Process the queue - start builds if capacity available
   * @private
   */
  _processQueue() {
    // Check if we can start more builds
    while (this.running.size < this.maxConcurrent && this.queue.length > 0) {
      const task = this.queue.shift();
      this._startBuild(task);
    }
  }

  /**
   * Start a build task
   * @private
   */
  async _startBuild(task) {
    const { docId, buildFn } = task;

    // Update task status
    task.status = 'running';
    task.startedAt = new Date();
    this.running.add(docId);

    console.log(`[BuildQueueManager] Starting build for doc ${docId}. Running: ${this.running.size}/${this.maxConcurrent}`);
    
    // Emit started event
    this.emit('started', { 
      docId, 
      runningCount: this.running.size,
      queueSize: this.queue.length 
    });

    try {
      // Execute the build function
      const result = await buildFn();

      // Build completed successfully
      task.status = 'completed';
      task.completedAt = new Date();
      task.result = result;

      console.log(`[BuildQueueManager] Completed build for doc ${docId}. Duration: ${task.completedAt - task.startedAt}ms`);
      
      // Emit completed event
      this.emit('completed', { 
        docId, 
        result,
        duration: task.completedAt - task.startedAt
      });

      // Resolve the promise
      task.resolve(result);

    } catch (error) {
      // Build failed
      task.status = 'failed';
      task.completedAt = new Date();
      task.error = error;

      console.error(`[BuildQueueManager] Failed build for doc ${docId}:`, error.message);
      
      // Emit failed event
      this.emit('failed', { 
        docId, 
        error,
        duration: task.completedAt - task.startedAt
      });

      // Reject the promise
      task.reject(error);

    } finally {
      // Remove from running set
      this.running.delete(docId);

      // Keep task in map for history (could be cleaned up later)
      // this.tasks.delete(docId);

      console.log(`[BuildQueueManager] Build finished for doc ${docId}. Running: ${this.running.size}/${this.maxConcurrent}, Queue: ${this.queue.length}`);

      // Process next item in queue
      this._processQueue();
    }
  }

  /**
   * Check if a document is currently being built
   * 
   * @param {string} docId - Document ID
   * @returns {boolean} True if build is in progress
   */
  isRunning(docId) {
    return this.running.has(docId);
  }

  /**
   * Check if a document is queued
   * 
   * @param {string} docId - Document ID
   * @returns {boolean} True if build is queued
   */
  isQueued(docId) {
    const task = this.tasks.get(docId);
    return task && task.status === 'queued';
  }

  /**
   * Get task status for a document
   * 
   * @param {string} docId - Document ID
   * @returns {Object|null} Task info or null if not found
   */
  getTaskStatus(docId) {
    const task = this.tasks.get(docId);
    if (!task) {
      return null;
    }

    return {
      docId: task.docId,
      status: task.status,
      queuedAt: task.queuedAt,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      duration: task.completedAt && task.startedAt 
        ? task.completedAt - task.startedAt 
        : null
    };
  }

  /**
   * Get queue statistics
   * 
   * @returns {Object} Queue statistics
   */
  getStats() {
    return {
      maxConcurrent: this.maxConcurrent,
      running: this.running.size,
      queued: this.queue.length,
      total: this.tasks.size,
      runningTasks: Array.from(this.running),
      queuedTasks: this.queue.map(t => t.docId)
    };
  }

  /**
   * Get task progress information
   * 
   * @param {string} docId - Document ID
   * @returns {Object|null} Progress info or null if not found
   */
  getProgress(docId) {
    const task = this.tasks.get(docId);
    
    if (!task) {
      return null;
    }
    
    // Calculate progress percentage based on status
    let percentage = 0;
    let stage = 'unknown';
    
    switch (task.status) {
      case 'queued':
        percentage = 0;
        stage = 'queued';
        break;
      case 'running':
        // Estimate progress based on elapsed time
        // Assume average build takes 30 seconds
        const elapsed = new Date() - task.startedAt;
        const estimatedTotal = 30000; // 30 seconds
        percentage = Math.min(Math.floor((elapsed / estimatedTotal) * 100), 95);
        stage = 'building';
        break;
      case 'completed':
        percentage = 100;
        stage = 'completed';
        break;
      case 'failed':
        percentage = 0;
        stage = 'failed';
        break;
      case 'cancelled':
        percentage = 0;
        stage = 'cancelled';
        break;
    }
    
    // Estimate remaining time for running tasks
    let estimatedTime = null;
    if (task.status === 'running' && percentage < 95) {
      const elapsed = new Date() - task.startedAt;
      const estimatedTotal = 30000;
      estimatedTime = Math.max(estimatedTotal - elapsed, 0);
    }
    
    return {
      docId,
      status: task.status,
      percentage,
      stage,
      estimatedTime
    };
  }

  /**
   * Get queue position for a document
   * 
   * @param {string} docId - Document ID
   * @returns {number|null} Queue position (1-based) or null if not queued
   */
  getQueuePosition(docId) {
    const task = this.tasks.get(docId);
    
    if (!task || task.status !== 'queued') {
      return null;
    }
    
    const index = this.queue.findIndex(t => t.docId === docId);
    return index >= 0 ? index + 1 : null;
  }

  /**
   * Cancel a queued or running build
   * 
   * @param {string} docId - Document ID
   * @returns {Object} Cancellation result
   */
  async cancel(docId) {
    const task = this.tasks.get(docId);
    
    if (!task) {
      return { 
        success: false, 
        reason: 'Task not found' 
      };
    }

    // Handle queued tasks
    if (task.status === 'queued') {
      // Remove from queue
      const index = this.queue.findIndex(t => t.docId === docId);
      if (index !== -1) {
        this.queue.splice(index, 1);
      }

      // Update task status
      task.status = 'cancelled';
      task.completedAt = new Date();

      // Reject the promise
      task.reject(new Error('Build cancelled by user'));

      // Remove from tasks map
      this.tasks.delete(docId);

      console.log(`[BuildQueueManager] Cancelled queued build for doc ${docId}`);
      
      // Emit cancelled event
      this.emit('cancelled', { docId, wasQueued: true });

      return { 
        success: true, 
        message: 'Task removed from queue' 
      };
    }
    
    // Handle running tasks
    if (task.status === 'running') {
      // Mark as cancelled - the build function should check this flag
      task.cancelled = true;
      
      console.log(`[BuildQueueManager] Cancellation requested for running build: ${docId}`);
      
      // Emit cancellation request event
      this.emit('cancellationRequested', { docId });
      
      return { 
        success: true, 
        message: 'Cancellation requested - task will stop when current operation completes' 
      };
    }
    
    // Cannot cancel completed/failed tasks
    return { 
      success: false, 
      reason: `Task cannot be cancelled (status: ${task.status})` 
    };
  }

  /**
   * Clear completed/failed tasks from history
   * 
   * @param {number} olderThanMs - Clear tasks older than this (milliseconds)
   */
  clearHistory(olderThanMs = 3600000) { // Default: 1 hour
    const now = new Date();
    const cleared = [];

    for (const [docId, task] of this.tasks.entries()) {
      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        if (task.completedAt && (now - task.completedAt) > olderThanMs) {
          this.tasks.delete(docId);
          cleared.push(docId);
        }
      }
    }

    if (cleared.length > 0) {
      console.log(`[BuildQueueManager] Cleared ${cleared.length} old tasks from history`);
    }

    return cleared;
  }

  /**
   * Reset the queue manager (for testing)
   */
  reset() {
    this.queue = [];
    this.running.clear();
    this.tasks.clear();
    console.log('[BuildQueueManager] Reset complete');
  }
}

// Export singleton instance
let instance = null;

function getInstance(maxConcurrent) {
  if (!instance) {
    // Get max concurrent from environment or use default
    const max = maxConcurrent || parseInt(process.env.KG_MAX_CONCURRENT_BUILDS) || 3;
    instance = new BuildQueueManager(max);
  }
  return instance;
}

module.exports = {
  BuildQueueManager,
  getInstance
};
