# LLM字段提取配置指南

## 概述

LLM字段提取是知识图谱关系抽取优化的核心功能，通过智能触发和批量处理策略，在保证关系构建成功率的同时，最小化LLM调用成本。

## 配置项说明

### 主开关

```env
# 启用LLM字段提取增强
ENABLE_LLM_FIELD_EXTRACTION=false
```

- **默认值**: `false`
- **说明**: 控制是否启用LLM字段提取功能
- **建议**: 
  - 开发/测试环境：设置为`false`以节省成本
  - 生产环境：设置为`true`以获得最佳关系构建效果

### 批量处理配置

```env
# LLM批量处理配置
LLM_BATCH_SIZE=20
LLM_MAX_CONCURRENT=3
LLM_TEMPERATURE=0.1
```

#### LLM_BATCH_SIZE
- **默认值**: `20`
- **说明**: 每次LLM调用处理的CKB数量
- **影响**: 
  - 更大的批量大小 → 更少的API调用 → 更低的成本
  - 但过大可能导致单次调用超时
- **建议值**: 
  - 小文档（<100个CKB）：10-15
  - 中等文档（100-300个CKB）：20-25
  - 大文档（>300个CKB）：25-30

#### LLM_MAX_CONCURRENT
- **默认值**: `3`
- **说明**: 最大并发LLM请求数
- **影响**: 
  - 更高的并发 → 更快的处理速度
  - 但可能触发API限流
- **建议值**: 
  - 免费API：1-2
  - 付费API（标准）：3-5
  - 付费API（高级）：5-10

#### LLM_TEMPERATURE
- **默认值**: `0.1`
- **说明**: LLM生成的随机性（0-1）
- **影响**: 
  - 更低的温度 → 更确定的输出 → 更高的准确性
  - 更高的温度 → 更多样的输出 → 可能更有创意但不稳定
- **建议值**: 
  - 字段提取：0.1-0.2（需要准确性）
  - 文本生成：0.7-0.9（需要创意）

### 字段提取策略

```env
# 字段提取策略
FIELD_EXTRACTION_STRATEGY=schema-aware
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.3
```

#### FIELD_EXTRACTION_STRATEGY
- **默认值**: `schema-aware`
- **说明**: 字段提取策略
- **可选值**: 
  - `schema-aware`: 根据激活的schemas智能提取（推荐）
  - `rule-based`: 仅使用规则提取
  - `ner-only`: 仅使用NER提取
- **建议**: 使用`schema-aware`以获得最佳效果

#### CRITICAL_FIELD_WEIGHT_THRESHOLD
- **默认值**: `0.3`
- **说明**: 关键字段的权重阈值
- **影响**: 
  - 更高的阈值 → 更少的LLM调用 → 更低的成本
  - 但可能遗漏一些重要字段
- **建议值**: 
  - 高质量要求：0.2-0.3
  - 平衡成本和质量：0.3-0.4
  - 成本优先：0.4-0.5

### 性能配置

```env
# 性能配置
FIELD_EXTRACTION_BATCH_SIZE=20
ENABLE_FIELD_EXTRACTION_CACHE=true
```

#### FIELD_EXTRACTION_BATCH_SIZE
- **默认值**: `20`
- **说明**: 字段提取的批量处理大小
- **影响**: 处理速度和内存使用
- **建议值**: 10-30

#### ENABLE_FIELD_EXTRACTION_CACHE
- **默认值**: `true`
- **说明**: 是否启用字段提取缓存
- **影响**: 
  - 启用 → 更快的重复处理
  - 禁用 → 更低的内存使用
- **建议**: 保持启用

## 使用场景

### 场景1: 开发测试（成本优先）

```env
ENABLE_LLM_FIELD_EXTRACTION=false
LLM_BATCH_SIZE=20
LLM_MAX_CONCURRENT=1
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.4
```

**特点**:
- 禁用LLM，仅使用规则+NER
- 零成本
- 关系数量可能较少（~50-100个）

### 场景2: 生产环境（平衡模式）

```env
ENABLE_LLM_FIELD_EXTRACTION=true
LLM_BATCH_SIZE=20
LLM_MAX_CONCURRENT=3
LLM_TEMPERATURE=0.1
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.3
```

**特点**:
- 启用LLM增强
- 平衡成本和质量
- 关系数量：~500-800个
- Token消耗：~6-8K/文档

### 场景3: 高质量要求

```env
ENABLE_LLM_FIELD_EXTRACTION=true
LLM_BATCH_SIZE=15
LLM_MAX_CONCURRENT=5
LLM_TEMPERATURE=0.1
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.2
```

**特点**:
- 更小的批量大小，更高的准确性
- 更高的并发，更快的处理
- 更低的阈值，更多的字段提取
- 关系数量：~800-1000个
- Token消耗：~8-12K/文档

## 成本估算

### Token消耗估算

基于241个CKB的测试文档：

| 配置 | LLM调用次数 | Token消耗 | 成本估算（GPT-4） |
|------|------------|----------|------------------|
| 批量大小=10 | 25 | ~12K | $0.24 |
| 批量大小=20 | 13 | ~6.7K | $0.13 |
| 批量大小=30 | 9 | ~5K | $0.10 |

**成本计算公式**:
```
成本 = (Token消耗 / 1000) × 单价
```

**常见LLM单价**（输入token，2024年价格）:
- GPT-4: $0.03/1K tokens
- GPT-3.5: $0.001/1K tokens
- Claude-3: $0.015/1K tokens
- 通义千问: ¥0.008/1K tokens

### 月度成本估算

