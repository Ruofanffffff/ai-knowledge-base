/**
 * 修复PhotographyEntity的必需字段配置
 * 将Camera和Lens改为非必需字段，因为它们很少被提取到
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('================================================================================');
console.log('🔧 修复PhotographyEntity必需字段配置');
console.log('================================================================================\n');

async function fix() {
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

    console.log('📝 当前核心字段配置:');
    coreFields.forEach((field, i) => {
      console.log(`   ${i + 1}. ${field.name}: 权重=${field.weight}, 必需=${field.required}, 锚点=${field.anchor}`);
    });
    console.log('');

    // 修改Camera和Lens为非必需
    console.log('🔧 修改必需字段配置...');
    
    let modified = false;
    coreFields.forEach(field => {
      if (field.name === 'Camera' && field.required === true) {
        field.required = false;
        console.log(`   ✓ Camera: required true → false`);
        modified = true;
      }
      if (field.name === 'Lens' && field.required === true) {
        field.required = false;
        console.log(`   ✓ Lens: required true → false`);
        modified = true;
      }
    });

    if (!modified) {
      console.log('   ℹ️  Camera和Lens已经是非必需字段');
    }
    console.log('');

    // 调整权重使总和接近1.0
    console.log('🔧 调整字段权重...');
    
    // 当前权重总和: 1.45
    // 目标: 1.0
    // 策略: 降低Camera和Lens的权重
    
    const oldWeights = {};
    coreFields.forEach(field => {
      oldWeights[field.name] = field.weight;
      
      if (field.name === 'Camera') {
        field.weight = 0.15; // 0.3 → 0.15
      } else if (field.name === 'Lens') {
        field.weight = 0.15; // 0.3 → 0.15
      }
    });

    // 显示权重变化
    coreFields.forEach(field => {
      if (oldWeights[field.name] !== field.weight) {
        console.log(`   ✓ ${field.name}: ${oldWeights[field.name]} → ${field.weight}`);
      }
    });

    const newTotalWeight = coreFields.reduce((sum, cf) => sum + (cf.weight || 0), 0);
    console.log(`   ✓ 权重总和: 1.45 → ${newTotalWeight.toFixed(2)}`);
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

    coreFields.forEach((field, i) => {
      console.log(`${i + 1}. ${field.name}`);
      console.log(`   - 权重: ${field.weight}`);
      console.log(`   - 必需: ${field.required}`);
      console.log(`   - 锚点: ${field.anchor}`);
    });
    console.log('');

    const requiredFields = coreFields.filter(cf => cf.required);
    console.log(`必需字段数量: ${requiredFields.length}/${coreFields.length}`);
    console.log(`权重总和: ${newTotalWeight.toFixed(2)}`);
    console.log('');

    console.log('✓ 修复完成\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('\n❌ 修复失败:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

fix();
