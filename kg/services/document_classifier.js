/**
 * Document Classifier
 * 
 * Classifies documents by type and determines which schemas should be activated.
 * This reduces the number of schemas loaded from 420 to ~10-50 per document.
 * 
 * Classification Strategy:
 * - Keyword-based classification (fast, 0 token cost)
 * - Returns relevant entity types for schema filtering
 */

/**
 * Document type definitions with keywords, relevant entity types, and schema name patterns
 */
const DOCUMENT_TYPES = {
  project: {
    keywords: ['项目', '工程', '建设', '施工', '合同', '招标', '投标', '验收', '实施', '方案'],
    entityTypes: ['ProjectEntity', 'OrganizationEntity', 'LocationEntity', 'EventEntity', 'DocumentEntity'],
    schemaNamePatterns: ['Project', 'Construction', 'Contract', 'Tender'],
    scenes: ['项目管理', '工程建设'],
    weight: 1.0
  },
  business: {
    keywords: ['公司', '企业', '商业', '合作', '协议', '业务', '经营', '管理', '采购', '供应'],
    entityTypes: ['OrganizationEntity', 'PersonEntity', 'DocumentEntity', 'ProjectEntity'],
    schemaNamePatterns: ['Business', 'Company', 'Organization', 'Management'],
    scenes: ['商业管理', '企业运营'],
    weight: 1.0
  },
  government: {
    keywords: ['政府', '政务', '审批', '监管', '政策', '法规', '行政', '公共', '部门', '机关'],
    entityTypes: ['OrganizationEntity', 'DocumentEntity', 'PolicyEntity', 'LocationEntity'],
    schemaNamePatterns: ['Government', 'Policy', 'Public', 'Admin'],
    scenes: ['政务管理', '公共服务'],
    weight: 1.0
  },
  technical: {
    keywords: ['技术', '系统', '平台', '架构', '开发', '软件', '硬件', '网络', '代码', 'API'],
    entityTypes: ['SystemEntity', 'ComponentEntity', 'DocumentEntity', 'OrganizationEntity'],
    schemaNamePatterns: ['Code', 'API', 'Software', 'System', 'Technical', 'Architecture'],
    scenes: ['技术开发', '系统架构'],
    weight: 1.0
  },
  research: {
    keywords: ['研究', '分析', '报告', '调研', '数据', '统计', '评估', '测试', '实验'],
    entityTypes: ['ResearchEntity', 'DocumentEntity', 'OrganizationEntity', 'EventEntity'],
    schemaNamePatterns: ['Research', 'Analysis', 'Report', 'Study'],
    scenes: ['研究分析', '数据统计'],
    weight: 1.0
  },
  general: {
    keywords: [],  // Fallback type
    entityTypes: ['GeneralEntity', 'LocationEntity', 'OrganizationEntity', 'EventEntity'],
    schemaNamePatterns: [],
    scenes: [],
    weight: 0.5
  }
};

/**
 * Document Classifier Class
 */
class DocumentClassifier {
  constructor(options = {}) {
    this.minKeywordMatches = options.minKeywordMatches || 2;
    this.maxEntityTypes = options.maxEntityTypes || 10;
  }
  
  /**
   * Classify document by analyzing text content
   * 
   * @param {string} text - Document text content
   * @param {Object} options - Classification options
   * @returns {Object} Classification result
   */
  classifyDocument(text, options = {}) {
    const { returnScores = false } = options;
    
    if (!text || typeof text !== 'string') {
      return this._getDefaultClassification();
    }
    
    // Calculate scores for each document type
    const scores = {};
    for (const [type, config] of Object.entries(DOCUMENT_TYPES)) {
      if (type === 'general') continue;  // Skip general type in scoring
      
      const matchCount = config.keywords.filter(kw => text.includes(kw)).length;
      scores[type] = matchCount * config.weight;
    }
    
    // Find the type with highest score
    const sortedTypes = Object.entries(scores)
      .sort((a, b) => b[1] - a[1]);
    
    const topType = sortedTypes[0];
    const topScore = topType ? topType[1] : 0;
    
    // If no keywords matched or score too low, use general type
    if (topScore < this.minKeywordMatches) {
      return {
        documentType: 'general',
        confidence: 0.5,
        entityTypes: DOCUMENT_TYPES.general.entityTypes,
        matchedKeywords: [],
        ...(returnScores && { scores })
      };
    }
    
    const documentType = topType[0];
    const config = DOCUMENT_TYPES[documentType];
    const matchedKeywords = config.keywords.filter(kw => text.includes(kw));
    
    // Calculate confidence based on keyword matches
    const confidence = Math.min(topScore / 10, 1.0);
    
    return {
      documentType,
      confidence,
      entityTypes: config.entityTypes,
      matchedKeywords,
      ...(returnScores && { scores })
    };
  }
  
