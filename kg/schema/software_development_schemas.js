/**
 * Software Development Domain Schemas (50 schemas)
 * 
 * Comprehensive schemas for software development, covering:
 * - Code & Architecture
 * - Development Process
 * - Testing & Quality
 * - DevOps & Deployment
 * - Documentation & Knowledge
 */

const schemas = [];

// ============================================================================
// 1. CODE & ARCHITECTURE (10 schemas)
// ============================================================================

schemas.push({
  schema_name: 'Code-Module',
  entity_type: 'CodeModuleEntity',
  scene: '软件开发/代码',
  description: '代码模块 - 记录代码模块的基本信息、功能和依赖关系',
  example_description: 'UserService模块，负责用户认证和授权，依赖DatabaseModule',
  core_fields: [
    { name: 'ModuleName', weight: 0.4, required: true, field_type: 'text', description: '模块名称', anchor: true },
    { name: 'Language', weight: 0.15, required: false, field_type: 'text', description: '编程语言' },
    { name: 'Purpose', weight: 0.2, required: false, field_type: 'text', description: '模块用途' },
    { name: 'Dependencies', weight: 0.15, required: false, field_type: 'list', description: '依赖模块' },
    { name: 'Author', weight: 0.1, required: false, field_type: 'text', description: '作者' }
  ],
  threshold: 0.5,
  relations: [
    { type: 'depends_on', target_field: 'Dependencies', direction: 'outgoing' },
    { type: 'authored_by', target_field: 'Author', direction: 'outgoing' }
  ],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'API-Endpoint',
  entity_type: 'APIEndpointEntity',
  scene: '软件开发/API',
  description: 'API端点 - 记录API接口的路径、方法、参数和响应',
  example_description: 'POST /api/users - 创建新用户，需要name和email参数',
  core_fields: [
    { name: 'Path', weight: 0.3, required: true, field_type: 'text', description: 'API路径', anchor: true },
    { name: 'Method', weight: 0.2, required: true, field_type: 'text', description: 'HTTP方法', anchor: true },
    { name: 'Parameters', weight: 0.2, required: false, field_type: 'list', description: '请求参数' },
    { name: 'Response', weight: 0.15, required: false, field_type: 'text', description: '响应格式' },
    { name: 'Authentication', weight: 0.15, required: false, field_type: 'text', description: '认证方式' }
  ],
  threshold: 0.6,
  relations: [],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Database-Schema',
  entity_type: 'DatabaseSchemaEntity',
  scene: '软件开发/数据库',
  description: '数据库模式 - 记录数据库表结构、字段和索引',
  example_description: 'users表：id(主键), name, email(唯一索引), created_at',
  core_fields: [
    { name: 'TableName', weight: 0.35, required: true, field_type: 'text', description: '表名', anchor: true },
    { name: 'Fields', weight: 0.3, required: true, field_type: 'list', description: '字段列表' },
    { name: 'PrimaryKey', weight: 0.15, required: false, field_type: 'text', description: '主键' },
    { name: 'Indexes', weight: 0.1, required: false, field_type: 'list', description: '索引' },
    { name: 'Relations', weight: 0.1, required: false, field_type: 'list', description: '关联表' }
  ],
  threshold: 0.6,
  relations: [
    { type: 'relates_to', target_field: 'Relations', direction: 'outgoing' }
  ],
  version: '1.0.0',
  active: true
});


