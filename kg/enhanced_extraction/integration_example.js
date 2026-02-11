/**
 * Enhanced Extraction Integration Example
 * 
 * 演示如何将LLM增强提取系统集成到Universal Document Pipeline中
 */

const { UniversalDocumentPipeline } = require('../pipeline/universal_document_pipeline');
const { createEnhancedExtractor } = require('./index');

// API Key配置
const LLM_API_KEY = 'sk-43c76462bfad4a57bd2420c7fdb0aec4';

/**
 * 示例1: 使用增强提取器作为Pipeline的自定义提取器
 */
async function example1_pipelineIntegration() {
  console.log('\n=== 示例1: Pipeline集成 ===\n');
  
  // 创建增强提取器
  const enhancedExtractor = createEnhancedExtractor({
    llm: {
      enabled: true,  // 启用LLM提取
      apiKey: LLM_API_KEY,
      model: 'qwen-turbo',
      timeout: 10000
    },
    algorithm: {
      enabled: true  // 同时启用算法提取
    },
    performance: {
      enableCache: true,
      maxProcessingTime: 10000
    }
  });
  
  // 创建Pipeline并配置自定义提取器
  const pipeline = new UniversalDocumentPipeline({
    extraction: {
      customExtractor: async (ckb, options) => {
        console.log('[Pipeline] 使用增强提取器处理文档...');
        return await enhancedExtractor.extractFields(ckb, options);
      }
    },
    // 其他Pipeline配置保持默认
    schemaMatching: {
      useLLM: false,  // Schema匹配不使用LLM以节省成本
      minConfidence: 0.5
    },
    normalization: {
      useLLM: false,  // 标准化不使用LLM
      useAlgorithm: true
    },
    entityBuilding: {
      useLLM: false,
      allowPartialEntities: true
    },
    relationExtraction: {
      enableBuiltin: true,
      enableCooccurrence: true,
      enableSemantic: false  // 禁用语义关系以节省时间
    }
  });
  
  // 测试文档
  const document = {
    id: 'test-doc-001',
    type: 'text',
    title: '摄影器材测试',
    content: `
      索尼SEL35F18F镜头是一款优秀的定焦镜头，焦距为35mm，最大光圈F1.8。
      这款镜头非常适合人文摄影和街拍，在室内拍摄时表现出色。
      推荐的拍摄参数：快门速度1/200s，ISO 400，光圈F2.8。
      
      另一款推荐的镜头是SEL50F18F，焦距50mm，最大光圈F1.8，
      特别适合人物肖像拍摄，能够产生漂亮的背景虚化效果。
    `
  };
  
  try {
    console.log('开始处理文档:', document.id);
    console.log('文档内容长度:', document.content.length, '字符\n');
    
    const context = await pipeline.processDocument(document);
    
    // 输出处理结果
    console.log('\n--- 处理结果 ---');
    console.log('状态:', context.status);
    console.log('总耗时:', context.totalDuration, 'ms');
    console.log('提取字段数:', context.metrics.fieldCount);
    console.log('构建实体数:', context.metrics.entityCount);
    console.log('抽取关系数:', context.metrics.relationCount);
    
    // 输出各步骤耗时
    console.log('\n--- 步骤耗时 ---');
    Object.keys(context.steps).forEach(stepName => {
      const step = context.steps[stepName];
      if (step.status !== 'not_started') {
        console.log(`${stepName}: ${step.duration}ms (${step.status})`);
      }
    });
    
    // 输出提取的实体
    if (context.data.entities && context.data.entities.length > 0) {
      console.log('\n--- 提取的实体 ---');
      context.data.entities.slice(0, 5).forEach((entity, i) => {
        console.log(`${i + 1}. ${entity.entity_name} (${entity.entity_type})`);
        console.log(`   置信度: ${entity.confidence}`);
        if (entity.fields && entity.fields.length > 0) {
          console.log(`   字段数: ${entity.fields.length}`);
        }
      });
      if (context.data.entities.length > 5) {
        console.log(`   ... 还有 ${context.data.entities.length - 5} 个实体`);
      }
    }
    
    // 输出警告和错误
    if (context.warnings.length > 0) {
      console.log('\n--- 警告 ---');
      context.warnings.forEach(w => {
        console.log(`[${w.step}] ${w.error}`);
      });
    }
    
    if (context.errors.length > 0) {
      console.log('\n--- 错误 ---');
      context.errors.forEach(e => {
        console.log(`[${e.step}] ${e.error}`);
      });
    }
    
    // 获取增强提取器的统计信息
    const stats = enhancedExtractor.getStatistics();
    console.log('\n--- 增强提取器统计 ---');
    console.log('总提取次数:', stats.totalExtractions);
    console.log('成功次数:', stats.successfulExtractions);
    console.log('失败次数:', stats.failedExtractions);
    
    return context;
    
  } catch (error) {
    console.error('\n处理失败:', error.message);
    console.error(error.stack);
    throw error;
  }
}

