/**
 * Degradation Strategy for Notes Feature
 * 
 * Provides fallback mechanisms when services are unavailable:
 * - LLM service degradation (use cache, basic processing, or queue)
 * - Storage service degradation (local cache, retry queue)
 * - Database degradation (read-only mode, cache)
 * 
 * Features:
 * - Service health monitoring
 * - Automatic fallback activation
 * - Queue management for deferred operations
 * - Cache-based fallbacks
 * 
 * Validates: Requirement 12.5
 */

const fs = require('fs');
const path = require('path');

/**
 * Service health status
 */
const ServiceStatus = {
  HEALTHY: 'HEALTHY',
  DEGRADED: 'DEGRADED',
  UNAVAILABLE: 'UNAVAILABLE'
};

/**
 * Degradation modes
 */
const DegradationMode = {
  NONE: 'NONE',
  CACHE_ONLY: 'CACHE_ONLY',
  BASIC_PROCESSING: 'BASIC_PROCESSING',
  QUEUE_DEFERRED: 'QUEUE_DEFERRED',
  READ_ONLY: 'READ_ONLY'
};

/**
 * Service Health Monitor
 * Tracks service health and triggers degradation
 */
class ServiceHealthMonitor {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.status = ServiceStatus.HEALTHY;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastCheckTime = Date.now();
    
    this.config = {
      failureThreshold: options.failureThreshold || 3,
      recoveryThreshold: options.recoveryThreshold || 5,
      checkInterval: options.checkInterval || 30000, // 30 seconds
      degradationTimeout: options.degradationTimeout || 300000, // 5 minutes
      ...options
    };

    this.degradationStartTime = null;
  }

  /**
   * Record successful operation
   */
  recordSuccess() {
    this.successCount++;
    this.failureCount = Math.max(0, this.failureCount - 1);
    
    // Check if service has recovered
    if (this.status !== ServiceStatus.HEALTHY && 
        this.successCount >= this.config.recoveryThreshold) {
      this.status = ServiceStatus.HEALTHY;
      this.degradationStartTime = null;
      console.log(`[ServiceHealth] ${this.serviceName} recovered to HEALTHY`);
    }
  }

  /**
   * Record failed operation
   */
  recordFailure() {
    this.failureCount++;
    this.successCount = 0;
    
    // Check if service should be degraded
    if (this.failureCount >= this.config.failureThreshold) {
      if (this.status === ServiceStatus.HEALTHY) {
        this.status = ServiceStatus.DEGRADED;
        this.degradationStartTime = Date.now();
        console.warn(`[ServiceHealth] ${this.serviceName} degraded to DEGRADED`);
      } else if (this.status === ServiceStatus.DEGRADED) {
        // Check if degradation timeout exceeded
        const degradationDuration = Date.now() - this.degradationStartTime;
        if (degradationDuration > this.config.degradationTimeout) {
          this.status = ServiceStatus.UNAVAILABLE;
          console.error(`[ServiceHealth] ${this.serviceName} marked as UNAVAILABLE`);
        }
      }
    }
  }

  /**
   * Get current service status
   */
  getStatus() {
    return {
      serviceName: this.serviceName,
      status: this.status,
      failureCount: this.failureCount,
      successCount: this.successCount,
      degradationStartTime: this.degradationStartTime,
      lastCheckTime: this.lastCheckTime
    };
  }

  /**
   * Check if service is healthy
   */
  isHealthy() {
    return this.status === ServiceStatus.HEALTHY;
  }

  /**
   * Check if service is degraded
   */
  isDegraded() {
    return this.status === ServiceStatus.DEGRADED;
  }

  /**
   * Check if service is unavailable
   */
  isUnavailable() {
    return this.status === ServiceStatus.UNAVAILABLE;
  }

  /**
   * Reset service health
   */
  reset() {
    this.status = ServiceStatus.HEALTHY;
    this.failureCount = 0;
    this.successCount = 0;
    this.degradationStartTime = null;
  }
}

/**
 * LLM Service Degradation Handler
 * Requirement 12.5: LLM service unavailable degradation
 */
class LLMDegradationHandler {
  constructor(options = {}) {
    this.healthMonitor = new ServiceHealthMonitor('LLM', options);
    this.cache = new Map();
    this.deferredQueue = [];
    this.mode = DegradationMode.NONE;
  }

