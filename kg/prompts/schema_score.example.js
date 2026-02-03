/**
 * Example usage of schema_score.js
 * 
 * This file demonstrates how to use the Schema Scoring prompt module
 * in the context of the Schema-Driven Knowledge Graph system.
 */

const {
  buildSchemaScoringPrompt,
  buildSimplifiedPrompt,
  validateSchemaScoringResult,
  calculateRuleBasedCompleteness,
  getPromptStats
} = require('./schema_score');

// Example 1: Rule-based matching (preferred, 0 tokens)
console.log('=== Example 1: Rule-Based Schema Matching (0 Tokens) ===\n');

const fields = [
  { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95 },
  { name: '时间', value: '2025-01', type: 'time', confidence: 0.95 },
  { name: '指标', value: '水位', type: 'indicator', confidence: 0.95 },
  { name: '数值', value: '10', type: 'number', confidence: 0.95 },
  { name: '单位', value: '米', type: 'unit', confidence: 0.95 }
];

const schema = {
  schema_name: '地下水位变化事件',
  entity_type: 'EventEntity',
  threshold: 0.75,
  core_fields: [
    { name: '区域', weight: 0.3, required: true },
    { name: '时间', weight: 0.2, required: true },
    { name: '指标', weight: 0.2, required: true },
    { name: '数值', weight: 0.2, required: false },
    { name: '单位', weight: 0.1, required: false }
  ]
};

const sourceConfidence = 0.9;

const ruleBasedResult = calculateRuleBasedCompleteness(fields, schema, sourceConfidence);
console.log('Rule-based result:', JSON.stringify(ruleBasedResult, null, 2));
console.log('Should trigger entity?', ruleBasedResult.meets_threshold);
console.log('Token cost: 0\n');

// Example 2: When to use LLM scoring
console.log('=== Example 2: When LLM Scoring is Needed ===\n');

const candidateSchemas = [
  {
    schema_name: '地下水位变化事件',
    entity_type: 'EventEntity',
    threshold: 0.75,
    core_fields: [
      { name: '区域', weight: 0.3, required: true },
      { name: '时间', weight: 0.2, required: true },
      { name: '指标', weight: 0.2, required: true },
      { name: '数值', weight: 0.2, required: false },
      { name: '单位', weight: 0.1, required: false }
    ]
  },
  {
    schema_name: '区域环境监测',
    entity_type: 'MonitoringEntity',
    threshold: 0.7,
    core_fields: [
      { name: '区域', weight: 0.4, required: true },
      { name: '指标', weight: 0.3, required: true },
      { name: '数值', weight: 0.3, required: false }
    ]
  }
];

// Calculate rule-based scores for all candidates
const ruleBasedScores = candidateSchemas.map(s => 
  calculateRuleBasedCompleteness(fields, s, sourceConfidence)
);

console.log('Rule-based scores:');
ruleBasedScores.forEach(score => {
  console.log(`  ${score.schema_name}: ${score.completeness.toFixed(2)} (threshold: ${candidateSchemas.find(s => s.schema_name === score.schema_name).threshold})`);
});

// Check if LLM scoring is needed
const maxScore = Math.max(...ruleBasedScores.map(s => s.completeness));
const closeScores = ruleBasedScores.filter(s => Math.abs(s.completeness - maxScore) < 0.1);

if (closeScores.length > 1) {
  console.log('\n⚠️  Multiple schemas have similar scores - LLM scoring recommended');
  console.log('Close scores:', closeScores.map(s => s.schema_name).join(', '));
} else {
  console.log('\n✅ Clear winner - no LLM scoring needed');
  console.log('Winner:', ruleBasedScores.find(s => s.completeness === maxScore).schema_name);
}

// Example 3: Building LLM prompt (when needed)
console.log('\n=== Example 3: Building LLM Prompt ===\n');

const context = {
  text: '阿里C区2025年1月水位下降10米',
  sourceConfidence: 0.9
};

// Full prompt with examples
const fullPrompt = buildSchemaScoringPrompt(fields, candidateSchemas, context);
const fullStats = getPromptStats(fullPrompt);
console.log('Full prompt stats:');
console.log(`  Lines: ${fullStats.lines}`);
console.log(`  Characters: ${fullStats.chars}`);
console.log(`  Estimated tokens: ${fullStats.estimatedTokens}`);

