# 知识图谱故障排查指南

## 📋 文档概述

本文档涵盖任务17.4的故障排查指南，提供常见问题的诊断和解决方案。

**版本**: 1.0  
**最后更新**: 2026-02-11

---

## 🚨 常见问题

### 问题1: LLM调用失败

#### 症状

```
[LLM Extractor] Batch 1 failed: Request failed with status 401
```

#### 可能原因

1. API密钥无效或过期
2. API密钥权限不足
3. 网络连接问题

#### 诊断步骤

```bash
# 1. 检查环境变量
echo $QWEN_API_KEY

# 2. 测试API连接
curl -X POST https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation \
  -H "Authorization: Bearer $QWEN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen-turbo","input":{"messages":[{"role":"user","content":"测试"}]}}'

# 3. 检查网络连接
ping dashscope.aliyuncs.com
```

#### 解决方案

**方案1**: 更新API密钥
```env
# .env
QWEN_API_KEY=your_new_api_key_here
```

**方案2**: 切换LLM提供商
```env
# 使用DeepSeek替代
DEEPSEEK_API_KEY=your_deepseek_key
```

**方案3**: 配置代理
```env
HTTP_PROXY=http://proxy.example.com:8080
HTTPS_PROXY=http://proxy.example.com:8080
```

---

### 问题2: Token消耗过高

#### 症状

```
[Budget] 超出日预算: 1200000/1000000
Token消耗: 12K/文档 (目标: <5K)
```

#### 可能原因

1. 批量大小太小
2. 触发阈值太低
3. 文本未正确截断

#### 诊断步骤

```javascript
// 检查当前配置
console.log('LLM_BATCH_SIZE:', process.env.LLM_BATCH_SIZE);
console.log('CRITICAL_FIELD_WEIGHT_THRESHOLD:', process.env.CRITICAL_FIELD_WEIGHT_THRESHOLD);

// 检查实际Token使用
const report = metricsCollector.generateReport();
console.log('Token使用:', report.tokens);
```

#### 解决方案

**方案1**: 增加批量大小
```env
LLM_BATCH_SIZE=30  # 从20增加到30
```
**预期效果**: Token消耗 -20%

**方案2**: 提高触发阈值
```env
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.4  # 从0.3提高到0.4
```
**预期效果**: Token消耗 -25%

**方案3**: 检查文本截断
```javascript
// kg/field_extractor/llm_extractor.js
// 确保文本被正确截断
const maxLength = 100;
const truncatedText = text.length > maxLength ? 
  text.substring(0, maxLength) + '...' : text;
```

---

### 问题3: 关系数量不足

#### 症状

```
创建了 15 个关系 (目标: >50)
关系构建成功率: 25%
```

#### 可能原因

1. LLM未启用
2. 触发阈值太高
3. Schema配置不足
4. 字段提取不准确

#### 诊断步骤

```javascript
// 1. 检查LLM是否启用
console.log('ENABLE_LLM_FIELD_EXTRACTION:', process.env.ENABLE_LLM_FIELD_EXTRACTION);

// 2. 检查LLM调用统计
const report = metricsCollector.generateReport();
console.log('LLM调用占比:', report.llm.totalCalls);

// 3. 检查字段提取结果
console.log('提取的字段:', ckb.extracted_fields);

// 4. 检查Schema数量
const schemas = await prisma.schema.findMany();
console.log('Schema数量:', schemas.length);
```

#### 解决方案

**方案1**: 启用LLM
```env
ENABLE_LLM_FIELD_EXTRACTION=true
```

**方案2**: 降低触发阈值
```env
CRITICAL_FIELD_WEIGHT_THRESHOLD=0.2  # 从0.3降低到0.2
```
**预期效果**: 关系数量 +30%

**方案3**: 检查Schema配置
```bash
# 运行schema验证脚本
node scripts/verify-schemas.js

# 如果schema不足，重新创建
node scripts/create-domain-schemas.js
```

**方案4**: 检查关系类型初始化
```bash
# 初始化90种关系类型
node kg/relation/init_relation_types.js
```

---

### 问题4: 处理速度慢

#### 症状

```
处理时间: 65s (目标: <30s)
```

#### 可能原因

1. 并发数太低
2. Schema数量太多未预过滤
3. 批量大小太小
4. 数据库查询慢

#### 诊断步骤

```javascript
// 1. 分析时间分布
const startTime = Date.now();

// 字段提取
const t1 = Date.now();
await extractFields(...);
console.log('字段提取:', Date.now() - t1, 'ms');

// 实体构建
const t2 = Date.now();
await buildEntities(...);
console.log('实体构建:', Date.now() - t2, 'ms');

// 关系构建
const t3 = Date.now();
await buildRelations(...);
console.log('关系构建:', Date.now() - t3, 'ms');

console.log('总时间:', Date.now() - startTime, 'ms');
```

