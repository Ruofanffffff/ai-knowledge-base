/**
 * AI Service
 * Business logic for AI operations
 */

const { CLOUD_MODELS, LOCAL_MODELS, OLLAMA_API_URL } = require('../config/models');

class AIService {
  constructor(kgService) {
    this.kgService = kgService;
  }

  async semanticSearch(query, topK = 10, userId) {
    try {
      const kg = require('../kg');
      const graphData = await kg.kgService?.search(query, topK) || { nodes: [], links: [] };
      
      const documents = await this._getDocumentsByEntities(graphData.nodes, userId);
      
      return {
        documents,
        answer: await this._generateAnswer(query, graphData),
        sources: graphData.nodes.slice(0, 5).map(n => n.label),
      };
    } catch (error) {
      console.error('Semantic search error:', error);
      throw error;
    }
  }

  async summarizeDocument(documentId, model, userId) {
    try {
      const document = await this._getDocumentById(documentId, userId);
      if (!document) {
        throw new Error('Document not found');
      }

      const prompt = `请总结以下文档内容：\n\n${document.content}`;
      const summary = await this._callModel(model, prompt);
      
      await this._saveSummary(documentId, model, summary, userId);
      
      return summary;
    } catch (error) {
      console.error('Summarize error:', error);
      throw error;
    }
  }

  async classifyDocument(documentId, userId) {
    try {
      const document = await this._getDocumentById(documentId, userId);
      if (!document) {
        throw new Error('Document not found');
      }

      const prompt = `请为以下文档选择合适的分类：\n\n标题：${document.title}\n内容：${document.content.substring(0, 500)}`;
      const classification = await this._callModel('deepseek-chat', prompt);
      
      return { classification };
    } catch (error) {
      console.error('Classify error:', error);
      throw error;
    }
  }

  async generateTags(documentId, model, userId) {
    try {
      const document = await this._getDocumentById(documentId, userId);
      if (!document) {
        throw new Error('Document not found');
      }

      const prompt = `请为以下文档生成3-5个标签：\n\n标题：${document.title}\n内容：${document.content.substring(0, 500)}`;
      const tagsText = await this._callModel(model, prompt);
      const tags = tagsText.split(/[,，、\n]/).map(t => t.trim()).filter(t => t);
      
      return { tags };
    } catch (error) {
      console.error('Generate tags error:', error);
      throw error;
    }
  }

  async _callModel(modelKey, prompt) {
    const modelConfig = CLOUD_MODELS[modelKey];
    
    if (modelConfig) {
      return await this._callCloudModel(modelConfig, prompt);
    } else if (LOCAL_MODELS.includes(modelKey)) {
      return await this._callLocalModel(modelKey, prompt);
    } else {
      throw new Error(`Unknown model: ${modelKey}`);
    }
  }

  async _callCloudModel(modelConfig, prompt) {
    if (!modelConfig.apiKey) {
      throw new Error(`API key not configured for ${modelConfig.model}`);
    }

    const response = await fetch(modelConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${modelConfig.apiKey}`
      },
      body: JSON.stringify({
        model: modelConfig.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        top_p: 0.9,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (data.output && data.output.text) {
      return data.output.text;
    } else if (data.choices && data.choices.length > 0) {
      return data.choices[0].message.content;
    } else {
      throw new Error('Invalid response format');
    }
  }

  async _callLocalModel(model, prompt) {
    const response = await fetch(`${OLLAMA_API_URL}/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status}`);
    }

    const data = await response.json();
    return data.response;
  }

  async _generateAnswer(query, graphData) {
    const context = graphData.nodes.slice(0, 10).map(n => n.label).join(', ');
    const prompt = `基于以下知识节点回答问题：${context}\n\n问题：${query}`;
    return await this._callModel('deepseek-chat', prompt);
  }

  async _getDocumentById(id, userId) {
    const db = require('../database/initUserDB')();
    return new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM documents WHERE id = ? AND user_id = ?',
        [id, userId],
        (err, row) => {
          if (err) return reject(err);
          if (!row) return resolve(null);
          resolve({
            id: row.id.toString(),
            title: row.title,
            content: row.content,
          });
        }
      );
    });
  });

  async _getDocumentsByEntities(entities, userId) {
    const db = require('../database/initUserDB')();
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT * FROM documents WHERE user_id = ?',
        [userId],
        (err, rows) => {
          if (err) return reject(err);
          resolve(rows.map(row => ({
            id: row.id.toString(),
            title: row.title,
            content: row.content,
            type: row.type,
            fileType: row.file_type,
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            tags: row.tags ? JSON.parse(row.tags) : [],
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          })));
        }
      );
    });
  }

  async _saveSummary(documentId, model, summary, userId) {
    const db = require('../database/initUserDB')();
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO summaries (user_id, document_id, model, content) VALUES (?, ?, ?, ?)',
        [userId, documentId, model, summary],
        (err) => {
          if (err) return reject(err);
          resolve();
        }
      );
    });
  }
}

module.exports = AIService;
