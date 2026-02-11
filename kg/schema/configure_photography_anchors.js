/**
 * 为摄影Schema配置锚点字段
 * 
 * 此脚本为所有摄影相关的Schema配置锚点字段
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 摄影Schema的锚点字段配置
const photographyAnchorConfigs = {
  'Photography-Technique': {
    anchor_fields: [
      { name: 'TechniqueName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Composition-Rule': {
    anchor_fields: [
      { name: 'RuleName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Lighting-Technique': {
    anchor_fields: [
      { name: 'LightingName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Exposure-Triangle': {
    anchor_fields: [
      { name: 'Setting', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Focus-Technique': {
    anchor_fields: [
      { name: 'TechniqueName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Depth-of-Field': {
    anchor_fields: [
      { name: 'Setting', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Motion-Blur': {
    anchor_fields: [
      { name: 'Effect', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Long-Exposure': {
    anchor_fields: [
      { name: 'Duration', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'HDR-Photography': {
    anchor_fields: [
      { name: 'Technique', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Panorama-Shooting': {
    anchor_fields: [
      { name: 'Method', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Camera-Settings': {
    anchor_fields: [
      { name: 'SettingName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Aperture-Setting': {
    anchor_fields: [
      { name: 'Value', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Shutter-Speed-Setting': {
    anchor_fields: [
      { name: 'Speed', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'ISO-Setting': {
    anchor_fields: [
      { name: 'Value', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'White-Balance-Setting': {
    anchor_fields: [
      { name: 'Mode', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Focus-Mode-Setting': {
    anchor_fields: [
      { name: 'Mode', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Drive-Mode-Setting': {
    anchor_fields: [
      { name: 'Mode', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Picture-Style': {
    anchor_fields: [
      { name: 'StyleName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Custom-Function': {
    anchor_fields: [
      { name: 'FunctionName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Lens-Recommendation': {
    anchor_fields: [
      { name: 'LensName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Prime-Lens': {
    anchor_fields: [
      { name: 'LensName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Zoom-Lens': {
    anchor_fields: [
      { name: 'LensName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Wide-Angle-Lens': {
    anchor_fields: [
      { name: 'LensName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Telephoto-Lens': {
    anchor_fields: [
      { name: 'LensName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Macro-Lens': {
    anchor_fields: [
      { name: 'LensName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Filter-Usage': {
    anchor_fields: [
      { name: 'FilterType', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Tripod-Selection': {
    anchor_fields: [
      { name: 'TripodType', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Flash-Equipment': {
    anchor_fields: [
      { name: 'EquipmentName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Portrait-Photography': {
    anchor_fields: [
      { name: 'Subject', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Landscape-Photography': {
    anchor_fields: [
      { name: 'Location', normalization_strategy: 'location', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Wildlife-Photography': {
    anchor_fields: [
      { name: 'Subject', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Macro-Photography': {
    anchor_fields: [
      { name: 'Subject', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Night-Photography': {
    anchor_fields: [
      { name: 'Scene', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Sports-Photography': {
    anchor_fields: [
      { name: 'Sport', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Event-Photography': {
    anchor_fields: [
      { name: 'EventType', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Product-Photography': {
    anchor_fields: [
      { name: 'ProductType', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Food-Photography': {
    anchor_fields: [
      { name: 'Dish', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Post-Processing-Workflow': {
    anchor_fields: [
      { name: 'WorkflowName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Exposure-Adjustment': {
    anchor_fields: [
      { name: 'AdjustmentType', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Contrast-Enhancement': {
    anchor_fields: [
      { name: 'Method', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Sharpening-Technique': {
    anchor_fields: [
      { name: 'Technique', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Cropping-Technique': {
    anchor_fields: [
      { name: 'Ratio', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Layer-Masking': {
    anchor_fields: [
      { name: 'MaskType', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Preset-Application': {
    anchor_fields: [
      { name: 'PresetName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Export-Settings': {
    anchor_fields: [
      { name: 'Format', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  }
};

async function configurePhotographyAnchors() {
  console.log('🔧 开始为摄影Schema配置锚点字段...\n');

  let configured = 0;
  let skipped = 0;
  let errors = 0;

  for (const [schemaName, config] of Object.entries(photographyAnchorConfigs)) {
    try {
      const schema = await prisma.schema.findUnique({
        where: { name: schemaName }
      });

      if (!schema) {
        console.log(`⏭️  ${schemaName} (不存在)`);
        skipped++;
        continue;
      }

      // 检查是否已配置
      if (schema.anchorFields && schema.anchorFields.length > 0) {
        console.log(`⏭️  ${schemaName} (已配置)`);
        skipped++;
        continue;
      }

      // 更新Schema
      await prisma.schema.update({
        where: { name: schemaName },
        data: {
          anchorFields: JSON.stringify(config.anchor_fields),
          anchorConfig: JSON.stringify(config.anchor_config)
        }
      });

      console.log(`✅ ${schemaName}`);
      configured++;
    } catch (error) {
      console.error(`❌ ${schemaName}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n📊 配置摘要:`);
  console.log(`   已配置: ${configured}`);
  console.log(`   跳过: ${skipped}`);
  console.log(`   错误: ${errors}`);
  console.log(`\n✅ 摄影Schema锚点配置完成！`);
}

configurePhotographyAnchors()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
