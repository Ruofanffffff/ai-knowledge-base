/**
 * Retry Utility for Notes Feature
 * 
 * Provides configurable retry logic for:
 * - Network requests
 * - LLM requests
 * - Storage operations
 * - Database operations
 * 
 * Features:
 * - Exponential backoff
 * - Configurable retry conditions
 * - Timeout handling
 * - Circuit breaker pattern
 * 
 * Validates: Requirement 12.4
 */

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG = {
  maxRetries: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  timeout: 30000, // 30 seconds
  retryableErrors: [
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ECONNREFUSED',
    'EHOSTUNREACH',
    'EPIPE',
    'EAI_AGAIN'
  ],
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
  shouldRetry: null, // Custom retry condition function
};

/**
 * Retry options interface
 * @typedef {Object} RetryOptions
 * @property {number} [maxRetries=3] - Maximum number of retry attempts
 * @property {number} [initialDelay=1000] - Initial delay in milliseconds
 * @property {number} [maxDelay=30000] - Maximum delay in milliseconds
 * @property {number} [backoffMultiplier=2] - Backoff multiplier for exponential backoff
 * @property {number} [timeout=30000] - Operation timeout in milliseconds
 * @property {string[]} [retryableErrors] - List of retryable error codes
 * @property {number[]} [retryableStatusCodes] - List of retryable HTTP status codes
 * @property {Function} [shouldRetry] - Custom function to determine if error is retryable
 * @property {Function} [onRetry] - Callback function called before each retry
 */

/**
 * Retry statistics
 * @typedef {Object} RetryStats
 * @property {number} attempts - Total number of attempts
 * @property {number} totalDelay - Total delay time in milliseconds
 * @property {Error[]} errors - Array of errors encountered
 * @property {boolean} success - Whether operation succeeded
 */

/**
 * Execute operation with retry logic
 * Requirement 12.4: Retry operations up to 3 times
 * 
 * @param {Function} operation - Async operation to execute
 * @param {RetryOptions} [options={}] - Retry configuration
 * @returns {Promise<any>} Operation result
 * @throws {Error} If all retry attempts fail
 */
async function withRetry(operation, options = {}) {
  const config = { ...DEFAULT_CONFIG, ...options };
  const stats = {
    attempts: 0,
    totalDelay: 0,
    errors: [],
    success: false
  };

  let delay = config.initialDelay;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    stats.attempts++;

    try {
      // Execute operation with timeout
      const result = await executeWithTimeout(operation, config.timeout);
      stats.success = true;
      return result;
    } catch (error) {
      stats.errors.push(error);

      // Check if we should retry
      const shouldRetry = isRetryable(error, config);
      const isLastAttempt = attempt === config.maxRetries;

      if (!shouldRetry || isLastAttempt) {
        // Attach retry stats to error
        error.retryStats = stats;
        throw error;
      }

      // Call onRetry callback if provided
      if (config.onRetry) {
        await config.onRetry(error, attempt + 1, delay);
      }

      // Wait before retry
      await sleep(delay);
      stats.totalDelay += delay;

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
    }
  }
}

/**
 * Execute operation with timeout
 * @private
 */
async function executeWithTimeout(operation, timeout) {
  return Promise.race([
    operation(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeout)
    )
  ]);
}

/**
 * Check if error is retryable
 * @private
 */
function isRetryable(error, config) {
  // Use custom retry condition if provided
  if (config.shouldRetry) {
    return config.shouldRetry(error);
  }

  // Check error code
  if (error.code && config.retryableErrors.includes(error.code)) {
    return true;
  }

  // Check HTTP status code
  if (error.response?.status && config.retryableStatusCodes.includes(error.response.status)) {
    return true;
  }

  // Check error message patterns
  const retryablePatterns = [
    /timeout/i,
    /network/i,
    /connection/i,
    /unavailable/i,
    /rate limit/i,
    /too many requests/i
  ];

  return retryablePatterns.some(pattern => pattern.test(error.message));
}

