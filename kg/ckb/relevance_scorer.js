/**
 * Relevance Scorer - 评估chunk与查询的相关性
 * 
 * 功能：
 * 1. Keyword-based scoring（关键词匹配）
 * 2. TF-IDF scoring（词频-逆文档频率）
 * 3. Semantic scoring（语义相似度）
 * 4. Hybrid scoring（混合评分）
 */

const { SemanticScorer } = require('./semantic_scorer');

/**
 * 分词（简单实现：中文按字，英文按词）
 * @param {string} text - 文本
 * @returns {Array<string>} 词列表
 */
function tokenize(text) {
  if (!text) return [];
  
  const tokens = [];
  
  // 提取中文字符
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || [];
  tokens.push(...chineseChars);
  
  // 提取英文单词（转小写）
  const englishWords = text.match(/[a-zA-Z]+/g) || [];
  tokens.push(...englishWords.map(w => w.toLowerCase()));
  
  // 提取数字
  const numbers = text.match(/\d+/g) || [];
  tokens.push(...numbers);
  
  return tokens;
}

/**
 * 计算词频（Term Frequency）
 * @param {Array<string>} tokens - 词列表
 * @returns {Map<string, number>} 词频映射
 */
function calculateTF(tokens) {
  const tf = new Map();
  const totalTokens = tokens.length;
  
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }
  
  // 归一化：词频 / 总词数
  for (const [token, count] of tf.entries()) {
    tf.set(token, count / totalTokens);
  }
  
  return tf;
}

/**
 * 计算逆文档频率（Inverse Document Frequency）
 * @param {Array<Array<string>>} documents - 文档列表（每个文档是词列表）
 * @returns {Map<string, number>} IDF映射
 */
function calculateIDF(documents) {
  const idf = new Map();
  const totalDocs = documents.length;
  
  // 统计每个词出现在多少个文档中
  const docFreq = new Map();
  for (const doc of documents) {
    const uniqueTokens = new Set(doc);
    for (const token of uniqueTokens) {
      docFreq.set(token, (docFreq.get(token) || 0) + 1);
    }
  }
  
  // 计算IDF：log(总文档数 / 包含该词的文档数)
  for (const [token, freq] of docFreq.entries()) {
    idf.set(token, Math.log(totalDocs / freq));
  }
  
  return idf;
}

class RelevanceScorer {
  constructor(options = {}) {
    // 评分缓存：query_hash -> chunk_id -> score
    this.scoreCache = new Map();
    
    // IDF缓存（用于TF-IDF）
    this.idfCache = null;
    this.corpusTokens = [];
    
    // 语义评分器
    this.semanticScorer = options.semanticScorer || new SemanticScorer(options);
  }

  /**
   * 预计算语料库的IDF
   * @param {Array<Object>} chunks - Chunks数组
   */
  precomputeIDF(chunks) {
    this.corpusTokens = chunks.map(chunk => tokenize(chunk.text));
    this.idfCache = calculateIDF(this.corpusTokens);
  }

  /**
   * 关键词匹配评分
   * @param {string} query - 查询文本
   * @param {Object} chunk - Chunk对象
   * @returns {number} 评分（0-1）
   */
  scoreByKeyword(query, chunk) {
    const queryTokens = new Set(tokenize(query));
    const chunkTokens = new Set(tokenize(chunk.text));
    
    if (queryTokens.size === 0) return 0;
    
    // 计算交集
    let matchCount = 0;
    for (const token of queryTokens) {
      if (chunkTokens.has(token)) {
        matchCount++;
      }
    }
    
    // Jaccard相似度：交集 / 并集
    const unionSize = queryTokens.size + chunkTokens.size - matchCount;
    const jaccardScore = unionSize > 0 ? matchCount / unionSize : 0;
    
    // 也考虑匹配率：匹配的查询词 / 总查询词
    const matchRate = matchCount / queryTokens.size;
    
    // 混合：70% Jaccard + 30% 匹配率
    return jaccardScore * 0.7 + matchRate * 0.3;
  }

