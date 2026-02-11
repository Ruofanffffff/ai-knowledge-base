/**
 * 端到端测试：使用影像科学PRD文档测试LLM增强实体提取系统
 * 
 * 测试目标：
 * 1. 验证系统能够提取复杂文档中的语义概念
 * 2. 验证系统能够提取细粒度实体
 * 3. 验证系统能够提取语义关系
 * 4. 验证混合提取策略的有效性
 * 5. 验证系统的性能和质量指标
 */

const fs = require('fs');
const path = require('path');
const ExtractionCoordinator = require('./extraction_coordinator');
const Configuration = require('./configuration');

// 测试配置
const TEST_CONFIG = {
  llm: {
    enabled: true,
    model: 'qwen-plus',
    apiKey: process.env.QWEN_API_KEY || 'sk-43c76462bfad4a57bd2420c7fdb0aec4',
    timeout: 30000, // 30秒超时
    maxRetries: 3
  },
  algorithm: {
    enabled: true
  },
  performance: {
    enableCache: true,
    maxProcessingTime: 60000 // 60秒最大处理时间
  }
};

/**
 * 读取影像科学PRD文档
 */
function loadImagingSciencePRD() {
  const prdPath = path.join(__dirname, '../../影像科学PRD.md');
  if (!fs.existsSync(prdPath)) {
    throw new Error(`PRD文档不存在: ${prdPath}`);
  }
  return fs.readFileSync(prdPath, 'utf-8');
}

/**
 * 分析提取结果
 */
function analyzeResults(result) {
  const analysis = {
    // 基础统计
    totalEntities: result.entities.length,
    totalRelations: result.relations.length,
    
    // 实体分类统计
    entityTypes: {},
    
    // 来源统计
    algorithmEntities: 0,
    llmEntities: 0,
    
    // 置信度统计
    avgConfidence: 0,
    lowConfidenceCount: 0,
    
    // 语义概念
    semanticConcepts: [],
    
    // 细粒度实体
    fineGrainedEntities: [],
    
    // 关系类型统计
    relationTypes: {},
    
    // 质量指标
    quality: result.quality,
    
    // 元数据
    metadata: result.metadata
  };
  
  // 统计实体
  result.entities.forEach(entity => {
    // 类型统计
    analysis.entityTypes[entity.type] = (analysis.entityTypes[entity.type] || 0) + 1;
    
    // 来源统计
    if (entity.source === 'algorithm') {
      analysis.algorithmEntities++;
    } else if (entity.source === 'llm') {
      analysis.llmEntities++;
    }
    
    // 置信度统计
    analysis.avgConfidence += entity.confidence;
    if (entity.confidence < 0.5) {
      analysis.lowConfidenceCount++;
    }
    
    // 语义概念
    if (entity.type === 'semantic_concept' || entity.type === 'concept') {
      analysis.semanticConcepts.push({
        name: entity.name,
        confidence: entity.confidence,
        description: entity.properties?.description
      });
    }
    
    // 细粒度实体
    if (entity.type === 'feature' || entity.type === 'component' || entity.type === 'technique') {
      analysis.fineGrainedEntities.push({
        name: entity.name,
        type: entity.type,
        confidence: entity.confidence
      });
    }
  });
  
  // 计算平均置信度
  if (result.entities.length > 0) {
    analysis.avgConfidence /= result.entities.length;
  }
  
  // 统计关系
  result.relations.forEach(relation => {
    analysis.relationTypes[relation.type] = (analysis.relationTypes[relation.type] || 0) + 1;
  });
  
  return analysis;
}

/**
 * 验证提取结果
 */
