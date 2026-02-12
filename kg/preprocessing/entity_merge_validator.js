/**
 * Entity Merge Validator
 * 
 * 基于索引叙述文本验证实体合并决策的准确性
 * 
 * 核心功能：
 * 1. 验证实体合并决策是否符合索引描述的事实
 * 2. 在索引中查找两个实体的提及
 * 3. 判断它们是否指向同一个现实对象
 * 4. 基于索引中的明确信息做出合并决策
 * 
 * Requirements: 5.1, 5.3
 */

const PQueue = require('p-queue').default;

class EntityMergeValidator {
  constructor(options = {}) {
    this.temperature = options.temperature || parseFloat(process.env.LLM_TEMPERATURE) || 0.1;
    this.timeout = options.timeout || parseInt(process.env.LLM_TIMEOUT) || 10000; // 10秒超时
    this.maxRetries = options.maxRetries || parseInt(process.env.LLM_MAX_RETRIES) || 2;
    
    console.log(`[Entity Merge Validator] Initialized with timeout=${this.timeout}ms, retries=${this.maxRetries}`);
  }
  
  /**
   * 验证实体合并决策
   * 
   * @param {Object} entity1 - 实体1
   * @param {Object} entity2 - 实体2
   * @param {string} indexedText - 索引叙述文本
   * @param {Object} llmClient - LLM客户端
   * @returns {Promise<Object>} 验证结果
   */
  async validateMergeDecision(entity1, entity2, indexedText, llmClient) {
    if (!indexedText) {
      console.warn('[Entity Merge Validator] Missing indexedText, skipping validation');
      return {
        shouldMerge: false,
        confidence: 0.5,
        reason: 'No indexed text available',
        validated: false
      };
    }
    
    if (!entity1 || !entity2) {
      console.warn('[Entity Merge Validator] Missing entities, skipping validation');
      return {
        shouldMerge: false,
        confidence: 0.5,
        reason: 'Missing entities',
        validated: false
      };
    }
    
    if (!llmClient) {
      console.warn('[Entity Merge Validator] No LLM client provided, cannot validate');
      return {
        shouldMerge: false,
        confidence: 0.5,
        reason: 'No LLM client for validation',
        validated: false
      };
    }
    
    try {
      console.log(`[Entity Merge Validator] Validating merge decision for entities: ${entity1.canonical_name || entity1.name} vs ${entity2.canonical_name || entity2.name}`);
      
      // 构建验证prompt
      const prompt = this._buildValidationPrompt(entity1, entity2, indexedText);
      
      // 调用LLM验证
      const response = await this._callLLMWithRetry(llmClient, prompt);
      
      // 解析响应
      const result = this._parseValidationResponse(response);
      
      console.log(`[Entity Merge Validator] Validation complete: shouldMerge=${result.shouldMerge}, confidence=${result.confidence}`);
      
      return result;
    } catch (error) {
      console.error('[Entity Merge Validator] Validation failed:', error.message);
      return {
        shouldMerge: false,
        confidence: 0.5,
        reason: 'Validation failed',
        error: error.message,
        validated: false
      };
    }
  }
  
  /**
   * 构建验证prompt
   * 
   * @param {Object} entity1 - 实体1
   * @param {Object} entity2 - 实体2
   * @param {string} indexedText - 索引叙述文本
   * @returns {string} Prompt
   * @private
   */
  _buildValidationPrompt(entity1, entity2, indexedText) {
    // 格式化实体1的属性
    const entity1Name = entity1.canonical_name || entity1.name || '未知实体';
    const entity1Attrs = this._formatEntityAttributes(entity1);
    
    // 格式化实体2的属性
    const entity2Name = entity2.canonical_name || entity2.name || '未知实体';
    const entity2Attrs = this._formatEntityAttributes(entity2);
    
    const prompt = `你是一个实体消歧验证器。

请基于"索引叙述文本"，验证两个实体是否应该合并。

索引叙述文本：
${indexedText}

待验证的实体：
- 实体1：${entity1Name}
  属性：${entity1Attrs}
  
- 实体2：${entity2Name}
  属性：${entity2Attrs}

任务：
1. 在索引文本中查找这两个实体的提及
2. 判断它们是否指向同一个现实对象
3. 只基于索引文本中的明确信息，不要推理

输出 JSON：
{
  "should_merge": true/false,
  "reason": "判断理由（引用索引文本中的具体条目）",
  "confidence": 0.9,
  "evidence_indices": [1, 3]
}`;
    
    return prompt;
  }
  
