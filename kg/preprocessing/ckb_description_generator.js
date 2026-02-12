/**
 * CKB Description Generator
 * 
 * Generates CKB descriptions based on indexed narrative text.
 * This replaces the traditional CKB parsing with LLM-guided generation.
 * 
 * Requirements: 2.1, 2.3
 */

const { v4: uuidv4 } = require('uuid');
const { createCKB } = require('../ckb/ckb_factory');

/**
 * CKB Description Generator Class
 * Generates CKB descriptions from indexed narrative text
 */
class CKBDescriptionGenerator {
  constructor(options = {}) {
    this.options = {
      temperature: options.temperature || 0.1,
      maxTokens: options.maxTokens || 1500,
      timeout: options.timeout || 15000,
      ...options
    };
  }

  /**
   * Generate CKB descriptions from indexed text
   * @param {string} indexedText - Indexed narrative text
   * @param {string} docId - Document ID
   * @param {Object} llmClient - LLM client instance
   * @param {Object} options - Generation options
   * @returns {Promise<Array>} Array of CKB objects
   */
  async generateCKBDescriptions(indexedText, docId, llmClient, options = {}) {
    const startTime = Date.now();
    
    try {
      // Validate inputs
      if (!indexedText || !docId) {
        throw new Error('Indexed text and document ID are required');
      }

      if (!llmClient) {
        throw new Error('LLM client is required');
      }

      // Build prompt for CKB generation
      const prompt = this._buildCKBGenerationPrompt(indexedText);
      
      // Call LLM with timeout
      const response = await this._callLLMWithTimeout(
        llmClient,
        prompt,
        options.timeout || this.options.timeout
      );

      // Parse LLM response
      const ckbData = this._parseLLMResponse(response.content);
      
      // Create CKB objects
      const ckbs = ckbData.ckbs.map((ckb, index) => {
        return createCKB({
          docId: docId,
          sourceType: 'llm_generated',
          sourceMeta: {
            source_index: ckb.source_index,
            generation_method: 'indexed_text',
            llm_model: response.model || 'unknown',
            generation_time_ms: Date.now() - startTime
          },
          text: ckb.ckb_text,
          sourceConfidence: 0.95 // High confidence for LLM-generated CKBs
        });
      });

      console.log(`[CKBDescriptionGenerator] Generated ${ckbs.length} CKBs for doc ${docId}`);

      return ckbs;
    } catch (error) {
      console.error(`[CKBDescriptionGenerator] Failed to generate CKBs for doc ${docId}:`, error);
      throw error;
    }
  }

  /**
   * Build prompt for CKB generation
   * @param {string} indexedText - Indexed narrative text
   * @returns {string} Prompt
   * @private
   */
  _buildCKBGenerationPrompt(indexedText) {
    return `你是一个 CKB 描述生成器。

请基于以下"索引叙述文本"，为每一条生成一个【最小事实单元（CKB）】描述文本。

要求：
1. 每条索引 → 一个 CKB
2. 描述必须是完整陈述句
3. 不合并、不省略、不推理

索引叙述文本：
${indexedText}

输出 JSON：
{
  "ckbs": [
    {
      "ckb_text": "...",
      "source_index": 1
    }
  ]
}`;
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
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`LLM call timeout after ${timeout}ms`));
      }, timeout);

      try {
        const response = await llmClient.call(prompt, {
          temperature: this.options.temperature,
          maxTokens: this.options.maxTokens,
          systemPrompt: '你是一个专业的CKB描述生成器，擅长将索引事实转换为完整的陈述句。'
        });
        
        clearTimeout(timeoutId);
        resolve(response);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Parse LLM response into structured CKB data
   * @param {string} content - LLM response content
   * @returns {Object} Parsed CKB data
   * @private
   */
  _parseLLMResponse(content) {
    try {
      // Try to extract JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in LLM response');
      }

      const data = JSON.parse(jsonMatch[0]);
      
      // Validate structure
      if (!data.ckbs || !Array.isArray(data.ckbs)) {
        throw new Error('Invalid CKB data structure');
      }

      // Validate each CKB
      data.ckbs.forEach((ckb, index) => {
        if (!ckb.ckb_text || typeof ckb.ckb_text !== 'string') {
          throw new Error(`CKB ${index} missing or invalid ckb_text`);
        }
        if (!ckb.source_index || typeof ckb.source_index !== 'number') {
          throw new Error(`CKB ${index} missing or invalid source_index`);
        }
      });

      return data;
    } catch (error) {
      console.error('[CKBDescriptionGenerator] Failed to parse LLM response:', error);
      console.error('Response content:', content);
      throw new Error(`Failed to parse LLM response: ${error.message}`);
    }
  }

  /**
   * Validate CKB descriptions against indexed text
   * @param {Array} ckbs - Array of CKB objects
   * @param {string} indexedText - Indexed narrative text
   * @returns {Object} Validation result
   */
  validateCKBDescriptions(ckbs, indexedText) {
    const issues = [];
    
    // Parse indexed text to get fact count
    const facts = this._parseIndexedText(indexedText);
    
    // Check if CKB count matches fact count
    if (ckbs.length !== facts.length) {
      issues.push(`CKB count (${ckbs.length}) does not match fact count (${facts.length})`);
    }

    // Check if each CKB has valid source_index
    ckbs.forEach((ckb, index) => {
      const sourceMeta = typeof ckb.source_meta === 'string' 
        ? JSON.parse(ckb.source_meta) 
        : ckb.source_meta;
      
      const sourceIndex = sourceMeta.source_index;
      
      if (!sourceIndex || sourceIndex < 1 || sourceIndex > facts.length) {
        issues.push(`CKB ${index} has invalid source_index: ${sourceIndex}`);
      }
    });

    // Check for duplicate source_index
    const sourceIndices = ckbs.map(ckb => {
      const sourceMeta = typeof ckb.source_meta === 'string' 
        ? JSON.parse(ckb.source_meta) 
        : ckb.source_meta;
      return sourceMeta.source_index;
    });
    
    const duplicates = sourceIndices.filter((item, index) => 
      sourceIndices.indexOf(item) !== index
    );
    
    if (duplicates.length > 0) {
      issues.push(`Duplicate source_index found: ${duplicates.join(', ')}`);
    }

    return {
      valid: issues.length === 0,
      issues,
      ckb_count: ckbs.length,
      fact_count: facts.length,
      coverage: ckbs.length / facts.length
    };
  }

  /**
   * Parse indexed text into facts
   * @param {string} indexedText - Indexed narrative text
   * @returns {Array} Array of facts
   * @private
   */
  _parseIndexedText(indexedText) {
    const facts = [];
    
    if (!indexedText) {
      return facts;
    }

    const lines = indexedText.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      const match = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
      
      if (match) {
        const index = parseInt(match[1], 10);
        const text = match[2].trim();
        
        if (text.length > 0) {
          facts.push({ index, text });
        }
      }
    }

    return facts;
  }
}

/**
 * Create CKB description generator instance
 * @param {Object} options - Generator options
 * @returns {CKBDescriptionGenerator} Generator instance
 */
function createCKBDescriptionGenerator(options = {}) {
  return new CKBDescriptionGenerator(options);
}

module.exports = {
  CKBDescriptionGenerator,
  createCKBDescriptionGenerator
};
