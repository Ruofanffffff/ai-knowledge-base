/**
 * Mapping Cache - Field Name Mapping Cache Management
 * 
 * Manages caching of field name mappings to avoid redundant LLM calls.
 * Supports in-memory cache, optional persistence, and learning from LLM results.
 * 
 * Design Reference: Phase 2 - Field Normalization Module (Section 4.5)
 * Validates: Requirements 18.8
 * 
 * Key Features:
 * - In-memory cache for fast access
 * - Optional persistent cache (file-based)
 * - Cache statistics and monitoring
 * - Learning from high-confidence LLM mappings
 * - Cache invalidation strategies
 */

const fs = require('fs');
const path = require('path');
const synonymDict = require('./synonym_dict');

/**
 * Mapping Cache Manager
 */
class MappingCache {
  constructor(options = {}) {
    const {
      enablePersistence = false,
      persistencePath = path.join(__dirname, '.cache', 'mapping_cache.json'),
      maxSize = 10000,
      ttl = 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      learnFromLLM = true,
      llmConfidenceThreshold = 0.9
    } = options;
    
    this.cache = new Map();
    this.enablePersistence = enablePersistence;
    this.persistencePath = persistencePath;
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.learnFromLLM = learnFromLLM;
    this.llmConfidenceThreshold = llmConfidenceThreshold;
    
    // Statistics
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      learned: 0
    };
    
