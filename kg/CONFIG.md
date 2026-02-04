# Schema 驱动知识图谱配置文档

## 概述

本文档说明 Schema 驱动知识图谱系统的所有环境变量配置项。

## 环境变量配置

### 1. 功能开关

#### KG_ENABLED
- **类型**: Boolean
- **默认值**: `true`
- **说明**: 知识图谱功能总开关
- **用途**: 控制是否启用知识图谱功能

### 2. Schema 配置

#### KG_SCHEMA_AUTO_CHECK
- **类型**: Boolean
- **默认值**: `true`
- **说明**: 系统启动时自动检查 Schema 数量
- **用途**: 确保数据库中至少有 250 个 Schema

#### KG_SCHEMA_MIN_COUNT
- **类型**: Number
- **默认值**: `250`
- **说明**: Schema 最小数量要求
- **用途**: 如果数据库中 Schema 数量少于此值,触发自动导入

#### KG_SCHEMA_AUTO_IMPORT
- **类型**: Boolean
- **默认值**: `true`
- **说明**: Schema 数量不足时自动导入
- **用途**: 从 SchemaList.md 自动导入 Schema

### 3. Token 预算管理

#### KG_TOKEN_DAILY_LIMIT
- **类型**: Number
- **默认值**: `100000`
- **说明**: 每日 Token 使用限额
- **用途**: 控制每日最大 Token 消耗,防止成本失控

#### KG_TOKEN_PER_DOCUMENT_LIMIT
- **类型**: Number
- **默认值**: `5000`
- **说明**: 单文档 Token 使用限额
- **用途**: 控制单个文档处理的最大 Token 消耗

#### KG_TOKEN_WARNING_THRESHOLD
- **类型**: Number (0-1)
- **默认值**: `0.8`
- **说明**: Token 预警阈值 (80%)
- **用途**: 当 Token 使用量达到此比例时发出预警

#### KG_TOKEN_EMERGENCY_THRESHOLD
- **类型**: Number (0-1)
- **默认值**: `1.0`
- **说明**: Token 紧急阈值 (100%)
- **用途**: 当 Token 使用量达到此比例时进入紧急模式,降低 LLM 调用频率

### 4. LLM 调用频率控制

#### KG_LLM_FIELD_EXTRACTION_RATE
- **类型**: Number (0-1)
- **默认值**: `1.0`
- **说明**: 字段抽取 LLM 调用频率 (100%)
- **用途**: 控制字段抽取阶段的 LLM 调用比例

#### KG_LLM_FIELD_MAPPING_RATE
- **类型**: Number (0-1)
- **默认值**: `0.5`
- **说明**: 字段映射 LLM 调用频率 (50%)
- **用途**: 控制字段映射阶段的 LLM 调用比例

#### KG_LLM_ENTITY_CANONICAL_NAME_RATE
- **类型**: Number (0-1)
- **默认值**: `0.5`
- **说明**: 实体规范名称生成 LLM 调用频率 (50%)
- **用途**: 控制实体规范名称生成的 LLM 调用比例

#### KG_LLM_ENTITY_DISAMBIGUATION_RATE
- **类型**: Number (0-1)
- **默认值**: `0.3`
- **说明**: 实体消歧 LLM 调用频率 (30%)
- **用途**: 控制实体消歧阶段的 LLM 调用比例

#### KG_LLM_SEMANTIC_RELATION_HIGH_PRIORITY_RATE
- **类型**: Number (0-1)
- **默认值**: `0.3`
- **说明**: 高优先级语义关系 LLM 调用频率 (30%)
- **用途**: 控制高优先级实体对的语义关系抽取比例

#### KG_LLM_SEMANTIC_RELATION_RANDOM_SAMPLE_RATE
- **类型**: Number (0-1)
- **默认值**: `0.2`
- **说明**: 随机采样语义关系 LLM 调用频率 (20%)
- **用途**: 控制随机采样实体对的语义关系抽取比例

### 5. 性能约束

#### KG_LOCAL_PROCESSING_TIMEOUT_MS
- **类型**: Number (毫秒)
- **默认值**: `1000`
- **说明**: 本地处理超时时间 (1秒)
- **用途**: 控制本地算法处理的最大时间

#### KG_LLM_CALL_TIMEOUT_MS
- **类型**: Number (毫秒)
- **默认值**: `10000`
- **说明**: LLM 调用超时时间 (10秒)
- **用途**: 控制单次 LLM 调用的最大等待时间

#### KG_TOTAL_PROCESSING_TIMEOUT_MS
- **类型**: Number (毫秒)
- **默认值**: `30000`
- **说明**: 总处理超时时间 (30秒)
- **用途**: 控制单文档知识图谱构建的最大时间

#### KG_SLOW_QUERY_THRESHOLD_MS
- **类型**: Number (毫秒)
- **默认值**: `500`
- **说明**: 慢查询阈值 (500毫秒)
- **用途**: 记录超过此时间的数据库查询

