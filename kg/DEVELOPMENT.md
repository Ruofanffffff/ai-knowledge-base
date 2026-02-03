# Schema 驱动知识图谱系统 - 开发指南

## 1. 开发环境搭建

### 1.1 前置要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0 或 yarn >= 1.22.0
- **Git**: >= 2.0.0
- **编辑器**: VS Code (推荐) 或其他支持 JavaScript/TypeScript 的 IDE

### 1.2 克隆项目

```bash
git clone https://github.com/your-org/knowledge-graph.git
cd knowledge-graph
```

### 1.3 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client
npm install
cd ..
```

### 1.4 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件
nano .env
```

**必需配置**:
```bash
# 数据库
DATABASE_URL="file:./prisma/knowledge-base.db"

# LLM API
QWEN_API_KEY="your_api_key_here"
QWEN_API_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"

# 知识图谱
KG_ENABLED=true
KG_TOKEN_DAILY_LIMIT=100000
```

### 1.5 初始化数据库

```bash
# 运行数据库迁移
npx prisma migrate dev

# 生成 Prisma Client
npx prisma generate

# 导入 Schema
node kg/schema/load_schemas.js
```

### 1.6 启动开发服务器

```bash
# 启动后端 (端口 3000)
npm run dev

# 启动前端 (端口 5173)
cd client
npm run dev
```

访问 http://localhost:5173/ 查看应用。

## 2. 项目结构

```
knowledge-graph/
├── kg/                          # 知识图谱核心模块
│   ├── ckb/                     # CKB 解析器
│   │   ├── ckb_parser.js
│   │   ├── ckb_store.js
│   │   └── parsers/             # 文档解析器
│   ├── field_extractor/         # 字段抽取
│   │   ├── field_extractor.js
│   │   ├── rule_extractor.js
│   │   ├── ner_extractor.js
│   │   └── llm_extractor.js
│   ├── schema/                  # Schema 管理
│   │   ├── schema_manager.js
│   │   ├── schema_matcher.js
│   │   └── schema_loader.js
│   ├── field_normalizer/        # 字段清洗
│   │   ├── field_normalizer.js
│   │   ├── algorithm_mapper.js
│   │   ├── llm_mapper.js
│   │   └── synonym_dict.js
│   ├── entity/                  # 实体管理
│   │   ├── entity_builder.js
│   │   └── entity_store.js
│   ├── relation/                # 关系管理
│   │   ├── builtin_relation_builder.js
│   │   ├── cooccurrence_relation_builder.js
│   │   └── semantic_relation_builder.js
│   ├── confidence/              # 置信度管理
│   │   ├── confidence_engine.js
│   │   └── quality_filter.js
│   ├── services/                # 服务层
│   │   ├── kg_service.js
│   │   └── graph_traversal.js
│   ├── utils/                   # 工具模块
│   │   ├── token_tracker.js
│   │   ├── llm_cache.js
│   │   └── performance_monitor.js
│   └── prompts/                 # Prompt 模板
│       ├── extract_fields.js
│       ├── schema_score.js
│       └── entity_build.js
├── routes/                      # API 路由
│   └── knowledgeGraphRoutes.js
├── client/                      # 前端应用
│   └── src/
│       └── pages/
│           └── KnowledgeGraph/
├── prisma/                      # 数据库
│   ├── schema.prisma
│   └── migrations/
├── server.js                    # 服务器入口
└── package.json
```

## 3. 编码规范

### 3.1 JavaScript 风格

- 使用 ES6+ 语法
- 使用 `const` 和 `let`,避免 `var`
- 使用箭头函数
- 使用模板字符串
- 使用解构赋值

**示例**:
```javascript
// ✅ 推荐
const extractFields = async (ckb) => {
  const { content, quality } = ckb;
  const fields = [];
  
  // 规则抽取
  const timeFields = extractTimeFields(content.text);
  fields.push(...timeFields);
  
  return fields;
};

// ❌ 不推荐
var extractFields = function(ckb) {
  var content = ckb.content;
  var quality = ckb.quality;
  var fields = [];
  
  var timeFields = extractTimeFields(content.text);
  for (var i = 0; i < timeFields.length; i++) {
    fields.push(timeFields[i]);
  }
  
  return fields;
};
```

### 3.2 命名约定

