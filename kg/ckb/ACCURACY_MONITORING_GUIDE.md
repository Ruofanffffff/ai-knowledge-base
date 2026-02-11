# Accuracy Monitoring Guide

## Overview

The Accuracy Monitor tracks extraction accuracy on test sets and compares optimized vs baseline performance. It implements automatic degradation when accuracy drops below acceptable thresholds.

## Quick Start

```javascript
const { getAccuracyMonitor } = require('./kg/ckb/accuracy_monitor');

// Initialize monitor
const monitor = getAccuracyMonitor({
  maxAccuracyDrop: 0.02,        // 2% max acceptable drop
  warningThreshold: 0.015,       // 1.5% warning threshold
  autoDegradationEnabled: true,  // Enable auto-degradation
  degradationThreshold: 0.02,    // 2% triggers degradation
  minTestSetSize: 10             // Minimum test cases needed
});

// Record baseline accuracy
await monitor.recordAccuracy({
  module: 'field_extraction',
  testCaseId: 'test_001',
  metrics: { precision: 0.85, recall: 0.80, f1: 0.825 },
  optimized: false
});

// Record optimized accuracy
await monitor.recordAccuracy({
  module: 'field_extraction',
  testCaseId: 'test_002',
  metrics: { precision: 0.84, recall: 0.79, f1: 0.815 },
  optimized: true
});

// Check status
const status = monitor.getAccuracyStatus();
console.log('Accuracy status:', status);

// Check for degradation
if (monitor.isDegraded('field_extraction')) {
  console.warn('Field extraction has degraded! Falling back to full context.');
}
```

## Features

### 1. Accuracy Recording

Record accuracy metrics for each test case:

```javascript
await monitor.recordAccuracy({
  module: 'field_extraction',      // Module name
  testCaseId: 'test_001',          // Test case identifier
  metrics: {
    precision: 0.85,               // Precision score
    recall: 0.80,                  // Recall score
    f1: 0.825                      // F1 score
  },
  optimized: false,                // Baseline or optimized
  metadata: {                      // Optional metadata
    documentType: 'technical',
    documentLength: 5000
  }
});
```

### 2. Accuracy Status

Get current accuracy status for all modules:

```javascript
const status = monitor.getAccuracyStatus();

// Example output:
// {
//   fieldExtraction: {
//     baseline: { f1: 0.825, count: 10 },
//     optimized: { f1: 0.815, count: 10 },
//     drop: 0.0121,
//     dropPercent: 1.21,
//     isAcceptable: true,
//     isDegraded: false,
//     hasWarning: false
//   },
//   entityRecognition: { ... },
//   relationExtraction: { ... }
// }
```

### 3. Auto-Degradation

Automatic degradation when accuracy drops exceed threshold:

```javascript
// Check if module is degraded
if (monitor.isDegraded('field_extraction')) {
  // Fall back to full context
  const context = ckb.content.text;
} else {
  // Use optimized context
  const { context } = await contextOptimizer.optimizeForFieldExtraction(ckb);
}

// Reset degradation after fixing issues
monitor.resetDegradation('field_extraction');
```

### 4. Alerts

Get and manage accuracy alerts:

```javascript
// Get all alerts
const alerts = monitor.getAlerts();

// Example alert:
// {
//   type: 'accuracy_degradation',
//   severity: 'critical',
//   module: 'field_extraction',
//   message: 'Accuracy drop of 2.5% detected in field_extraction. Auto-degradation triggered.',
//   data: {
//     baselineF1: 0.825,
//     optimizedF1: 0.805,
//     drop: 0.025,
//     threshold: 0.02
//   },
//   timestamp: '2025-02-09T...'
// }

// Clear all alerts
monitor.clearAlerts();
```

### 5. Historical Statistics

Query historical accuracy data:

