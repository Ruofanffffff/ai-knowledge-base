/**
 * Debug script to investigate relation extraction issue
 */

const fs = require('fs');
const path = require('path');
const PromptBuilder = require('./prompt_builder');
const { createLLMClient } = require('./llm_client');
const ResultParser = require('./result_parser');

async function debugRelationExtraction() {
  console.log('=== Debug: Relation Extraction ===\n');
  
  // 1. Create test entities
  const testEntities = [
    {
      type: 'lens',
      name: 'SEL35F18F',
      properties: {
        focalLength: '35mm',
        maxAperture: 'F1.8'
      },
      confidence: 0.95
    },
    {
      type: 'technique',
      name: '街拍',
      properties: {
        description: '在街头捕捉日常生活瞬间的摄影方式'
      },
      confidence: 0.90
    },
    {
      type: 'scene',
      name: '室内弱光',
      properties: {
        description: '室内低光照环境'
      },
      confidence: 0.85
    }
  ];
  
  const testText = `35mm定焦镜头SEL35F18F是索尼E卡口的经典镜头，最大光圈F1.8，重量仅280g。
这支镜头非常适合街拍和人文摄影，在室内弱光环境下也能获得出色的表现。`;
  
  console.log('Test Entities:', JSON.stringify(testEntities, null, 2));
  console.log('\nTest Text:', testText);
  
  // 2. Build relation extraction prompt
  console.log('\n--- Step 1: Build Prompt ---');
  const promptBuilder = new PromptBuilder({ language: 'zh' });
  const relationPrompt = promptBuilder.buildRelationExtractionPrompt(testEntities, testText);
  
  console.log('Relation Prompt:');
  console.log(relationPrompt);
  console.log('\n' + '-'.repeat(80));
  
  // 3. Call LLM
  console.log('\n--- Step 2: Call LLM ---');
  const llmClient = createLLMClient({
    apiKey: process.env.QWEN_API_KEY || 'sk-43c76462bfad4a57bd2420c7fdb0aec4',
    model: 'qwen-plus',
    timeout: 30000
  });
  
  try {
    const response = await llmClient.call(relationPrompt, {
      temperature: 0.3,
      maxTokens: 1000
    });
    
    console.log('LLM Response:');
    console.log('Content:', response.content);
    console.log('Tokens:', response.tokens);
    console.log('Model:', response.model);
    console.log('\n' + '-'.repeat(80));
    
    // 4. Parse relations
    console.log('\n--- Step 3: Parse Relations ---');
    const parser = new ResultParser({ strictMode: false });
    const relations = parser.parseRelations(response.content);
    
    console.log('Parsed Relations:', JSON.stringify(relations, null, 2));
    console.log('Number of relations:', relations.length);
    
    if (relations.length === 0) {
      console.log('\n⚠️  WARNING: No relations extracted!');
      console.log('This indicates the issue is in either:');
      console.log('  1. LLM not returning relations in the expected format');
      console.log('  2. Parser not correctly extracting relations from response');
    } else {
      console.log('\n✅ Relations extracted successfully!');
    }
    
  } catch (error) {
    console.error('\n❌ Error during LLM call:', error.message);
    console.error(error.stack);
  }
  
  console.log('\n=== Debug Complete ===');
}

// Run if executed directly
if (require.main === module) {
  debugRelationExtraction()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Debug script failed:', error);
      process.exit(1);
    });
}

module.exports = { debugRelationExtraction };