schemas.push({
  schema_name: 'Design-Pattern',
  entity_type: 'DesignPatternEntity',
  scene: '软件开发/架构',
  description: '设计模式 - 记录使用的设计模式及其应用场景',
  example_description: '单例模式用于DatabaseConnection，确保全局唯一实例',
  core_fields: [
    { name: 'PatternName', weight: 0.4, required: true, field_type: 'text', description: '模式名称', anchor: true },
    { name: 'Category', weight: 0.2, required: false, field_type: 'text', description: '模式类别' },
    { name: 'UseCase', weight: 0.2, required: false, field_type: 'text', description: '应用场景' },
    { name: 'Implementation', weight: 0.2, required: false, field_type: 'text', description: '实现方式' }
  ],
  threshold: 0.5,
  relations: [],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Microservice',
  entity_type: 'MicroserviceEntity',
  scene: '软件开发/架构',
  description: '微服务 - 记录微服务的名称、职责和通信方式',
  example_description: 'UserService微服务，处理用户管理，通过gRPC通信',
  core_fields: [
    { name: 'ServiceName', weight: 0.35, required: true, field_type: 'text', description: '服务名称', anchor: true },
    { name: 'Responsibility', weight: 0.25, required: false, field_type: 'text', description: '服务职责' },
    { name: 'Protocol', weight: 0.2, required: false, field_type: 'text', description: '通信协议' },
    { name: 'Port', weight: 0.1, required: false, field_type: 'number', description: '端口号' },
    { name: 'Dependencies', weight: 0.1, required: false, field_type: 'list', description: '依赖服务' }
  ],
  threshold: 0.5,
  relations: [
    { type: 'depends_on', target_field: 'Dependencies', direction: 'outgoing' }
  ],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Code-Library',
  entity_type: 'CodeLibraryEntity',
  scene: '软件开发/依赖',
  description: '代码库 - 记录第三方库或内部库的信息',
  example_description: 'React v18.2.0 - 用于构建用户界面的JavaScript库',
  core_fields: [
    { name: 'LibraryName', weight: 0.35, required: true, field_type: 'text', description: '库名称', anchor: true },
    { name: 'Version', weight: 0.25, required: true, field_type: 'text', description: '版本号', anchor: true },
    { name: 'Purpose', weight: 0.2, required: false, field_type: 'text', description: '用途' },
    { name: 'License', weight: 0.1, required: false, field_type: 'text', description: '许可证' },
    { name: 'Repository', weight: 0.1, required: false, field_type: 'text', description: '仓库地址' }
  ],
  threshold: 0.6,
  relations: [],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Code-Function',
  entity_type: 'CodeFunctionEntity',
  scene: '软件开发/代码',
  description: '代码函数 - 记录函数的签名、参数和返回值',
  example_description: 'calculateTotal(items: Array) => number - 计算订单总价',
  core_fields: [
    { name: 'FunctionName', weight: 0.35, required: true, field_type: 'text', description: '函数名', anchor: true },
    { name: 'Parameters', weight: 0.25, required: false, field_type: 'list', description: '参数列表' },
    { name: 'ReturnType', weight: 0.2, required: false, field_type: 'text', description: '返回类型' },
    { name: 'Description', weight: 0.2, required: false, field_type: 'text', description: '功能描述' }
  ],
  threshold: 0.5,
  relations: [],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Code-Class',
  entity_type: 'CodeClassEntity',
  scene: '软件开发/代码',
  description: '代码类 - 记录类的属性、方法和继承关系',
  example_description: 'User类：继承BaseModel，包含name、email属性和save()方法',
  core_fields: [
    { name: 'ClassName', weight: 0.35, required: true, field_type: 'text', description: '类名', anchor: true },
    { name: 'Properties', weight: 0.2, required: false, field_type: 'list', description: '属性列表' },
    { name: 'Methods', weight: 0.2, required: false, field_type: 'list', description: '方法列表' },
    { name: 'Extends', weight: 0.15, required: false, field_type: 'text', description: '继承的类' },
    { name: 'Implements', weight: 0.1, required: false, field_type: 'list', description: '实现的接口' }
  ],
  threshold: 0.5,
  relations: [
    { type: 'extends', target_field: 'Extends', direction: 'outgoing' },
    { type: 'implements', target_field: 'Implements', direction: 'outgoing' }
  ],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Code-Interface',
  entity_type: 'CodeInterfaceEntity',
  scene: '软件开发/代码',
  description: '代码接口 - 记录接口定义和方法签名',
  example_description: 'IRepository接口：定义save()、find()、delete()方法',
  core_fields: [
    { name: 'InterfaceName', weight: 0.4, required: true, field_type: 'text', description: '接口名', anchor: true },
    { name: 'Methods', weight: 0.3, required: true, field_type: 'list', description: '方法列表' },
    { name: 'Extends', weight: 0.15, required: false, field_type: 'list', description: '继承的接口' },
    { name: 'Purpose', weight: 0.15, required: false, field_type: 'text', description: '接口用途' }
  ],
  threshold: 0.6,
  relations: [
    { type: 'extends', target_field: 'Extends', direction: 'outgoing' }
  ],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Architecture-Layer',
  entity_type: 'ArchitectureLayerEntity',
  scene: '软件开发/架构',
  description: '架构层 - 记录系统架构的分层结构',
  example_description: '表现层(Presentation Layer)：包含Controller和View组件',
  core_fields: [
    { name: 'LayerName', weight: 0.4, required: true, field_type: 'text', description: '层名称', anchor: true },
    { name: 'Components', weight: 0.3, required: false, field_type: 'list', description: '包含的组件' },
    { name: 'Responsibility', weight: 0.2, required: false, field_type: 'text', description: '职责' },
    { name: 'DependsOn', weight: 0.1, required: false, field_type: 'list', description: '依赖的层' }
  ],
  threshold: 0.5,
  relations: [
    { type: 'depends_on', target_field: 'DependsOn', direction: 'outgoing' }
  ],
  version: '1.0.0',
  active: true
});

