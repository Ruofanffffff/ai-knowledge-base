/**
 * Synonym Dictionary
 * 
 * Manages synonym mappings for field name normalization.
 * Provides fast lookup and optional learning from LLM results.
 * 
 * Performance Optimizations (Requirements 20.19, 20.20):
 * - Index-based O(1) lookup using reverse index
 * - Hit rate statistics tracking
 * - Cache-friendly data structures
 * 
 * Design Reference: Phase 2 - Field Normalization Module (Section 4.3)
 * Validates: Requirements 18.3, 20.19, 20.20
 */

const fs = require('fs');
const path = require('path');

/**
 * Synonym Dictionary Class
 * 
 * Manages a dictionary of standard field names and their synonyms.
 * Supports loading from JSON file, matching, and dynamic expansion.
 * 
 * Performance Features:
 * - Reverse index for O(1) synonym lookup
 * - Hit rate statistics for monitoring effectiveness
 */
class SynonymDict {
  constructor() {
    this.dict = this.loadDict();
    this.reverseIndex = this.buildReverseIndex();
    this.stats = this.loadStats();
  }
  
  /**
   * Load dictionary from JSON file
   * 
   * @returns {Object} Dictionary object
   */
  loadDict() {
    const dictPath = path.join(__dirname, 'synonym_dict.json');
    
    if (fs.existsSync(dictPath)) {
      try {
        const content = fs.readFileSync(dictPath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error('Error loading synonym dictionary:', error);
        return this.getDefaultDict();
      }
    }
    
    // If file doesn't exist, use default dictionary
    return this.getDefaultDict();
  }
  
  /**
   * Load statistics from JSON file
   * 
   * @returns {Object} Statistics object
   */
  loadStats() {
    const statsPath = path.join(__dirname, '.synonym_dict_stats.json');
    
    if (fs.existsSync(statsPath)) {
      try {
        const content = fs.readFileSync(statsPath, 'utf-8');
        return JSON.parse(content);
      } catch (error) {
        console.error('Error loading synonym dictionary stats:', error);
        return this.getDefaultStats();
      }
    }
    
    return this.getDefaultStats();
  }
  
  /**
   * Get default statistics
   * 
   * @returns {Object} Default statistics
   */
  getDefaultStats() {
    return {
      totalLookups: 0,
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      synonymHits: {},  // synonym -> hit count
      standardHits: {},  // standard field -> hit count
      lastReset: new Date().toISOString()
    };
  }
  
  /**
   * Build reverse index for O(1) lookup
   * Maps synonym -> standard field name
   * 
   * Requirement 20.19: Index-based O(1) lookup
   * 
   * @returns {Map} Reverse index
   */
  buildReverseIndex() {
    const index = new Map();
    
    for (const [standard, data] of Object.entries(this.dict)) {
      const synonyms = Array.isArray(data) ? data : (data.synonyms || []);
      
      for (const synonym of synonyms) {
        // Store standard field name for this synonym
        if (!index.has(synonym)) {
          index.set(synonym, []);
        }
        index.get(synonym).push(standard);
      }
    }
    
    return index;
  }
  
  /**
   * Rebuild reverse index (call after dictionary updates)
   */
  rebuildReverseIndex() {
    this.reverseIndex = this.buildReverseIndex();
  }
  
  /**
   * Get default dictionary
   * 
   * @returns {Object} Default dictionary
   */
  getDefaultDict() {
    return {
      '时间': ['日期', '时刻', '时段', '时间点', '发生时间', '记录时间'],
      '区域': ['地区', '地域', '区', '地点', '位置', '场所', '发生地点'],
      '数值': ['值', '数字', '数量', '量', '大小'],
      '单位': ['计量单位', '度量单位'],
      '指标': ['指数', '参数', '度量', '指标名称'],
      '实体': ['对象', '主体', '目标', '主体对象'],
      '描述': ['说明', '备注', '注释', '详细描述'],
      '类型': ['种类', '分类', '类别', '类型名称'],
      '状态': ['情况', '状况', '态势', '当前状态'],
      '结果': ['成果', '产出', '输出', '最终结果'],
      '名称': ['名字', '标题', '称呼'],
      '内容': ['正文', '文本', '详情'],
      '来源': ['出处', '源头', '引用'],
      '作者': ['创建者', '发布者', '撰写人'],
      '标签': ['关键词', '分类标签', 'tag'],
      '评分': ['打分', '评价', '得分'],
      '价格': ['费用', '金额', '成本'],
      '数量': ['个数', '总数', '计数'],
      '持续时间': ['时长', 'duration', '耗时'],
      '频率': ['次数', '频次', '发生频率']
    };
  }
  
  /**
   * Match raw field name to standard field name using synonym dictionary
   * 
   * Uses reverse index for O(1) lookup performance.
   * Records hit/miss statistics for monitoring.
   * 
   * Requirements 20.19, 20.20: O(1) lookup + hit rate tracking
   * 
   * @param {string} rawFieldName - Raw field name
   * @param {Array<string>} schemaFieldNames - Schema field names
   * @returns {Object|null} Mapping result or null
   */
  match(rawFieldName, schemaFieldNames) {
    // Increment total lookups
    this.stats.totalLookups++;
    
    // O(1) lookup using reverse index
    const candidates = this.reverseIndex.get(rawFieldName);
    
    if (!candidates || candidates.length === 0) {
      // Miss: synonym not found
      this.stats.totalMisses++;
      this.updateHitRate();
      return null;
    }
    
    // Find first candidate that exists in schema fields
    for (const standard of candidates) {
      if (schemaFieldNames.includes(standard)) {
        // Hit: found matching standard field
        this.stats.totalHits++;
        
        // Record synonym hit
        if (!this.stats.synonymHits[rawFieldName]) {
          this.stats.synonymHits[rawFieldName] = 0;
        }
        this.stats.synonymHits[rawFieldName]++;
        
        // Record standard field hit
        if (!this.stats.standardHits[standard]) {
          this.stats.standardHits[standard] = 0;
        }
        this.stats.standardHits[standard]++;
        
        this.updateHitRate();
        this.saveStats();
        
        return {
          mapped_name: standard,
          confidence: 0.9,
          method: 'synonym'
        };
      }
    }
    
    // Miss: synonym found but no matching schema field
    this.stats.totalMisses++;
    this.updateHitRate();
    return null;
  }
  
  /**
   * Update hit rate calculation
   */
  updateHitRate() {
    if (this.stats.totalLookups > 0) {
      this.stats.hitRate = this.stats.totalHits / this.stats.totalLookups;
    } else {
      this.stats.hitRate = 0;
    }
  }
  
  /**
   * Add a synonym to the dictionary
   * 
   * @param {string} standard - Standard field name
   * @param {string} synonym - Synonym to add
   */
  addSynonym(standard, synonym) {
    // Get existing data
    let data = this.dict[standard];
    
    if (!data) {
      // Create new entry
      this.dict[standard] = {
        synonyms: [],
        domain: [],
        usage_count: 0
      };
      data = this.dict[standard];
    }
    
    // Handle legacy array format
    if (Array.isArray(data)) {
      this.dict[standard] = {
        synonyms: data,
        domain: [],
        usage_count: 0
      };
      data = this.dict[standard];
    }
    
    // Add synonym if not exists
    if (!data.synonyms.includes(synonym)) {
      data.synonyms.push(synonym);
      this.saveDict();
      this.rebuildReverseIndex();  // Rebuild index after update
      console.log(`Added synonym: ${synonym} -> ${standard}`);
    }
  }
  
  /**
   * Save dictionary to JSON file
   */
  saveDict() {
    const dictPath = path.join(__dirname, 'synonym_dict.json');
    
    try {
      fs.writeFileSync(
        dictPath, 
        JSON.stringify(this.dict, null, 2), 
        'utf-8'
      );
    } catch (error) {
      console.error('Error saving synonym dictionary:', error);
    }
  }
  
  /**
   * Save statistics to JSON file
   * 
   * Requirement 20.20: Hit rate statistics tracking
   */
  saveStats() {
    const statsPath = path.join(__dirname, '.synonym_dict_stats.json');
    
    try {
      fs.writeFileSync(
        statsPath,
        JSON.stringify(this.stats, null, 2),
        'utf-8'
      );
    } catch (error) {
      console.error('Error saving synonym dictionary stats:', error);
    }
  }
  
  /**
   * Learn from LLM mapping result
   * 
   * If LLM provides a high-confidence mapping, add it to the dictionary
   * for future use (avoiding redundant LLM calls).
   * 
   * @param {string} rawFieldName - Raw field name
   * @param {string} mappedFieldName - Mapped field name from LLM
   * @param {number} confidence - Mapping confidence
   */
  learnFromLLM(rawFieldName, mappedFieldName, confidence) {
    // Only learn from high-confidence mappings
    if (confidence >= 0.9) {
      this.addSynonym(mappedFieldName, rawFieldName);
    }
  }
  
  /**
   * Get all synonyms for a standard field name
   * 
   * @param {string} standard - Standard field name
   * @returns {Array<string>} Array of synonyms
   */
  getSynonyms(standard) {
    const data = this.dict[standard];
    if (!data) return [];
    
    // Handle both legacy array format and new object format
    return Array.isArray(data) ? data : (data.synonyms || []);
  }
  
  /**
   * Get all standard field names
   * 
   * @returns {Array<string>} Array of standard field names
   */
  getStandardFields() {
    return Object.keys(this.dict);
  }
  
  /**
   * Check if a field name is a standard field
   * 
   * @param {string} fieldName - Field name to check
   * @returns {boolean} True if standard field
   */
  isStandardField(fieldName) {
    return this.dict.hasOwnProperty(fieldName);
  }
  
  /**
   * Get dictionary statistics
   * 
   * Requirement 20.20: Hit rate statistics
   * 
   * @returns {Object} Statistics
   */
  getStats() {
    const standardCount = Object.keys(this.dict).length;
    let synonymCount = 0;
    
    for (const data of Object.values(this.dict)) {
      const synonyms = Array.isArray(data) ? data : (data.synonyms || []);
      synonymCount += synonyms.length;
    }
    
    // Get top synonyms by hit count
    const topSynonyms = Object.entries(this.stats.synonymHits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([synonym, count]) => ({ synonym, count }));
    
    // Get top standard fields by hit count
    const topStandards = Object.entries(this.stats.standardHits)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([standard, count]) => ({ standard, count }));
    
    return {
      dictionary: {
        standard_fields: standardCount,
        total_synonyms: synonymCount,
        avg_synonyms_per_field: standardCount > 0 ? (synonymCount / standardCount).toFixed(2) : 0,
        reverse_index_size: this.reverseIndex.size
      },
      performance: {
        total_lookups: this.stats.totalLookups,
        total_hits: this.stats.totalHits,
        total_misses: this.stats.totalMisses,
        hit_rate: (this.stats.hitRate * 100).toFixed(2) + '%',
        last_reset: this.stats.lastReset
      },
      top_synonyms: topSynonyms,
      top_standards: topStandards
    };
  }
  
