/**
 * Anchor Merger
 * 
 * 基于锚点指纹合并Schema实例为实体。
 * 
 * 核心原则：
 * - 锚点相同 → 合并为同一实体
 * - 锚点不同 → 不同实体
 * - 优先高置信度字段值
 * - 多schema支撑 → 更高置信度
 */

const crypto = require('crypto');
const { generateAnchorFingerprint } = require('./anchor_generator');
const anchorMetrics = require('./anchor_metrics');

/**
 * 按锚点合并Schema实例
 * 
 * @param {Array<Object>} instances - Schema实例列表
 * @param {Map<string, Object>} schemaMap - Schema定义映射 (schema_id -> schema)
 * @returns {Array<Object>} 实体列表
 */
function mergeInstancesByAnchor(instances, schemaMap) {
  const startTime = Date.now();
  let success = false;
  let entitiesCreated = 0;
  const instancesProcessed = instances.length;
  
  try {
    if (!Array.isArray(instances)) {
      throw new Error('[AnchorMerger] instances must be an array');
    }

    if (!schemaMap || !(schemaMap instanceof Map)) {
      throw new Error('[AnchorMerger] schemaMap must be a Map');
    }

    // Step 1: 生成锚点指纹并分组
    const anchorGroups = new Map(); // anchor → instances[]

    for (const instance of instances) {
      try {
        const schema = schemaMap.get(instance.schema_id);

        if (!schema) {
          console.warn(`[AnchorMerger] Schema not found for instance: ${instance.schema_id}`);
          continue;
        }

        const anchor = generateAnchorFingerprint(instance, schema);

        if (!anchorGroups.has(anchor)) {
          anchorGroups.set(anchor, []);
        }

        anchorGroups.get(anchor).push({
          instance,
          schema,
          anchor
        });
      } catch (error) {
        console.error(`[AnchorMerger] Error processing instance ${instance.schema_name}:`, error.message);
      }
    }

    // Step 2: 为每个锚点组生成实体
    const entities = [];

    for (const [anchor, group] of anchorGroups.entries()) {
      try {
        const entity = mergeGroupToEntity(anchor, group);
        entities.push(entity);
      } catch (error) {
        console.error(`[AnchorMerger] Error merging group for anchor ${anchor}:`, error.message);
      }
    }

    entitiesCreated = entities.length;
    success = true;
    return entities;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    // 记录监控指标
    const duration = Date.now() - startTime;
    anchorMetrics.recordMerging(duration, entitiesCreated, instancesProcessed, success);
  }
}

/**
 * 将同一锚点的实例组合并为实体
 * 
 * @param {string} anchor - 锚点指纹
 * @param {Array<Object>} group - 实例组 [{instance, schema, anchor}, ...]
 * @returns {Object} 实体对象
 */
