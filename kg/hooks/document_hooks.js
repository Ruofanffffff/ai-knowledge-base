/**
 * 文档操作钩子
 * 在文档创建、更新、删除后自动触发知识图谱操作
 * 
 * 支持两种模式：
 * 1. 传统模式 (kgService) - 默认模式，使用现有的 kg_service
 * 2. Pipeline模式 (UniversalDocumentPipeline) - 新模式，使用通用文档处理流水线
 * 
 * 通过环境变量 USE_PIPELINE=true 启用 Pipeline 模式
 * 通过环境变量 AUTO_BUILD_KG=true 启用自动构建（默认false，需要手动触发）
 */

const kgService = require('../services/kg_service');
const { UniversalDocumentPipeline } = require('../pipeline/universal_document_pipeline');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getInstance: getStatusManager } = require('../services/status_manager');
const { getInstance: getBuildQueueManager } = require('../services/build_queue_manager');
const { getInstance: getKGAdapter } = require('../services/kg_service_adapter');

// 配置开关：是否启用自动构建
const AUTO_BUILD_KG = process.env.AUTO_BUILD_KG === 'true';

console.log(`[KG Hook] 自动构建配置: AUTO_BUILD_KG=${AUTO_BUILD_KG}`);

// 创建 Pipeline 实例（延迟初始化）
let pipelineInstance = null;

/**
 * 获取或创建 Pipeline 实例
 * @returns {UniversalDocumentPipeline}
 */
function getPipelineInstance() {
  if (!pipelineInstance) {
    // 从环境变量读取配置
    const pipelineConfig = {
      extraction: {
        useLLM: process.env.PIPELINE_EXTRACTION_USE_LLM === 'true',
        useNER: process.env.PIPELINE_EXTRACTION_USE_NER !== 'false',
        useRules: process.env.PIPELINE_EXTRACTION_USE_RULES !== 'false'
      },
      normalization: {
        useLLM: process.env.PIPELINE_NORMALIZATION_USE_LLM === 'true',
        useAlgorithm: process.env.PIPELINE_NORMALIZATION_USE_ALGORITHM !== 'false'
      },
      entityBuilding: {
        useLLM: process.env.PIPELINE_ENTITY_USE_LLM === 'true',
        allowPartialEntities: process.env.PIPELINE_ENTITY_ALLOW_PARTIAL !== 'false'
      },
      relationExtraction: {
        enableBuiltin: process.env.PIPELINE_RELATION_BUILTIN !== 'false',
        enableCooccurrence: process.env.PIPELINE_RELATION_COOCCURRENCE !== 'false',
        enableSemantic: process.env.PIPELINE_RELATION_SEMANTIC === 'true'
      }
    };
    
    pipelineInstance = new UniversalDocumentPipeline(pipelineConfig);
    console.log('[KG Hook] Pipeline 实例已创建，配置:', pipelineConfig);
  }
  return pipelineInstance;
}

/**
 * 检查是否启用 Pipeline 模式
 * @returns {boolean}
 */
function isPipelineEnabled() {
  return process.env.USE_PIPELINE === 'true';
}

/**
 * 文档创建后钩子
 * 自动触发知识图谱构建（如果启用AUTO_BUILD_KG）
 * 
 * @param {Object} document - 创建的文档对象
 * @param {string} document.id - 文档 ID
 * @param {string} document.title - 文档标题
 * @param {string} document.content - 文档内容
 * @param {Object} options - 可选配置
 * @param {boolean} options.async - 是否异步执行 (默认 true)
 * @param {boolean} options.skipIfExists - 如果已存在则跳过 (默认 false)
 * @returns {Promise<Object>} 构建结果
 */
async function onDocumentCreated(document, options = {}) {
  const { async = true, skipIfExists = false } = options;
  
  try {
    console.log(`[KG Hook] 文档创建钩子触发: ${document.id} - ${document.title}`);
    
    // 检查是否启用自动构建
    if (!AUTO_BUILD_KG) {
      console.log('[KG Hook] 自动构建已禁用 (AUTO_BUILD_KG=false)，跳过KG构建');
      console.log('[KG Hook] 提示：可通过 POST /api/kg/build 手动触发构建');
      return { 
        skipped: true, 
        reason: 'Auto build disabled',
        message: 'Use POST /api/kg/build to manually trigger KG build'
      };
    }
    
    // 使用新的KG服务适配器 - 直接传入文档数据，避免跨数据库查询问题
    const kgAdapter = getKGAdapter();
    const result = await kgAdapter.buildWithDocument(document, {
      async,
      skipIfExists,
      force: false
    });
    
    console.log(`[KG Hook] 自动构建结果:`, result);
    
    return {
      success: true,
      mode: 'auto',
      result
    };
    
  } catch (error) {
    console.error(`[KG Hook] 文档创建钩子执行失败:`, error);
    return {
      success: false,
      mode: 'auto',
      error: error.message
    };
  }
}

