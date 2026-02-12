/**
 * KG服务适配器
 * 
 * 封装知识图谱服务调用,提供统一的接口
 * 负责从数据库读取文档数据并触发KG构建
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const kgService = require('./kg_service');
const { getInstance: getStatusManager } = require('./status_manager');
const { getInstance: getBuildQueueManager } = require('./build_queue_manager');
const { getInstance: getKGConfig } = require('../config/kg_config');
const { createError, isRetryable } = require('../errors/kg_error');
const { getInstance: getKGMonitor } = require('../monitoring/kg_monitor');
const { createLLMClient } = require('../enhanced_extraction/llm_client');

class KGServiceAdapter {
  constructor() {
    // 重试配置
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1秒
    this.maxDelay = 30000; // 30秒
  }
  /**
   * 从数据库构建KG
   * @param {string} docId - 文档ID
   * @param {Object} options - 构建选项
   * @param {boolean} options.force - 是否强制重建
   * @param {boolean} options.async - 是否异步执行
   * @param {boolean} options.skipIfExists - 如果已存在则跳过
   * @returns {Promise<Object>} 构建结果
   */
  async buildFromDatabase(docId, options = {}) {
    const {
      force = false,
      async = true,
      skipIfExists = false
    } = options;

    try {
      console.log(`[KG Adapter] 开始构建KG: ${docId}`);

      // 1. 从数据库查询文档
      const doc = await this.getDocumentFromDB(docId);

      // 2. 验证文档存在
      if (!doc) {
        throw createError.documentNotFound(docId);
      }

      // 3. 验证文档有必要的字段
      if (!doc.filePath) {
        throw createError.documentInvalid(docId, 'missing filePath');
      }

      // 4. 检查是否已有KG
      if (!force && skipIfExists) {
        const existingKG = await this.checkExistingKG(docId);
        if (existingKG) {
          console.log(`[KG Adapter] KG已存在,跳过构建: ${docId}`);
          return {
            success: true,
            skipped: true,
            reason: 'KG already exists',
            docId
          };
        }
      }

      // 5. 异步执行
      if (async) {
        return await this._buildAsync(docId, doc, options);
      }

      // 6. 同步执行
      return await this._buildSync(docId, doc, options);

    } catch (error) {
      console.error(`[KG Adapter] 构建失败: ${docId}`, error);
      throw error;
    }
  }

  /**
   * 直接使用传入的文档数据构建KG（不从数据库查询）
   * 用于 document_hooks 场景：上传时已有完整文档信息
   * @param {Object} document - 文档对象
   * @param {string} document.id - 文档ID
   * @param {string} document.content - 文档内容
   * @param {Object} document.metadata - 文档元数据（含 filePath）
   * @param {string} document.fileType - 文件类型
   * @param {Object} options - 构建选项
   * @returns {Promise<Object>} 构建结果
   */
  async buildWithDocument(document, options = {}) {
    const {
      force = false,
      async: isAsync = true,
      skipIfExists = false
    } = options;

    const docId = document.id?.toString();

    try {
      console.log(`[KG Adapter] 直接构建KG (无需查库): ${docId}`);

      if (!docId) {
        throw createError.documentInvalid('unknown', 'missing document id');
      }

      // 从 metadata 中提取 filePath
      const filePath = document.metadata?.filePath || document.filePath || null;
      if (!filePath) {
        throw createError.documentInvalid(docId, 'missing filePath in metadata');
      }

      const doc = {
        id: docId,
        title: document.title || 'Untitled',
        content: document.content || '',
        filePath: filePath,
        fileType: document.fileType || document.metadata?.fileType || '.txt',
        metadata: document.metadata || {}
      };

      // 检查是否已有KG
      if (!force && skipIfExists) {
        const existingKG = await this.checkExistingKG(docId);
        if (existingKG) {
          console.log(`[KG Adapter] KG已存在,跳过构建: ${docId}`);
          return {
            success: true,
            skipped: true,
            reason: 'KG already exists',
            docId
          };
        }
      }

      if (isAsync) {
        return await this._buildAsync(docId, doc, options);
      }

      return await this._buildSync(docId, doc, options);

    } catch (error) {
      console.error(`[KG Adapter] 直接构建失败: ${docId}`, error);
      throw error;
    }
  }



  /**
   * 异步构建KG
   * @private
   */
  async _buildAsync(docId, doc, options) {
    const statusManager = getStatusManager();
    const queueManager = getBuildQueueManager();

    // 创建初始状态
    try {
      await statusManager.createStatus(docId, 'pending');
    } catch (error) {
      console.error(`[KG Adapter] 创建状态失败:`, error);
    }

    // 定义构建函数（带重试）
    const buildFn = async () => {
      return await this._buildWithRetry(docId, doc, options);
    };

    // 加入队列
    queueManager.enqueue(docId, buildFn).catch(error => {
      console.error(`[KG Adapter] 队列处理失败: ${docId}`, error);
    });

    // 获取队列信息
    const queueStats = queueManager.getStats();
    const queuePosition = queueManager.getQueuePosition(docId);

    return {
      success: true,
      docId,
      status: 'queued',
      queuePosition,
      queueStats,
      message: 'KG build queued successfully'
    };
  }

  /**
   * 带重试的构建逻辑
   * @private
   */
  async _buildWithRetry(docId, doc, options) {
    const statusManager = getStatusManager();
    const monitor = getKGMonitor();
    
    let lastError = null;
    let attempt = 0;
    
    // 记录构建开始
    const buildRecord = monitor.recordBuildStart(docId);

    // ===== 创建 LLM 客户端并注入 options =====
    if (!options.llmClient && process.env.QWEN_API_KEY) {
      try {
        options.llmClient = createLLMClient({
          apiKey: process.env.QWEN_API_KEY,
          model: process.env.TEXT_LLM_MODEL || 'qwen-max',
          timeout: parseInt(process.env.TEXT_LLM_TIMEOUT || '30000')
        });
        console.log(`[KG Adapter] LLM 客户端已创建 (model: ${options.llmClient.config.model})`);
      } catch (llmError) {
        console.warn(`[KG Adapter] LLM 客户端创建失败，将使用纯规则提取:`, llmError.message);
      }
    }

    // ===== 新增：同步文档到 knowledge_graph.db =====
    try {
      console.log(`[KG Adapter] 同步文档到 knowledge_graph.db: ${docId}`);
      await kgService.syncDocumentToKGDB(doc);
    } catch (syncError) {
      console.error(`[KG Adapter] 文档同步失败，终止构建: ${docId}`, syncError);
      await statusManager.updateStatus(docId, 'failed', {
        errorMessage: `文档同步失败: ${syncError.message}`,
        errorCategory: 'document_sync_error',
        attempts: 0,
        retryable: false
      });
      monitor.recordBuildFailure(docId, buildRecord, syncError);
      throw syncError;
    }
    // ===== 新增结束 =====

    while (attempt <= this.maxRetries) {
      try {
        // 更新状态为building
        await statusManager.updateStatus(docId, 'building', {
          attempt: attempt + 1,
          maxAttempts: this.maxRetries + 1
        });

        console.log(`[KG Adapter] 构建尝试 ${attempt + 1}/${this.maxRetries + 1}: ${docId}`);

        // 调用KG服务构建
        const result = await kgService.buildKnowledgeGraph(
          docId,
          doc.filePath,
          doc.fileType || '.txt',
          options
        );

        // 计算总关系数
        const totalRelations = (result.relations_created?.builtin || 0) +
                               (result.relations_created?.cooccurrence || 0) +
                               (result.relations_created?.semantic || 0);

        // 更新状态为completed
        await statusManager.updateStatus(docId, 'completed', {
          entityCount: result.entities_created || 0,
          relationCount: totalRelations,
          attempts: attempt + 1
        });

        console.log(`[KG Adapter] 构建完成: ${docId} (尝试 ${attempt + 1}次)`);

        // 记录构建成功
        monitor.recordBuildComplete(docId, buildRecord, {
          entityCount: result.entities_created || 0,
          relationCount: totalRelations
        });

        return {
          success: true,
          docId,
          entityCount: result.entities_created || 0,
          relationCount: totalRelations,
          attempts: attempt + 1
        };

      } catch (error) {
        lastError = error;
        attempt++;

        console.error(`[KG Adapter] 构建失败 (尝试 ${attempt}/${this.maxRetries + 1}): ${docId}`, error.message);

        // 检查是否可重试
        const canRetry = isRetryable(error.category) && attempt <= this.maxRetries;

        if (!canRetry) {
          // 不可重试或已达最大重试次数
          console.error(`[KG Adapter] 构建最终失败: ${docId}`, error);

          await statusManager.updateStatus(docId, 'failed', {
            errorMessage: error.message,
            errorCategory: error.category || 'unknown_error',
            attempts: attempt,
            retryable: false
          });

          // 记录构建失败
          monitor.recordBuildFailure(docId, buildRecord, error);

          throw error;
        }

        // 计算退避延迟（指数退避）
        const delay = this._calculateBackoffDelay(attempt);
        console.log(`[KG Adapter] 等待 ${delay}ms 后重试: ${docId}`);

        // 更新状态为retrying
        await statusManager.updateStatus(docId, 'building', {
          retrying: true,
          attempt: attempt,
          nextRetryIn: delay,
          lastError: error.message
        });

        // 等待后重试
        await this._sleep(delay);
      }
    }

    // 如果所有重试都失败
    await statusManager.updateStatus(docId, 'failed', {
      errorMessage: lastError?.message || 'Unknown error',
      errorCategory: lastError?.category || 'unknown_error',
      attempts: attempt,
      retryable: false
    });

    // 记录构建失败
    monitor.recordBuildFailure(docId, buildRecord, lastError);

    throw lastError;
  }

  /**
   * 计算指数退避延迟
   * @private
   * @param {number} attempt - 当前尝试次数
   * @returns {number} 延迟时间（毫秒）
   */
  _calculateBackoffDelay(attempt) {
    // 指数退避: baseDelay * 2^(attempt-1)
    const delay = this.baseDelay * Math.pow(2, attempt - 1);
    
    // 添加随机抖动（±20%）避免雷鸣群效应
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    
    // 限制最大延迟
    return Math.min(delay + jitter, this.maxDelay);
  }

  /**
   * 睡眠函数
   * @private
   * @param {number} ms - 毫秒数
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 同步构建KG
   * @private
   */
  async _buildSync(docId, doc, options) {
    const statusManager = getStatusManager();

    try {
      // 创建初始状态
      await statusManager.createStatus(docId, 'building');

      // 调用KG服务构建
      const result = await kgService.buildKnowledgeGraph(
        docId,
        doc.filePath,
        doc.fileType || '.txt',
        options
      );

      // 计算总关系数
      const totalRelations = (result.relations_created?.builtin || 0) +
                             (result.relations_created?.cooccurrence || 0) +
                             (result.relations_created?.semantic || 0);

      // 更新状态为completed
      await statusManager.updateStatus(docId, 'completed', {
        entityCount: result.entities_created || 0,
        relationCount: totalRelations
      });

      console.log(`[KG Adapter] 同步构建完成: ${docId}`);

      return {
        success: true,
        docId,
        status: 'completed',
        entityCount: result.entities_created || 0,
        relationCount: totalRelations,
        result
      };

    } catch (error) {
      // 更新状态为failed
      await statusManager.updateStatus(docId, 'failed', {
        errorMessage: error.message,
        errorCategory: error.category || 'unknown_error'
      });

      throw error;
    }
  }

  /**
   * 批量构建KG
   * @param {Array<string>} docIds - 文档ID列表
   * @param {Object} options - 构建选项
   * @param {number} options.concurrency - 并发数
   * @returns {Promise<Array>} 构建结果列表
   */
  async buildBatch(docIds, options = {}) {
    const { concurrency = 3 } = options;

    console.log(`[KG Adapter] 批量构建KG: ${docIds.length}个文档`);

    const results = [];

    for (const docId of docIds) {
      try {
        const result = await this.buildFromDatabase(docId, {
          ...options,
          async: true
        });
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          docId,
          error: error.message,
          category: error.category
        });
      }
    }

    return results;
  }

  /**
   * 查询构建状态
   * @param {string} docId - 文档ID
   * @returns {Promise<Object>} 状态信息
   */
  async getStatus(docId) {
    const statusManager = getStatusManager();
    const status = await statusManager.getStatus(docId);

    if (!status) {
      return null;
    }

    return status;
  }

  /**
   * 查询详细状态(包含进度)
   * @param {string} docId - 文档ID
   * @returns {Promise<Object>} 详细状态信息
   */
  async getDetailedStatus(docId) {
    const statusManager = getStatusManager();
    const status = await statusManager.getStatus(docId);

    if (!status) {
      return null;
    }

    // 如果正在构建,获取进度信息
    if (status.status === 'building' || status.status === 'queued') {
      const queueManager = getBuildQueueManager();
      const progress = queueManager.getProgress(docId);
      const queuePosition = queueManager.getQueuePosition(docId);

      return {
        ...status,
        progress: progress?.percentage || 0,
        currentStage: progress?.stage || 'unknown',
        estimatedTimeRemaining: progress?.estimatedTime || null,
        queuePosition
      };
    }

    return status;
  }

  /**
   * 删除KG
   * @param {string} docId - 文档ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteKG(docId) {
    console.log(`[KG Adapter] 删除KG: ${docId}`);

    try {
      const result = await kgService.deleteKnowledgeGraph(docId);

      // 删除状态记录
      const statusManager = getStatusManager();
      await statusManager.deleteStatus(docId);

      return {
        success: true,
        docId,
        ...result
      };

    } catch (error) {
      console.error(`[KG Adapter] 删除KG失败: ${docId}`, error);
      throw error;
    }
  }

  /**
   * 重建KG
   * @param {string} docId - 文档ID
   * @param {Object} options - 构建选项
   * @returns {Promise<Object>} 重建结果
   */
  async rebuildKG(docId, options = {}) {
    console.log(`[KG Adapter] 重建KG: ${docId}`);

    try {
      // 先删除旧KG
      await this.deleteKG(docId);

      // 重新构建
      return await this.buildFromDatabase(docId, {
        ...options,
        force: true,
        async: true
      });

    } catch (error) {
      console.error(`[KG Adapter] 重建KG失败: ${docId}`, error);
      throw error;
    }
  }

  /**
   * 从数据库获取文档
   * @private
   * @param {string} docId - 文档ID
   * @returns {Promise<Object>} 文档对象
   */
  async getDocumentFromDB(docId) {
      try {
        // 尝试从Prisma Note表查询
        const note = await prisma.note.findUnique({
          where: { id: docId }
        });

        if (note) {
          return {
            id: note.id,
            title: note.content?.substring(0, 100) || 'Untitled',
            content: note.content,
            filePath: note.metadata?.filePath || null,
            fileType: note.metadata?.fileType || '.txt',
            metadata: note.metadata
          };
        }

        // 尝试从Prisma Document表查询
        const doc = await prisma.document.findUnique({
          where: { id: docId }
        });

        if (doc) {
          const metadata = doc.metadata ? (typeof doc.metadata === 'string' ? JSON.parse(doc.metadata) : doc.metadata) : {};
          return {
            id: doc.id,
            title: doc.title || 'Untitled',
            content: doc.content || '',
            filePath: metadata.filePath || null,
            fileType: doc.fileType || metadata.fileType || '.txt',
            metadata
          };
        }

        // 回退：从 users.db 的 documents 表查询（主文档存储）
        const userDoc = await this._getDocumentFromUserDB(docId);
        return userDoc;

      } catch (error) {
        console.error(`[KG Adapter] 查询文档失败: ${docId}`, error);
        // 最后尝试从 users.db 查询
        try {
          return await this._getDocumentFromUserDB(docId);
        } catch (e) {
          return null;
        }
      }
    }

  /**
   * 从 users.db 的 documents 表查询文档
   * @private
   * @param {string} docId - 文档ID
   * @returns {Promise<Object|null>} 文档对象
   */
  async _getDocumentFromUserDB(docId) {
    const { initDatabase } = require('../../database/initUserDB');
    const userDb = initDatabase();

    return new Promise((resolve, reject) => {
      userDb.get('SELECT * FROM documents WHERE id = ?', [docId], (err, row) => {
        if (err) {
          console.error(`[KG Adapter] users.db 查询失败: ${docId}`, err);
          return resolve(null);
        }
        if (!row) {
          return resolve(null);
        }

        let metadata = {};
        try {
          metadata = row.metadata ? JSON.parse(row.metadata) : {};
        } catch (e) {
          // ignore parse error
        }

        resolve({
          id: row.id.toString(),
          title: row.title || 'Untitled',
          content: row.content || '',
          filePath: metadata.filePath || null,
          fileType: row.file_type || metadata.fileType || '.txt',
          metadata
        });
      });
    });
  }




  /**
   * 检查是否已有KG
   * @private
   * @param {string} docId - 文档ID
   * @returns {Promise<boolean>} 是否存在KG
   */
  async checkExistingKG(docId) {
    try {
      const ckb = await prisma.cKB.findFirst({
        where: { doc_id: docId }
      });
      return ckb !== null;
    } catch (error) {
      console.error(`[KG Adapter] 检查KG失败: ${docId}`, error);
      return false;
    }
  }

  /**
   * 取消构建任务
   * @param {string} docId - 文档ID
   * @returns {Promise<Object>} 取消结果
   */
  async cancelBuild(docId) {
    console.log(`[KG Adapter] 取消构建: ${docId}`);

    try {
      const queueManager = getBuildQueueManager();
      const result = await queueManager.cancel(docId);

      return {
        success: result.success,
        docId,
        message: result.message || result.reason
      };

    } catch (error) {
      console.error(`[KG Adapter] 取消构建失败: ${docId}`, error);
      throw error;
    }
  }

  /**
   * 获取队列统计信息
   * @returns {Object} 队列统计
   */
  getQueueStats() {
    const queueManager = getBuildQueueManager();
    return queueManager.getStats();
  }
}

// 导出单例
let instance = null;

function getInstance() {
  if (!instance) {
    instance = new KGServiceAdapter();
  }
  return instance;
}

module.exports = {
  KGServiceAdapter,
  getInstance
};
