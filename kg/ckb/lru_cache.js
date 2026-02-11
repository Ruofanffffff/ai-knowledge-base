/**
 * LRU (Least Recently Used) Cache Implementation
 * 
 * Efficient caching with automatic eviction of least recently used items
 */

class LRUCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || null; // Time to live in milliseconds
    this.cache = new Map();
    this.accessOrder = []; // Track access order for LRU
    this.timestamps = new Map(); // Track insertion time for TTL
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {*} Cached value or undefined
   */
  get(key) {
    if (!this.cache.has(key)) {
      return undefined;
    }

    // Check TTL
    if (this.ttl && this.timestamps.has(key)) {
      const age = Date.now() - this.timestamps.get(key);
      if (age > this.ttl) {
        this.delete(key);
        return undefined;
      }
    }

    // Update access order (move to end = most recently used)
    this._updateAccessOrder(key);

    return this.cache.get(key);
  }

  /**
   * Set value in cache
   * @param {string} key - Cache key
   * @param {*} value - Value to cache
   */
  set(key, value) {
    // If key exists, update it
    if (this.cache.has(key)) {
      this.cache.set(key, value);
      this.timestamps.set(key, Date.now());
      this._updateAccessOrder(key);
      return;
    }

    // If cache is full, evict least recently used
    if (this.cache.size >= this.maxSize) {
      this._evictLRU();
    }

    // Add new entry
    this.cache.set(key, value);
    this.timestamps.set(key, Date.now());
    this.accessOrder.push(key);
  }

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists
   */
  has(key) {
    if (!this.cache.has(key)) {
      return false;
    }

    // Check TTL
    if (this.ttl && this.timestamps.has(key)) {
      const age = Date.now() - this.timestamps.get(key);
      if (age > this.ttl) {
        this.delete(key);
        return false;
      }
    }

    return true;
  }

  /**
   * Delete key from cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key was deleted
   */
  delete(key) {
    if (!this.cache.has(key)) {
      return false;
    }

    this.cache.delete(key);
    this.timestamps.delete(key);
    
    // Remove from access order
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }

    return true;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.timestamps.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache size
   * @returns {number} Number of entries in cache
   */
  get size() {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    let expiredCount = 0;
    
    if (this.ttl) {
      const now = Date.now();
      for (const [key, timestamp] of this.timestamps.entries()) {
        if (now - timestamp > this.ttl) {
          expiredCount++;
        }
      }
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilizationPercent: (this.cache.size / this.maxSize) * 100,
      expiredCount,
      ttl: this.ttl,
    };
  }

  /**
   * Clean up expired entries
   * @returns {number} Number of entries cleaned up
   */
  cleanup() {
    if (!this.ttl) {
      return 0;
    }

    const now = Date.now();
    const keysToDelete = [];

    for (const [key, timestamp] of this.timestamps.entries()) {
      if (now - timestamp > this.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }

    return keysToDelete.length;
  }

  /**
   * Update access order for LRU
   * @private
   */
  _updateAccessOrder(key) {
    // Remove key from current position
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    
    // Add to end (most recently used)
    this.accessOrder.push(key);
  }

  /**
   * Evict least recently used entry
   * @private
   */
  _evictLRU() {
    if (this.accessOrder.length === 0) {
      return;
    }

    // First entry is least recently used
    const lruKey = this.accessOrder[0];
    this.delete(lruKey);
  }
}

module.exports = { LRUCache };
