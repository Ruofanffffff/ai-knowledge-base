/**
 * Semantic Scorer - 基于语义相似度的评分
 * 
 * 功能：
 * 1. 使用embedding模型计算文本语义向量
 * 2. 计算向量之间的余弦相似度
 * 3. 支持批量embedding计算
 * 4. 缓存embedding结果
 */

/**
 * 计算两个向量的余弦相似度
 * @param {Array<number>} vec1 - 向量1
 * @param {Array<number>} vec2 - 向量2
 * @returns {number} 余弦相似度 (0-1)
 */
function cosineSimilarity(vec1, vec2) {
  if (!vec1 || !vec2 || vec1.length !== vec2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  const denominator = Math.sqrt(norm1) * Math.sqrt(norm2);
  return denominator > 0 ? dotProduct / denominator : 0;
}

/**
 * 简单的TF-IDF向量化（作为embedding的fallback）
 * @param {string} text - 文本
 * @param {Map<string, number>} idfMap - IDF映射
 * @returns {Array<number>} TF-IDF向量
 */
function tfidfVectorize(text, idfMap) {
  if (!text || !idfMap || idfMap.size === 0) {
    return Array.from(idfMap?.keys() || []).map(() => 0);
  }
  
  // Tokenize: split Chinese characters individually, keep English words together
  const tokens = [];
  
  // Extract Chinese characters (one by one)
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  tokens.push(...chineseChars);
  
  // Extract English words (as whole words, lowercase)
  const englishWords = text.match(/[a-zA-Z]+/g) || [];
  tokens.push(...englishWords.map(w => w.toLowerCase()));
  
  // Extract numbers
  const numbers = text.match(/\d+/g) || [];
  tokens.push(...numbers);
  
  if (tokens.length === 0) {
    return Array.from(idfMap.keys()).map(() => 0);
  }
  
  const tf = new Map();
  
  // 计算词频
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  
  // 归一化TF
  for (const [token, count] of tf.entries()) {
    tf.set(token, count / tokens.length);
  }
  
  // 构建TF-IDF向量
  const vector = [];
  const vocab = Array.from(idfMap.keys()).sort();
  
  for (const token of vocab) {
    const tfValue = tf.get(token) || 0;
    const idfValue = idfMap.get(token) || 0;
    vector.push(tfValue * idfValue);
  }
  
  return vector;
}

class SemanticScorer {
  constructor(options = {}) {
    this.embeddingModel = options.embeddingModel || null;
    this.embeddingCache = new Map(); // text_hash -> embedding
    this.idfMap = null; // Fallback TF-IDF
    this.useFallback = !this.embeddingModel;
  }

  /**
   * 设置embedding模型
   * @param {Object} model - Embedding模型（需要实现embed方法）
   */
  setEmbeddingModel(model) {
    this.embeddingModel = model;
    this.useFallback = false;
  }

  /**
   * 预计算IDF（用于fallback）
   * @param {Array<string>} documents - 文档列表
   */
  precomputeIDF(documents) {
    const docFreq = new Map();
    const totalDocs = documents.length;

    for (const doc of documents) {
      // Use same tokenization as tfidfVectorize
      const tokens = [];
      
      // Extract Chinese characters (one by one)
      const chineseChars = doc.match(/[\u4e00-\u9fa5]/g) || [];
      tokens.push(...chineseChars);
      
      // Extract English words (as whole words, lowercase)
      const englishWords = doc.match(/[a-zA-Z]+/g) || [];
      tokens.push(...englishWords.map(w => w.toLowerCase()));
      
      // Extract numbers
      const numbers = doc.match(/\d+/g) || [];
      tokens.push(...numbers);
      
      const uniqueTokens = new Set(tokens);
      for (const token of uniqueTokens) {
        docFreq.set(token, (docFreq.get(token) || 0) + 1);
      }
    }

    this.idfMap = new Map();
    for (const [token, freq] of docFreq.entries()) {
      this.idfMap.set(token, Math.log(totalDocs / freq));
    }
  }

  /**
   * 获取文本的embedding
   * @param {string} text - 文本
   * @param {boolean} useCache - 是否使用缓存
   * @returns {Promise<Array<number>>} Embedding向量
   */
  async getEmbedding(text, useCache = true) {
    if (!text) {
      return [];
    }

    // 检查缓存
    const textHash = this._hashText(text);
    if (useCache && this.embeddingCache.has(textHash)) {
      return this.embeddingCache.get(textHash);
    }

    let embedding;

    if (this.useFallback || !this.embeddingModel) {
      // 使用TF-IDF作为fallback
      if (!this.idfMap) {
        throw new Error('IDF not computed. Call precomputeIDF() first.');
      }
      embedding = tfidfVectorize(text, this.idfMap);
    } else {
      // 使用embedding模型
      try {
        embedding = await this.embeddingModel.embed(text);
      } catch (error) {
        console.error('Embedding model error:', error);
        // Fallback to TF-IDF
        if (this.idfMap) {
          embedding = tfidfVectorize(text, this.idfMap);
        } else {
          throw error;
        }
      }
    }

    // 缓存
    if (useCache) {
      this.embeddingCache.set(textHash, embedding);
    }

    return embedding;
  }

  /**
   * 批量获取embeddings
   * @param {Array<string>} texts - 文本列表
   * @param {boolean} useCache - 是否使用缓存
   * @returns {Promise<Array<Array<number>>>} Embeddings
   */
  async getBatchEmbeddings(texts, useCache = true) {
    if (!texts || texts.length === 0) {
      return [];
    }

    // 检查哪些需要计算
    const toCompute = [];
    const results = new Array(texts.length);

    for (let i = 0; i < texts.length; i++) {
      const textHash = this._hashText(texts[i]);
      if (useCache && this.embeddingCache.has(textHash)) {
        results[i] = this.embeddingCache.get(textHash);
      } else {
        toCompute.push({ index: i, text: texts[i] });
      }
    }

    // 批量计算
    if (toCompute.length > 0) {
      if (this.useFallback || !this.embeddingModel) {
        // TF-IDF fallback
        if (!this.idfMap) {
          throw new Error('IDF not computed. Call precomputeIDF() first.');
        }
        for (const { index, text } of toCompute) {
          const embedding = tfidfVectorize(text, this.idfMap);
          results[index] = embedding;
          if (useCache) {
            this.embeddingCache.set(this._hashText(text), embedding);
          }
        }
      } else {
        // 使用embedding模型的批量接口（如果支持）
        try {
          const textsToEmbed = toCompute.map(item => item.text);
          let embeddings;

          if (this.embeddingModel.embedBatch) {
            embeddings = await this.embeddingModel.embedBatch(textsToEmbed);
          } else {
            // 串行计算
            embeddings = await Promise.all(
              textsToEmbed.map(text => this.embeddingModel.embed(text))
            );
          }

          for (let i = 0; i < toCompute.length; i++) {
            const { index, text } = toCompute[i];
            results[index] = embeddings[i];
            if (useCache) {
              this.embeddingCache.set(this._hashText(text), embeddings[i]);
            }
          }
        } catch (error) {
          console.error('Batch embedding error:', error);
          // Fallback to TF-IDF
          if (this.idfMap) {
            for (const { index, text } of toCompute) {
              const embedding = tfidfVectorize(text, this.idfMap);
              results[index] = embedding;
              if (useCache) {
                this.embeddingCache.set(this._hashText(text), embedding);
              }
            }
          } else {
            throw error;
          }
        }
      }
    }

    return results;
  }

  /**
   * 计算语义相似度
   * @param {string} text1 - 文本1
   * @param {string} text2 - 文本2
   * @returns {Promise<number>} 相似度 (0-1)
   */
  async computeSimilarity(text1, text2) {
    const [emb1, emb2] = await Promise.all([
      this.getEmbedding(text1),
      this.getEmbedding(text2)
    ]);

    return cosineSimilarity(emb1, emb2);
  }

  /**
   * 为chunks预计算embeddings
   * @param {Array<Object>} chunks - Chunks数组
   * @returns {Promise<Array<Object>>} 带embedding的chunks
   */
  async precomputeChunkEmbeddings(chunks) {
    const texts = chunks.map(chunk => chunk.text);
    const embeddings = await this.getBatchEmbeddings(texts);

    return chunks.map((chunk, i) => ({
      ...chunk,
      embedding: embeddings[i]
    }));
  }

  /**
   * 查找最相似的chunks
   * @param {string} query - 查询文本
   * @param {Array<Object>} chunks - Chunks数组（需要有embedding字段）
   * @param {Object} options - 选项
   * @returns {Promise<Array<Object>>} 排序后的chunks
   */
  async findSimilarChunks(query, chunks, options = {}) {
    const {
      topK = 5,
      threshold = 0.0
    } = options;

    // 获取查询的embedding
    const queryEmbedding = await this.getEmbedding(query);

    // 计算相似度
    const scoredChunks = chunks.map(chunk => {
      const similarity = chunk.embedding
        ? cosineSimilarity(queryEmbedding, chunk.embedding)
        : 0;

      return {
        ...chunk,
        semantic_similarity: similarity
      };
    });

    // 过滤和排序
    return scoredChunks
      .filter(chunk => chunk.semantic_similarity >= threshold)
      .sort((a, b) => b.semantic_similarity - a.semantic_similarity)
      .slice(0, topK);
  }

  /**
   * 生成文本哈希（用于缓存）
   * @private
   */
  _hashText(text) {
    // 简单哈希：使用前200个字符
    return text.substring(0, 200);
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.embeddingCache.clear();
  }

  /**
   * 获取缓存统计
   * @returns {Object} 缓存统计
   */
  getCacheStats() {
    return {
      cached_embeddings: this.embeddingCache.size,
      using_fallback: this.useFallback,
      has_idf: this.idfMap !== null
    };
  }
}

module.exports = {
  SemanticScorer,
  cosineSimilarity,
  tfidfVectorize
};