  /**
   * Get hit rate statistics
   * 
   * Requirement 20.20: Hit rate statistics tracking
   * 
   * @returns {Object} Hit rate statistics
   */
  getHitRateStats() {
    return {
      total_lookups: this.stats.totalLookups,
      total_hits: this.stats.totalHits,
      total_misses: this.stats.totalMisses,
      hit_rate: this.stats.hitRate,
      hit_rate_percentage: (this.stats.hitRate * 100).toFixed(2) + '%'
    };
  }
  
  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = this.getDefaultStats();
    this.saveStats();
    console.log('[SynonymDict] Statistics reset');
  }
  
  /**
   * Export dictionary to JSON string
   * 
   * @returns {string} JSON string
   */
  exportToJSON() {
    return JSON.stringify(this.dict, null, 2);
  }
  
  /**
   * Import dictionary from JSON string
   * 
   * @param {string} jsonStr - JSON string
   */
  importFromJSON(jsonStr) {
    try {
      this.dict = JSON.parse(jsonStr);
      this.saveDict();
    } catch (error) {
      console.error('Error importing dictionary:', error);
      throw error;
    }
  }
  
  /**
   * Reset dictionary to default
   */
  reset() {
    this.dict = this.getDefaultDict();
    this.saveDict();
  }
}

// Export singleton instance
module.exports = new SynonymDict();
