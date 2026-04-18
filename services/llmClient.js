require('dotenv').config();

const DEFAULT_ENDPOINT = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation';
const DEFAULT_MODEL = 'qwen-plus';
const DEFAULT_TIMEOUT = 60000;

class LLMClient {
  constructor() {
    this.apiKey = process.env.QWEN_API_KEY;
    this.endpoint = DEFAULT_ENDPOINT;
    this.model = DEFAULT_MODEL;
  }

  async _callApi(prompt, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 2000,
      timeout = DEFAULT_TIMEOUT,
      model = this.model,
      systemPrompt = null,
    } = options;

    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const body = {
      model,
      input: {
        messages,
      },
      parameters: {
        temperature,
        top_p: 0.9,
        max_tokens: maxTokens,
      },
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Qwen API error:', response.status, errorText);
        throw new Error(`Qwen API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.error('Qwen API request timed out');
        throw new Error('Qwen API request timed out');
      }
      console.error('LLMClient.call error:', err.message);
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 调用Qwen API，返回文本响应
   * @param {string} prompt - 提示词
   * @param {object} options - 可选参数 {temperature, maxTokens, timeout, model}
   * @returns {Promise<string>} LLM响应文本
   */
  async call(prompt, options = {}) {
    const data = await this._callApi(prompt, options);
    return this._extractText(data);
  }

  async callWithMeta(prompt, options = {}) {
    const data = await this._callApi(prompt, options);
    return { text: this._extractText(data), usage: this._extractUsage(data) };
  }

  /**
   * 调用Qwen API并解析JSON响应
   * @param {string} prompt - 提示词
   * @param {object} options - 可选参数
   * @returns {Promise<object>} 解析后的JSON对象
   */
  async callJSON(prompt, options = {}) {
    const text = await this.call(prompt, options);
    return this._parseJSON(text);
  }

  async callJSONWithMeta(prompt, options = {}) {
    const { text, usage } = await this.callWithMeta(prompt, options);
    return { data: this._parseJSON(text), usage };
  }

  /**
   * 从API响应中提取文本（兼容多种响应格式）
   */
  _extractText(data) {
    if (data.output && data.output.text) {
      return data.output.text;
    }
    if (data.output && data.output.choices && data.output.choices.length > 0) {
      return data.output.choices[0].message.content;
    }
    if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    }
    console.error('Cannot parse Qwen API response:', JSON.stringify(data));
    throw new Error('Invalid response format from Qwen API');
  }

  _extractUsage(data) {
    const u = data?.usage || data?.output?.usage || null;
    if (!u || typeof u !== 'object') return null;

    const promptTokens = Number(u.prompt_tokens ?? u.input_tokens ?? u.inputTokens ?? NaN);
    const completionTokens = Number(u.completion_tokens ?? u.output_tokens ?? u.outputTokens ?? NaN);
    const totalTokens = Number(u.total_tokens ?? u.totalTokens ?? NaN);

    const out = {};
    if (!Number.isNaN(promptTokens)) out.promptTokens = promptTokens;
    if (!Number.isNaN(completionTokens)) out.completionTokens = completionTokens;
    if (!Number.isNaN(totalTokens)) out.totalTokens = totalTokens;
    if (!Object.keys(out).length) return null;
    return out;
  }

  /**
   * 从LLM文本响应中解析JSON，处理markdown代码块包裹的情况
   */
  _parseJSON(text) {
    // Strip markdown code fences if present
    let cleaned = text.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) {
      cleaned = fenceMatch[1].trim();
    }

    try {
      return JSON.parse(cleaned);
    } catch (err) {
      console.error('Failed to parse JSON from LLM response:', text);
      throw new Error('LLM response is not valid JSON');
    }
  }
}

module.exports = new LLMClient();
