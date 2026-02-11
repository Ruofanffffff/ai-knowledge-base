/**
 * 测试Schema对象结构
 * 检查从数据库加载的Schema对象是否有正确的属性
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('================================================================================');
console.log('🔍 测试Schema对象结构');
console.log('================================================================================\n');

async function test() {
  try {
    // 查询PhotographyEntity
    const schema = await prisma.schema.findUnique({
      where: { name: 'PhotographyEntity' }
    });

    if (!schema) {
      console.error('❌ 未找到PhotographyEntity');
      process.exit(1);
    }

    console.log('Schema对象属性:');
    console.log('');

    // 列出所有属性
    for (const key in schema) {
      const value = schema[key];
      const type = typeof value;
      
      if (type === 'string' && value.length > 100) {
        console.log(`  ${key}: ${type} (长度: ${value.length})`);
      } else if (type === 'object' && value !== null) {
        console.log(`  ${key}: ${type} (${JSON.stringify(value).substring(0, 50)}...)`);
      } else {
        console.log(`  ${key}: ${value}`);
      }
    }
    console.log('');

    // 检查关键属性
    console.log('关键属性检查:');
    console.log(`  schema.name: ${schema.name || '(无)'}`);
    console.log(`  schema.schema_name: ${schema.schema_name || '(无)'}`);
    console.log(`  schema.coreFields: ${schema.coreFields ? '存在' : '不存在'}`);
    console.log(`  schema.core_fields: ${schema.core_fields ? '存在' : '不存在'}`);
    console.log('');

    // 测试MappingBasedNormalizer如何获取Schema名称
    console.log('MappingBasedNormalizer获取Schema名称的逻辑:');
    console.log(`  const schemaName = schema.name || schema.schema_name;`);
    console.log(`  结果: ${schema.name || schema.schema_name}`);
    console.log('');

    console.log('✓ 测试完成\n');

    await prisma.$disconnect();

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

test();
