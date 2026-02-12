# LLM Field Extractor - Concurrency Control Implementation

## Overview

Task 6.1 has been successfully completed, adding comprehensive concurrency queue management to the LLM field extractor using the `p-queue` library.

## Implementation Summary

### 1. Library Integration (Task 6.1.1)

- **Library**: `p-queue` v6.6.2 (CommonJS compatible)
- **Installation**: Added to package.json dependencies
- **Integration**: Imported and initialized in LLMFieldExtractor constructor

### 2. Concurrency Configuration (Task 6.1.2)

- **Max Concurrent Requests**: 3 (configurable via `LLM_MAX_CONCURRENT` env var)
- **Queue Initialization**: PQueue instance created with concurrency limit
- **Automatic Management**: p-queue handles all concurrency control automatically

### 3. Timeout Control (Task 6.1.3)

- **Default Timeout**: 30 seconds (configurable via `LLM_TIMEOUT` env var)
- **Implementation**: AbortController with setTimeout for each LLM call
- **Graceful Handling**: Timeouts trigger fallback to individual processing
- **Queue Timeout**: p-queue configured with timeout and throwOnTimeout options

### 4. Retry Logic (Task 6.1.4)

- **Max Retries**: 2 (configurable via `LLM_MAX_RETRIES` env var)
- **Exponential Backoff**: Delay = min(1000 * 2^(attempt-1), 10000)ms
  - Attempt 1: 1 second delay
  - Attempt 2: 2 seconds delay
  - Attempt 3: 4 seconds delay
  - Maximum: 10 seconds
- **Error Handling**: Distinguishes between timeout and other errors
- **Fallback**: If batch fails after all retries, falls back to individual processing

## Configuration

### Environment Variables

```bash
# LLM Concurrency and Timeout Configuration
LLM_BATCH_SIZE=20              # Number of CKBs per batch
LLM_MAX_CONCURRENT=3           # Maximum concurrent LLM requests
LLM_TEMPERATURE=0.1            # LLM temperature for extraction
LLM_TIMEOUT=30000              # Timeout per LLM call (milliseconds)
LLM_MAX_RETRIES=2              # Maximum retry attempts
```

### Code Configuration

```javascript
const extractor = new LLMFieldExtractor({
  batchSize: 20,        // CKBs per batch
  maxConcurrent: 3,     // Max concurrent requests
  temperature: 0.1,     // LLM temperature
  timeout: 30000,       // 30 second timeout
  maxRetries: 2         // 2 retry attempts
});
```

## Architecture

### Queue Management Flow

```
CKBs → Create Batches → Add to Queue → Process with Concurrency Limit
                                              ↓
                                    Max 3 Concurrent Calls
                                              ↓
                                    Timeout Control (30s)
                                              ↓
                                    Retry Logic (2 attempts)
                                              ↓
                                    Fallback if Failed
```

### Key Components

1. **PQueue Instance**
   - Manages concurrency automatically
   - Queues excess requests
   - Provides pending/size statistics

2. **Batch Processing**
   - Each batch added to queue with `queue.add()`
   - Queue ensures max 3 concurrent executions
   - All batches processed in parallel (within limit)

3. **Timeout Control**
   - AbortController for each LLM call
   - Automatic cleanup on completion
   - Graceful error handling

4. **Retry Logic**
   - Exponential backoff between retries
   - Detailed logging for each attempt
   - Final error after max retries

## Testing

### Unit Tests

All 13 unit tests pass successfully:
- ✓ Batch prompt building
- ✓ Response parsing (JSON and markdown-wrapped)
- ✓ Field type inference
- ✓ Batch creation
- ✓ Statistics calculation
- ✓ Empty input handling
- ✓ Batch processing

### Integration Tests

Created `test_concurrency_control.js` with three test scenarios:

1. **Concurrency Control Test**
   - Processes 10 CKBs with max 3 concurrent
   - Verifies concurrency limit respected
   - Validates processing time (~4 seconds)
   - Result: ✓ All checks passed

2. **Timeout Control Test**
   - Simulates slow LLM (2s) with short timeout (500ms)
   - Verifies timeout detection
   - Validates fallback mechanism
   - Result: ✓ Timeout handled gracefully

