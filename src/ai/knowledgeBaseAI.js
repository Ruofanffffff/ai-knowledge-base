const { SentenceTransformer } = require('sentence-transformers');
const { NLP } = require('nlpjs');
const { ChromaClient } = require('chromadb');

// 初始化AI模型和向量数据库
class KnowledgeBaseAI {
  constructor() {
    this.model = null;
    this.client = null;
    this.collection = null;
    this.nlp = null;
    this.isInitialized = false;
  }

  // 初始化所有AI服务
  async initialize() {
    try {
      console.log('Initializing AI services...');
      
      // 1. 初始化嵌入模型
      this.model = new SentenceTransformer('all-MiniLM-L6-v2', {
        device: 'cpu',
        cacheFolder: './models'
      });
      
      // 2. 初始化向量数据库
      this.client = new ChromaClient();
      this.collection = await this.client.createCollection({
        name: 'knowledge_base',
        metadata: { 'hnsw:space': 'cosine' }
      });
      
      // 3. 初始化NLP模型
      this.nlp = new NLP();
      await this.nlp.load({ languages: ['zh', 'en'] });
      
      this.isInitialized = true;
      console.log('AI services initialized successfully');
    } catch (error) {
      console.error('Failed to initialize AI services:', error);
      throw error;
    }
  }

  // 语义搜索
  async semanticSearch(query, topK = 10) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      // 生成查询嵌入
      const queryEmbedding = await this.model.encode([query]);
      
      // 搜索相似文档
      const results = await this.collection.query({
        queryEmbeddings: queryEmbedding,
        nResults: topK,
        include: ['documents', 'metadatas', 'distances']
      });
      
      // 格式化结果
      return results.ids[0].map((id, index) => ({
        id,
        contentId: results.metadatas[0][index].contentId,
        chunk: results.documents[0][index],
        score: 1 - results.distances[0][index] // 转换为相似度分数
      }));
    } catch (error) {
      console.error('Semantic search failed:', error);
      throw error;
    }
  }

  // 智能标签生成
  async generateTags(content, topN = 5) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      // 使用NLP提取关键词
      const result = await this.nlp.process('zh', content);
      const keywords = [];
      
      // 提取实体
      if (result.entities) {
        keywords.push(...result.entities.map(entity => entity.sourceText));
      }
      
      // 提取自定义关键词（名词短语）
      const customKeywords = this.extractNounPhrases(content);
      keywords.push(...customKeywords);
      
      // 去重并排序
      const uniqueKeywords = [...new Set(keywords)];
      
      // 计算关键词重要性（简化实现）
      const keywordScores = uniqueKeywords.map(keyword => ({
        keyword,
        score: this.calculateKeywordScore(keyword, content)
      }));
      
      // 返回前N个关键词
      return keywordScores
        .sort((a, b) => b.score - a.score)
        .slice(0, topN)
        .map(item => item.keyword);
    } catch (error) {
      console.error('Tag generation failed:', error);
      throw error;
    }
  }

  // 实体识别与关系抽取
  async extractEntitiesAndRelations(content) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      const entities = [];
      const relations = [];
      
      // 使用NLP.js识别实体
      const result = await this.nlp.process('zh', content);
      
      if (result.entities) {
        entities.push(...result.entities.map(entity => ({
          text: entity.sourceText,
          type: entity.entity,
          confidence: entity.score
        })));
      }
      
      // 提取自定义实体（概念、项目等）
      const customEntities = this.extractCustomEntities(content);
      entities.push(...customEntities);
      
      // 提取实体关系（简化实现）
      relations.push(...this.extractRelations(content, entities));
      
      return { entities, relations };
    } catch (error) {
      console.error('Entity and relation extraction failed:', error);
      throw error;
    }
  }

  // 向向量数据库添加文档
  async addDocumentToVectorDB(id, content, metadata = {}) {
    try {
      if (!this.isInitialized) await this.initialize();
      
      // 将文档分割成块（简化实现）
      const chunks = this.splitDocument(content);
      
      // 生成嵌入
      const embeddings = await this.model.encode(chunks);
      
      // 构建元数据
      const metadatas = chunks.map((chunk, index) => ({
        contentId: id,
        chunkIndex: index,
        ...metadata
      }));
      
      // 添加到向量数据库
      await this.collection.add({
        ids: chunks.map((_, index) => `${id}_${index}`),
        documents: chunks,
        embeddings,
        metadatas
      });
      
      return chunks.length;
    } catch (error) {
      console.error('Failed to add document to vector DB:', error);
      throw error;
    }
  }

  // 辅助方法：分割文档
  splitDocument(content, chunkSize = 1000) {
    const chunks = [];
    for (let i = 0; i < content.length; i += chunkSize) {
      chunks.push(content.slice(i, i + chunkSize));
    }
    return chunks;
  }

  // 辅助方法：提取名词短语
  extractNounPhrases(text) {
    // 简化实现：提取连续的中文词语
    const regex = /(?:[\u4e00-\u9fa5]+[的]?){2,}/g;
    const matches = text.match(regex) || [];
    return matches;
  }

  // 辅助方法：计算关键词分数
  calculateKeywordScore(keyword, content) {
    // 简化实现：基于出现频率计算分数
    const regex = new RegExp(keyword, 'g');
    const matches = content.match(regex) || [];
    return matches.length;
  }

  // 辅助方法：提取自定义实体
  extractCustomEntities(content) {
    const entities = [];
    // 概念识别
    const conceptRegex = /(?:[\u4e00-\u9fa5]+[的]?){2,}/g;
    let match;
    while ((match = conceptRegex.exec(content)) !== null) {
      entities.push({
        text: match[0],
        type: 'CONCEPT',
        confidence: 0.8
      });
    }
    // 项目识别（简化实现）
    const projectRegex = /项目[\u4e00-\u9fa5]+/g;
    while ((match = projectRegex.exec(content)) !== null) {
      entities.push({
        text: match[0],
        type: 'PROJECT',
        confidence: 0.7
      });
    }
    return entities;
  }

  // 辅助方法：提取实体关系
  extractRelations(content, entities) {
    const relations = [];
    
    // 生成所有实体对
    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        const entity1 = entities[i];
        const entity2 = entities[j];
        
        // 计算共现频率
        const cooccurrence = this.calculateCooccurrence(content, entity1.text, entity2.text);
        
        if (cooccurrence > 0) {
          relations.push({
            source: entity1.text,
            target: entity2.text,
            type: 'ASSOCIATION',
            strength: Math.min(cooccurrence / 10, 1.0) // 归一化到0-1
          });
        }
      }
    }
    
    return relations;
  }

  // 辅助方法：计算共现频率
  calculateCooccurrence(text, term1, term2) {
    const lines = text.split(/[\n\r]/);
    let count = 0;
    
    for (const line of lines) {
      if (line.includes(term1) && line.includes(term2)) {
        count++;
      }
    }
    
    return count;
  }
}

module.exports = KnowledgeBaseAI;