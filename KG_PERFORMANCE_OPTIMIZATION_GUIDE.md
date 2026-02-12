# 知识图谱性能优化指南

## 📋 文档概述

本文档涵盖任务14.2、14.4、14.5、15.3、15.4的优化建议和实施方案。

**相关任务**:
- 14.2 优化规则提取速度
- 14.4 添加缓存机制
- 14.5 优化并发策略
- 15.3 调整LLM触发阈值
- 15.4 实施token预算管理

---

## 🚀 任务14.2: 优化规则提取速度

### 当前状态

规则提取器性能良好，处理241个CKB耗时约2秒（每个CKB约8ms）。

### 优化建议

#### 1. 预编译正则表达式

**当前问题**: 每次调用都重新编译正则表达式

**优化方案**:
```javascript
// kg/field_extractor/rule_extractor.js
class RuleExtractor {
  constructor() {
    // 预编译常用正则表达式
    this.patterns = {
      date: /\d{4}年\d{1,2}月\d{1,2}日/g,
      location: /(?:位于|在)([^，。]+(?:省|市|区|县))/g,
      organization: /([^，。]{2,20}(?:公司|企业|单位|机构|部门))/g,
      project: /([^，。]{4,30}项目)/g,
      amount: /(\d+(?:\.\d+)?(?:万|亿|元))/g
    };
  }
  
  extractFields(text, requiredFields = []) {
    // 使用预编译的正则表达式
    const fields = [];
    
    if (this.shouldExtract('时间', requiredFields)) {
      const matches = text.match(this.patterns.date);
      if (matches) {
        fields.push({ name: '时间', value: matches[0], type: 'date' });
      }
    }
    
    // ... 其他字段提取
    
    return fields;
  }
}
```

**预期效果**: 提升10-15%的提取速度

#### 2. 智能字段过滤

**当前问题**: 提取所有可能的字段，即使不需要

**优化方案**:
```javascript
shouldExtract(fieldName, requiredFields) {
  // 如果没有指定需求，提取所有字段
  if (!requiredFields || requiredFields.length === 0) {
    return true;
  }
  
  // 只提取需要的字段
  return requiredFields.some(f => 
    f.name === fieldName || 
    (f.aliases && f.aliases.includes(fieldName))
  );
}
```

**预期效果**: 减少30-40%的不必要计算

#### 3. 文本预处理缓存

**优化方案**:
```javascript
class RuleExtractor {
  constructor() {
    this.preprocessCache = new Map();
  }
  
  preprocessText(text) {
    const cacheKey = text.substring(0, 100); // 使用前100字符作为key
    
    if (this.preprocessCache.has(cacheKey)) {
      return this.preprocessCache.get(cacheKey);
    }
    
    const processed = {
      normalized: text.replace(/\s+/g, ''),
      sentences: text.split(/[。！？]/),
      length: text.length
    };
    
    this.preprocessCache.set(cacheKey, processed);
    return processed;
  }
}
```

**预期效果**: 减少20%的重复预处理时间

### 实施优先级

1. ⭐⭐⭐ 预编译正则表达式（高优先级，简单实施）
2. ⭐⭐⭐ 智能字段过滤（高优先级，已部分实现）
3. ⭐⭐ 文本预处理缓存（中优先级，需要测试缓存命中率）

---

## 💾 任务14.4: 添加缓存机制

### 当前状态

已实施schema匹配缓存和字段归一化缓存，但缓存命中率较低（<5%）。

### 优化建议

#### 1. 智能缓存策略

**问题分析**: 
- 每个CKB的字段组合都不同，导致缓存命中率低
- 缓存key生成过于精确