// Simplified prompt (for batch processing)
const simplifiedPrompt = buildSimplifiedPrompt(fields, candidateSchemas, context);
const simplifiedStats = getPromptStats(simplifiedPrompt);
console.log('\nSimplified prompt stats:');
console.log(`  Lines: ${simplifiedStats.lines}`);
console.log(`  Characters: ${simplifiedStats.chars}`);
console.log(`  Estimated tokens: ${simplifiedStats.estimatedTokens}`);
console.log(`  Token savings: ${((1 - simplifiedStats.estimatedTokens / fullStats.estimatedTokens) * 100).toFixed(1)}%`);

// Example 4: Validating LLM response
console.log('\n=== Example 4: Validating LLM Response ===\n');

const llmResponse = {
  schema_scores: [
    {
      schema_name: '地下水位变化事件',
      match_score: 0.95,
      matched_fields: ['区域', '时间', '指标', '数值', '单位'],
      missing_fields: [],
      reasoning: '所有核心字段都已匹配，且字段语义完全对应水位变化事件'
    },
    {
      schema_name: '区域环境监测',
      match_score: 0.85,
      matched_fields: ['区域', '指标', '数值'],
      missing_fields: [],
      reasoning: '核心字段已匹配，但缺少时间维度，匹配度略低'
    }
  ],
  recommended_schemas: ['地下水位变化事件']
};

const { validResult, errors } = validateSchemaScoringResult(llmResponse, candidateSchemas);

if (errors.length === 0) {
  console.log('✅ Validation passed');
  console.log('Recommended schemas:', validResult.recommended_schemas);
  console.log('\nSchema scores:');
  validResult.schema_scores.forEach(score => {
    console.log(`  ${score.schema_name}: ${score.match_score}`);
    console.log(`    Matched: ${score.matched_fields.join(', ')}`);
    console.log(`    Missing: ${score.missing_fields.join(', ') || 'none'}`);
  });
} else {
  console.log('❌ Validation failed');
  console.log('Errors:', errors);
}

// Example 5: Decision flow
console.log('\n=== Example 5: Complete Decision Flow ===\n');

function shouldUseLLMScoring(ruleBasedScores, threshold = 0.1) {
  // Find schemas that meet their threshold
  const qualifyingSchemas = ruleBasedScores.filter(s => s.meets_threshold);
  
  if (qualifyingSchemas.length === 0) {
    return { useLLM: false, reason: 'No schemas meet threshold' };
  }
  
  if (qualifyingSchemas.length === 1) {
    return { useLLM: false, reason: 'Single clear match' };
  }
  
  // Check if scores are close
  const scores = qualifyingSchemas.map(s => s.completeness);
  const maxScore = Math.max(...scores);
  const minScore = Math.min(...scores);
  
  if (maxScore - minScore < threshold) {
    return { 
      useLLM: true, 
      reason: 'Multiple schemas with similar scores',
      candidates: qualifyingSchemas.map(s => s.schema_name)
    };
  }
  
  return { useLLM: false, reason: 'Clear score difference' };
}

const decision = shouldUseLLMScoring(ruleBasedScores);
console.log('Decision:', decision);

if (decision.useLLM) {
  console.log('\n📊 Use LLM scoring for:', decision.candidates.join(', '));
  console.log('Estimated token cost:', simplifiedStats.estimatedTokens);
} else {
  console.log('\n✅ Use rule-based result');
  console.log('Token cost: 0');
  const winner = ruleBasedScores.find(s => s.meets_threshold);
  if (winner) {
    console.log('Selected schema:', winner.schema_name);
  }
}

// Example 6: Token optimization strategy
console.log('\n=== Example 6: Token Optimization Strategy ===\n');

const batchSize = 10;
const estimatedTokensPerCKB = simplifiedStats.estimatedTokens;
const totalTokens = batchSize * estimatedTokensPerCKB;

console.log(`Processing ${batchSize} CKBs:`);
console.log(`  Rule-based only: 0 tokens`);
console.log(`  With LLM (all): ${totalTokens} tokens`);
console.log(`  With LLM (50% sampling): ${totalTokens * 0.5} tokens`);
console.log(`  With LLM (ambiguous only, ~20%): ${totalTokens * 0.2} tokens`);
console.log('\n💡 Recommendation: Use rule-based first, LLM only for ambiguous cases');
