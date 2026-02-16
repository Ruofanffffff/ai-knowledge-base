const axios = require('axios');
const crypto = require('crypto');

const DEFAULT_MODEL = 'doubao-seedream-4-5-251128';
const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3';
const DEFAULT_IMAGE_SIZE = '1024x576';
const DEFAULT_TIMEOUT = 60000;
const DEFAULT_MAX_RETRIES = 2;
const BASE_RETRY_DELAY = 1000;

class JimengClient {
  constructor(config = {}) {
    this.apiKey = config.apiKey || process.env.ARK_API_KEY || process.env.VOLCENGINE_API_KEY;
    this.accessKeyId = config.accessKeyId || process.env.VOLCENGINE_ACCESS_KEY_ID;
    this.secretAccessKey = config.secretAccessKey || process.env.VOLCENGINE_SECRET_ACCESS_KEY;
    this.model = config.model || process.env.JIMENG_MODEL || DEFAULT_MODEL;
    this.baseURL = config.baseURL || process.env.JIMENG_API_BASE_URL || DEFAULT_BASE_URL;
    this.imageSize = config.imageSize || process.env.JIMENG_IMAGE_SIZE || DEFAULT_IMAGE_SIZE;
    this.timeout = config.timeout || DEFAULT_TIMEOUT;
    this.maxRetries = config.maxRetries != null ? config.maxRetries : DEFAULT_MAX_RETRIES;
    
    const url = new URL(this.baseURL);
    this.host = url.host;
    this.region = 'cn-beijing';
    this.service = 'ark';
  }

  _sha256(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  _hmacSha256(key, data) {
    return crypto.createHmac('sha256', key).update(data).digest();
  }

  _getSignatureKey(key, dateStamp, region, service) {
    const kDate = this._hmacSha256(key, dateStamp);
    const kRegion = this._hmacSha256(kDate, region);
    const kService = this._hmacSha256(kRegion, service);
    const kSigning = this._hmacSha256(kService, 'request');
    return kSigning;
  }

  _createSignature(method, path, query, headers, body) {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);

    const canonicalUri = path;
    const canonicalQuerystring = Object.keys(query || {})
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
      .join('&');

    const signedHeaders = ['content-type', 'host', 'x-content-sha256', 'x-date'];
    const canonicalHeaders = [
      `content-type:${headers['Content-Type']}`,
      `host:${this.host}`,
      `x-content-sha256:${this._sha256(body)}`,
      `x-date:${amzDate}`,
    ].join('\n') + '\n';

    const payloadHash = this._sha256(body);
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuerystring,
      canonicalHeaders,
      signedHeaders.join(';'),
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.region}/${this.service}/request`;
    const stringToSign = [
      'HMAC-SHA256',
      amzDate,
      credentialScope,
      this._sha256(canonicalRequest),
    ].join('\n');

    const signingKey = this._getSignatureKey(this.secretAccessKey, dateStamp, this.region, this.service);
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authorization = `HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders.join(';')}, Signature=${signature}`;

    return {
      'X-Date': amzDate,
      'X-Content-Sha256': payloadHash,
      'Authorization': authorization,
    };
  }

  async generateImage(prompt) {
    const path = '/api/v3/images/generations';
    const body = JSON.stringify({
      model: this.model,
      prompt,
      response_format: 'url',
      size: this.imageSize,
      watermark: false,
    });

    let headers;
    
    if (this.accessKeyId && this.secretAccessKey) {
      headers = {
        'Content-Type': 'application/json',
        'Host': this.host,
        ...this._createSignature('POST', path, {}, { 'Content-Type': 'application/json' }, body),
      };
    } else if (this.apiKey) {
      headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      };
    } else {
      throw new Error('请配置 ARK_API_KEY 或 VOLCENGINE_ACCESS_KEY_ID/VOLCENGINE_SECRET_ACCESS_KEY');
    }

    const url = `${this.baseURL}/images/generations`;

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
        const errorData = err.response?.data;
        console.error(
          `即梦AI请求失败 (attempt ${attempt + 1}/${this.maxRetries + 1}):`,
          status || err.message,
          errorData ? JSON.stringify(errorData) : ''
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

  _parseResponse(data) {
    if (!data || !Array.isArray(data.data) || data.data.length === 0) {
      throw new Error('即梦AI返回空数据');
    }

    return data.data.map(item => ({
      url: item.url,
      revisedPrompt: item.revised_prompt || '',
    }));
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { JimengClient };
