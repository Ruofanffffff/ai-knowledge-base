/**
 * 诊断实体构建失败的根本原因
 * 
 * 测试从字段提取到实体构建的完整流程
 */

const fs = require('fs');
const path = require('path');
const { UniversalDocumentPipeline } = require('./universal_document_pipeline');

async function diagnoseEntityBuilding() {
  console.log('='.repeat(80));
  console.log('实体构建诊断工具');
  console.log('='.repeat(80));
  console.log();
  
  try {
    // 读取摄影课文档
    const docPath = path.join(__dirname, '../../摄影课.md');
    const content = fs.readFileSync(docPath, 'utf-8');
    
    console.log('✓ 成功读取文档: 摄影课.md');
    console.log(`  文档长度: ${content.length} 字符\n`);
    
    // 创建流水线（使用锚点模式）
    const pipeline = new UniversalDocumentPipeline({
      extraction: {
        useLLM: true,
        useNER: true,
        useRules: true
      },
      schemaMatching: {
        useLLM: true,
        minConfidence: 0.4
      },
      normalization: {
        useLLM: true,
        useAlgorithm: true
      },
      entityBuilding: {
        useLLM: false,
        compatibilityMode: 'anchor_only',  // 使用锚点模式
        allowPartialEntities: true
      },
      relationExtraction: {
        enableBuiltin: true,
        enableCooccurrence: true,
        enableSemantic: false
      }
    });
    
    console.log('✓ 创建流水线实例（锚点模式）\n');
    
    // 处理文档
    const document = {
      id: 'photography_course_diagnosis',
      type: 'markdown',
      title: '摄影课',
      content: content
    };
    
    console.log('开始处理文档...\n');
    console.log('-'.repeat(80));
    
    const context = await pipeline.processDocument(document);
    
    console.log('-'.repeat(80));
    console.log();
    
    // 输出诊断结果
    console.log('诊断结果:');
    console.log('='.repeat(80));
    
    // 1. 字段提取结果
    console.log('\n1. 字段提取结果:');
    console.log(`   状态: ${context.steps.extraction.status}`);
    console.log(`   提取字段数: ${context.data.extractedFields.length}`);
    
    if (context.data.extractedFields.length > 0) {
      console.log('   前10个字段:');
      context.data.extractedFields.slice(0, 10).forEach((field, i) => {
        console.log(`     ${i+1}. ${field.name}: ${field.value}`);
      });
    }
    
    // 2. Schema匹配结果
    console.log('\n2. Schema匹配结果:');
    console.log(`   状态: ${context.steps.schemaMatching.status}`);
    console.log(`   匹配Schema数: ${context.data.matchedSchemas.length}`);
    
    if (context.data.matchedSchemas.length > 0) {
      console.log('   匹配的Schema:');
      context.data.matchedSchemas.forEach((match, i) => {
        console.log(`     ${i+1}. ${match.schema_name}: ${(match.weightedCompleteness * 100).toFixed(1)}%`);
        console.log(`        算法匹配: ${match.algorithmMatches || match.mappedFields}, LLM匹配: ${match.llmMatches || 0}`);
      });
    }
    
    // 3. 字段标准化结果
    console.log('\n3. 字段标准化结果:');
    console.log(`   状态: ${context.steps.normalization.status}`);
    console.log(`   标准化字段集数: ${context.data.normalizedFields.length}`);
    
    if (context.data.normalizedFields.length > 0) {
      context.data.normalizedFields.forEach((nf, i) => {
        console.log(`   Schema ${i+1}: ${nf.schema.schema_name || nf.schema.name}`);
        console.log(`     标准化字段数: ${nf.fields.length}`);
        
        // 检查锚点字段
        const schema = nf.schema;
        const anchorFields = schema.anchor_fields || [];
        
        if (anchorFields.length > 0) {
          console.log(`     锚点字段配置: ${anchorFields.map(af => af.name || af).join(', ')}`);
          
          // 检查锚点字段值
          const anchorFieldValues = {};
          anchorFields.forEach(af => {
            const fieldName = af.name || af;
            const field = nf.fields.find(f => 
              f.standardName === fieldName || f.name === fieldName
            );
            anchorFieldValues[fieldName] = field ? field.value : '(未找到)';
          });
          
          console.log('     锚点字段值:');
          Object.entries(anchorFieldValues).forEach(([name, value]) => {
            const status = value === '(未找到)' ? '✗' : '✓';
            console.log(`       ${status} ${name}: ${value}`);
          });
        } else {
          console.log('     ⚠️  警告: 未配置锚点字段');
        }
        
        // 显示前5个标准化字段
        if (nf.fields.length > 0) {
          console.log('     前5个标准化字段:');
          nf.fields.slice(0, 5).forEach((field, j) => {
            console.log(`       ${j+1}. ${field.standardName || field.name}: ${field.value}`);
          });
        }
      });
    }
    
    // 4. 实体构建结果
    console.log('\n4. 实体构建结果:');
    console.log(`   状态: ${context.steps.entityBuilding.status}`);
    console.log(`   实体数: ${context.data.entities.length}`);
    
    if (context.steps.entityBuilding.status === 'failure') {
      console.log(`   ✗ 错误: ${context.steps.entityBuilding.error}`);
    }
    
    if (context.data.entities.length > 0) {
      console.log('   生成的实体:');
      context.data.entities.forEach((entity, i) => {
        console.log(`     ${i+1}. ${entity.canonical_name} (${entity.entity_type})`);
        console.log(`        ID: ${entity.entity_id}`);
        console.log(`        锚点指纹: ${entity.anchor_fingerprint}`);
        console.log(`        置信度: ${(entity.confidence * 100).toFixed(1)}%`);
        console.log(`        字段数: ${Object.keys(entity.fields).length}`);
      });
    } else {
      console.log('   ⚠️  未生成任何实体');
    }
    
    // 5. 错误和警告
    console.log('\n5. 错误和警告:');
    console.log(`   错误数: ${context.errors.length}`);
    console.log(`   警告数: ${context.warnings.length}`);
    
    if (context.errors.length > 0) {
      console.log('   错误列表:');
      context.errors.forEach((err, i) => {
        console.log(`     ${i+1}. [${err.step}] ${err.error}`);
      });
    }
    
    if (context.warnings.length > 0) {
      console.log('   警告列表:');
      context.warnings.forEach((warn, i) => {
        console.log(`     ${i+1}. [${warn.step}] ${warn.error}`);
      });
    }
    
    // 6. 性能指标
    console.log('\n6. 性能指标:');
    console.log(`   总耗时: ${context.totalDuration}ms`);
    console.log(`   Token使用: ${context.metrics.tokenUsage}`);
    console.log(`   API调用: ${context.metrics.apiCalls}`);
    
    console.log('\n' + '='.repeat(80));
    console.log('诊断完成');
    console.log('='.repeat(80));
    
    // 保存详细结果到文件
    const resultPath = path.join(__dirname, 'entity_building_diagnosis_result.json');
    fs.writeFileSync(resultPath, JSON.stringify({
      summary: context.getSummary(),
      extractedFields: context.data.extractedFields,
      matchedSchemas: context.data.matchedSchemas,
      normalizedFields: context.data.normalizedFields,
      entities: context.data.entities,
      errors: context.errors,
      warnings: context.warnings
    }, null, 2));
    
    console.log(`\n详细结果已保存到: ${resultPath}`);
    
  } catch (error) {
    console.error('\n✗ 诊断过程中发生错误:');
    console.error(error);
    console.error('\n堆栈跟踪:');
    console.error(error.stack);
  }
}

// 运行诊断
diagnoseEntityBuilding().catch(console.error);