    // Load persistent cache if enabled
    if (this.enablePersistence) {
      this.loadFromDisk();
    }
  }
  
  /**
   * Generate cache key
   * 
   * @param {string} rawFieldName - Raw field name
   * @param {string} schemaName - Schema name
   * @returns {string} Cache key
   */
  _generateKey(rawFieldName, schemaName) {
    return `${schemaName}:${rawFieldName}`;
  }
  
  /**
   * Get mapping from cache
   * 
   * @param {string} rawFieldName - Raw field name
   * @param {string} schemaName - Schema name
   * @returns {Object|null} Cached mapping or null
   */
  get(rawFieldName, schemaName) {
    const key = this._generateKey(rawFieldName, schemaName);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check TTL
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      // Expired
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    return entry.mapping;
  }
  
  /**
   * Set mapping in cache
   * 
   * @param {string} rawFieldName - Raw field name
   * @param {string} schemaName - Schema name
   * @param {Object} mapping - Mapping result
   */
  set(rawFieldName, schemaName, mapping) {
    const key = this._generateKey(rawFieldName, schemaName);
    
    // Check cache size limit
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      // Evict oldest entry (LRU)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
    
    // Store mapping with timestamp
    this.cache.set(key, {
      mapping: mapping,
      timestamp: Date.now()
    });
    
    this.stats.sets++;
    
    // Learn from high-confidence LLM mappings
    if (this.learnFromLLM && 
        mapping && 
        mapping.method === 'llm' && 
        mapping.confidence >= this.llmConfidenceThreshold) {
      this._learnFromLLM(rawFieldName, mapping.mapped_name, mapping.confidence);
    }
    
    // Persist if enabled
    if (this.enablePersistence) {
      this._schedulePersistence();
    }
  }
  
  /**
   * Learn from high-confidence LLM mapping
   * 
   * Adds the mapping to the synonym dictionary for future use.
   * 
   * @param {string} rawFieldName - Raw field name
   * @param {string} mappedFieldName - Mapped field name
   * @param {number} confidence - Mapping confidence
   */
  _learnFromLLM(rawFieldName, mappedFieldName, confidence) {
    try {
      // Add to synonym dictionary
      synonymDict.addSynonym(mappedFieldName, rawFieldName);
      this.stats.learned++;
      
      console.log(`[MappingCache] Learned synonym: ${rawFieldName} → ${mappedFieldName} (confidence: ${confidence.toFixed(2)})`);
    } catch (error) {
      console.error('[MappingCache] Error learning from LLM:', error);
    }
  }
  
  /**
   * Check if mapping exists in cache
   * 
   * @param {string} rawFieldName - Raw field name
   * @param {string} schemaName - Schema name
   * @returns {boolean} True if exists and not expired
   */
  has(rawFieldName, schemaName) {
    return this.get(rawFieldName, schemaName) !== null;
  }
  
  /**
   * Delete mapping from cache
   * 
   * @param {string} rawFieldName - Raw field name
   * @param {string} schemaName - Schema name
   * @returns {boolean} True if deleted
   */
  delete(rawFieldName, schemaName) {
    const key = this._generateKey(rawFieldName, schemaName);
    return this.cache.delete(key);
  }
  
  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0,
      learned: 0
    };
    
    if (this.enablePersistence) {
      this._deletePersistentCache();
    }
  }
  
  /**
   * Get cache size
   * 
   * @returns {number} Number of entries
   */
  size() {
    return this.cache.size;
  }
  
  /**
   * Get cache statistics
   * 
   * @returns {Object} Statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;
    
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: hitRate,
      maxSize: this.maxSize
    };
  }
  
  /**
   * Invalidate expired entries
   * 
   * @returns {number} Number of invalidated entries
   */
  invalidateExpired() {
    if (this.ttl <= 0) {
      return 0;
    }
    
    let invalidated = 0;
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        invalidated++;
      }
    }
    
    return invalidated;
  }
  
  /**
   * Load cache from disk
   */
  loadFromDisk() {
    try {
      if (fs.existsSync(this.persistencePath)) {
        const data = fs.readFileSync(this.persistencePath, 'utf-8');
        const entries = JSON.parse(data);
        
        // Restore cache entries
        for (const [key, entry] of Object.entries(entries)) {
          this.cache.set(key, entry);
        }
        
        console.log(`[MappingCache] Loaded ${this.cache.size} entries from disk`);
      }
    } catch (error) {
      console.error('[MappingCache] Error loading cache from disk:', error);
    }
  }
  
  /**
   * Save cache to disk
   */
  saveToDisk() {
    try {
      // Ensure directory exists
      const dir = path.dirname(this.persistencePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Convert Map to object for JSON serialization
      const entries = Object.fromEntries(this.cache.entries());
      
      // Write to disk
      fs.writeFileSync(
        this.persistencePath,
        JSON.stringify(entries, null, 2),
        'utf-8'
      );
      
      console.log(`[MappingCache] Saved ${this.cache.size} entries to disk`);
    } catch (error) {
      console.error('[MappingCache] Error saving cache to disk:', error);
    }
  }
  
  /**
   * Schedule persistence (debounced)
   */
  _schedulePersistence() {
    // Clear existing timeout
    if (this._persistenceTimeout) {
      clearTimeout(this._persistenceTimeout);
    }
    
    // Schedule save after 5 seconds of inactivity
    this._persistenceTimeout = setTimeout(() => {
      this.saveToDisk();
    }, 5000);
  }
  
  /**
   * Delete persistent cache file
   */
  _deletePersistentCache() {
    try {
      if (fs.existsSync(this.persistencePath)) {
        fs.unlinkSync(this.persistencePath);
        console.log('[MappingCache] Deleted persistent cache file');
      }
    } catch (error) {
      console.error('[MappingCache] Error deleting persistent cache:', error);
    }
  }
  
  /**
   * Export cache entries
   * 
   * @returns {Array} Array of cache entries
   */
  export() {
    const entries = [];
    
    for (const [key, entry] of this.cache.entries()) {
      const [schemaName, rawFieldName] = key.split(':');
      entries.push({
        schemaName,
        rawFieldName,
        mapping: entry.mapping,
        timestamp: entry.timestamp,
        age: Date.now() - entry.timestamp
      });
    }
    
    return entries;
  }
  
  /**
   * Import cache entries
   * 
   * @param {Array} entries - Array of cache entries
   * @returns {number} Number of imported entries
   */
  import(entries) {
    let imported = 0;
    
    for (const entry of entries) {
      if (entry.schemaName && entry.rawFieldName && entry.mapping) {
        this.set(entry.rawFieldName, entry.schemaName, entry.mapping);
        imported++;
      }
    }
    
    return imported;
  }
}

// Global cache instance
let globalCache = null;

/**
 * Get global cache instance
 * 
 * @param {Object} options - Cache options
 * @returns {MappingCache} Cache instance
 */
function getGlobalCache(options = {}) {
  if (!globalCache) {
    globalCache = new MappingCache(options);
  }
  return globalCache;
}

/**
 * Reset global cache instance
 */
function resetGlobalCache() {
  if (globalCache) {
    globalCache.clear();
  }
  globalCache = null;
}

module.exports = {
  MappingCache,
  getGlobalCache,
  resetGlobalCache
};
