# Token Monitoring Guide

## Overview

The Token Monitor tracks and manages token consumption for the CKB Intelligent Chunking system. It provides:
- Real-time token usage tracking
- Budget management and alerting
- Cost calculation
- Usage statistics and reporting
- Optimization metrics

## Quick Start

### Basic Usage

```javascript
const { getTokenMonitor } = require('./token_monitor');

// Get monitor instance
const monitor = getTokenMonitor({
  budgetLimit: 1000000,  // 1M tokens per day
  alertThreshold: 0.8     // Alert at 80%
});

// Record token usage
await monitor.recordUsage({
  module: 'field_extraction',
  ckbId: 'ckb_123',
  modelName: 'gpt-3.5-turbo',
  inputTokens: 500,
  outputTokens: 100,
  optimized: true,
  baselineTokens: 2000  // For comparison
});

// Check budget status
const status = monitor.getBudgetStatus();
console.log(`Used: ${status.used} / ${status.budgetLimit} tokens`);
console.log(`Savings: ${(status.savingsRatio * 100).toFixed(1)}%`);

// Get alerts
const alerts = monitor.getAlerts();
if (alerts.length > 0) {
  console.warn('Active alerts:', alerts);
}
```

### Integration with Context Optimizer

```javascript
const { ContextOptimizer } = require('./context_optimizer');
const { getTokenMonitor } = require('./token_monitor');

const optimizer = new ContextOptimizer();
const monitor = getTokenMonitor();

async function optimizeAndTrack(ckb, options) {
  // Optimize context
  const result = await optimizer.optimizeForFieldExtraction(ckb, options);
  
  // Calculate baseline (full text)
  const baselineTokens = estimateTokens(ckb.content.text);
  
  // Record usage
  await monitor.recordUsage({
    module: 'field_extraction',
    ckbId: ckb.ckb_id,
    modelName: 'gpt-3.5-turbo',
    inputTokens: result.token_count,
    outputTokens: 100, // Estimated
    optimized: true,
    baselineTokens
  });
  
  return result;
}
```

## Configuration

### Environment Variables

```bash
# Budget limit (tokens per day)
TOKEN_BUDGET_LIMIT=1000000

# Alert threshold (0-1)
TOKEN_ALERT_THRESHOLD=0.8

# Enable/disable features
TOKEN_LOGGING_ENABLED=true
TOKEN_ALERTING_ENABLED=true

# Module-specific budgets
TOKEN_BUDGET_FIELD_EXTRACTION=300000
TOKEN_BUDGET_ENTITY_NAMING=200000
TOKEN_BUDGET_RELATION_EXTRACTION=300000

# Alert notifications
ALERT_EMAIL_ENABLED=false
ALERT_EMAIL_RECIPIENTS=admin@example.com
ALERT_WEBHOOK_ENABLED=false
ALERT_WEBHOOK_URL=https://hooks.example.com/alerts

# Statistics retention
TOKEN_STATS_DETAILED_DAYS=30
TOKEN_STATS_AGGREGATED_DAYS=365
```

### Configuration File

```javascript
// kg/ckb/token_monitor_config.js
module.exports = {
  budgetLimit: 1000000,
  alertThreshold: 0.8,
  enableLogging: true,
  enableAlerting: true,
  pricing: {
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-3.5-turbo': { input: 0.0015, output: 0.002 }
  }
};
```

## Features

### 1. Token Usage Recording

Record every LLM call with detailed metrics:

```javascript
await monitor.recordUsage({
  module: 'field_extraction',      // Module name
  ckbId: 'ckb_123',                // Optional: CKB ID
  modelName: 'gpt-3.5-turbo',      // LLM model
  inputTokens: 500,                // Prompt tokens
  outputTokens: 100,               // Completion tokens
  optimized: true,                 // Whether optimized
  baselineTokens: 2000             // Baseline for comparison
});
```

### 2. Budget Management

Track daily token budget:

```javascript
const status = monitor.getBudgetStatus();

console.log({
  budgetLimit: status.budgetLimit,
  used: status.used,
  remaining: status.remaining,
  usagePercent: status.usagePercent,
  isOverBudget: status.isOverBudget,
  isNearLimit: status.isNearLimit,
  byModule: status.byModule
});
```

### 3. Alerting

Automatic alerts when approaching or exceeding budget:

```javascript
// Get active alerts
const alerts = monitor.getAlerts();

alerts.forEach(alert => {
  console.log({
    type: alert.type,           // 'budget_warning' | 'budget_exceeded'
    severity: alert.severity,   // 'warning' | 'critical'
    message: alert.message,
    timestamp: alert.timestamp
  });
});

// Clear alerts
monitor.clearAlerts();
```

### 4. Usage Statistics

Query historical usage data:

```javascript
// Get stats for date range
const stats = await monitor.getUsageStats({
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  module: 'field_extraction',  // Optional: filter by module
  groupBy: 'module'            // 'module' | 'date' | 'model'
});

console.log({
  totalTokens: stats.totalTokens,
  totalCost: stats.totalCost,
  recordCount: stats.recordCount,
  byModule: stats.byModule,
  byDate: stats.byDate,
  byModel: stats.byModel
});
```

### 5. Optimization Comparison

Compare optimized vs baseline usage:

```javascript
const comparison = await monitor.compareOptimization({
  startDate: '2025-01-01',
  endDate: '2025-01-31',
  module: 'field_extraction'
});

console.log({
  totalTokens: comparison.totalTokens,
  averageTokensPerCall: comparison.averageTokensPerCall,
  byModule: comparison.byModule
});
```

