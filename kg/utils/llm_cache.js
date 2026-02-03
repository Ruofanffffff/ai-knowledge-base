/**
 * LLM Response Cache
 * 
 * Caches LLM responses to avoid redundant API calls.
 * Implements cache invalidation strategies:
 * - Time-based (TTL)
 * - LRU eviction
 * - Content-based invalidation
 * - Manual invalidation
 * 
 * Requirements: 11.11-11.12
 */

const crypto = require('crypto');

/**
 * Cache entry structure
 */
class CacheEntry {
  constructor(key, value, ttl, tags = []) {
    this.key = key;
    this.value = value;
    this.created_at = Date.now();
    this.expires_at = ttl ? Date.now() + ttl : null;
    this.hit_count = 0;
    this.last_accessed = Date.now();
    this.tags = tags; // For content-based invalidation
    this.content_hash = null; // For detecting content changes
  }

  isExpired() {
    return this.expires_at && Date.now() > this.expires_at;
  }

  access() {
    this.hit_count++;
    this.last_accessed = Date.now();
  }

  updateTTL(ttl) {
    this.expires_at = ttl ? Date.now() + ttl : null;
  }
}

// In-memory cache storage
const cache = new Map();

// Cache statistics
const stats = {
  hits: 0,
  misses: 0,
  evictions: 0,
  total_saved_tokens: 0
};

// Default configuration
const config = {
  maxSize: 1000,              // Maximum number of cache entries
  defaultTTL: 24 * 60 * 60 * 1000,  // 24 hours in milliseconds
  cleanupInterval: 60 * 60 * 1000,   // 1 hour
  enableAutoCleanup: true,    // Enable automatic cleanup
  enableContentTracking: true // Enable content-based invalidation
};

// Start periodic cleanup
let cleanupTimer = null;
startPeriodicCleanup();

/**
 * Generate cache key from prompt and options
 * @param {string} prompt - LLM prompt
 * @param {Object} options - LLM options
 * @returns {string} Cache key
 */
function generateCacheKey(prompt, options = {}) {
  const normalizedOptions = {
    model: options.model || 'default',
    temperature: options.temperature || 0.7,
    max_tokens: options.max_tokens || 1000
  };

  const keyString = JSON.stringify({ prompt, options: normalizedOptions });
  return crypto.createHash('sha256').update(keyString).digest('hex');
}

/**
 * Get cached response
 * @param {string} prompt - LLM prompt
 * @param {Object} options - LLM options
 * @returns {Object|null} Cached response or null
 */
function get(prompt, options = {}) {
  const key = generateCacheKey(prompt, options);
  const entry = cache.get(key);

  if (!entry) {
    stats.misses++;
    return null;
  }

  if (entry.isExpired()) {
    cache.delete(key);
    stats.misses++;
    stats.evictions++;
    return null;
  }

  entry.access();
  stats.hits++;
  
  // Estimate saved tokens (rough estimate)
  const estimatedTokens = Math.ceil(prompt.length / 4) + 100; // Input + output estimate
  stats.total_saved_tokens += estimatedTokens;

  return entry.value;
}

/**
 * Set cache entry
 * @param {string} prompt - LLM prompt
 * @param {Object} options - LLM options
 * @param {Object} response - LLM response
 * @param {number} ttl - Time to live in milliseconds (optional)
 * @param {Array<string>} tags - Tags for content-based invalidation (optional)
 * @returns {string} Cache key
 */
function set(prompt, options = {}, response, ttl = null, tags = []) {
  const key = generateCacheKey(prompt, options);
  const effectiveTTL = ttl || config.defaultTTL;

  // Check cache size and evict if necessary
  if (cache.size >= config.maxSize) {
    evictLRU();
  }

  const entry = new CacheEntry(key, response, effectiveTTL, tags);
  
  // Calculate content hash for change detection
  if (config.enableContentTracking) {
    entry.content_hash = crypto.createHash('md5')
      .update(JSON.stringify(response))
      .digest('hex');
  }

  cache.set(key, entry);

  return key;
}

/**
 * Check if prompt is cached
 * @param {string} prompt - LLM prompt
 * @param {Object} options - LLM options
 * @returns {boolean} True if cached
 */
function has(prompt, options = {}) {
  const key = generateCacheKey(prompt, options);
  const entry = cache.get(key);
  
  if (!entry) {
    return false;
  }

  if (entry.isExpired()) {
    cache.delete(key);
    return false;
  }

  return true;
}

