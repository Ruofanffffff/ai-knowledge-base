/**
 * Named Entity Recognition (NER) Extractor
 * 
 * Lightweight NER using dictionary-based approach
 * This is a 0-Token method for entity extraction
 */

const { FieldType } = require('./rule_extractor');

/**
 * Entity dictionaries
 */
const ENTITY_DICTIONARIES = {
  // Organizations
  organizations: [
    '公司', '集团', '企业', '机构', '组织', '协会', '学会',
    '研究所', '实验室', '中心', '部门', '局', '委员会'
  ],
  
  // Locations (common suffixes)
  locationSuffixes: [
    '省', '市', '县', '区', '镇', '乡', '村', '街道',
    '路', '街', '巷', '弄', '号', '楼', '室'
  ],
  
  // Person titles
  personTitles: [
    '先生', '女士', '教授', '博士', '硕士', '院士',
    '总经理', '经理', '主任', '主管', '专家', '工程师'
  ]
};

/**
 * Extract named entities from text
 * @param {string} text - Input text
 * @returns {Array} Array of entity fields
 */
function extractEntities(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  
  const entities = [];
  
  // Extract organizations
  entities.push(...extractOrganizations(text));
  
  // Extract person names (with titles)
  entities.push(...extractPersons(text));
  
  // Extract locations (enhanced)
  entities.push(...extractLocations(text));
  
  return deduplicateEntities(entities);
}

/**
 * Extract organization entities
 * @param {string} text - Input text
 * @returns {Array} Organization entities
 */
function extractOrganizations(text) {
  const entities = [];
  
  ENTITY_DICTIONARIES.organizations.forEach(suffix => {
    // Pattern: 2-10 characters + organization suffix
    const pattern = new RegExp(`([\\u4e00-\\u9fa5A-Za-z0-9]{2,10}${suffix})`, 'g');
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      entities.push({
        name: '实体',
        value: match[1],
        type: FieldType.ENTITY,
        subtype: 'organization',
        confidence: 0.75,
        raw: match[0]
      });
    }
  });
  
  return entities;
}

/**
 * Extract person entities
 * @param {string} text - Input text
 * @returns {Array} Person entities
 */
function extractPersons(text) {
  const entities = [];
  
  ENTITY_DICTIONARIES.personTitles.forEach(title => {
    // Pattern: 2-4 Chinese characters + title
    const pattern = new RegExp(`([\\u4e00-\\u9fa5]{2,4}${title})`, 'g');
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      entities.push({
        name: '实体',
        value: match[1],
        type: FieldType.ENTITY,
        subtype: 'person',
        confidence: 0.7,
        raw: match[0]
      });
    }
  });
  
  // Pattern: Common Chinese surnames + 1-2 characters
  const surnames = [
    '王', '李', '张', '刘', '陈', '杨', '黄', '赵', '周', '吴',
    '徐', '孙', '马', '朱', '胡', '郭', '何', '林', '高', '罗'
  ];
  
  surnames.forEach(surname => {
    const pattern = new RegExp(`(${surname}[\\u4e00-\\u9fa5]{1,2})(?=[，。；！？\\s]|$)`, 'g');
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      // Only if followed by context suggesting it's a name
      const context = text.substring(match.index, match.index + 20);
      if (context.match(/说|表示|认为|指出|称|提到/)) {
        entities.push({
          name: '实体',
          value: match[1],
          type: FieldType.ENTITY,
          subtype: 'person',
          confidence: 0.6,
          raw: match[0]
        });
      }
    }
  });
  
  return entities;
}

/**
 * Extract location entities (enhanced)
 * @param {string} text - Input text
 * @returns {Array} Location entities
 */
function extractLocations(text) {
  const entities = [];
  
  ENTITY_DICTIONARIES.locationSuffixes.forEach(suffix => {
    // Pattern: 2-8 characters + location suffix
    const pattern = new RegExp(`([\\u4e00-\\u9fa5]{2,8}${suffix})`, 'g');
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      entities.push({
        name: '区域',
        value: match[1],
        type: FieldType.LOCATION,
        subtype: 'administrative',
        confidence: 0.8,
        raw: match[0]
      });
    }
  });
  
  return entities;
}

/**
 * Deduplicate entities
 * @param {Array} entities - Array of entities
 * @returns {Array} Deduplicated entities
 */
function deduplicateEntities(entities) {
  const seen = new Map();
  
  return entities.filter(entity => {
    const key = `${entity.type}:${entity.subtype}:${entity.value}`;
    
    if (seen.has(key)) {
      // Keep the one with higher confidence
      const existing = seen.get(key);
      if (entity.confidence > existing.confidence) {
        seen.set(key, entity);
        return true;
      }
      return false;
    }
    
    seen.set(key, entity);
    return true;
  });
}

/**
 * Merge NER results with rule-based extraction
 * @param {Array} ruleFields - Fields from rule extraction
 * @param {Array} nerEntities - Entities from NER
 * @returns {Array} Merged fields
 */
function mergeWithRuleFields(ruleFields, nerEntities) {
  const merged = [...ruleFields];
  
  // Add NER entities that don't conflict with rule fields
  nerEntities.forEach(entity => {
    const conflict = ruleFields.some(field => 
      field.value === entity.value && field.type === entity.type
    );
    
    if (!conflict) {
      merged.push(entity);
    }
  });
  
  return merged;
}

module.exports = {
  extractEntities,
  extractOrganizations,
  extractPersons,
  extractLocations,
  mergeWithRuleFields,
  ENTITY_DICTIONARIES
};
