/**
 * KG配置管理模块
 * 
 * 负责加载、验证和管理知识图谱相关的配置
 * 提供统一的配置访问接口
 */

class KGConfig {
  constructor() {
    // 自动构建开关
    this.autoBuild = process.env.AUTO_BUILD_KG === 'true';
    
    // KG服务启用开关
    this.enabled = process.env.KG_SERVICE_ENABLED !== 'false';
    
    // 最大并发构建数
    this.maxConcurrent = parseInt(process.env.KG_MAX_CONCURRENT || '3');
    
    // 构建超时时间（毫秒）
    this.buildTimeout = parseInt(process.env.KG_BUILD_TIMEOUT || '300000');
    
    // 是否启用构建队列
    this.enableQueue = process.env.KG_ENABLE_QUEUE !== 'false';
    
    // 队列最大长度
    this.queueMaxLength = parseInt(process.env.KG_QUEUE_MAX_LENGTH || '100');
    
    // 验证配置
    this.validate();
    
    // 打印配置信息
    this.logConfig();
  }
  
  /**
   * 验证配置的有效性
   * @throws {Error} 如果配置无效
   */
  validate() {
    const errors = [];
    
    // 验证最大并发数
    if (this.maxConcurrent < 1 || this.maxConcurrent > 10) {
      errors.push('KG_MAX_CONCURRENT must be between 1 and 10');
    }
    
    // 验证构建超时时间
    if (this.buildTimeout < 10000) {
      errors.push('KG_BUILD_TIMEOUT must be at least 10000ms (10 seconds)');
    }
    
    if (this.buildTimeout > 600000) {
      errors.push('KG_BUILD_TIMEOUT should not exceed 600000ms (10 minutes)');
    }
    
    // 验证队列最大长度
    if (this.queueMaxLength < 10) {
      errors.push('KG_QUEUE_MAX_LENGTH must be at least 10');
    }
    
    if (this.queueMaxLength > 1000) {
      errors.push('KG_QUEUE_MAX_LENGTH should not exceed 1000');
    }
    
    // 如果有错误，抛出异常
    if (errors.length > 0) {
      throw new Error(`KG Configuration validation failed:\n${errors.join('\n')}`);
    }
  }
  
  /**
   * 打印配置信息到控制台
   */
  logConfig() {
    console.log('[KG Config] Configuration loaded:');
    console.log(`  - Auto Build: ${this.autoBuild}`);
    console.log(`  - Service Enabled: ${this.enabled}`);
    console.log(`  - Max Concurrent: ${this.maxConcurrent}`);
    console.log(`  - Build Timeout: ${this.buildTimeout}ms`);
    console.log(`  - Queue Enabled: ${this.enableQueue}`);
    console.log(`  - Queue Max Length: ${this.queueMaxLength}`);
  }
  
  /**
   * 获取配置的JSON表示
   * @returns {Object} 配置对象
   */
  toJSON() {
    return {
      autoBuild: this.autoBuild,
      enabled: this.enabled,
      maxConcurrent: this.maxConcurrent,
      buildTimeout: this.buildTimeout,
      enableQueue: this.enableQueue,
      queueMaxLength: this.queueMaxLength
    };
  }
  
  /**
   * 检查KG服务是否启用
   * @returns {boolean}
   */
  isEnabled() {
    return this.enabled;
  }
  
  /**
   * 检查是否启用自动构建
   * @returns {boolean}
   */
  isAutoBuildEnabled() {
    return this.autoBuild;
  }
  
  /**
   * 获取最大并发数
   * @returns {number}
   */
  getMaxConcurrent() {
    return this.maxConcurrent;
  }
  
  /**
   * 获取构建超时时间
   * @returns {number}
   */
  getBuildTimeout() {
    return this.buildTimeout;
  }
  
  /**
   * 检查是否启用队列
   * @returns {boolean}
   */
  isQueueEnabled() {
    return this.enableQueue;
  }
  
  /**
   * 获取队列最大长度
   * @returns {number}
   */
  getQueueMaxLength() {
    return this.queueMaxLength;
  }
  
  /**
   * 更新配置（运行时）
   * 注意：这不会修改环境变量，只影响当前实例
   * 
   * @param {Object} updates - 要更新的配置项
   */
  update(updates) {
    if (updates.maxConcurrent !== undefined) {
      this.maxConcurrent = updates.maxConcurrent;
    }
    
    if (updates.buildTimeout !== undefined) {
      this.buildTimeout = updates.buildTimeout;
    }
    
    if (updates.queueMaxLength !== undefined) {
      this.queueMaxLength = updates.queueMaxLength;
    }
    
    // 重新验证
    this.validate();
    
    console.log('[KG Config] Configuration updated');
  }
}

// 导出单例实例
let instance = null;

function getInstance() {
  if (!instance) {
    try {
      instance = new KGConfig();
    } catch (error) {
      console.error('[KG Config] Failed to initialize configuration:', error.message);
      // 返回一个禁用的配置，避免系统崩溃
      instance = {
        enabled: false,
        autoBuild: false,
        maxConcurrent: 3,
        buildTimeout: 300000,
        enableQueue: true,
        queueMaxLength: 100,
        isEnabled: () => false,
        isAutoBuildEnabled: () => false,
        getMaxConcurrent: () => 3,
        getBuildTimeout: () => 300000,
        isQueueEnabled: () => true,
        getQueueMaxLength: () => 100,
        toJSON: () => ({ enabled: false, error: error.message })
      };
    }
  }
  return instance;
}

module.exports = {
  KGConfig,
  getInstance
};