/**
 * Invalidate cache entry
 * @param {string} prompt - LLM prompt
 * @param {Object} options - LLM options
 * @returns {boolean} True if entry was deleted
 */
function invalidate(prompt, options = {}) {
  const key = generateCacheKey(prompt, options);
  return cache.delete(key);
}

/**
 * Invalidate cache entries by pattern
 * @param {Function} predicate - Function to test cache entries
 * @returns {number} Number of entries invalidated
 */
function invalidateBy(predicate) {
  let count = 0;

  for (const [key, entry] of cache.entries()) {
    if (predicate(entry)) {
      cache.delete(key);
      count++;
    }
  }

  stats.evictions += count;
  return count;
}

/**
 * Clear all cache entries
 * @returns {number} Number of entries cleared
 */
function clear() {
  const count = cache.size;
  cache.clear();
  
  // Reset stats for testing
  stats.hits = 0;
  stats.misses = 0;
  stats.evictions = 0;
  stats.total_saved_tokens = 0;
  
  return count;
}

/**
 * Evict least recently used entry
 */
function evictLRU() {
  let oldestEntry = null;
  let oldestKey = null;

  for (const [key, entry] of cache.entries()) {
    if (!oldestEntry || entry.last_accessed < oldestEntry.last_accessed) {
      oldestEntry = entry;
      oldestKey = key;
    }
  }

  if (oldestKey) {
    cache.delete(oldestKey);
    stats.evictions++;
  }
}

/**
 * Clean up expired entries
 * @returns {number} Number of entries cleaned
 */
function cleanup() {
  let count = 0;

  for (const [key, entry] of cache.entries()) {
    if (entry.isExpired()) {
      cache.delete(key);
      count++;
    }
  }

  if (count > 0) {
    console.log(`[LLM Cache] Cleaned up ${count} expired entries`);
    stats.evictions += count;
  }

  return count;
}

/**
 * Start periodic cleanup
 */
function startPeriodicCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }

  cleanupTimer = setInterval(() => {
    cleanup();
  }, config.cleanupInterval);
}

/**
 * Stop periodic cleanup
 */
function stopPeriodicCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/**
 * Get cache statistics
 * @returns {Object} Statistics
 */
function getStats() {
  const totalRequests = stats.hits + stats.misses;
  const hitRate = totalRequests > 0 ? (stats.hits / totalRequests * 100) : 0;

  return {
    size: cache.size,
    max_size: config.maxSize,
    hits: stats.hits,
    misses: stats.misses,
    hit_rate: Math.round(hitRate * 100) / 100,
    evictions: stats.evictions,
    total_saved_tokens: stats.total_saved_tokens,
    estimated_cost_saved: Math.round(stats.total_saved_tokens * 0.00002 * 100) / 100 // Rough estimate
  };
}

/**
 * Get cache entries info
 * @returns {Array} Cache entries info
 */
function getEntries() {
  const entries = [];

  for (const [key, entry] of cache.entries()) {
    entries.push({
      key,
      created_at: new Date(entry.created_at).toISOString(),
      expires_at: entry.expires_at ? new Date(entry.expires_at).toISOString() : null,
      hit_count: entry.hit_count,
      last_accessed: new Date(entry.last_accessed).toISOString(),
      is_expired: entry.isExpired()
    });
  }

  // Sort by hit count descending
  entries.sort((a, b) => b.hit_count - a.hit_count);

  return entries;
}

/**
 * Configure cache
 * @param {Object} options - Configuration options
 */
function configure(options = {}) {
  if (options.maxSize !== undefined) {
    config.maxSize = options.maxSize;
  }
  if (options.defaultTTL !== undefined) {
    config.defaultTTL = options.defaultTTL;
  }
  if (options.cleanupInterval !== undefined) {
    config.cleanupInterval = options.cleanupInterval;
    if (config.enableAutoCleanup) {
      startPeriodicCleanup(); // Restart with new interval
    }
  }
  if (options.enableAutoCleanup !== undefined) {
    config.enableAutoCleanup = options.enableAutoCleanup;
    if (config.enableAutoCleanup) {
      startPeriodicCleanup();
    } else {
      stopPeriodicCleanup();
    }
  }
  if (options.enableContentTracking !== undefined) {
    config.enableContentTracking = options.enableContentTracking;
  }

  console.log('[LLM Cache] Configuration updated:', config);
}