/**
 * Sleep utility
 * @private
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry wrapper for network requests
 * Optimized for HTTP/HTTPS requests
 * 
 * @param {Function} requestFn - Request function
 * @param {RetryOptions} [options={}] - Retry configuration
 * @returns {Promise<any>} Request result
 */
async function retryNetworkRequest(requestFn, options = {}) {
  return withRetry(requestFn, {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    ...options
  });
}

/**
 * Retry wrapper for LLM requests
 * Optimized for LLM API calls with longer timeouts
 * 
 * @param {Function} llmFn - LLM request function
 * @param {RetryOptions} [options={}] - Retry configuration
 * @returns {Promise<any>} LLM result
 */
async function retryLLMRequest(llmFn, options = {}) {
  return withRetry(llmFn, {
    maxRetries: 3,
    initialDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 2,
    timeout: 60000, // 60 seconds for LLM
    retryableStatusCodes: [429, 500, 502, 503, 504],
    shouldRetry: (error) => {
      // Don't retry on authentication errors
      if (error.response?.status === 401 || error.response?.status === 403) {
        return false;
      }
      // Don't retry on invalid request errors
      if (error.response?.status === 400) {
        return false;
      }
      return true;
    },
    ...options
  });
}

/**
 * Retry wrapper for storage operations
 * Optimized for S3/object storage operations
 * 
 * @param {Function} storageFn - Storage operation function
 * @param {RetryOptions} [options={}] - Retry configuration
 * @returns {Promise<any>} Storage result
 */
async function retryStorageOperation(storageFn, options = {}) {
  return withRetry(storageFn, {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
    timeout: 30000,
    shouldRetry: (error) => {
      // Don't retry on authentication errors
      if (error.statusCode === 403 || error.name === 'AccessDenied') {
        return false;
      }
      // Don't retry on not found errors
      if (error.statusCode === 404 || error.name === 'NoSuchKey') {
        return false;
      }
      return true;
    },
    ...options
  });
}

/**
 * Retry wrapper for database operations
 * Optimized for database queries
 * 
 * @param {Function} dbFn - Database operation function
 * @param {RetryOptions} [options={}] - Retry configuration
 * @returns {Promise<any>} Database result
 */
async function retryDatabaseOperation(dbFn, options = {}) {
  return withRetry(dbFn, {
    maxRetries: 3,
    initialDelay: 500,
    maxDelay: 5000,
    backoffMultiplier: 2,
    timeout: 10000,
    shouldRetry: (error) => {
      // Retry on connection errors
      if (error.code === 'P1001' || error.code === 'P1002') {
        return true;
      }
      // Retry on timeout errors
      if (error.code === 'P2024') {
        return true;
      }
      // Don't retry on constraint violations
      if (error.code === 'P2002' || error.code === 'P2003') {
        return false;
      }
      return false;
    },
    ...options
  });
}

/**
 * Circuit breaker for preventing cascading failures
 * Implements the circuit breaker pattern
 */
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }

  /**
   * Execute operation through circuit breaker
   * 
   * @param {Function} operation - Operation to execute
   * @returns {Promise<any>} Operation result
   */
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error('Circuit breaker is OPEN');
      }
      // Try to close circuit
      this.state = 'HALF_OPEN';
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
    
    this.successes++;
  }

  onFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.resetTimeout;
    }
  }

  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      nextAttemptTime: this.nextAttemptTime
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = null;
    this.nextAttemptTime = null;
  }
}

/**
 * Create a circuit breaker instance
 * 
 * @param {Object} options - Circuit breaker options
 * @returns {CircuitBreaker}
 */
function createCircuitBreaker(options = {}) {
  return new CircuitBreaker(options);
}

module.exports = {
  withRetry,
  retryNetworkRequest,
  retryLLMRequest,
  retryStorageOperation,
  retryDatabaseOperation,
  CircuitBreaker,
  createCircuitBreaker,
  DEFAULT_CONFIG,
};
