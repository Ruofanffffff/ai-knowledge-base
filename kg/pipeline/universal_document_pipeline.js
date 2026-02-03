/**
 * Universal Document Pipeline
 * 
 * 通用文档处理流水线 - 从文档输入到知识图谱生成的完整流程
 * 
 * 核心流程：
 * 1. 文档解析 (Document Parsing)
 * 2. 字段提取 (Field Extraction)
 * 3. Schema匹配 (Schema Matching)
 * 4. 字段标准化 (Field Normalization)
 * 5. 实体构建 (Entity Building)
 * 6. 关系抽取 (Relation Extraction)
 * 7. 知识图谱存储 (Knowledge Graph Storage)
 */

const ckbParser = require('../ckb/ckb_parser');
const fieldExtractor = require('../field_extractor/field_extractor');
const schemaManager = require('../schema/schema_manager');
const schemaMatcher = require('../schema/schema_matcher');
const fieldNormalizer = require('../field_normalizer/field_normalizer');
const MappingBasedNormalizer = require('../field_normalizer/mapping_based_normalizer');
const entityBuilder = require('../entity/entity_builder');
const builtinRelationBuilder = require('../relation/builtin_relation_builder');
const cooccurrenceRelationBuilder = require('../relation/cooccurrence_relation_builder');
const semanticRelationBuilder = require('../relation/semantic_relation_builder');
const entityStore = require('../entity/entity_store');
const relationStore = require('../relation/relation_store');
const tokenTracker = require('../utils/token_tracker');
const performanceMonitor = require('../utils/performance_monitor');
const DocumentClassifier = require('./document_classifier');

/**
 * Processing Context - 流水线处理上下文
 * 
 * 记录整个处理流程的状态、结果和指标。
 * 每个文档处理完成后会返回一个ProcessingContext实例。
 * 
 * @class
 * @property {string} documentId - 文档ID
 * @property {string} documentType - 文档类型
 * @property {number} startTime - 开始时间戳
 * @property {number} endTime - 结束时间戳
 * @property {number} totalDuration - 总耗时（毫秒）
 * @property {string} status - 处理状态: processing, completed, failed, partial
 * @property {Object} steps - 各步骤的执行状态
 * @property {Object} data - 流程数据（CKB、字段、实体、关系等）
 * @property {Object} metrics - 性能指标
 * @property {Array} errors - 错误列表
 * @property {Array} warnings - 警告列表
 */
class ProcessingContext {
  /**
   * 创建处理上下文
   * @param {string} documentId - 文档ID
   * @param {string} documentType - 文档类型
   */
  constructor(documentId, documentType) {
    this.documentId = documentId;
    this.documentType = documentType;
    this.startTime = Date.now();
    this.endTime = null;
    this.totalDuration = 0;
    this.status = 'processing'; // processing, completed, failed, partial
    
    // 各步骤的执行状态
    this.steps = {
      parsing: { status: 'not_started', duration: 0, result: null, error: null, metrics: {} },
      extraction: { status: 'not_started', duration: 0, result: null, error: null, metrics: {} },
      classification: { status: 'not_started', duration: 0, result: null, error: null, metrics: {} },
      schemaMatching: { status: 'not_started', duration: 0, result: null, error: null, metrics: {} },
      normalization: { status: 'not_started', duration: 0, result: null, error: null, metrics: {} },
      entityBuilding: { status: 'not_started', duration: 0, result: null, error: null, metrics: {} },
      relationExtraction: { status: 'not_started', duration: 0, result: null, error: null, metrics: {} },
      storage: { status: 'not_started', duration: 0, result: null, error: null, metrics: {} }
    };
    
    // 流程数据
    this.data = {
      ckb: null,
      extractedFields: [],
      matchedSchemas: [],
      normalizedFields: [],
      entities: [],
      relations: []
    };
    
    // 性能指标
    this.metrics = {
      fieldCount: 0,
      entityCount: 0,
      relationCount: 0,
      tokenUsage: 0,
      apiCalls: 0,
      confidenceScores: {}
    };
    
    // 错误和警告
    this.errors = [];
    this.warnings = [];
  }
  
  /**
   * 完成处理并计算最终指标
   * 
   * 在文档处理完成后调用，计算总耗时、吞吐量等指标，
   * 并根据错误和警告情况确定最终状态。
   */
  complete() {
    this.endTime = Date.now();
    this.totalDuration = this.endTime - this.startTime;
    
    // 判断最终状态
    const hasErrors = this.errors.length > 0;
    const hasWarnings = this.warnings.length > 0;
    
    if (hasErrors) {
      this.status = 'failed';
    } else if (hasWarnings) {
      this.status = 'partial';
    } else {
      this.status = 'completed';
    }
    
    // 计算吞吐量指标
    this._calculateThroughputMetrics();
  }
  
  /**
   * 计算吞吐量指标
   * @private
   */
  _calculateThroughputMetrics() {
    const durationInSeconds = this.totalDuration / 1000;
    
    if (durationInSeconds > 0) {
      // 文档处理速度（文档/秒）
      this.metrics.documentsPerSecond = 1 / durationInSeconds;
      
      // 字段提取速度（字段/秒）
      if (this.metrics.fieldCount > 0) {
        this.metrics.fieldsPerSecond = this.metrics.fieldCount / durationInSeconds;
      }
      
      // 实体构建速度（实体/秒）
      if (this.metrics.entityCount > 0) {
        this.metrics.entitiesPerSecond = this.metrics.entityCount / durationInSeconds;
      }
      
      // 关系提取速度（关系/秒）
      if (this.metrics.relationCount > 0) {
        this.metrics.relationsPerSecond = this.metrics.relationCount / durationInSeconds;
      }
    }
  }
  
  /**
   * 获取处理摘要
   * 
   * 返回包含处理状态、性能统计、步骤详情、数据指标等的完整摘要。
   * 包括瓶颈识别、吞吐量指标等高级分析。
   * 
   * @returns {Object} 处理摘要对象
   * @returns {string} return.documentId - 文档ID
   * @returns {string} return.status - 处理状态
   * @returns {number} return.totalDuration - 总耗时（毫秒）
   * @returns {string} return.slowestStep - 最慢的步骤（瓶颈）
   * @returns {number} return.slowestStepDuration - 最慢步骤的耗时
   * @returns {number} return.successfulSteps - 成功步骤数
   * @returns {number} return.failedSteps - 失败步骤数
   * @returns {Object} return.performance - 性能统计（吞吐量、瓶颈等）
   * @returns {Object} return.steps - 步骤详情
   * @returns {Object} return.metrics - 数据指标
   * @returns {number} return.errorCount - 错误数量
   * @returns {number} return.warningCount - 警告数量
   * @returns {Array} return.errors - 错误列表
   * @returns {Array} return.warnings - 警告列表
   */
  getSummary() {
    const successfulSteps = Object.keys(this.steps).filter(
      step => this.steps[step].status === 'success'
    );
    const failedSteps = Object.keys(this.steps).filter(
      step => this.steps[step].status === 'failure'
    );
    
    // 找出最慢的步骤（瓶颈）
    let slowestStep = null;
    let maxDuration = 0;
    Object.keys(this.steps).forEach(step => {
      if (this.steps[step].duration > maxDuration) {
        maxDuration = this.steps[step].duration;
        slowestStep = step;
      }
    });
    
    // 计算各步骤时间总和
    const stepDurationsSum = Object.values(this.steps)
      .reduce((sum, step) => sum + (step.duration || 0), 0);
    
    // 计算性能统计
    const performanceStats = {
      totalDuration: this.totalDuration,
      stepDurationsSum: stepDurationsSum,
      overhead: this.totalDuration - stepDurationsSum,
      overheadPercentage: this.totalDuration > 0 ? 
        ((this.totalDuration - stepDurationsSum) / this.totalDuration * 100).toFixed(2) + '%' : '0%',
      
      // 吞吐量指标
      throughput: {
        documentsPerSecond: this.metrics.documentsPerSecond || 0,
        fieldsPerSecond: this.metrics.fieldsPerSecond || 0,
        entitiesPerSecond: this.metrics.entitiesPerSecond || 0,
        relationsPerSecond: this.metrics.relationsPerSecond || 0
      },
      
      // 瓶颈识别
      bottleneck: {
        step: slowestStep,
        duration: maxDuration,
        percentage: this.totalDuration > 0 ? 
          (maxDuration / this.totalDuration * 100).toFixed(2) + '%' : '0%'
      }
    };
    
    // 步骤详情
    const stepDetails = {};
    Object.keys(this.steps).forEach(stepName => {
      const step = this.steps[stepName];
      if (step.status !== 'not_started') {
        stepDetails[stepName] = {
          status: step.status,
          duration: step.duration,
          percentage: this.totalDuration > 0 ? 
            (step.duration / this.totalDuration * 100).toFixed(2) + '%' : '0%',
          metrics: step.metrics
        };
      }
    });
    
    return {
      // 基本信息
      documentId: this.documentId,
      status: this.status,
      
      // 向后兼容的顶层字段
      totalDuration: this.totalDuration,
      slowestStep: slowestStep,
      slowestStepDuration: maxDuration,
      
      // 步骤统计
      successfulSteps: successfulSteps.length,
      failedSteps: failedSteps.length,
      totalSteps: successfulSteps.length + failedSteps.length,
      
      // 性能统计（详细）
      performance: performanceStats,
      
      // 步骤详情
      steps: stepDetails,
      
      // 数据指标
      metrics: this.metrics,
      
      // 错误和警告
      errorCount: this.errors.length,
      warningCount: this.warnings.length,
      errors: this.errors,
      warnings: this.warnings
    };
  }
}

