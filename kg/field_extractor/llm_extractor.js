/**
 * LLM Field Extractor
 * 
 * 批量提取缺失的关键字段，采用智能触发和并发控制策略。
 * 
 * 设计原则：
 * 1. 批量处理：一次LLM调用处理10个CKB，减少网络往返
 * 2. 智能触发：仅针对缺失关键字段的CKB
 * 3. 并发控制：最多3个并发请求，避免超出API限流
 * 4. 错误处理：支持重试和fallback机制
 */

const { FieldType } = require('./rule_extractor');
const PQueue = require('p-queue').default;

/**
 * LLM Field Extractor Class
 */
class LLMFieldExtractor {
  constructor(options = {}) {
    this.batchSize = options.batchSize || parseInt(process.env.LLM_BATCH_SIZE) || 20; // 增加到20
    this.maxConcurrent = options.maxConcurrent || parseInt(process.env.LLM_MAX_CONCURRENT) || 3;
    this.temperature = options.temperature || parseFloat(process.env.LLM_TEMPERATURE) || 0.1;
    this.timeout = options.timeout || parseInt(process.env.LLM_TIMEOUT) || 30000; // 30秒超时
    this.maxRetries = options.maxRetries || parseInt(process.env.LLM_MAX_RETRIES) || 2;
    
    // 初始化并发队列
    this.queue = new PQueue({
      concurrency: this.maxConcurrent,
      timeout: this.timeout,
      throwOnTimeout: true
    });
    
    console.log(`[LLM Extractor] Initialized with concurrency=${this.maxConcurrent}, timeout=${this.timeout}ms, retries=${this.maxRetries}`);
  }
  
  /**
   * 批量提取缺失字段
   * 
   * @param {Array} ckbsWithMissingFields - 需要LLM增强的CKB数组
   * @param {Object} llmClient - LLM客户端
   * @returns {Promise<Map>} Map<CKB ID, extracted fields>
   */
  async batchExtractMissingFields(ckbsWithMissingFields, llmClient) {
    if (!ckbsWithMissingFields || ckbsWithMissingFields.length === 0) {
      return new Map();
    }
    
    if (!llmClient) {
      console.warn('[LLM Extractor] No LLM client provided, skipping extraction');
      return new Map();
    }
    
    console.log(`[LLM Extractor] Processing ${ckbsWithMissingFields.length} CKBs in batches of ${this.batchSize}`);
    
    const results = new Map();
    const batches = this._createBatches(ckbsWithMissingFields, this.batchSize);
    
    // 使用p-queue处理所有批次（自动并发控制）
    const batchPromises = batches.map((batch, index) => {
      return this.queue.add(
        async () => {
          const batchResults = await this._processBatch(batch, llmClient, index + 1, batches.length);
          
          // 合并结果
          batchResults.forEach((fields, ckbId) => {
            results.set(ckbId, fields);
          });
        },
        {
          priority: 0 // 所有批次优先级相同
        }
      );
    });
    
    // 等待所有批次完成
    await Promise.all(batchPromises);
    
    console.log(`[LLM Extractor] Completed. Extracted fields for ${results.size} CKBs`);
    console.log(`[LLM Extractor] Queue stats: pending=${this.queue.pending}, size=${this.queue.size}`);
    
    return results;
  }
  
  /**
   * 处理单个批次
   * 
   * @param {Array} batch - 批次中的CKB
   * @param {Object} llmClient - LLM客户端
   * @param {number} batchIndex - 批次索引
   * @param {number} totalBatches - 总批次数
   * @returns {Promise<Map>} 批次结果
   */
  async _processBatch(batch, llmClient, batchIndex, totalBatches) {
    console.log(`[LLM Extractor] Processing batch ${batchIndex}/${totalBatches} (${batch.length} CKBs)`);
    
    const startTime = Date.now();
    
    try {
      // 构建批量prompt
      const prompt = this._buildBatchPrompt(batch);
      
      // 调用LLM（带重试）
      const response = await this._callLLMWithRetry(llmClient, prompt);
      
      // 解析响应
      const batchResults = this._parseBatchResponse(response, batch);
      
      const duration = Date.now() - startTime;
      console.log(`[LLM Extractor] Batch ${batchIndex} completed in ${duration}ms, extracted ${batchResults.size} CKB results`);
      
      return batchResults;
    } catch (error) {
      console.error(`[LLM Extractor] Batch ${batchIndex} failed after all retries:`, error.message);
      
      // Fallback: 尝试单个处理
      console.log(`[LLM Extractor] Attempting fallback to individual processing for batch ${batchIndex}`);
      return await this._fallbackToIndividualProcessing(batch, llmClient);
    }
  }
  
