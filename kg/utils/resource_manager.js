/**
 * Resource Manager Module
 * 
 * Manages system resources including:
 * - Memory usage monitoring
 * - Queue backlog monitoring
 * - Rate limiting and throttling
 * - Service degradation
 * 
 * Validates: Requirements 21.13, 21.14, 21.15, 21.18
 */

// In-memory storage for resource metrics
const metrics = {
  memory: [],
  queue: [],
  throttle: []
};

// Configuration
const CONFIG = {
  MEMORY_THRESHOLD_MB: 2048,        // 2GB memory threshold
  MEMORY_WARNING_MB: 1638,          // 80% of threshold (warning)
  QUEUE_THRESHOLD: 100,             // Max queue size
  QUEUE_WARNING: 80,                // 80% of threshold (warning)
  RATE_LIMIT_PER_MINUTE: 60,        // Max requests per minute
  THROTTLE_WINDOW_MS: 60000,        // 1 minute window
  CHECK_INTERVAL_MS: 5000           // Check every 5 seconds
};

// Current state
const state = {
  isThrottled: false,
  isDegraded: false,
  queueSize: 0,
  requestCounts: [],
  alertCallbacks: []
};

/**
 * Get current memory usage
 * @returns {Object} Memory usage information
 */
function getMemoryUsage() {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024), // MB
      rss: Math.round(usage.rss / 1024 / 1024), // MB
      external: Math.round(usage.external / 1024 / 1024), // MB
      timestamp: new Date().toISOString()
    };
  }
  return {
    heapUsed: 0,
    heapTotal: 0,
    rss: 0,
    external: 0,
    timestamp: new Date().toISOString()
  };
}

/**
 * Record memory usage
 * @returns {Object} Recorded memory metric
 */
function recordMemoryUsage() {
  const usage = getMemoryUsage();
  
  const metric = {
    id: generateId(),
    timestamp: usage.timestamp,
    heap_used: usage.heapUsed,
    heap_total: usage.heapTotal,
    rss: usage.rss,
    external: usage.external,
    is_warning: usage.heapUsed >= CONFIG.MEMORY_WARNING_MB,
    is_critical: usage.heapUsed >= CONFIG.MEMORY_THRESHOLD_MB
  };

  metrics.memory.push(metric);

  // Trim old metrics (keep last 1000)
  if (metrics.memory.length > 1000) {
    metrics.memory.shift();
  }

  // Check thresholds
  if (metric.is_critical) {
    console.error(`[Resource Manager] CRITICAL: Memory usage ${metric.heap_used}MB exceeds threshold ${CONFIG.MEMORY_THRESHOLD_MB}MB`);
    triggerAlert('memory_critical', {
      heap_used: metric.heap_used,
      threshold: CONFIG.MEMORY_THRESHOLD_MB
    });
    
    // Trigger garbage collection if available
    if (global.gc) {
      console.log('[Resource Manager] Triggering garbage collection');
      global.gc();
    }
  } else if (metric.is_warning) {
    console.warn(`[Resource Manager] WARNING: Memory usage ${metric.heap_used}MB approaching threshold`);
    triggerAlert('memory_warning', {
      heap_used: metric.heap_used,
      threshold: CONFIG.MEMORY_THRESHOLD_MB
    });
  }

  return metric;
}

/**
 * Record queue size
 * @param {number} size - Current queue size
 * @returns {Object} Recorded queue metric
 */
function recordQueueSize(size) {
  state.queueSize = size;

  const metric = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    size: size,
    is_warning: size >= CONFIG.QUEUE_WARNING,
    is_critical: size >= CONFIG.QUEUE_THRESHOLD
  };

  metrics.queue.push(metric);

  // Trim old metrics
  if (metrics.queue.length > 1000) {
    metrics.queue.shift();
  }

  // Check thresholds
  if (metric.is_critical) {
    console.error(`[Resource Manager] CRITICAL: Queue size ${size} exceeds threshold ${CONFIG.QUEUE_THRESHOLD}`);
    triggerAlert('queue_critical', {
      size: size,
      threshold: CONFIG.QUEUE_THRESHOLD
    });
    
    // Enable degraded mode
    if (!state.isDegraded) {
      enableDegradedMode();
    }
  } else if (metric.is_warning) {
    console.warn(`[Resource Manager] WARNING: Queue size ${size} approaching threshold`);
    triggerAlert('queue_warning', {
      size: size,
      threshold: CONFIG.QUEUE_THRESHOLD
    });
  } else if (state.isDegraded && size < CONFIG.QUEUE_WARNING * 0.5) {
    // Disable degraded mode when queue drops below 50% of warning
    disableDegradedMode();
  }

  return metric;
}

