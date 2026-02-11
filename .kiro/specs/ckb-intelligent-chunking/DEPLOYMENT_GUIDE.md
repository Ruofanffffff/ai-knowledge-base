# CKB智能分片与上下文优化 - 部署指南

## 目录

1. [概述](#概述)
2. [系统要求](#系统要求)
3. [配置指南](#配置指南)
4. [数据库迁移](#数据库迁移)
5. [部署步骤](#部署步骤)
6. [监控配置](#监控配置)
7. [性能调优](#性能调优)
8. [故障排查](#故障排查)
9. [回滚方案](#回滚方案)
10. [灰度发布策略](#灰度发布策略)

---

## 概述

CKB智能分片与上下文优化系统通过智能分片、精准上下文提取和证据定位，在保证准确性的前提下，大幅降低token消耗（目标：减少70-85%）和时延（目标：减少60-75%）。

### 核心组件

- **Chunk Manager**: 文档智能分片管理
- **Context Optimizer**: 上下文优化器
- **Relevance Scorer**: 相关性评分器
- **Evidence Locator**: 证据定位器
- **Token Monitor**: Token消耗监控
- **Accuracy Monitor**: 准确性监控
- **Latency Monitor**: 时延监控

### 优化效果

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| Token消耗 | 100% | 15-30% | 减少70-85% |
| 处理时延 | 100% | 25-40% | 减少60-75% |
| 准确性 | 100% | 98%+ | 保持 |

---

## 系统要求

### 硬件要求

**最低配置**:
- CPU: 4核
- 内存: 8GB
- 存储: 50GB SSD

**推荐配置**:
- CPU: 8核+
- 内存: 16GB+
- 存储: 100GB+ SSD

### 软件依赖

- **Node.js**: >= 16.x
- **数据库**: SQLite 3.x (开发) / PostgreSQL 13+ (生产)
- **LLM API**: OpenAI API / Qwen API
- **可选**: Redis (用于缓存)

### 网络要求

- LLM API访问（OpenAI/Qwen）
- 数据库连接
- 监控系统连接（可选）

---

## 配置指南

### 环境变量配置

创建或更新 `.env` 文件：

```bash
# ========================================
# CKB智能分片配置
# ========================================

# 启用/禁用智能分片
ENABLE_CKB_CHUNKING=true

# 分片策略: paragraph | sentence | semantic | fixed
CKB_CHUNKING_STRATEGY=paragraph

# 启用/禁用上下文优化
ENABLE_CONTEXT_OPTIMIZATION=true

# 上下文优化参数
MAX_CONTEXT_TOKENS=600
MIN_CONTEXT_CHUNKS=3
RELEVANCE_THRESHOLD=0.5

# 相关性评分方法: keyword | tfidf | semantic | hybrid
RELEVANCE_SCORING_METHOD=hybrid

# 启用/禁用证据定位
ENABLE_EVIDENCE_LOCALIZATION=true

# ========================================
# Token监控配置
# ========================================

# Token预算限制（每日）
TOKEN_BUDGET_LIMIT=1000000

# 告警阈值（0-1）
TOKEN_ALERT_THRESHOLD=0.8

# 启用Token日志
TOKEN_LOGGING_ENABLED=true

# 启用Token告警
TOKEN_ALERTING_ENABLED=true

# 模块级别预算
TOKEN_BUDGET_FIELD_EXTRACTION=300000
TOKEN_BUDGET_ENTITY_NAMING=200000
TOKEN_BUDGET_RELATION_EXTRACTION=300000

# ========================================
# 准确性监控配置
# ========================================

# 最大准确性下降（0-1）
ACCURACY_MAX_DROP=0.02

# 告警阈值
ACCURACY_WARNING_THRESHOLD=0.015

# 启用自动降级
ACCURACY_AUTO_DEGRADATION=true

# 降级阈值
ACCURACY_DEGRADATION_THRESHOLD=0.02

# 最小测试集大小
ACCURACY_MIN_TEST_SET_SIZE=10

# 启用准确性日志
ACCURACY_LOGGING_ENABLED=true

# 启用准确性告警
ACCURACY_ALERTING_ENABLED=true

# ========================================
# 时延监控配置
# ========================================

# 告警阈值（毫秒）
LATENCY_WARNING_THRESHOLD=5000
LATENCY_CRITICAL_THRESHOLD=10000

# 性能目标（毫秒）
LATENCY_TARGET_DOCUMENT=5000
LATENCY_TARGET_FIELD=2000
LATENCY_TARGET_ENTITY=1000
LATENCY_TARGET_RELATION=2000

# 启用时延日志
LATENCY_LOGGING_ENABLED=true

# 启用时延告警
LATENCY_ALERTING_ENABLED=true
```

### 运行时配置

创建配置文件 `kg/ckb/config.js`:

```javascript
module.exports = {
  chunking: {
    enabled: process.env.ENABLE_CKB_CHUNKING === 'true',
    strategy: process.env.CKB_CHUNKING_STRATEGY || 'paragraph',
    options: {
      paragraph: {
        minLength: 50,
        maxLength: 500
      },
      sentence: {
        minLength: 20,
        maxLength: 100
      },
      fixed: {
        chunkSize: 500,
        overlap: 50
      }
    }
  },
  contextOptimization: {
    enabled: process.env.ENABLE_CONTEXT_OPTIMIZATION === 'true',
    maxTokens: parseInt(process.env.MAX_CONTEXT_TOKENS) || 600,
    minChunks: parseInt(process.env.MIN_CONTEXT_CHUNKS) || 3,
    relevanceThreshold: parseFloat(process.env.RELEVANCE_THRESHOLD) || 0.5
  }
};
```

---

## 数据库迁移

### 迁移概述

CKB智能分片系统需要以下数据库表：

1. `kg_token_usage` - Token使用记录
2. `kg_accuracy_metric` - 准确性指标
3. `kg_latency_metric` - 时延指标
4. Evidence字段（Entity和Relation表）

### 迁移步骤

#### 1. 备份现有数据库

```bash
# SQLite备份
cp prisma/knowledge-base.db prisma/knowledge-base.db.backup

# PostgreSQL备份
pg_dump -U username -d database_name > backup.sql
```

#### 2. 运行Prisma迁移

```bash
# 生成迁移文件
npx prisma migrate dev --name add_ckb_monitoring_tables

# 应用迁移
npx prisma migrate deploy
```

#### 3. 验证迁移

```bash
# 检查表是否创建成功
npx prisma studio

# 或使用SQL查询
sqlite3 prisma/knowledge-base.db ".tables"
```

### 数据库Schema

#### Token Usage表

```sql
CREATE TABLE kg_token_usage (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  ckb_id TEXT,
  model_name TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_token_usage_module ON kg_token_usage(module);
CREATE INDEX idx_token_usage_created_at ON kg_token_usage(created_at);
```

#### Accuracy Metric表

```sql
CREATE TABLE kg_accuracy_metric (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  test_case_id TEXT NOT NULL,
  precision REAL NOT NULL,
  recall REAL NOT NULL,
  f1_score REAL NOT NULL,
  optimized BOOLEAN NOT NULL,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_accuracy_module ON kg_accuracy_metric(module);
CREATE INDEX idx_accuracy_optimized ON kg_accuracy_metric(optimized);
CREATE INDEX idx_accuracy_created_at ON kg_accuracy_metric(created_at);
```

#### Latency Metric表

```sql
CREATE TABLE kg_latency_metric (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  latency_ms INTEGER NOT NULL,
  optimized BOOLEAN NOT NULL,
  metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_latency_module ON kg_latency_metric(module);
CREATE INDEX idx_latency_optimized ON kg_latency_metric(optimized);
CREATE INDEX idx_latency_created_at ON kg_latency_metric(created_at);
```

#### Evidence字段（Entity表）

```sql
ALTER TABLE Entity ADD COLUMN evidence TEXT;
```

#### Evidence字段（Relation表）

```sql
ALTER TABLE Relation ADD COLUMN evidence TEXT;
```

### 现有CKB数据升级

如果系统中已有CKB数据，需要进行升级以支持智能分片：

#### 选项1：按需分片（推荐）

CKB在首次使用时自动分片，无需预处理。

```javascript
// 系统会自动处理
const chunks = await chunkManager.chunkCKB(ckb);
```

#### 选项2：批量预处理

对现有CKB进行批量分片：

```javascript
// scripts/migrate_existing_ckbs.js
const { ChunkManager } = require('../kg/ckb/chunk_manager');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const chunkManager = new ChunkManager();

async function migrateExistingCKBs() {
  const ckbs = await prisma.cKB.findMany();
  
  console.log(`Processing ${ckbs.length} CKBs...`);
  
  for (const ckb of ckbs) {
    try {
      // 分片CKB
      const chunks = await chunkManager.chunkCKB(ckb, {
        strategy: 'paragraph'
      });
      
      console.log(`✓ CKB ${ckb.ckb_id}: ${chunks.length} chunks`);
    } catch (error) {
      console.error(`✗ CKB ${ckb.ckb_id}: ${error.message}`);
    }
  }
  
  console.log('Migration complete!');
}

migrateExistingCKBs();
```

运行迁移：

```bash
node scripts/migrate_existing_ckbs.js
```

---

## 部署步骤

### 1. 准备阶段

#### 1.1 代码部署

```bash
# 拉取最新代码
git pull origin main

# 安装依赖
npm install

# 构建项目（如需要）
npm run build
```

#### 1.2 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置
nano .env
```

#### 1.3 数据库迁移

```bash
# 备份数据库
npm run db:backup

# 运行迁移
npx prisma migrate deploy

# 验证迁移
npm run db:verify
```

### 2. 测试阶段

#### 2.1 单元测试

```bash
# 运行所有测试
npm test

# 运行CKB相关测试
npm test -- kg/ckb

# 检查测试覆盖率
npm run test:coverage
```

#### 2.2 集成测试

```bash
# 运行集成测试
npm run test:integration

# 测试特定模块
npm test -- kg/ckb/chunk_manager.test.js
npm test -- kg/ckb/context_optimizer.test.js
npm test -- kg/ckb/evidence_locator.test.js
```

#### 2.3 性能测试

```bash
# 运行性能测试
npm run test:performance

# 测试token优化效果
node scripts/test_token_optimization.js

# 测试准确性
node scripts/test_accuracy.js
```

### 3. 部署阶段

#### 3.1 停止服务

```bash
# 停止现有服务
pm2 stop kg-service

# 或使用systemd
sudo systemctl stop kg-service
```

#### 3.2 启动服务

```bash
# 使用PM2启动
pm2 start server.js --name kg-service

# 或使用systemd
sudo systemctl start kg-service

# 检查服务状态
pm2 status
# 或
sudo systemctl status kg-service
```

#### 3.3 验证部署

```bash
# 检查服务健康状态
curl http://localhost:3000/health

# 检查监控端点
curl http://localhost:3000/api/monitoring/token-status
curl http://localhost:3000/api/monitoring/accuracy-status
curl http://localhost:3000/api/monitoring/latency-status

# 测试文档处理
curl -X POST http://localhost:3000/api/documents \
  -H "Content-Type: application/json" \
  -d @test_document.json
```

### 4. 监控阶段

#### 4.1 实时监控

```bash
# 查看日志
pm2 logs kg-service

# 查看监控指标
pm2 monit

# 查看Token使用情况
curl http://localhost:3000/api/monitoring/token-usage
```

#### 4.2 告警配置

配置告警通知（可选）：

```javascript
// kg/ckb/alert_handler.js
const { getTokenMonitor } = require('./token_monitor');
const { getAccuracyMonitor } = require('./accuracy_monitor');
const { getLatencyMonitor } = require('./latency_monitor');

// 定期检查告警
setInterval(async () => {
  const tokenAlerts = getTokenMonitor().getAlerts();
  const accuracyAlerts = getAccuracyMonitor().getAlerts();
  const latencyAlerts = getLatencyMonitor().getAlerts();
  
  const allAlerts = [...tokenAlerts, ...accuracyAlerts, ...latencyAlerts];
  
  if (allAlerts.length > 0) {
    // 发送告警通知（邮件、Slack、钉钉等）
    await sendAlertNotification(allAlerts);
  }
}, 60000); // 每分钟检查一次
```

---

## 监控配置

### Token监控

#### 初始化Token Monitor

```javascript
const { getTokenMonitor } = require('./kg/ckb/token_monitor');

const monitor = getTokenMonitor({
  budgetLimit: 1000000,
  alertThreshold: 0.8
});
```

#### 集成到LLM调用

```javascript
async function callLLMWithMonitoring(prompt, options = {}) {
  const startTokens = estimateTokens(prompt);
  
  const response = await llmClient.call(prompt, options);
  
  const outputTokens = estimateTokens(response);
  
  await monitor.recordUsage({
    module: options.module || 'unknown',
    ckbId: options.ckbId,
    modelName: options.model || 'gpt-3.5-turbo',
    inputTokens: startTokens,
    outputTokens: outputTokens,
    optimized: options.optimized || false,
    baselineTokens: options.baselineTokens
  });
  
  return response;
}
```

#### 查看Token使用情况

```javascript
// 获取预算状态
const status = monitor.getBudgetStatus();
console.log('Token usage:', status);

// 获取告警
const alerts = monitor.getAlerts();
if (alerts.length > 0) {
  console.warn('Budget alerts:', alerts);
}

// 获取统计数据
const stats = await monitor.getUsageStats({
  startDate: '2025-01-01',
  endDate: '2025-01-31'
});
console.log('Monthly usage:', stats);
```

### 准确性监控

#### 初始化Accuracy Monitor

```javascript
const { getAccuracyMonitor } = require('./kg/ckb/accuracy_monitor');

const monitor = getAccuracyMonitor({
  maxAccuracyDrop: 0.02,
  autoDegradationEnabled: true
});
```

#### 运行准确性测试

```javascript
async function runAccuracyTest() {
  const testCases = await loadTestCases();
  
  for (const testCase of testCases) {
    // 测试baseline
    const baselineResult = await extractFields(testCase.ckb.content.text);
    const baselineMetrics = calculateMetrics(baselineResult, testCase.groundTruth);
    
    await monitor.recordAccuracy({
      module: 'field_extraction',
      testCaseId: testCase.id,
      metrics: baselineMetrics,
      optimized: false
    });
    
    // 测试optimized
    const { context } = await optimizer.optimizeForFieldExtraction(testCase.ckb);
    const optimizedResult = await extractFields(context);
    const optimizedMetrics = calculateMetrics(optimizedResult, testCase.groundTruth);
    
    await monitor.recordAccuracy({
      module: 'field_extraction',
      testCaseId: testCase.id,
      metrics: optimizedMetrics,
      optimized: true
    });
  }
  
  // 检查结果
  const status = monitor.getAccuracyStatus();
  console.log('Accuracy status:', status);
  
  // 检查是否需要降级
  if (monitor.isDegraded('field_extraction')) {
    console.warn('Auto-degradation triggered for field_extraction');
  }
}
```

### 时延监控

#### 初始化Latency Monitor

```javascript
const { getLatencyMonitor } = require('./kg/ckb/latency_monitor');

const monitor = getLatencyMonitor({
  warningThreshold: 5000,
  criticalThreshold: 10000
});
```

#### 跟踪操作时延

```javascript
async function processDocumentWithLatencyTracking(document) {
  const timerId = monitor.startTimer('process_document', {
    module: 'document_processing',
    optimized: true
  });
  
  try {
    const result = await processDocument(document);
    await monitor.stopTimer(timerId);
    return result;
  } catch (error) {
    await monitor.stopTimer(timerId, {
      metadata: { error: error.message }
    });
    throw error;
  }
}
```

---

## 性能调优

### Token优化调优

#### 1. 调整上下文窗口大小

```bash
# 更激进的优化（更少token，可能影响准确性）
MAX_CONTEXT_TOKENS=400
MIN_CONTEXT_CHUNKS=2

# 更保守的优化（更多token，更高准确性）
MAX_CONTEXT_TOKENS=800
MIN_CONTEXT_CHUNKS=4
```

#### 2. 调整相关性阈值

```bash
# 更严格的相关性要求（更少chunks）
RELEVANCE_THRESHOLD=0.7

# 更宽松的相关性要求（更多chunks）
RELEVANCE_THRESHOLD=0.3
```

#### 3. 选择评分方法

```bash
# 快速但不太准确
RELEVANCE_SCORING_METHOD=keyword

# 平衡速度和准确性
RELEVANCE_SCORING_METHOD=hybrid

# 最准确但较慢（需要embedding）
RELEVANCE_SCORING_METHOD=semantic
```

### 准确性调优

#### 1. 调整降级阈值

```bash
# 更严格的准确性要求
ACCURACY_DEGRADATION_THRESHOLD=0.01  # 1%

# 更宽松的准确性要求
ACCURACY_DEGRADATION_THRESHOLD=0.03  # 3%
```

#### 2. 调整测试集大小

```bash
# 更大的测试集（更可靠的统计）
ACCURACY_MIN_TEST_SET_SIZE=20

# 更小的测试集（更快的反馈）
ACCURACY_MIN_TEST_SET_SIZE=5
```

### 时延优化

#### 1. 并行处理

```javascript
// 并行处理多个CKB
const results = await Promise.all(
  ckbs.map(ckb => processDocument(ckb))
);
```

#### 2. 缓存优化

```javascript
// 启用chunk缓存
const chunkManager = new ChunkManager({
  enableCache: true,
  cacheSize: 1000
});

// 启用相关性评分缓存
const relevanceScorer = new RelevanceScorer({
  enableCache: true,
  cacheTTL: 3600
});
```

#### 3. 数据库优化

```sql
-- 添加索引
CREATE INDEX idx_token_usage_module_date ON kg_token_usage(module, created_at);
CREATE INDEX idx_accuracy_module_optimized ON kg_accuracy_metric(module, optimized);
CREATE INDEX idx_latency_module_optimized ON kg_latency_metric(module, optimized);

-- 定期清理旧数据
DELETE FROM kg_token_usage WHERE created_at < datetime('now', '-30 days');
DELETE FROM kg_accuracy_metric WHERE created_at < datetime('now', '-30 days');
DELETE FROM kg_latency_metric WHERE created_at < datetime('now', '-30 days');
```

### 分片策略选择

#### 按文档类型选择策略

```javascript
function selectChunkingStrategy(document) {
  // 结构化文档（有明显段落）
  if (document.hasStructure) {
    return 'paragraph';
  }
  
  // 长文本无明显结构
  if (document.length > 5000 && !document.hasStructure) {
    return 'semantic';
  }
  
  // 短文本
  if (document.length < 1000) {
    return 'sentence';
  }
  
  // 默认
  return 'paragraph';
}
```

---

## 故障排查

### 常见问题

#### 1. Token消耗未减少

**症状**: Token使用量与优化前相同

**可能原因**:
- 上下文优化未启用
- 相关性阈值过低
- 文档太短，无法分片

**解决方案**:

```bash
# 检查配置
echo $ENABLE_CONTEXT_OPTIMIZATION  # 应该是 true

# 检查日志
grep "optimization_ratio" logs/app.log

# 调整阈值
RELEVANCE_THRESHOLD=0.5
MAX_CONTEXT_TOKENS=600
```

#### 2. 准确性下降过多

**症状**: F1分数下降超过2%

**可能原因**:
- 上下文窗口太小
- 相关性阈值太高
- 分片策略不适合文档类型

**解决方案**:

```bash
# 增加上下文窗口
MAX_CONTEXT_TOKENS=800
MIN_CONTEXT_CHUNKS=4

# 降低相关性阈值
RELEVANCE_THRESHOLD=0.3

# 检查自动降级状态
curl http://localhost:3000/api/monitoring/accuracy-status
```

#### 3. 自动降级频繁触发

**症状**: 系统频繁回退到全文模式

**可能原因**:
- 降级阈值设置过严格
- 测试集不够代表性
- 优化参数需要调整

**解决方案**:

```bash
# 放宽降级阈值
ACCURACY_DEGRADATION_THRESHOLD=0.03

# 增加测试集大小
ACCURACY_MIN_TEST_SET_SIZE=20

# 手动重置降级状态
curl -X POST http://localhost:3000/api/monitoring/reset-degradation
```

#### 4. 时延增加

**症状**: 处理时间比优化前更长

**可能原因**:
- 分片开销过大
- 相关性评分计算慢
- 数据库查询慢

**解决方案**:

```bash
# 启用缓存
ENABLE_CHUNK_CACHE=true
ENABLE_RELEVANCE_CACHE=true

# 优化数据库
npm run db:optimize

# 使用更快的评分方法
RELEVANCE_SCORING_METHOD=keyword
```

#### 5. 内存使用过高

**症状**: 服务器内存占用持续增长

**可能原因**:
- Chunk缓存过大
- 监控数据未清理
- 内存泄漏

**解决方案**:

```bash
# 限制缓存大小
CHUNK_CACHE_SIZE=1000
RELEVANCE_CACHE_SIZE=500

# 定期清理监控数据
node scripts/cleanup_monitoring_data.js

# 重启服务
pm2 restart kg-service
```

### 调试工具

#### 1. 查看优化效果

```javascript
// scripts/analyze_optimization.js
const { getTokenMonitor } = require('../kg/ckb/token_monitor');

async function analyzeOptimization() {
  const monitor = getTokenMonitor();
  
  const stats = await monitor.getUsageStats({
    startDate: '2025-01-01',
    endDate: '2025-01-31'
  });
  
  console.log('Token Optimization Analysis:');
  console.log('Total tokens:', stats.totalTokens);
  console.log('Total cost:', stats.totalCost);
  console.log('By module:', stats.byModule);
  
  // 计算节省比例
  const baseline = stats.byModule.baseline || 0;
  const optimized = stats.byModule.optimized || 0;
  const savings = baseline > 0 ? (1 - optimized / baseline) * 100 : 0;
  
  console.log(`Token savings: ${savings.toFixed(1)}%`);
}

analyzeOptimization();
```

#### 2. 测试单个文档

```javascript
// scripts/test_single_document.js
const { ContextOptimizer } = require('../kg/ckb/context_optimizer');
const { ChunkManager } = require('../kg/ckb/chunk_manager');

async function testDocument(ckb) {
  const chunkManager = new ChunkManager();
  const optimizer = new ContextOptimizer();
  
  // 分片
  const chunks = await chunkManager.chunkCKB(ckb);
  console.log(`Chunks: ${chunks.length}`);
  
  // 优化
  const result = await optimizer.optimizeForFieldExtraction(ckb);
  console.log(`Optimized context: ${result.token_count} tokens`);
  console.log(`Original: ${estimateTokens(ckb.content.text)} tokens`);
  console.log(`Savings: ${(result.optimization_ratio * 100).toFixed(1)}%`);
}
```

---

## 回滚方案

### 快速回滚

如果优化系统出现严重问题，可以快速回滚到全文模式：

#### 方法1：环境变量回滚

```bash
# 禁用所有优化
ENABLE_CKB_CHUNKING=false
ENABLE_CONTEXT_OPTIMIZATION=false
ENABLE_EVIDENCE_LOCALIZATION=false

# 重启服务
pm2 restart kg-service
```

#### 方法2：代码回滚

```bash
# 回滚到上一个版本
git revert HEAD
git push origin main

# 重新部署
npm install
pm2 restart kg-service
```

#### 方法3：数据库回滚

```bash
# 恢复数据库备份
cp prisma/knowledge-base.db.backup prisma/knowledge-base.db

# 或PostgreSQL
psql -U username -d database_name < backup.sql
```

### 渐进式回滚

如果只有部分功能有问题，可以选择性禁用：

```bash
# 只禁用上下文优化，保留分片和证据定位
ENABLE_CONTEXT_OPTIMIZATION=false

# 只禁用自动降级
ACCURACY_AUTO_DEGRADATION=false

# 只禁用某个模块的优化
# 在代码中添加模块级别的开关
```

### 回滚验证

```bash
# 检查服务状态
curl http://localhost:3000/health

# 验证功能正常
npm run test:integration

# 检查日志
pm2 logs kg-service --lines 100
```

---

## 灰度发布策略

### 阶段1：10%流量测试（1周）

#### 配置流量分流

```javascript
// middleware/feature_flag.js
function shouldUseOptimization(req) {
  // 基于用户ID的哈希分流
  const userId = req.user?.id || 'anonymous';
  const hash = hashCode(userId);
  return (hash % 100) < 10; // 10%流量
}

// 在路由中使用
app.post('/api/documents', async (req, res) => {
  const useOptimization = shouldUseOptimization(req);
  
  const result = await processDocument(req.body, {
    enableOptimization: useOptimization
  });
  
  res.json(result);
});
```

#### 监控指标

```javascript
// 每天检查以下指标
const metrics = {
  tokenSavings: '70-85%',
  latencyImprovement: '60-75%',
  accuracyDrop: '<2%',
  errorRate: '<1%',
  userComplaints: 0
};

// 如果任何指标不达标，暂停灰度
if (metrics.accuracyDrop > 0.02 || metrics.errorRate > 0.01) {
  console.warn('Metrics not meeting targets, pausing rollout');
  // 回滚到0%
}
```

### 阶段2：50%流量测试（1周）

```javascript
function shouldUseOptimization(req) {
  const userId = req.user?.id || 'anonymous';
  const hash = hashCode(userId);
  return (hash % 100) < 50; // 50%流量
}
```

#### 持续监控

```bash
# 每小时检查监控指标
*/60 * * * * curl http://localhost:3000/api/monitoring/summary

# 每天生成报告
0 0 * * * node scripts/generate_daily_report.js
```

### 阶段3：100%全量上线

```javascript
function shouldUseOptimization(req) {
  return true; // 100%流量
}

// 或直接移除特性开关
```

#### 上线后监控

```bash
# 持续监控1周
# 每天检查：
# - Token节省率
# - 准确性指标
# - 时延改善
# - 错误率
# - 用户反馈

# 如果稳定运行1周，视为上线成功
```

### 紧急回滚触发条件

立即回滚到0%的条件：

1. **准确性下降 > 5%**
2. **错误率 > 5%**
3. **服务不可用 > 5分钟**
4. **严重用户投诉 > 10个**
5. **Token消耗反而增加**

```javascript
// 自动回滚脚本
async function checkRollbackConditions() {
  const status = await getSystemStatus();
  
  if (status.accuracyDrop > 0.05 ||
      status.errorRate > 0.05 ||
      status.downtime > 300000 ||
      status.complaints > 10) {
    
    console.error('Emergency rollback triggered!');
    await rollbackToZeroPercent();
    await notifyTeam('Emergency rollback executed');
  }
}
```

---

## 附录

### A. 配置参数完整列表

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `ENABLE_CKB_CHUNKING` | boolean | true | 启用CKB分片 |
| `CKB_CHUNKING_STRATEGY` | string | paragraph | 分片策略 |
| `ENABLE_CONTEXT_OPTIMIZATION` | boolean | true | 启用上下文优化 |
| `MAX_CONTEXT_TOKENS` | number | 600 | 最大上下文token数 |
| `MIN_CONTEXT_CHUNKS` | number | 3 | 最小chunk数 |
| `RELEVANCE_THRESHOLD` | number | 0.5 | 相关性阈值 |
| `RELEVANCE_SCORING_METHOD` | string | hybrid | 评分方法 |
| `ENABLE_EVIDENCE_LOCALIZATION` | boolean | true | 启用证据定位 |
| `TOKEN_BUDGET_LIMIT` | number | 1000000 | Token预算限制 |
| `TOKEN_ALERT_THRESHOLD` | number | 0.8 | Token告警阈值 |
| `ACCURACY_MAX_DROP` | number | 0.02 | 最大准确性下降 |
| `ACCURACY_AUTO_DEGRADATION` | boolean | true | 启用自动降级 |
| `LATENCY_WARNING_THRESHOLD` | number | 5000 | 时延告警阈值(ms) |
| `LATENCY_CRITICAL_THRESHOLD` | number | 10000 | 时延严重阈值(ms) |

### B. API端点列表

#### 监控端点

```
GET  /api/monitoring/token-status      - Token使用状态
GET  /api/monitoring/token-usage       - Token使用统计
GET  /api/monitoring/accuracy-status   - 准确性状态
GET  /api/monitoring/latency-status    - 时延状态
GET  /api/monitoring/summary           - 综合监控摘要
POST /api/monitoring/reset-degradation - 重置降级状态
```

#### 证据端点

```
GET /api/entities/:id/context          - 获取实体上下文
GET /api/relations/:id/context         - 获取关系上下文
GET /api/entities/:id/evidence-chain   - 获取实体证据链
GET /api/relations/:id/evidence-chain  - 获取关系证据链
```

### C. 性能基准

#### Token消耗基准

| 场景 | 优化前 | 优化后 | 节省 |
|------|--------|--------|------|
| 字段提取（单CKB） | 2000-4000 | 300-600 | 70-85% |
| 实体名称生成 | 500-1000 | 100-200 | 75-80% |
| 关系抽取（单CKB） | 1500-3000 | 300-600 | 75-80% |
| 批量处理（10个CKB） | 20000-40000 | 3000-6000 | 80-85% |

#### 时延基准

| 场景 | 优化前 | 优化后 | 改善 |
|------|--------|--------|------|
| 单文档处理 | 10-15秒 | 3-5秒 | 60-70% |
| 批量处理（10文档） | 100-150秒 | 30-50秒 | 65-75% |

#### 准确性基准

| 指标 | 优化前 | 优化后（最低要求） |
|------|--------|-------------------|
| 字段提取F1 | 0.85 | 0.83 (≥98%) |
| 实体识别F1 | 0.80 | 0.78 (≥98%) |
| 关系抽取F1 | 0.75 | 0.73 (≥98%) |

### D. 故障排查清单

#### 部署前检查

- [ ] 环境变量配置正确
- [ ] 数据库迁移成功
- [ ] 所有测试通过
- [ ] 备份已创建
- [ ] 监控系统就绪

#### 部署后检查

- [ ] 服务正常启动
- [ ] 健康检查通过
- [ ] 监控端点可访问
- [ ] Token使用正常
- [ ] 准确性符合预期
- [ ] 时延改善明显
- [ ] 无错误日志

#### 运行时监控

- [ ] Token节省率 > 70%
- [ ] 准确性下降 < 2%
- [ ] 时延改善 > 60%
- [ ] 错误率 < 1%
- [ ] 无告警触发

### E. 联系方式

如遇到问题，请联系：

- **技术支持**: support@example.com
- **紧急联系**: +86-xxx-xxxx-xxxx
- **文档**: https://docs.example.com/ckb-optimization
- **GitHub Issues**: https://github.com/example/kg-system/issues

---

## 总结

本部署指南涵盖了CKB智能分片与上下文优化系统的完整部署流程，包括：

1. ✅ 系统要求和依赖
2. ✅ 详细的配置指南
3. ✅ 数据库迁移步骤
4. ✅ 完整的部署流程
5. ✅ 监控配置和使用
6. ✅ 性能调优建议
7. ✅ 故障排查方案
8. ✅ 回滚策略
9. ✅ 灰度发布计划

遵循本指南，可以安全、稳定地部署CKB优化系统，实现70-85%的token节省和60-75%的时延改善，同时保持98%+的准确性。

**祝部署顺利！** 🚀
