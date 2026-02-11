/**
 * 调整PhotographyEntity的字段权重
 * 使权重总和接近1.0
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('================================================================================');
console.log('🔧 调整PhotographyEntity字段权重');
console.log('================================================================================\n');

async function adjust() {
  try {
    // 查询PhotographyEntity
    const schema = await prisma.schema.findUnique({
      where: { name: 'PhotographyEntity' }
    });

    if (!schema) {
      console.error('❌ 未找到PhotographyEntity');
      process.exit(1);
    }

    console.log('✓ 找到PhotographyEntity\n');

    // 解析核心字段
    const coreFields = JSON.parse(schema.coreFields || '[]');

    const oldTotalWeight = coreFields.reduce((sum, cf) => sum + (cf.weight || 0), 0);
    console.log(`当前权重总和: ${oldTotalWeight.toFixed(2)}\n`);

    // 新的权重配置
    // 目标: 总和 = 1.0
    // 锚点字段（经常被提取）: Aperture, Shutter, ISO, FocalLength
    // 非锚点字段（很少被提取）: Camera, Lens, Exposure, Focus
    
    const newWeights = {
      'Aperture': 0.25,      // 锚点，高权重
      'Shutter': 0.25,       // 锚点，高权重
      'ISO': 0.20,           // 锚点，高权重
      'FocalLength': 0.15,   // 锚点，中权重
      'Camera': 0.05,        // 非锚点，低权重
      'Lens': 0.05,          // 非锚点，低权重
      'Exposure': 0.03,      // 非锚点，很低权重
      'Focus': 0.02          // 非锚点，很低权重
    };

    console.log('🔧 调整字段权重...\n');

    coreFields.forEach(field => {
      const oldWeight = field.weight;
      const newWeight = newWeights[field.name] || field.weight;
      
      if (oldWeight !== newWeight) {
        field.weight = newWeight;
        console.log(`   ${field.name}: ${oldWeight.toFixed(2)} → ${newWeight.toFixed(2)}`);
      }
    });

    const newTotalWeight = coreFields.reduce((sum, cf) => sum + (cf.weight || 0), 0);
    console.log(`\n   权重总和: ${oldTotalWeight.toFixed(2)} → ${newTotalWeight.toFixed(2)}`);
    console.log('');

    // 更新数据库
    console.log('💾 更新数据库...');
    
    await prisma.schema.update({
      where: { name: 'PhotographyEntity' },
      data: {
        coreFields: JSON.stringify(coreFields)
      }
    });

    console.log('   ✓ 数据库已更新\n');

    // 显示更新后的配置
    console.log('================================================================================');
    console.log('📊 更新后的核心字段配置');
    console.log('================================================================================\n');

    // 按权重排序
    const sortedFields = [...coreFields].sort((a, b) => b.weight - a.weight);

    sortedFields.forEach((field, i) => {
      const anchor = field.anchor ? '🔗' : '  ';
      console.log(`${i + 1}. ${anchor} ${field.name.padEnd(15)} 权重: ${field.weight.toFixed(2)}`);
    });
    console.log('');

    console.log(`权重总和: ${newTotalWeight.toFixed(2)}`);
    console.log(`锚点字段: ${coreFields.filter(cf => cf.anchor).length}个`);
    console.log(`必需字段: ${coreFields.filter(cf => cf.required).length}个`);
    console.log('');

    console.log('✓ 调整完成\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('\n❌ 调整失败:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

adjust();