- **文件名**: 小写 + 下划线 (snake_case)
  - `field_extractor.js`
  - `schema_matcher.js`

- **变量名**: 驼峰命名 (camelCase)
  - `fieldName`
  - `schemaId`

- **常量**: 大写 + 下划线 (UPPER_SNAKE_CASE)
  - `MAX_RETRIES`
  - `DEFAULT_THRESHOLD`

- **类名**: 帕斯卡命名 (PascalCase)
  - `EntityBuilder`
  - `SchemaManager`

- **函数名**: 驼峰命名 (camelCase)
  - `extractFields()`
  - `matchSchemas()`

### 3.3 注释规范

**文件头注释**:
```javascript
/**
 * Field Extractor - 字段抽取模块
 * 
 * 从 CKB 中提取结构化字段,采用规则优先、LLM 兜底的策略
 * 
 * @module kg/field_extractor
 * @author Your Name
 * @created 2025-01-26
 */
```

**函数注释**:
```javascript
/**
 * 从 CKB 中提取字段
 * 
 * @param {Object} ckb - CKB 对象
 * @param {string} ckb.content.text - 文本内容
 * @param {number} ckb.quality.source_confidence - 源置信度
 * @returns {Promise<Array<Field>>} 字段列表
 * @throws {Error} 当 CKB 格式无效时抛出错误
 * 
 * @example
 * const fields = await extractFields(ckb);
 * // => [{ name: '时间', value: '2025-01', type: 'time', confidence: 0.9 }]
 */
async function extractFields(ckb) {
  // 实现...
}
```

**行内注释**:
```javascript
// 1. 规则抽取 (优先级最高)
const ruleFields = extractByRule(text);

// 2. NER 抽取 (中等优先级)
const nerFields = extractByNER(text);

// 3. LLM 抽取 (兜底策略)
if (ruleFields.length === 0 && nerFields.length === 0) {
  const llmFields = await extractByLLM(ckb);
  return llmFields;
}
```

### 3.4 错误处理

**使用 try-catch**:
```javascript
async function extractFields(ckb) {
  try {
    // 验证输入
    if (!ckb || !ckb.content || !ckb.content.text) {
      throw new Error('Invalid CKB format');
    }
    
    // 执行抽取
    const fields = await performExtraction(ckb);
    return fields;
    
  } catch (error) {
    console.error('Field extraction failed:', error);
    
    // 记录错误日志
    await logError('field_extraction', error, { ckb_id: ckb.id });
    
    // 返回空结果或重新抛出
    return [];
  }
}
```

**自定义错误类**:
```javascript
class SchemaNotFoundError extends Error {
  constructor(schemaId) {
    super(`Schema not found: ${schemaId}`);
    this.name = 'SchemaNotFoundError';
    this.schemaId = schemaId;
  }
}

// 使用
throw new SchemaNotFoundError('schema_123');
```

## 4. 测试指南

### 4.1 测试框架

- **单元测试**: Jest
- **属性测试**: fast-check
- **集成测试**: Jest + Supertest
- **端到端测试**: Jest

### 4.2 运行测试

```bash
# 运行所有测试
npm test

# 运行特定模块测试
npm test kg/field_extractor

# 运行属性测试
npm test -- --testNamePattern="Property"

# 生成覆盖率报告
npm run test:coverage

# 监听模式
npm test -- --watch
```

### 4.3 编写单元测试

**测试文件命名**: `<module>.test.js`

**示例**:
```javascript
// field_extractor.test.js
const { extractFields } = require('./field_extractor');

describe('Field Extractor', () => {
  describe('extractFields', () => {
    it('should extract time fields from text', async () => {
      // Arrange
      const ckb = {
        id: 'ckb_001',
        content: { text: '2025年1月水位下降' },
        quality: { source_confidence: 0.9 }
      };
      
      // Act
      const fields = await extractFields(ckb);
      
      // Assert
      expect(fields).toHaveLength(1);
      expect(fields[0]).toMatchObject({
        name: '时间',
        value: '2025-01',
        type: 'time'
      });
    });
    
    it('should return empty array for invalid CKB', async () => {
      const fields = await extractFields(null);
      expect(fields).toEqual([]);
    });
  });
});
```

### 4.4 编写属性测试

**测试文件命名**: `<module>.property.test.js`

