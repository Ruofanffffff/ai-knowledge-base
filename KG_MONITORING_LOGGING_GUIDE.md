# 知识图谱监控与日志指南

## 📋 文档概述

本文档涵盖任务16.1和16.2的监控指标和日志优化方案。

**相关任务**:
- 16.1 添加性能监控指标（所有子任务）
- 16.2 优化日志输出

---

## 📊 任务16.1: 添加性能监控指标

### 16.1.1 字段提取时间监控

#### 实施方案

```javascript
// kg/services/metrics_collector.js
class MetricsCollector {
  constructor() {
    this.metrics = {
      fieldExtraction: {
        totalTime: 0,
        ruleTime: 0,
        nerTime: 0,
        llmTime: 0,
        count: 0
      }
    };
  }
  
  recordFieldExtraction(stage, duration) {
    this.metrics.fieldExtraction[`${stage}Time`] += duration;
    if (stage === 'total') {
      this.metrics.fieldExtraction.count++;
    }
  }
  
  getFieldExtractionMetrics() {
    const m = this.metrics.fieldExtraction;
    return {
      avgTotalTime: m.count > 0 ? (m.totalTime / m.count).toFixed(2) : 0,
      avgRuleTime: m.count > 0 ? (m.ruleTime / m.count).toFixed(2) : 0,
      avgNerTime: m.count > 0 ? (m.nerTime / m.count).toFixed(2) : 0,
      avgLlmTime: m.count > 0 ? (m.llmTime / m.count).toFixed(2) : 0,
      totalCount: m.count
    };
  }
}
```

#### 使用示例

```javascript
// kg/field_extractor/schema_aware_extractor.js
async extractFields(ckb, schemas, options = {}) {
  const startTime = Date.now();
  
  // 规则提取
  const ruleStart = Date.now();
  const ruleFields = await this.ruleExtractor.extract(ckb.content.text);
  metricsCollector.recordFieldExtraction('rule', Date.now() - ruleStart);
  
  // NER提取
  const nerStart = Date.now();
  const nerFields = await this.nerExtractor.extract(ckb.content.text);
  metricsCollector.recordFieldExtraction('ner', Date.now() - nerStart);
  
  // LLM提取（如需要）
  if (needsLLM) {
    const llmStart = Date.now();
    const llmFields = await this.llmExtractor.extract(...);
    metricsCollector.recordFieldExtraction('llm', Date.now() - llmStart);
  }
  
  metricsCollector.recordFieldExtraction('total', Date.now() - startTime);
  
  return mergedFields;
}
```

### 16.1.2 LLM调用次数和延迟监控

#### 实施方案

```javascript
class MetricsCollector {
  constructor() {
    this.metrics = {
      llm: {
        totalCalls: 0,
        successCalls: 0,
        failedCalls: 0,
        totalLatency: 0,
        minLatency: Infinity,
        maxLatency: 0,
        timeouts: 0,
        retries: 0
      }
    };
  }
  
  recordLLMCall(success, latency, isRetry = false, isTimeout = false) {
    const m = this.metrics.llm;
    
    m.totalCalls++;
    if (success) m.successCalls++;
    else m.failedCalls++;
    
    if (latency) {
      m.totalLatency += latency;
      m.minLatency = Math.min(m.minLatency, latency);
      m.maxLatency = Math.max(m.maxLatency, latency);
    }
    
    if (isRetry) m.retries++;
    if (isTimeout) m.timeouts++;
  }
  
  getLLMMetrics() {
    const m = this.metrics.llm;
    return {
      totalCalls: m.totalCalls,
      successRate: m.totalCalls > 0 ? 
        ((m.successCalls / m.totalCalls) * 100).toFixed(1) : 0,
      avgLatency: m.successCalls > 0 ? 
        (m.totalLatency / m.successCalls).toFixed(0) : 0,
      minLatency: m.minLatency === Infinity ? 0 : m.minLatency,
      maxLatency: m.maxLatency,
      timeoutRate: m.totalCalls > 0 ? 
        ((m.timeouts / m.totalCalls) * 100).toFixed(1) : 0,
      retryRate: m.totalCalls > 0 ? 
        ((m.retries / m.totalCalls) * 100).toFixed(1) : 0
    };
  }
}
```

### 16.1.3 Token消耗监控

#### 实施方案