### 6. 置信度阈值

#### KG_MIN_ENTITY_CONFIDENCE
- **类型**: Number (0-1)
- **默认值**: `0.5`
- **说明**: 实体最低置信度阈值
- **用途**: 过滤低置信度实体

#### KG_MIN_RELATION_CONFIDENCE
- **类型**: Number (0-1)
- **默认值**: `0.5`
- **说明**: 关系最低置信度阈值
- **用途**: 过滤低置信度关系

#### KG_MIN_QUALITY_SCORE
- **类型**: Number (0-1)
- **默认值**: `0.6`
- **说明**: 最低质量分数阈值
- **用途**: 过滤低质量数据

### 7. 缓存配置

#### KG_CACHE_ENABLED
- **类型**: Boolean
- **默认值**: `true`
- **说明**: LLM 响应缓存开关
- **用途**: 控制是否启用 LLM 响应缓存

#### KG_CACHE_TTL_HOURS
- **类型**: Number (小时)
- **默认值**: `24`
- **说明**: 缓存过期时间 (24小时)
- **用途**: 控制缓存数据的有效期

#### KG_CACHE_MAX_SIZE_MB
- **类型**: Number (MB)
- **默认值**: `100`
- **说明**: 缓存最大大小 (100MB)
- **用途**: 控制缓存占用的最大内存

### 8. 同义词词典配置

#### KG_SYNONYM_DICT_AUTO_EXPAND
- **类型**: Boolean
- **默认值**: `true`
- **说明**: 同义词词典自动扩充开关
- **用途**: 控制是否自动从 LLM 映射结果中学习新同义词

#### KG_SYNONYM_DICT_LEARNING_ENABLED
- **类型**: Boolean
- **默认值**: `true`
- **说明**: 同义词词典学习功能开关
- **用途**: 控制是否从未映射字段中学习新同义词

#### KG_SYNONYM_DICT_MIN_COVERAGE
- **类型**: Number (0-1)
- **默认值**: `0.9`
- **说明**: 同义词词典最低覆盖率 (90%)
- **用途**: 同义词词典质量评估的最低覆盖率要求

### 9. 字段映射失败率告警

#### KG_FIELD_MAPPING_FAILURE_THRESHOLD
- **类型**: Number (0-1)
- **默认值**: `0.2`
- **说明**: 字段映射失败率告警阈值 (20%)
- **用途**: 当映射失败率超过此值时触发告警

### 10. 批量处理配置

#### KG_BATCH_SIZE
- **类型**: Number
- **默认值**: `10`
- **说明**: 批量处理大小
- **用途**: 控制批量处理的记录数量

#### KG_BATCH_CONCURRENCY
- **类型**: Number
- **默认值**: `3`
- **说明**: 批量处理并发数
- **用途**: 控制批量处理的并发任务数

## 配置示例

### 开发环境配置

```bash
# 开发环境 - 启用所有功能,较宽松的限制
KG_ENABLED=true
KG_TOKEN_DAILY_LIMIT=200000
KG_TOKEN_PER_DOCUMENT_LIMIT=10000
KG_LLM_FIELD_MAPPING_RATE=1.0
KG_LLM_ENTITY_CANONICAL_NAME_RATE=1.0
KG_LLM_ENTITY_DISAMBIGUATION_RATE=1.0
KG_LLM_SEMANTIC_RELATION_HIGH_PRIORITY_RATE=1.0
KG_LLM_SEMANTIC_RELATION_RANDOM_SAMPLE_RATE=1.0
```

### 生产环境配置

```bash
# 生产环境 - 严格的 Token 控制和性能约束
KG_ENABLED=true
KG_TOKEN_DAILY_LIMIT=100000
KG_TOKEN_PER_DOCUMENT_LIMIT=5000
KG_TOKEN_WARNING_THRESHOLD=0.8
KG_TOKEN_EMERGENCY_THRESHOLD=1.0
KG_LLM_FIELD_MAPPING_RATE=0.5
KG_LLM_ENTITY_CANONICAL_NAME_RATE=0.5
KG_LLM_ENTITY_DISAMBIGUATION_RATE=0.3
KG_LLM_SEMANTIC_RELATION_HIGH_PRIORITY_RATE=0.3
KG_LLM_SEMANTIC_RELATION_RANDOM_SAMPLE_RATE=0.2
KG_CACHE_ENABLED=true
KG_CACHE_TTL_HOURS=24
```

### 测试环境配置

```bash
# 测试环境 - 禁用缓存,启用所有功能
KG_ENABLED=true
KG_TOKEN_DAILY_LIMIT=50000
KG_TOKEN_PER_DOCUMENT_LIMIT=3000
KG_CACHE_ENABLED=false
KG_SYNONYM_DICT_AUTO_EXPAND=false
KG_SYNONYM_DICT_LEARNING_ENABLED=false
```

## 配置优化建议

