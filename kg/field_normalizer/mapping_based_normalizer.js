/**
 * Mapping-Based Field Normalizer
 * 
 * 基于预定义映射表的字段归一化器
 * 优先使用算法映射，无法映射的字段才使用LLM
 * 
 * 流程：
 * 1. 加载Schema字段映射表
 * 2. 对提取的字段进行算法匹配（精确匹配、模糊匹配、语义相似度）
 * 3. 无法匹配的字段使用LLM归一化
 * 4. 返回归一化结果和统计信息
 */

const fs = require('fs').promises;
const path = require('path');

class MappingBasedNormalizer {
  constructor() {
    this.mappings = null;
    this.stats = {
      totalFields: 0,
      algorithmMapped: 0,
      llmMapped: 0,
      unmapped: 0
    };
  }

  /**
   * 加载Schema字段映射表
   */
  async loadMappings() {
    if (this.mappings) {
      return this.mappings;
    }

    try {
      // 优先使用完整的255个schema映射表
      let mappingPath = path.join(__dirname, 'schema_field_mappings_full.json');
      
      // 如果完整映射表不存在，回退到原始映射表
      try {
        await fs.access(mappingPath);
      } catch {
        console.log('完整映射表不存在，使用原始映射表');
        mappingPath = path.join(__dirname, 'schema_field_mappings.json');
      }
      
      const content = await fs.readFile(mappingPath, 'utf-8');
      this.mappings = JSON.parse(content);
      console.log(`已加载 ${Object.keys(this.mappings).length} 个schemas的字段映射表`);
      return this.mappings;
    } catch (error) {
      console.error('Failed to load schema field mappings:', error);
      this.mappings = {};
      return this.mappings;
    }
  }

  /**
   * 归一化字段到指定Schema
   * 
   * @param {Array} extractedFields - 提取的原始字段
   * @param {Object} schema - 目标Schema
   * @param {Object} options - 选项
   * @param {boolean} options.useLLM - 是否使用LLM处理无法映射的字段
   * @param {Function} options.llmNormalizer - LLM归一化函数
   * @returns {Object} 归一化结果
   */
  async normalizeFields(extractedFields, schema, options = {}) {
    const {
      useLLM = true,
      llmNormalizer = null
    } = options;

    // 加载映射表
    await this.loadMappings();

    // 获取Schema的字段映射 (支持 schema.name 和 schema.schema_name)
    const schemaName = schema.name || schema.schema_name;
    const schemaMapping = this.mappings[schemaName];
    if (!schemaMapping) {
      console.warn(`No mapping found for schema: ${schemaName}`);
      // 如果没有映射表，直接使用LLM
      if (useLLM && llmNormalizer) {
        return await llmNormalizer(extractedFields, schema);
      }
      return {
        normalizedFields: [],
        mappedCount: 0,
        unmappedFields: extractedFields
      };
    }

    // 重置统计
    this.stats = {
      totalFields: extractedFields.length,
      algorithmMapped: 0,
      llmMapped: 0,
      unmapped: 0
    };

    const normalizedFields = [];
    const unmappedFields = [];

    // 第一阶段：算法映射
    for (const field of extractedFields) {
      const mappedField = this._algorithmMap(field, schemaMapping);
      
      if (mappedField) {
        normalizedFields.push(mappedField);
        this.stats.algorithmMapped++;
      } else {
        unmappedFields.push(field);
      }
    }

    // 第二阶段：LLM映射（仅处理无法映射的字段）
    let finalUnmappedFields = unmappedFields;
    
    if (useLLM && llmNormalizer && unmappedFields.length > 0) {
      console.log(`[MappingBasedNormalizer] 调用LLM处理 ${unmappedFields.length} 个未映射字段...`);
      
      const llmResult = await llmNormalizer(unmappedFields, schema);
      
      if (llmResult && llmResult.normalizedFields) {
        normalizedFields.push(...llmResult.normalizedFields);
        this.stats.llmMapped = llmResult.normalizedFields.length;
        
        // 更新最终未映射字段列表
        finalUnmappedFields = llmResult.unmappedFields || [];
        this.stats.unmapped = finalUnmappedFields.length;
        
        console.log(`[MappingBasedNormalizer] LLM成功映射 ${llmResult.normalizedFields.length} 个字段，剩余 ${finalUnmappedFields.length} 个未映射`);
      } else {
        this.stats.unmapped = unmappedFields.length;
        console.log(`[MappingBasedNormalizer] LLM映射未返回结果`);
      }
    } else {
      this.stats.unmapped = unmappedFields.length;
      if (!useLLM) {
        console.log(`[MappingBasedNormalizer] LLM已禁用，跳过LLM映射`);
      } else if (!llmNormalizer) {
        console.log(`[MappingBasedNormalizer] 未提供LLM归一化函数`);
      }
    }

    // 计算完整度
    const coreFields = JSON.parse(schema.coreFields || '[]');
    const mappedCoreFields = coreFields.filter(cf => 
      normalizedFields.some(nf => nf.standardName === cf.name)
    );

    const completeness = coreFields.length > 0 
      ? mappedCoreFields.length / coreFields.length 
      : 0;

    // 计算加权完整度
    const totalWeight = coreFields.reduce((sum, cf) => sum + (cf.weight || 0), 0);
    const mappedWeight = mappedCoreFields.reduce((sum, cf) => sum + (cf.weight || 0), 0);
    const weightedCompleteness = totalWeight > 0 ? mappedWeight / totalWeight : 0;

    return {
      normalizedFields,
      mappedCount: normalizedFields.length,
      unmappedFields: finalUnmappedFields,
      completeness,
      weightedCompleteness,
      stats: { ...this.stats },
      mappingMethod: {
        algorithm: this.stats.algorithmMapped,
        llm: this.stats.llmMapped,
        failed: this.stats.unmapped
      }
    };
  }

