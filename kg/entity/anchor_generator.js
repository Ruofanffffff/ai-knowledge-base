/**
 * Anchor Generator
 * 
 * 生成标准化的锚点指纹，用于判断"是不是同一个东西"。
 * 
 * 核心原则：
 * - 确定性：相同输入必须产生相同锚点指纹
 * - 唯一性：不同语义实体必须产生不同锚点指纹
 * - 规则驱动：完全基于规则，不使用LLM
 */

const crypto = require('crypto');
const { normalizeFieldValue } = require('./field_normalizers');
const anchorMetrics = require('./anchor_metrics');

/**
 * 生成锚点指纹
 * 
 * @param {Object} instance - Schema实例
 * @param {Object} schema - Schema定义（包含anchor_fields配置）
 * @returns {string} 锚点指纹，格式：entity_type|value1|value2|...
 */
function generateAnchorFingerprint(instance, schema) {
  const startTime = Date.now();
  let success = false;
  
  try {
    if (!instance) {
      throw new Error('[AnchorGenerator] instance is required');
    }

    if (!schema) {
      throw new Error('[AnchorGenerator] schema is required');
    }

    const entityType = schema.entity_type || instance.entity_type;

    if (!entityType) {
      throw new Error('[AnchorGenerator] entity_type is required');
    }

    // 获取锚点字段配置
    const anchorFields = schema.anchor_fields || inferAnchorFields(schema);

    if (!anchorFields || anchorFields.length === 0) {
      throw new Error(`[AnchorGenerator] No anchor fields defined for schema ${schema.schema_name}`);
    }

    // 生成锚点值列表
    const anchorValues = anchorFields.map(fieldConfig => {
      const fieldName = typeof fieldConfig === 'string' ? fieldConfig : fieldConfig.name;
      const fieldValue = instance.fields[fieldName];
      const strategy = fieldConfig.normalization_strategy || 'default';

      // 标准化字段值
      const normalized = normalizeFieldValue(fieldValue, fieldName, strategy);

      return normalized;
    });

    // 过滤空值
    const nonEmptyValues = anchorValues.filter(v => v !== '');

    if (nonEmptyValues.length === 0) {
      console.warn(`[AnchorGenerator] All anchor field values are empty for schema ${schema.schema_name}, trying fallback strategy`);
      
      // 降级策略1: 使用所有非空字段值
      const allFieldValues = Object.values(instance.fields)
        .filter(v => v && String(v).trim() !== '')
        .map(v => {
          // 确保值是字符串
          const strValue = typeof v === 'object' ? JSON.stringify(v) : String(v);
          return normalizeFieldValue(strValue, 'unknown', 'lowercase');
        });
      
      if (allFieldValues.length > 0) {
        const fingerprint = `${entityType}|fallback|${allFieldValues.slice(0, 3).join('|')}`;
        console.log(`[AnchorGenerator] Using fallback fingerprint with ${allFieldValues.length} fields: ${fingerprint}`);
        success = true;
        return fingerprint;
      }
      
      // 降级策略2: 使用schema_name + CKB ID（如果可用）
      const ckbId = instance.ckb_ids && instance.ckb_ids[0] ? instance.ckb_ids[0] : 'unknown';
      const fingerprint = `${entityType}|fallback|${schema.schema_name}|${ckbId}`;
      console.warn(`[AnchorGenerator] Using CKB-based fallback fingerprint: ${fingerprint}`);
      success = true;
      return fingerprint;
    }

    // 生成指纹: entity_type|value1|value2|...
    const fingerprint = `${entityType}|${nonEmptyValues.join('|')}`;

    success = true;
    return fingerprint;
  } catch (error) {
    success = false;
    throw error;
  } finally {
    // 记录监控指标
    const duration = Date.now() - startTime;
    anchorMetrics.recordAnchorGeneration(duration, success);
  }
}

/**
 * 自动推断锚点字段
 * 如果schema没有定义anchor_fields，根据core_fields推断
 * 
 * @param {Object} schema - Schema定义
 * @returns {Array} 锚点字段配置列表
 */
function inferAnchorFields(schema) {
  if (!schema.core_fields || schema.core_fields.length === 0) {
    return [];
  }

  // 优先选择required字段
  const requiredFields = schema.core_fields.filter(f => f.required);

  if (requiredFields.length > 0) {
    return requiredFields.map(f => ({
      name: f.name,
      normalization_strategy: inferNormalizationStrategy(f.name)
    }));
  }

  // 如果没有required字段，选择权重最高的前3个字段
  const sortedFields = [...schema.core_fields].sort((a, b) => (b.weight || 0) - (a.weight || 0));
  const topFields = sortedFields.slice(0, 3);

  return topFields.map(f => ({
    name: f.name,
    normalization_strategy: inferNormalizationStrategy(f.name)
  }));
}

/**
 * 根据字段名推断标准化策略
 * 
 * @param {string} fieldName - 字段名
 * @returns {string} 标准化策略名称
 */