  /**
   * TF-IDF评分
   * @param {string} query - 查询文本
   * @param {Object} chunk - Chunk对象
   * @param {number} chunkIndex - Chunk在语料库中的索引
   * @returns {number} 评分
   */
  scoreByTFIDF(query, chunk, chunkIndex = null) {
    if (!this.idfCache) {
      // 如果没有预计算IDF，使用简单的TF评分
      return this._simpleTFScore(query, chunk);
    }
    
    const queryTokens = tokenize(query);
    const chunkTokens = chunkIndex !== null && chunkIndex < this.corpusTokens.length
      ? this.corpusTokens[chunkIndex]
      : tokenize(chunk.text);
    
    const chunkTF = calculateTF(chunkTokens);
    
    // 计算查询向量和文档向量的余弦相似度
    let dotProduct = 0;
    let queryNorm = 0;
    let chunkNorm = 0;
    
    for (const token of queryTokens) {
      const idf = this.idfCache.get(token) || 0;
      const tf = chunkTF.get(token) || 0;
      const tfidf = tf * idf;
      
      dotProduct += idf * tfidf;  // 查询词权重 = IDF
      queryNorm += idf * idf;
      chunkNorm += tfidf * tfidf;
    }
    
    // 余弦相似度
    const denominator = Math.sqrt(queryNorm) * Math.sqrt(chunkNorm);
    return denominator > 0 ? dotProduct / denominator : 0;
  }

  /**
   * 简单TF评分（当没有IDF时）
   * @private
   */
  _simpleTFScore(query, chunk) {
    const queryTokens = tokenize(query);
    const chunkTokens = tokenize(chunk.text);
    const chunkTF = calculateTF(chunkTokens);
    
    let totalScore = 0;
    for (const token of queryTokens) {
      totalScore += chunkTF.get(token) || 0;
    }
    
    return queryTokens.length > 0 ? totalScore / queryTokens.length : 0;
  }

  /**
   * 混合评分（Keyword + TF-IDF）
   * @param {string} query - 查询文本
   * @param {Object} chunk - Chunk对象
   * @param {Object} options - 选项
   * @param {number} options.keywordWeight - 关键词权重（默认0.4）
   * @param {number} options.tfidfWeight - TF-IDF权重（默认0.6）
   * @param {number} options.chunkIndex - Chunk索引（用于TF-IDF）
   * @returns {number} 评分（0-1）
   */
  scoreHybrid(query, chunk, options = {}) {
    const {
      keywordWeight = 0.4,
      tfidfWeight = 0.6,
      chunkIndex = null
    } = options;
    
    const keywordScore = this.scoreByKeyword(query, chunk);
    const tfidfScore = this.scoreByTFIDF(query, chunk, chunkIndex);
    
    return keywordScore * keywordWeight + tfidfScore * tfidfWeight;
  }

  /**
   * 语义相似度评分
   * @param {string} query - 查询文本
   * @param {Object} chunk - Chunk对象
   * @returns {Promise<number>} 评分（0-1）
   */
  async scoreBySemantic(query, chunk) {
    // 如果chunk已有embedding，直接使用
    if (chunk.embedding) {
      const queryEmbedding = await this.semanticScorer.getEmbedding(query);
      const { cosineSimilarity } = require('./semantic_scorer');
      return cosineSimilarity(queryEmbedding, chunk.embedding);
    }
    
    // 否则计算相似度
    return await this.semanticScorer.computeSimilarity(query, chunk.text);
  }

  /**
   * 混合评分（Keyword + TF-IDF + Semantic）
   * @param {string} query - 查询文本
   * @param {Object} chunk - Chunk对象
   * @param {Object} options - 选项
   * @param {number} options.keywordWeight - 关键词权重（默认0.3）
   * @param {number} options.tfidfWeight - TF-IDF权重（默认0.3）
   * @param {number} options.semanticWeight - 语义权重（默认0.4）
   * @param {number} options.chunkIndex - Chunk索引（用于TF-IDF）
   * @returns {Promise<number>} 评分（0-1）
   */
  async scoreHybridWithSemantic(query, chunk, options = {}) {
    const {
      keywordWeight = 0.3,
      tfidfWeight = 0.3,
      semanticWeight = 0.4,
      chunkIndex = null
    } = options;
    
    const keywordScore = this.scoreByKeyword(query, chunk);
    const tfidfScore = this.scoreByTFIDF(query, chunk, chunkIndex);
    const semanticScore = await this.scoreBySemantic(query, chunk);
    
    return keywordScore * keywordWeight + 
           tfidfScore * tfidfWeight + 
           semanticScore * semanticWeight;
  }

