/**
 * 为剩余的Schema配置锚点字段
 * 
 * 包括：
 * - 9个文档类Schema
 * - 50个AI科学Schema
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 文档类Schema的锚点字段配置
const documentationAnchorConfigs = {
  'Technical-Specification': {
    anchor_fields: [
      { name: 'SpecName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Version', normalization_strategy: 'lowercase', priority: 2 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Architecture-Decision': {
    anchor_fields: [
      { name: 'DecisionID', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Code-Comment': {
    anchor_fields: [
      { name: 'Location', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'CommentType', normalization_strategy: 'lowercase', priority: 2 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'README-File': {
    anchor_fields: [
      { name: 'ProjectName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Changelog-Entry': {
    anchor_fields: [
      { name: 'Version', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Date', normalization_strategy: 'time_day', priority: 2 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Knowledge-Article': {
    anchor_fields: [
      { name: 'Title', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Tutorial-Guide': {
    anchor_fields: [
      { name: 'Title', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Best-Practice': {
    anchor_fields: [
      { name: 'Title', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Troubleshooting-Guide': {
    anchor_fields: [
      { name: 'Title', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  }
};

// AI科学Schema的锚点字段配置
const aiScienceAnchorConfigs = {
  'ML-Model': {
    anchor_fields: [
      { name: 'ModelName', normalization_strategy: 'lowercase', priority: 1 },
      { name: 'Version', normalization_strategy: 'lowercase', priority: 2 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Neural-Network': {
    anchor_fields: [
      { name: 'NetworkName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'CNN-Architecture': {
    anchor_fields: [
      { name: 'ArchitectureName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'RNN-Architecture': {
    anchor_fields: [
      { name: 'ArchitectureName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Transformer-Model': {
    anchor_fields: [
      { name: 'ModelName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'GAN-Model': {
    anchor_fields: [
      { name: 'ModelName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Autoencoder': {
    anchor_fields: [
      { name: 'ModelName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Attention-Mechanism': {
    anchor_fields: [
      { name: 'MechanismType', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Model-Layer': {
    anchor_fields: [
      { name: 'LayerName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Activation-Function': {
    anchor_fields: [
      { name: 'FunctionName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Training-Dataset': {
    anchor_fields: [
      { name: 'DatasetName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Training-Hyperparameters': {
    anchor_fields: [
      { name: 'ConfigName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Optimizer-Config': {
    anchor_fields: [
      { name: 'OptimizerType', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Learning-Rate-Schedule': {
    anchor_fields: [
      { name: 'ScheduleType', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Loss-Function': {
    anchor_fields: [
      { name: 'FunctionName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Regularization-Method': {
    anchor_fields: [
      { name: 'MethodName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Data-Augmentation': {
    anchor_fields: [
      { name: 'TechniqueName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Batch-Normalization': {
    anchor_fields: [
      { name: 'LayerName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Dropout-Layer': {
    anchor_fields: [
      { name: 'LayerName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Training-Epoch': {
    anchor_fields: [
      { name: 'EpochNumber', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Model-Evaluation': {
    anchor_fields: [
      { name: 'EvaluationID', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Accuracy-Metric': {
    anchor_fields: [
      { name: 'MetricName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Precision-Recall': {
    anchor_fields: [
      { name: 'MetricType', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'F1-Score': {
    anchor_fields: [
      { name: 'ScoreType', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'ROC-Curve': {
    anchor_fields: [
      { name: 'CurveName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Confusion-Matrix': {
    anchor_fields: [
      { name: 'MatrixID', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Cross-Validation': {
    anchor_fields: [
      { name: 'ValidationMethod', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Validation-Set': {
    anchor_fields: [
      { name: 'SetName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Test-Set': {
    anchor_fields: [
      { name: 'SetName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Benchmark-Result': {
    anchor_fields: [
      { name: 'BenchmarkName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Data-Preprocessing': {
    anchor_fields: [
      { name: 'StepName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Feature-Engineering': {
    anchor_fields: [
      { name: 'FeatureName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Feature-Selection': {
    anchor_fields: [
      { name: 'Method', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Data-Normalization': {
    anchor_fields: [
      { name: 'Method', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Data-Cleaning': {
    anchor_fields: [
      { name: 'StepName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Missing-Value-Handling': {
    anchor_fields: [
      { name: 'Method', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Outlier-Detection': {
    anchor_fields: [
      { name: 'Method', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Data-Splitting': {
    anchor_fields: [
      { name: 'SplitStrategy', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Data-Sampling': {
    anchor_fields: [
      { name: 'SamplingMethod', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Data-Labeling': {
    anchor_fields: [
      { name: 'LabelingTask', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Model-Deployment': {
    anchor_fields: [
      { name: 'DeploymentID', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Inference-Service': {
    anchor_fields: [
      { name: 'ServiceName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Model-Serving': {
    anchor_fields: [
      { name: 'ServingEndpoint', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Model-Monitoring': {
    anchor_fields: [
      { name: 'MonitoringID', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Model-Versioning': {
    anchor_fields: [
      { name: 'Version', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'A-B-Testing': {
    anchor_fields: [
      { name: 'TestID', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Model-Performance': {
    anchor_fields: [
      { name: 'MetricName', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Prediction-Result': {
    anchor_fields: [
      { name: 'PredictionID', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'Model-Explainability': {
    anchor_fields: [
      { name: 'ExplanationMethod', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  },
  'AI-Ethics': {
    anchor_fields: [
      { name: 'EthicsPrinciple', normalization_strategy: 'lowercase', priority: 1 }
    ],
    anchor_config: { conflict_strategy: 'auto' }
  }
};

// 合并所有配置
const allAnchorConfigs = {
  ...documentationAnchorConfigs,
  ...aiScienceAnchorConfigs
};

async function configureRemainingAnchors() {
  console.log('🔧 开始为剩余Schema配置锚点字段...\n');
  console.log(`📊 总计需要配置: ${Object.keys(allAnchorConfigs).length} 个Schema\n`);

  let configured = 0;
  let skipped = 0;
  let errors = 0;

  for (const [schemaName, config] of Object.entries(allAnchorConfigs)) {
    try {
      const schema = await prisma.schema.findUnique({
        where: { name: schemaName }
      });

      if (!schema) {
        console.log(`⏭️  ${schemaName} (不存在)`);
        skipped++;
        continue;
      }

      // 检查是否已配置
      if (schema.anchorFields && schema.anchorFields !== '[]' && schema.anchorFields !== '') {
        console.log(`⏭️  ${schemaName} (已配置)`);
        skipped++;
        continue;
      }

      // 更新Schema
      await prisma.schema.update({
        where: { name: schemaName },
        data: {
          anchorFields: JSON.stringify(config.anchor_fields),
          anchorConfig: JSON.stringify(config.anchor_config)
        }
      });

      console.log(`✅ ${schemaName}`);
      configured++;
    } catch (error) {
      console.error(`❌ ${schemaName}: ${error.message}`);
      errors++;
    }
  }

  console.log(`\n📊 配置摘要:`);
  console.log(`   已配置: ${configured}`);
  console.log(`   跳过: ${skipped}`);
  console.log(`   错误: ${errors}`);
  console.log(`\n✅ 剩余Schema锚点配置完成！`);
  
  // 验证最终状态
  const unconfigured = await prisma.schema.count({
    where: {
      OR: [
        { anchorFields: null },
        { anchorFields: { equals: '[]' } },
        { anchorFields: { equals: '' } }
      ]
    }
  });
  
  const total = await prisma.schema.count();
  const configuredTotal = total - unconfigured;
  const percentage = ((configuredTotal / total) * 100).toFixed(1);
  
  console.log(`\n📈 最终统计:`);
  console.log(`   总Schema数: ${total}`);
  console.log(`   已配置锚点: ${configuredTotal} (${percentage}%)`);
  console.log(`   未配置锚点: ${unconfigured} (${((unconfigured / total) * 100).toFixed(1)}%)`);
}

configureRemainingAnchors()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