// ============================================================================
// 2. DEVELOPMENT PROCESS (10 schemas)
// ============================================================================

schemas.push({
  schema_name: 'User-Story',
  entity_type: 'UserStoryEntity',
  scene: '软件开发/需求',
  description: '用户故事 - 记录用户需求和验收标准',
  example_description: '作为用户，我想要重置密码，以便恢复账户访问',
  core_fields: [
    { name: 'StoryID', weight: 0.3, required: true, field_type: 'text', description: '故事ID', anchor: true },
    { name: 'AsA', weight: 0.2, required: false, field_type: 'text', description: '作为(角色)' },
    { name: 'IWant', weight: 0.2, required: false, field_type: 'text', description: '我想要' },
    { name: 'SoThat', weight: 0.15, required: false, field_type: 'text', description: '以便' },
    { name: 'AcceptanceCriteria', weight: 0.15, required: false, field_type: 'list', description: '验收标准' }
  ],
  threshold: 0.5,
  relations: [],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Sprint',
  entity_type: 'SprintEntity',
  scene: '软件开发/敏捷',
  description: '冲刺 - 记录敏捷开发的冲刺周期信息',
  example_description: 'Sprint 23：2024-01-01至2024-01-14，目标完成用户认证功能',
  core_fields: [
    { name: 'SprintNumber', weight: 0.3, required: true, field_type: 'number', description: '冲刺编号', anchor: true },
    { name: 'StartDate', weight: 0.2, required: true, field_type: 'date', description: '开始日期' },
    { name: 'EndDate', weight: 0.2, required: true, field_type: 'date', description: '结束日期' },
    { name: 'Goal', weight: 0.2, required: false, field_type: 'text', description: '冲刺目标' },
    { name: 'Stories', weight: 0.1, required: false, field_type: 'list', description: '包含的故事' }
  ],
  threshold: 0.6,
  relations: [
    { type: 'includes', target_field: 'Stories', direction: 'outgoing' }
  ],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Code-Review',
  entity_type: 'CodeReviewEntity',
  scene: '软件开发/质量',
  description: '代码审查 - 记录代码审查的结果和建议',
  example_description: 'PR#123审查：发现3个问题，建议优化错误处理',
  core_fields: [
    { name: 'ReviewID', weight: 0.3, required: true, field_type: 'text', description: '审查ID', anchor: true },
    { name: 'Reviewer', weight: 0.2, required: false, field_type: 'text', description: '审查者' },
    { name: 'Issues', weight: 0.2, required: false, field_type: 'list', description: '发现的问题' },
    { name: 'Suggestions', weight: 0.15, required: false, field_type: 'list', description: '改进建议' },
    { name: 'Status', weight: 0.15, required: false, field_type: 'text', description: '审查状态' }
  ],
  threshold: 0.5,
  relations: [
    { type: 'reviewed_by', target_field: 'Reviewer', direction: 'outgoing' }
  ],
  version: '1.0.0',
  active: true
});


