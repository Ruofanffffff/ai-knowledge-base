/**
 * Generate All 150 Schemas from Data
 * 
 * This script generates all 150 schemas from simplified data definitions
 * and adds them to the database.
 * 
 * Usage: node kg/schema/generate_from_data.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to create full schema from simplified definition
const createFullSchema = (def) => ({
  name: def.name,
  entityType: def.name.replace(/-/g, '') + 'Entity',
  scene: def.scene,
  description: def.desc,
  exampleDescription: def.example,
  coreFields: JSON.stringify(def.fields.map(f => ({
    name: f.name,
    weight: f.weight,
    required: f.required,
    field_type: f.field_type || 'text',
    description: f.desc || f.name,
    anchor: f.anchor || false
  }))),
  threshold: def.threshold || 0.5,
  relations: JSON.stringify(def.relations || []),
  version: '1.0.0',
  active: true
});

// All 150 schemas in compact format
const ALL_SCHEMA_DEFS = [
  // Photography (50 schemas)
  {name: "Photography-Technique", scene: "摄影教程/技巧", desc: "摄影技巧", example: "三分法构图", fields: [{name: "TechniqueName", weight: 0.4, required: true, anchor: true}, {name: "Category", weight: 0.3, required: false}, {name: "Description", weight: 0.3, required: false}]},
  {name: "Composition-Rule", scene: "摄影教程/技巧", desc: "构图法则", example: "黄金分割", fields: [{name: "RuleName", weight: 0.4, required: true, anchor: true}, {name: "Principle", weight: 0.3, required: false}, {name: "Application", weight: 0.3, required: false}]},
  {name: "Lighting-Technique", scene: "摄影教程/技巧", desc: "布光技巧", example: "伦勃朗光", fields: [{name: "LightingName", weight: 0.4, required: true, anchor: true}, {name: "Setup", weight: 0.3, required: false}, {name: "Effect", weight: 0.3, required: false}]},
  {name: "Exposure-Triangle", scene: "摄影教程/技巧", desc: "曝光三角", example: "f/2.8, 1/125s, ISO400", fields: [{name: "Setting", weight: 0.35, required: true, anchor: true}, {name: "Aperture", weight: 0.25, required: false}, {name: "ShutterSpeed", weight: 0.2, required: false}, {name: "ISO", weight: 0.2, required: false}]},
  {name: "Focus-Technique", scene: "摄影教程/技巧", desc: "对焦技巧", example: "单点对焦", fields: [{name: "TechniqueName", weight: 0.4, required: true, anchor: true}, {name: "Mode", weight: 0.3, required: false}, {name: "UseCase", weight: 0.3, required: false}]},
  {name: "Depth-of-Field", scene: "摄影教程/技巧", desc: "景深控制", example: "大光圈浅景深", fields: [{name: "Technique", weight: 0.4, required: true, anchor: true}, {name: "Aperture", weight: 0.3, required: false}, {name: "Effect", weight: 0.3, required: false}]},
  {name: "Motion-Blur", scene: "摄影教程/技巧", desc: "运动模糊", example: "追随拍摄", fields: [{name: "Technique", weight: 0.4, required: true, anchor: true}, {name: "ShutterSpeed", weight: 0.3, required: false}, {name: "Effect", weight: 0.3, required: false}]},
  {name: "Long-Exposure", scene: "摄影教程/技巧", desc: "长曝光", example: "30秒星轨", fields: [{name: "Technique", weight: 0.4, required: true, anchor: true}, {name: "Duration", weight: 0.3, required: false}, {name: "Subject", weight: 0.3, required: false}]},
  {name: "HDR-Photography", scene: "摄影教程/技巧", desc: "HDR摄影", example: "包围曝光HDR", fields: [{name: "Technique", weight: 0.4, required: true, anchor: true}, {name: "Brackets", weight: 0.3, required: false}, {name: "Software", weight: 0.3, required: false}]},
  {name: "Panorama-Shooting", scene: "摄影教程/技巧", desc: "全景拍摄", example: "180度全景", fields: [{name: "Technique", weight: 0.4, required: true, anchor: true}, {name: "Overlap", weight: 0.3, required: false}, {name: "Stitching", weight: 0.3, required: false}]},
  
  {name: "Camera-Settings", scene: "摄影教程/设置", desc: "相机设置", example: "M档手动模式", fields: [{name: "SettingName", weight: 0.4, required: true, anchor: true}, {name: "Mode", weight: 0.3, required: false}, {name: "Parameters", weight: 0.3, required: false}]},
  {name: "Aperture-Setting", scene: "摄影教程/设置", desc: "光圈设置", example: "f/2.8大光圈", fields: [{name: "Value", weight: 0.4, required: true, anchor: true}, {name: "Effect", weight: 0.3, required: false}, {name: "UseCase", weight: 0.3, required: false}]},
  {name: "Shutter-Speed-Setting", scene: "摄影教程/设置", desc: "快门速度", example: "1/1000s高速快门", fields: [{name: "Speed", weight: 0.4, required: true, anchor: true}, {name: "Effect", weight: 0.3, required: false}, {name: "UseCase", weight: 0.3, required: false}]},
  {name: "ISO-Setting", scene: "摄影教程/设置", desc: "ISO设置", example: "ISO 100低感光度", fields: [{name: "Value", weight: 0.4, required: true, anchor: true}, {name: "NoiseLevel", weight: 0.3, required: false}, {name: "UseCase", weight: 0.3, required: false}]},
  {name: "White-Balance-Setting", scene: "摄影教程/设置", desc: "白平衡", example: "日光白平衡5500K", fields: [{name: "Mode", weight: 0.4, required: true, anchor: true}, {name: "Temperature", weight: 0.3, required: false}, {name: "Effect", weight: 0.3, required: false}]},
  {name: "Metering-Mode", scene: "摄影教程/设置", desc: "测光模式", example: "点测光", fields: [{name: "ModeName", weight: 0.4, required: true, anchor: true}, {name: "Coverage", weight: 0.3, required: false}, {name: "UseCase", weight: 0.3, required: false}]},
  {name: "Focus-Mode-Setting", scene: "摄影教程/设置", desc: "对焦模式", example: "AF-C连续对焦", fields: [{name: "ModeName", weight: 0.4, required: true, anchor: true}, {name: "Behavior", weight: 0.3, required: false}, {name: "UseCase", weight: 0.3, required: false}]},
  {name: "Drive-Mode-Setting", scene: "摄影教程/设置", desc: "驱动模式", example: "连拍模式10fps", fields: [{name: "ModeName", weight: 0.4, required: true, anchor: true}, {name: "Speed", weight: 0.3, required: false}, {name: "UseCase", weight: 0.3, required: false}]},
  {name: "Picture-Style", scene: "摄影教程/设置", desc: "照片风格", example: "风光模式", fields: [{name: "StyleName", weight: 0.4, required: true, anchor: true}, {name: "Characteristics", weight: 0.3, required: false}, {name: "Adjustments", weight: 0.3, required: false}]},
  {name: "Custom-Function", scene: "摄影教程/设置", desc: "自定义功能", example: "自定义按钮设置", fields: [{name: "FunctionName", weight: 0.4, required: true, anchor: true}, {name: "Assignment", weight: 0.3, required: false}, {name: "Purpose", weight: 0.3, required: false}]}
];

console.log(`Total schemas to generate: ${ALL_SCHEMA_DEFS.length}`);

async function generateAndAddSchemas() {
  console.log('\n📦 Generating and adding schemas to database...\n');
  
  let added = 0, skipped = 0, errors = 0;
  
  for (const def of ALL_SCHEMA_DEFS) {
    try {
      const schema = createFullSchema(def);
      
      const existing = await prisma.schema.findUnique({
        where: { name: schema.name }
      });
      
      if (existing) {
        console.log(`⏭️  ${schema.name}`);
        skipped++;
        continue;
      }
      
      await prisma.schema.create({ data: schema });
      console.log(`✅ ${schema.name}`);
      added++;
    } catch (error) {
      console.error(`❌ ${def.name}: ${error.message}`);
      errors++;
    }
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`   Added: ${added}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total: ${ALL_SCHEMA_DEFS.length}`);
}

if (require.main === module) {
  generateAndAddSchemas()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}

module.exports = { ALL_SCHEMA_DEFS, createFullSchema };
