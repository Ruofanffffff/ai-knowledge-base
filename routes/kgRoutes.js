/**
 * KG API Routes
 * 
 * 提供统一的知识图谱管理API接口
 * 实现文档服务与KG服务的完全分离
 */

const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../services/authService');
const { getInstance: getKGAdapter } = require('../kg/services/kg_service_adapter');
const { getInstance: getBuildQueueManager } = require('../kg/services/build_queue_manager');
const { getInstance: getKGConfig } = require('../kg/config/kg_config');
const { handleKGError, ErrorCategory } = require('../kg/errors/kg_error');
const { getInstance: getKGMonitor } = require('../kg/monitoring/kg_monitor');

/**
 * POST /api/kg/build
 * 触发单个文档的KG构建
 * 
 * Request body:
 * {
 *   docId: string (required),
 *   options: {
 *     force: boolean,  // 是否强制重建
 *     async: boolean   // 是否异步执行
 *   }
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     docId: string,
 *     status: string,
 *     queuePosition: number,
 *     message: string
 *   }
 * }
 */
router.post('/build', authMiddleware, async (req, res) => {
  try {
    const { docId, options = {} } = req.body;

    // 验证参数
    if (!docId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: docId'
      });
    }

    const kgAdapter = getKGAdapter();
    const result = await kgAdapter.buildFromDatabase(docId, {
      ...options,
      async: true
    });

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error building KG:', error);

    // 使用统一的错误处理
    const errorResponse = handleKGError(error);
    
    // 根据错误类别返回不同的状态码
    let statusCode = 500;
    if (errorResponse.category === ErrorCategory.DOCUMENT_NOT_FOUND) {
      statusCode = 404;
    } else if (errorResponse.category === ErrorCategory.DOCUMENT_INVALID ||
               errorResponse.category === ErrorCategory.INVALID_PARAMETER) {
      statusCode = 400;
    } else if (errorResponse.category === ErrorCategory.UNAUTHORIZED) {
      statusCode = 401;
    } else if (errorResponse.category === ErrorCategory.FORBIDDEN) {
      statusCode = 403;
    }

    res.status(statusCode).json(errorResponse);
  }
});

/**
 * POST /api/kg/build/batch
 * 批量构建KG
 * 
 * Request body:
 * {
 *   docIds: string[] (required),
 *   options: {
 *     concurrency: number  // 并发数
 *   }
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     total: number,
 *     results: Array
 *   }
 * }
 */
router.post('/build/batch', authMiddleware, async (req, res) => {
  try {
    const { docIds, options = {} } = req.body;

    // 验证参数
    if (!docIds || !Array.isArray(docIds) || docIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid parameter: docIds (must be non-empty array)'
      });
    }

    const kgAdapter = getKGAdapter();
    const results = await kgAdapter.buildBatch(docIds, options);

    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    res.json({
      success: true,
      data: {
        total: docIds.length,
        successCount,
        failureCount,
        results
      }
    });

  } catch (error) {
    console.error('Error building batch KG:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/kg/status/:docId
 * 查询构建状态
 * 
 * Query params:
 *   - detailed: boolean (是否返回详细信息,包含进度)
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     docId: string,
 *     status: string,
 *     progress: number,
 *     entityCount: number,
 *     relationCount: number,
 *     ...
 *   }
 * }
 */
router.get('/status/:docId', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    const { detailed = 'false' } = req.query;

    const kgAdapter = getKGAdapter();
    const status = detailed === 'true'
      ? await kgAdapter.getDetailedStatus(docId)
      : await kgAdapter.getStatus(docId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or KG status not available',
        code: 'DOCUMENT_NOT_FOUND',
        docId: docId
      });
    }

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    console.error('Error getting KG status:', error);
    
    // Check if it's a document not found error
    if (error.message && (error.message.includes('not found') || error.message.includes('does not exist'))) {
      return res.status(404).json({
        success: false,
        error: 'Document not found or KG status not available',
        code: 'DOCUMENT_NOT_FOUND',
        docId: req.params.docId
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/kg/:docId
 * 删除文档的KG
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     docId: string,
 *     deletedEntities: number,
 *     deletedRelations: number
 *   }
 * }
 */
router.delete('/:docId', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;

    const kgAdapter = getKGAdapter();
    const result = await kgAdapter.deleteKG(docId);

    res.json({
      success: true,
      data: result,
      message: 'KG deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting KG:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/kg/rebuild/:docId
 * 重建文档的KG
 * 
 * Request body:
 * {
 *   options: {
 *     async: boolean
 *   }
 * }
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     docId: string,
 *     status: string,
 *     message: string
 *   }
 * }
 */
router.post('/rebuild/:docId', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;
    const { options = {} } = req.body;

    const kgAdapter = getKGAdapter();
    const result = await kgAdapter.rebuildKG(docId, options);

    res.json({
      success: true,
      data: result,
      message: 'KG rebuild initiated'
    });

  } catch (error) {
    console.error('Error rebuilding KG:', error);

    if (error.category === 'document_not_found') {
      return res.status(404).json({
        success: false,
        error: error.message,
        category: error.category
      });
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/kg/cancel/:docId
 * 取消KG构建任务
 * 
 * Response:
 * {
 *   success: boolean,
 *   message: string
 * }
 */
router.post('/cancel/:docId', authMiddleware, async (req, res) => {
  try {
    const { docId } = req.params;

    const kgAdapter = getKGAdapter();
    const result = await kgAdapter.cancelBuild(docId);

    res.json({
      success: result.success,
      message: result.message
    });

  } catch (error) {
    console.error('Error cancelling KG build:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/kg/queue/stats
 * 获取队列统计信息
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     queued: number,
 *     running: number,
 *     completed: number,
 *     failed: number
 *   }
 * }
 */
router.get('/queue/stats', authMiddleware, async (req, res) => {
  try {
    const kgAdapter = getKGAdapter();
    const stats = kgAdapter.getQueueStats();

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Error getting queue stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/kg/health
 * 健康检查
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     status: string,
 *     queueStats: Object
 *   }
 * }
 */
router.get('/health', async (req, res) => {
  try {
    const kgAdapter = getKGAdapter();
    const queueStats = kgAdapter.getQueueStats();

    res.json({
      success: true,
      data: {
        status: 'healthy',
        queueStats,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error checking health:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/kg/metrics
 * 获取监控指标
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     current: Object,  // 当前指标
 *     realtime: Object  // 实时统计
 *   }
 * }
 */
router.get('/metrics', authMiddleware, async (req, res) => {
  try {
    const monitor = getKGMonitor();
    const metrics = monitor.getMetrics();
    const realtime = monitor.getRealTimeStats();

    res.json({
      success: true,
      data: {
        current: metrics,
        realtime
      }
    });

  } catch (error) {
    console.error('Error getting metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/kg/metrics/history
 * 获取历史统计
 * 
 * Query params:
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 *   - limit: number
 * 
 * Response:
 * {
 *   success: boolean,
 *   data: {
 *     period: Object,
 *     stats: Object,
 *     records: Array
 *   }
 * }
 */
router.get('/metrics/history', authMiddleware, async (req, res) => {
  try {
    const { startDate, endDate, limit } = req.query;
    
    const options = {};
    if (startDate) options.startDate = new Date(startDate);
    if (endDate) options.endDate = new Date(endDate);
    if (limit) options.limit = parseInt(limit);

    const monitor = getKGMonitor();
    const history = await monitor.getHistoricalStats(options);

    res.json({
      success: true,
      data: history
    });

  } catch (error) {
    console.error('Error getting historical metrics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