```javascript
const stats = await monitor.getAccuracyStats({
  module: 'field_extraction',
  startDate: '2025-01-01',
  endDate: '2025-01-31'
});

// Example output:
// {
//   field_extraction: {
//     baseline: {
//       count: 100,
//       totalF1: 82.5,
//       avgF1: 0.825,
//       metrics: [...]
//     },
//     optimized: {
//       count: 100,
//       totalF1: 81.0,
//       avgF1: 0.810,
//       metrics: [...]
//     },
//     drop: 0.0182,
//     dropPercent: 1.82
//   }
// }
```

## Configuration

### Environment Variables

```bash
# Accuracy thresholds
ACCURACY_MAX_DROP=0.02                    # 2% max acceptable drop
ACCURACY_WARNING_THRESHOLD=0.015          # 1.5% warning threshold
ACCURACY_DEGRADATION_THRESHOLD=0.02       # 2% triggers degradation

# Auto-degradation
ACCURACY_AUTO_DEGRADATION=true            # Enable auto-degradation

# Test set requirements
ACCURACY_MIN_TEST_SET_SIZE=10             # Minimum test cases needed

# Logging
ACCURACY_LOGGING_ENABLED=true             # Log to database

# Module-specific thresholds (optional)
ACCURACY_MAX_DROP_FIELD_EXTRACTION=0.02
ACCURACY_DEGRADATION_FIELD_EXTRACTION=0.02
ACCURACY_MAX_DROP_ENTITY_RECOGNITION=0.02
ACCURACY_DEGRADATION_ENTITY_RECOGNITION=0.02
ACCURACY_MAX_DROP_RELATION_EXTRACTION=0.02
ACCURACY_DEGRADATION_RELATION_EXTRACTION=0.02

# Alerting
ACCURACY_ALERTING_ENABLED=true
ACCURACY_ALERT_EMAIL=false
ACCURACY_ALERT_WEBHOOK=false
ACCURACY_ALERT_WEBHOOK_URL=https://example.com/webhook
ACCURACY_ALERT_EMAIL_RECIPIENTS=admin@example.com,team@example.com

# Statistics retention
ACCURACY_STATS_RETENTION_DAYS=90
ACCURACY_STATS_AGGREGATION=daily          # daily, weekly, monthly
```

### Programmatic Configuration

```javascript
const monitor = getAccuracyMonitor({
  // Accuracy thresholds
  maxAccuracyDrop: 0.02,
  warningThreshold: 0.015,
  
  // Auto-degradation
  autoDegradationEnabled: true,
  degradationThreshold: 0.02,
  
  // Test set requirements
  minTestSetSize: 10,
  
  // Logging
  loggingEnabled: true
});
```

## Integration Examples

### Field Extractor Integration

```javascript
const { getAccuracyMonitor } = require('./kg/ckb/accuracy_monitor');
const { ContextOptimizer } = require('./kg/ckb/context_optimizer');

const monitor = getAccuracyMonitor();
const optimizer = new ContextOptimizer();

async function extractFieldsWithMonitoring(ckb, testCase = null) {
  // Check if degraded
  const isDegraded = monitor.isDegraded('field_extraction');
  
  let context;
  let optimized = false;
  
  if (isDegraded) {
    // Use full context
    context = ckb.content.text;
    console.log('Using full context due to degradation');
  } else {
    // Use optimized context
    const result = await optimizer.optimizeForFieldExtraction(ckb);
    context = result.context;
    optimized = true;
  }
  
  // Extract fields
  const fields = await extractFields(context);
  
  // Record accuracy if test case provided
  if (testCase) {
    const metrics = calculateMetrics(fields, testCase.groundTruth);
    await monitor.recordAccuracy({
      module: 'field_extraction',
      testCaseId: testCase.id,
      metrics,
      optimized
    });
  }
  
  return fields;
}
```

### Entity Builder Integration

```javascript
async function enhanceNameWithMonitoring(rawName, schema, ckb, entity, testCase = null) {
  const isDegraded = monitor.isDegraded('entity_recognition');
  
  let context;
  let optimized = false;
  
  if (isDegraded) {
    context = ckb.content.text;
  } else {
    const evidence = await evidenceLocator.locateEntity(entity, ckb);
    const chunks = await chunkManager.getChunks(evidence.chunk_ids);
    context = chunks.map(c => c.text).join('\n');
    optimized = true;
  }
  
  const enhancedName = await llmClient.callJSON(buildPrompt(rawName, context));
  
  if (testCase) {
    const metrics = calculateMetrics(enhancedName, testCase.groundTruth);
    await monitor.recordAccuracy({
      module: 'entity_recognition',
      testCaseId: testCase.id,
      metrics,
      optimized
    });
  }
  
  return enhancedName;
}
```

