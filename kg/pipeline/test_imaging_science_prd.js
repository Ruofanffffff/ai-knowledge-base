/**
 * 测试脚本：使用《影像科学PRD.md》生成知识图谱
 * 
 * 目的：验证知识图谱系统对产品需求文档的处理能力
 */

const fs = require('fs');
const path = require('path');
const { UniversalDocumentPipeline } = require('./universal_document_pipeline');

async function testImagingSciencePRD() {
  console.log('='.repeat(80));
  console.log('📸 影像科学PRD知识图谱生成测试');
  console.log('='.repeat(80));
  console.log();

  try {
    // 读取文档内容
    const docPath = path.join(__dirname, '../../影像科学PRD.md');
    const content = fs.readFileSync(docPath, 'utf-8');
    
    console.log('✅ 文档读取成功');
    console.log(`📄 文档长度: ${content.length} 字符`);
    console.log();

    // 创建文档对象
    const document = {
      id: 'imaging_science_prd_v1',
      title: '影像科学产品需求文档',
      content: content,
      metadata: {
        type: 'PRD',
        version: 'V1.0',
        author: 'Johnie',
        domain: '产品设计',
        language: 'zh-CN'
      }
    };

    // 初始化流水线
    console.log('🔧 初始化通用文档处理流水线...');
    const pipeline = new UniversalDocumentPipeline({
      enableLLM: true,
      enableSemanticExtraction: true,
      enableMapping: true,
      maxTokens: 8000,
      debug: true
    });
    console.log('✅ 流水线初始化完成');
    console.log();

    // 处理文档
    console.log('⚙️  开始处理文档...');
    console.log('-'.repeat(80));
    const startTime = Date.now();
    
    const result = await pipeline.processDocument(document);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    console.log('-'.repeat(80));
    console.log(`✅ 文档处理完成 (耗时: ${duration}秒)`);
    console.log();

    // 输出结果统计
    console.log('📊 知识图谱生成结果统计');
    console.log('='.repeat(80));
    console.log();

    // 1. Schema匹配结果
    console.log('🎯 Schema匹配结果:');
    const matchedSchemas = result.data?.matchedSchemas || [];
    if (matchedSchemas.length > 0) {
      console.log(`   匹配到 ${matchedSchemas.length} 个Schema:`);
      matchedSchemas.forEach((schemaMatch, index) => {
        const schemaName = schemaMatch.schema_name || schemaMatch.schema?.schema_name || '未知';
        const confidence = schemaMatch.weightedCompleteness || schemaMatch.completeness || 0;
        console.log(`   ${index + 1}. ${schemaName} (完整度: ${(confidence * 100).toFixed(1)}%)`);
        if (schemaMatch.mappedFields !== undefined && schemaMatch.totalFields !== undefined) {
          console.log(`      映射字段: ${schemaMatch.mappedFields}/${schemaMatch.totalFields}`);
        }
      });
    } else {
      console.log('   ⚠️  未匹配到Schema');
    }
    console.log();

    // 2. 实体提取结果
    console.log('🏷️  实体提取结果:');
    const entities = result.data?.entities || [];
    if (entities.length > 0) {
      console.log(`   提取到 ${entities.length} 个实体:`);
      
      // 按类型分组
      const entityByType = {};
      entities.forEach(entity => {
        const type = entity.entity_type || '未分类';
        if (!entityByType[type]) {
          entityByType[type] = [];
        }
        entityByType[type].push(entity);
      });

      Object.entries(entityByType).forEach(([type, entitiesOfType]) => {
        console.log(`   \n   📌 ${type} (${entitiesOfType.length}个):`);
        entitiesOfType.slice(0, 5).forEach(entity => {
          console.log(`      - ${entity.canonical_name} (置信度: ${(entity.confidence * 100).toFixed(1)}%)`);
          if (entity.attributes && Object.keys(entity.attributes).length > 0) {
            const attrStr = Object.entries(entity.attributes)
              .slice(0, 3)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ');
            console.log(`        属性: ${attrStr}${Object.keys(entity.attributes).length > 3 ? '...' : ''}`);
          }
        });
        if (entitiesOfType.length > 5) {
          console.log(`      ... 还有 ${entitiesOfType.length - 5} 个`);
        }
      });
    } else {
      console.log('   ⚠️  未提取到实体');
    }
    console.log();

    // 3. 关系提取结果
    console.log('🔗 关系提取结果:');
    const relations = result.data?.relations || [];
    if (relations.length > 0) {
      console.log(`   提取到 ${relations.length} 个关系:`);
      
      // 按类型分组
      const relationByType = {};
      relations.forEach(relation => {
        const type = relation.relation_type || '未分类';
        if (!relationByType[type]) {
          relationByType[type] = [];
        }
        relationByType[type].push(relation);
      });

      Object.entries(relationByType).forEach(([type, relationsOfType]) => {
        console.log(`   \n   🔗 ${type} (${relationsOfType.length}个):`);
        relationsOfType.slice(0, 3).forEach(relation => {
          const source = relation.source_entity_id || relation.source || '未知';
          const target = relation.target_entity_id || relation.target || '未知';
          console.log(`      ${source} → ${target}`);
          if (relation.confidence) {
            console.log(`         置信度: ${(relation.confidence * 100).toFixed(1)}%`);
          }
        });
        if (relationsOfType.length > 3) {
          console.log(`      ... 还有 ${relationsOfType.length - 3} 个`);
        }
      });
    } else {
      console.log('   ⚠️  未提取到关系');
    }
    console.log();

    // 4. 字段提取结果
    console.log('📝 字段提取结果:');
    const extractedFields = result.data?.extractedFields || [];
    if (extractedFields.length > 0) {
      console.log(`   提取到 ${extractedFields.length} 个字段:`);
      
      // 按类型分组
      const fieldsByType = {};
      extractedFields.forEach(field => {
        const type = field.type || '未分类';
        if (!fieldsByType[type]) {
          fieldsByType[type] = [];
        }
        fieldsByType[type].push(field);
      });

      Object.entries(fieldsByType).forEach(([type, fieldsOfType]) => {
        console.log(`   \n   📝 ${type} (${fieldsOfType.length}个):`);
        fieldsOfType.slice(0, 5).forEach(field => {
          const displayValue = typeof field.value === 'string' && field.value.length > 50 
            ? field.value.substring(0, 50) + '...' 
            : field.value;
          console.log(`      - ${field.name}: ${displayValue}`);
        });
        if (fieldsOfType.length > 5) {
          console.log(`      ... 还有 ${fieldsOfType.length - 5} 个`);
        }
      });
    } else {
      console.log('   ⚠️  未提取到字段');
    }
    console.log();

    // 5. 性能指标
    console.log('⚡ 性能指标:');
    if (result.metrics) {
      console.log(`   总耗时: ${duration}秒`);
      console.log(`   字段数: ${result.metrics.fieldCount || 0}`);
      console.log(`   实体数: ${result.metrics.entityCount || 0}`);
      console.log(`   关系数: ${result.metrics.relationCount || 0}`);
      if (result.metrics.tokenUsage) {
        console.log(`   Token使用: ${result.metrics.tokenUsage}`);
      }
      if (result.metrics.apiCalls) {
        console.log(`   API调用: ${result.metrics.apiCalls}`);
      }
    }
    console.log();

    // 保存结果到文件
    const outputPath = path.join(__dirname, 'test_result_imaging_science_prd.json');
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`💾 完整结果已保存到: ${outputPath}`);
    console.log();

    // 生成可视化报告
    generateReport(result, document);

    console.log('='.repeat(80));
    console.log('✅ 测试完成!');
    console.log('='.repeat(80));

    return result;

  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error('错误堆栈:', error.stack);
    throw error;
  }
}

