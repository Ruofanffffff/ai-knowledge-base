/**
 * 测试Universal Extractor在摄影文档上的效果
 */

const fs = require('fs');
const path = require('path');
const UniversalExtractor = require('./universal_extractor');

async function testUniversalExtractor() {
  console.log('='.repeat(80));
  console.log('📸 测试Universal Extractor - 摄影文档');
  console.log('='.repeat(80));
  console.log();
  
  // 读取摄影测试文档
  const docPath = path.join(__dirname, '../pipeline/test_photography_params.md');
  const content = fs.readFileSync(docPath, 'utf-8');
  
  console.log('✅ 文档读取成功');
  console.log(`📄 文档长度: ${content.length} 字符`);
  console.log();
  
  // 创建CKB对象
  const ckb = {
    ckb_id: 'test_photography_001',
    doc_id: 'doc_photography_001',
    content: {
      text: content,
      title: '街拍作品拍摄记录'
    }
  };
  
  // 创建提取器
  const extractor = new UniversalExtractor();
  
  console.log('🔧 开始提取字段...');
  console.log();
  
  // 提取字段
  const startTime = Date.now();
  const fields = await extractor.extractFields(ckb, {
    maxFields: 100,
    minKeywordScore: 0.01,
    includeStructured: true,
    includeKeywords: true
  });
  const duration = Date.now() - startTime;
  
  console.log(`✅ 字段提取完成 (耗时: ${duration}ms)`);
  console.log(`📊 提取到 ${fields.length} 个字段`);
  console.log();
  
  // 获取统计信息
  const stats = extractor.getStats(fields);
  
  console.log('📈 提取统计:');
  console.log(`   总字段数: ${stats.total}`);
  console.log(`   平均置信度: ${(stats.avgConfidence * 100).toFixed(1)}%`);
  console.log();
  
  console.log('   按提取方法:');
  for (const [method, count] of Object.entries(stats.byMethod)) {
    console.log(`     - ${method}: ${count} 个`);
  }
  console.log();
  
  console.log('   按类型:');
  for (const [type, count] of Object.entries(stats.byType)) {
    console.log(`     - ${type}: ${count} 个`);
  }
  console.log();
  
  // 显示摄影相关字段
  console.log('📷 摄影相关字段 (Top 30):');
  console.log('-'.repeat(80));
  
  const photographyKeywords = [
    '相机', '镜头', 'ISO', '光圈', '快门', '曝光', '对焦', '白平衡', '测光',
    '防抖', '格式', '风格', '构图', '拍摄', '后期', '软件', '调整', '色彩',
    'Camera', 'Lens', 'Aperture', 'Shutter', 'Exposure', 'Focus'
  ];
  
  const photographyFields = fields.filter(f => 
    photographyKeywords.some(keyword => 
      f.name.includes(keyword) || keyword.includes(f.name)
    )
  );
  
  console.log(`找到 ${photographyFields.length} 个摄影相关字段:`);
  console.log();
  
  photographyFields.slice(0, 30).forEach((field, index) => {
    const value = field.value.length > 50 ? 
      field.value.substring(0, 50) + '...' : 
      field.value;
    const confidence = (field.confidence * 100).toFixed(0);
    
    console.log(`${index + 1}. ${field.name}: ${value}`);
    console.log(`   类型: ${field.type}, 置信度: ${confidence}%, 方法: ${field.extraction_method}`);
  });
  
  if (photographyFields.length > 30) {
    console.log(`   ... 还有 ${photographyFields.length - 30} 个`);
  }
  console.log();
  
  // 显示所有结构化字段
  console.log('📋 所有结构化字段:');
  console.log('-'.repeat(80));
  
  const structuredFields = fields.filter(f => f.extraction_method === 'structured');
  console.log(`找到 ${structuredFields.length} 个结构化字段:`);
  console.log();
  
  structuredFields.forEach((field, index) => {
    const value = field.value.length > 60 ? 
      field.value.substring(0, 60) + '...' : 
      field.value;
    
    console.log(`${index + 1}. ${field.name}: ${value}`);
  });
  console.log();
  
  // 检查关键摄影参数是否被提取
  console.log('✅ 关键摄影参数检查:');
  console.log('-'.repeat(80));
  
  const keyParams = [
    { name: '相机', expected: 'Sony A7M4' },
    { name: '镜头', expected: '35mm f1.8' },
    { name: 'ISO', expected: '3200' },
    { name: '光圈', expected: 'f1.8' },
    { name: '快门速度', expected: '1/15s' },
    { name: '软件', expected: 'Lightroom' }
  ];
  
  for (const param of keyParams) {
    const found = fields.find(f => f.name === param.name);
    if (found) {
      const match = found.value.includes(param.expected) ? '✓' : '✗';
      console.log(`${match} ${param.name}: ${found.value}`);
    } else {
      console.log(`✗ ${param.name}: 未找到`);
    }
  }
  console.log();
  
  console.log('='.repeat(80));
  console.log('✅ 测试完成!');
  console.log('='.repeat(80));
  
  return {
    fields,
    stats,
    photographyFields,
    structuredFields
  };
}

// 运行测试
testUniversalExtractor().catch(error => {
  console.error('❌ 测试失败:', error);
  console.error(error.stack);
  process.exit(1);
});
