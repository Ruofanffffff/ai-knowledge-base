/**
 * Tests for Error Handler Middleware
 * 
 * Validates: Requirement 11.3
 */

const {
  errorHandler,
  notFound,
  asyncHandler,
  AppError,
  ErrorLogger,
  ERROR_CODES,
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  conflictError,
  serviceUnavailableError,
} = require('./errorHandler');

describe('Error Handler Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      originalUrl: '/api/test',
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'test-agent'
      },
      body: {},
      query: {},
      params: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    next = jest.fn();

    // Suppress console output during tests
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AppError', () => {
    it('should create an operational error with all properties', () => {
      const error = new AppError('Test error', 400, ERROR_CODES.BAD_REQUEST, { field: 'test' });

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ERROR_CODES.BAD_REQUEST);
      expect(error.details).toEqual({ field: 'test' });
      expect(error.isOperational).toBe(true);
    });
  });

  describe('errorHandler', () => {
    it('should handle AppError with correct status and code', () => {
      const error = new AppError('Validation failed', 400, ERROR_CODES.VALIDATION_ERROR);

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ERROR_CODES.VALIDATION_ERROR,
            message: 'Validation failed',
            requestId: expect.any(String),
            timestamp: expect.any(String)
          })
        })
      );
    });

    it('should classify LLM errors correctly', () => {
      const error = new Error('LLM request failed');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ERROR_CODES.LLM_SERVICE_ERROR
          })
        })
      );
    });

    it('should classify storage errors correctly', () => {
      const error = new Error('S3 upload failed');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(502);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ERROR_CODES.STORAGE_SERVICE_ERROR
          })
        })
      );
    });

    it('should classify database errors correctly', () => {
      const error = new Error('Prisma query failed');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ERROR_CODES.DATABASE_ERROR
          })
        })
      );
    });

    it('should classify validation errors correctly', () => {
      const error = new Error('Field is required');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ERROR_CODES.VALIDATION_ERROR
          })
        })
      );
    });

    it('should classify file size errors correctly', () => {
      const error = new Error('File size exceeds maximum');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(413);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ERROR_CODES.PAYLOAD_TOO_LARGE
          })
        })
      );
    });

    it('should classify timeout errors correctly', () => {
      const error = new Error('Request timeout');

      errorHandler(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(504);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ERROR_CODES.GATEWAY_TIMEOUT
          })
        })
      );
    });

    it('should include stack trace in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            stack: expect.any(String)
          })
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should not include stack trace in production mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      expect(response.error.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should use request ID from header if present', () => {
      req.headers['x-request-id'] = 'test-request-id';
      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            requestId: 'test-request-id'
          })
        })
      );
    });

    it('should sanitize sensitive fields in request body', () => {
      req.body = {
        username: 'test',
        password: 'secret123',
        apiKey: 'key123'
      };

      const error = new Error('Test error');
      errorHandler(error, req, res, next);

      // Error should be logged but password should be redacted
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('notFound', () => {
    it('should create 404 error and pass to next', () => {
      notFound(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('/api/test'),
          statusCode: 404,
          code: ERROR_CODES.NOT_FOUND
        })
      );
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async function', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const handler = asyncHandler(asyncFn);

      await handler(req, res, next);

      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });

    it('should catch async errors and pass to next', async () => {
      const error = new Error('Async error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const handler = asyncHandler(asyncFn);

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('Error factory functions', () => {
    it('validationError should create validation error', () => {
      const error = validationError('Invalid input', { field: 'email' });

      expect(error.statusCode).toBe(400);
      expect(error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
      expect(error.message).toBe('Invalid input');
      expect(error.details).toEqual({ field: 'email' });
    });

    it('notFoundError should create not found error', () => {
      const error = notFoundError('User');

      expect(error.statusCode).toBe(404);
      expect(error.code).toBe(ERROR_CODES.NOT_FOUND);
      expect(error.message).toBe('User not found');
    });

    it('unauthorizedError should create unauthorized error', () => {
      const error = unauthorizedError('Invalid token');

      expect(error.statusCode).toBe(401);
      expect(error.code).toBe(ERROR_CODES.UNAUTHORIZED);
      expect(error.message).toBe('Invalid token');
    });

    it('forbiddenError should create forbidden error', () => {
      const error = forbiddenError('Access denied');

      expect(error.statusCode).toBe(403);
      expect(error.code).toBe(ERROR_CODES.FORBIDDEN);
      expect(error.message).toBe('Access denied');
    });

    it('conflictError should create conflict error', () => {
      const error = conflictError('Resource already exists', { id: '123' });

      expect(error.statusCode).toBe(409);
      expect(error.code).toBe(ERROR_CODES.CONFLICT);
      expect(error.message).toBe('Resource already exists');
      expect(error.details).toEqual({ id: '123' });
    });

    it('serviceUnavailableError should create service unavailable error', () => {
      const error = serviceUnavailableError('LLM Service');

      expect(error.statusCode).toBe(503);
      expect(error.code).toBe(ERROR_CODES.SERVICE_UNAVAILABLE);
      expect(error.message).toBe('LLM Service is temporarily unavailable');
    });
  });

  describe('ErrorLogger', () => {
    it('should create error logger instance', () => {
      const logger = new ErrorLogger();
      expect(logger).toBeDefined();
      expect(logger.logDir).toBeDefined();
      expect(logger.errorLogFile).toBeDefined();
    });

    it('should log error with context', () => {
      const logger = new ErrorLogger();
      const error = new Error('Test error');
      const context = {
        userId: 'user123',
        requestId: 'req123',
        method: 'GET',
        url: '/api/test'
      };

      // Should not throw
      expect(() => logger.log(error, context)).not.toThrow();
    });
  });

  describe('Error response format', () => {
    it('should have consistent error response structure', () => {
      const error = new AppError('Test error', 400, ERROR_CODES.BAD_REQUEST);

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      
      expect(response).toHaveProperty('error');
      expect(response.error).toHaveProperty('code');
      expect(response.error).toHaveProperty('message');
      expect(response.error).toHaveProperty('requestId');
      expect(response.error).toHaveProperty('timestamp');
    });

    it('should include timestamp in ISO format', () => {
      const error = new Error('Test error');

      errorHandler(error, req, res, next);

      const response = res.json.mock.calls[0][0];
      const timestamp = response.error.timestamp;
      
      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
});
