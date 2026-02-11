/**
 * 处理摄影课文档 - 完整流程演示
 * 从字段提取到知识图谱生成
 */

const { UniversalDocumentPipeline } = require('./universal_document_pipeline');
const fs = require('fs');
const path = require('path');

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80) + '\n');
}

/**
 * 处理摄影课文档
 */
async function processPhotographyCourse() {
  logSection('📸 摄影课文档处理 - 完整流程');
  
  // 读取摄影课文档
  const docPath = path.join(__dirname, '..', '..', '摄影课.md');
  
  if (!fs.existsSync(docPath)) {
    log('❌ 找不到摄影课.md文件', 'red');
    return null;
  }
  
  const content = fs.readFileSync(docPath, 'utf-8');
  log(`✓ 已读取文档: 摄影课.md`, 'green');
  log(`  文档大小: ${content.length} 字符`, 'blue');
  
  // 创建流水线实例
  log('\n📋 配置处理流水线...', 'cyan');
  const pipeline = new UniversalDocumentPipeline({
    extraction: { 
      useLLM: false,  // 使用本地提取
      enableUniversal: true
    },
    normalization: { 
      useLLM: false,  // 使用本地规范化
      enableMapping: true
    },
    entityBuilding: { 
      useLLM: false,  // 使用本地实体构建
      enableAnchor: true
    },
    relationExtraction: { 
      enableBuiltin: true,
      enableCooccurrence: true,
      enableSemantic: false  // 禁用语义关系以节省时间
    }
  });
  
  log('✓ 流水线配置完成', 'green');
  
  // 准备文档
  const document = {
    id: 'photography-course-001',
    type: 'markdown',
    title: '摄影课 - 人物肖像拍摄技巧',
    content: content,
    metadata: {
      source: '摄影课.md',
      category: '摄影教程',
      topic: '人物肖像',
      uploadTime: new Date().toISOString()
    }
  };
  
  // 开始处理
  logSection('🔄 开始处理文档');
  log('步骤1: 字段提取...', 'cyan');
  log('步骤2: 字段规范化...', 'cyan');
  log('步骤3: Schema匹配...', 'cyan');
  log('步骤4: 实体构建...', 'cyan');
  log('步骤5: 关系抽取...', 'cyan');
  
  const startTime = Date.now();
  const context = await pipeline.processDocument(document);
  const endTime = Date.now();
  
  // 显示处理结果
  logSection('✅ 处理完成');
  
  log(`文档ID: ${context.documentId}`, 'blue');
  log(`处理状态: ${context.status}`, context.status === 'completed' ? 'green' : 'yellow');
  log(`总耗时: ${endTime - startTime}ms`, 'blue');
  
  // 步骤详情
  logSection('📊 各步骤执行情况');
  const steps = [
    { key: 'extraction', name: '字段提取' },
    { key: 'normalization', name: '字段规范化' },
    { key: 'schemaMatching', name: 'Schema匹配' },
    { key: 'entityBuilding', name: '实体构建' },
    { key: 'relationExtraction', name: '关系抽取' }
  ];
  
  steps.forEach(({ key, name }) => {
    const stepInfo = context.steps[key];
    if (stepInfo) {
      const status = stepInfo.status === 'success' ? '✓' : 
                     stepInfo.status === 'failure' ? '✗' : '-';
      const color = stepInfo.status === 'success' ? 'green' : 
                    stepInfo.status === 'failure' ? 'red' : 'yellow';
      log(`${status} ${name}: ${stepInfo.duration}ms`, color);
      
      if (stepInfo.result) {
        if (key === 'extraction' && stepInfo.result.fields) {
          log(`    提取字段数: ${Object.keys(stepInfo.result.fields).length}`, 'blue');
        }
        if (key === 'normalization' && stepInfo.result.normalizedFields) {
          log(`    规范化字段数: ${Object.keys(stepInfo.result.normalizedFields).length}`, 'blue');
        }
        if (key === 'schemaMatching' && stepInfo.result.matchedSchemas) {
          log(`    匹配Schema数: ${stepInfo.result.matchedSchemas.length}`, 'blue');
          stepInfo.result.matchedSchemas.forEach(s => {
            log(`      - ${s.schema.name} (置信度: ${s.confidence.toFixed(2)})`, 'cyan');
          });
        }
        if (key === 'entityBuilding' && stepInfo.result.entities) {
          log(`    构建实体数: ${stepInfo.result.entities.length}`, 'blue');
        }
        if (key === 'relationExtraction' && stepInfo.result.relations) {
          log(`    抽取关系数: ${stepInfo.result.relations.length}`, 'blue');
        }
      }
    }
  });
  
  // 处理指标
  logSection('📈 处理指标');
  log(`提取字段数: ${context.metrics.fieldCount}`, 'blue');
  log(`构建实体数: ${context.metrics.entityCount}`, 'blue');
  log(`抽取关系数: ${context.metrics.relationCount}`, 'blue');
  
  // 显示提取的字段
  if (context.steps.extraction?.result?.fields) {
    logSection('🔍 提取的字段 (前20个)');
    const fields = context.steps.extraction.result.fields;
    const fieldEntries = Object.entries(fields).slice(0, 20);
    
    fieldEntries.forEach(([key, value]) => {
      const displayValue = Array.isArray(value) ? value.join(', ') : value;
      const truncated = displayValue.length > 60 ? displayValue.substring(0, 60) + '...' : displayValue;
      log(`  ${key}: ${truncated}`, 'cyan');
    });
    
    if (Object.keys(fields).length > 20) {
      log(`  ... 还有 ${Object.keys(fields).length - 20} 个字段`, 'yellow');
    }
  }
  
  // 显示构建的实体
  if (context.steps.entityBuilding?.result?.entities) {
    logSection('🎯 构建的实体');
    const entities = context.steps.entityBuilding.result.entities;
    
    entities.forEach((entity, index) => {
      log(`\n实体 ${index + 1}:`, 'magenta');
      log(`  ID: ${entity.id}`, 'blue');
      log(`  类型: ${entity.type}`, 'blue');
      log(`  名称: ${entity.name || '未命名'}`, 'cyan');
      
      if (entity.properties && Object.keys(entity.properties).length > 0) {
        log(`  属性 (${Object.keys(entity.properties).length}):`, 'blue');
        Object.entries(entity.properties).slice(0, 5).forEach(([key, value]) => {
          const displayValue = typeof value === 'object' ? JSON.stringify(value) : value;
          const truncated = displayValue.length > 50 ? displayValue.substring(0, 50) + '...' : displayValue;
          log(`    - ${key}: ${truncated}`, 'cyan');
        });
        if (Object.keys(entity.properties).length > 5) {
          log(`    ... 还有 ${Object.keys(entity.properties).length - 5} 个属性`, 'yellow');
        }
      }
    });
  }
  
  // 显示抽取的关系
  if (context.steps.relationExtraction?.result?.relations) {
    logSection('🔗 抽取的关系');
    const relations = context.steps.relationExtraction.result.relations;
    
    relations.forEach((relation, index) => {
      log(`\n关系 ${index + 1}:`, 'magenta');
      log(`  类型: ${relation.type}`, 'blue');
      log(`  来源: ${relation.source}`, 'cyan');
      log(`  目标: ${relation.target}`, 'cyan');
      if (relation.confidence) {
        log(`  置信度: ${relation.confidence.toFixed(2)}`, 'blue');
      }
      if (relation.properties && Object.keys(relation.properties).length > 0) {
        log(`  属性: ${JSON.stringify(relation.properties)}`, 'blue');
      }
    });
  }
  
  // 警告和错误
  if (context.warnings.length > 0) {
    logSection('⚠️  警告');
    context.warnings.forEach(w => {
      log(`  ${w.step}: ${w.error}`, 'yellow');
    });
  }
  
  if (context.errors.length > 0) {
    logSection('❌ 错误');
    context.errors.forEach(e => {
      log(`  ${e.step}: ${e.error}`, 'red');
    });
  }
  
  // 处理摘要
  const summary = context.getSummary();
  logSection('📋 处理摘要');
  log(`成功步骤: ${summary.successfulSteps}`, 'green');
  log(`失败步骤: ${summary.failedSteps}`, summary.failedSteps > 0 ? 'red' : 'green');
  log(`最慢步骤: ${summary.slowestStep} (${summary.slowestStepDuration}ms)`, 'yellow');
  if (summary.successRate !== undefined) {
    log(`处理效率: ${summary.successRate.toFixed(1)}%`, summary.successRate === 100 ? 'green' : 'yellow');
  }
  
  // 保存结果到文件
  const outputPath = path.join(__dirname, 'photography_course_result.json');
  const output = {
    documentId: context.documentId,
    status: context.status,
    processingTime: endTime - startTime,
    metrics: context.metrics,
    fields: context.steps.extraction?.result?.fields || {},
    entities: context.steps.entityBuilding?.result?.entities || [],
    relations: context.steps.relationExtraction?.result?.relations || [],
    matchedSchemas: context.steps.schemaMatching?.result?.matchedSchemas || [],
    summary: summary
  };
  
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');
  log(`\n💾 结果已保存到: ${outputPath}`, 'green');
  
  logSection('🎉 处理完成！');
  
  return context;
}

// 主函数
async function main() {
  try {
    await processPhotographyCourse();
    process.exit(0);
  } catch (error) {
    log('\n❌ 处理过程中出错:', 'red');
    console.error(error);
    process.exit(1);
  }
}

// 运行
if (require.main === module) {
  main();
}

module.exports = { processPhotographyCourse };