  /**
   * 格式化实体属性
   * 
   * @param {Object} entity - 实体对象
   * @returns {string} 格式化的属性字符串
   * @private
   */
  _formatEntityAttributes(entity) {
    const attrs = [];
    
    // 添加实体类型
    if (entity.entity_type) {
      attrs.push(`类型=${entity.entity_type}`);
    }
    
    // 添加锚点字段
    if (entity.anchor_fields && Object.keys(entity.anchor_fields).length > 0) {
      const anchorStr = Object.entries(entity.anchor_fields)
        .map(([key, value]) => `${key}=${this._formatValue(value)}`)
        .join(', ');
      attrs.push(`锚点字段={${anchorStr}}`);
    }
    
    // 添加关键字段（最多5个）
    if (entity.fields && Object.keys(entity.fields).length > 0) {
      const fieldEntries = Object.entries(entity.fields).slice(0, 5);
      const fieldsStr = fieldEntries
        .map(([key, value]) => `${key}=${this._formatValue(value)}`)
        .join(', ');
      attrs.push(`字段={${fieldsStr}}`);
    }
    
    return attrs.join('; ') || '无属性';
  }
  
  /**
   * 格式化字段值
   * 
   * @param {*} value - 字段值
   * @returns {string} 格式化的值
   * @private
   */
  _formatValue(value) {
    if (value === null || value === undefined) {
      return 'null';
    }
    if (Array.isArray(value)) {
      return value.slice(0, 3).join(',');
    }
    if (typeof value === 'object') {
      return JSON.stringify(value).substring(0, 50);
    }
    const str = String(value);
    return str.length > 50 ? str.substring(0, 50) + '...' : str;
  }
  
  /**
   * 解析验证响应
   * 
   * @param {string} response - LLM响应
   * @returns {Object} 解析后的验证结果
   * @private
   */
  _parseValidationResponse(response) {
    try {
      // 提取JSON
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
      
      return {
        shouldMerge: parsed.should_merge === true,
        reason: parsed.reason || 'LLM validation completed',
        confidence: parsed.confidence || 0.5,
        evidenceIndices: parsed.evidence_indices || [],
        validated: true
      };
    } catch (error) {
      console.error('[Entity Merge Validator] Failed to parse validation response:', error.message);
      console.error('[Entity Merge Validator] Response:', response.substring(0, 500));
      
      return {
        shouldMerge: false,
        confidence: 0.5,
        reason: 'Failed to parse validation response',
        parseError: error.message,
        validated: false
      };
    }
  }
  
  /**
   * 调用LLM（带重试和指数退避）
   * 
   * @param {Object} llmClient - LLM客户端
   * @param {string} prompt - Prompt
   * @returns {Promise<string>} LLM响应
   * @private
   */
  async _callLLMWithRetry(llmClient, prompt) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        console.log(`[Entity Merge Validator] Calling LLM (attempt ${attempt}/${this.maxRetries})...`);
        
