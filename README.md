# 知识库管理系统

一个功能强大的知识库管理系统,集成了 Schema 驱动的知识图谱功能,能够从非结构化文档中自动提取结构化知识并构建高质量的知识图谱。

## 核心功能

### 📚 文档管理
- 支持多种文档格式 (Word, PDF, Excel, Markdown)
- 文档上传、编辑、删除
- 文档分类和标签管理
- 全文搜索

### 🕸️ 知识图谱 (Schema-Driven KG)
- **智能知识抽取**: 从文档中自动提取实体和关系
- **Schema 驱动**: 基于 250+ 预定义 Schema 进行知识抽取
- **三阶段Schema匹配**: 算法匹配 → LLM兜底 → 合并排名，确保高召回率
- **多层次映射**: 4 层字段映射策略 (精确匹配 → 相似度 → 同义词 → LLM)
- **LLM 100%兜底**: LLM作为兜底方案，验证和优化所有关键步骤
- **Token 优化**: 智能控制 LLM 调用,降低成本 90%+
- **高质量保证**: 置信度管理和质量过滤机制
- **可视化展示**: 交互式知识图谱可视化

### 👤 用户管理
- 用户注册和登录
- 权限管理
- 个人资料管理

### 📊 统计分析
- 文档统计
- 知识图谱统计
- Token 使用统计
- 性能监控

## 技术栈

### 后端
- **运行时**: Node.js 18+
- **框架**: Express.js
- **ORM**: Prisma
- **数据库**: SQLite (开发) / PostgreSQL (生产)
- **LLM**: 通义千问 (Qwen) / DeepSeek

### 前端
- **框架**: React 18 + TypeScript
- **UI 库**: Ant Design 5.8
- **可视化**: D3.js 7.8
- **路由**: React Router DOM 6.15

### 测试
- **测试框架**: Jest
- **Property-Based Testing**: fast-check

## 快速开始

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0 或 yarn >= 1.22.0
- SQLite >= 3.35.0 (开发) 或 PostgreSQL >= 13.0 (生产)

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-org/knowledge-base.git
cd knowledge-base

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
nano .env
```

### 配置

编辑 `.env` 文件,配置必要的环境变量:

```bash
# 数据库配置
DATABASE_URL="file:./prisma/knowledge-base.db"

# LLM API 配置
QWEN_API_KEY="your_qwen_api_key_here"

# 知识图谱配置
KG_ENABLED=true
KG_TOKEN_DAILY_LIMIT=100000
```

详细配置说明请参考 [kg/CONFIG.md](./kg/CONFIG.md)

### 初始化

```bash
# 运行数据库迁移
npx prisma migrate dev

# 导入 Schema 定义
node kg/schema/load_schemas.js
```

### 启动

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

服务将在 `http://localhost:3000` 启动。


## 知识图谱功能

### 系统架构

```
文档 (Document)
    ↓
CKB 解析 (CKB Parser)
    ↓
字段抽取 (Field Extractor)
    ↓
字段清洗 (Field Normalizer)
    ↓
Schema 匹配 (Schema Matcher)
    ↓
实体构建 (Entity Builder)
    ↓
关系构建 (Relation Builder)
    ↓
置信度计算 (Confidence Engine)
    ↓
质量过滤 (Quality Filter)
    ↓
知识图谱 (Knowledge Graph)
```

### 核心特性

#### 1. Schema 驱动
- 250+ 预定义 Schema 覆盖多个领域
- 支持科研、政府、个人生活、旅行、摄影等场景
- 灵活的 Schema 定义和管理

#### 2. 智能字段映射
- **精确匹配**: 字段名完全相同
- **相似度匹配**: 编辑距离 + 余弦相似度
- **同义词匹配**: 基于同义词词典 (覆盖率 > 90%)
- **LLM 映射**: 使用大语言模型进行语义映射

#### 3. Token 优化
- LLM 响应缓存
- 智能频率控制
- 批量处理优化
- 智能字段截断 (Token 节省率 ≥ 40%)
- 每日 Token 预算管理

