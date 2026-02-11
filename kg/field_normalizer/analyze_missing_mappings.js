/**
 * 分析缺失字段映射的Schema
 * 
 * 找出数据库中所有没有字段映射的Schema
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

async function analyzeMissingMappings() {
  console.log('开始分析缺失的字段映射...\n');

  try {
    // 1. 读取映射表
    const mappingPath = path.join(__dirname, 'schema_field_mappings.json');
    const mappingContent = await fs.readFile(mappingPath, 'utf-8');
    const mappings = JSON.parse(mappingContent);
    
    console.log(`✓ 已加载映射表: ${Object.keys(mappings).length} 个Schema\n`);

    // 2. 读取数据库中的所有Schema
    const allSchemas = await prisma.schema.findMany({
      select: {
        id: true,
        name: true,
        scene: true,
        coreFields: true
      },
      orderBy: {
        name: 'asc'
      }
    });

    console.log(`✓ 数据库中共有 ${allSchemas.length} 个Schema\n`);

    // 3. 找出没有映射的Schema
    const missingMappings = [];
    const mappingSet = new Set(Object.keys(mappings));

    for (const schema of allSchemas) {
      const schemaName = schema.name;
      if (!mappingSet.has(schemaName)) {
        missingMappings.push({
          id: schema.id,
          name: schemaName,
          scene: schema.scene,
          coreFields: schema.coreFields ? JSON.parse(schema.coreFields) : []
        });
      }
    }

    console.log('================================================================================');
    console.log('📊 分析结果');
    console.log('================================================================================\n');

    console.log(`总Schema数: ${allSchemas.length}`);
    console.log(`已有映射: ${Object.keys(mappings).length} (${(Object.keys(mappings).length / allSchemas.length * 100).toFixed(1)}%)`);
    console.log(`缺失映射: ${missingMappings.length} (${(missingMappings.length / allSchemas.length * 100).toFixed(1)}%)\n`);

    if (missingMappings.length === 0) {
      console.log('✓ 所有Schema都已有字段映射！\n');
      return;
    }

    // 4. 按场景分组
    const byScene = {};
    for (const schema of missingMappings) {
      const scene = schema.scene || 'Unknown';
      if (!byScene[scene]) {
        byScene[scene] = [];
      }
      byScene[scene].push(schema);
    }

    console.log('================================================================================');
    console.log('📋 缺失映射的Schema（按场景分组）');
    console.log('================================================================================\n');

    for (const [scene, schemas] of Object.entries(byScene)) {
      console.log(`\n【${scene}】 (${schemas.length} 个Schema)`);
      console.log('─'.repeat(80));
      
      for (const schema of schemas) {
        console.log(`\n${schema.name}`);
        console.log(`  ID: ${schema.id}`);
        console.log(`  核心字段数: ${schema.coreFields.length}`);
        
        if (schema.coreFields.length > 0) {
          console.log(`  核心字段:`);
          schema.coreFields.forEach(field => {
            console.log(`    - ${field.name} (权重: ${field.weight || 0}, 必需: ${field.required || false})`);
          });
        }
      }
    }

    // 5. 生成映射模板
    console.log('\n\n================================================================================');
    console.log('📝 生成映射模板');
    console.log('================================================================================\n');

    const mappingTemplate = {};
    
    for (const schema of missingMappings) {
      mappingTemplate[schema.name] = {};
      
      for (const field of schema.coreFields) {
        mappingTemplate[schema.name][field.name] = {
          common_variations: [],
          weight: field.weight || 0.1,
          required: field.required || false,
          description: ''
        };
      }
    }

    // 保存模板到文件
    const templatePath = path.join(__dirname, 'missing_mappings_template.json');
    await fs.writeFile(
      templatePath,
      JSON.stringify(mappingTemplate, null, 2),
      'utf-8'
    );

    console.log(`✓ 映射模板已保存到: ${templatePath}`);
    console.log(`  包含 ${missingMappings.length} 个Schema的映射模板\n`);

    // 6. 统计信息
    console.log('================================================================================');
    console.log('📈 统计信息');
    console.log('================================================================================\n');

    const totalCoreFields = missingMappings.reduce((sum, s) => sum + s.coreFields.length, 0);
    console.log(`缺失映射的Schema总数: ${missingMappings.length}`);
    console.log(`需要添加映射的字段总数: ${totalCoreFields}`);
    console.log(`平均每个Schema的字段数: ${(totalCoreFields / missingMappings.length).toFixed(1)}\n`);

    // 按场景统计
    console.log('按场景统计:');
    for (const [scene, schemas] of Object.entries(byScene)) {
      const fieldCount = schemas.reduce((sum, s) => sum + s.coreFields.length, 0);
      console.log(`  ${scene}: ${schemas.length} 个Schema, ${fieldCount} 个字段`);
    }

  } catch (error) {
    console.error('分析失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 运行分析
analyzeMissingMappings();
