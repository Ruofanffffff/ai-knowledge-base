/**
 * 同步PhotographyEntity到完整映射表
 * 将schema_field_mappings.json中的PhotographyEntity复制到schema_field_mappings_full.json
 */

const fs = require('fs');
const path = require('path');

console.log('================================================================================');
console.log('🔧 同步PhotographyEntity到完整映射表');
console.log('================================================================================\n');

async function sync() {
  try {
    // 读取两个映射文件
    const mainMappingPath = path.join(__dirname, 'schema_field_mappings.json');
    const fullMappingPath = path.join(__dirname, 'schema_field_mappings_full.json');

    const mainMappings = JSON.parse(fs.readFileSync(mainMappingPath, 'utf-8'));
    const fullMappings = JSON.parse(fs.readFileSync(fullMappingPath, 'utf-8'));

    console.log(`✓ 已读取映射文件`);
    console.log(`  - schema_field_mappings.json: ${Object.keys(mainMappings).length} 个Schema`);
    console.log(`  - schema_field_mappings_full.json: ${Object.keys(fullMappings).length} 个Schema\n`);

    // 检查PhotographyEntity
    if (!mainMappings.PhotographyEntity) {
      console.error('❌ schema_field_mappings.json中未找到PhotographyEntity');
      process.exit(1);
    }

    console.log('✓ 找到PhotographyEntity\n');

    // 复制PhotographyEntity到完整映射表
    console.log('🔧 复制PhotographyEntity...');
    
    fullMappings.PhotographyEntity = mainMappings.PhotographyEntity;

    console.log('   ✓ 已复制PhotographyEntity\n');

    // 保存完整映射表
    console.log('💾 保存完整映射表...');
    
    fs.writeFileSync(fullMappingPath, JSON.stringify(fullMappings, null, 2), 'utf-8');

    console.log('   ✓ 已保存\n');

    // 验证
    console.log('✓ 验证:');
    const verifyMappings = JSON.parse(fs.readFileSync(fullMappingPath, 'utf-8'));
    console.log(`  - schema_field_mappings_full.json现在有 ${Object.keys(verifyMappings).length} 个Schema`);
    console.log(`  - PhotographyEntity存在: ${!!verifyMappings.PhotographyEntity}`);
    
    if (verifyMappings.PhotographyEntity) {
      const fieldCount = Object.keys(verifyMappings.PhotographyEntity).length;
      console.log(`  - PhotographyEntity有 ${fieldCount} 个字段`);
    }
    console.log('');

    console.log('✓ 同步完成\n');

  } catch (error) {
    console.error('\n❌ 同步失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

sync();
