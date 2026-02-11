/**
 * Tests for Retry Utility
 * 
 * Validates: Requirement 12.4
 */

const {
  withRetry,
  retryNetworkRequest,
  retryLLMRequest,
  retryStorageOperation,
  retryDatabaseOperation,
  CircuitBreaker,
  createCircuitBreaker,
  DEFAULT_CONFIG,
} = require('./retry');

describe('Retry Utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      const result = await withRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';
      
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await withRetry(operation, { initialDelay: 10 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry up to maxRetries times', async () => {
      const error = new Error('Timeout');
      error.code = 'ETIMEDOUT';
      const operation = jest.fn().mockRejectedValue(error);

      await expect(withRetry(operation, { maxRetries: 3, initialDelay: 10 }))
        .rejects.toThrow('Timeout');

      expect(operation).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    });

    it('should use exponential backoff', async () => {
      const error1 = new Error('Connection reset');
      error1.code = 'ECONNRESET';
      const error2 = new Error('Connection reset');
      error2.code = 'ECONNRESET';
      
      const operation = jest.fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValue('success');

      const startTime = Date.now();
      await withRetry(operation, {
        maxRetries: 3,
        initialDelay: 100,
        backoffMultiplier: 2
      });
      const duration = Date.now() - startTime;

      // Should wait 100ms + 200ms = 300ms minimum
      expect(duration).toBeGreaterThanOrEqual(300);
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should respect maxDelay', async () => {
      const error1 = new Error('Connection reset');
      error1.code = 'ECONNRESET';
      const error2 = new Error('Connection reset');
      error2.code = 'ECONNRESET';
      
      const operation = jest.fn()
        .mockRejectedValueOnce(error1)
        .mockRejectedValueOnce(error2)
        .mockResolvedValue('success');

      const startTime = Date.now();
      await withRetry(operation, {
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 1500,
        backoffMultiplier: 3
      });
      const duration = Date.now() - startTime;

      // Should wait 1000ms + 1500ms (capped) = 2500ms maximum
      expect(duration).toBeLessThan(3000);
    });

    it('should not retry on non-retryable error', async () => {
      const error = new Error('Invalid input');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(withRetry(operation, { initialDelay: 10 }))
        .rejects.toThrow('Invalid input');

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const onRetry = jest.fn();
      const error = new Error('Connection reset');
      error.code = 'ECONNRESET';
      
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      await withRetry(operation, { initialDelay: 10, onRetry });

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        expect.any(Error),
        1, // attempt number
        expect.any(Number) // delay
      );
    });

    it('should use custom shouldRetry function', async () => {
      const shouldRetry = jest.fn().mockReturnValue(false);
      const operation = jest.fn().mockRejectedValue(new Error('Custom error'));

      await expect(withRetry(operation, { shouldRetry, initialDelay: 10 }))
        .rejects.toThrow('Custom error');

      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error));
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should attach retry stats to error', async () => {
      const error = new Error('Timeout');
      error.code = 'ETIMEDOUT';
      const operation = jest.fn().mockRejectedValue(error);

      try {
        await withRetry(operation, { maxRetries: 2, initialDelay: 10 });
      } catch (err) {
        expect(err.retryStats).toBeDefined();
        expect(err.retryStats.attempts).toBe(3);
        expect(err.retryStats.errors).toHaveLength(3);
        expect(err.retryStats.success).toBe(false);
      }
    });

    it('should timeout long-running operations', async () => {
      const operation = jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 5000))
      );

      await expect(withRetry(operation, { timeout: 100, maxRetries: 0 }))
        .rejects.toThrow('Operation timeout');
    });

    it('should retry on HTTP 429 status code', async () => {
      const error = new Error('Rate limit');
      error.response = { status: 429 };
      
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await withRetry(operation, { initialDelay: 10 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on HTTP 503 status code', async () => {
      const error = new Error('Service unavailable');
      error.response = { status: 503 };
      
      const operation = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue('success');

      const result = await withRetry(operation, { initialDelay: 10 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe('retryNetworkRequest', () => {
    it('should retry network requests with appropriate config', async () => {
      const error = new Error('Network error');
      error.response = { status: 503 };
      
      const requestFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ data: 'success' });

      const result = await retryNetworkRequest(requestFn);

      expect(result).toEqual({ data: 'success' });
      expect(requestFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('retryLLMRequest', () => {
    it('should retry LLM requests with longer timeout', async () => {
      const error = new Error('Timeout');
      error.response = { status: 504 };
      
      const llmFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ content: 'Generated text' });

      const result = await retryLLMRequest(llmFn);

      expect(result).toEqual({ content: 'Generated text' });
      expect(llmFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 401 authentication error', async () => {
      const error = new Error('Unauthorized');
      error.response = { status: 401 };
      
      const llmFn = jest.fn().mockRejectedValue(error);

      await expect(retryLLMRequest(llmFn)).rejects.toThrow('Unauthorized');
      expect(llmFn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 400 bad request', async () => {
      const error = new Error('Bad request');
      error.response = { status: 400 };
      
      const llmFn = jest.fn().mockRejectedValue(error);

      await expect(retryLLMRequest(llmFn)).rejects.toThrow('Bad request');
      expect(llmFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryStorageOperation', () => {
    it('should retry storage operations', async () => {
      const error = new Error('Connection error');
      error.code = 'ECONNRESET';
      
      const storageFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ key: 'file.jpg', url: 'https://...' });

      const result = await retryStorageOperation(storageFn);

      expect(result).toEqual({ key: 'file.jpg', url: 'https://...' });
      expect(storageFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on 403 access denied', async () => {
      const error = new Error('Access denied');
      error.statusCode = 403;
      
      const storageFn = jest.fn().mockRejectedValue(error);

      await expect(retryStorageOperation(storageFn)).rejects.toThrow('Access denied');
      expect(storageFn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on 404 not found', async () => {
      const error = new Error('Not found');
      error.name = 'NoSuchKey';
      
      const storageFn = jest.fn().mockRejectedValue(error);

      await expect(retryStorageOperation(storageFn)).rejects.toThrow('Not found');
      expect(storageFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryDatabaseOperation', () => {
    it('should retry on connection errors', async () => {
      const error = new Error('Connection failed');
      error.code = 'P1001';
      
      const dbFn = jest.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValue({ id: '123', name: 'Test' });

      const result = await retryDatabaseOperation(dbFn);

      expect(result).toEqual({ id: '123', name: 'Test' });
      expect(dbFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on constraint violations', async () => {
      const error = new Error('Unique constraint failed');
      error.code = 'P2002';
      
      const dbFn = jest.fn().mockRejectedValue(error);

      await expect(retryDatabaseOperation(dbFn)).rejects.toThrow('Unique constraint failed');
      expect(dbFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('CircuitBreaker', () => {
    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker();
      
      expect(breaker.getState().state).toBe('CLOSED');
      expect(breaker.getState().failures).toBe(0);
    });

    it('should execute operation successfully', async () => {
      const breaker = new CircuitBreaker();
      const operation = jest.fn().mockResolvedValue('success');

      const result = await breaker.execute(operation);

      expect(result).toBe('success');
      expect(breaker.getState().state).toBe('CLOSED');
      expect(breaker.getState().successes).toBe(1);
    });

    it('should open circuit after threshold failures', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 3 });
      const operation = jest.fn().mockRejectedValue(new Error('Failed'));

      // Fail 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(operation);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState().state).toBe('OPEN');
      expect(breaker.getState().failures).toBe(3);
    });

    it('should reject immediately when circuit is OPEN', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 10000 });
      const operation = jest.fn().mockRejectedValue(new Error('Failed'));

      // Fail twice to open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(operation);
        } catch (error) {
          // Expected
        }
      }

      // Circuit should be OPEN now
      await expect(breaker.execute(operation)).rejects.toThrow('Circuit breaker is OPEN');
      
      // Operation should not be called
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should transition to HALF_OPEN after reset timeout', async () => {
      const breaker = new CircuitBreaker({ failureThreshold: 2, resetTimeout: 100 });
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Failed'))
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValue('success');

      // Fail twice to open circuit
      for (let i = 0; i < 2; i++) {
        try {
          await breaker.execute(operation);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState().state).toBe('OPEN');

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should transition to HALF_OPEN and succeed
      const result = await breaker.execute(operation);
      
      expect(result).toBe('success');
      expect(breaker.getState().state).toBe('CLOSED');
    });

    it('should reset circuit breaker', () => {
      const breaker = new CircuitBreaker();
      const operation = jest.fn().mockRejectedValue(new Error('Failed'));

      // Cause some failures
      breaker.onFailure();
      breaker.onFailure();

      expect(breaker.getState().failures).toBe(2);

      // Reset
      breaker.reset();

      expect(breaker.getState().state).toBe('CLOSED');
      expect(breaker.getState().failures).toBe(0);
      expect(breaker.getState().successes).toBe(0);
    });
  });

  describe('createCircuitBreaker', () => {
    it('should create circuit breaker with custom options', () => {
      const breaker = createCircuitBreaker({
        failureThreshold: 10,
        resetTimeout: 30000
      });

      expect(breaker).toBeInstanceOf(CircuitBreaker);
      expect(breaker.failureThreshold).toBe(10);
      expect(breaker.resetTimeout).toBe(30000);
    });
  });

  describe('Error pattern matching', () => {
    it('should retry on timeout error message', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Request timeout occurred'))
        .mockResolvedValue('success');

      const result = await withRetry(operation, { initialDelay: 10 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on network error message', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Network connection failed'))
        .mockResolvedValue('success');

      const result = await withRetry(operation, { initialDelay: 10 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should retry on rate limit error message', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Rate limit exceeded'))
        .mockResolvedValue('success');

      const result = await withRetry(operation, { initialDelay: 10 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
});