/**
 * 示例2: 直接使用增强提取系统（不通过Pipeline）
 */
async function example2_standaloneUsage() {
  console.log('\n=== 示例2: 独立使用 ===\n');
  
  const { ExtractionCoordinator, Configuration } = require('./index');
  
  // 创建配置
  const config = new Configuration({
    llm: {
      enabled: true,
      apiKey: LLM_API_KEY,
      model: 'qwen-turbo',
      timeout: 10000
    },
    algorithm: {
      enabled: true
    },
    fusion: {
      conflictStrategy: 'prefer_algorithm',
      deduplication: true
    }
  });
  
  // 创建协调器
  const coordinator = new ExtractionCoordinator({ config });
  
  // 测试文档
  const documentText = `
    索尼SEL35F18F镜头，焦距35mm，最大光圈F1.8，适合人文摄影。
    推荐拍摄参数：快门速度1/200s，ISO 400，光圈F2.8。
  `;
  
  try {
    console.log('开始提取...\n');
    
    const result = await coordinator.extract(documentText, {
      enableLLM: true,
      enableAlgorithm: true,
      timeout: 10000,
      language: 'zh'
    });
    
    // 输出结果
    console.log('--- 提取结果 ---');
    console.log('状态:', result.metadata.status);
    console.log('处理时间:', result.metadata.processingTime, 'ms');
    console.log('算法提取时间:', result.metadata.algorithmTime, 'ms');
    console.log('LLM提取时间:', result.metadata.llmTime, 'ms');
    console.log('Token使用量:', result.metadata.tokensUsed);
    
    console.log('\n--- 提取的实体 ---');
    result.entities.forEach((entity, i) => {
      console.log(`${i + 1}. ${entity.name} (${entity.type})`);
      console.log(`   来源: ${entity.source}`);
      console.log(`   置信度: ${entity.confidence}`);
      if (entity.properties) {
        console.log(`   属性:`, Object.keys(entity.properties).join(', '));
      }
    });
    
    console.log('\n--- 提取的关系 ---');
    result.relations.forEach((relation, i) => {
      console.log(`${i + 1}. ${relation.source} --[${relation.type}]--> ${relation.target}`);
      console.log(`   来源: ${relation.source}`);
      console.log(`   置信度: ${relation.confidence}`);
    });
    
    // 质量报告
    console.log('\n--- 质量报告 ---');
    console.log('实体完整性:', (result.quality.entityCompleteness * 100).toFixed(1) + '%');
    console.log('关系完整性:', (result.quality.relationCompleteness * 100).toFixed(1) + '%');
    console.log('平均置信度:', (result.quality.averageConfidence * 100).toFixed(1) + '%');
    
    if (result.quality.warnings.length > 0) {
      console.log('\n警告:');
      result.quality.warnings.forEach(w => console.log('  -', w));
    }
    
    return result;
    
  } catch (error) {
    console.error('\n提取失败:', error.message);
    throw error;
  }
}

/**
 * 示例3: 仅使用算法提取（不使用LLM）
 */
async function example3_algorithmOnly() {
  console.log('\n=== 示例3: 仅算法提取（节省成本） ===\n');
  
  const enhancedExtractor = createEnhancedExtractor({
    llm: {
      enabled: false,  // 禁用LLM
      apiKey: LLM_API_KEY
    },
    algorithm: {
      enabled: true
    }
  });
  
  const ckb = {
    content: {
      text: '焦距: 35mm, 光圈: F1.8, 快门速度: 1/200s, ISO: 400'
    }
  };
  
  try {
    console.log('开始提取（仅算法）...\n');
    
    const fields = await enhancedExtractor.extractFields(ckb, {
      useLLM: false,
      useAlgorithm: true
    });
    
    console.log('--- 提取的字段 ---');
    fields.forEach((field, i) => {
      console.log(`${i + 1}. ${field.name}: ${field.value}`);
      console.log(`   来源: ${field.source}`);
      console.log(`   置信度: ${field.confidence}`);
      console.log(`   类型: ${field.type}`);
    });
    
    console.log(`\n总共提取 ${fields.length} 个字段`);
    
    return fields;
    
  } catch (error) {
    console.error('\n提取失败:', error.message);
    throw error;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('========================================');
  console.log('  LLM增强提取系统 - 集成示例');
  console.log('========================================');
  
  try {
    // 运行示例1: Pipeline集成
    await example1_pipelineIntegration();
    
    // 运行示例2: 独立使用
    // await example2_standaloneUsage();
    
    // 运行示例3: 仅算法提取
    // await example3_algorithmOnly();
    
    console.log('\n========================================');
    console.log('  所有示例执行完成！');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n执行失败:', error.message);
    process.exit(1);
  }
}

// 如果直接运行此文件，执行main函数
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = {
  example1_pipelineIntegration,
  example2_standaloneUsage,
  example3_algorithmOnly
};
