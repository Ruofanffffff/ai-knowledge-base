/**
 * Relation Description Generator
 * 
 * Generates human-readable descriptions for relationships in the knowledge graph.
 * Supports both template-based and LLM-based description generation.
 * 
 * Design Reference: Requirements 3.1-3.5
 * 
 * Key Features:
 * - Template-based description generation for all relation types
 * - LLM-based description generation for complex relationships
 * - Bilingual support (Chinese and English)
 * - Context-aware descriptions
 * - Caching for performance optimization
 */

const fs = require('fs');
const path = require('path');

/**
 * @typedef {Object} RelationDescription
 * @property {string} description - The generated description
 * @property {string} method - Method used: 'template' | 'llm' | 'fallback'
 * @property {number} confidence - Confidence score (0-1)
 * @property {Object} metadata - Additional metadata
 */

class RelationDescriptionGenerator {
  constructor(options = {}) {
    this.llmClient = options.llmClient || null;
    this.enableLLM = options.enableLLM !== false;
    this.language = options.language || 'zh'; // 'zh' or 'en'
    this.relationTypes = null;
    this.descriptionCache = new Map();
    
    // Load relation type definitions
    this._loadRelationTypes();
  }

  /**
   * Load relation type definitions from relation_types.json
   * @private
   */
  _loadRelationTypes() {
    try {
      const relationTypesPath = path.join(__dirname, '../relation/relation_types.json');
      const data = fs.readFileSync(relationTypesPath, 'utf8');
      this.relationTypes = JSON.parse(data);
    } catch (error) {
      console.error('[RelationDescriptionGenerator] Failed to load relation types:', error);
      this.relationTypes = { domains: {} };
    }
  }

  /**
   * Generate description for a relationship
   * 
   * Main entry point for description generation.
   * 
   * @param {Object} relation - Relationship object
   * @param {string} relation.type - Relation type
   * @param {Object} relation.source - Source entity
   * @param {Object} relation.target - Target entity
   * @param {Object} options - Generation options
   * @returns {Promise<RelationDescription>}
   * 
   * @example
   * const description = await generator.generateDescription({
   *   type: 'family_parent',
   *   source: { canonical_name: '张三' },
   *   target: { canonical_name: '张小明' }
   * });
   * // Returns: { description: '张三是张小明的父母', method: 'template', confidence: 0.9 }
   */
  async generateDescription(relation, options = {}) {
    try {
      // Validate input
      if (!relation || typeof relation !== 'object') {
        console.error('[RelationDescriptionGenerator] Invalid relation: must be an object');
        return this._createErrorResult('Invalid relation: must be an object');
      }

      if (!relation.source || !relation.target) {
        console.error('[RelationDescriptionGenerator] Invalid relation: missing source or target');
        return this._createErrorResult('Invalid relation: missing source or target');
      }

      if (!relation.type || typeof relation.type !== 'string') {
        console.error('[RelationDescriptionGenerator] Invalid relation: missing or invalid type');
        return this._createErrorResult('Invalid relation: missing or invalid type');
      }

      const {
        method = 'auto', // 'template' | 'llm' | 'auto'
        context = null,
        useCache = true,
        timeout = 5000 // 5 second timeout for LLM calls
      } = options;

      // Check cache
      if (useCache) {
        const cacheKey = this._getCacheKey(relation);
        if (this.descriptionCache.has(cacheKey)) {
          return this.descriptionCache.get(cacheKey);
        }
      }

      let result;

      // Auto mode: try template first, then LLM if needed
      if (method === 'auto') {
        try {
          result = await this.generateTemplateDescription(relation);
          
          // If template confidence is low and LLM is available, try LLM
          if (result.confidence < 0.7 && this.enableLLM && this.llmClient) {
            try {
              const llmResult = await this._withTimeout(
                this.generateLLMDescription(relation, context),
                timeout
              );
              if (llmResult.confidence > result.confidence) {
                result = llmResult;
              }
            } catch (error) {
              console.error('[RelationDescriptionGenerator] LLM generation failed in auto mode:', error.message);
              // Continue with template result
            }
          }
        } catch (error) {
          console.error('[RelationDescriptionGenerator] Template generation failed:', error.message);
          result = this._generateFallbackDescription(relation);
        }
      } else if (method === 'template') {
        try {
          result = await this.generateTemplateDescription(relation);
        } catch (error) {
          console.error('[RelationDescriptionGenerator] Template generation failed:', error.message);
          result = this._generateFallbackDescription(relation);
        }
      } else if (method === 'llm') {
        try {
          result = await this._withTimeout(
            this.generateLLMDescription(relation, context),
            timeout
          );
        } catch (error) {
          console.error('[RelationDescriptionGenerator] LLM generation failed:', error.message);
          result = this._generateFallbackDescription(relation);
        }
      } else {
        result = this._generateFallbackDescription(relation);
      }

      // Cache the result
      if (useCache && result.method !== 'error') {
        const cacheKey = this._getCacheKey(relation);
        this.descriptionCache.set(cacheKey, result);
        
        // Limit cache size
        if (this.descriptionCache.size > 1000) {
          const firstKey = this.descriptionCache.keys().next().value;
          this.descriptionCache.delete(firstKey);
        }
      }

      return result;
    } catch (error) {
      console.error('[RelationDescriptionGenerator] Unexpected error in generateDescription:', error.message);
      return this._createErrorResult(error.message);
    }
  }

