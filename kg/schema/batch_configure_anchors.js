/**
 * Batch Configure Anchor Fields
 * 
 * 批量为Schema配置anchor_fields和anchor_config
 * 基于DATABASE_STATUS_AND_RECOMMENDATIONS.md中的建议
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Entity Type配置模板
 */
const ANCHOR_CONFIGS = {
  PostProcessingEntity: {
    anchor_fields: [
      { name: 'Date', normalization_strategy: 'time_day', priority: 1 },
      { name: 'Style', normalization_strategy: 'lowercase', priority: 2 },
      { name: 'Version', normalization_strategy: 'lowercase', priority: 3 }
    ],
    anchor_config: {
      time_granularity: 'day',
      conflict_strategy: 'llm_advisory'
    }
  },
  
  PhotographyEntity: {
    anchor_fields: [
      { name: 'Timestamp', normalization_strategy: 'time_day', priority: 1 },
      { name: 'Location', normalization_strategy: 'location', priority: 2 },
      { name: 'Style', normalization_strategy: 'lowercase', priority: 3 }
    ],
    anchor_config: {
      time_granularity: 'day',
      conflict_strategy: 'llm_advisory'
    }
  },
  
  ResearchEntity: {
    anchor_fields: [
      { name: 'Metric', normalization_strategy: 'indicator', priority: 1 },
      { name: 'Date', normalization_strategy: 'time_month', priority: 2 },
      { name: 'Location', normalization_strategy: 'location', priority: 3 }
    ],
    anchor_config: {
      time_granularity: 'month',
      conflict_strategy: 'llm_advisory'
    }
  },
  
  GovernmentEntity: {
    anchor_fields: [
      { name: 'Date', normalization_strategy: 'time_month', priority: 1 },
      { name: 'Title', normalization_strategy: 'lowercase', priority: 2 },
      { name: 'Location', normalization_strategy: 'location', priority: 3 }
    ],
    anchor_config: {
      time_granularity: 'month',
      conflict_strategy: 'llm_advisory'
    }
  },
  
  PersonalEntity: {
    anchor_fields: [
      { name: 'Date', normalization_strategy: 'time_day', priority: 1 },
      { name: 'Item', normalization_strategy: 'lowercase', priority: 2 },
      { name: 'Activity', normalization_strategy: 'lowercase', priority: 3 }
    ],
    anchor_config: {
      time_granularity: 'day',
      conflict_strategy: 'auto'
    }
  },
  
  TravelEntity: {
    anchor_fields: [
      { name: 'Location', normalization_strategy: 'location', priority: 1 },
      { name: 'Timestamp', normalization_strategy: 'time_day', priority: 2 },
      { name: 'Activity', normalization_strategy: 'lowercase', priority: 3 }
    ],
    anchor_config: {
      time_granularity: 'day',
      conflict_strategy: 'auto'
    }
  },
  
  EventEntity: {
    anchor_fields: [
      { name: '区域', normalization_strategy: 'location', priority: 1 },
      { name: '指标', normalization_strategy: 'indicator', priority: 2 },
      { name: '时间', normalization_strategy: 'time_month', priority: 3 }
    ],
    anchor_config: {
      time_granularity: 'month',
      conflict_strategy: 'llm_advisory'
    }
  },
  
  LocationEntity: {
    anchor_fields: [
      { name: '区域名称', normalization_strategy: 'location', priority: 1 }
    ],
    anchor_config: {
      conflict_strategy: 'auto'
    }
  },
  
  // 通用配置（用于其他类型）
  _default: {
    anchor_fields: [
      { name: 'Date', normalization_strategy: 'time_day', priority: 1 },
      { name: 'Location', normalization_strategy: 'location', priority: 2 }
    ],
    anchor_config: {
      time_granularity: 'day',
      conflict_strategy: 'auto'
    }
  }
};

/**
 * 字段名映射（处理不同命名）
 */
