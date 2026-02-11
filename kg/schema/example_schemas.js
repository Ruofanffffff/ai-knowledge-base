/**
 * Example Schema Definitions
 * 
 * This file contains example schemas that demonstrate how to define
 * different types of entities for the knowledge graph system.
 */

/**
 * Example 1: 地下水位变化事件 (Groundwater Level Change Event)
 * 
 * This schema captures events related to groundwater level changes,
 * including location, time, indicator, value, and unit.
 */
const groundwaterLevelChangeEvent = {
  schema_name: '地下水位变化事件',
  entity_type: 'EventEntity',
  core_fields: [
    { name: '区域', weight: 0.3, required: true },
    { name: '时间', weight: 0.2, required: true },
    { name: '指标', weight: 0.2, required: true },
    { name: '数值', weight: 0.2, required: false },
    { name: '单位', weight: 0.1, required: false }
  ],
  threshold: 0.75,
  relations: [
    { type: '发生于', target_field: '区域', direction: 'outgoing' },
    { type: '发生时间', target_field: '时间', direction: 'outgoing' },
    { type: '影响指标', target_field: '指标', direction: 'outgoing' }
  ],
  // 🆕 锚点字段配置 - 用于实体合并
  anchor_fields: [
    { name: '区域', normalization_strategy: 'location', priority: 1 },
    { name: '指标', normalization_strategy: 'indicator', priority: 2 },
    { name: '时间', normalization_strategy: 'time_month', priority: 3 }
  ],
  // 🆕 锚点配置
  anchor_config: {
    time_granularity: 'month',
    allow_fuzzy_match: false,
    conflict_strategy: 'llm_advisory'
  },
  version: '1.0.0'
};

/**
 * Example 2: 区域实体 (Location Entity)
 * 
 * This schema captures geographic locations with their properties.
 */
const locationEntity = {
  schema_name: '区域实体',
  entity_type: 'LocationEntity',
  core_fields: [
    { name: '区域名称', weight: 0.5, required: true },
    { name: '区域类型', weight: 0.3, required: false },
    { name: '上级区域', weight: 0.2, required: false }
  ],
  threshold: 0.6,
  relations: [
    { type: '属于', target_field: '上级区域', direction: 'outgoing' }
  ],
  // 🆕 锚点字段配置 - 地点实体只需要区域名称作为锚点
  anchor_fields: [
    { name: '区域名称', normalization_strategy: 'location', priority: 1 }
  ],
  // 🆕 锚点配置
  anchor_config: {
    allow_fuzzy_match: false,
    conflict_strategy: 'auto'
  },
  version: '1.0.0'
};

/**
 * Example 3: 指标实体 (Indicator Entity)
 * 
 * This schema captures measurement indicators or metrics.
 */
const indicatorEntity = {
  schema_name: '指标实体',
  entity_type: 'IndicatorEntity',
  core_fields: [
    { name: '指标名称', weight: 0.5, required: true },
    { name: '指标类型', weight: 0.3, required: false },
    { name: '单位', weight: 0.2, required: false }
  ],
  threshold: 0.6,
  relations: [],
  version: '1.0.0'
};

/**
 * Example 4: 项目实体 (Project Entity)
 * 
 * This schema captures project information with timeline and participants.
 */
const projectEntity = {
  schema_name: '项目实体',
  entity_type: 'ProjectEntity',
  core_fields: [
    { name: '项目名称', weight: 0.4, required: true },
    { name: '项目负责人', weight: 0.2, required: false },
    { name: '开始时间', weight: 0.2, required: false },
    { name: '结束时间', weight: 0.1, required: false },
    { name: '项目状态', weight: 0.1, required: false }
  ],
  threshold: 0.7,
  relations: [
    { type: '负责人', target_field: '项目负责人', direction: 'outgoing' }
  ],
  // 🆕 锚点字段配置 - 项目名称和开始时间作为锚点
  anchor_fields: [
    { name: '项目名称', normalization_strategy: 'lowercase', priority: 1 },
    { name: '开始时间', normalization_strategy: 'time_month', priority: 2 }
  ],
  // 🆕 锚点配置
  anchor_config: {
    time_granularity: 'month',
    allow_fuzzy_match: false,
    conflict_strategy: 'llm_advisory'
  },
  version: '1.0.0'
};

