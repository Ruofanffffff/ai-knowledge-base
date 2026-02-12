/**
 * LLM Document Index Preprocessing Configuration
 * 
 * 集中管理LLM文档索引预处理功能的所有配置参数
 * 
 * 配置来源：
 * 1. 环境变量 (.env文件)
 * 2. 默认值 (当环境变量未设置时)
 * 
 * Requirements: 1.5, 8.5
 */

/**
 * 解析布尔值环境变量
 * @param {string} value - 环境变量值
 * @param {boolean} defaultValue - 默认值
 * @returns {boolean}
 */
function parseBoolean(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  return value === 'true' || value === '1';
}

/**
 * 解析整数环境变量
 * @param {string} value - 环境变量值
 * @param {number} defaultValue - 默认值
 * @returns {number}
 */
function parseInteger(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * 解析浮点数环境变量
 * @param {string} value - 环境变量值
 * @param {number} defaultValue - 默认值
 * @returns {number}
 */
function parseFloat(value, defaultValue) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const parsed = Number.parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * LLM预处理配置
 */
const config = {
  // ========== 主开关 ==========
  /**
   * 启用LLM文档索引预处理
   * @type {boolean}
   */
  enabled: parseBoolean(process.env.ENABLE_LLM_PREPROCESSING, false),

  // ========== LLM调用配置 ==========
  /**
   * LLM温度参数 (0-1, 越低越确定性)
   * @type {number}
   */
  temperature: parseFloat(process.env.LLM_PREPROCESSING_TEMPERATURE, 0.1),

  /**
   * LLM最大Token数
   * @type {number}
   */
  maxTokens: parseInteger(process.env.LLM_PREPROCESSING_MAX_TOKENS, 2000),

  // ========== 超时配置 (毫秒) ==========
  timeouts: {
    /**
     * 文档索引生成超时
     * @type {number}
     */
    documentIndex: parseInteger(process.env.LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT, 30000),

    /**
     * CBK描述矫正超时
     * @type {number}
     */
    cbkCorrection: parseInteger(process.env.LLM_PREPROCESSING_CBK_CORRECTION_TIMEOUT, 10000),

    /**
     * 字段提取矫正超时
     * @type {number}
     */
    fieldCorrection: parseInteger(process.env.LLM_PREPROCESSING_FIELD_CORRECTION_TIMEOUT, 15000),

    /**
     * Schema选择矫正超时
     * @type {number}
     */
    schemaCorrection: parseInteger(process.env.LLM_PREPROCESSING_SCHEMA_CORRECTION_TIMEOUT, 10000),

    /**
     * 实体合并矫正超时
     * @type {number}
     */
    mergeCorrection: parseInteger(process.env.LLM_PREPROCESSING_MERGE_CORRECTION_TIMEOUT, 10000),

    /**
     * 关系抽取矫正超时
     * @type {number}
     */
    relationCorrection: parseInteger(process.env.LLM_PREPROCESSING_RELATION_CORRECTION_TIMEOUT, 20000),

    /**
     * 图谱描述生成超时
     * @type {number}
     */
    graphDescription: parseInteger(process.env.LLM_PREPROCESSING_GRAPH_DESCRIPTION_TIMEOUT, 30000)
  },

  // ========== 并发控制配置 ==========
  concurrency: {
    /**
     * 最大并发LLM调用数量
     * @type {number}
     */
    maxConcurrent: parseInteger(process.env.LLM_PREPROCESSING_MAX_CONCURRENCY, 5),

    /**
     * 队列超时时间 (毫秒)
     * @type {number}
     */
    queueTimeout: parseInteger(process.env.LLM_PREPROCESSING_QUEUE_TIMEOUT, 60000)
  },

  // ========== 缓存配置 ==========
  cache: {
    /**
     * 启用LLM调用结果缓存
     * @type {boolean}
     */
    enabled: parseBoolean(process.env.LLM_PREPROCESSING_CACHE_ENABLED, true),

    /**
     * 缓存最大条目数
     * @type {number}
     */
    maxSize: parseInteger(process.env.LLM_PREPROCESSING_CACHE_MAX_SIZE, 1000),

    /**
     * 缓存过期时间 (毫秒)
     * @type {number}
     */
    ttl: parseInteger(process.env.LLM_PREPROCESSING_CACHE_TTL, 3600000)
  },

  // ========== 智能触发阈值配置 ==========
  thresholds: {
    /**
     * 字段覆盖率阈值 (低于此值触发补充提取)
     * @type {number}
     */
    fieldCoverage: parseFloat(process.env.LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD, 0.8),

    /**
     * 关系覆盖率阈值 (低于此值触发补充提取)
     * @type {number}
     */
    relationCoverage: parseFloat(process.env.LLM_PREPROCESSING_RELATION_COVERAGE_THRESHOLD, 0.7),

    /**
     * Schema验证置信度阈值 (低于此值触发二次验证)
     * @type {number}
     */
    schemaConfidence: parseFloat(process.env.LLM_PREPROCESSING_SCHEMA_CONFIDENCE_THRESHOLD, 0.75)
  }
};

/**
 * 验证配置有效性
 * @returns {Object} 验证结果
 */
function validateConfig() {
  const errors = [];
  const warnings = [];

  // 验证温度参数
  if (config.temperature < 0 || config.temperature > 1) {
    errors.push('LLM_PREPROCESSING_TEMPERATURE must be between 0 and 1');
  }

  // 验证超时配置
  Object.entries(config.timeouts).forEach(([key, value]) => {
    if (value < 1000) {
      warnings.push(`Timeout for ${key} is less than 1 second (${value}ms)`);
    }
    if (value > 120000) {
      warnings.push(`Timeout for ${key} is greater than 2 minutes (${value}ms)`);
    }
  });

  // 验证并发配置
  if (config.concurrency.maxConcurrent < 1) {
    errors.push('LLM_PREPROCESSING_MAX_CONCURRENCY must be at least 1');
  }
  if (config.concurrency.maxConcurrent > 20) {
    warnings.push(`High concurrency setting: ${config.concurrency.maxConcurrent}`);
  }

  // 验证缓存配置
  if (config.cache.maxSize < 10) {
    warnings.push(`Cache size is very small: ${config.cache.maxSize}`);
  }
  if (config.cache.ttl < 60000) {
    warnings.push(`Cache TTL is less than 1 minute: ${config.cache.ttl}ms`);
  }

  // 验证阈值配置
  Object.entries(config.thresholds).forEach(([key, value]) => {
    if (value < 0 || value > 1) {
      errors.push(`Threshold ${key} must be between 0 and 1`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * 打印配置信息
 */
function printConfig() {
  console.log('\n========== LLM Preprocessing Configuration ==========');
  console.log(`Enabled: ${config.enabled}`);
  console.log(`Temperature: ${config.temperature}`);
  console.log(`Max Tokens: ${config.maxTokens}`);
  console.log('\nTimeouts:');
  Object.entries(config.timeouts).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}ms`);
  });
  console.log('\nConcurrency:');
  console.log(`  Max Concurrent: ${config.concurrency.maxConcurrent}`);
  console.log(`  Queue Timeout: ${config.concurrency.queueTimeout}ms`);
  console.log('\nCache:');
  console.log(`  Enabled: ${config.cache.enabled}`);
  console.log(`  Max Size: ${config.cache.maxSize}`);
  console.log(`  TTL: ${config.cache.ttl}ms`);
  console.log('\nThresholds:');
  console.log(`  Field Coverage: ${config.thresholds.fieldCoverage}`);
  console.log(`  Relation Coverage: ${config.thresholds.relationCoverage}`);
  console.log(`  Schema Confidence: ${config.thresholds.schemaConfidence}`);
  console.log('====================================================\n');
}

/**
 * 获取LatencyControlManager的配置选项
 * @returns {Object} LatencyControlManager配置
 */
function getLatencyControlOptions() {
  return {
    documentIndexTimeout: config.timeouts.documentIndex,
    cbkCorrectionTimeout: config.timeouts.cbkCorrection,
    fieldCorrectionTimeout: config.timeouts.fieldCorrection,
    schemaCorrectionTimeout: config.timeouts.schemaCorrection,
    mergeCorrectionTimeout: config.timeouts.mergeCorrection,
    relationCorrectionTimeout: config.timeouts.relationCorrection,
    graphDescriptionTimeout: config.timeouts.graphDescription,
    maxConcurrency: config.concurrency.maxConcurrent,
    queueTimeout: config.concurrency.queueTimeout,
    cacheEnabled: config.cache.enabled,
    cacheMaxSize: config.cache.maxSize,
    cacheTTL: config.cache.ttl,
    fieldCoverageThreshold: config.thresholds.fieldCoverage,
    relationCoverageThreshold: config.thresholds.relationCoverage,
    schemaConfidenceThreshold: config.thresholds.schemaConfidence
  };
}

// 在模块加载时验证配置
const validation = validateConfig();
if (!validation.valid) {
  console.error('[Preprocessing Config] Configuration errors:', validation.errors);
  throw new Error('Invalid preprocessing configuration');
}
if (validation.warnings.length > 0) {
  console.warn('[Preprocessing Config] Configuration warnings:', validation.warnings);
}

module.exports = {
  config,
  validateConfig,
  printConfig,
  getLatencyControlOptions
};
