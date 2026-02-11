# Latency Monitoring Guide

## Overview

The Latency Monitor tracks end-to-end processing latency and module-level performance. It identifies performance bottlenecks and tracks latency improvements from context optimization.

## Quick Start

```javascript
const { getLatencyMonitor } = require('./kg/ckb/latency_monitor');

// Initialize monitor
const monitor = getLatencyMonitor({
  warningThreshold: 5000,      // 5 seconds
  criticalThreshold: 10000,    // 10 seconds
  targetLatency: {
    document_processing: 5000,
    field_extraction: 2000,
    entity_building: 1000,
    relation_extraction: 2000
  }
});

// Start timing
const timerId = monitor.startTimer('extract_fields', {
  module: 'field_extraction',
  optimized: true
});

// ... perform operation ...

// Stop timing
const result = await monitor.stopTimer(timerId);
console.log(`Operation took ${result.latency}ms`);

// Check status
const status = monitor.getLatencyStatus();
console.log('Latency status:', status);

// Identify bottlenecks
const bottlenecks = monitor.identifyBottlenecks();
if (bottlenecks.length > 0) {
  console.warn('Performance bottlenecks:', bottlenecks);
}
```

## Features

### 1. Timer-Based Tracking

```javascript
// Start timer
const timerId = monitor.startTimer('operation_id', {
  module: 'field_extraction',
  optimized: true,
  documentId: 'doc_123'
});

// Perform operation
await performOperation();

// Stop timer and record
const result = await monitor.stopTimer(timerId);
// { module: 'field_extraction', latency: 1234, optimized: true }
```

### 2. Direct Latency Recording

```javascript
await monitor.recordLatency({
  module: 'field_extraction',
  operationId: 'extract_001',
  latency: 1500,
  optimized: true,
  metadata: {
    documentLength: 5000,
    chunkCount: 10
  }
});
```

### 3. Latency Status

```javascript
const status = monitor.getLatencyStatus();

// Example output:
// {
//   fieldExtraction: {
//     baseline: {
//       avgLatency: 2000,
//       count: 10,
//       min: 1500,
//       max: 3000,
//       p50: 2000,
//       p95: 2800,
//       p99: 2950
//     },
//     optimized: {
//       avgLatency: 800,
//       count: 10,
//       min: 600,
//       max: 1200,
//       p50: 800,
//       p95: 1100,
//       p99: 1180
//     },
//     improvement: 0.6,
//     improvementPercent: 60,
//     targetLatency: 2000,
//     meetsTarget: true,
//     hasWarning: false,
//     isCritical: false
//   }
// }
```

### 4. Bottleneck Identification

```javascript
const bottlenecks = monitor.identifyBottlenecks();

// Example output:
// [
//   {
//     module: 'field_extraction',
//     type: 'target_exceeded',
//     severity: 'warning',
//     currentLatency: 3000,
//     targetLatency: 2000,
//     excess: 1000,
//     excessPercent: 50
//   },
//   {
//     module: 'entity_building',
//     type: 'high_p95',
//     severity: 'warning',
//     p95Latency: 2500,
//     targetLatency: 1000,
//     message: 'P95 latency is more than 2x target'
//   }
// ]
```

### 5. Latency Breakdown

```javascript
const breakdown = monitor.getLatencyBreakdown({ module: 'field_extraction' });

// Example output:
// {
//   baseline: {
//     extract_op1: { count: 5, avgLatency: 2000, minLatency: 1800, maxLatency: 2200 },
//     extract_op2: { count: 5, avgLatency: 2100, minLatency: 1900, maxLatency: 2300 }
//   },
//   optimized: {
//     extract_op1: { count: 5, avgLatency: 800, minLatency: 700, maxLatency: 900 },
//     extract_op2: { count: 5, avgLatency: 850, minLatency: 750, maxLatency: 950 }
//   }
// }
```

### 6. Performance Alerts

```javascript
const alerts = monitor.getAlerts();

// Example alert:
// {
//   type: 'critical_latency',
//   severity: 'critical',
//   module: 'field_extraction',
//   message: 'Critical latency detected: 12000ms (threshold: 10000ms)',
//   data: {
//     latency: 12000,
//     threshold: 10000,
//     targetLatency: 2000
//   },
//   timestamp: '2025-02-09T...'
// }
```

## Configuration

### Environment Variables

```bash
# Latency thresholds (milliseconds)
LATENCY_WARNING_THRESHOLD=5000
LATENCY_CRITICAL_THRESHOLD=10000

# Performance targets (milliseconds)
LATENCY_TARGET_DOCUMENT=5000
LATENCY_TARGET_FIELD=2000
LATENCY_TARGET_ENTITY=1000
LATENCY_TARGET_RELATION=2000

# Logging
LATENCY_LOGGING_ENABLED=true
LATENCY_DETAILED_LOGGING=false

# Alerting
LATENCY_ALERTING_ENABLED=true
LATENCY_ALERT_EMAIL=false
LATENCY_ALERT_WEBHOOK=false
LATENCY_ALERT_WEBHOOK_URL=https://example.com/webhook
LATENCY_ALERT_EMAIL_RECIPIENTS=admin@example.com

# Statistics
LATENCY_STATS_RETENTION_DAYS=90
LATENCY_STATS_AGGREGATION=hourly
```

## Integration Examples

### Field Extractor Integration

```javascript
const { getLatencyMonitor } = require('./kg/ckb/latency_monitor');

const monitor = getLatencyMonitor();

async function extractFieldsWithLatencyTracking(ckb, optimized = false) {
  const timerId = monitor.startTimer('extract_fields', {
    module: 'field_extraction',
    optimized,
    ckbId: ckb.ckb_id
  });
  
  try {
    const fields = await extractFields(ckb, optimized);
    await monitor.stopTimer(timerId);
    return fields;
  } catch (error) {
    await monitor.stopTimer(timerId, {
      metadata: { error: error.message }
    });
    throw error;
  }
}
```