```javascript
class MetricsCollector {
  constructor() {
    this.metrics = {
      tokens: {
        totalInput: 0,
        totalOutput: 0,
        totalCost: 0,
        byDocument: new Map()
      }
    };
  }
  
  recordTokenUsage(docId, inputTokens, outputTokens, cost) {
    const m = this.metrics.tokens;
    
    m.totalInput += inputTokens;
    m.totalOutput += outputTokens;
    m.totalCost += cost;
    
    if (!m.byDocument.has(docId)) {
      m.byDocument.set(docId, {
        input: 0,
        output: 0,
        cost: 0
      });
    }
    
    const doc = m.byDocument.get(docId);
    doc.input += inputTokens;
    doc.output += outputTokens;
    doc.cost += cost;
  }
  
  getTokenMetrics() {
    const m = this.metrics.tokens;
    const docCount = m.byDocument.size;
    
    return {
      totalInput: m.totalInput,
      totalOutput: m.totalOutput,
      totalTokens: m.totalInput + m.totalOutput,
      totalCost: m.totalCost.toFixed(2),
      avgPerDocument: docCount > 0 ? 
        Math.round((m.totalInput + m.totalOutput) / docCount) : 0,
      avgCostPerDocument: docCount > 0 ? 
        (m.totalCost / docCount).toFixed(2) : 0
    };
  }
}
```

### 16.1.4 关系构建成功率监控

#### 实施方案

```javascript
class MetricsCollector {
  constructor() {
    this.metrics = {
      relations: {
        attempted: 0,
        successful: 0,
        failed: 0,
        byType: new Map()
      }
    };
  }
  
  recordRelationBuild(relationType, success) {
    const m = this.metrics.relations;
    
    m.attempted++;
    if (success) m.successful++;
    else m.failed++;
    
    if (!m.byType.has(relationType)) {
      m.byType.set(relationType, {
        attempted: 0,
        successful: 0
      });
    }
    
    const type = m.byType.get(relationType);
    type.attempted++;
    if (success) type.successful++;
  }
  
  getRelationMetrics() {
    const m = this.metrics.relations;
    
    const byType = {};
    m.byType.forEach((stats, type) => {
      byType[type] = {
        attempted: stats.attempted,
        successful: stats.successful,
        successRate: ((stats.successful / stats.attempted) * 100).toFixed(1)
      };
    });
    
    return {
      totalAttempted: m.attempted,
      totalSuccessful: m.successful,
      totalFailed: m.failed,
      successRate: m.attempted > 0 ? 
        ((m.successful / m.attempted) * 100).toFixed(1) : 0,
      byType: byType
    };
  }
}
```

### 监控指标汇总

```javascript
// kg/services/metrics_collector.js
class MetricsCollector {
  // ... 上述所有方法 ...
  
  // 生成完整报告
  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      fieldExtraction: this.getFieldExtractionMetrics(),
      llm: this.getLLMMetrics(),
      tokens: this.getTokenMetrics(),
      relations: this.getRelationMetrics()
    };
  }
  
  // 打印报告
  printReport() {
    const report = this.generateReport();
    
    console.log('\n========== 性能监控报告 ==========');
    console.log(`时间: ${report.timestamp}`);
    
    console.log('\n【字段提取】');
    console.log(`  平均总时间: ${report.fieldExtraction.avgTotalTime}ms`);
    console.log(`  - 规则提取: ${report.fieldExtraction.avgRuleTime}ms`);
    console.log(`  - NER提取: ${report.fieldExtraction.avgNerTime}ms`);
    console.log(`  - LLM提取: ${report.fieldExtraction.avgLlmTime}ms`);
    console.log(`  处理数量: ${report.fieldExtraction.totalCount}`);
    
    console.log('\n【LLM调用】');
    console.log(`  总调用次数: ${report.llm.totalCalls}`);
    console.log(`  成功率: ${report.llm.successRate}%`);
    console.log(`  平均延迟: ${report.llm.avgLatency}ms`);
    console.log(`  延迟范围: ${report.llm.minLatency}ms - ${report.llm.maxLatency}ms`);
    console.log(`  超时率: ${report.llm.timeoutRate}%`);
    console.log(`  重试率: ${report.llm.retryRate}%`);
    
    console.log('\n【Token消耗】');
    console.log(`  总输入: ${report.tokens.totalInput}`);
    console.log(`  总输出: ${report.tokens.totalOutput}`);
    console.log(`  总计: ${report.tokens.totalTokens}`);
    console.log(`  总成本: $${report.tokens.totalCost}`);
    console.log(`  平均/文档: ${report.tokens.avgPerDocument} tokens`);
    console.log(`  平均成本/文档: $${report.tokens.avgCostPerDocument}`);
    
    console.log('\n【关系构建】');
    console.log(`  尝试构建: ${report.relations.totalAttempted}`);
    console.log(`  成功: ${report.relations.totalSuccessful}`);
    console.log(`  失败: ${report.relations.totalFailed}`);
    console.log(`  成功率: ${report.relations.successRate}%`);
    
    console.log('\n==================================\n');
  }
}

// 导出单例
module.exports = new MetricsCollector();
```

---

## 📝 任务16.2: 优化日志输出

### 日志级别定义

