/**
 * Example usage of Prompt 4: Semantic Relation Candidate Extraction
 * 
 * This file demonstrates how to use the relation candidate extraction prompt
 * in various scenarios.
 */

const {
  buildRelationExtractionPrompt,
  buildSimplifiedPrompt,
  buildBatchPrompt,
  validateRelationExtractionResult,
  shouldUseLLMExtraction,
  getPromptStats
} = require('./relation_candidate');

// Example 1: Basic relation extraction with causal keywords
console.log('=== Example 1: Causal Relation ===\n');

const example1CKB = {
  content: {
    text: '阿里C区2025年1月水位下降10米，导致地下水资源严重减少'
  }
};

const example1Entities = [
  { canonical_name: '阿里C区水位下降', entity_type: 'EventEntity' },
  { canonical_name: '地下水资源', entity_type: 'IndicatorEntity' }
];

// Check if LLM should be used
const decision1 = shouldUseLLMExtraction(example1CKB, example1Entities);
console.log('Should use LLM:', decision1.shouldUse);
console.log('Reason:', decision1.reason);
console.log('Priority:', decision1.priority);
console.log();

if (decision1.shouldUse) {
  // Build full prompt
  const prompt1 = buildRelationExtractionPrompt(example1CKB, example1Entities);
  console.log('Full Prompt (first 500 chars):');
  console.log(prompt1.substring(0, 500) + '...\n');
  
  // Get prompt stats
  const stats1 = getPromptStats(prompt1);
  console.log('Prompt Stats:');
  console.log('- Lines:', stats1.lines);
  console.log('- Characters:', stats1.chars);
  console.log('- Estimated Tokens:', stats1.estimatedTokens);
  console.log();
  
  // Simulate LLM response
  const llmResponse1 = {
    relations: [
      {
        subject: '阿里C区水位下降',
        relation: '导致',
        object: '地下水资源',
        confidence: 0.95,
        evidence_text: '阿里C区2025年1月水位下降10米，导致地下水资源严重减少'
      }
    ]
  };
  
  // Validate response
  const validation1 = validateRelationExtractionResult(
    llmResponse1,
    example1Entities,
    example1CKB.content.text
  );
  
  console.log('Validation Result:');
  console.log('- Valid Relations:', validation1.validRelations.length);
  console.log('- Errors:', validation1.errors.length);
  console.log('- Relations:', JSON.stringify(validation1.validRelations, null, 2));
}

console.log('\n' + '='.repeat(60) + '\n');

// Example 2: Multi-entity scenario
console.log('=== Example 2: Multi-Entity Scenario ===\n');

const example2CKB = {
  content: {
    text: '张三在阿里巴巴担任高级工程师，负责开发知识图谱系统'
  }
};

const example2Entities = [
  { canonical_name: '张三', entity_type: 'PersonEntity' },
  { canonical_name: '阿里巴巴', entity_type: 'OrganizationEntity' },
  { canonical_name: '高级工程师', entity_type: 'entity' },
  { canonical_name: '知识图谱系统', entity_type: 'entity' }
];

const decision2 = shouldUseLLMExtraction(example2CKB, example2Entities);
console.log('Should use LLM:', decision2.shouldUse);
console.log('Reason:', decision2.reason);
console.log('Priority:', decision2.priority);
console.log();

if (decision2.shouldUse) {
  // Build simplified prompt (for batch processing)
  const prompt2 = buildSimplifiedPrompt(example2CKB, example2Entities);
  console.log('Simplified Prompt:');
  console.log(prompt2);
  console.log();
  
  const stats2 = getPromptStats(prompt2);
  console.log('Prompt Stats:');
  console.log('- Estimated Tokens:', stats2.estimatedTokens);
  console.log();
  
  // Simulate LLM response
  const llmResponse2 = {
    relations: [
      {
        subject: '张三',
        relation: '工作于',
        object: '阿里巴巴',
        confidence: 0.95,
        evidence_text: '张三在阿里巴巴担任高级工程师'
      },
      {
        subject: '张三',
        relation: '担任',
        object: '高级工程师',
        confidence: 0.95,
        evidence_text: '张三在阿里巴巴担任高级工程师'
      },
      {
        subject: '张三',
        relation: '负责',
        object: '知识图谱系统',
        confidence: 0.9,
        evidence_text: '张三负责开发知识图谱系统'
      }
    ]
  };
  
  const validation2 = validateRelationExtractionResult(
    llmResponse2,
    example2Entities,
    example2CKB.content.text
  );
  
  console.log('Validation Result:');
  console.log('- Valid Relations:', validation2.validRelations.length);
  validation2.validRelations.forEach((rel, i) => {
    console.log(`  ${i + 1}. ${rel.subject} --[${rel.relation}]--> ${rel.object} (${rel.confidence})`);
  });
}

console.log('\n' + '='.repeat(60) + '\n');

// Example 3: Batch processing
console.log('=== Example 3: Batch Processing ===\n');

const batchCKBs = [
  {
    content: { text: '阿里C区水位下降导致地下水资源减少' }
  },
  {
    content: { text: '北京市2024年GDP增长率优于2023年' }
  },
  {
    content: { text: '长江流域包括上海市、江苏省等地区' }
  }
];