### Entity Builder Integration

```javascript
async function buildEntityWithLatencyTracking(fields, schema, ckb, optimized = false) {
  const timerId = monitor.startTimer('build_entity', {
    module: 'entity_building',
    optimized,
    schemaId: schema.schema_id
  });
  
  const entity = await buildEntity(fields, schema, ckb, optimized);
  await monitor.stopTimer(timerId);
  
  return entity;
}
```

### End-to-End Pipeline Tracking

```javascript
async function processDocumentWithLatencyTracking(document) {
  const pipelineTimer = monitor.startTimer('document_pipeline', {
    module: 'document_processing',
    optimized: true,
    documentId: document.id
  });
  
  // Parse document
  const parseTimer = monitor.startTimer('parse_document', {
    module: 'document_processing',
    optimized: false
  });
  const ckb = await parseDocument(document);
  await monitor.stopTimer(parseTimer);
  
  // Extract fields
  const extractTimer = monitor.startTimer('extract_fields', {
    module: 'field_extraction',
    optimized: true
  });
  const fields = await extractFields(ckb);
  await monitor.stopTimer(extractTimer);
  
  // Build entities
  const entityTimer = monitor.startTimer('build_entities', {
    module: 'entity_building',
    optimized: true
  });
  const entities = await buildEntities(fields);
  await monitor.stopTimer(entityTimer);
  
  // Extract relations
  const relationTimer = monitor.startTimer('extract_relations', {
    module: 'relation_extraction',
    optimized: true
  });
  const relations = await extractRelations(entities, ckb);
  await monitor.stopTimer(relationTimer);
  
  // Stop pipeline timer
  await monitor.stopTimer(pipelineTimer);
  
  // Check for bottlenecks
  const bottlenecks = monitor.identifyBottlenecks();
  if (bottlenecks.length > 0) {
    console.warn('Performance bottlenecks detected:', bottlenecks);
  }
  
  return { ckb, fields, entities, relations };
}
```

## Best Practices

### 1. Always Use Try-Catch

```javascript
const timerId = monitor.startTimer('operation');
try {
  await performOperation();
  await monitor.stopTimer(timerId);
} catch (error) {
  await monitor.stopTimer(timerId, {
    metadata: { error: error.message, failed: true }
  });
  throw error;
}
```

### 2. Set Realistic Targets

```javascript
// Based on actual performance data
const monitor = getLatencyMonitor({
  targetLatency: {
    document_processing: 5000,  // 5 seconds for full pipeline
    field_extraction: 2000,     // 2 seconds for extraction
    entity_building: 1000,      // 1 second per entity
    relation_extraction: 2000   // 2 seconds for relations
  }
});
```

### 3. Regular Performance Reviews

```javascript
// Daily performance review
async function dailyPerformanceReview() {
  const stats = await monitor.getLatencyStats({
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate: new Date()
  });
  
  console.log('Daily latency stats:', stats);
  
  const bottlenecks = monitor.identifyBottlenecks();
  if (bottlenecks.length > 0) {
    sendPerformanceAlert(bottlenecks);
  }
  
  monitor.resetSession();
}
```

### 4. Monitor Percentiles

```javascript
const status = monitor.getLatencyStatus();

// Focus on p95 and p99 for production
if (status.fieldExtraction.optimized.p95 > status.fieldExtraction.targetLatency * 1.5) {
  console.warn('P95 latency exceeds target by 50%');
}
```

## Troubleshooting

### Issue: High latency variance

**Cause**: Inconsistent performance across operations

**Solution**: Check latency breakdown to identify specific operations

```javascript
const breakdown = monitor.getLatencyBreakdown({ module: 'field_extraction' });
console.log('Latency breakdown:', breakdown);
```

### Issue: Latency not improving with optimization

**Cause**: Optimization not effective or bottleneck elsewhere

**Solution**: Compare baseline vs optimized and identify bottlenecks

```javascript
const status = monitor.getLatencyStatus();
console.log('Improvement:', status.fieldExtraction.improvementPercent + '%');

const bottlenecks = monitor.identifyBottlenecks();
console.log('Bottlenecks:', bottlenecks);
```

### Issue: Memory leak from active timers

**Cause**: Timers not stopped properly

**Solution**: Always stop timers in finally block

```javascript
const timerId = monitor.startTimer('operation');
try {
  await performOperation();
} finally {
  if (monitor.activeTimers.has(timerId)) {
    await monitor.stopTimer(timerId);
  }
}
```

## API Reference

### LatencyMonitor Class

#### startTimer(operationId, metadata)
Start timing an operation.

**Returns:** Timer ID (string)

#### stopTimer(timerId, params)
Stop timing and record latency.

**Returns:** Promise<Object>

#### recordLatency(params)
Directly record latency.

**Returns:** Promise<Object>

#### getLatencyStatus()
Get current latency status.

**Returns:** Object

#### getLatencyBreakdown(options)
Get latency breakdown by operation.

**Returns:** Object

#### identifyBottlenecks()
Identify performance bottlenecks.

**Returns:** Array

#### getAlerts()
Get current alerts.

**Returns:** Array

#### clearAlerts()
Clear all alerts.

#### resetSession(module)
Reset session metrics.

#### getLatencyStats(options)
Get historical statistics.

**Returns:** Promise<Object>

### getLatencyMonitor(config)
Get or create latency monitor singleton.

**Returns:** LatencyMonitor

## Conclusion

The Latency Monitor provides comprehensive latency tracking and performance analysis to ensure the CKB optimization system delivers the expected latency improvements while identifying and addressing performance bottlenecks.