  /**
   * Create error result
   * @private
   */
  _createErrorResult(errorMessage) {
    return {
      description: 'Error generating description',
      method: 'error',
      confidence: 0.0,
      metadata: {
        error: errorMessage,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Execute promise with timeout
   * @private
   */
  async _withTimeout(promise, timeoutMs) {
    return Promise.race([
      promise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
      )
    ]);
  }

  /**
   * Generate template-based description
   * 
   * Uses predefined templates for each relation type.
   * 
   * @param {Object} relation - Relationship object
   * @returns {Promise<RelationDescription>}
   */
  async generateTemplateDescription(relation) {
    try {
      if (!relation || typeof relation !== 'object') {
        throw new Error('Invalid relation object');
      }

      const { type, source, target } = relation;

      if (!source || !target) {
        throw new Error('Missing source or target entity');
      }

      // Find relation type definition (always returns a definition, even for unknown types)
      const relationType = this._findRelationType(type);

      // Get template for this relation type
      const template = this._getTemplate(relationType);
      
      if (!template) {
        return this._generateFallbackDescription(relation);
      }

      // Substitute variables in template
      const description = this._substituteTemplate(template, {
        source: source.canonical_name || source.name || 'Unknown',
        target: target.canonical_name || target.name || 'Unknown',
        type: relationType.displayName || relationType.name
      });

      return {
        description: description,
        method: 'template',
        confidence: 0.9,
        metadata: {
          relation_type: type,
          template_used: template
        }
      };
    } catch (error) {
      console.error('[RelationDescriptionGenerator] Error in generateTemplateDescription:', error.message);
      return this._generateFallbackDescription(relation);
    }
  }

  /**
   * Generate LLM-based description
   * 
   * Uses LLM to generate contextual descriptions.
   * 
   * @param {Object} relation - Relationship object
   * @param {string} context - Optional context text
   * @returns {Promise<RelationDescription>}
   */
  async generateLLMDescription(relation, context = null) {
    try {
      if (!this.llmClient) {
        console.log('[RelationDescriptionGenerator] LLM client not available');
        return this._generateFallbackDescription(relation);
      }

      if (!relation || typeof relation !== 'object') {
        throw new Error('Invalid relation object');
      }

      const { type, source, target } = relation;

      if (!source || !target) {
        throw new Error('Missing source or target entity');
      }

      // Build prompt
      const prompt = this._buildLLMPrompt(relation, context);

      try {
        const response = await this.llmClient.callJSON(prompt, {
          temperature: 0.3,
          maxTokens: 200,
          systemPrompt: '你是一个关系描述生成专家。'
        });

        // Validate response
        if (!response || !response.description) {
          console.warn('[RelationDescriptionGenerator] LLM returned invalid response');
          return this._generateFallbackDescription(relation);
        }

        // Validate description quality
        const validation = this._validateDescription(response.description, relation);
        
        if (!validation.isValid) {
          console.warn('[RelationDescriptionGenerator] LLM description failed validation:', validation.reason);
          return this._generateFallbackDescription(relation);
        }

        return {
          description: response.description,
          method: 'llm',
          confidence: response.confidence || 0.8,
          metadata: {
            relation_type: type,
            llm_reasoning: response.reasoning || ''
          }
        };
      } catch (llmError) {
        console.error('[RelationDescriptionGenerator] LLM API call failed:', llmError.message);
        return this._generateFallbackDescription(relation);
      }
    } catch (error) {
      console.error('[RelationDescriptionGenerator] Error in generateLLMDescription:', error.message);
      return this._generateFallbackDescription(relation);
    }
  }

  /**
   * Find relation type definition
   * @private
   */
  _findRelationType(typeId) {
    try {
      if (!this.relationTypes || !this.relationTypes.domains) {
        // Return a minimal type definition for unknown types
        return {
          name: typeId,
          displayName: typeId,
          isDirectional: false
        };
      }

      // Search through all domains and categories
      for (const domain of Object.values(this.relationTypes.domains)) {
        if (domain.categories) {
          for (const category of Object.values(domain.categories)) {
            if (category.types) {
              const found = category.types.find(t => 
                t.relationTypeId === typeId || t.name === typeId
              );
              if (found) return found;
            }
          }
        }
      }

      // Return a minimal type definition for unknown types
      return {
        name: typeId,
        displayName: typeId,
        isDirectional: false
      };
    } catch (error) {
      console.error('[RelationDescriptionGenerator] Error in _findRelationType:', error.message);
      return {
        name: typeId || 'unknown',
        displayName: typeId || 'unknown',
        isDirectional: false
      };
    }
  }

  /**
   * Get template for relation type
   * @private
   */
  _getTemplate(relationType) {
    const lang = this.language;
    
    // Chinese templates
    if (lang === 'zh') {
      return this._getChineseTemplate(relationType);
    }
    
    // English templates
    return this._getEnglishTemplate(relationType);
  }

  /**
   * Get Chinese template
   * @private
   */
  _getChineseTemplate(relationType) {
    const { name, displayName, isDirectional } = relationType;

    // Common templates based on relation type patterns
    const templates = {
      // Family relations
      'parent': '{source}是{target}的父母',
      'child': '{source}是{target}的子女',
      'spouse': '{source}和{target}是配偶关系',
      'sibling': '{source}和{target}是兄弟姐妹',
      'grandparent': '{source}是{target}的祖父母',
      'grandchild': '{source}是{target}的孙子女',
      
      // Work relations
      'colleague': '{source}和{target}是同事关系',
      'supervisor': '{source}是{target}的上级',
      'subordinate': '{source}是{target}的下属',
      'mentor': '{source}是{target}的导师',
      
      // Location relations
      'located_in': '{source}位于{target}',
      'contains': '{source}包含{target}',
      'near': '{source}靠近{target}',
      
      // Temporal relations
      'before': '{source}发生在{target}之前',
      'after': '{source}发生在{target}之后',
      'during': '{source}发生在{target}期间',
      
      // Causal relations
      'causes': '{source}导致{target}',
      'caused_by': '{source}由{target}引起',
      'enables': '{source}使{target}成为可能',
      
      // Part-whole relations
      'part_of': '{source}是{target}的一部分',
      'has_part': '{source}包含部分{target}',
      'component_of': '{source}是{target}的组成部分',
      
      // Attribute relations
      'has_property': '{source}具有属性{target}',
      'property_of': '{source}是{target}的属性',
      
      // Hierarchical relations
      'is_a': '{source}是一种{target}',
      'subclass_of': '{source}是{target}的子类',
      'instance_of': '{source}是{target}的实例',
      
      // Co-occurrence relation
      'co_occurrence': '{source}和{target}经常一起出现'
    };

    // Try to find exact match
    if (templates[name]) {
      return templates[name];
    }

    // Generic template based on directionality
    if (isDirectional) {
      return `{source}与{target}存在${displayName}关系`;
    } else {
      return `{source}和{target}存在${displayName}关系`;
    }
  }

  /**
   * Get English template
   * @private
   */
  _getEnglishTemplate(relationType) {
    const { name, displayName, isDirectional } = relationType;

    const templates = {
      'parent': '{source} is the parent of {target}',
      'child': '{source} is the child of {target}',
      'spouse': '{source} and {target} are spouses',
      'sibling': '{source} and {target} are siblings',
      'located_in': '{source} is located in {target}',
      'contains': '{source} contains {target}',
      'causes': '{source} causes {target}',
      'part_of': '{source} is part of {target}',
      'has_property': '{source} has property {target}',
      'is_a': '{source} is a type of {target}',
      'co_occurrence': '{source} and {target} frequently co-occur'
    };

    if (templates[name]) {
      return templates[name];
    }

    if (isDirectional) {
      return `{source} has ${displayName} relation with {target}`;
    } else {
      return `{source} and {target} have ${displayName} relation`;
    }
  }

  /**
   * Substitute template variables
   * @private
   */
  _substituteTemplate(template, variables) {
    try {
      if (!template || typeof template !== 'string') {
        return '';
      }

      let result = template;
      
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{${key}}`;
        const safeValue = String(value || '');
        result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), safeValue);
      }
      
      return result;
    } catch (error) {
      console.error('[RelationDescriptionGenerator] Error in _substituteTemplate:', error.message);
      return template || '';
    }
  }

  /**
   * Build LLM prompt for description generation
   * @private
   */
  _buildLLMPrompt(relation, context) {
    const { type, source, target } = relation;
    const relationType = this._findRelationType(type);
    
    const contextText = context || '';
    const typeInfo = relationType ? relationType.displayName : type;

    return `你是一个关系描述生成专家。请为以下关系生成一个简洁、准确的中文描述。

关系信息:
- 源实体: ${source.canonical_name || source.name || 'Unknown'}
- 目标实体: ${target.canonical_name || target.name || 'Unknown'}
- 关系类型: ${typeInfo}
${contextText ? `- 上下文: ${contextText}` : ''}

要求:
1. 描述应该简洁明了（5-20个字）
2. 必须包含源实体和目标实体的名称
3. 清楚表达两者之间的关系
4. 使用自然、流畅的中文表达
5. 不要添加额外的解释或评论

输出 JSON 格式:
{
  "description": "生成的关系描述",
  "confidence": 0.9,
  "reasoning": "简短说明生成描述的理由"
}

示例:
输入: 源实体="张三", 目标实体="张小明", 关系类型="父母"
输出: {"description": "张三是张小明的父亲", "confidence": 0.95, "reasoning": "根据父母关系生成"}`;
  }

  /**
   * Validate description quality
   * @private
   */
  _validateDescription(description, relation) {
    const { source, target } = relation;

    // Check length (5-50 words for Chinese, 5-100 chars for English)
    if (this.language === 'zh') {
      if (description.length < 5 || description.length > 50) {
        return { isValid: false, reason: 'length_out_of_range' };
      }
    } else {
      if (description.length < 10 || description.length > 100) {
        return { isValid: false, reason: 'length_out_of_range' };
      }
    }

    // Check if description contains entity names
    const sourceName = source.canonical_name || source.name || '';
    const targetName = target.canonical_name || target.name || '';
    
    if (sourceName && !description.includes(sourceName)) {
      return { isValid: false, reason: 'missing_source_entity' };
    }
    
    if (targetName && !description.includes(targetName)) {
      return { isValid: false, reason: 'missing_target_entity' };
    }

    return { isValid: true };
  }

  /**
   * Generate fallback description
   * @private
   */
  _generateFallbackDescription(relation) {
    try {
      if (!relation || typeof relation !== 'object') {
        return {
          description: 'Error generating description',
          method: 'fallback',
          confidence: 0.1,
          metadata: {
            reason: 'invalid_relation'
          }
        };
      }

      const { type, source, target } = relation;
      const sourceName = source?.canonical_name || source?.name || 'Unknown';
      const targetName = target?.canonical_name || target?.name || 'Unknown';

      // Minimal fallback template
      const description = this.language === 'zh'
        ? `${sourceName}与${targetName}存在${type || 'unknown'}关系`
        : `${sourceName} has ${type || 'unknown'} relation with ${targetName}`;

      return {
        description: description,
        method: 'fallback',
        confidence: 0.5,
        metadata: {
          relation_type: type || 'unknown',
          reason: 'no_template_or_llm_available'
        }
      };
    } catch (error) {
      console.error('[RelationDescriptionGenerator] Error in _generateFallbackDescription:', error.message);
      return {
        description: 'Error generating description',
        method: 'fallback',
        confidence: 0.1,
        metadata: {
          error: error.message
        }
      };
    }
  }

  /**
   * Get cache key for a relation
   * @private
   */
  _getCacheKey(relation) {
    try {
      if (!relation || typeof relation !== 'object') {
        return 'invalid';
      }

      const { type, source, target } = relation;
      const sourceName = source?.canonical_name || source?.name || '';
      const targetName = target?.canonical_name || target?.name || '';
      return `${type || 'unknown'}:${sourceName}:${targetName}`;
    } catch (error) {
      console.error('[RelationDescriptionGenerator] Error in _getCacheKey:', error.message);
      return 'error';
    }
  }

  /**
   * Clear description cache
   */
  clearCache() {
    this.descriptionCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.descriptionCache.size,
      maxSize: 1000 // Could be configurable
    };
  }
}

module.exports = {
  RelationDescriptionGenerator
};