function validateResults(result, analysis) {
  const validations = {
    passed: [],
    failed: [],
    warnings: []
  };
  
  // 验证1: 应该提取到实体
  if (analysis.totalEntities > 0) {
    validations.passed.push('✓ 成功提取实体');
  } else {
    validations.failed.push('✗ 未提取到任何实体');
  }
  
  // 验证2: 应该提取到语义概念
  if (analysis.semanticConcepts.length >= 5) {
    validations.passed.push(`✓ 提取到 ${analysis.semanticConcepts.length} 个语义概念`);
  } else {
    validations.warnings.push(`⚠ 语义概念数量较少: ${analysis.semanticConcepts.length}`);
  }
  
  // 验证3: 应该提取到关系
  if (analysis.totalRelations > 0) {
    validations.passed.push(`✓ 提取到 ${analysis.totalRelations} 个关系`);
  } else {
    validations.warnings.push('⚠ 未提取到关系');
  }
  
  // 验证4: 混合提取策略
  if (analysis.algorithmEntities > 0 && analysis.llmEntities > 0) {
    validations.passed.push('✓ 混合提取策略工作正常');
  } else if (analysis.algorithmEntities > 0) {
    validations.warnings.push('⚠ 仅算法提取有结果');
  } else if (analysis.llmEntities > 0) {
    validations.warnings.push('⚠ 仅LLM提取有结果');
  }
  
  // 验证5: 平均置信度
  if (analysis.avgConfidence >= 0.7) {
    validations.passed.push(`✓ 平均置信度良好: ${(analysis.avgConfidence * 100).toFixed(1)}%`);
  } else if (analysis.avgConfidence >= 0.5) {
    validations.warnings.push(`⚠ 平均置信度中等: ${(analysis.avgConfidence * 100).toFixed(1)}%`);
  } else {
    validations.failed.push(`✗ 平均置信度较低: ${(analysis.avgConfidence * 100).toFixed(1)}%`);
  }
  
  // 验证6: 处理时间
  if (result.metadata.processingTime < 60000) {
    validations.passed.push(`✓ 处理时间符合要求: ${(result.metadata.processingTime / 1000).toFixed(2)}s`);
  } else {
    validations.warnings.push(`⚠ 处理时间较长: ${(result.metadata.processingTime / 1000).toFixed(2)}s`);
  }
  
  // 验证7: 状态
  if (result.metadata.status === 'success') {
    validations.passed.push('✓ 提取状态: 成功');
  } else if (result.metadata.status === 'partial_success') {
    validations.warnings.push('⚠ 提取状态: 部分成功');
  } else {
    validations.failed.push('✗ 提取状态: 失败');
  }
  
  // 验证8: 质量指标
  if (result.quality) {
    if (result.quality.entityCompleteness >= 0.7) {
      validations.passed.push(`✓ 实体完整性: ${(result.quality.entityCompleteness * 100).toFixed(1)}%`);
    } else {
      validations.warnings.push(`⚠ 实体完整性较低: ${(result.quality.entityCompleteness * 100).toFixed(1)}%`);
    }
  }
  
  return validations;
}

/**
 * 打印测试报告
 */