/**
 * 生成可视化报告
 */
function generateReport(result, document) {
  console.log('📄 生成可视化报告...');
  
  const report = `
# 影像科学PRD知识图谱分析报告

## 文档信息
- **标题**: ${document.title}
- **类型**: ${document.metadata.type}
- **版本**: ${document.metadata.version}
- **作者**: ${document.metadata.author}
- **领域**: ${document.metadata.domain}

## 知识图谱统计

### Schema匹配
- 匹配数量: ${result.schemas?.length || 0}
${result.schemas?.map((s, i) => `${i + 1}. **${s.name}** (置信度: ${(s.confidence * 100).toFixed(1)}%)`).join('\n') || '无'}

### 实体提取
- 实体总数: ${result.entities?.length || 0}
${generateEntitySummary(result.entities)}

### 关系提取
- 关系总数: ${result.relations?.length || 0}
${generateRelationSummary(result.relations)}

### 字段提取
- 字段总数: ${Object.keys(result.fields || {}).length}

## 核心发现

### 产品定位
${extractProductInfo(result)}

### 用户画像
${extractUserInfo(result)}

### 功能模块
${extractFeatureInfo(result)}

### 技术要求
${extractTechInfo(result)}

---
*报告生成时间: ${new Date().toLocaleString('zh-CN')}*
`;

  const reportPath = path.join(__dirname, 'imaging_science_prd_report.md');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`📊 可视化报告已保存到: ${reportPath}`);
}

