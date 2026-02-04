/**
 * Universal Document Pipeline - 使用示例
 * 
 * 演示如何使用通用文档处理流水线
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
  red: '\x1b[31m'
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
 * 示例1: 处理单个文档
 */
async function example1_singleDocument() {
  logSection('示例1: 处理单个文档');
  
  // 创建流水线实例（禁用LLM以节省成本和时间）
  const pipeline = new UniversalDocumentPipeline({
    extraction: { useLLM: false },
    normalization: { useLLM: false },
    entityBuilding: { useLLM: false },
    relationExtraction: { enableSemantic: false }
  });
  
  // 准备文档
  const document = {
    id: 'example-doc-1',
    type: 'text',
    title: '测试招标文件',
    content: `
      项目名称：某市政道路改造工程
      项目编号：2024-001
      招标人：某市建设局
      预算金额：500万元
      工期：6个月
      联系人：张三
      联系电话：13800138000
      项目地址：某市某区某街道
    `
  };
  
  log('处理文档...', 'cyan');
  const context = await pipeline.processDocument(document);
  
  // 显示结果
  log('\n✓ 处理完成！', 'green');
  log(`\n文档ID: ${context.documentId}`, 'blue');
  log(`状态: ${context.status}`, 'blue');
  log(`总耗时: ${context.totalDuration}ms`, 'blue');
  
  log('\n步骤执行情况:', 'cyan');
  Object.keys(context.steps).forEach(step => {
    const stepInfo = context.steps[step];
    const status = stepInfo.status === 'success' ? '✓' : 
                   stepInfo.status === 'failure' ? '✗' : '-';
    log(`  ${status} ${step}: ${stepInfo.duration}ms`, 'blue');
  });
  
  log('\n处理指标:', 'cyan');
  log(`  提取字段: ${context.metrics.fieldCount}`, 'blue');
  log(`  构建实体: ${context.metrics.entityCount}`, 'blue');
  log(`  抽取关系: ${context.metrics.relationCount}`, 'blue');
  
  if (context.warnings.length > 0) {
    log(`\n警告 (${context.warnings.length}):', 'yellow');
    context.warnings.forEach(w => {
      log(`  - ${w.step}: ${w.error}`, 'yellow');
    });
  }
  
  if (context.errors.length > 0) {
    log(`\n错误 (${context.errors.length}):', 'red');
    context.errors.forEach(e => {
      log(`  - ${e.step}: ${e.error}`, 'red');
    });
  }
  
  // 显示摘要
  const summary = context.getSummary();
  log('\n处理摘要:', 'cyan');
  log(`  成功步骤: ${summary.successfulSteps}`, 'green');
  log(`  失败步骤: ${summary.failedSteps}`, 'red');
  log(`  最慢步骤: ${summary.slowestStep} (${summary.slowestStepDuration}ms)`, 'yellow');
  
  return context;
}

/**
 * 示例2: 批量处理文档
 */
async function example2_batchProcessing() {
  logSection('示例2: 批量处理文档');
  
  const pipeline = new UniversalDocumentPipeline({
    extraction: { useLLM: false },
    normalization: { useLLM: false },
    entityBuilding: { useLLM: false },
    relationExtraction: { enableSemantic: false }
  });
  
  // 准备多个文档
  const documents = [
    {
      id: 'batch-doc-1',
      type: 'text',
      title: '招标文件1',
      content: '项目名称：道路改造工程\n预算：500万元'
    },
    {
      id: 'batch-doc-2',
      type: 'text',
      title: '招标文件2',
      content: '项目名称：桥梁建设工程\n预算：1000万元'
    },
    {
      id: 'batch-doc-3',
      type: 'text',
      title: '招标文件3',
      content: '项目名称：公园绿化工程\n预算：300万元'
    }
  ];
  
  log(`批量处理 ${documents.length} 个文档...`, 'cyan');
  const results = await pipeline.processBatch(documents, {
    concurrency: 2  // 并发处理2个文档
  });
  
  log('\n✓ 批量处理完成！', 'green');
  
  // 统计结果
  const completed = results.filter(r => r.status === 'completed').length;
  const partial = results.filter(r => r.status === 'partial').length;
  const failed = results.filter(r => r.status === 'failed').length;
  
  log('\n批量处理统计:', 'cyan');
  log(`  总文档数: ${results.length}`, 'blue');
  log(`  完全成功: ${completed}`, 'green');
  log(`  部分成功: ${partial}`, 'yellow');
  log(`  失败: ${failed}`, 'red');
  
  // 显示每个文档的结果
  log('\n各文档处理结果:', 'cyan');
  results.forEach(context => {
    const statusColor = context.status === 'completed' ? 'green' :
                       context.status === 'partial' ? 'yellow' : 'red';
    log(`  ${context.documentId}: ${context.status} (${context.totalDuration}ms)`, statusColor);
    log(`    - 字段: ${context.metrics.fieldCount}, 实体: ${context.metrics.entityCount}, 关系: ${context.metrics.relationCount}`, 'blue');
  });
  
  return results;
}

/**
 * 示例3: 从文件读取并处理
 */
async function example3_processFromFile() {
  logSection('示例3: 从文件读取并处理');
  
  const pipeline = new UniversalDocumentPipeline({
    extraction: { useLLM: false },
    normalization: { useLLM: false },
    entityBuilding: { useLLM: false },
    relationExtraction: { enableSemantic: false }
  });
  
  // 检查测试文件是否存在
  const testFile = path.join(__dirname, '..', '..', '测试数据.md');
  
  if (!fs.existsSync(testFile)) {
    log('测试文件不存在，跳过此示例', 'yellow');
    return null;
  }
  
  // 读取文件
  const content = fs.readFileSync(testFile, 'utf-8');
  const document = {
    id: 'file-doc-1',
    type: 'markdown',
    title: '测试数据.md',
    content: content.substring(0, 3000)  // 限制长度
  };
  
  log(`处理文件: ${testFile}`, 'cyan');
  log(`文件大小: ${content.length} 字符`, 'blue');
  log(`处理长度: ${document.content.length} 字符`, 'blue');
  
  const context = await pipeline.processDocument(document);
  
  log('\n✓ 文件处理完成！', 'green');
  log(`状态: ${context.status}`, 'blue');
  log(`提取字段: ${context.metrics.fieldCount}`, 'blue');
  log(`构建实体: ${context.metrics.entityCount}`, 'blue');
  log(`抽取关系: ${context.metrics.relationCount}`, 'blue');
  
  return context;
}

/**
 * 主函数
 */
async function main() {
  logSection('🚀 Universal Document Pipeline - 使用示例');
  
  try {
    // 运行示例1
    await example1_singleDocument();
    
    // 运行示例2
    await example2_batchProcessing();
    
    // 运行示例3
    await example3_processFromFile();
    
    logSection('✅ 所有示例运行完成！');
    
  } catch (error) {
    log('\n❌ 运行示例时出错:', 'red');
    console.error(error);
    process.exit(1);
  }
}

// 运行示例
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch(error => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  example1_singleDocument,
  example2_batchProcessing,
  example3_processFromFile
};