/**
 * Pipeline Options - 流水线配置选项
 */
const DEFAULT_OPTIONS = {
  // 字段提取配置
  extraction: {
    useLLM: true,
    useNER: true,
    useRules: true,
    maxTokens: 4000
  },
  
  // Schema匹配配置
  schemaMatching: {
    useLLM: true,
    minConfidence: 0.5,
    fallbackToGeneric: true
  },
  
  // 字段标准化配置
  normalization: {
    useLLM: true,
    useAlgorithm: true,
    minConfidence: 0.6,
    maxRetries: 2
  },
  
  // 实体构建配置
  entityBuilding: {
    useLLM: true,
    allowPartialEntities: true,
    minFieldCoverage: 0.5
  },
  
  // 关系抽取配置
  relationExtraction: {
    enableBuiltin: true,
    enableCooccurrence: true,
    enableSemantic: true,
    semanticUseLLM: true,
    minConfidence: 0.5
  },
  
  // 存储配置
  storage: {
    useTransaction: true,
    skipDuplicates: true
  },
  
  // 错误处理配置
  errorHandling: {
    stopOnCriticalError: true,
    continueOnWarning: true
  }
};

/**
 * Batch Options - 批量处理配置
 */
const DEFAULT_BATCH_OPTIONS = {
  ...DEFAULT_OPTIONS,
  concurrency: 3,
  stopOnFirstError: false
};

/**
 * Step Executor - 步骤执行器
 * 统一处理每个步骤的执行、错误处理和指标记录
 */
class StepExecutor {
  /**
   * 执行单个步骤
   * @param {string} stepName - 步骤名称
   * @param {Function} stepFunction - 步骤执行函数
   * @param {ProcessingContext} context - 处理上下文
   * @param {boolean} isCritical - 是否为关键步骤
   * @returns {Promise<Object>} 步骤执行结果
   */
  static async executeStep(stepName, stepFunction, context, isCritical = false) {
    const startTime = Date.now();
    context.steps[stepName].status = 'in_progress';
    
    try {
      console.log(`[Pipeline] 开始执行步骤: ${stepName}`);
      
      // 执行步骤函数
      const result = await stepFunction();
      
      // 记录成功结果
      const duration = Date.now() - startTime;
      context.steps[stepName].status = 'success';
      context.steps[stepName].duration = duration;
      context.steps[stepName].result = result;
      
      console.log(`[Pipeline] 步骤完成: ${stepName} (${duration}ms)`);
      
      return { status: 'success', result, duration };
      
    } catch (error) {
      // 记录错误
      const duration = Date.now() - startTime;
      context.steps[stepName].status = 'failure';
      context.steps[stepName].duration = duration;
      context.steps[stepName].error = error.message;
      
      console.error(`[Pipeline] 步骤失败: ${stepName} - ${error.message}`);
      
      // 根据是否为关键步骤决定如何处理
      if (isCritical) {
        context.errors.push({
          step: stepName,
          error: error.message,
          timestamp: Date.now()
        });
        throw error; // 关键步骤失败，抛出错误终止流水线
      } else {
        context.warnings.push({
          step: stepName,
          error: error.message,
          timestamp: Date.now()
        });
        return { status: 'failure', error, duration };
      }
    }
  }
  
  /**
   * 记录步骤指标
   */
  static recordMetrics(stepName, metrics, context) {
    context.steps[stepName].metrics = metrics;
  }
}

/**
 * Batch Processor - 批量处理器
 * 管理多个文档的并发处理
 */
class BatchProcessor {
  /**
   * 并发处理文档
   * @param {Array<Object>} documents - 文档数组
   * @param {Object} options - 批量处理配置
   * @param {Function} processFn - 单文档处理函数
   * @returns {Promise<Array<ProcessingContext>>} 所有处理结果
   */
  static async processConcurrently(documents, options, processFn) {
    const concurrency = options.concurrency || 3;
    const stopOnFirstError = options.stopOnFirstError || false;
    
    console.log(`[BatchProcessor] 开始批量处理 ${documents.length} 个文档 (并发: ${concurrency})`);
    
    const results = [];
    const errors = [];
    
    // 创建并发控制的处理队列
    const queue = [...documents];
    const processing = new Set();
    
    // 处理单个文档的包装函数
    const processDocument = async (doc, index) => {
      try {
        console.log(`[BatchProcessor] 开始处理文档 ${index + 1}/${documents.length}: ${doc.id}`);
        const result = await processFn(doc);
        results[index] = result;
        
        // 记录处理状态
        if (result.status === 'failed') {
          errors.push({ index, documentId: doc.id, error: result.errors });
        }
        
        console.log(`[BatchProcessor] 完成文档 ${index + 1}/${documents.length}: ${doc.id} (状态: ${result.status})`);
        
        return result;
      } catch (error) {
        console.error(`[BatchProcessor] 文档处理异常 ${index + 1}/${documents.length}: ${doc.id}`, error);
        
        // 创建失败的上下文
        const failedContext = new ProcessingContext(doc.id, doc.type || 'unknown');
        failedContext.errors.push({
          step: 'batch_processing',
          error: error.message,
          timestamp: Date.now()
        });
        failedContext.complete();
        
        results[index] = failedContext;
        errors.push({ index, documentId: doc.id, error: error.message });
        
        return failedContext;
      }
    };
    
    // 并发控制循环
    let currentIndex = 0;
    
    while (currentIndex < documents.length || processing.size > 0) {
      // 填充处理队列直到达到并发限制
      while (processing.size < concurrency && currentIndex < documents.length) {
        const index = currentIndex;
        const doc = documents[index];
        
        const promise = processDocument(doc, index)
          .finally(() => {
            processing.delete(promise);
          });
        
        processing.add(promise);
        currentIndex++;
      }
      
      // 等待至少一个任务完成
      if (processing.size > 0) {
        await Promise.race(processing);
      }
      
      // 如果配置了遇到错误就停止
      if (stopOnFirstError && errors.length > 0) {
        console.log('[BatchProcessor] 检测到错误，停止批量处理');
        
        // 等待所有正在处理的任务完成
        if (processing.size > 0) {
          await Promise.all(processing);
        }
        
        break;
      }
    }
    
    // 确保所有结果都已填充（对于提前停止的情况）
    for (let i = 0; i < documents.length; i++) {
      if (!results[i]) {
        const doc = documents[i];
        const skippedContext = new ProcessingContext(doc.id, doc.type || 'unknown');
        skippedContext.warnings.push({
          step: 'batch_processing',
          error: '由于前面的错误，此文档被跳过',
          timestamp: Date.now()
        });
        skippedContext.status = 'skipped';
        skippedContext.complete();
        results[i] = skippedContext;
      }
    }
    
    console.log(`[BatchProcessor] 批量处理完成: ${results.length} 个文档, ${errors.length} 个错误`);
    
    return results;
  }
}

/**
 * Universal Document Pipeline - 通用文档处理流水线
 * 
 * 提供端到端的文档处理能力，从文档输入到知识图谱生成的完整流程。
 * 支持多种文档格式、灵活配置、错误处理和批量处理。
 */