#### 解决方案

**方案1**: 增加并发数
```env
LLM_MAX_CONCURRENT=5  # 从3增加到5
```
**预期效果**: 处理时间 -20%

**方案2**: 启用Schema预过滤
```env
ENABLE_SCHEMA_PREFILTER=true
SCHEMA_PREFILTER_THRESHOLD=50
```
**预期效果**: 处理时间 -40%（如果schema>50个）

**方案3**: 增加批量大小
```env
LLM_BATCH_SIZE=25  # 从20增加到25
```
**预期效果**: 处理时间 -10%

**方案4**: 优化数据库查询
```javascript
// 使用批量查询替代单个查询
const entities = await prisma.entity.findMany({
  where: { id: { in: entityIds } }
});
```

---

### 问题5: 内存占用过高

#### 症状

```
Error: JavaScript heap out of memory
```

#### 可能原因

1. 批量处理太大
2. 缓存未清理
3. 内存泄漏

#### 诊断步骤

```bash
# 监控内存使用
node --max-old-space-size=4096 --trace-gc your-script.js

# 使用内存分析工具
node --inspect your-script.js
```

#### 解决方案

**方案1**: 减小批量大小
```env
FIELD_EXTRACTION_BATCH_SIZE=10  # 从20减小到10
LLM_BATCH_SIZE=15  # 从20减小到15
```

**方案2**: 增加Node.js内存限制
```bash
node --max-old-space-size=8192 your-script.js
```

**方案3**: 清理缓存
```javascript
// 定期清理缓存
setInterval(() => {
  cacheManager.clear();
}, 3600000); // 每小时清理一次
```

---

### 问题6: 数据库连接错误

#### 症状

```
Error: Can't reach database server
PrismaClientInitializationError
```

#### 可能原因

1. 数据库未启动
2. 连接字符串错误
3. 网络问题
4. 连接池耗尽

#### 诊断步骤

```bash
# 1. 检查数据库状态
pg_isready -h localhost -p 5432

# 2. 测试连接
psql -h localhost -U user -d ai_knowledge_base

# 3. 检查环境变量
echo $DATABASE_URL
```

#### 解决方案

**方案1**: 启动数据库
```bash
# PostgreSQL
sudo systemctl start postgresql

# Docker
docker start postgres-container
```

**方案2**: 修正连接字符串
```env
DATABASE_URL=postgresql://user:password@localhost:5432/ai_knowledge_base
```

**方案3**: 增加连接池大小
```env
DB_POOL_MAX=20  # 从10增加到20
```

---

## 🔍 诊断工具

### 1. 健康检查脚本

```javascript
// scripts/health-check.js
async function healthCheck() {
  console.log('=== 系统健康检查 ===\n');
  
  // 1. 检查环境变量
  console.log('【环境变量】');
  console.log('✓ ENABLE_LLM_FIELD_EXTRACTION:', process.env.ENABLE_LLM_FIELD_EXTRACTION);
  console.log('✓ LLM_BATCH_SIZE:', process.env.LLM_BATCH_SIZE);
  console.log('✓ LLM_MAX_CONCURRENT:', process.env.LLM_MAX_CONCURRENT);
  
  // 2. 检查数据库连接
  console.log('\n【数据库连接】');
  try {
    await prisma.$connect();
    console.log('✓ 数据库连接正常');
  } catch (error) {
    console.log('✗ 数据库连接失败:', error.message);
  }
  
  // 3. 检查LLM API
  console.log('\n【LLM API】');
  try {
    const result = await llmClient.chat({
      messages: [{ role: 'user', content: '测试' }]
    });
    console.log('✓ LLM API正常');
  } catch (error) {
    console.log('✗ LLM API失败:', error.message);
  }
  
  // 4. 检查Schema
  console.log('\n【Schema】');
  const schemas = await prisma.schema.findMany();
  console.log(`✓ 加载了 ${schemas.length} 个schemas`);
  
  // 5. 检查关系类型
  console.log('\n【关系类型】');
  const relationTypes = await prisma.relationType.findMany();
  console.log(`✓ 加载了 ${relationTypes.length} 个关系类型`);
  
  console.log('\n=== 检查完成 ===');
}

healthCheck().catch(console.error);
```

运行健康检查：

```bash
node scripts/health-check.js
```

### 2. 性能分析脚本