**优化方案**:
```javascript
// kg/services/cache_manager.js
class CacheManager {
  constructor() {
    this.schemaCache = new Map();
    this.fieldCache = new LRUCache({ max: 1000, ttl: 3600000 }); // 1小时
    this.extractionCache = new LRUCache({ max: 500, ttl: 1800000 }); // 30分钟
  }
  
  // Schema缓存（长期有效）
  getSchema(schemaId) {
    return this.schemaCache.get(schemaId);
  }
  
  setSchema(schemaId, schema) {
    this.schemaCache.set(schemaId, schema);
  }
  
  // 字段提取缓存（基于文本哈希）
  getExtractedFields(textHash, strategy) {
    const key = `${textHash}_${strategy}`;
    return this.fieldCache.get(key);
  }
  
  setExtractedFields(textHash, strategy, fields) {
    const key = `${textHash}_${strategy}`;
    this.fieldCache.set(key, fields);
  }
  
  // 生成文本哈希（快速哈希算法）
  hashText(text) {
    let hash = 0;
    for (let i = 0; i < Math.min(text.length, 200); i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}
```

#### 2. 分层缓存策略

**L1缓存**: Schema定义（永久缓存）
```javascript
// 应用启动时加载所有schemas
const schemaCache = await loadAllSchemas();
```

**L2缓存**: 规则提取结果（1小时TTL）
```javascript
// 基于文本哈希缓存规则提取结果
const cacheKey = cacheManager.hashText(text);
const cached = cacheManager.getExtractedFields(cacheKey, 'rule');
if (cached) return cached;
```

**L3缓存**: LLM提取结果（30分钟TTL）
```javascript
// 缓存LLM提取结果（成本高，缓存时间短）
const cacheKey = cacheManager.hashText(text);
const cached = cacheManager.getExtractedFields(cacheKey, 'llm');
if (cached) return cached;
```

#### 3. 缓存预热

**优化方案**:
```javascript
// scripts/warm-cache.js
async function warmCache() {
  console.log('预热缓存...');
  
  // 1. 加载所有schemas
  const schemas = await prisma.schema.findMany();
  schemas.forEach(schema => {
    cacheManager.setSchema(schema.id, schema);
  });
  console.log(`✓ 缓存了 ${schemas.length} 个schemas`);
  
  // 2. 加载常用关系类型
  const relationTypes = await prisma.relationType.findMany();
  relationTypes.forEach(rt => {
    cacheManager.setRelationType(rt.id, rt);
  });
  console.log(`✓ 缓存了 ${relationTypes.length} 个关系类型`);
  
  // 3. 预编译正则表达式
  ruleExtractor.compilePatterns();
  console.log('✓ 预编译了正则表达式');
  
  console.log('缓存预热完成！');
}

// 应用启动时调用
warmCache().catch(console.error);
```

### 实施优先级

1. ⭐⭐⭐ Schema缓存（高优先级，效果显著）
2. ⭐⭐ 缓存预热（中优先级，改善启动性能）
3. ⭐ 字段提取缓存（低优先级，命中率低）

---

## ⚡ 任务14.5: 优化并发策略

### 当前状态

LLM调用使用p-queue控制并发（最大3个），效果良好。

### 优化建议

#### 1. 动态并发控制

**当前问题**: 固定并发数，无法适应不同负载

**优化方案**:
```javascript
// kg/field_extractor/concurrent_controller.js
class ConcurrentController {
  constructor() {
    this.maxConcurrent = parseInt(process.env.LLM_MAX_CONCURRENT) || 3;
    this.currentConcurrent = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.avgLatency = 0;
  }
  
  // 动态调整并发数
  adjustConcurrency() {
    const errorRate = this.failureCount / (this.successCount + this.failureCount);
    
    // 错误率高，降低并发
    if (errorRate > 0.1 && this.maxConcurrent > 1) {
      this.maxConcurrent--;
      console.log(`[Concurrent] 降低并发到 ${this.maxConcurrent}`);
    }
    
    // 错误率低且延迟低，提高并发
    if (errorRate < 0.05 && this.avgLatency < 1000 && this.maxConcurrent < 10) {
      this.maxConcurrent++;
      console.log(`[Concurrent] 提高并发到 ${this.maxConcurrent}`);
    }
  }
  
  // 记录请求结果
  recordResult(success, latency) {
    if (success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }
    
    // 更新平均延迟
    this.avgLatency = (this.avgLatency * 0.9) + (latency * 0.1);
    
    // 每10次请求调整一次
    if ((this.successCount + this.failureCount) % 10 === 0) {
      this.adjustConcurrency();
    }
  }
}
```

