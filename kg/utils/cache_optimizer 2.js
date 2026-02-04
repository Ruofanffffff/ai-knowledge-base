/**
 * Cache Optimizer Module
 * 
 * Optimizes cache performance by:
 * - Managing cache expiration times dynamically
 * - Tracking cache hit rate statistics
 * - Providing cache optimization recommendations
 * - Analyzing cache usage patterns
 * 
 * Validates: Requirements 21.16, 21.17
 */

const llmCache = require('./llm_cache');

// Cache performance metrics
const metrics = {
  hitRateHistory: [],
  expirationEvents: [],
  sizeHistory: []
};

// Configuration
const CONFIG = {
  TARGET_HIT_RATE: 0.5,           // Target 50% hit rate
  MIN_TTL_MS: 3600000,            // 1 hour minimum
  MAX_TTL_MS: 86400000,           // 24 hours maximum
  DEFAULT_TTL_MS: 24 * 60 * 60 * 1000,  // 24 hours
  SAMPLE_INTERVAL_MS: 60000,      // Sample every minute
  HISTORY_SIZE: 1000              // Keep last 1000 samples
};

// Current state
const state = {
  currentTTL: CONFIG.DEFAULT_TTL_MS,
  lastOptimization: Date.now(),
  samplingTimer: null
};

/**
 * Start cache monitoring
 */
function startMonitoring() {
  if (state.samplingTimer) {
    stopMonitoring();
  }

  state.samplingTimer = setInterval(() => {
    sampleCacheMetrics();
  }, CONFIG.SAMPLE_INTERVAL_MS);

  console.log('[Cache Optimizer] Monitoring started');
}

/**
 * Stop cache monitoring
 */
function stopMonitoring() {
  if (state.samplingTimer) {
    clearInterval(state.samplingTimer);
    state.samplingTimer = null;
  }

  console.log('[Cache Optimizer] Monitoring stopped');
}

/**
 * Sample cache metrics
 */
function sampleCacheMetrics() {
  const stats = llmCache.getStats();

  // Record hit rate
  metrics.hitRateHistory.push({
    timestamp: new Date().toISOString(),
    hit_rate: stats.hit_rate / 100, // Convert percentage to decimal
    hits: stats.hits,
    misses: stats.misses,
    size: stats.size
  });

  // Record cache size
  metrics.sizeHistory.push({
    timestamp: new Date().toISOString(),
    size: stats.size,
    max_size: stats.max_size,
    utilization: stats.max_size > 0 ? stats.size / stats.max_size : 0
  });

  // Trim history
  if (metrics.hitRateHistory.length > CONFIG.HISTORY_SIZE) {
    metrics.hitRateHistory.shift();
  }
  if (metrics.sizeHistory.length > CONFIG.HISTORY_SIZE) {
    metrics.sizeHistory.shift();
  }
}

/**
 * Get cache hit rate statistics
 * @param {Object} options - Query options
 * @returns {Object} Hit rate statistics
 */
function getHitRateStats(options = {}) {
  const {
    timeRange = 3600000 // Default: last hour
  } = options;

  const since = new Date(Date.now() - timeRange);
  const recentSamples = metrics.hitRateHistory.filter(s => 
    new Date(s.timestamp) >= since
  );

  if (recentSamples.length === 0) {
    return {
      current_hit_rate: 0,
      avg_hit_rate: 0,
      min_hit_rate: 0,
      max_hit_rate: 0,
      sample_count: 0,
      target_hit_rate: CONFIG.TARGET_HIT_RATE * 100, // Return as percentage
      is_healthy: false
    };
  }

  const hitRates = recentSamples.map(s => s.hit_rate);
  const avgHitRate = average(hitRates);
  const currentHitRate = recentSamples[recentSamples.length - 1].hit_rate;

  return {
    current_hit_rate: Math.round(currentHitRate * 10000) / 100, // Percentage
    avg_hit_rate: Math.round(avgHitRate * 10000) / 100,
    min_hit_rate: Math.round(Math.min(...hitRates) * 10000) / 100,
    max_hit_rate: Math.round(Math.max(...hitRates) * 10000) / 100,
    sample_count: recentSamples.length,
    target_hit_rate: CONFIG.TARGET_HIT_RATE * 100,
    is_healthy: avgHitRate >= CONFIG.TARGET_HIT_RATE,
    trend: calculateTrend(hitRates)
  };
}

/**
 * Get cache size statistics
 * @param {Object} options - Query options
 * @returns {Object} Size statistics
 */
