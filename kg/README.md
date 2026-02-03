# Schema 驱动知识图谱系统

## 概述

Schema 驱动知识图谱 (Schema-Driven Knowledge Graph) 是一个智能的知识抽取和图谱构建系统,能够从非结构化文档中自动提取结构化知识,并构建高质量的知识图谱。

### 核心特性

- **Schema 驱动**: 基于 250+ 预定义 Schema 进行知识抽取
- **三阶段Schema匹配**: 算法匹配 → LLM兜底 → 合并排名 (40%阈值)
- **多层次抽取**: CKB → 字段 → 实体 → 关系的渐进式抽取
- **智能映射**: 4 层字段映射策略 (精确匹配 → 相似度 → 同义词 → LLM)
- **LLM 100%兜底**: LLM作为兜底方案，确保关键步骤的质量
- **Token 优化**: 智能控制 LLM 调用,降低成本 90%+
- **高质量**: 置信度管理和质量过滤机制
- **可扩展**: 模块化设计,易于扩展和定制

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

## 快速开始

### 安装依赖

```bash
npm install
```

### 配置环境变量

复制 `.env.example` 到 `.env` 并配置:

```bash
cp .env.example .env
```

关键配置项:

```bash
# 启用知识图谱功能
KG_ENABLED=true

# LLM API 密钥
QWEN_API_KEY=your_api_key_here

# Token 预算
KG_TOKEN_DAILY_LIMIT=100000
KG_TOKEN_PER_DOCUMENT_LIMIT=5000
```

详细配置说明请参考 [CONFIG.md](./CONFIG.md)

### 初始化数据库

```bash
# 运行数据库迁移
npx prisma migrate dev

# 导入 Schema 定义
node kg/schema/load_schemas.js
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

## 核心模块

### 1. CKB (Common Knowledge Base)

**路径**: `kg/ckb/`

**功能**: 解析文档,提取结构化的知识块

**支持格式**:
- Word (.docx)
- PDF (.pdf)
- Excel (.xlsx)
- Markdown (.md)
- 纯文本 (.txt)

**示例**:

```javascript
const { parseCKB } = require('./kg/ckb/ckb_parser');

const ckbs = await parseCKB({
  doc_id: 'doc-123',
  content: '文档内容...',
  metadata: { filename: 'example.docx' }
});
```

### 2. 字段抽取 (Field Extractor)

**路径**: `kg/field_extractor/`

**功能**: 从 CKB 中抽取结构化字段

**抽取策略**:
1. **规则抽取**: 基于正则表达式和模式匹配
2. **NER 抽取**: 命名实体识别
3. **LLM 抽取**: 使用大语言模型进行智能抽取

**示例**:

```javascript
const { extractFields } = require('./kg/field_extractor/field_extractor');

const fields = await extractFields(ckb);
// 输出: { "时间": "2024-01-01", "地点": "北京", ... }
```

### 3. 字段清洗 (Field Normalizer)

**路径**: `kg/field_normalizer/`

**功能**: 将抽取的字段映射到标准 Schema 字段

**映射策略** (4层):
1. **精确匹配**: 字段名完全相同
2. **相似度匹配**: 编辑距离 + 余弦相似度
3. **同义词匹配**: 基于同义词词典
4. **LLM 映射**: 使用 LLM 进行语义映射 (50% 概率)

**示例**:

```javascript
const { normalizeFields } = require('./kg/field_normalizer/field_normalizer');

const normalizedFields = await normalizeFields(fields, schema);
// 输出: { "event_time": "2024-01-01", "location": "北京", ... }
```

**智能截断**:
- 自动评估字段重要性
- 场景自适应策略
- Token 节省率 ≥ 40%

### 4. Schema 管理 (Schema Manager)

**路径**: `kg/schema/`

**功能**: 管理 Schema 定义和匹配

**Schema 数量**: 250+ 个预定义 Schema

**Schema 分类**:
- 科研工作 (50+)
- 政府工作 (40+)
- 个人生活 (60+)
- 旅行摄影 (30+)
- 网信工作 (40+)
- 其他 (30+)

**示例**:

```javascript
const { matchSchemas } = require('./kg/schema/schema_matcher');

