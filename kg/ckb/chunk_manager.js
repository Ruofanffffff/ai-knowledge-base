/**
 * Chunk Manager - 管理CKB的智能分片
 * 
 * 功能：
 * 1. 将CKB文本分割为语义连贯的chunks
 * 2. 支持多种分片策略（paragraph, sentence, semantic, fixed-length）
 * 3. 提供chunk检索和相邻chunk获取
 */

const { SemanticScorer, cosineSimilarity } = require('./semantic_scorer');

/**
 * 计算文本在原文中的偏移量
 * @param {string} fullText - 完整文本
 * @param {string} fragment - 文本片段
 * @param {number} startFrom - 开始搜索位置
 * @returns {number} 偏移量
 */
function calculateOffset(fullText, fragment, startFrom = 0) {
  const index = fullText.indexOf(fragment, startFrom);
  return index >= 0 ? index : 0;
}

/**
 * 估算文本的token数量（简单估算：中文1字=1token，英文1词=1token）
 * @param {string} text - 文本
 * @returns {number} 估算的token数
 */
function estimateTokens(text) {
  if (!text) return 0;
  
  // 中文字符数
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  // 英文单词数（简单按空格分割）
  const englishWords = text.split(/\s+/).filter(word => 
    /[a-zA-Z]/.test(word)
  ).length;
  
  return chineseChars + englishWords;
}

class ChunkManager {
  constructor(options = {}) {
    // Chunk缓存：ckb_id -> chunks
    this.chunkCache = new Map();
    
    // Semantic scorer for semantic chunking
    this.semanticScorer = options.semanticScorer || new SemanticScorer();
  }

  /**
   * 将CKB文本分割为chunks
   * @param {Object} ckb - CKB对象
   * @param {Object} options - 分片选项
   * @param {string} options.strategy - 分片策略：'paragraph' | 'sentence' | 'semantic' | 'fixed'
   * @param {number} options.minLength - 最小chunk长度
   * @param {number} options.maxLength - 最大chunk长度
   * @param {number} options.overlap - 重叠字符数（仅用于fixed策略）
   * @param {number} options.similarityThreshold - 语义相似度阈值（仅用于semantic策略，默认0.7）
   * @param {number} options.windowSize - 滑动窗口大小（仅用于semantic策略，默认3）
   * @returns {Array<Object>} Chunks数组
   */
  async chunkCKB(ckb, options = {}) {
    const {
      strategy = 'paragraph',
      minLength = 50,
      maxLength = 500,
      overlap = 50,
      similarityThreshold = 0.7,
      windowSize = 3
    } = options;

    const text = ckb.content?.text || '';
    if (!text || text.length < minLength) {
      // 文本太短，返回单个chunk（不缓存）
      return [{
        chunk_id: `${ckb.ckb_id}_chunk_0`,
        ckb_id: ckb.ckb_id,
        text: text,
        start_offset: 0,
        end_offset: text.length,
        chunk_type: 'full_text',
        chunk_index: 0,
        metadata: {
          token_count: estimateTokens(text),
          char_count: text.length,
          sentence_count: this._countSentences(text)
        }
      }];
    }

    let chunks = [];
    
    switch (strategy) {
      case 'paragraph':
        chunks = this._chunkByParagraph(text, minLength, maxLength);
        break;
      case 'sentence':
        chunks = this._chunkBySentence(text, minLength, maxLength);
        break;
      case 'semantic':
        chunks = await this._chunkBySemantic(text, minLength, maxLength, similarityThreshold, windowSize);
        break;
      case 'fixed':
        chunks = this._chunkByFixedLength(text, maxLength, overlap);
        break;
      default:
        throw new Error(`Unknown chunking strategy: ${strategy}`);
    }

    // 添加CKB ID和chunk ID
    chunks = chunks.map((chunk, index) => ({
      ...chunk,
      chunk_id: `${ckb.ckb_id}_chunk_${index}`,
      ckb_id: ckb.ckb_id,
      chunk_index: index,
      metadata: {
        ...chunk.metadata,
        token_count: estimateTokens(chunk.text),
        char_count: chunk.text.length
      }
    }));

    // 缓存chunks
    this.chunkCache.set(ckb.ckb_id, chunks);

    return chunks;
  }

