/**
 * Field Extraction Validator
 * 
 * 基于索引叙述文本验证字段提取完整性，并补充遗漏的字段
 * 
 * 核心功能：
 * 1. 验证字段提取完整性
 * 2. 识别索引中提到但未被提取的实体和属性
 * 3. 补充提取遗漏的字段
 * 4. 计算覆盖率
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4
 */

const PQueue = require('p-queue').default;
const preprocessingMonitor = require('./preprocessing_monitor');

class FieldExtractionValidator {
  constructor(options = {}) {
    this.temperature = options.temperature || parseFloat(process.env.LLM_TEMPERATURE) || 0.1;
    this.timeout = options.timeout || parseInt(process.env.LLM_TIMEOUT) || 15000; // 15秒超时
    this.maxRetries = options.maxRetries || parseInt(process.env.LLM_MAX_RETRIES) || 2;
    this.coverageThreshold = options.coverageThreshold || 0.8; // 覆盖率阈值
    
    console.log(`[Field Validator] Initialized with timeout=${this.timeout}ms, retries=${this.maxRetries}, threshold=${this.coverageThreshold}`);
  }
  
  /**
   * 验证字段提取完整性
   * 
   * @param {Array} extractedFields - 已提取的字段
   * @param {string} indexedText - 索引叙述文本
   * @param {Object} ckb - CKB对象
   * @param {Object} llmClient - LLM客户端
   * @returns {Promise<Object>} 验证结果
   */
  async validateFields(extractedFields, indexedText, ckb, llmClient) {
    const startTime = Date.now();
    
    if (!indexedText || !ckb) {
      console.warn('[Field Validator] Missing indexedText or ckb, skipping validation');
      return {
        isValid: true,
        coverageRate: 1.0,
        missingFields: [],
        reason: 'No indexed text available'
      };
    }
    
    if (!llmClient) {
      console.warn('[Field Validator] No LLM client provided, skipping validation');
      return {
        isValid: true,
        coverageRate: 1.0,
        missingFields: [],
        reason: 'No LLM client'
      };
    }
    
    try {
      console.log(`[Field Validator] Validating ${extractedFields.length} extracted fields against indexed text`);
      
      // 构建验证prompt
      const prompt = this._buildValidationPrompt(extractedFields, indexedText, ckb);
      
      // 调用LLM验证
      const response = await this._callLLMWithRetry(llmClient, prompt);
      
      // 解析响应
      const result = this._parseValidationResponse(response);
      
      const duration = Date.now() - startTime;
      console.log(`[Field Validator] Validation complete: coverage=${result.coverageRate}, missing=${result.missingFields.length}`);
      
      // Record validation metrics
      preprocessingMonitor.recordValidation({
        doc_id: ckb.doc_id,
        stage: 'field_extraction',
        duration,
        items_validated: extractedFields.length,
        validation_passed: result.isValid ? extractedFields.length : 0,
        validation_failed: result.isValid ? 0 : extractedFields.length,
        coverage_rate: result.coverageRate,
        success: true,
        metadata: {
          missing_fields_count: result.missingFields.length
        }
      });
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('[Field Validator] Validation failed:', error.message);
      
      // Record failure
      preprocessingMonitor.recordValidation({
        doc_id: ckb.doc_id,
        stage: 'field_extraction',
        duration,
        items_validated: extractedFields.length,
        validation_passed: 0,
        validation_failed: 0,
        coverage_rate: 1.0,
        success: false,
        error: error.message
      });
      
      return {
        isValid: true,
        coverageRate: 1.0,
        missingFields: [],
        error: error.message
      };
    }
  }
  
