/**
 * Anchor-Driven Entity Synthesis Configuration - Production Environment
 * 
 * This configuration is optimized for production with:
 * - Minimal logging (warn/error only)
 * - Strict performance constraints
 * - Conservative feature flags
 * - Production-grade monitoring
 */

module.exports = {
  // Environment
  environment: 'production',
  
  // Feature Flags
  features: {
    // Enable anchor-driven entity synthesis
    anchorModeEnabled: true,
    
    // Compatibility mode: 'ANCHOR_ONLY', 'HYBRID', 'LEGACY'
    // Start with ANCHOR_ONLY after successful staging validation
    compatibilityMode: 'ANCHOR_ONLY',
    
    // Enable conflict detection
    conflictDetectionEnabled: true,
    
    // Enable LLM advisory for conflicts (optional, costs tokens)
    // Disabled by default to minimize costs - enable only if needed
    llmAdvisoryEnabled: false,
    
    // Enable anchor fingerprint caching
    cachingEnabled: true,
    
    // Enable metrics collection
    metricsEnabled: true,
    
    // Disable performance profiling in production
    profilingEnabled: false
  },
  
  // Anchor Generation Configuration
  anchorGeneration: {
    // Cache configuration
    cache: {
      enabled: true,
      maxSize: 100000, // Large cache for production
      ttl: 14400000 // 4 hours in milliseconds
    },
    
    // Field normalization strategies
    normalization: {
      strategies: ['time_month', 'time_year', 'time_day', 'location', 'indicator', 'lowercase'],
      customRules: {}
    },
    
    // Performance constraints (strict production targets)
    performance: {
      maxTimePerInstance: 10, // ms (production target)
      warnTimePerInstance: 5 // ms
    }
  },
  
  // Anchor Merging Configuration
  anchorMerging: {
    // Confidence calculation
    confidence: {
      baseWeight: 0.7,
      multiSchemaBonus: 0.05,
      maxConfidence: 0.99
    },
    
    // Field merging strategy
    fieldMerging: {
      strategy: 'highest_confidence',
      logConflicts: false, // Disable verbose logging in production
      conflictResolution: 'prefer_first'
    },
    
    // Performance constraints (strict production targets)
    performance: {
      maxTimeFor1000Instances: 100, // ms (production target)
      warnTimeFor1000Instances: 50 // ms
    }
  },
  
  // Conflict Detection Configuration
  conflictDetection: {
    // Enable different conflict types
    checks: {
      timeConsistency: true,
      valueConflicts: true,
      stateContradictions: true
    },
    
    // Thresholds
    thresholds: {
      valueConflictPercent: 10,
      highSeverityPercent: 50
    },
    
    // Conflict handling
    handling: {
      autoMergeNoConflict: true,
      autoMergeLowSeverity: true,
      requireReviewHighSeverity: true
    }
  },
  
  // LLM Advisory Configuration
  llmAdvisory: {
    // Enable LLM advisory (costs tokens)
    // Disabled by default - enable only if conflict rate is high
    enabled: false,
    
    // LLM provider configuration
    provider: {
      name: 'qwen',
      apiKey: process.env.QWEN_API_KEY,
      model: 'qwen-turbo',
      temperature: 0.2,
      maxTokens: 400
    },
    
    // Advisory thresholds
    thresholds: {
      minSeverity: 'high', // Only use LLM for high severity
      minConfidence: 0.8 // Higher confidence threshold in production
    },
    
    // Fallback behavior
    fallback: {
      useRuleBased: true,
      defaultRecommendation: 'review'
    },
    
    // Rate limiting (conservative)
    rateLimit: {
      maxCallsPerMinute: 20,
      maxCallsPerHour: 300
    }
  },
  
  // Pipeline Integration Configuration
  pipeline: {
    // Entity building mode
    entityBuilding: {
      useAnchor: true,
      compatibilityMode: 'ANCHOR_ONLY',
      detectConflicts: true,
      useLLM: false
    },
    
    // Pipeline performance
    performance: {
      maxOverheadPercent: 5, // Strict production target
      warnOverheadPercent: 3
    }
  },
  
  // Logging Configuration
  logging: {
    // Log level: 'debug', 'info', 'warn', 'error'
    level: 'warn', // Only warnings and errors in production
    
    // Disable detailed logging
    detailed: false,
    
    // Disable verbose logging
    logAnchorGeneration: false,
    logMerging: false,
    logConflicts: false, // Only log via metrics
    logLLMCalls: true, // Keep for cost tracking
    logPerformance: false // Use metrics instead
  },
  
  // Monitoring Configuration
  monitoring: {
    // Enable metrics collection
    enabled: true,
    
    // Metrics to collect
    metrics: [
      'anchor_generation_time',
      'merge_processing_time',
      'conflict_detection_count',
      'llm_advisory_calls',
      'entity_count_by_type',
      'schema_overlap_stats',
      'error_rate',
      'throughput',
      'memory_usage',
      'cpu_usage'
    ],
    
    // Metrics export interval (ms)
    exportInterval: 60000, // 1 minute
    
    // Alert thresholds
    alerts: {
      anchorGenerationTime: 50, // ms
      mergeProcessingTime: 500, // ms per 1000 instances
      errorRate: 0.01, // 1%
      memoryUsage: 0.8, // 80%
      cpuUsage: 0.8 // 80%
    }
  },
  
  // Database Configuration
  database: {
    // Use anchor fields
    useAnchorFields: true,
    
    // Index configuration
    indexes: {
      anchorFingerprint: true,
      typeAndAnchor: true
    },
    
    // Query optimization
    optimization: {
      useIndexes: true,
      cacheQueries: true,
      connectionPoolSize: 20
    }
  },
  
  // Production-Specific Settings
  production: {
    // Strict mode
    strictMode: true,
    
    // Enable graceful degradation
    gracefulDegradation: true,
    
    // Enable circuit breaker
    circuitBreaker: {
      enabled: true,
      threshold: 0.5, // 50% error rate
      timeout: 60000, // 1 minute
      resetTimeout: 300000 // 5 minutes
    },
    
    // Enable health checks
    healthChecks: {
      enabled: true,
      interval: 30000, // 30 seconds
      timeout: 5000 // 5 seconds
    },
    
    // Disable test data
    testData: {
      enabled: false
    },
    
    // Security settings
    security: {
      validateInput: true,
      sanitizeOutput: true,
      rateLimiting: true
    }
  }
};