  /**
   * 按段落分片（默认策略）
   * @private
   */
  _chunkByParagraph(text, minLength, maxLength) {
    // 按双换行符分割段落
    const paragraphs = text.split(/\n\n+/);
    const chunks = [];
    let currentOffset = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const para = paragraphs[i];
      const trimmed = para.trim();
      if (!trimmed) {
        currentOffset += para.length + 2; // +2 for \n\n
        continue;
      }

      const actualOffset = text.indexOf(trimmed, currentOffset);
      
      if (trimmed.length < minLength) {
        // 段落太短，尝试与上一段合并
        if (chunks.length > 0 && chunks[chunks.length - 1].text.length + trimmed.length < maxLength) {
          const lastChunk = chunks[chunks.length - 1];
          lastChunk.text += '\n\n' + trimmed;
          lastChunk.end_offset = actualOffset + trimmed.length;
          lastChunk.metadata.sentence_count += this._countSentences(trimmed);
        } else {
          // 无法合并，单独成chunk
          chunks.push({
            text: trimmed,
            start_offset: actualOffset,
            end_offset: actualOffset + trimmed.length,
            chunk_type: 'paragraph',
            metadata: {
              paragraph_index: chunks.length,
              sentence_count: this._countSentences(trimmed)
            }
          });
        }
      } else if (trimmed.length > maxLength) {
        // 段落太长，按句子分割
        const sentences = this._splitIntoSentences(trimmed);
        let currentChunk = { text: '', start_offset: actualOffset, sentences: [] };
        
        for (const sentence of sentences) {
          if (currentChunk.text.length + sentence.length > maxLength && currentChunk.text.length > 0) {
            // 当前chunk已满，保存并开始新chunk
            const chunkEndOffset = actualOffset + currentChunk.text.length;
            chunks.push({
              text: currentChunk.text.trim(),
              start_offset: currentChunk.start_offset,
              end_offset: chunkEndOffset,
              chunk_type: 'paragraph',
              metadata: {
                paragraph_index: chunks.length,
                sentence_count: currentChunk.sentences.length
              }
            });
            currentChunk = { text: '', start_offset: chunkEndOffset, sentences: [] };
          }
          currentChunk.text += sentence;
          currentChunk.sentences.push(sentence);
        }
        
        // 保存最后一个chunk
        if (currentChunk.text.trim()) {
          chunks.push({
            text: currentChunk.text.trim(),
            start_offset: currentChunk.start_offset,
            end_offset: actualOffset + trimmed.length,
            chunk_type: 'paragraph',
            metadata: {
              paragraph_index: chunks.length,
              sentence_count: currentChunk.sentences.length
            }
          });
        }
      } else {
        // 段落长度适中
        chunks.push({
          text: trimmed,
          start_offset: actualOffset,
          end_offset: actualOffset + trimmed.length,
          chunk_type: 'paragraph',
          metadata: {
            paragraph_index: chunks.length,
            sentence_count: this._countSentences(trimmed)
          }
        });
      }

      currentOffset = actualOffset + trimmed.length;
    }