/**
 * Check if request should be throttled
 * @returns {boolean} True if should throttle
 */
function shouldThrottle() {
  const now = Date.now();
  const windowStart = now - CONFIG.THROTTLE_WINDOW_MS;

  // Remove old requests
  state.requestCounts = state.requestCounts.filter(t => t > windowStart);

  // Check if over limit
  if (state.requestCounts.length >= CONFIG.RATE_LIMIT_PER_MINUTE) {
    if (!state.isThrottled) {
      state.isThrottled = true;
      console.warn(`[Resource Manager] Rate limit exceeded: ${state.requestCounts.length} requests in last minute`);
      triggerAlert('rate_limit_exceeded', {
        count: state.requestCounts.length,
        limit: CONFIG.RATE_LIMIT_PER_MINUTE
      });
    }
    return true;
  }

  if (state.isThrottled && state.requestCounts.length < CONFIG.RATE_LIMIT_PER_MINUTE * 0.8) {
    state.isThrottled = false;
    console.log('[Resource Manager] Rate limit recovered');
  }

  return false;
}

/**
 * Record a request
 * @returns {boolean} True if request is allowed
 */
function recordRequest() {
  if (shouldThrottle()) {
    metrics.throttle.push({
      id: generateId(),
      timestamp: new Date().toISOString(),
      action: 'throttled'
    });
    return false;
  }

  state.requestCounts.push(Date.now());

  metrics.throttle.push({
    id: generateId(),
    timestamp: new Date().toISOString(),
    action: 'allowed'
  });

  // Trim old throttle metrics
  if (metrics.throttle.length > 1000) {
    metrics.throttle.shift();
  }

  return true;
}

/**
 * Enable degraded mode
 */
function enableDegradedMode() {
  state.isDegraded = true;
  console.warn('[Resource Manager] Entering degraded mode');
  triggerAlert('degraded_mode_enabled', {
    reason: 'queue_overload',
    queue_size: state.queueSize
  });
}

/**
 * Disable degraded mode
 */
function disableDegradedMode() {
  state.isDegraded = false;
  console.log('[Resource Manager] Exiting degraded mode');
  triggerAlert('degraded_mode_disabled', {
    queue_size: state.queueSize
  });
}

/**
 * Get resource statistics
 * @param {Object} options - Query options
 * @returns {Object} Resource statistics
 */
function getStats(options = {}) {
  const {
    timeRange = 3600000 // Default: last hour
  } = options;

  const since = new Date(Date.now() - timeRange);

  // Filter metrics by time range
  const recentMemory = metrics.memory.filter(m => new Date(m.timestamp) >= since);
  const recentQueue = metrics.queue.filter(m => new Date(m.timestamp) >= since);
  const recentThrottle = metrics.throttle.filter(m => new Date(m.timestamp) >= since);

  // Calculate memory stats
  const memoryStats = {
    current: recentMemory.length > 0 ? recentMemory[recentMemory.length - 1] : getMemoryUsage(),
    avg_heap_used: average(recentMemory.map(m => m.heap_used)),
    max_heap_used: Math.max(...recentMemory.map(m => m.heap_used), 0),
    warning_count: recentMemory.filter(m => m.is_warning).length,
    critical_count: recentMemory.filter(m => m.is_critical).length,
    threshold: CONFIG.MEMORY_THRESHOLD_MB
  };

  // Calculate queue stats
  const queueStats = {
    current_size: state.queueSize,
    avg_size: average(recentQueue.map(m => m.size)),
    max_size: Math.max(...recentQueue.map(m => m.size), 0),
    warning_count: recentQueue.filter(m => m.is_warning).length,
    critical_count: recentQueue.filter(m => m.is_critical).length,
    threshold: CONFIG.QUEUE_THRESHOLD
  };

  // Calculate throttle stats
  const throttleStats = {
    total_requests: recentThrottle.length,
    allowed_requests: recentThrottle.filter(m => m.action === 'allowed').length,
    throttled_requests: recentThrottle.filter(m => m.action === 'throttled').length,
    throttle_rate: recentThrottle.length > 0
      ? recentThrottle.filter(m => m.action === 'throttled').length / recentThrottle.length
      : 0,
    rate_limit: CONFIG.RATE_LIMIT_PER_MINUTE
  };

  return {
    timestamp: new Date().toISOString(),
    time_range: timeRange,
    memory: memoryStats,
    queue: queueStats,
    throttle: throttleStats,
    state: {
      is_throttled: state.isThrottled,
      is_degraded: state.isDegraded
    }
  };
}

