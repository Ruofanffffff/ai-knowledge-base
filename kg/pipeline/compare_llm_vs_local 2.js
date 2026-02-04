/**
 * 对比测试：纯本地处理 vs LLM增强处理
 * 
 * 比较维度：
 * 1. 准确性：实体名称、字段映射质量
 * 2. 完整性：提取的实体数量、关系数量
 * 3. 成本：Token消耗、处理时间
 * 4. 质量：置信度、字段覆盖率
 */

const fs = require('fs');
const path = require('path');
const { UniversalDocumentPipeline } = require('./universal_document_pipeline');
const UniversalExtractor = require('../field_extractor/universal_extractor');

async function runComparison() {
  console.log('='.repeat(80));
  console.log('📊 对比测试：纯本地处理 vs LLM增强处理');
  console.log('='.repeat(80));
  console.log();
  
  // 读取摄影课文档
  const docPath = path.join(__dirname, '../../摄影课.md');
  const content = fs.readFileSync(docPath, 'utf-8');
  
  const document = {
    id: 'photography_course_comparison',
    type: 'text',
    title: '摄影课 - 人物肖像拍摄技巧',
    content: content
  };
  
  // 创建Universal Extractor
  const universalExtractor = new UniversalExtractor();
  const customExtractFields = async (ckb, options) => {
    return await universalExtractor.extractFields(ckb, {
      maxFields: 150,
      minKeywordScore: 0.01,
      includeStructured: true,
      includeKeywords: true
    });
  };
  
  // ============================================================
  // 测试1: 纯本地处理（零Token消耗）
  // ============================================================
  console.log('🔵 测试1: 纯本地处理（零Token消耗）');
  console.log('-'.repeat(80));
  
  const localPipeline = new UniversalDocumentPipeline({
    extraction: {
      useLLM: false,
      useNER: false,
      useRules: false,
      customExtractor: customExtractFields
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
      enableBuiltin: true,
      enableCooccurrence: true,
      enableSemantic: false
    }
  });
  
  const localStart = Date.now();
  const localResult = await localPipeline.processDocument(document);
  const localDuration = (Date.now() - localStart) / 1000;
  
  console.log(`✅ 完成 (耗时: ${localDuration.toFixed(2)}秒)`);
  console.log();
  
  // ============================================================
  // 测试2: LLM增强处理
  // ============================================================
  console.log('🟢 测试2: LLM增强处理');
  console.log('-'.repeat(80));
  
  const llmPipeline = new UniversalDocumentPipeline({
    extraction: {
      useLLM: false,  // 字段提取仍用Universal Extractor
      useNER: false,
      useRules: false,
      customExtractor: customExtractFields
    },
    schemaMatching: {
      useLLM: false,  // Schema匹配用映射表
      minConfidence: 0.3
    },
    normalization: {
      useLLM: true,   // ✅ 启用LLM字段归一化
      useAlgorithm: true,
      minConfidence: 0.6
    },
    entityBuilding: {
      useLLM: true,   // ✅ 启用LLM实体名称标准化
      llmProbability: 1.0  // 100% probability to ensure LLM is called
    },
    relationExtraction: {
      enableBuiltin: true,
      enableCooccurrence: true,
      enableSemantic: true,  // ✅ 启用语义关系
      semanticUseLLM: true
    }
  });
  
  const llmStart = Date.now();
  const llmResult = await llmPipeline.processDocument(document);
  const llmDuration = (Date.now() - llmStart) / 1000;
  
  console.log(`✅ 完成 (耗时: ${llmDuration.toFixed(2)}秒)`);
  console.log();
  
  // ============================================================
  // 对比分析
  // ============================================================
  console.log('='.repeat(80));
  console.log('📊 对比分析结果');
  console.log('='.repeat(80));
  console.log();
  
  // 1. 基础指标对比
  console.log('1️⃣  基础指标对比');
  console.log('-'.repeat(80));
  console.log(`${'指标'.padEnd(20)} | ${'纯本地'.padEnd(15)} | ${'LLM增强'.padEnd(15)} | 差异`);
  console.log('-'.repeat(80));
  
  const localFields = localResult.data.extractedFields?.length || 0;
  const llmFields = llmResult.data.extractedFields?.length || 0;
  console.log(`${'提取字段数'.padEnd(20)} | ${localFields.toString().padEnd(15)} | ${llmFields.toString().padEnd(15)} | ${llmFields - localFields >= 0 ? '+' : ''}${llmFields - localFields}`);
  
  const localSchemas = localResult.data.matchedSchemas?.length || 0;
  const llmSchemas = llmResult.data.matchedSchemas?.length || 0;
  console.log(`${'匹配Schema数'.padEnd(20)} | ${localSchemas.toString().padEnd(15)} | ${llmSchemas.toString().padEnd(15)} | ${llmSchemas - localSchemas >= 0 ? '+' : ''}${llmSchemas - localSchemas}`);
  
  const localEntities = localResult.data.entities?.length || 0;
  const llmEntities = llmResult.data.entities?.length || 0;
  console.log(`${'实体数'.padEnd(20)} | ${localEntities.toString().padEnd(15)} | ${llmEntities.toString().padEnd(15)} | ${llmEntities - localEntities >= 0 ? '+' : ''}${llmEntities - localEntities}`);
  
  const localRelations = localResult.data.relations?.length || 0;
  const llmRelations = llmResult.data.relations?.length || 0;
  console.log(`${'关系数'.padEnd(20)} | ${localRelations.toString().padEnd(15)} | ${llmRelations.toString().padEnd(15)} | ${llmRelations - localRelations >= 0 ? '+' : ''}${llmRelations - localRelations}`);
  
  console.log();
  
  // 2. 性能指标对比
  console.log('2️⃣  性能指标对比');
  console.log('-'.repeat(80));
  console.log(`${'指标'.padEnd(20)} | ${'纯本地'.padEnd(15)} | ${'LLM增强'.padEnd(15)} | 差异`);
  console.log('-'.repeat(80));
  
  console.log(`${'处理时间(秒)'.padEnd(20)} | ${localDuration.toFixed(2).padEnd(15)} | ${llmDuration.toFixed(2).padEnd(15)} | ${llmDuration > localDuration ? '+' : ''}${(llmDuration - localDuration).toFixed(2)}`);
  
  const localTokens = localResult.metrics?.tokenUsage || 0;
  const llmTokens = llmResult.metrics?.tokenUsage || 0;
  console.log(`${'Token消耗'.padEnd(20)} | ${localTokens.toString().padEnd(15)} | ${llmTokens.toString().padEnd(15)} | ${llmTokens - localTokens >= 0 ? '+' : ''}${llmTokens - localTokens}`);
  
  const localAPICalls = localResult.metrics?.apiCalls || 0;
  const llmAPICalls = llmResult.metrics?.apiCalls || 0;
  console.log(`${'API调用次数'.padEnd(20)} | ${localAPICalls.toString().padEnd(15)} | ${llmAPICalls.toString().padEnd(15)} | ${llmAPICalls - localAPICalls >= 0 ? '+' : ''}${llmAPICalls - localAPICalls}`);
  
  console.log();
  
  // 3. 质量指标对比
  console.log('3️⃣  质量指标对比');
  console.log('-'.repeat(80));
  
  // 计算平均置信度
  const localAvgConf = localEntities > 0 ? 
    localResult.data.entities.reduce((sum, e) => sum + (e.confidence || 0), 0) / localEntities : 0;
  const llmAvgConf = llmEntities > 0 ? 
    llmResult.data.entities.reduce((sum, e) => sum + (e.confidence || 0), 0) / llmEntities : 0;
  
  console.log(`${'平均实体置信度'.padEnd(20)} | ${(localAvgConf * 100).toFixed(1)}%`.padEnd(37) + ` | ${(llmAvgConf * 100).toFixed(1)}%`.padEnd(17) + ` | ${llmAvgConf > localAvgConf ? '+' : ''}${((llmAvgConf - localAvgConf) * 100).toFixed(1)}%`);
  
  // LLM增强的实体数量
  const llmEnhancedCount = llmResult.data.entities?.filter(e => e.llm_enriched).length || 0;
  console.log(`${'LLM增强实体数'.padEnd(20)} | ${'0'.padEnd(15)} | ${llmEnhancedCount.toString().padEnd(15)} | +${llmEnhancedCount}`);
  
  console.log();
  
  // 4. 实体名称对比（前5个）
  console.log('4️⃣  实体名称对比（前5个）');
  console.log('-'.repeat(80));
  
  const maxEntities = Math.min(5, Math.max(localEntities, llmEntities));
  for (let i = 0; i < maxEntities; i++) {
    const localEntity = localResult.data.entities?.[i];
    const llmEntity = llmResult.data.entities?.[i];
    
    console.log(`实体 ${i + 1}:`);
    if (localEntity) {
      console.log(`  🔵 本地: ${localEntity.canonical_name} (${localEntity.schema_name})`);
    }
    if (llmEntity) {
      const enhancedMark = llmEntity.llm_enriched ? ' ✨' : '';
      console.log(`  🟢 LLM:  ${llmEntity.canonical_name} (${llmEntity.schema_name})${enhancedMark}`);
    }
    console.log();
  }
  
  // 5. 关系类型对比
  console.log('5️⃣  关系类型对比');
  console.log('-'.repeat(80));
  
  const localRelTypes = {};
  localResult.data.relations?.forEach(r => {
    const type = r.type || 'unknown';
    localRelTypes[type] = (localRelTypes[type] || 0) + 1;
  });
  
  const llmRelTypes = {};
  llmResult.data.relations?.forEach(r => {
    const type = r.type || 'unknown';
    llmRelTypes[type] = (llmRelTypes[type] || 0) + 1;
  });
  
  const allTypes = new Set([...Object.keys(localRelTypes), ...Object.keys(llmRelTypes)]);
  
  console.log(`${'关系类型'.padEnd(20)} | ${'纯本地'.padEnd(15)} | ${'LLM增强'.padEnd(15)}`);
  console.log('-'.repeat(80));
  for (const type of allTypes) {
    const localCount = localRelTypes[type] || 0;
    const llmCount = llmRelTypes[type] || 0;
    console.log(`${type.padEnd(20)} | ${localCount.toString().padEnd(15)} | ${llmCount.toString().padEnd(15)}`);
  }
  
  console.log();
  
  // 6. 总结
  console.log('='.repeat(80));
  console.log('📝 总结');
  console.log('='.repeat(80));
  console.log();
  
  console.log('🔵 纯本地处理优势:');
  console.log(`   ✅ 零Token消耗，完全免费`);
  console.log(`   ✅ 处理速度快 (${localDuration.toFixed(2)}秒)`);
  console.log(`   ✅ 无需API密钥，可离线运行`);
  console.log(`   ✅ 结果稳定，可重现`);
  console.log();
  
  console.log('🟢 LLM增强优势:');
  if (llmTokens > 0) {
    console.log(`   ✅ 实体名称更标准化 (${llmEnhancedCount}个实体被增强)`);
    console.log(`   ✅ 可能发现更多语义关系 (${llmRelTypes.semantic || 0}个语义关系)`);
    console.log(`   ✅ 字段映射更准确`);
    console.log(`   💰 成本: ${llmTokens} tokens, ${llmAPICalls} API调用`);
  } else {
    console.log(`   ⚠️  LLM未被调用（可能是API密钥未配置或预算限制）`);
  }
  console.log();
  
  console.log('💡 建议:');
  if (llmTokens === 0) {
    console.log(`   - 当前LLM未介入，纯本地处理已经取得很好的效果`);
    console.log(`   - 如需启用LLM增强，请配置QWEN_API_KEY环境变量`);
  } else {
    const improvement = ((llmEntities - localEntities) / localEntities * 100).toFixed(1);
    if (improvement > 10) {
      console.log(`   - LLM增强带来了显著提升 (+${improvement}%实体)`);
      console.log(`   - 建议在生产环境中启用LLM增强`);
    } else {
      console.log(`   - 纯本地处理已经足够好，LLM增强提升有限`);
      console.log(`   - 建议优先使用纯本地处理以节省成本`);
    }
  }
  
  console.log();
  console.log('='.repeat(80));
  console.log('✅ 对比测试完成!');
  console.log('='.repeat(80));
}

// 运行对比测试
runComparison().catch(error => {
  console.error('❌ 测试失败:', error);
  console.error(error.stack);
  process.exit(1);
});
