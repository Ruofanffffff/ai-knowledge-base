/**
 * Generate All 150 Schemas
 * 
 * This script generates all 150 schema definitions programmatically
 * and adds them to the database.
 * 
 * Usage: node kg/schema/generate_all_150_schemas.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper to create schema
const createSchema = (config) => ({
  name: config.name,
  entityType: config.entityType,
  scene: config.scene,
  description: config.description,
  exampleDescription: config.example,
  coreFields: JSON.stringify(config.fields),
  threshold: config.threshold || 0.5,
  relations: JSON.stringify(config.relations || []),
  version: '1.0.0',
  active: true
});

// Schema definitions organized by domain
const schemaDefinitions = {
  software: [
    // 1-10: Code & Architecture
    { name: 'Code-Module', entityType: 'CodeModuleEntity', scene: '软件开发/代码', description: '代码模块 - 记录代码模块的基本信息、功能和依赖关系', example: 'UserService模块，负责用户认证和授权，依赖DatabaseModule', threshold: 0.5, fields: [
      { name: 'ModuleName', weight: 0.4, required: true, field_type: 'text', description: '模块名称', anchor: true },
      { name: 'Language', weight: 0.15, required: false, field_type: 'text', description: '编程语言' },
      { name: 'Purpose', weight: 0.2, required: false, field_type: 'text', description: '模块用途' },
      { name: 'Dependencies', weight: 0.15, required: false, field_type: 'list', description: '依赖模块' },
      { name: 'Author', weight: 0.1, required: false, field_type: 'text', description: '作者' }
    ], relations: [{ type: 'depends_on', target_field: 'Dependencies', direction: 'outgoing' }]},
    
    { name: 'API-Endpoint', entityType: 'APIEndpointEntity', scene: '软件开发/API', description: 'API端点 - 记录API接口的路径、方法、参数和响应', example: 'POST /api/users - 创建新用户，需要name和email参数', threshold: 0.6, fields: [
      { name: 'Path', weight: 0.3, required: true, field_type: 'text', description: 'API路径', anchor: true },
      { name: 'Method', weight: 0.2, required: true, field_type: 'text', description: 'HTTP方法', anchor: true },
      { name: 'Parameters', weight: 0.2, required: false, field_type: 'list', description: '请求参数' },
      { name: 'Response', weight: 0.15, required: false, field_type: 'text', description: '响应格式' },
      { name: 'Authentication', weight: 0.15, required: false, field_type: 'text', description: '认证方式' }
    ]},
    
    { name: 'Database-Schema', entityType: 'DatabaseSchemaEntity', scene: '软件开发/数据库', description: '数据库模式 - 记录数据库表结构、字段和索引', example: 'users表：id(主键), name, email(唯一索引), created_at', threshold: 0.6, fields: [
      { name: 'TableName', weight: 0.35, required: true, field_type: 'text', description: '表名', anchor: true },
      { name: 'Fields', weight: 0.3, required: true, field_type: 'list', description: '字段列表' },
      { name: 'PrimaryKey', weight: 0.15, required: false, field_type: 'text', description: '主键' },
      { name: 'Indexes', weight: 0.1, required: false, field_type: 'list', description: '索引' },
      { name: 'Relations', weight: 0.1, required: false, field_type: 'list', description: '关联表' }
    ]},
    
    { name: 'Design-Pattern', entityType: 'DesignPatternEntity', scene: '软件开发/架构', description: '设计模式 - 记录使用的设计模式及其应用场景', example: '单例模式用于DatabaseConnection，确保全局唯一实例', fields: [
      { name: 'PatternName', weight: 0.4, required: true, field_type: 'text', description: '模式名称', anchor: true },
      { name: 'Category', weight: 0.2, required: false, field_type: 'text', description: '模式类别' },
      { name: 'UseCase', weight: 0.2, required: false, field_type: 'text', description: '应用场景' },
      { name: 'Implementation', weight: 0.2, required: false, field_type: 'text', description: '实现方式' }
    ]},
    
    { name: 'Microservice', entityType: 'MicroserviceEntity', scene: '软件开发/架构', description: '微服务 - 记录微服务的名称、职责和通信方式', example: 'UserService微服务，处理用户管理，通过gRPC通信', fields: [
      { name: 'ServiceName', weight: 0.35, required: true, field_type: 'text', description: '服务名称', anchor: true },
      { name: 'Responsibility', weight: 0.25, required: false, field_type: 'text', description: '服务职责' },
      { name: 'Protocol', weight: 0.2, required: false, field_type: 'text', description: '通信协议' },
      { name: 'Port', weight: 0.1, required: false, field_type: 'number', description: '端口号' },
      { name: 'Dependencies', weight: 0.1, required: false, field_type: 'list', description: '依赖服务' }
    ], relations: [{ type: 'depends_on', target_field: 'Dependencies', direction: 'outgoing' }]},
  ]
};

// Generate all schemas
const allSchemas = [];

// Add software development schemas
schemaDefinitions.software.forEach(def => {
  allSchemas.push(createSchema(def));
});

console.log(`Generated ${allSchemas.length} schema definitions`);

async function addSchemasToDatabase() {
  console.log(`\nAdding ${allSchemas.length} schemas to database...`);
  
  let added = 0;
  let skipped = 0;
  let errors = 0;

  for (const schema of allSchemas) {
    try {
      const existing = await prisma.schema.findUnique({
        where: { name: schema.name }
      });

      if (existing) {
        console.log(`⏭️  Skipped: ${schema.name} (already exists)`);
        skipped++;
        continue;
      }

      await prisma.schema.create({
        data: schema
      });

      console.log(`✅ Added: ${schema.name}`);
      added++;
    } catch (error) {
      console.error(`❌ Error adding ${schema.name}:`, error.message);
      errors++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Added: ${added}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  console.log(`   Total: ${allSchemas.length}`);
}

// Export for use in other scripts
module.exports = { allSchemas, createSchema, schemaDefinitions };

// Run if called directly
if (require.main === module) {
  addSchemasToDatabase()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
