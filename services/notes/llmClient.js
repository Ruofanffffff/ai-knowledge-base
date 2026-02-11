/**
 * LLM Client for Notes Feature
 * 
 * Provides unified interface for:
 * - Multimodal LLM (image analysis with GPT-4 Vision / Claude 3 / Qwen-VL)
 * - Text LLM (text enhancement with GPT-4 / Claude 3 / Qwen)
 * 
 * Features:
 * - Request retry with exponential backoff
 * - Timeout handling
 * - Response parsing and validation
 * - Token usage tracking
 * 
 * Validates: Requirements 2.2, 2.3, 2.4, 5.2, 6.1, 7.1, 8.1
 */

const axios = require('axios');
const { notesConfig } = require('../../config/notes.config');

/**
 * Base LLM Client class
 */
class BaseLLMClient {
  constructor(config = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.LLM_API_KEY,
      timeout: config.timeout || notesConfig.llm?.timeout || 30000,
      maxRetries: config.maxRetries || notesConfig.llm?.maxRetries || 3,
      initialDelay: config.initialDelay || notesConfig.llm?.initialDelay || 1000,
      backoffMultiplier: config.backoffMultiplier || notesConfig.llm?.backoffMultiplier || 2,
      ...config
    };

    if (!this.config.apiKey) {
      throw new Error('LLM API key is required');
    }

    // Statistics tracking
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      totalTokens: 0,
      totalCost: 0
    };
  }

  /**
   * Make HTTP request with retry logic
   * @protected
   * @param {Object} requestConfig - Axios request configuration
   * @returns {Promise<Object>} Response data
   */
  async _makeRequest(requestConfig) {
    let lastError = null;
    let delay = this.config.initialDelay;

    this.stats.totalCalls++;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await axios({
          ...requestConfig,
          timeout: this.config.timeout,
          headers: {
            'Content-Type': 'application/json',
            ...requestConfig.headers
          }
        });

        this.stats.successfulCalls++;
        return response.data;
      } catch (error) {
        lastError = error;

        console.error(`[LLMClient] Attempt ${attempt + 1}/${this.config.maxRetries + 1} failed:`, 
          error.response?.data?.error?.message || error.message);

        // Don't retry on certain errors
        if (this._isNonRetryableError(error)) {
          break;
        }

        // Wait before retry
        if (attempt < this.config.maxRetries) {
          await this._sleep(delay);
          delay *= this.config.backoffMultiplier;
        }
      }
    }

    this.stats.failedCalls++;
    throw new Error(`LLM request failed after ${this.config.maxRetries + 1} attempts: ${lastError.message}`);
  }

  /**
   * Check if error should not be retried
   * @protected
   * @param {Error} error - Error object
   * @returns {boolean}
   */
  _isNonRetryableError(error) {
    if (!error.response) return false;

    const status = error.response.status;
    
    // Don't retry on client errors (except rate limiting)
    if (status === 401 || status === 403 || status === 400) {
      return true;
    }

    return false;
  }

  /**
   * Sleep utility
   * @protected
   * @param {number} ms - Milliseconds to sleep
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      ...this.stats,
      successRate: this.stats.totalCalls > 0
        ? Math.round((this.stats.successfulCalls / this.stats.totalCalls) * 100)
        : 0
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
      totalCost: 0
    };
  }
}

/**
 * Multimodal LLM Client for image analysis
 * Supports GPT-4 Vision, Claude 3, Qwen-VL
 */
class MultimodalLLMClient extends BaseLLMClient {
  constructor(config = {}) {
    super(config);
    
    this.config.model = config.model || notesConfig.llm?.multimodalModel || 'gpt-4-vision-preview';
    this.config.provider = config.provider || this._detectProvider(this.config.model);
    this.config.baseURL = config.baseURL || this._getBaseURL(this.config.provider);
  }

  /**
   * Detect provider from model name
   * @private
   */
  _detectProvider(model) {
    if (model.includes('gpt') || model.includes('vision')) return 'openai';
    if (model.includes('claude')) return 'anthropic';
    if (model.includes('qwen')) return 'qwen';
    if (model.includes('seed')) return 'volcengine'; // seed1.8, seedance, seedream
    return 'openai'; // default
  }

  /**
   * Get base URL for provider
   * @private
   */
  _getBaseURL(provider) {
    const urls = {
      openai: 'https://api.openai.com/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages',
      qwen: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      volcengine: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions' // 字节火山引擎
    };
    return urls[provider] || urls.openai;
  }