### Relation Builder Integration

```javascript
async function extractRelationsWithMonitoring(ckb, entities, testCase = null) {
  const isDegraded = monitor.isDegraded('relation_extraction');
  
  let context;
  let optimized = false;
  
  if (isDegraded) {
    context = ckb.content.text;
  } else {
    const entityChunkIds = new Set();
    for (const entity of entities) {
      const evidence = await evidenceLocator.locateEntity(entity, ckb);
      evidence.chunk_ids.forEach(id => entityChunkIds.add(id));
    }
    const chunks = await chunkManager.getChunks([...entityChunkIds]);
    context = chunks.map(c => c.text).join('\n');
    optimized = true;
  }
  
  const relations = await extractRelations(context, entities);
  
  if (testCase) {
    const metrics = calculateMetrics(relations, testCase.groundTruth);
    await monitor.recordAccuracy({
      module: 'relation_extraction',
      testCaseId: testCase.id,
      metrics,
      optimized
    });
  }
  
  return relations;
}
```

## Best Practices

### 1. Test Set Size

Ensure sufficient test cases before relying on auto-degradation:

```javascript
const monitor = getAccuracyMonitor({
  minTestSetSize: 10  // At least 10 test cases per mode
});
```

### 2. Threshold Tuning

Adjust thresholds based on your accuracy requirements:

```javascript
// Strict requirements
const monitor = getAccuracyMonitor({
  maxAccuracyDrop: 0.01,        // 1% max drop
  warningThreshold: 0.005,      // 0.5% warning
  degradationThreshold: 0.01    // 1% triggers degradation
});

// Relaxed requirements
const monitor = getAccuracyMonitor({
  maxAccuracyDrop: 0.03,        // 3% max drop
  warningThreshold: 0.02,       // 2% warning
  degradationThreshold: 0.03    // 3% triggers degradation
});
```

### 3. Regular Testing

Run accuracy tests regularly:

```javascript
// Daily accuracy test
async function runDailyAccuracyTest() {
  const testCases = await loadTestCases();
  
  for (const testCase of testCases) {
    // Test baseline
    const baselineResult = await extractFieldsWithMonitoring(
      testCase.ckb,
      { ...testCase, optimized: false }
    );
    
    // Test optimized
    const optimizedResult = await extractFieldsWithMonitoring(
      testCase.ckb,
      { ...testCase, optimized: true }
    );
  }
  
  // Check status
  const status = monitor.getAccuracyStatus();
  console.log('Daily accuracy test results:', status);
  
  // Alert if degraded
  const alerts = monitor.getAlerts();
  if (alerts.length > 0) {
    sendAlertNotification(alerts);
  }
}
```

### 4. Session Management

Reset session metrics periodically:

```javascript
// Reset daily
setInterval(() => {
  monitor.resetSession();
  console.log('Session metrics reset');
}, 24 * 60 * 60 * 1000);

// Or reset after each test run
async function runTestSuite() {
  monitor.resetSession();
  
  // Run tests...
  
  const status = monitor.getAccuracyStatus();
  return status;
}
```

### 5. Alert Handling

Implement custom alert handlers:

```javascript
async function handleAccuracyAlerts() {
  const alerts = monitor.getAlerts();
  
  for (const alert of alerts) {
    if (alert.severity === 'critical') {
      // Send email notification
      await sendEmail({
        to: 'admin@example.com',
        subject: `Critical: ${alert.message}`,
        body: JSON.stringify(alert.data, null, 2)
      });
      
      // Log to monitoring system
      await logToMonitoring(alert);
      
      // Trigger incident response
      await createIncident(alert);
    } else if (alert.severity === 'warning') {
      // Log warning
      console.warn(alert.message);
      
      // Send Slack notification
      await sendSlackMessage(alert.message);
    }
  }
  
  // Clear processed alerts
  monitor.clearAlerts();
}
```

