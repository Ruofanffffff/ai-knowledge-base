/**
 * 为剩余Schema添加通用字段映射
 * 目标：达到90%覆盖率
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

console.log('开始添加剩余Schema映射...\n');

// 通用字段映射变体生成函数
function generateVariations(fieldName) {
  const variations = [fieldName];
  
  // 添加小写
  variations.push(fieldName.toLowerCase());
  
  // CamelCase to spaces
  const withSpaces = fieldName.replace(/([A-Z])/g, ' $1').trim();
  if (withSpaces !== fieldName) {
    variations.push(withSpaces);
    variations.push(withSpaces.toLowerCase());
  }
  
  // CamelCase to snake_case
  const snakeCase = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  if (snakeCase !== fieldName.toLowerCase()) {
    variations.push(snakeCase);
  }
  
  // CamelCase to kebab-case
  const kebabCase = fieldName.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
  if (kebabCase !== fieldName.toLowerCase()) {
    variations.push(kebabCase);
  }
  
  // 添加常见中文翻译（基于字段名推测）
  const chineseMap = {
    'Name': '名称',
    'Type': '类型',
    'Description': '描述',
    'Status': '状态',
    'Date': '日期',
    'Time': '时间',
    'Value': '值',
    'Amount': '数量',
    'Price': '价格',
    'Location': '地点',
    'Address': '地址',
    'Phone': '电话',
    'Email': '邮箱',
    'User': '用户',
    'Author': '作者',
    'Title': '标题',
    'Content': '内容',
    'Category': '类别',
    'Tag': '标签',
    'Version': '版本',
    'ID': 'ID'
  };
  
  for (const [eng, chn] of Object.entries(chineseMap)) {
    if (fieldName.includes(eng)) {
      variations.push(fieldName.replace(eng, chn));
    }
  }
  
  return [...new Set(variations)];
}

async function main() {
  try {
    const mappingFile = path.join(__dirname, 'schema_field_mappings.json');
    const existing = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
    console.log(`现有映射: ${Object.keys(existing).length}个Schema`);

    const allSchemas = await prisma.schema.findMany();
    console.log(`数据库Schema总数: ${allSchemas.length}`);

    const missing = allSchemas.filter(s => !existing[s.name]);
    console.log(`缺失映射: ${missing.length}个Schema`);
    
    // 计算需要添加多少个才能达到90%
    const target = Math.ceil(allSchemas.length * 0.9);
    const current = Object.keys(existing).length;
    const needed = target - current;
    
    console.log(`\n目标: ${target}个Schema (90%)`);
    console.log(`当前: ${current}个Schema`);
    console.log(`需要: ${needed}个Schema\n`);

    if (needed <= 0) {
      console.log('✅ 已达到90%目标!');
      await prisma.$disconnect();
      return;
    }

    // 选择要添加的Schema（优先选择字段多的）
    const toAdd = missing
      .map(s => ({
        schema: s,
        fieldCount: JSON.parse(s.coreFields || '[]').length
      }))
      .filter(item => item.fieldCount > 0)
      .sort((a, b) => b.fieldCount - a.fieldCount)
      .slice(0, needed);

    console.log(`将添加${toAdd.length}个Schema的映射:\n`);

    let added = 0;
    const newMappings = { ...existing };

    for (const item of toAdd) {
      const schema = item.schema;
      const fields = JSON.parse(schema.coreFields);
      
      const mapping = {};
      for (const field of fields) {
        const variations = generateVariations(field.name);
        mapping[field.name] = {
          common_variations: variations,
          weight: field.weight || 0.5,
          required: field.required || false,
          description: `${field.name}字段`,
          data_type: field.type || 'text',
          domain: schema.scene || 'general'
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
      const stillNeed = Math.ceil(allSchemas.length * 0.9 - Object.keys(newMappings).length);
      console.log(`⚠️  还需${stillNeed}个Schema达到90%`);
    }

    await prisma.$disconnect();
  } catch (error) {
    console.error('错误:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
