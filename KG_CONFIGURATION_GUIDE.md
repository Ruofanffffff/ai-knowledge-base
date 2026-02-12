# 知识图谱配置说明

## 📋 文档概述

本文档涵盖任务17.3的配置说明，提供完整的配置参数说明和最佳实践。

**版本**: 1.0  
**最后更新**: 2026-02-11

---

## 🔧 环境变量配置

### LLM配置

```env
# LLM API密钥
QWEN_API_KEY=your_qwen_api_key_here
DEEPSEEK_API_KEY=your_deepseek_api_key_here

# LLM字段提取开关
ENABLE_LLM_FIELD_EXTRACTION=true

# LLM批量处理配置
LLM_BATCH_SIZE=20
LLM_MAX_CONCURRENT=3
LLM_TEMPERATURE=0.1
LLM_TIMEOUT=30000
```

#### 参数说明

| 参数 | 默认值 | 说明 | 建议值 |
|------|--------|------|--------|
| ENABLE_LLM_FIELD_EXTRACTION | false | 启用LLM字段提取 | 生产环境: true |
| LLM_BATCH_SIZE | 20 | 每批处理的CKB数量 | 15-30 |
| LLM_MAX_CONCURRENT | 3 | 最大并发请求数 | 3-5 |
| LLM_TEMPERATURE | 0.1 | LLM生成温度 | 0.1-0.2 |
| LLM_TIMEOUT | 30000 | 请求超时时间（毫秒） | 30000-60000 |

### 字段提取配置

```env
# 字段提取策略
FIELD_EXTRACTION_STRATEGY=schema-aware
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.3
FIELD_EXTRACTION_BATCH_SIZE=20
ENABLE_FIELD_EXTRACTION_CACHE=true
```

#### 参数说明

| 参数 | 默认值 | 说明 | 可选值 |
|------|--------|------|--------|
| FIELD_EXTRACTION_STRATEGY | schema-aware | 字段提取策略 | schema-aware, rule-based, ner-only |
| CRITICAL_FIELD_WEIGHT_THRESHOLD | 0.3 | 关键字段权重阈值 | 0.2-0.5 |
| FIELD_EXTRACTION_BATCH_SIZE | 20 | 批量处理大小 | 10-30 |
| ENABLE_FIELD_EXTRACTION_CACHE | true | 启用缓存 | true, false |

### Token预算配置

```env
# Token预算管理
ENABLE_TOKEN_BUDGET=true
DAILY_TOKEN_BUDGET=1000000
DOCUMENT_TOKEN_BUDGET=8000
TOKEN_BUDGET_ALERT_EMAIL=admin@example.com
```

#### 参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| ENABLE_TOKEN_BUDGET | false | 启用预算控制 |
| DAILY_TOKEN_BUDGET | 1000000 | 日预算（tokens） |
| DOCUMENT_TOKEN_BUDGET | 8000 | 单文档预算（tokens） |
| TOKEN_BUDGET_ALERT_EMAIL | - | 告警邮箱 |

### 日志配置

```env
# 日志配置
LOG_LEVEL=INFO
LOG_FORMAT=text
LOG_COLORS=true
LOG_FILE=logs/kg.log
```

#### 参数说明

| 参数 | 默认值 | 说明 | 可选值 |
|------|--------|------|--------|
| LOG_LEVEL | INFO | 日志级别 | DEBUG, INFO, WARN, ERROR, NONE |
| LOG_FORMAT | text | 日志格式 | text, json |
| LOG_COLORS | true | 启用颜色 | true, false |
| LOG_FILE | - | 日志文件路径 | 文件路径或留空 |

### 性能配置

```env
# 性能优化
ENABLE_SCHEMA_PREFILTER=true
SCHEMA_PREFILTER_THRESHOLD=50
ENABLE_PARALLEL_ENTITY_BUILD=false
ENABLE_RELATION_INDEX=true
```

