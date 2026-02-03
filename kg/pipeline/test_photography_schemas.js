/**
 * 测试摄影Schema匹配
 * 
 * 使用包含实际摄影参数的文档测试100个摄影Schema
 */

const fs = require('fs');
const path = require('path');
const { UniversalDocumentPipeline } = require('./universal_document_pipeline');

async function testPhotographySchemas() {
  console.log('='.repeat(80));
  console.log('📸 摄影Schema匹配测试');
  console.log('='.repeat(80));
  console.log();
  
  // 读取测试文档
  const docPath = path.join(__dirname, 'test_photography_params.md');
  const content = fs.readFileSync(docPath, 'utf-8');
  
  console.log('✅ 文档读取成功');
  console.log(`📄 文档长度: ${content.length} 字符`);
  console.log();
  
  // 创建文档对象
  const document = {
    id: 'photography_test_001',
    type: 'text',
    title: '街拍作品拍摄记录',
    content: content
  };
  
  // 初始化流水线
  console.log('🔧 初始化通用文档处理流水线...');
  const pipeline = new UniversalDocumentPipeline({
    extraction: {
      useLLM: false,  // 禁用LLM以加快测试
      useNER: true,
      useRules: true
    },
    schemaMatching: {
      useLLM: false,
      minConfidence: 0.3  // 降低阈值以看到更多匹配
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
  console.log(`   匹配到 ${matchedSchemas.length} 个Schema:`);
  
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
        .map(f => f.standardName || f.name)
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
    s.schema_name.includes('后期') ||
    s.schema_name.includes('Raw') ||
    s.schema_name.includes('Color') ||
    s.schema_name.includes('Lightroom')
  );
  
  console.log(`📷 摄影相关Schema匹配情况:`);
  console.log(`   共匹配到 ${photographySchemas.length} 个摄影相关Schema`);
  console.log();
  
  if (photographySchemas.length > 0) {
    console.log('   详细列表:');
    photographySchemas.forEach((schema, index) => {
      const completeness = (schema.weightedCompleteness * 100).toFixed(1);
      const mappedFields = schema.normalizedFields?.length || 0;
      const totalFields = schema.schema.coreFields ? 
        JSON.parse(schema.schema.coreFields).length : 0;
      
      console.log(`   ${index + 1}. ${schema.schema_name}: ${completeness}% (${mappedFields}/${totalFields})`);
    });
  } else {
    console.log('   ⚠️  没有匹配到摄影相关Schema');
  }
  console.log();
  
  // 实体提取结果
  console.log('🏷️  实体提取结果:');
  const entities = result.data.entities || [];
  console.log(`   提取到 ${entities.length} 个实体`);
  console.log();
  
  // 按类型分组
  const entitiesByType = {};
  entities.forEach(entity => {
    const type = entity.entity_type || 'Unknown';
    if (!entitiesByType[type]) {
      entitiesByType[type] = [];
    }
    entitiesByType[type].push(entity);
  });
  
  for (const [type, typeEntities] of Object.entries(entitiesByType)) {
    console.log(`   📌 ${type} (${typeEntities.length}个):`);
    typeEntities.slice(0, 3).forEach(entity => {
      const name = entity.entity_name || entity.entity_id;
      const confidence = ((entity.confidence || 0) * 100).toFixed(1);
      console.log(`      - ${name} (置信度: ${confidence}%)`);
      
      // 显示部分属性
      if (entity.properties) {
        const props = Object.entries(entity.properties)
          .slice(0, 3)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        console.log(`        属性: ${props}...`);
      }
    });
    if (typeEntities.length > 3) {
      console.log(`      ... 还有 ${typeEntities.length - 3} 个`);
    }
  }
  console.log();
  
  // 字段提取结果
  console.log('📝 字段提取结果:');
  const fields = result.data.extractedFields || [];
  console.log(`   提取到 ${fields.length} 个字段`);
  console.log();
  
  // 按类型分组
  const fieldsByType = {};
  fields.forEach(field => {
    const type = field.type || 'unknown';
    if (!fieldsByType[type]) {
      fieldsByType[type] = [];
    }
    fieldsByType[type].push(field);
  });
  
  for (const [type, typeFields] of Object.entries(fieldsByType)) {
    console.log(`   📝 ${type} (${typeFields.length}个):`);
    typeFields.slice(0, 5).forEach(field => {
      const value = field.value ? String(field.value).substring(0, 50) : '';
      console.log(`      - ${field.name}: ${value}${value.length >= 50 ? '...' : ''}`);
    });
    if (typeFields.length > 5) {
      console.log(`      ... 还有 ${typeFields.length - 5} 个`);
    }
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
testPhotographySchemas().catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});
