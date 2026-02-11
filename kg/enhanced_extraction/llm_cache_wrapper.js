/**
 * LLM Cache Wrapper for Enhanced Entity Extraction
 * 
 * Wraps the existing llm_cache module to provide caching for LLM calls
 * in the enhanced extraction system.
 * 
 * Requirements: 5.1
 */

const llmCache = require('../utils/llm_cache');

class LLMCacheWrapper {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      ttl: config.ttl || 24 * 60 * 60 * 1000, // 24 hours default
      maxSize: config.maxSize || 1000,
      ...config
    };

    // Configure underlying cache
    if (this.config.enabled) {
      llmCache.configure({
        defaultTTL: this.config.ttl,
        maxSize: this.config.maxSize,
        enableAutoCleanup: true,
        enableContentTracking: true
      });
    }
  }

  /**
   * Get cached LLM response
   * @param {string} prompt - LLM prompt
   * @param {Object} options - LLM options
   * @returns {Object|null} Cached response or null
   */
  get(prompt, options = {}) {
    if (!this.config.enabled) {
      return null;
    }

    return llmCache.get(prompt, options);
  }

  /**
   * Set cached LLM response
   * @param {string} prompt - LLM prompt
   * @param {Object} options - LLM options
   * @param {Object} response - LLM response
   * @param {Array<string>} tags - Tags for content-based invalidation
   * @returns {string} Cache key
   */
  set(prompt, options = {}, response, tags = []) {
    if (!this.config.enabled) {
      return null;
    }

    return llmCache.set(prompt, options, response, this.config.ttl, tags);
  }

  /**
   * Check if prompt is cached
   * @param {string} prompt - LLM prompt
   * @param {Object} options - LLM options
   * @returns {boolean}
   */
  has(prompt, options = {}) {
    if (!this.config.enabled) {
      return false;
    }

    return llmCache.has(prompt, options);
  }

  /**
   * Invalidate cache entry
   * @param {string} prompt - LLM prompt
   * @param {Object} options - LLM options
   * @returns {boolean}
   */
  invalidate(prompt, options = {}) {
    if (!this.config.enabled) {
      return false;
    }

    return llmCache.invalidate(prompt, options);
  }

  /**
   * Invalidate cache entries by tags
   * @param {Array<string>} tags - Tags to match
   * @returns {number} Number of entries invalidated
   */
  invalidateByTags(tags) {
    if (!this.config.enabled) {
      return 0;
    }

    return llmCache.invalidateByTags(tags);
  }

  /**
   * Clear all cache entries
   * @returns {number} Number of entries cleared
   */
  clear() {
    return llmCache.clear();
  }

  /**
   * Get cache statistics
   * @returns {Object}
   */
  getStats() {
    return llmCache.getStats();
  }

  /**
   * Get cache health metrics
   * @returns {Object}
   */
  getHealthMetrics() {
    return llmCache.getHealthMetrics();
  }

  /**
   * Optimize cache by removing low-value entries
   * @returns {Object}
   */
  optimize() {
    if (!this.config.enabled) {
      return { message: 'Cache is disabled' };
    }

    return llmCache.optimize();
  }

  /**
   * Wrapper function to cache LLM calls
   * @param {Function} llmFunction - LLM function to call
   * @param {string} prompt - Prompt
   * @param {Object} options - Options
   * @param {Array<string>} tags - Tags for caching
   * @returns {Promise<Object>} LLM response
   */
  async cachedCall(llmFunction, prompt, options = {}, tags = []) {
    if (!this.config.enabled) {
      return await llmFunction(prompt, options);
    }

    // Check cache first
    const cached = this.get(prompt, options);
    if (cached) {
      console.log('[LLMCacheWrapper] Cache hit');
      return {
        ...cached,
        _cached: true
      };
    }

    // Call LLM
    console.log('[LLMCacheWrapper] Cache miss, calling LLM');
    const response = await llmFunction(prompt, options);

    // Cache response
    this.set(prompt, options, response, tags);

    return {
      ...response,
      _cached: false
    };
  }

  /**
   * Enable cache
   */
  enable() {
    this.config.enabled = true;
  }

  /**
   * Disable cache
   */
  disable() {
    this.config.enabled = false;
  }

  /**
   * Check if cache is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.config.enabled;
  }
}

/**
 * Create cache wrapper instance
 * @param {Object} config - Cache configuration
 * @returns {LLMCacheWrapper}
 */
function createCacheWrapper(config = {}) {
  return new LLMCacheWrapper(config);
}

module.exports = {
  LLMCacheWrapper,
  createCacheWrapper
};
