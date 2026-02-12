/**
 * Relation Extraction Validator
 * 
 * 基于索引叙述文本验证关系抽取完整性，并补充遗漏的关系
 * 
 * 核心功能：
 * 1. 验证关系抽取完整性
 * 2. 识别索引中明确提到但未被抽取的关系
 * 3. 补充提取遗漏的关系
 * 4. 计算覆盖率
 * 
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

const PQueue = require('p-queue').default;

class RelationExtractionValidator {
  constructor(options = {}) {
    this.temperature = options.temperature || parseFloat(process.env.LLM_TEMPERATURE) || 0.1;
    this.timeout = options.timeout || parseInt(process.env.LLM_TIMEOUT) || 20000; // 20秒超时
    this.maxRetries = options.maxRetries || parseInt(process.env.LLM_MAX_RETRIES) || 2;
    this.coverageThreshold = options.coverageThreshold || 0.7; // 覆盖率阈值
    
    console.log(`[Relation Validator] Initialized with timeout=${this.timeout}ms, retries=${this.maxRetries}, threshold=${this.coverageThreshold}`);
  }
  
  /**
   * 验证关系抽取完整性
   * 
   * @param {Array} extractedRelations - 已抽取的关系
   * @param {string} indexedText - 索引叙述文本
   * @param {Array} entities - 实体列表
   * @param {Object} llmClient - LLM客户端
   * @returns {Promise<Object>} 验证结果
   */
  async validateRelations(extractedRelations, indexedText, entities, llmClient) {
    if (!indexedText) {
      console.warn('[Relation Validator] Missing indexedText, skipping validation');
      return {
        isValid: true,
        coverageRate: 1.0,
        missingRelations: [],
        reason: 'No indexed text available'
      };
    }
    
    if (!entities || entities.length === 0) {
      console.warn('[Relation Validator] No entities provided, skipping validation');
      return {
        isValid: true,
        coverageRate: 1.0,
        missingRelations: [],
        reason: 'No entities available'
      };
    }
    
    if (!llmClient) {
      console.warn('[Relation Validator] No LLM client provided, skipping validation');
      return {
        isValid: true,
        coverageRate: 1.0,
        missingRelations: [],
        reason: 'No LLM client'
      };
    }
    
    try {
      console.log(`[Relation Validator] Validating ${extractedRelations.length} extracted relations against indexed text`);
      
      // 构建验证prompt
      const prompt = this._buildValidationPrompt(extractedRelations, indexedText, entities);
      
      // 调用LLM验证
      const response = await this._callLLMWithRetry(llmClient, prompt);
      
      // 解析响应
      const result = this._parseValidationResponse(response);
      
      console.log(`[Relation Validator] Validation complete: coverage=${result.coverageRate}, missing=${result.missingRelations.length}`);
      
      return result;
    } catch (error) {
      console.error('[Relation Validator] Validation failed:', error.message);
      return {
        isValid: true,
        coverageRate: 1.0,
        missingRelations: [],
        error: error.message
      };
    }
  }
  
  /**
   * 补充遗漏的关系
   * 
   * @param {Array} missingRelations - 遗漏的关系信息
   * @param {Array} entities - 实体列表
   * @param {Object} llmClient - LLM客户端
   * @returns {Promise<Array>} 补充的关系
   */
  async supplementRelations(missingRelations, entities, llmClient) {
    if (!missingRelations || missingRelations.length === 0) {
      return [];
    }
    
    if (!llmClient) {
      console.warn('[Relation Validator] No LLM client provided, cannot supplement relations');
      return [];
    }
    
    try {
      console.log(`[Relation Validator] Supplementing ${missingRelations.length} missing relations`);
      
      // 构建补充提取prompt
      const prompt = this._buildSupplementPrompt(missingRelations, entities);
      
      // 调用LLM提取
      const response = await this._callLLMWithRetry(llmClient, prompt);
      
      // 解析响应
      const supplementedRelations = this._parseSupplementResponse(response, entities);
      
      console.log(`[Relation Validator] Supplemented ${supplementedRelations.length} relations`);
      
      return supplementedRelations;
    } catch (error) {
      console.error('[Relation Validator] Supplement failed:', error.message);
      return [];
    }
  }
  
  /**
   * 构建验证prompt
   * 
   * @param {Array} extractedRelations - 已抽取的关系
   * @param {string} indexedText - 索引叙述文本
   * @param {Array} entities - 实体列表
   * @returns {string} Prompt
   * @private
   */
  _buildValidationPrompt(extractedRelations, indexedText, entities) {
    // 格式化已抽取关系
    const relationsJson = JSON.stringify(
      extractedRelations.slice(0, 20).map(r => ({
        subject: r.subject_name || r.subject_id,
        relation: r.relation_description || r.relation_type,
        object: r.object_name || r.object_id
      })),
      null,
      2
    );
    
    // 格式化实体列表
    const entitiesJson = JSON.stringify(
      entities.slice(0, 30).map(e => ({
        id: e.entity_id,
        name: e.canonical_name || e.name,
        type: e.entity_type
      })),
      null,
      2
    );
    
    const prompt = `你是一个关系抽取验证器。

请基于"索引叙述文本"，检查关系抽取结果的完整性。

索引叙述文本：
${indexedText}

已抽取关系：
${relationsJson}

实体列表：
${entitiesJson}

任务：
1. 识别索引文本中明确提到但未被抽取的关系
2. 补充提取这些遗漏的关系
3. 只提取明确的事实关系，不要推理

输出 JSON：
{
  "missing_relations": [
    {
      "subject": "主体实体",
      "relation": "关系描述",
      "object": "客体实体",
      "type": "关系类型",
      "source_index": 4,
      "confidence": 0.85
    }
  ],
  "coverage_rate": 0.8
}`;
    
    return prompt;
  }
  
  /**
   * 构建补充提取prompt
   * 
   * @param {Array} missingRelations - 遗漏的关系信息
   * @param {Array} entities - 实体列表
   * @returns {string} Prompt
   * @private
   */
  _buildSupplementPrompt(missingRelations, entities) {
    // 格式化遗漏关系
    const missingJson = JSON.stringify(
      missingRelations.map(r => ({
        subject: r.subject,
        relation: r.relation,
        object: r.object
      })),
      null,
      2
    );
    
    // 格式化实体列表
    const entitiesJson = JSON.stringify(
      entities.slice(0, 30).map(e => ({
        id: e.entity_id,
        name: e.canonical_name || e.name,
        type: e.entity_type
      })),
      null,
      2
    );
    
    const prompt = `请补充提取以下遗漏的关系。

遗漏的关系：
${missingJson}

实体列表：
${entitiesJson}

任务：
1. 为每个遗漏的关系找到对应的实体ID
2. 确定关系类型和置信度
3. 如果无法找到对应实体，返回null

返回JSON格式:
[
  {
    "subject_id": "entity_123",
    "subject_name": "阿里C区",
    "relation_type": "located_in",
    "relation_description": "位于",
    "object_id": "entity_456",
    "object_name": "海南省",
    "confidence": 0.9
  }
]`;
    
    return prompt;
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
      
      const missingRelations = (parsed.missing_relations || [])
        .filter(r => r.subject && r.object && r.relation)
        .map(r => ({
          subject: r.subject,
          relation: r.relation,
          object: r.object,
          type: r.type || 'semantic',
          confidence: r.confidence || 0.8,
          sourceIndex: r.source_index
        }));
      
      const coverageRate = parsed.coverage_rate || 1.0;
      
      return {
        isValid: coverageRate >= this.coverageThreshold,
        coverageRate,
        missingRelations,
        needsSupplement: missingRelations.length > 0
      };
    } catch (error) {
      console.error('[Relation Validator] Failed to parse validation response:', error.message);
      console.error('[Relation Validator] Response:', response.substring(0, 500));
      
      return {
        isValid: true,
        coverageRate: 1.0,
        missingRelations: [],
        parseError: error.message
      };
    }
  }
  
  /**
   * 解析补充提取响应
   * 
   * @param {string} response - LLM响应
   * @param {Array} entities - 实体列表
   * @returns {Array} 补充的关系
   * @private
   */
  _parseSupplementResponse(response, entities) {
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
        .filter(r => r.subject_id && r.object_id && r.relation_type)
        .map(r => ({
          subject_id: r.subject_id,
          subject_name: r.subject_name,
          relation_type: r.relation_type,
          relation_description: r.relation_description || r.relation_type,
          object_id: r.object_id,
          object_name: r.object_name,
          confidence: r.confidence || 0.8,
          sources: ['llm_supplement']
        }));
    } catch (error) {
      console.error('[Relation Validator] Failed to parse supplement response:', error.message);
      console.error('[Relation Validator] Response:', response.substring(0, 500));
      return [];
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
        console.log(`[Relation Validator] Calling LLM (attempt ${attempt}/${this.maxRetries})...`);
        
        // 创建超时控制
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
          const response = await llmClient.chat({
            messages: [
              {
                role: 'system',
                content: '你是一个关系抽取验证器。请基于索引叙述文本验证关系完整性，返回JSON。'
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
          console.error(`[Relation Validator] Attempt ${attempt} timed out after ${this.timeout}ms`);
        } else {
          console.error(`[Relation Validator] Attempt ${attempt} failed:`, error.message);
        }
        
        // 如果不是最后一次尝试，使用指数退避等待后重试
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(`[Relation Validator] Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw new Error(`LLM call failed after ${this.maxRetries} attempts: ${lastError?.message}`);
  }
  
  /**
   * 批量验证多个文档的关系抽取
   * 
   * @param {Array} documentsWithRelations - 文档和关系数组 [{relations, indexedText, entities}]
   * @param {Object} llmClient - LLM客户端
   * @param {Object} options - 选项
   * @returns {Promise<Map>} Map<document index, validation result>
   */
  async batchValidateRelations(documentsWithRelations, llmClient, options = {}) {
    if (!documentsWithRelations || documentsWithRelations.length === 0) {
      return new Map();
    }
    
    if (!llmClient) {
      console.warn('[Relation Validator] No LLM client provided, skipping batch validation');
      return new Map();
    }
    
    const { maxConcurrency = 3 } = options;
    const queue = new PQueue({ concurrency: maxConcurrency });
    const results = new Map();
    
    console.log(`[Relation Validator] Batch validating ${documentsWithRelations.length} documents`);
    
    const promises = documentsWithRelations.map((item, index) => {
      return queue.add(async () => {
        const result = await this.validateRelations(
          item.relations,
          item.indexedText,
          item.entities,
          llmClient
        );
        results.set(index, result);
      });
    });
    
    await Promise.all(promises);
    
    console.log(`[Relation Validator] Batch validation complete: ${results.size} results`);
    
    return results;
  }
  
  /**
   * 获取验证统计信息
   * 
   * @param {Map} validationResults - 验证结果Map
   * @returns {Object} 统计信息
   */
  getValidationStats(validationResults) {
    let totalDocs = 0;
    let validDocs = 0;
    let totalMissingRelations = 0;
    let avgCoverageRate = 0;
    
    validationResults.forEach(result => {
      totalDocs++;
      if (result.isValid) {
        validDocs++;
      }
      totalMissingRelations += (result.missingRelations || []).length;
      avgCoverageRate += result.coverageRate || 0;
    });
    
    return {
      totalDocs,
      validDocs,
      invalidDocs: totalDocs - validDocs,
      validRate: totalDocs > 0 ? (validDocs / totalDocs).toFixed(2) : 0,
      totalMissingRelations,
      avgMissingRelationsPerDoc: totalDocs > 0 ? (totalMissingRelations / totalDocs).toFixed(2) : 0,
      avgCoverageRate: totalDocs > 0 ? (avgCoverageRate / totalDocs).toFixed(2) : 0
    };
  }
  
  /**
   * 智能触发判断：是否需要调用LLM验证
   * 
   * 当前策略：只在覆盖率可能较低时调用
   * 
   * @param {Array} extractedRelations - 已抽取的关系
   * @param {Array} entities - 实体列表
   * @param {Object} context - 上下文信息
   * @returns {boolean} 是否需要LLM验证
   */
  shouldCallLLM(extractedRelations, entities, context = {}) {
    // 如果没有索引文本，不需要验证
    if (!context.indexedText) {
      return false;
    }
    
    // 如果没有实体，不需要验证
    if (!entities || entities.length === 0) {
      return false;
    }
    
    // 如果实体数量较多但关系数量较少，可能需要验证
    const entityCount = entities.length;
    const relationCount = extractedRelations.length;
    
    // 简单启发式：如果实体数量 > 5 但关系数量 < 实体数量的一半，可能遗漏了关系
    if (entityCount > 5 && relationCount < entityCount / 2) {
      return true;
    }
    
    // 如果明确要求验证，则验证
    if (context.forceValidation) {
      return true;
    }
    
    // 默认不验证（节省LLM调用）
    return false;
  }
}

module.exports = RelationExtractionValidator;
