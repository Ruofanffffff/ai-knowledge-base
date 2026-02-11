/**
 * Unified Error Response Format
 * Standardizes all API responses to a consistent format
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

const successResponse = (data, message = 'Success') => ({
  success: true,
  data,
  error: null,
  message,
});

const errorResponse = (error, message = null) => {
  const statusCode = error.statusCode || 500;
  const errorMessage = message || error.message || 'Internal Server Error';
  
  return {
    success: false,
    data: null,
    error: errorMessage,
    message: errorMessage,
  };
};

const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'AppError') {
    return res.status(err.statusCode).json(errorResponse(err));
  }

  if (err.code === 'SQLITE_CONSTRAINT') {
    return res.status(400).json(errorResponse({
      message: 'Database constraint violation',
      statusCode: 400
    }));
  }

  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(errorResponse({
      message: 'File size exceeds limit',
      statusCode: 400
    }));
  }

  res.status(500).json(errorResponse(err));
};

const notFoundHandler = (req, res) => {
  res.status(404).json(errorResponse({
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404
  }));
};

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  successResponse,
  errorResponse,
  errorHandler,
  notFoundHandler,
  asyncHandler,
};