  /**
   * 批量评分
   * @param {string} query - 查询文本
   * @param {Array<Object>} chunks - Chunks数组
   * @param {Object} options - 选项
   * @param {string} options.method - 评分方法：'keyword' | 'tfidf' | 'hybrid' | 'semantic' | 'hybrid_semantic'
   * @param {boolean} options.useCache - 是否使用缓存
   * @returns {Promise<Array<Object>>} 带评分的chunks
   */
  async scoreChunks(query, chunks, options = {}) {
    const {
      method = 'hybrid',
      useCache = true
    } = options;
    
    // 生成查询哈希（用于缓存）
    const queryHash = this._hashQuery(query);
    
    // 检查缓存
    if (useCache && this.scoreCache.has(queryHash)) {
      const cachedScores = this.scoreCache.get(queryHash);
      return chunks.map(chunk => ({
        ...chunk,
        relevance_score: cachedScores.get(chunk.chunk_id) || 0
      }));
    }
    
    // 如果使用TF-IDF且没有预计算IDF，先预计算
    if ((method === 'tfidf' || method === 'hybrid' || method === 'hybrid_semantic') && !this.idfCache) {
      this.precomputeIDF(chunks);
    }
    
    // 如果使用语义评分，预计算embeddings
    if ((method === 'semantic' || method === 'hybrid_semantic') && !chunks[0]?.embedding) {
      chunks = await this.semanticScorer.precomputeChunkEmbeddings(chunks);
    }
    
    // 评分
    let scoredChunks;
    
    if (method === 'semantic' || method === 'hybrid_semantic') {
      // 异步评分
      scoredChunks = await Promise.all(chunks.map(async (chunk, index) => {
        let score = 0;
        
        switch (method) {
          case 'semantic':
            score = await this.scoreBySemantic(query, chunk);
            break;
          case 'hybrid_semantic':
            score = await this.scoreHybridWithSemantic(query, chunk, { chunkIndex: index });
            break;
        }
        
        return {
          ...chunk,
          relevance_score: score
        };
      }));
    } else {
      // 同步评分
      scoredChunks = chunks.map((chunk, index) => {
        let score = 0;
        
        switch (method) {
          case 'keyword':
            score = this.scoreByKeyword(query, chunk);
            break;
          case 'tfidf':
            score = this.scoreByTFIDF(query, chunk, index);
            break;
          case 'hybrid':
            score = this.scoreHybrid(query, chunk, { chunkIndex: index });
            break;
          default:
            throw new Error(`Unknown scoring method: ${method}`);
        }
        
        return {
          ...chunk,
          relevance_score: score
        };
      });
    }
    
    // 缓存评分
    if (useCache) {
      const scoreMap = new Map();
      for (const chunk of scoredChunks) {
        scoreMap.set(chunk.chunk_id, chunk.relevance_score);
      }
      this.scoreCache.set(queryHash, scoreMap);
    }
    
    return scoredChunks;
  }

  /**
   * 选择最相关的chunks
   * @param {string} query - 查询文本
   * @param {Array<Object>} chunks - Chunks数组
   * @param {Object} options - 选项
   * @param {number} options.topK - 返回前K个
   * @param {number} options.threshold - 最低相关性阈值
   * @param {string} options.method - 评分方法
   * @returns {Promise<Array<Object>>} 最相关的chunks
   */
  async selectRelevantChunks(query, chunks, options = {}) {
    const {
      topK = 5,
      threshold = 0.1,
      method = 'hybrid'
    } = options;
    
    // 评分
    const scoredChunks = await this.scoreChunks(query, chunks, { method });
    
    // 过滤和排序
    const relevantChunks = scoredChunks
      .filter(chunk => chunk.relevance_score >= threshold)
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, topK);
    
    return relevantChunks;
  }

  /**
   * 生成查询哈希（用于缓存）
   * @private
   */
  _hashQuery(query) {
    // 简单哈希：使用查询文本的前100个字符
    return query.substring(0, 100);
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.scoreCache.clear();
    this.idfCache = null;
    this.corpusTokens = [];
    this.semanticScorer.clearCache();
  }

  /**
   * 获取缓存统计
   * @returns {Object} 缓存统计信息
   */
  getCacheStats() {
    return {
      cached_queries: this.scoreCache.size,
      idf_computed: this.idfCache !== null,
      corpus_size: this.corpusTokens.length,
      semantic_stats: this.semanticScorer.getCacheStats()
    };
  }
}

module.exports = {
  RelevanceScorer,
  tokenize,
  calculateTF,
  calculateIDF
};