function inferNormalizationStrategy(fieldName) {
  const lowerName = fieldName.toLowerCase();

  // 时间相关
  if (lowerName.includes('时间') || lowerName.includes('time') || lowerName.includes('date') || lowerName.includes('timestamp')) {
    return 'time_month'; // 默认月份粒度
  }

  // 地点相关
  if (lowerName.includes('区域') || lowerName.includes('地点') || lowerName.includes('location') || lowerName.includes('place') || lowerName.includes('area')) {
    return 'location';
  }

  // 指标相关
  if (lowerName.includes('指标') || lowerName.includes('indicator') || lowerName.includes('metric')) {
    return 'indicator';
  }

  // 默认小写
  return 'lowercase';
}

/**
 * 从锚点指纹生成确定性的实体ID
 * 
 * @param {string} anchorFingerprint - 锚点指纹
 * @returns {string} 实体ID
 */
function generateEntityId(anchorFingerprint) {
  if (!anchorFingerprint) {
    throw new Error('[AnchorGenerator] anchorFingerprint is required');
  }

  // 使用SHA-256生成hash
  const hash = crypto
    .createHash('sha256')
    .update(anchorFingerprint)
    .digest('hex')
    .substring(0, 16);

  return `entity_${hash}`;
}

/**
 * 锚点指纹缓存
 * 用于提高性能，避免重复计算
 */
class AnchorFingerprintCache {
  constructor() {
    this.cache = new Map();
  }

  /**
   * 生成缓存键
   * @param {string} schemaId - Schema ID
   * @param {Object} fields - 字段对象
   * @returns {string} 缓存键
   */
  getCacheKey(schemaId, fields) {
    const fieldsStr = JSON.stringify(fields);
    const hash = crypto.createHash('md5').update(fieldsStr).digest('hex');
    return `${schemaId}_${hash}`;
  }

  /**
   * 获取缓存的锚点指纹
   * @param {string} schemaId - Schema ID
   * @param {Object} fields - 字段对象
   * @returns {string|null} 锚点指纹或null
   */
  get(schemaId, fields) {
    const key = this.getCacheKey(schemaId, fields);
    return this.cache.get(key) || null;
  }

  /**
   * 设置缓存
   * @param {string} schemaId - Schema ID
   * @param {Object} fields - 字段对象
   * @param {string} anchor - 锚点指纹
   */
  set(schemaId, fields, anchor) {
    const key = this.getCacheKey(schemaId, fields);
    this.cache.set(key, anchor);
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   * @returns {number}
   */
  size() {
    return this.cache.size;
  }
}

// 全局缓存实例
const globalCache = new AnchorFingerprintCache();

/**
 * 生成锚点指纹（带缓存）
 * 
 * @param {Object} instance - Schema实例
 * @param {Object} schema - Schema定义
 * @param {boolean} useCache - 是否使用缓存
 * @returns {string} 锚点指纹
 */
function generateAnchorFingerprintCached(instance, schema, useCache = true) {
  if (!useCache) {
    return generateAnchorFingerprint(instance, schema);
  }

  // 检查缓存
  const cached = globalCache.get(schema.schema_id, instance.fields);
  if (cached) {
    return cached;
  }

  // 生成并缓存
  const fingerprint = generateAnchorFingerprint(instance, schema);
  globalCache.set(schema.schema_id, instance.fields, fingerprint);

  return fingerprint;
}

/**
 * 批量生成锚点指纹
 * 
 * @param {Array<Object>} instances - Schema实例列表
 * @param {Map<string, Object>} schemaMap - Schema定义映射 (schema_id -> schema)
 * @returns {Array<Object>} 包含instance, schema, anchor的对象列表
 */
function generateAnchorFingerprintsBatch(instances, schemaMap) {
  if (!Array.isArray(instances)) {
    throw new Error('[AnchorGenerator] instances must be an array');
  }

  if (!schemaMap || !(schemaMap instanceof Map)) {
    throw new Error('[AnchorGenerator] schemaMap must be a Map');
  }

  const results = [];

  for (const instance of instances) {
    try {
      const schema = schemaMap.get(instance.schema_id);

      if (!schema) {
        console.warn(`[AnchorGenerator] Schema not found for instance: ${instance.schema_id}`);
        continue;
      }

      const anchor = generateAnchorFingerprintCached(instance, schema);

      results.push({
        instance,
        schema,
        anchor
      });
    } catch (error) {
      console.error(`[AnchorGenerator] Error generating anchor for instance ${instance.schema_name}:`, error.message);
    }
  }

  return results;
}

module.exports = {
  generateAnchorFingerprint,
  generateAnchorFingerprintCached,
  generateAnchorFingerprintsBatch,
  generateEntityId,
  inferAnchorFields,
  inferNormalizationStrategy,
  AnchorFingerprintCache,
  globalCache,
  // Export metrics for monitoring
  getMetrics: () => anchorMetrics.getMetrics(),
  getMetricsSummary: () => anchorMetrics.getSummary(),
  resetMetrics: () => anchorMetrics.reset()
};

