// 错误处理中间件
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err.stack);
  
  // 设置默认错误状态码和消息
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  // 根据错误类型返回不同的响应
  res.status(statusCode).json({
    error: {
      message: message,
      code: statusCode,
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    }
  });
};

// 404处理中间件
const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

module.exports = { errorHandler, notFound };