#### 2. 智能批量分组

**优化方案**:
```javascript
// kg/field_extractor/batch_optimizer.js
class BatchOptimizer {
  // 根据CKB复杂度智能分组
  optimizeBatches(ckbs, batchSize) {
    // 按文本长度和缺失字段数量排序
    const sorted = ckbs.sort((a, b) => {
      const scoreA = a.content.text.length + a._missingCriticalFields.length * 100;
      const scoreB = b.content.text.length + b._missingCriticalFields.length * 100;
      return scoreA - scoreB;
    });
    
    const batches = [];
    let currentBatch = [];
    let currentComplexity = 0;
    const maxComplexity = batchSize * 150; // 平均每个CKB 150复杂度
    
    for (const ckb of sorted) {
      const complexity = ckb.content.text.length + ckb._missingCriticalFields.length * 100;
      
      if (currentComplexity + complexity > maxComplexity && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentComplexity = 0;
      }
      
      currentBatch.push(ckb);
      currentComplexity += complexity;
    }
    
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }
    
    return batches;
  }
}
```

#### 3. 失败重试策略

**优化方案**:
```javascript
// kg/field_extractor/retry_strategy.js
class RetryStrategy {
  constructor() {
    this.maxRetries = 3;
    this.baseDelay = 1000; // 1秒
  }
  
  async executeWithRetry(fn, context) {
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        const result = await fn();
        const latency = Date.now() - startTime;
        
        // 记录成功
        context.controller.recordResult(true, latency);
        return result;
        
      } catch (error) {
        lastError = error;
        
        // 记录失败
        context.controller.recordResult(false, 0);
        
        // 最后一次尝试，不再重试
        if (attempt === this.maxRetries - 1) {
          break;
        }
        
        // 指数退避
        const delay = this.baseDelay * Math.pow(2, attempt);
        console.log(`[Retry] 尝试 ${attempt + 1}/${this.maxRetries} 失败，${delay}ms后重试`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }
}
```

### 实施优先级

1. ⭐⭐ 失败重试策略（中优先级，提高稳定性）
2. ⭐⭐ 智能批量分组（中优先级，优化资源利用）
3. ⭐ 动态并发控制（低优先级，复杂度高）

---

## 🎯 任务15.3: 调整LLM触发阈值

### 当前状态

当前阈值为0.3，LLM调用占比5.4%，效果良好。

### 优化建议

#### 1. 自适应阈值

**优化方案**:
```javascript
// kg/field_extractor/adaptive_threshold.js
class AdaptiveThreshold {
  constructor() {
    this.baseThreshold = 0.3;
    this.currentThreshold = 0.3;
    this.targetLLMRatio = 0.08; // 目标8%
    this.adjustmentRate = 0.05;
  }
  
  // 根据实际LLM调用比例调整阈值
  adjustThreshold(actualLLMRatio, relationCount, targetRelationCount) {
    // 如果LLM调用过多，提高阈值
    if (actualLLMRatio > this.targetLLMRatio * 1.2) {
      this.currentThreshold += this.adjustmentRate;
      console.log(`[Threshold] LLM调用过多(${(actualLLMRatio*100).toFixed(1)}%)，提高阈值到 ${this.currentThreshold.toFixed(2)}`);
    }
    
    // 如果关系数量不足，降低阈值
    if (relationCount < targetRelationCount * 0.8) {
      this.currentThreshold -= this.adjustmentRate;
      console.log(`[Threshold] 关系数量不足(${relationCount}/${targetRelationCount})，降低阈值到 ${this.currentThreshold.toFixed(2)}`);
    }
    
    // 限制阈值范围
    this.currentThreshold = Math.max(0.2, Math.min(0.5, this.currentThreshold));
    
    return this.currentThreshold;
  }
  
  // 获取当前阈值
  getThreshold() {
    return this.currentThreshold;
  }
}
```

#### 2. 分场景阈值