const matchedSchemas = await matchSchemas(fields);
// 输出: [{ schema_name: "地下水位变化事件", confidence: 0.85 }, ...]
```

### 5. 实体构建 (Entity Builder)

**路径**: `kg/entity/`

**功能**: 从字段构建实体

**实体类型**:
- EventEntity (事件实体)
- LocationEntity (地点实体)
- ObservationEntity (观测实体)
- ResearchEntity (科研实体)
- TravelEntity (旅行实体)
- PhotographyEntity (摄影实体)

**特性**:
- 规范名称生成 (规则 + 50% LLM)
- 实体消歧 (30% LLM)
- 属性增强 (LLM 提取隐含信息)

**示例**:

```javascript
const { buildEntity } = require('./kg/entity/entity_builder');

const entity = await buildEntity(normalizedFields, schema);
// 输出: { id: "entity-123", canonical_name: "2024年北京地下水位变化", ... }
```

### 6. 关系构建 (Relation Builder)

**路径**: `kg/relation/`

**功能**: 构建实体间的关系

**关系类型**:

1. **内建关系** (Builtin Relations)
   - 基于 Schema 定义的固有关系
   - 100% 自动生成

2. **共现关系** (Co-occurrence Relations)
   - 基于实体在文档中的共现
   - 统计共现频率和距离

3. **语义关系** (Semantic Relations)
   - 基于 LLM 的语义理解
   - 分层触发: 高优先级 30% + 随机采样 20%
   - 三轮验证机制

**示例**:

```javascript
const { buildRelations } = require('./kg/relation/relation_store');

const relations = await buildRelations(entities);
// 输出: [{ source: "entity-1", target: "entity-2", type: "causes", ... }]
```

### 7. 置信度管理 (Confidence Engine)

**路径**: `kg/confidence/`

**功能**: 计算和管理实体、关系的置信度

**置信度计算**:
- 实体置信度: 基于来源、Schema 匹配度、字段完整性
- 关系置信度: 基于实体置信度、关系类型、验证结果
- 级联更新: 实体置信度变化时自动更新关系置信度

**质量过滤**:
- 过滤低置信度实体 (< 0.5)
- 过滤低置信度关系 (< 0.5)
- 冲突消解机制

**示例**:

```javascript
const { calculateEntityConfidence } = require('./kg/confidence/confidence_engine');

const confidence = calculateEntityConfidence(entity);
// 输出: 0.85
```

### 8. 图遍历 (Graph Traversal)

**路径**: `kg/services/`

**功能**: 图查询和遍历

**支持操作**:
- BFS/DFS 遍历
- 最短路径查找
- 邻居查询
- 子图查询

**示例**:

```javascript
const { findShortestPath } = require('./kg/services/graph_traversal');

const path = await findShortestPath(sourceId, targetId);
// 输出: [entity1, entity2, entity3]
```

### 9. Token 优化 (Token Optimization)

**路径**: `kg/utils/`

**功能**: 优化 LLM 调用,降低 Token 成本

**优化策略**:
1. **LLM 响应缓存**: 避免重复调用
2. **智能频率控制**: 根据场景调整 LLM 调用频率
3. **批量处理**: 减少 API 调用次数
4. **智能截断**: 只传递重要字段给 LLM
5. **同义词词典**: 减少 LLM 映射调用

**Token 预算管理**:
- 每日限额: 100,000 tokens
- 单文档限额: 5,000 tokens
- 预警阈值: 80%
- 紧急模式: 降低 LLM 调用频率

**示例**:

```javascript
const { trackTokenUsage } = require('./kg/utils/token_tracker');