## Troubleshooting

### Issue: Auto-degradation not triggering

**Cause**: Insufficient test cases

**Solution**: Ensure you have at least `minTestSetSize` test cases for both baseline and optimized modes:

```javascript
const status = monitor.getAccuracyStatus();
console.log('Baseline count:', status.fieldExtraction.baseline.count);
console.log('Optimized count:', status.fieldExtraction.optimized.count);

// Need at least minTestSetSize (default: 10) for each
```

### Issue: Accuracy drop calculation seems wrong

**Cause**: Comparing different test sets

**Solution**: Ensure baseline and optimized tests use the same test cases:

```javascript
// Good: Same test cases
for (const testCase of testCases) {
  await testBaseline(testCase);
  await testOptimized(testCase);
}

// Bad: Different test cases
await testBaseline(testCasesA);
await testOptimized(testCasesB);
```

### Issue: Degradation state persists after fixing

**Cause**: Degradation state not reset

**Solution**: Manually reset degradation after fixing issues:

```javascript
// After fixing the issue
monitor.resetDegradation('field_extraction');

// Or reset all modules
monitor.resetSession();
```

### Issue: Database logging fails

**Cause**: Missing database table

**Solution**: Ensure the `kg_accuracy_metric` table exists:

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
```

## API Reference

### AccuracyMonitor Class

#### Constructor

```javascript
new AccuracyMonitor(config)
```

**Parameters:**
- `config.maxAccuracyDrop` (number): Maximum acceptable accuracy drop (default: 0.02)
- `config.warningThreshold` (number): Warning threshold (default: 0.015)
- `config.autoDegradationEnabled` (boolean): Enable auto-degradation (default: true)
- `config.degradationThreshold` (number): Degradation trigger threshold (default: 0.02)
- `config.minTestSetSize` (number): Minimum test cases needed (default: 10)
- `config.loggingEnabled` (boolean): Enable database logging (default: true)

#### Methods

##### recordAccuracy(params)

Record accuracy metrics for a test case.

**Parameters:**
- `params.module` (string): Module name
- `params.testCaseId` (string): Test case identifier
- `params.metrics` (object): Accuracy metrics (precision, recall, f1)
- `params.optimized` (boolean): Whether optimization was used
- `params.metadata` (object): Optional metadata

**Returns:** Promise<Object>

##### getAccuracyStatus()

Get current accuracy status for all modules.

**Returns:** Object

##### getAccuracyComparison(options)

Get accuracy comparison between baseline and optimized.

**Parameters:**
- `options.module` (string): Module to query
- `options.startDate` (Date): Start date
- `options.endDate` (Date): End date

**Returns:** Promise<Object>

##### isDegraded(module)

Check if a module is in degraded state.

**Parameters:**
- `module` (string): Module name

**Returns:** boolean

##### resetDegradation(module)

Reset degradation state for a module.

**Parameters:**
- `module` (string): Module name

##### getAlerts()

Get current alerts.

**Returns:** Array

##### clearAlerts()

Clear all alerts.

##### resetSession(module)

Reset session metrics.

**Parameters:**
- `module` (string): Optional module to reset (resets all if not specified)

##### getAccuracyStats(options)

Get accuracy statistics from database.

**Parameters:**
- `options.module` (string): Module to query
- `options.startDate` (Date): Start date
- `options.endDate` (Date): End date

**Returns:** Promise<Object>

### getAccuracyMonitor(config)

Get or create accuracy monitor singleton.

**Parameters:**
- `config` (object): Configuration options

**Returns:** AccuracyMonitor

## Conclusion

The Accuracy Monitor provides comprehensive accuracy tracking and auto-degradation capabilities to ensure the CKB optimization system maintains high quality while reducing token consumption. Use it to continuously monitor accuracy and automatically fall back to full context when needed.
