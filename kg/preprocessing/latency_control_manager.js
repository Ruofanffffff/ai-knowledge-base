/**
 * Latency Control Manager
 * 
 * 统一管理LLM调用的时延控制机制
 * 
 * 核心功能：
 * 1. 超时控制 - 为所有LLM调用设置统一的超时机制
 * 2. 并发控制 - 使用p-queue限制并发LLM调用数量
 * 3. 缓存机制 - 缓存LLM调用结果，避免重复调用
 * 4. 智能触发 - 根据上下文决定是否需要调用LLM
 * 5. 性能监控 - 记录时延指标和超时事件
 * 
 * Requirements: 9.1, 9.3
 */

const PQueue = require('p-queue').default;
const crypto = require('crypto');

/**
 * LRU Cache implementation
 */
class LRUCache {
  constructor(maxSize = 1000, ttl = 3600000) { // 默认1小时TTL
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
    this.accessOrder = [];
  }

  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // 更新访问顺序
    this._updateAccessOrder(key);
    
    return entry.value;
  }

  set(key, value) {
    // 如果已存在，先删除
    if (this.cache.has(key)) {
      this.cache.delete(key);
      this._removeFromAccessOrder(key);
    }

    // 如果缓存已满，删除最久未使用的项
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.accessOrder.shift();
      this.cache.delete(oldestKey);
    }

    // 添加新项
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
    this.accessOrder.push(key);
  }

  has(key) {
    return this.cache.has(key) && this.get(key) !== null;
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }

  size() {
    return this.cache.size;
  }

  _updateAccessOrder(key) {
    this._removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  _removeFromAccessOrder(key) {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }
}

/**
 * Latency Control Manager
 */
class LatencyControlManager {
  constructor(options = {}) {
    // 超时配置
    this.timeouts = {
      document_index: options.documentIndexTimeout || 30000,      // 30秒
      cbk_correction: options.cbkCorrectionTimeout || 10000,      // 10秒
      field_correction: options.fieldCorrectionTimeout || 15000,  // 15秒
      schema_correction: options.schemaCorrectionTimeout || 10000, // 10秒
      merge_correction: options.mergeCorrectionTimeout || 10000,  // 10秒
      relation_correction: options.relationCorrectionTimeout || 20000, // 20秒
      graph_description: options.graphDescriptionTimeout || 30000 // 30秒
    };

    // 并发控制
    this.maxConcurrency = options.maxConcurrency || 5;
    this.queue = new PQueue({ 
      concurrency: this.maxConcurrency,
      timeout: options.queueTimeout || 60000 // 队列超时60秒
    });

    // 缓存配置
    this.cacheEnabled = options.cacheEnabled !== false; // 默认启用
    this.cacheMaxSize = options.cacheMaxSize || 1000;
    this.cacheTTL = options.cacheTTL || 3600000; // 1小时
    this.cache = new LRUCache(this.cacheMaxSize, this.cacheTTL);

    // 智能触发阈值
    this.thresholds = {
      fieldCoverageRate: options.fieldCoverageThreshold || 0.8,
      schemaConfidence: options.schemaConfidenceThreshold || 0.75,
      relationCoverageRate: options.relationCoverageThreshold || 0.7
    };

    // 性能监控
    this.metrics = {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      timeoutCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalLatency: 0,
      operationLatencies: {}
    };

    console.log(`[Latency Control] Initialized with concurrency=${this.maxConcurrency}, cache=${this.cacheEnabled}`);
  }