schemas.push({
  schema_name: 'Git-Commit',
  entity_type: 'GitCommitEntity',
  scene: '软件开发/版本控制',
  description: 'Git提交 - 记录代码提交的信息',
  example_description: 'commit abc123: feat: 添加用户登录功能',
  core_fields: [
    { name: 'CommitHash', weight: 0.35, required: true, field_type: 'text', description: '提交哈希', anchor: true },
    { name: 'Message', weight: 0.3, required: true, field_type: 'text', description: '提交信息' },
    { name: 'Author', weight: 0.2, required: false, field_type: 'text', description: '作者' },
    { name: 'Date', weight: 0.15, required: false, field_type: 'date', description: '提交日期' }
  ],
  threshold: 0.6,
  relations: [
    { type: 'authored_by', target_field: 'Author', direction: 'outgoing' }
  ],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Pull-Request',
  entity_type: 'PullRequestEntity',
  scene: '软件开发/协作',
  description: '拉取请求 - 记录PR的信息和审查状态',
  example_description: 'PR#456: 添加支付功能，等待审查',
  core_fields: [
    { name: 'PRID', weight: 0.3, required: true, field_type: 'text', description: 'PR编号', anchor: true },
    { name: 'Title', weight: 0.25, required: true, field_type: 'text', description: 'PR标题' },
    { name: 'Author', weight: 0.15, required: false, field_type: 'text', description: '作者' },
    { name: 'Reviewers', weight: 0.15, required: false, field_type: 'list', description: '审查者' },
    { name: 'Status', weight: 0.15, required: false, field_type: 'text', description: 'PR状态' }
  ],
  threshold: 0.5,
  relations: [
    { type: 'authored_by', target_field: 'Author', direction: 'outgoing' },
    { type: 'reviewed_by', target_field: 'Reviewers', direction: 'outgoing' }
  ],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Issue-Ticket',
  entity_type: 'IssueTicketEntity',
  scene: '软件开发/项目管理',
  description: '问题工单 - 记录Bug或任务的跟踪信息',
  example_description: 'Issue#789: 登录页面在移动端显示异常 - 优先级高',
  core_fields: [
    { name: 'IssueID', weight: 0.3, required: true, field_type: 'text', description: '工单ID', anchor: true },
    { name: 'Title', weight: 0.25, required: true, field_type: 'text', description: '标题' },
    { name: 'Type', weight: 0.15, required: false, field_type: 'text', description: '类型' },
    { name: 'Priority', weight: 0.15, required: false, field_type: 'text', description: '优先级' },
    { name: 'Assignee', weight: 0.15, required: false, field_type: 'text', description: '负责人' }
  ],
  threshold: 0.5,
  relations: [
    { type: 'assigned_to', target_field: 'Assignee', direction: 'outgoing' }
  ],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Release-Version',
  entity_type: 'ReleaseVersionEntity',
  scene: '软件开发/发布',
  description: '发布版本 - 记录软件版本发布信息',
  example_description: 'v2.1.0发布：新增支付功能，修复5个Bug',
  core_fields: [
    { name: 'Version', weight: 0.35, required: true, field_type: 'text', description: '版本号', anchor: true },
    { name: 'ReleaseDate', weight: 0.25, required: true, field_type: 'date', description: '发布日期' },
    { name: 'Features', weight: 0.2, required: false, field_type: 'list', description: '新功能' },
    { name: 'BugFixes', weight: 0.2, required: false, field_type: 'list', description: 'Bug修复' }
  ],
  threshold: 0.6,
  relations: [],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Technical-Debt',
  entity_type: 'TechnicalDebtEntity',
  scene: '软件开发/质量',
  description: '技术债务 - 记录需要重构或优化的代码',
  example_description: 'UserService模块：代码重复率高，需要重构',
  core_fields: [
    { name: 'DebtID', weight: 0.3, required: true, field_type: 'text', description: '债务ID', anchor: true },
    { name: 'Component', weight: 0.25, required: true, field_type: 'text', description: '相关组件' },
    { name: 'Description', weight: 0.25, required: false, field_type: 'text', description: '问题描述' },
    { name: 'Impact', weight: 0.2, required: false, field_type: 'text', description: '影响程度' }
  ],
  threshold: 0.5,
  relations: [],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Refactoring-Task',
  entity_type: 'RefactoringTaskEntity',
  scene: '软件开发/重构',
  description: '重构任务 - 记录代码重构的计划和进度',
  example_description: '重构AuthModule：提取公共逻辑，减少代码重复',
  core_fields: [
    { name: 'TaskID', weight: 0.3, required: true, field_type: 'text', description: '任务ID', anchor: true },
    { name: 'Target', weight: 0.25, required: true, field_type: 'text', description: '重构目标' },
    { name: 'Reason', weight: 0.2, required: false, field_type: 'text', description: '重构原因' },
    { name: 'Status', weight: 0.15, required: false, field_type: 'text', description: '任务状态' },
    { name: 'Assignee', weight: 0.1, required: false, field_type: 'text', description: '负责人' }
  ],
  threshold: 0.5,
  relations: [
    { type: 'assigned_to', target_field: 'Assignee', direction: 'outgoing' }
  ],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Code-Metric',
  entity_type: 'CodeMetricEntity',
  scene: '软件开发/质量',
  description: '代码指标 - 记录代码质量相关的度量数据',
  example_description: 'UserModule：代码覆盖率85%，圈复杂度12',
  core_fields: [
    { name: 'Component', weight: 0.3, required: true, field_type: 'text', description: '组件名称', anchor: true },
    { name: 'Coverage', weight: 0.25, required: false, field_type: 'number', description: '代码覆盖率' },
    { name: 'Complexity', weight: 0.2, required: false, field_type: 'number', description: '圈复杂度' },
    { name: 'LOC', weight: 0.15, required: false, field_type: 'number', description: '代码行数' },
    { name: 'Duplication', weight: 0.1, required: false, field_type: 'number', description: '重复率' }
  ],
  threshold: 0.5,
  relations: [],
  version: '1.0.0',
  active: true
});