class UniversalDocumentPipeline {
  /**
   * 创建流水线实例
   * 
   * @param {Object} [options={}] - 流水线配置选项
   * @param {Object} [options.extraction] - 字段提取配置
   * @param {boolean} [options.extraction.useLLM=true] - 是否使用LLM进行字段提取
   * @param {boolean} [options.extraction.useNER=true] - 是否使用NER进行字段提取
   * @param {boolean} [options.extraction.useRules=true] - 是否使用规则进行字段提取
   * @param {number} [options.extraction.maxTokens=4000] - LLM提取的最大token数
   * @param {Object} [options.schemaMatching] - Schema匹配配置
   * @param {boolean} [options.schemaMatching.useLLM=true] - 是否使用LLM进行Schema匹配
   * @param {number} [options.schemaMatching.minConfidence=0.5] - Schema匹配的最小置信度阈值
   * @param {boolean} [options.schemaMatching.fallbackToGeneric=true] - 未匹配时是否降级到通用Schema
   * @param {Object} [options.normalization] - 字段标准化配置
   * @param {boolean} [options.normalization.useLLM=true] - 是否使用LLM进行字段标准化
   * @param {boolean} [options.normalization.useAlgorithm=true] - 是否使用算法进行字段标准化
   * @param {number} [options.normalization.minConfidence=0.6] - 字段映射的最小置信度阈值
   * @param {number} [options.normalization.maxRetries=2] - 字段映射的最大重试次数
   * @param {Object} [options.entityBuilding] - 实体构建配置
   * @param {boolean} [options.entityBuilding.useLLM=true] - 是否使用LLM进行实体构建
   * @param {boolean} [options.entityBuilding.allowPartialEntities=true] - 是否允许构建部分实体
   * @param {number} [options.entityBuilding.minFieldCoverage=0.5] - 实体的最小字段覆盖率
   * @param {Object} [options.relationExtraction] - 关系抽取配置
   * @param {boolean} [options.relationExtraction.enableBuiltin=true] - 是否启用内置规则关系
   * @param {boolean} [options.relationExtraction.enableCooccurrence=true] - 是否启用共现关系
   * @param {boolean} [options.relationExtraction.enableSemantic=true] - 是否启用语义关系
   * @param {boolean} [options.relationExtraction.semanticUseLLM=true] - 语义关系是否使用LLM
   * @param {number} [options.relationExtraction.minConfidence=0.5] - 关系的最小置信度阈值
   * @param {Object} [options.storage] - 存储配置
   * @param {boolean} [options.storage.useTransaction=true] - 是否使用事务存储
   * @param {boolean} [options.storage.skipDuplicates=true] - 是否跳过重复数据
   * @param {Object} [options.errorHandling] - 错误处理配置
   * @param {boolean} [options.errorHandling.stopOnCriticalError=true] - 关键错误时是否停止
   * @param {boolean} [options.errorHandling.continueOnWarning=true] - 警告时是否继续
   * 
   * @example
   * // 使用默认配置
   * const pipeline = new UniversalDocumentPipeline();
   * 
   * @example
   * // 自定义配置（禁用LLM以节省成本）
   * const pipeline = new UniversalDocumentPipeline({
   *   extraction: { useLLM: false },
   *   normalization: { useLLM: false },
   *   entityBuilding: { useLLM: false },
   *   relationExtraction: { enableSemantic: false }
   * });
   */
  constructor(options = {}) {
    this.options = this._mergeOptions(DEFAULT_OPTIONS, options);
    
    // 支持的文档格式
    this.SUPPORTED_FORMATS = ['text', 'pdf', 'word', 'excel', 'markdown', 'html'];
    
    // 文档大小限制 (默认 50MB)
    this.MAX_DOCUMENT_SIZE = 50 * 1024 * 1024;
    
    // 文档分类器
    this.documentClassifier = new DocumentClassifier();
    
    // 映射表归一化器（用于性能优化）
    this.mappingBasedNormalizer = new MappingBasedNormalizer();
  }
  
  /**
   * 合并配置选项
   */
  _mergeOptions(defaults, custom) {
    const merged = { ...defaults };
    
    for (const key in custom) {
      if (typeof custom[key] === 'object' && !Array.isArray(custom[key]) && custom[key] !== null) {
        // 如果defaults中没有这个key，使用空对象作为默认值
        merged[key] = { ...(defaults[key] || {}), ...custom[key] };
      } else {
        merged[key] = custom[key];
      }
    }
    
    return merged;
  }
  
  /**
   * 验证文档格式和大小
   * @param {Object} document - 文档对象
   * @returns {Object} 验证结果 { valid: boolean, error: string }
   */
  _validateDocument(document) {
    // 检查文档对象是否存在
    if (!document) {
      return {
        valid: false,
        error: '文档对象不能为空'
      };
    }
    
    // 检查文档内容
    if (!document.content && !document.text) {
      return {
        valid: false,
        error: '文档内容不能为空'
      };
    }
    
    // 检查文档格式
    const docType = (document.type || 'text').trim(); // 去除空格
    if (!this.SUPPORTED_FORMATS.includes(docType.toLowerCase())) {
      return {
        valid: false,
        error: `不支持的文档格式: ${docType}。支持的格式: ${this.SUPPORTED_FORMATS.join(', ')}`
      };
    }
    
    // 检查文档大小
    const content = document.content || document.text || '';
    const size = typeof content === 'string' 
      ? Buffer.byteLength(content, 'utf8')
      : content.length;
      
    if (size > this.MAX_DOCUMENT_SIZE) {
      return {
        valid: false,
        error: `文档大小超过限制: ${(size / 1024 / 1024).toFixed(2)}MB > ${(this.MAX_DOCUMENT_SIZE / 1024 / 1024).toFixed(2)}MB`
      };
    }
    
    return { valid: true };
  }
  
  /**
   * 处理单个文档
   * 
   * 将文档通过完整的流水线处理，从解析到知识图谱存储。
   * 
   * @param {Object} document - 文档对象
   * @param {string} document.id - 文档唯一标识符
   * @param {string} document.type - 文档类型 (text, pdf, word, excel, markdown, html)
   * @param {string} document.content - 文档内容
   * @param {string} [document.title] - 文档标题（可选）
   * @param {Object} [document.metadata] - 文档元数据（可选）
   * @param {Object} [options] - 可选的配置覆盖，会与构造函数配置合并
   * @param {Object} [options.extraction] - 字段提取配置
   * @param {boolean} [options.extraction.useLLM] - 是否使用LLM提取
   * @param {Object} [options.normalization] - 字段标准化配置
   * @param {Object} [options.entityBuilding] - 实体构建配置
   * @param {Object} [options.relationExtraction] - 关系抽取配置
   * @returns {Promise<ProcessingContext>} 处理上下文，包含所有步骤的结果和指标
   * 
   * @example
   * const pipeline = new UniversalDocumentPipeline();
   * const document = {
   *   id: 'doc-001',
   *   type: 'text',
   *   title: '招标文件',
   *   content: '项目名称：某市政道路改造工程...'
   * };
   * const context = await pipeline.processDocument(document);
   * console.log('状态:', context.status);
   * console.log('提取字段:', context.metrics.fieldCount);
   * 
   * @throws {Error} 当文档验证失败或关键步骤失败时抛出错误
   */
  async processDocument(document, options = {}) {
    // 合并配置
    const finalOptions = this._mergeOptions(this.options, options);
    
    // 创建处理上下文
    const context = new ProcessingContext(
      document.id || `doc_${Date.now()}`,
      document.type || 'text'
    );
    
    console.log(`[Pipeline] 开始处理文档: ${context.documentId}`);
    
    try {
      // 步骤0: 文档验证
      const validation = this._validateDocument(document);
      if (!validation.valid) {
        throw new Error(`文档验证失败: ${validation.error}`);
      }
      
      console.log('[Pipeline] 文档验证通过');
      
      // 步骤1: 文档解析 (关键步骤)
      await StepExecutor.executeStep(
        'parsing',
        async () => await this._parseDocument(document, context, finalOptions),
        context,
        true // 关键步骤
      );
      
      // 步骤2: 字段提取 (关键步骤)
      await StepExecutor.executeStep(
        'extraction',
        async () => await this._extractFields(context, finalOptions),
        context,
        true
      );
      
      // 步骤3: Schema匹配 (关键步骤)
      await StepExecutor.executeStep(
        'schemaMatching',
        async () => await this._matchSchema(context, finalOptions),
        context,
        true
      );
      
      // 步骤4: 字段标准化 (非关键步骤)
      await StepExecutor.executeStep(
        'normalization',
        async () => await this._normalizeFields(context, finalOptions),
        context,
        false
      );
      
      // 步骤5: 实体构建 (非关键步骤)
      await StepExecutor.executeStep(
        'entityBuilding',
        async () => await this._buildEntities(context, finalOptions),
        context,
        false
      );
      
      // 步骤6: 关系抽取 (非关键步骤)
      await StepExecutor.executeStep(
        'relationExtraction',
        async () => await this._extractRelations(context, finalOptions),
        context,
        false
      );
      
      // 步骤7: 知识图谱存储 (关键步骤)
      if (context.data.entities.length > 0) {
        await StepExecutor.executeStep(
          'storage',
          async () => await this._storeToKnowledgeGraph(context, finalOptions),
          context,
          true
        );
      } else {
        console.log('[Pipeline] 没有实体需要存储，跳过存储步骤');
      }
      
      console.log('[Pipeline] 流水线处理完成');
      
    } catch (error) {
      console.error(`[Pipeline] 文档处理失败: ${error.message}`);
      if (!context.errors.some(e => e.error === error.message)) {
        context.errors.push({
          step: 'pipeline',
          error: error.message,
          timestamp: Date.now()
        });
      }
    } finally {
      context.complete();
    }
    
    return context;
  }
  