  /**
   * 调用LLM（带超时、并发控制和缓存）
   * 
   * @param {Object} llmClient - LLM客户端
   * @param {string} prompt - Prompt文本
   * @param {Object} options - 调用选项
   * @returns {Promise<string>} LLM响应
   */
  async callLLM(llmClient, prompt, options = {}) {
    const {
      operation = 'default',
      temperature = 0.1,
      maxTokens = 2000,
      systemPrompt = '',
      enableCache = true,
      cacheKey = null
    } = options;

    const startTime = Date.now();
    this.metrics.totalCalls++;

    try {
      // 1. 检查缓存
      if (this.cacheEnabled && enableCache) {
        const key = cacheKey || this._generateCacheKey(prompt, temperature, maxTokens);
        const cached = this.cache.get(key);
        
        if (cached) {
          this.metrics.cacheHits++;
          console.log(`[Latency Control] Cache hit for ${operation}`);
          return cached;
        }
        
        this.metrics.cacheMisses++;
      }

      // 2. 通过队列控制并发
      const response = await this.queue.add(async () => {
        return await this._callLLMWithTimeout(
          llmClient,
          prompt,
          operation,
          { temperature, maxTokens, systemPrompt }
        );
      });

      // 3. 缓存结果
      if (this.cacheEnabled && enableCache && response) {
        const key = cacheKey || this._generateCacheKey(prompt, temperature, maxTokens);
        this.cache.set(key, response);
      }

      // 4. 记录成功指标
      const latency = Date.now() - startTime;
      this.metrics.successCalls++;
      this.metrics.totalLatency += latency;
      this._recordOperationLatency(operation, latency);

      console.log(`[Latency Control] ${operation} completed in ${latency}ms`);

      return response;
    } catch (error) {
      const latency = Date.now() - startTime;
      
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        this.metrics.timeoutCalls++;
        console.error(`[Latency Control] ${operation} timeout after ${latency}ms`);
      } else {
        this.metrics.failedCalls++;
        console.error(`[Latency Control] ${operation} failed after ${latency}ms:`, error.message);
      }

      throw error;
    }
  }

  /**
   * 调用LLM（带超时控制）
   * 
   * @param {Object} llmClient - LLM客户端
   * @param {string} prompt - Prompt文本
   * @param {string} operation - 操作类型
   * @param {Object} options - 调用选项
   * @returns {Promise<string>} LLM响应
   * @private
   */
  async _callLLMWithTimeout(llmClient, prompt, operation, options) {
    const timeout = this.timeouts[operation] || 15000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await llmClient.chat({
        messages: [
          ...(options.systemPrompt ? [{
            role: 'system',
            content: options.systemPrompt
          }] : []),
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: options.temperature,
        maxTokens: options.maxTokens,
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      return response.content || response.message?.content || '';
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`LLM call timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * 生成缓存键
   * 
   * @param {string} prompt - Prompt文本
   * @param {number} temperature - 温度参数
   * @param {number} maxTokens - 最大token数
   * @returns {string} 缓存键
   * @private
   */
  _generateCacheKey(prompt, temperature, maxTokens) {
    const content = `${prompt}|${temperature}|${maxTokens}`;
    return crypto.createHash('md5').update(content).digest('hex');
  }

  /**
   * 记录操作时延
   * 
   * @param {string} operation - 操作类型
   * @param {number} latency - 时延（毫秒）
   * @private
   */
  _recordOperationLatency(operation, latency) {
    if (!this.metrics.operationLatencies[operation]) {
      this.metrics.operationLatencies[operation] = {
        count: 0,
        total: 0,
        min: Infinity,
        max: 0,
        avg: 0
      };
    }

    const stats = this.metrics.operationLatencies[operation];
    stats.count++;
    stats.total += latency;
    stats.min = Math.min(stats.min, latency);
    stats.max = Math.max(stats.max, latency);
    stats.avg = stats.total / stats.count;
  }

  /**
   * 智能触发判断：字段提取矫正
   * 
   * @param {Object} context - 上下文信息
   * @returns {boolean} 是否需要调用LLM
   */
  shouldTriggerFieldCorrection(context) {
    const { coverageRate, extractedFieldsCount } = context;
    
    // 如果覆盖率低于阈值，需要矫正
    if (coverageRate !== undefined && coverageRate < this.thresholds.fieldCoverageRate) {
      return true;
    }

    // 如果提取的字段数量很少，可能需要矫正
    if (extractedFieldsCount !== undefined && extractedFieldsCount < 3) {
      return true;
    }

    return false;
  }

  /**
   * 智能触发判断：Schema选择矫正
   * 
   * @param {Object} context - 上下文信息
   * @returns {boolean} 是否需要调用LLM
   */
  shouldTriggerSchemaCorrection(context) {
    const { confidence, missingRequiredFields } = context;
    
    // 如果置信度低于阈值，需要二次验证
    if (confidence !== undefined && confidence < this.thresholds.schemaConfidence) {
      return true;
    }

    // 如果有缺失的必需字段，需要验证
    if (missingRequiredFields && missingRequiredFields.length > 0) {
      return true;
    }

    return false;
  }

  /**
   * 智能触发判断：实体合并矫正
   * 
   * @param {Object} context - 上下文信息
   * @returns {boolean} 是否需要调用LLM
   */
  shouldTriggerMergeCorrection(context) {
    const { hasConflict, entityTypeMismatch } = context;
    
    // 如果有冲突，需要验证
    if (hasConflict) {
      return true;
    }

    // 如果实体类型不匹配，需要验证
    if (entityTypeMismatch) {
      return true;
    }

    return false;
  }

  /**
   * 智能触发判断：关系抽取矫正
   * 
   * @param {Object} context - 上下文信息
   * @returns {boolean} 是否需要调用LLM
   */
  shouldTriggerRelationCorrection(context) {
    const { coverageRate, entityCount, relationCount } = context;
    
    // 如果覆盖率低于阈值，需要矫正
    if (coverageRate !== undefined && coverageRate < this.thresholds.relationCoverageRate) {
      return true;
    }

    // 如果实体数量较多但关系数量较少，可能遗漏了关系
    if (entityCount > 5 && relationCount < entityCount / 2) {
      return true;
    }

    return false;
  }

  /**
   * 获取性能指标
   * 
   * @returns {Object} 性能指标
   */
  getMetrics() {
    const avgLatency = this.metrics.totalCalls > 0
      ? Math.round(this.metrics.totalLatency / this.metrics.totalCalls)
      : 0;

    const successRate = this.metrics.totalCalls > 0
      ? (this.metrics.successCalls / this.metrics.totalCalls * 100).toFixed(2)
      : 0;

    const cacheHitRate = (this.metrics.cacheHits + this.metrics.cacheMisses) > 0
      ? (this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) * 100).toFixed(2)
      : 0;

    return {
      totalCalls: this.metrics.totalCalls,
      successCalls: this.metrics.successCalls,
      failedCalls: this.metrics.failedCalls,
      timeoutCalls: this.metrics.timeoutCalls,
      successRate: `${successRate}%`,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      cacheHitRate: `${cacheHitRate}%`,
      cacheSize: this.cache.size(),
      avgLatency: `${avgLatency}ms`,
      operationLatencies: this.metrics.operationLatencies,
      queueSize: this.queue.size,
      queuePending: this.queue.pending
    };
  }

  /**
   * 重置性能指标
   */
  resetMetrics() {
    this.metrics = {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      timeoutCalls: 0,
      cacheHits: 0,
      cacheMisses: 0,
      totalLatency: 0,
      operationLatencies: {}
    };
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
    console.log('[Latency Control] Cache cleared');
  }

  /**
   * 获取超时配置
   * 
   * @param {string} operation - 操作类型
   * @returns {number} 超时时间（毫秒）
   */
  getTimeout(operation) {
    return this.timeouts[operation] || 15000;
  }

  /**
   * 设置超时配置
   * 
   * @param {string} operation - 操作类型
   * @param {number} timeout - 超时时间（毫秒）
   */
  setTimeout(operation, timeout) {
    this.timeouts[operation] = timeout;
    console.log(`[Latency Control] Set timeout for ${operation}: ${timeout}ms`);
  }

  /**
   * 获取并发队列状态
   * 
   * @returns {Object} 队列状态
   */
  getQueueStatus() {
    return {
      size: this.queue.size,
      pending: this.queue.pending,
      concurrency: this.maxConcurrency
    };
  }
}

/**
 * 创建全局单例实例
 */
let globalInstance = null;

/**
 * 获取全局实例
 * 
 * @param {Object} options - 配置选项
 * @returns {LatencyControlManager} 全局实例
 */
function getGlobalInstance(options = {}) {
  if (!globalInstance) {
    globalInstance = new LatencyControlManager(options);
  }
  return globalInstance;
}

/**
 * 重置全局实例
 */
function resetGlobalInstance() {
  globalInstance = null;
}

module.exports = {
  LatencyControlManager,
  LRUCache,
  getGlobalInstance,
  resetGlobalInstance
};
