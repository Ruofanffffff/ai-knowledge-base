/**
 * Middleware Index
 * Exports all middleware for easy importing
 */

const { errorHandler, notFoundHandler, asyncHandler } = require('./errorHandler');
const { accessLogMiddleware } = require('./requestLogger');
const { rateLimiter, strictRateLimiter } = require('./rateLimiter');

module.exports = {
  errorHandler,
  notFoundHandler,
  asyncHandler,
  accessLogMiddleware,
  rateLimiter,
  strictRateLimiter,
};
