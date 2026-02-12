# LLM文档索引预处理配置指南

本文档详细说明LLM文档索引预处理功能的所有配置选项。

## 目录

- [快速开始](#快速开始)
- [配置选项](#配置选项)
  - [主开关](#主开关)
  - [LLM调用配置](#llm调用配置)
  - [超时配置](#超时配置)
  - [并发控制配置](#并发控制配置)
  - [缓存配置](#缓存配置)
  - [智能触发阈值配置](#智能触发阈值配置)
- [配置示例](#配置示例)
- [性能调优建议](#性能调优建议)
- [故障排查](#故障排查)

## 快速开始

### 1. 启用预处理功能

在 `.env` 文件中设置：

```bash
ENABLE_LLM_PREPROCESSING=true
```

### 2. 使用默认配置

如果不设置其他配置项，系统将使用以下默认值：

- 温度参数：0.1（保持事实性）
- 最大Token数：2000
- 并发数：5
- 缓存：启用
- 智能触发阈值：字段覆盖率0.8，关系覆盖率0.7，Schema置信度0.75

### 3. 验证配置

启动服务后，查看日志输出的配置信息：

```
========== LLM Preprocessing Configuration ==========
Enabled: true
Temperature: 0.1
Max Tokens: 2000
...
====================================================
```

## 配置选项

### 主开关

#### `ENABLE_LLM_PREPROCESSING`

- **类型**: Boolean
- **默认值**: `false`
- **说明**: 启用或禁用LLM文档索引预处理功能
- **示例**: `ENABLE_LLM_PREPROCESSING=true`

**注意**: 设置为 `false` 时，系统将使用原有的知识图谱构建流程，不进行任何预处理。

### LLM调用配置

#### `LLM_PREPROCESSING_TEMPERATURE`

- **类型**: Float (0-1)
- **默认值**: `0.1`
- **说明**: LLM温度参数，控制输出的随机性。越低越确定性，越高越有创造性。
- **建议值**: `0.1` - 保持事实性，适合索引生成
- **示例**: `LLM_PREPROCESSING_TEMPERATURE=0.1`

#### `LLM_PREPROCESSING_MAX_TOKENS`

- **类型**: Integer
- **默认值**: `2000`
- **说明**: LLM单次调用的最大Token数
- **建议值**: `2000-4000` - 根据文档长度调整
- **示例**: `LLM_PREPROCESSING_MAX_TOKENS=2000`

### 超时配置

所有超时配置的单位为**毫秒**。

#### `LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT`

- **类型**: Integer (毫秒)
- **默认值**: `30000` (30秒)
- **说明**: 文档索引生成的超时时间
- **建议值**: `20000-60000` - 根据文档复杂度调整
- **示例**: `LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT=30000`

#### `LLM_PREPROCESSING_CBK_CORRECTION_TIMEOUT`

- **类型**: Integer (毫秒)
- **默认值**: `10000` (10秒)
- **说明**: CBK描述矫正的超时时间
- **建议值**: `5000-15000`
- **示例**: `LLM_PREPROCESSING_CBK_CORRECTION_TIMEOUT=10000`

#### `LLM_PREPROCESSING_FIELD_CORRECTION_TIMEOUT`

- **类型**: Integer (毫秒)
- **默认值**: `15000` (15秒)
- **说明**: 字段提取矫正的超时时间
- **建议值**: `10000-20000`
- **示例**: `LLM_PREPROCESSING_FIELD_CORRECTION_TIMEOUT=15000`

#### `LLM_PREPROCESSING_SCHEMA_CORRECTION_TIMEOUT`

- **类型**: Integer (毫秒)
- **默认值**: `10000` (10秒)
- **说明**: Schema选择矫正的超时时间
- **建议值**: `5000-15000`
- **示例**: `LLM_PREPROCESSING_SCHEMA_CORRECTION_TIMEOUT=10000`

#### `LLM_PREPROCESSING_MERGE_CORRECTION_TIMEOUT`

- **类型**: Integer (毫秒)
- **默认值**: `10000` (10秒)
- **说明**: 实体合并矫正的超时时间
- **建议值**: `5000-15000`
- **示例**: `LLM_PREPROCESSING_MERGE_CORRECTION_TIMEOUT=10000`

#### `LLM_PREPROCESSING_RELATION_CORRECTION_TIMEOUT`

- **类型**: Integer (毫秒)
- **默认值**: `20000` (20秒)
- **说明**: 关系抽取矫正的超时时间
- **建议值**: `15000-30000`
- **示例**: `LLM_PREPROCESSING_RELATION_CORRECTION_TIMEOUT=20000`

#### `LLM_PREPROCESSING_GRAPH_DESCRIPTION_TIMEOUT`

- **类型**: Integer (毫秒)
- **默认值**: `30000` (30秒)
- **说明**: 图谱描述生成的超时时间
- **建议值**: `20000-60000`
- **示例**: `LLM_PREPROCESSING_GRAPH_DESCRIPTION_TIMEOUT=30000`

### 并发控制配置

#### `LLM_PREPROCESSING_MAX_CONCURRENCY`

- **类型**: Integer
- **默认值**: `5`
- **说明**: 最大并发LLM调用数量
- **建议值**: `3-10` - 根据LLM服务的QPS限制调整
- **示例**: `LLM_PREPROCESSING_MAX_CONCURRENCY=5`

**注意**: 
- 设置过高可能导致LLM服务限流
- 设置过低会降低处理速度
- 建议根据LLM服务商的并发限制设置

#### `LLM_PREPROCESSING_QUEUE_TIMEOUT`

- **类型**: Integer (毫秒)
- **默认值**: `60000` (60秒)
- **说明**: 并发队列的超时时间
- **建议值**: `30000-120000`
- **示例**: `LLM_PREPROCESSING_QUEUE_TIMEOUT=60000`

### 缓存配置

#### `LLM_PREPROCESSING_CACHE_ENABLED`

- **类型**: Boolean
- **默认值**: `true`
- **说明**: 启用或禁用LLM调用结果缓存
- **建议**: 保持启用以提高性能和降低成本
- **示例**: `LLM_PREPROCESSING_CACHE_ENABLED=true`

#### `LLM_PREPROCESSING_CACHE_MAX_SIZE`

- **类型**: Integer
- **默认值**: `1000`
- **说明**: 缓存的最大条目数
- **建议值**: `500-2000` - 根据内存大小调整
- **示例**: `LLM_PREPROCESSING_CACHE_MAX_SIZE=1000`

#### `LLM_PREPROCESSING_CACHE_TTL`

- **类型**: Integer (毫秒)
- **默认值**: `3600000` (1小时)
- **说明**: 缓存条目的过期时间
- **建议值**: `1800000-7200000` (30分钟-2小时)
- **示例**: `LLM_PREPROCESSING_CACHE_TTL=3600000`

### 智能触发阈值配置

这些阈值决定了何时触发LLM矫正操作。

#### `LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD`

- **类型**: Float (0-1)
- **默认值**: `0.8`
- **说明**: 字段覆盖率阈值。当提取的字段覆盖率低于此值时，触发补充提取。
- **建议值**: `0.7-0.9`
- **示例**: `LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD=0.8`

**说明**: 
- 设置为 `0.8` 表示当覆盖率低于80%时触发LLM补充提取
- 值越高，触发频率越高，准确性越好，但成本也越高

#### `LLM_PREPROCESSING_RELATION_COVERAGE_THRESHOLD`

- **类型**: Float (0-1)
- **默认值**: `0.7`
- **说明**: 关系覆盖率阈值。当抽取的关系覆盖率低于此值时，触发补充提取。
- **建议值**: `0.6-0.8`
- **示例**: `LLM_PREPROCESSING_RELATION_COVERAGE_THRESHOLD=0.7`

#### `LLM_PREPROCESSING_SCHEMA_CONFIDENCE_THRESHOLD`

- **类型**: Float (0-1)
- **默认值**: `0.75`
- **说明**: Schema验证置信度阈值。当Schema匹配置信度低于此值时，触发二次验证。
- **建议值**: `0.7-0.85`
- **示例**: `LLM_PREPROCESSING_SCHEMA_CONFIDENCE_THRESHOLD=0.75`

## 配置示例

### 示例1: 开发环境（快速测试）

```bash
# 启用预处理
ENABLE_LLM_PREPROCESSING=true

# 使用较短的超时
LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT=15000
LLM_PREPROCESSING_FIELD_CORRECTION_TIMEOUT=10000
LLM_PREPROCESSING_RELATION_CORRECTION_TIMEOUT=15000

# 较低的并发
LLM_PREPROCESSING_MAX_CONCURRENCY=3

# 启用缓存
LLM_PREPROCESSING_CACHE_ENABLED=true
LLM_PREPROCESSING_CACHE_MAX_SIZE=500
```

### 示例2: 生产环境（高质量）

```bash
# 启用预处理
ENABLE_LLM_PREPROCESSING=true

# 使用标准超时
LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT=30000
LLM_PREPROCESSING_FIELD_CORRECTION_TIMEOUT=15000
LLM_PREPROCESSING_RELATION_CORRECTION_TIMEOUT=20000

# 较高的并发
LLM_PREPROCESSING_MAX_CONCURRENCY=8

# 启用缓存，较大容量
LLM_PREPROCESSING_CACHE_ENABLED=true
LLM_PREPROCESSING_CACHE_MAX_SIZE=2000
LLM_PREPROCESSING_CACHE_TTL=7200000

# 较高的质量阈值
LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD=0.85
LLM_PREPROCESSING_RELATION_COVERAGE_THRESHOLD=0.75
LLM_PREPROCESSING_SCHEMA_CONFIDENCE_THRESHOLD=0.8
```

### 示例3: 成本优化（降低LLM调用）

```bash
# 启用预处理
ENABLE_LLM_PREPROCESSING=true

# 使用较短的超时（快速失败）
LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT=20000
LLM_PREPROCESSING_FIELD_CORRECTION_TIMEOUT=10000
LLM_PREPROCESSING_RELATION_CORRECTION_TIMEOUT=15000

# 较低的并发
LLM_PREPROCESSING_MAX_CONCURRENCY=3

# 启用缓存，较长TTL
LLM_PREPROCESSING_CACHE_ENABLED=true
LLM_PREPROCESSING_CACHE_MAX_SIZE=2000
LLM_PREPROCESSING_CACHE_TTL=14400000

# 较低的触发阈值（减少LLM调用）
LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD=0.7
LLM_PREPROCESSING_RELATION_COVERAGE_THRESHOLD=0.6
LLM_PREPROCESSING_SCHEMA_CONFIDENCE_THRESHOLD=0.7
```

## 性能调优建议

### 1. 超时配置调优

- **文档索引生成**: 这是最耗时的操作，建议设置为30-60秒
- **矫正操作**: 通常较快，10-20秒即可
- **图谱描述生成**: 可以设置较长超时，因为这是最后一步

### 2. 并发控制调优

根据LLM服务商的限制调整：

| LLM服务商 | 建议并发数 |
|----------|----------|
| 通义千问 | 5-10 |
| DeepSeek | 3-5 |
| GPT-4 | 3-5 |
| 本地模型 | 1-3 |

### 3. 缓存策略调优

- **开发环境**: 较小缓存（500），较短TTL（30分钟）
- **生产环境**: 较大缓存（2000），较长TTL（2小时）
- **内存受限**: 减小缓存大小，但保持启用

### 4. 智能触发阈值调优

根据质量和成本平衡：

| 场景 | 字段覆盖率 | 关系覆盖率 | Schema置信度 |
|-----|----------|----------|------------|
| 高质量优先 | 0.85-0.9 | 0.75-0.8 | 0.8-0.85 |
| 平衡 | 0.8 | 0.7 | 0.75 |
| 成本优先 | 0.7-0.75 | 0.6-0.65 | 0.7 |

## 故障排查

### 问题1: LLM调用频繁超时

**症状**: 日志中出现大量超时错误

**解决方案**:
1. 增加超时时间
2. 降低并发数
3. 检查LLM服务状态
4. 检查网络连接

```bash
# 增加超时
LLM_PREPROCESSING_DOCUMENT_INDEX_TIMEOUT=60000

# 降低并发
LLM_PREPROCESSING_MAX_CONCURRENCY=3
```

### 问题2: 处理速度太慢

**症状**: 知识图谱构建耗时过长

**解决方案**:
1. 增加并发数（如果LLM服务允许）
2. 降低触发阈值（减少LLM调用）
3. 启用缓存
4. 减少超时时间（快速失败）

```bash
# 增加并发
LLM_PREPROCESSING_MAX_CONCURRENCY=8

# 降低触发阈值
LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD=0.7
LLM_PREPROCESSING_RELATION_COVERAGE_THRESHOLD=0.6
```

### 问题3: 成本过高

**症状**: LLM调用次数过多

**解决方案**:
1. 启用缓存并增加TTL
2. 降低触发阈值
3. 增加缓存大小

```bash
# 启用缓存
LLM_PREPROCESSING_CACHE_ENABLED=true
LLM_PREPROCESSING_CACHE_MAX_SIZE=2000
LLM_PREPROCESSING_CACHE_TTL=14400000

# 降低触发阈值
LLM_PREPROCESSING_FIELD_COVERAGE_THRESHOLD=0.7
LLM_PREPROCESSING_RELATION_COVERAGE_THRESHOLD=0.6
LLM_PREPROCESSING_SCHEMA_CONFIDENCE_THRESHOLD=0.7
```

### 问题4: 配置不生效

**症状**: 修改配置后没有变化

**解决方案**:
1. 确认 `.env` 文件位置正确
2. 重启服务器
3. 检查环境变量是否正确加载
4. 查看启动日志中的配置信息

```bash
# 查看配置是否正确加载
# 启动日志应该显示：
========== LLM Preprocessing Configuration ==========
Enabled: true
...
====================================================
```

### 问题5: 配置验证失败

**症状**: 启动时报错 "Invalid preprocessing configuration"

**解决方案**:
1. 检查配置值是否在有效范围内
2. 温度参数必须在 0-1 之间
3. 阈值必须在 0-1 之间
4. 并发数必须 >= 1

```bash
# 错误示例
LLM_PREPROCESSING_TEMPERATURE=1.5  # 错误：超出范围

# 正确示例
LLM_PREPROCESSING_TEMPERATURE=0.1  # 正确：在0-1之间
```

## 监控指标

系统会自动收集以下性能指标：

- **总调用次数**: LLM调用总数
- **成功率**: 成功调用的百分比
- **超时次数**: 超时的调用次数
- **缓存命中率**: 缓存命中的百分比
- **平均时延**: 每次调用的平均耗时
- **各操作时延**: 每个操作类型的详细时延统计

可以通过API查询这些指标（需要实现API接口）。

## 相关文档

- [LLM文档索引预处理设计文档](../../.kiro/specs/llm-document-index-preprocessing/design.md)
- [需求文档](../../.kiro/specs/llm-document-index-preprocessing/requirements.md)
- [实现计划](../../.kiro/specs/llm-document-index-preprocessing/tasks.md)
