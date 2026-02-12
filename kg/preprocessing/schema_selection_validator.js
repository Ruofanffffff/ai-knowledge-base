/**
 * Schema Selection Validator
 * 
 * 基于索引叙述文本验证Schema选择的准确性
 * 
 * 核心功能：
 * 1. 验证Schema选择是否符合索引描述的事实
 * 2. 检查核心字段是否在索引中有支持
 * 3. 对低置信度匹配进行二次验证
 * 4. 提供Schema选择建议
 * 
 * Requirements: 4.1, 4.2, 4.3
 */

const PQueue = require('p-queue').default;

class SchemaSelectionValidator {
  constructor(options = {}) {
    this.temperature = options.temperature || parseFloat(process.env.LLM_TEMPERATURE) || 0.1;
    this.timeout = options.timeout || parseInt(process.env.LLM_TIMEOUT) || 10000; // 10秒超时
    this.maxRetries = options.maxRetries || parseInt(process.env.LLM_MAX_RETRIES) || 2;
    this.confidenceThreshold = options.confidenceThreshold || 0.75; // 低置信度阈值
    
    console.log(`[Schema Validator] Initialized with timeout=${this.timeout}ms, retries=${this.maxRetries}, threshold=${this.confidenceThreshold}`);
  }
  
  /**
   * 验证Schema选择
   * 
   * @param {Object} schemaMatch - Schema匹配结果
   * @param {string} indexedText - 索引叙述文本
   * @param {Object} llmClient - LLM客户端
   * @returns {Promise<Object>} 验证结果
   */
  async validateSchemaSelection(schemaMatch, indexedText, llmClient) {
    if (!indexedText) {
      console.warn('[Schema Validator] Missing indexedText, skipping validation');
      return {
        isAppropriate: true,
        confidence: 1.0,
        reason: 'No indexed text available',
        needsRevalidation: false
      };
    }
    
    if (!schemaMatch || !schemaMatch.schema) {
      console.warn('[Schema Validator] Missing schemaMatch, skipping validation');
      return {
        isAppropriate: true,
        confidence: 1.0,
        reason: 'No schema match provided',
        needsRevalidation: false
      };
    }
    
    // 检查是否需要二次验证（低置信度）
    const needsRevalidation = this._needsRevalidation(schemaMatch);
    
    if (!needsRevalidation) {
      console.log(`[Schema Validator] Schema ${schemaMatch.schema.schema_name} has high confidence (${schemaMatch.completeness.toFixed(2)}), skipping validation`);
      return {
        isAppropriate: true,
        confidence: schemaMatch.completeness,
        reason: 'High confidence match',
        needsRevalidation: false
      };
    }
    
    if (!llmClient) {
      console.warn('[Schema Validator] No LLM client provided, cannot validate low confidence match');
      return {
        isAppropriate: true,
        confidence: schemaMatch.completeness,
        reason: 'No LLM client for revalidation',
        needsRevalidation: true,
        skipped: true
      };
    }
    
    try {
      console.log(`[Schema Validator] Validating schema ${schemaMatch.schema.schema_name} (confidence: ${schemaMatch.completeness.toFixed(2)})`);
      
      // 构建验证prompt
      const prompt = this._buildValidationPrompt(schemaMatch, indexedText);
      
      // 调用LLM验证
      const response = await this._callLLMWithRetry(llmClient, prompt);
      
      // 解析响应
      const result = this._parseValidationResponse(response, schemaMatch);
      
      console.log(`[Schema Validator] Validation complete: appropriate=${result.isAppropriate}, confidence=${result.confidence}`);
      
      return result;
    } catch (error) {
      console.error('[Schema Validator] Validation failed:', error.message);
      return {
        isAppropriate: true,
        confidence: schemaMatch.completeness,
        reason: 'Validation failed, using original match',
        error: error.message,
        needsRevalidation: true
      };
    }
  }
  
  /**
   * 检查是否需要二次验证
   * 
   * @param {Object} schemaMatch - Schema匹配结果
   * @returns {boolean} 是否需要验证
   * @private
   */
  _needsRevalidation(schemaMatch) {
    // 低置信度需要验证
    if (schemaMatch.completeness < this.confidenceThreshold) {
      return true;
    }
    
    // 如果有多个缺失的必需字段，也需要验证
    const missingRequiredFields = (schemaMatch.missing_fields || [])
      .filter(f => f.required === true);
    
    if (missingRequiredFields.length > 0) {
      return true;
    }
    
    return false;
  }
  