**示例**:
```javascript
// field_normalizer.property.test.js
const fc = require('fast-check');
const { normalizeFields } = require('./field_normalizer');

describe('Field Normalizer - Property Tests', () => {
  it('should preserve field count', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          name: fc.string(),
          value: fc.string(),
          type: fc.constantFrom('time', 'location', 'number')
        })),
        async (rawFields) => {
          const normalized = await normalizeFields(rawFields, mockSchema);
          return normalized.length === rawFields.length;
        }
      )
    );
  });
});
```

### 4.5 测试覆盖率目标

- **总体覆盖率**: ≥ 80%
- **核心模块**: ≥ 90%
- **工具模块**: ≥ 70%

## 5. 调试技巧

### 5.1 使用 VS Code 调试器

**配置 `.vscode/launch.json`**:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Server",
      "program": "${workspaceFolder}/server.js",
      "env": {
        "NODE_ENV": "development"
      }
    },
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Tests",
      "program": "${workspaceFolder}/node_modules/.bin/jest",
      "args": ["--runInBand", "${file}"],
      "console": "integratedTerminal"
    }
  ]
}
```

### 5.2 日志调试

```javascript
// 使用结构化日志
const logger = require('./utils/logger');

logger.info('Field extraction started', {
  ckb_id: ckb.id,
  text_length: ckb.content.text.length
});

logger.debug('Rule extraction result', {
  field_count: ruleFields.length,
  fields: ruleFields
});

logger.error('LLM call failed', {
  error: error.message,
  ckb_id: ckb.id
});
```

### 5.3 性能分析

```javascript
// 使用 console.time
console.time('field_extraction');
const fields = await extractFields(ckb);
console.timeEnd('field_extraction');
// => field_extraction: 45.123ms

// 使用性能监控
const { trackPerformance } = require('./utils/performance_monitor');

await trackPerformance('field_extraction', async () => {
  return await extractFields(ckb);
});
```

## 6. 数据库操作

### 6.1 使用 Prisma Client

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 创建实体
const entity = await prisma.entity.create({
  data: {
    canonical_name: '2025年北京水位变化',
    type: 'EventEntity',
    attributes: { location: '北京', time: '2025-01' },
    confidence: 0.85
  }
});

// 查询实体
const entities = await prisma.entity.findMany({
  where: {
    type: 'EventEntity',
    confidence: { gte: 0.7 }
  },
  orderBy: { confidence: 'desc' },
  take: 10
});

// 更新实体
await prisma.entity.update({
  where: { id: entity.id },
  data: { confidence: 0.9 }
});

// 删除实体
await prisma.entity.delete({
  where: { id: entity.id }
});
```

### 6.2 数据库迁移

```bash
# 创建新迁移
npx prisma migrate dev --name add_new_field

# 应用迁移
npx prisma migrate deploy

# 重置数据库 (开发环境)
npx prisma migrate reset

# 查看迁移状态
npx prisma migrate status
```

### 6.3 数据库查询优化

```javascript
// ❌ N+1 查询问题
const entities = await prisma.entity.findMany();
for (const entity of entities) {
  const relations = await prisma.relation.findMany({
    where: { source_id: entity.id }
  });
}

// ✅ 使用 include 预加载
const entities = await prisma.entity.findMany({
  include: {
    outgoing_relations: true
  }
});
```

## 7. API 开发

### 7.1 创建新的 API 端点

**在 `routes/knowledgeGraphRoutes.js` 中添加**:
```javascript
// GET /api/knowledge-graph/entities/:id
router.get('/entities/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 查询实体
    const entity = await entityStore.getEntity(id);
    
    if (!entity) {
      return res.status(404).json({
        success: false,
        error: 'Entity not found'
      });
    }
    
    res.json({
      success: true,
      data: entity
    });
    
  } catch (error) {
    console.error('Get entity failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

### 7.2 API 响应格式

**成功响应**:
```json
{
  "success": true,
  "data": {
    "entity_id": "entity_123",
    "canonical_name": "2025年北京水位变化"
  },
  "metadata": {
    "timestamp": "2025-01-26T10:00:00Z",
    "version": "1.0"
  }
}
```

**错误响应**:
```json
{
  "success": false,
  "error": "Entity not found",
  "error_code": "ENTITY_NOT_FOUND",
  "details": {
    "entity_id": "entity_123"
  }
}
```

### 7.3 API 测试

```javascript
// 使用 Supertest
const request = require('supertest');
const app = require('../server');

