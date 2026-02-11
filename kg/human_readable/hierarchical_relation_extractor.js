/**
 * Hierarchical Relation Extractor
 * 
 * Extracts hierarchical relationships (is_a, part_of, has_property) from text.
 * Supports both pattern-based extraction and LLM-based inference.
 * 
 * Design Reference: Requirements 4.1-4.5
 * 
 * Key Features:
 * - Pattern-based extraction for explicit hierarchical relationships
 * - LLM-based inference for implicit relationships
 * - Domain knowledge integration
 * - Circular hierarchy detection
 * - Bilingual support (Chinese and English)
 */

/**
 * @typedef {Object} HierarchicalRelation
 * @property {string} source_id - Source entity ID
 * @property {string} target_id - Target entity ID
 * @property {string} type - Always 'hierarchical'
 * @property {string} subtype - Hierarchy type: 'is_a' | 'part_of' | 'has_property'
 * @property {string} description - Human-readable description
 * @property {number} confidence - Confidence score (0-1)
 * @property {Array<string>} evidence_ckb - Supporting CKB IDs
 * @property {string} evidence_text - Evidence text snippet
 * @property {Object} metadata - Additional metadata
 */

class HierarchicalRelationExtractor {
  constructor(options = {}) {
    this.llmClient = options.llmClient || null;
    this.enableLLM = options.enableLLM !== false;
    this.language = options.language || 'zh'; // 'zh' or 'en'
    this.domainKnowledge = options.domainKnowledge || {};
    
    // Initialize patterns
    this._initializePatterns();
  }

  /**
   * Initialize extraction patterns
   * @private
   */
  _initializePatterns() {
    // Chinese patterns - enhanced with more variations
    this.chinesePatterns = {
      is_a: [
        // Basic patterns
        /(.+?)是一种(.+)/,
        /(.+?)属于(.+)/,
        /(.+?)是(.+?)的一种/,
        /(.+?)是(.+?)类型/,
        /(.+?)为(.+?)的一种/,
        // Extended patterns
        /(.+?)是(.+?)之一/,
        /(.+?)归属于(.+)/,
        /(.+?)归类为(.+)/,
        /(.+?)可以分类为(.+)/,
        /(.+?)被归为(.+)/,
        /(.+?)作为(.+?)的一种/,
        /(.+?)算是(.+)/,
        /(.+?)也是(.+)/
      ],
      part_of: [
        // Basic patterns
        /(.+?)是(.+?)的一部分/,
        /(.+?)包含(.+)/,
        /(.+?)由(.+?)组成/,
        /(.+?)的(.+?)部分/,
        /(.+?)中的(.+)/,
        // Extended patterns
        /(.+?)含有(.+)/,
        /(.+?)包括(.+)/,
        /(.+?)涵盖(.+)/,
        /(.+?)囊括(.+)/,
        /(.+?)构成(.+?)的一部分/,
        /(.+?)组成(.+)/,
        /(.+?)是(.+?)的组成部分/,
        /(.+?)是(.+?)的构成要素/
      ],
      has_property: [
        // Basic patterns
        /(.+?)的(.+?)是(.+)/,
        /(.+?)具有(.+)/,
        /(.+?)拥有(.+)/,
        /(.+?)有(.+?)属性/,
        /(.+?)的特点是(.+)/,
        // Extended patterns
        /(.+?)具备(.+)/,
        /(.+?)带有(.+)/,
        /(.+?)配备(.+)/,
        /(.+?)的特征是(.+)/,
        /(.+?)的性质是(.+)/,
        /(.+?)表现出(.+)/,
        /(.+?)呈现(.+?)特性/
      ]
    };

    // English patterns - enhanced with more variations
    this.englishPatterns = {
      is_a: [
        // Basic patterns
        /(.+?)\s+is\s+a\s+(?:type\s+of\s+)?(.+)/i,
        /(.+?)\s+is\s+an\s+(.+)/i,
        /(.+?)\s+belongs\s+to\s+(.+)/i,
        /(.+?)\s+is\s+a\s+kind\s+of\s+(.+)/i,
        // Extended patterns
        /(.+?)\s+is\s+one\s+of\s+(?:the\s+)?(.+)/i,
        /(.+?)\s+falls\s+under\s+(.+)/i,
        /(.+?)\s+can\s+be\s+classified\s+as\s+(.+)/i,
        /(.+?)\s+is\s+categorized\s+as\s+(.+)/i,
        /(.+?)\s+represents\s+a\s+(?:type\s+of\s+)?(.+)/i,
        /(.+?)\s+serves\s+as\s+a\s+(.+)/i
      ],
      part_of: [
        // Basic patterns
        /(.+?)\s+is\s+part\s+of\s+(.+)/i,
        /(.+?)\s+contains\s+(.+)/i,
        /(.+?)\s+consists\s+of\s+(.+)/i,
        /(.+?)\s+includes\s+(.+)/i,
        // Extended patterns
        /(.+?)\s+comprises\s+(.+)/i,
        /(.+?)\s+is\s+composed\s+of\s+(.+)/i,
        /(.+?)\s+is\s+made\s+up\s+of\s+(.+)/i,
        /(.+?)\s+incorporates\s+(.+)/i,
        /(.+?)\s+encompasses\s+(.+)/i,
        /(.+?)\s+forms\s+part\s+of\s+(.+)/i
      ],
      has_property: [
        // Basic patterns
        /(.+?)\s+has\s+(?:a\s+)?(.+)/i,
        /(.+?)\s+with\s+(.+)/i,
        /(.+?)'s\s+(.+)\s+is\s+(.+)/i,
        // Extended patterns
        /(.+?)\s+possesses\s+(.+)/i,
        /(.+?)\s+features\s+(.+)/i,
        /(.+?)\s+exhibits\s+(.+)/i,
        /(.+?)\s+displays\s+(.+)/i,
        /(.+?)\s+is\s+characterized\s+by\s+(.+)/i,
        /(.+?)\s+shows\s+(.+)/i
      ]
    };

    // Compile patterns for better performance
    this._compilePatterns();
  }