  /**
   * 算法映射字段
   * 
   * @param {Object} field - 原始字段
   * @param {Object} schemaMapping - Schema的字段映射
   * @returns {Object|null} 映射后的字段，如果无法映射返回null
   */
  _algorithmMap(field, schemaMapping) {
    const fieldName = field.name.toLowerCase().trim();

    // 遍历Schema的所有标准字段
    for (const [standardName, mapping] of Object.entries(schemaMapping)) {
      // 1. 精确匹配
      if (fieldName === standardName.toLowerCase()) {
        return {
          name: standardName,  // 添加name字段供entity_builder使用
          originalName: field.name,
          standardName: standardName,
          value: field.value,
          confidence: 1.0,
          mappingMethod: 'exact',
          source: field.source || 'extraction'
        };
      }

      // 2. 常见说法匹配
      const variations = mapping.common_variations || [];
      for (const variation of variations) {
        if (fieldName === variation.toLowerCase()) {
          return {
            name: standardName,  // 添加name字段供entity_builder使用
            originalName: field.name,
            standardName: standardName,
            value: field.value,
            confidence: 0.95,
            mappingMethod: 'variation',
            source: field.source || 'extraction'
          };
        }
      }

      // 3. 模糊匹配（包含关系）- 添加长度检查避免误匹配
      const minLength = Math.min(fieldName.length, standardName.toLowerCase().length);
      // 只有当较短字符串长度>=4且相似度足够高时才进行模糊匹配
      if (minLength >= 4) {
        if (fieldName.includes(standardName.toLowerCase()) || 
            standardName.toLowerCase().includes(fieldName)) {
          // 计算相似度：较短字符串长度 / 较长字符串长度
          const maxLength = Math.max(fieldName.length, standardName.toLowerCase().length);
          const similarity = minLength / maxLength;
          
          // 只有相似度>=0.6时才认为是模糊匹配
          if (similarity >= 0.6) {
            return {
              name: standardName,  // 添加name字段供entity_builder使用
              originalName: field.name,
              standardName: standardName,
              value: field.value,
              confidence: 0.85,
              mappingMethod: 'fuzzy',
              source: field.source || 'extraction'
            };
          }
        }
      }

      // 4. 常见说法的模糊匹配 - 添加长度检查避免误匹配
      for (const variation of variations) {
        const varLower = variation.toLowerCase();
        const minVarLength = Math.min(fieldName.length, varLower.length);
        
        // 只有当较短字符串长度>=4且相似度足够高时才进行模糊匹配
        if (minVarLength >= 4) {
          if (fieldName.includes(varLower) || varLower.includes(fieldName)) {
            // 计算相似度
            const maxVarLength = Math.max(fieldName.length, varLower.length);
            const varSimilarity = minVarLength / maxVarLength;
            
            // 只有相似度>=0.6时才认为是模糊匹配
            if (varSimilarity >= 0.6) {
              return {
                name: standardName,  // 添加name字段供entity_builder使用
                originalName: field.name,
                standardName: standardName,
                value: field.value,
                confidence: 0.8,
                mappingMethod: 'fuzzy_variation',
                source: field.source || 'extraction'
              };
            }
          }
        }
      }
    }

    // 无法映射
    return null;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats() {
    this.stats = {
      totalFields: 0,
      algorithmMapped: 0,
      llmMapped: 0,
      unmapped: 0
    };
  }

  /**
   * 为Schema添加新的字段映射
   * 
   * @param {string} schemaName - Schema名称
   * @param {string} standardFieldName - 标准字段名
   * @param {Array} variations - 常见说法列表
   */
  async addFieldMapping(schemaName, standardFieldName, variations) {
    await this.loadMappings();

    if (!this.mappings[schemaName]) {
      this.mappings[schemaName] = {};
    }

    if (!this.mappings[schemaName][standardFieldName]) {
      this.mappings[schemaName][standardFieldName] = {
        common_variations: [],
        weight: 0.1,
        required: false,
        description: ''
      };
    }

    // 添加新的常见说法（去重）
    const existingVariations = this.mappings[schemaName][standardFieldName].common_variations || [];
    const newVariations = variations.filter(v => !existingVariations.includes(v));
    this.mappings[schemaName][standardFieldName].common_variations.push(...newVariations);

    // 保存到文件
    await this._saveMappings();
  }

  /**
   * 保存映射表到文件
   */
  async _saveMappings() {
    try {
      const mappingPath = path.join(__dirname, 'schema_field_mappings.json');
      await fs.writeFile(
        mappingPath, 
        JSON.stringify(this.mappings, null, 2), 
        'utf-8'
      );
    } catch (error) {
      console.error('Failed to save schema field mappings:', error);
    }
  }

  /**
   * 分析字段映射覆盖率
   * 
   * @param {Array} extractedFields - 提取的字段
   * @param {string} schemaName - Schema名称
   * @returns {Object} 覆盖率分析
   */
  async analyzeCoverage(extractedFields, schemaName) {
    await this.loadMappings();

    const schemaMapping = this.mappings[schemaName];
    if (!schemaMapping) {
      return {
        coverage: 0,
        mappableFields: 0,
        unmappableFields: extractedFields.length
      };
    }

    let mappableCount = 0;
    const unmappableFields = [];

    for (const field of extractedFields) {
      const mapped = this._algorithmMap(field, schemaMapping);
      if (mapped) {
        mappableCount++;
      } else {
        unmappableFields.push(field.name);
      }
    }

    return {
      coverage: extractedFields.length > 0 ? mappableCount / extractedFields.length : 0,
      mappableFields: mappableCount,
      unmappableFields: unmappableFields.length,
      unmappableFieldNames: unmappableFields
    };
  }
}

module.exports = MappingBasedNormalizer;
