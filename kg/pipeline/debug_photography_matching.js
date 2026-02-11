/**
 * 调试摄影文档的Schema匹配
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debugMatching() {
  console.log('🔍 调试摄影文档Schema匹配\n');
  
  // 1. 读取文档
  const docPath = path.join(__dirname, '../../摄影课.md');
  const text = fs.readFileSync(docPath, 'utf8');
  console.log(`📄 文档长度: ${text.length} 字符\n`);
  
  // 2. 提取字段
  const { extractFields } = require('../field_extractor/rule_extractor');
  const fields = extractFields(text);
  console.log(`📊 提取字段数: ${fields.length}`);
  console.log('提取的字段:');
  fields.forEach(f => {
    console.log(`  - ${f.name}: ${f.value} (${f.type}, ${f.confidence})`);
  });
  console.log();
  
  // 3. 获取Lens-Recommendation schema
  const schema = await prisma.schema.findUnique({
    where: { name: 'Lens-Recommendation' }
  });
  
  if (!schema) {
    console.log('❌ 未找到Lens-Recommendation schema');
    return;
  }
  
  console.log('📋 Lens-Recommendation Schema:');
  console.log(`  阈值: ${schema.threshold}`);
  console.log(`  核心字段: ${JSON.parse(schema.coreFields).map(f => f.name).join(', ')}`);
  console.log(`  锚点字段: ${JSON.parse(schema.anchorFields).map(f => f.name).join(', ')}`);
  console.log();
  
  // 4. 读取字段映射
  const mappingPath = path.join(__dirname, '../field_normalizer/schema_field_mappings.json');
  const mappings = JSON.parse(fs.readFileSync(mappingPath, 'utf8'));
  const lensMapping = mappings['Lens-Recommendation'];
  
  console.log('🗺️  Lens-Recommendation 字段映射:');
  Object.entries(lensMapping).forEach(([schemaField, docFields]) => {
    console.log(`  ${schemaField} <- [${docFields.join(', ')}]`);
  });
  console.log();
  
  // 5. 检查匹配
  console.log('🔍 字段匹配检查:');
  const coreFields = JSON.parse(schema.coreFields);
  let matchedCount = 0;
  
  coreFields.forEach(coreField => {
    const possibleNames = lensMapping[coreField.name] || [];
    const matched = fields.filter(f => 
      possibleNames.some(name => 
        name.toLowerCase() === f.name.toLowerCase()
      )
    );
    
    if (matched.length > 0) {
      console.log(`  ✅ ${coreField.name}:`);
      matched.forEach(m => {
        console.log(`     - ${m.name}: ${m.value}`);
      });
      matchedCount++;
    } else {
      console.log(`  ❌ ${coreField.name}: 未匹配`);
      console.log(`     期望字段名: [${possibleNames.join(', ')}]`);
    }
  });
  
  const completeness = matchedCount / coreFields.length;
  console.log(`\n📊 完整度: ${(completeness * 100).toFixed(1)}% (${matchedCount}/${coreFields.length})`);
  console.log(`   阈值: ${(schema.threshold * 100).toFixed(1)}%`);
  console.log(`   ${completeness >= schema.threshold ? '✅ 达到阈值' : '❌ 未达到阈值'}`);
  
  await prisma.$disconnect();
}

debugMatching().catch(console.error);