  /**
   * Get relevant schemas for a document
   * Filters schemas by:
   * 1. Entity types matching document classification
   * 2. Scene matching document type
   * 3. Schema name patterns matching document type
   * 
   * @param {string} text - Document text
   * @param {Array} allSchemas - All available schemas
   * @param {Object} options - Options
   * @returns {Array} Filtered schemas
   */
  getRelevantSchemas(text, allSchemas, options = {}) {
    const classification = this.classifyDocument(text, options);
    const config = DOCUMENT_TYPES[classification.documentType];
    
    if (!config) {
      return allSchemas; // Return all if no classification
    }
    
    // For 'general' type, return all schemas since we can't narrow down
    if (classification.documentType === 'general') {
      return allSchemas;
    }
    
    const relevantSchemas = allSchemas.filter(schema => {
      // Priority 1: Match by entity type
      if (schema.entityType && config.entityTypes.includes(schema.entityType)) {
        return true;
      }
      
      // Priority 2: Match by scene
      if (schema.scene && config.scenes.some(s => schema.scene.includes(s))) {
        return true;
      }
      
      // Priority 3: Match by schema name patterns
      if (schema.name && config.schemaNamePatterns.some(pattern => 
        schema.name.toLowerCase().includes(pattern.toLowerCase())
      )) {
        return true;
      }
      
      return false;
    });
    
    // Fallback: if filtering produced too few results, return all schemas
    // This prevents 0-entity builds when schema entityTypes don't match classifier expectations
    if (relevantSchemas.length === 0) {
      console.log(`[DocumentClassifier] Schema filtering returned 0 results for type '${classification.documentType}', falling back to all ${allSchemas.length} schemas`);
      return allSchemas;
    }
    
    return relevantSchemas;
  }
  
  /**
   * Classify multiple documents in batch
   * 
   * @param {Array} documents - Array of document objects with text field
   * @returns {Array} Array of classification results
   */
  classifyBatch(documents) {
    return documents.map(doc => {
      const text = doc.text || doc.content || '';
      return {
        ...doc,
        classification: this.classifyDocument(text)
      };
    });
  }
  
  /**
   * Get default classification (fallback)
   * 
   * @returns {Object} Default classification
   */
  _getDefaultClassification() {
    return {
      documentType: 'general',
      confidence: 0.5,
      entityTypes: DOCUMENT_TYPES.general.entityTypes,
      matchedKeywords: []
    };
  }
  
  /**
   * Get statistics about document types
   * 
   * @returns {Object} Statistics
   */
  getTypeStatistics() {
    const stats = {};
    for (const [type, config] of Object.entries(DOCUMENT_TYPES)) {
      stats[type] = {
        keywordCount: config.keywords.length,
        entityTypeCount: config.entityTypes.length,
        entityTypes: config.entityTypes
      };
    }
    return stats;
  }
  
  /**
   * Add custom document type
   * 
   * @param {string} typeName - Type name
   * @param {Object} config - Type configuration
   */
  addDocumentType(typeName, config) {
    if (!config.keywords || !Array.isArray(config.keywords)) {
      throw new Error('keywords must be an array');
    }
    if (!config.entityTypes || !Array.isArray(config.entityTypes)) {
      throw new Error('entityTypes must be an array');
    }
    
    DOCUMENT_TYPES[typeName] = {
      keywords: config.keywords,
      entityTypes: config.entityTypes,
      weight: config.weight || 1.0
    };
  }
}

module.exports = {
  DocumentClassifier,
  DOCUMENT_TYPES
};
