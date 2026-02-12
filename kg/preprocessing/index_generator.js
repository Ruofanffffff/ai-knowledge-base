/**
 * LLM Document Index Generator
 * 
 * Generates indexed narrative text from documents for use in downstream correction stages.
 * This is the core preprocessing module that creates a low-noise, machine-friendly index.
 * 
 * Requirements: 1.1, 1.2, 1.5
 */

const { v4: uuidv4 } = require('uuid');
const preprocessingMonitor = require('./preprocessing_monitor');

/**
 * Index Generator Class
 * Generates indexed narrative text from document content
 */
class IndexGenerator {
  constructor(options = {}) {
    this.options = {
      temperature: options.temperature || 0.1,
      maxTokens: options.maxTokens || 2000,
      timeout: options.timeout || 30000,
      ...options
    };
  }

  /**
   * Generate indexed narrative text from document
   * @param {string} docId - Document ID
   * @param {string} text - Document text content
   * @param {Object} llmClient - LLM client instance
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Document index object
   */
  async generateIndexedText(docId, text, llmClient, options = {}) {
    const startTime = Date.now();
    
    try {
      // Validate inputs
      if (!docId || !text) {
        throw new Error('Document ID and text are required');
      }

      if (!llmClient) {
        throw new Error('LLM client is required');
      }

      // Build prompt for indexed text generation
      const prompt = this._buildIndexGenerationPrompt(text);
      
      // Call LLM with timeout
      const response = await this._callLLMWithTimeout(
        llmClient,
        prompt,
        options.timeout || this.options.timeout
      );

      // Parse and validate the indexed text
      const indexedText = response.content.trim();
      const validation = this.validateIndexedText(indexedText);
      
      if (!validation.valid) {
        console.warn(`[IndexGenerator] Generated index has quality issues:`, validation.issues);
      }

      // Parse indexed text into structured facts
      const facts = this.parseIndexedText(indexedText);

      // Create document index object
      const documentIndex = {
        id: uuidv4(),
        doc_id: docId,
        indexed_text: indexedText,
        metadata: {
          generated_at: new Date().toISOString(),
          llm_model: response.model || 'unknown',
          token_count: response.tokens || 0,
          input_tokens: response.input_tokens || 0,
          output_tokens: response.output_tokens || 0,
          fact_count: facts.length,
          generation_time_ms: Date.now() - startTime,
          validation: validation
        },
        version: 1,
        created_at: new Date()
      };

      console.log(`[IndexGenerator] Generated index for doc ${docId}: ${facts.length} facts, ${response.tokens || 0} tokens`);

      // Record performance metrics
      preprocessingMonitor.recordIndexGeneration({
        doc_id: docId,
        duration: Date.now() - startTime,
        fact_count: facts.length,
        token_count: response.tokens || 0,
        success: true,
        metadata: {
          model: response.model || 'unknown',
          validation: validation
        }
      });

      return documentIndex;
    } catch (error) {
      console.error(`[IndexGenerator] Failed to generate index for doc ${docId}:`, error);
      
      // Record failure metrics
      preprocessingMonitor.recordIndexGeneration({
        doc_id: docId,
        duration: Date.now() - startTime,
        fact_count: 0,
        token_count: 0,
        success: false,
        error: error.message
      });
      
      throw error;
    }
  }

  /**
   * Build prompt for index generation
   * @param {string} text - Document text
   * @returns {string} Prompt
   * @private
   */
  _buildIndexGenerationPrompt(text) {
    return `你是一个"事实索引生成器"。

你的任务不是写摘要，而是将文章转换为【供机器使用的、低噪声、结构友好的索引叙述文本】。

要求：
1. 不要评论、不要推理、不要总结观点
2. 每一段只描述一件明确事实
3. 保留所有可识别的时间、地点、数值、单位
4. 将隐含信息显式化（如"近期"→具体时间）
5. 使用稳定、明确的指代名称（不要用"其""该区域"）

输出格式：
- 使用编号列表
- 每一条是一个独立事实
- 每条不超过 2 句话

原文：
${text}

输出：
【索引叙述文本】`;
  }

