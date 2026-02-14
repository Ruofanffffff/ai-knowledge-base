const axios = require('axios');

const DEFAULT_MODEL = 'seedream-3-0-t2i-250415';
const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_IMAGE_SIZE = '1024x576';
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_MAX_RETRIES = 2;
const BASE_RETRY_DELAY = 1000;

class JimengClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.VOLCENGINE_API_KEY;
    this.model = config.model || process.env.JIMENG_MODEL || DEFAULT_MODEL;
    this.baseURL = config.baseURL || process.env.JIMENG_API_BASE_URL || DEFAULT_BASE_URL;
    this.imageSize = config.imageSize || process.env.JIMENG_IMAGE_SIZE || DEFAULT_IMAGE_SIZE;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries != null ? config.maxRetries : DEFAULT_MAX_RETRIES;
  }

  /**
   * 生成图片
   * @param {string} prompt - 图片描述提示词
   * @returns {Promise<Array<{url: string, revisedPrompt: string}>>} 所有生成的图片
   */
  async generateImage(prompt) {
    const url = `${this.baseURL}/images/generations`;
    const body = {
      model: this.model,
      prompt,
      response_format: 'url',
      size: this.imageSize,
      watermark: false,
    };
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    };

    let lastError;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await axios.post(url, body, {
          headers,
          timeout: this.timeout,
        });

        return this._parseResponse(response.data);
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        console.error(
          `即梦AI请求失败 (attempt ${attempt + 1}/${this.maxRetries + 1}):`,
          status || err.message
        );

        if (attempt < this.maxRetries) {
          const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
          await this._sleep(delay);
        }
      }
    }

    console.error('即梦AI所有重试均失败:', lastError?.message);
    throw lastError;
  }

  /**
   * 解析API响应，提取所有图片的 url 和 revised_prompt
   * @param {object} data - API 响应体
   * @returns {Array<{url: string, revisedPrompt: string}>}
   */
  _parseResponse(data) {
    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error('即梦AI返回空数据');
    }

    return data.data.map(item => ({
      url: item.url,
      revisedPrompt: item.revised_prompt || '',
    }));
  }

  /**
   * @param {number} ms
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { JimengClient };
