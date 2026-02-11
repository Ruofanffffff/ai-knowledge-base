/**
 * Context Optimizer - 优化LLM调用的上下文
 * 
 * 功能：
 * 1. 为不同任务选择最相关的chunks
 * 2. 动态调整上下文窗口大小
 * 3. 优化token消耗
 * 4. 保持准确性
 */

const { ChunkManager } = require('./chunk_manager');
const { RelevanceScorer } = require('./relevance_scorer');
const { BatchOptimizer } = require('./batch_optimizer');

class ContextOptimizer {
  constructor(options = {}) {
    this.chunkManager = options.chunkManager || new ChunkManager();
    this.relevanceScorer = options.relevanceScorer || new RelevanceScorer();
    this.batchOptimizer = options.batchOptimizer || new BatchOptimizer({
      semanticScorer: this.relevanceScorer.semanticScorer
    });
    
    // 默认配置
    this.config = {
      maxTokens: options.maxTokens || 2000,
      minChunks: options.minChunks || 2,
      maxChunks: options.maxChunks || 10,
      relevanceThreshold: options.relevanceThreshold || 0.1,
      includeAdjacent: options.includeAdjacent !== false,
      adjacentWindow: options.adjacentWindow || 1,
      enableBatchOptimization: options.enableBatchOptimization !== false,
      ...options
    };
  }

  /**
   * 为字段提取优化上下文
   * @param {Array<Object>} ckbs - CKB数组
   * @param {Array<string>} fieldNames - 要提取的字段名称
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 优化后的上下文
   */
  async optimizeForFieldExtraction(ckbs, fieldNames, options = {}) {
    const {
      maxTokens = this.config.maxTokens,
      minChunks = this.config.minChunks,
      relevanceThreshold = this.config.relevanceThreshold
    } = options;

    // 构建查询（基于字段名称）
    const query = fieldNames.join(' ');
    
    // 对所有CKBs进行分片
    const allChunks = [];
    for (const ckb of ckbs) {
      const chunks = await this.chunkManager.chunkCKB(ckb, {
        strategy: 'paragraph',
        minLength: 50,
        maxLength: 500
      });
      allChunks.push(...chunks);
    }

    // 如果chunks太少,直接返回全文
    if (allChunks.length <= minChunks) {
      return {
        optimized: false,
        reason: 'too_few_chunks',
        context: this._chunksToText(allChunks),
        chunks: allChunks,
        tokenCount: this._estimateTotalTokens(allChunks),
        originalTokenCount: this._estimateTotalTokens(allChunks)
      };
    }

    // 评分和选择相关chunks
    const relevantChunks = this.relevanceScorer.selectRelevantChunks(
      query,
      allChunks,
      {
        topK: this.config.maxChunks,
        threshold: relevanceThreshold,
        method: 'hybrid'
      }
    );

    // 如果没有足够相关的chunks,降级到全文
    if (relevantChunks.length < minChunks) {
      return {
        optimized: false,
        reason: 'insufficient_relevant_chunks',
        context: this._chunksToText(allChunks),
        chunks: allChunks,
        tokenCount: this._estimateTotalTokens(allChunks),
        originalTokenCount: this._estimateTotalTokens(allChunks)
      };
    }

    // 添加相邻chunks以保持上下文连贯性
    let selectedChunks = relevantChunks;
    if (this.config.includeAdjacent) {
      selectedChunks = await this._addAdjacentChunks(relevantChunks);
    }

    // 确保不超过token限制
    selectedChunks = this._limitByTokens(selectedChunks, maxTokens);

    const originalTokenCount = this._estimateTotalTokens(allChunks);
    const optimizedTokenCount = this._estimateTotalTokens(selectedChunks);

    return {
      optimized: true,
      context: this._chunksToText(selectedChunks),
      chunks: selectedChunks,
      tokenCount: optimizedTokenCount,
      originalTokenCount: originalTokenCount,
      tokenSavings: originalTokenCount - optimizedTokenCount,
      tokenSavingsPercent: ((originalTokenCount - optimizedTokenCount) / originalTokenCount * 100).toFixed(2),
      relevanceScores: selectedChunks.map(c => c.relevance_score || 0)
    };
  }

