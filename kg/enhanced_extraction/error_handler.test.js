/**
 * Unit tests for ErrorHandler
 */

const ErrorHandler = require('./error_handler');
const { ERROR_CATEGORIES, ERROR_TYPES } = require('./error_handler');
const { PROCESSING_STATUS } = require('./constants');

describe('ErrorHandler', () => {
  let errorHandler;
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn()
    };
    errorHandler = new ErrorHandler({ logger: mockLogger });
  });

  describe('Error Classification', () => {
    test('should classify timeout errors as LLM errors', () => {
      const error = new Error('Request timeout');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.LLM_ERROR);
    });

    test('should classify rate limit errors as LLM errors', () => {
      const error = new Error('Rate limit exceeded (429)');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.LLM_ERROR);
    });

    test('should classify malformed response as LLM error', () => {
      const error = new Error('Malformed JSON response');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.LLM_ERROR);
    });

    test('should classify authentication errors as LLM errors', () => {
      const error = new Error('Authentication failed (401)');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.LLM_ERROR);
    });

    test('should classify network errors correctly', () => {
      const error = new Error('Network error: ECONNREFUSED');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.NETWORK_ERROR);
    });

    test('should classify invalid input as processing error', () => {
      const error = new Error('Invalid input format');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.PROCESSING_ERROR);
    });

    test('should classify empty document as processing error', () => {
      const error = new Error('Empty document provided');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.PROCESSING_ERROR);
    });

    test('should classify unsupported language as processing error', () => {
      const error = new Error('Unsupported language detected');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.PROCESSING_ERROR);
    });

    test('should classify memory errors as processing error', () => {
      const error = new Error('Memory overflow: heap limit exceeded');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.PROCESSING_ERROR);
    });

    test('should classify schema violations as validation error', () => {
      const error = new Error('Schema validation failed');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.VALIDATION_ERROR);
    });

    test('should classify missing fields as validation error', () => {
      const error = new Error('Missing required field: name');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.VALIDATION_ERROR);
    });

    test('should classify invalid confidence as validation error', () => {
      const error = new Error('Invalid confidence score');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.VALIDATION_ERROR);
    });

    test('should classify circular relations as validation error', () => {
      const error = new Error('Circular relation detected');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.VALIDATION_ERROR);
    });

    test('should classify unknown errors', () => {
      const error = new Error('Something went wrong');
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.UNKNOWN_ERROR);
    });

    test('should handle null error', () => {
      expect(errorHandler.classifyError(null)).toBe(ERROR_CATEGORIES.UNKNOWN_ERROR);
    });
  });

  describe('Error Type Detection', () => {
    test('should detect API timeout type', () => {
      const error = new Error('Request timeout');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.API_TIMEOUT);
    });

    test('should detect rate limiting type', () => {
      const error = new Error('Rate limit exceeded');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.RATE_LIMITING);
    });

    test('should detect malformed response type', () => {
      const error = new Error('Malformed JSON');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.MALFORMED_RESPONSE);
    });

    test('should detect authentication failure type', () => {
      const error = new Error('Authentication failed');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.AUTHENTICATION_FAILURE);
    });

    test('should detect invalid input type', () => {
      const error = new Error('Invalid input');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.INVALID_INPUT);
    });

    test('should detect empty document type', () => {
      const error = new Error('Empty document');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.EMPTY_DOCUMENT);
    });

    test('should detect unsupported language type', () => {
      const error = new Error('Unsupported language');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.UNSUPPORTED_LANGUAGE);
    });

    test('should detect memory overflow type', () => {
      const error = new Error('Memory overflow');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.MEMORY_OVERFLOW);
    });

    test('should detect schema violation type', () => {
      const error = new Error('Schema violation');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.SCHEMA_VIOLATION);
    });

    test('should detect missing required fields type', () => {
      const error = new Error('Missing required field');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.MISSING_REQUIRED_FIELDS);
    });

    test('should detect invalid confidence type', () => {
      const error = new Error('Invalid confidence');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.INVALID_CONFIDENCE);
    });

    test('should detect circular relations type', () => {
      const error = new Error('Circular relation');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.CIRCULAR_RELATIONS);
    });

    test('should detect connection refused type', () => {
      const error = new Error('ECONNREFUSED');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.CONNECTION_REFUSED);
    });

    test('should detect network error type', () => {
      const error = new Error('Network error');
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.NETWORK_ERROR);
    });
  });

  describe('Error Logging', () => {
    test('should log error with timestamp and context (Requirement 8.5)', () => {
      const error = new Error('Test error');
      const context = { documentId: 'doc123', phase: 'extraction' };
      
      const logEntry = errorHandler.logError(error, context);
      
      expect(logEntry).toHaveProperty('timestamp');
      expect(logEntry).toHaveProperty('category');
      expect(logEntry).toHaveProperty('type');
      expect(logEntry).toHaveProperty('message', 'Test error');
      expect(logEntry).toHaveProperty('stack');
      expect(logEntry).toHaveProperty('context', context);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should log validation errors as warnings', () => {
      const error = new Error('Schema validation failed');
      
      errorHandler.logError(error);
      
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should log LLM errors as warnings', () => {
      const error = new Error('Request timeout');
      
      errorHandler.logError(error);
      
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should log network errors as warnings', () => {
      const error = new Error('Network error');
      
      errorHandler.logError(error);
      
      expect(mockLogger.warn).toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    test('should update error metrics when logging', () => {
      const error1 = new Error('Request timeout');
      const error2 = new Error('Schema validation failed');
      
      errorHandler.logError(error1);
      errorHandler.logError(error2);
      
      const metrics = errorHandler.getMetrics();
      expect(metrics.total).toBe(2);
      expect(metrics.byCategory[ERROR_CATEGORIES.LLM_ERROR]).toBe(1);
      expect(metrics.byCategory[ERROR_CATEGORIES.VALIDATION_ERROR]).toBe(1);
    });

    test('should not update metrics when disabled', () => {
      const handler = new ErrorHandler({ logger: mockLogger, enableMetrics: false });
      const error = new Error('Test error');
      
      handler.logError(error);
      
      const metrics = handler.getMetrics();
      expect(metrics.total).toBe(0);
    });
  });

  describe('LLM Failure Handling', () => {
    test('should handle LLM failure with degradation (Requirement 8.1)', () => {
      const error = new Error('LLM API timeout');
      const algorithmResult = {
        entities: [{ name: 'test', type: 'parameter' }],
        relations: [],
        metadata: { status: PROCESSING_STATUS.SUCCESS }
      };
      
      const result = errorHandler.handleLLMFailure(error, algorithmResult);
      
      expect(result.entities).toEqual(algorithmResult.entities);
      expect(result.metadata.status).toBe(PROCESSING_STATUS.PARTIAL_SUCCESS);
      expect(result.metadata.llmError).toBe('LLM API timeout');
      expect(result.metadata.degraded).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('should include error type in degraded result', () => {
      const error = new Error('Rate limit exceeded');
      const algorithmResult = {
        entities: [],
        relations: [],
        metadata: {}
      };
      
      const result = errorHandler.handleLLMFailure(error, algorithmResult);
      
      expect(result.metadata.llmErrorType).toBe(ERROR_TYPES.RATE_LIMITING);
    });

    test('should preserve algorithm result metadata', () => {
      const error = new Error('LLM failed');
      const algorithmResult = {
        entities: [],
        relations: [],
        metadata: {
          processingTime: 100,
          parametersFound: 5
        }
      };
      
      const result = errorHandler.handleLLMFailure(error, algorithmResult);
      
      expect(result.metadata.processingTime).toBe(100);
      expect(result.metadata.parametersFound).toBe(5);
    });
  });

  describe('Format Error Handling', () => {
    test('should handle format error with default values (Requirement 8.2)', () => {
      const error = new Error('Malformed JSON response');
      
      const result = errorHandler.handleFormatError(error);
      
      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.metadata.status).toBe(PROCESSING_STATUS.FAILED);
      expect(result.metadata.formatError).toBe('Malformed JSON response');
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('should use partial result when available', () => {
      const error = new Error('Parse error');
      const partialResult = {
        entities: [{ name: 'partial', type: 'concept' }],
        relations: [],
        metadata: {}
      };
      
      const result = errorHandler.handleFormatError(error, partialResult);
      
      expect(result.entities).toEqual(partialResult.entities);
      expect(result.relations).toEqual(partialResult.relations);
    });

    test('should include error type in result', () => {
      const error = new Error('Malformed response');
      
      const result = errorHandler.handleFormatError(error);
      
      expect(result.metadata.errorType).toBe(ERROR_TYPES.MALFORMED_RESPONSE);
    });
  });

  describe('Retry Failure Handling', () => {
    test('should handle retry failure (Requirement 8.4)', () => {
      const error = new Error('Network timeout after retries');
      const attempts = 3;
      
      const result = errorHandler.handleRetryFailure(error, attempts);
      
      expect(result.entities).toEqual([]);
      expect(result.relations).toEqual([]);
      expect(result.metadata.status).toBe(PROCESSING_STATUS.FAILED);
      expect(result.metadata.error).toBe('Network timeout after retries');
      expect(result.metadata.retryAttempts).toBe(3);
      expect(result.metadata.retriesExhausted).toBe(true);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    test('should include error type in retry failure result', () => {
      const error = new Error('Request timeout');
      
      const result = errorHandler.handleRetryFailure(error, 3);
      
      expect(result.metadata.errorType).toBe(ERROR_TYPES.API_TIMEOUT);
    });

    test('should log with retry context', () => {
      const error = new Error('Network timeout after retries');
      const context = { documentId: 'doc123' };
      
      errorHandler.handleRetryFailure(error, 3, context);
      
      // Verify logger was called (network errors log as warnings)
      expect(mockLogger.warn).toHaveBeenCalled();
      
      // Verify the log entry contains the expected context
      const logCall = mockLogger.warn.mock.calls[0];
      expect(logCall[1]).toMatchObject({
        context: expect.objectContaining({
          documentId: 'doc123',
          phase: 'retry',
          attempts: 3
        })
      });
    });
  });

  describe('Retryable Error Detection', () => {
    test('should identify timeout as retryable', () => {
      const error = new Error('Request timeout');
      expect(errorHandler.isRetryable(error)).toBe(true);
    });

    test('should identify rate limiting as retryable', () => {
      const error = new Error('Rate limit exceeded');
      expect(errorHandler.isRetryable(error)).toBe(true);
    });

    test('should identify network errors as retryable', () => {
      const error = new Error('Network error');
      expect(errorHandler.isRetryable(error)).toBe(true);
    });

    test('should identify connection refused as retryable', () => {
      const error = new Error('ECONNREFUSED');
      expect(errorHandler.isRetryable(error)).toBe(true);
    });

    test('should identify authentication errors as non-retryable', () => {
      const error = new Error('Authentication failed');
      expect(errorHandler.isRetryable(error)).toBe(false);
    });

    test('should identify validation errors as non-retryable', () => {
      const error = new Error('Schema validation failed');
      expect(errorHandler.isRetryable(error)).toBe(false);
    });

    test('should identify malformed response as non-retryable', () => {
      const error = new Error('Malformed JSON');
      expect(errorHandler.isRetryable(error)).toBe(false);
    });
  });

  describe('Error Metrics', () => {
    test('should track total error count', () => {
      errorHandler.logError(new Error('Error 1'));
      errorHandler.logError(new Error('Error 2'));
      errorHandler.logError(new Error('Error 3'));
      
      const metrics = errorHandler.getMetrics();
      expect(metrics.total).toBe(3);
    });

    test('should track errors by category', () => {
      errorHandler.logError(new Error('Request timeout'));
      errorHandler.logError(new Error('Schema validation failed'));
      errorHandler.logError(new Error('Network error'));
      
      const metrics = errorHandler.getMetrics();
      expect(metrics.byCategory[ERROR_CATEGORIES.LLM_ERROR]).toBe(1);
      expect(metrics.byCategory[ERROR_CATEGORIES.VALIDATION_ERROR]).toBe(1);
      expect(metrics.byCategory[ERROR_CATEGORIES.NETWORK_ERROR]).toBe(1);
    });

    test('should track errors by type', () => {
      errorHandler.logError(new Error('Request timeout'));
      errorHandler.logError(new Error('Request timeout'));
      errorHandler.logError(new Error('Rate limit exceeded'));
      
      const metrics = errorHandler.getMetrics();
      expect(metrics.byType[ERROR_TYPES.API_TIMEOUT]).toBe(2);
      expect(metrics.byType[ERROR_TYPES.RATE_LIMITING]).toBe(1);
    });

    test('should reset metrics', () => {
      errorHandler.logError(new Error('Error 1'));
      errorHandler.logError(new Error('Error 2'));
      
      errorHandler.resetMetrics();
      
      const metrics = errorHandler.getMetrics();
      expect(metrics.total).toBe(0);
      expect(Object.keys(metrics.byCategory)).toHaveLength(0);
      expect(Object.keys(metrics.byType)).toHaveLength(0);
    });

    test('should return copy of metrics', () => {
      errorHandler.logError(new Error('Test'));
      
      const metrics1 = errorHandler.getMetrics();
      metrics1.total = 999;
      
      const metrics2 = errorHandler.getMetrics();
      expect(metrics2.total).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle error without message', () => {
      const error = new Error();
      error.message = '';
      
      const logEntry = errorHandler.logError(error);
      
      expect(logEntry.message).toBe('Unknown error');
    });

    test('should handle error without stack trace', () => {
      const error = { message: 'Test error' };
      
      const logEntry = errorHandler.logError(error);
      
      expect(logEntry).toHaveProperty('stack');
    });

    test('should handle empty context', () => {
      const error = new Error('Test');
      
      const logEntry = errorHandler.logError(error);
      
      expect(logEntry.context).toEqual({});
    });

    test('should handle TimeoutError by name', () => {
      const error = new Error('Something went wrong');
      error.name = 'TimeoutError';
      
      expect(errorHandler.classifyError(error)).toBe(ERROR_CATEGORIES.LLM_ERROR);
      expect(errorHandler.getErrorType(error)).toBe(ERROR_TYPES.API_TIMEOUT);
    });
  });
});
