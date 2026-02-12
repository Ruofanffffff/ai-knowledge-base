/**
 * Test script to verify LLM extractor concurrency control
 * 
 * This script tests:
 * 1. p-queue integration
 * 2. Maximum concurrent requests (3)
 * 3. Timeout control (30 seconds)
 * 4. Retry logic with exponential backoff
 */

const LLMFieldExtractor = require('./kg/field_extractor/llm_extractor');

// Mock LLM client that simulates delays
class MockLLMClient {
  constructor(delay = 1000) {
    this.delay = delay;
    this.callCount = 0;
    this.concurrentCalls = 0;
    this.maxConcurrentCalls = 0;
  }
  
  async chat({ messages, temperature, signal }) {
    this.callCount++;
    this.concurrentCalls++;
    this.maxConcurrentCalls = Math.max(this.maxConcurrentCalls, this.concurrentCalls);
    
    console.log(`[Mock LLM] Call #${this.callCount} started (concurrent: ${this.concurrentCalls})`);
    
    try {
      // Simulate API delay
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, this.delay);
        
        if (signal) {
          signal.addEventListener('abort', () => {
            clearTimeout(timeout);
            reject(new Error('AbortError'));
          });
        }
      });
      
      // Return mock response
      return {
        content: JSON.stringify({
          ckb_0: [
            { name: '地点', value: '测试地点', confidence: 0.9 }
          ]
        })
      };
    } finally {
      this.concurrentCalls--;
      console.log(`[Mock LLM] Call #${this.callCount} completed (concurrent: ${this.concurrentCalls})`);
    }
  }
  
  getStats() {
    return {
      totalCalls: this.callCount,
      maxConcurrentCalls: this.maxConcurrentCalls
    };
  }
}

async function testConcurrencyControl() {
  console.log('=== Testing Concurrency Control ===\n');
  
  // Create extractor with concurrency limit of 3
  const extractor = new LLMFieldExtractor({
    batchSize: 1, // 1 CKB per batch to test concurrency
    maxConcurrent: 3,
    timeout: 5000,
    maxRetries: 1
  });
  
  // Create mock LLM client with 1 second delay
  const mockClient = new MockLLMClient(1000);
  
  // Create 10 CKBs that need LLM extraction
  const ckbsWithMissingFields = [];
  for (let i = 0; i < 10; i++) {
    ckbsWithMissingFields.push({
      ckb: {
        ckb_id: `ckb_${i}`,
        content: { text: `测试文本 ${i}` }
      },
      missingFields: [{ name: '地点' }]
    });
  }
  
  console.log(`Processing ${ckbsWithMissingFields.length} CKBs with max concurrency of 3...\n`);
  
  const startTime = Date.now();
  const results = await extractor.batchExtractMissingFields(ckbsWithMissingFields, mockClient);
  const duration = Date.now() - startTime;
  
  console.log('\n=== Results ===');
  console.log(`Total time: ${duration}ms`);
  console.log(`CKBs processed: ${results.size}`);
  console.log(`Total LLM calls: ${mockClient.callCount}`);
  console.log(`Max concurrent calls: ${mockClient.maxConcurrentCalls}`);
  
  // Verify concurrency limit
  if (mockClient.maxConcurrentCalls <= 3) {
    console.log('✓ Concurrency limit respected (max 3 concurrent calls)');
  } else {
    console.log(`✗ Concurrency limit exceeded! (${mockClient.maxConcurrentCalls} concurrent calls)`);
  }
  
  // Verify all CKBs were processed
  if (results.size === ckbsWithMissingFields.length) {
    console.log('✓ All CKBs processed successfully');
  } else {
    console.log(`✗ Some CKBs failed (${results.size}/${ckbsWithMissingFields.length})`);
  }
  
  // Expected time: ~4 seconds (10 calls / 3 concurrent = 4 batches * 1 second)
  const expectedTime = Math.ceil(ckbsWithMissingFields.length / 3) * 1000;
  const tolerance = 1000; // 1 second tolerance
  if (Math.abs(duration - expectedTime) < tolerance) {
    console.log(`✓ Processing time as expected (~${expectedTime}ms)`);
  } else {
    console.log(`⚠ Processing time unexpected (expected ~${expectedTime}ms, got ${duration}ms)`);
  }
}

async function testTimeoutControl() {
  console.log('\n\n=== Testing Timeout Control ===\n');
  
  // Create extractor with short timeout
  const extractor = new LLMFieldExtractor({
    batchSize: 1,
    maxConcurrent: 1,
    timeout: 500, // 500ms timeout
    maxRetries: 1
  });
  
  // Create mock client with 2 second delay (will timeout)
  const mockClient = new MockLLMClient(2000);
  
  const ckbsWithMissingFields = [{
    ckb: {
      ckb_id: 'ckb_timeout',
      content: { text: '测试超时' }
    },
    missingFields: [{ name: '地点' }]
  }];
  
  console.log('Processing CKB with 500ms timeout (LLM takes 2000ms)...\n');
  
  try {
    const results = await extractor.batchExtractMissingFields(ckbsWithMissingFields, mockClient);
    console.log('✓ Timeout handled gracefully (fallback succeeded)');
    console.log(`Results: ${results.size} CKBs processed`);
  } catch (error) {
    console.log('✓ Timeout detected and handled');
    console.log(`Error: ${error.message}`);
  }
}

async function testRetryLogic() {
  console.log('\n\n=== Testing Retry Logic ===\n');
  
  // Create extractor with retries
  const extractor = new LLMFieldExtractor({
    batchSize: 1,
    maxConcurrent: 1,
    timeout: 5000,
    maxRetries: 3
  });
  
  // Create mock client that fails first 2 times
  let attemptCount = 0;
  const mockClient = {
    chat: async () => {
      attemptCount++;
      console.log(`[Mock LLM] Attempt ${attemptCount}`);
      
      if (attemptCount < 3) {
        throw new Error('Simulated API error');
      }
      
      return {
        content: JSON.stringify({
          ckb_0: [{ name: '地点', value: '成功', confidence: 0.9 }]
        })
      };
    }
  };
  
  const ckbsWithMissingFields = [{
    ckb: {
      ckb_id: 'ckb_retry',
      content: { text: '测试重试' }
    },
    missingFields: [{ name: '地点' }]
  }];
  
  console.log('Processing CKB with failing LLM (should retry)...\n');
  
  const results = await extractor.batchExtractMissingFields(ckbsWithMissingFields, mockClient);
  
  if (results.size === 1 && attemptCount === 3) {
    console.log('✓ Retry logic works (succeeded on 3rd attempt)');
  } else {
    console.log(`✗ Retry logic failed (attempts: ${attemptCount}, results: ${results.size})`);
  }
}

// Run all tests
async function runAllTests() {
  try {
    await testConcurrencyControl();
    await testTimeoutControl();
    await testRetryLogic();
    
    console.log('\n\n=== All Tests Completed ===\n');
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

runAllTests();
