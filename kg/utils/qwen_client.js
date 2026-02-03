/**
 * Qwen LLM Client
 * 
 * Client for Alibaba Qwen (通义千问) API
 * Provides unified interface for LLM calls with token tracking
 */

const axios = require('axios');

class QwenClient {
  constructor(apiKey, options = {}) {
    this.apiKey = apiKey;
    this.baseURL = options.baseURL || 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
    this.model = options.model || 'qwen-turbo';
    this.timeout = options.timeout || 30000;
    this.maxRetries = options.maxRetries || 3;
  }

  /**
   * Call Qwen API
   * @param {string} prompt - User prompt
   * @param {Object} options - Call options
   * @returns {Promise<Object>} Response with content and token usage
   */
  async call(prompt, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 2000,
      topP = 0.9,
      systemPrompt = '你是一个专业的知识图谱助手。'
    } = options;

    const requestBody = {
      model: this.model,
      input: {
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      },
      parameters: {
        temperature: temperature,
        max_tokens: maxTokens,
        top_p: topP,
        result_format: 'message'
      }
    };

    let lastError = null;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const response = await axios.post(this.baseURL, requestBody, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: this.timeout
        });

        if (response.data && response.data.output) {
          const content = response.data.output.choices[0].message.content;
          const usage = response.data.usage || {};

          return {
            content: content,
            tokens: usage.total_tokens || 0,
            input_tokens: usage.input_tokens || 0,
            output_tokens: usage.output_tokens || 0,
            model: this.model
          };
        } else {
          throw new Error('Invalid response format from Qwen API');
        }
      } catch (error) {
        lastError = error;
        
        // Log error
        console.error(`[QwenClient] Attempt ${attempt + 1} failed:`, error.message);
        
        // Don't retry on certain errors
        if (error.response && error.response.status === 401) {
          throw new Error('Invalid API key');
        }
        
        if (error.response && error.response.status === 400) {
          throw new Error('Invalid request: ' + (error.response.data?.message || error.message));
        }
        
        // Wait before retry (exponential backoff)
        if (attempt < this.maxRetries - 1) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new Error(`Qwen API call failed after ${this.maxRetries} attempts: ${lastError.message}`);
  }

  /**
   * Parse JSON from LLM response
   * @param {string} content - LLM response content
   * @returns {Object} Parsed JSON object
   */
  parseJSON(content) {
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
      console.error('[QwenClient] Failed to parse JSON:', error.message);
      console.error('[QwenClient] Content:', content);
      throw new Error('Failed to parse JSON from LLM response');
    }
  }

  /**
   * Call with JSON response parsing
   * @param {string} prompt - User prompt
   * @param {Object} options - Call options
   * @returns {Promise<Object>} Parsed JSON response
   */
  async callJSON(prompt, options = {}) {
    const response = await this.call(prompt, options);
    const parsed = this.parseJSON(response.content);
    
    return {
      ...parsed,
      _meta: {
        tokens: response.tokens,
        input_tokens: response.input_tokens,
        output_tokens: response.output_tokens,
        model: response.model
      }
    };
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Test connection
   * @returns {Promise<boolean>} True if connection successful
   */
  async testConnection() {
    try {
      await this.call('你好', { maxTokens: 10 });
      return true;
    } catch (error) {
      console.error('[QwenClient] Connection test failed:', error.message);
      return false;
    }
  }
}

/**
 * Create Qwen client instance
 * @param {string} apiKey - Qwen API key
 * @param {Object} options - Client options
 * @returns {QwenClient} Client instance
 */
function createQwenClient(apiKey, options = {}) {
  if (!apiKey) {
    throw new Error('Qwen API key is required');
  }
  
  return new QwenClient(apiKey, options);
}

module.exports = {
  QwenClient,
  createQwenClient
};
