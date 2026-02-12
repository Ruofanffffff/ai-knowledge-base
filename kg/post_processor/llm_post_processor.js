/**
 * LLMPostProcessor — 管线末端 LLM 后处理清洗模块
 *
 * 将原始实体和关系提交给 LLM 进行归纳、去重、总结，
 * 输出精炼的清洗实体和关系，支持增量归纳。
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 15.1, 15.2, 15.3, 15.4, 15.5
 */

// Field length limits (Requirements 13.3, 13.4, 13.5, 14.4, 14.5)
const ENTITY_NAME_MAX_LENGTH = 6;
const ENTITY_DESC_MAX_LENGTH = 20;
const RELATION_NAME_MAX_LENGTH = 4;

class LLMPostProcessor {
  /**
   * 执行后处理清洗
   * @param {Object} params
   * @param {Array} params.entities - 管线生成的原始 KGEntity 列表
   * @param {Array} params.relations - 管线生成的原始 KGRelation 列表
   * @param {string|null} params.documentIndexText - DocumentIndex 索引文本
   * @param {Array} params.existingCleanedEntities - 已有的 CleanedEntity 列表
   * @param {Array} params.existingCleanedRelations - 已有的 CleanedRelation 列表
   * @param {Object} params.llmClient - LLM 客户端
   * @returns {Promise<CleanupResult>}
   */
  async cleanup(params) {
    const {
      entities = [],
      relations = [],
      documentIndexText = null,
      existingCleanedEntities = [],
      existingCleanedRelations = [],
      llmClient
    } = params;

    const emptyResult = {
      entities: { created: [], updated: [] },
      relations: { created: [], updated: [] },
      stats: {
        entitiesCreated: 0,
        entitiesUpdated: 0,
        relationsCreated: 0,
        relationsUpdated: 0
      }
    };

    if (!llmClient) {
      console.error('[LLMPostProcessor] No LLM client provided, skipping cleanup');
      return emptyResult;
    }

    if (entities.length === 0 && relations.length === 0) {
      console.log('[LLMPostProcessor] No entities or relations to clean');
      return emptyResult;
    }

    try {
      // Step 1: Build cleanup prompt (Req 14.1, 14.2, 14.3, 15.1)
      const prompt = this._buildCleanupPrompt(
        entities,
        relations,
        documentIndexText,
        { entities: existingCleanedEntities, relations: existingCleanedRelations }
      );

      // Step 2: Call LLM (Req 14.6 — catch errors)
      let llmResponse;
      try {
        const response = await llmClient.call(prompt, {
          temperature: 0.1
        });
        llmResponse = response.content || response || '';
      } catch (error) {
        console.error('[LLMPostProcessor] LLM call failed:', error.message);
        return emptyResult;
      }

      // Step 3: Parse and validate result (Req 14.4, 14.5)
      const parsedResult = this._parseAndValidateResult(llmResponse);
      if (!parsedResult) {
        return emptyResult;
      }

      // Step 4: Incremental merge (Req 15.2, 15.3, 15.4, 15.5)
      const mergeResult = this._performIncrementalMerge(
        parsedResult,
        existingCleanedEntities,
        existingCleanedRelations
      );

      return mergeResult;
    } catch (error) {
      console.error('[LLMPostProcessor] Cleanup failed:', error.message);
      return emptyResult;
    }
  }