  /**
   * 步骤1: 解析文档
   */
  async _parseDocument(document, context, options) {
    const content = document.content || document.text || '';
    const title = document.title || document.filename || `Document ${context.documentId}`;
    
    // 创建CKB对象
    const ckb = {
      ckb_id: `ckb_${context.documentId}_${Date.now()}`,
      doc_id: context.documentId,
      content: {
        text: content,
        title: title
      },
      quality: {
        source_confidence: 0.9
      },
      metadata: document.metadata || {}
    };
    
    context.data.ckb = ckb;
    
    // 解析步骤不使用LLM，所以token使用为0
    StepExecutor.recordMetrics('parsing', {
      tokenUsage: 0,
      apiCalls: 0
    }, context);
    
    return ckb;
  }
  
  /**
   * 步骤2: 提取字段
   */
  async _extractFields(context, options) {
    const extractionOptions = {
      useLLM: options.extraction.useLLM,
      useNER: options.extraction.useNER,
      useRules: options.extraction.useRules,
      maxTokens: options.extraction.maxTokens,
      forceLLM: options.extraction.forceLLM || false  // 新增：强制使用LLM
    };
    
    try {
      // 记录开始时的token使用情况
      const tokenStatsBefore = tokenTracker.getTokenStats();
      const apiCallsBefore = tokenStatsBefore.total_records || 0;
      const tokensBefore = tokenStatsBefore.total_tokens || 0;
      
      const fields = await fieldExtractor.extractFields(context.data.ckb, extractionOptions);
      
      // 记录结束时的token使用情况
      const tokenStatsAfter = tokenTracker.getTokenStats();
      const apiCallsAfter = tokenStatsAfter.total_records || 0;
      const tokensAfter = tokenStatsAfter.total_tokens || 0;
      
      // 计算此步骤的token使用
      const stepTokenUsage = tokensAfter - tokensBefore;
      const stepApiCalls = apiCallsAfter - apiCallsBefore;
      
      // 更新context中的token使用统计
      context.metrics.tokenUsage += stepTokenUsage;
      context.metrics.apiCalls += stepApiCalls;
      
      context.data.extractedFields = fields;
      context.metrics.fieldCount = fields.length;
      
      // 检查提取的字段数量
      const minFieldCount = 3; // 最少期望字段数
      if (fields.length < minFieldCount) {
        console.warn(`[Pipeline] 字段提取数量较少: ${fields.length} < ${minFieldCount}`);
        context.warnings.push({
          step: 'extraction',
          error: `提取的字段数量较少 (${fields.length}个)，可能影响后续处理质量`,
          timestamp: Date.now()
        });
      }
      
      StepExecutor.recordMetrics('extraction', {
        fieldCount: fields.length,
        usedLLM: extractionOptions.useLLM,
        belowThreshold: fields.length < minFieldCount,
        tokenUsage: stepTokenUsage || 0,
        apiCalls: stepApiCalls || 0
      }, context);
      
      return fields;
    } catch (error) {
      // 如果提取完全失败，尝试降级处理
      console.warn(`[Pipeline] 字段提取失败，尝试降级处理: ${error.message}`);
      
      // 尝试只使用Rule和NER(禁用LLM)
      if (extractionOptions.useLLM) {
        try {
          // 记录降级前的token使用情况
          const tokenStatsBefore = tokenTracker.getTokenStats();
          const apiCallsBefore = tokenStatsBefore.total_records || 0;
          const tokensBefore = tokenStatsBefore.total_tokens || 0;
          
          const fallbackOptions = {
            ...extractionOptions,
            useLLM: false
          };
          
          const fields = await fieldExtractor.extractFields(context.data.ckb, fallbackOptions);
          
          // 记录降级后的token使用情况
          const tokenStatsAfter = tokenTracker.getTokenStats();
          const apiCallsAfter = tokenStatsAfter.total_records || 0;
          const tokensAfter = tokenStatsAfter.total_tokens || 0;
          
          // 计算此步骤的token使用
          const stepTokenUsage = tokensAfter - tokensBefore;
          const stepApiCalls = apiCallsAfter - apiCallsBefore;
          
          // 更新context中的token使用统计
          context.metrics.tokenUsage += stepTokenUsage;
          context.metrics.apiCalls += stepApiCalls;
          
          context.data.extractedFields = fields;
          context.metrics.fieldCount = fields.length;
          
          context.warnings.push({
            step: 'extraction',
            error: `LLM提取失败，已降级到Rule+NER提取 (${fields.length}个字段)`,
            timestamp: Date.now()
          });
          
          StepExecutor.recordMetrics('extraction', {
            fieldCount: fields.length,
            usedLLM: false,
            fallbackUsed: true,
            tokenUsage: stepTokenUsage || 0,
            apiCalls: stepApiCalls || 0
          }, context);
          
          return fields;
        } catch (fallbackError) {
          console.error(`[Pipeline] 降级提取也失败: ${fallbackError.message}`);
          throw error; // 抛出原始错误
        }
      } else {
        throw error;
      }
    }
  }
  
  /**
   * 带缓存的字段归一化
   * 
   * @param {Array} extractedFields - 提取的字段
   * @param {Object} schema - 目标Schema
   * @param {Map} cache - 归一化缓存
   * @param {Object} options - 归一化选项
   * @returns {Array} 归一化后的字段
   */
  async _normalizeFieldsWithCache(extractedFields, schema, cache, options) {
    const schemaName = schema.schema_name || schema.name;
    const normalizedFields = [];
    
    // 确保映射表已加载
    if (!this.mappingBasedNormalizer.mappings) {
      await this.mappingBasedNormalizer.loadMappings();
    }
    
    const schemaMapping = this.mappingBasedNormalizer.mappings[schemaName];
    if (!schemaMapping) {
      return normalizedFields;  // 没有映射表，返回空数组
    }
    
    for (const field of extractedFields) {
      // 生成缓存键: fieldName_fieldValue_schemaName
      const cacheKey = `${field.name}_${field.value}_${schemaName}`;
      
      // 检查缓存
      if (cache.has(cacheKey)) {
        normalizedFields.push(cache.get(cacheKey));
        continue;
      }
      
      // 使用mapping_based_normalizer的算法映射
      const mappedField = this.mappingBasedNormalizer._algorithmMap(field, schemaMapping);
      if (mappedField) {
        cache.set(cacheKey, mappedField);
        normalizedFields.push(mappedField);
      }
    }
    
    return normalizedFields;
  }
  
