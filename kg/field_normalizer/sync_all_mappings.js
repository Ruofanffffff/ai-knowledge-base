/**
 * 同步所有字段映射到完整映射表
 * 
 * 将 schema_field_mappings.json (371个Schema) 的内容
 * 完全同步到 schema_field_mappings_full.json
 */

const fs = require('fs').promises;
const path = require('path');

async function syncAllMappings() {
  console.log('开始同步字段映射...\n');

  // 1. 读取源映射表（371个Schema）
  const sourcePath = path.join(__dirname, 'schema_field_mappings.json');
  const sourceContent = await fs.readFile(sourcePath, 'utf-8');
  const sourceMappings = JSON.parse(sourceContent);
  
  console.log(`✓ 读取源映射表: ${Object.keys(sourceMappings).length} 个Schema`);

  // 2. 读取目标映射表（251个Schema）
  const targetPath = path.join(__dirname, 'schema_field_mappings_full.json');
  const targetContent = await fs.readFile(targetPath, 'utf-8');
  const targetMappings = JSON.parse(targetContent);
  
  console.log(`✓ 读取目标映射表: ${Object.keys(targetMappings).length} 个Schema`);

  // 3. 备份目标映射表
  const backupPath = path.join(__dirname, `schema_field_mappings_full.backup.${Date.now()}.json`);
  await fs.writeFile(backupPath, targetContent, 'utf-8');
  console.log(`✓ 备份目标映射表: ${backupPath}\n`);

  // 4. 找出差异
  const sourceSchemas = new Set(Object.keys(sourceMappings));
  const targetSchemas = new Set(Object.keys(targetMappings));
  
  const missingInTarget = [...sourceSchemas].filter(s => !targetSchemas.has(s));
  const onlyInTarget = [...targetSchemas].filter(s => !sourceSchemas.has(s));
  
  console.log('差异分析:');
  console.log(`  - 源映射表独有: ${missingInTarget.length} 个Schema`);
  console.log(`  - 目标映射表独有: ${onlyInTarget.length} 个Schema`);
  console.log(`  - 共同拥有: ${[...sourceSchemas].filter(s => targetSchemas.has(s)).length} 个Schema\n`);

  if (missingInTarget.length > 0) {
    console.log('源映射表独有的Schema（前20个）:');
    missingInTarget.slice(0, 20).forEach(s => console.log(`  - ${s}`));
    if (missingInTarget.length > 20) {
      console.log(`  ... 还有 ${missingInTarget.length - 20} 个\n`);
    } else {
      console.log('');
    }
  }

  if (onlyInTarget.length > 0) {
    console.log('目标映射表独有的Schema:');
    onlyInTarget.forEach(s => console.log(`  - ${s}`));
    console.log('');
  }

  // 5. 完全同步：用源映射表覆盖目标映射表
  console.log('执行完全同步...');
  await fs.writeFile(
    targetPath,
    JSON.stringify(sourceMappings, null, 2),
    'utf-8'
  );
  
  console.log(`✓ 同步完成！`);
  console.log(`  - 目标映射表现在包含: ${Object.keys(sourceMappings).length} 个Schema`);
  console.log(`  - 增加了: ${missingInTarget.length} 个Schema`);
  console.log(`  - 移除了: ${onlyInTarget.length} 个Schema\n`);

  // 6. 验证同步结果
  const verifyContent = await fs.readFile(targetPath, 'utf-8');
  const verifyMappings = JSON.parse(verifyContent);
  
  console.log('验证同步结果:');
  console.log(`  ✓ 目标映射表Schema数量: ${Object.keys(verifyMappings).length}`);
  console.log(`  ✓ 与源映射表一致: ${Object.keys(verifyMappings).length === Object.keys(sourceMappings).length ? '是' : '否'}`);
  
  // 验证PhotographyEntity是否存在
  if (verifyMappings['PhotographyEntity']) {
    console.log(`  ✓ PhotographyEntity存在，包含 ${Object.keys(verifyMappings['PhotographyEntity']).length} 个字段`);
  } else {
    console.log(`  ✗ PhotographyEntity不存在`);
  }

  console.log('\n同步完成！');
}

// 运行同步
syncAllMappings().catch(console.error);
