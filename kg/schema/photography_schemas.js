/**
 * Photography-Related Schema Definitions
 * 
 * Schemas for photography, post-processing, and product design domains.
 * These schemas are designed to capture information from photography PRDs,
 * equipment reviews, and creative workflow documentation.
 */

/**
 * PhotographyEntity Schema
 * 
 * Captures photography equipment and shooting parameters.
 * Designed for camera reviews, shooting guides, and equipment documentation.
 */
const photographyEntity = {
  schema_name: 'PhotographyEntity',
  entity_type: 'PhotographyEntity',
  scene: '摄影',
  description: '摄影实体 - 捕获相机、镜头、拍摄参数等摄影设备和技术信息',
  core_fields: [
    { name: 'Camera', weight: 0.3, required: true, field_type: 'text', description: '相机型号' },
    { name: 'Lens', weight: 0.3, required: true, field_type: 'text', description: '镜头型号' },
    { name: 'ISO', weight: 0.1, required: false, field_type: 'number', description: 'ISO感光度' },
    { name: 'Aperture', weight: 0.1, required: false, field_type: 'text', description: '光圈值' },
    { name: 'Shutter', weight: 0.1, required: false, field_type: 'text', description: '快门速度' },
    { name: 'Exposure', weight: 0.05, required: false, field_type: 'text', description: '曝光补偿' },
    { name: 'Focus', weight: 0.05, required: false, field_type: 'text', description: '对焦模式' }
  ],
  threshold: 0.5,
  relations: [
    { type: '使用镜头', target_field: 'Lens', direction: 'outgoing' },
    { type: '拍摄参数', target_field: 'ISO', direction: 'outgoing' }
  ],
  version: '1.0.0'
};

/**
 * PostProcessingEntity Schema
 * 
 * Captures post-processing software, styles, and presets.
 * Designed for photo editing tutorials, color grading guides, and workflow documentation.
 */
const postProcessingEntity = {
  schema_name: 'PostProcessingEntity',
  entity_type: 'PostProcessingEntity',
  scene: '后期处理',
  description: '后期处理实体 - 捕获修图软件、调色风格、预设等后期处理信息',
  core_fields: [
    { name: 'Software', weight: 0.4, required: true, field_type: 'text', description: '后期软件' },
    { name: 'Style', weight: 0.3, required: false, field_type: 'text', description: '调色风格' },
    { name: 'Preset', weight: 0.3, required: false, field_type: 'text', description: '预设名称' }
  ],
  threshold: 0.5,
  relations: [
    { type: '使用软件', target_field: 'Software', direction: 'outgoing' },
    { type: '应用风格', target_field: 'Style', direction: 'outgoing' }
  ],
  version: '1.0.0'
};

/**
 * ProductDesignEntity Schema
 * 
 * Captures product design information including product name, version, author, and status.
 * Designed for PRDs, product specifications, and design documentation.
 */
const productDesignEntity = {
  schema_name: 'ProductDesignEntity',
  entity_type: 'ProductDesignEntity',
  scene: '产品设计',
  description: '产品设计实体 - 捕获产品名称、版本、作者、状态等产品设计信息',
  core_fields: [
    { name: 'ProductName', weight: 0.4, required: true, field_type: 'text', description: '产品名称' },
    { name: 'Version', weight: 0.2, required: false, field_type: 'text', description: '版本号' },
    { name: 'Author', weight: 0.2, required: false, field_type: 'text', description: '作者' },
    { name: 'Status', weight: 0.2, required: false, field_type: 'text', description: '状态' }
  ],
  threshold: 0.5,
  relations: [
    { type: '创建者', target_field: 'Author', direction: 'outgoing' },
    { type: '当前版本', target_field: 'Version', direction: 'outgoing' }
  ],
  version: '1.0.0'
};

// Export all photography-related schemas
module.exports = {
  photographyEntity,
  postProcessingEntity,
  productDesignEntity,
  
  // Export as array for easy iteration
  allSchemas: [
    photographyEntity,
    postProcessingEntity,
    productDesignEntity
  ]
};
