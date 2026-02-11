# Anchor-Driven Entity Synthesis Configuration

This directory contains environment-specific configuration files for the Anchor-Driven Entity Synthesis system.

## Configuration Files

### JavaScript Configuration Files

- **`anchor.config.development.js`** - Development environment configuration
  - Verbose logging for debugging
  - All features enabled
  - Relaxed performance constraints
  - Enhanced error reporting

- **`anchor.config.staging.js`** - Staging/testing environment configuration
  - Production-like settings
  - Moderate logging for validation
  - All features enabled for testing
  - Performance monitoring enabled

- **`anchor.config.production.js`** - Production environment configuration
  - Minimal logging (warn/error only)
  - Strict performance constraints
  - Conservative feature flags
  - Production-grade monitoring

- **`index.js`** - Configuration loader and utilities
  - Automatically loads config based on NODE_ENV
  - Provides validation and utility functions
  - Exports convenience accessors

### Environment Variable Templates

- **`.env.anchor.development`** - Development environment variables
- **`.env.anchor.staging`** - Staging environment variables
- **`.env.anchor.production`** - Production environment variables

## Usage

### 1. Load Configuration in Code

```javascript
// Load configuration (automatically selects based on NODE_ENV)
const anchorConfig = require('./config');

// Access configuration values
const isEnabled = anchorConfig.isEnabled('anchorModeEnabled');
const compatMode = anchorConfig.getFeature('compatibilityMode');
const cacheConfig = anchorConfig.getAnchorGeneration().cache;

// Get specific value with default
const logLevel = anchorConfig.get('logging.level', 'info');
```

### 2. Set Environment Variables

Copy the appropriate `.env.anchor.*` file to your project root and merge with your existing `.env` file:

```bash
# Development
cat .kiro/specs/anchor-driven-entity-synthesis/config/.env.anchor.development >> .env

# Staging
cat .kiro/specs/anchor-driven-entity-synthesis/config/.env.anchor.staging >> .env.staging

# Production
cat .kiro/specs/anchor-driven-entity-synthesis/config/.env.anchor.production >> .env.production
```

### 3. Set NODE_ENV

```bash
# Development (default)
export NODE_ENV=development

# Staging
export NODE_ENV=staging

# Production
export NODE_ENV=production
```

## Configuration Structure

### Feature Flags

Control which features are enabled:

```javascript
features: {
  anchorModeEnabled: true,           // Enable anchor system
  compatibilityMode: 'ANCHOR_ONLY',  // ANCHOR_ONLY, HYBRID, or LEGACY
  conflictDetectionEnabled: true,    // Enable conflict detection
  llmAdvisoryEnabled: false,         // Enable LLM advisory (costs tokens)
  cachingEnabled: true,              // Enable caching
  metricsEnabled: true,              // Enable metrics collection
  profilingEnabled: false            // Enable performance profiling
}
```

### Anchor Generation

Configure anchor fingerprint generation:

```javascript
anchorGeneration: {
  cache: {
    enabled: true,
    maxSize: 100000,
    ttl: 14400000  // 4 hours
  },
  normalization: {
    strategies: ['time_month', 'time_year', 'time_day', 'location', 'indicator', 'lowercase']
  },
  performance: {
    maxTimePerInstance: 10,  // ms
    warnTimePerInstance: 5   // ms
  }
}
```

### Anchor Merging

Configure entity merging:

```javascript
anchorMerging: {
  confidence: {
    baseWeight: 0.7,
    multiSchemaBonus: 0.05,
    maxConfidence: 0.99
  },
  fieldMerging: {
    strategy: 'highest_confidence',
    logConflicts: false,
    conflictResolution: 'prefer_first'
  },
  performance: {
    maxTimeFor1000Instances: 100,  // ms
    warnTimeFor1000Instances: 50   // ms
  }
}
```

### Conflict Detection

Configure conflict detection:

