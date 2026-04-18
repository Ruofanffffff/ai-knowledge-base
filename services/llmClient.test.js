const LLMClient = require('./llmClient');

// Save original fetch
const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
});

function mockFetch(responseData, ok = true, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(responseData),
    text: () => Promise.resolve(JSON.stringify(responseData)),
  });
}

describe('LLMClient', () => {
  describe('_extractText', () => {
    it('extracts from data.output.text', () => {
      const result = LLMClient._extractText({ output: { text: 'hello' } });
      expect(result).toBe('hello');
    });

    it('extracts from data.output.choices', () => {
      const result = LLMClient._extractText({
        output: { choices: [{ message: { content: 'world' } }] },
      });
      expect(result).toBe('world');
    });

    it('extracts from data.choices', () => {
      const result = LLMClient._extractText({
        choices: [{ message: { content: 'foo' } }],
      });
      expect(result).toBe('foo');
    });

    it('throws on invalid format', () => {
      expect(() => LLMClient._extractText({})).toThrow('Invalid response format');
    });
  });

  describe('_parseJSON', () => {
    it('parses plain JSON', () => {
      const result = LLMClient._parseJSON('[{"name":"test"}]');
      expect(result).toEqual([{ name: 'test' }]);
    });

    it('parses JSON wrapped in markdown code fences', () => {
      const text = '```json\n[{"name":"test"}]\n```';
      const result = LLMClient._parseJSON(text);
      expect(result).toEqual([{ name: 'test' }]);
    });

    it('parses JSON wrapped in code fences without language tag', () => {
      const text = '```\n{"key":"value"}\n```';
      const result = LLMClient._parseJSON(text);
      expect(result).toEqual({ key: 'value' });
    });

    it('throws on invalid JSON', () => {
      expect(() => LLMClient._parseJSON('not json')).toThrow('not valid JSON');
    });
  });

  describe('call', () => {
    it('returns text from successful API call', async () => {
      mockFetch({ output: { text: 'response text' } });
      const result = await LLMClient.call('test prompt');
      expect(result).toBe('response text');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('sends correct request body', async () => {
      mockFetch({ output: { text: 'ok' } });
      await LLMClient.call('my prompt', { temperature: 0.5, maxTokens: 1000 });

      const [url, opts] = global.fetch.mock.calls[0];
      expect(url).toBe('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation');
      const body = JSON.parse(opts.body);
      expect(body.model).toBe('qwen-plus');
      expect(body.input.messages[0].content).toBe('my prompt');
      expect(body.parameters.temperature).toBe(0.5);
      expect(body.parameters.max_tokens).toBe(1000);
    });

    it('throws on non-ok response', async () => {
      mockFetch({ error: 'bad request' }, false, 400);
      await expect(LLMClient.call('test')).rejects.toThrow('Qwen API error: 400');
    });

    it('throws on timeout', async () => {
      global.fetch = jest.fn().mockImplementation(() => {
        return new Promise((_, reject) => {
          const err = new Error('aborted');
          err.name = 'AbortError';
          setTimeout(() => reject(err), 10);
        });
      });
      await expect(LLMClient.call('test', { timeout: 5 })).rejects.toThrow('timed out');
    });
  });

  describe('callWithMeta', () => {
    it('returns text and token usage when available', async () => {
      mockFetch({
        output: { text: 'ok' },
        usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
      });
      const res = await LLMClient.callWithMeta('test prompt');
      expect(res).toEqual({
        text: 'ok',
        usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      });
    });

    it('returns null usage when unavailable', async () => {
      mockFetch({ output: { text: 'ok' } });
      const res = await LLMClient.callWithMeta('test prompt');
      expect(res).toEqual({ text: 'ok', usage: null });
    });
  });

  describe('callJSON', () => {
    it('returns parsed JSON from API response', async () => {
      mockFetch({ output: { text: '[{"name":"entity1"}]' } });
      const result = await LLMClient.callJSON('extract entities');
      expect(result).toEqual([{ name: 'entity1' }]);
    });

    it('handles markdown-wrapped JSON in response', async () => {
      mockFetch({ output: { text: '```json\n[{"name":"entity1"}]\n```' } });
      const result = await LLMClient.callJSON('extract entities');
      expect(result).toEqual([{ name: 'entity1' }]);
    });

    it('throws when response is not valid JSON', async () => {
      mockFetch({ output: { text: 'This is not JSON at all' } });
      await expect(LLMClient.callJSON('test')).rejects.toThrow('not valid JSON');
    });
  });

  describe('callJSONWithMeta', () => {
    it('returns parsed JSON and usage', async () => {
      mockFetch({
        output: { text: '{"ok":true}' },
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      });
      const res = await LLMClient.callJSONWithMeta('test');
      expect(res).toEqual({
        data: { ok: true },
        usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 },
      });
    });
  });
});