  /**
   * 构建批量prompt
   * 
   * @param {Array} batch - 批次中的CKB
   * @returns {string} 批量prompt
   */
  _buildBatchPrompt(batch) {
    const ckbTexts = batch.map((item, index) => {
      const fieldNames = item.missingFields.map(f => f.name).join('、');
      const text = item.ckb.content?.text || '';
      // 截断到前100字符以减少token消耗
      const truncatedText = text.length > 100 ? text.substring(0, 100) + '...' : text;
      
      return `CKB ${index}:\n文本: ${truncatedText}\n字段: ${fieldNames}`;
    }).join('\n---\n');
    
    const prompt = `提取字段，不存在返回null。

${ckbTexts}

返回JSON:
{
  "ckb_0": [{"name": "地点", "value": "海南", "confidence": 0.9}],
  "ckb_1": [{"name": "单位", "value": null, "confidence": 0}]
}`;
    
    return prompt;
  }
  
  /**
   * 调用LLM（带重试和指数退避）
   * 
   * @param {Object} llmClient - LLM客户端
   * @param {string} prompt - Prompt
   * @returns {Promise<string>} LLM响应
   */
  async _callLLMWithRetry(llmClient, prompt) {
      let lastError = null;

      for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
        try {
          console.log(`[LLM Extractor] Calling LLM (attempt ${attempt}/${this.maxRetries})...`);

          const response = await llmClient.call(prompt, {
            systemPrompt: '提取字段，返回JSON。',
            temperature: this.temperature
          });

          return response.content || response || '';
        } catch (error) {
          lastError = error;

          if (error.name === 'AbortError') {
            console.error(`[LLM Extractor] Attempt ${attempt} timed out after ${this.timeout}ms`);
          } else {
            console.error(`[LLM Extractor] Attempt ${attempt} failed:`, error.message);
          }

          // 如果不是最后一次尝试，使用指数退避等待后重试
          if (attempt < this.maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // 指数退避，最大10秒
            console.log(`[LLM Extractor] Retrying in ${delay}ms (exponential backoff)...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      throw new Error(`LLM call failed after ${this.maxRetries} attempts: ${lastError?.message}`);
    }
  
  /**
   * 解析批量响应
   * 
   * @param {string} response - LLM响应
   * @param {Array} batch - 批次中的CKB
   * @returns {Map} 解析后的结果
   */
  _parseBatchResponse(response, batch) {
    const results = new Map();
    
    try {
      // 尝试提取JSON（可能被markdown包裹）
      let jsonStr = response.trim();
      
      // 移除markdown代码块标记
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.substring(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.substring(3);
      }
      
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3);
      }
      
      jsonStr = jsonStr.trim();
      
      // 解析JSON
      const parsed = JSON.parse(jsonStr);
      
      // 处理每个CKB的结果
      batch.forEach((item, index) => {
        const key = `ckb_${index}`;
        const ckbFields = parsed[key];
        
        if (ckbFields && Array.isArray(ckbFields)) {
          // 过滤掉null值的字段
          const validFields = ckbFields
            .filter(f => f.value !== null && f.value !== undefined && f.value !== '')
            .map(f => ({
              name: f.name,
              value: f.value,
              type: this._inferFieldType(f.name),
              confidence: f.confidence || 0.8,
              sources: ['llm']
            }));
          
          if (validFields.length > 0) {
            results.set(item.ckb.ckb_id, validFields);
          }
        }
      });
      
      console.log(`[LLM Extractor] Parsed ${results.size} CKB results from batch`);
    } catch (error) {
      console.error('[LLM Extractor] Failed to parse batch response:', error.message);
      console.error('[LLM Extractor] Response:', response.substring(0, 500));
      
      // 尝试修复JSON
      try {
        const fixed = this._fixJSON(response);
        if (fixed) {
          return this._parseBatchResponse(fixed, batch);
        }
      } catch (e) {
        // 修复失败，返回空结果
      }
    }
    
    return results;
  }
  
  /**
   * 尝试修复JSON
   * 
   * @param {string} jsonStr - 可能损坏的JSON字符串
   * @returns {string|null} 修复后的JSON或null
   */
  _fixJSON(jsonStr) {
    // 简单的修复策略
    try {
      // 移除多余的逗号
      let fixed = jsonStr.replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
      
      // 尝试解析
      JSON.parse(fixed);
      return fixed;
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Fallback到单个处理
   * 
   * @param {Array} batch - 批次中的CKB
   * @param {Object} llmClient - LLM客户端
   * @returns {Promise<Map>} 结果
   */
  async _fallbackToIndividualProcessing(batch, llmClient) {
    console.log(`[LLM Extractor] Falling back to individual processing for ${batch.length} CKBs`);
    
    const results = new Map();
    
    for (const item of batch) {
      try {
        const fields = await this.extractMissingFields(item.ckb, item.missingFields, llmClient);
        if (fields.length > 0) {
          results.set(item.ckb.ckb_id, fields);
        }
      } catch (error) {
        console.error(`[LLM Extractor] Individual extraction failed for CKB ${item.ckb.ckb_id}:`, error.message);
      }
    }
    
    return results;
  }
  
  /**
   * 单个CKB提取（fallback）
   * 
   * @param {Object} ckb - CKB对象
   * @param {Array} missingFields - 缺失的字段
   * @param {Object} llmClient - LLM客户端
   * @returns {Promise<Array>} 提取的字段
   */
  async extractMissingFields(ckb, missingFields, llmClient) {
    const text = ckb.content?.text || '';
    const fieldNames = missingFields.map(f => f.name).join('、');
    
    const prompt = `请从以下文本中提取指定的字段。如果字段不存在，返回null。

文本: ${text}
需要提取的字段: ${fieldNames}

返回JSON格式:
[
  {"name": "地点", "value": "海南省海口市", "confidence": 0.9},
  {"name": "单位", "value": null, "confidence": 0}
]`;
    
    try {
      const response = await this._callLLMWithRetry(llmClient, prompt);
      
      // 解析响应
      let jsonStr = response.trim();
      if (jsonStr.startsWith('```json')) {
        jsonStr = jsonStr.substring(7);
      } else if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.substring(3);
      }
      if (jsonStr.endsWith('```')) {
        jsonStr = jsonStr.substring(0, jsonStr.length - 3);
      }
      
      const parsed = JSON.parse(jsonStr.trim());
      
      // 过滤并格式化结果
      return parsed
        .filter(f => f.value !== null && f.value !== undefined && f.value !== '')
        .map(f => ({
          name: f.name,
          value: f.value,
          type: this._inferFieldType(f.name),
          confidence: f.confidence || 0.8,
          sources: ['llm']
        }));
    } catch (error) {
      console.error(`[LLM Extractor] Single extraction failed:`, error.message);
      return [];
    }
  }
  
