/**
 * 诊断Schema匹配问题
 * 检查为什么PhotographyEntity没有被匹配到任何字段
 */

const fs = require('fs');
const path = require('path');
const MappingBasedNormalizer = require('../field_normalizer/mapping_based_normalizer');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

console.log('================================================================================');
console.log('🔍 诊断Schema匹配问题');
console.log('================================================================================\n');

async function diagnose() {
  try {
    // 1. 读取PhotographyEntity的数据库配置
    const schema = await prisma.schema.findUnique({
      where: { name: 'PhotographyEntity' }
    });

    if (!schema) {
      console.error('❌ 未找到PhotographyEntity');
      process.exit(1);
    }

    const coreFields = JSON.parse(schema.coreFields || '[]');
    console.log('1. 数据库中的核心字段:');
    coreFields.forEach((field, i) => {
      console.log(`   ${i + 1}. ${field.name} (权重: ${field.weight})`);
    });
    console.log('');

    // 2. 读取字段映射表
    const mappingPath = path.join(__dirname, '../field_normalizer/schema_field_mappings.json');
    const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf-8'));
    
    const photoMapping = mappings.PhotographyEntity;
    if (!photoMapping) {
      console.error('❌ 映射表中未找到PhotographyEntity');
      process.exit(1);
    }

    console.log('2. 映射表中的字段:');
    Object.keys(photoMapping).forEach((fieldName, i) => {
      const variations = photoMapping[fieldName].common_variations || [];
      console.log(`   ${i + 1}. ${fieldName} (${variations.length}个变体)`);
    });
    console.log('');

    // 3. 检查一致性
    console.log('3. 检查数据库和映射表的一致性:');
    const coreFieldNames = coreFields.map(cf => cf.name);
    const mappingFieldNames = Object.keys(photoMapping);

    const missingInMapping = coreFieldNames.filter(cf => !mappingFieldNames.includes(cf));
    const missingInCore = mappingFieldNames.filter(mf => !coreFieldNames.includes(mf));

    if (missingInMapping.length > 0) {
      console.log(`   ⚠️  数据库中有但映射表中没有的字段:`);
      missingInMapping.forEach(f => console.log(`      - ${f}`));
    }

    if (missingInCore.length > 0) {
      console.log(`   ⚠️  映射表中有但数据库中没有的字段:`);
      missingInCore.forEach(f => console.log(`      - ${f}`));
    }

    if (missingInMapping.length === 0 && missingInCore.length === 0) {
      console.log(`   ✓ 数据库和映射表一致`);
    }
    console.log('');

    // 4. 测试字段映射
    console.log('4. 测试字段映射:');
    
    const testFields = [
      { name: 'FocalLength', value: '55' },
      { name: 'Aperture', value: '1.8' },
      { name: 'ShutterSpeed', value: '1/250' },
      { name: 'LensModel', value: 'SEL35F18F' }
    ];

    console.log(`   测试字段: ${testFields.map(f => f.name).join(', ')}\n`);

    const normalizer = new MappingBasedNormalizer();
    const result = await normalizer.normalizeFields(testFields, schema, { useLLM: false });

    console.log(`   映射结果:`);
    console.log(`   - 映射成功: ${result.mappedCount}个`);
    console.log(`   - 未映射: ${result.unmappedFields.length}个`);
    console.log(`   - 完整度: ${(result.completeness * 100).toFixed(1)}%`);
    console.log(`   - 加权完整度: ${(result.weightedCompleteness * 100).toFixed(1)}%`);
    console.log('');

    if (result.normalizedFields.length > 0) {
      console.log(`   映射详情:`);
      result.normalizedFields.forEach((nf, i) => {
        console.log(`   ${i + 1}. ${nf.originalName} → ${nf.standardName} (方法: ${nf.mappingMethod})`);
      });
    }
    console.log('');

    if (result.unmappedFields.length > 0) {
      console.log(`   未映射字段:`);
      result.unmappedFields.forEach((uf, i) => {
        console.log(`   ${i + 1}. ${uf.name}`);
      });
      console.log('');
    }

    // 5. 检查核心字段是否被映射
    console.log('5. 检查核心字段映射情况:');
    const mappedCoreFieldNames = result.normalizedFields.map(nf => nf.standardName);
    
    coreFields.forEach((cf, i) => {
      const isMapped = mappedCoreFieldNames.includes(cf.name);
      const status = isMapped ? '✓' : '✗';
      console.log(`   ${status} ${cf.name} (权重: ${cf.weight})`);
    });
    console.log('');

    // 6. 分析问题
    console.log('================================================================================');
    console.log('🔍 问题分析');
    console.log('================================================================================\n');

    if (result.completeness === 0) {
      console.log('❌ 问题: 完整度为0%，没有任何字段被映射');
      console.log('');
      console.log('可能的原因:');
      console.log('1. 映射表中的字段名与数据库中的核心字段名不匹配');
      console.log('2. 映射算法无法识别提取的字段名');
      console.log('3. Schema对象传递给映射器时缺少必要的属性');
      console.log('');
    } else if (result.completeness < 0.4) {
      console.log('⚠️  问题: 完整度低于40%，无法达到匹配阈值');
      console.log('');
      console.log('建议:');
      console.log('1. 降低匹配阈值');
      console.log('2. 增加更多字段映射');
      console.log('3. 调整核心字段权重');
      console.log('');
    } else {
      console.log('✓ 完整度正常，应该能够被匹配');
      console.log('');
    }

    console.log('✓ 诊断完成\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('\n❌ 诊断失败:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

diagnose();