```javascript
// kg/utils/logger.js
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4
};

class Logger {
  constructor() {
    this.level = LOG_LEVELS[process.env.LOG_LEVEL] || LOG_LEVELS.INFO;
    this.enableColors = process.env.LOG_COLORS !== 'false';
  }
  
  debug(message, ...args) {
    if (this.level <= LOG_LEVELS.DEBUG) {
      console.debug(this.format('DEBUG', message), ...args);
    }
  }
  
  info(message, ...args) {
    if (this.level <= LOG_LEVELS.INFO) {
      console.log(this.format('INFO', message), ...args);
    }
  }
  
  warn(message, ...args) {
    if (this.level <= LOG_LEVELS.WARN) {
      console.warn(this.format('WARN', message), ...args);
    }
  }
  
  error(message, ...args) {
    if (this.level <= LOG_LEVELS.ERROR) {
      console.error(this.format('ERROR', message), ...args);
    }
  }
  
  format(level, message) {
    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level}]`;
    
    if (this.enableColors) {
      const colors = {
        DEBUG: '\x1b[36m',  // Cyan
        INFO: '\x1b[32m',   // Green
        WARN: '\x1b[33m',   // Yellow
        ERROR: '\x1b[31m'   // Red
      };
      const reset = '\x1b[0m';
      return `${colors[level]}${prefix}${reset} ${message}`;
    }
    
    return `${prefix} ${message}`;
  }
}

module.exports = new Logger();
```

### 结构化日志

```javascript
// kg/utils/structured_logger.js
class StructuredLogger {
  log(level, component, action, data = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: level,
      component: component,
      action: action,
      ...data
    };
    
    if (process.env.LOG_FORMAT === 'json') {
      console.log(JSON.stringify(logEntry));
    } else {
      const message = `[${component}] ${action}`;
      const details = Object.keys(data).length > 0 ? 
        JSON.stringify(data) : '';
      
      switch(level) {
        case 'DEBUG':
          logger.debug(message, details);
          break;
        case 'INFO':
          logger.info(message, details);
          break;
        case 'WARN':
          logger.warn(message, details);
          break;
        case 'ERROR':
          logger.error(message, details);
          break;
      }
    }
  }
  
  // 便捷方法
  debug(component, action, data) {
    this.log('DEBUG', component, action, data);
  }
  
  info(component, action, data) {
    this.log('INFO', component, action, data);
  }
  
  warn(component, action, data) {
    this.log('WARN', component, action, data);
  }
  
  error(component, action, data) {
    this.log('ERROR', component, action, data);
  }
}

module.exports = new StructuredLogger();
```

### 使用示例

```javascript
// kg/services/kg_service.js
const logger = require('../utils/structured_logger');

async function buildKnowledgeGraph(docId, filePath, fileType, options = {}) {
  logger.info('KGService', 'StartBuild', {
    docId: docId,
    fileType: fileType
  });
  
  try {
    // ... 处理逻辑 ...
    
    logger.info('KGService', 'BuildComplete', {
      docId: docId,
      entities: result.entities_created,
      relations: result.relations_created.builtin,
      duration: result.processing_time
    });
    
    return result;
    
  } catch (error) {
    logger.error('KGService', 'BuildFailed', {
      docId: docId,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}
```

### 日志配置

```env
# 日志配置
LOG_LEVEL=INFO              # DEBUG, INFO, WARN, ERROR, NONE
LOG_FORMAT=text             # text, json
LOG_COLORS=true             # 启用颜色输出
LOG_FILE=logs/kg.log        # 日志文件路径（可选）
```

---

## 📈 监控仪表板（可选）

### 简单的Web仪表板

```javascript
// kg/monitoring/dashboard.js
const express = require('express');
const metricsCollector = require('../services/metrics_collector');

const app = express();

app.get('/metrics', (req, res) => {
  const report = metricsCollector.generateReport();
  res.json(report);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

app.listen(3001, () => {
  console.log('监控仪表板运行在 http://localhost:3001');
});
```

### Prometheus集成（可选）

```javascript
// kg/monitoring/prometheus.js
const client = require('prom-client');

// 创建指标
const fieldExtractionDuration = new client.Histogram({
  name: 'kg_field_extraction_duration_ms',
  help: '字段提取耗时（毫秒）',
  labelNames: ['stage']
});

const llmCallsTotal = new client.Counter({
  name: 'kg_llm_calls_total',
  help: 'LLM调用总次数',
  labelNames: ['status']
});

const tokenUsageTotal = new client.Counter({
  name: 'kg_token_usage_total',
  help: 'Token使用总量',
  labelNames: ['type']
});

// 导出指标
module.exports = {
  fieldExtractionDuration,
  llmCallsTotal,
  tokenUsageTotal,
  register: client.register
};
```

---

## 📚 相关文档

- [性能优化指南](./KG_PERFORMANCE_OPTIMIZATION_GUIDE.md)
- [配置指南](./KG_LLM_FIELD_EXTRACTION_CONFIG.md)

---

**文档版本**: 1.0  
**创建日期**: 2026-02-11  
**维护者**: AI Knowledge Base Team
