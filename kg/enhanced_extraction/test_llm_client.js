/**
 * Test LLM Client directly
 */

const { createQwenClient } = require('../utils/qwen_client');
const { LLMClient } = require('./llm_client');

console.log('Testing Qwen Client directly...');
const qwenClient = createQwenClient('sk-43c76462bfad4a57bd2420c7fdb0aec4', {
  model: 'qwen-plus',
  timeout: 10000
});

console.log('Qwen client created:', qwenClient);
console.log('Has call method?', typeof qwenClient.call);
console.log('Call method:', qwenClient.call);

console.log('\n\nTesting LLMClient...');
const llmClient = new LLMClient({
  apiKey: 'sk-43c76462bfad4a57bd2420c7fdb0aec4',
  model: 'qwen-plus',
  timeout: 10000
});

console.log('LLM client created:', llmClient);
console.log('Has client?', !!llmClient.client);
console.log('Client:', llmClient.client);
console.log('Client has call?', llmClient.client && typeof llmClient.client.call);

async function testCall() {
  try {
    console.log('\n\nTesting call...');
    const result = await llmClient.call('你好');
    console.log('Result:', result);
  } catch (error) {
    console.error('Call failed:', error.message);
    console.error(error.stack);
  }
}

testCall();