const FIELD_NAME_MAPPINGS = {
  // 时间字段
  'Timestamp': ['Timestamp', 'Date', 'Time', '时间', '日期'],
  'Date': ['Date', 'Timestamp', 'Time', '时间', '日期'],
  '时间': ['时间', 'Time', 'Date', 'Timestamp', '日期'],
  
  // 地点字段
  'Location': ['Location', 'Place', 'Area', '区域', '地点'],
  '区域': ['区域', 'Location', 'Place', 'Area', '地点'],
  '区域名称': ['区域名称', '区域', 'Location', 'Place'],
  
  // 指标字段
  'Metric': ['Metric', 'Indicator', '指标', '指标名称'],
  '指标': ['指标', 'Indicator', 'Metric', '指标名称'],
  
  // 其他字段
  'Style': ['Style', '风格', 'Type'],
  'Activity': ['Activity', '活动', 'Action'],
  'Item': ['Item', '项目', 'Thing'],
  'Title': ['Title', '标题', 'Name']
};

/**
 * 查找Schema中匹配的字段名
 */
function findMatchingField(schema, targetFieldName) {
  const coreFields = JSON.parse(schema.coreFields);
  const fieldNames = coreFields.map(f => f.name);
  
  // 精确匹配
  if (fieldNames.includes(targetFieldName)) {
    return targetFieldName;
  }
  
  // 使用映射表查找
  const alternatives = FIELD_NAME_MAPPINGS[targetFieldName] || [];
  for (const alt of alternatives) {
    if (fieldNames.includes(alt)) {
      return alt;
    }
  }
  
  return null;
}

/**
 * 为单个Schema配置anchor_fields
 */
function configureSchemaAnchorFields(schema, config) {
  const coreFields = JSON.parse(schema.coreFields);
  const fieldNames = coreFields.map(f => f.name);
  
  // 匹配anchor_fields
  const matchedAnchorFields = [];
  
  for (const anchorField of config.anchor_fields) {
    const matchedName = findMatchingField(schema, anchorField.name);
    
    if (matchedName) {
      matchedAnchorFields.push({
        name: matchedName,
        normalization_strategy: anchorField.normalization_strategy,
        priority: anchorField.priority
      });
    }
  }
  
  // 如果没有匹配到任何字段，使用core_fields中权重最高的字段
  if (matchedAnchorFields.length === 0) {
    const sortedFields = [...coreFields].sort((a, b) => (b.weight || 0) - (a.weight || 0));
    const topFields = sortedFields.slice(0, Math.min(3, sortedFields.length));
    
    for (let i = 0; i < topFields.length; i++) {
      const field = topFields[i];
      matchedAnchorFields.push({
        name: field.name,
        normalization_strategy: inferNormalizationStrategy(field.name),
        priority: i + 1
      });
    }
  }
  
  return {
    anchor_fields: matchedAnchorFields,
    anchor_config: config.anchor_config
  };
}

/**
 * 推断标准化策略
 */
function inferNormalizationStrategy(fieldName) {
  const lowerName = fieldName.toLowerCase();
  
  if (lowerName.includes('时间') || lowerName.includes('time') || lowerName.includes('date') || lowerName.includes('timestamp')) {
    return 'time_day';
  }
  
  if (lowerName.includes('区域') || lowerName.includes('地点') || lowerName.includes('location') || lowerName.includes('place')) {
    return 'location';
  }
  
  if (lowerName.includes('指标') || lowerName.includes('indicator') || lowerName.includes('metric')) {
    return 'indicator';
  }
  
  return 'lowercase';
}

/**
 * 批量配置所有Schema
 */
