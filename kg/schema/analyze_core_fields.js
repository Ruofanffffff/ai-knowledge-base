/**
 * 分析所有Schema的核心字段数量
 * 
 * 统计每个Schema的字段数，找出需要补充字段的Schema
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function analyzeCoreFields() {
  console.log('开始分析Schema核心字段...\n');

  try {
    // 读取所有Schema
    const allSchemas = await prisma.schema.findMany({
      select: {
        id: true,
        name: true,
        scene: true,
        coreFields: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`✓ 数据库中共有 ${allSchemas.length} 个Schema\n`);

    // 统计字段数量
    const fieldStats = [];
    let totalFields = 0;

    for (const schema of allSchemas) {
      const coreFields = schema.coreFields ? JSON.parse(schema.coreFields) : [];
      const fieldCount = coreFields.length;
      totalFields += fieldCount;

      fieldStats.push({
        name: schema.name,
        scene: schema.scene,
        fieldCount: fieldCount,
        fields: coreFields.map(f => f.name)
      });
    }

    // 计算平均值
    const avgFields = totalFields / allSchemas.length;

    console.log('================================================================================');
    console.log('📊 统计结果');
    console.log('================================================================================\n');

    console.log(`总Schema数: ${allSchemas.length}`);
    console.log(`总字段数: ${totalFields}`);
    console.log(`平均字段数: ${avgFields.toFixed(2)}\n`);

    // 按字段数量分组
    const byFieldCount = {};
    for (const stat of fieldStats) {
      const count = stat.fieldCount;
      if (!byFieldCount[count]) {
        byFieldCount[count] = [];
      }
      byFieldCount[count].push(stat);
    }

    console.log('按字段数量分布:');
    const sortedCounts = Object.keys(byFieldCount).map(Number).sort((a, b) => a - b);
    for (const count of sortedCounts) {
      const schemas = byFieldCount[count];
      console.log(`  ${count} 个字段: ${schemas.length} 个Schema`);
    }

    console.log('');

    // 找出字段数<5的Schema
    const needMoreFields = fieldStats.filter(s => s.fieldCount < 5);

    console.log('================================================================================');
    console.log('📋 需要补充字段的Schema（字段数<5）');
    console.log('================================================================================\n');

    console.log(`需要补充的Schema数: ${needMoreFields.length} (${(needMoreFields.length / allSchemas.length * 100).toFixed(1)}%)\n`);

    // 按场景分组
    const byScene = {};
    for (const schema of needMoreFields) {
      const scene = schema.scene || 'Unknown';
      if (!byScene[scene]) {
        byScene[scene] = [];
      }
      byScene[scene].push(schema);
    }

    for (const [scene, schemas] of Object.entries(byScene)) {
      console.log(`\n【${scene}】 (${schemas.length} 个Schema)`);
      console.log('─'.repeat(80));
      
      for (const schema of schemas.slice(0, 10)) {
        console.log(`\n${schema.name}`);
        console.log(`  当前字段数: ${schema.fieldCount}`);
        console.log(`  需要补充: ${5 - schema.fieldCount} 个字段`);
        if (schema.fields.length > 0) {
          console.log(`  现有字段: ${schema.fields.join(', ')}`);
        }
      }
      
      if (schemas.length > 10) {
        console.log(`\n  ... 还有 ${schemas.length - 10} 个Schema`);
      }
    }

    // 计算需要补充的总字段数
    const fieldsToAdd = needMoreFields.reduce((sum, s) => sum + (5 - s.fieldCount), 0);

    console.log('\n\n================================================================================');
    console.log('📈 补充计划');
    console.log('================================================================================\n');

    console.log(`需要补充字段的Schema数: ${needMoreFields.length}`);
    console.log(`需要补充的总字段数: ${fieldsToAdd}`);
    console.log(`补充后的平均字段数: ${((totalFields + fieldsToAdd) / allSchemas.length).toFixed(2)}\n`);

    // 按场景统计
    console.log('按场景统计需要补充的字段:');
    for (const [scene, schemas] of Object.entries(byScene)) {
      const sceneFieldsToAdd = schemas.reduce((sum, s) => sum + (5 - s.fieldCount), 0);
      console.log(`  ${scene}: ${schemas.length} 个Schema, 需要补充 ${sceneFieldsToAdd} 个字段`);
    }

  } catch (error) {
    console.error('分析失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行分析
analyzeCoreFields();