describe('GET /api/knowledge-graph/entities/:id', () => {
  it('should return entity details', async () => {
    const response = await request(app)
      .get('/api/knowledge-graph/entities/entity_123')
      .expect(200);
    
    expect(response.body.success).toBe(true);
    expect(response.body.data).toHaveProperty('canonical_name');
  });
  
  it('should return 404 for non-existent entity', async () => {
    const response = await request(app)
      .get('/api/knowledge-graph/entities/invalid_id')
      .expect(404);
    
    expect(response.body.success).toBe(false);
  });
});
```

## 8. 常见开发任务

### 8.1 添加新的 Schema

1. 在 `SchemaList.md` 中添加 Schema 定义
2. 运行导入脚本:
```bash
node kg/schema/load_schemas.js
```
3. 验证导入结果:
```bash
node -e "const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.schema.count().then(console.log);"
```

### 8.2 扩展字段抽取器

1. 在 `kg/field_extractor/` 创建新的抽取器
2. 实现 `extract(ckb)` 方法
3. 在 `field_extractor.js` 中注册
4. 编写单元测试

**示例**:
```javascript
// custom_extractor.js
async function extractCustomFields(ckb) {
  const fields = [];
  
  // 自定义抽取逻辑
  const regex = /自定义模式/g;
  const matches = ckb.content.text.matchAll(regex);
  
  for (const match of matches) {
    fields.push({
      name: '自定义字段',
      value: match[1],
      type: 'custom',
      confidence: 0.8
    });
  }
  
  return fields;
}

module.exports = { extractCustomFields };
```

### 8.3 添加新的关系类型

1. 在 Schema 中定义关系类型
2. 在 `kg/relation/` 实现关系构建逻辑
3. 更新关系存储模块
4. 编写测试

### 8.4 自定义 Prompt

所有 Prompt 模板位于 `kg/prompts/` 目录:

```javascript
// kg/prompts/custom_prompt.js
function generateCustomPrompt(context) {
  return `你是一个专业的知识抽取助手。

任务: ${context.task}
输入: ${context.input}

请按照以下格式输出:
{
  "result": "...",
  "confidence": 0.85
}`;
}

module.exports = { generateCustomPrompt };
```

## 9. 性能优化

### 9.1 Token 优化

- 优先使用规则和算法
- 启用 LLM 响应缓存
- 使用智能字段截断
- 批量处理 LLM 请求

### 9.2 数据库优化

- 在关键字段上创建索引
- 使用连接池
- 避免 N+1 查询
- 使用事务处理批量操作

### 9.3 代码优化

- 使用异步并发处理
- 避免阻塞操作
- 使用流式处理大文件
- 缓存频繁访问的数据

## 10. 故障排查

### 10.1 常见问题

**问题 1: 数据库连接失败**
```bash
# 检查数据库文件
ls -la prisma/knowledge-base.db

# 重新生成 Prisma Client
npx prisma generate
```

**问题 2: LLM 调用超时**
```bash
# 增加超时时间
KG_LLM_CALL_TIMEOUT_MS=15000
```

**问题 3: Schema 数量不足**
```bash
# 重新导入 Schema
node kg/schema/load_schemas.js
```

### 10.2 日志查看

```bash
# 查看错误日志
tail -f logs/error.log

# 查看所有日志
tail -f logs/combined.log

# 搜索特定错误
grep "Token limit exceeded" logs/error.log
```

## 11. 贡献指南

### 11.1 提交代码

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feature/your-feature`
3. 提交更改: `git commit -am 'Add some feature'`
4. 推送分支: `git push origin feature/your-feature`
5. 创建 Pull Request

### 11.2 代码审查

- 确保所有测试通过
- 代码覆盖率 ≥ 80%
- 遵循编码规范
- 更新相关文档

### 11.3 提交信息规范

使用 Conventional Commits 格式:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型**:
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建或工具相关

**示例**:
```
feat(field-extractor): add custom field extraction

- Implement custom regex-based field extractor
- Add unit tests for custom extractor
- Update documentation

Closes #123
```

---

**文档版本**: v1.0.0  
**最后更新**: 2025-02-03  
**维护者**: Schema-Driven KG Team