  /**
   * Analyze image with multimodal LLM
   * Requirement 2.2, 2.3, 2.4: Use multimodal LLM for image analysis
   * 
   * @param {Object} options - Analysis options
   * @param {string} options.imageUrl - Image URL or base64 data
   * @param {string} options.prompt - Analysis prompt
   * @param {Object} [options.config] - Additional configuration
   * @returns {Promise<Object>} Analysis result
   */
  async analyzeImage(options) {
    const { imageUrl, prompt, config = {} } = options;

    if (!imageUrl || !prompt) {
      throw new Error('imageUrl and prompt are required');
    }

    const requestBody = this._buildImageAnalysisRequest(imageUrl, prompt, config);
    const requestConfig = {
      method: 'POST',
      url: this.config.baseURL,
      data: requestBody,
      headers: this._getAuthHeaders()
    };

    const response = await this._makeRequest(requestConfig);
    return this._parseImageAnalysisResponse(response);
  }

  /**
   * Build request body for image analysis
   * @private
   */
  _buildImageAnalysisRequest(imageUrl, prompt, config) {
    const temperature = config.temperature || 0.7;
    const maxTokens = config.maxTokens || 1000;

    switch (this.config.provider) {
      case 'openai':
        return {
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }
          ],
          max_tokens: maxTokens,
          temperature
        };

      case 'anthropic':
        return {
          model: this.config.model,
          max_tokens: maxTokens,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image', source: { type: 'url', url: imageUrl } }
              ]
            }
          ],
          temperature
        };

      case 'qwen':
        return {
          model: this.config.model,
          input: {
            messages: [
              {
                role: 'user',
                content: [
                  { text: prompt },
                  { image: imageUrl }
                ]
              }
            ]
          },
          parameters: {
            temperature,
            max_tokens: maxTokens
          }
        };

      case 'volcengine':
        // 字节火山引擎 seed1.8 模型 - 兼容OpenAI格式
        return {
          model: this.config.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: imageUrl } }
              ]
            }
          ],
          max_tokens: maxTokens,
          temperature
        };

      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Parse image analysis response
   * @private
   */
  _parseImageAnalysisResponse(response) {
    let content, tokens;

    switch (this.config.provider) {
      case 'openai':
      case 'volcengine': // 字节火山引擎使用OpenAI兼容格式
        content = response.choices[0].message.content;
        tokens = response.usage?.total_tokens || 0;
        break;

      case 'anthropic':
        content = response.content[0].text;
        tokens = response.usage?.input_tokens + response.usage?.output_tokens || 0;
        break;

      case 'qwen':
        content = response.output.choices[0].message.content;
        tokens = response.usage?.total_tokens || 0;
        break;

      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }

    this.stats.totalTokens += tokens;

    return {
      content,
      tokens,
      model: this.config.model,
      provider: this.config.provider
    };
  }

  /**
   * Get authentication headers
   * @private
   */
  _getAuthHeaders() {
    switch (this.config.provider) {
      case 'openai':
        return { 'Authorization': `Bearer ${this.config.apiKey}` };
      
      case 'anthropic':
        return {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        };
      
      case 'qwen':
        return { 'Authorization': `Bearer ${this.config.apiKey}` };
      
      case 'volcengine':
        return { 'Authorization': `Bearer ${this.config.apiKey}` };
      
      default:
        return { 'Authorization': `Bearer ${this.config.apiKey}` };
    }
  }
}

/**
 * Text LLM Client for text enhancement
 * Supports GPT-4, Claude 3, Qwen
 */
class TextLLMClient extends BaseLLMClient {
  constructor(config = {}) {
    super(config);
    
    this.config.model = config.model || notesConfig.llm?.textModel || 'gpt-4';
    this.config.provider = config.provider || this._detectProvider(this.config.model);
    this.config.baseURL = config.baseURL || this._getBaseURL(this.config.provider);
  }

  /**
   * Detect provider from model name
   * @private
   */
  _detectProvider(model) {
    if (model.includes('gpt')) return 'openai';
    if (model.includes('claude')) return 'anthropic';
    if (model.includes('qwen')) return 'qwen';
    if (model.includes('seed')) return 'volcengine'; // seedance, seedream
    return 'openai'; // default
  }

  /**
   * Get base URL for provider
   * @private
   */
  _getBaseURL(provider) {
    const urls = {
      openai: 'https://api.openai.com/v1/chat/completions',
      anthropic: 'https://api.anthropic.com/v1/messages',
      qwen: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
      volcengine: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions' // 字节火山引擎
    };
    return urls[provider] || urls.openai;
  }

