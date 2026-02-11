/**
 * Anchor-Driven Entity Synthesis Configuration - Staging Environment
 * 
 * This configuration is optimized for staging/testing with:
 * - Production-like settings
 * - Moderate logging for validation
 * - All features enabled for testing
 * - Performance monitoring enabled
 */

module.exports = {
  // Environment
  environment: 'staging',
  
  // Feature Flags
  features: {
    // Enable anchor-driven entity synthesis
    anchorModeEnabled: true,
    
    // Compatibility mode: 'ANCHOR_ONLY', 'HYBRID', 'LEGACY'
    compatibilityMode: 'ANCHOR_ONLY',
    
    // Enable conflict detection
    conflictDetectionEnabled: true,
    
    // Enable LLM advisory for conflicts (optional, costs tokens)
    llmAdvisoryEnabled: false, // Disabled by default to save costs
    
    // Enable anchor fingerprint caching
    cachingEnabled: true,
    
    // Enable detailed metrics collection
    metricsEnabled: true,
    
    // Enable performance profiling
    profilingEnabled: true
  },
  
  // Anchor Generation Configuration
  anchorGeneration: {
    // Cache configuration
    cache: {
      enabled: true,
      maxSize: 50000, // Larger cache for staging
      ttl: 7200000 // 2 hours in milliseconds
    },
    
    // Field normalization strategies
    normalization: {
      strategies: ['time_month', 'time_year', 'time_day', 'location', 'indicator', 'lowercase'],
      customRules: {}
    },
    
    // Performance constraints (production targets)
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
      logConflicts: true, // Keep logging for validation
      conflictResolution: 'prefer_first'
    },
    
    // Performance constraints (production targets)
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
    enabled: false, // Disabled by default in staging
    
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
      minSeverity: 'high',
      minConfidence: 0.7
    },
    
    // Fallback behavior
    fallback: {
      useRuleBased: true,
      defaultRecommendation: 'review'
    },
    
    // Rate limiting
    rateLimit: {
      maxCallsPerMinute: 30,
      maxCallsPerHour: 500
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
      maxOverheadPercent: 5, // Production target
      warnOverheadPercent: 3
    }
  },
  
  // Logging Configuration
  logging: {
    // Log level: 'debug', 'info', 'warn', 'error'
    level: 'info',
    
    // Enable detailed logging
    detailed: true,
    
    // Log anchor generation
    logAnchorGeneration: false, // Reduce noise
    
    // Log merging operations
    logMerging: false, // Reduce noise
    
    // Log conflicts
    logConflicts: true, // Keep for validation
    
    // Log LLM calls
    logLLMCalls: true,
    
    // Log performance metrics
    logPerformance: true
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
      'throughput'
    ],
    
    // Metrics export interval (ms)
    exportInterval: 30000 // 30 seconds
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
      cacheQueries: true
    }
  },
  
  // Staging-Specific Settings
  staging: {
    // Enable validation mode
    validationMode: true,
    
    // Enable data integrity checks
    dataIntegrityChecks: true,
    
    // Enable performance benchmarking
    performanceBenchmarking: true,
    
    // Enable detailed error reporting
    detailedErrors: true,
    
    // Test data configuration
    testData: {
      enabled: true,
      sampleSize: 100
    }
  }
};