  /**
   * 构建验证prompt
   * 
   * @param {Object} schemaMatch - Schema匹配结果
   * @param {string} indexedText - 索引叙述文本
   * @returns {string} Prompt
   * @private
   */
  _buildValidationPrompt(schemaMatch, indexedText) {
    const schema = schemaMatch.schema;
    const extractedFields = schemaMatch.matched_fields || [];
    const missingFields = schemaMatch.missing_fields || [];
    
    // 格式化已提取字段
    const fieldsJson = JSON.stringify(
      extractedFields.map(f => ({
        name: f,
        matched: true
      })),
      null,
      2
    );
    
    // 格式化核心字段
    const coreFieldsJson = JSON.stringify(
      schema.core_fields.map(cf => ({
        name: cf.name,
        weight: cf.weight,
        required: cf.required
      })),
      null,
      2
    );
    
    const prompt = `你是一个 Schema 验证器。

请基于"索引叙述文本"，验证当前选择的 Schema 是否合适。

索引叙述文本：
${indexedText}

当前选择的Schema：
- Schema名称：${schema.schema_name}
- 实体类型：${schema.entity_type || '未指定'}
- 场景描述：${schema.scene || '未指定'}
- 核心字段：
${coreFieldsJson}

已提取字段：
${fieldsJson}

缺失字段：${missingFields.join('、') || '无'}

任务：
1. 判断索引文本描述的事实是否符合该 Schema 的定义
2. 检查核心字段是否在索引文本中有明确支持
3. 如果不合适，说明原因

输出 JSON：
{
  "is_appropriate": true/false,
  "reason": "验证理由",
  "confidence": 0.9,
  "supported_fields": ["字段1", "字段2"],
  "unsupported_fields": ["字段3"]
}`;
    
    return prompt;
  }
  
  /**
   * 解析验证响应
   * 
   * @param {string} response - LLM响应
   * @param {Object} schemaMatch - 原始Schema匹配结果
   * @returns {Object} 解析后的验证结果
   * @private
   */
  _parseValidationResponse(response, schemaMatch) {
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
        isAppropriate: parsed.is_appropriate !== false, // 默认为true
        reason: parsed.reason || 'LLM validation completed',
        confidence: parsed.confidence || schemaMatch.completeness,
        supportedFields: parsed.supported_fields || [],
        unsupportedFields: parsed.unsupported_fields || [],
        needsRevalidation: false,
        validated: true
      };
    } catch (error) {
      console.error('[Schema Validator] Failed to parse validation response:', error.message);
      console.error('[Schema Validator] Response:', response.substring(0, 500));
      
      return {
        isAppropriate: true,
        confidence: schemaMatch.completeness,
        reason: 'Failed to parse validation response, using original match',
        parseError: error.message,
        needsRevalidation: false
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
        console.log(`[Schema Validator] Calling LLM (attempt ${attempt}/${this.maxRetries})...`);
        
        // 创建超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
          const response = await llmClient.chat({
            messages: [
              {
                role: 'system',
                content: '你是一个Schema验证器。请基于索引叙述文本验证Schema选择，返回JSON。'
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
          console.error(`[Schema Validator] Attempt ${attempt} timed out after ${this.timeout}ms`);
        } else {
          console.error(`[Schema Validator] Attempt ${attempt} failed:`, error.message);
        }
        
        // 如果不是最后一次尝试，使用指数退避等待后重试
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[Schema Validator] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`LLM call failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }
  
  /**
   * 批量验证多个Schema匹配
   * 
   * @param {Array} schemaMatches - Schema匹配数组 [{schemaMatch, indexedText}]
   * @param {Object} llmClient - LLM客户端
   * @param {Object} options - 选项
   * @returns {Promise<Map>} Map<Schema名称, validation result>
   */
  async batchValidateSchemas(schemaMatches, llmClient, options = {}) {
    if (!schemaMatches || schemaMatches.length === 0) {
      return new Map();
    }
    
    if (!llmClient) {
      console.warn('[Schema Validator] No LLM client provided, skipping batch validation');
      return new Map();
    }
    
    const { maxConcurrency = 3 } = options;
    const queue = new PQueue({ concurrency: maxConcurrency });
    const results = new Map();
    
    console.log(`[Schema Validator] Batch validating ${schemaMatches.length} schema matches`);
    
    const promises = schemaMatches.map(item => {
      return queue.add(async () => {
        const result = await this.validateSchemaSelection(
          item.schemaMatch,
          item.indexedText,
          llmClient
        );
        results.set(item.schemaMatch.schema.schema_name, result);
      });
    });
    
    await Promise.all(promises);
    
    console.log(`[Schema Validator] Batch validation complete: ${results.size} results`);
    
    return results;
  }
  
  /**
   * 获取验证统计信息
   * 
   * @param {Map} validationResults - 验证结果Map
   * @returns {Object} 统计信息
   */
  getValidationStats(validationResults) {
    let totalSchemas = 0;
    let appropriateSchemas = 0;
    let revalidatedSchemas = 0;
    let avgConfidence = 0;
    
    validationResults.forEach(result => {
      totalSchemas++;
      if (result.isAppropriate) {
        appropriateSchemas++;
      }
      if (result.validated) {
        revalidatedSchemas++;
      }
      avgConfidence += result.confidence || 0;
    });
    
    return {
      totalSchemas,
      appropriateSchemas,
      inappropriateSchemas: totalSchemas - appropriateSchemas,
      appropriateRate: totalSchemas > 0 ? (appropriateSchemas / totalSchemas).toFixed(2) : 0,
      revalidatedSchemas,
      revalidationRate: totalSchemas > 0 ? (revalidatedSchemas / totalSchemas).toFixed(2) : 0,
      avgConfidence: totalSchemas > 0 ? (avgConfidence / totalSchemas).toFixed(2) : 0
    };
  }
  
  /**
   * 智能触发判断：是否需要调用LLM验证
   * 
   * @param {Object} schemaMatch - Schema匹配结果
   * @returns {boolean} 是否需要LLM验证
   */
  shouldCallLLM(schemaMatch) {
    return this._needsRevalidation(schemaMatch);
  }
}

module.exports = SchemaSelectionValidator;