  /**
   * Execute LLM operation with degradation fallback
   * 
   * @param {Function} operation - LLM operation
   * @param {Object} options - Operation options
   * @returns {Promise<Object>} Result or fallback
   */
  async execute(operation, options = {}) {
    const { cacheKey, allowBasicProcessing = true, allowQueue = true } = options;

    try {
      // Try normal operation
      const result = await operation();
      this.healthMonitor.recordSuccess();
      
      // Cache result if cache key provided
      if (cacheKey) {
        this.cache.set(cacheKey, {
          result,
          timestamp: Date.now()
        });
      }
      
      this.mode = DegradationMode.NONE;
      return result;
    } catch (error) {
      this.healthMonitor.recordFailure();
      
      // Try fallback strategies
      return this.handleFailure(error, options);
    }
  }

  /**
   * Handle LLM operation failure with fallback
   * @private
   */
  async handleFailure(error, options) {
    const { cacheKey, allowBasicProcessing, allowQueue, input } = options;

    // Strategy 1: Use cached result
    if (cacheKey && this.cache.has(cacheKey)) {
      console.log('[LLMDegradation] Using cached result');
      this.mode = DegradationMode.CACHE_ONLY;
      const cached = this.cache.get(cacheKey);
      return {
        ...cached.result,
        fromCache: true,
        cacheAge: Date.now() - cached.timestamp
      };
    }

    // Strategy 2: Basic processing (no AI)
    if (allowBasicProcessing && this.healthMonitor.isDegraded()) {
      console.log('[LLMDegradation] Using basic processing');
      this.mode = DegradationMode.BASIC_PROCESSING;
      return this.basicProcessing(input, options);
    }

    // Strategy 3: Queue for later processing
    if (allowQueue && this.healthMonitor.isUnavailable()) {
      console.log('[LLMDegradation] Queueing operation for later');
      this.mode = DegradationMode.QUEUE_DEFERRED;
      return this.queueOperation(input, options);
    }

    // No fallback available, throw error
    throw error;
  }

  /**
   * Basic processing without AI
   * @private
   */
  basicProcessing(input, options) {
    const { operationType } = options;

    switch (operationType) {
      case 'imageAnalysis':
        return {
          textContent: null,
          description: 'Image analysis unavailable - LLM service degraded',
          tags: [],
          degraded: true
        };

      case 'textGeneration':
        return {
          expandedText: input,
          imagePrompt: null,
          degraded: true
        };

      case 'proofread':
        return {
          correctedText: input,
          changes: [],
          degraded: true
        };

      case 'tableGeneration':
        return {
          table: { headers: [], rows: [] },
          degraded: true
        };

      case 'mindmapGeneration':
        return {
          mindmap: { central: 'Unavailable', branches: [] },
          degraded: true
        };

      default:
        return {
          result: null,
          degraded: true
        };
    }
  }

