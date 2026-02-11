/**
 * 检查PhotographyEntity Schema的锚点字段配置
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPhotographySchema() {
  try {
    console.log('正在查询PhotographyEntity Schema...\n');
    
    const schema = await prisma.schema.findFirst({
      where: {
        OR: [
          { name: 'PhotographyEntity' },
          { entityType: 'PhotographyEntity' }
        ]
      }
    });
    
    if (schema) {
      console.log('✓ 找到PhotographyEntity Schema');
      console.log('=====================================');
      console.log('ID:', schema.id);
      console.log('Name:', schema.name);
      console.log('Entity Type:', schema.entityType);
      console.log('Scene:', schema.scene);
      console.log('\n锚点字段配置:');
      console.log(JSON.stringify(schema.anchorFields, null, 2));
      console.log('\n核心字段配置:');
      console.log(JSON.stringify(schema.coreFields, null, 2));
      console.log('=====================================\n');
      
      // 检查锚点字段是否为空
      if (!schema.anchorFields || schema.anchorFields.length === 0) {
        console.log('⚠️  警告: 锚点字段为空！');
      } else {
        console.log(`✓ 锚点字段数量: ${schema.anchorFields.length}`);
      }
      
      // 检查核心字段
      if (!schema.coreFields || schema.coreFields.length === 0) {
        console.log('⚠️  警告: 核心字段为空！');
      } else {
        console.log(`✓ 核心字段数量: ${schema.coreFields.length}`);
      }
      
    } else {
      console.log('✗ 未找到PhotographyEntity Schema');
    }
    
  } catch (error) {
    console.error('错误:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

checkPhotographySchema();