#### 4. 高质量保证
- 实体置信度计算
- 关系置信度计算
- 低质量数据过滤
- 冲突消解机制

#### 5. 多类型关系
- **内建关系**: 基于 Schema 定义,100% 自动生成
- **共现关系**: 基于实体共现统计
- **语义关系**: 基于 LLM 的语义理解,分层触发

### API 端点

知识图谱系统提供了丰富的 API 端点:

#### CKB 相关
- `POST /api/knowledge-graph/ckb/parse` - 解析文档生成 CKB
- `GET /api/knowledge-graph/ckb/:id` - 获取 CKB 详情
- `GET /api/knowledge-graph/ckb/document/:docId` - 获取文档的所有 CKB

#### Schema 相关
- `GET /api/knowledge-graph/schemas` - 获取 Schema 列表
- `POST /api/knowledge-graph/schemas` - 创建 Schema
- `PUT /api/knowledge-graph/schemas/:id` - 更新 Schema
- `DELETE /api/knowledge-graph/schemas/:id` - 删除 Schema

#### 实体相关
- `GET /api/knowledge-graph/entities` - 获取实体列表
- `GET /api/knowledge-graph/entities/:id` - 获取实体详情
- `GET /api/knowledge-graph/entities/search` - 搜索实体

#### 关系相关
- `GET /api/knowledge-graph/relations` - 获取关系列表
- `GET /api/knowledge-graph/relations/:id` - 获取关系详情

#### 图遍历相关
- `POST /api/knowledge-graph/traverse` - 图遍历
- `GET /api/knowledge-graph/neighbors/:id` - 获取邻居节点
- `GET /api/knowledge-graph/path/:sourceId/:targetId` - 查找最短路径
- `GET /api/knowledge-graph/subgraph/:id` - 获取子图

#### KG 构建相关
- `POST /api/knowledge-graph/build` - 构建知识图谱
- `POST /api/knowledge-graph/update` - 更新知识图谱
- `POST /api/knowledge-graph/rebuild` - 重建知识图谱
- `DELETE /api/knowledge-graph/document/:docId` - 删除文档的知识图谱

#### 统计相关
- `GET /api/knowledge-graph/stats` - 获取知识图谱统计
- `GET /api/knowledge-graph/stats/tokens` - Token 使用统计
- `GET /api/knowledge-graph/stats/quality` - 质量报告
- `GET /api/knowledge-graph/stats/performance` - 性能统计

完整 API 文档请参考 [kg/API.md](./kg/API.md)

### 性能指标

- **处理时间**: 单文档 < 30s
- **Token 消耗**: 约 2,000-3,000 tokens/文档
- **实体置信度**: 平均 > 0.7
- **关系置信度**: 平均 > 0.6
- **字段映射准确率**: > 90%

## 文档

### 知识图谱文档
- [README.md](./kg/README.md) - KG 模块概述
- [ARCHITECTURE.md](./kg/ARCHITECTURE.md) - 系统架构设计
- [SCHEMA_GUIDE.md](./kg/SCHEMA_GUIDE.md) - Schema 定义指南
- [API.md](./kg/API.md) - API 参考文档
- [CONFIG.md](./kg/CONFIG.md) - 配置说明
- [DEPLOYMENT.md](./kg/DEPLOYMENT.md) - 部署指南

### 其他文档
- [知识库功能分析](./knowledge_base_analysis.md)
- [技术栈说明](./knowledge_base_tech_stack.md)
- [架构设计](./knowledge_base_architecture.md)

## 测试

### 运行所有测试

```bash
npm test
```

### 运行特定模块测试

```bash
# CKB 解析测试
npm test kg/ckb

# 字段抽取测试
npm test kg/field_extractor

# 字段清洗测试
npm test kg/field_normalizer

# 实体构建测试
npm test kg/entity

# 关系构建测试
npm test kg/relation
```

### 运行 Property-Based 测试

```bash
npm test -- --testNamePattern="Property"
```

### 测试覆盖率

```bash
npm run test:coverage
```

目标覆盖率: ≥ 80%

## 部署

### 开发环境

```bash
npm run dev
```

### 生产环境

