/**
 * Universal Field Extractor - 通用字段提取器
 * 
 * 基于分词 + 关键词提取 + 结构化识别的通用字段提取方案
 * 不依赖固定的字段类型，能够适应90%的生活工作场景
 * 
 * 核心流程：
 * 1. 文档分词（中英文混合）
 * 2. 关键词提取（TF-IDF）
 * 3. 结构化模式识别（key: value）
 * 4. 字段候选生成
 * 5. 去重和过滤
 */

const nodejieba = require('nodejieba');

class UniversalExtractor {
  constructor() {
    // 停用词列表（常见的无意义词）
    this.stopWords = new Set([
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
      '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
      '自己', '这', '那', '里', '就是', '可以', '这个', '什么', '他', '她', '它',
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with'
    ]);
    
    // 结构化模式（key: value, key=value, key：value）
    this.structuredPatterns = [
      // 中文冒号
      /^([^：\n]{1,20})：\s*([^\n]{1,200})$/gm,
      // 英文冒号
      /^([^:\n]{1,20}):\s*([^\n]{1,200})$/gm,
      // 等号
      /^([^=\n]{1,20})=\s*([^\n]{1,200})$/gm,
      // Markdown列表项
      /^[-*]\s+([^：:\n]{1,20})[：:]\s*([^\n]{1,200})$/gm,
      // 数字列表项
      /^\d+\.\s+([^：:\n]{1,20})[：:]\s*([^\n]{1,200})$/gm
    ];
    
    // 值类型识别模式
    this.valuePatterns = {
      date: /^\d{4}[-年]\d{1,2}[-月]\d{1,2}[日]?$/,
      time: /^\d{1,2}:\d{2}(:\d{2})?$/,
      number: /^-?\d+(\.\d+)?$/,
      percentage: /^\d+(\.\d+)?%$/,
      url: /^https?:\/\//,
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    };
  }
  
  /**
   * 提取字段
   * 
   * @param {Object} ckb - CKB对象
   * @param {Object} options - 提取选项
   * @returns {Promise<Array>} 提取的字段列表
   */
  async extractFields(ckb, options = {}) {
    const {
      maxFields = 100,           // 最多提取字段数
      minKeywordScore = 0.01,    // 最小关键词分数
      includeStructured = true,  // 是否包含结构化字段
      includeKeywords = true     // 是否包含关键词字段
    } = options;
    
    const text = ckb.content?.text || '';
    if (!text || text.length < 10) {
      return [];
    }
    
    const fields = [];
    
    // 步骤1: 提取结构化字段（key: value模式）
    if (includeStructured) {
      const structuredFields = this._extractStructuredFields(text);
      fields.push(...structuredFields);
    }
    
    // 步骤2: 提取关键词字段
    if (includeKeywords) {
      const keywordFields = this._extractKeywordFields(text, minKeywordScore);
      fields.push(...keywordFields);
    }
    
    // 步骤3: 去重和过滤
    const uniqueFields = this._deduplicateFields(fields);
    
    // 步骤4: 限制数量
    const limitedFields = uniqueFields.slice(0, maxFields);
    
    // 步骤5: 添加元数据
    return limitedFields.map(field => ({
      ...field,
      ckb_id: ckb.ckb_id,
      doc_id: ckb.doc_id,
      source: 'universal_extractor',
      extraction_method: field.extraction_method || 'unknown'
    }));
  }
  
  /**
   * 提取结构化字段（key: value模式）
   * 
   * @param {string} text - 文档文本
   * @returns {Array} 结构化字段列表
   */
  _extractStructuredFields(text) {
    const fields = [];
    const seen = new Set();
    
    for (const pattern of this.structuredPatterns) {
      let match;
      const regex = new RegExp(pattern.source, pattern.flags);
      
      while ((match = regex.exec(text)) !== null) {
        let key = match[1].trim();
        const value = match[2].trim();
        
        // 移除key前面的列表标记（-, *, 数字等）
        key = key.replace(/^[-*•]\s*/, '').replace(/^\d+\.\s*/, '').trim();
        
        // 过滤无效的key
        if (!key || key.length < 2 || key.length > 50) continue;
        if (!value || value.length < 1 || value.length > 500) continue;
        
        // 去重
        const fieldKey = `${key}:${value}`;
        if (seen.has(fieldKey)) continue;
        seen.add(fieldKey);
        
        // 识别值类型
        const valueType = this._detectValueType(value);
        
        fields.push({
          name: key,
          value: value,
          type: valueType,
          confidence: 0.9,  // 结构化字段置信度高
          extraction_method: 'structured'
        });
      }
    }
    
    return fields;
  }
  
