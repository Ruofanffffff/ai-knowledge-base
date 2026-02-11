/**
 * Pipeline Integration for Enhanced Extraction
 * 
 * 将LLM增强实体提取系统集成到Universal Document Pipeline中
 * 作为可选的字段提取器使用
 */

const ExtractionCoordinator = require('./extraction_coordinator');
const Configuration = require('./configuration');

/**
 * Enhanced Extraction Adapter
 * 
 * 适配器类，将Enhanced Extraction系统适配到Pipeline的字段提取接口
 */
class EnhancedExtractionAdapter {
  /**
   * 创建适配器实例
   * @param {Object} options - 配置选项
   */
  constructor(options = {}) {
    // 创建配置
    const config = new Configuration(options);
    
    // 创建提取协调器
    this.coordinator = new ExtractionCoordinator(config);
    
    // 是否启用
    this.enabled = options.enabled !== false;
  }
  
  /**
   * 提取字段（适配Pipeline接口）
   * 
   * @param {Object} ckb - CKB对象
   * @param {Object} options - 提取选项
   * @returns {Promise<Array>} 提取的字段数组
   */
  async extractFields(ckb, options = {}) {
    if (!this.enabled) {
      throw new Error('Enhanced extraction is disabled');
    }
    
    // 从CKB中提取文档文本
    const documentText = ckb.content?.text || ckb.content || '';
    
    if (!documentText || documentText.trim().length === 0) {
      throw new Error('Invalid input: documentText must be a non-empty string');
    }
    
    // 执行增强提取
    const extractOptions = {
      enableLLM: options.useLLM !== false,
      enableAlgorithm: options.useAlgorithm !== false,
      timeout: options.timeout || 5000,
      language: options.language || 'auto'
    };
    
    const result = await this.coordinator.extract(documentText, extractOptions);
    
    // 检查提取状态
    if (result.metadata.status === 'failed') {
      throw new Error(`Enhanced extraction failed: ${result.metadata.errors?.join(', ')}`);
    }
    
    // 转换为Pipeline期望的字段格式
    const fields = this._convertToFields(result);
    
    return fields;
  }
  
  /**
   * 转换提取结果为Pipeline字段格式
   * 
   * @param {Object} result - 增强提取结果
   * @returns {Array} 字段数组
   * @private
   */
  _convertToFields(result) {
    const fields = [];
    
    // 转换实体为字段
    for (const entity of result.entities) {
      // 实体名称作为字段
      fields.push({
        name: entity.type,
        value: entity.name,
        confidence: entity.confidence,
        source: entity.source,
        type: 'entity',
        metadata: {
          entityId: entity.id,
          entityType: entity.type,
          properties: entity.properties
        }
      });
      
      // 实体属性作为字段
      if (entity.properties) {
        for (const [propName, propValue] of Object.entries(entity.properties)) {
          if (propValue !== null && propValue !== undefined) {
            fields.push({
              name: propName,
              value: String(propValue),
              confidence: entity.confidence,
              source: entity.source,
              type: 'property',
              metadata: {
                entityId: entity.id,
                entityType: entity.type,
                propertyName: propName
              }
            });
          }
        }
      }
    }
    
    return fields;
  }
  
  /**
   * 获取提取统计信息
   * @returns {Object} 统计信息
   */
  getStatistics() {
    // Return basic statistics
    return {
      totalExtractions: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      averageProcessingTime: 0
    };
  }
  
  /**
   * 重置统计信息
   */
  resetStatistics() {
    // No-op for now
  }
}

/**
 * 创建增强提取适配器
 * 
 * @param {Object} options - 配置选项
 * @returns {EnhancedExtractionAdapter} 适配器实例
 */
function createEnhancedExtractor(options = {}) {
  return new EnhancedExtractionAdapter(options);
}

/**
 * 检查增强提取是否可用
 * 
 * @returns {boolean} 是否可用
 */
function isEnhancedExtractionAvailable() {
  try {
    // 尝试加载必要的模块
    require('./extraction_coordinator');
    require('./configuration');
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  EnhancedExtractionAdapter,
  createEnhancedExtractor,
  isEnhancedExtractionAvailable
};