  /**
   * 步骤3: 匹配Schema（改进版：先分类预筛选，再归一化匹配）
   */
  async _matchSchema(context, options) {
    // 记录开始时的token使用情况
    const tokenStatsBefore = tokenTracker.getTokenStats();
    const apiCallsBefore = tokenStatsBefore.total_records || 0;
    const tokensBefore = tokenStatsBefore.total_tokens || 0;
    
    // 步骤3.1: 文档分类 - 基于提取的字段识别文档类型
    console.log('[Pipeline] 步骤3.1: 文档分类...');
    const classificationResult = this.documentClassifier.classify(context.data.extractedFields, {
      topN: 3,
      minConfidence: 0.1
    });
    
    console.log(
      `[Pipeline] 文档分类结果: ${classificationResult.primaryDomain} ` +
      `(置信度: ${(classificationResult.confidence * 100).toFixed(1)}%)`
    );
    
    if (classificationResult.allDomains.length > 1) {
      console.log('[Pipeline] 其他可能的领域:');
      classificationResult.allDomains.slice(1).forEach(d => {
        console.log(`  - ${d.domain}: ${(d.confidence * 100).toFixed(1)}%`);
      });
    }
    
    // 步骤3.2: Schema预筛选 - 根据文档类型筛选相关Schema
    console.log('[Pipeline] 步骤3.2: Schema预筛选...');
    const allSchemas = await schemaManager.listSchemas({ take: 1000 });  // 获取所有Schema
    
    // 获取主要领域和次要领域对应的场景和实体类型
    const relevantScenes = new Set();
    const relevantEntityTypes = new Set();
    
    classificationResult.allDomains.forEach(domainInfo => {
      const scenes = this.documentClassifier.getDomainScenes(domainInfo.domain);
      const entityTypes = this.documentClassifier.getDomainEntityTypes(domainInfo.domain);
      
      scenes.forEach(s => relevantScenes.add(s));
      entityTypes.forEach(et => relevantEntityTypes.add(et));
    });
    
    // 筛选相关的Schema
    const schemas = allSchemas.filter(schema => {
      const schemaScene = schema.scene || '';
      const schemaEntityType = schema.entity_type || '';
      
      // 检查场景匹配
      const sceneMatch = Array.from(relevantScenes).some(scene => 
        schemaScene.includes(scene) || scene.includes(schemaScene)
      );
      
      // 检查实体类型匹配
      const entityTypeMatch = relevantEntityTypes.has(schemaEntityType);
      
      // 如果是general领域，接受所有Schema
      const isGeneralDomain = classificationResult.primaryDomain === 'general';
      
      return isGeneralDomain || sceneMatch || entityTypeMatch;
    });
    
    console.log(
      `[Pipeline] Schema预筛选完成: ${schemas.length}/${allSchemas.length} 个Schema ` +
      `(过滤掉 ${allSchemas.length - schemas.length} 个不相关Schema)`
    );
    
    // 如果预筛选后Schema数量过少，添加警告但继续处理
    if (schemas.length === 0) {
      console.warn('[Pipeline] 警告: 预筛选后没有匹配的Schema，将使用所有Schema');
      context.warnings.push({
        step: 'schemaMatching',
        error: `文档分类为 ${classificationResult.primaryDomain}，但未找到匹配的Schema`,
        timestamp: Date.now()
      });
      schemas.push(...allSchemas);
    } else if (schemas.length < 5) {
      console.log(`[Pipeline] 提示: 预筛选后Schema数量较少 (${schemas.length}个)，可能需要扩展Schema库`);
    }
    
    // 记录分类和预筛选指标
    StepExecutor.recordMetrics('classification', {
      primaryDomain: classificationResult.primaryDomain,
      confidence: classificationResult.confidence,
      allDomains: classificationResult.allDomains,
      totalSchemas: allSchemas.length,
      filteredSchemas: schemas.length,
      filterRate: allSchemas.length > 0 ? (allSchemas.length - schemas.length) / allSchemas.length : 0
    }, context);
    
    console.log(`[Pipeline] 步骤3.3: 开始Schema匹配，共${schemas.length}个候选Schema`);
    
    // 优化1: 预加载映射表（避免重复加载）
    await this.mappingBasedNormalizer.loadMappings();
    console.log(`[Pipeline] 已预加载 ${Object.keys(this.mappingBasedNormalizer.mappings).length} 个Schema的映射表`);
    
    // 优化2: 创建字段归一化缓存
    const normalizationCache = new Map();
    
    // 优化3: 按相关度排序Schema（优先处理最可能匹配的）
    const sortedSchemas = schemas.sort((a, b) => {
      // 优先处理与主要领域完全匹配的Schema
      const aDomainMatch = a.scene === classificationResult.primaryDomain || 
                          a.entity_type?.includes(classificationResult.primaryDomain);
      const bDomainMatch = b.scene === classificationResult.primaryDomain || 
                          b.entity_type?.includes(classificationResult.primaryDomain);
      if (aDomainMatch && !bDomainMatch) return -1;
      if (!aDomainMatch && bDomainMatch) return 1;
      
      // 其次按核心字段数量排序（字段多的更可能匹配）
      const aFieldCount = (a.core_fields || []).length;
      const bFieldCount = (b.core_fields || []).length;
      return bFieldCount - aFieldCount;
    });
    
    // 优化4: 并行处理Schema匹配（批量处理，避免过载）
    const schemaMatchResults = [];
    const BATCH_SIZE = 10;  // 每批处理10个Schema
    const HIGH_QUALITY_THRESHOLD = 0.85;  // 高质量匹配阈值
    let foundHighQualityMatch = false;
    
    for (let i = 0; i < sortedSchemas.length; i += BATCH_SIZE) {
      // 优化5: 提前终止 - 如果已找到高质量匹配，只处理当前批次
      if (foundHighQualityMatch && i > 0) {
        console.log(`[Pipeline] 已找到高质量匹配，跳过剩余 ${sortedSchemas.length - i} 个Schema`);
        break;
      }
      
      const batch = sortedSchemas.slice(i, i + BATCH_SIZE);
      
      // 并行处理当前批次
      const batchResults = await Promise.all(
        batch.map(async (schema) => {
          try {
            // 尝试将提取的字段归一化到当前Schema
            const normalizedFields = await this._normalizeFieldsWithCache(
              context.data.extractedFields,
              schema,
              normalizationCache,
              {
                useLLM: options.normalization.useLLM,
                useAlgorithm: options.normalization.useAlgorithm,
                cleanValues: true,
                useCache: true
              }
            );
            
            // 计算匹配度：成功映射的核心字段数量 / 总核心字段数量
            const coreFields = schema.core_fields || [];
            const mappedCoreFieldNames = new Set(
              normalizedFields
                .filter(f => f.mappingMethod && f.mappingMethod !== 'none')  // 只计算成功映射的字段
                .map(f => f.standardName)  // 使用 standardName 而不是 name
            );
            
            const mappedCoreFieldCount = coreFields.filter(cf => 
              mappedCoreFieldNames.has(cf.name)
            ).length;
            
            const completeness = coreFields.length > 0 ? 
              mappedCoreFieldCount / coreFields.length : 0;
            
            // 计算加权完整度（考虑字段权重）
            let weightedCompleteness = 0;
            if (coreFields.length > 0) {
              const totalWeight = coreFields.reduce((sum, cf) => sum + (cf.weight || 0), 0);
              const mappedWeight = coreFields
                .filter(cf => mappedCoreFieldNames.has(cf.name))
                .reduce((sum, cf) => sum + (cf.weight || 0), 0);
              weightedCompleteness = totalWeight > 0 ? mappedWeight / totalWeight : 0;
            }
            
            const result = {
              schema: schema,
              schema_name: schema.schema_name || schema.name,
              completeness: completeness,
              weightedCompleteness: weightedCompleteness,
              mappedFields: mappedCoreFieldCount,
              totalFields: coreFields.length,
              normalizedFields: normalizedFields,
              threshold: schema.threshold || 0.6
            };
            
            console.log(
              `[Pipeline] Schema "${schema.schema_name || schema.name}": ` +
              `完整度 ${(completeness * 100).toFixed(1)}%, ` +
              `加权完整度 ${(weightedCompleteness * 100).toFixed(1)}%, ` +
              `映射字段 ${mappedCoreFieldCount}/${coreFields.length}`
            );
            
            return result;
            
          } catch (error) {
            console.warn(`[Pipeline] Schema "${schema.schema_name || schema.name}" 归一化失败: ${error.message}`);
            return null;
          }
        })
      );
      
      // 过滤掉失败的结果并添加到总结果中
      const validResults = batchResults.filter(r => r !== null);
      schemaMatchResults.push(...validResults);
      
      // 检查是否有高质量匹配
      const hasHighQuality = validResults.some(r => r.weightedCompleteness >= HIGH_QUALITY_THRESHOLD);
      if (hasHighQuality) {
        foundHighQualityMatch = true;
        console.log(`[Pipeline] 发现高质量匹配 (>=${(HIGH_QUALITY_THRESHOLD * 100).toFixed(0)}%)，将在当前批次后停止`);
      }
    }
    
    console.log(`[Pipeline] 缓存命中统计: ${normalizationCache.size} 个字段被缓存`);
    normalizationCache.clear();  // 清理缓存
    
    // 按加权完整度排序
    schemaMatchResults.sort((a, b) => b.weightedCompleteness - a.weightedCompleteness);
    
    // 获取触发的Schema（完整度达到阈值）
    const triggeredSchemas = schemaMatchResults.filter(result => 
      result.weightedCompleteness >= result.threshold
    );
    
    console.log(
      `[Pipeline] Schema匹配完成: ${triggeredSchemas.length}/${schemas.length} 个Schema达到阈值`
    );
    
    // 记录结束时的token使用情况
    const tokenStatsAfter = tokenTracker.getTokenStats();
    const apiCallsAfter = tokenStatsAfter.total_records || 0;
    const tokensAfter = tokenStatsAfter.total_tokens || 0;
    
    // 计算此步骤的token使用
    const stepTokenUsage = tokensAfter - tokensBefore;
    const stepApiCalls = apiCallsAfter - apiCallsBefore;
    
    // 更新context中的token使用统计
    context.metrics.tokenUsage += stepTokenUsage;
    context.metrics.apiCalls += stepApiCalls;
    
    // 如果没有触发的Schema且允许降级，使用通用Schema
    if (triggeredSchemas.length === 0 && options.schemaMatching.fallbackToGeneric) {
      console.log('[Pipeline] 未找到匹配的Schema，使用通用Schema');
      
      // 输出最接近的Schema信息
      if (schemaMatchResults.length > 0) {
        const closest = schemaMatchResults[0];
        console.log(
          `[Pipeline] 最接近的Schema: "${closest.schema_name}", ` +
          `完整度 ${(closest.weightedCompleteness * 100).toFixed(1)}%, ` +
          `阈值 ${(closest.threshold * 100).toFixed(1)}%, ` +
          `差距 ${((closest.threshold - closest.weightedCompleteness) * 100).toFixed(1)}%`
        );
      }
      
      context.warnings.push({
        step: 'schemaMatching',
        error: '未找到匹配的Schema，使用通用Schema',
        timestamp: Date.now()
      });
      
      // 创建通用Schema（兼容field_normalizer）
      // 从提取的字段中选择前20个作为核心字段
      const topFields = context.data.extractedFields.slice(0, 20);
      
      const genericSchema = {
        schema_name: 'Generic',
        entity_type: 'Generic',
        description: '通用Schema，用于处理未匹配到特定Schema的文档',
        core_fields: topFields.map((f, index) => ({
          name: f.name || `field_${index}`,
          weight: 0.05,  // 均匀权重
          required: false,
          field_type: f.type || 'string',
          description: `提取的字段: ${f.name || `field_${index}`}`
        })),
        fields: context.data.extractedFields.map((f, index) => ({
          field_name: f.name || `field_${index}`,
          field_type: f.type || 'string',
          required: false
        }))
      };
      
      context.data.matchedSchemas = [{
        schema: genericSchema,
        completeness: 1.0,
        weightedCompleteness: 1.0,
        schema_name: 'Generic',
        normalizedFields: context.data.extractedFields  // 通用Schema不需要归一化
      }];
    } else {
      context.data.matchedSchemas = triggeredSchemas;
    }
    
    StepExecutor.recordMetrics('schemaMatching', {
      totalSchemas: schemas.length,
      triggeredSchemas: context.data.matchedSchemas.length,
      avgCompleteness: context.data.matchedSchemas.reduce((sum, s) => sum + s.weightedCompleteness, 0) / 
                       (context.data.matchedSchemas.length || 1),
      bestMatch: schemaMatchResults.length > 0 ? {
        name: schemaMatchResults[0].schema_name,
        completeness: schemaMatchResults[0].weightedCompleteness
      } : null,
      tokenUsage: stepTokenUsage || 0,
      apiCalls: stepApiCalls || 0
    }, context);
    
    return context.data.matchedSchemas;
  }
  
