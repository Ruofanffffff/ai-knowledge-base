/**
 * Schema问题诊断脚本
 * 
 * 检查三个关键问题：
 * 1. Schema数量是否正确（应该是412个）
 * 2. 每个Schema的核心字段和映射字段是否完善
 * 3. LLM匹配逻辑是否正常工作
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function diagnoseSchemaIssues() {
  console.log('='.repeat(80));
  console.log('Schema问题诊断报告');
  console.log('='.repeat(80));
  console.log();

  // ========== 问题1：Schema数量检查 ==========
  console.log('【问题1】Schema数量检查');
  console.log('-'.repeat(80));
  
  const totalSchemas = await prisma.schema.count();
  console.log(`✓ 数据库中Schema总数: ${totalSchemas}`);
  
  if (totalSchemas !== 412) {
    console.log(`⚠️  警告: 预期412个Schema，实际${totalSchemas}个`);
  } else {
    console.log(`✓ Schema数量正确`);
  }
  console.log();

  // ========== 问题2：核心字段和映射字段完善性 ==========
  console.log('【问题2】核心字段和映射字段完善性检查');
  console.log('-'.repeat(80));
  
  // 2.1 检查有多少Schema有核心字段
  const allSchemas = await prisma.schema.findMany({
    select: {
      id: true,
      name: true,
      entityType: true,
      coreFields: true,
      anchorFields: true
    }
  });

  let schemasWithCoreFields = 0;
  let schemasWithAnchorFields = 0;
  let schemasWithoutCoreFields = [];
  let schemasWithoutAnchorFields = [];

  for (const schema of allSchemas) {
    const coreFields = JSON.parse(schema.coreFields || '[]');
    const anchorFields = JSON.parse(schema.anchorFields || '[]');
    
    if (coreFields.length > 0) {
      schemasWithCoreFields++;
    } else {
      schemasWithoutCoreFields.push(schema.name);
    }
    
    if (anchorFields.length > 0) {
      schemasWithAnchorFields++;
    } else {
      schemasWithoutAnchorFields.push(schema.name);
    }
  }

  console.log(`✓ 有核心字段的Schema: ${schemasWithCoreFields}/${totalSchemas} (${(schemasWithCoreFields/totalSchemas*100).toFixed(1)}%)`);
  console.log(`✓ 有锚点字段的Schema: ${schemasWithAnchorFields}/${totalSchemas} (${(schemasWithAnchorFields/totalSchemas*100).toFixed(1)}%)`);
  
  if (schemasWithoutCoreFields.length > 0) {
    console.log(`⚠️  没有核心字段的Schema (${schemasWithoutCoreFields.length}个):`);
    schemasWithoutCoreFields.slice(0, 10).forEach(name => {
      console.log(`   - ${name}`);
    });
    if (schemasWithoutCoreFields.length > 10) {
      console.log(`   ... 还有${schemasWithoutCoreFields.length - 10}个`);
    }
  }
  console.log();

  // 2.2 检查字段映射配置
  const mappingFilePath = path.join(__dirname, '../field_normalizer/schema_field_mappings.json');
  const mappings = JSON.parse(fs.readFileSync(mappingFilePath, 'utf-8'));
  const schemasWithMappings = Object.keys(mappings).length;
  
  console.log(`✓ 有字段映射的Schema: ${schemasWithMappings}/${totalSchemas} (${(schemasWithMappings/totalSchemas*100).toFixed(1)}%)`);
  
  if (schemasWithMappings < totalSchemas * 0.5) {
    console.log(`⚠️  警告: 只有${(schemasWithMappings/totalSchemas*100).toFixed(1)}%的Schema有字段映射`);
    console.log(`   建议: 至少应该为50%的Schema配置字段映射`);
  }
  console.log();

  // 2.3 检查摄影Schema的映射完善性
  console.log('摄影Schema映射完善性检查:');
  const photographySchemas = allSchemas.filter(s => 
    s.entityType === 'PhotographyEntity' || 
    s.name.includes('Photography') ||
    s.name.includes('Camera') ||
    s.name.includes('Lens') ||
    s.name.includes('Aperture') ||
    s.name.includes('Shutter') ||
    s.name.includes('ISO')
  );
  
  console.log(`  摄影相关Schema总数: ${photographySchemas.length}`);
  
  let photographyWithMappings = 0;
  let photographyWithoutMappings = [];
  
  for (const schema of photographySchemas) {
    if (mappings[schema.name]) {
      photographyWithMappings++;
    } else {
      photographyWithoutMappings.push(schema.name);
    }
  }
  
  console.log(`  有映射的摄影Schema: ${photographyWithMappings}/${photographySchemas.length} (${(photographyWithMappings/photographySchemas.length*100).toFixed(1)}%)`);
  
  if (photographyWithoutMappings.length > 0) {
    console.log(`  ⚠️  没有映射的摄影Schema (${photographyWithoutMappings.length}个):`);
    photographyWithoutMappings.slice(0, 10).forEach(name => {
      console.log(`     - ${name}`);
    });
    if (photographyWithoutMappings.length > 10) {
      console.log(`     ... 还有${photographyWithoutMappings.length - 10}个`);
    }
  }
  console.log();

  // 2.4 检查映射字段的完善性（每个Schema应该有90%场景的映射）
  console.log('映射字段完善性检查（抽样）:');
  const sampleSchemas = Object.keys(mappings).slice(0, 5);
  
  for (const schemaName of sampleSchemas) {
    const schema = allSchemas.find(s => s.name === schemaName);
    if (!schema) continue;
    
    const coreFields = JSON.parse(schema.coreFields || '[]');
    const mapping = mappings[schemaName];
    
    console.log(`  Schema: ${schemaName}`);
    console.log(`    核心字段数: ${coreFields.length}`);
    console.log(`    映射配置数: ${Object.keys(mapping).length}`);
    
    // 检查每个核心字段是否有映射
    let mappedCoreFields = 0;
    for (const coreField of coreFields) {
      if (mapping[coreField.name]) {
        mappedCoreFields++;
        const variations = mapping[coreField.name].common_variations || [];
        console.log(`      ✓ ${coreField.name}: ${variations.length}个变体`);
      } else {
        console.log(`      ✗ ${coreField.name}: 无映射配置`);
      }
    }
    
    const mappingCoverage = coreFields.length > 0 ? mappedCoreFields / coreFields.length : 0;
    console.log(`    映射覆盖率: ${(mappingCoverage * 100).toFixed(1)}%`);
    
    if (mappingCoverage < 0.9) {
      console.log(`    ⚠️  警告: 映射覆盖率低于90%`);
    }
  }
  console.log();

  // ========== 问题3：LLM匹配逻辑检查 ==========
  console.log('【问题3】LLM匹配逻辑检查');
  console.log('-'.repeat(80));
  
  // 3.1 检查SchemaMatcherV2是否存在
  const matcherPath = path.join(__dirname, '../pipeline/schema_matcher_v2.js');
  if (fs.existsSync(matcherPath)) {
    console.log(`✓ SchemaMatcherV2文件存在`);
    
    // 检查关键方法
    const matcherCode = fs.readFileSync(matcherPath, 'utf-8');
    const hasLLMMatch = matcherCode.includes('_llmMatchFields');
    const hasBuildPrompt = matcherCode.includes('_buildLLMMatchPrompt');
    const hasParseResponse = matcherCode.includes('_parseLLMResponse');
    
    console.log(`  ✓ _llmMatchFields方法: ${hasLLMMatch ? '存在' : '缺失'}`);
    console.log(`  ✓ _buildLLMMatchPrompt方法: ${hasBuildPrompt ? '存在' : '缺失'}`);
    console.log(`  ✓ _parseLLMResponse方法: ${hasParseResponse ? '存在' : '缺失'}`);
    
    if (!hasLLMMatch || !hasBuildPrompt || !hasParseResponse) {
      console.log(`  ⚠️  警告: LLM匹配方法不完整`);
    }
  } else {
    console.log(`✗ SchemaMatcherV2文件不存在`);
  }
  console.log();

  // 3.2 检查LLM调用是否正常
  console.log('LLM调用检查:');
  try {
    const qwenClient = require('../utils/qwen_client');
    console.log(`  ✓ qwen_client模块加载成功`);
    
    // 检查chat方法
    if (typeof qwenClient.chat === 'function') {
      console.log(`  ✓ chat方法存在`);
    } else {
      console.log(`  ✗ chat方法不存在`);
    }
  } catch (error) {
    console.log(`  ✗ qwen_client加载失败: ${error.message}`);
  }
  console.log();

  // 3.3 检查tokenTracker问题
  console.log('TokenTracker检查:');
  try {
    const tokenTracker = require('../utils/token_tracker');
    console.log(`  ✓ token_tracker模块加载成功`);
    
    // 检查recordUsage方法
    if (typeof tokenTracker.recordUsage === 'function') {
      console.log(`  ✓ recordUsage方法存在`);
    } else {
      console.log(`  ✗ recordUsage方法不存在`);
      console.log(`  可用方法:`, Object.keys(tokenTracker));
    }
  } catch (error) {
    console.log(`  ✗ token_tracker加载失败: ${error.message}`);
  }
  console.log();

  // ========== 总结和建议 ==========
  console.log('='.repeat(80));
  console.log('诊断总结和建议');
  console.log('='.repeat(80));
  console.log();

  const issues = [];
  const recommendations = [];

  // 问题1总结
  if (totalSchemas !== 412) {
    issues.push(`Schema数量不正确: 预期412个，实际${totalSchemas}个`);
    recommendations.push('检查Schema导入脚本是否完整执行');
  }

  // 问题2总结
  if (schemasWithMappings < totalSchemas * 0.5) {
    issues.push(`字段映射覆盖率过低: 只有${(schemasWithMappings/totalSchemas*100).toFixed(1)}%`);
    recommendations.push('为更多Schema配置字段映射，目标至少50%');
  }

  if (photographyWithMappings < photographySchemas.length * 0.9) {
    issues.push(`摄影Schema映射不完善: 只有${(photographyWithMappings/photographySchemas.length*100).toFixed(1)}%`);
    recommendations.push('完善摄影Schema的字段映射配置');
  }

  // 问题3总结
  issues.push('LLM匹配存在字段验证失败问题');
  recommendations.push('检查LLM返回的字段名是否与Schema定义一致');
  recommendations.push('修复tokenTracker.recordUsage调用错误');

  if (issues.length > 0) {
    console.log('发现的问题:');
    issues.forEach((issue, i) => {
      console.log(`  ${i + 1}. ${issue}`);
    });
    console.log();
  }

  if (recommendations.length > 0) {
    console.log('改进建议:');
    recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
    console.log();
  }

  console.log('='.repeat(80));
  console.log('诊断完成');
  console.log('='.repeat(80));

  await prisma.$disconnect();
}

// 运行诊断
if (require.main === module) {
  diagnoseSchemaIssues()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('诊断过程出错:', error);
      process.exit(1);
    });
}

module.exports = { diagnoseSchemaIssues };
