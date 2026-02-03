/**
 * 测试Universal Extractor与field_extractor.js的集成
 */

const fieldExtractor = require('./field_extractor');

async function testUniversalIntegration() {
  console.log('='.repeat(80));
  console.log('🧪 测试Universal Extractor集成');
  console.log('='.repeat(80));
  console.log();
  
  // 创建测试CKB
  const ckb = {
    ckb_id: 'test_universal_001',
    doc_id: 'doc_001',
    content: {
      text: `
拍摄日期：2025年10月15日
拍摄地点：上海街头
天气：阴天傍晚
场景类型：夜景街头

相机机身：Sony A7M4 全画幅
镜头：35mm f1.8
画面风格：S-Log3

ISO：3200 (噪点可控)
光圈：f1.8 (浅景深)
快门速度：1/15s (拖影效果)
曝光补偿：欠曝1档保高光
测光模式：点测人脸
对焦模式：单点对焦眼睛
驱动模式：连拍

构图规则：三分法
主体位置：主体偏左
引导线：道路引导
视角：低角度
空间层次：前中后景

风格类型：纪实街拍
拍摄意图：纪实风格
画面情绪：冷静孤独

后期软件：Lightroom
曝光调整：+0.3EV
对比度：提升对比
高光控制：压高光
暗部控制：提暗部
白平衡：拉暖
曲线调整：S曲线
清晰度：10
锐化：适度锐化
降噪：高感降噪
裁剪：4:5
透视修正：拉直建筑
暗角：添加暗角
颗粒：胶片颗粒
      `
    }
  };
  
  console.log('📄 测试文档准备完成');
  console.log();
  
  // 测试1: 使用universal策略
  console.log('测试1: 使用universal策略');
  console.log('-'.repeat(80));
  
  const fields1 = await fieldExtractor.extractFields(ckb, {
    strategy: 'universal',
    useCache: false
  });
  
  console.log(`✅ 提取到 ${fields1.length} 个字段`);
  console.log();
  
  // 显示前10个字段
  console.log('前10个字段:');
  fields1.slice(0, 10).forEach((field, index) => {
    const value = field.value.length > 30 ? 
      field.value.substring(0, 30) + '...' : 
      field.value;
    console.log(`  ${index + 1}. ${field.name}: ${value} (${field.extraction_method})`);
  });
  console.log();
  
  // 测试2: 使用rule-first策略 + useUniversal选项
  console.log('测试2: 使用rule-first策略 + useUniversal选项');
  console.log('-'.repeat(80));
  
  const fields2 = await fieldExtractor.extractFields(ckb, {
    strategy: 'rule-first',
    useUniversal: true,
    useLLM: false,
    useRules: false,
    useNER: false,
    useCache: false
  });
  
  console.log(`✅ 提取到 ${fields2.length} 个字段`);
  console.log();
  
  // 测试3: 获取统计信息
  console.log('测试3: 字段统计信息');
  console.log('-'.repeat(80));
  
  const stats = fieldExtractor.getFieldStatistics(fields1);
  console.log('统计信息:');
  console.log(`  总字段数: ${stats.total}`);
  console.log(`  平均置信度: ${(stats.avgConfidence * 100).toFixed(1)}%`);
  console.log();
  
  console.log('按类型分组:');
  for (const [type, count] of Object.entries(stats.byType)) {
    console.log(`  - ${type}: ${count}`);
  }
  console.log();
  
  console.log('按来源分组:');
  for (const [source, count] of Object.entries(stats.bySource)) {
    console.log(`  - ${source}: ${count}`);
  }
  console.log();
  
  // 测试4: 获取Universal Extractor实例
  console.log('测试4: 获取Universal Extractor实例');
  console.log('-'.repeat(80));
  
  const universalExtractor = fieldExtractor.getUniversalExtractor();
  const extractorStats = universalExtractor.getStats(fields1);
  
  console.log('Universal Extractor统计:');
  console.log(`  总字段数: ${extractorStats.total}`);
  console.log(`  平均置信度: ${extractorStats.avgConfidence.toFixed(1)}%`);
  console.log();
  
  console.log('按提取方法:');
  for (const [method, count] of Object.entries(extractorStats.byMethod)) {
    console.log(`  - ${method}: ${count}`);
  }
  console.log();
  
  console.log('按类型:');
  for (const [type, count] of Object.entries(extractorStats.byType)) {
    console.log(`  - ${type}: ${count}`);
  }
  console.log();
  
  console.log('='.repeat(80));
  console.log('✅ 所有测试通过!');
  console.log('='.repeat(80));
}

// 运行测试
testUniversalIntegration().catch(error => {
  console.error('❌ 测试失败:', error);
  console.error(error.stack);
  process.exit(1);
});