await trackTokenUsage('field_extraction', promptTokens, completionTokens);
```

## API 接口

### CKB 相关

```
POST   /api/knowledge-graph/ckb/parse          # 解析文档生成 CKB
GET    /api/knowledge-graph/ckb/:id            # 获取 CKB 详情
GET    /api/knowledge-graph/ckb/document/:docId # 获取文档的所有 CKB
```

### Schema 相关

```
GET    /api/knowledge-graph/schemas            # 获取 Schema 列表
POST   /api/knowledge-graph/schemas            # 创建 Schema
PUT    /api/knowledge-graph/schemas/:id        # 更新 Schema
DELETE /api/knowledge-graph/schemas/:id        # 删除 Schema
POST   /api/knowledge-graph/schemas/import     # 导入 Schema
GET    /api/knowledge-graph/schemas/export     # 导出 Schema
PUT    /api/knowledge-graph/schemas/:id/enable # 启用 Schema
PUT    /api/knowledge-graph/schemas/:id/disable # 禁用 Schema
```

### 实体相关

```
GET    /api/knowledge-graph/entities           # 获取实体列表
GET    /api/knowledge-graph/entities/:id       # 获取实体详情
GET    /api/knowledge-graph/entities/search    # 搜索实体
```

### 关系相关

```
GET    /api/knowledge-graph/relations          # 获取关系列表
GET    /api/knowledge-graph/relations/:id      # 获取关系详情
```

### 图遍历相关

```
POST   /api/knowledge-graph/traverse           # 图遍历
GET    /api/knowledge-graph/neighbors/:id      # 获取邻居节点
GET    /api/knowledge-graph/path/:sourceId/:targetId # 查找最短路径
GET    /api/knowledge-graph/subgraph/:id       # 获取子图
```

### KG 构建相关

```
POST   /api/knowledge-graph/build              # 构建知识图谱
POST   /api/knowledge-graph/rebuild            # 重建知识图谱
POST   /api/knowledge-graph/update             # 更新知识图谱
DELETE /api/knowledge-graph/document/:docId    # 删除文档的知识图谱
```

### 统计相关

```
GET    /api/knowledge-graph/stats/tokens       # Token 使用统计
GET    /api/knowledge-graph/stats/tokens/timeseries # Token 时序数据
GET    /api/knowledge-graph/stats/tokens/budget # Token 预算状态
GET    /api/knowledge-graph/stats/tokens/recommendations # 优化建议
GET    /api/knowledge-graph/stats/quality      # 质量统计
```

详细 API 文档请参考 [API.md](./API.md)

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

## 性能指标

### 处理时间

- **本地处理**: < 1s
- **LLM 调用**: < 10s
- **单文档总时间**: < 30s

### Token 消耗

- **每日限额**: 100,000 tokens
- **单文档限额**: 5,000 tokens
- **实际消耗**: 约 2,000-3,000 tokens/文档

### 质量指标

- **实体置信度**: 平均 > 0.7
- **关系置信度**: 平均 > 0.6
- **字段映射准确率**: > 90%

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

详细配置说明请参考 [CONFIG.md](./CONFIG.md)

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

### 字段映射失败率高

**症状**: 系统告警字段映射失败率超过 20%

**解决方案**:
1. 检查同义词词典是否完整
2. 启用同义词词典自动扩充
3. 增加 `KG_LLM_FIELD_MAPPING_RATE`

## 开发指南

### 添加新的 Schema

1. 在 `SchemaList.md` 中添加 Schema 定义
2. 运行导入脚本: `node kg/schema/load_schemas.js`
3. 验证导入结果

### 扩展字段抽取器

1. 在 `kg/field_extractor/` 创建新的抽取器
2. 实现 `extract(ckb)` 方法
3. 在 `field_extractor.js` 中注册

### 添加新的关系类型

1. 在 Schema 中定义关系类型
2. 在 `kg/relation/` 实现关系构建逻辑
3. 更新关系存储模块

### 自定义 Prompt

所有 Prompt 模板位于 `kg/prompts/` 目录:
- `extract_fields.js` - 字段抽取
- `schema_score.js` - Schema 匹配
- `entity_build.js` - 实体构建
- `relation_candidate.js` - 关系候选
- `field_mapping.js` - 字段映射

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

- ✅ 完成 Phase 1-9 开发
- ✅ 实现 250+ Schema 支持
- ✅ 实现智能字段映射
- ✅ 实现 Token 优化
- ✅ 实现前端可视化
- ✅ 实现文档操作钩子
- ✅ 完成项目集成

### 下一步计划

- [ ] Phase 10: 测试和文档完善
- [ ] Phase 11: GitHub 部署
- [ ] 性能优化和监控增强
- [ ] 支持更多文档格式
- [ ] 多语言支持

---

**Schema 驱动知识图谱系统 - 让知识抽取更智能、更高效!**