  /**
   * 步骤4: 标准化字段（已在Schema匹配中完成，这里只是整理结果）
   */
  async _normalizeFields(context, options) {
    // 归一化已经在Schema匹配步骤中完成
    // 这里只需要整理结果并记录指标
    
    const allNormalizedFields = [];
    const schemaMetrics = [];
    
    for (const schemaMatch of context.data.matchedSchemas) {
      // 使用Schema匹配步骤中已经归一化的字段
      const normalizedFields = schemaMatch.normalizedFields || [];
      
      // 计算映射成功率
      const schema = schemaMatch.schema;
      const expectedFieldCount = schema.core_fields ? schema.core_fields.length : 
                                 (schema.fields ? schema.fields.length : 0);
      const mappedFieldCount = normalizedFields.filter(f => f.mapping_method !== 'none').length;
      const successRate = expectedFieldCount > 0 ? 
                         (mappedFieldCount / expectedFieldCount) : 1.0;
      
      // 记录schema级别的指标
      const schemaMetric = {
        schemaName: schemaMatch.schema_name,
        expectedFields: expectedFieldCount,
        mappedFields: mappedFieldCount,
        successRate: successRate,
        failedFields: []
      };
      
      // 识别未映射的字段
      if (schema.core_fields) {
        const mappedFieldNames = new Set(
          normalizedFields
            .filter(f => f.mapping_method !== 'none')
            .map(f => f.name)
        );
        const unmappedFields = schema.core_fields
          .filter(cf => !mappedFieldNames.has(cf.name))
          .map(cf => cf.name);
        
        schemaMetric.failedFields = unmappedFields;
        
        // 如果有未映射的字段，记录详细信息（但不是警告，因为已经在匹配步骤中处理）
        if (unmappedFields.length > 0) {
          console.log(
            `[Pipeline] Schema "${schemaMatch.schema_name}" 字段映射统计: ` +
            `${mappedFieldCount}/${expectedFieldCount} 字段成功映射 (${(successRate * 100).toFixed(1)}%)`
          );
        }
      }
      
      schemaMetrics.push(schemaMetric);
      
      allNormalizedFields.push({
        schema: schemaMatch.schema,
        fields: normalizedFields,
        successRate: successRate
      });
    }
    
    context.data.normalizedFields = allNormalizedFields;
    
    // 计算总体指标
    const totalExpectedFields = schemaMetrics.reduce((sum, m) => sum + m.expectedFields, 0);
    const totalMappedFields = schemaMetrics.reduce((sum, m) => sum + m.mappedFields, 0);
    const overallSuccessRate = totalExpectedFields > 0 ? 
                               (totalMappedFields / totalExpectedFields) : 1.0;
    
    StepExecutor.recordMetrics('normalization', {
      schemasProcessed: allNormalizedFields.length,
      totalNormalizedFields: allNormalizedFields.reduce((sum, nf) => sum + nf.fields.length, 0),
      overallSuccessRate: overallSuccessRate,
      schemaMetrics: schemaMetrics,
      tokenUsage: 0,  // Token已在Schema匹配步骤中计算
      apiCalls: 0
    }, context);
    
    return allNormalizedFields;
  }
  