        // 创建超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
          const response = await llmClient.chat({
            messages: [
              {
                role: 'system',
                content: '你是一个实体消歧验证器。请基于索引叙述文本验证实体合并决策，返回JSON。'
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            temperature: this.temperature,
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          return response.content || response.message?.content || '';
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error;
        
        if (error.name === 'AbortError') {
          console.error(`[Entity Merge Validator] Attempt ${attempt} timed out after ${this.timeout}ms`);
        } else {
          console.error(`[Entity Merge Validator] Attempt ${attempt} failed:`, error.message);
        }
        
        // 如果不是最后一次尝试，使用指数退避等待后重试
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[Entity Merge Validator] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`LLM call failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }
  
  /**
   * 批量验证多个实体合并决策
   * 
   * @param {Array} mergePairs - 合并对数组 [{entity1, entity2, indexedText}]
   * @param {Object} llmClient - LLM客户端
   * @param {Object} options - 选项
   * @returns {Promise<Map>} Map<pair key, validation result>
   */
  async batchValidateMerges(mergePairs, llmClient, options = {}) {
    if (!mergePairs || mergePairs.length === 0) {
      return new Map();
    }
    
    if (!llmClient) {
      console.warn('[Entity Merge Validator] No LLM client provided, skipping batch validation');
      return new Map();
    }
    
    const { maxConcurrency = 3 } = options;
    const queue = new PQueue({ concurrency: maxConcurrency });
    const results = new Map();
    
    console.log(`[Entity Merge Validator] Batch validating ${mergePairs.length} merge decisions`);
    
    const promises = mergePairs.map((pair, index) => {
      return queue.add(async () => {
        const result = await this.validateMergeDecision(
          pair.entity1,
          pair.entity2,
          pair.indexedText,
          llmClient
        );
        
        // 使用实体ID组合作为key
        const key = `${pair.entity1.entity_id}_${pair.entity2.entity_id}`;
        results.set(key, result);
      });
    });
    
    await Promise.all(promises);
    
    console.log(`[Entity Merge Validator] Batch validation complete: ${results.size} results`);
    
    return results;
  }
  
  /**
   * 获取验证统计信息
   * 
   * @param {Map} validationResults - 验证结果Map
   * @returns {Object} 统计信息
   */
  getValidationStats(validationResults) {
    let totalPairs = 0;
    let shouldMergePairs = 0;
    let shouldNotMergePairs = 0;
    let validatedPairs = 0;
    let avgConfidence = 0;
    
    validationResults.forEach(result => {
      totalPairs++;
      if (result.shouldMerge) {
        shouldMergePairs++;
      } else {
        shouldNotMergePairs++;
      }
      if (result.validated) {
        validatedPairs++;
      }
      avgConfidence += result.confidence || 0;
    });
    
    return {
      totalPairs,
      shouldMergePairs,
      shouldNotMergePairs,
      mergeRate: totalPairs > 0 ? (shouldMergePairs / totalPairs).toFixed(2) : 0,
      validatedPairs,
      validationRate: totalPairs > 0 ? (validatedPairs / totalPairs).toFixed(2) : 0,
      avgConfidence: totalPairs > 0 ? (avgConfidence / totalPairs).toFixed(2) : 0
    };
  }
  
  /**
   * 智能触发判断：是否需要调用LLM验证
   * 
   * 当前策略：只在合并决策与索引冲突时调用
   * 由于我们无法在不调用LLM的情况下判断是否冲突，
   * 这个方法主要用于外部调用者决定是否需要验证
   * 
   * @param {Object} entity1 - 实体1
   * @param {Object} entity2 - 实体2
   * @param {Object} context - 上下文信息
   * @returns {boolean} 是否需要LLM验证
   */
  shouldCallLLM(entity1, entity2, context = {}) {
    // 如果没有索引文本，不需要验证
    if (!context.indexedText) {
      return false;
    }
    
    // 如果实体类型不同，通常不应该合并，需要验证
    if (entity1.entity_type && entity2.entity_type && 
        entity1.entity_type !== entity2.entity_type) {
      return true;
    }
    
    // 如果锚点指纹相同，通常应该合并，不需要额外验证
    if (entity1.anchor_fingerprint && entity2.anchor_fingerprint &&
        entity1.anchor_fingerprint === entity2.anchor_fingerprint) {
      return false;
    }
    
    // 如果锚点指纹不同，需要验证是否应该合并
    if (entity1.anchor_fingerprint && entity2.anchor_fingerprint &&
        entity1.anchor_fingerprint !== entity2.anchor_fingerprint) {
      return true;
    }
    
    // 默认情况下，如果有合并意图，需要验证
    return context.hasMergeIntent || false;
  }
}

module.exports = EntityMergeValidator;