  /**
   * Compile regex patterns for better performance
   * @private
   */
  _compilePatterns() {
    // Patterns are already RegExp objects, but we can add flags if needed
    // This method is a placeholder for future optimization
  }

  /**
   * Extract hierarchical relations from text and entities
   * 
   * Main entry point for hierarchical extraction.
   * 
   * @param {string} text - Document text
   * @param {Array<Object>} entities - Extracted entities
   * @param {Object} options - Extraction options
   * @returns {Promise<Array<HierarchicalRelation>>}
   * 
   * @example
   * const relations = await extractor.extractHierarchicalRelations(
   *   "Canon EOS R5是一种全画幅无反相机",
   *   [{ id: 'e1', canonical_name: 'Canon EOS R5' }, { id: 'e2', canonical_name: '全画幅无反相机' }]
   * );
   */
  async extractHierarchicalRelations(text, entities, options = {}) {
    try {
      // Validate input
      if (!text || typeof text !== 'string') {
        console.error('[HierarchicalRelationExtractor] Invalid text: must be a non-empty string');
        return [];
      }

      if (!Array.isArray(entities)) {
        console.error('[HierarchicalRelationExtractor] Invalid entities: must be an array');
        return [];
      }

      if (entities.length === 0) {
        return [];
      }

      const {
        method = 'hybrid', // 'pattern' | 'llm' | 'hybrid'
        confidenceThreshold = 0.7,
        maxRelations = 50,
        timeout = 10000 // 10 second timeout for LLM calls
      } = options;

      const relations = [];

      // Pattern-based extraction
      if (method === 'pattern' || method === 'hybrid') {
        try {
          const patternRelations = await this._extractWithPatterns(text, entities);
          relations.push(...patternRelations);
        } catch (error) {
          console.error('[HierarchicalRelationExtractor] Pattern extraction failed:', error.message);
          // Continue with other methods
        }
      }

      // LLM-based inference
      if ((method === 'llm' || method === 'hybrid') && this.enableLLM && this.llmClient) {
        try {
          const llmRelations = await this._withTimeout(
            this._extractWithLLM(text, entities),
            timeout
          );
          relations.push(...llmRelations);
        } catch (error) {
          console.error('[HierarchicalRelationExtractor] LLM extraction failed:', error.message);
          // Continue with other methods
        }
      }

      // Domain knowledge integration
      try {
        const knowledgeRelations = await this._extractWithDomainKnowledge(entities);
        relations.push(...knowledgeRelations);
      } catch (error) {
        console.error('[HierarchicalRelationExtractor] Domain knowledge extraction failed:', error.message);
        // Continue with existing relations
      }

      // Filter by confidence and remove duplicates
      const filteredRelations = this._filterAndDeduplicate(relations, confidenceThreshold);

      // Detect and remove circular hierarchies
      const validRelations = this._removeCircularHierarchies(filteredRelations);

      // Limit to max relations
      return validRelations.slice(0, maxRelations);
    } catch (error) {
      console.error('[HierarchicalRelationExtractor] Unexpected error in extractHierarchicalRelations:', error.message);
      return [];
    }
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
   * Extract is_a relationships (taxonomy)
   * 
   * @param {string} text - Document text
   * @param {Array<Object>} entities - Extracted entities
   * @returns {Array<HierarchicalRelation>}
   */
  extractIsARelations(text, entities) {
    return this._extractByType(text, entities, 'is_a');
  }

  /**
   * Extract part_of relationships (composition)
   * 
   * @param {string} text - Document text
   * @param {Array<Object>} entities - Extracted entities
   * @returns {Array<HierarchicalRelation>}
   */
  extractPartOfRelations(text, entities) {
    return this._extractByType(text, entities, 'part_of');
  }

  /**
   * Extract has_property relationships (attributes)
   * 
   * @param {string} text - Document text
   * @param {Array<Object>} entities - Extracted entities
   * @returns {Array<HierarchicalRelation>}
   */
  extractHasPropertyRelations(text, entities) {
    return this._extractByType(text, entities, 'has_property');
  }

  /**
   * Extract relations by specific type
   * @private
   */
  _extractByType(text, entities, hierarchyType) {
    try {
      if (!text || typeof text !== 'string') {
        return [];
      }

      if (!Array.isArray(entities) || entities.length === 0) {
        return [];
      }

      const patterns = this.language === 'zh' 
        ? this.chinesePatterns[hierarchyType] 
        : this.englishPatterns[hierarchyType];

      if (!patterns || !Array.isArray(patterns)) {
        return [];
      }

      const relations = [];

      for (const pattern of patterns) {
        try {
          const matches = text.matchAll(new RegExp(pattern, 'g'));
          
          for (const match of matches) {
            try {
              const relation = this._createRelationFromMatch(match, entities, hierarchyType, text);
              if (relation) {
                relations.push(relation);
              }
            } catch (error) {
              console.error('[HierarchicalRelationExtractor] Error creating relation from match:', error.message);
              // Continue with next match
            }
          }
        } catch (error) {
          console.error('[HierarchicalRelationExtractor] Error matching pattern:', error.message);
          // Continue with next pattern
        }
      }

      return relations;
    } catch (error) {
      console.error('[HierarchicalRelationExtractor] Error in _extractByType:', error.message);
      return [];
    }
  }

  /**
   * Extract with pattern matching
   * @private
   */
  async _extractWithPatterns(text, entities) {
    try {
      if (!text || !Array.isArray(entities)) {
        return [];
      }

      const relations = [];

      // Extract each type
      try {
        relations.push(...this.extractIsARelations(text, entities));
      } catch (error) {
        console.error('[HierarchicalRelationExtractor] Error extracting is_a relations:', error.message);
      }

      try {
        relations.push(...this.extractPartOfRelations(text, entities));
      } catch (error) {
        console.error('[HierarchicalRelationExtractor] Error extracting part_of relations:', error.message);
      }

      try {
        relations.push(...this.extractHasPropertyRelations(text, entities));
      } catch (error) {
        console.error('[HierarchicalRelationExtractor] Error extracting has_property relations:', error.message);
      }

      // Try dependency parsing for complex patterns
      try {
        const dependencyRelations = this._extractWithDependencyParsing(text, entities);
        relations.push(...dependencyRelations);
      } catch (error) {
        console.error('[HierarchicalRelationExtractor] Error in dependency parsing:', error.message);
      }

      return relations;
    } catch (error) {
      console.error('[HierarchicalRelationExtractor] Error in _extractWithPatterns:', error.message);
      return [];
    }
  }

  /**
   * Extract with dependency parsing for complex patterns
   * @private
   */
  _extractWithDependencyParsing(text, entities) {
    // Placeholder for dependency parsing
    // This would use NLP libraries like compromise or natural
    // For now, we use advanced regex patterns
    
    const relations = [];
    
    // Complex Chinese patterns using sentence structure
    const complexChinesePatterns = [
      // Pattern: X，作为Y，...
      { regex: /(.+?)，作为(.+?)，/g, type: 'is_a' },
      // Pattern: X（Y）
      { regex: /(.+?)（(.+?)）/g, type: 'is_a' },
      // Pattern: X，即Y
      { regex: /(.+?)，即(.+)/g, type: 'is_a' },
      // Pattern: X，也就是Y
      { regex: /(.+?)，也就是(.+)/g, type: 'is_a' }
    ];

    // Complex English patterns
    const complexEnglishPatterns = [
      // Pattern: X, which is a Y
      { regex: /(.+?),\s*which\s+is\s+a\s+(.+)/gi, type: 'is_a' },
      // Pattern: X (a Y)
      { regex: /(.+?)\s*\(a\s+(.+?)\)/gi, type: 'is_a' },
      // Pattern: X, namely Y
      { regex: /(.+?),\s*namely\s+(.+)/gi, type: 'is_a' }
    ];

    const patterns = this.language === 'zh' 
      ? complexChinesePatterns 
      : complexEnglishPatterns;

    for (const { regex, type } of patterns) {
      const matches = text.matchAll(regex);
      
      for (const match of matches) {
        const relation = this._createRelationFromMatch(match, entities, type, text);
        if (relation) {
          // Mark as dependency-parsed
          relation.metadata.extraction_method = 'dependency_parsing';
          relation.confidence = 0.85; // Slightly lower confidence
          relations.push(relation);
        }
      }
    }

    return relations;
  }

  /**
   * Create relation from regex match
   * @private
   */
  _createRelationFromMatch(match, entities, hierarchyType, text) {
    const [fullMatch, source, target] = match;
    
    if (!source || !target) return null;

    // Find matching entities
    const sourceEntity = this._findEntityByName(source.trim(), entities);
    const targetEntity = this._findEntityByName(target.trim(), entities);

    if (!sourceEntity || !targetEntity) return null;

    // Generate description
    const description = this._generateDescription(
      sourceEntity.canonical_name || sourceEntity.name,
      targetEntity.canonical_name || targetEntity.name,
      hierarchyType
    );

    return {
      source_id: sourceEntity.id,
      target_id: targetEntity.id,
      type: 'hierarchical',
      subtype: hierarchyType,
      description: description,
      confidence: 0.9, // High confidence for pattern matches
      evidence_ckb: [],
      evidence_text: fullMatch,
      metadata: {
        hierarchy_type: hierarchyType,
        extraction_method: 'pattern',
        pattern_matched: true
      }
    };
  }

  /**
   * Find entity by name with fuzzy matching
   * @private
   */
  _findEntityByName(name, entities) {
    const normalizedName = name.toLowerCase().trim();
    
    // Try exact match first
    let entity = entities.find(e => {
      const entityName = (e.canonical_name || e.name || '').toLowerCase().trim();
      return entityName === normalizedName;
    });
    
    if (entity) return entity;
    
    // Try partial match (contains)
    entity = entities.find(e => {
      const entityName = (e.canonical_name || e.name || '').toLowerCase().trim();
      return entityName.includes(normalizedName) || normalizedName.includes(entityName);
    });
    
    if (entity) return entity;
    
    // Try fuzzy match with similarity threshold
    const threshold = 0.7;
    for (const e of entities) {
      const entityName = (e.canonical_name || e.name || '').toLowerCase().trim();
      const similarity = this._calculateSimilarity(normalizedName, entityName);
      
      if (similarity >= threshold) {
        return e;
      }
    }
    
    return null;
  }

  /**
   * Calculate string similarity (Levenshtein-based)
   * @private
   */
  _calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this._levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance
   * @private
   */
  _levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Generate description for hierarchical relation
   * @private
   */
  _generateDescription(sourceName, targetName, hierarchyType) {
    if (this.language === 'zh') {
      const templates = {
        is_a: `${sourceName}是一种${targetName}`,
        part_of: `${sourceName}是${targetName}的一部分`,
        has_property: `${sourceName}具有属性${targetName}`
      };
      return templates[hierarchyType] || `${sourceName}与${targetName}存在${hierarchyType}关系`;
    } else {
      const templates = {
        is_a: `${sourceName} is a type of ${targetName}`,
        part_of: `${sourceName} is part of ${targetName}`,
        has_property: `${sourceName} has property ${targetName}`
      };
      return templates[hierarchyType] || `${sourceName} has ${hierarchyType} relation with ${targetName}`;
    }
  }

  /**
   * Extract with LLM inference
   * @private
   */
  async _extractWithLLM(text, entities) {
    if (!this.llmClient || entities.length < 2) {
      return [];
    }

    try {
      const prompt = this._buildLLMPrompt(text, entities);
      
      // Call LLM
      let response;
      if (typeof this.llmClient === 'function') {
        response = await this.llmClient(prompt);
      } else {
        const result = await this.llmClient.call(prompt, {
          temperature: 0.2,
          maxTokens: 1000,
          systemPrompt: '你是一个知识图谱层级关系抽取专家。'
        });
        response = result.content;
      }

      // Parse response
      const relations = this._parseLLMResponse(response, entities);
      
      return relations;
    } catch (error) {
      console.error('[HierarchicalRelationExtractor] LLM extraction failed:', error);
      return [];
    }
  }

  /**
   * Build LLM prompt for hierarchical extraction
   * @private
   */
  _buildLLMPrompt(text, entities) {
    const entityList = entities
      .filter(e => e && e.id && (e.canonical_name || e.name))
      .map((e, i) => 
        `${i + 1}. ${e.canonical_name || e.name} (ID: ${e.id})`
      ).join('\n');

    return `你是一个知识图谱层级关系抽取专家。请从以下文本中识别实体之间的层级关系。

文本: ${text}

实体列表:
${entityList}

层级关系类型:
1. is_a: 分类关系 (A是一种B, A属于B类)
2. part_of: 组成关系 (A是B的一部分, B包含A)
3. has_property: 属性关系 (A具有属性B, A的特征是B)

要求:
1. 只抽取文本中明确或隐含的层级关系
2. 关系必须连接实体列表中的实体
3. 提供证据文本
4. 评估置信度(0-1)

输出 JSON 格式:
{
  "relations": [
    {
      "source": "实体名称",
      "source_id": "实体ID",
      "target": "实体名称",
      "target_id": "实体ID",
      "hierarchy_type": "is_a/part_of/has_property",
      "evidence_text": "证据文本",
      "confidence": 0.85
    }
  ]
}`;
  }

  /**
   * Parse LLM response
   * @private
   */
  _parseLLMResponse(response, entities) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const data = JSON.parse(jsonMatch[0]);
      const candidates = data.relations || [];

      return candidates
        .filter(c => c.source_id && c.target_id && c.hierarchy_type)
        .map(c => ({
          source_id: c.source_id,
          target_id: c.target_id,
          type: 'hierarchical',
          subtype: c.hierarchy_type,
          description: this._generateDescription(
            c.source || '',
            c.target || '',
            c.hierarchy_type
          ),
          confidence: (c.confidence || 0.7) * 0.9, // LLM discount
          evidence_ckb: [],
          evidence_text: c.evidence_text || '',
          metadata: {
            hierarchy_type: c.hierarchy_type,
            extraction_method: 'llm',
            llm_inferred: true
          }
        }));
    } catch (error) {
      console.error('[HierarchicalRelationExtractor] Failed to parse LLM response:', error);
      return [];
    }
  }

  /**
   * Extract with domain knowledge
   * @private
   */
  async _extractWithDomainKnowledge(entities) {
    // Placeholder for domain knowledge integration
    // Will be implemented in task 8.6
    return [];
  }

  /**
   * Filter and deduplicate relations
   * @private
   */
  _filterAndDeduplicate(relations, confidenceThreshold) {
    // Filter by confidence
    const filtered = relations.filter(r => r.confidence >= confidenceThreshold);

    // Deduplicate by source-target-type combination
    const seen = new Set();
    const deduplicated = [];

    for (const relation of filtered) {
      const key = `${relation.source_id}:${relation.target_id}:${relation.subtype}`;
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(relation);
      }
    }

    return deduplicated;
  }

  /**
   * Remove circular hierarchies
   * @private
   */
  _removeCircularHierarchies(relations) {
    // Build adjacency list
    const graph = new Map();
    
    for (const relation of relations) {
      if (!graph.has(relation.source_id)) {
        graph.set(relation.source_id, []);
      }
      graph.get(relation.source_id).push(relation.target_id);
    }

    // Detect cycles using DFS
    const visited = new Set();
    const recursionStack = new Set();
    const cycleNodes = new Set();

    const hasCycle = (node) => {
      visited.add(node);
      recursionStack.add(node);

      const neighbors = graph.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) {
            cycleNodes.add(node);
            cycleNodes.add(neighbor);
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          cycleNodes.add(node);
          cycleNodes.add(neighbor);
          return true;
        }
      }

      recursionStack.delete(node);
      return false;
    };

    // Check all nodes
    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        hasCycle(node);
      }
    }

    // Remove relations involving cycle nodes
    return relations.filter(r => 
      !cycleNodes.has(r.source_id) && !cycleNodes.has(r.target_id)
    );
  }

  /**
   * Infer hierarchical relationships using LLM
   * 
   * Used when explicit patterns are not found.
   * 
   * @param {Array<Object>} entities - Extracted entities
   * @param {Object} domainKnowledge - Domain-specific knowledge
   * @returns {Promise<Array<HierarchicalRelation>>}
   */
  async inferHierarchicalRelations(entities, domainKnowledge = {}) {
    if (!this.llmClient || entities.length < 2) {
      return [];
    }

    // Group entities by domain if available
    const groupedEntities = this._groupEntitiesByDomain(entities, domainKnowledge);

    const allRelations = [];

    for (const [domain, domainEntities] of Object.entries(groupedEntities)) {
      if (domainEntities.length < 2) continue;

      try {
        const prompt = this._buildInferencePrompt(domainEntities, domain, domainKnowledge);
        
        let response;
        if (typeof this.llmClient === 'function') {
          response = await this.llmClient(prompt);
        } else {
          const result = await this.llmClient.call(prompt, {
            temperature: 0.3,
            maxTokens: 1000,
            systemPrompt: '你是一个知识图谱层级关系推理专家。'
          });
          response = result.content;
        }

        const relations = this._parseLLMResponse(response, domainEntities);
        allRelations.push(...relations);
      } catch (error) {
        console.error(`[HierarchicalRelationExtractor] Inference failed for domain ${domain}:`, error);
      }
    }

    return allRelations;
  }

  /**
   * Group entities by domain
   * @private
   */
  _groupEntitiesByDomain(entities, domainKnowledge) {
    const groups = { general: [] };

    for (const entity of entities) {
      const domain = entity.domain || entity.type || 'general';
      
      if (!groups[domain]) {
        groups[domain] = [];
      }
      
      groups[domain].push(entity);
    }

    return groups;
  }

  /**
   * Build inference prompt
   * @private
   */
  _buildInferencePrompt(entities, domain, domainKnowledge) {
    const entityList = entities
      .map((e, i) => `${i + 1}. ${e.canonical_name || e.name} (ID: ${e.id})`)
      .join('\n');

    const domainContext = domainKnowledge[domain] 
      ? `\n领域知识: ${JSON.stringify(domainKnowledge[domain])}`
      : '';

    return `你是一个知识图谱层级关系推理专家。请根据领域知识推理以下实体之间可能存在的层级关系。

领域: ${domain}${domainContext}

实体列表:
${entityList}

请推理可能的层级关系:
1. is_a: 分类关系
2. part_of: 组成关系
3. has_property: 属性关系

输出 JSON 格式:
{
  "relations": [
    {
      "source": "实体名称",
      "source_id": "实体ID",
      "target": "实体名称",
      "target_id": "实体ID",
      "hierarchy_type": "is_a/part_of/has_property",
      "evidence_text": "推理依据",
      "confidence": 0.75
    }
  ]
}`;
  }
}

module.exports = {
  HierarchicalRelationExtractor
};