#### 参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| ENABLE_SCHEMA_PREFILTER | true | 启用Schema预过滤 |
| SCHEMA_PREFILTER_THRESHOLD | 50 | 预过滤触发阈值 |
| ENABLE_PARALLEL_ENTITY_BUILD | false | 并行构建实体 |
| ENABLE_RELATION_INDEX | true | 启用关系索引 |

---

## 📝 配置文件

### 1. .env文件示例

```env
# ==================== LLM配置 ====================
QWEN_API_KEY=sk-xxx
ENABLE_LLM_FIELD_EXTRACTION=true
LLM_BATCH_SIZE=20
LLM_MAX_CONCURRENT=3
LLM_TEMPERATURE=0.1

# ==================== 字段提取配置 ====================
FIELD_EXTRACTION_STRATEGY=schema-aware
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.3
ENABLE_FIELD_EXTRACTION_CACHE=true

# ==================== Token预算配置 ====================
ENABLE_TOKEN_BUDGET=true
DAILY_TOKEN_BUDGET=1000000
DOCUMENT_TOKEN_BUDGET=8000

# ==================== 日志配置 ====================
LOG_LEVEL=INFO
LOG_FORMAT=text
LOG_COLORS=true

# ==================== 性能配置 ====================
ENABLE_SCHEMA_PREFILTER=true
SCHEMA_PREFILTER_THRESHOLD=50
```

### 2. 数据库配置

```env
# 数据库连接
DATABASE_URL=postgresql://user:password@localhost:5432/ai_knowledge_base

# 连接池配置
DB_POOL_MIN=2
DB_POOL_MAX=10
DB_TIMEOUT=30000
```

---

## 🎯 场景化配置

### 场景1: 开发测试环境

**特点**: 成本优先，快速迭代

```env
# LLM配置
ENABLE_LLM_FIELD_EXTRACTION=false  # 禁用LLM节省成本
LLM_BATCH_SIZE=10
LLM_MAX_CONCURRENT=1

# 字段提取
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.4  # 提高阈值减少LLM调用

# Token预算
ENABLE_TOKEN_BUDGET=true
DAILY_TOKEN_BUDGET=100000  # 较低预算

# 日志
LOG_LEVEL=DEBUG  # 详细日志便于调试
LOG_FORMAT=text
```

### 场景2: 生产环境（平衡模式）

**特点**: 平衡成本和质量

```env
# LLM配置
ENABLE_LLM_FIELD_EXTRACTION=true
LLM_BATCH_SIZE=20
LLM_MAX_CONCURRENT=3
LLM_TEMPERATURE=0.1

# 字段提取
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.3
ENABLE_FIELD_EXTRACTION_CACHE=true

# Token预算
ENABLE_TOKEN_BUDGET=true
DAILY_TOKEN_BUDGET=1000000
DOCUMENT_TOKEN_BUDGET=8000

# 日志
LOG_LEVEL=INFO
LOG_FORMAT=json  # 结构化日志便于分析
```

### 场景3: 高质量要求

**特点**: 质量优先，成本次要

```env
# LLM配置
ENABLE_LLM_FIELD_EXTRACTION=true
LLM_BATCH_SIZE=15  # 较小批量提高准确性
LLM_MAX_CONCURRENT=5  # 更高并发提升速度
LLM_TEMPERATURE=0.1

# 字段提取
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.2  # 更低阈值提取更多字段
ENABLE_FIELD_EXTRACTION_CACHE=true

# Token预算
ENABLE_TOKEN_BUDGET=true
DAILY_TOKEN_BUDGET=5000000  # 更高预算
DOCUMENT_TOKEN_BUDGET=12000

# 日志
LOG_LEVEL=INFO
LOG_FORMAT=json
```

### 场景4: 高吞吐量

**特点**: 速度优先，大批量处理

```env
# LLM配置
ENABLE_LLM_FIELD_EXTRACTION=true
LLM_BATCH_SIZE=30  # 更大批量
LLM_MAX_CONCURRENT=10  # 最大并发
LLM_TEMPERATURE=0.1

# 字段提取
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.35
ENABLE_FIELD_EXTRACTION_CACHE=true

# 性能优化
ENABLE_SCHEMA_PREFILTER=true
ENABLE_PARALLEL_ENTITY_BUILD=true
ENABLE_RELATION_INDEX=true

# 日志
LOG_LEVEL=WARN  # 减少日志输出
LOG_FORMAT=json
```

