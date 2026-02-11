/**
 * Knowledge Graph Service
 * Business logic for knowledge graph operations
 */

class KnowledgeGraphService {
  constructor(kgModule) {
    this.kgModule = kgModule;
    this.entityStore = kgModule.entityStore;
    this.relationStore = kgModule.relationStore;
  }

  async getGraphData(params = {}) {
    try {
      const { minConfidence, entityType, relationType } = params;
      
      if (!this.entityStore || !this.relationStore) {
        return { entities: [], relations: [] };
      }

      let entities = await this.entityStore.getAllEntities();
      let relations = await this.relationStore.getAllRelations();

      // Apply filters
      if (minConfidence) {
        entities = entities.filter(e => e.confidence >= minConfidence);
        relations = relations.filter(r => r.confidence >= minConfidence);
      }

      if (entityType) {
        entities = entities.filter(e => e.entity_type === entityType);
      }

      if (relationType) {
        relations = relations.filter(r => r.type === relationType);
      }

      return { entities, relations };
    } catch (error) {
      console.error('Get graph data error:', error);
      throw error;
    }
  }

  async getStats() {
    try {
      if (!this.entityStore || !this.relationStore) {
        return { entity_count: 0, relation_count: 0 };
      }

      const entities = await this.entityStore.getAllEntities();
      const relations = await this.relationStore.getAllRelations();

      return {
        entity_count: entities.length,
        relation_count: relations.length,
        by_type: this._groupByType(entities),
      };
    } catch (error) {
      console.error('Get stats error:', error);
      throw error;
    }
  }

  async buildFromDocument(documentId, userId) {
    try {
      if (!this.kgModule.processDocumentWithFullProcessing) {
        throw new Error('Document processing not available');
      }

      const document = await this._getDocument(documentId, userId);
      if (!document) {
        throw new Error('Document not found');
      }

      const result = await this.kgModule.processDocumentWithFullProcessing(document);
      
      return {
        entities_created: result.entities?.length || 0,
        relations_created: result.relations?.length || 0,
      };
    } catch (error) {
      console.error('Build graph error:', error);
      throw error;
    }
  }

  async getEntities(params = {}) {
    try {
      if (!this.entityStore) {
        return { total: 0, count: 0, entities: [] };
      }

      const { minConfidence, type, skip = 0, take = 100 } = params;
      
      let entities = await this.entityStore.getAllEntities();

      // Apply filters
      if (minConfidence) {
        entities = entities.filter(e => e.confidence >= minConfidence);
      }

      if (type) {
        entities = entities.filter(e => e.entity_type === type);
      }

      return {
        total: entities.length,
        count: Math.min(take, entities.length - skip),
        entities: entities.slice(skip, skip + take),
      };
    } catch (error) {
      console.error('Get entities error:', error);
      throw error;
    }
  }

  async getRelations(params = {}) {
    try {
      if (!this.relationStore) {
        return { total: 0, count: 0, relations: [] };
      }

      const { minConfidence, type, skip = 0, take = 100 } = params;
      
      let relations = await this.relationStore.getAllRelations();

      // Apply filters
      if (minConfidence) {
        relations = relations.filter(r => r.confidence >= minConfidence);
      }

      if (type) {
        relations = relations.filter(r => r.type === type);
      }

      return {
        total: relations.length,
        count: Math.min(take, relations.length - skip),
        relations: relations.slice(skip, skip + take),
      };
    } catch (error) {
      console.error('Get relations error:', error);
      throw error;
    }
  }

  _groupByType(entities) {
    return entities.reduce((acc, entity) => {
      const type = entity.entity_type || 'unknown';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
  }

  async _getDocument(id, userId) {
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
            type: row.type,
            fileType: row.file_type,
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            tags: row.tags ? JSON.parse(row.tags) : [],
          });
        }
      );
    });
  }
}

module.exports = KnowledgeGraphService;