  /**
   * Generate text completion
   * Requirement 5.2, 6.1, 7.1, 8.1: Use text LLM for text enhancement
   * 
   * @param {Object} options - Generation options
   * @param {string} options.prompt - User prompt
   * @param {string} [options.systemPrompt] - System prompt
   * @param {Object} [options.config] - Additional configuration
   * @returns {Promise<Object>} Generation result
   */
  async generate(options) {
    const { prompt, systemPrompt, config = {} } = options;

    if (!prompt) {
      throw new Error('prompt is required');
    }

    const requestBody = this._buildGenerationRequest(prompt, systemPrompt, config);
    const requestConfig = {
      method: 'POST',
      url: this.config.baseURL,
      data: requestBody,
      headers: this._getAuthHeaders()
    };

    const response = await this._makeRequest(requestConfig);
    return this._parseGenerationResponse(response);
  }

  /**
   * Generate with JSON response
   * @param {Object} options - Generation options
   * @returns {Promise<Object>} Parsed JSON result
   */
  async generateJSON(options) {
    const result = await this.generate(options);
    
    try {
      const parsed = this._parseJSON(result.content);
      return {
        data: parsed,
        tokens: result.tokens,
        model: result.model
      };
    } catch (error) {
      throw new Error(`Failed to parse JSON from LLM response: ${error.message}`);
    }
  }

  /**
   * Build request body for text generation
   * @private
   */
  _buildGenerationRequest(prompt, systemPrompt, config) {
    const temperature = config.temperature || 0.7;
    const maxTokens = config.maxTokens || 2000;

    switch (this.config.provider) {
      case 'openai':
      case 'volcengine': // 字节火山引擎使用OpenAI兼容格式
        const messages = [];
        if (systemPrompt) {
          messages.push({ role: 'system', content: systemPrompt });
        }
        messages.push({ role: 'user', content: prompt });

        return {
          model: this.config.model,
          messages,
          temperature,
          max_tokens: maxTokens
        };

      case 'anthropic':
        return {
          model: this.config.model,
          max_tokens: maxTokens,
          system: systemPrompt || '你是一个专业的AI助手。',
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature
        };

      case 'qwen':
        const qwenMessages = [];
        if (systemPrompt) {
          qwenMessages.push({ role: 'system', content: systemPrompt });
        }
        qwenMessages.push({ role: 'user', content: prompt });

        return {
          model: this.config.model,
          input: { messages: qwenMessages },
          parameters: {
            temperature,
            max_tokens: maxTokens,
            result_format: 'message'
          }
        };

      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Parse generation response
   * @private
   */
  _parseGenerationResponse(response) {
    let content, tokens;

    switch (this.config.provider) {
      case 'openai':
      case 'volcengine': // 字节火山引擎使用OpenAI兼容格式
        content = response.choices[0].message.content;
        tokens = response.usage?.total_tokens || 0;
        break;

      case 'anthropic':
        content = response.content[0].text;
        tokens = response.usage?.input_tokens + response.usage?.output_tokens || 0;
        break;

      case 'qwen':
        content = response.output.choices[0].message.content;
        tokens = response.usage?.total_tokens || 0;
        break;

      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }

    this.stats.totalTokens += tokens;

    return {
      content,
      tokens,
      model: this.config.model,
      provider: this.config.provider
    };
  }

  /**
   * Parse JSON from text
   * @private
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
   * Get authentication headers
   * @private
   */
  _getAuthHeaders() {
    switch (this.config.provider) {
      case 'openai':
        return { 'Authorization': `Bearer ${this.config.apiKey}` };
      
      case 'anthropic':
        return {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01'
        };
      
      case 'qwen':
        return { 'Authorization': `Bearer ${this.config.apiKey}` };
      
      case 'volcengine':
        return { 'Authorization': `Bearer ${this.config.apiKey}` };
      
      default:
        return { 'Authorization': `Bearer ${this.config.apiKey}` };
    }
  }
}

/**
 * Create multimodal LLM client
 * @param {Object} config - Client configuration
 * @returns {MultimodalLLMClient}
 */
function createMultimodalLLMClient(config = {}) {
  return new MultimodalLLMClient(config);
}

/**
 * Create text LLM client
 * @param {Object} config - Client configuration
 * @returns {TextLLMClient}
 */
function createTextLLMClient(config = {}) {
  return new TextLLMClient(config);
}

module.exports = {
  BaseLLMClient,
  MultimodalLLMClient,
  TextLLMClient,
  createMultimodalLLMClient,
  createTextLLMClient
};
