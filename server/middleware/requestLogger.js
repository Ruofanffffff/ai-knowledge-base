/**
 * Request Logger Middleware
 * Logs all incoming requests for debugging and monitoring
 */

const accessLogMiddleware = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, url, ip } = req;
    const { statusCode } = res;
    
    console.log(`[${new Date().toISOString()}] ${method} ${url} ${statusCode} ${duration}ms - ${ip}`);
  });
  
  next();
};

module.exports = {
  accessLogMiddleware,
};
