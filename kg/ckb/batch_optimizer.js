/**
 * Batch Optimizer - 批量优化LLM调用
 * 
 * 功能：
 * 1. 识别相似chunks，合并LLM调用
 * 2. 实现跨CKB的上下文共享
 * 3. 批量处理多个CKB
 * 4. 减少LLM调用次数 > 50%
 */

const { SemanticScorer } = require('./semantic_scorer');

class BatchOptimizer {
  constructor(options = {}) {
    this.semanticScorer = options.semanticScorer || new SemanticScorer(options);
    
    // 配置
    this.config = {
      similarityThreshold: options.similarityThreshold || 0.85, // 相似度阈值
      maxBatchSize: options.maxBatchSize || 10, // 最大批量大小
      minBatchSize: options.minBatchSize || 2, // 最小批量大小
      maxTokensPerBatch: options.maxTokensPerBatch || 3000, // 每批最大token数
      ...options
    };
  }

  /**
   * 识别相似的chunks
   * @param {Array<Object>} chunks - Chunks数组
   * @param {Object} options - 选项
   * @returns {Promise<Array<Array<Object>>>} 相似chunks的分组
   */
  async identifySimilarChunks(chunks, options = {}) {
    const {
      similarityThreshold = this.config.similarityThreshold
    } = options;

    if (!chunks || chunks.length === 0) {
      return [];
    }

    // 预计算所有chunks的embeddings
    const chunksWithEmbeddings = await this.semanticScorer.precomputeChunkEmbeddings(chunks);

    // 使用聚类算法分组相似chunks
    const groups = [];
    const processed = new Set();

    for (let i = 0; i < chunksWithEmbeddings.length; i++) {
      if (processed.has(i)) continue;

      const group = [chunksWithEmbeddings[i]];
      processed.add(i);

      // 查找与当前chunk相似的其他chunks
      for (let j = i + 1; j < chunksWithEmbeddings.length; j++) {
        if (processed.has(j)) continue;

        const { cosineSimilarity } = require('./semantic_scorer');
        const similarity = cosineSimilarity(
          chunksWithEmbeddings[i].embedding,
          chunksWithEmbeddings[j].embedding
        );

        if (similarity >= similarityThreshold) {
          group.push(chunksWithEmbeddings[j]);
          processed.add(j);
        }
      }

      // 只保留有多个成员的组
      if (group.length >= this.config.minBatchSize) {
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * 合并LLM调用
   * @param {Array<Object>} chunks - 相似的chunks
   * @param {Object} options - 选项
   * @returns {Object} 合并后的上下文
   */
  mergeLLMCalls(chunks, options = {}) {
    const {
      maxTokens = this.config.maxTokensPerBatch,
      deduplicateText = true
    } = options;

    if (!chunks || chunks.length === 0) {
      return {
        merged: false,
        context: '',
        chunks: [],
        tokenCount: 0
      };
    }

    // 如果只有一个chunk，不需要合并
    if (chunks.length === 1) {
      return {
        merged: false,
        context: chunks[0].text,
        chunks: chunks,
        tokenCount: chunks[0].metadata?.token_count || 0
      };
    }

    // 去重文本（如果启用）
    let uniqueChunks = chunks;
    if (deduplicateText) {
      const seenTexts = new Set();
      uniqueChunks = chunks.filter(chunk => {
        const normalized = chunk.text.trim().toLowerCase();
        if (seenTexts.has(normalized)) {
          return false;
        }
        seenTexts.add(normalized);
        return true;
      });
    }

    // 按token数限制
    const selectedChunks = [];
    let totalTokens = 0;

    for (const chunk of uniqueChunks) {
      const chunkTokens = chunk.metadata?.token_count || 0;
      if (totalTokens + chunkTokens <= maxTokens) {
        selectedChunks.push(chunk);
        totalTokens += chunkTokens;
      } else {
        break;
      }
    }

    // 合并文本
    const context = selectedChunks.map(c => c.text).join('\n\n');

    return {
      merged: true,
      context,
      chunks: selectedChunks,
      tokenCount: totalTokens,
      originalChunkCount: chunks.length,
      mergedChunkCount: selectedChunks.length,
      deduplicationSavings: chunks.length - uniqueChunks.length
    };
  }

  /**
   * 跨CKB共享上下文
   * @param {Array<Object>} ckbs - CKB数组
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 共享上下文信息
   */
  async shareContextAcrossCKBs(ckbs, options = {}) {
    const {
      maxSharedChunks = 5,
      similarityThreshold = this.config.similarityThreshold
    } = options;

    if (!ckbs || ckbs.length < 2) {
      return {
        shared: false,
        reason: 'insufficient_ckbs',
        sharedChunks: []
      };
    }

    // 收集所有chunks
    const allChunks = [];
    const ckbChunkMap = new Map(); // ckb_id -> chunks

    for (const ckb of ckbs) {
      if (ckb.chunks && ckb.chunks.length > 0) {
        allChunks.push(...ckb.chunks);
        ckbChunkMap.set(ckb.ckb_id, ckb.chunks);
      }
    }

    if (allChunks.length === 0) {
      return {
        shared: false,
        reason: 'no_chunks',
        sharedChunks: []
      };
    }

    // 预计算IDF（如果还没有）
    if (!this.semanticScorer.idfMap) {
      const texts = allChunks.map(c => c.text);
      this.semanticScorer.precomputeIDF(texts);
    }

    // 识别相似chunks
    const similarGroups = await this.identifySimilarChunks(allChunks, {
      similarityThreshold
    });

    // 找出跨CKB的相似chunks
    const sharedChunks = [];
    for (const group of similarGroups) {
      const ckbIds = new Set(group.map(c => c.ckb_id));
      
      // 只保留跨CKB的组
      if (ckbIds.size >= 2) {
        sharedChunks.push({
          chunks: group,
          ckb_count: ckbIds.size,
          ckb_ids: Array.from(ckbIds),
          representative: group[0] // 使用第一个作为代表
        });
      }
    }

    // 按CKB数量排序，选择最共享的chunks
    sharedChunks.sort((a, b) => b.ckb_count - a.ckb_count);
    const topShared = sharedChunks.slice(0, maxSharedChunks);

    return {
      shared: topShared.length > 0,
      sharedChunks: topShared,
      totalSharedGroups: sharedChunks.length,
      potentialSavings: this._calculateSharedSavings(topShared)
    };
  }

  /**
   * 批量处理CKBs
   * @param {Array<Object>} ckbs - CKB数组
   * @param {Object} options - 选项
   * @returns {Promise<Object>} 批量处理结果
   */
  async batchProcess(ckbs, options = {}) {
    const {
      task = 'field_extraction', // field_extraction, entity_naming, relation_extraction
      maxBatchSize = this.config.maxBatchSize,
      enableSharing = true
    } = options;

    if (!ckbs || ckbs.length === 0) {
      return {
        batches: [],
        totalBatches: 0,
        totalCKBs: 0,
        estimatedLLMCalls: 0
      };
    }

    // 限制批量大小
    const limitedCKBs = ckbs.slice(0, maxBatchSize);

    // 如果启用共享，先识别共享上下文
    let sharedContext = null;
    if (enableSharing && limitedCKBs.length >= 2) {
      sharedContext = await this.shareContextAcrossCKBs(limitedCKBs, options);
    }

    // 根据任务类型分批
    const batches = await this._createBatches(limitedCKBs, task, options);

    // 计算优化效果
    const baselineLLMCalls = limitedCKBs.length; // 不优化时每个CKB一次调用
    const optimizedLLMCalls = batches.length;
    const reduction = baselineLLMCalls - optimizedLLMCalls;
    const reductionPercent = (reduction / baselineLLMCalls * 100).toFixed(2);

    return {
      batches,
      totalBatches: batches.length,
      totalCKBs: limitedCKBs.length,
      sharedContext,
      optimization: {
        baselineLLMCalls,
        optimizedLLMCalls,
        reduction,
        reductionPercent: `${reductionPercent}%`
      }
    };
  }

  /**
   * 创建批次
   * @private
   */
  async _createBatches(ckbs, task, options) {
    const batches = [];
    const processed = new Set();

    // 收集所有chunks
    const allChunks = [];
    for (const ckb of ckbs) {
      if (ckb.chunks && ckb.chunks.length > 0) {
        allChunks.push(...ckb.chunks.map(chunk => ({
          ...chunk,
          source_ckb_id: ckb.ckb_id
        })));
      }
    }

    // 预计算IDF（如果还没有）
    if (allChunks.length > 0 && !this.semanticScorer.idfMap) {
      const texts = allChunks.map(c => c.text);
      this.semanticScorer.precomputeIDF(texts);
    }

    // 识别相似chunks
    const similarGroups = await this.identifySimilarChunks(allChunks, options);

    // 为每个相似组创建一个批次
    for (const group of similarGroups) {
      const ckbIds = new Set(group.map(c => c.source_ckb_id));
      
      // 标记已处理的CKBs
      for (const ckbId of ckbIds) {
        processed.add(ckbId);
      }

      // 合并chunks
      const merged = this.mergeLLMCalls(group, options);

      batches.push({
        batch_id: `batch_${batches.length}`,
        ckb_ids: Array.from(ckbIds),
        ckb_count: ckbIds.size,
        context: merged.context,
        chunks: merged.chunks,
        tokenCount: merged.tokenCount,
        task
      });
    }

    // 为未处理的CKBs创建单独的批次
    for (const ckb of ckbs) {
      if (!processed.has(ckb.ckb_id)) {
        const chunks = ckb.chunks || [];
        const context = chunks.map(c => c.text).join('\n\n');
        const tokenCount = chunks.reduce((sum, c) => 
          sum + (c.metadata?.token_count || 0), 0
        );

        batches.push({
          batch_id: `batch_${batches.length}`,
          ckb_ids: [ckb.ckb_id],
          ckb_count: 1,
          context,
          chunks,
          tokenCount,
          task
        });
      }
    }

    return batches;
  }

  /**
   * 计算共享节省
   * @private
   */
  _calculateSharedSavings(sharedChunks) {
    let totalSavings = 0;

    for (const shared of sharedChunks) {
      // 节省 = (CKB数量 - 1) * chunk的token数
      const chunkTokens = shared.representative.metadata?.token_count || 0;
      const savings = (shared.ckb_count - 1) * chunkTokens;
      totalSavings += savings;
    }

    return totalSavings;
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
}

module.exports = {
  BatchOptimizer
};