function mergeGroupToEntity(anchor, group) {
  if (!group || group.length === 0) {
    throw new Error('[AnchorMerger] group cannot be empty');
  }

  // 提取所有schema信息
  const schemas = group.map(item => ({
    schema_name: item.instance.schema_name,
    schema_id: item.instance.schema_id,
    confidence: item.instance.confidence
  }));

  // 合并字段（优先高置信度）
  const mergedFields = mergeFields(group);

  // 收集所有支撑CKB
  const supportedBy = [...new Set(
    group.flatMap(item => item.instance.ckb_ids)
  )];

  // 计算综合置信度
  const confidence = calculateMergedConfidence(group);

  // 生成规范名称
  const canonicalName = generateCanonicalName(mergedFields, group[0].schema);

  // 提取锚点字段
  const anchorFields = extractAnchorFields(anchor, group[0].schema, mergedFields);

  // 生成实体ID
  const entityId = generateEntityId(anchor);

  return {
    entity_id: entityId,
    entity_type: group[0].instance.entity_type,
    name: canonicalName,  // 🔧 添加name字段（向后兼容）
    canonical_name: canonicalName,
    anchor_fingerprint: anchor,
    anchor_fields: anchorFields,
    schemas: schemas,
    fields: mergedFields,
    supported_by: supportedBy,
    confidence: confidence,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/**
 * 合并字段策略
 * 优先采用高置信度schema的字段值
 * 
 * @param {Array<Object>} group - 实例组
 * @returns {Object} 合并后的字段
 */
function mergeFields(group) {
  const mergedFields = {};
  const fieldSources = {}; // 记录字段来源

  // 按置信度排序（高到低）
  const sortedGroup = [...group].sort((a, b) =>
    b.instance.confidence - a.instance.confidence
  );

  for (const item of sortedGroup) {
    for (const [fieldName, fieldValue] of Object.entries(item.instance.fields)) {
      if (!mergedFields[fieldName]) {
        // 首次出现，直接采用
        mergedFields[fieldName] = fieldValue;
        fieldSources[fieldName] = {
          schema: item.instance.schema_name,
          confidence: item.instance.confidence
        };
      } else if (mergedFields[fieldName] !== fieldValue) {
        // 字段冲突，记录警告但保持高置信度的值
        console.warn(`[AnchorMerger] Field conflict: ${fieldName}`, {
          anchor: item.anchor,
          existing: mergedFields[fieldName],
          new: fieldValue,
          existing_source: fieldSources[fieldName],
          new_source: {
            schema: item.instance.schema_name,
            confidence: item.instance.confidence
          }
        });
        // 保持高置信度的值（已排序，所以不覆盖）
      }
    }
  }

  return mergedFields;
}

/**
 * 计算合并后的置信度
 * 策略：多个schema支撑 → 更高置信度
 * 
 * @param {Array<Object>} group - 实例组
 * @returns {number} 置信度 (0-1)
 */
function calculateMergedConfidence(group) {
  const schemaCount = group.length;
  const avgConfidence = group.reduce((sum, item) =>
    sum + item.instance.confidence, 0) / schemaCount;

  // 基础置信度 + schema数量加成
  let confidence = avgConfidence;

  if (schemaCount >= 2) confidence += 0.05;
  if (schemaCount >= 3) confidence += 0.05;
  if (schemaCount >= 4) confidence += 0.05;

  // 确保不超过0.99
  return Math.min(confidence, 0.99);
}

/**
 * 生成规范名称
 * 
 * @param {Object} fields - 合并后的字段
 * @param {Object} schema - Schema定义
 * @returns {string} 规范名称
 */
function generateCanonicalName(fields, schema) {
  // 辅助函数：获取字段值（处理数组情况）
  const getFieldValue = (fieldValue) => {
    if (Array.isArray(fieldValue)) {
      return fieldValue[0]; // 取第一个值
    }
    return fieldValue;
  };

  // 尝试从字段中提取名称
  const nameFields = ['name', 'Name', '名称', 'title', 'Title', '标题'];

  for (const fieldName of nameFields) {
    if (fields[fieldName]) {
      return String(getFieldValue(fields[fieldName]));
    }
  }

  // 如果没有名称字段，使用schema名称 + 关键字段
  const keyFields = schema.anchor_fields || [];
  const keyValues = keyFields
    .map(f => {
      const fieldName = typeof f === 'string' ? f : f.name;
      const fieldValue = fields[fieldName];
      return fieldValue ? getFieldValue(fieldValue) : null;
    })
    .filter(Boolean)
    .slice(0, 2);

  if (keyValues.length > 0) {
    return `${schema.schema_name}_${keyValues.join('_')}`;
  }

  return schema.schema_name;
}

/**
 * 提取锚点字段
 * 
 * @param {string} anchor - 锚点指纹
 * @param {Object} schema - Schema定义
 * @param {Object} fields - 合并后的字段
 * @returns {Object} 锚点字段键值对
 */
function extractAnchorFields(anchor, schema, fields) {
  const anchorFields = {};
  const anchorFieldConfigs = schema.anchor_fields || [];

  for (const fieldConfig of anchorFieldConfigs) {
    const fieldName = typeof fieldConfig === 'string' ? fieldConfig : fieldConfig.name;

    if (fields[fieldName] !== undefined) {
      anchorFields[fieldName] = fields[fieldName];
    }
  }

  return anchorFields;
}

/**
 * 从锚点指纹生成确定性的实体ID
 * 
 * @param {string} anchorFingerprint - 锚点指纹
 * @returns {string} 实体ID
 */
function generateEntityId(anchorFingerprint) {
  const hash = crypto
    .createHash('sha256')
    .update(anchorFingerprint)
    .digest('hex')
    .substring(0, 16);

  return `entity_${hash}`;
}

/**
 * 批量合并实例（带性能优化）
 * 
 * @param {Array<Object>} instances - Schema实例列表
 * @param {Map<string, Object>} schemaMap - Schema定义映射
 * @param {Object} options - 选项
 * @param {number} options.concurrency - 并发数（暂未实现）
 * @returns {Array<Object>} 实体列表
 */
function mergeInstancesByAnchorBatch(instances, schemaMap, options = {}) {
  // 目前直接调用标准合并函数
  // 未来可以实现并行处理优化
  return mergeInstancesByAnchor(instances, schemaMap);
}

/**
 * 获取合并统计信息
 * 
 * @param {Array<Object>} entities - 实体列表
 * @returns {Object} 统计信息
 */
function getMergeStatistics(entities) {
  const stats = {
    total_entities: entities.length,
    single_schema_entities: 0,
    multi_schema_entities: 0,
    max_schemas_per_entity: 0,
    avg_schemas_per_entity: 0,
    avg_confidence: 0
  };

  let totalSchemas = 0;
  let totalConfidence = 0;

  for (const entity of entities) {
    const schemaCount = entity.schemas.length;
    totalSchemas += schemaCount;
    totalConfidence += entity.confidence;

    if (schemaCount === 1) {
      stats.single_schema_entities++;
    } else {
      stats.multi_schema_entities++;
    }

    if (schemaCount > stats.max_schemas_per_entity) {
      stats.max_schemas_per_entity = schemaCount;
    }
  }

  if (entities.length > 0) {
    stats.avg_schemas_per_entity = totalSchemas / entities.length;
    stats.avg_confidence = totalConfidence / entities.length;
  }

  return stats;
}

module.exports = {
  mergeInstancesByAnchor,
  mergeGroupToEntity,
  mergeFields,
  calculateMergedConfidence,
  generateCanonicalName,
  extractAnchorFields,
  generateEntityId,
  mergeInstancesByAnchorBatch,
  getMergeStatistics
};
