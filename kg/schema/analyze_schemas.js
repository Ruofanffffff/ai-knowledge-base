/**
 * Schema Analysis Script
 * 
 * 分析数据库中的Schema状态：
 * 1. 统计Schema总数
 * 2. 按entity_type分组统计
 * 3. 检查anchor_fields配置情况
 * 4. 分析字段分布和特征
 * 5. 为指纹算法优化提供建议
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * 主分析函数
 */
async function analyzeSchemas() {
  console.log('='.repeat(80));
  console.log('Schema Database Analysis');
  console.log('='.repeat(80));
  console.log();

  try {
    // 1. 统计Schema总数
    const totalCount = await prisma.schema.count();
    console.log(`📊 Total Schemas: ${totalCount}`);
    console.log();

    // 2. 按entity_type分组统计
    console.log('📈 Schemas by Entity Type:');
    console.log('-'.repeat(80));
    
    const schemasByType = await prisma.schema.groupBy({
      by: ['entityType'],
      _count: {
        entityType: true
      },
      orderBy: {
        _count: {
          entityType: 'desc'
        }
      }
    });

    for (const group of schemasByType) {
      console.log(`  ${group.entityType.padEnd(30)} : ${group._count.entityType} schemas`);
    }
    console.log();

    // 3. 检查anchor_fields配置情况
    console.log('🔗 Anchor Fields Configuration Status:');
    console.log('-'.repeat(80));
    
    const allSchemas = await prisma.schema.findMany({
      select: {
        id: true,
        name: true,
        entityType: true,
        anchorFields: true,
        anchorConfig: true,
        coreFields: true
      }
    });

    let withAnchorFields = 0;
    let withAnchorConfig = 0;
    let withoutAnchor = 0;

    for (const schema of allSchemas) {
      if (schema.anchorFields) withAnchorFields++;
      if (schema.anchorConfig) withAnchorConfig++;
      if (!schema.anchorFields && !schema.anchorConfig) withoutAnchor++;
    }

    console.log(`  ✅ With anchor_fields    : ${withAnchorFields} (${(withAnchorFields/totalCount*100).toFixed(1)}%)`);
    console.log(`  ✅ With anchor_config    : ${withAnchorConfig} (${(withAnchorConfig/totalCount*100).toFixed(1)}%)`);
    console.log(`  ❌ Without anchor config : ${withoutAnchor} (${(withoutAnchor/totalCount*100).toFixed(1)}%)`);
    console.log();

    // 4. 按entity_type分析anchor配置情况
    console.log('🎯 Anchor Configuration by Entity Type:');
    console.log('-'.repeat(80));
    
    const typeStats = {};
    for (const schema of allSchemas) {
      const type = schema.entityType;
      if (!typeStats[type]) {
        typeStats[type] = {
          total: 0,
          withAnchor: 0,
          withoutAnchor: 0
        };
      }
      typeStats[type].total++;
      if (schema.anchorFields) {
        typeStats[type].withAnchor++;
      } else {
        typeStats[type].withoutAnchor++;
      }
    }

    for (const [type, stats] of Object.entries(typeStats).sort((a, b) => b[1].total - a[1].total)) {
      const percentage = (stats.withAnchor / stats.total * 100).toFixed(1);
      console.log(`  ${type.padEnd(30)} : ${stats.withAnchor}/${stats.total} configured (${percentage}%)`);
    }
    console.log();

    // 5. 分析字段分布
    console.log('📋 Field Distribution Analysis:');
    console.log('-'.repeat(80));
    
    const fieldFrequency = {};
    for (const schema of allSchemas) {
      const coreFields = JSON.parse(schema.coreFields);
      for (const field of coreFields) {
        const fieldName = field.name;
        if (!fieldFrequency[fieldName]) {
          fieldFrequency[fieldName] = 0;
        }
        fieldFrequency[fieldName]++;
      }
    }

    const sortedFields = Object.entries(fieldFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20);

    console.log('  Top 20 Most Common Fields:');
    for (const [fieldName, count] of sortedFields) {
      const percentage = (count / totalCount * 100).toFixed(1);
      console.log(`    ${fieldName.padEnd(30)} : ${count} schemas (${percentage}%)`);
    }
    console.log();

    // 6. 采样显示有anchor_fields的schema
    console.log('✨ Sample Schemas WITH anchor_fields:');
    console.log('-'.repeat(80));
    
    const schemasWithAnchor = allSchemas.filter(s => s.anchorFields).slice(0, 3);
    for (const schema of schemasWithAnchor) {
      console.log(`  Schema: ${schema.name}`);
      console.log(`  Type: ${schema.entityType}`);
      console.log(`  Anchor Fields: ${schema.anchorFields}`);
      if (schema.anchorConfig) {
        console.log(`  Anchor Config: ${schema.anchorConfig}`);
      }
      console.log();
    }

    // 7. 采样显示没有anchor_fields的schema
    console.log('⚠️  Sample Schemas WITHOUT anchor_fields:');
    console.log('-'.repeat(80));
    
    const schemasWithoutAnchor = allSchemas.filter(s => !s.anchorFields).slice(0, 5);
    for (const schema of schemasWithoutAnchor) {
      const coreFields = JSON.parse(schema.coreFields);
      console.log(`  Schema: ${schema.name}`);
      console.log(`  Type: ${schema.entityType}`);
      console.log(`  Core Fields: ${coreFields.map(f => f.name).join(', ')}`);
      console.log();
    }

    // 8. 指纹算法优化建议
    console.log('💡 Fingerprint Algorithm Optimization Recommendations:');
    console.log('-'.repeat(80));
    
    // 分析时间字段
    const timeFields = Object.keys(fieldFrequency).filter(f => 
      f.includes('时间') || f.includes('Time') || f.includes('Date') || f.includes('Timestamp')
    );
    console.log(`  📅 Time-related fields detected: ${timeFields.length}`);
    console.log(`     ${timeFields.slice(0, 5).join(', ')}${timeFields.length > 5 ? '...' : ''}`);
    console.log(`     Recommendation: Use 'time_month' or 'time_day' normalization`);
    console.log();

    // 分析地点字段
    const locationFields = Object.keys(fieldFrequency).filter(f => 
      f.includes('区域') || f.includes('地点') || f.includes('Location') || f.includes('Place') || f.includes('Area')
    );
    console.log(`  📍 Location-related fields detected: ${locationFields.length}`);
    console.log(`     ${locationFields.slice(0, 5).join(', ')}${locationFields.length > 5 ? '...' : ''}`);
    console.log(`     Recommendation: Use 'location' normalization`);
    console.log();

    // 分析指标字段
    const indicatorFields = Object.keys(fieldFrequency).filter(f => 
      f.includes('指标') || f.includes('Indicator') || f.includes('Metric')
    );
    console.log(`  📊 Indicator-related fields detected: ${indicatorFields.length}`);
    console.log(`     ${indicatorFields.slice(0, 5).join(', ')}${indicatorFields.length > 5 ? '...' : ''}`);
    console.log(`     Recommendation: Use 'indicator' normalization`);
    console.log();

    // 按entity_type推荐anchor_fields配置
    console.log('🎯 Recommended Anchor Fields by Entity Type:');
    console.log('-'.repeat(80));
    
    for (const [type, stats] of Object.entries(typeStats).sort((a, b) => b[1].total - a[1].total).slice(0, 5)) {
      console.log(`  ${type}:`);
      
      // 分析该类型下的常见字段
      const typeSchemas = allSchemas.filter(s => s.entityType === type);
      const typeFieldFreq = {};
      
      for (const schema of typeSchemas) {
        const coreFields = JSON.parse(schema.coreFields);
        for (const field of coreFields) {
          if (!typeFieldFreq[field.name]) {
            typeFieldFreq[field.name] = { count: 0, totalWeight: 0 };
          }
          typeFieldFreq[field.name].count++;
          typeFieldFreq[field.name].totalWeight += field.weight;
        }
      }
      
      // 推荐权重最高的3个字段
      const recommended = Object.entries(typeFieldFreq)
        .sort((a, b) => b[1].totalWeight - a[1].totalWeight)
        .slice(0, 3);
      
      for (const [fieldName, data] of recommended) {
        const avgWeight = (data.totalWeight / data.count).toFixed(2);
        const coverage = (data.count / stats.total * 100).toFixed(1);
        console.log(`    - ${fieldName} (avg weight: ${avgWeight}, coverage: ${coverage}%)`);
      }
      console.log();
    }

    console.log('='.repeat(80));
    console.log('Analysis Complete!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('Error analyzing schemas:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 运行分析
if (require.main === module) {
  analyzeSchemas()
    .then(() => {
      console.log('\n✅ Analysis completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Analysis failed:', error);
      process.exit(1);
    });
}

module.exports = { analyzeSchemas };