  /**
   * Call LLM with timeout control
   * @param {Object} llmClient - LLM client
   * @param {string} prompt - Prompt text
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Object>} LLM response
   * @private
   */
  async _callLLMWithTimeout(llmClient, prompt, timeout) {
    const startTime = Date.now();
    
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const duration = Date.now() - startTime;
        console.error(`[IndexGenerator] LLM call timeout after ${timeout}ms`);
        
        // Record timeout
        preprocessingMonitor.recordPreprocessingLLMCall({
          stage: 'index_generation',
          operation: 'generate_indexed_text',
          duration,
          success: false,
          timeout: true
        });
        
        reject(new Error(`LLM call timeout after ${timeout}ms`));
      }, timeout);

      try {
        const response = await llmClient.call(prompt, {
          temperature: this.options.temperature,
          maxTokens: this.options.maxTokens,
          systemPrompt: '你是一个专业的文档索引生成器，擅长提取文档中的关键事实。'
        });
        
        clearTimeout(timeoutId);
        
        // Record successful LLM call
        const duration = Date.now() - startTime;
        preprocessingMonitor.recordPreprocessingLLMCall({
          stage: 'index_generation',
          operation: 'generate_indexed_text',
          duration,
          success: true,
          timeout: false,
          model: response.model || 'unknown',
          tokens: response.tokens || 0,
          input_tokens: response.input_tokens || 0,
          output_tokens: response.output_tokens || 0
        });
        
        resolve(response);
      } catch (error) {
        clearTimeout(timeoutId);
        
        // Record failed LLM call
        const duration = Date.now() - startTime;
        preprocessingMonitor.recordPreprocessingLLMCall({
          stage: 'index_generation',
          operation: 'generate_indexed_text',
          duration,
          success: false,
          timeout: false,
          error: error.message
        });
        
        reject(error);
      }
    });
  }

  /**
   * Validate indexed text quality
   * @param {string} indexedText - Indexed narrative text
   * @returns {Object} Validation result with valid flag and issues array
   */
  validateIndexedText(indexedText) {
    const issues = [];
    
    // Check if text is empty
    if (!indexedText || indexedText.trim().length === 0) {
      issues.push('Indexed text is empty');
      return { valid: false, issues };
    }

    // Check if text contains numbered list format
    const hasNumberedList = /^\d+\.\s+/m.test(indexedText);
    if (!hasNumberedList) {
      issues.push('Indexed text does not contain numbered list format');
    }

    // Check minimum number of facts (at least 1)
    const facts = this.parseIndexedText(indexedText);
    if (facts.length === 0) {
      issues.push('No facts extracted from indexed text');
    }

    // Check for overly long facts (> 200 characters)
    const longFacts = facts.filter(f => f.text.length > 200);
    if (longFacts.length > 0) {
      issues.push(`${longFacts.length} facts exceed 200 characters`);
    }

    // Check for vague references (这, 该, 其)
    const vagueReferences = indexedText.match(/[这该其]/g);
    if (vagueReferences && vagueReferences.length > 3) {
      issues.push(`Contains ${vagueReferences.length} vague references`);
    }

    return {
      valid: issues.length === 0,
      issues,
      fact_count: facts.length,
      avg_fact_length: facts.length > 0 
        ? Math.round(facts.reduce((sum, f) => sum + f.text.length, 0) / facts.length)
        : 0
    };
  }

  /**
   * Parse indexed text into structured facts
   * @param {string} indexedText - Indexed narrative text
   * @returns {Array<Object>} Array of fact objects
   */
  parseIndexedText(indexedText) {
    const facts = [];
    
    if (!indexedText) {
      return facts;
    }

    // Split by lines and extract numbered items
    const lines = indexedText.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Match numbered list items: "1. text" or "1) text"
      const match = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
      
      if (match) {
        const index = parseInt(match[1], 10);
        const text = match[2].trim();
        
        if (text.length > 0) {
          facts.push({
            index,
            text,
            length: text.length
          });
        }
      }
    }

    return facts;
  }

  /**
   * Extract key entities from indexed text
   * @param {string} indexedText - Indexed narrative text
   * @returns {Array<Object>} Array of entity mentions
   */
  extractKeyEntities(indexedText) {
    const entities = [];
    const facts = this.parseIndexedText(indexedText);
    
    // Simple entity extraction patterns
    const patterns = {
      time: /(\d{4}年\d{1,2}月|\d{1,2}月\d{1,2}日|\d{4}-\d{2}-\d{2})/g,
      location: /([\u4e00-\u9fa5]{2,}(?:省|市|区|县|镇|村|路|街))/g,
      number: /(\d+(?:\.\d+)?(?:米|千米|公里|吨|千克|元|万元|亿元|%|度|℃))/g,
      organization: /([\u4e00-\u9fa5]{2,}(?:公司|集团|部门|局|委员会|协会))/g
    };

    facts.forEach(fact => {
      Object.entries(patterns).forEach(([type, pattern]) => {
        const matches = fact.text.match(pattern);
        if (matches) {
          matches.forEach(match => {
            entities.push({
              type,
              value: match,
              source_index: fact.index
            });
          });
        }
      });
    });

    return entities;
  }

  /**
   * Extract key relations from indexed text
   * @param {string} indexedText - Indexed narrative text
   * @returns {Array<Object>} Array of relation mentions
   */
  extractKeyRelations(indexedText) {
    const relations = [];
    const facts = this.parseIndexedText(indexedText);
    
    // Simple relation extraction patterns
    const relationPatterns = [
      { pattern: /(.+?)位于(.+?)/, type: 'located_in' },
      { pattern: /(.+?)属于(.+?)/, type: 'belongs_to' },
      { pattern: /(.+?)由(.+?)负责/, type: 'managed_by' },
      { pattern: /(.+?)导致(.+?)/, type: 'causes' },
      { pattern: /(.+?)包含(.+?)/, type: 'contains' }
    ];

    facts.forEach(fact => {
      relationPatterns.forEach(({ pattern, type }) => {
        const match = fact.text.match(pattern);
        if (match) {
          relations.push({
            type,
            subject: match[1].trim(),
            object: match[2].trim(),
            source_index: fact.index
          });
        }
      });
    });

    return relations;
  }
}

/**
 * Create index generator instance
 * @param {Object} options - Generator options
 * @returns {IndexGenerator} Generator instance
 */
function createIndexGenerator(options = {}) {
  return new IndexGenerator(options);
}

module.exports = {
  IndexGenerator,
  createIndexGenerator
};
