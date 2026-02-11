/**
 * Anchor-Driven Entity Synthesis Configuration - Development Environment
 * 
 * This configuration is optimized for development with:
 * - Verbose logging for debugging
 * - All features enabled for testing
 * - Relaxed performance constraints
 * - Enhanced error reporting
 */

module.exports = {
  // Environment
  environment: 'development',
  
  // Feature Flags
  features: {
    // Enable anchor-driven entity synthesis
    anchorModeEnabled: true,
    
    // Compatibility mode: 'ANCHOR_ONLY', 'HYBRID', 'LEGACY'
    compatibilityMode: 'ANCHOR_ONLY',
    
    // Enable conflict detection
    conflictDetectionEnabled: true,
    
    // Enable LLM advisory for conflicts (optional, costs tokens)
    llmAdvisoryEnabled: false,
    
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
      maxSize: 10000, // Maximum number of cached fingerprints
      ttl: 3600000 // 1 hour in milliseconds
    },
    
    // Field normalization strategies
    normalization: {
      // Available strategies: time_month, time_year, time_day, location, indicator, lowercase, default
      strategies: ['time_month', 'time_year', 'time_day', 'location', 'indicator', 'lowercase'],
      
      // Custom normalization rules (optional)
      customRules: {}
    },
    
    // Performance constraints (relaxed for development)
    performance: {
      maxTimePerInstance: 100, // ms (relaxed from 10ms target)
      warnTimePerInstance: 50 // ms
    }
  },
  
  // Anchor Merging Configuration
  anchorMerging: {
    // Confidence calculation
    confidence: {
      // Base confidence from schema matching
      baseWeight: 0.7,
      
      // Bonus for multiple schema support
      multiSchemaBonus: 0.05, // per additional schema (max 3)
      
      // Maximum confidence cap
      maxConfidence: 0.99
    },
    
    // Field merging strategy
    fieldMerging: {
      // Strategy: 'highest_confidence', 'most_recent', 'merge_all'
      strategy: 'highest_confidence',
      
      // Log conflicts for debugging
      logConflicts: true,
      
      // Conflict resolution
      conflictResolution: 'prefer_first' // 'prefer_first', 'prefer_last', 'manual'
    },
    
    // Performance constraints (relaxed for development)
    performance: {
      maxTimeFor1000Instances: 500, // ms (relaxed from 100ms target)
      warnTimeFor1000Instances: 200 // ms
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
      // Value conflict threshold (percentage difference)
      valueConflictPercent: 10,
      
      // High severity threshold
      highSeverityPercent: 50
    },
    
    // Conflict handling
    handling: {
      // Auto-merge if no conflicts
      autoMergeNoConflict: true,
      
      // Auto-merge low severity conflicts
      autoMergeLowSeverity: true,
      
      // Require review for high severity
      requireReviewHighSeverity: true
    }
  },
  
  // LLM Advisory Configuration
  llmAdvisory: {
    // Enable LLM advisory (costs tokens)
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
      // Only use LLM for high severity conflicts
      minSeverity: 'high',
      
      // Minimum confidence to trust LLM suggestion
      minConfidence: 0.7
    },
    
    // Fallback behavior
    fallback: {
      // If LLM fails, use rule-based decision
      useRuleBased: true,
      
      // Default recommendation on failure
      defaultRecommendation: 'review'
    },
    
    // Rate limiting
    rateLimit: {
      maxCallsPerMinute: 60,
      maxCallsPerHour: 1000
    }
  },
  
  // Pipeline Integration Configuration
  pipeline: {
    // Entity building mode
    entityBuilding: {
      // Use anchor-driven entity synthesis
      useAnchor: true,
      
      // Compatibility mode
      compatibilityMode: 'ANCHOR_ONLY',
      
      // Enable conflict detection in pipeline
      detectConflicts: true,
      
      // Use LLM advisory in pipeline
      useLLM: false
    },
    
    // Pipeline performance
    performance: {
      // Maximum overhead allowed (percentage)
      maxOverheadPercent: 10, // Relaxed for development
      
      // Warn if overhead exceeds
      warnOverheadPercent: 5
    }
  },
  
  // Logging Configuration
  logging: {
    // Log level: 'debug', 'info', 'warn', 'error'
    level: 'debug',
    
    // Enable detailed logging
    detailed: true,
    
    // Log anchor generation
    logAnchorGeneration: true,
    
    // Log merging operations
    logMerging: true,
    
    // Log conflicts
    logConflicts: true,
    
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
      'schema_overlap_stats'
    ],
    
    // Metrics export interval (ms)
    exportInterval: 60000 // 1 minute
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
  
  // Development-Specific Settings
  development: {
    // Enable debug mode
    debugMode: true,
    
    // Enable test data generation
    generateTestData: true,
    
    // Enable performance profiling
    enableProfiling: true,
    
    // Enable detailed error messages
    detailedErrors: true,
    
    // Enable hot reload
    hotReload: true
  }
};