3. **Retry Logic Test**
   - Simulates failing LLM (fails first 2 attempts)
   - Verifies exponential backoff
   - Validates eventual success
   - Result: ✓ Succeeded on 3rd attempt

## Performance Characteristics

### Concurrency Benefits

- **Without Concurrency**: 10 CKBs × 1s = 10 seconds
- **With Concurrency (3)**: 10 CKBs / 3 = ~4 seconds
- **Speedup**: 2.5x faster

### Resource Management

- **API Rate Limits**: Respects 3 concurrent request limit
- **Memory**: Minimal overhead from p-queue
- **CPU**: Non-blocking async operations

### Error Resilience

- **Timeout Protection**: Prevents hanging on slow APIs
- **Retry Logic**: Handles transient failures
- **Fallback**: Individual processing if batch fails

## Code Changes

### Modified Files

1. **`kg/field_extractor/llm_extractor.js`**
   - Added p-queue import
   - Initialized queue in constructor
   - Updated batchExtractMissingFields to use queue
   - Enhanced _callLLMWithRetry with exponential backoff
   - Added queue statistics logging

2. **`kg/field_extractor/rule_extractor.js`**
   - Added FieldType.TEXT constant

3. **`.env.example`**
   - Added LLM_TIMEOUT configuration
   - Added LLM_MAX_RETRIES configuration

4. **`package.json`**
   - Added p-queue@^6.6.2 dependency

### New Files

1. **`test_concurrency_control.js`**
   - Comprehensive integration tests
   - Mock LLM client for testing
   - Three test scenarios

2. **`CONCURRENCY_CONTROL_IMPLEMENTATION.md`**
   - This documentation file

## Usage Example

```javascript
const LLMFieldExtractor = require('./kg/field_extractor/llm_extractor');

// Create extractor with default settings
const extractor = new LLMFieldExtractor();

// Prepare CKBs needing LLM extraction
const ckbsWithMissingFields = [
  {
    ckb: { ckb_id: 'ckb_1', content: { text: '...' } },
    missingFields: [{ name: '地点' }, { name: '执行单位' }]
  },
  // ... more CKBs
];

// Process with automatic concurrency control
const results = await extractor.batchExtractMissingFields(
  ckbsWithMissingFields,
  llmClient
);

// Results is a Map<ckb_id, extracted_fields[]>
console.log(`Processed ${results.size} CKBs`);
```

## Monitoring

### Queue Statistics

The extractor logs queue statistics after processing:

```
[LLM Extractor] Queue stats: pending=0, size=0
```

- **pending**: Number of tasks currently executing
- **size**: Number of tasks waiting in queue

### Performance Metrics

Track these metrics for monitoring:

- Total LLM calls
- Average batch processing time
- Max concurrent calls observed
- Timeout occurrences
- Retry attempts
- Fallback invocations

## Benefits

1. **API Rate Limit Compliance**: Never exceeds 3 concurrent requests
2. **Improved Performance**: 2.5x faster than sequential processing
3. **Reliability**: Automatic retries with exponential backoff
4. **Resilience**: Timeout protection prevents hanging
5. **Graceful Degradation**: Fallback to individual processing
6. **Observability**: Detailed logging and statistics

## Future Enhancements

1. **Adaptive Concurrency**: Adjust based on API response times
2. **Priority Queue**: Process critical CKBs first
3. **Circuit Breaker**: Temporarily disable LLM on repeated failures
4. **Metrics Dashboard**: Real-time monitoring of queue performance
5. **Cost Tracking**: Monitor token usage per batch

## Conclusion

Task 6.1 has been successfully completed with all subtasks implemented:

- ✓ 6.1.1 集成p-queue或类似库
- ✓ 6.1.2 配置最大并发数（3个）
- ✓ 6.1.3 实现超时控制
- ✓ 6.1.4 添加重试逻辑

The implementation provides robust concurrency control, timeout protection, and retry logic with exponential backoff, ensuring reliable and efficient LLM field extraction while respecting API rate limits.
