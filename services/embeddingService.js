/**
 * EmbeddingService - 语义向量服务
 * 
 * 从 server.js 中抽取 generateEmbedding() 和 cosineSimilarity() 为独立模块，
 * 供碎片采集、主题发现、InsightPanel 提示等模块复用。
 */

require('dotenv').config();

class EmbeddingService {
  constructor() {
    this.modelConfig = {
      provider: 'aliyun',
      apiKey: process.env.QWEN_API_KEY || '',
      endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/embeddings/text-embedding/text-embedding',
      model: 'text-embedding-v3'
    };
  }

  /**
   * 生成文本嵌入向量
   * @param {string} text - 要生成嵌入的文本
   * @returns {Promise<number[] | null>} 嵌入向量，失败返回 null
   */
  async generateEmbedding(text) {
    if (!this.modelConfig.apiKey) {
      console.error('Embedding model not configured');
      return null;
    }

    try {
      const response = await fetch(this.modelConfig.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.modelConfig.apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-v3',
          input: {
            texts: [text]
          },
          parameters: {
            text_type: 'document'
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Embedding API error:', errorText);
        return null;
      }

      const data = await response.json();
      if (data.output && data.output.embeddings && data.output.embeddings.length > 0) {
        return data.output.embeddings[0].embedding;
      }
      return null;
    } catch (error) {
      console.error('Error generating embedding:', error);
      return null;
    }
  }

  /**
   * 计算余弦相似度
   * @param {number[]} vecA - 向量 A
   * @param {number[]} vecB - 向量 B
   * @returns {number} 余弦相似度值
   */
  cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 在候选列表中查找与给定 embedding 相似的项
   * @param {number[]} embedding - 查询向量
   * @param {Array<{id: string, embedding: number[]}>} candidates - 候选列表
   * @param {number} threshold - 相似度阈值
   * @returns {Promise<Array<{id: string, similarity: number}>>} 超过阈值的结果列表，按相似度降序
   */
  async findSimilar(embedding, candidates, threshold) {
    const results = [];

    for (const candidate of candidates) {
      if (!candidate.embedding || !Array.isArray(candidate.embedding)) {
        continue;
      }
      const similarity = this.cosineSimilarity(embedding, candidate.embedding);
      if (similarity >= threshold) {
        results.push({ id: candidate.id, similarity });
      }
    }

    return results.sort((a, b) => b.similarity - a.similarity);
  }
}

// 导出单例实例
const embeddingService = new EmbeddingService();
module.exports = embeddingService;
module.exports.EmbeddingService = EmbeddingService;