```javascript
conflictDetection: {
  checks: {
    timeConsistency: true,
    valueConflicts: true,
    stateContradictions: true
  },
  thresholds: {
    valueConflictPercent: 10,
    highSeverityPercent: 50
  },
  handling: {
    autoMergeNoConflict: true,
    autoMergeLowSeverity: true,
    requireReviewHighSeverity: true
  }
}
```

### LLM Advisory

Configure LLM advisory (optional):

```javascript
llmAdvisory: {
  enabled: false,  // Disabled by default to save costs
  provider: {
    name: 'qwen',
    apiKey: process.env.QWEN_API_KEY,
    model: 'qwen-turbo',
    temperature: 0.2,
    maxTokens: 400
  },
  thresholds: {
    minSeverity: 'high',
    minConfidence: 0.8
  },
  rateLimit: {
    maxCallsPerMinute: 20,
    maxCallsPerHour: 300
  }
}
```

### Logging

Configure logging:

```javascript
logging: {
  level: 'warn',  // debug, info, warn, error
  detailed: false,
  logAnchorGeneration: false,
  logMerging: false,
  logConflicts: false,
  logLLMCalls: true,
  logPerformance: false
}
```

### Monitoring

Configure monitoring and metrics:

```javascript
monitoring: {
  enabled: true,
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
  exportInterval: 60000,  // 1 minute
  alerts: {
    anchorGenerationTime: 50,
    mergeProcessingTime: 500,
    errorRate: 0.01,
    memoryUsage: 0.8,
    cpuUsage: 0.8
  }
}
```

## Environment-Specific Settings

### Development

- **Logging**: Verbose (debug level)
- **Performance**: Relaxed constraints
- **Features**: All enabled
- **Profiling**: Enabled
- **Error Reporting**: Detailed

### Staging

- **Logging**: Moderate (info level)
- **Performance**: Production targets
- **Features**: All enabled for testing
- **Validation**: Enabled
- **Benchmarking**: Enabled

### Production

- **Logging**: Minimal (warn level)
- **Performance**: Strict constraints
- **Features**: Conservative (LLM disabled by default)
- **Monitoring**: Production-grade
- **Security**: Enhanced

## Configuration Validation

The configuration loader automatically validates the configuration on load:

```javascript
const { validateConfig } = require('./config');

const validation = validateConfig(config);
if (!validation.valid) {
  console.error('Configuration errors:', validation.errors);
}
```

## Configuration Overrides

You can override configuration values at runtime:

```javascript
const { mergeConfig, config } = require('./config');

const overrides = {
  features: {
    llmAdvisoryEnabled: true
  },
  logging: {
    level: 'debug'
  }
};

const customConfig = mergeConfig(config, overrides);
```

## Best Practices

1. **Start Conservative**: Begin with `ANCHOR_ONLY` mode and LLM disabled
2. **Monitor Performance**: Watch metrics closely after deployment
3. **Enable LLM Gradually**: Only enable LLM advisory if conflict rate is high
4. **Use Staging**: Always test in staging before production
5. **Review Logs**: Check logs regularly for issues
6. **Tune Thresholds**: Adjust thresholds based on real-world data
7. **Keep Secrets Safe**: Never commit API keys to version control

## Troubleshooting

### Configuration Not Loading

- Check NODE_ENV is set correctly
- Verify configuration file exists
- Check for syntax errors in config file

### Performance Issues

- Check performance metrics
- Increase cache size
- Disable verbose logging
- Review conflict detection thresholds

### High Conflict Rate

- Review anchor field configurations
- Adjust conflict thresholds
- Consider enabling LLM advisory
- Check data quality

### LLM Costs Too High

- Disable LLM advisory
- Increase minSeverity threshold
- Reduce rate limits
- Use rule-based conflict resolution

## Support

For issues or questions:
- Check TROUBLESHOOTING.md
- Review DEPLOYMENT_CHECKLIST.md
- Consult IMPLEMENTATION_COMPLETE_SUMMARY.md

---

**Version**: 1.0  
**Last Updated**: 2026-02-08  
**Status**: Production Ready
