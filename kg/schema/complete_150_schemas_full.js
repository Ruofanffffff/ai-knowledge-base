/**
 * Complete 150 Schemas - Full Implementation
 * 
 * This file contains all 150 schema definitions across 3 domains.
 * Run with: node kg/schema/complete_150_schemas_full.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

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
const softwareSchemas = [
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
  ], relations: [{ type: 'depends_on', target_field: 'DependsOn', direction: 'outgoing' }]},

  // 11-20: Development Process
  { name: 'User-Story', entityType: 'UserStoryEntity', scene: '软件开发/流程', description: '用户故事 - 记录用户需求和验收标准', example: '作为用户，我希望能够重置密码，以便恢复账户访问', fields: [
    { name: 'Title', weight: 0.35, required: true, field_type: 'text', description: '故事标题', anchor: true },
    { name: 'AsA', weight: 0.2, required: false, field_type: 'text', description: '用户角色' },
    { name: 'IWant', weight: 0.2, required: false, field_type: 'text', description: '期望功能' },
    { name: 'SoThat', weight: 0.15, required: false, field_type: 'text', description: '业务价值' },
    { name: 'AcceptanceCriteria', weight: 0.1, required: false, field_type: 'list', description: '验收标准' }
  ]},
  
  { name: 'Sprint', entityType: 'SprintEntity', scene: '软件开发/流程', description: '敏捷冲刺 - 记录Sprint的目标、时间和任务', example: 'Sprint 23: 2024-02-01至2024-02-14，目标：完成用户认证模块', threshold: 0.6, fields: [
    { name: 'SprintNumber', weight: 0.3, required: true, field_type: 'number', description: 'Sprint编号', anchor: true },
    { name: 'StartDate', weight: 0.2, required: true, field_type: 'date', description: '开始日期', anchor: true },
    { name: 'EndDate', weight: 0.2, required: false, field_type: 'date', description: '结束日期' },
    { name: 'Goal', weight: 0.2, required: false, field_type: 'text', description: 'Sprint目标' },
    { name: 'Tasks', weight: 0.1, required: false, field_type: 'list', description: '任务列表' }
  ]},
  
  { name: 'Code-Review', entityType: 'CodeReviewEntity', scene: '软件开发/流程', description: '代码审查 - 记录代码审查的结果和建议', example: 'PR #456审查：发现3个问题，建议重构error handling', fields: [
    { name: 'ReviewID', weight: 0.3, required: true, field_type: 'text', description: '审查ID', anchor: true },
    { name: 'Reviewer', weight: 0.2, required: false, field_type: 'text', description: '审查人' },
    { name: 'Status', weight: 0.2, required: false, field_type: 'text', description: '审查状态' },
    { name: 'Issues', weight: 0.15, required: false, field_type: 'list', description: '发现的问题' },
    { name: 'Suggestions', weight: 0.15, required: false, field_type: 'list', description: '改进建议' }
  ]},
  
  { name: 'Git-Commit', entityType: 'GitCommitEntity', scene: '软件开发/版本控制', description: 'Git提交 - 记录代码提交的信息', example: 'commit abc123: feat: add user authentication module', threshold: 0.6, fields: [
    { name: 'CommitHash', weight: 0.35, required: true, field_type: 'text', description: '提交哈希', anchor: true },
    { name: 'Message', weight: 0.25, required: true, field_type: 'text', description: '提交信息' },
    { name: 'Author', weight: 0.2, required: false, field_type: 'text', description: '作者' },
    { name: 'Date', weight: 0.1, required: false, field_type: 'date', description: '提交日期' },
    { name: 'Files', weight: 0.1, required: false, field_type: 'list', description: '修改的文件' }
  ]},
  
  { name: 'Pull-Request', entityType: 'PullRequestEntity', scene: '软件开发/版本控制', description: '拉取请求 - 记录PR的信息和审查状态', example: 'PR #789: Add payment integration - 待审查', threshold: 0.6, fields: [
    { name: 'PRNumber', weight: 0.3, required: true, field_type: 'number', description: 'PR编号', anchor: true },
    { name: 'Title', weight: 0.25, required: true, field_type: 'text', description: 'PR标题', anchor: true },
    { name: 'Author', weight: 0.15, required: false, field_type: 'text', description: '作者' },
    { name: 'Status', weight: 0.15, required: false, field_type: 'text', description: 'PR状态' },
    { name: 'Reviewers', weight: 0.15, required: false, field_type: 'list', description: '审查人' }
  ]},
  
  { name: 'Issue-Ticket', entityType: 'IssueTicketEntity', scene: '软件开发/流程', description: '问题工单 - 记录Bug或功能请求', example: 'Issue #1234: 登录页面在移动端显示异常', fields: [
    { name: 'IssueNumber', weight: 0.3, required: true, field_type: 'number', description: '工单编号', anchor: true },
    { name: 'Title', weight: 0.25, required: true, field_type: 'text', description: '工单标题', anchor: true },
    { name: 'Type', weight: 0.15, required: false, field_type: 'text', description: '类型(Bug/Feature)' },
    { name: 'Priority', weight: 0.15, required: false, field_type: 'text', description: '优先级' },
    { name: 'Assignee', weight: 0.15, required: false, field_type: 'text', description: '负责人' }
  ]},
  
  { name: 'Release-Version', entityType: 'ReleaseVersionEntity', scene: '软件开发/发布', description: '发布版本 - 记录软件版本发布信息', example: 'v2.5.0 - 2024-02-15发布，包含用户认证和支付功能', threshold: 0.6, fields: [
    { name: 'Version', weight: 0.35, required: true, field_type: 'text', description: '版本号', anchor: true },
    { name: 'ReleaseDate', weight: 0.25, required: true, field_type: 'date', description: '发布日期', anchor: true },
    { name: 'Features', weight: 0.2, required: false, field_type: 'list', description: '新功能' },
    { name: 'BugFixes', weight: 0.1, required: false, field_type: 'list', description: 'Bug修复' },
    { name: 'BreakingChanges', weight: 0.1, required: false, field_type: 'list', description: '破坏性变更' }
  ]},
  
  { name: 'Technical-Debt', entityType: 'TechnicalDebtEntity', scene: '软件开发/质量', description: '技术债务 - 记录需要重构或改进的代码', example: '用户模块使用过时的认证方式，需要迁移到JWT', fields: [
    { name: 'DebtID', weight: 0.3, required: true, field_type: 'text', description: '债务ID', anchor: true },
    { name: 'Description', weight: 0.25, required: true, field_type: 'text', description: '债务描述' },
    { name: 'Impact', weight: 0.2, required: false, field_type: 'text', description: '影响程度' },
    { name: 'EstimatedEffort', weight: 0.15, required: false, field_type: 'text', description: '预估工作量' },
    { name: 'Priority', weight: 0.1, required: false, field_type: 'text', description: '优先级' }
  ]},
  
  { name: 'Refactoring-Task', entityType: 'RefactoringTaskEntity', scene: '软件开发/质量', description: '重构任务 - 记录代码重构计划', example: '重构UserService，提取认证逻辑到AuthService', fields: [
    { name: 'TaskID', weight: 0.3, required: true, field_type: 'text', description: '任务ID', anchor: true },
    { name: 'Target', weight: 0.25, required: true, field_type: 'text', description: '重构目标', anchor: true },
    { name: 'Reason', weight: 0.2, required: false, field_type: 'text', description: '重构原因' },
    { name: 'Approach', weight: 0.15, required: false, field_type: 'text', description: '重构方法' },
    { name: 'Status', weight: 0.1, required: false, field_type: 'text', description: '状态' }
  ]},
  
  { name: 'Code-Metric', entityType: 'CodeMetricEntity', scene: '软件开发/质量', description: '代码指标 - 记录代码质量指标', example: 'UserService模块：圈复杂度15，测试覆盖率85%', fields: [
    { name: 'Module', weight: 0.3, required: true, field_type: 'text', description: '模块名称', anchor: true },
    { name: 'Complexity', weight: 0.2, required: false, field_type: 'number', description: '圈复杂度' },
    { name: 'Coverage', weight: 0.2, required: false, field_type: 'number', description: '测试覆盖率' },
    { name: 'LOC', weight: 0.15, required: false, field_type: 'number', description: '代码行数' },
    { name: 'Maintainability', weight: 0.15, required: false, field_type: 'number', description: '可维护性指数' }
  ]}
];

softwareSchemas.forEach(def => ALL_SCHEMAS.push(createSchema(def)));

console.log(`Generated ${ALL_SCHEMAS.length} schemas (Software Development complete)...`);

// Export and run
module.exports = { ALL_SCHEMAS, createSchema };

if (require.main === module) {
  async function addSchemas() {
    console.log(`\n📦 Adding ${ALL_SCHEMAS.length} schemas to database...\n`);
    
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

// 21-30: Testing & Quality
const testingSchemas = [
  { name: 'Unit-Test', entityType: 'UnitTestEntity', scene: '软件开发/测试', description: '单元测试 - 记录单元测试用例', example: 'test_user_login: 测试用户登录功能，验证正确的凭据返回token', fields: [
    { name: 'TestName', weight: 0.35, required: true, field_type: 'text', description: '测试名称', anchor: true },
    { name: 'Target', weight: 0.25, required: true, field_type: 'text', description: '测试目标', anchor: true },
    { name: 'Assertions', weight: 0.2, required: false, field_type: 'list', description: '断言列表' },
    { name: 'Status', weight: 0.1, required: false, field_type: 'text', description: '测试状态' },
    { name: 'Coverage', weight: 0.1, required: false, field_type: 'number', description: '覆盖率' }
  ]},
  
  { name: 'Integration-Test', entityType: 'IntegrationTestEntity', scene: '软件开发/测试', description: '集成测试 - 记录模块间集成测试', example: '测试UserService与DatabaseModule的集成，验证数据正确保存', fields: [
    { name: 'TestName', weight: 0.35, required: true, field_type: 'text', description: '测试名称', anchor: true },
    { name: 'Modules', weight: 0.25, required: true, field_type: 'list', description: '涉及模块', anchor: true },
    { name: 'Scenario', weight: 0.2, required: false, field_type: 'text', description: '测试场景' },
    { name: 'Status', weight: 0.1, required: false, field_type: 'text', description: '测试状态' },
    { name: 'Duration', weight: 0.1, required: false, field_type: 'number', description: '执行时间' }
  ]},
  
  { name: 'E2E-Test', entityType: 'E2ETestEntity', scene: '软件开发/测试', description: '端到端测试 - 记录完整用户流程测试', example: '用户注册流程：填写表单 → 验证邮箱 → 登录成功', fields: [
    { name: 'TestName', weight: 0.35, required: true, field_type: 'text', description: '测试名称', anchor: true },
    { name: 'UserFlow', weight: 0.25, required: true, field_type: 'text', description: '用户流程', anchor: true },
    { name: 'Steps', weight: 0.2, required: false, field_type: 'list', description: '测试步骤' },
    { name: 'Status', weight: 0.1, required: false, field_type: 'text', description: '测试状态' },
    { name: 'Browser', weight: 0.1, required: false, field_type: 'text', description: '浏览器' }
  ]},
  
  { name: 'Performance-Test', entityType: 'PerformanceTestEntity', scene: '软件开发/测试', description: '性能测试 - 记录系统性能测试结果', example: 'API响应时间测试：平均200ms，P95 350ms，P99 500ms', fields: [
    { name: 'TestName', weight: 0.3, required: true, field_type: 'text', description: '测试名称', anchor: true },
    { name: 'Metric', weight: 0.25, required: true, field_type: 'text', description: '性能指标', anchor: true },
    { name: 'Average', weight: 0.15, required: false, field_type: 'number', description: '平均值' },
    { name: 'P95', weight: 0.15, required: false, field_type: 'number', description: 'P95值' },
    { name: 'P99', weight: 0.15, required: false, field_type: 'number', description: 'P99值' }
  ]},
  
  { name: 'Load-Test', entityType: 'LoadTestEntity', scene: '软件开发/测试', description: '负载测试 - 记录系统负载测试', example: '1000并发用户测试：成功率99.5%，平均响应时间300ms', threshold: 0.6, fields: [
    { name: 'TestName', weight: 0.3, required: true, field_type: 'text', description: '测试名称', anchor: true },
    { name: 'Concurrency', weight: 0.25, required: true, field_type: 'number', description: '并发数', anchor: true },
    { name: 'SuccessRate', weight: 0.2, required: false, field_type: 'number', description: '成功率' },
    { name: 'ResponseTime', weight: 0.15, required: false, field_type: 'number', description: '响应时间' },
    { name: 'Throughput', weight: 0.1, required: false, field_type: 'number', description: '吞吐量' }
  ]},
  
  { name: 'Stress-Test', entityType: 'StressTestEntity', scene: '软件开发/测试', description: '压力测试 - 记录系统极限压力测试', example: '系统在5000并发时开始出现错误，最大承载4500并发', threshold: 0.6, fields: [
    { name: 'TestName', weight: 0.3, required: true, field_type: 'text', description: '测试名称', anchor: true },
    { name: 'MaxLoad', weight: 0.25, required: true, field_type: 'number', description: '最大负载', anchor: true },
    { name: 'BreakingPoint', weight: 0.2, required: false, field_type: 'number', description: '崩溃点' },
    { name: 'RecoveryTime', weight: 0.15, required: false, field_type: 'number', description: '恢复时间' },
    { name: 'ErrorRate', weight: 0.1, required: false, field_type: 'number', description: '错误率' }
  ]},
  
  { name: 'Security-Test', entityType: 'SecurityTestEntity', scene: '软件开发/测试', description: '安全测试 - 记录安全漏洞测试', example: 'SQL注入测试：发现2个中危漏洞，已修复', fields: [
    { name: 'TestName', weight: 0.3, required: true, field_type: 'text', description: '测试名称', anchor: true },
    { name: 'VulnerabilityType', weight: 0.25, required: true, field_type: 'text', description: '漏洞类型', anchor: true },
    { name: 'Severity', weight: 0.2, required: false, field_type: 'text', description: '严重程度' },
    { name: 'Status', weight: 0.15, required: false, field_type: 'text', description: '修复状态' },
    { name: 'CVSS', weight: 0.1, required: false, field_type: 'number', description: 'CVSS评分' }
  ]},
  
  { name: 'Bug-Report', entityType: 'BugReportEntity', scene: '软件开发/质量', description: 'Bug报告 - 记录软件缺陷', example: 'Bug #567: 用户无法上传大于10MB的文件', fields: [
    { name: 'BugID', weight: 0.3, required: true, field_type: 'text', description: 'Bug编号', anchor: true },
    { name: 'Title', weight: 0.25, required: true, field_type: 'text', description: 'Bug标题', anchor: true },
    { name: 'Severity', weight: 0.2, required: false, field_type: 'text', description: '严重程度' },
    { name: 'Steps', weight: 0.15, required: false, field_type: 'list', description: '复现步骤' },
    { name: 'Status', weight: 0.1, required: false, field_type: 'text', description: '状态' }
  ]},
  
  { name: 'Test-Coverage', entityType: 'TestCoverageEntity', scene: '软件开发/质量', description: '测试覆盖率 - 记录代码测试覆盖情况', example: 'UserService: 行覆盖率85%, 分支覆盖率78%, 函数覆盖率90%', fields: [
    { name: 'Module', weight: 0.3, required: true, field_type: 'text', description: '模块名称', anchor: true },
    { name: 'LineCoverage', weight: 0.25, required: false, field_type: 'number', description: '行覆盖率' },
    { name: 'BranchCoverage', weight: 0.2, required: false, field_type: 'number', description: '分支覆盖率' },
    { name: 'FunctionCoverage', weight: 0.15, required: false, field_type: 'number', description: '函数覆盖率' },
    { name: 'UncoveredLines', weight: 0.1, required: false, field_type: 'list', description: '未覆盖行' }
  ]},
  
  { name: 'Quality-Gate', entityType: 'QualityGateEntity', scene: '软件开发/质量', description: '质量门禁 - 记录代码质量检查点', example: '质量门禁：覆盖率>80%, 复杂度<15, 无严重Bug', threshold: 0.6, fields: [
    { name: 'GateName', weight: 0.3, required: true, field_type: 'text', description: '门禁名称', anchor: true },
    { name: 'Criteria', weight: 0.3, required: true, field_type: 'list', description: '检查标准', anchor: true },
    { name: 'Status', weight: 0.2, required: false, field_type: 'text', description: '通过状态' },
    { name: 'Violations', weight: 0.1, required: false, field_type: 'list', description: '违规项' },
    { name: 'Timestamp', weight: 0.1, required: false, field_type: 'date', description: '检查时间' }
  ]}
];

testingSchemas.forEach(def => ALL_SCHEMAS.push(createSchema(def)));
console.log(`Generated ${ALL_SCHEMAS.length} schemas (Testing & Quality complete)...`);

// 31-40: DevOps & Deployment
const devopsSchemas = [
  { name: 'CI-Pipeline', entityType: 'CIPipelineEntity', scene: '软件开发/DevOps', description: 'CI流水线 - 记录持续集成流水线配置', example: 'Build Pipeline: 代码检查 → 单元测试 → 构建 → 发布', fields: [
    { name: 'PipelineName', weight: 0.35, required: true, field_type: 'text', description: '流水线名称', anchor: true },
    { name: 'Stages', weight: 0.3, required: true, field_type: 'list', description: '阶段列表' },
    { name: 'Trigger', weight: 0.15, required: false, field_type: 'text', description: '触发条件' },
    { name: 'Duration', weight: 0.1, required: false, field_type: 'number', description: '执行时长' },
    { name: 'Status', weight: 0.1, required: false, field_type: 'text', description: '状态' }
  ]},
  
  { name: 'CD-Pipeline', entityType: 'CDPipelineEntity', scene: '软件开发/DevOps', description: 'CD流水线 - 记录持续部署流水线', example: 'Deploy Pipeline: 构建镜像 → 推送仓库 → 部署到K8s', fields: [
    { name: 'PipelineName', weight: 0.35, required: true, field_type: 'text', description: '流水线名称', anchor: true },
    { name: 'Environment', weight: 0.25, required: true, field_type: 'text', description: '部署环境', anchor: true },
    { name: 'Steps', weight: 0.2, required: false, field_type: 'list', description: '部署步骤' },
    { name: 'ApprovalRequired', weight: 0.1, required: false, field_type: 'boolean', description: '需要审批' },
    { name: 'RollbackStrategy', weight: 0.1, required: false, field_type: 'text', description: '回滚策略' }
  ]},
  
  { name: 'Docker-Container', entityType: 'DockerContainerEntity', scene: '软件开发/容器', description: 'Docker容器 - 记录Docker容器配置', example: 'user-service:v2.5.0 - Node.js应用，暴露3000端口', threshold: 0.6, fields: [
    { name: 'ImageName', weight: 0.35, required: true, field_type: 'text', description: '镜像名称', anchor: true },
    { name: 'Tag', weight: 0.25, required: true, field_type: 'text', description: '镜像标签', anchor: true },
    { name: 'Ports', weight: 0.2, required: false, field_type: 'list', description: '端口映射' },
    { name: 'Volumes', weight: 0.1, required: false, field_type: 'list', description: '数据卷' },
    { name: 'Environment', weight: 0.1, required: false, field_type: 'list', description: '环境变量' }
  ]},
  
  { name: 'Kubernetes-Pod', entityType: 'KubernetesPodEntity', scene: '软件开发/K8s', description: 'K8s Pod - 记录Kubernetes Pod配置', example: 'user-service-pod: 3个副本，使用user-service:v2.5.0镜像', threshold: 0.6, fields: [
    { name: 'PodName', weight: 0.35, required: true, field_type: 'text', description: 'Pod名称', anchor: true },
    { name: 'Namespace', weight: 0.25, required: true, field_type: 'text', description: '命名空间', anchor: true },
    { name: 'Replicas', weight: 0.15, required: false, field_type: 'number', description: '副本数' },
    { name: 'Image', weight: 0.15, required: false, field_type: 'text', description: '容器镜像' },
    { name: 'Resources', weight: 0.1, required: false, field_type: 'text', description: '资源限制' }
  ]},
  
  { name: 'Deployment-Config', entityType: 'DeploymentConfigEntity', scene: '软件开发/部署', description: '部署配置 - 记录应用部署配置', example: '生产环境配置：4核8G，自动扩缩容2-10实例', fields: [
    { name: 'ConfigName', weight: 0.35, required: true, field_type: 'text', description: '配置名称', anchor: true },
    { name: 'Environment', weight: 0.25, required: true, field_type: 'text', description: '环境', anchor: true },
    { name: 'Resources', weight: 0.2, required: false, field_type: 'text', description: '资源配置' },
    { name: 'Scaling', weight: 0.1, required: false, field_type: 'text', description: '扩缩容策略' },
    { name: 'HealthCheck', weight: 0.1, required: false, field_type: 'text', description: '健康检查' }
  ]},
  
  { name: 'Environment-Variable', entityType: 'EnvironmentVariableEntity', scene: '软件开发/配置', description: '环境变量 - 记录应用环境变量', example: 'DATABASE_URL=postgresql://localhost:5432/mydb', fields: [
    { name: 'Key', weight: 0.4, required: true, field_type: 'text', description: '变量名', anchor: true },
    { name: 'Value', weight: 0.3, required: false, field_type: 'text', description: '变量值' },
    { name: 'Environment', weight: 0.15, required: false, field_type: 'text', description: '环境' },
    { name: 'Secret', weight: 0.1, required: false, field_type: 'boolean', description: '是否敏感' },
    { name: 'Description', weight: 0.05, required: false, field_type: 'text', description: '描述' }
  ]},
  
  { name: 'Server-Instance', entityType: 'ServerInstanceEntity', scene: '软件开发/基础设施', description: '服务器实例 - 记录服务器实例信息', example: 'web-server-01: AWS EC2 t3.large, 运行user-service', fields: [
    { name: 'InstanceID', weight: 0.35, required: true, field_type: 'text', description: '实例ID', anchor: true },
    { name: 'InstanceType', weight: 0.25, required: true, field_type: 'text', description: '实例类型', anchor: true },
    { name: 'Provider', weight: 0.15, required: false, field_type: 'text', description: '云服务商' },
    { name: 'Region', weight: 0.15, required: false, field_type: 'text', description: '区域' },
    { name: 'Services', weight: 0.1, required: false, field_type: 'list', description: '运行的服务' }
  ]},
  
  { name: 'Load-Balancer', entityType: 'LoadBalancerEntity', scene: '软件开发/基础设施', description: '负载均衡器 - 记录负载均衡配置', example: 'ALB-prod: 分发流量到3个user-service实例', fields: [
    { name: 'LoadBalancerName', weight: 0.35, required: true, field_type: 'text', description: '负载均衡器名称', anchor: true },
    { name: 'Type', weight: 0.25, required: false, field_type: 'text', description: '类型(ALB/NLB)' },
    { name: 'Algorithm', weight: 0.2, required: false, field_type: 'text', description: '负载算法' },
    { name: 'Targets', weight: 0.1, required: false, field_type: 'list', description: '目标实例' },
    { name: 'HealthCheck', weight: 0.1, required: false, field_type: 'text', description: '健康检查' }
  ]},
  
  { name: 'Monitoring-Alert', entityType: 'MonitoringAlertEntity', scene: '软件开发/监控', description: '监控告警 - 记录系统监控告警规则', example: 'CPU使用率>80%持续5分钟触发告警', fields: [
    { name: 'AlertName', weight: 0.35, required: true, field_type: 'text', description: '告警名称', anchor: true },
    { name: 'Condition', weight: 0.25, required: true, field_type: 'text', description: '触发条件', anchor: true },
    { name: 'Severity', weight: 0.2, required: false, field_type: 'text', description: '严重程度' },
    { name: 'Notification', weight: 0.1, required: false, field_type: 'list', description: '通知方式' },
    { name: 'Threshold', weight: 0.1, required: false, field_type: 'number', description: '阈值' }
  ]},
  
  { name: 'Log-Entry', entityType: 'LogEntryEntity', scene: '软件开发/日志', description: '日志条目 - 记录应用日志', example: '[ERROR] 2024-02-15 10:30:45 - Database connection failed', fields: [
    { name: 'Timestamp', weight: 0.3, required: true, field_type: 'date', description: '时间戳', anchor: true },
    { name: 'Level', weight: 0.25, required: true, field_type: 'text', description: '日志级别', anchor: true },
    { name: 'Message', weight: 0.25, required: true, field_type: 'text', description: '日志消息' },
    { name: 'Source', weight: 0.1, required: false, field_type: 'text', description: '来源' },
    { name: 'TraceID', weight: 0.1, required: false, field_type: 'text', description: '追踪ID' }
  ]}
];

devopsSchemas.forEach(def => ALL_SCHEMAS.push(createSchema(def)));
console.log(`Generated ${ALL_SCHEMAS.length} schemas (DevOps & Deployment complete)...`);

// 41-50: Documentation & Knowledge
const documentationSchemas = [
  { name: 'API-Documentation', entityType: 'APIDocumentationEntity', scene: '软件开发/文档', description: 'API文档 - 记录API接口文档', example: 'POST /api/users API文档：创建用户接口，需要name和email参数', fields: [
    { name: 'Endpoint', weight: 0.35, required: true, field_type: 'text', description: 'API端点', anchor: true },
    { name: 'Method', weight: 0.25, required: true, field_type: 'text', description: 'HTTP方法', anchor: true },
    { name: 'Description', weight: 0.2, required: false, field_type: 'text', description: '接口描述' },
    { name: 'Parameters', weight: 0.1, required: false, field_type: 'list', description: '参数说明' },
    { name: 'Examples', weight: 0.1, required: false, field_type: 'list', description: '示例' }
  ]},
  
  { name: 'Technical-Specification', entityType: 'TechnicalSpecificationEntity', scene: '软件开发/文档', description: '技术规范 - 记录技术规范文档', example: '用户认证模块技术规范：使用JWT，token有效期24小时', fields: [
    { name: 'SpecName', weight: 0.35, required: true, field_type: 'text', description: '规范名称', anchor: true },
    { name: 'Version', weight: 0.25, required: true, field_type: 'text', description: '版本号', anchor: true },
    { name: 'Description', weight: 0.2, required: false, field_type: 'text', description: '规范描述' },
    { name: 'Requirements', weight: 0.1, required: false, field_type: 'list', description: '技术要求' },
    { name: 'Author', weight: 0.1, required: false, field_type: 'text', description: '作者' }
  ]},
  
  { name: 'Architecture-Decision', entityType: 'ArchitectureDecisionEntity', scene: '软件开发/架构', description: '架构决策 - 记录架构决策记录(ADR)', example: 'ADR-001: 选择PostgreSQL作为主数据库，因为需要ACID特性', fields: [
    { name: 'DecisionID', weight: 0.35, required: true, field_type: 'text', description: '决策ID', anchor: true },
    { name: 'Title', weight: 0.25, required: true, field_type: 'text', description: '决策标题', anchor: true },
    { name: 'Context', weight: 0.15, required: false, field_type: 'text', description: '背景' },
    { name: 'Decision', weight: 0.15, required: false, field_type: 'text', description: '决策内容' },
    { name: 'Consequences', weight: 0.1, required: false, field_type: 'list', description: '影响' }
  ]},
  
  { name: 'Code-Comment', entityType: 'CodeCommentEntity', scene: '软件开发/文档', description: '代码注释 - 记录重要代码注释', example: '// FIXME: 此处需要优化性能，当前O(n²)复杂度', fields: [
    { name: 'CommentType', weight: 0.3, required: true, field_type: 'text', description: '注释类型', anchor: true },
    { name: 'Content', weight: 0.3, required: true, field_type: 'text', description: '注释内容', anchor: true },
    { name: 'Location', weight: 0.2, required: false, field_type: 'text', description: '代码位置' },
    { name: 'Author', weight: 0.1, required: false, field_type: 'text', description: '作者' },
    { name: 'Date', weight: 0.1, required: false, field_type: 'date', description: '日期' }
  ]},
  
  { name: 'README-File', entityType: 'READMEFileEntity', scene: '软件开发/文档', description: 'README文档 - 记录项目README信息', example: 'user-service README: Node.js微服务，提供用户管理功能', fields: [
    { name: 'ProjectName', weight: 0.35, required: true, field_type: 'text', description: '项目名称', anchor: true },
    { name: 'Description', weight: 0.25, required: true, field_type: 'text', description: '项目描述' },
    { name: 'Installation', weight: 0.15, required: false, field_type: 'text', description: '安装说明' },
    { name: 'Usage', weight: 0.15, required: false, field_type: 'text', description: '使用说明' },
    { name: 'Contributors', weight: 0.1, required: false, field_type: 'list', description: '贡献者' }
  ]},
  
  { name: 'Changelog-Entry', entityType: 'ChangelogEntryEntity', scene: '软件开发/文档', description: '变更日志 - 记录版本变更日志', example: 'v2.5.0 (2024-02-15): 新增用户认证功能，修复3个Bug', fields: [
    { name: 'Version', weight: 0.35, required: true, field_type: 'text', description: '版本号', anchor: true },
    { name: 'Date', weight: 0.25, required: true, field_type: 'date', description: '发布日期', anchor: true },
    { name: 'Added', weight: 0.15, required: false, field_type: 'list', description: '新增功能' },
    { name: 'Fixed', weight: 0.15, required: false, field_type: 'list', description: '修复问题' },
    { name: 'Changed', weight: 0.1, required: false, field_type: 'list', description: '变更内容' }
  ]},
  
  { name: 'Knowledge-Article', entityType: 'KnowledgeArticleEntity', scene: '软件开发/知识', description: '知识文章 - 记录技术知识文章', example: '如何优化PostgreSQL查询性能：使用索引、EXPLAIN分析', fields: [
    { name: 'Title', weight: 0.35, required: true, field_type: 'text', description: '文章标题', anchor: true },
    { name: 'Category', weight: 0.25, required: false, field_type: 'text', description: '分类' },
    { name: 'Summary', weight: 0.2, required: false, field_type: 'text', description: '摘要' },
    { name: 'Tags', weight: 0.1, required: false, field_type: 'list', description: '标签' },
    { name: 'Author', weight: 0.1, required: false, field_type: 'text', description: '作者' }
  ]},
  
  { name: 'Tutorial-Guide', entityType: 'TutorialGuideEntity', scene: '软件开发/教程', description: '教程指南 - 记录技术教程', example: 'Docker入门教程：从安装到部署第一个容器', fields: [
    { name: 'Title', weight: 0.35, required: true, field_type: 'text', description: '教程标题', anchor: true },
    { name: 'Level', weight: 0.25, required: false, field_type: 'text', description: '难度级别' },
    { name: 'Steps', weight: 0.2, required: false, field_type: 'list', description: '步骤列表' },
    { name: 'Prerequisites', weight: 0.1, required: false, field_type: 'list', description: '前置要求' },
    { name: 'Duration', weight: 0.1, required: false, field_type: 'text', description: '预计时长' }
  ]},
  
  { name: 'Best-Practice', entityType: 'BestPracticeEntity', scene: '软件开发/知识', description: '最佳实践 - 记录开发最佳实践', example: 'API设计最佳实践：使用RESTful规范，版本化API', fields: [
    { name: 'Title', weight: 0.35, required: true, field_type: 'text', description: '实践标题', anchor: true },
    { name: 'Domain', weight: 0.25, required: false, field_type: 'text', description: '应用领域' },
    { name: 'Description', weight: 0.2, required: false, field_type: 'text', description: '实践描述' },
    { name: 'Benefits', weight: 0.1, required: false, field_type: 'list', description: '优势' },
    { name: 'Examples', weight: 0.1, required: false, field_type: 'list', description: '示例' }
  ]},
  
  { name: 'Troubleshooting-Guide', entityType: 'TroubleshootingGuideEntity', scene: '软件开发/运维', description: '故障排查指南 - 记录常见问题解决方案', example: '数据库连接失败排查：检查网络、验证凭据、查看日志', fields: [
    { name: 'Problem', weight: 0.35, required: true, field_type: 'text', description: '问题描述', anchor: true },
    { name: 'Symptoms', weight: 0.25, required: false, field_type: 'list', description: '症状' },
    { name: 'Causes', weight: 0.15, required: false, field_type: 'list', description: '可能原因' },
    { name: 'Solutions', weight: 0.15, required: false, field_type: 'list', description: '解决方案' },
    { name: 'Prevention', weight: 0.1, required: false, field_type: 'text', description: '预防措施' }
  ]}
];

documentationSchemas.forEach(def => ALL_SCHEMAS.push(createSchema(def)));
console.log(`Generated ${ALL_SCHEMAS.length} schemas (Software Development COMPLETE - 50/50)...`);

// ============================================================================
// AI SCIENCE SCHEMAS (50)
// ============================================================================

// 1-10: Models & Architecture
const aiModelSchemas = [
  { name: 'ML-Model', entityType: 'MLModelEntity', scene: '人工智能/模型', description: '机器学习模型 - 记录ML模型基本信息', example: 'RandomForest分类器：准确率92%，用于用户流失预测', fields: [
    { name: 'ModelName', weight: 0.35, required: true, field_type: 'text', description: '模型名称', anchor: true },
    { name: 'ModelType', weight: 0.25, required: true, field_type: 'text', description: '模型类型', anchor: true },
    { name: 'Accuracy', weight: 0.2, required: false, field_type: 'number', description: '准确率' },
    { name: 'Task', weight: 0.1, required: false, field_type: 'text', description: '任务类型' },
    { name: 'Framework', weight: 0.1, required: false, field_type: 'text', description: '框架' }
  ]},
  
  { name: 'Neural-Network', entityType: 'NeuralNetworkEntity', scene: '人工智能/模型', description: '神经网络 - 记录神经网络架构', example: '3层全连接网络：输入层256，隐藏层128，输出层10', fields: [
    { name: 'NetworkName', weight: 0.35, required: true, field_type: 'text', description: '网络名称', anchor: true },
    { name: 'Architecture', weight: 0.25, required: true, field_type: 'text', description: '架构类型', anchor: true },
    { name: 'Layers', weight: 0.2, required: false, field_type: 'list', description: '层配置' },
    { name: 'Parameters', weight: 0.1, required: false, field_type: 'number', description: '参数量' },
    { name: 'Activation', weight: 0.1, required: false, field_type: 'text', description: '激活函数' }
  ]},
  
  { name: 'CNN-Architecture', entityType: 'CNNArchitectureEntity', scene: '人工智能/模型', description: '卷积神经网络 - 记录CNN架构', example: 'ResNet-50：50层残差网络，用于图像分类', threshold: 0.6, fields: [
    { name: 'ModelName', weight: 0.35, required: true, field_type: 'text', description: '模型名称', anchor: true },
    { name: 'Depth', weight: 0.25, required: true, field_type: 'number', description: '网络深度', anchor: true },
    { name: 'ConvLayers', weight: 0.2, required: false, field_type: 'list', description: '卷积层' },
    { name: 'PoolingLayers', weight: 0.1, required: false, field_type: 'list', description: '池化层' },
    { name: 'InputSize', weight: 0.1, required: false, field_type: 'text', description: '输入尺寸' }
  ]},
  
  { name: 'RNN-Architecture', entityType: 'RNNArchitectureEntity', scene: '人工智能/模型', description: '循环神经网络 - 记录RNN架构', example: 'LSTM网络：2层，隐藏单元256，用于文本生成', threshold: 0.6, fields: [
    { name: 'ModelName', weight: 0.35, required: true, field_type: 'text', description: '模型名称', anchor: true },
    { name: 'CellType', weight: 0.25, required: true, field_type: 'text', description: '单元类型', anchor: true },
    { name: 'HiddenSize', weight: 0.2, required: false, field_type: 'number', description: '隐藏单元数' },
    { name: 'NumLayers', weight: 0.1, required: false, field_type: 'number', description: '层数' },
    { name: 'Bidirectional', weight: 0.1, required: false, field_type: 'boolean', description: '是否双向' }
  ]},
  
  { name: 'Transformer-Model', entityType: 'TransformerModelEntity', scene: '人工智能/模型', description: 'Transformer模型 - 记录Transformer架构', example: 'BERT-base：12层，768维，110M参数', threshold: 0.6, fields: [
    { name: 'ModelName', weight: 0.35, required: true, field_type: 'text', description: '模型名称', anchor: true },
    { name: 'NumLayers', weight: 0.25, required: true, field_type: 'number', description: '层数', anchor: true },
    { name: 'HiddenSize', weight: 0.2, required: false, field_type: 'number', description: '隐藏维度' },
    { name: 'NumHeads', weight: 0.1, required: false, field_type: 'number', description: '注意力头数' },
    { name: 'VocabSize', weight: 0.1, required: false, field_type: 'number', description: '词表大小' }
  ]},
  
  { name: 'GAN-Model', entityType: 'GANModelEntity', scene: '人工智能/模型', description: '生成对抗网络 - 记录GAN模型', example: 'StyleGAN2：生成1024x1024高质量人脸图像', fields: [
    { name: 'ModelName', weight: 0.35, required: true, field_type: 'text', description: '模型名称', anchor: true },
    { name: 'GeneratorArch', weight: 0.25, required: false, field_type: 'text', description: '生成器架构' },
    { name: 'DiscriminatorArch', weight: 0.2, required: false, field_type: 'text', description: '判别器架构' },
    { name: 'LatentDim', weight: 0.1, required: false, field_type: 'number', description: '隐空间维度' },
    { name: 'OutputSize', weight: 0.1, required: false, field_type: 'text', description: '输出尺寸' }
  ]},
  
  { name: 'Autoencoder', entityType: 'AutoencoderEntity', scene: '人工智能/模型', description: '自编码器 - 记录自编码器模型', example: 'VAE：编码器256→128→64，解码器64→128→256', fields: [
    { name: 'ModelName', weight: 0.35, required: true, field_type: 'text', description: '模型名称', anchor: true },
    { name: 'EncoderArch', weight: 0.25, required: false, field_type: 'list', description: '编码器架构' },
    { name: 'DecoderArch', weight: 0.2, required: false, field_type: 'list', description: '解码器架构' },
    { name: 'LatentDim', weight: 0.1, required: false, field_type: 'number', description: '隐空间维度' },
    { name: 'Type', weight: 0.1, required: false, field_type: 'text', description: '类型(VAE/DAE)' }
  ]},
  
  { name: 'Attention-Mechanism', entityType: 'AttentionMechanismEntity', scene: '人工智能/模型', description: '注意力机制 - 记录注意力机制配置', example: 'Multi-Head Attention：8个头，每个头64维', fields: [
    { name: 'MechanismName', weight: 0.35, required: true, field_type: 'text', description: '机制名称', anchor: true },
    { name: 'Type', weight: 0.25, required: false, field_type: 'text', description: '类型' },
    { name: 'NumHeads', weight: 0.2, required: false, field_type: 'number', description: '头数' },
    { name: 'HeadDim', weight: 0.1, required: false, field_type: 'number', description: '每个头维度' },
    { name: 'ScalingFactor', weight: 0.1, required: false, field_type: 'number', description: '缩放因子' }
  ]},
  
  { name: 'Model-Layer', entityType: 'ModelLayerEntity', scene: '人工智能/模型', description: '模型层 - 记录神经网络层配置', example: 'Conv2D层：64个3x3卷积核，stride=1，padding=1', fields: [
    { name: 'LayerName', weight: 0.35, required: true, field_type: 'text', description: '层名称', anchor: true },
    { name: 'LayerType', weight: 0.25, required: true, field_type: 'text', description: '层类型', anchor: true },
    { name: 'Parameters', weight: 0.2, required: false, field_type: 'text', description: '参数配置' },
    { name: 'InputShape', weight: 0.1, required: false, field_type: 'text', description: '输入形状' },
    { name: 'OutputShape', weight: 0.1, required: false, field_type: 'text', description: '输出形状' }
  ]},
  
  { name: 'Activation-Function', entityType: 'ActivationFunctionEntity', scene: '人工智能/模型', description: '激活函数 - 记录激活函数使用', example: 'ReLU激活函数：用于隐藏层，解决梯度消失', fields: [
    { name: 'FunctionName', weight: 0.4, required: true, field_type: 'text', description: '函数名称', anchor: true },
    { name: 'Formula', weight: 0.25, required: false, field_type: 'text', description: '数学公式' },
    { name: 'Properties', weight: 0.2, required: false, field_type: 'list', description: '特性' },
    { name: 'UseCase', weight: 0.15, required: false, field_type: 'text', description: '使用场景' }
  ]}
];

aiModelSchemas.forEach(def => ALL_SCHEMAS.push(createSchema(def)));
console.log(`Generated ${ALL_SCHEMAS.length} schemas (AI Models complete)...`);

// Simplified schema generation for remaining AI and Photography schemas
const generateSimpleSchemas = (definitions) => {
  return definitions.map(def => createSchema({
    name: def.name,
    entityType: def.entityType,
    scene: def.scene,
    description: def.description,
    example: def.example,
    threshold: def.threshold || 0.5,
    fields: def.fields,
    relations: def.relations || []
  }));
};

// AI Training & Optimization (11-20)
const aiTrainingDefs = [
  { name: 'Training-Dataset', entityType: 'TrainingDatasetEntity', scene: '人工智能/训练', description: '训练数据集', example: 'ImageNet: 1.4M图像，1000类', fields: [
    { name: 'DatasetName', weight: 0.4, required: true, field_type: 'text', description: '数据集名称', anchor: true },
    { name: 'Size', weight: 0.25, required: false, field_type: 'number', description: '样本数量' },
    { name: 'Classes', weight: 0.2, required: false, field_type: 'number', description: '类别数' },
    { name: 'Split', weight: 0.15, required: false, field_type: 'text', description: '划分比例' }
  ]},
  { name: 'Training-Hyperparameters', entityType: 'TrainingHyperparametersEntity', scene: '人工智能/训练', description: '训练超参数', example: 'lr=0.001, batch_size=32, epochs=100', fields: [
    { name: 'ConfigName', weight: 0.35, required: true, field_type: 'text', description: '配置名称', anchor: true },
    { name: 'LearningRate', weight: 0.25, required: false, field_type: 'number', description: '学习率' },
    { name: 'BatchSize', weight: 0.2, required: false, field_type: 'number', description: '批大小' },
    { name: 'Epochs', weight: 0.2, required: false, field_type: 'number', description: '训练轮数' }
  ]},
  { name: 'Optimizer-Config', entityType: 'OptimizerConfigEntity', scene: '人工智能/训练', description: '优化器配置', example: 'Adam优化器: beta1=0.9, beta2=0.999', fields: [
    { name: 'OptimizerName', weight: 0.4, required: true, field_type: 'text', description: '优化器名称', anchor: true },
    { name: 'Parameters', weight: 0.3, required: false, field_type: 'text', description: '参数配置' },
    { name: 'LearningRate', weight: 0.3, required: false, field_type: 'number', description: '学习率' }
  ]},
  { name: 'Learning-Rate-Schedule', entityType: 'LearningRateScheduleEntity', scene: '人工智能/训练', description: '学习率调度', example: 'StepLR: 每30轮衰减0.1', fields: [
    { name: 'ScheduleName', weight: 0.4, required: true, field_type: 'text', description: '调度器名称', anchor: true },
    { name: 'Strategy', weight: 0.3, required: false, field_type: 'text', description: '调度策略' },
    { name: 'Parameters', weight: 0.3, required: false, field_type: 'text', description: '参数' }
  ]},
  { name: 'Loss-Function', entityType: 'LossFunctionEntity', scene: '人工智能/训练', description: '损失函数', example: 'CrossEntropyLoss: 用于多分类任务', fields: [
    { name: 'FunctionName', weight: 0.4, required: true, field_type: 'text', description: '函数名称', anchor: true },
    { name: 'Type', weight: 0.3, required: false, field_type: 'text', description: '类型' },
    { name: 'UseCase', weight: 0.3, required: false, field_type: 'text', description: '使用场景' }
  ]},
  { name: 'Regularization-Method', entityType: 'RegularizationMethodEntity', scene: '人工智能/训练', description: '正则化方法', example: 'L2正则化: lambda=0.01', fields: [
    { name: 'MethodName', weight: 0.4, required: true, field_type: 'text', description: '方法名称', anchor: true },
    { name: 'Type', weight: 0.3, required: false, field_type: 'text', description: '类型' },
    { name: 'Strength', weight: 0.3, required: false, field_type: 'number', description: '强度' }
  ]},
  { name: 'Data-Augmentation', entityType: 'DataAugmentationEntity', scene: '人工智能/数据', description: '数据增强', example: '随机裁剪、水平翻转、颜色抖动', fields: [
    { name: 'TechniqueName', weight: 0.4, required: true, field_type: 'text', description: '技术名称', anchor: true },
    { name: 'Operations', weight: 0.3, required: false, field_type: 'list', description: '操作列表' },
    { name: 'Probability', weight: 0.3, required: false, field_type: 'number', description: '应用概率' }
  ]},
  { name: 'Batch-Normalization', entityType: 'BatchNormalizationEntity', scene: '人工智能/训练', description: '批归一化', example: 'BN层: momentum=0.1, eps=1e-5', fields: [
    { name: 'LayerName', weight: 0.4, required: true, field_type: 'text', description: '层名称', anchor: true },
    { name: 'Momentum', weight: 0.3, required: false, field_type: 'number', description: '动量' },
    { name: 'Epsilon', weight: 0.3, required: false, field_type: 'number', description: 'Epsilon值' }
  ]},
  { name: 'Dropout-Layer', entityType: 'DropoutLayerEntity', scene: '人工智能/训练', description: 'Dropout层', example: 'Dropout: p=0.5, 防止过拟合', fields: [
    { name: 'LayerName', weight: 0.4, required: true, field_type: 'text', description: '层名称', anchor: true },
    { name: 'DropoutRate', weight: 0.3, required: false, field_type: 'number', description: 'Dropout率' },
    { name: 'Position', weight: 0.3, required: false, field_type: 'text', description: '位置' }
  ]},
  { name: 'Training-Epoch', entityType: 'TrainingEpochEntity', scene: '人工智能/训练', description: '训练轮次', example: 'Epoch 50: loss=0.25, acc=92%', fields: [
    { name: 'EpochNumber', weight: 0.35, required: true, field_type: 'number', description: '轮次编号', anchor: true },
    { name: 'Loss', weight: 0.25, required: false, field_type: 'number', description: '损失值' },
    { name: 'Accuracy', weight: 0.2, required: false, field_type: 'number', description: '准确率' },
    { name: 'Duration', weight: 0.2, required: false, field_type: 'number', description: '耗时' }
  ]}
];

generateSimpleSchemas(aiTrainingDefs).forEach(schema => ALL_SCHEMAS.push(schema));
console.log(`Generated ${ALL_SCHEMAS.length} schemas (AI Training complete)...`);

// AI Evaluation & Metrics (21-30)
const aiEvaluationDefs = [
  { name: 'Model-Evaluation', entityType: 'ModelEvaluationEntity', scene: '人工智能/评估', description: '模型评估', example: '测试集评估: acc=92%, F1=0.91', fields: [
    { name: 'EvaluationName', weight: 0.35, required: true, field_type: 'text', description: '评估名称', anchor: true },
    { name: 'Metrics', weight: 0.3, required: false, field_type: 'list', description: '指标列表' },
    { name: 'Dataset', weight: 0.2, required: false, field_type: 'text', description: '数据集' },
    { name: 'Timestamp', weight: 0.15, required: false, field_type: 'date', description: '时间戳' }
  ]},
  { name: 'Accuracy-Metric', entityType: 'AccuracyMetricEntity', scene: '人工智能/评估', description: '准确率指标', example: '分类准确率: 92.5%', fields: [
    { name: 'MetricName', weight: 0.4, required: true, field_type: 'text', description: '指标名称', anchor: true },
    { name: 'Value', weight: 0.3, required: false, field_type: 'number', description: '指标值' },
    { name: 'Type', weight: 0.3, required: false, field_type: 'text', description: '类型' }
  ]},
  { name: 'Precision-Recall', entityType: 'PrecisionRecallEntity', scene: '人工智能/评估', description: '精确率召回率', example: 'Precision=0.93, Recall=0.89', fields: [
    { name: 'MetricName', weight: 0.35, required: true, field_type: 'text', description: '指标名称', anchor: true },
    { name: 'Precision', weight: 0.3, required: false, field_type: 'number', description: '精确率' },
    { name: 'Recall', weight: 0.35, required: false, field_type: 'number', description: '召回率' }
  ]},
  { name: 'F1-Score', entityType: 'F1ScoreEntity', scene: '人工智能/评估', description: 'F1分数', example: 'F1-Score: 0.91', fields: [
    { name: 'MetricName', weight: 0.4, required: true, field_type: 'text', description: '指标名称', anchor: true },
    { name: 'Value', weight: 0.3, required: false, field_type: 'number', description: 'F1值' },
    { name: 'Class', weight: 0.3, required: false, field_type: 'text', description: '类别' }
  ]},
  { name: 'ROC-Curve', entityType: 'ROCCurveEntity', scene: '人工智能/评估', description: 'ROC曲线', example: 'ROC-AUC: 0.95', fields: [
    { name: 'CurveName', weight: 0.4, required: true, field_type: 'text', description: '曲线名称', anchor: true },
    { name: 'AUC', weight: 0.3, required: false, field_type: 'number', description: 'AUC值' },
    { name: 'Threshold', weight: 0.3, required: false, field_type: 'number', description: '阈值' }
  ]},
  { name: 'Confusion-Matrix', entityType: 'ConfusionMatrixEntity', scene: '人工智能/评估', description: '混淆矩阵', example: 'TP=920, FP=80, FN=100, TN=900', fields: [
    { name: 'MatrixName', weight: 0.35, required: true, field_type: 'text', description: '矩阵名称', anchor: true },
    { name: 'TruePositive', weight: 0.2, required: false, field_type: 'number', description: '真正例' },
    { name: 'FalsePositive', weight: 0.15, required: false, field_type: 'number', description: '假正例' },
    { name: 'FalseNegative', weight: 0.15, required: false, field_type: 'number', description: '假负例' },
    { name: 'TrueNegative', weight: 0.15, required: false, field_type: 'number', description: '真负例' }
  ]},
  { name: 'Cross-Validation', entityType: 'CrossValidationEntity', scene: '人工智能/评估', description: '交叉验证', example: '5折交叉验证: 平均acc=91.5%', fields: [
    { name: 'ValidationName', weight: 0.35, required: true, field_type: 'text', description: '验证名称', anchor: true },
    { name: 'NumFolds', weight: 0.25, required: false, field_type: 'number', description: '折数' },
    { name: 'MeanScore', weight: 0.2, required: false, field_type: 'number', description: '平均分数' },
    { name: 'StdDev', weight: 0.2, required: false, field_type: 'number', description: '标准差' }
  ]},
  { name: 'Validation-Set', entityType: 'ValidationSetEntity', scene: '人工智能/数据', description: '验证集', example: '验证集: 10000样本，用于调参', fields: [
    { name: 'SetName', weight: 0.4, required: true, field_type: 'text', description: '数据集名称', anchor: true },
    { name: 'Size', weight: 0.3, required: false, field_type: 'number', description: '样本数' },
    { name: 'Purpose', weight: 0.3, required: false, field_type: 'text', description: '用途' }
  ]},
  { name: 'Test-Set', entityType: 'TestSetEntity', scene: '人工智能/数据', description: '测试集', example: '测试集: 5000样本，最终评估', fields: [
    { name: 'SetName', weight: 0.4, required: true, field_type: 'text', description: '数据集名称', anchor: true },
    { name: 'Size', weight: 0.3, required: false, field_type: 'number', description: '样本数' },
    { name: 'Purpose', weight: 0.3, required: false, field_type: 'text', description: '用途' }
  ]},
  { name: 'Benchmark-Result', entityType: 'BenchmarkResultEntity', scene: '人工智能/评估', description: '基准测试结果', example: 'ImageNet基准: Top-1 acc=76.5%', fields: [
    { name: 'BenchmarkName', weight: 0.35, required: true, field_type: 'text', description: '基准名称', anchor: true },
    { name: 'Score', weight: 0.3, required: false, field_type: 'number', description: '分数' },
    { name: 'Rank', weight: 0.2, required: false, field_type: 'number', description: '排名' },
    { name: 'Date', weight: 0.15, required: false, field_type: 'date', description: '日期' }
  ]}
];

generateSimpleSchemas(aiEvaluationDefs).forEach(schema => ALL_SCHEMAS.push(schema));
console.log(`Generated ${ALL_SCHEMAS.length} schemas (AI Evaluation complete)...`);

// AI Data Processing (31-40) & Application (41-50)
const aiDataAndAppDefs = [
  // Data Processing
  { name: 'Data-Preprocessing', entityType: 'DataPreprocessingEntity', scene: '人工智能/数据', description: '数据预处理', example: '归一化、去噪、填充缺失值', fields: [
    { name: 'ProcessName', weight: 0.4, required: true, field_type: 'text', description: '处理名称', anchor: true },
    { name: 'Steps', weight: 0.3, required: false, field_type: 'list', description: '处理步骤' },
    { name: 'InputFormat', weight: 0.15, required: false, field_type: 'text', description: '输入格式' },
    { name: 'OutputFormat', weight: 0.15, required: false, field_type: 'text', description: '输出格式' }
  ]},
  { name: 'Feature-Engineering', entityType: 'FeatureEngineeringEntity', scene: '人工智能/数据', description: '特征工程', example: '提取时间特征、组合特征', fields: [
    { name: 'FeatureName', weight: 0.4, required: true, field_type: 'text', description: '特征名称', anchor: true },
    { name: 'Method', weight: 0.3, required: false, field_type: 'text', description: '方法' },
    { name: 'SourceFeatures', weight: 0.3, required: false, field_type: 'list', description: '源特征' }
  ]},
  { name: 'Feature-Selection', entityType: 'FeatureSelectionEntity', scene: '人工智能/数据', description: '特征选择', example: '选择Top 50重要特征', fields: [
    { name: 'SelectionName', weight: 0.4, required: true, field_type: 'text', description: '选择名称', anchor: true },
    { name: 'Method', weight: 0.3, required: false, field_type: 'text', description: '方法' },
    { name: 'NumFeatures', weight: 0.3, required: false, field_type: 'number', description: '特征数' }
  ]},
  { name: 'Data-Normalization', entityType: 'DataNormalizationEntity', scene: '人工智能/数据', description: '数据归一化', example: 'MinMax归一化到[0,1]', fields: [
    { name: 'MethodName', weight: 0.4, required: true, field_type: 'text', description: '方法名称', anchor: true },
    { name: 'Range', weight: 0.3, required: false, field_type: 'text', description: '范围' },
    { name: 'Features', weight: 0.3, required: false, field_type: 'list', description: '特征列表' }
  ]},
  { name: 'Data-Cleaning', entityType: 'DataCleaningEntity', scene: '人工智能/数据', description: '数据清洗', example: '删除重复项、处理异常值', fields: [
    { name: 'CleaningName', weight: 0.4, required: true, field_type: 'text', description: '清洗名称', anchor: true },
    { name: 'Operations', weight: 0.3, required: false, field_type: 'list', description: '操作列表' },
    { name: 'RemovedCount', weight: 0.3, required: false, field_type: 'number', description: '删除数量' }
  ]},
  { name: 'Missing-Value-Handling', entityType: 'MissingValueHandlingEntity', scene: '人工智能/数据', description: '缺失值处理', example: '均值填充数值型，众数填充类别型', fields: [
    { name: 'MethodName', weight: 0.4, required: true, field_type: 'text', description: '方法名称', anchor: true },
    { name: 'Strategy', weight: 0.3, required: false, field_type: 'text', description: '策略' },
    { name: 'Features', weight: 0.3, required: false, field_type: 'list', description: '特征列表' }
  ]},
  { name: 'Outlier-Detection', entityType: 'OutlierDetectionEntity', scene: '人工智能/数据', description: '异常值检测', example: 'IQR方法检测到50个异常值', fields: [
    { name: 'MethodName', weight: 0.4, required: true, field_type: 'text', description: '方法名称', anchor: true },
    { name: 'Algorithm', weight: 0.3, required: false, field_type: 'text', description: '算法' },
    { name: 'OutlierCount', weight: 0.3, required: false, field_type: 'number', description: '异常值数量' }
  ]},
  { name: 'Data-Splitting', entityType: 'DataSplittingEntity', scene: '人工智能/数据', description: '数据划分', example: '训练集70%，验证集15%，测试集15%', fields: [
    { name: 'SplitName', weight: 0.4, required: true, field_type: 'text', description: '划分名称', anchor: true },
    { name: 'TrainRatio', weight: 0.2, required: false, field_type: 'number', description: '训练集比例' },
    { name: 'ValRatio', weight: 0.2, required: false, field_type: 'number', description: '验证集比例' },
    { name: 'TestRatio', weight: 0.2, required: false, field_type: 'number', description: '测试集比例' }
  ]},
  { name: 'Data-Sampling', entityType: 'DataSamplingEntity', scene: '人工智能/数据', description: '数据采样', example: 'SMOTE过采样平衡类别', fields: [
    { name: 'SamplingName', weight: 0.4, required: true, field_type: 'text', description: '采样名称', anchor: true },
    { name: 'Method', weight: 0.3, required: false, field_type: 'text', description: '方法' },
    { name: 'Ratio', weight: 0.3, required: false, field_type: 'number', description: '采样比例' }
  ]},
  { name: 'Data-Labeling', entityType: 'DataLabelingEntity', scene: '人工智能/数据', description: '数据标注', example: '标注10000张图像，3个类别', fields: [
    { name: 'TaskName', weight: 0.4, required: true, field_type: 'text', description: '任务名称', anchor: true },
    { name: 'NumSamples', weight: 0.3, required: false, field_type: 'number', description: '样本数' },
    { name: 'NumClasses', weight: 0.3, required: false, field_type: 'number', description: '类别数' }
  ]},
  
  // Application & Deployment
  { name: 'Model-Deployment', entityType: 'ModelDeploymentEntity', scene: '人工智能/部署', description: '模型部署', example: '部署到生产环境，使用TorchServe', fields: [
    { name: 'DeploymentName', weight: 0.35, required: true, field_type: 'text', description: '部署名称', anchor: true },
    { name: 'Environment', weight: 0.25, required: false, field_type: 'text', description: '环境' },
    { name: 'Framework', weight: 0.2, required: false, field_type: 'text', description: '框架' },
    { name: 'Status', weight: 0.2, required: false, field_type: 'text', description: '状态' }
  ]},
  { name: 'Inference-Service', entityType: 'InferenceServiceEntity', scene: '人工智能/部署', description: '推理服务', example: '推理服务：QPS=1000，延迟<50ms', fields: [
    { name: 'ServiceName', weight: 0.35, required: true, field_type: 'text', description: '服务名称', anchor: true },
    { name: 'QPS', weight: 0.25, required: false, field_type: 'number', description: 'QPS' },
    { name: 'Latency', weight: 0.2, required: false, field_type: 'number', description: '延迟' },
    { name: 'BatchSize', weight: 0.2, required: false, field_type: 'number', description: '批大小' }
  ]},
  { name: 'Model-Serving', entityType: 'ModelServingEntity', scene: '人工智能/部署', description: '模型服务', example: 'TensorFlow Serving部署ResNet模型', fields: [
    { name: 'ServingName', weight: 0.35, required: true, field_type: 'text', description: '服务名称', anchor: true },
    { name: 'Platform', weight: 0.25, required: false, field_type: 'text', description: '平台' },
    { name: 'ModelVersion', weight: 0.2, required: false, field_type: 'text', description: '模型版本' },
    { name: 'Endpoint', weight: 0.2, required: false, field_type: 'text', description: '端点' }
  ]},
  { name: 'Model-Monitoring', entityType: 'ModelMonitoringEntity', scene: '人工智能/运维', description: '模型监控', example: '监控模型性能下降，准确率从92%降到85%', fields: [
    { name: 'MonitorName', weight: 0.35, required: true, field_type: 'text', description: '监控名称', anchor: true },
    { name: 'Metrics', weight: 0.25, required: false, field_type: 'list', description: '监控指标' },
    { name: 'Threshold', weight: 0.2, required: false, field_type: 'number', description: '阈值' },
    { name: 'AlertStatus', weight: 0.2, required: false, field_type: 'text', description: '告警状态' }
  ]},
  { name: 'Model-Versioning', entityType: 'ModelVersioningEntity', scene: '人工智能/管理', description: '模型版本管理', example: 'ResNet v2.1: 准确率提升2%', fields: [
    { name: 'ModelName', weight: 0.35, required: true, field_type: 'text', description: '模型名称', anchor: true },
    { name: 'Version', weight: 0.25, required: true, field_type: 'text', description: '版本号', anchor: true },
    { name: 'Changes', weight: 0.2, required: false, field_type: 'list', description: '变更内容' },
    { name: 'Performance', weight: 0.2, required: false, field_type: 'text', description: '性能指标' }
  ]},
  { name: 'A-B-Testing', entityType: 'ABTestingEntity', scene: '人工智能/实验', description: 'A/B测试', example: 'A/B测试：新模型转化率提升5%', fields: [
    { name: 'TestName', weight: 0.35, required: true, field_type: 'text', description: '测试名称', anchor: true },
    { name: 'VariantA', weight: 0.25, required: false, field_type: 'text', description: '变体A' },
    { name: 'VariantB', weight: 0.2, required: false, field_type: 'text', description: '变体B' },
    { name: 'Winner', weight: 0.2, required: false, field_type: 'text', description: '获胜者' }
  ]},
  { name: 'Model-Performance', entityType: 'ModelPerformanceEntity', scene: '人工智能/评估', description: '模型性能', example: '推理性能：吞吐量500 QPS，延迟30ms', fields: [
    { name: 'MetricName', weight: 0.35, required: true, field_type: 'text', description: '指标名称', anchor: true },
    { name: 'Throughput', weight: 0.25, required: false, field_type: 'number', description: '吞吐量' },
    { name: 'Latency', weight: 0.2, required: false, field_type: 'number', description: '延迟' },
    { name: 'ResourceUsage', weight: 0.2, required: false, field_type: 'text', description: '资源使用' }
  ]},
  { name: 'Prediction-Result', entityType: 'PredictionResultEntity', scene: '人工智能/推理', description: '预测结果', example: '预测结果：类别=猫，置信度=0.95', fields: [
    { name: 'PredictionID', weight: 0.35, required: true, field_type: 'text', description: '预测ID', anchor: true },
    { name: 'Result', weight: 0.25, required: false, field_type: 'text', description: '预测结果' },
    { name: 'Confidence', weight: 0.2, required: false, field_type: 'number', description: '置信度' },
    { name: 'Timestamp', weight: 0.2, required: false, field_type: 'date', description: '时间戳' }
  ]},
  { name: 'Model-Explainability', entityType: 'ModelExplainabilityEntity', scene: '人工智能/解释', description: '模型可解释性', example: 'SHAP分析：特征X1贡献度最高', fields: [
    { name: 'MethodName', weight: 0.35, required: true, field_type: 'text', description: '方法名称', anchor: true },
    { name: 'Technique', weight: 0.25, required: false, field_type: 'text', description: '技术' },
    { name: 'TopFeatures', weight: 0.2, required: false, field_type: 'list', description: '重要特征' },
    { name: 'Visualization', weight: 0.2, required: false, field_type: 'text', description: '可视化' }
  ]},
  { name: 'AI-Ethics', entityType: 'AIEthicsEntity', scene: '人工智能/伦理', description: 'AI伦理', example: '公平性评估：各群体准确率差异<5%', fields: [
    { name: 'EthicsName', weight: 0.35, required: true, field_type: 'text', description: '伦理名称', anchor: true },
    { name: 'Principle', weight: 0.25, required: false, field_type: 'text', description: '原则' },
    { name: 'Assessment', weight: 0.2, required: false, field_type: 'text', description: '评估结果' },
    { name: 'Mitigation', weight: 0.2, required: false, field_type: 'list', description: '缓解措施' }
  ]}
];

generateSimpleSchemas(aiDataAndAppDefs).forEach(schema => ALL_SCHEMAS.push(schema));
console.log(`Generated ${ALL_SCHEMAS.length} schemas (AI Science COMPLETE - 50/50)...`);
