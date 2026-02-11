/**
 * ErrorHandler - Handles errors and implements degradation strategies
 * 
 * Responsibilities:
 * - Classify errors into categories (LLM, Processing, Validation)
 * - Log errors with context
 * - Implement degradation strategies
 * - Track error metrics
 * 
 * Requirements: 8.1, 8.2, 8.4, 8.5
 */

const { PROCESSING_STATUS } = require('./constants');

/**
 * Error categories
 */
const ERROR_CATEGORIES = {
  LLM_ERROR: 'llm_error',
  PROCESSING_ERROR: 'processing_error',
  VALIDATION_ERROR: 'validation_error',
  NETWORK_ERROR: 'network_error',
  UNKNOWN_ERROR: 'unknown_error'
};

/**
 * Error types
 */
const ERROR_TYPES = {
  // LLM Errors
  API_TIMEOUT: 'api_timeout',
  RATE_LIMITING: 'rate_limiting',
  MALFORMED_RESPONSE: 'malformed_response',
  AUTHENTICATION_FAILURE: 'authentication_failure',
  
  // Processing Errors
  INVALID_INPUT: 'invalid_input',
  EMPTY_DOCUMENT: 'empty_document',
  UNSUPPORTED_LANGUAGE: 'unsupported_language',
  MEMORY_OVERFLOW: 'memory_overflow',
  
  // Validation Errors
  SCHEMA_VIOLATION: 'schema_violation',
  MISSING_REQUIRED_FIELDS: 'missing_required_fields',
  INVALID_CONFIDENCE: 'invalid_confidence',
  CIRCULAR_RELATIONS: 'circular_relations',
  
  // Network Errors
  NETWORK_ERROR: 'network_error',
  CONNECTION_REFUSED: 'connection_refused'
};

/**
 * ErrorHandler class
 */
class ErrorHandler {
  constructor(options = {}) {
    this.logger = options.logger || console;
    this.enableMetrics = options.enableMetrics !== false;
    this.errorMetrics = {
      total: 0,
      byCategory: {},
      byType: {}
    };
  }

  /**
   * Classify an error into a category
   * @param {Error} error - The error to classify
   * @returns {string} Error category
   */
  classifyError(error) {
    if (!error) {
      return ERROR_CATEGORIES.UNKNOWN_ERROR;
    }

    const errorMessage = (error.message || '').toLowerCase();
    const errorName = error.name || '';

    // Validation Errors (check first to avoid conflicts)
    if (errorMessage.includes('schema') || errorMessage.includes('validation')) {
      return ERROR_CATEGORIES.VALIDATION_ERROR;
    }
    if (errorMessage.includes('required field') || errorMessage.includes('missing field')) {
      return ERROR_CATEGORIES.VALIDATION_ERROR;
    }
    if (errorMessage.includes('confidence') || errorMessage.includes('invalid score')) {
      return ERROR_CATEGORIES.VALIDATION_ERROR;
    }
    if (errorMessage.includes('circular')) {
      return ERROR_CATEGORIES.VALIDATION_ERROR;
    }

    // Processing Errors
    if (errorMessage.includes('invalid input')) {
      return ERROR_CATEGORIES.PROCESSING_ERROR;
    }
    if (errorMessage.includes('empty document')) {
      return ERROR_CATEGORIES.PROCESSING_ERROR;
    }
    if (errorMessage.includes('unsupported language')) {
      return ERROR_CATEGORIES.PROCESSING_ERROR;
    }
    if (errorMessage.includes('memory') || errorMessage.includes('heap')) {
      return ERROR_CATEGORIES.PROCESSING_ERROR;
    }

    // LLM Errors
    if (errorMessage.includes('timeout') || errorName === 'TimeoutError') {
      return ERROR_CATEGORIES.LLM_ERROR;
    }
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return ERROR_CATEGORIES.LLM_ERROR;
    }
    if (errorMessage.includes('malformed') || errorMessage.includes('parse')) {
      return ERROR_CATEGORIES.LLM_ERROR;
    }
    if (errorMessage.includes('authentication') || errorMessage.includes('401') || errorMessage.includes('403')) {
      return ERROR_CATEGORIES.LLM_ERROR;
    }

    // Network Errors
    if (errorMessage.includes('network') || errorMessage.includes('econnrefused') || errorMessage.includes('etimedout')) {
      return ERROR_CATEGORIES.NETWORK_ERROR;
    }