```javascript
// scripts/performance-analysis.js
async function analyzePerformance(docId) {
  console.log('=== 性能分析 ===\n');
  
  const startTime = Date.now();
  
  // 分段计时
  const timings = {};
  
  // 1. 文档解析
  let t = Date.now();
  const ckbs = await parseDocument(...);
  timings.parsing = Date.now() - t;
  
  // 2. 文档分类
  t = Date.now();
  const classification = await classifier.classify(...);
  timings.classification = Date.now() - t;
  
  // 3. Schema过滤
  t = Date.now();
  const schemas = await filterSchemas(...);
  timings.schemaFilter = Date.now() - t;
  
  // 4. 字段提取
  t = Date.now();
  await extractFields(...);
  timings.fieldExtraction = Date.now() - t;
  
  // 5. 实体构建
  t = Date.now();
  await buildEntities(...);
  timings.entityBuild = Date.now() - t;
  
  // 6. 关系构建
  t = Date.now();
  await buildRelations(...);
  timings.relationBuild = Date.now() - t;
  
  const totalTime = Date.now() - startTime;
  
  // 输出分析结果
  console.log('时间分布:');
  Object.entries(timings).forEach(([step, time]) => {
    const percentage = ((time / totalTime) * 100).toFixed(1);
    console.log(`  ${step}: ${time}ms (${percentage}%)`);
  });
  
  console.log(`\n总时间: ${totalTime}ms`);
  
  // 识别瓶颈
  const bottleneck = Object.entries(timings)
    .sort((a, b) => b[1] - a[1])[0];
  console.log(`\n⚠️  瓶颈: ${bottleneck[0]} (${bottleneck[1]}ms)`);
}
```

### 3. Token使用分析

```javascript
// scripts/token-analysis.js
async function analyzeTokenUsage(docId) {
  console.log('=== Token使用分析 ===\n');
  
  const report = metricsCollector.generateReport();
  
  console.log('Token统计:');
  console.log(`  总输入: ${report.tokens.totalInput}`);
  console.log(`  总输出: ${report.tokens.totalOutput}`);
  console.log(`  总计: ${report.tokens.totalTokens}`);
  console.log(`  成本: $${report.tokens.totalCost}`);
  
  console.log('\nLLM调用统计:');
  console.log(`  总调用: ${report.llm.totalCalls}`);
  console.log(`  成功率: ${report.llm.successRate}%`);
  console.log(`  平均延迟: ${report.llm.avgLatency}ms`);
  
  // 计算优化潜力
  const currentBatchSize = parseInt(process.env.LLM_BATCH_SIZE) || 20;
  const potentialSavings = report.tokens.totalTokens * 0.2; // 假设可节省20%
  
  console.log('\n优化建议:');
  if (report.tokens.totalTokens > 8000) {
    console.log(`  ⚠️  Token消耗较高 (${report.tokens.totalTokens})`);
    console.log(`  建议: 增加批量大小到 ${currentBatchSize + 5}`);
    console.log(`  预期节省: ${potentialSavings.toFixed(0)} tokens`);
  } else {
    console.log('  ✓ Token消耗在合理范围内');
  }
}
```

---

## 📊 监控告警

### 设置告警阈值

```javascript
// kg/monitoring/alerts.js
const ALERT_THRESHOLDS = {
  processingTime: 45000,      // 45秒
  tokenUsage: 10000,          // 10K tokens
  llmCallRatio: 0.15,         // 15%
  relationCount: 30,          // 30个关系
  errorRate: 0.1              // 10%错误率
};

function checkAlerts(result) {
  const alerts = [];
  
  if (result.processing_time > ALERT_THRESHOLDS.processingTime) {
    alerts.push({
      level: 'WARNING',
      message: `处理时间过长: ${result.processing_time}ms`
    });
  }
  
  if (result.llm_enhancement) {
    const ratio = result.llm_enhancement.ckbs_processed / result.ckbs_created;
    if (ratio > ALERT_THRESHOLDS.llmCallRatio) {
      alerts.push({
        level: 'WARNING',
        message: `LLM调用占比过高: ${(ratio * 100).toFixed(1)}%`
      });
    }
  }
  
  if (result.relations_created.builtin < ALERT_THRESHOLDS.relationCount) {
    alerts.push({
      level: 'ERROR',
      message: `关系数量不足: ${result.relations_created.builtin}`
    });
  }
  
  return alerts;
}
```

---

## 📚 相关文档

- [API文档](./KG_API_DOCUMENTATION.md)
- [配置指南](./KG_CONFIGURATION_GUIDE.md)
- [使用指南](./KG_RELATION_EXTRACTION_USER_GUIDE.md)
- [性能优化指南](./KG_PERFORMANCE_OPTIMIZATION_GUIDE.md)

---

## 🆘 获取帮助

如果以上方案无法解决问题，请：

1. 收集以下信息：
   - 错误日志
   - 环境变量配置
   - 系统信息（Node版本、OS等）
   - 重现步骤

2. 运行诊断脚本：
   ```bash
   node scripts/health-check.js > health-report.txt
   node scripts/performance-analysis.js > perf-report.txt
   ```

3. 联系技术支持团队，提供上述信息

---

**文档版本**: 1.0  
**创建日期**: 2026-02-11  
**维护者**: AI Knowledge Base Team