/**
 * Get current system status
 * @returns {Object} System status
 */
function getStatus() {
  const memUsage = getMemoryUsage();
  
  return {
    timestamp: new Date().toISOString(),
    memory: {
      heap_used: memUsage.heapUsed,
      heap_total: memUsage.heapTotal,
      rss: memUsage.rss,
      threshold: CONFIG.MEMORY_THRESHOLD_MB,
      is_healthy: memUsage.heapUsed < CONFIG.MEMORY_WARNING_MB
    },
    queue: {
      size: state.queueSize,
      threshold: CONFIG.QUEUE_THRESHOLD,
      is_healthy: state.queueSize < CONFIG.QUEUE_WARNING
    },
    throttle: {
      is_throttled: state.isThrottled,
      rate_limit: CONFIG.RATE_LIMIT_PER_MINUTE,
      current_rate: state.requestCounts.length
    },
    degraded_mode: state.isDegraded,
    overall_health: !state.isDegraded && !state.isThrottled && 
                    memUsage.heapUsed < CONFIG.MEMORY_WARNING_MB &&
                    state.queueSize < CONFIG.QUEUE_WARNING
  };
}

/**
 * Register alert callback
 * @param {Function} callback - Alert callback function
 */
function onAlert(callback) {
  if (typeof callback === 'function') {
    state.alertCallbacks.push(callback);
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
  state.alertCallbacks.forEach(callback => {
    try {
      callback(alert);
    } catch (error) {
      console.error('[Resource Manager] Alert callback error:', error);
    }
  });
}

/**
 * Clear old metrics
 * @param {number} olderThan - Clear metrics older than this (in ms)
 * @returns {Object} Cleared counts
 */
function clearOldMetrics(olderThan = 86400000) { // Default: 24 hours
  const initialCounts = {
    memory: metrics.memory.length,
    queue: metrics.queue.length,
    throttle: metrics.throttle.length
  };

  if (olderThan === 0) {
    // Clear all metrics
    metrics.memory = [];
    metrics.queue = [];
    metrics.throttle = [];
  } else {
    const cutoff = new Date(Date.now() - olderThan);
    metrics.memory = metrics.memory.filter(m => new Date(m.timestamp) >= cutoff);
    metrics.queue = metrics.queue.filter(m => new Date(m.timestamp) >= cutoff);
    metrics.throttle = metrics.throttle.filter(m => new Date(m.timestamp) >= cutoff);
  }

  const cleared = {
    memory: initialCounts.memory - metrics.memory.length,
    queue: initialCounts.queue - metrics.queue.length,
    throttle: initialCounts.throttle - metrics.throttle.length
  };

  console.log(`[Resource Manager] Cleared old metrics:`, cleared);

  return cleared;
}

/**
 * Reset all data (for testing)
 */
function reset() {
  metrics.memory = [];
  metrics.queue = [];
  metrics.throttle = [];
  state.isThrottled = false;
  state.isDegraded = false;
  state.queueSize = 0;
  state.requestCounts = [];
  state.alertCallbacks = [];
  console.log('[Resource Manager] Reset complete');
}

// Helper functions

function generateId() {
  return `resource_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

module.exports = {
  recordMemoryUsage,
  recordQueueSize,
  recordRequest,
  shouldThrottle,
  enableDegradedMode,
  disableDegradedMode,
  getMemoryUsage,
  getStats,
  getStatus,
  onAlert,
  clearOldMetrics,
  reset,
  CONFIG
};