  /**
   * 步骤5: 构建实体
   */
  async _buildEntities(context, options) {
    const buildingOptions = {
      useLLM: options.entityBuilding.useLLM,
      llmProbability: options.entityBuilding.useLLM ? 0.3 : 0,
      allowPartialEntities: options.entityBuilding.allowPartialEntities
    };
    
    // 记录开始时的token使用情况
    const tokenStatsBefore = tokenTracker.getTokenStats();
    const apiCallsBefore = tokenStatsBefore.total_records || 0;
    const tokensBefore = tokenStatsBefore.total_tokens || 0;
    
    const entities = [];
    const buildingMetrics = [];
    
    for (const normalizedFieldSet of context.data.normalizedFields) {
      try {
        const schemaMatch = context.data.matchedSchemas.find(
          sm => sm.schema.schema_name === normalizedFieldSet.schema.schema_name
        );
        
        const entity = await entityBuilder.buildEntity(
          schemaMatch,
          normalizedFieldSet.fields,
          context.data.ckb,
          buildingOptions
        );
        
        // 计算字段覆盖率
        const schema = schemaMatch.schema;
        const expectedFieldCount = schema.core_fields ? schema.core_fields.length : 
                                   (schema.fields ? schema.fields.length : 0);
        const actualFieldCount = normalizedFieldSet.fields.length;
        const fieldCoverage = expectedFieldCount > 0 ? 
                             (actualFieldCount / expectedFieldCount) : 1.0;
        
        // 记录实体构建指标
        const entityMetric = {
          schemaName: schemaMatch.schema_name,
          entityId: entity.entity_id,
          confidence: entity.confidence,
          fieldCoverage: fieldCoverage,
          expectedFields: expectedFieldCount,
          actualFields: actualFieldCount,
          isPartial: fieldCoverage < 1.0
        };
        
        // 如果是部分实体，记录警告
        if (fieldCoverage < 1.0 && fieldCoverage >= options.entityBuilding.minFieldCoverage) {
          console.warn(
            `[Pipeline] 构建部分实体 (${schemaMatch.schema_name}): ` +
            `字段覆盖率 ${(fieldCoverage * 100).toFixed(1)}% (${actualFieldCount}/${expectedFieldCount})`
          );
          context.warnings.push({
            step: 'entityBuilding',
            error: `Schema ${schemaMatch.schema_name}: 部分实体构建 - ` +
                   `字段覆盖率 ${(fieldCoverage * 100).toFixed(1)}% (${actualFieldCount}/${expectedFieldCount})`,
            timestamp: Date.now()
          });
        } else if (fieldCoverage < options.entityBuilding.minFieldCoverage) {
          console.warn(
            `[Pipeline] 实体字段覆盖率过低 (${schemaMatch.schema_name}): ` +
            `${(fieldCoverage * 100).toFixed(1)}% < ${(options.entityBuilding.minFieldCoverage * 100).toFixed(1)}%`
          );
          context.warnings.push({
            step: 'entityBuilding',
            error: `Schema ${schemaMatch.schema_name}: 字段覆盖率过低 - ` +
                   `${(fieldCoverage * 100).toFixed(1)}% (最低要求: ${(options.entityBuilding.minFieldCoverage * 100).toFixed(1)}%)`,
            timestamp: Date.now()
          });
        }
        
        buildingMetrics.push(entityMetric);
        entities.push(entity);
        
      } catch (error) {
        console.warn(`[Pipeline] 实体构建失败 (${normalizedFieldSet.schema.schema_name}): ${error.message}`);
        context.warnings.push({
          step: 'entityBuilding',
          error: `Schema ${normalizedFieldSet.schema.schema_name}: ${error.message}`,
          timestamp: Date.now()
        });
        
        // 记录失败的实体构建
        buildingMetrics.push({
          schemaName: normalizedFieldSet.schema.schema_name,
          entityId: null,
          confidence: 0,
          fieldCoverage: 0,
          expectedFields: 0,
          actualFields: 0,
          isPartial: false,
          error: error.message
        });
      }
    }
    
    context.data.entities = entities;
    context.metrics.entityCount = entities.length;
    
    // 记录结束时的token使用情况
    const tokenStatsAfter = tokenTracker.getTokenStats();
    const apiCallsAfter = tokenStatsAfter.total_records || 0;
    const tokensAfter = tokenStatsAfter.total_tokens || 0;
    
    // 计算此步骤的token使用
    const stepTokenUsage = tokensAfter - tokensBefore;
    const stepApiCalls = apiCallsAfter - apiCallsBefore;
    
    // 更新context中的token使用统计
    context.metrics.tokenUsage += stepTokenUsage;
    context.metrics.apiCalls += stepApiCalls;
    
    // 计算总体指标
    const avgConfidence = entities.length > 0 ? 
                         entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length : 0;
    const avgFieldCoverage = buildingMetrics.length > 0 ?
                            buildingMetrics.reduce((sum, m) => sum + (m.fieldCoverage || 0), 0) / buildingMetrics.length : 0;
    const partialEntityCount = buildingMetrics.filter(m => m.isPartial).length;
    
    StepExecutor.recordMetrics('entityBuilding', {
      entityCount: entities.length,
      avgConfidence: avgConfidence,
      avgFieldCoverage: avgFieldCoverage,
      partialEntityCount: partialEntityCount,
      entityMetrics: buildingMetrics,
      tokenUsage: stepTokenUsage || 0,
      apiCalls: stepApiCalls || 0
    }, context);
    
    return entities;
  }
  
  /**
   * 步骤6: 抽取关系
   */
  async _extractRelations(context, options) {
    const relationOptions = options.relationExtraction;
    
    // 记录开始时的token使用情况
    const tokenStatsBefore = tokenTracker.getTokenStats();
    const apiCallsBefore = tokenStatsBefore.total_records || 0;
    const tokensBefore = tokenStatsBefore.total_tokens || 0;
    
    const allRelations = [];
    const builderResults = {
      builtin: { success: false, count: 0, error: null },
      cooccurrence: { success: false, count: 0, error: null },
      semantic: { success: false, count: 0, error: null }
    };
    
    // 内置规则关系
    if (relationOptions.enableBuiltin) {
      try {
        let builtinRelations = [];
        for (const entity of context.data.entities) {
          try {
            const schema = context.data.matchedSchemas.find(
              sm => sm.schema.schema_name === entity.schemas[0]?.schema_name
            )?.schema;
            
            if (schema) {
              const normalizedFields = context.data.normalizedFields.find(
                nf => nf.schema.schema_name === schema.schema_name
              )?.fields || [];
              
              const relations = await builtinRelationBuilder.buildRelations(
                entity,
                schema,
                normalizedFields,
                [context.data.ckb.ckb_id]
              );
              
              builtinRelations.push(...relations);
            }
          } catch (error) {
            console.warn(`[Pipeline] 实体 ${entity.entity_id} 的内置关系抽取失败: ${error.message}`);
          }
        }
        
        allRelations.push(...builtinRelations);
        builderResults.builtin.success = true;
        builderResults.builtin.count = builtinRelations.length;
      } catch (error) {
        console.warn(`[Pipeline] 内置关系构建器失败: ${error.message}`);
        builderResults.builtin.error = error.message;
        context.warnings.push({
          step: 'relationExtraction',
          error: `内置关系构建器失败: ${error.message}`,
          timestamp: Date.now()
        });
      }
    }
    
    // 共现关系
    if (relationOptions.enableCooccurrence) {
      if (context.data.entities.length > 1) {
        try {
          const cooccurrenceRelations = await cooccurrenceRelationBuilder.buildRelations(
            context.data.entities,
            [context.data.ckb.ckb_id]
          );
          allRelations.push(...cooccurrenceRelations);
          builderResults.cooccurrence.success = true;
          builderResults.cooccurrence.count = cooccurrenceRelations.length;
        } catch (error) {
          console.warn(`[Pipeline] 共现关系构建器失败: ${error.message}`);
          builderResults.cooccurrence.error = error.message;
          context.warnings.push({
            step: 'relationExtraction',
            error: `共现关系构建器失败: ${error.message}`,
            timestamp: Date.now()
          });
        }
      } else {
        // 实体数量不足，标记为成功但没有关系
        builderResults.cooccurrence.success = true;
        builderResults.cooccurrence.count = 0;
      }
    }
    
    // 语义关系
    if (relationOptions.enableSemantic && relationOptions.semanticUseLLM) {
      if (context.data.entities.length > 1) {
        try {
          const semanticRelations = await semanticRelationBuilder.buildRelations(
            context.data.entities,
            context.data.ckb,
            { useLLM: true }
          );
          allRelations.push(...semanticRelations);
          builderResults.semantic.success = true;
          builderResults.semantic.count = semanticRelations.length;
        } catch (error) {
          console.warn(`[Pipeline] 语义关系构建器失败: ${error.message}`);
          builderResults.semantic.error = error.message;
          context.warnings.push({
            step: 'relationExtraction',
            error: `语义关系构建器失败: ${error.message}`,
            timestamp: Date.now()
          });
        }
      } else {
        // 实体数量不足，标记为成功但没有关系
        builderResults.semantic.success = true;
        builderResults.semantic.count = 0;
      }
    }
    
    context.data.relations = allRelations;
    context.metrics.relationCount = allRelations.length;
    
    // 记录结束时的token使用情况
    const tokenStatsAfter = tokenTracker.getTokenStats();
    const apiCallsAfter = tokenStatsAfter.total_records || 0;
    const tokensAfter = tokenStatsAfter.total_tokens || 0;
    
    // 计算此步骤的token使用
    const stepTokenUsage = tokensAfter - tokensBefore;
    const stepApiCalls = apiCallsAfter - apiCallsBefore;
    
    // 更新context中的token使用统计
    context.metrics.tokenUsage += stepTokenUsage;
    context.metrics.apiCalls += stepApiCalls;
    
    // 计算成功和失败的构建器数量
    const enabledBuilders = [];
    if (relationOptions.enableBuiltin) enabledBuilders.push('builtin');
    if (relationOptions.enableCooccurrence) enabledBuilders.push('cooccurrence');
    if (relationOptions.enableSemantic) enabledBuilders.push('semantic');
    
    const successfulBuilders = enabledBuilders.filter(b => builderResults[b].success);
    const failedBuilders = enabledBuilders.filter(b => !builderResults[b].success);
    
    StepExecutor.recordMetrics('relationExtraction', {
      relationCount: allRelations.length,
      builtinCount: allRelations.filter(r => r.type === 'builtin').length,
      cooccurrenceCount: allRelations.filter(r => r.type === 'cooccurrence').length,
      semanticCount: allRelations.filter(r => r.type === 'semantic').length,
      enabledBuilders: enabledBuilders.length,
      successfulBuilders: successfulBuilders.length,
      failedBuilders: failedBuilders.length,
      builderResults: builderResults,
      tokenUsage: stepTokenUsage || 0,
      apiCalls: stepApiCalls || 0
    }, context);
    
    return allRelations;
  }
  