  /**
   * 为实体命名优化上下文
   * @param {Object} entity - 实体对象
   * @param {Array<Object>} ckbs - CKB数组
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 优化后的上下文
   */
  async optimizeForEntityNaming(entity, ckbs, options = {}) {
    const {
      maxTokens = this.config.maxTokens,
      contextWindow = 100 // characters around entity mention
    } = options;

    // 构建查询（基于实体名称和类型）
    const query = `${entity.name} ${entity.type || ''}`.trim();
    
    // 对所有CKBs进行分片
    const allChunks = [];
    for (const ckb of ckbs) {
      const chunks = await this.chunkManager.chunkCKB(ckb, {
        strategy: 'sentence',
        minLength: 30,
        maxLength: 300
      });
      allChunks.push(...chunks);
    }

    // 查找包含实体名称的chunks
    const mentionChunks = allChunks.filter(chunk => 
      chunk.text.includes(entity.name)
    );

    // 如果找到提及,使用这些chunks
    if (mentionChunks.length > 0) {
      const selectedChunks = this._limitByTokens(mentionChunks, maxTokens);
      
      return {
        optimized: true,
        context: this._chunksToText(selectedChunks),
        chunks: selectedChunks,
        tokenCount: this._estimateTotalTokens(selectedChunks),
        originalTokenCount: this._estimateTotalTokens(allChunks),
        method: 'mention_based'
      };
    }

    // 否则使用相关性评分
    const relevantChunks = await this.relevanceScorer.selectRelevantChunks(
      query,
      allChunks,
      {
        topK: 5,
        threshold: 0.1,
        method: 'hybrid'
      }
    );

    const selectedChunks = this._limitByTokens(relevantChunks, maxTokens);

    return {
      optimized: true,
      context: this._chunksToText(selectedChunks),
      chunks: selectedChunks,
      tokenCount: this._estimateTotalTokens(selectedChunks),
      originalTokenCount: this._estimateTotalTokens(allChunks),
      method: 'relevance_based'
    };
  }

  /**
   * 为关系抽取优化上下文
   * @param {Object} relation - 关系对象
   * @param {Array<Object>} ckbs - CKB数组
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 优化后的上下文
   */
  async optimizeForRelationExtraction(relation, ckbs, options = {}) {
    const {
      maxTokens = this.config.maxTokens
    } = options;

    // 构建查询（基于源实体和目标实体）
    const query = `${relation.source} ${relation.target}`.trim();
    
    // 对所有CKBs进行分片
    const allChunks = [];
    for (const ckb of ckbs) {
      const chunks = await this.chunkManager.chunkCKB(ckb, {
        strategy: 'sentence',
        minLength: 30,
        maxLength: 400
      });
      allChunks.push(...chunks);
    }

    // 查找同时包含两个实体的chunks
    const coOccurrenceChunks = allChunks.filter(chunk => 
      chunk.text.includes(relation.source) && chunk.text.includes(relation.target)
    );

    // 如果找到共现,优先使用这些chunks
    if (coOccurrenceChunks.length > 0) {
      const selectedChunks = this._limitByTokens(coOccurrenceChunks, maxTokens);
      
      return {
        optimized: true,
        context: this._chunksToText(selectedChunks),
        chunks: selectedChunks,
        tokenCount: this._estimateTotalTokens(selectedChunks),
        originalTokenCount: this._estimateTotalTokens(allChunks),
        method: 'co_occurrence'
      };
    }

    // 否则使用相关性评分
    const relevantChunks = await this.relevanceScorer.selectRelevantChunks(
      query,
      allChunks,
      {
        topK: 5,
        threshold: 0.1,
        method: 'hybrid'
      }
    );

    const selectedChunks = this._limitByTokens(relevantChunks, maxTokens);

    return {
      optimized: true,
      context: this._chunksToText(selectedChunks),
      chunks: selectedChunks,
      tokenCount: this._estimateTotalTokens(selectedChunks),
      originalTokenCount: this._estimateTotalTokens(allChunks),
      method: 'relevance_based'
    };
  }

