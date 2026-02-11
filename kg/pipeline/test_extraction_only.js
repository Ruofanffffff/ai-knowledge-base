/**
 * 仅测试字段提取步骤
 */

const { extractFields } = require('../field_extractor/field_extractor');
const { createCKB } = require('../ckb/ckb_factory');
const fs = require('fs');
const path = require('path');

async function testExtraction() {
  console.log('\n=== 摄影课文档 - 字段提取测试 ===\n');
  
  // 读取文档
  const docPath = path.join(__dirname, '..', '..', '摄影课.md');
  const content = fs.readFileSync(docPath, 'utf-8');
  
  console.log(`文档大小: ${content.length} 字符\n`);
  console.log('文档内容预览:');
  console.log(content.substring(0, 200) + '...\n');
  console.log('='.repeat(80));
  
  // 创建CKB
  const ckb = createCKB({
    docId: 'test-photography',
    sourceType: 'markdown',
    text: content,
    sourceMeta: {
      title: '摄影课',
      filename: '摄影课.md'
    }
  });
  
  // 提取字段
  console.log('\n开始提取字段...\n');
  const result = await extractFields(ckb, {
    useLLM: false,
    useUniversal: true
  });
  
  console.log('='.repeat(80));
  console.log(`\n✅ 提取完成！共提取 ${Object.keys(result).length} 个字段\n`);
  console.log('='.repeat(80));
  
  // 显示所有字段
  console.log('\n📋 提取的字段列表:\n');
  Object.entries(result).forEach(([key, value], index) => {
    console.log(`${index + 1}. ${key}:`);
    
    if (Array.isArray(value)) {
      console.log(`   类型: 数组 (${value.length} 项)`);
      value.forEach((item, i) => {
        const displayItem = typeof item === 'string' && item.length > 60 ? 
          item.substring(0, 60) + '...' : item;
        console.log(`   [${i}] ${displayItem}`);
      });
    } else if (typeof value === 'object') {
      console.log(`   类型: 对象`);
      console.log(`   ${JSON.stringify(value, null, 2)}`);
    } else {
      const displayValue = typeof value === 'string' && value.length > 100 ? 
        value.substring(0, 100) + '...' : value;
      console.log(`   ${displayValue}`);
    }
    console.log();
  });
  
  // 统计信息
  console.log('='.repeat(80));
  console.log('\n📊 统计信息:\n');
  console.log(`总字段数: ${Object.keys(result).length}`);
  
  const arrayFields = Object.entries(result).filter(([k, v]) => Array.isArray(v));
  console.log(`数组字段: ${arrayFields.length}`);
  
  const stringFields = Object.entries(result).filter(([k, v]) => typeof v === 'string');
  console.log(`字符串字段: ${stringFields.length}`);
  
  const objectFields = Object.entries(result).filter(([k, v]) => typeof v === 'object' && !Array.isArray(v));
  console.log(`对象字段: ${objectFields.length}`);
  
  console.log(`\n提取策略: ${result.strategy || '未知'}`);
  console.log(`使用LLM: ${result.usedLLM ? '是' : '否'}`);
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 测试完成\n');
}

testExtraction().catch(console.error);
