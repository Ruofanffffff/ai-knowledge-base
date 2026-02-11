/**
 * 为AI科学和软件开发Schema添加字段映射
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

console.log('开始执行脚本...\n');

// AI科学领域字段映射
const AI_VARIATIONS = {
  'ModelName': ['模型名称', '模型', 'Model', 'model', 'AI模型', 'GPT', 'BERT'],
  'ModelType': ['模型类型', '类型', 'Type', 'CNN', 'RNN', 'GAN'],
  'Architecture': ['架构', '网络架构', 'Architecture', '模型架构'],
  'Parameters': ['参数', '参数量', 'Parameters', 'params'],
  'Dataset': ['数据集', 'Dataset', '训练数据', 'ImageNet'],
  'Accuracy': ['准确率', 'Accuracy', 'acc', '精度'],
  'Framework': ['框架', 'Framework', 'PyTorch', 'TensorFlow']
};

// 软件开发领域字段映射
const SOFTWARE_VARIATIONS = {
  'ModuleName': ['模块名称', '模块', 'Module', '组件'],
  'ClassName': ['类名', '类', 'Class'],
  'FunctionName': ['函数名', '函数', 'Function', '方法'],
  'Language': ['编程语言', '语言', 'Language', 'Java', 'Python'],
  'Path': ['路径', 'Path', 'API路径', 'URL'],
  'Method': ['方法', 'Method', 'HTTP方法', 'GET', 'POST'],
  'ProjectName': ['项目名称', '项目', 'Project']
};

async function main() {
  try {
    const mappingFile = path.join(__dirname, 'schema_field_mappings.json');
    console.log(`读取映射文件: ${mappingFile}`);
    
    const existing = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
    console.log(`现有映射: ${Object.keys(existing).length}个Schema\n`);

    const allSchemas = await prisma.schema.findMany();
    console.log(`数据库Schema总数: ${allSchemas.length}`);

    const missing = allSchemas.filter(s => !existing[s.name]);
    console.log(`缺失映射: ${missing.length}个Schema\n`);

    const aiSchemas = missing.filter(s => 
      (s.scene && (s.scene.includes('AI') || s.scene.includes('人工智能'))) ||
      s.name.includes('AI') || s.name.includes('ML') || s.name.includes('Model')
    );

    const softwareSchemas = missing.filter(s => 
      (s.scene && s.scene.includes('软件开发')) ||
      s.name.includes('Code') || s.name.includes('API') || s.name.includes('Test')
    );

    console.log(`AI科学Schema: ${aiSchemas.length}个`);
    console.log(`软件开发Schema: ${softwareSchemas.length}个\n`);

    let added = 0;
    const newMappings = { ...existing };

    // 处理AI Schema
    console.log('添加AI科学Schema映射:');
    for (const schema of aiSchemas) {
      const fields = JSON.parse(schema.coreFields || '[]');
      if (fields.length === 0) continue;

      const mapping = {};
      for (const field of fields) {
        const vars = AI_VARIATIONS[field.name] || [field.name];
        mapping[field.name] = {
          common_variations: vars,
          weight: field.weight || 0.5,
          required: field.required || false,
          description: `${field.name}字段`,
          data_type: field.type || 'text',
          domain: 'ai_science'
        };
      }
      newMappings[schema.name] = mapping;
      added++;
      console.log(`  ✓ ${schema.name} (${fields.length}个字段)`);
    }

    // 处理软件开发Schema
    console.log('\n添加软件开发Schema映射:');
    for (const schema of softwareSchemas) {
      const fields = JSON.parse(schema.coreFields || '[]');
      if (fields.length === 0) continue;

      const mapping = {};
      for (const field of fields) {
        const vars = SOFTWARE_VARIATIONS[field.name] || [field.name];
        mapping[field.name] = {
          common_variations: vars,
          weight: field.weight || 0.5,
          required: field.required || false,
          description: `${field.name}字段`,
          data_type: field.type || 'text',
          domain: 'software'
        };
      }
      newMappings[schema.name] = mapping;
      added++;
      console.log(`  ✓ ${schema.name} (${fields.length}个字段)`);
    }

    // 保存
    if (added > 0) {
      const backup = mappingFile + '.backup.' + Date.now();
      fs.copyFileSync(mappingFile, backup);
      console.log(`\n✓ 备份: ${backup}`);

      fs.writeFileSync(mappingFile, JSON.stringify(newMappings, null, 2));
      console.log(`✓ 保存: ${Object.keys(newMappings).length}个Schema`);
    }

    const coverage = (Object.keys(newMappings).length / allSchemas.length * 100).toFixed(1);
    console.log(`\n映射覆盖率: ${coverage}%`);
    
    if (parseFloat(coverage) >= 90) {
      console.log('✅ 达到90%目标!');
    } else {
      const need = Math.ceil(allSchemas.length * 0.9 - Object.keys(newMappings).length);
      console.log(`⚠️  还需${need}个Schema达到90%`);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('错误:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