使用 PM2 进行进程管理:

```bash
# 安装 PM2
npm install -g pm2

# 启动应用
pm2 start ecosystem.config.js

# 查看状态
pm2 status

# 查看日志
pm2 logs
```

详细部署指南请参考 [kg/DEPLOYMENT.md](./kg/DEPLOYMENT.md)

## 配置优化

### Token 成本优化

如果 Token 成本过高:

```bash
# 降低 LLM 调用频率
KG_LLM_FIELD_MAPPING_RATE=0.3
KG_LLM_ENTITY_DISAMBIGUATION_RATE=0.2
KG_LLM_SEMANTIC_RELATION_RANDOM_SAMPLE_RATE=0.1

# 启用缓存
KG_CACHE_ENABLED=true

# 启用同义词词典自动扩充
KG_SYNONYM_DICT_AUTO_EXPAND=true
```

### 性能优化

如果处理速度过慢:

```bash
# 增加并发数
KG_BATCH_CONCURRENCY=5
KG_BATCH_SIZE=20

# 增加超时时间
KG_LLM_CALL_TIMEOUT_MS=15000
```

### 质量优化

如果知识图谱质量不足:

```bash
# 增加 LLM 调用频率
KG_LLM_FIELD_MAPPING_RATE=0.8
KG_LLM_ENTITY_CANONICAL_NAME_RATE=0.8
KG_LLM_ENTITY_DISAMBIGUATION_RATE=0.5

# 提高置信度阈值
KG_MIN_ENTITY_CONFIDENCE=0.6
KG_MIN_RELATION_CONFIDENCE=0.6
```

## 故障排查

### Token 超限

**症状**: 系统进入紧急模式,LLM 调用频率降低

**解决方案**:
1. 检查 `KG_TOKEN_DAILY_LIMIT` 是否设置过低
2. 启用缓存减少重复调用
3. 降低 LLM 调用频率

### 处理超时

**症状**: 文档处理失败,提示超时

**解决方案**:
1. 增加 `KG_TOTAL_PROCESSING_TIMEOUT_MS`
2. 检查网络连接
3. 检查 LLM API 响应速度

### Schema 数量不足

**症状**: 系统启动时提示 Schema 数量不足

**解决方案**:
1. 确保 `KG_SCHEMA_AUTO_IMPORT=true`
2. 手动运行: `node kg/schema/load_schemas.js`
3. 检查 `SchemaList.md` 文件是否存在

## 贡献指南

欢迎贡献代码、报告问题或提出建议!

### 提交代码

1. Fork 本仓库
2. 创建特性分支: `git checkout -b feature/your-feature`
3. 提交更改: `git commit -am 'Add some feature'`
4. 推送分支: `git push origin feature/your-feature`
5. 创建 Pull Request

### 代码规范

- 使用 ESLint 进行代码检查
- 遵循 JavaScript Standard Style
- 编写单元测试和集成测试
- 更新相关文档

### 测试要求

- 单元测试覆盖率 ≥ 80%
- 所有 Property 测试通过
- 集成测试通过
- 端到端测试通过

## 许可证

MIT License

## 联系方式

- 项目主页: [GitHub Repository]
- 问题反馈: [GitHub Issues]
- 文档: [Documentation]

## 致谢

感谢所有贡献者和使用者!

## 更新日志

### v1.0.0 (2025-02-01)

**知识图谱功能**:
- ✅ 完成 Phase 1-9 开发
- ✅ 实现 250+ Schema 支持
- ✅ 实现智能字段映射
- ✅ 实现 Token 优化
- ✅ 实现前端可视化
- ✅ 实现文档操作钩子
- ✅ 完成项目集成
- ✅ 完成文档编写

**文档管理功能**:
- ✅ 文档上传和管理
- ✅ 全文搜索
- ✅ 用户管理
- ✅ 权限控制

### 下一步计划

- [ ] Phase 10: 测试完善
- [ ] Phase 11: GitHub 部署
- [ ] 性能优化和监控增强
- [ ] 支持更多文档格式
- [ ] 多语言支持

---

**让知识抽取更智能、更高效!**