function printReport(analysis, validations, result) {
  console.log('\n' + '='.repeat(80));
  console.log('影像科学PRD文档 - LLM增强实体提取系统 端到端测试报告');
  console.log('='.repeat(80));
  
  // 基础统计
  console.log('\n【基础统计】');
  console.log(`  总实体数: ${analysis.totalEntities}`);
  console.log(`  总关系数: ${analysis.totalRelations}`);
  console.log(`  算法提取实体: ${analysis.algorithmEntities}`);
  console.log(`  LLM提取实体: ${analysis.llmEntities}`);
  console.log(`  平均置信度: ${(analysis.avgConfidence * 100).toFixed(1)}%`);
  console.log(`  低置信度实体: ${analysis.lowConfidenceCount}`);
  
  // 实体类型分布
  console.log('\n【实体类型分布】');
  Object.entries(analysis.entityTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  // 语义概念
  console.log('\n【语义概念】(前10个)');
  analysis.semanticConcepts.slice(0, 10).forEach((concept, idx) => {
    console.log(`  ${idx + 1}. ${concept.name} (置信度: ${(concept.confidence * 100).toFixed(1)}%)`);
    if (concept.description) {
      console.log(`     ${concept.description.substring(0, 80)}...`);
    }
  });
  
  // 细粒度实体
  console.log('\n【细粒度实体】(前10个)');
  analysis.fineGrainedEntities.slice(0, 10).forEach((entity, idx) => {
    console.log(`  ${idx + 1}. ${entity.name} [${entity.type}] (置信度: ${(entity.confidence * 100).toFixed(1)}%)`);
  });
  
  // 关系类型分布
  console.log('\n【关系类型分布】');
  Object.entries(analysis.relationTypes).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  
  // 性能指标
  console.log('\n【性能指标】');
  console.log(`  总处理时间: ${(analysis.metadata.processingTime / 1000).toFixed(2)}s`);
  if (analysis.metadata.algorithmTime) {
    console.log(`  算法提取时间: ${(analysis.metadata.algorithmTime / 1000).toFixed(2)}s`);
  }
  if (analysis.metadata.llmTime) {
    console.log(`  LLM提取时间: ${(analysis.metadata.llmTime / 1000).toFixed(2)}s`);
  }
  if (analysis.metadata.tokensUsed) {
    console.log(`  Token使用量: ${analysis.metadata.tokensUsed}`);
  }
  if (analysis.metadata.cost) {
    console.log(`  估算成本: $${analysis.metadata.cost.toFixed(4)}`);
  }
  console.log(`  处理状态: ${analysis.metadata.status}`);
  
  // 质量指标
  if (analysis.quality) {
    console.log('\n【质量指标】');
    console.log(`  实体完整性: ${(analysis.quality.entityCompleteness * 100).toFixed(1)}%`);
    console.log(`  关系完整性: ${(analysis.quality.relationCompleteness * 100).toFixed(1)}%`);
    console.log(`  平均置信度: ${(analysis.quality.averageConfidence * 100).toFixed(1)}%`);
    console.log(`  字段完整率: ${(analysis.quality.fieldCompleteness * 100).toFixed(1)}%`);
    if (analysis.quality.warnings && analysis.quality.warnings.length > 0) {
      console.log(`  警告信息: ${analysis.quality.warnings.length}条`);
      analysis.quality.warnings.forEach(warning => {
        console.log(`    - ${warning}`);
      });
    }
  }
  
  // 验证结果
  console.log('\n【验证结果】');
  console.log(`\n  通过 (${validations.passed.length}):`);
  validations.passed.forEach(msg => console.log(`    ${msg}`));
  
  if (validations.warnings.length > 0) {
    console.log(`\n  警告 (${validations.warnings.length}):`);
    validations.warnings.forEach(msg => console.log(`    ${msg}`));
  }
  
  if (validations.failed.length > 0) {
    console.log(`\n  失败 (${validations.failed.length}):`);
    validations.failed.forEach(msg => console.log(`    ${msg}`));
  }
  
  // 总结
  console.log('\n【测试总结】');
  const totalTests = validations.passed.length + validations.warnings.length + validations.failed.length;
  const passRate = ((validations.passed.length / totalTests) * 100).toFixed(1);
  console.log(`  测试项: ${totalTests}`);
  console.log(`  通过: ${validations.passed.length}`);
  console.log(`  警告: ${validations.warnings.length}`);
  console.log(`  失败: ${validations.failed.length}`);
  console.log(`  通过率: ${passRate}%`);
  
  if (validations.failed.length === 0) {
    console.log('\n  ✅ 测试通过！系统运行正常。');
  } else {
    console.log('\n  ❌ 测试失败！请检查失败项。');
  }
  
  console.log('\n' + '='.repeat(80));
}

/**
 * 保存详细结果到文件
 */
function saveDetailedResults(result, analysis, validations) {
  const outputDir = path.join(__dirname, 'test_results');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultFile = path.join(outputDir, `imaging_science_prd_test_${timestamp}.json`);
  
  const detailedResults = {
    timestamp: new Date().toISOString(),
    document: '影像科学PRD.md',
    result,
    analysis,
    validations
  };
  
  fs.writeFileSync(resultFile, JSON.stringify(detailedResults, null, 2), 'utf-8');
  console.log(`\n详细结果已保存到: ${resultFile}`);
}

/**
 * 主测试函数
 */
async function runE2ETest() {
  console.log('开始端到端测试...');
  console.log('文档: 影像科学PRD.md');
  console.log('系统: LLM增强实体提取系统\n');
  
  try {
    // 1. 加载文档
    console.log('步骤 1/5: 加载文档...');
    const documentText = loadImagingSciencePRD();
    console.log(`  文档长度: ${documentText.length} 字符`);
    
    // 2. 初始化系统
    console.log('\n步骤 2/5: 初始化提取系统...');
    const config = new Configuration(TEST_CONFIG);
    const coordinator = new ExtractionCoordinator(config);
    console.log('  系统初始化完成');
    
    // 3. 执行提取
    console.log('\n步骤 3/5: 执行混合提取...');
    const startTime = Date.now();
    const result = await coordinator.extract(documentText, {
      language: 'zh',
      enableLLM: true,
      enableAlgorithm: true
    });
    const endTime = Date.now();
    console.log(`  提取完成，耗时: ${((endTime - startTime) / 1000).toFixed(2)}s`);
    
    // 4. 分析结果
    console.log('\n步骤 4/5: 分析提取结果...');
    const analysis = analyzeResults(result);
    console.log('  分析完成');
    
    // 5. 验证结果
    console.log('\n步骤 5/5: 验证提取结果...');
    const validations = validateResults(result, analysis);
    console.log('  验证完成');
    
    // 打印报告
    printReport(analysis, validations, result);
    
    // 保存详细结果
    saveDetailedResults(result, analysis, validations);
    
    // 返回测试结果
    return {
      success: validations.failed.length === 0,
      result,
      analysis,
      validations
    };
    
  } catch (error) {
    console.error('\n❌ 测试执行失败:');
    console.error(error);
    
    // 保存错误信息
    const outputDir = path.join(__dirname, 'test_results');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const errorFile = path.join(outputDir, `imaging_science_prd_test_error_${timestamp}.txt`);
    fs.writeFileSync(errorFile, `${error.stack}\n`, 'utf-8');
    console.log(`\n错误信息已保存到: ${errorFile}`);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runE2ETest()
    .then(testResult => {
      process.exit(testResult.success ? 0 : 1);
    })
    .catch(error => {
      console.error('测试执行异常:', error);
      process.exit(1);
    });
}

module.exports = { runE2ETest, analyzeResults, validateResults };