// ============================================================================
// 3. TESTING & QUALITY (10 schemas)
// ============================================================================

schemas.push({
  schema_name: 'Unit-Test',
  entity_type: 'UnitTestEntity',
  scene: '软件开发/测试',
  description: '单元测试 - 记录单元测试用例和结果',
  example_description: 'test_user_login: 测试用户登录功能，通过',
  core_fields: [
    { name: 'TestName', weight: 0.35, required: true, field_type: 'text', description: '测试名称', anchor: true },
    { name: 'Target', weight: 0.25, required: true, field_type: 'text', description: '测试目标' },
    { name: 'Status', weight: 0.2, required: false, field_type: 'text', description: '测试状态' },
    { name: 'Duration', weight: 0.1, required: false, field_type: 'number', description: '执行时间' },
    { name: 'Coverage', weight: 0.1, required: false, field_type: 'number', description: '覆盖率' }
  ],
  threshold: 0.6,
  relations: [],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Integration-Test',
  entity_type: 'IntegrationTestEntity',
  scene: '软件开发/测试',
  description: '集成测试 - 记录模块间集成测试的信息',
  example_description: '测试UserService与DatabaseModule的集成',
  core_fields: [
    { name: 'TestName', weight: 0.35, required: true, field_type: 'text', description: '测试名称', anchor: true },
    { name: 'Components', weight: 0.3, required: true, field_type: 'list', description: '测试组件' },
    { name: 'Scenario', weight: 0.2, required: false, field_type: 'text', description: '测试场景' },
    { name: 'Status', weight: 0.15, required: false, field_type: 'text', description: '测试状态' }
  ],
  threshold: 0.6,
  relations: [],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'E2E-Test',
  entity_type: 'E2ETestEntity',
  scene: '软件开发/测试',
  description: '端到端测试 - 记录完整用户流程的测试',
  example_description: '测试用户注册到登录的完整流程',
  core_fields: [
    { name: 'TestName', weight: 0.35, required: true, field_type: 'text', description: '测试名称', anchor: true },
    { name: 'UserFlow', weight: 0.3, required: true, field_type: 'text', description: '用户流程' },
    { name: 'Steps', weight: 0.2, required: false, field_type: 'list', description: '测试步骤' },
    { name: 'Status', weight: 0.15, required: false, field_type: 'text', description: '测试状态' }
  ],
  threshold: 0.6,
  relations: [],
  version: '1.0.0',
  active: true
});

schemas.push({
  schema_name: 'Performance-Test',
  entity_type: 'PerformanceTestEntity',
  scene: '软件开发/测试',
  description: '性能测试 - 记录系统性能测试结果',
  example_description: 'API响应时间测试：平均200ms，P95为350ms',
  core_fields: [
    { name: 'TestName', weight: 0.3, required: true, field_type: 'text', description: '测试名称', anchor: true },
    { name: 'Target', weight: 0.25, required: true, field_type: 'text', description: '测试目标' },
    { name: 'AvgTime', weight: 0.2, required: false, field_type: 'number', description: '平均响应时间' },
    { name: 'P95', weight: 0.15, required: false, field_type: 'number', description: 'P95响应时间' },
    { name: 'TPS', weight: 0.1, required: false, field_type: 'number', description: '每秒事务数' }
  ],
  threshold: 0.5,
  relations: [],
  version: '1.0.0',
  active: true
});

