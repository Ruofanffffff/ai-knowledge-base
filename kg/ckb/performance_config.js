/**
 * Performance Configuration for CKB Intelligent Chunking
 * 
 * Centralized configuration for performance optimization settings
 */

module.exports = {
  // Caching configuration
  cache: {
    // Enable/disable caching globally
    enabled: process.env.ENABLE_CKB_CACHE !== 'false',
    
    // Relevance score cache settings
    relevanceScoreCache: {
      enabled: true,
      maxSize: 10000, // Maximum number of cached scores
      ttl: 3600000, // Time to live in milliseconds (1 hour)
    },
    
    // Embedding cache settings
    embeddingCache: {
      enabled: true,
      maxSize: 5000, // Maximum number of cached embeddings
      ttl: 7200000, // Time to live in milliseconds (2 hours)
    },
    
    // Chunk cache settings
    chunkCache: {
      enabled: true,
      maxSize: 1000, // Maximum number of cached CKB chunks
      ttl: 1800000, // Time to live in milliseconds (30 minutes)
    },
  },
  
  // Parallel processing configuration
  parallel: {
    // Enable/disable parallel processing
    enabled: process.env.ENABLE_PARALLEL_PROCESSING !== 'false',
    
    // Maximum concurrent operations
    maxConcurrency: parseInt(process.env.MAX_CONCURRENCY) || 5,
    
    // Batch size for parallel operations
    batchSize: parseInt(process.env.BATCH_SIZE) || 10,
    
    // Timeout for parallel operations (ms)
    timeout: parseInt(process.env.PARALLEL_TIMEOUT) || 30000,
  },
  
  // Indexing configuration
  indexing: {
    // Enable/disable chunk indexing
    enabled: process.env.ENABLE_CHUNK_INDEXING !== 'false',
    
    // Index type: 'memory' | 'redis' | 'vector-db'
    type: process.env.INDEX_TYPE || 'memory',
    
    // Index rebuild interval (ms)
    rebuildInterval: parseInt(process.env.INDEX_REBUILD_INTERVAL) || 3600000,
    
    // Enable incremental indexing
    incremental: true,
  },
  
  // Embedding computation optimization
  embedding: {
    // Enable batch embedding computation
    batchComputation: true,
    
    // Batch size for embedding computation
    batchSize: parseInt(process.env.EMBEDDING_BATCH_SIZE) || 32,
    
    // Enable GPU acceleration (if available)
    useGPU: process.env.USE_GPU === 'true',
    
    // Embedding model cache
    modelCache: true,
  },
  
  // Performance monitoring
  monitoring: {
    // Enable performance monitoring
    enabled: process.env.ENABLE_PERFORMANCE_MONITORING !== 'false',
    
    // Log slow operations (ms threshold)
    slowOperationThreshold: parseInt(process.env.SLOW_OPERATION_THRESHOLD) || 1000,
    
    // Sample rate for performance metrics (0-1)
    sampleRate: parseFloat(process.env.PERF_SAMPLE_RATE) || 0.1,
  },
  
  // Memory management
  memory: {
    // Enable automatic memory cleanup
    autoCleanup: true,
    
    // Memory cleanup interval (ms)
    cleanupInterval: parseInt(process.env.MEMORY_CLEANUP_INTERVAL) || 300000,
    
    // Maximum memory usage (MB)
    maxMemoryMB: parseInt(process.env.MAX_MEMORY_MB) || 512,
  },
};