## Cost Calculation

The monitor automatically calculates costs based on model pricing:

| Model | Input (per 1K tokens) | Output (per 1K tokens) |
|-------|----------------------|------------------------|
| GPT-4 | $0.03 | $0.06 |
| GPT-4 Turbo | $0.01 | $0.03 |
| GPT-3.5 Turbo | $0.0015 | $0.002 |
| Qwen | $0.001 | $0.001 |

Example:
```javascript
// 1000 input tokens + 200 output tokens with GPT-3.5 Turbo
// Cost = (1000/1000 * 0.0015) + (200/1000 * 0.002)
//      = 0.0015 + 0.0004
//      = $0.0019
```

## Database Schema

Token usage is stored in the `kg_token_usage` table:

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
```

## Best Practices

### 1. Record All LLM Calls

Always record token usage for every LLM call:

```javascript
async function callLLM(prompt, options) {
  const response = await llmClient.call(prompt, options);
  
  // Record usage
  await monitor.recordUsage({
    module: options.module,
    modelName: options.model,
    inputTokens: response.usage.prompt_tokens,
    outputTokens: response.usage.completion_tokens
  });
  
  return response;
}
```

### 2. Include Baseline for Comparison

When using optimization, always include baseline tokens:

```javascript
const baselineTokens = estimateTokens(fullText);
const optimizedTokens = estimateTokens(optimizedText);

await monitor.recordUsage({
  module: 'field_extraction',
  inputTokens: optimizedTokens,
  outputTokens: 100,
  optimized: true,
  baselineTokens  // For savings calculation
});
```

### 3. Monitor Budget Daily

Check budget status regularly:

```javascript
// Daily cron job
cron.schedule('0 0 * * *', () => {
  const status = monitor.getBudgetStatus();
  
  if (status.isOverBudget) {
    console.error('Budget exceeded!', status);
    // Send notification
  }
  
  // Reset for new day
  monitor.resetDailyUsage();
});
```

### 4. Review Statistics Weekly

Analyze usage patterns:

```javascript
// Weekly report
const stats = await monitor.getUsageStats({
  startDate: getWeekStart(),
  endDate: getWeekEnd()
});

console.log('Weekly Token Usage Report:');
console.log(`Total: ${stats.totalTokens} tokens`);
console.log(`Cost: $${stats.totalCost.toFixed(2)}`);
console.log('By Module:', stats.byModule);
```

### 5. Set Module-Specific Budgets

Allocate budget by module:

```javascript
const moduleBudgets = {
  field_extraction: 300000,
  entity_naming: 200000,
  relation_extraction: 300000
};

// Check module budget
const moduleUsage = status.byModule['field_extraction'];
if (moduleUsage > moduleBudgets.field_extraction) {
  console.warn('Field extraction over budget!');
}
```

## Troubleshooting

### High Token Usage

If token usage is higher than expected:

1. Check which modules are consuming most tokens:
   ```javascript
   const status = monitor.getBudgetStatus();
   console.log('Usage by module:', status.byModule);
   ```

2. Verify optimization is enabled:
   ```javascript
   const isOptimized = process.env.ENABLE_CONTEXT_OPTIMIZATION === 'true';
   console.log('Optimization enabled:', isOptimized);
   ```

3. Review optimization parameters:
   ```javascript
   const config = {
     maxTokens: 600,
     minChunks: 3,
     relevanceThreshold: 0.5
   };
   ```

### Budget Alerts Not Working

If alerts are not triggering:

1. Check alerting is enabled:
   ```javascript
   console.log('Alerting enabled:', monitor.options.enableAlerting);
   ```

2. Verify threshold is set correctly:
   ```javascript
   console.log('Alert threshold:', monitor.options.alertThreshold);
   ```

3. Check alert status:
   ```javascript
   const alerts = monitor.getAlerts();
   console.log('Active alerts:', alerts);
   ```

### Database Logging Issues

If usage is not being logged to database:

1. Check logging is enabled:
   ```javascript
   console.log('Logging enabled:', monitor.options.enableLogging);
   ```

2. Verify database connection:
   ```javascript
   const { PrismaClient } = require('@prisma/client');
   const prisma = new PrismaClient();
   await prisma.$connect();
   ```

3. Check for errors:
   ```javascript
   const usage = await monitor.recordUsage({...});
   if (usage.error) {
     console.error('Logging error:', usage.error);
   }
   ```

## API Reference

### TokenMonitor Class

#### Constructor

```javascript
new TokenMonitor(options)
```

Options:
- `budgetLimit` (number): Daily token budget (default: 1000000)
- `alertThreshold` (number): Alert threshold 0-1 (default: 0.8)
- `enableLogging` (boolean): Enable database logging (default: true)
- `enableAlerting` (boolean): Enable alerting (default: true)

#### Methods

- `recordUsage(usage)`: Record token usage
- `getUsageStats(options)`: Get usage statistics
- `compareOptimization(options)`: Compare optimized vs baseline
- `getBudgetStatus()`: Get current budget status
- `getAlerts()`: Get active alerts
- `clearAlerts()`: Clear all alerts
- `resetDailyUsage()`: Reset daily usage counters

### Helper Functions

```javascript
getTokenMonitor(options)
```

Returns singleton TokenMonitor instance.

## Examples

See `kg/ckb/token_monitor.test.js` for comprehensive examples.
