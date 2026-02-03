/**
 * Example usage of entity_build.js
 * 
 * This file demonstrates how to use the entity building prompts
 * for standardizing entity names and disambiguating entities.
 */

const {
  buildEntityNamePrompt,
  buildSimplifiedPrompt,
  buildEntityDisambiguationPrompt,
  validateEntityNamingResult,
  validateDisambiguationResult,
  shouldUseLLMStandardization,
  getPromptStats
} = require('./entity_build');

// ============================================================================
// Example 1: Entity Name Standardization (Full Prompt)
// ============================================================================

console.log('='.repeat(80));
console.log('Example 1: Entity Name Standardization (Full Prompt)');
console.log('='.repeat(80));

const rawName1 = '阿里C区_水位_2025-01';
const entityType1 = 'EventEntity';
const context1 = {
  text: '阿里C区2025年1月水位下降10米',
  fields: [
    { name: '区域', value: '阿里C区', type: 'location' },
    { name: '时间', value: '2025-01', type: 'time' },
    { name: '指标', value: '水位', type: 'indicator' },
    { name: '变化', value: '下降', type: 'indicator' },
    { name: '数值', value: '10', type: 'number' },
    { name: '单位', value: '米', type: 'unit' }
  ],
  schema: { schema_name: '地下水位变化事件' }
};

const fullPrompt1 = buildEntityNamePrompt(rawName1, entityType1, context1);
console.log('\nGenerated Prompt:');
console.log(fullPrompt1.substring(0, 500) + '...\n');

const stats1 = getPromptStats(fullPrompt1);
console.log('Prompt Statistics:');
console.log(`  Lines: ${stats1.lines}`);
console.log(`  Characters: ${stats1.chars}`);
console.log(`  Estimated Tokens: ${stats1.estimatedTokens}`);

// Simulate LLM response
const llmResponse1 = {
  canonical_name: '阿里C区水位下降_2025-01',
  aliases: ['阿里C区水位变化', 'C区水位下降', '阿里C区2025年1月水位事件'],
  reasoning: '规范化为"区域+指标+变化+时间"格式，去除冗余词汇，生成简化和口语化别名'
};

console.log('\nSimulated LLM Response:');
console.log(JSON.stringify(llmResponse1, null, 2));

// Validate response
const { validResult: validResult1, errors: errors1 } = validateEntityNamingResult(llmResponse1, rawName1);
console.log('\nValidation Result:');
console.log(`  Valid: ${validResult1 !== null}`);
console.log(`  Errors: ${errors1.length === 0 ? 'None' : errors1.join(', ')}`);
if (validResult1) {
  console.log(`  Canonical Name: ${validResult1.canonical_name}`);
  console.log(`  Aliases: ${validResult1.aliases.join(', ')}`);
}

// ============================================================================
// Example 2: Entity Name Standardization (Simplified Prompt)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('Example 2: Entity Name Standardization (Simplified Prompt)');
console.log('='.repeat(80));

const rawName2 = '北京市';
const entityType2 = 'LocationEntity';
const context2 = {
  text: '北京市2024年GDP增长5.2%'
};

const simplifiedPrompt2 = buildSimplifiedPrompt(rawName2, entityType2, context2);
console.log('\nGenerated Simplified Prompt:');
console.log(simplifiedPrompt2);

const stats2 = getPromptStats(simplifiedPrompt2);
console.log('\nPrompt Statistics:');
console.log(`  Lines: ${stats2.lines}`);
console.log(`  Characters: ${stats2.chars}`);
console.log(`  Estimated Tokens: ${stats2.estimatedTokens}`);
console.log(`  Token Savings: ${Math.round((1 - stats2.estimatedTokens / stats1.estimatedTokens) * 100)}% vs full prompt`);

// Simulate LLM response
const llmResponse2 = {
  canonical_name: '北京市',
  aliases: ['北京', '首都', '京'],
  reasoning: '原始名称已经规范，保持不变，添加常见简称和别称'
};

console.log('\nSimulated LLM Response:');
console.log(JSON.stringify(llmResponse2, null, 2));

// ============================================================================
// Example 3: Entity Disambiguation (Same Entity)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('Example 3: Entity Disambiguation (Same Entity)');
console.log('='.repeat(80));

const entity1 = {
  canonical_name: '阿里巴巴',
  aliases: ['阿里', 'Alibaba'],
  attributes: { type: '公司', industry: '互联网' }
};

const entity2 = {
  canonical_name: '阿里巴巴集团',
  aliases: ['阿里集团', '阿里'],
  attributes: { type: '公司', industry: '科技' }
};

const disambiguationPrompt1 = buildEntityDisambiguationPrompt(entity1, entity2, { includeExamples: false });
console.log('\nGenerated Disambiguation Prompt (without examples):');
console.log(disambiguationPrompt1.substring(0, 800) + '...\n');

const stats3 = getPromptStats(disambiguationPrompt1);
console.log('Prompt Statistics:');
console.log(`  Estimated Tokens: ${stats3.estimatedTokens}`);

// Simulate LLM response
const disambiguationResponse1 = {
  is_same: true,
  confidence: 0.95,
  reasoning: '两个实体都指向阿里巴巴公司，别名重叠（"阿里"），属性相似（都是公司，行业相关），只是名称表述略有不同',
  recommended_canonical_name: '阿里巴巴'
};

console.log('\nSimulated LLM Response:');
console.log(JSON.stringify(disambiguationResponse1, null, 2));

