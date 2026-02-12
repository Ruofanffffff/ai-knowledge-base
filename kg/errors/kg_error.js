/**
 * KG错误处理模块
 * 
 * 定义知识图谱相关的错误类型和处理逻辑
 * 提供统一的错误分类和响应格式
 */

/**
 * KG错误类
 * 扩展标准Error类，添加错误类别和详细信息
 */
class KGError extends Error {
  /**
   * @param {string} message - 错误消息
   * @param {string} category - 错误类别
   * @param {Object} details - 错误详细信息
   */
  constructor(message, category, details = {}) {
    super(message);
    this.name = 'KGError';
    this.category = category;
    this.details = details;
    this.timestamp = new Date().toISOString();
    
    // 保持正确的堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, KGError);
    }
  }
  
  /**
   * 转换为JSON格式
   */
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      category: this.category,
      details: this.details,
      timestamp: this.timestamp,
      stack: this.stack
    };
  }
}

/**
 * 错误类别枚举
 */
const ErrorCategory = {
  // 文档相关错误
  DOCUMENT_NOT_FOUND: 'document_not_found',
  DOCUMENT_INVALID: 'document_invalid',
  DOCUMENT_EMPTY: 'document_empty',
  
  // KG构建错误
  KG_BUILD_FAILED: 'kg_build_failed',
  KG_ALREADY_EXISTS: 'kg_already_exists',
  KG_NOT_FOUND: 'kg_not_found',
  
  // 队列相关错误
  QUEUE_FULL: 'queue_full',
  TASK_NOT_FOUND: 'task_not_found',
  TASK_ALREADY_QUEUED: 'task_already_queued',
  
  // 系统错误
  TIMEOUT: 'timeout',
  SYSTEM_ERROR: 'system_error',
  DATABASE_ERROR: 'database_error',
  CONFIGURATION_ERROR: 'configuration_error',
  
  // 用户错误
  INVALID_PARAMETER: 'invalid_parameter',
  UNAUTHORIZED: 'unauthorized',
  FORBIDDEN: 'forbidden'
};

/**
 * 错误处理器
 * 将各种错误转换为统一的响应格式
 * 
 * @param {Error} error - 错误对象
 * @returns {Object} 标准化的错误响应
 */
function handleKGError(error) {
  // 如果是KGError，直接使用其信息
  if (error instanceof KGError) {
    return {
      success: false,
      error: error.message,
      category: error.category,
      details: error.details,
      retryable: isRetryable(error.category),
      timestamp: error.timestamp
    };
  }
  
  // 如果是普通Error，尝试分类
  const category = categorizeError(error);
  const userFriendlyMessage = formatErrorMessage(error, category);
  
  return {
    success: false,
    error: userFriendlyMessage,
    category: category,
    details: {
      originalMessage: error.message
    },
    retryable: isRetryable(category),
    timestamp: new Date().toISOString()
  };
}

/**
 * 判断错误是否可重试
 * 
 * @param {string} category - 错误类别
 * @returns {boolean} 是否可重试
 */
function isRetryable(category) {
  const retryableCategories = [
    ErrorCategory.TIMEOUT,
    ErrorCategory.SYSTEM_ERROR,
    ErrorCategory.DATABASE_ERROR,
    ErrorCategory.KG_BUILD_FAILED
  ];
  
  return retryableCategories.includes(category);
}

/**
 * 分类错误类型
 * 
 * @param {Error} error - 错误对象
 * @returns {string} 错误类别
 */
function categorizeError(error) {
  const message = error.message || '';
  
  // 文档相关错误
  if (message.includes('not found') || message.includes('找不到')) {
    return ErrorCategory.DOCUMENT_NOT_FOUND;
  }
  
  if (message.includes('Invalid file format') || 
      message.includes('Empty content') ||
      message.includes('缺少 filePath') ||
      message.includes('missing filePath')) {
    return ErrorCategory.DOCUMENT_INVALID;
  }
  
  // 队列相关错误
  if (message.includes('queue full') || message.includes('队列已满')) {
    return ErrorCategory.QUEUE_FULL;
  }
  
  if (message.includes('already queued') || message.includes('已在队列')) {
    return ErrorCategory.TASK_ALREADY_QUEUED;
  }
  
  // 超时错误
  if (message.includes('timeout') || message.includes('超时') || 
      message.includes('ETIMEDOUT')) {
    return ErrorCategory.TIMEOUT;
  }
  
  // 数据库错误
  if (message.includes('Database') || message.includes('数据库') ||
      message.includes('SQLITE') || message.includes('Prisma')) {
    return ErrorCategory.DATABASE_ERROR;
  }
  
  // 系统错误
  if (message.includes('ENOENT') || message.includes('EACCES') ||
      message.includes('Connection') || message.includes('连接')) {
    return ErrorCategory.SYSTEM_ERROR;
  }
  
  // 默认为系统错误
  return ErrorCategory.SYSTEM_ERROR;
}