  /**
   * 推断字段类型
   * 
   * @param {string} fieldName - 字段名
   * @returns {string} 字段类型
   */
  _inferFieldType(fieldName) {
    if (fieldName.includes('地点') || fieldName.includes('位置') || fieldName.includes('区域')) {
      return FieldType.LOCATION;
    }
    if (fieldName.includes('单位') || fieldName.includes('公司') || fieldName.includes('组织')) {
      return FieldType.ENTITY;
    }
    if (fieldName.includes('时间') || fieldName.includes('日期')) {
      return FieldType.TIME;
    }
    if (fieldName.includes('数值') || fieldName.includes('金额') || fieldName.includes('数量')) {
      return FieldType.NUMBER;
    }
    return FieldType.TEXT;
  }
  
  /**
   * 创建批次
   * 
   * @param {Array} items - 所有项目
   * @param {number} batchSize - 批次大小
   * @returns {Array} 批次数组
   */
  _createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
  
  /**
   * 获取统计信息
   * 
   * @param {Map} results - 提取结果
   * @returns {Object} 统计信息
   */
  getStats(results) {
    let totalFields = 0;
    const fieldCounts = new Map();
    
    results.forEach(fields => {
      totalFields += fields.length;
      fields.forEach(field => {
        fieldCounts.set(field.name, (fieldCounts.get(field.name) || 0) + 1);
      });
    });
    
    return {
      ckbsProcessed: results.size,
      totalFields,
      avgFieldsPerCKB: results.size > 0 ? (totalFields / results.size).toFixed(2) : 0,
      fieldDistribution: Object.fromEntries(fieldCounts)
    };
  }
}

module.exports = LLMFieldExtractor;