**优化方案**:
```javascript
// 根据文档类型使用不同阈值
const thresholdByDocType = {
  '项目文档': 0.3,  // 项目文档字段较规范，使用标准阈值
  '商业文档': 0.25, // 商业文档字段多样，降低阈值
  '政务文档': 0.35, // 政务文档字段规范，提高阈值
  '技术文档': 0.4,  // 技术文档字段标准，提高阈值
  'default': 0.3
};

function getThresholdForDocument(classification) {
  const docType = classification.entityTypes[0] || 'default';
  return thresholdByDocType[docType] || thresholdByDocType.default;
}
```

#### 3. 字段级阈值

**优化方案**:
```javascript
// 不同字段使用不同阈值
const fieldThresholds = {
  '地点': 0.2,      // 地点很重要，低阈值
  '时间': 0.2,      // 时间很重要，低阈值
  '项目名称': 0.1,  // 项目名称最重要，最低阈值
  '单位': 0.3,      // 单位中等重要
  '金额': 0.3,      // 金额中等重要
  'default': 0.3
};

function shouldExtractField(field, extractedFields) {
  const threshold = fieldThresholds[field.name] || fieldThresholds.default;
  
  // 如果字段已提取，跳过
  if (extractedFields.some(f => f.name === field.name)) {
    return false;
  }
  
  // 检查字段权重是否超过阈值
  return field.weight >= threshold || field.required;
}
```

### 实施优先级

1. ⭐⭐⭐ 分场景阈值（高优先级，简单有效）
2. ⭐⭐ 字段级阈值（中优先级，精细控制）
3. ⭐ 自适应阈值（低优先级，复杂度高）

---

## 💰 任务15.4: 实施token预算管理

### 当前状态

Token消耗约6.7K/文档，无预算控制机制。

### 优化建议

#### 1. Token预算系统

**优化方案**:
```javascript
// kg/services/token_budget_manager.js
class TokenBudgetManager {
  constructor() {
    this.dailyBudget = parseInt(process.env.DAILY_TOKEN_BUDGET) || 1000000; // 1M tokens/天
    this.documentBudget = parseInt(process.env.DOCUMENT_TOKEN_BUDGET) || 8000; // 8K tokens/文档
    this.usedToday = 0;
    this.lastResetDate = new Date().toDateString();
  }
  
  // 检查是否可以使用tokens
  canUseTokens(estimatedTokens) {
    this.resetIfNewDay();
    
    // 检查日预算
    if (this.usedToday + estimatedTokens > this.dailyBudget) {
      console.warn(`[Budget] 超出日预算: ${this.usedToday + estimatedTokens}/${this.dailyBudget}`);
      return false;
    }
    
    // 检查文档预算
    if (estimatedTokens > this.documentBudget) {
      console.warn(`[Budget] 超出文档预算: ${estimatedTokens}/${this.documentBudget}`);
      return false;
    }
    
    return true;
  }
  
  // 记录token使用
  recordUsage(tokens) {
    this.usedToday += tokens;
    console.log(`[Budget] 使用 ${tokens} tokens，今日已用 ${this.usedToday}/${this.dailyBudget}`);
  }
  
  // 每日重置
  resetIfNewDay() {
    const today = new Date().toDateString();
    if (today !== this.lastResetDate) {
      console.log(`[Budget] 新的一天，重置预算。昨日使用: ${this.usedToday} tokens`);
      this.usedToday = 0;
      this.lastResetDate = today;
    }
  }
  
  // 获取剩余预算
  getRemainingBudget() {
    this.resetIfNewDay();
    return {
      daily: this.dailyBudget - this.usedToday,
      dailyPercentage: ((this.dailyBudget - this.usedToday) / this.dailyBudget * 100).toFixed(1)
    };
  }
}
```

#### 2. Token估算

