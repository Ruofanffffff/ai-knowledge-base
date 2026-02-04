/**
 * 文档操作钩子
 * 在文档创建、更新、删除后自动触发知识图谱操作
 * 
 * 支持两种模式：
 * 1. 传统模式 (kgService) - 默认模式，使用现有的 kg_service
 * 2. Pipeline模式 (UniversalDocumentPipeline) - 新模式，使用通用文档处理流水线
 * 
 * 通过环境变量 USE_PIPELINE=true 启用 Pipeline 模式
 */

const kgService = require('../services/kg_service');
const { UniversalDocumentPipeline } = require('../pipeline/universal_document_pipeline');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
 * 自动触发知识图谱构建
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
    
    // 检查环境变量是否启用 KG
    if (process.env.KG_ENABLED === 'false') {
      console.log('[KG Hook] 知识图谱功能已禁用,跳过构建');
      return { skipped: true, reason: 'KG disabled' };
    }
    
    // 检查是否已存在
    if (skipIfExists) {
      const existingCKB = await prisma.cKB.findFirst({
        where: { doc_id: document.id }
      });
      
      if (existingCKB) {
        console.log(`[KG Hook] 文档 ${document.id} 的 KG 已存在,跳过构建`);
        return { skipped: true, reason: 'Already exists' };
      }
    }
    
    // 选择处理模式
    const usePipeline = isPipelineEnabled();
    console.log(`[KG Hook] 使用${usePipeline ? 'Pipeline' : 'kgService'}模式处理文档`);
    
    // 异步执行
    if (async) {
      // 不等待结果,立即返回
      setImmediate(async () => {
        try {
          if (usePipeline) {
            // 使用 Pipeline 模式
            const pipeline = getPipelineInstance();
            const pipelineDoc = {
              id: document.id,
              type: 'text',
              title: document.title,
              content: document.content,
              metadata: document.metadata
            };
            const context = await pipeline.processDocument(pipelineDoc);
            console.log(`[KG Hook] Pipeline 处理完成: ${document.id}, 状态: ${context.status}`);
          } else {
            // 使用传统 kgService 模式
            // 从 document.metadata 中获取 filePath 和 fileType
            const filePath = document.metadata?.filePath || document.filePath;
            const fileType = document.fileType || document.metadata?.fileType || '.txt';
            
            if (!filePath) {
              console.error(`[KG Hook] 文档 ${document.id} 缺少 filePath，无法构建知识图谱`);
              return;
            }
            
            await kgService.buildKnowledgeGraph(document.id, filePath, fileType);
            console.log(`[KG Hook] 文档 ${document.id} 的知识图谱构建完成`);
          }
        } catch (error) {
          console.error(`[KG Hook] 文档 ${document.id} 的知识图谱构建失败:`, error);
        }
      });
      
      return { 
        success: true, 
        async: true,
        mode: usePipeline ? 'pipeline' : 'kgService',
        message: 'KG build started in background' 
      };
    }
    
    // 同步执行
    let result;
    if (usePipeline) {
      // 使用 Pipeline 模式
      const pipeline = getPipelineInstance();
      const pipelineDoc = {
        id: document.id,
        type: 'text',
        title: document.title,
        content: document.content,
        metadata: document.metadata
      };
      const context = await pipeline.processDocument(pipelineDoc);
      console.log(`[KG Hook] Pipeline 处理完成: ${document.id}, 状态: ${context.status}`);
      result = {
        status: context.status,
        metrics: context.metrics,
        duration: context.totalDuration
      };
    } else {
      // 使用传统 kgService 模式
      const filePath = document.metadata?.filePath || document.filePath;
      const fileType = document.fileType || document.metadata?.fileType || '.txt';
      
      if (!filePath) {
        throw new Error(`文档 ${document.id} 缺少 filePath，无法构建知识图谱`);
      }
      
      result = await kgService.buildKnowledgeGraph(document.id, filePath, fileType);
      console.log(`[KG Hook] 文档 ${document.id} 的知识图谱构建完成`);
    }
    
    return {
      success: true,
      async: false,
      mode: usePipeline ? 'pipeline' : 'kgService',
      result
    };
    
  } catch (error) {
    console.error(`[KG Hook] 文档创建钩子执行失败:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 文档更新后钩子
 * 自动触发知识图谱增量更新
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
    
    // 检查环境变量是否启用 KG
    if (process.env.KG_ENABLED === 'false') {
      console.log('[KG Hook] 知识图谱功能已禁用,跳过更新');
      return { skipped: true, reason: 'KG disabled' };
    }
    
    // 选择处理模式
    const usePipeline = isPipelineEnabled();
    console.log(`[KG Hook] 使用${usePipeline ? 'Pipeline' : 'kgService'}模式更新文档`);
    
    // 异步执行
    if (async) {
      // 不等待结果,立即返回
      setImmediate(async () => {
        try {
          if (usePipeline) {
            // Pipeline 模式：先删除旧数据，再重新处理
            await kgService.deleteKnowledgeGraph(document.id);
            
            const pipeline = getPipelineInstance();
            const pipelineDoc = {
              id: document.id,
              type: 'text',
              title: document.title,
              content: document.content,
              metadata: document.metadata
            };
            const context = await pipeline.processDocument(pipelineDoc);
            console.log(`[KG Hook] Pipeline 更新完成: ${document.id}, 状态: ${context.status}`);
          } else {
            // 传统模式
            if (fullRebuild) {
              // 先删除旧数据,再重建
              await kgService.deleteKnowledgeGraph(document.id);
              await kgService.buildKnowledgeGraph(document.id);
              console.log(`[KG Hook] 文档 ${document.id} 的知识图谱全量重建完成`);
            } else {
              // 增量更新
              await kgService.updateKnowledgeGraph(document.id);
              console.log(`[KG Hook] 文档 ${document.id} 的知识图谱增量更新完成`);
            }
          }
        } catch (error) {
          console.error(`[KG Hook] 文档 ${document.id} 的知识图谱更新失败:`, error);
        }
      });
      
      return { 
        success: true, 
        async: true,
        mode: usePipeline ? 'pipeline' : 'kgService',
        message: usePipeline ? 'Pipeline update started in background' : 
                 (fullRebuild ? 'KG rebuild started in background' : 'KG update started in background')
      };
    }
    
    // 同步执行
    let result;
    if (usePipeline) {
      // Pipeline 模式：先删除旧数据，再重新处理
      await kgService.deleteKnowledgeGraph(document.id);
      
      const pipeline = getPipelineInstance();
      const pipelineDoc = {
        id: document.id,
        type: 'text',
        title: document.title,
        content: document.content,
        metadata: document.metadata
      };
      const context = await pipeline.processDocument(pipelineDoc);
      console.log(`[KG Hook] Pipeline 更新完成: ${document.id}, 状态: ${context.status}`);
      result = {
        status: context.status,
        metrics: context.metrics,
        duration: context.totalDuration
      };
    } else {
      // 传统模式
      if (fullRebuild) {
        await kgService.deleteKnowledgeGraph(document.id);
        result = await kgService.buildKnowledgeGraph(document.id);
        console.log(`[KG Hook] 文档 ${document.id} 的知识图谱全量重建完成`);
      } else {
        result = await kgService.updateKnowledgeGraph(document.id);
        console.log(`[KG Hook] 文档 ${document.id} 的知识图谱增量更新完成`);
      }
    }
    
    return {
      success: true,
      async: false,
      mode: usePipeline ? 'pipeline' : 'kgService',
      result
    };
    
  } catch (error) {
    console.error(`[KG Hook] 文档更新钩子执行失败:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 文档删除后钩子
 * 自动触发知识图谱清理
 * 
 * @param {string} documentId - 文档 ID
 * @param {Object} options - 可选配置
 * @param {boolean} options.async - 是否异步执行 (默认 true)
 * @returns {Promise<Object>} 删除结果
 */
async function onDocumentDeleted(documentId, options = {}) {
  const { async = true } = options;
  
  try {
    console.log(`[KG Hook] 文档删除钩子触发: ${documentId}`);
    
    // 检查环境变量是否启用 KG
    if (process.env.KG_ENABLED === 'false') {
      console.log('[KG Hook] 知识图谱功能已禁用,跳过清理');
      return { skipped: true, reason: 'KG disabled' };
    }
    
    // 异步执行
    if (async) {
      // 不等待结果,立即返回
      setImmediate(async () => {
        try {
          await kgService.deleteKnowledgeGraph(documentId);
          console.log(`[KG Hook] 文档 ${documentId} 的知识图谱清理完成`);
        } catch (error) {
          console.error(`[KG Hook] 文档 ${documentId} 的知识图谱清理失败:`, error);
        }
      });
      
      return { 
        success: true, 
        async: true,
        message: 'KG cleanup started in background' 
      };
    }
    
    // 同步执行
    const result = await kgService.deleteKnowledgeGraph(documentId);
    console.log(`[KG Hook] 文档 ${documentId} 的知识图谱清理完成`);
    
    return {
      success: true,
      async: false,
      result
    };
    
  } catch (error) {
    console.error(`[KG Hook] 文档删除钩子执行失败:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 批量文档操作钩子
 * 批量触发知识图谱操作
 * 
 * @param {Array<Object>} documents - 文档列表
 * @param {string} operation - 操作类型: 'create' | 'update' | 'delete'
 * @param {Object} options - 可选配置
 * @returns {Promise<Object>} 批量操作结果
 */
async function onBatchDocuments(documents, operation, options = {}) {
  try {
    console.log(`[KG Hook] 批量文档${operation}钩子触发: ${documents.length} 个文档`);
    
    // 检查环境变量是否启用 KG
    if (process.env.KG_ENABLED === 'false') {
      console.log('[KG Hook] 知识图谱功能已禁用,跳过批量操作');
      return { skipped: true, reason: 'KG disabled' };
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
      total: documents.length,
      successCount,
      failureCount,
      results
    };
    
  } catch (error) {
    console.error(`[KG Hook] 批量文档钩子执行失败:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
  onBatchDocuments
};