  /**
   * 构建清洗 prompt
   * @param {Array} entities - 原始实体列表
   * @param {Array} relations - 原始关系列表
   * @param {string|null} indexText - DocumentIndex 文本
   * @param {Object} existingCleaned - { entities: [], relations: [] }
   * @returns {string} prompt 文本
   */
  _buildCleanupPrompt(entities, relations, indexText, existingCleaned) {
    const parts = [];

    parts.push('你是一个知识图谱清洗专家。请对以下原始实体和关系进行归纳清洗。');
    parts.push('');

    // Cleanup rules (Req 14.2, 14.3)
    parts.push('## 清洗规则');
    parts.push('1. 语义相同或相近的实体合并为一个词');
    parts.push('2. 语义缺失的对照文档索引补充');
    parts.push('3. 过长的名称对照文档索引压缩');
    parts.push('4. 文档索引提到但未构建出的实体补充');
    parts.push('');

    // Output format requirements (Req 14.4, 14.5)
    parts.push('## 输出格式要求');
    parts.push('- 实体名称：不超过6个字');
    parts.push('- 实体描述：不超过20个字');
    parts.push('- 关系名称：不超过4个字');
    parts.push('');

    // Existing cleaned data (Req 15.1)
    if (existingCleaned && (existingCleaned.entities.length > 0 || existingCleaned.relations.length > 0)) {
      parts.push('## 已有图谱字段表');
      if (existingCleaned.entities.length > 0) {
        parts.push('### 已有实体');
        for (const e of existingCleaned.entities) {
          parts.push(`- [id=${e.id}] ${e.cleanedName}: ${e.description || ''}`);
        }
      }
      if (existingCleaned.relations.length > 0) {
        parts.push('### 已有关系');
        for (const r of existingCleaned.relations) {
          const sourceName = r.source?.cleanedName || r.sourceEntityId;
          const targetName = r.target?.cleanedName || r.targetEntityId;
          parts.push(`- [id=${r.id}] ${sourceName} -[${r.cleanedName}]-> ${targetName}: ${r.description || ''}`);
        }
      }
      parts.push('');
    }

    // Document index
    if (indexText) {
      parts.push('## 文档索引');
      // Truncate very long index text to avoid exceeding LLM context
      const maxIndexLength = 3000;
      if (indexText.length > maxIndexLength) {
        parts.push(indexText.substring(0, maxIndexLength) + '...(已截断)');
      } else {
        parts.push(indexText);
      }
      parts.push('');
    }

    // Raw entities
    parts.push('## 原始实体');
    if (entities.length === 0) {
      parts.push('（无）');
    } else {
      for (const entity of entities) {
        const id = entity.entity_id || entity.id || '';
        const name = entity.canonical_name || entity.name || '';
        parts.push(`- [id=${id}] ${name}`);
      }
    }
    parts.push('');

    // Raw relations
    parts.push('## 原始关系');
    if (relations.length === 0) {
      parts.push('（无）');
    } else {
      for (const rel of relations) {
        const id = rel.relation_id || rel.id || '';
        const type = rel.relation_type || rel.type || '';
        const source = rel.source_entity_id || rel.source || '';
        const target = rel.target_entity_id || rel.target || '';
        parts.push(`- [id=${id}] ${source} -[${type}]-> ${target}`);
      }
    }
    parts.push('');

    // Output format instruction
    parts.push('请以 JSON 格式返回清洗结果：');
    parts.push('{');
    parts.push('  "entities": [');
    parts.push('    { "name": "...", "description": "...", "source_ids": [...], "existing_id": null|"..." }');
    parts.push('  ],');
    parts.push('  "relations": [');
    parts.push('    { "name": "...", "description": "...", "source": "实体名", "target": "实体名", "source_ids": [...], "existing_id": null|"..." }');
    parts.push('  ]');
    parts.push('}');

    return parts.join('\n');
  }

