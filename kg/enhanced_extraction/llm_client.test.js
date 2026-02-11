/**
 * Unit Tests for LLMClient
 * 
 * Tests retry logic, timeout handling, token tracking, and error handling
 */

const { LLMClient, createLLMClient } = require('./llm_client');
const { createQwenClient } = require('../utils/qwen_client');

// Mock the qwen_client module
jest.mock('../utils/qwen_client');

describe('LLMClient', () => {
  let mockQwenClient;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock Qwen client
    mockQwenClient = {
      call: jest.fn()
    };

    createQwenClient.mockReturnValue(mockQwenClient);
  });

  describe('Constructor', () => {
    it('should create client with default config', () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      expect(client.config.apiKey).toBe('test-key');
      expect(client.config.model).toBe('qwen-turbo');
      expect(client.config.maxRetries).toBe(3);
      expect(client.config.timeout).toBe(30000);
    });

    it('should create client with custom config', () => {
      const client = new LLMClient({
        apiKey: 'test-key',
        model: 'qwen-plus',
        maxRetries: 5,
        timeout: 60000,
        temperature: 0.5
      });
      
      expect(client.config.model).toBe('qwen-plus');
      expect(client.config.maxRetries).toBe(5);
      expect(client.config.timeout).toBe(60000);
      expect(client.config.temperature).toBe(0.5);
    });

    it('should throw error if API key is missing', () => {
      expect(() => new LLMClient({})).toThrow('LLM API key is required');
    });

    it('should initialize stats', () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      expect(client.stats.totalCalls).toBe(0);
      expect(client.stats.successfulCalls).toBe(0);
      expect(client.stats.failedCalls).toBe(0);
      expect(client.stats.totalTokens).toBe(0);
    });
  });

  describe('call', () => {
    it('should successfully call LLM', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      mockQwenClient.call.mockResolvedValue({
        content: 'Test response',
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50,
        model: 'qwen-turbo'
      });

      const response = await client.call('Test prompt');

      expect(response.content).toBe('Test response');
      expect(response.tokens).toBe(100);
      expect(response.inputTokens).toBe(50);
      expect(response.outputTokens).toBe(50);
      expect(response.model).toBe('qwen-turbo');
      expect(response.attempt).toBe(1);
      expect(response.processingTime).toBeGreaterThanOrEqual(0);
    });

    it('should track token usage', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      mockQwenClient.call.mockResolvedValue({
        content: 'Test response',
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50,
        model: 'qwen-turbo'
      });

      await client.call('Test prompt');

      expect(client.stats.totalCalls).toBe(1);
      expect(client.stats.successfulCalls).toBe(1);
      expect(client.stats.totalTokens).toBe(100);
      expect(client.stats.totalInputTokens).toBe(50);
      expect(client.stats.totalOutputTokens).toBe(50);
      expect(client.stats.totalCost).toBeGreaterThan(0);
    });

    it('should retry on failure with exponential backoff', async () => {
      const client = new LLMClient({ apiKey: 'test-key', maxRetries: 3 });
      
      // Fail twice, then succeed
      mockQwenClient.call
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          content: 'Success',
          tokens: 100,
          input_tokens: 50,
          output_tokens: 50,
          model: 'qwen-turbo'
        });

      const response = await client.call('Test prompt');

      expect(response.content).toBe('Success');
      expect(response.attempt).toBe(3);
      expect(mockQwenClient.call).toHaveBeenCalledTimes(3);
      expect(client.stats.successfulCalls).toBe(1);
    });

    it('should fail after max retries', async () => {
      const client = new LLMClient({ apiKey: 'test-key', maxRetries: 3 });
      
      mockQwenClient.call.mockRejectedValue(new Error('Network error'));

      await expect(client.call('Test prompt')).rejects.toThrow('LLM call failed after 3 attempts');
      
      expect(mockQwenClient.call).toHaveBeenCalledTimes(3);
      expect(client.stats.failedCalls).toBe(1);
    });

    it('should not retry on authentication errors', async () => {
      const client = new LLMClient({ apiKey: 'test-key', maxRetries: 3 });
      
      mockQwenClient.call.mockRejectedValue(new Error('Invalid API key'));

      await expect(client.call('Test prompt')).rejects.toThrow('LLM call failed after 3 attempts');
      
      // Should only try once for non-retryable errors
      expect(mockQwenClient.call).toHaveBeenCalledTimes(1);
    });

    it('should not retry on invalid request errors', async () => {
      const client = new LLMClient({ apiKey: 'test-key', maxRetries: 3 });
      
      mockQwenClient.call.mockRejectedValue(new Error('Invalid request'));

      await expect(client.call('Test prompt')).rejects.toThrow('LLM call failed after 3 attempts');
      
      expect(mockQwenClient.call).toHaveBeenCalledTimes(1);
    });

    it('should use custom options', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      mockQwenClient.call.mockResolvedValue({
        content: 'Test response',
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50,
        model: 'qwen-turbo'
      });

      await client.call('Test prompt', {
        temperature: 0.5,
        maxTokens: 1000,
        systemPrompt: 'Custom system prompt'
      });

      expect(mockQwenClient.call).toHaveBeenCalledWith('Test prompt', {
        temperature: 0.5,
        maxTokens: 1000,
        systemPrompt: 'Custom system prompt'
      });
    });

    it('should respect custom maxRetries in options', async () => {
      const client = new LLMClient({ apiKey: 'test-key', maxRetries: 3 });
      
      mockQwenClient.call.mockRejectedValue(new Error('Network error'));

      await expect(client.call('Test prompt', { maxRetries: 1 })).rejects.toThrow();
      
      expect(mockQwenClient.call).toHaveBeenCalledTimes(1);
    });
  });

  describe('callJSON', () => {
    it('should parse JSON response', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      const jsonResponse = { entities: [], relations: [] };
      mockQwenClient.call.mockResolvedValue({
        content: JSON.stringify(jsonResponse),
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50,
        model: 'qwen-turbo'
      });

      const response = await client.callJSON('Test prompt');

      expect(response.data).toEqual(jsonResponse);
      expect(response.metadata.tokens).toBe(100);
      expect(response.metadata.model).toBe('qwen-turbo');
    });

    it('should parse JSON from markdown code block', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      const jsonResponse = { entities: [], relations: [] };
      const markdownContent = '```json\n' + JSON.stringify(jsonResponse) + '\n```';
      
      mockQwenClient.call.mockResolvedValue({
        content: markdownContent,
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50,
        model: 'qwen-turbo'
      });

      const response = await client.callJSON('Test prompt');

      expect(response.data).toEqual(jsonResponse);
    });

    it('should throw error on invalid JSON', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      mockQwenClient.call.mockResolvedValue({
        content: 'Not valid JSON',
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50,
        model: 'qwen-turbo'
      });

      await expect(client.callJSON('Test prompt')).rejects.toThrow('Failed to parse JSON from LLM response');
    });
  });

  describe('getStats', () => {
    it('should return statistics', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      mockQwenClient.call.mockResolvedValue({
        content: 'Test',
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50,
        model: 'qwen-turbo'
      });

      await client.call('Test 1');
      await client.call('Test 2');

      const stats = client.getStats();

      expect(stats.totalCalls).toBe(2);
      expect(stats.successfulCalls).toBe(2);
      expect(stats.failedCalls).toBe(0);
      expect(stats.totalTokens).toBe(200);
      expect(stats.averageTokensPerCall).toBe(100);
      expect(stats.successRate).toBe(100);
      expect(stats.estimatedCost).toBeGreaterThanOrEqual(0);
    });

    it('should handle zero calls', () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      const stats = client.getStats();

      expect(stats.averageTokensPerCall).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('should reset statistics', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      mockQwenClient.call.mockResolvedValue({
        content: 'Test',
        tokens: 100,
        input_tokens: 50,
        output_tokens: 50,
        model: 'qwen-turbo'
      });

      await client.call('Test');
      
      expect(client.stats.totalCalls).toBe(1);

      client.resetStats();

      expect(client.stats.totalCalls).toBe(0);
      expect(client.stats.successfulCalls).toBe(0);
      expect(client.stats.totalTokens).toBe(0);
    });
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      mockQwenClient.call.mockResolvedValue({
        content: 'Test',
        tokens: 10,
        input_tokens: 5,
        output_tokens: 5,
        model: 'qwen-turbo'
      });

      const result = await client.testConnection();

      expect(result).toBe(true);
    });

    it('should return false on failed connection', async () => {
      const client = new LLMClient({ apiKey: 'test-key' });
      
      mockQwenClient.call.mockRejectedValue(new Error('Connection failed'));

      const result = await client.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('createLLMClient', () => {
    it('should create client instance', () => {
      const client = createLLMClient({ apiKey: 'test-key' });
      
      expect(client).toBeInstanceOf(LLMClient);
      expect(client.config.apiKey).toBe('test-key');
    });
  });
});