    return chunks;
  }

  /**
   * 按句子分片
   * @private
   */
  _chunkBySentence(text, minLength, maxLength) {
    const sentences = this._splitIntoSentences(text);
    const chunks = [];
    let currentChunk = { text: '', start_offset: 0, sentences: [] };
    let currentOffset = 0;

    for (const sentence of sentences) {
      const sentenceStart = text.indexOf(sentence, currentOffset);
      
      if (currentChunk.text.length + sentence.length > maxLength && currentChunk.text.length >= minLength) {
        // 当前chunk已满，保存并开始新chunk
        chunks.push({
          text: currentChunk.text.trim(),
          start_offset: currentChunk.start_offset,
          end_offset: sentenceStart,
          chunk_type: 'sentence',
          metadata: {
            sentence_count: currentChunk.sentences.length
          }
        });
        currentChunk = { text: '', start_offset: sentenceStart, sentences: [] };
      }
      
      if (currentChunk.text === '') {
        currentChunk.start_offset = sentenceStart;
      }
      
      currentChunk.text += sentence;
      currentChunk.sentences.push(sentence);
      currentOffset = sentenceStart + sentence.length;
    }

    // 保存最后一个chunk
    if (currentChunk.text.trim()) {
      chunks.push({
        text: currentChunk.text.trim(),
        start_offset: currentChunk.start_offset,
        end_offset: currentOffset,
        chunk_type: 'sentence',
        metadata: {
          sentence_count: currentChunk.sentences.length
        }
      });
    }

    return chunks;
  }

  /**
   * 按固定长度分片（兜底策略）
   * @private
   */
  _chunkByFixedLength(text, maxLength, overlap) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      let end = Math.min(start + maxLength, text.length);
      
      // 尝试在句子边界处切断
      if (end < text.length) {
        const sentenceEnd = this._findSentenceBoundary(text, end);
        if (sentenceEnd > start + maxLength / 2) {
          end = sentenceEnd;
        }
      }

      const chunkText = text.substring(start, end).trim();
      if (chunkText) {
        chunks.push({
          text: chunkText,
          start_offset: start,
          end_offset: end,
          chunk_type: 'fixed_length',
          metadata: {
            sentence_count: this._countSentences(chunkText)
          }
        });
      }

      start = end - overlap;
      if (start >= text.length - overlap) break;
    }

    return chunks;
  }

  /**
   * 按语义相似度分片（适用于长文本）
   * 使用滑动窗口和相似度阈值来识别语义边界
   * @private
   */
  async _chunkBySemantic(text, minLength, maxLength, similarityThreshold, windowSize) {
    // Step 1: 先按句子分割
    const sentences = this._splitIntoSentences(text);
    
    if (sentences.length <= 1) {
      // 只有一个句子，直接返回
      return [{
        text: text.trim(),
        start_offset: 0,
        end_offset: text.length,
        chunk_type: 'semantic',
        metadata: {
          sentence_count: 1,
          avg_similarity: 1.0
        }
      }];
    }

    // Step 2: 预计算IDF（如果还没有）
    if (!this.semanticScorer.idfMap) {
      this.semanticScorer.precomputeIDF(sentences);
    }

    // Step 3: 计算每个句子的embedding
    const embeddings = await this.semanticScorer.getBatchEmbeddings(sentences);

    // Step 4: 使用滑动窗口计算相邻句子的相似度
    const similarities = [];
    for (let i = 0; i < sentences.length - 1; i++) {
      const similarity = cosineSimilarity(embeddings[i], embeddings[i + 1]);
      similarities.push(similarity);
    }

    // Step 5: 识别语义边界（相似度低于阈值的位置）
    const boundaries = [0]; // 起始边界
    
    for (let i = 0; i < similarities.length; i++) {
      // 使用滑动窗口平滑相似度
      const windowStart = Math.max(0, i - Math.floor(windowSize / 2));
      const windowEnd = Math.min(similarities.length, i + Math.ceil(windowSize / 2));
      const windowSimilarities = similarities.slice(windowStart, windowEnd);
      const avgSimilarity = windowSimilarities.reduce((sum, s) => sum + s, 0) / windowSimilarities.length;
      
      // 如果平均相似度低于阈值，标记为边界
      if (avgSimilarity < similarityThreshold) {
        boundaries.push(i + 1);
      }
    }
    
    boundaries.push(sentences.length); // 结束边界

    // Step 6: 根据边界构建chunks
    const chunks = [];
    let currentOffset = 0;

    for (let i = 0; i < boundaries.length - 1; i++) {
      const startIdx = boundaries[i];
      const endIdx = boundaries[i + 1];
      const chunkSentences = sentences.slice(startIdx, endIdx);
      const chunkText = chunkSentences.join('');
      
      // 计算chunk在原文中的位置
      const chunkStart = text.indexOf(chunkSentences[0], currentOffset);
      const chunkEnd = chunkStart + chunkText.length;
      
      // 计算chunk内的平均相似度
      const chunkSimilarities = similarities.slice(startIdx, endIdx - 1);
      const avgSimilarity = chunkSimilarities.length > 0
        ? chunkSimilarities.reduce((sum, s) => sum + s, 0) / chunkSimilarities.length
        : 1.0;

      // 检查chunk长度
      if (chunkText.trim().length < minLength && chunks.length > 0) {
        // 太短，与上一个chunk合并
        const lastChunk = chunks[chunks.length - 1];
        lastChunk.text += chunkText;
        lastChunk.end_offset = chunkEnd;
        lastChunk.metadata.sentence_count += chunkSentences.length;
        lastChunk.metadata.avg_similarity = (lastChunk.metadata.avg_similarity + avgSimilarity) / 2;
      } else if (chunkText.trim().length > maxLength) {
        // 太长，按固定长度分割
        const subChunks = this._chunkByFixedLength(chunkText, maxLength, 50);
        for (const subChunk of subChunks) {
          chunks.push({
            text: subChunk.text,
            start_offset: chunkStart + subChunk.start_offset,
            end_offset: chunkStart + subChunk.end_offset,
            chunk_type: 'semantic',
            metadata: {
              sentence_count: subChunk.metadata.sentence_count,
              avg_similarity: avgSimilarity
            }
          });
        }
      } else {
        // 长度适中
        chunks.push({
          text: chunkText.trim(),
          start_offset: chunkStart,
          end_offset: chunkEnd,
          chunk_type: 'semantic',
          metadata: {
            sentence_count: chunkSentences.length,
            avg_similarity: avgSimilarity
          }
        });
      }

      currentOffset = chunkEnd;
    }

    return chunks;
  }

  /**
   * 分割文本为句子
   * @private
   */
  _splitIntoSentences(text) {
    // 简单的句子分割（支持中英文）
    // 中文：。！？
    // 英文：. ! ?
    const sentenceRegex = /[^。！？.!?]+[。！？.!?]+/g;
    const sentences = text.match(sentenceRegex) || [];
    
    // 处理最后可能没有标点的部分
    const lastSentenceEnd = sentences.join('').length;
    if (lastSentenceEnd < text.length) {
      const remaining = text.substring(lastSentenceEnd).trim();
      if (remaining) {
        sentences.push(remaining);
      }
    }
    
    return sentences;
  }

  /**
   * 计算句子数量
   * @private
   */
  _countSentences(text) {
    const sentences = this._splitIntoSentences(text);
    return sentences.length;
  }

  /**
   * 查找句子边界
   * @private
   */
  _findSentenceBoundary(text, position) {
    // 向后查找最近的句子结束符
    const sentenceEnders = ['。', '！', '？', '.', '!', '?'];
    for (let i = position; i < Math.min(position + 100, text.length); i++) {
      if (sentenceEnders.includes(text[i])) {
        return i + 1;
      }
    }
    return position;
  }

  /**
   * 根据chunk_ids检索chunks
   * @param {Array<string>} chunkIds - Chunk IDs
   * @returns {Promise<Array<Object>>} Chunks
   */
  async getChunks(chunkIds) {
    if (!chunkIds || chunkIds.length === 0) {
      return [];
    }

    const chunks = [];
    const ckbChunksMap = new Map();

    // 按CKB ID分组
    for (const chunkId of chunkIds) {
      const ckbId = chunkId.split('_chunk_')[0];
      if (!ckbChunksMap.has(ckbId)) {
        ckbChunksMap.set(ckbId, []);
      }
      ckbChunksMap.get(ckbId).push(chunkId);
    }

    // 从缓存中获取chunks
    for (const [ckbId, ids] of ckbChunksMap.entries()) {
      const cachedChunks = this.chunkCache.get(ckbId);
      if (cachedChunks) {
        for (const id of ids) {
          const chunk = cachedChunks.find(c => c.chunk_id === id);
          if (chunk) {
            chunks.push(chunk);
          }
        }
      }
    }

    return chunks;
  }

  /**
   * 获取chunk的相邻chunks
   * @param {string} chunkId - Chunk ID
   * @param {number} window - 窗口大小（前后各N个）
   * @returns {Promise<Array<Object>>} 相邻chunks
   */
  async getAdjacentChunks(chunkId, window = 1) {
    const ckbId = chunkId.split('_chunk_')[0];
    const chunkIndex = parseInt(chunkId.split('_chunk_')[1]);

    const cachedChunks = this.chunkCache.get(ckbId);
    if (!cachedChunks) {
      return [];
    }

    const adjacentChunks = [];
    const startIndex = Math.max(0, chunkIndex - window);
    const endIndex = Math.min(cachedChunks.length - 1, chunkIndex + window);

    for (let i = startIndex; i <= endIndex; i++) {
      if (i !== chunkIndex) {
        adjacentChunks.push(cachedChunks[i]);
      }
    }

    return adjacentChunks;
  }

  /**
   * 清除缓存
   * @param {string} ckbId - CKB ID（可选，不提供则清除所有）
   */
  clearCache(ckbId = null) {
    if (ckbId) {
      this.chunkCache.delete(ckbId);
    } else {
      this.chunkCache.clear();
    }
  }

  /**
   * 获取缓存统计
   * @returns {Object} 缓存统计信息
   */
  getCacheStats() {
    let totalChunks = 0;
    for (const chunks of this.chunkCache.values()) {
      totalChunks += chunks.length;
    }

    return {
      cached_ckbs: this.chunkCache.size,
      total_chunks: totalChunks,
      avg_chunks_per_ckb: this.chunkCache.size > 0 ? totalChunks / this.chunkCache.size : 0
    };
  }
}

module.exports = {
  ChunkManager,
  estimateTokens,
  calculateOffset
};