function getCacheSizeStats(options = {}) {
  const {
    timeRange = 3600000
  } = options;

  const since = new Date(Date.now() - timeRange);
  const recentSamples = metrics.sizeHistory.filter(s => 
    new Date(s.timestamp) >= since
  );

  if (recentSamples.length === 0) {
    const currentStats = llmCache.getStats();
    return {
      current_size: currentStats.size,
      avg_size: currentStats.size,
      max_size: currentStats.max_size,
      avg_utilization: currentStats.size / currentStats.max_size,
      sample_count: 0
    };
  }

  const sizes = recentSamples.map(s => s.size);
  const utilizations = recentSamples.map(s => s.utilization);

  return {
    current_size: recentSamples[recentSamples.length - 1].size,
    avg_size: Math.round(average(sizes)),
    max_size: recentSamples[0].max_size,
    avg_utilization: Math.round(average(utilizations) * 10000) / 100, // Percentage
    peak_size: Math.max(...sizes),
    sample_count: recentSamples.length
  };
}

/**
 * Optimize cache TTL based on hit rate
 * @returns {Object} Optimization result
 */
function optimizeTTL() {
  const hitRateStats = getHitRateStats();
  const currentHitRate = hitRateStats.current_hit_rate / 100;

  let newTTL = state.currentTTL;
  let action = 'no_change';
  let reason = 'Hit rate is within acceptable range';

  // If hit rate is too low, increase TTL to keep entries longer
  if (currentHitRate < CONFIG.TARGET_HIT_RATE * 0.8) {
    newTTL = Math.min(state.currentTTL * 1.5, CONFIG.MAX_TTL_MS);
    action = 'increase_ttl';
    reason = `Hit rate ${hitRateStats.current_hit_rate}% is below target, increasing TTL to retain entries longer`;
  }
  // If hit rate is very high, we can reduce TTL to free up space
  else if (currentHitRate > CONFIG.TARGET_HIT_RATE * 1.5) {
    newTTL = Math.max(state.currentTTL * 0.75, CONFIG.MIN_TTL_MS);
    action = 'decrease_ttl';
    reason = `Hit rate ${hitRateStats.current_hit_rate}% is well above target, decreasing TTL to free up space`;
  }

  // Apply new TTL if changed
  if (newTTL !== state.currentTTL) {
    state.currentTTL = newTTL;
    llmCache.configure({ defaultTTL: newTTL });
    console.log(`[Cache Optimizer] ${action}: ${Math.round(newTTL / 1000 / 60)} minutes`);
  }

  state.lastOptimization = Date.now();

  return {
    action,
    reason,
    old_ttl_ms: state.currentTTL,
    new_ttl_ms: newTTL,
    current_hit_rate: hitRateStats.current_hit_rate,
    target_hit_rate: CONFIG.TARGET_HIT_RATE * 100, // Return as percentage
    timestamp: new Date().toISOString()
  };
}

/**
 * Get cache optimization recommendations
 * @returns {Array} Recommendations
 */
