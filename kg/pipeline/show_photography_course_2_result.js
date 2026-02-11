/**
 * 展示摄影课2.md的知识图谱生成结果
 */

const fs = require('fs');
const path = require('path');

function main() {
  const resultPath = path.join(__dirname, 'photography_course_2_result.json');
  const result = JSON.parse(fs.readFileSync(resultPath, 'utf-8'));

  console.log('\n' + '='.repeat(100));
  console.log('📸 摄影课2.md 知识图谱生成结果');
  console.log('='.repeat(100));

  // 1. 处理概览
  console.log('\n📊 处理概览:');
  console.log('─'.repeat(100));
  console.log(`文档ID: ${result.documentId}`);
  console.log(`处理状态: ${result.status}`);
  console.log(`总耗时: ${result.totalDuration}ms (${(result.totalDuration / 1000).toFixed(2)}秒)`);
  console.log(`文档类型: ${result.documentType}`);

  // 2. 提取的字段
  console.log('\n📝 提取的字段 (共 ' + result.data.extractedFields.length + ' 个):');
  console.log('─'.repeat(100));
  
  const fieldGroups = {};
  result.data.extractedFields.forEach(field => {
    if (!fieldGroups[field.name]) {
      fieldGroups[field.name] = [];
    }
    fieldGroups[field.name].push(field.value);
  });

  Object.entries(fieldGroups).forEach(([name, values]) => {
    console.log(`\n${name}:`);
    console.log(`  值: ${values.join(', ')}`);
    console.log(`  数量: ${values.length}`);
  });

  // 3. 匹配的Schema
  console.log('\n\n🎯 匹配的Schema (共 ' + result.data.matchedSchemas.length + ' 个):');
  console.log('─'.repeat(100));
  
  result.data.matchedSchemas.forEach((match, idx) => {
    console.log(`\n[${idx + 1}] ${match.schema_name}`);
    console.log(`    类型: ${match.schema.entity_type}`);
    console.log(`    场景: ${match.schema.scene}`);
    console.log(`    描述: ${match.schema.description}`);
    console.log(`    匹配得分: ${(match.score * 100).toFixed(1)}%`);
    console.log(`    完整度: ${(match.completeness * 100).toFixed(1)}%`);
    console.log(`    加权完整度: ${(match.weightedCompleteness * 100).toFixed(1)}%`);
    console.log(`    算法匹配字段: ${match.algorithmMatches}`);
    console.log(`    LLM匹配字段: ${match.llmMatches}`);
    console.log(`    总匹配字段: ${match.totalMatches}`);
    
    // 显示核心字段
    console.log(`    核心字段 (${match.schema.core_fields.length}个):`);
    match.schema.core_fields.forEach(field => {
      const isAnchor = field.anchor ? ' [锚点]' : '';
      const isRequired = field.required ? ' [必需]' : '';
      console.log(`      - ${field.name}: ${field.description || ''}${isAnchor}${isRequired} (权重: ${field.weight})`);
    });
  });

  // 4. 生成的实体
  console.log('\n\n📦 生成的实体:');
  console.log('─'.repeat(100));
  
  if (result.steps.entityBuilding && result.steps.entityBuilding.result) {
    const entities = result.steps.entityBuilding.result;
    console.log(`共生成 ${entities.length} 个实体\n`);
    
    entities.forEach((entity, idx) => {
      console.log(`[${idx + 1}] 实体ID: ${entity.id}`);
      console.log(`    Schema: ${entity.schema}`);
      console.log(`    类型: ${entity.type}`);
      console.log(`    置信度: ${entity.confidence || 'N/A'}`);
      
      // 显示锚点指纹
      if (entity.anchorFingerprint) {
        console.log(`    锚点指纹: ${entity.anchorFingerprint}`);
      }
      
      // 显示字段
      const fieldKeys = Object.keys(entity).filter(k => 
        !['id', 'schema', 'type', 'confidence', 'anchorFingerprint', 'source_ckb', 'created_at'].includes(k)
      );
      
      if (fieldKeys.length > 0) {
        console.log(`    字段 (${fieldKeys.length}个):`);
        fieldKeys.forEach(key => {
          const value = entity[key];
          if (Array.isArray(value)) {
            console.log(`      ${key}: [${value.join(', ')}]`);
          } else if (typeof value === 'object') {
            console.log(`      ${key}: ${JSON.stringify(value)}`);
          } else {
            console.log(`      ${key}: ${value}`);
          }
        });
      }
      console.log('');
    });
  }

  // 5. 生成的关系
  console.log('\n🔗 生成的关系:');
  console.log('─'.repeat(100));
  
  if (result.steps.relationExtraction && result.steps.relationExtraction.result) {
    const relations = result.steps.relationExtraction.result;
    console.log(`共生成 ${relations.length} 个关系\n`);
    
    // 按类型分组
    const relationsByType = {};
    relations.forEach(rel => {
      if (!relationsByType[rel.type]) {
        relationsByType[rel.type] = [];
      }
      relationsByType[rel.type].push(rel);
    });
    
    Object.entries(relationsByType).forEach(([type, rels]) => {
      console.log(`\n${type} (${rels.length}个):`);
      rels.slice(0, 5).forEach(rel => {
        console.log(`  ${rel.source_id} --> ${rel.target_id}`);
        console.log(`    权重: ${rel.weight}, 置信度: ${rel.confidence}`);
      });
      if (rels.length > 5) {
        console.log(`  ... 还有 ${rels.length - 5} 个关系`);
      }
    });
  }

  // 6. 性能指标
  console.log('\n\n⚡ 性能指标:');
  console.log('─'.repeat(100));
  console.log(`字段数量: ${result.metrics.fieldCount}`);
  console.log(`实体数量: ${result.metrics.entityCount}`);
  console.log(`关系数量: ${result.metrics.relationCount}`);
  console.log(`Token使用: ${result.metrics.tokenUsage}`);
  console.log(`API调用: ${result.metrics.apiCalls}`);
  console.log(`处理速度:`);
  console.log(`  - 文档/秒: ${result.metrics.documentsPerSecond.toFixed(2)}`);
  console.log(`  - 字段/秒: ${result.metrics.fieldsPerSecond.toFixed(2)}`);
  console.log(`  - 实体/秒: ${result.metrics.entitiesPerSecond.toFixed(2)}`);
  console.log(`  - 关系/秒: ${result.metrics.relationsPerSecond.toFixed(2)}`);

  // 7. 各步骤耗时
  console.log('\n\n⏱️  各步骤耗时:');
  console.log('─'.repeat(100));
  Object.entries(result.steps).forEach(([step, data]) => {
    if (data.status === 'success') {
      console.log(`${step}: ${data.duration}ms`);
    }
  });

  console.log('\n' + '='.repeat(100));
  console.log('✅ 知识图谱生成完成！');
  console.log('='.repeat(100) + '\n');
}

if (require.main === module) {
  main();
}

module.exports = { main };