  /**
   * 提取关键词字段
   * 
   * @param {string} text - 文档文本
   * @param {number} minScore - 最小TF-IDF分数
   * @returns {Array} 关键词字段列表
   */
  _extractKeywordFields(text, minScore = 0.01) {
    // 分词
    const words = nodejieba.extract(text, 50);  // 提取Top 50关键词
    
    const fields = [];
    
    for (const item of words) {
      const word = item.word;
      const score = item.weight;
      
      // Normalize score to 0-1 range (nodejieba returns TF-IDF scores that can be > 1)
      // We'll use a simple normalization: divide by max score in the batch
      const normalizedScore = Math.min(score / 100, 1.0);  // Assume max TF-IDF is ~100
      
      // 过滤停用词和低分词
      if (this.stopWords.has(word)) continue;
      if (normalizedScore < minScore) continue;
      if (word.length < 2) continue;
      
      // 在文档中查找该词的上下文，尝试提取值
      const contexts = this._findWordContexts(text, word);
      
      if (contexts.length > 0) {
        // 如果找到上下文，创建带值的字段
        for (const context of contexts.slice(0, 3)) {  // 最多3个上下文
          fields.push({
            name: word,
            value: context.value,
            type: context.type || 'keyword',
            confidence: normalizedScore * 0.7,  // 关键词字段置信度较低
            extraction_method: 'keyword_context'
          });
        }
      } else {
        // 没有上下文，创建仅有名称的字段
        fields.push({
          name: word,
          value: word,
          type: 'keyword',
          confidence: normalizedScore * 0.5,
          extraction_method: 'keyword'
        });
      }
    }
    
    return fields;
  }
  
  /**
   * 查找词的上下文（尝试提取值）
   * 
   * @param {string} text - 文档文本
   * @param {string} word - 关键词
   * @returns {Array} 上下文列表
   */
  _findWordContexts(text, word) {
    const contexts = [];
    
    // 模式1: "词：值" 或 "词: 值"
    const pattern1 = new RegExp(`${this._escapeRegex(word)}[：:]\s*([^\n]{1,100})`, 'g');
    let match;
    
    while ((match = pattern1.exec(text)) !== null) {
      const value = match[1].trim();
      if (value && value.length > 0) {
        contexts.push({
          value: value,
          type: this._detectValueType(value)
        });
      }
    }
    
    // 模式2: "词是xxx" 或 "词为xxx"
    const pattern2 = new RegExp(`${this._escapeRegex(word)}[是为]\s*([^\n，。]{1,50})`, 'g');
    
    while ((match = pattern2.exec(text)) !== null) {
      const value = match[1].trim();
      if (value && value.length > 0) {
        contexts.push({
          value: value,
          type: this._detectValueType(value)
        });
      }
    }
    
    return contexts;
  }
  
  /**
   * 检测值的类型
   * 
   * @param {string} value - 值
   * @returns {string} 类型
   */
  _detectValueType(value) {
    if (!value) return 'unknown';
    
    const trimmed = value.trim();
    
    // 检查各种模式
    if (this.valuePatterns.date.test(trimmed)) return 'date';
    if (this.valuePatterns.time.test(trimmed)) return 'time';
    if (this.valuePatterns.number.test(trimmed)) return 'number';
    if (this.valuePatterns.percentage.test(trimmed)) return 'percentage';
    if (this.valuePatterns.url.test(trimmed)) return 'url';
    if (this.valuePatterns.email.test(trimmed)) return 'email';
    
    // 检查是否包含数字
    if (/\d/.test(trimmed)) return 'mixed';
    
    // 默认为文本
    return 'text';
  }
  
  /**
   * 去重字段
   * 
   * @param {Array} fields - 字段列表
   * @returns {Array} 去重后的字段列表
   */
  _deduplicateFields(fields) {
    const seen = new Map();
    
    for (const field of fields) {
      const key = `${field.name}:${field.value}`;
      
      if (!seen.has(key)) {
        seen.set(key, field);
      } else {
        // 如果已存在，保留置信度更高的
        const existing = seen.get(key);
        if (field.confidence > existing.confidence) {
          seen.set(key, field);
        }
      }
    }
    
    // 按置信度排序
    return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence);
  }
  
  /**
   * 转义正则表达式特殊字符
   * 
   * @param {string} str - 字符串
   * @returns {string} 转义后的字符串
   */
  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  /**
   * 获取提取统计
   * 
   * @param {Array} fields - 字段列表
   * @returns {Object} 统计信息
   */
  getStats(fields) {
    const stats = {
      total: fields.length,
      byMethod: {},
      byType: {},
      avgConfidence: 0
    };
    
    let totalConfidence = 0;
    
    for (const field of fields) {
      // 按提取方法统计
      const method = field.extraction_method || 'unknown';
      stats.byMethod[method] = (stats.byMethod[method] || 0) + 1;
      
      // 按类型统计
      const type = field.type || 'unknown';
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      
      // 累计置信度
      totalConfidence += field.confidence || 0;
    }
    
    if (fields.length > 0) {
      stats.avgConfidence = (totalConfidence / fields.length);  // 不要乘以100，保持0-1范围
    }
    
    return stats;
  }
}

module.exports = UniversalExtractor;