/**
 * 文档更新后钩子
 * 自动触发知识图谱增量更新（如果启用AUTO_BUILD_KG）
 * 
 * @param {Object} document - 更新的文档对象
 * @param {string} document.id - 文档 ID
 * @param {string} document.title - 文档标题
 * @param {string} document.content - 文档内容
 * @param {Object} options - 可选配置
 * @param {boolean} options.async - 是否异步执行 (默认 true)
 * @param {boolean} options.fullRebuild - 是否全量重建 (默认 false)
 * @returns {Promise<Object>} 更新结果
 */
async function onDocumentUpdated(document, options = {}) {
  const { async = true, fullRebuild = false } = options;
  
  try {
    console.log(`[KG Hook] 文档更新钩子触发: ${document.id} - ${document.title}`);
    
    // 检查是否启用自动构建
    if (!AUTO_BUILD_KG) {
      console.log('[KG Hook] 自动构建已禁用 (AUTO_BUILD_KG=false)，跳过KG更新');
      console.log('[KG Hook] 提示：可通过 POST /api/kg/rebuild/:docId 手动触发重建');
      return { 
        skipped: true, 
        reason: 'Auto build disabled',
        message: 'Use POST /api/kg/rebuild/:docId to manually trigger KG rebuild'
      };
    }
    
    // 使用新的KG服务适配器
    const kgAdapter = getKGAdapter();
    
    if (fullRebuild) {
      // 全量重建
      const result = await kgAdapter.rebuildKG(document.id, { async });
      console.log(`[KG Hook] 自动重建结果:`, result);
      return {
        success: true,
        mode: 'auto',
        operation: 'rebuild',
        result
      };
    } else {
      // 增量更新：先删除再重建（简化实现）
      const result = await kgAdapter.rebuildKG(document.id, { async });
      console.log(`[KG Hook] 自动更新结果:`, result);
      return {
        success: true,
        mode: 'auto',
        operation: 'update',
        result
      };
    }
    
  } catch (error) {
    console.error(`[KG Hook] 文档更新钩子执行失败:`, error);
    return {
      success: false,
      mode: 'auto',
      error: error.message
    };
  }
}

/**
 * 文档删除后钩子
 * 自动触发知识图谱清理（如果启用AUTO_BUILD_KG）
 * 使用数据库事务确保数据一致性
 * 
 * @param {string} documentId - 文档 ID
 * @param {Object} options - 可选配置
 * @param {boolean} options.async - 是否异步执行 (默认 true)
 * @param {boolean} options.useTransaction - 是否使用事务 (默认 true)
 * @returns {Promise<Object>} 删除结果
 */