/**
 * 格式化错误消息为用户友好的文本
 * 
 * @param {Error} error - 错误对象
 * @param {string} category - 错误类别
 * @returns {string} 用户友好的错误消息
 */
function formatErrorMessage(error, category) {
  const messageMap = {
    [ErrorCategory.DOCUMENT_NOT_FOUND]: '文档不存在，请检查文档ID是否正确',
    [ErrorCategory.DOCUMENT_INVALID]: '文档格式无效或内容为空，请检查文档',
    [ErrorCategory.DOCUMENT_EMPTY]: '文档内容为空，无法构建知识图谱',
    [ErrorCategory.KG_BUILD_FAILED]: '知识图谱构建失败，请稍后重试',
    [ErrorCategory.KG_ALREADY_EXISTS]: '知识图谱已存在，如需重建请使用rebuild接口',
    [ErrorCategory.KG_NOT_FOUND]: '知识图谱不存在',
    [ErrorCategory.QUEUE_FULL]: '构建队列已满，请稍后重试',
    [ErrorCategory.TASK_NOT_FOUND]: '任务不存在',
    [ErrorCategory.TASK_ALREADY_QUEUED]: '任务已在队列中',
    [ErrorCategory.TIMEOUT]: '操作超时，请稍后重试',
    [ErrorCategory.SYSTEM_ERROR]: '系统错误，请稍后重试',
    [ErrorCategory.DATABASE_ERROR]: '数据库错误，请稍后重试',
    [ErrorCategory.CONFIGURATION_ERROR]: '配置错误，请检查系统配置',
    [ErrorCategory.INVALID_PARAMETER]: '参数无效，请检查请求参数',
    [ErrorCategory.UNAUTHORIZED]: '未授权，请先登录',
    [ErrorCategory.FORBIDDEN]: '无权限执行此操作'
  };
  
  return messageMap[category] || '处理失败，请联系管理员';
}

/**
 * 创建特定类型的KG错误
 */
const createError = {
  /**
   * 文档不存在错误
   */
  documentNotFound: (docId) => new KGError(
    `Document ${docId} not found`,
    ErrorCategory.DOCUMENT_NOT_FOUND,
    { docId }
  ),
  
  /**
   * 文档无效错误
   */
  documentInvalid: (docId, reason) => new KGError(
    `Document ${docId} is invalid: ${reason}`,
    ErrorCategory.DOCUMENT_INVALID,
    { docId, reason }
  ),
  
  /**
   * 队列已满错误
   */
  queueFull: (currentSize, maxSize) => new KGError(
    `Queue is full (${currentSize}/${maxSize})`,
    ErrorCategory.QUEUE_FULL,
    { currentSize, maxSize }
  ),
  
  /**
   * 任务已在队列错误
   */
  taskAlreadyQueued: (docId) => new KGError(
    `Task for document ${docId} is already queued`,
    ErrorCategory.TASK_ALREADY_QUEUED,
    { docId }
  ),
  
  /**
   * 超时错误
   */
  timeout: (operation, duration) => new KGError(
    `Operation ${operation} timed out after ${duration}ms`,
    ErrorCategory.TIMEOUT,
    { operation, duration }
  ),
  
  /**
   * 系统错误
   */
  systemError: (message, details = {}) => new KGError(
    message,
    ErrorCategory.SYSTEM_ERROR,
    details
  ),
  
  /**
   * 数据库错误
   */
  databaseError: (message, details = {}) => new KGError(
    message,
    ErrorCategory.DATABASE_ERROR,
    details
  )
};

module.exports = {
  KGError,
  ErrorCategory,
  handleKGError,
  isRetryable,
  categorizeError,
  formatErrorMessage,
  createError
};
