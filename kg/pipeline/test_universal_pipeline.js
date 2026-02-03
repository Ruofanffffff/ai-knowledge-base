/**
 * 测试使用Universal Extractor的完整流水线
 */

const fs = require('fs');
const path = require('path');
const { UniversalDocumentPipeline } = require('./universal_document_pipeline');
const UniversalExtractor = require('../field_extractor/universal_extractor');

async function testUniversalPipeline() {
  console.log('='.repeat(80));
  console.log('🚀 测试Universal Extractor + 完整流水线');
  console.log('='.repeat(80));
  console.log();
  
  // 读取摄影测试文档
  const docPath = path.join(__dirname, 'test_photography_params.md');
  const content = fs.readFileSync(docPath, 'utf-8');
  
  console.log('✅ 文档读取成功');
  console.log(`📄 文档长度: ${content.length} 字符`);
  console.log();
  
  // 创建文档对象
  const document = {
    id: 'photography_universal_001',
    type: 'text',
    title: '街拍作品拍摄记录',
    content: content
  };
  
  // 初始化流水线（使用Universal Extractor）
  console.log('🔧 初始化流水线（使用Universal Extractor）...');
  
  // 创建自定义的字段提取函数
  const universalExtractor = new UniversalExtractor();
  const customExtractFields = async (ckb, options) => {
    return await universalExtractor.extractFields(ckb, {
      maxFields: 100,
      minKeywordScore: 0.01,
      includeStructured: true,
      includeKeywords: true
    });
  };
  
  const pipeline = new UniversalDocumentPipeline({
    extraction: {
      useLLM: false,
      useNER: false,
      useRules: false,
      customExtractor: customExtractFields  // 使用自定义提取器
    },
    schemaMatching: {
      useLLM: false,
      minConfidence: 0.3
    },
    normalization: {
      useLLM: false
    },
    entityBuilding: {
      useLLM: false
    },
    relationExtraction: {
      enableSemantic: false
    }
  });
  
  console.log('✅ 流水线初始化完成');
  console.log();
  
  // 处理文档
  console.log('⚙️  开始处理文档...');
  console.log('-'.repeat(80));
  const startTime = Date.now();
  
  const result = await pipeline.processDocument(document);
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('-'.repeat(80));
  console.log(`✅ 文档处理完成 (耗时: ${duration}秒)`);
  console.log();
  
  // 输出结果统计
  console.log('📊 知识图谱生成结果统计');
  console.log('='.repeat(80));
  console.log();
  
  // Schema匹配结果
  console.log('🎯 Schema匹配结果:');
  const matchedSchemas = result.data.matchedSchemas || [];
  console.log(`   匹配到 ${matchedSchemas.length} 个Schema`);
  console.log();
  
  // 按完整度排序
  const sortedSchemas = [...matchedSchemas].sort((a, b) => 
    b.weightedCompleteness - a.weightedCompleteness
  );
  
  // 显示Top 10
  const topSchemas = sortedSchemas.slice(0, 10);
  topSchemas.forEach((schema, index) => {
    const completeness = (schema.weightedCompleteness * 100).toFixed(1);
    const mappedFields = schema.normalizedFields?.length || 0;
    const totalFields = schema.schema.coreFields ? 
      JSON.parse(schema.schema.coreFields).length : 0;
    
    console.log(`   ${index + 1}. ${schema.schema_name} (完整度: ${completeness}%)`);
    console.log(`      映射字段: ${mappedFields}/${totalFields}`);
    
    // 显示映射的字段
    if (schema.normalizedFields && schema.normalizedFields.length > 0) {
      const fieldNames = schema.normalizedFields
        .map(f => `${f.originalName || f.name}`)
        .slice(0, 5)
        .join(', ');
      console.log(`      字段: ${fieldNames}${schema.normalizedFields.length > 5 ? '...' : ''}`);
    }
  });
  console.log();
  
  // 统计摄影相关Schema
  const photographySchemas = sortedSchemas.filter(s => 
    s.schema_name.includes('Shooting') ||
    s.schema_name.includes('ISO') ||
    s.schema_name.includes('Aperture') ||
    s.schema_name.includes('Exposure') ||
    s.schema_name.includes('Camera') ||
    s.schema_name.includes('Lens') ||
    s.schema_name.includes('Focus') ||
    s.schema_name.includes('White-Balance') ||
    s.schema_name.includes('Composition') ||
    s.schema_name.includes('Style') ||
    s.schema_name.includes('Raw') ||
    s.schema_name.includes('Color')
  );
  
  console.log(`📷 摄影相关Schema匹配情况:`);
  console.log(`   共匹配到 ${photographySchemas.length} 个摄影相关Schema`);
  console.log();
  
  if (photographySchemas.length > 0) {
    console.log('   详细列表:');
    photographySchemas.slice(0, 20).forEach((schema, index) => {
      const completeness = (schema.weightedCompleteness * 100).toFixed(1);
      const mappedFields = schema.normalizedFields?.length || 0;
      const totalFields = schema.schema.coreFields ? 
        JSON.parse(schema.schema.coreFields).length : 0;
      
      console.log(`   ${index + 1}. ${schema.schema_name}: ${completeness}% (${mappedFields}/${totalFields})`);
    });
    
    if (photographySchemas.length > 20) {
      console.log(`   ... 还有 ${photographySchemas.length - 20} 个`);
    }
  } else {
    console.log('   ⚠️  没有匹配到摄影相关Schema');
  }
  console.log();
  
  // 实体提取结果
  console.log('🏷️  实体提取结果:');
  const entities = result.data.entities || [];
  console.log(`   提取到 ${entities.length} 个实体`);
  console.log();
  
  // 字段提取结果
  console.log('📝 字段提取结果:');
  const fields = result.data.extractedFields || [];
  console.log(`   提取到 ${fields.length} 个字段`);
  console.log();
  
  // 按提取方法分组
  const fieldsByMethod = {};
  fields.forEach(field => {
    const method = field.extraction_method || 'unknown';
    if (!fieldsByMethod[method]) {
      fieldsByMethod[method] = [];
    }
    fieldsByMethod[method].push(field);
  });
  
  console.log('   按提取方法:');
  for (const [method, methodFields] of Object.entries(fieldsByMethod)) {
    console.log(`     - ${method}: ${methodFields.length} 个`);
  }
  console.log();
  
  // 显示部分结构化字段
  const structuredFields = fields.filter(f => f.extraction_method === 'structured');
  console.log(`   结构化字段 (前20个):`);
  structuredFields.slice(0, 20).forEach((field, index) => {
    const value = field.value.length > 40 ? 
      field.value.substring(0, 40) + '...' : 
      field.value;
    console.log(`     ${index + 1}. ${field.name}: ${value}`);
  });
  
  if (structuredFields.length > 20) {
    console.log(`     ... 还有 ${structuredFields.length - 20} 个`);
  }
  console.log();
  
  // 性能指标
  console.log('⚡ 性能指标:');
  console.log(`   总耗时: ${duration}秒`);
  console.log(`   字段数: ${fields.length}`);
  console.log(`   Schema数: ${matchedSchemas.length}`);
  console.log(`   实体数: ${entities.length}`);
  console.log();
  
  console.log('='.repeat(80));
  console.log('✅ 测试完成!');
  console.log('='.repeat(80));
}

// 运行测试
testUniversalPipeline().catch(error => {
  console.error('❌ 测试失败:', error);
  console.error(error.stack);
  process.exit(1);
});