  /**
   * 补充遗漏的字段
   * 
   * @param {Array} missingFields - 遗漏的字段信息
   * @param {Object} ckb - CKB对象
   * @param {Object} llmClient - LLM客户端
   * @returns {Promise<Array>} 补充的字段
   */
  async supplementFields(missingFields, ckb, llmClient) {
    if (!missingFields || missingFields.length === 0) {
      return [];
    }
    
    if (!llmClient) {
      console.warn('[Field Validator] No LLM client provided, cannot supplement fields');
      return [];
    }
    
    try {
      console.log(`[Field Validator] Supplementing ${missingFields.length} missing fields`);
      
      const text = ckb.content?.text || '';
      const fieldNames = missingFields.map(f => f.name).join('、');
      
      // 构建补充提取prompt
      const prompt = `请从以下文本中提取指定的字段。如果字段不存在，返回null。

文本: ${text}
需要提取的字段: ${fieldNames}

返回JSON格式:
[
  {"name": "地点", "value": "海南省海口市", "confidence": 0.9},
  {"name": "单位", "value": null, "confidence": 0}
]`;
      
      // 调用LLM提取
      const response = await this._callLLMWithRetry(llmClient, prompt);
      
      // 解析响应
      const supplementedFields = this._parseSupplementResponse(response);
      
      console.log(`[Field Validator] Supplemented ${supplementedFields.length} fields`);
      
      return supplementedFields;
    } catch (error) {
      console.error('[Field Validator] Supplement failed:', error.message);
      return [];
    }
  }
  
  /**
   * 构建验证prompt
   * 
   * @param {Array} extractedFields - 已提取的字段
   * @param {string} indexedText - 索引叙述文本
   * @param {Object} ckb - CKB对象
   * @returns {string} Prompt
   */
  _buildValidationPrompt(extractedFields, indexedText, ckb) {
    const ckbText = ckb.content?.text || '';
    
    // 格式化已提取字段
    const fieldsJson = JSON.stringify(
      extractedFields.map(f => ({
        name: f.name,
        value: f.value
      })),
      null,
      2
    );
    
    const prompt = `你是一个字段提取验证器。

请基于"索引叙述文本"，检查字段提取结果的完整性。

索引叙述文本：
${indexedText}

已提取字段：
${fieldsJson}

CKB文本：
${ckbText.substring(0, 500)}${ckbText.length > 500 ? '...' : ''}

任务：
1. 识别索引文本中提到但未被提取的实体和属性
2. 从CKB文本中补充提取这些遗漏的字段
3. 不要推理，只提取明确提到的内容

输出 JSON：
{
  "missing_fields": [
    {
      "name": "字段名",
      "value": "字段值",
      "type": "字段类型",
      "source_index": 1,
      "confidence": 0.9
    }
  ],
  "coverage_rate": 0.85
}`;
    
    return prompt;
  }
  
  /**
   * 解析验证响应
   * 
   * @param {string} response - LLM响应
   * @returns {Object} 解析后的验证结果
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
      
      const missingFields = (parsed.missing_fields || [])
        .filter(f => f.value !== null && f.value !== undefined && f.value !== '')
        .map(f => ({
          name: f.name,
          value: f.value,
          type: f.type || 'text',
          confidence: f.confidence || 0.8,
          sourceIndex: f.source_index,
          sources: ['llm_validation']
        }));
      
      const coverageRate = parsed.coverage_rate || 1.0;
      
      return {
        isValid: coverageRate >= this.coverageThreshold,
        coverageRate,
        missingFields,
        needsSupplement: missingFields.length > 0
      };
    } catch (error) {
      console.error('[Field Validator] Failed to parse validation response:', error.message);
      console.error('[Field Validator] Response:', response.substring(0, 500));
      
      return {
        isValid: true,
        coverageRate: 1.0,
        missingFields: [],
        parseError: error.message
      };
    }
  }
  
  /**
   * 解析补充提取响应
   * 
   * @param {string} response - LLM响应
   * @returns {Array} 补充的字段
   */
  _parseSupplementResponse(response) {
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
      
      // 过滤并格式化结果
      return parsed
        .filter(f => f.value !== null && f.value !== undefined && f.value !== '')
        .map(f => ({
          name: f.name,
          value: f.value,
          type: this._inferFieldType(f.name),
          confidence: f.confidence || 0.8,
          sources: ['llm_supplement']
        }));
    } catch (error) {
      console.error('[Field Validator] Failed to parse supplement response:', error.message);
      console.error('[Field Validator] Response:', response.substring(0, 500));
      return [];
    }
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
    const overallStartTime = Date.now();
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      const attemptStartTime = Date.now();
      
