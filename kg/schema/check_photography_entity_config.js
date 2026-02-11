/**
 * 检查PhotographyEntity的数据库配置
 * 查看core_fields和anchor_fields是否正确
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('================================================================================');
console.log('🔍 检查PhotographyEntity配置');
console.log('================================================================================\n');

async function check() {
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

    // 解析配置
    const coreFields = JSON.parse(schema.coreFields || '[]');
    const anchorFields = JSON.parse(schema.anchorFields || '[]');

    console.log('📝 基本信息:');
    console.log(`   ID: ${schema.id}`);
    console.log(`   名称: ${schema.name}`);
    console.log(`   描述: ${schema.description || '(无)'}`);
    console.log(`   领域: ${schema.domain || '(无)'}`);
    console.log('');

    console.log('📊 核心字段 (coreFields):');
    console.log(`   总数: ${coreFields.length}`);
    console.log('');

    if (coreFields.length > 0) {
      console.log('   详细列表:');
      coreFields.forEach((field, i) => {
        console.log(`   ${i + 1}. ${field.name}`);
        console.log(`      - 权重: ${field.weight || 0}`);
        console.log(`      - 必需: ${field.required || false}`);
        console.log(`      - 锚点: ${field.anchor || false}`);
        console.log(`      - 数据类型: ${field.dataType || '(无)'}`);
      });
    } else {
      console.log('   ⚠️  没有核心字段');
    }
    console.log('');

    console.log('🔗 锚点字段 (anchorFields):');
    console.log(`   总数: ${anchorFields.length}`);
    console.log('');

    if (anchorFields.length > 0) {
      console.log('   详细列表:');
      anchorFields.forEach((field, i) => {
        console.log(`   ${i + 1}. ${field.name} (优先级: ${field.priority || i + 1})`);
      });
    } else {
      console.log('   ⚠️  没有锚点字段');
    }
    console.log('');

    // 检查问题
    console.log('================================================================================');
    console.log('🔍 问题检查');
    console.log('================================================================================\n');

    let hasIssues = false;

    // 检查1: 核心字段是否为空
    if (coreFields.length === 0) {
      console.log('❌ 问题1: 核心字段为空');
      console.log('   影响: Schema匹配器无法计算完整度');
      console.log('   建议: 配置核心字段\n');
      hasIssues = true;
    } else {
      console.log(`✓ 核心字段已配置 (${coreFields.length}个)\n`);
    }

    // 检查2: 锚点字段是否为空
    if (anchorFields.length === 0) {
      console.log('❌ 问题2: 锚点字段为空');
      console.log('   影响: 实体构建无法使用锚点驱动');
      console.log('   建议: 配置锚点字段\n');
      hasIssues = true;
    } else {
      console.log(`✓ 锚点字段已配置 (${anchorFields.length}个)\n`);
    }

    // 检查3: 核心字段的权重总和
    const totalWeight = coreFields.reduce((sum, cf) => sum + (cf.weight || 0), 0);
    console.log(`核心字段权重总和: ${totalWeight.toFixed(2)}`);
    
    if (totalWeight === 0) {
      console.log('⚠️  警告: 所有核心字段权重为0');
      console.log('   影响: 加权完整度计算可能不准确\n');
      hasIssues = true;
    } else if (totalWeight < 0.9 || totalWeight > 1.1) {
      console.log(`⚠️  警告: 权重总和不接近1.0 (${totalWeight.toFixed(2)})`);
      console.log('   建议: 调整权重使总和接近1.0\n');
    } else {
      console.log('✓ 权重总和正常\n');
    }

    // 检查4: 必需字段数量
    const requiredFields = coreFields.filter(cf => cf.required);
    console.log(`必需字段数量: ${requiredFields.length}/${coreFields.length}`);
    
    if (requiredFields.length === coreFields.length) {
      console.log('⚠️  警告: 所有核心字段都是必需的');
      console.log('   影响: Schema可能很难达到匹配阈值\n');
    } else {
      console.log('✓ 必需字段配置合理\n');
    }

    // 检查5: 锚点字段是否在核心字段中
    const coreFieldNames = coreFields.map(cf => cf.name);
    const anchorFieldNames = anchorFields.map(af => af.name);
    const missingAnchors = anchorFieldNames.filter(af => !coreFieldNames.includes(af));
    
    if (missingAnchors.length > 0) {
      console.log('⚠️  警告: 以下锚点字段不在核心字段中:');
      missingAnchors.forEach(af => console.log(`   - ${af}`));
      console.log('   影响: 这些锚点字段可能无法被提取\n');
    } else {
      console.log('✓ 所有锚点字段都在核心字段中\n');
    }

    // 总结
    console.log('================================================================================');
    console.log('📋 检查总结');
    console.log('================================================================================\n');

    if (hasIssues) {
      console.log('⚠️  发现配置问题，需要修复');
    } else {
      console.log('✓ 配置正常');
    }

    console.log('\n✓ 检查完成\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('\n❌ 检查失败:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

check();
