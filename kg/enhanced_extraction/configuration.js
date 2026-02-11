/**
 * Configuration Manager for LLM-Enhanced Entity Extraction System
 * 
 * Handles loading, validation, and management of system configuration.
 * Supports loading from files, environment variables, and provides default fallbacks.
 */

const fs = require('fs');
const path = require('path');
const { DEFAULT_CONFIG } = require('./constants');

class Configuration {
  constructor(config = {}) {
    this.config = this._mergeWithDefaults(config);
    this._validate();
  }

  /**
   * Load configuration from file
   * @param {string} filePath - Path to configuration file
   * @returns {Configuration}
   */
  static fromFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        console.warn(`Configuration file not found: ${filePath}, using defaults`);
        return new Configuration();
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');
      const config = JSON.parse(fileContent);
      return new Configuration(config);
    } catch (error) {
      console.warn(`Failed to load configuration from ${filePath}: ${error.message}, using defaults`);
      return new Configuration();
    }
  }

  /**
   * Load configuration from environment variables
   * @returns {Configuration}
   */
  static fromEnv() {
    const config = {
      llm: {
        enabled: process.env.LLM_ENABLED !== 'false',
        model: process.env.LLM_MODEL || DEFAULT_CONFIG.llm.model,
        apiKey: process.env.LLM_API_KEY,
        baseURL: process.env.LLM_BASE_URL,
        timeout: parseInt(process.env.LLM_TIMEOUT) || DEFAULT_CONFIG.llm.timeout,
        maxRetries: parseInt(process.env.LLM_MAX_RETRIES) || DEFAULT_CONFIG.llm.maxRetries,
        temperature: parseFloat(process.env.LLM_TEMPERATURE) || DEFAULT_CONFIG.llm.temperature,
        maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || DEFAULT_CONFIG.llm.maxTokens
      },
      algorithm: {
        enabled: process.env.ALGORITHM_ENABLED !== 'false',
        extractorType: process.env.ALGORITHM_EXTRACTOR_TYPE || DEFAULT_CONFIG.algorithm.extractorType
      },
      fusion: {
        conflictStrategy: process.env.FUSION_CONFLICT_STRATEGY || DEFAULT_CONFIG.fusion.conflictStrategy,
        deduplication: process.env.FUSION_DEDUPLICATION !== 'false',
        confidenceThreshold: parseFloat(process.env.FUSION_CONFIDENCE_THRESHOLD) || DEFAULT_CONFIG.fusion.confidenceThreshold
      },
      performance: {
        enableCache: process.env.PERFORMANCE_ENABLE_CACHE !== 'false',
        cacheExpiry: parseInt(process.env.PERFORMANCE_CACHE_EXPIRY) || DEFAULT_CONFIG.performance.cacheExpiry,
        batchSize: parseInt(process.env.PERFORMANCE_BATCH_SIZE) || DEFAULT_CONFIG.performance.batchSize,
        maxProcessingTime: parseInt(process.env.PERFORMANCE_MAX_PROCESSING_TIME) || DEFAULT_CONFIG.performance.maxProcessingTime
      },
      quality: {
        minEntities: parseInt(process.env.QUALITY_MIN_ENTITIES) || DEFAULT_CONFIG.quality.minEntities,
        minRelations: parseInt(process.env.QUALITY_MIN_RELATIONS) || DEFAULT_CONFIG.quality.minRelations,
        minConfidence: parseFloat(process.env.QUALITY_MIN_CONFIDENCE) || DEFAULT_CONFIG.quality.minConfidence,
        requiredFields: process.env.QUALITY_REQUIRED_FIELDS ? process.env.QUALITY_REQUIRED_FIELDS.split(',') : DEFAULT_CONFIG.quality.requiredFields
      },
      language: {
        default: process.env.LANGUAGE_DEFAULT || DEFAULT_CONFIG.language.default,
        supported: process.env.LANGUAGE_SUPPORTED ? process.env.LANGUAGE_SUPPORTED.split(',') : DEFAULT_CONFIG.language.supported,
        autoDetect: process.env.LANGUAGE_AUTO_DETECT !== 'false'
      }
    };

    return new Configuration(config);
  }

  /**
   * Merge user config with defaults
   * @private
   */
  _mergeWithDefaults(userConfig) {
    return {
      llm: { ...DEFAULT_CONFIG.llm, ...(userConfig.llm || {}) },
      algorithm: { ...DEFAULT_CONFIG.algorithm, ...(userConfig.algorithm || {}) },
      fusion: { ...DEFAULT_CONFIG.fusion, ...(userConfig.fusion || {}) },
      performance: { ...DEFAULT_CONFIG.performance, ...(userConfig.performance || {}) },
      quality: { ...DEFAULT_CONFIG.quality, ...(userConfig.quality || {}) },
      language: { ...DEFAULT_CONFIG.language, ...(userConfig.language || {}) }
    };
  }

  /**
   * Validate configuration
   * @private
   */
  _validate() {
    // Validate LLM config
    if (this.config.llm.enabled) {
      if (this.config.llm.timeout <= 0) {
        throw new Error('LLM timeout must be positive');
      }
      if (this.config.llm.maxRetries < 0) {
        throw new Error('LLM maxRetries must be non-negative');
      }
      if (this.config.llm.temperature < 0 || this.config.llm.temperature > 2) {
        throw new Error('LLM temperature must be between 0 and 2');
      }
      if (this.config.llm.maxTokens <= 0) {
        throw new Error('LLM maxTokens must be positive');
      }
    }

    // Validate fusion config
    const validStrategies = ['prefer_algorithm', 'prefer_llm', 'merge'];
    if (!validStrategies.includes(this.config.fusion.conflictStrategy)) {
      throw new Error(`Invalid conflict strategy: ${this.config.fusion.conflictStrategy}`);
    }
    if (this.config.fusion.confidenceThreshold < 0 || this.config.fusion.confidenceThreshold > 1) {
      throw new Error('Confidence threshold must be between 0 and 1');
    }

    // Validate performance config
    if (this.config.performance.cacheExpiry < 0) {
      throw new Error('Cache expiry must be non-negative');
    }
    if (this.config.performance.batchSize <= 0) {
      throw new Error('Batch size must be positive');
    }
    if (this.config.performance.maxProcessingTime <= 0) {
      throw new Error('Max processing time must be positive');
    }

    // Validate quality config
    if (this.config.quality.minEntities < 0) {
      throw new Error('Min entities must be non-negative');
    }
    if (this.config.quality.minRelations < 0) {
      throw new Error('Min relations must be non-negative');
    }
    if (this.config.quality.minConfidence < 0 || this.config.quality.minConfidence > 1) {
      throw new Error('Min confidence must be between 0 and 1');
    }

    // Validate language config
    const validLanguages = ['zh', 'en', 'auto'];
    if (!validLanguages.includes(this.config.language.default)) {
      throw new Error(`Invalid default language: ${this.config.language.default}`);
    }
  }

  /**
   * Get configuration value
   * @param {string} path - Dot-separated path to config value (e.g., 'llm.enabled')
   * @returns {*}
   */
  get(path) {
    const parts = path.split('.');
    let value = this.config;
    for (const part of parts) {
      if (value === undefined || value === null) {
        return undefined;
      }
      value = value[part];
    }
    return value;
  }

  /**
   * Set configuration value
   * @param {string} path - Dot-separated path to config value
   * @param {*} value - Value to set
   */
  set(path, value) {
    const parts = path.split('.');
    const lastPart = parts.pop();
    let target = this.config;
    
    for (const part of parts) {
      if (!target[part]) {
        target[part] = {};
      }
      target = target[part];
    }
    
    target[lastPart] = value;
    this._validate();
  }

  /**
   * Get full configuration object
   * @returns {Object}
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * Export configuration to JSON
   * @returns {string}
   */
  toJSON() {
    return JSON.stringify(this.config, null, 2);
  }

  /**
   * Save configuration to file
   * @param {string} filePath - Path to save configuration
   */
  saveToFile(filePath) {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, this.toJSON(), 'utf8');
  }
}

module.exports = Configuration;
