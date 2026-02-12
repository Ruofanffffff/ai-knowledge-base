/**
 * 知识图谱性能瓶颈诊断
 * 详细测量每个步骤的耗时
 */

const ckbParser = require('./kg/ckb/ckb_parser');
const fieldExtractor = require('./kg/field_extractor/field_extractor');
const schemaManager = require('./kg/schema/schema_manager');
const schemaMatcher = require('./kg/schema/schema_matcher');
const fieldNormalizer = require('./kg/field_normalizer/field_normalizer');
const entityBuilder = require('./kg/entity/entity_builder');

async function diagnoseBottleneck() {
  console.log('=== 知识图谱性能瓶颈诊断 ===\n');
  
  // 测试文档路径
  const testDocPath = '/Users/dengzhaoyu/Desktop/TepVis/AI产品/KnowlegeGragh/ai-knowledge-base/uploads/20210824海南省海口市美兰机场智慧防疫项目测试方案.docx';
  const docId = 'test-doc';
  const fileType = 'docx';
  
  console.log(`测试文档: ${testDocPath}\n`);
  
  // Step 1: 解析CKB
  console.log('Step 1: 解析文档为CKB...');
  const step1Start = Date.now();
  const ckbs = await ckbParser.parseDocument(docId, testDocPath, fileType);
  const step1Time = Date.now() - step1Start;
  console.log(`✓ 完成: ${ckbs.length} 个CKB, 耗时: ${step1Time}ms (${(step1Time/1000).toFixed(2)}秒)\n`);
  
  // 只测试前10个CKB
  const testCkbs = ckbs.slice(0, 10);
  console.log(`使用前 ${testCkbs.length} 个CKB进行测试\n`);
  
  // Step 2: 字段提取 (串行)
  console.log('Step 2a: 字段提取 (当前实现 - 串行)...');
  const step2aStart = Date.now();
  for (const ckb of testCkbs) {
    const rawFields = await fieldExtractor.extractFields(ckb);
    ckb.extracted_fields = rawFields;
  }
  const step2aTime = Date.now() - step2aStart;
  console.log(`✓ 完成: 耗时: ${step2aTime}ms (${(step2aTime/1000).toFixed(2)}秒)`);
  console.log(`  平均每个CKB: ${(step2aTime/testCkbs.length).toFixed(2)}ms\n`);
  
  // Step 2b: 字段提取 (并行)
  console.log('Step 2b: 字段提取 (并行优化)...');
  const testCkbs2 = ckbs.slice(10, 20);
  const step2bStart = Date.now();
  await Promise.all(
    testCkbs2.map(async (ckb) => {
      const rawFields = await fieldExtractor.extractFields(ckb);
      ckb.extracted_fields = rawFields;
    })
  );
  const step2bTime = Date.now() - step2bStart;
  console.log(`✓ 完成: 耗时: ${step2bTime}ms (${(step2bTime/1000).toFixed(2)}秒)`);
  console.log(`  平均每个CKB: ${(step2bTime/testCkbs2.length).toFixed(2)}ms`);
  console.log(`  提升: ${((step2aTime - step2bTime) / step2aTime * 100).toFixed(1)}%\n`);
  
  // Step 3: Schema匹配
  console.log('Step 3: Schema匹配...');
  const step3Start = Date.now();
  const schemas = await schemaManager.listSchemas({ active: true });
  console.log(`  加载了 ${schemas.length} 个Schema`);
  
  let totalMatches = 0;
  for (const ckb of testCkbs) {
    if (ckb.extracted_fields) {
      const matches = await schemaMatcher.matchSchemas(ckb.extracted_fields, schemas);
      totalMatches += matches.length;
    }
  }
  const step3Time = Date.now() - step3Start;
  console.log(`✓ 完成: ${totalMatches} 个匹配, 耗时: ${step3Time}ms (${(step3Time/1000).toFixed(2)}秒)`);
  console.log(`  平均每个CKB: ${(step3Time/testCkbs.length).toFixed(2)}ms\n`);
  
  // Step 4: 字段归一化 (测试单个)
  console.log('Step 4: 字段归一化 (单个CKB测试)...');
  const testCkb = testCkbs[0];
  if (testCkb.extracted_fields) {
    const matches = await schemaMatcher.matchSchemas(testCkb.extracted_fields, schemas);
    if (matches.length > 0) {
      const match = matches[0];
      const step4Start = Date.now();
      const normalizedFields = await fieldNormalizer.normalizeFields(
        testCkb.extracted_fields,
        match.schema,
        { llmClient: null }
      );
      const step4Time = Date.now() - step4Start;
      console.log(`✓ 完成: 耗时: ${step4Time}ms\n`);
    } else {
      console.log('  跳过: 没有匹配的Schema\n');
    }
  }
  
  // Step 5: 实体构建 (测试单个)
  console.log('Step 5: 实体构建 (单个CKB测试)...');
  if (testCkb.extracted_fields) {
    const matches = await schemaMatcher.matchSchemas(testCkb.extracted_fields, schemas);
    if (matches.length > 0) {
      const match = matches[0];
      const normalizedFields = await fieldNormalizer.normalizeFields(
        testCkb.extracted_fields,
        match.schema,
        { llmClient: null }
      );
      
      const step5Start = Date.now();
      const entity = await entityBuilder.buildEntity(
        match.schema,
        normalizedFields,
        testCkb,
        { llmClient: null }
      );
      const step5Time = Date.now() - step5Start;
      console.log(`✓ 完成: 耗时: ${step5Time}ms\n`);
    } else {
      console.log('  跳过: 没有匹配的Schema\n');
    }
  }
  
  // 总结
  console.log('=== 性能瓶颈分析 ===\n');
  console.log(`1. CKB解析: ${step1Time}ms (${(step1Time/ckbs.length).toFixed(2)}ms/CKB)`);
  console.log(`2. 字段提取 (串行): ${step2aTime}ms (${(step2aTime/testCkbs.length).toFixed(2)}ms/CKB)`);
  console.log(`3. 字段提取 (并行): ${step2bTime}ms (${(step2bTime/testCkbs2.length).toFixed(2)}ms/CKB)`);
  console.log(`4. Schema匹配: ${step3Time}ms (${(step3Time/testCkbs.length).toFixed(2)}ms/CKB)`);
  
  console.log('\n预估241个CKB的总耗时:');
  const serialTime = (step2aTime/testCkbs.length) * 241;
  const parallelTime = (step2bTime/testCkbs2.length) * 241;
  console.log(`  字段提取 (串行): ${(serialTime/1000).toFixed(2)}秒`);
  console.log(`  字段提取 (并行): ${(parallelTime/1000).toFixed(2)}秒`);
  console.log(`  节省时间: ${((serialTime - parallelTime)/1000).toFixed(2)}秒`);
  
  console.log('\n关键发现:');
  console.log('  ⚠️  Step 2 (字段提取) 仍然是串行的!');
  console.log('  ⚠️  这是最大的性能瓶颈!');
  console.log('  ✓  并行化后可以提升 ' + ((step2aTime - step2bTime) / step2aTime * 100).toFixed(1) + '%');
}

diagnoseBottleneck().catch(error => {
  console.error('诊断失败:', error);
  process.exit(1);
});