/**
 * Get cache configuration
 * @returns {Object} Configuration
 */
function getConfig() {
  return { ...config };
}

/**
 * Wrapper function to cache LLM calls
 * @param {Function} llmFunction - LLM function to call
 * @param {string} prompt - Prompt
 * @param {Object} options - Options
 * @returns {Promise<Object>} LLM response
 */
async function cachedLLMCall(llmFunction, prompt, options = {}) {
  // Check cache first
  const cached = get(prompt, options);
  if (cached) {
    console.log('[LLM Cache] Cache hit');
    return cached;
  }

  // Call LLM
  console.log('[LLM Cache] Cache miss, calling LLM');
  const response = await llmFunction(prompt, options);

  // Cache response
  set(prompt, options, response);

  return response;
}

/**
 * Invalidate cache entries by tags
 * @param {Array<string>} tags - Tags to match
 * @returns {number} Number of entries invalidated
 */
function invalidateByTags(tags) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return 0;
  }

  let count = 0;
  const tagsSet = new Set(tags);

  for (const [key, entry] of cache.entries()) {
    if (entry.tags && entry.tags.some(tag => tagsSet.has(tag))) {
      cache.delete(key);
      count++;
    }
  }

  stats.evictions += count;
  console.log(`[LLM Cache] Invalidated ${count} entries by tags:`, tags);
  return count;
}

/**
 * Invalidate cache entries older than specified age
 * @param {number} maxAge - Maximum age in milliseconds
 * @returns {number} Number of entries invalidated
 */
function invalidateOlderThan(maxAge) {
  const cutoffTime = Date.now() - maxAge;
  let count = 0;

  for (const [key, entry] of cache.entries()) {
    if (entry.created_at < cutoffTime) {
      cache.delete(key);
      count++;
    }
  }

  stats.evictions += count;
  console.log(`[LLM Cache] Invalidated ${count} entries older than ${maxAge}ms`);
  return count;
}

/**
 * Invalidate cache entries not accessed recently
 * @param {number} maxIdleTime - Maximum idle time in milliseconds
 * @returns {number} Number of entries invalidated
 */
function invalidateIdle(maxIdleTime) {
  const cutoffTime = Date.now() - maxIdleTime;
  let count = 0;

  for (const [key, entry] of cache.entries()) {
    if (entry.last_accessed < cutoffTime) {
      cache.delete(key);
      count++;
    }
  }

  stats.evictions += count;
  console.log(`[LLM Cache] Invalidated ${count} idle entries (idle > ${maxIdleTime}ms)`);
  return count;
}

/**
 * Invalidate cache entries with low hit count
 * @param {number} minHitCount - Minimum hit count threshold
 * @returns {number} Number of entries invalidated
 */
function invalidateLowHitCount(minHitCount) {
  let count = 0;

  for (const [key, entry] of cache.entries()) {
    if (entry.hit_count < minHitCount) {
      cache.delete(key);
      count++;
    }
  }

  stats.evictions += count;
  console.log(`[LLM Cache] Invalidated ${count} entries with hit count < ${minHitCount}`);
  return count;
}

/**
 * Update TTL for existing cache entries
 * @param {Function} predicate - Function to test cache entries
 * @param {number} newTTL - New TTL in milliseconds
 * @returns {number} Number of entries updated
 */
function updateTTL(predicate, newTTL) {
  let count = 0;

  for (const [key, entry] of cache.entries()) {
    if (predicate(entry)) {
      entry.updateTTL(newTTL);
      count++;
    }
  }

  console.log(`[LLM Cache] Updated TTL for ${count} entries`);
  return count;
}

/**
 * Extend TTL for frequently accessed entries
 * @param {number} minHitCount - Minimum hit count threshold
 * @param {number} extensionTime - Time to extend in milliseconds
 * @returns {number} Number of entries extended
 */
function extendHotEntries(minHitCount = 5, extensionTime = 24 * 60 * 60 * 1000) {
  return updateTTL(
    entry => entry.hit_count >= minHitCount,
    extensionTime
  );
}

/**
 * Detect and invalidate entries with content changes
 * @param {string} prompt - LLM prompt
 * @param {Object} options - LLM options
 * @param {Object} newResponse - New LLM response
 * @returns {boolean} True if content changed and cache was invalidated
 */