/**
 * Example 5: 人员实体 (Person Entity)
 * 
 * This schema captures person information with role and organization.
 */
const personEntity = {
  schema_name: '人员实体',
  entity_type: 'PersonEntity',
  core_fields: [
    { name: '姓名', weight: 0.5, required: true },
    { name: '职位', weight: 0.2, required: false },
    { name: '组织', weight: 0.2, required: false },
    { name: '联系方式', weight: 0.1, required: false }
  ],
  threshold: 0.6,
  relations: [
    { type: '所属组织', target_field: '组织', direction: 'outgoing' }
  ],
  version: '1.0.0'
};

/**
 * Example 6: 组织实体 (Organization Entity)
 * 
 * This schema captures organization information.
 */
const organizationEntity = {
  schema_name: '组织实体',
  entity_type: 'OrganizationEntity',
  core_fields: [
    { name: '组织名称', weight: 0.5, required: true },
    { name: '组织类型', weight: 0.3, required: false },
    { name: '上级组织', weight: 0.2, required: false }
  ],
  threshold: 0.6,
  relations: [
    { type: '隶属于', target_field: '上级组织', direction: 'outgoing' }
  ],
  version: '1.0.0'
};

/**
 * Example 7: 文档实体 (Document Entity)
 * 
 * This schema captures document metadata.
 */
const documentEntity = {
  schema_name: '文档实体',
  entity_type: 'DocumentEntity',
  core_fields: [
    { name: '文档标题', weight: 0.4, required: true },
    { name: '文档类型', weight: 0.2, required: false },
    { name: '作者', weight: 0.2, required: false },
    { name: '创建时间', weight: 0.2, required: false }
  ],
  threshold: 0.6,
  relations: [
    { type: '作者', target_field: '作者', direction: 'outgoing' }
  ],
  version: '1.0.0'
};

/**
 * Example 8: 设备实体 (Equipment Entity)
 * 
 * This schema captures equipment or device information.
 */
const equipmentEntity = {
  schema_name: '设备实体',
  entity_type: 'EquipmentEntity',
  core_fields: [
    { name: '设备名称', weight: 0.4, required: true },
    { name: '设备型号', weight: 0.2, required: false },
    { name: '所在位置', weight: 0.2, required: false },
    { name: '设备状态', weight: 0.2, required: false }
  ],
  threshold: 0.6,
  relations: [
    { type: '位于', target_field: '所在位置', direction: 'outgoing' }
  ],
  version: '1.0.0'
};

/**
 * Example 9: 政府工作报告实体 (Government Report Entity)
 * 
 * This schema captures government work report information including projects,
 * regions, metrics, and statistics.
 */
const governmentReportEntity = {
  schema_name: '政府工作报告实体',
  entity_type: 'GovernmentReportEntity',
  core_fields: [
    { name: '项目名称', weight: 0.3, required: true },
    { name: '区域', weight: 0.2, required: false },
    { name: '数值', weight: 0.15, required: false },
    { name: '单位', weight: 0.1, required: false },
    { name: '指标', weight: 0.15, required: false },
    { name: '时间', weight: 0.1, required: false }
  ],
  threshold: 0.6,
  relations: [
    { type: '位于', target_field: '区域', direction: 'outgoing' },
    { type: '发生于', target_field: '时间', direction: 'outgoing' },
    { type: '涉及指标', target_field: '指标', direction: 'outgoing' }
  ],
  version: '1.0.0'
};

// Export all example schemas
module.exports = {
  groundwaterLevelChangeEvent,
  locationEntity,
  indicatorEntity,
  projectEntity,
  personEntity,
  organizationEntity,
  documentEntity,
  equipmentEntity,
  governmentReportEntity,
  
  // Export as array for easy iteration
  allSchemas: [
    groundwaterLevelChangeEvent,
    locationEntity,
    indicatorEntity,
    projectEntity,
    personEntity,
    organizationEntity,
    documentEntity,
    equipmentEntity,
    governmentReportEntity
  ]
};