假设每天处理100个文档：

| 批量大小 | 每文档Token | 每日Token | 月度Token | 月度成本（GPT-4） |
|---------|-----------|----------|----------|------------------|
| 10 | 12K | 1.2M | 36M | $1,080 |
| 20 | 6.7K | 670K | 20M | $600 |
| 30 | 5K | 500K | 15M | $450 |

## 性能优化建议

### 1. 调整批量大小

**问题**: 处理速度慢
**解决**: 增加`LLM_BATCH_SIZE`到25-30

**问题**: Token消耗高
**解决**: 保持`LLM_BATCH_SIZE`在20左右

### 2. 调整并发数

**问题**: 处理速度慢
**解决**: 增加`LLM_MAX_CONCURRENT`到5-10

**问题**: API限流错误
**解决**: 降低`LLM_MAX_CONCURRENT`到1-2

### 3. 调整触发阈值

**问题**: 关系数量不足
**解决**: 降低`CRITICAL_FIELD_WEIGHT_THRESHOLD`到0.2

**问题**: Token消耗过高
**解决**: 提高`CRITICAL_FIELD_WEIGHT_THRESHOLD`到0.4-0.5

### 4. Schema预过滤

系统已自动启用Schema预过滤，当schema数量>50时：
- 使用文档分类信息过滤schemas
- 减少88%的schema匹配次数
- 处理时间从38s降到6.5s

**无需手动配置**，系统自动优化。

## 监控指标

### 关键指标

1. **LLM调用占比**: 应该<10%
   - 计算方式: (需要LLM的CKB数 / 总CKB数) × 100%
   - 查看方式: 日志中的`[KG Service] X CKBs need LLM enhancement (Y%)`

2. **Token消耗**: 应该<5K/文档
   - 查看方式: 日志中的`[LLM Extractor] Token usage: X`

3. **处理时间**: 应该<30s/文档
   - 查看方式: 日志中的`[KG Service] Knowledge graph built in Xms`

4. **关系数量**: 应该>50/文档
   - 查看方式: 日志中的`[KG Service] Created X relations`

### 告警阈值

| 指标 | 警告阈值 | 错误阈值 | 处理建议 |
|------|---------|---------|---------|
| LLM调用占比 | >15% | >20% | 检查规则提取器，增加规则覆盖 |
| Token消耗 | >8K | >10K | 减小批量大小，提高阈值 |
| 处理时间 | >45s | >60s | 增加并发数，优化schema |
| 关系数量 | <30 | <20 | 降低阈值，检查schema配置 |

## 故障排查

### 问题1: LLM调用失败

**症状**: 日志中出现`[LLM Extractor] Batch X failed`

**可能原因**:
1. API密钥无效或过期
2. API限流
3. 网络超时

**解决方案**:
1. 检查`.env`中的API密钥配置
2. 降低`LLM_MAX_CONCURRENT`
3. 增加超时时间（代码中默认30秒）

### 问题2: Token消耗过高

**症状**: Token消耗>10K/文档

**可能原因**:
1. 批量大小太小
2. 触发阈值太低
3. 文本截断不够

**解决方案**:
1. 增加`LLM_BATCH_SIZE`到25-30
2. 提高`CRITICAL_FIELD_WEIGHT_THRESHOLD`到0.4
3. 检查文本截断逻辑（默认100字符）

### 问题3: 关系数量不足

**症状**: 关系数量<50/文档

**可能原因**:
1. LLM未启用
2. 触发阈值太高
3. Schema配置不足

**解决方案**:
1. 设置`ENABLE_LLM_FIELD_EXTRACTION=true`
2. 降低`CRITICAL_FIELD_WEIGHT_THRESHOLD`到0.2-0.3
3. 检查schema数量和配置

### 问题4: 处理速度慢

**症状**: 处理时间>60s/文档

**可能原因**:
1. 并发数太低
2. Schema数量太多
3. 批量大小太小

**解决方案**:
1. 增加`LLM_MAX_CONCURRENT`到5-10
2. 检查schema预过滤是否生效
3. 增加`LLM_BATCH_SIZE`到25-30

## 最佳实践

### 1. 渐进式启用

**第一阶段**: 禁用LLM，测试基础功能
```env
ENABLE_LLM_FIELD_EXTRACTION=false
```

**第二阶段**: 启用LLM，小批量测试
```env
ENABLE_LLM_FIELD_EXTRACTION=true
LLM_BATCH_SIZE=10
LLM_MAX_CONCURRENT=1
```

**第三阶段**: 优化配置，全量部署
```env
ENABLE_LLM_FIELD_EXTRACTION=true
LLM_BATCH_SIZE=20
LLM_MAX_CONCURRENT=3
```

### 2. 定期监控

- 每周检查Token消耗趋势
- 每月评估成本效益
- 根据实际情况调整配置

### 3. A/B测试

对比不同配置的效果：
- 配置A: 批量大小=10，阈值=0.3
- 配置B: 批量大小=20，阈值=0.4

选择成本和质量平衡最好的配置。

## 参考资料

- [知识图谱优化最终报告](./KG_OPTIMIZATION_FINAL_REPORT.md)
- [进一步优化报告](./KG_ADVANCED_OPTIMIZATION_REPORT.md)
- [阶段2完成报告](./KG_RELATION_EXTRACTION_PHASE2_COMPLETE.md)
- [任务列表](./.kiro/specs/kg-relation-extraction-optimization/tasks.md)

---

**文档版本**: 1.0  
**最后更新**: 2026-02-11  
**维护者**: AI Knowledge Base Team