async function batchConfigureAnchors(options = {}) {
  const { dryRun = false, entityTypes = null } = options;
  
  console.log('='.repeat(80));
  console.log('Batch Configure Anchor Fields');
  console.log('='.repeat(80));
  console.log();
  
  if (dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made to database');
    console.log();
  }
  
  try {
    // 获取所有Schema
    const where = {};
    if (entityTypes) {
      where.entityType = { in: entityTypes };
    }
    
    const schemas = await prisma.schema.findMany({ where });
    
    console.log(`📊 Found ${schemas.length} schemas to configure`);
    console.log();
    
    const results = {
      total: schemas.length,
      configured: 0,
      skipped: 0,
      failed: 0,
      errors: []
    };
    
    // 按entity_type分组
    const schemasByType = {};
    for (const schema of schemas) {
      if (!schemasByType[schema.entityType]) {
        schemasByType[schema.entityType] = [];
      }
      schemasByType[schema.entityType].push(schema);
    }
    
    // 逐个类型配置
    for (const [entityType, typeSchemas] of Object.entries(schemasByType)) {
      console.log(`\n📦 Configuring ${entityType} (${typeSchemas.length} schemas)`);
      console.log('-'.repeat(80));
      
      // 获取配置模板
      const config = ANCHOR_CONFIGS[entityType] || ANCHOR_CONFIGS._default;
      
      for (const schema of typeSchemas) {
        try {
          // 配置anchor_fields
          const { anchor_fields, anchor_config } = configureSchemaAnchorFields(schema, config);
          
          console.log(`  ✓ ${schema.name}`);
          console.log(`    Anchor Fields: ${anchor_fields.map(f => f.name).join(', ')}`);
          
          if (!dryRun) {
            // 更新数据库
            await prisma.schema.update({
              where: { id: schema.id },
              data: {
                anchorFields: JSON.stringify(anchor_fields),
                anchorConfig: JSON.stringify(anchor_config)
              }
            });
          }
          
          results.configured++;
        } catch (error) {
          console.error(`  ✗ ${schema.name}: ${error.message}`);
          results.failed++;
          results.errors.push({
            schema: schema.name,
            error: error.message
          });
        }
      }
    }
    
    console.log();
    console.log('='.repeat(80));
    console.log('Configuration Summary');
    console.log('='.repeat(80));
    console.log(`Total Schemas    : ${results.total}`);
    console.log(`Configured       : ${results.configured}`);
    console.log(`Skipped          : ${results.skipped}`);
    console.log(`Failed           : ${results.failed}`);
    
    if (results.errors.length > 0) {
      console.log();
      console.log('Errors:');
      for (const error of results.errors) {
        console.log(`  - ${error.schema}: ${error.error}`);
      }
    }
    
    console.log('='.repeat(80));
    
    return results;
    
  } catch (error) {
    console.error('Error configuring schemas:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * 验证配置
 */
async function validateConfigurations() {
  console.log('='.repeat(80));
  console.log('Validate Anchor Configurations');
  console.log('='.repeat(80));
  console.log();
  
  try {
    const schemas = await prisma.schema.findMany({
      where: {
        anchorFields: { not: null }
      }
    });
    
    console.log(`📊 Found ${schemas.length} schemas with anchor_fields`);
    console.log();
    
    const issues = [];
    
    for (const schema of schemas) {
      try {
        const anchorFields = JSON.parse(schema.anchorFields);
        const coreFields = JSON.parse(schema.coreFields);
        const coreFieldNames = coreFields.map(f => f.name);
        
        // 检查anchor_fields中的字段是否都在core_fields中
        for (const anchorField of anchorFields) {
          if (!coreFieldNames.includes(anchorField.name)) {
            issues.push({
              schema: schema.name,
              issue: `Anchor field '${anchorField.name}' not found in core_fields`
            });
          }
        }
        
        // 检查是否有anchor_fields
        if (anchorFields.length === 0) {
          issues.push({
            schema: schema.name,
            issue: 'No anchor fields configured'
          });
        }
        
      } catch (error) {
        issues.push({
          schema: schema.name,
          issue: `Invalid JSON: ${error.message}`
        });
      }
    }
    
    if (issues.length === 0) {
      console.log('✅ All configurations are valid!');
    } else {
      console.log(`⚠️  Found ${issues.length} issues:`);
      console.log();
      for (const issue of issues) {
        console.log(`  - ${issue.schema}: ${issue.issue}`);
      }
    }
    
    console.log();
    console.log('='.repeat(80));
    
    return issues;
    
  } catch (error) {
    console.error('Error validating configurations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'configure';
  
  if (command === 'configure') {
    const dryRun = args.includes('--dry-run');
    const entityTypes = args.find(arg => arg.startsWith('--types='))?.split('=')[1]?.split(',');
    
    batchConfigureAnchors({ dryRun, entityTypes })
      .then(() => {
        console.log('\n✅ Configuration completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Configuration failed:', error);
        process.exit(1);
      });
  } else if (command === 'validate') {
    validateConfigurations()
      .then(() => {
        console.log('\n✅ Validation completed successfully');
        process.exit(0);
      })
      .catch((error) => {
        console.error('\n❌ Validation failed:', error);
        process.exit(1);
      });
  } else {
    console.log('Usage:');
    console.log('  node batch_configure_anchors.js configure [--dry-run] [--types=Type1,Type2]');
    console.log('  node batch_configure_anchors.js validate');
    process.exit(1);
  }
}

module.exports = {
  batchConfigureAnchors,
  validateConfigurations,
  configureSchemaAnchorFields
};
