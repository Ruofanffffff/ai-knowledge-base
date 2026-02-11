/**
 * Anchor Configuration Loader
 * 
 * Loads the appropriate configuration based on NODE_ENV
 * and provides utilities for accessing configuration values.
 */

const path = require('path');

/**
 * Get current environment
 * @returns {string} Environment name (development, staging, production)
 */
function getEnvironment() {
  return process.env.NODE_ENV || 'development';
}

/**
 * Load configuration for current environment
 * @returns {Object} Configuration object
 */
function loadConfig() {
  const env = getEnvironment();
  
  try {
    const configPath = path.join(__dirname, `anchor.config.${env}.js`);
    const config = require(configPath);
    
    console.log(`[AnchorConfig] Loaded configuration for environment: ${env}`);
    
    return config;
  } catch (error) {
    console.warn(`[AnchorConfig] Failed to load config for ${env}, falling back to development`);
    return require('./anchor.config.development.js');
  }
}

/**
 * Get configuration value by path
 * @param {Object} config - Configuration object
 * @param {string} path - Dot-separated path (e.g., 'features.anchorModeEnabled')
 * @param {*} defaultValue - Default value if path not found
 * @returns {*} Configuration value
 */
function getConfigValue(config, path, defaultValue = undefined) {
  const keys = path.split('.');
  let value = config;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }
  
  return value;
}

/**
 * Validate configuration
 * @param {Object} config - Configuration object
 * @returns {Object} Validation result { valid: boolean, errors: string[] }
 */
function validateConfig(config) {
  const errors = [];
  
  // Required fields
  const requiredFields = [
    'environment',
    'features.anchorModeEnabled',
    'features.compatibilityMode',
    'anchorGeneration.cache.enabled',
    'anchorMerging.confidence.baseWeight',
    'logging.level'
  ];
  
  for (const field of requiredFields) {
    const value = getConfigValue(config, field);
    if (value === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Validate compatibility mode
  const compatibilityMode = getConfigValue(config, 'features.compatibilityMode');
  const validModes = ['ANCHOR_ONLY', 'HYBRID', 'LEGACY'];
  if (compatibilityMode && !validModes.includes(compatibilityMode)) {
    errors.push(`Invalid compatibility mode: ${compatibilityMode}. Must be one of: ${validModes.join(', ')}`);
  }
  
  // Validate log level
  const logLevel = getConfigValue(config, 'logging.level');
  const validLevels = ['debug', 'info', 'warn', 'error'];
  if (logLevel && !validLevels.includes(logLevel)) {
    errors.push(`Invalid log level: ${logLevel}. Must be one of: ${validLevels.join(', ')}`);
  }
  
  // Validate confidence weights
  const baseWeight = getConfigValue(config, 'anchorMerging.confidence.baseWeight');
  if (baseWeight !== undefined && (baseWeight < 0 || baseWeight > 1)) {
    errors.push(`Invalid base weight: ${baseWeight}. Must be between 0 and 1`);
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Merge configurations (for overrides)
 * @param {Object} baseConfig - Base configuration
 * @param {Object} overrides - Override configuration
 * @returns {Object} Merged configuration
 */
function mergeConfig(baseConfig, overrides) {
  const merged = JSON.parse(JSON.stringify(baseConfig)); // Deep clone
  
  function merge(target, source) {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        target[key] = target[key] || {};
        merge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  
  merge(merged, overrides);
  return merged;
}

/**
 * Get configuration summary for logging
 * @param {Object} config - Configuration object
 * @returns {Object} Configuration summary
 */
function getConfigSummary(config) {
  return {
    environment: config.environment,
    anchorModeEnabled: getConfigValue(config, 'features.anchorModeEnabled'),
    compatibilityMode: getConfigValue(config, 'features.compatibilityMode'),
    conflictDetectionEnabled: getConfigValue(config, 'features.conflictDetectionEnabled'),
    llmAdvisoryEnabled: getConfigValue(config, 'features.llmAdvisoryEnabled'),
    cachingEnabled: getConfigValue(config, 'features.cachingEnabled'),
    logLevel: getConfigValue(config, 'logging.level'),
    metricsEnabled: getConfigValue(config, 'monitoring.enabled')
  };
}

// Load configuration on module load
const config = loadConfig();

// Validate configuration
const validation = validateConfig(config);
if (!validation.valid) {
  console.error('[AnchorConfig] Configuration validation failed:');
  validation.errors.forEach(error => console.error(`  - ${error}`));
  throw new Error('Invalid anchor configuration');
}

// Log configuration summary
const summary = getConfigSummary(config);
console.log('[AnchorConfig] Configuration summary:', JSON.stringify(summary, null, 2));

// Export configuration and utilities
module.exports = {
  // Configuration object
  config,
  
  // Utilities
  getEnvironment,
  loadConfig,
  getConfigValue,
  validateConfig,
  mergeConfig,
  getConfigSummary,
  
  // Convenience accessors
  get: (path, defaultValue) => getConfigValue(config, path, defaultValue),
  isEnabled: (feature) => getConfigValue(config, `features.${feature}`, false),
  getFeature: (feature) => getConfigValue(config, `features.${feature}`),
  getAnchorGeneration: () => config.anchorGeneration,
  getAnchorMerging: () => config.anchorMerging,
  getConflictDetection: () => config.conflictDetection,
  getLLMAdvisory: () => config.llmAdvisory,
  getPipeline: () => config.pipeline,
  getLogging: () => config.logging,
  getMonitoring: () => config.monitoring,
  getDatabase: () => config.database
};
