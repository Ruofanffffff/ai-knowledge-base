/**
 * 诊断锚点字段值问题
 * 检查LLM匹配的字段值是否正确传递到实体构建阶段
 */

const fs = require('fs');
const path = require('path');
const { UniversalDocumentPipeline } = require('./universal_document_pipeline');

console.log('================================================================================');
console.log('🔍 锚点字段值诊断工具');
console.log('================================================================================\n');

async function diagnose() {
  try {
    // 读取测试文档
    const docPath = path.join(__dirname, '../../摄影课.md');
    const content = fs.readFileSync(docPath, 'utf-8');
    
    console.log('✓ 已读取文档: 摄影课.md');
    console.log(`  文档大小: ${content.length} 字符\n`);
    
    // 创建流水线
    const pipeline = new UniversalDocumentPipeline({
      extraction: {
        useLLM: false,
        useNER: true,
        useRules: true
      },
      schemaMatching: {
        useLLM: true,
        minConfidence: 0.4
      },
      normalization: {
        useLLM: false,
        useAlgorithm: true
      },
      entityBuilding: {
        useLLM: false,
        compatibilityMode: 'anchor_only'
      },
      relationExtraction: {
        enableBuiltin: true,
        enableCooccurrence: true,
        enableSemantic: false
      }
    });
    
    console.log('✓ 流水线配置完成\n');
    
    // 处理文档
    const document = {
      id: 'photography-course-diagnosis',
      type: 'text',
      title: '摄影课',
      content: content
    };
    
    console.log('================================================================================');
    console.log('🔄 开始处理文档');
    console.log('================================================================================\n');
    
    const context = await pipeline.processDocument(document);
    
    console.log('\n================================================================================');
    console.log('📊 诊断结果');
    console.log('================================================================================\n');
    
    // 1. 检查提取的字段
    console.log('1. 提取的字段:');
    console.log(`   总数: ${context.data.extractedFields.length}`);
    console.log(`   所有字段:`);
    context.data.extractedFields.forEach((field, i) => {
      const source = field.source || 'unknown';
      const valuePreview = field.value ? 
        (field.value.length > 50 ? field.value.substring(0, 50) + '...' : field.value) : 
        '(空)';
      console.log(`     ${i + 1}. [${source}] ${field.name}: "${valuePreview}"`);
    });
    
    // 查找名为"数值"的字段
    const numericFields = context.data.extractedFields.filter(f => 
      f.name === '数值' || f.name.includes('数值')
    );
    if (numericFields.length > 0) {
      console.log(`\n   ⚠️  发现 ${numericFields.length} 个"数值"相关字段:`);
      numericFields.forEach((field, i) => {
        console.log(`     ${i + 1}. [${field.source}] ${field.name}: "${field.value}"`);
      });
    }
    console.log('');
    
    // 2. 检查Schema匹配结果
    console.log('2. Schema匹配结果:');
    const schemaMatchingMetrics = context.steps.schemaMatching.metrics;
    console.log(`   总Schema数: ${schemaMatchingMetrics.totalSchemas}`);
    console.log(`   算法匹配Schema: ${schemaMatchingMetrics.algorithmMatchedSchemas}`);
    console.log(`   LLM匹配Schema: ${schemaMatchingMetrics.llmMatchedSchemas}`);
    console.log(`   合格Schema: ${schemaMatchingMetrics.qualifiedSchemas}`);
    console.log(`   触发Schema: ${schemaMatchingMetrics.triggeredSchemas}`);
    console.log(`   未匹配字段: ${schemaMatchingMetrics.unmatchedFieldCount}`);
    
    if (schemaMatchingMetrics.bestMatch) {
      console.log(`   最佳匹配: ${schemaMatchingMetrics.bestMatch.name} (${(schemaMatchingMetrics.bestMatch.completeness * 100).toFixed(1)}%)`);
      console.log(`     - 算法匹配: ${schemaMatchingMetrics.bestMatch.algorithmMatches || 0}`);
      console.log(`     - LLM匹配: ${schemaMatchingMetrics.bestMatch.llmMatches || 0}`);
    }
    console.log('');
    
    // 3. 检查字段规范化结果
    console.log('3. 字段规范化结果:');
    const normalizationMetrics = context.steps.normalization.metrics;
    console.log(`   处理的Schema: ${normalizationMetrics.schemasProcessed}`);
    console.log(`   规范化字段总数: ${normalizationMetrics.totalNormalizedFields}`);
    console.log(`   整体成功率: ${(normalizationMetrics.overallSuccessRate * 100).toFixed(1)}%`);
    console.log('');
    
    // 详细检查每个Schema的规范化字段
    console.log('   各Schema规范化详情:');
    normalizationMetrics.schemaMetrics.forEach((metric, i) => {
      console.log(`   ${i + 1}. ${metric.schemaName}:`);
      console.log(`      - 预期字段: ${metric.expectedFields}`);
      console.log(`      - 映射字段: ${metric.mappedFields}`);
      console.log(`      - 成功率: ${(metric.successRate * 100).toFixed(1)}%`);
      if (metric.failedFields && metric.failedFields.length > 0) {
        console.log(`      - 失败字段: ${metric.failedFields.join(', ')}`);
      }
    });
    console.log('');
    
    // 4. 检查匹配的Schema及其字段
    console.log('4. 匹配的Schema及其字段:');
    if (context.data.matchedSchemas && context.data.matchedSchemas.length > 0) {
      context.data.matchedSchemas.forEach((schema, i) => {
        console.log(`   ${i + 1}. ${schema.schema_name}:`);
        console.log(`      - 完整度: ${(schema.completeness * 100).toFixed(1)}%`);
        console.log(`      - 加权完整度: ${(schema.weightedCompleteness * 100).toFixed(1)}%`);
        console.log(`      - 规范化字段数: ${schema.normalizedFields.length}`);
        
        // 检查规范化字段的值
        console.log(`      - 规范化字段详情:`);
        schema.normalizedFields.forEach((field, j) => {
          const valuePreview = field.value ? 
            (field.value.length > 30 ? field.value.substring(0, 30) + '...' : field.value) : 
            '(空)';
          console.log(`        ${j + 1}. ${field.name}: "${valuePreview}"`);
          console.log(`           - 原始名: ${field.originalName || '(无)'}`);
          console.log(`           - 映射方法: ${field.mappingMethod}`);
          console.log(`           - 置信度: ${field.confidence}`);
        });
      });
    } else {
      console.log('   ⚠️  没有匹配的Schema');
    }
    console.log('');
    
    // 5. 检查实体构建结果
    console.log('5. 实体构建结果:');
    const entityMetrics = context.steps.entityBuilding.metrics;
    console.log(`   实体数: ${entityMetrics.entityCount}`);
    console.log(`   Schema实例数: ${entityMetrics.schemaInstanceCount}`);
    console.log(`   平均置信度: ${(entityMetrics.avgConfidence * 100).toFixed(1)}%`);
    console.log(`   模式: ${entityMetrics.mode}`);
    console.log('');
    
    // 详细检查每个实体
    if (context.data.entities && context.data.entities.length > 0) {
      console.log('   实体详情:');
      context.data.entities.forEach((entity, i) => {
        console.log(`   ${i + 1}. ${entity.name} (${entity.entity_type}):`);
        console.log(`      - ID: ${entity.entity_id}`);
        console.log(`      - 锚点指纹: ${entity.anchor_fingerprint ? entity.anchor_fingerprint.substring(0, 80) + '...' : '(无)'}`);
        console.log(`      - 置信度: ${(entity.confidence * 100).toFixed(1)}%`);
        console.log(`      - 字段数: ${Object.keys(entity.fields).length}`);
        
        // 检查字段值
        console.log(`      - 字段详情:`);
        const fieldEntries = Object.entries(entity.fields).slice(0, 5);
        fieldEntries.forEach(([key, value]) => {
          const valueStr = typeof value === 'object' ? JSON.stringify(value).substring(0, 50) : String(value).substring(0, 50);
          console.log(`        - ${key}: ${valueStr}`);
        });
        
        if (Object.keys(entity.fields).length > 5) {
          console.log(`        ... 还有 ${Object.keys(entity.fields).length - 5} 个字段`);
        }
      });
    } else {
      console.log('   ⚠️  没有生成实体');
    }
    console.log('');
    
    // 6. 分析问题
    console.log('================================================================================');
    console.log('🔍 问题分析');
    console.log('================================================================================\n');
    
    let hasIssues = false;
    
    // 检查LLM匹配的字段是否有值
    if (context.data.matchedSchemas && context.data.matchedSchemas.length > 0) {
      const llmMatchedFields = [];
      context.data.matchedSchemas.forEach(schema => {
        schema.normalizedFields.forEach(field => {
          if (field.mappingMethod === 'llm') {
            llmMatchedFields.push({
              schema: schema.schema_name,
              field: field.name,
              value: field.value,
              originalName: field.originalName
            });
          }
        });
      });
      
      if (llmMatchedFields.length > 0) {
        console.log(`✓ 找到 ${llmMatchedFields.length} 个LLM匹配的字段\n`);
        
        const emptyFields = llmMatchedFields.filter(f => !f.value || f.value.trim() === '');
        if (emptyFields.length > 0) {
          console.log(`⚠️  发现 ${emptyFields.length} 个LLM匹配字段的值为空:`);
          emptyFields.slice(0, 5).forEach((f, i) => {
            console.log(`   ${i + 1}. ${f.schema}.${f.field} (原始名: ${f.originalName || '(无)'})`);
          });
          hasIssues = true;
        } else {
          console.log('✓ 所有LLM匹配的字段都有值');
        }
      } else {
        console.log('⚠️  没有LLM匹配的字段');
      }
    }
    console.log('');
    
    // 检查实体置信度
    if (context.data.entities && context.data.entities.length > 0) {
      const lowConfidenceEntities = context.data.entities.filter(e => e.confidence < 0.1);
      if (lowConfidenceEntities.length > 0) {
        console.log(`⚠️  发现 ${lowConfidenceEntities.length} 个低置信度实体 (< 10%):`);
        lowConfidenceEntities.forEach((e, i) => {
          console.log(`   ${i + 1}. ${e.name}: ${(e.confidence * 100).toFixed(1)}%`);
        });
        hasIssues = true;
      } else {
        console.log('✓ 所有实体置信度 >= 10%');
      }
    }
    console.log('');
    
    // 总结
    console.log('================================================================================');
    console.log('📋 诊断总结');
    console.log('================================================================================\n');
    
    if (hasIssues) {
      console.log('⚠️  发现问题，需要进一步调查');
    } else {
      console.log('✓ 未发现明显问题');
    }
    
    console.log('\n✓ 诊断完成\n');
    
  } catch (error) {
    console.error('\n❌ 诊断失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

diagnose();