// Validate response
const { validResult: validResult3, errors: errors3 } = validateDisambiguationResult(disambiguationResponse1);
console.log('\nValidation Result:');
console.log(`  Valid: ${validResult3 !== null}`);
console.log(`  Errors: ${errors3.length === 0 ? 'None' : errors3.join(', ')}`);
if (validResult3) {
  console.log(`  Same Entity: ${validResult3.is_same}`);
  console.log(`  Confidence: ${validResult3.confidence}`);
  console.log(`  Recommended Name: ${validResult3.recommended_canonical_name}`);
}

// ============================================================================
// Example 4: Entity Disambiguation (Different Entities)
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('Example 4: Entity Disambiguation (Different Entities)');
console.log('='.repeat(80));

const entity3 = {
  canonical_name: '北京市',
  aliases: ['北京', '首都'],
  attributes: { type: '城市', level: '直辖市' }
};

const entity4 = {
  canonical_name: '北京大学',
  aliases: ['北大', 'PKU'],
  attributes: { type: '大学', location: '北京' }
};

console.log('\nEntity 1:', JSON.stringify(entity3, null, 2));
console.log('\nEntity 2:', JSON.stringify(entity4, null, 2));

// Simulate LLM response
const disambiguationResponse2 = {
  is_same: false,
  confidence: 0.98,
  reasoning: '虽然都包含"北京"，但实体类型完全不同（城市 vs 大学），属性无重叠，是两个不同的实体',
  recommended_canonical_name: null
};

console.log('\nSimulated LLM Response:');
console.log(JSON.stringify(disambiguationResponse2, null, 2));

// Validate response
const { validResult: validResult4, errors: errors4 } = validateDisambiguationResult(disambiguationResponse2);
console.log('\nValidation Result:');
console.log(`  Valid: ${validResult4 !== null}`);
console.log(`  Same Entity: ${validResult4.is_same}`);
console.log(`  Confidence: ${validResult4.confidence}`);

// ============================================================================
// Example 5: Deciding When to Use LLM Standardization
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('Example 5: Deciding When to Use LLM Standardization');
console.log('='.repeat(80));

const testNames = [
  '阿里C区',           // Well-formed
  '阿里  C区',         // Multiple spaces (poorly formed)
  '水位下降!',         // Special characters (poorly formed)
  '测试的',            // Ends with redundant word (poorly formed)
  'GDP',               // Well-formed
  '北京市'             // Well-formed
];

console.log('\nTesting with 50% sampling rate:');
testNames.forEach(name => {
  const shouldUse = shouldUseLLMStandardization(name, 0.5);
  console.log(`  "${name}": ${shouldUse ? 'Use LLM' : 'Skip LLM'}`);
});

console.log('\nTesting with 0% sampling rate (only poorly formed names):');
testNames.forEach(name => {
  const shouldUse = shouldUseLLMStandardization(name, 0);
  console.log(`  "${name}": ${shouldUse ? 'Use LLM' : 'Skip LLM'}`);
});

console.log('\nTesting with 100% sampling rate (all names):');
testNames.forEach(name => {
  const shouldUse = shouldUseLLMStandardization(name, 1.0);
  console.log(`  "${name}": ${shouldUse ? 'Use LLM' : 'Skip LLM'}`);
});

// ============================================================================
// Example 6: Token Consumption Comparison
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('Example 6: Token Consumption Comparison');
console.log('='.repeat(80));

const testCases = [
  {
    name: 'Full prompt with examples',
    prompt: buildEntityNamePrompt('测试', 'EventEntity', { text: '测试文本' }, { includeExamples: true })
  },
  {
    name: 'Full prompt without examples',
    prompt: buildEntityNamePrompt('测试', 'EventEntity', { text: '测试文本' }, { includeExamples: false })
  },
  {
    name: 'Simplified prompt',
    prompt: buildSimplifiedPrompt('测试', 'EventEntity', { text: '测试文本' })
  }
];

console.log('\nToken consumption comparison:');
testCases.forEach(testCase => {
  const stats = getPromptStats(testCase.prompt);
  console.log(`\n${testCase.name}:`);
  console.log(`  Characters: ${stats.chars}`);
  console.log(`  Estimated Tokens: ${stats.estimatedTokens}`);
});

const fullTokens = getPromptStats(testCases[0].prompt).estimatedTokens;
const simplifiedTokens = getPromptStats(testCases[2].prompt).estimatedTokens;
const savings = Math.round((1 - simplifiedTokens / fullTokens) * 100);

console.log(`\nToken savings (simplified vs full): ${savings}%`);
console.log(`Expected savings: ~70%`);

// ============================================================================
// Summary
// ============================================================================

console.log('\n' + '='.repeat(80));
console.log('Summary');
console.log('='.repeat(80));

console.log(`
Key Features:
1. Entity Name Standardization
   - Generates canonical names and 2-3 aliases
   - Removes redundant words and standardizes format
   - Used in 50% of entity instantiations (random sampling)

2. Entity Disambiguation
   - Determines if two entities are the same
   - Provides confidence scores and reasoning
   - Used in 30% of potential duplicates (cost control)

3. Token Optimization
   - Full prompt: ~800-1000 tokens (with examples)
   - Simplified prompt: ~200-300 tokens (without examples)
   - ~70% token savings with simplified prompts

4. Validation
   - Validates canonical names and aliases
   - Ensures confidence scores are in valid range
   - Filters out invalid data automatically

5. Smart Sampling
   - Always uses LLM for poorly formed names
   - Random sampling for well-formed names (default 50%)
   - Configurable sampling rate for cost control

Usage Recommendations:
- Use full prompts for initial testing and quality assessment
- Use simplified prompts for batch processing (>10 entities)
- Adjust sampling rate based on token budget and quality requirements
- Always validate LLM responses before using them
`);

console.log('='.repeat(80));
