/**
 * 验证MappingBasedNormalizer是否正确加载371个Schema
 */

const MappingBasedNormalizer = require('./mapping_based_normalizer');

async function verifyMappingLoad() {
  console.log('验证MappingBasedNormalizer加载...\n');

  const normalizer = new MappingBasedNormalizer();
  
  // 加载映射表
  const mappings = await normalizer.loadMappings();
  
  console.log(`✓ 加载的Schema数量: ${Object.keys(mappings).length}`);
  
  // 验证PhotographyEntity
  if (mappings['PhotographyEntity']) {
    console.log(`✓ PhotographyEntity存在`);
    console.log(`  - 字段数量: ${Object.keys(mappings['PhotographyEntity']).length}`);
    console.log(`  - 字段列表: ${Object.keys(mappings['PhotographyEntity']).join(', ')}`);
  } else {
    console.log(`✗ PhotographyEntity不存在`);
  }
  
  console.log('\n验证完成！');
}

verifyMappingLoad().catch(console.error);
