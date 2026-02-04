/**
 * 测试使用摄影课.md文档的完整流水线 - 启用LLM校准
 * 
 * 对比测试：
 * 1. 纯本地处理（Universal Extractor + 映射表）
 * 2. LLM增强处理（在关键环节使用LLM校准）
 */

const fs = require('fs');
const path = require('path');
const { UniversalDocumentPipeline } = require('./universal_document_pipeline');
const UniversalExtractor = require('../field_extractor/universal_extractor');

async function testWithLLM() {
  console.log('='.repeat(80));
  console.log('🚀 测试摄影课文档 - LLM增强版本');
  console.log('='.repeat(80));
  console.log();
  
  // 读取摄影课文档
  const docPath = path.join(__dirname, '../../摄影课.md');
  const content = fs.readFileSync(docPath, 'utf-8');
  
  console.log('✅ 文档读取成功');
  console.log(`📄 文档长度: ${content.length} 字符`);
  console.log();
  
  // 创建文档对象
  const document = {
    id: 'photography_course_llm_001',
    type: 'text',
    title: '摄影课 - 人物肖像拍摄技巧',
    content: content
  };
  
  // 初始化流水线（启用LLM增强）
  console.log('🔧 初始化流水线（启用LLM增强）...');
  
  // 创建自定义的字段提取函数（仍使用Universal Extractor，但后续步骤会用LLM校准）
  const universalExtractor = new UniversalExtractor();
  const customExtractFields = async (ckb, options) => {
    return await universalExtractor.extractFields(ckb, {
      maxFields: 150,
      minKeywordScore: 0.01,
      includeStructured: true,
      includeKeywords: true
    });
  };
  
  const pipeline = new UniversalDocumentPipeline({
    extraction: {
      useLLM: false,  // 字段提取仍用Universal Extractor（已经很好）
      useNER: false,
      useRules: false,
      customExtractor: customExtractFields
    },
    schemaMatching: {
      useLLM: false,  // Schema匹配用映射表（已经很准确）
      minConfidence: 0.3
    },
    normalization: {
      useLLM: true,   // ✅ 启用LLM进行字段归一化校准
      useAlgorithm: true,
      minConfidence: 0.6
    },
    entityBuilding: {
      useLLM: true,   // ✅ 启用LLM进行实体名称标准化
      llmProbability: 0.5  // 50%概率使用LLM增强
    },
    relationExtraction: {
      enableBuiltin: true,
      enableCooccurrence: true,
      enableSemantic: true,  // ✅ 启用语义关系提取
      semanticUseLLM: true
    }
  });
  
  console.log('✅ 流水线初始化完成（LLM增强模式）');
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
  console.log('📊 知识图谱生成结果统计（LLM增强版）');
  console.log('='.repeat(80));
  console.log();
  
  // 字段提取结果
  console.log('📝 字段提取结果:');
  const fields = result.data.extractedFields || [];
  console.log(`   提取到 ${fields.length} 个字段`);
  console.log();
  
  // Schema匹配结果
  console.log('🎯 Schema匹配结果:');
  const matchedSchemas = result.data.matchedSchemas || [];
  console.log(`   匹配到 ${matchedSchemas.length} 个Schema`);
  
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
    s.schema_name.includes('Portrait') ||
    s.schema_name.includes('Shutter')
  );
  
  console.log(`📷 摄影相关Schema匹配情况:`);
  console.log(`   共匹配到 ${photographySchemas.length} 个摄影相关Schema`);
  console.log();
  
  // 实体提取结果
  console.log('🏷️  实体提取结果:');
  const entities = result.data.entities || [];
  console.log(`   提取到 ${entities.length} 个实体`);
  console.log();
  
  if (entities.length > 0) {
    console.log('   实体列表（显示LLM增强效果）:');
    entities.slice(0, 10).forEach((entity, index) => {
      const llmEnhanced = entity.llm_enriched ? '✨ LLM增强' : '📋 规则生成';
      console.log(`   ${index + 1}. ${entity.schema_name} (${entity.entity_id})`);
      console.log(`      名称: ${entity.canonical_name} ${llmEnhanced}`);
      console.log(`      字段数: ${Object.keys(entity.fields || {}).length}`);
      console.log(`      置信度: ${(entity.confidence * 100).toFixed(1)}%`);
      
      // 显示部分字段
      const fieldEntries = Object.entries(entity.fields || {}).slice(0, 3);
      if (fieldEntries.length > 0) {
        console.log(`      字段: ${fieldEntries.map(([k, v]) => `${k}=${v}`).join(', ')}`);
      }
      console.log();
    });
  }
  
  // 关系提取结果
  console.log('🔗 关系提取结果:');
  const relations = result.data.relations || [];
  console.log(`   提取到 ${relations.length} 个关系`);
  
  // 按类型分组
  const relationsByType = {};
  relations.forEach(r => {
    const type = r.type || 'unknown';
    if (!relationsByType[type]) {
      relationsByType[type] = [];
    }
    relationsByType[type].push(r);
  });
  
  console.log('   按类型:');
  for (const [type, typeRelations] of Object.entries(relationsByType)) {
    console.log(`     - ${type}: ${typeRelations.length} 个`);
  }
  console.log();
  
  // 性能指标
  console.log('⚡ 性能指标:');
  console.log(`   总耗时: ${duration}秒`);
  console.log(`   字段数: ${fields.length}`);
  console.log(`   Schema数: ${matchedSchemas.length}`);
  console.log(`   实体数: ${entities.length}`);
  console.log(`   关系数: ${relations.length}`);
  console.log(`   Token消耗: ${result.metrics.tokenUsage || 0}`);
  console.log(`   API调用: ${result.metrics.apiCalls || 0}`);
  console.log();
  
  // LLM使用统计
  console.log('🤖 LLM使用统计:');
  const steps = result.steps || {};
  let totalLLMCalls = 0;
  let totalTokens = 0;
  
  for (const [stepName, stepData] of Object.entries(steps)) {
    if (stepData.metrics && (stepData.metrics.apiCalls > 0 || stepData.metrics.tokenUsage > 0)) {
      console.log(`   ${stepName}:`);
      console.log(`     - API调用: ${stepData.metrics.apiCalls || 0}`);
      console.log(`     - Token消耗: ${stepData.metrics.tokenUsage || 0}`);
      totalLLMCalls += stepData.metrics.apiCalls || 0;
      totalTokens += stepData.metrics.tokenUsage || 0;
    }
  }
  
  console.log(`   总计:`);
  console.log(`     - API调用: ${totalLLMCalls}`);
  console.log(`     - Token消耗: ${totalTokens}`);
  console.log();
  
  // 提取统计
  const stats = universalExtractor.getStats(fields);
  console.log('📈 提取统计:');
  console.log(`   平均置信度: ${(stats.avgConfidence * 100).toFixed(1)}%`);
  console.log();
  
  console.log('='.repeat(80));
  console.log('✅ LLM增强测试完成!');
  console.log('='.repeat(80));
  
  return result;
}

// 运行测试
testWithLLM().catch(error => {
  console.error('❌ 测试失败:', error);
  console.error(error.stack);
  process.exit(1);
});
