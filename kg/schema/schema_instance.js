/**
 * Schema Instance Manager
 * 
 * 管理Schema实例的生命周期。Schema实例是Schema匹配后生成的中间层数据结构，
 * 不直接存储为实体，而是用于锚点指纹生成和实体合并。
 * 
 * 核心原则：
 * - Schema实例是中间层，不直接变成实体
 * - 包含schema信息、字段、置信度、支撑CKB
 * - 传递给锚点生成器进行合并判断
 */

/**
 * Schema Instance类
 * 表示一个Schema匹配后的结构化实例
 */
class SchemaInstance {
  /**
   * @param {Object} schema - Schema定义对象
   * @param {Object} fields - 提取的字段键值对
   * @param {Array<string>} ckbIds - 支撑此实例的CKB ID列表
   * @param {number} confidence - 置信度 (0-1)
   */
  constructor(schema, fields, ckbIds, confidence) {
    // Schema信息
    this.schema_name = schema.schema_name;
    this.schema_id = schema.schema_id;
    this.entity_type = schema.entity_type;
    
    // 字段数据
    this.fields = fields || {};
    
    // 支撑信息
    this.ckb_ids = Array.isArray(ckbIds) ? ckbIds : [ckbIds];
    
    // 置信度
    this.confidence = confidence;
    
    // 时间戳
    this.created_at = new Date().toISOString();
  }

  /**
   * 获取字段值
   * @param {string} fieldName - 字段名
   * @returns {*} 字段值
   */
  getField(fieldName) {
    return this.fields[fieldName];
  }

  /**
   * 设置字段值
   * @param {string} fieldName - 字段名
   * @param {*} value - 字段值
   */
  setField(fieldName, value) {
    this.fields[fieldName] = value;
  }

  /**
   * 检查是否包含指定字段
   * @param {string} fieldName - 字段名
   * @returns {boolean}
   */
  hasField(fieldName) {
    return fieldName in this.fields && this.fields[fieldName] !== undefined && this.fields[fieldName] !== null;
  }

  /**
   * 获取所有字段名
   * @returns {Array<string>}
   */
  getFieldNames() {
    return Object.keys(this.fields);
  }

  /**
   * 转换为JSON对象
   * @returns {Object}
   */
  toJSON() {
    return {
      schema_name: this.schema_name,
      schema_id: this.schema_id,
      entity_type: this.entity_type,
      fields: this.fields,
      ckb_ids: this.ckb_ids,
      confidence: this.confidence,
      created_at: this.created_at
    };
  }
}

/**
 * 从Schema匹配结果创建Schema实例
 * 
 * @param {Object} schemaScore - Schema匹配结果对象
 * @param {Object} schemaScore.schema - Schema定义
 * @param {number} schemaScore.score - 匹配分数
 * @param {Object|Array} normalizedFields - 标准化后的字段（对象或数组）
 * @param {Object} ckb - CKB对象
 * @returns {SchemaInstance}
 */
function createSchemaInstance(schemaScore, normalizedFields, ckb) {
  if (!schemaScore || !schemaScore.schema) {
    throw new Error('[SchemaInstance] schemaScore and schema are required');
  }

  const schema = schemaScore.schema;
  const confidence = schemaScore.score || 0;

  // 将normalizedFields转换为对象格式（如果是数组）
  let fieldsObj = {};
  if (Array.isArray(normalizedFields)) {
    // 数组格式：[{ name: 'Aperture', value: '1.8', ... }, ...]
    // 转换为对象格式：{ Aperture: ['1.8', '2.0'], ... }
    for (const field of normalizedFields) {
      const fieldName = field.name || field.standardName;
      if (!fieldName) continue;
      
      // 如果字段已存在，转换为数组
      if (fieldsObj[fieldName]) {
        if (!Array.isArray(fieldsObj[fieldName])) {
          fieldsObj[fieldName] = [fieldsObj[fieldName]];
        }
        fieldsObj[fieldName].push(field.value);
      } else {
        fieldsObj[fieldName] = field.value;
      }
    }
  } else {
    // 对象格式：直接使用
    fieldsObj = normalizedFields || {};
  }

  // 提取schema相关的字段
  const schemaFields = {};
  const coreFieldNames = schema.core_fields ? schema.core_fields.map(f => f.name) : [];

  // 优先使用core_fields定义的字段
  for (const fieldName of coreFieldNames) {
    if (fieldsObj[fieldName] !== undefined) {
      schemaFields[fieldName] = fieldsObj[fieldName];
    }
  }

  // 如果没有core_fields定义，使用所有fieldsObj
  if (Object.keys(schemaFields).length === 0) {
    Object.assign(schemaFields, fieldsObj);
  }

  // 获取CKB ID
  const ckbIds = ckb ? [ckb.ckb_id || ckb.id] : [];

  return new SchemaInstance(schema, schemaFields, ckbIds, confidence);
}

/**
 * 验证Schema实例的完整性
 * 
 * @param {SchemaInstance} instance - Schema实例
 * @returns {Object} 验证结果 { valid: boolean, errors: Array<string> }
 */
function validateSchemaInstance(instance) {
  const errors = [];

  // 检查必需字段
  if (!instance.schema_name) {
    errors.push('schema_name is required');
  }

  if (!instance.schema_id) {
    errors.push('schema_id is required');
  }

  if (!instance.entity_type) {
    errors.push('entity_type is required');
  }

  if (!instance.fields || typeof instance.fields !== 'object') {
    errors.push('fields must be an object');
  }

  if (!Array.isArray(instance.ckb_ids)) {
    errors.push('ckb_ids must be an array');
  }

  if (typeof instance.confidence !== 'number' || instance.confidence < 0 || instance.confidence > 1) {
    errors.push('confidence must be a number between 0 and 1');
  }

  // 检查字段是否为空
  if (instance.fields && Object.keys(instance.fields).length === 0) {
    errors.push('fields cannot be empty');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 批量创建Schema实例
 * 
 * @param {Array<Object>} schemaScores - Schema匹配结果列表
 * @param {Object} normalizedFields - 标准化后的字段
 * @param {Object} ckb - CKB对象
 * @returns {Array<SchemaInstance>}
 */
function createSchemaInstances(schemaScores, normalizedFields, ckb) {
  if (!Array.isArray(schemaScores)) {
    throw new Error('[SchemaInstance] schemaScores must be an array');
  }

  const instances = [];

  for (const schemaScore of schemaScores) {
    try {
      const instance = createSchemaInstance(schemaScore, normalizedFields, ckb);
      const validation = validateSchemaInstance(instance);

      if (validation.valid) {
        instances.push(instance);
      } else {
        console.warn(`[SchemaInstance] Invalid instance for schema ${schemaScore.schema.schema_name}:`, validation.errors);
      }
    } catch (error) {
      console.error(`[SchemaInstance] Error creating instance for schema ${schemaScore.schema?.schema_name}:`, error.message);
    }
  }

  return instances;
}

module.exports = {
  SchemaInstance,
  createSchemaInstance,
  validateSchemaInstance,
  createSchemaInstances
};