function detectContentChange(prompt, options, newResponse) {
  if (!config.enableContentTracking) {
    return false;
  }

  const key = generateCacheKey(prompt, options);
  const entry = cache.get(key);

  if (!entry) {
    return false;
  }

  const newHash = crypto.createHash('md5')
    .update(JSON.stringify(newResponse))
    .digest('hex');

  if (entry.content_hash !== newHash) {
    console.log('[LLM Cache] Content change detected, invalidating entry');
    cache.delete(key);
    stats.evictions++;
    return true;
  }

  return false;
}

/**
 * Get cache health metrics
 * @returns {Object} Health metrics
 */
function getHealthMetrics() {
  const stats = getStats();
  const entries = Array.from(cache.values());

  // Calculate average age
  const now = Date.now();
  const avgAge = entries.length > 0
    ? entries.reduce((sum, e) => sum + (now - e.created_at), 0) / entries.length
    : 0;

  // Calculate average hit count
  const avgHitCount = entries.length > 0
    ? entries.reduce((sum, e) => sum + e.hit_count, 0) / entries.length
    : 0;

  // Count expired entries
  const expiredCount = entries.filter(e => e.isExpired()).length;

  // Calculate memory usage estimate (rough)
  const estimatedMemoryMB = (cache.size * 2) / 1024; // Rough estimate: 2KB per entry

  return {
    ...stats,
    avg_age_ms: Math.round(avgAge),
    avg_hit_count: Math.round(avgHitCount * 100) / 100,
    expired_count: expiredCount,
    estimated_memory_mb: Math.round(estimatedMemoryMB * 100) / 100,
    health_score: calculateHealthScore(stats, expiredCount, avgHitCount)
  };
}

/**
 * Calculate cache health score (0-100)
 * @param {Object} stats - Cache statistics
 * @param {number} expiredCount - Number of expired entries
 * @param {number} avgHitCount - Average hit count
 * @returns {number} Health score
 */
function calculateHealthScore(stats, expiredCount, avgHitCount) {
  let score = 100;

  // Penalize low hit rate
  if (stats.hit_rate < 30) {
    score -= 30;
  } else if (stats.hit_rate < 50) {
    score -= 15;
  }

  // Penalize high expired count
  const expiredRatio = stats.size > 0 ? (expiredCount / stats.size) : 0;
  if (expiredRatio > 0.2) {
    score -= 20;
  } else if (expiredRatio > 0.1) {
    score -= 10;
  }

  // Penalize low average hit count
  if (avgHitCount < 1) {
    score -= 20;
  } else if (avgHitCount < 2) {
    score -= 10;
  }

  // Penalize cache near full
  const fillRatio = stats.size / stats.max_size;
  if (fillRatio > 0.9) {
    score -= 15;
  } else if (fillRatio > 0.8) {
    score -= 5;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * Optimize cache by removing low-value entries
 * @returns {Object} Optimization results
 */
function optimize() {
  const before = {
    size: cache.size,
    stats: { ...stats }
  };

  // Remove expired entries
  const expiredRemoved = cleanup();

  // Remove entries with 0 hit count that are older than 1 hour
  const lowValueRemoved = invalidateBy(entry => 
    entry.hit_count === 0 && 
    (Date.now() - entry.created_at) > 60 * 60 * 1000
  );

  // Extend TTL for hot entries
  const hotExtended = extendHotEntries(5, 48 * 60 * 60 * 1000); // 48 hours

  const after = {
    size: cache.size,
    stats: { ...stats }
  };

  const result = {
    expired_removed: expiredRemoved,
    low_value_removed: lowValueRemoved,
    hot_entries_extended: hotExtended,
    size_before: before.size,
    size_after: after.size,
    size_reduced: before.size - after.size
  };

  console.log('[LLM Cache] Optimization completed:', result);
  return result;
}

module.exports = {
  get,
  set,
  has,
  invalidate,
  invalidateBy,
  invalidateByTags,
  invalidateOlderThan,
  invalidateIdle,
  invalidateLowHitCount,
  updateTTL,
  extendHotEntries,
  detectContentChange,
  clear,
  cleanup,
  getStats,
  getHealthMetrics,
  getEntries,
  configure,
  getConfig,
  cachedLLMCall,
  optimize,
  startPeriodicCleanup,
  stopPeriodicCleanup
};
