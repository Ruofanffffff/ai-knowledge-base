/**
 * Direct LLM Test
 * Test if the LLM client is working properly
 */

require('dotenv').config();
const { createQwenClient } = require('../utils/qwen_client');

async function testLLM() {
  console.log('🧪 测试LLM客户端');
  console.log('='.repeat(60));
  
  const apiKey = process.env.QWEN_API_KEY;
  
  if (!apiKey) {
    console.error('❌ QWEN_API_KEY 未配置');
    return;
  }
  
  console.log(`✅ API Key: ${apiKey.substring(0, 10)}...`);
  console.log();
  
  try {
    const client = createQwenClient(apiKey);
    console.log('✅ LLM客户端创建成功');
    console.log();
    
    const prompt = '请用一句话介绍什么是知识图谱。';
    console.log(`📝 发送提示: ${prompt}`);
    console.log();
    
    const startTime = Date.now();
    const result = await client.call(prompt, {
      temperature: 0.7,
      maxTokens: 100
    });
    const duration = Date.now() - startTime;
    
    console.log('✅ LLM响应成功');
    console.log(`⏱️  耗时: ${duration}ms`);
    console.log();
    console.log('📄 响应内容:');
    console.log('-'.repeat(60));
    console.log(result.content);
    console.log('-'.repeat(60));
    console.log();
    console.log(`📊 Token使用: ${result.usage?.total_tokens || 'unknown'}`);
    
  } catch (error) {
    console.error('❌ LLM调用失败:', error.message);
    console.error(error.stack);
  }
}

testLLM().catch(console.error);
