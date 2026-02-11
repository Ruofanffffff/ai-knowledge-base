/**
 * 展示摄影课文档处理的详细结果
 */

const { UniversalDocumentPipeline } = require('./universal_document_pipeline');
const fs = require('fs');
const path = require('path');

async function showDetails() {
  console.log('\n=== 摄影课文档处理详细结果 ===\n');
  
  // 读取文档
  const docPath = path.join(__dirname, '..', '..', '摄影课.md');
  const content = fs.readFileSync(docPath, 'utf-8');
  
  const pipeline = new UniversalDocumentPipeline({
    extraction: { useLLM: false, enableUniversal: true },
    normalization: { useLLM: false, enableMapping: true },
    entityBuilding: { useLLM: false, enableAnchor: true },
    relationExtraction: { enableBuiltin: true, enableCooccurrence: true, enableSemantic: false }
  });
  
  const document = {
    id: 'photography-course-details',
    type: 'markdown',
    title: '摄影课',
    content: content
  };
  
  const context = await pipeline.processDocument(document);
  
  // 1. 提取的原始字段
  console.log('📋 步骤1: 字段提取结果');
  console.log('=' .repeat(80));
  if (context.steps.extraction?.result?.fields) {
    const fields = context.steps.extraction.result.fields;
    console.log(`\n提取了 ${Object.keys(fields).length} 个字段:\n`);
    
    Object.entries(fields).forEach(([key, value], index) => {
      const displayValue = Array.isArray(value) ? 
        `[${value.length}项] ${value.slice(0, 2).join(', ')}${value.length > 2 ? '...' : ''}` :
        value;
      console.log(`${index + 1}. ${key}:`);
      console.log(`   ${displayValue}\n`);
    });
  }
  
  // 2. Schema匹配结果
  console.log('\n📊 步骤2: Schema匹配结果');
  console.log('='.repeat(80));
  if (context.steps.schemaMatching?.result?.matchedSchemas) {
    const schemas = context.steps.schemaMatching.result.matchedSchemas;
    console.log(`\n匹配到 ${schemas.length} 个Schema:\n`);
    
    schemas.forEach((match, index) => {
      console.log(`${index + 1}. ${match.schema.name}`);
      console.log(`   置信度: ${(match.confidence * 100).toFixed(1)}%`);
      console.log(`   字段数: ${match.schema.fields?.length || 0}`);
      if (match.schema.fields) {
        console.log(`   字段: ${match.schema.fields.map(f => f.name).join(', ')}`);
      }
      console.log();
    });
  }
  
  // 3. 规范化后的字段
  console.log('\n🔄 步骤3: 字段规范化结果');
  console.log('='.repeat(80));
  if (context.steps.normalization?.result?.normalizedFields) {
    const normalized = context.steps.normalization.result.normalizedFields;
    console.log(`\n规范化了 ${Object.keys(normalized).length} 个Schema的字段:\n`);
    
    Object.entries(normalized).forEach(([schemaName, fields]) => {
      console.log(`Schema: ${schemaName}`);
      console.log(`字段数: ${Object.keys(fields).length}`);
      Object.entries(fields).forEach(([fieldName, value]) => {
        const displayValue = Array.isArray(value) ? 
          `[${value.length}项]` : 
          (typeof value === 'string' && value.length > 50 ? value.substring(0, 50) + '...' : value);
        console.log(`  - ${fieldName}: ${displayValue}`);
      });
      console.log();
    });
  }
  
  // 4. 实体构建结果
  console.log('\n🎯 步骤4: 实体构建结果');
  console.log('='.repeat(80));
  if (context.steps.entityBuilding?.result?.entities && context.steps.entityBuilding.result.entities.length > 0) {
    const entities = context.steps.entityBuilding.result.entities;
    console.log(`\n构建了 ${entities.length} 个实体:\n`);
    
    entities.forEach((entity, index) => {
      console.log(`${index + 1}. ${entity.name || entity.id}`);
      console.log(`   类型: ${entity.type}`);
      console.log(`   属性数: ${Object.keys(entity.properties || {}).length}`);
      if (entity.properties) {
        Object.entries(entity.properties).slice(0, 5).forEach(([key, value]) => {
          const displayValue = typeof value === 'string' && value.length > 50 ? 
            value.substring(0, 50) + '...' : value;
          console.log(`   - ${key}: ${displayValue}`);
        });
      }
      console.log();
    });
  } else {
    console.log('\n⚠️  未能构建实体');
    if (context.steps.entityBuilding?.error) {
      console.log(`错误: ${context.steps.entityBuilding.error}`);
    }
  }
  
  // 5. 关系抽取结果
  console.log('\n🔗 步骤5: 关系抽取结果');
  console.log('='.repeat(80));
  if (context.steps.relationExtraction?.result?.relations && context.steps.relationExtraction.result.relations.length > 0) {
    const relations = context.steps.relationExtraction.result.relations;
    console.log(`\n抽取了 ${relations.length} 个关系:\n`);
    
    relations.forEach((relation, index) => {
      console.log(`${index + 1}. ${relation.type}`);
      console.log(`   来源: ${relation.source}`);
      console.log(`   目标: ${relation.target}`);
      if (relation.confidence) {
        console.log(`   置信度: ${(relation.confidence * 100).toFixed(1)}%`);
      }
      console.log();
    });
  } else {
    console.log('\n⚠️  未能抽取关系（因为没有实体）');
  }
  
  // 6. 处理统计
  console.log('\n📈 处理统计');
  console.log('='.repeat(80));
  console.log(`总耗时: ${context.totalDuration}ms`);
  console.log(`状态: ${context.status}`);
  console.log(`提取字段: ${context.metrics.fieldCount}`);
  console.log(`构建实体: ${context.metrics.entityCount}`);
  console.log(`抽取关系: ${context.metrics.relationCount}`);
  
  if (context.warnings.length > 0) {
    console.log(`\n⚠️  警告 (${context.warnings.length}):`);
    context.warnings.forEach(w => {
      console.log(`  - ${w.step}: ${w.error}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 详细结果展示完成\n');
}

showDetails().catch(console.error);