**优化方案**:
```javascript
// kg/services/token_estimator.js
class TokenEstimator {
  // 估算文本的token数量（简化版）
  estimateTokens(text) {
    // 中文：约1.5字符/token
    // 英文：约4字符/token
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const otherChars = text.length - chineseChars;
    
    return Math.ceil(chineseChars / 1.5 + otherChars / 4);
  }
  
  // 估算批量提取的token消耗
  estimateBatchTokens(batch, missingFieldsMap) {
    let totalTokens = 0;
    
    // System message
    totalTokens += 50;
    
    // 每个CKB的prompt
    batch.forEach(item => {
      const textTokens = this.estimateTokens(item.ckb.content.text.substring(0, 100));
      const fieldTokens = item.missingFields.length * 5;
      totalTokens += textTokens + fieldTokens + 20; // 20 for formatting
    });
    
    // 响应JSON
    const responseTokens = batch.length * 50; // 每个CKB约50 tokens响应
    totalTokens += responseTokens;
    
    return totalTokens;
  }
}
```

#### 3. 预算告警

**优化方案**:
```javascript
// kg/services/budget_monitor.js
class BudgetMonitor {
  constructor(budgetManager) {
    this.budgetManager = budgetManager;
    this.alertThresholds = [0.5, 0.75, 0.9]; // 50%, 75%, 90%
    this.alertedLevels = new Set();
  }
  
  checkAndAlert() {
    const remaining = this.budgetManager.getRemainingBudget();
    const usageRatio = 1 - (remaining.daily / this.budgetManager.dailyBudget);
    
    for (const threshold of this.alertThresholds) {
      if (usageRatio >= threshold && !this.alertedLevels.has(threshold)) {
        this.sendAlert(threshold, remaining);
        this.alertedLevels.add(threshold);
      }
    }
    
    // 新的一天重置告警
    if (usageRatio < 0.1) {
      this.alertedLevels.clear();
    }
  }
  
  sendAlert(threshold, remaining) {
    const percentage = (threshold * 100).toFixed(0);
    console.warn(`⚠️  [Budget Alert] 已使用 ${percentage}% 的日预算！剩余: ${remaining.daily} tokens`);
    
    // 可以发送邮件、Slack通知等
    // sendEmailAlert(...)
    // sendSlackAlert(...)
  }
}
```

### 环境变量配置

```env
# Token预算配置
DAILY_TOKEN_BUDGET=1000000        # 日预算：1M tokens
DOCUMENT_TOKEN_BUDGET=8000        # 文档预算：8K tokens
ENABLE_TOKEN_BUDGET=true          # 启用预算控制
TOKEN_BUDGET_ALERT_EMAIL=admin@example.com
```

### 实施优先级

1. ⭐⭐⭐ Token预算系统（高优先级，成本控制）
2. ⭐⭐ Token估算（中优先级，预算准确性）
3. ⭐⭐ 预算告警（中优先级，及时发现问题）

---

## 📊 综合优化效果预估

### 优化前（当前）

| 指标 | 值 |
|------|---|
| 处理时间 | 6.51s |
| Token消耗 | 6,678 |
| LLM调用占比 | 5.4% |
| 关系数量 | 723 |

### 优化后（预估）

| 指标 | 当前值 | 预估值 | 改进 |
|------|--------|--------|------|
| 处理时间 | 6.51s | 5.5s | -15% |
| Token消耗 | 6,678 | 5,500 | -18% |
| LLM调用占比 | 5.4% | 4.5% | -17% |
| 关系数量 | 723 | 700-750 | 稳定 |
| 成本控制 | 无 | 有预算 | ✅ |

### 实施路线图

**第一阶段**（1周）：
- ✅ 预编译正则表达式
- ✅ Schema缓存
- ✅ 分场景阈值

**第二阶段**（1周）：
- ✅ Token预算系统
- ✅ Token估算
- ✅ 失败重试策略

**第三阶段**（可选）：
- 动态并发控制
- 自适应阈值
- 智能批量分组

---

## 📚 相关文档

- [知识图谱优化最终报告](./KG_OPTIMIZATION_FINAL_REPORT.md)
- [LLM字段提取配置指南](./KG_LLM_FIELD_EXTRACTION_CONFIG.md)
- [使用指南](./KG_RELATION_EXTRACTION_USER_GUIDE.md)

---

**文档版本**: 1.0  
**创建日期**: 2026-02-11  
**维护者**: AI Knowledge Base Team