async function onDocumentDeleted(documentId, options = {}) {
  const { async = true, useTransaction = true } = options;
  
  try {
    console.log(`[KG Hook] 文档删除钩子触发: ${documentId}`);
    
    // 检查是否启用自动构建
    if (!AUTO_BUILD_KG) {
      console.log('[KG Hook] 自动构建已禁用 (AUTO_BUILD_KG=false)，跳过KG清理');
      console.log('[KG Hook] 提示：可通过 DELETE /api/kg/:docId 手动触发清理');
      return { 
        skipped: true, 
        reason: 'Auto build disabled',
        message: 'Use DELETE /api/kg/:docId to manually trigger KG cleanup'
      };
    }
    
    // 记录审计日志
    await logAuditEvent({
      operation: 'kg_delete',
      documentId,
      timestamp: new Date().toISOString(),
      reason: 'document_deleted',
      initiator: 'auto_hook'
    });
    
    // 使用新的KG服务适配器
    const kgAdapter = getKGAdapter();
    
    if (async) {
      // 异步执行
      setImmediate(async () => {
        try {
          if (useTransaction) {
            await deleteKGWithTransaction(documentId);
          } else {
            await kgAdapter.deleteKG(documentId);
          }
          console.log(`[KG Hook] 文档 ${documentId} 的知识图谱清理完成`);
          
          // 记录成功日志
          await logAuditEvent({
            operation: 'kg_delete_success',
            documentId,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error(`[KG Hook] 文档 ${documentId} 的知识图谱清理失败:`, error);
          
          // 记录失败日志
          await logAuditEvent({
            operation: 'kg_delete_failed',
            documentId,
            timestamp: new Date().toISOString(),
            error: error.message
          });
        }
      });
      
      return { 
        success: true, 
        async: true,
        mode: 'auto',
        message: 'KG cleanup started in background' 
      };
    }
    
    // 同步执行
    let result;
    if (useTransaction) {
      result = await deleteKGWithTransaction(documentId);
    } else {
      result = await kgAdapter.deleteKG(documentId);
    }
    
    console.log(`[KG Hook] 文档 ${documentId} 的知识图谱清理完成`);
    
    // 记录成功日志
    await logAuditEvent({
      operation: 'kg_delete_success',
      documentId,
      timestamp: new Date().toISOString(),
      deletedEntities: result.deletedEntities,
      deletedRelations: result.deletedRelations
    });
    
    return {
      success: true,
      async: false,
      mode: 'auto',
      result
    };
    
  } catch (error) {
    console.error(`[KG Hook] 文档删除钩子执行失败:`, error);
    
    // 记录失败日志
    await logAuditEvent({
      operation: 'kg_delete_failed',
      documentId,
      timestamp: new Date().toISOString(),
      error: error.message
    }).catch(err => console.error('[KG Hook] 审计日志记录失败:', err));
    
    return {
      success: false,
      mode: 'auto',
      error: error.message
    };
  }
}

/**
 * 批量文档操作钩子
 * 批量触发知识图谱操作（如果启用AUTO_BUILD_KG）
 * 
 * @param {Array<Object>} documents - 文档列表
 * @param {string} operation - 操作类型: 'create' | 'update' | 'delete'
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>} 批量操作结果
 */
async function onBatchDocuments(documents, operation, options = {}) {
  try {
    console.log(`[KG Hook] 批量文档${operation}钩子触发: ${documents.length} 个文档`);
    
    // 检查是否启用自动构建
    if (!AUTO_BUILD_KG) {
      console.log('[KG Hook] 自动构建已禁用 (AUTO_BUILD_KG=false)，跳过批量操作');
      console.log('[KG Hook] 提示：可通过 POST /api/kg/build/batch 手动触发批量构建');
      return { 
        skipped: true, 
        reason: 'Auto build disabled',
        message: 'Use POST /api/kg/build/batch to manually trigger batch KG build'
      };
    }
    
    const results = [];
    
    for (const doc of documents) {
      let result;
      
      switch (operation) {
        case 'create':
          result = await onDocumentCreated(doc, options);
          break;
        case 'update':
          result = await onDocumentUpdated(doc, options);
          break;
        case 'delete':
          result = await onDocumentDeleted(doc.id || doc, options);
          break;
        default:
          result = { success: false, error: `Unknown operation: ${operation}` };
      }
      
      results.push({
        documentId: doc.id || doc,
        ...result
      });
    }
    
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;
    
    console.log(`[KG Hook] 批量操作完成: ${successCount} 成功, ${failureCount} 失败`);
    
    return {
      success: true,
      mode: 'auto',
      total: documents.length,
      successCount,
      failureCount,
      results
    };
    
  } catch (error) {
    console.error(`[KG Hook] 批量文档钩子执行失败:`, error);
    return {
      success: false,
      mode: 'auto',
      error: error.message
    };
  }
}

/**
 * 分类错误类型
 * @param {Error} error - 错误对象
 * @returns {string} 错误类别
 */
function categorizeError(error) {
  const message = error.message || '';
  
  // 用户错误
  if (message.includes('Invalid file format') ||
      message.includes('Empty content') ||
      message.includes('缺少 filePath') ||
      message.includes('不支持的文件类型')) {
    return 'user_error';
  }
  
  // 系统错误
  if (message.includes('Database') ||
      message.includes('Connection') ||
      message.includes('Timeout') ||
      message.includes('ENOENT') ||
      message.includes('EACCES')) {
    return 'system_error';
  }
  
  return 'unknown_error';
}

/**
 * 格式化错误消息为用户友好的文本
 * @param {Error} error - 错误对象
 * @param {string} category - 错误类别
 * @returns {string} 用户友好的错误消息
 */
function formatErrorMessage(error, category) {
  if (category === 'user_error') {
    return '文件格式不支持或内容无效，请检查文件后重试';
  }
  if (category === 'system_error') {
    return '系统暂时无法处理，请稍后重试';
  }
  return '处理失败，请联系管理员';
}

/**
 * 使用事务删除KG数据
 * 确保删除操作的原子性
 * 
 * @param {string} documentId - 文档ID
 * @returns {Promise<Object>} 删除结果
 */
async function deleteKGWithTransaction(documentId) {
  console.log(`[KG Hook] 使用事务删除KG: ${documentId}`);
  
  try {
    // 使用Prisma事务
    const result = await prisma.$transaction(async (tx) => {
      // 1. 删除CKB实体
      const deletedCKBs = await tx.cKB.deleteMany({
        where: { doc_id: documentId }
      });
      
      // 2. 删除关系（通过CKB ID）
      // 注意：这里假设关系表有doc_id字段，如果没有需要先查询CKB ID
      const deletedRelations = await tx.cKBRelation.deleteMany({
        where: { doc_id: documentId }
      });
      
      // 3. 删除状态记录
      await tx.kGBuildStatus.deleteMany({
        where: { doc_id: documentId }
      });
      
      console.log(`[KG Hook] 事务删除完成: ${deletedCKBs.count} 个实体, ${deletedRelations.count} 个关系`);
      
      return {
        success: true,
        docId: documentId,
        deletedEntities: deletedCKBs.count,
        deletedRelations: deletedRelations.count
      };
    });
    
    return result;
    
  } catch (error) {
    console.error(`[KG Hook] 事务删除失败: ${documentId}`, error);
    throw error;
  }
}

/**
 * 记录审计日志
 * 记录所有KG操作以便追踪和审计
 * 
 * @param {Object} event - 审计事件
 * @param {string} event.operation - 操作类型
 * @param {string} event.documentId - 文档ID
 * @param {string} event.timestamp - 时间戳
 * @param {string} event.reason - 操作原因
 * @param {string} event.initiator - 操作发起者
 * @param {string} event.error - 错误信息（如果有）
 * @returns {Promise<void>}
 */
async function logAuditEvent(event) {
  try {
    // 尝试写入数据库审计表
    await prisma.kGAuditLog.create({
      data: {
        operation: event.operation,
        doc_id: event.documentId,
        timestamp: new Date(event.timestamp),
        reason: event.reason || null,
        initiator: event.initiator || 'system',
        error_message: event.error || null,
        metadata: JSON.stringify({
          deletedEntities: event.deletedEntities,
          deletedRelations: event.deletedRelations
        })
      }
    }).catch(err => {
      // 如果审计表不存在，只记录到控制台
      if (err.code === 'P2021' || err.message.includes('does not exist')) {
        console.log('[KG Hook] 审计日志 (表不存在，仅控制台):', event);
      } else {
        throw err;
      }
    });
    
  } catch (error) {
    // 审计日志失败不应影响主流程，只记录到控制台
    console.log('[KG Hook] 审计日志:', event);
    console.error('[KG Hook] 审计日志写入失败:', error.message);
  }
}

/**
 * 检查数据一致性
 * 检查文档和KG数据的一致性
 * 
 * @param {string} documentId - 文档ID
 * @returns {Promise<Object>} 一致性检查结果
 */
async function checkDataConsistency(documentId) {
  try {
    // 检查文档是否存在
    const document = await prisma.note.findUnique({
      where: { id: documentId }
    });
    
    // 检查KG数据是否存在
    const kgData = await prisma.cKB.findFirst({
      where: { doc_id: documentId }
    });
    
    // 检查状态记录是否存在
    const statusManager = getStatusManager();
    const status = await statusManager.getStatus(documentId);
    
    const issues = [];
    
    // 文档不存在但有KG数据（孤立的KG数据）
    if (!document && kgData) {
      issues.push({
        type: 'orphaned_kg',
        message: 'KG data exists but document is missing',
        severity: 'high'
      });
    }
    
    // 文档存在但没有KG数据（缺失的KG数据）
    if (document && !kgData && status?.status === 'completed') {
      issues.push({
        type: 'missing_kg',
        message: 'Document exists and status is completed but KG data is missing',
        severity: 'medium'
      });
    }
    
    // 状态不一致
    if (kgData && (!status || status.status !== 'completed')) {
      issues.push({
        type: 'status_mismatch',
        message: 'KG data exists but status is not completed',
        severity: 'low'
      });
    }
    
    return {
      documentId,
      consistent: issues.length === 0,
      issues,
      checks: {
        documentExists: !!document,
        kgDataExists: !!kgData,
        statusExists: !!status,
        statusValue: status?.status
      }
    };
    
  } catch (error) {
    console.error(`[KG Hook] 一致性检查失败: ${documentId}`, error);
    return {
      documentId,
      consistent: false,
      error: error.message
    };
  }
}

module.exports = {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
  onBatchDocuments,
  checkDataConsistency
};