  /**
   * 步骤7: 存储到知识图谱
   */
  async _storeToKnowledgeGraph(context, options) {
    const storageOptions = options.storage;
    const storedEntityIds = [];
    const storedRelationIds = [];
    
    try {
      // 如果启用事务，使用事务包装存储操作
      if (storageOptions.useTransaction) {
        console.log('[Pipeline] 使用事务模式存储实体和关系');
        
        // 存储实体
        for (const entity of context.data.entities) {
          try {
            const storedEntity = await entityStore.saveEntity(entity);
            storedEntityIds.push(storedEntity.entity_id);
          } catch (error) {
            console.warn(`[Pipeline] 实体存储失败: ${error.message}`);
            if (!storageOptions.skipDuplicates || !error.message.includes('duplicate')) {
              // 关键错误，需要回滚
              throw error;
            }
          }
        }
        
        // 存储关系
        for (const relation of context.data.relations) {
          try {
            const storedRelation = await relationStore.saveRelation(relation);
            storedRelationIds.push(storedRelation.relation_id);
          } catch (error) {
            console.warn(`[Pipeline] 关系存储失败: ${error.message}`);
            if (!storageOptions.skipDuplicates || !error.message.includes('duplicate')) {
              // 关键错误，需要回滚
              throw error;
            }
          }
        }
        
        console.log(`[Pipeline] 事务提交成功: ${storedEntityIds.length} 个实体, ${storedRelationIds.length} 个关系`);
        
      } else {
        // 非事务模式，直接存储
        console.log('[Pipeline] 使用非事务模式存储实体和关系');
        
        // 存储实体
        for (const entity of context.data.entities) {
          try {
            const storedEntity = await entityStore.saveEntity(entity);
            storedEntityIds.push(storedEntity.entity_id);
          } catch (error) {
            console.warn(`[Pipeline] 实体存储失败: ${error.message}`);
            if (!storageOptions.skipDuplicates || !error.message.includes('duplicate')) {
              throw error;
            }
          }
        }
        
        // 存储关系
        for (const relation of context.data.relations) {
          try {
            const storedRelation = await relationStore.saveRelation(relation);
            storedRelationIds.push(storedRelation.relation_id);
          } catch (error) {
            console.warn(`[Pipeline] 关系存储失败: ${error.message}`);
            if (!storageOptions.skipDuplicates || !error.message.includes('duplicate')) {
              throw error;
            }
          }
        }
      }
      
      StepExecutor.recordMetrics('storage', {
        storedEntities: storedEntityIds.length,
        storedRelations: storedRelationIds.length,
        tokenUsage: 0,
        apiCalls: 0
      }, context);
      
      return {
        entityIds: storedEntityIds,
        relationIds: storedRelationIds
      };
      
    } catch (error) {
      // 存储失败，执行回滚
      console.error(`[Pipeline] 存储失败，开始回滚: ${error.message}`);
      
      if (storageOptions.useTransaction) {
        await this._rollbackStorage(storedEntityIds, storedRelationIds);
      }
      
      // 重新抛出错误，让StepExecutor处理
      throw new Error(`存储失败: ${error.message}`);
    }
  }
  
  /**
   * 回滚存储操作
   * @param {Array<string>} entityIds - 已存储的实体ID
   * @param {Array<string>} relationIds - 已存储的关系ID
   */
  async _rollbackStorage(entityIds, relationIds) {
    console.log(`[Pipeline] 开始回滚: ${entityIds.length} 个实体, ${relationIds.length} 个关系`);
    
    let rollbackErrors = [];
    
    // 回滚关系（先删除关系，再删除实体）
    for (const relationId of relationIds) {
      try {
        await relationStore.deleteRelation(relationId);
        console.log(`[Pipeline] 回滚关系: ${relationId}`);
      } catch (error) {
        console.error(`[Pipeline] 回滚关系失败 ${relationId}: ${error.message}`);
        rollbackErrors.push(`关系 ${relationId}: ${error.message}`);
      }
    }
    
    // 回滚实体
    for (const entityId of entityIds) {
      try {
        await entityStore.deleteEntity(entityId);
        console.log(`[Pipeline] 回滚实体: ${entityId}`);
      } catch (error) {
        console.error(`[Pipeline] 回滚实体失败 ${entityId}: ${error.message}`);
        rollbackErrors.push(`实体 ${entityId}: ${error.message}`);
      }
    }
    
    if (rollbackErrors.length > 0) {
      console.error(`[Pipeline] 回滚过程中出现 ${rollbackErrors.length} 个错误`);
      console.error('[Pipeline] 回滚错误详情:', rollbackErrors);
    } else {
      console.log('[Pipeline] 回滚完成，所有数据已清理');
    }
  }
  
  /**
   * 批量处理多个文档
   * 
   * 使用并发控制批量处理多个文档，每个文档独立处理，互不影响。
   * 支持配置并发数量和错误处理策略。
   * 
   * @param {Array<Object>} documents - 文档数组
   * @param {string} documents[].id - 文档唯一标识符
   * @param {string} documents[].type - 文档类型 (text, pdf, word, excel, markdown, html)
   * @param {string} documents[].content - 文档内容
   * @param {string} [documents[].title] - 文档标题（可选）
   * @param {Object} [documents[].metadata] - 文档元数据（可选）
   * @param {Object} [options] - 批量处理配置，会与构造函数配置合并
   * @param {number} [options.concurrency=3] - 并发处理的文档数量
   * @param {boolean} [options.stopOnFirstError=false] - 遇到第一个错误时是否停止处理
   * @param {Object} [options.extraction] - 字段提取配置（同processDocument）
   * @param {Object} [options.normalization] - 字段标准化配置（同processDocument）
   * @param {Object} [options.entityBuilding] - 实体构建配置（同processDocument）
   * @param {Object} [options.relationExtraction] - 关系抽取配置（同processDocument）
   * @returns {Promise<Array<ProcessingContext>>} 处理上下文数组，每个文档对应一个上下文
   * 
   * @example
   * const pipeline = new UniversalDocumentPipeline();
   * const documents = [
   *   { id: 'doc-1', type: 'text', content: '招标文件内容...' },
   *   { id: 'doc-2', type: 'text', content: '政府报告内容...' },
   *   { id: 'doc-3', type: 'text', content: '旅游攻略内容...' }
   * ];
   * 
   * // 并发处理3个文档
   * const results = await pipeline.processBatch(documents, {
   *   concurrency: 3,
   *   stopOnFirstError: false
   * });
   * 
   * // 查看每个文档的处理结果
   * results.forEach(context => {
   *   console.log(`${context.documentId}: ${context.status}`);
   *   console.log(`  实体: ${context.metrics.entityCount}`);
   *   console.log(`  关系: ${context.metrics.relationCount}`);
   * });
   * 
   * @throws {Error} 当stopOnFirstError为true且某个文档处理失败时抛出错误
   */
  async processBatch(documents, options = {}) {
    const batchOptions = this._mergeOptions(DEFAULT_BATCH_OPTIONS, options);
    
    // 使用 BatchProcessor 进行并发处理
    const results = await BatchProcessor.processConcurrently(
      documents,
      batchOptions,
      (doc) => this.processDocument(doc, batchOptions)
    );
    
    return results;
  }
}

module.exports = {
  UniversalDocumentPipeline,
  ProcessingContext,
  StepExecutor,
  BatchProcessor,
  DEFAULT_OPTIONS,
  DEFAULT_BATCH_OPTIONS
};
