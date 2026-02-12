/**
 * Schema-aware Field Extractor
 * 
 * 根据激活的schemas智能提取字段，采用三层处理架构：
 * Layer 1: 规则提取 (0 token, 0ms, 80%覆盖)
 * Layer 2: NER提取 (0 token, 50ms, 15%覆盖)
 * Layer 3: LLM增强 (有成本, 500ms, 5%覆盖)
 */

const ruleExtractor = require('./rule_extractor');
const nerExtractor = require('./ner_extractor');

class SchemaAwareExtractor {
  constructor(options = {}) {
    this.criticalFieldWeightThreshold = options.criticalFieldWeightThreshold || 0.4; // 从0.3提高到0.4
    this.enableCache = options.enableCache !== false;
    this.cache = new Map();
  }
  
  /**
   * 根据schemas需求提取字段
   * 
   * @param {Object} ckb - CKB对象
   * @param {Array} schemas - 激活的schemas
   * @param {Object} options - 选项
   * @param {Object} options.llmClient - LLM客户端（可选）
   * @param {boolean} options.enableLLM - 是否启用LLM增强
   * @returns {Promise<Array>} 提取的字段
   */
  async extractFields(ckb, schemas, options = {}) {
    const { llmClient = null, enableLLM = false } = options;
    
    // Step 1: 收集所有schemas需要的字段
    const requiredFields = this._collectRequiredFields(schemas);
    
    console.log(`[SchemaAware] Collected ${requiredFields.length} required fields from ${schemas.length} schemas`);
    
    // Step 2: 规则提取（快速，0 token）- 传递requiredFields以进行针对性提取
    const text = ckb.content?.text || '';
    const ruleFields = await ruleExtractor.extractFields(text, requiredFields);
    
    console.log(`[SchemaAware] Rule extraction found ${ruleFields.length} fields`);
    
    // Step 3: NER提取（快速，0 token）
    const nerFields = await nerExtractor.extractEntities(text);
    
    console.log(`[SchemaAware] NER extraction found ${nerFields.length} fields`);
    
    // Step 4: 合并结果
    const extractedFields = this._mergeFields(ruleFields, nerFields);
    
    console.log(`[SchemaAware] Merged to ${extractedFields.length} unique fields`);
    
    // Step 5: 识别缺失的关键字段
    const missingCriticalFields = this._findMissingCriticalFields(
      requiredFields,
      extractedFields,
      schemas
    );
    
    if (missingCriticalFields.length > 0) {
      console.log(`[SchemaAware] Missing ${missingCriticalFields.length} critical fields: ${missingCriticalFields.map(f => f.name).join(', ')}`);
    }
    
    // Step 6: LLM增强（仅针对缺失的关键字段）
    // 注意：这里不直接调用LLM，而是标记需要LLM的字段
    // 实际的LLM调用在kg_service中批量处理
    if (enableLLM && missingCriticalFields.length > 0) {
      console.log(`[SchemaAware] Marking ${missingCriticalFields.length} fields for LLM enhancement`);
      // 将缺失字段信息附加到CKB，供后续批量处理
      ckb._missingCriticalFields = missingCriticalFields;
    }
    
    return extractedFields;
  }
  
  /**
   * 收集schemas需要的所有字段
   * 
   * @param {Array} schemas - Schema数组
   * @returns {Array} 字段需求数组
   */
  _collectRequiredFields(schemas) {
    const fields = new Map();
    
    schemas.forEach(schema => {
      // 解析coreFields（可能是JSON字符串）
      let coreFields = schema.coreFields;
      if (typeof coreFields === 'string') {
        try {
          coreFields = JSON.parse(coreFields);
        } catch (e) {
          console.warn(`[SchemaAware] Failed to parse coreFields for schema ${schema.name}`);
          coreFields = [];
        }
      }
      
      // 收集core fields
      if (Array.isArray(coreFields)) {
        coreFields.forEach(field => {
          if (!fields.has(field.name)) {
            fields.set(field.name, {
              name: field.name,
              weight: field.weight || 0,
              required: field.required || false,
              sources: []
            });
          }
          fields.get(field.name).sources.push({
            schema: schema.name,
            type: 'core',
            weight: field.weight
          });
        });
      }
      
      // 解析relations（可能是JSON字符串）
      let relations = schema.relations;
      if (typeof relations === 'string') {
        try {
          relations = JSON.parse(relations);
        } catch (e) {
          console.warn(`[SchemaAware] Failed to parse relations for schema ${schema.name}`);
          relations = [];
        }
      }
      
      // 收集relation target fields
      if (Array.isArray(relations)) {
        relations.forEach(rel => {
          const targetField = rel.target_field;
          if (!targetField) return;
          
          if (!fields.has(targetField)) {
            fields.set(targetField, {
              name: targetField,
              weight: 0.5,  // 关系字段默认权重
              required: false,
              sources: []
            });
          }
          fields.get(targetField).sources.push({
            schema: schema.name,
            type: 'relation',
            relation_type: rel.type,
            relation_type_id: rel.relation_type_id
          });
        });
      }
    });
    
    return Array.from(fields.values());
  }
  
  /**
   * 识别缺失的关键字段
   * 
   * 关键字段定义：
   * 1. required=true的字段（最高优先级）
   * 2. 用于关系构建的target_field
   * 
   * @param {Array} requiredFields - 需要的字段
   * @param {Array} extractedFields - 已提取的字段
   * @param {Array} schemas - Schema数组
   * @returns {Array} 缺失的关键字段
   */
  _findMissingCriticalFields(requiredFields, extractedFields, schemas) {
    const extractedNames = new Set(extractedFields.map(f => f.name));
    
    return requiredFields.filter(field => {
      // 已提取，跳过
      if (extractedNames.has(field.name)) return false;
      
      // 只提取required=true的字段或用于关系的字段
      const isCritical = 
        field.required ||  // 必需字段
        field.sources.some(s => s.type === 'relation');  // 关系字段
      
      return isCritical;
    });
  }
  
  /**
   * 合并多个来源的字段
   * 
   * @param {Array} ruleFields - 规则提取的字段
   * @param {Array} nerFields - NER提取的字段
   * @returns {Array} 合并后的字段
   */
  _mergeFields(ruleFields, nerFields) {
    const merged = new Map();
    
    // 添加规则提取的字段
    ruleFields.forEach(field => {
      merged.set(field.name, {
        ...field,
        sources: ['rule']
      });
    });
    
    // 添加NER提取的字段（如果规则未提取）
    nerFields.forEach(field => {
      if (!merged.has(field.name)) {
        merged.set(field.name, {
          ...field,
          sources: ['ner']
        });
      } else {
        // 如果已存在，增加来源
        const existing = merged.get(field.name);
        if (!existing.sources.includes('ner')) {
          existing.sources.push('ner');
        }
      }
    });
    
    return Array.from(merged.values());
  }
  
  /**
   * 获取字段提取统计信息
   * 
   * @param {Array} extractedFields - 提取的字段
   * @returns {Object} 统计信息
   */
  getExtractionStats(extractedFields) {
    const stats = {
      total: extractedFields.length,
      bySource: {
        rule: 0,
        ner: 0,
        both: 0
      }
    };
    
    extractedFields.forEach(field => {
      const sources = field.sources || [];
      if (sources.includes('rule') && sources.includes('ner')) {
        stats.bySource.both++;
      } else if (sources.includes('rule')) {
        stats.bySource.rule++;
      } else if (sources.includes('ner')) {
        stats.bySource.ner++;
      }
    });
    
    return stats;
  }
}

module.exports = SchemaAwareExtractor;
