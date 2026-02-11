/**
 * Error Handler Middleware for Notes Feature
 * 
 * Provides unified error handling with:
 * - Standardized error response format
 * - Error logging with context
 * - Error classification and status codes
 * - Development vs production error details
 * 
 * Validates: Requirement 11.3
 */

const fs = require('fs');
const path = require('path');

/**
 * Error codes mapping
 */
const ERROR_CODES = {
  // Client errors (4xx)
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server errors (5xx)
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  LLM_SERVICE_ERROR: 'LLM_SERVICE_ERROR',
  STORAGE_SERVICE_ERROR: 'STORAGE_SERVICE_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  GATEWAY_TIMEOUT: 'GATEWAY_TIMEOUT',
};

/**
 * Custom error class for application errors
 */
class AppError extends Error {
  constructor(message, statusCode, code, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error logger
 * Logs errors to console and optionally to file
 */
class ErrorLogger {
  constructor() {
    this.logDir = path.join(process.cwd(), 'logs');
    this.errorLogFile = path.join(this.logDir, 'error.log');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      try {
        fs.mkdirSync(this.logDir, { recursive: true });
      } catch (error) {
        console.error('Failed to create log directory:', error);
      }
    }
  }

  /**
   * Log error with context
   * Requirement 11.3: Implement error logging
   */
  log(error, context = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: 'ERROR',
      message: error.message,
      code: error.code || 'UNKNOWN',
      statusCode: error.statusCode || 500,
      stack: error.stack,
      context: {
        userId: context.userId,
        requestId: context.requestId,
        method: context.method,
        url: context.url,
        ip: context.ip,
        userAgent: context.userAgent,
        ...context.additional
      }
    };

    // Console logging
    console.error('=== Error Log ===');
    console.error(`[${timestamp}] ${error.code || 'ERROR'}: ${error.message}`);
    console.error('Context:', JSON.stringify(logEntry.context, null, 2));
    
    if (process.env.NODE_ENV === 'development') {
      console.error('Stack:', error.stack);
    }
    console.error('================');

    // File logging (async, non-blocking)
    this.writeToFile(logEntry);
  }

  writeToFile(logEntry) {
    try {
      const logLine = JSON.stringify(logEntry) + '\n';
      fs.appendFile(this.errorLogFile, logLine, (err) => {
        if (err) {
          console.error('Failed to write to error log file:', err);
        }
      });
    } catch (error) {
      console.error('Error in writeToFile:', error);
    }
  }
}

const errorLogger = new ErrorLogger();

/**
 * Classify error and determine status code
 */
function classifyError(error) {
  // Already classified
  if (error.statusCode && error.code) {
    return { statusCode: error.statusCode, code: error.code };
  }

  // LLM service errors
  if (error.message.includes('LLM') || error.message.includes('API key')) {
    return { statusCode: 502, code: ERROR_CODES.LLM_SERVICE_ERROR };
  }

  // Storage errors
  if (error.message.includes('S3') || error.message.includes('storage') || error.message.includes('upload')) {
    return { statusCode: 502, code: ERROR_CODES.STORAGE_SERVICE_ERROR };
  }

  // Database errors
  if (error.message.includes('Prisma') || error.message.includes('database') || error.message.includes('query')) {
    return { statusCode: 500, code: ERROR_CODES.DATABASE_ERROR };
  }

  // Validation errors
  if (error.message.includes('required') || error.message.includes('invalid') || error.message.includes('must be')) {
    return { statusCode: 400, code: ERROR_CODES.VALIDATION_ERROR };
  }

  // File size errors
  if (error.message.includes('size') && error.message.includes('exceeds')) {
    return { statusCode: 413, code: ERROR_CODES.PAYLOAD_TOO_LARGE };
  }

  // Timeout errors
  if (error.message.includes('timeout') || error.code === 'ETIMEDOUT') {
    return { statusCode: 504, code: ERROR_CODES.GATEWAY_TIMEOUT };
  }

  // Network errors
  if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
    return { statusCode: 503, code: ERROR_CODES.SERVICE_UNAVAILABLE };
  }

  // Default to internal server error
  return { statusCode: 500, code: ERROR_CODES.INTERNAL_SERVER_ERROR };
}

/**
 * Format error response
 * Requirement 11.3: Create unified error response format
 */
function formatErrorResponse(error, statusCode, code, requestId) {
  const response = {
    error: {
      code,
      message: error.message || 'An error occurred',
      requestId,
      timestamp: new Date().toISOString()
    }
  };

  // Add details in development mode
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = error.stack;
    response.error.details = error.details;
  } else if (error.details && error.isOperational) {
    // Only include details for operational errors in production
    response.error.details = error.details;
  }

  return response;
}

/**
 * Main error handler middleware
 * Requirement 11.3: Display clear error messages
 */
const errorHandler = (err, req, res, next) => {
  // Generate request ID if not present
  const requestId = req.id || req.headers['x-request-id'] || generateRequestId();

  // Classify error
  const { statusCode, code } = classifyError(err);

  // Build context for logging
  const context = {
    userId: req.user?.id,
    requestId,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    additional: {
      body: sanitizeBody(req.body),
      query: req.query,
      params: req.params
    }
  };

  // Log error
  errorLogger.log(err, context);

  // Format and send response
  const response = formatErrorResponse(err, statusCode, code, requestId);
  res.status(statusCode).json(response);
};

/**
 * 404 Not Found handler
 */
const notFound = (req, res, next) => {
  const error = new AppError(
    `Resource not found - ${req.originalUrl}`,
    404,
    ERROR_CODES.NOT_FOUND
  );
  next(error);
};

/**
 * Async handler wrapper
 * Catches async errors and passes to error handler
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation error handler
 */
const validationError = (message, details = null) => {
  return new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, details);
};

/**
 * Not found error handler
 */
const notFoundError = (resource) => {
  return new AppError(`${resource} not found`, 404, ERROR_CODES.NOT_FOUND);
};

/**
 * Unauthorized error handler
 */
const unauthorizedError = (message = 'Unauthorized') => {
  return new AppError(message, 401, ERROR_CODES.UNAUTHORIZED);
};

/**
 * Forbidden error handler
 */
const forbiddenError = (message = 'Forbidden') => {
  return new AppError(message, 403, ERROR_CODES.FORBIDDEN);
};

/**
 * Conflict error handler
 */
const conflictError = (message, details = null) => {
  return new AppError(message, 409, ERROR_CODES.CONFLICT, details);
};

/**
 * Service unavailable error handler
 */
const serviceUnavailableError = (service) => {
  return new AppError(
    `${service} is temporarily unavailable`,
    503,
    ERROR_CODES.SERVICE_UNAVAILABLE
  );
};

/**
 * Helper: Generate request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Helper: Sanitize request body for logging
 * Remove sensitive fields
 */
function sanitizeBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

module.exports = {
  errorHandler,
  notFound,
  asyncHandler,
  AppError,
  ErrorLogger,
  ERROR_CODES,
  // Error factory functions
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  conflictError,
  serviceUnavailableError,
};