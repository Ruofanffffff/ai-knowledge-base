/**
 * LLM Client for Enhanced Entity Extraction
 * 
 * Wraps the existing QwenClient with:
 * - Retry logic with exponential backoff
 * - Timeout handling
 * - Token usage and cost tracking
 * - Error handling and logging
 * 
 * Requirements: 5.4, 5.6, 8.3
 */

const { createQwenClient } = require('../utils/qwen_client');

class LLMClient {
  constructor(config = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.LLM_API_KEY,
      model: config.model || 'qwen-turbo',
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      temperature: config.temperature || 0.7,
      maxTokens: config.maxTokens || 2000,
      ...config
    };

    // Only validate API key if LLM is enabled
    const llmEnabled = config.enabled !== false;
    if (llmEnabled && !this.config.apiKey) {
      throw new Error('LLM API key is required');
    }

    // Create underlying Qwen client only if API key is available
    if (this.config.apiKey) {
      this.client = createQwenClient(this.config.apiKey, {
        model: this.config.model,
        baseURL: this.config.baseURL,
        timeout: this.config.timeout,
        maxRetries: 1 // We handle retries ourselves
      });
    } else {
      this.client = null;
    }

    // Token usage tracking
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0
    };
  }

  /**
   * Call LLM with retry logic and error handling
   * @param {string} prompt - User prompt
   * @param {Object} options - Call options
   * @returns {Promise<Object>} Response with content and metadata
   */
  async call(prompt, options = {}) {
    const callOptions = {
      temperature: options.temperature || this.config.temperature,
      maxTokens: options.maxTokens || this.config.maxTokens,
      systemPrompt: options.systemPrompt || '你是一个专业的知识图谱助手。'
    };

    this.stats.totalCalls++;

    let lastError = null;
    const maxRetries = options.maxRetries !== undefined ? options.maxRetries : this.config.maxRetries;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        // Call underlying client
        const response = await this.client.call(prompt, callOptions);
        
        const processingTime = Date.now() - startTime;

        // Track token usage
        this._trackTokenUsage(response);

        this.stats.successfulCalls++;

        return {
          content: response.content,
          tokens: response.tokens,
          inputTokens: response.input_tokens,
          outputTokens: response.output_tokens,
          model: response.model,
          processingTime,
          attempt: attempt + 1
        };
      } catch (error) {
        lastError = error;
        
        console.error(`[LLMClient] Attempt ${attempt + 1}/${maxRetries} failed:`, error.message);

        // Don't retry on certain errors
        if (this._isNonRetryableError(error)) {
          break;
        }

        // Wait before retry with exponential backoff
        if (attempt < maxRetries - 1) {
          const backoffTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
          console.log(`[LLMClient] Waiting ${backoffTime}ms before retry...`);
          await this._sleep(backoffTime);
        }
      }
    }

    // All retries failed
    this.stats.failedCalls++;
    throw new Error(`LLM call failed after ${maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Call LLM and parse JSON response
   * @param {string} prompt - User prompt
   * @param {Object} options - Call options
   * @returns {Promise<Object>} Parsed JSON response with metadata
   */
  async callJSON(prompt, options = {}) {
    const response = await this.call(prompt, options);
    
    try {
      const parsed = this._parseJSON(response.content);
      
      return {
        data: parsed,
        metadata: {
          tokens: response.tokens,
          inputTokens: response.inputTokens,
          outputTokens: response.outputTokens,
          model: response.model,
          processingTime: response.processingTime,
          attempt: response.attempt
        }
      };
    } catch (error) {
      console.error('[LLMClient] Failed to parse JSON response:', error.message);
      throw new Error(`Failed to parse JSON from LLM response: ${error.message}`);
    }
  }

  /**
   * Parse JSON from LLM response
   * @private
   * @param {string} content - LLM response content
   * @returns {Object} Parsed JSON object
   */
  _parseJSON(content) {
    try {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/) ||
                       content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        return JSON.parse(jsonStr);
      }
      
      // Try to parse the whole content
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`JSON parse error: ${error.message}`);
    }
  }

  /**
   * Track token usage and cost
   * @private
   * @param {Object} response - LLM response
   */
  _trackTokenUsage(response) {
    const tokens = response.tokens || 0;
    const inputTokens = response.input_tokens || 0;
    const outputTokens = response.output_tokens || 0;

    this.stats.totalTokens += tokens;
    this.stats.totalInputTokens += inputTokens;
    this.stats.totalOutputTokens += outputTokens;

    // Estimate cost (rough estimate for Qwen)
    // Input: ~$0.0005 per 1K tokens, Output: ~$0.002 per 1K tokens
    const cost = (inputTokens / 1000 * 0.0005) + (outputTokens / 1000 * 0.002);
    this.stats.totalCost += cost;
  }

  /**
   * Check if error is non-retryable
   * @private
   * @param {Error} error - Error object
   * @returns {boolean}
   */
  _isNonRetryableError(error) {
    const message = error.message.toLowerCase();
    
    // Authentication errors
    if (message.includes('invalid api key') || message.includes('unauthorized')) {
      return true;
    }
    
    // Invalid request errors
    if (message.includes('invalid request') || message.includes('bad request')) {
      return true;
    }
    
    return false;
  }

  /**
   * Sleep utility
   * @private
   * @param {number} ms - Milliseconds to sleep
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get token usage statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      averageTokensPerCall: this.stats.successfulCalls > 0 
        ? Math.round(this.stats.totalTokens / this.stats.successfulCalls)
        : 0,
      successRate: this.stats.totalCalls > 0
        ? Math.round((this.stats.successfulCalls / this.stats.totalCalls) * 100)
        : 0,
      estimatedCost: Math.round(this.stats.totalCost * 100) / 100
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalTokens: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0
    };
  }

  /**
   * Test connection to LLM service
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      await this.call('你好', { maxTokens: 10, maxRetries: 1 });
      return true;
    } catch (error) {
      console.error('[LLMClient] Connection test failed:', error.message);
      return false;
    }
  }
}

/**
 * Create LLM client instance
 * @param {Object} config - Client configuration
 * @returns {LLMClient}
 */
function createLLMClient(config = {}) {
  return new LLMClient(config);
}

module.exports = {
  LLMClient,
  createLLMClient
};
