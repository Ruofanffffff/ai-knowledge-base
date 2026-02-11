/**
 * 更新PhotographyEntity的锚点字段配置
 * 
 * 当前锚点字段: Camera, Lens, ISO
 * 问题: 这些字段很少被提取到
 * 
 * 新锚点字段: Aperture, Shutter, ISO, FocalLength
 * 原因: 这些字段经常被提取到,是摄影的核心参数
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

console.log('================================================================================');
console.log('🔧 更新PhotographyEntity锚点字段配置');
console.log('================================================================================\n');

async function updateAnchorFields() {
  try {
    // 查找PhotographyEntity
    const schema = await prisma.schema.findFirst({
      where: { name: 'PhotographyEntity' }
    });
    
    if (!schema) {
      console.error('❌ 未找到PhotographyEntity');
      process.exit(1);
    }
    
    console.log(`✓ 找到Schema: ${schema.name}\n`);
    
    // 当前锚点字段
    const currentAnchorFields = schema.anchorFields ? JSON.parse(schema.anchorFields) : [];
    console.log('当前锚点字段:');
    currentAnchorFields.forEach((f, i) => {
      console.log(`  ${i+1}. ${f.name} (优先级: ${f.priority})`);
    });
    
    // 新锚点字段配置
    const newAnchorFields = [
      {
        name: 'Aperture',
        normalization_strategy: 'lowercase',
        priority: 1
      },
      {
        name: 'Shutter',
        normalization_strategy: 'lowercase',
        priority: 2
      },
      {
        name: 'ISO',
        normalization_strategy: 'lowercase',
        priority: 3
      },
      {
        name: 'FocalLength',
        normalization_strategy: 'lowercase',
        priority: 4
      }
    ];
    
    console.log('\n新锚点字段:');
    newAnchorFields.forEach((f, i) => {
      console.log(`  ${i+1}. ${f.name} (优先级: ${f.priority})`);
    });
    
    // 更新core_fields,标记锚点字段
    const coreFields = JSON.parse(schema.coreFields);
    const updatedCoreFields = coreFields.map(field => {
      const isAnchor = newAnchorFields.some(af => af.name === field.name);
      return {
        ...field,
        anchor: isAnchor,
        weight: isAnchor ? 0.2 : field.weight
      };
    });
    
    // 添加FocalLength字段(如果不存在)
    if (!updatedCoreFields.some(f => f.name === 'FocalLength')) {
      updatedCoreFields.push({
        name: 'FocalLength',
        type: 'text',
        required: false,
        anchor: true,
        weight: 0.15,
        description: '镜头焦距'
      });
    }
    
    console.log('\n更新后的核心字段:');
    updatedCoreFields.forEach((f, i) => {
      console.log(`  ${i+1}. ${f.name} (anchor: ${f.anchor || false}, weight: ${f.weight})`);
    });
    
    // 更新数据库
    await prisma.schema.update({
      where: { id: schema.id },
      data: {
        anchorFields: JSON.stringify(newAnchorFields),
        coreFields: JSON.stringify(updatedCoreFields)
      }
    });
    
    console.log('\n✓ 已更新数据库\n');
    
    // 验证
    const updated = await prisma.schema.findFirst({
      where: { name: 'PhotographyEntity' }
    });
    
    console.log('================================================================================');
    console.log('📊 验证结果');
    console.log('================================================================================\n');
    
    const verifyAnchorFields = JSON.parse(updated.anchorFields);
    const verifyCoreFields = JSON.parse(updated.coreFields);
    
    console.log('锚点字段配置:');
    verifyAnchorFields.forEach((f, i) => {
      console.log(`  ${i+1}. ${f.name} (优先级: ${f.priority})`);
    });
    
    console.log('\n核心字段中的锚点字段:');
    verifyCoreFields.filter(f => f.anchor).forEach((f, i) => {
      console.log(`  ${i+1}. ${f.name} (权重: ${f.weight})`);
    });
    
    console.log('\n✓ 更新完成\n');
    
  } catch (error) {
    console.error('\n❌ 更新失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateAnchorFields();