  /**
   * 解析 LLM 清洗结果并验证长度限制
   * @param {string} llmResponse - LLM 返回的文本
   * @returns {Object|null} 解析后的结果 { entities: [], relations: [] }，失败返回 null
   */
  _parseAndValidateResult(llmResponse) {
    if (!llmResponse || typeof llmResponse !== 'string') {
      console.error('[LLMPostProcessor] Empty or invalid LLM response');
      return null;
    }

    let jsonStr = llmResponse.trim();

    // Try to extract JSON from markdown code blocks
    const jsonBlockMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (jsonBlockMatch) {
      jsonStr = jsonBlockMatch[1].trim();
    }

    // Try to extract JSON object if response has extra text
    if (!jsonStr.startsWith('{')) {
      const jsonStart = jsonStr.indexOf('{');
      const jsonEnd = jsonStr.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        jsonStr = jsonStr.substring(jsonStart, jsonEnd + 1);
      }
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (error) {
      console.error('[LLMPostProcessor] JSON parse failed:', error.message);
      return null;
    }

    // Validate structure
    if (!parsed || typeof parsed !== 'object') {
      console.error('[LLMPostProcessor] Parsed result is not an object');
      return null;
    }

    const entities = Array.isArray(parsed.entities) ? parsed.entities : [];
    const relations = Array.isArray(parsed.relations) ? parsed.relations : [];

    // Validate and truncate entity fields (Req 14.4, 14.5)
    const validatedEntities = entities.map(e => ({
      name: truncate(String(e.name || ''), ENTITY_NAME_MAX_LENGTH),
      description: truncate(String(e.description || ''), ENTITY_DESC_MAX_LENGTH),
      source_ids: Array.isArray(e.source_ids) ? e.source_ids : [],
      existing_id: e.existing_id || null
    }));

    // Validate and truncate relation fields
    const validatedRelations = relations.map(r => ({
      name: truncate(String(r.name || ''), RELATION_NAME_MAX_LENGTH),
      description: String(r.description || ''),
      source: String(r.source || ''),
      target: String(r.target || ''),
      source_ids: Array.isArray(r.source_ids) ? r.source_ids : [],
      existing_id: r.existing_id || null
    }));

    return {
      entities: validatedEntities,
      relations: validatedRelations
    };
  }

  /**
   * 执行增量归纳：根据 existing_id 决定创建或更新
   * @param {Object} cleanedResult - { entities: [], relations: [] }
   * @param {Array} existingEntities - 已有的 CleanedEntity 列表
   * @param {Array} existingRelations - 已有的 CleanedRelation 列表
   * @returns {CleanupResult}
   */
  _performIncrementalMerge(cleanedResult, existingEntities, existingRelations) {
    const existingEntityMap = new Map();
    for (const e of existingEntities) {
      existingEntityMap.set(e.id, e);
    }

    const existingRelationMap = new Map();
    for (const r of existingRelations) {
      existingRelationMap.set(r.id, r);
    }

    const result = {
      entities: { created: [], updated: [] },
      relations: { created: [], updated: [] },
      stats: {
        entitiesCreated: 0,
        entitiesUpdated: 0,
        relationsCreated: 0,
        relationsUpdated: 0
      }
    };

    // Process entities (Req 15.2, 15.3)
    for (const entity of cleanedResult.entities) {
      if (entity.existing_id && existingEntityMap.has(entity.existing_id)) {
        // Update existing entity
        result.entities.updated.push({
          id: entity.existing_id,
          description: entity.description,
          sourceEntityIds: entity.source_ids
        });
        result.stats.entitiesUpdated++;
      } else {
        // Create new entity
        result.entities.created.push({
          cleanedName: entity.name,
          description: entity.description,
          sourceEntityIds: entity.source_ids
        });
        result.stats.entitiesCreated++;
      }
    }

    // Process relations (Req 15.4, 15.5)
    for (const relation of cleanedResult.relations) {
      if (relation.existing_id && existingRelationMap.has(relation.existing_id)) {
        // Update existing relation
        result.relations.updated.push({
          id: relation.existing_id,
          description: relation.description,
          sourceRelationIds: relation.source_ids
        });
        result.stats.relationsUpdated++;
      } else {
        // Create new relation
        result.relations.created.push({
          cleanedName: relation.name,
          description: relation.description,
          sourceEntityId: relation.source,
          targetEntityId: relation.target,
          sourceRelationIds: relation.source_ids
        });
        result.stats.relationsCreated++;
      }
    }

    console.log(`[LLMPostProcessor] Merge result: entities(created=${result.stats.entitiesCreated}, updated=${result.stats.entitiesUpdated}), relations(created=${result.stats.relationsCreated}, updated=${result.stats.relationsUpdated})`);

    return result;
  }
}

/**
 * Truncate a string to maxLength characters
 * @param {string} str
 * @param {number} maxLength
 * @returns {string}
 */
function truncate(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength);
}

module.exports = LLMPostProcessor;