const batchEntities = [
  [
    { canonical_name: '阿里C区水位下降', entity_type: 'EventEntity' },
    { canonical_name: '地下水资源', entity_type: 'IndicatorEntity' }
  ],
  [
    { canonical_name: '北京市', entity_type: 'LocationEntity' },
    { canonical_name: '2024年GDP增长率', entity_type: 'IndicatorEntity' },
    { canonical_name: '2023年GDP增长率', entity_type: 'IndicatorEntity' }
  ],
  [
    { canonical_name: '长江流域', entity_type: 'LocationEntity' },
    { canonical_name: '上海市', entity_type: 'LocationEntity' },
    { canonical_name: '江苏省', entity_type: 'LocationEntity' }
  ]
];

const batchPrompt = buildBatchPrompt(batchCKBs, batchEntities);
console.log('Batch Prompt (first 800 chars):');
console.log(batchPrompt.substring(0, 800) + '...\n');

const batchStats = getPromptStats(batchPrompt);
console.log('Batch Prompt Stats:');
console.log('- Estimated Tokens:', batchStats.estimatedTokens);
console.log('- Average Tokens per CKB:', Math.round(batchStats.estimatedTokens / batchCKBs.length));
console.log();

console.log('Note: Batch processing reduces token overhead by ~30-40% compared to individual calls');

console.log('\n' + '='.repeat(60) + '\n');

// Example 4: No relation scenario
console.log('=== Example 4: No Relation Scenario ===\n');

const example4CKB = {
  content: {
    text: '阿里C区水位10米，温度25度，湿度60%'
  }
};

const example4Entities = [
  { canonical_name: '阿里C区', entity_type: 'LocationEntity' },
  { canonical_name: '水位', entity_type: 'IndicatorEntity' },
  { canonical_name: '温度', entity_type: 'IndicatorEntity' },
  { canonical_name: '湿度', entity_type: 'IndicatorEntity' }
];

const decision4 = shouldUseLLMExtraction(example4CKB, example4Entities);
console.log('Should use LLM:', decision4.shouldUse);
console.log('Reason:', decision4.reason);
console.log();

if (decision4.shouldUse) {
  console.log('Even though LLM is triggered (multi-entity), the expected response is:');
  console.log(JSON.stringify({ relations: [] }, null, 2));
  console.log('\nReason: Entities are only listed in parallel, no explicit semantic relation');
}

console.log('\n' + '='.repeat(60) + '\n');

// Example 5: Token optimization comparison
console.log('=== Example 5: Token Optimization ===\n');

const exampleCKB = {
  content: {
    text: '2024年北京市GDP增长5.2%，相比2023年提升0.8个百分点'
  }
};

const exampleEntities = [
  { canonical_name: '北京市', entity_type: 'LocationEntity' },
  { canonical_name: '2024年GDP', entity_type: 'IndicatorEntity' },
  { canonical_name: '2023年GDP', entity_type: 'IndicatorEntity' }
];

const fullPrompt = buildRelationExtractionPrompt(exampleCKB, exampleEntities);
const simplifiedPrompt = buildSimplifiedPrompt(exampleCKB, exampleEntities);

const fullStats = getPromptStats(fullPrompt);
const simplifiedStats = getPromptStats(simplifiedPrompt);

console.log('Full Prompt:');
console.log('- Estimated Tokens:', fullStats.estimatedTokens);
console.log();

console.log('Simplified Prompt:');
console.log('- Estimated Tokens:', simplifiedStats.estimatedTokens);
console.log();

const tokenSavings = ((fullStats.estimatedTokens - simplifiedStats.estimatedTokens) / fullStats.estimatedTokens * 100).toFixed(1);
console.log(`Token Savings: ${tokenSavings}%`);
console.log();

console.log('Recommendation:');
console.log('- Use full prompt for: First-time extraction, complex scenarios, high accuracy requirements');
console.log('- Use simplified prompt for: Batch processing, well-understood patterns, token budget constraints');

console.log('\n' + '='.repeat(60) + '\n');

// Example 6: Validation error handling
console.log('=== Example 6: Validation Error Handling ===\n');

const invalidResponse = {
  relations: [
    {
      subject: '未知实体',  // Unknown entity
      relation: '导致',
      object: '地下水资源',
      confidence: 0.95,
      evidence_text: '测试'
    },
    {
      subject: '阿里C区水位下降',
      relation: '导致',
      object: '地下水资源',
      confidence: 0.5,  // Too low
      evidence_text: '测试'
    },
    {
      subject: '阿里C区水位下降',
      relation: '导致',
      object: '阿里C区水位下降',  // Self-reference
      confidence: 0.95,
      evidence_text: '测试'
    }
  ]
};

const validation = validateRelationExtractionResult(
  invalidResponse,
  example1Entities,
  example1CKB.content.text
);

console.log('Validation Result:');
console.log('- Valid Relations:', validation.validRelations.length);
console.log('- Errors:', validation.errors.length);
console.log();

console.log('Errors:');
validation.errors.forEach((error, i) => {
  console.log(`  ${i + 1}. ${error}`);
});

console.log('\n' + '='.repeat(60) + '\n');

console.log('Examples completed! See the code for implementation details.');