    return ERROR_CATEGORIES.UNKNOWN_ERROR;
  }

  /**
   * Get specific error type
   * @param {Error} error - The error
   * @returns {string} Error type
   */
  getErrorType(error) {
    if (!error) {
      return ERROR_TYPES.NETWORK_ERROR;
    }

    const errorMessage = (error.message || '').toLowerCase();
    const errorName = error.name || '';

    // Validation Errors (check first)
    if (errorMessage.includes('schema')) {
      return ERROR_TYPES.SCHEMA_VIOLATION;
    }
    if (errorMessage.includes('required field') || errorMessage.includes('missing field')) {
      return ERROR_TYPES.MISSING_REQUIRED_FIELDS;
    }
    if (errorMessage.includes('confidence') || errorMessage.includes('invalid score')) {
      return ERROR_TYPES.INVALID_CONFIDENCE;
    }
    if (errorMessage.includes('circular')) {
      return ERROR_TYPES.CIRCULAR_RELATIONS;
    }

    // Processing Errors
    if (errorMessage.includes('invalid input')) {
      return ERROR_TYPES.INVALID_INPUT;
    }
    if (errorMessage.includes('empty document')) {
      return ERROR_TYPES.EMPTY_DOCUMENT;
    }
    if (errorMessage.includes('unsupported language')) {
      return ERROR_TYPES.UNSUPPORTED_LANGUAGE;
    }
    if (errorMessage.includes('memory') || errorMessage.includes('heap')) {
      return ERROR_TYPES.MEMORY_OVERFLOW;
    }

    // LLM Errors
    if (errorMessage.includes('timeout') || errorName === 'TimeoutError') {
      return ERROR_TYPES.API_TIMEOUT;
    }
    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return ERROR_TYPES.RATE_LIMITING;
    }
    if (errorMessage.includes('malformed') || errorMessage.includes('parse')) {
      return ERROR_TYPES.MALFORMED_RESPONSE;
    }
    if (errorMessage.includes('authentication') || errorMessage.includes('401') || errorMessage.includes('403')) {
      return ERROR_TYPES.AUTHENTICATION_FAILURE;
    }

    // Network Errors
    if (errorMessage.includes('econnrefused')) {
      return ERROR_TYPES.CONNECTION_REFUSED;
    }
    if (errorMessage.includes('network') || errorMessage.includes('etimedout')) {
      return ERROR_TYPES.NETWORK_ERROR;
    }

    return ERROR_TYPES.NETWORK_ERROR;
  }

  /**
   * Log an error with context
   * Requirement 8.5: Error logging completeness
   * @param {Error} error - The error to log
   * @param {Object} context - Additional context
   */
  logError(error, context = {}) {
    const category = this.classifyError(error);
    const errorType = this.getErrorType(error);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      category,
      type: errorType,
      message: error.message || 'Unknown error',
      stack: error.stack,
      context
    };

    // Update metrics
    if (this.enableMetrics) {
      this.errorMetrics.total++;
      this.errorMetrics.byCategory[category] = (this.errorMetrics.byCategory[category] || 0) + 1;
      this.errorMetrics.byType[errorType] = (this.errorMetrics.byType[errorType] || 0) + 1;
    }

    // Log based on severity
    if (category === ERROR_CATEGORIES.VALIDATION_ERROR || 
        category === ERROR_CATEGORIES.LLM_ERROR || 
        category === ERROR_CATEGORIES.NETWORK_ERROR) {
      this.logger.warn('Recoverable error:', logEntry);
    } else {
      this.logger.error('Error:', logEntry);
    }

    return logEntry;
  }

  /**
   * Handle LLM failure with degradation
   * Requirement 8.1: Graceful LLM failure handling
   * @param {Error} error - The LLM error
   * @param {Object} algorithmResult - Fallback algorithm result
   * @param {Object} context - Additional context
   * @returns {Object} Degraded result
   */
  handleLLMFailure(error, algorithmResult, context = {}) {
    this.logError(error, { ...context, phase: 'llm_extraction' });

    // Return algorithm results with partial success status
    return {
      ...algorithmResult,
      metadata: {
        ...algorithmResult.metadata,
        status: PROCESSING_STATUS.PARTIAL_SUCCESS,
        llmError: error.message,
        llmErrorType: this.getErrorType(error),
        degraded: true
      }
    };
  }

  /**
   * Handle format error with default values
   * Requirement 8.2: Format error handling
   * @param {Error} error - The format error
   * @param {Object} partialResult - Partial result if available
   * @param {Object} context - Additional context
   * @returns {Object} Result with defaults
   */
  handleFormatError(error, partialResult = null, context = {}) {
    this.logError(error, { ...context, phase: 'result_parsing' });

    // Return partial result or empty result with defaults
    return partialResult || {
      entities: [],
      relations: [],
      metadata: {
        status: PROCESSING_STATUS.FAILED,
        formatError: error.message,
        errorType: this.getErrorType(error)
      }
    };
  }

  /**
   * Handle retry failure
   * Requirement 8.4: Retry failure handling
   * @param {Error} error - The final error after retries
   * @param {number} attempts - Number of retry attempts
   * @param {Object} context - Additional context
   * @returns {Object} Failure result
   */
  handleRetryFailure(error, attempts, context = {}) {
    this.logError(error, { ...context, phase: 'retry', attempts });

    return {
      entities: [],
      relations: [],
      metadata: {
        status: PROCESSING_STATUS.FAILED,
        error: error.message,
        errorType: this.getErrorType(error),
        retryAttempts: attempts,
        retriesExhausted: true
      }
    };
  }

  /**
   * Determine if an error is retryable
   * @param {Error} error - The error to check
   * @returns {boolean} True if retryable
   */
  isRetryable(error) {
    const errorType = this.getErrorType(error);
    
    // Retryable errors
    const retryableTypes = [
      ERROR_TYPES.API_TIMEOUT,
      ERROR_TYPES.RATE_LIMITING,
      ERROR_TYPES.NETWORK_ERROR,
      ERROR_TYPES.CONNECTION_REFUSED
    ];

    return retryableTypes.includes(errorType);
  }

  /**
   * Get error metrics
   * @returns {Object} Error metrics
   */
  getMetrics() {
    return { ...this.errorMetrics };
  }

  /**
   * Reset error metrics
   */
  resetMetrics() {
    this.errorMetrics = {
      total: 0,
      byCategory: {},
      byType: {}
    };
  }
}

module.exports = ErrorHandler;
module.exports.ERROR_CATEGORIES = ERROR_CATEGORIES;
module.exports.ERROR_TYPES = ERROR_TYPES;