function getRecommendations() {
  const recommendations = [];
  const hitRateStats = getHitRateStats();
  const sizeStats = getCacheSizeStats();
  const cacheStats = llmCache.getStats();

  // Recommendation 1: Low hit rate
  if (hitRateStats.avg_hit_rate < CONFIG.TARGET_HIT_RATE * 100) {
    recommendations.push({
      priority: 'high',
      category: 'hit_rate',
      issue: `Cache hit rate ${hitRateStats.avg_hit_rate}% is below target ${CONFIG.TARGET_HIT_RATE * 100}%`,
      recommendation: 'Increase cache TTL to retain entries longer, or increase cache size',
      impact: 'high',
      effort: 'low'
    });
  }

  // Recommendation 2: Cache size near limit
  if (sizeStats.avg_utilization > 80) {
    recommendations.push({
      priority: 'medium',
      category: 'capacity',
      issue: `Cache utilization ${sizeStats.avg_utilization}% is high`,
      recommendation: 'Increase max cache size to reduce evictions',
      impact: 'medium',
      effort: 'low'
    });
  }

  // Recommendation 3: High eviction rate
  if (cacheStats.evictions > cacheStats.hits * 0.1) {
    recommendations.push({
      priority: 'medium',
      category: 'evictions',
      issue: `High eviction rate: ${cacheStats.evictions} evictions vs ${cacheStats.hits} hits`,
      recommendation: 'Increase cache size or reduce TTL for less frequently used entries',
      impact: 'medium',
      effort: 'medium'
    });
  }

  // Recommendation 4: Very high hit rate (over-caching)
  if (hitRateStats.avg_hit_rate > 90) {
    recommendations.push({
      priority: 'low',
      category: 'optimization',
      issue: `Cache hit rate ${hitRateStats.avg_hit_rate}% is very high`,
      recommendation: 'Consider reducing cache size or TTL to free up memory',
      impact: 'low',
      effort: 'low'
    });
  }

  // Recommendation 5: Declining hit rate trend
  if (hitRateStats.trend === 'decreasing') {
    recommendations.push({
      priority: 'medium',
      category: 'trend',
      issue: 'Cache hit rate is declining',
      recommendation: 'Investigate query patterns and consider adjusting cache strategy',
      impact: 'medium',
      effort: 'high'
    });
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return recommendations;
}

/**
 * Analyze cache usage patterns
 * @returns {Object} Usage analysis
 */
function analyzeCacheUsage() {
  const entries = llmCache.getEntries();
  const hitRateStats = getHitRateStats();
  const sizeStats = getCacheSizeStats();

  // Analyze entry distribution
  const hitCounts = entries.map(e => e.hit_count);
  const totalHits = hitCounts.reduce((sum, count) => sum + count, 0);

  // Find hot entries (top 20%)
  const sortedByHits = [...entries].sort((a, b) => b.hit_count - a.hit_count);
  const hotEntriesCount = Math.ceil(entries.length * 0.2);
  const hotEntries = sortedByHits.slice(0, hotEntriesCount);
  const hotEntriesHits = hotEntries.reduce((sum, e) => sum + e.hit_count, 0);

  // Find cold entries (bottom 20%)
  const coldEntriesCount = Math.ceil(entries.length * 0.2);
  const coldEntries = sortedByHits.slice(-coldEntriesCount);

  return {
    timestamp: new Date().toISOString(),
    total_entries: entries.length,
    hit_rate_stats: hitRateStats,
    size_stats: sizeStats,
    entry_distribution: {
      hot_entries: {
        count: hotEntries.length,
        total_hits: hotEntriesHits,
        hit_percentage: totalHits > 0 ? Math.round(hotEntriesHits / totalHits * 10000) / 100 : 0
      },
      cold_entries: {
        count: coldEntries.length,
        avg_hits: coldEntries.length > 0 ? average(coldEntries.map(e => e.hit_count)) : 0
      }
    },
    recommendations: getRecommendations()
  };
}

/**
 * Get comprehensive cache statistics
 * @returns {Object} Comprehensive statistics
 */
function getComprehensiveStats() {
  const cacheStats = llmCache.getStats();
  const hitRateStats = getHitRateStats();
  const sizeStats = getCacheSizeStats();

  return {
    timestamp: new Date().toISOString(),
    cache: cacheStats,
    hit_rate: hitRateStats,
    size: sizeStats,
    configuration: {
      current_ttl_ms: state.currentTTL,
      current_ttl_hours: Math.round(state.currentTTL / 1000 / 60 / 60 * 10) / 10,
      min_ttl_hours: CONFIG.MIN_TTL_MS / 1000 / 60 / 60,
      max_ttl_hours: CONFIG.MAX_TTL_MS / 1000 / 60 / 60,
      target_hit_rate: CONFIG.TARGET_HIT_RATE * 100
    },
    last_optimization: new Date(state.lastOptimization).toISOString()
  };
}

/**
 * Clear all metrics (for testing)
 */
function reset() {
  metrics.hitRateHistory = [];
  metrics.expirationEvents = [];
  metrics.sizeHistory = [];
  state.currentTTL = CONFIG.DEFAULT_TTL_MS;
  state.lastOptimization = Date.now();
  stopMonitoring();
  console.log('[Cache Optimizer] Reset complete');
}

// Helper functions

function average(arr) {
  if (arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

function calculateTrend(values) {
  if (values.length < 2) return 'stable';

  const firstHalf = values.slice(0, Math.floor(values.length / 2));
  const secondHalf = values.slice(Math.floor(values.length / 2));

  const firstAvg = average(firstHalf);
  const secondAvg = average(secondHalf);

  const changeRate = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;

  if (Math.abs(changeRate) < 10) {
    return 'stable';
  } else if (changeRate > 0) {
    return 'increasing';
  } else {
    return 'decreasing';
  }
}

module.exports = {
  startMonitoring,
  stopMonitoring,
  getHitRateStats,
  getCacheSizeStats,
  optimizeTTL,
  getRecommendations,
  analyzeCacheUsage,
  getComprehensiveStats,
  reset,
  CONFIG
};