      try {
        console.log(`[Field Validator] Calling LLM (attempt ${attempt}/${this.maxRetries})...`);
        
        // 创建超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
          const response = await llmClient.chat({
            messages: [
              {
                role: 'system',
                content: '你是一个字段提取验证器。请基于索引叙述文本验证字段完整性，返回JSON。'
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
          
          // Record successful LLM call
          const duration = Date.now() - attemptStartTime;
          preprocessingMonitor.recordPreprocessingLLMCall({
            stage: 'field_validation',
            operation: 'validate_fields',
            duration,
            success: true,
            timeout: false,
            tokens: response.tokens || 0
          });
          
          return response.content || response.message?.content || '';
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        lastError = error;
        const duration = Date.now() - attemptStartTime;
        
        if (error.name === 'AbortError') {
          console.error(`[Field Validator] Attempt ${attempt} timed out after ${this.timeout}ms`);
          
          // Record timeout
          preprocessingMonitor.recordPreprocessingLLMCall({
            stage: 'field_validation',
            operation: 'validate_fields',
            duration,
            success: false,
            timeout: true
          });
        } else {
          console.error(`[Field Validator] Attempt ${attempt} failed:`, error.message);
          
          // Record failure
          preprocessingMonitor.recordPreprocessingLLMCall({
            stage: 'field_validation',
            operation: 'validate_fields',
            duration,
            success: false,
            timeout: false,
            error: error.message
          });
        }
        
        // 如果不是最后一次尝试，使用指数退避等待后重试
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[Field Validator] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`LLM call failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }
  
  /**
   * 推断字段类型
   * 
   * @param {string} fieldName - 字段名
   * @returns {string} 字段类型
   */
  _inferFieldType(fieldName) {
    if (fieldName.includes('地点') || fieldName.includes('位置') || fieldName.includes('区域')) {
      return 'location';
    }
    if (fieldName.includes('单位') || fieldName.includes('公司') || fieldName.includes('组织')) {
      return 'entity';
    }
    if (fieldName.includes('时间') || fieldName.includes('日期')) {
      return 'time';
    }
    if (fieldName.includes('数值') || fieldName.includes('金额') || fieldName.includes('数量')) {
      return 'number';
    }
    return 'text';
  }
  
  /**
   * 批量验证多个CKB的字段提取
   * 
   * @param {Array} ckbsWithFields - CKB和字段数组 [{ckb, fields, indexedText}]
   * @param {Object} llmClient - LLM客户端
   * @param {Object} options - 选项
   * @returns {Promise<Map>} Map<CKB ID, validation result>
   */
  async batchValidateFields(ckbsWithFields, llmClient, options = {}) {
    if (!ckbsWithFields || ckbsWithFields.length === 0) {
      return new Map();
    }
    
    if (!llmClient) {
      console.warn('[Field Validator] No LLM client provided, skipping batch validation');
      return new Map();
    }
    
    const { maxConcurrency = 3 } = options;
    const queue = new PQueue({ concurrency: maxConcurrency });
    const results = new Map();
    
    console.log(`[Field Validator] Batch validating ${ckbsWithFields.length} CKBs`);
    
    const promises = ckbsWithFields.map(item => {
      return queue.add(async () => {
        const result = await this.validateFields(
          item.fields,
          item.indexedText,
          item.ckb,
          llmClient
        );
        results.set(item.ckb.ckb_id, result);
      });
    });
    
    await Promise.all(promises);
    
    console.log(`[Field Validator] Batch validation complete: ${results.size} results`);
    
    return results;
  }
  
  /**
   * 获取验证统计信息
   * 
   * @param {Map} validationResults - 验证结果Map
   * @returns {Object} 统计信息
   */
  getValidationStats(validationResults) {
    let totalCKBs = 0;
    let validCKBs = 0;
    let totalMissingFields = 0;
    let avgCoverageRate = 0;
    
    validationResults.forEach(result => {
      totalCKBs++;
      if (result.isValid) {
        validCKBs++;
      }
      totalMissingFields += (result.missingFields || []).length;
      avgCoverageRate += result.coverageRate || 0;
    });
    
    return {
      totalCKBs,
      validCKBs,
      invalidCKBs: totalCKBs - validCKBs,
      validRate: totalCKBs > 0 ? (validCKBs / totalCKBs).toFixed(2) : 0,
      totalMissingFields,
      avgMissingFieldsPerCKB: totalCKBs > 0 ? (totalMissingFields / totalCKBs).toFixed(2) : 0,
      avgCoverageRate: totalCKBs > 0 ? (avgCoverageRate / totalCKBs).toFixed(2) : 0
    };
  }
}

module.exports = FieldExtractionValidator;