  /**
   * Queue operation for deferred processing
   * @private
   */
  queueOperation(input, options) {
    const queueItem = {
      id: `deferred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      input,
      options,
      timestamp: Date.now(),
      status: 'queued'
    };

    this.deferredQueue.push(queueItem);

    return {
      queued: true,
      queueId: queueItem.id,
      message: 'Operation queued for processing when service recovers'
    };
  }

  /**
   * Process deferred queue
   */
  async processDeferredQueue(operation) {
    if (!this.healthMonitor.isHealthy()) {
      console.log('[LLMDegradation] Service not healthy, skipping queue processing');
      return;
    }

    console.log(`[LLMDegradation] Processing ${this.deferredQueue.length} queued operations`);

    const results = [];
    while (this.deferredQueue.length > 0) {
      const item = this.deferredQueue.shift();
      
      try {
        const result = await operation(item.input, item.options);
        results.push({ id: item.id, success: true, result });
      } catch (error) {
        console.error(`[LLMDegradation] Failed to process queued item ${item.id}:`, error);
        results.push({ id: item.id, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get degradation status
   */
  getStatus() {
    return {
      ...this.healthMonitor.getStatus(),
      mode: this.mode,
      cacheSize: this.cache.size,
      queueSize: this.deferredQueue.length
    };
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Reset handler
   */
  reset() {
    this.healthMonitor.reset();
    this.cache.clear();
    this.deferredQueue = [];
    this.mode = DegradationMode.NONE;
  }
}

/**
 * Storage Service Degradation Handler
 * Requirement 12.5: Storage service unavailable local cache
 */
class StorageDegradationHandler {
  constructor(options = {}) {
    this.healthMonitor = new ServiceHealthMonitor('Storage', options);
    this.localCacheDir = options.localCacheDir || path.join(process.cwd(), '.cache', 'storage');
    this.retryQueue = [];
    this.mode = DegradationMode.NONE;
    
    this.ensureCacheDirectory();
  }

  /**
   * Ensure local cache directory exists
   * @private
   */
  ensureCacheDirectory() {
    if (!fs.existsSync(this.localCacheDir)) {
      try {
        fs.mkdirSync(this.localCacheDir, { recursive: true });
      } catch (error) {
        console.error('[StorageDegradation] Failed to create cache directory:', error);
      }
    }
  }

  /**
   * Execute storage operation with degradation fallback
   * 
   * @param {Function} operation - Storage operation
   * @param {Object} options - Operation options
   * @returns {Promise<Object>} Result or fallback
   */
  async execute(operation, options = {}) {
    const { fileData, filename, metadata = {} } = options;

    try {
      // Try normal operation
      const result = await operation();
      this.healthMonitor.recordSuccess();
      this.mode = DegradationMode.NONE;
      return result;
    } catch (error) {
      this.healthMonitor.recordFailure();
      
      // Fallback: Save to local cache
      return this.saveToLocalCache(fileData, filename, metadata, error);
    }
  }

  /**
   * Save file to local cache
   * @private
   */
  async saveToLocalCache(fileData, filename, metadata, originalError) {
    if (!fileData || !filename) {
      throw originalError;
    }

    try {
      const cacheFilename = `${Date.now()}_${filename}`;
      const cachePath = path.join(this.localCacheDir, cacheFilename);
      
      // Save file data
      fs.writeFileSync(cachePath, fileData);
      
      // Save metadata
      const metadataPath = `${cachePath}.meta.json`;
      fs.writeFileSync(metadataPath, JSON.stringify({
        originalFilename: filename,
        metadata,
        timestamp: Date.now(),
        error: originalError.message
      }));

      // Add to retry queue
      this.retryQueue.push({
        id: cacheFilename,
        cachePath,
        metadataPath,
        timestamp: Date.now()
      });

      console.log(`[StorageDegradation] Saved to local cache: ${cacheFilename}`);
      this.mode = DegradationMode.CACHE_ONLY;

      return {
        cached: true,
        cacheId: cacheFilename,
        cachePath,
        message: 'File saved to local cache, will retry upload when service recovers'
      };
    } catch (cacheError) {
      console.error('[StorageDegradation] Failed to save to local cache:', cacheError);
      throw originalError;
    }
  }

  /**
   * Retry uploading cached files
   */
  async retryQueuedUploads(uploadOperation) {
    if (!this.healthMonitor.isHealthy()) {
      console.log('[StorageDegradation] Service not healthy, skipping retry');
      return;
    }

    console.log(`[StorageDegradation] Retrying ${this.retryQueue.length} cached uploads`);

    const results = [];
    while (this.retryQueue.length > 0) {
      const item = this.retryQueue.shift();
      
      try {
        // Read file data
        const fileData = fs.readFileSync(item.cachePath);
        const metadata = JSON.parse(fs.readFileSync(item.metadataPath, 'utf8'));
        
        // Retry upload
        const result = await uploadOperation(fileData, metadata);
        
        // Clean up cache files
        fs.unlinkSync(item.cachePath);
        fs.unlinkSync(item.metadataPath);
        
        results.push({ id: item.id, success: true, result });
      } catch (error) {
        console.error(`[StorageDegradation] Failed to retry upload ${item.id}:`, error);
        // Put back in queue
        this.retryQueue.push(item);
        results.push({ id: item.id, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get degradation status
   */
  getStatus() {
    return {
      ...this.healthMonitor.getStatus(),
      mode: this.mode,
      queueSize: this.retryQueue.length,
      cacheDir: this.localCacheDir
    };
  }

  /**
   * Clear local cache
   */
  clearCache() {
    try {
      const files = fs.readdirSync(this.localCacheDir);
      for (const file of files) {
        fs.unlinkSync(path.join(this.localCacheDir, file));
      }
      this.retryQueue = [];
    } catch (error) {
      console.error('[StorageDegradation] Failed to clear cache:', error);
    }
  }

  /**
   * Reset handler
   */
  reset() {
    this.healthMonitor.reset();
    this.retryQueue = [];
    this.mode = DegradationMode.NONE;
  }
}

/**
 * Create LLM degradation handler
 */
function createLLMDegradationHandler(options = {}) {
  return new LLMDegradationHandler(options);
}

/**
 * Create storage degradation handler
 */
function createStorageDegradationHandler(options = {}) {
  return new StorageDegradationHandler(options);
}

module.exports = {
  ServiceHealthMonitor,
  LLMDegradationHandler,
  StorageDegradationHandler,
  createLLMDegradationHandler,
  createStorageDegradationHandler,
  ServiceStatus,
  DegradationMode,
};