  /**
   * 添加相邻chunks以保持上下文连贯性
   * @private
   */
  async _addAdjacentChunks(chunks) {
    const chunkSet = new Set(chunks.map(c => c.chunk_id));
    const adjacentChunks = [];

    for (const chunk of chunks) {
      const adjacent = await this.chunkManager.getAdjacentChunks(
        chunk.chunk_id,
        this.config.adjacentWindow
      );
      
      for (const adj of adjacent) {
        if (!chunkSet.has(adj.chunk_id)) {
          adjacentChunks.push(adj);
          chunkSet.add(adj.chunk_id);
        }
      }
    }

    // 合并并按位置排序
    const allChunks = [...chunks, ...adjacentChunks];
    allChunks.sort((a, b) => {
      if (a.ckb_id !== b.ckb_id) {
        return a.ckb_id.localeCompare(b.ckb_id);
      }
      return a.chunk_index - b.chunk_index;
    });

    return allChunks;
  }

  /**
   * 限制chunks以不超过token限制
   * @private
   */
  _limitByTokens(chunks, maxTokens) {
    const selected = [];
    let totalTokens = 0;

    // 按相关性排序（如果有）
    const sortedChunks = [...chunks].sort((a, b) => 
      (b.relevance_score || 0) - (a.relevance_score || 0)
    );

    for (const chunk of sortedChunks) {
      const chunkTokens = chunk.metadata?.token_count || 0;
      if (totalTokens + chunkTokens <= maxTokens) {
        selected.push(chunk);
        totalTokens += chunkTokens;
      } else {
        break;
      }
    }

    // 按原始顺序排序
    selected.sort((a, b) => {
      if (a.ckb_id !== b.ckb_id) {
        return a.ckb_id.localeCompare(b.ckb_id);
      }
      return a.chunk_index - b.chunk_index;
    });

    return selected;
  }

  /**
   * 将chunks转换为文本
   * @private
   */
  _chunksToText(chunks) {
    return chunks.map(c => c.text).join('\n\n');
  }

  /**
   * 估算总token数
   * @private
   */
  _estimateTotalTokens(chunks) {
    return chunks.reduce((sum, chunk) => 
      sum + (chunk.metadata?.token_count || 0), 0
    );
  }

  /**
   * 批量优化字段提取（跨多个CKBs）
   * @param {Array<Object>} ckbs - CKB数组
   * @param {Array<string>} fieldNames - 要提取的字段名称
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 批量优化结果
   */
  async batchOptimizeFieldExtraction(ckbs, fieldNames, options = {}) {
    if (!this.config.enableBatchOptimization || !ckbs || ckbs.length === 0) {
      // 如果未启用批量优化或没有CKBs，返回空结果
      return {
        optimized: false,
        reason: 'batch_optimization_disabled_or_no_ckbs',
        batches: []
      };
    }

    // 使用批量优化器处理
    const batchResult = await this.batchOptimizer.batchProcess(ckbs, {
      task: 'field_extraction',
      ...options
    });

    // 为每个批次优化上下文
    const optimizedBatches = [];
    for (const batch of batchResult.batches) {
      // 如果批次包含多个CKBs，使用合并的上下文
      if (batch.ckb_count > 1) {
        optimizedBatches.push({
          ...batch,
          optimized: true,
          method: 'batch_merged'
        });
      } else {
        // 单个CKB，使用常规优化
        const ckb = ckbs.find(c => c.ckb_id === batch.ckb_ids[0]);
        if (ckb) {
          const singleResult = await this.optimizeForFieldExtraction(
            [ckb],
            fieldNames,
            options
          );
          optimizedBatches.push({
            ...batch,
            context: singleResult.context,
            tokenCount: singleResult.tokenCount,
            optimized: singleResult.optimized,
            method: 'single_optimized'
          });
        }
      }
    }

    return {
      optimized: true,
      batches: optimizedBatches,
      totalBatches: optimizedBatches.length,
      totalCKBs: ckbs.length,
      optimization: batchResult.optimization,
      sharedContext: batchResult.sharedContext
    };
  }

