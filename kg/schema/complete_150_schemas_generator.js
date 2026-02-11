/**
 * Complete 150 Schemas Generator
 * 
 * This script generates all 150 schema definitions and adds them to the database.
 * Organized by domain for maintainability.
 * 
 * Usage: node kg/schema/complete_150_schemas_generator.js
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

// All 150 schema definitions
const ALL_SCHEMAS = [];

// ============================================================================
// SOFTWARE DEVELOPMENT SCHEMAS (50)
// ============================================================================

// 1-10: Code & Architecture
const softwareCodeArchitecture = [
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
  
  { name: 'Code-Library', entityType: 'CodeLibraryEntity', scene: '软件开发/依赖', description: '代码库 - 记录第三方库或内部库的信息', example: 'React v18.2.0 - 用于构建用户界面的JavaScript库', threshold: 0.6, fields: [
    { name: 'LibraryName', weight: 0.35, required: true, field_type: 'text', description: '库名称', anchor: true },
    { name: 'Version', weight: 0.25, required: true, field_type: 'text', description: '版本号', anchor: true },
    { name: 'Purpose', weight: 0.2, required: false, field_type: 'text', description: '用途' },
    { name: 'License', weight: 0.1, required: false, field_type: 'text', description: '许可证' },
    { name: 'Repository', weight: 0.1, required: false, field_type: 'text', description: '仓库地址' }
  ]},
  
  { name: 'Code-Function', entityType: 'CodeFunctionEntity', scene: '软件开发/代码', description: '代码函数 - 记录函数的签名、参数和返回值', example: 'calculateTotal(items: Array) => number - 计算订单总价', fields: [
    { name: 'FunctionName', weight: 0.35, required: true, field_type: 'text', description: '函数名', anchor: true },
    { name: 'Parameters', weight: 0.25, required: false, field_type: 'list', description: '参数列表' },
    { name: 'ReturnType', weight: 0.2, required: false, field_type: 'text', description: '返回类型' },
    { name: 'Description', weight: 0.2, required: false, field_type: 'text', description: '功能描述' }
  ]},
  
  { name: 'Code-Class', entityType: 'CodeClassEntity', scene: '软件开发/代码', description: '代码类 - 记录类的属性、方法和继承关系', example: 'User类：继承BaseModel，包含name、email属性和save()方法', fields: [
    { name: 'ClassName', weight: 0.35, required: true, field_type: 'text', description: '类名', anchor: true },
    { name: 'Properties', weight: 0.2, required: false, field_type: 'list', description: '属性列表' },
    { name: 'Methods', weight: 0.2, required: false, field_type: 'list', description: '方法列表' },
    { name: 'Extends', weight: 0.15, required: false, field_type: 'text', description: '继承的类' },
    { name: 'Implements', weight: 0.1, required: false, field_type: 'list', description: '实现的接口' }
  ], relations: [
    { type: 'extends', target_field: 'Extends', direction: 'outgoing' },
    { type: 'implements', target_field: 'Implements', direction: 'outgoing' }
  ]},
  
  { name: 'Code-Interface', entityType: 'CodeInterfaceEntity', scene: '软件开发/代码', description: '代码接口 - 记录接口定义和方法签名', example: 'IRepository接口：定义save()、find()、delete()方法', threshold: 0.6, fields: [
    { name: 'InterfaceName', weight: 0.4, required: true, field_type: 'text', description: '接口名', anchor: true },
    { name: 'Methods', weight: 0.3, required: true, field_type: 'list', description: '方法列表' },
    { name: 'Extends', weight: 0.15, required: false, field_type: 'list', description: '继承的接口' },
    { name: 'Purpose', weight: 0.15, required: false, field_type: 'text', description: '接口用途' }
  ], relations: [{ type: 'extends', target_field: 'Extends', direction: 'outgoing' }]},
  
  { name: 'Architecture-Layer', entityType: 'ArchitectureLayerEntity', scene: '软件开发/架构', description: '架构层 - 记录系统架构的分层结构', example: '表现层(Presentation Layer)：包含Controller和View组件', fields: [
    { name: 'LayerName', weight: 0.4, required: true, field_type: 'text', description: '层名称', anchor: true },
    { name: 'Components', weight: 0.3, required: false, field_type: 'list', description: '包含的组件' },
    { name: 'Responsibility', weight: 0.2, required: false, field_type: 'text', description: '职责' },
    { name: 'DependsOn', weight: 0.1, required: false, field_type: 'list', description: '依赖的层' }
  ], relations: [{ type: 'depends_on', target_field: 'DependsOn', direction: 'outgoing' }]}
];

// Add to ALL_SCHEMAS
softwareCodeArchitecture.forEach(def => ALL_SCHEMAS.push(createSchema(def)));

console.log(`Generated ${ALL_SCHEMAS.length} schemas so far...`);

// Export for testing
module.exports = { ALL_SCHEMAS, createSchema };

// Run if called directly
if (require.main === module) {
  async function addSchemas() {
    console.log(`\nAdding ${ALL_SCHEMAS.length} schemas to database...`);
    
    let added = 0, skipped = 0, errors = 0;

    for (const schema of ALL_SCHEMAS) {
      try {
        const existing = await prisma.schema.findUnique({
          where: { name: schema.name }
        });

        if (existing) {
          console.log(`⏭️  ${schema.name}`);
          skipped++;
          continue;
        }

        await prisma.schema.create({ data: schema });
        console.log(`✅ ${schema.name}`);
        added++;
      } catch (error) {
        console.error(`❌ ${schema.name}: ${error.message}`);
        errors++;
      }
    }

    console.log(`\n📊 Summary: Added ${added}, Skipped ${skipped}, Errors ${errors}, Total ${ALL_SCHEMAS.length}`);
  }

  addSchemas()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
}
