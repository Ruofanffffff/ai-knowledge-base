/**
 * AI Enhancement Service for Notes Feature
 * 
 * Provides AI-powered text enhancement features:
 * - Smart generation (text expansion + image prompt generation)
 * - Smart proofreading (error correction with change tracking)
 * - Table generation (convert text to structured table)
 * - Mind map generation (convert text to hierarchical mind map)
 * 
 * Validates: Requirements 5, 6, 7, 8
 */

const { createTextLLMClient } = require('./llmClient');
const {
  createSmartGenerationPrompt,
  createSmartProofreadingPrompt,
  createTableGenerationPrompt,
  createMindMapGenerationPrompt,
  validateTextParameter
} = require('./prompts');
const { notesConfig } = require('../../config/notes.config');

/**
 * AI Enhancement Service
 */
class AIEnhancementService {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || notesConfig.performance?.aiEnhancementTimeout || 5000,
      ...config
    };

    // Create LLM client for text enhancement
    this.llmClient = createTextLLMClient({
      apiKey: config.apiKey || notesConfig.textLLM?.apiKey,
      model: config.model || notesConfig.textLLM?.model,
      timeout: this.config.timeout
    });
  }

  /**
   * Smart generation: Expand text and generate image prompt
   * Requirement 5.2, 5.3, 5.4: Expand text and generate image prompts
   * 
   * @param {Object} options - Generation options
   * @param {string} options.text - Text to expand
   * @param {string} [options.context] - Additional context
   * @param {string} [options.style] - Desired style (creative, professional, casual)
   * @returns {Promise<Object>} Result with expandedText and imagePrompt
   */
  async generate(options) {
    const { text, context, style } = options;

    // Validate input
    validateTextParameter(text, 'text');

    // Create prompt
    const prompt = createSmartGenerationPrompt(text, { context, style });

    try {
      // Call LLM with timeout
      const result = await this._callWithTimeout(
        () => this.llmClient.generateJSON({ prompt }),
        this.config.timeout
      );

      // Validate output format
      this._validateGenerateOutput(result.data);

      return {
        expandedText: result.data.expandedText,
        imagePrompt: result.data.imagePrompt,
        tokens: result.tokens,
        model: result.model
      };
    } catch (error) {
      throw new Error(`Smart generation failed: ${error.message}`);
    }
  }

  /**
   * Smart proofreading: Correct errors while preserving meaning and style
   * Requirement 6.1, 6.2, 6.3, 6.4, 6.5: Correct errors with change tracking
   * 
   * @param {Object} options - Proofreading options
   * @param {string} options.text - Text to proofread
   * @param {string} [options.language] - Language (zh, en)
   * @returns {Promise<Object>} Result with correctedText and changes
   */
  async proofread(options) {
    const { text, language } = options;

    // Validate input
    validateTextParameter(text, 'text');

    // Create prompt
    const prompt = createSmartProofreadingPrompt(text, { language });

    try {
      // Call LLM with timeout
      const result = await this._callWithTimeout(
        () => this.llmClient.generateJSON({ prompt }),
        this.config.timeout
      );

      // Validate output format
      this._validateProofreadOutput(result.data);

      return {
        correctedText: result.data.correctedText,
        changes: result.data.changes || [],
        tokens: result.tokens,
        model: result.model
      };
    } catch (error) {
      throw new Error(`Smart proofreading failed: ${error.message}`);
    }
  }

  /**
   * Generate table: Convert text to structured table
   * Requirement 7.1, 7.2, 7.3, 7.4: Extract information and create table
   * 
   * @param {Object} options - Table generation options
   * @param {string} options.text - Text to convert to table
   * @param {number} [options.maxColumns] - Maximum number of columns
   * @returns {Promise<Object>} Result with table data
   */
  async generateTable(options) {
    const { text, maxColumns } = options;

    // Validate input
    validateTextParameter(text, 'text');

    // Create prompt
    const prompt = createTableGenerationPrompt(text, { maxColumns });

    try {
      // Call LLM with timeout
      const result = await this._callWithTimeout(
        () => this.llmClient.generateJSON({ prompt }),
        this.config.timeout
      );

      // Validate output format
      this._validateTableOutput(result.data);

      return {
        table: {
          headers: result.data.columns,
          rows: result.data.rows
        },
        tableType: result.data.table_type,
        summary: result.data.summary,
        tokens: result.tokens,
        model: result.model
      };
    } catch (error) {
      throw new Error(`Table generation failed: ${error.message}`);
    }
  }

  /**
   * Generate mind map: Convert text to hierarchical mind map
   * Requirement 8.1, 8.2, 8.3, 8.4, 8.5: Identify theme and create branches
   * 
   * @param {Object} options - Mind map generation options
   * @param {string} options.text - Text to convert to mind map
   * @param {number} [options.maxBranches] - Maximum number of first-level branches
   * @param {number} [options.maxDepth] - Maximum depth of branches
   * @returns {Promise<Object>} Result with mind map data
   */
  async generateMindMap(options) {
    const { text, maxBranches, maxDepth } = options;

    // Validate input
    validateTextParameter(text, 'text');

    // Create prompt
    const prompt = createMindMapGenerationPrompt(text, { maxBranches, maxDepth });

    try {
      // Call LLM with timeout
      const result = await this._callWithTimeout(
        () => this.llmClient.generateJSON({ prompt }),
        this.config.timeout
      );

      // Validate output format
      this._validateMindMapOutput(result.data);

      return {
        mindmap: {
          central_topic: result.data.central_topic,
          nodes: result.data.nodes
        },
        tokens: result.tokens,
        model: result.model
      };
    } catch (error) {
      throw new Error(`Mind map generation failed: ${error.message}`);
    }
  }

  /**
   * Call function with timeout
   * @private
   * @param {Function} fn - Function to call
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<any>} Result
   */
  async _callWithTimeout(fn, timeout) {
    return Promise.race([
      fn(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Operation timed out after ${timeout}ms`)), timeout)
      )
    ]);
  }

  /**
   * Validate generate output format
   * Property 8: Smart generation output format
   * @private
   */
  _validateGenerateOutput(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Output must be an object');
    }

    if (!data.expandedText || typeof data.expandedText !== 'string') {
      throw new Error('Output must contain expandedText field as string');
    }

    if (!data.imagePrompt || typeof data.imagePrompt !== 'string') {
      throw new Error('Output must contain imagePrompt field as string');
    }

    if (data.expandedText.trim().length === 0) {
      throw new Error('expandedText cannot be empty');
    }

    if (data.imagePrompt.trim().length === 0) {
      throw new Error('imagePrompt cannot be empty');
    }
  }

  /**
   * Validate proofread output format
   * @private
   */
  _validateProofreadOutput(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Output must be an object');
    }

    if (!data.correctedText || typeof data.correctedText !== 'string') {
      throw new Error('Output must contain correctedText field as string');
    }

    if (!Array.isArray(data.changes)) {
      throw new Error('Output must contain changes field as array');
    }

    // Validate each change
    data.changes.forEach((change, index) => {
      if (!change.type || !['spelling', 'grammar', 'punctuation', 'word-choice'].includes(change.type)) {
        throw new Error(`Change ${index} has invalid type`);
      }
      if (typeof change.original !== 'string' || typeof change.corrected !== 'string') {
        throw new Error(`Change ${index} must have original and corrected as strings`);
      }
    });
  }

  /**
   * Validate table output format
   * Property 10: Table generation JSON validity
   * Property 11: Table structure reasonableness
   * @private
   */
  _validateTableOutput(data) {
      if (!data || typeof data !== 'object') {
        throw new Error('Output must be an object');
      }

      if (!Array.isArray(data.columns)) {
        throw new Error('Output must contain columns field as array');
      }

      if (!Array.isArray(data.rows)) {
        throw new Error('Output must contain rows field as array');
      }

      if (data.columns.length === 0) {
        throw new Error('Table must have at least one column');
      }

      // Validate all columns are strings
      data.columns.forEach((col, index) => {
        if (typeof col !== 'string') {
          throw new Error(`Column ${index} must be a string`);
        }
      });

      // Validate all rows have same length as columns
      const colLength = data.columns.length;
      data.rows.forEach((row, index) => {
        if (!Array.isArray(row)) {
          throw new Error(`Row ${index} must be an array`);
        }
        if (row.length !== colLength) {
          throw new Error(`Row ${index} has ${row.length} columns, expected ${colLength}`);
        }
        row.forEach((cell, cellIndex) => {
          if (typeof cell !== 'string') {
            throw new Error(`Row ${index}, cell ${cellIndex} must be a string`);
          }
        });
      });
    }

  /**
   * Validate mind map output format
   * Property 12: Mind map structure completeness
   * Property 13: Mind map JSON validity
   * @private
   */
  _validateMindMapOutput(data) {
      if (!data || typeof data !== 'object') {
        throw new Error('Output must be an object');
      }

      // 校验 central_topic
      if (!data.central_topic || typeof data.central_topic !== 'string') {
        throw new Error('Output must contain central_topic field as string');
      }

      // 校验 nodes
      if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
        throw new Error('Output must contain nodes field as non-empty array');
      }

      // 校验一级分支数量
      if (data.nodes.length < 1 || data.nodes.length > 6) {
        throw new Error(`一级分支数量应为 1-6 个, got ${data.nodes.length}`);
      }

      // 递归校验每个节点
      data.nodes.forEach((node, index) => {
        this._validateNode(node, index, 1);
      });
    }

  /**
   * Validate mind map node recursively
   * @private
   */
  _validateNode(node, index, depth) {
    if (!node || typeof node !== 'object') {
      throw new Error(`Node ${index} at depth ${depth} must be an object`);
    }
    if (!node.id || typeof node.id !== 'string') {
      throw new Error(`Node ${index} at depth ${depth} must have id as string`);
    }
    if (!node.text || typeof node.text !== 'string') {
      throw new Error(`Node ${index} at depth ${depth} must have text as string`);
    }
    if (node.text.length > 20) {
      throw new Error(`节点文本过长: Node ${index} at depth ${depth}, ${node.text.length} characters (max 20)`);
    }
    if (node.children) {
      if (!Array.isArray(node.children)) {
        throw new Error(`Node ${index} at depth ${depth} children must be an array`);
      }
      node.children.forEach((child, childIndex) => {
        this._validateNode(child, childIndex, depth + 1);
      });
    }
  }

  /**
   * Get LLM client statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return this.llmClient.getStats();
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.llmClient.resetStats();
  }
}

/**
 * Create AI enhancement service
 * @param {Object} config - Service configuration
 * @returns {AIEnhancementService}
 */
function createAIEnhancementService(config = {}) {
  return new AIEnhancementService(config);
}

module.exports = {
  AIEnhancementService,
  createAIEnhancementService
};