  /**
   * 批量优化实体命名（跨多个CKBs）
   * @param {Array<Object>} entities - 实体数组
   * @param {Array<Object>} ckbs - CKB数组
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 批量优化结果
   */
  async batchOptimizeEntityNaming(entities, ckbs, options = {}) {
    if (!this.config.enableBatchOptimization || !entities || entities.length === 0) {
      return {
        optimized: false,
        reason: 'batch_optimization_disabled_or_no_entities',
        results: []
      };
    }

    // 为每个实体找到相关的CKBs
    const entityCKBMap = new Map();
    for (const entity of entities) {
      const relevantCKBs = ckbs.filter(ckb => 
        entity.supported_by?.includes(ckb.ckb_id)
      );
      entityCKBMap.set(entity.entity_id, relevantCKBs);
    }

    // 识别共享上下文
    const sharedContext = await this.batchOptimizer.shareContextAcrossCKBs(ckbs, options);

    // 为每个实体优化上下文
    const results = [];
    for (const entity of entities) {
      const relevantCKBs = entityCKBMap.get(entity.entity_id) || [];
      
      if (relevantCKBs.length > 0) {
        const result = await this.optimizeForEntityNaming(entity, relevantCKBs, options);
        results.push({
          entity_id: entity.entity_id,
          ...result
        });
      }
    }

    // 计算优化效果
    const baselineLLMCalls = entities.length;
    const optimizedLLMCalls = results.length;

    return {
      optimized: true,
      results,
      totalEntities: entities.length,
      sharedContext,
      optimization: {
        baselineLLMCalls,
        optimizedLLMCalls,
        reduction: baselineLLMCalls - optimizedLLMCalls,
        reductionPercent: `${((baselineLLMCalls - optimizedLLMCalls) / baselineLLMCalls * 100).toFixed(2)}%`
      }
    };
  }

  /**
   * 批量优化关系抽取（跨多个CKBs）
   * @param {Array<Object>} relations - 关系数组
   * @param {Array<Object>} ckbs - CKB数组
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 批量优化结果
   */
  async batchOptimizeRelationExtraction(relations, ckbs, options = {}) {
    if (!this.config.enableBatchOptimization || !relations || relations.length === 0) {
      return {
        optimized: false,
        reason: 'batch_optimization_disabled_or_no_relations',
        results: []
      };
    }

    // 识别共享上下文
    const sharedContext = await this.batchOptimizer.shareContextAcrossCKBs(ckbs, options);

    // 为每个关系优化上下文
    const results = [];
    for (const relation of relations) {
      const result = await this.optimizeForRelationExtraction(relation, ckbs, options);
      results.push({
        relation_id: relation.relation_id || `${relation.source}_${relation.target}`,
        ...result
      });
    }

    // 计算优化效果
    const baselineLLMCalls = relations.length;
    const optimizedLLMCalls = results.length;

    return {
      optimized: true,
      results,
      totalRelations: relations.length,
      sharedContext,
      optimization: {
        baselineLLMCalls,
        optimizedLLMCalls,
        reduction: baselineLLMCalls - optimizedLLMCalls,
        reductionPercent: `${((baselineLLMCalls - optimizedLLMCalls) / baselineLLMCalls * 100).toFixed(2)}%`
      }
    };
  }

  /**
   * 更新配置
   * @param {Object} newConfig - 新配置
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }

  /**
   * 获取当前配置
   * @returns {Object} 当前配置
   */
  getConfig() {
    return { ...this.config };
  }

  /**
   * 获取批量优化器
   * @returns {BatchOptimizer} 批量优化器实例
   */
  getBatchOptimizer() {
    return this.batchOptimizer;
  }
}

module.exports = {
  ContextOptimizer
};
