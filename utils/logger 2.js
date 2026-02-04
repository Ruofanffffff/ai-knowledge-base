// 监控和日志系统
const fs = require('fs');
const path = require('path');

// 确保日志目录存在
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

// 日志级别
const LOG_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error',
    FATAL: 'fatal'
};

// 当前日志级别
let currentLogLevel = LOG_LEVELS.INFO;

// 日志文件路径
const logFiles = {
    access: path.join(logDir, 'access.log'),
    error: path.join(logDir, 'error.log'),
    app: path.join(logDir, 'app.log')
};

// 格式化时间戳
function formatTimestamp() {
    return new Date().toISOString();
}

// 格式化日志消息
function formatLog(level, message, metadata = {}) {
    return {
        timestamp: formatTimestamp(),
        level,
        message,
        metadata
    };
}

// 写入日志文件
function writeLog(file, logObj) {
    const logString = JSON.stringify(logObj) + '\n';
    fs.appendFile(file, logString, (err) => {
        if (err) {
            console.error('Failed to write log:', err);
        }
    });
}

// 日志函数
const logger = {
    // 设置日志级别
    setLevel(level) {
        if (LOG_LEVELS[level.toUpperCase()]) {
            currentLogLevel = LOG_LEVELS[level.toUpperCase()];
        }
    },

    // 调试日志
    debug(message, metadata = {}) {
        if (currentLogLevel === LOG_LEVELS.DEBUG) {
            const logObj = formatLog(LOG_LEVELS.DEBUG, message, metadata);
            console.log('[DEBUG]', message, metadata);
            writeLog(logFiles.app, logObj);
        }
    },

    // 信息日志
    info(message, metadata = {}) {
        if ([LOG_LEVELS.DEBUG, LOG_LEVELS.INFO].includes(currentLogLevel)) {
            const logObj = formatLog(LOG_LEVELS.INFO, message, metadata);
            console.log('[INFO]', message, metadata);
            writeLog(logFiles.app, logObj);
        }
    },

    // 警告日志
    warn(message, metadata = {}) {
        if ([LOG_LEVELS.DEBUG, LOG_LEVELS.INFO, LOG_LEVELS.WARN].includes(currentLogLevel)) {
            const logObj = formatLog(LOG_LEVELS.WARN, message, metadata);
            console.warn('[WARN]', message, metadata);
            writeLog(logFiles.app, logObj);
            writeLog(logFiles.error, logObj);
        }
    },

    // 错误日志
    error(message, metadata = {}) {
        const logObj = formatLog(LOG_LEVELS.ERROR, message, metadata);
        console.error('[ERROR]', message, metadata);
        writeLog(logFiles.app, logObj);
        writeLog(logFiles.error, logObj);
    },

    // 致命错误日志
    fatal(message, metadata = {}) {
        const logObj = formatLog(LOG_LEVELS.FATAL, message, metadata);
        console.error('[FATAL]', message, metadata);
        writeLog(logFiles.app, logObj);
        writeLog(logFiles.error, logObj);
    },

    // 访问日志
    access(method, path, status, responseTime, ip, userAgent) {
        const logObj = {
            timestamp: formatTimestamp(),
            method,
            path,
            status,
            responseTime: `${responseTime}ms`,
            ip,
            userAgent
        };
        console.log('[ACCESS]', `${method} ${path} ${status} ${responseTime}ms`);
        writeLog(logFiles.access, logObj);
    }
};

// 访问日志中间件
function accessLogMiddleware(req, res, next) {
    const start = Date.now();
    const { method, url, ip, headers } = req;
    const userAgent = headers['user-agent'];

    // 重写res.end方法以捕获响应时间和状态码
    const originalEnd = res.end;
    res.end = function(...args) {
        const responseTime = Date.now() - start;
        logger.access(method, url, res.statusCode, responseTime, ip, userAgent);
        originalEnd.apply(this, args);
    };

    next();
}

// 错误处理中间件
function errorHandlerMiddleware(err, req, res, next) {
    const { method, url, ip } = req;
    logger.error('Request error', {
        error: err.message,
        stack: err.stack,
        request: {
            method,
            url,
            ip,
            body: req.body,
            query: req.query
        }
    });

    res.status(500).json({
        success: false,
        error: 'Internal server error'
    });
}

// 健康检查和日志状态
function getLogStatus() {
    try {
        const logs = {
            access: fs.existsSync(logFiles.access) ? fs.statSync(logFiles.access).size : 0,
            error: fs.existsSync(logFiles.error) ? fs.statSync(logFiles.error).size : 0,
            app: fs.existsSync(logFiles.app) ? fs.statSync(logFiles.app).size : 0
        };

        return {
            status: 'ok',
            logLevel: currentLogLevel,
            logFiles: logs,
            logDirSize: getDirSize(logDir)
        };
    } catch (error) {
        return {
            status: 'error',
            error: error.message
        };
    }
}

// 获取目录大小
function getDirSize(dir) {
    let totalSize = 0;
    const files = fs.readdirSync(dir);
    
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
            totalSize += stat.size;
        } else if (stat.isDirectory()) {
            totalSize += getDirSize(filePath);
        }
    });
    
    return totalSize;
}

// 清理旧日志
function cleanOldLogs(days = 7) {
    const cutoffTime = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    Object.values(logFiles).forEach(file => {
        if (fs.existsSync(file)) {
            const stat = fs.statSync(file);
            if (stat.mtime.getTime() < cutoffTime) {
                fs.truncate(file, 0, (err) => {
                    if (err) {
                        logger.error('Failed to clean old log:', err);
                    } else {
                        logger.info('Cleaned old log file:', file);
                    }
                });
            }
        }
    });
}

// 导出模块
module.exports = {
    logger,
    accessLogMiddleware,
    errorHandlerMiddleware,
    getLogStatus,
    cleanOldLogs,
    LOG_LEVELS
};