### 1. Token 成本优化

如果 Token 成本过高,可以:
- 降低 `KG_LLM_FIELD_MAPPING_RATE` (从 0.5 降到 0.3)
- 降低 `KG_LLM_ENTITY_DISAMBIGUATION_RATE` (从 0.3 降到 0.2)
- 降低 `KG_LLM_SEMANTIC_RELATION_RANDOM_SAMPLE_RATE` (从 0.2 降到 0.1)
- 启用缓存 `KG_CACHE_ENABLED=true`
- 启用同义词词典自动扩充 `KG_SYNONYM_DICT_AUTO_EXPAND=true`

### 2. 性能优化

如果处理速度过慢,可以:
- 增加 `KG_BATCH_CONCURRENCY` (从 3 增到 5)
- 增加 `KG_BATCH_SIZE` (从 10 增到 20)
- 增加 `KG_LLM_CALL_TIMEOUT_MS` (从 10000 增到 15000)
- 启用缓存 `KG_CACHE_ENABLED=true`

### 3. 质量优化

如果知识图谱质量不足,可以:
- 增加 `KG_LLM_FIELD_MAPPING_RATE` (从 0.5 增到 0.8)
- 增加 `KG_LLM_ENTITY_CANONICAL_NAME_RATE` (从 0.5 增到 0.8)
- 增加 `KG_LLM_ENTITY_DISAMBIGUATION_RATE` (从 0.3 增到 0.5)
- 增加 `KG_LLM_SEMANTIC_RELATION_HIGH_PRIORITY_RATE` (从 0.3 增到 0.5)
- 提高 `KG_MIN_ENTITY_CONFIDENCE` (从 0.5 增到 0.6)
- 提高 `KG_MIN_RELATION_CONFIDENCE` (从 0.5 增到 0.6)

## 监控和告警

系统会自动监控以下指标:

1. **Token 使用量**: 达到 80% 时预警,达到 100% 时告警
2. **字段映射失败率**: 超过 20% 时告警
3. **处理超时**: 超过配置的超时时间时记录日志
4. **慢查询**: 超过 500ms 的查询会被记录
5. **Schema 数量**: 少于 250 个时触发自动导入

## 故障排查

### Token 超限

**症状**: 系统进入紧急模式,LLM 调用频率降低

**解决方案**:
1. 检查 `KG_TOKEN_DAILY_LIMIT` 是否设置过低
2. 检查是否有大量文档同时处理
3. 启用缓存减少重复调用
4. 降低 LLM 调用频率

### 处理超时

**症状**: 文档处理失败,提示超时

**解决方案**:
1. 增加 `KG_TOTAL_PROCESSING_TIMEOUT_MS`
2. 增加 `KG_LLM_CALL_TIMEOUT_MS`
3. 检查网络连接
4. 检查 LLM API 响应速度

### Schema 数量不足

**症状**: 系统启动时提示 Schema 数量不足

**解决方案**:
1. 确保 `KG_SCHEMA_AUTO_IMPORT=true`
2. 检查 `SchemaList.md` 文件是否存在
3. 手动运行 Schema 导入脚本
4. 检查数据库连接

### 字段映射失败率高

**症状**: 系统告警字段映射失败率超过 20%

**解决方案**:
1. 检查同义词词典是否完整
2. 启用同义词词典自动扩充
3. 增加 `KG_LLM_FIELD_MAPPING_RATE`
4. 检查文档内容是否包含大量非标准字段

## 最新更新 (v1.0.1)

### 三阶段Schema匹配配置

#### KG_SCHEMA_MATCH_ALGORITHM_THRESHOLD
- **类型**: Number (0-1)
- **默认值**: `0.4`
- **说明**: 算法匹配阶段的阈值（从0.6降至0.4）
- **用途**: 提高Schema召回率，确保更多潜在匹配被识别

#### KG_SCHEMA_MATCH_LLM_FALLBACK
- **类型**: Boolean
- **默认值**: `true`
- **说明**: 启用LLM兜底匹配
- **用途**: 对未匹配字段使用LLM进行语义理解

### LLM 100%兜底策略

以下操作现在使用LLM作为100%兜底方案：

- **Schema匹配**: 处理所有未匹配字段
- **实体名称生成**: 验证和优化所有实体名称
- **字段映射**: 4层策略后的兜底处理

## 参考资料

- [Schema 驱动知识图谱设计文档](../.kiro/specs/schema-driven-knowledge-graph/design.md)
- [Schema 驱动知识图谱需求文档](../.kiro/specs/schema-driven-knowledge-graph/requirements.md)
- [三阶段Schema匹配](./pipeline/THREE_STAGE_SCHEMA_MATCHING.md)
- [LLM兜底策略说明](./pipeline/LLM_FALLBACK_EXPLAINED.md)
- [Token 优化策略](./utils/token_budget_manager.js)
- [性能监控](./utils/performance_monitor.js)