---

## 🔄 动态配置

### 运行时配置

某些配置可以在运行时动态调整：

```javascript
// 临时调整批量大小
process.env.LLM_BATCH_SIZE = '25';

// 临时调整阈值
process.env.CRITICAL_FIELD_WEIGHT_THRESHOLD = '0.35';

// 处理文档
const result = await kgService.buildKnowledgeGraph(...);

// 恢复默认值
process.env.LLM_BATCH_SIZE = '20';
process.env.CRITICAL_FIELD_WEIGHT_THRESHOLD = '0.3';
```

### 配置优先级

1. 运行时参数（最高优先级）
2. 环境变量
3. 配置文件
4. 默认值（最低优先级）

---

## 📊 配置验证

### 验证脚本

```javascript
// scripts/validate-config.js
function validateConfig() {
  const errors = [];
  
  // 检查必需的环境变量
  if (!process.env.QWEN_API_KEY && !process.env.DEEPSEEK_API_KEY) {
    errors.push('缺少LLM API密钥');
  }
  
  // 检查数值范围
  const batchSize = parseInt(process.env.LLM_BATCH_SIZE) || 20;
  if (batchSize < 5 || batchSize > 50) {
    errors.push(`LLM_BATCH_SIZE超出范围: ${batchSize} (应在5-50之间)`);
  }
  
  const threshold = parseFloat(process.env.CRITICAL_FIELD_WEIGHT_THRESHOLD) || 0.3;
  if (threshold < 0.1 || threshold > 0.9) {
    errors.push(`CRITICAL_FIELD_WEIGHT_THRESHOLD超出范围: ${threshold} (应在0.1-0.9之间)`);
  }
  
  // 输出结果
  if (errors.length > 0) {
    console.error('配置验证失败:');
    errors.forEach(err => console.error(`  - ${err}`));
    process.exit(1);
  } else {
    console.log('✓ 配置验证通过');
  }
}

validateConfig();
```

运行验证：

```bash
node scripts/validate-config.js
```

---

## 🔍 配置调优指南

### 1. 优化Token消耗

**目标**: 降低Token消耗到5K以下

**调整**:
```env
LLM_BATCH_SIZE=30                      # 增加批量大小
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.4    # 提高阈值
```

**预期效果**: Token消耗 -20%

### 2. 优化处理速度

**目标**: 处理时间<5秒

**调整**:
```env
LLM_MAX_CONCURRENT=5                   # 增加并发
ENABLE_PARALLEL_ENTITY_BUILD=true      # 并行构建实体
ENABLE_SCHEMA_PREFILTER=true           # 启用预过滤
```

**预期效果**: 处理时间 -30%

### 3. 优化关系数量

**目标**: 关系数量>800

**调整**:
```env
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.2    # 降低阈值
LLM_BATCH_SIZE=15                      # 减小批量提高准确性
```

**预期效果**: 关系数量 +15%

### 4. 平衡成本和质量

**目标**: 在成本和质量间找到最佳平衡

**调整**:
```env
LLM_BATCH_SIZE=20                      # 标准批量
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.3    # 标准阈值
ENABLE_TOKEN_BUDGET=true               # 启用预算控制
DAILY_TOKEN_BUDGET=1000000             # 设置合理预算
```

---

## 📚 相关文档

- [API文档](./KG_API_DOCUMENTATION.md)
- [使用指南](./KG_RELATION_EXTRACTION_USER_GUIDE.md)
- [故障排查指南](./KG_TROUBLESHOOTING_GUIDE.md)
- [性能优化指南](./KG_PERFORMANCE_OPTIMIZATION_GUIDE.md)

---

**文档版本**: 1.0  
**创建日期**: 2026-02-11  
**维护者**: AI Knowledge Base Team