function generateEntitySummary(entities) {
  if (!entities || entities.length === 0) return '无';
  
  const byType = {};
  entities.forEach(e => {
    const type = e.type || '其他';
    byType[type] = (byType[type] || 0) + 1;
  });
  
  return Object.entries(byType)
    .map(([type, count]) => `- ${type}: ${count}个`)
    .join('\n');
}

function generateRelationSummary(relations) {
  if (!relations || relations.length === 0) return '无';
  
  const byType = {};
  relations.forEach(r => {
    const type = r.type || '其他';
    byType[type] = (byType[type] || 0) + 1;
  });
  
  return Object.entries(byType)
    .map(([type, count]) => `- ${type}: ${count}个`)
    .join('\n');
}

function extractProductInfo(result) {
  const productEntities = result.entities?.filter(e => 
    e.type === '产品' || e.name?.includes('影像科学') || e.name?.includes('PhotoScience')
  ) || [];
  
  if (productEntities.length === 0) return '未提取到产品信息';
  
  return productEntities.map(e => `- ${e.name}: ${e.value || e.description || ''}`).join('\n');
}

function extractUserInfo(result) {
  const userEntities = result.entities?.filter(e => 
    e.type === '用户' || e.type === '角色' || e.name?.includes('用户')
  ) || [];
  
  if (userEntities.length === 0) return '未提取到用户信息';
  
  return userEntities.map(e => `- ${e.name}: ${e.value || e.description || ''}`).join('\n');
}

function extractFeatureInfo(result) {
  const featureEntities = result.entities?.filter(e => 
    e.type === '功能' || e.type === '模块'
  ) || [];
  
  if (featureEntities.length === 0) return '未提取到功能信息';
  
  return featureEntities.slice(0, 10).map(e => `- ${e.name}`).join('\n');
}

function extractTechInfo(result) {
  const techEntities = result.entities?.filter(e => 
    e.type === '技术' || e.type === '工具' || e.name?.includes('AI') || e.name?.includes('Lightroom')
  ) || [];
  
  if (techEntities.length === 0) return '未提取到技术信息';
  
  return techEntities.map(e => `- ${e.name}`).join('\n');
}

// 运行测试
if (require.main === module) {
  testImagingSciencePRD()
    .then(() => {
      console.log('\n✅ 所有测试通过');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ 测试失败:', error.message);
      process.exit(1);
    });
}

module.exports = { testImagingSciencePRD };
