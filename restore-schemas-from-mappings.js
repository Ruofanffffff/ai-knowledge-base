/**
 * 从映射文件恢复 Schema 到数据库
 * 
 * 映射文件中有 414 个 Schema 的字段映射信息
 * 我们需要根据这些信息重建 Schema 定义并导入数据库
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const mappings = require('./kg/field_normalizer/schema_field_mappings.json');

// 从映射推断 Schema 定义
function inferSchemaFromMapping(schemaName, mapping) {
  // 提取所有字段
  const fields = new Set();
  
  // 从映射中提取字段
  for (const [key, value] of Object.entries(mapping)) {
    if (typeof value === 'string') {
      fields.add(value);
    } else if (Array.isArray(value)) {
      value.forEach(v => fields.add(v));
    }
  }
  
  // 转换为 core_fields 格式
  const coreFields = Array.from(fields).map((fieldName, index) => {
    const weight = index === 0 ? 0.4 : (1 - 0.4) / (fields.size - 1);
    return {
      name: fieldName,
      weight: parseFloat(weight.toFixed(3)),
      required: index === 0, // 第一个字段为必需
      field_type: 'text',
      description: fieldName,
      anchor: index === 0 // 第一个字段作为锚点
    };
  });
  
  // 归一化权重
  const totalWeight = coreFields.reduce((sum, f) => sum + f.weight, 0);
  coreFields.forEach(f => {
    f.weight = parseFloat((f.weight / totalWeight).toFixed(3));
  });
  
  // 推断实体类型
  let entityType = schemaName.replace(/实体$/, 'Entity');
  if (!entityType.endsWith('Entity')) {
    entityType += 'Entity';
  }
  
  // 推断场景
  let scene = 'general';
  if (schemaName.includes('摄影') || schemaName.includes('Photography')) {
    scene = '摄影教程';
  } else if (schemaName.includes('软件') || schemaName.includes('代码') || schemaName.includes('API')) {
    scene = '软件开发';
  } else if (schemaName.includes('AI') || schemaName.includes('算法') || schemaName.includes('模型')) {
    scene = 'AI科学';
  }
  
  return {
    schema_name: schemaName,
    entity_type: entityType,
    scene: scene,
    core_fields: coreFields,
    threshold: 0.4, // 默认阈值
    relations: [],
    example_description: `${schemaName}的示例`,
    description: `${schemaName} - 从映射文件恢复`,
    version: '1.0.0',
    active: true
  };
}

async function restoreSchemas() {
  console.log('=== 从映射文件恢复 Schema ===\n');
  
  const schemaNames = Object.keys(mappings);
  console.log(`找到 ${schemaNames.length} 个 Schema 映射\n`);
  
  let created = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const schemaName of schemaNames) {
    try {
      // 检查是否已存在
      const existing = await prisma.schema.findUnique({
        where: { name: schemaName }
      });
      
      if (existing) {
        skipped++;
        continue;
      }
      
      // 从映射推断 Schema
      const schema = inferSchemaFromMapping(schemaName, mappings[schemaName]);
      
      // 创建 Schema
      await prisma.schema.create({
        data: {
          name: schema.schema_name,
          entityType: schema.entity_type,
          scene: schema.scene,
          coreFields: JSON.stringify(schema.core_fields),
          anchorFields: JSON.stringify(schema.core_fields.filter(f => f.anchor).map(f => f.name)),
          threshold: schema.threshold,
          relations: JSON.stringify(schema.relations),
          exampleDescription: schema.example_description,
          description: schema.description,
          version: schema.version,
          active: schema.active
        }
      });
      
      created++;
      
      if (created % 50 === 0) {
        console.log(`已创建 ${created} 个 Schema...`);
      }
      
    } catch (error) {
      console.error(`❌ 创建 Schema "${schemaName}" 失败:`, error.message);
      failed++;
    }
  }
  
  console.log('\n=== 恢复完成 ===');
  console.log(`✅ 创建: ${created}`);
  console.log(`⏭️  跳过: ${skipped}`);
  console.log(`❌ 失败: ${failed}`);
  console.log(`📊 总计: ${schemaNames.length}`);
  
  // 验证
  const count = await prisma.schema.count();
  console.log(`\n数据库中现有 ${count} 个 Schema`);
  
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

restoreSchemas();
