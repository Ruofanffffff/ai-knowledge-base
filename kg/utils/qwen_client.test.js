/**
 * Tests for Qwen LLM Client
 */

const { QwenClient, createQwenClient } = require('./qwen_client');

describe('QwenClient', () => {
  describe('createQwenClient', () => {
    test('should create client with API key', () => {
      const client = createQwenClient('test-api-key');
      expect(client).toBeInstanceOf(QwenClient);
      expect(client.apiKey).toBe('test-api-key');
    });

    test('should throw error without API key', () => {
      expect(() => createQwenClient()).toThrow('Qwen API key is required');
    });

    test('should accept custom options', () => {
      const client = createQwenClient('test-key', {
        model: 'qwen-plus',
        timeout: 60000
      });
      expect(client.model).toBe('qwen-plus');
      expect(client.timeout).toBe(60000);
    });
  });

  describe('QwenClient instance', () => {
    let client;

    beforeEach(() => {
      client = new QwenClient('test-api-key');
    });

    test('should have correct default configuration', () => {
      expect(client.apiKey).toBe('test-api-key');
      expect(client.model).toBe('qwen-turbo');
      expect(client.timeout).toBe(30000);
      expect(client.maxRetries).toBe(3);
    });

    test('should accept custom configuration', () => {
      const customClient = new QwenClient('test-key', {
        model: 'qwen-max',
        timeout: 60000,
        maxRetries: 5
      });
      expect(customClient.model).toBe('qwen-max');
      expect(customClient.timeout).toBe(60000);
      expect(customClient.maxRetries).toBe(5);
    });
  });

  describe('parseJSON', () => {
    let client;

    beforeEach(() => {
      client = new QwenClient('test-api-key');
    });

    test('should parse plain JSON', () => {
      const content = '{"name": "test", "value": 123}';
      const result = client.parseJSON(content);
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    test('should extract JSON from markdown code block', () => {
      const content = '```json\n{"name": "test", "value": 123}\n```';
      const result = client.parseJSON(content);
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    test('should extract JSON from generic code block', () => {
      const content = '```\n{"name": "test", "value": 123}\n```';
      const result = client.parseJSON(content);
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    test('should extract JSON from mixed content', () => {
      const content = 'Here is the result:\n{"name": "test", "value": 123}\nEnd of result';
      const result = client.parseJSON(content);
      expect(result).toEqual({ name: 'test', value: 123 });
    });

    test('should throw error for invalid JSON', () => {
      const content = 'This is not JSON';
      expect(() => client.parseJSON(content)).toThrow('Failed to parse JSON from LLM response');
    });

    test('should throw error for malformed JSON', () => {
      const content = '{"name": "test", "value": }';
      expect(() => client.parseJSON(content)).toThrow('Failed to parse JSON from LLM response');
    });
  });

  describe('sleep', () => {
    let client;

    beforeEach(() => {
      client = new QwenClient('test-api-key');
    });

    test('should sleep for specified duration', async () => {
      const start = Date.now();
      await client.sleep(100);
      const duration = Date.now() - start;
      expect(duration).toBeGreaterThanOrEqual(90); // Allow some tolerance
      expect(duration).toBeLessThan(150);
    });
  });

  describe('Integration tests (mocked)', () => {
    let client;
    let mockAxios;

    beforeEach(() => {
      // Mock axios
      mockAxios = {
        post: jest.fn()
      };
      
      client = new QwenClient('test-api-key');
      
      // Replace axios with mock
      const axios = require('axios');
      axios.post = mockAxios.post;
    });

    test('should call API with correct parameters', async () => {
      mockAxios.post.mockResolvedValue({
        data: {
          output: {
            choices: [{
              message: {
                content: 'Test response'
              }
            }]
          },
          usage: {
            total_tokens: 100,
            input_tokens: 50,
            output_tokens: 50
          }
        }
      });

      const result = await client.call('Test prompt');

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          model: 'qwen-turbo',
          input: {
            messages: expect.arrayContaining([
              expect.objectContaining({ role: 'system' }),
              expect.objectContaining({ role: 'user', content: 'Test prompt' })
            ])
          }
        }),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-api-key',
            'Content-Type': 'application/json'
          })
        })
      );

      expect(result).toEqual({
        content: 'Test response',
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50,
        model: 'qwen-turbo'
      });
    });

    test('should handle API errors with retry', async () => {
      mockAxios.post
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          data: {
            output: {
              choices: [{
                message: {
                  content: 'Success after retry'
                }
              }]
            },
            usage: { total_tokens: 50 }
          }
        });

      const result = await client.call('Test prompt');

      expect(mockAxios.post).toHaveBeenCalledTimes(3);
      expect(result.content).toBe('Success after retry');
    });

    test('should throw error after max retries', async () => {
      mockAxios.post.mockRejectedValue(new Error('Network error'));

      await expect(client.call('Test prompt')).rejects.toThrow(
        'Qwen API call failed after 3 attempts'
      );

      expect(mockAxios.post).toHaveBeenCalledTimes(3);
    });

    test('should not retry on 401 error', async () => {
      mockAxios.post.mockRejectedValue({
        response: { status: 401 }
      });

      await expect(client.call('Test prompt')).rejects.toThrow('Invalid API key');

      expect(mockAxios.post).toHaveBeenCalledTimes(1);
    });

    test('should not retry on 400 error', async () => {
      mockAxios.post.mockRejectedValue({
        response: { 
          status: 400,
          data: { message: 'Bad request' }
        }
      });

      await expect(client.call('Test prompt')).rejects.toThrow('Invalid request');

      expect(mockAxios.post).toHaveBeenCalledTimes(1);
    });
  });
});
