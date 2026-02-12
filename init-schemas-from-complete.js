/**
 * 初始化 Schema 到数据库
 * 
 * 从 all_150_schemas_complete.js 加载所有 Schema 并导入到数据库
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 导入 Schema 定义
const allSchemasModule = require('./kg/schema/all_150_schemas_complete.js');

async function initSchemas() {
  console.log('=== 初始化 Schema 到数据库 ===\n');
  
  try {
    // 获取所有 Schema
    const allSchemas = allSchemasModule.softwareSchemas || allSchemasModule.allSchemas || allSchemasModule;
    
    if (!Array.isArray(allSchemas)) {
      console.error('❌ 无法加载 Schema 数组');
      console.log('模块导出:', Object.keys(allSchemasModule));
      await prisma.$disconnect();
      return;
    }
    
    console.log(`找到 ${allSchemas.length} 个 Schema 定义\n`);
    
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    
    for (const schema of allSchemas) {
      try {
        // 检查 Schema 是否已存在
        const existing = await prisma.schema.findUnique({
          where: { name: schema.name }
        });
        
        if (existing) {
          console.log(`⏭️  跳过: ${schema.name} (已存在)`);
          skipCount++;
          continue;
        }
        
        // 创建 Schema
        await prisma.schema.create({
          data: {
            name: schema.name,
            entityType: schema.entityType,
            scene: schema.scene || null,
            description: schema.description || null,
            exampleDescription: schema.exampleDescription || null,
            coreFields: JSON.stringify(schema.coreFields),
            threshold: schema.threshold,
            relations: schema.relations ? JSON.stringify(schema.relations) : null,
            version: schema.version || '1.0.0',
            active: schema.active !== undefined ? schema.active : true
          }
        });
        
        console.log(`✅ 创建: ${schema.name}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ 失败: ${schema.name} - ${error.message}`);
        errorCount++;
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('初始化完成:');
    console.log(`  ✅ 成功: ${successCount}`);
    console.log(`  ⏭️  跳过: ${skipCount}`);
    console.log(`  ❌ 失败: ${errorCount}`);
    console.log(`  📊 总计: ${allSchemas.length}`);
    console.log('='.repeat(60));
    
    // 验证数据库中的 Schema 数量
    const totalInDb = await prisma.schema.count();
    console.log(`\n数据库中共有 ${totalInDb} 个 Schema\n`);
    
    await prisma.$disconnect();
    process.exit(errorCount > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('\n❌ 初始化失败:', error.message);
    console.error(error.stack);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// 运行初始化
initSchemas();
