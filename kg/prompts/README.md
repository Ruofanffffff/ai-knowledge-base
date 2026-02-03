# Knowledge Graph Prompts Module

This module contains all LLM prompts used in the Schema-Driven Knowledge Graph system. Each prompt is carefully designed to minimize token consumption while maximizing extraction accuracy.

## Overview

The prompts module follows the design principle of **"规则优先,LLM 兜底"** (Rules First, LLM Fallback), ensuring that LLM is only used when necessary to achieve the 90% token reduction goal.

## Prompts

### Prompt 1: Field Extraction (`extract_fields.js`)

**Purpose**: Extract structured fields from CKB (Contextual Knowledge Block) content.

**Status**: ✅ Implemented

**Usage**:
```javascript
const { buildFieldExtractionPrompt } = require('./kg/prompts/extract_fields');

// Build full prompt with examples
const prompt = buildFieldExtractionPrompt(
  '阿里C区2025年1月水位下降10米',
  existingFields
);

// Build simplified prompt (saves ~70% tokens)
const { buildSimplifiedPrompt } = require('./kg/prompts/extract_fields');
const simplifiedPrompt = buildSimplifiedPrompt(
  '阿里C区2025年1月水位下降10米',
  existingFields
);
```

**Key Features**:
- Extracts 6 field types: location, time, number, unit, indicator, entity
- Enforces "no inference" rule to prevent hallucination
- Standardizes time fields to ISO 8601 format
- Provides confidence scores (0-1) for each field
- Includes validation to ensure extracted values appear in original text

**Token Optimization**:
- Full prompt: ~800-1000 tokens (with examples)
- Simplified prompt: ~200-300 tokens (without examples)
- Use simplified prompt when processing large batches

**Validation**:
```javascript
const { validateExtractedFields } = require('./kg/prompts/extract_fields');

const result = validateExtractedFields(llmFields, originalText);
console.log(result.validFields); // Valid fields with source='llm'
console.log(result.errors);      // Validation errors/warnings
```

### Prompt 2: Schema Scoring (`schema_score.js`)

**Purpose**: Determine which schemas should be triggered based on extracted fields.

**Status**: ✅ Implemented (Task 5.2)

**Usage**:
```javascript
const { buildSchemaScoringPrompt, calculateRuleBasedCompleteness } = require('./kg/prompts/schema_score');

// First, try rule-based matching (preferred)
const ruleBasedResult = calculateRuleBasedCompleteness(fields, schema, sourceConfidence);

// Only use LLM when ambiguous (multiple schemas with similar scores)
if (needsLLMScoring) {
  const prompt = buildSchemaScoringPrompt(fields, candidateSchemas, context);
  // Call LLM with prompt...
}

// Build simplified prompt (saves ~60% tokens)
const simplifiedPrompt = buildSimplifiedPrompt(fields, candidateSchemas, context);
```

**Key Features**:
- Evaluates multiple candidate schemas against extracted fields
- Calculates match scores (0-1) for each schema
- Identifies matched and missing fields for each schema
- Provides reasoning for match scores
- Recommends which schemas should be triggered
- Includes rule-based completeness calculator (0 tokens)

**When to Use LLM Scoring**:
- Multiple schemas have similar completeness scores (within 0.1)
- Field-to-schema mapping is ambiguous
- Rule-based matching cannot confidently determine best schema
- **Do NOT use** when rule-based matching is clear

**Token Optimization**:
- Full prompt: ~1200-1500 tokens (with examples)
- Simplified prompt: ~400-600 tokens (without examples)
- Rule-based calculation: 0 tokens (preferred method)
- Use simplified prompt when processing large batches

**Validation**:
```javascript
const { validateSchemaScoringResult } = require('./kg/prompts/schema_score');

const result = validateSchemaScoringResult(llmResult, candidateSchemas);
console.log(result.validResult);  // Validated schema scores
console.log(result.errors);       // Validation errors/warnings
```

**Rule-Based Completeness** (Preferred):
```javascript
const { calculateRuleBasedCompleteness } = require('./kg/prompts/schema_score');

const result = calculateRuleBasedCompleteness(fields, schema, sourceConfidence);
// Returns: { schema_name, completeness, matched_fields, missing_fields, meets_threshold }
```

### Prompt 3: Entity Building (`entity_build.js`)

**Purpose**: Generate canonical names and aliases for entities, with LLM enhancement.

**Status**: ✅ Implemented (Task 5.3)

**Usage**:
```javascript
const { 
  buildEntityNamePrompt, 
  buildSimplifiedPrompt,
  buildEntityDisambiguationPrompt,
  shouldUseLLMStandardization 
} = require('./kg/prompts/entity_build');

// Check if LLM standardization is needed
const rawName = '阿里C区_水位_2025-01';
if (shouldUseLLMStandardization(rawName, 0.5)) {
  // Build full prompt with examples
  const prompt = buildEntityNamePrompt(
    rawName,
    'EventEntity',
    {
      text: '阿里C区2025年1月水位下降10米',
      fields: extractedFields,
      schema: matchedSchema
    }
  );
  
  // Or build simplified prompt (saves ~70% tokens)
  const simplifiedPrompt = buildSimplifiedPrompt(rawName, 'EventEntity', { text });
}

// Entity disambiguation (30% sampling)
if (Math.random() < 0.3) {
  const disambiguationPrompt = buildEntityDisambiguationPrompt(entity1, entity2);
  // Call LLM to determine if entities are the same...
}
```

**Key Features**:
- **Name Standardization**: Generates canonical names and 2-3 aliases
- **Entity Disambiguation**: Determines if two entities are the same (30% sampling)
- **Smart Sampling**: Always uses LLM for poorly formed names, random sampling for well-formed names (default 50%)
- **Entity Type Guidance**: Provides specific naming rules for each entity type (Event, Location, Person, Organization, Indicator)
- **Validation**: Ensures canonical names are valid, aliases are unique, and confidence scores are in range

**Token Optimization**:
- Full prompt: ~600-800 tokens (with examples)
- Simplified prompt: ~150-250 tokens (without examples)
- Disambiguation prompt: ~400-600 tokens (without examples)
- Use simplified prompt when processing large batches

**When to Use LLM Standardization**:
- Always: Name is poorly formed (multiple spaces, special characters, redundant words)
- 50% probability: Name is well-formed (random sampling for quality improvement)
- Configurable: Adjust sampling rate based on token budget

**Validation**:
```javascript
const { validateEntityNamingResult, validateDisambiguationResult } = require('./kg/prompts/entity_build');

// Validate entity naming result
const { validResult, errors } = validateEntityNamingResult(llmResponse, rawName);
if (validResult) {
  console.log(validResult.canonical_name);
  console.log(validResult.aliases);
}

// Validate disambiguation result
const { validResult, errors } = validateDisambiguationResult(llmResponse);
if (validResult && validResult.is_same) {
  // Merge entities using validResult.recommended_canonical_name
}
```

**Entity Types Supported**:
- `EventEntity`: Events or changes (format: 区域_指标_时间)
- `LocationEntity`: Geographic locations (standard place names)
- `PersonEntity`: Individuals (full names without titles)
- `OrganizationEntity`: Companies, institutions (official names)
- `IndicatorEntity`: Metrics or attributes (standard terminology)

**Design Notes**:
- Used in 50% of entity instantiations (random sampling)
- Generates 2-3 common aliases per entity
- Actual token usage: ~600-800 tokens (full), ~150-250 tokens (simplified)
- Disambiguation used in 30% of potential duplicates

### Prompt 4: Relation Extraction (`relation_candidate.js`)

**Purpose**: Extract semantic relations between entities using LLM.

**Status**: ✅ Implemented (Task 5.4)

**Usage**:
```javascript
const { 
  buildRelationExtractionPrompt,
  buildSimplifiedPrompt,
  buildBatchPrompt,
  shouldUseLLMExtraction 
} = require('./kg/prompts/relation_candidate');

// Check if LLM should be used (layered triggering)
const decision = shouldUseLLMExtraction(ckb, entities);
if (decision.shouldUse) {
  // Build full prompt with examples
  const prompt = buildRelationExtractionPrompt(ckb, entities);
  
  // Or build simplified prompt (saves ~60% tokens)
  const simplifiedPrompt = buildSimplifiedPrompt(ckb, entities);
  
  // Or batch process multiple CKBs (saves ~30-40% tokens)
  const batchPrompt = buildBatchPrompt(ckbBatch, entitiesBatch);
}
```

**Key Features**:
- **Layered Triggering Strategy**:
  - High priority (30%): Causal keywords (导致、因为、由于)
  - High priority (30%): Comparison keywords (优于、相比、不同于)
  - High priority (30%): Multi-entity scenarios (3+ entities)
  - Medium priority (20%): Random sampling to discover new patterns
- **6 Relation Types**: Causal, Influence, Comparison, Containment, Temporal, Spatial
- **Batch Processing**: Process up to 5 CKBs in a single LLM call
- **Strict Validation**: Ensures subject/object are known entities, evidence_text exists in original text
- **Confidence Threshold**: Only outputs relations with confidence ≥ 0.7
- **Direction Awareness**: Validates relation directionality (e.g., cause → effect)

**Token Optimization**:
- Full prompt: ~600-800 tokens (with examples)
- Simplified prompt: ~200-300 tokens (without examples)
- Batch prompt: ~400-600 tokens per CKB (30-40% savings vs individual calls)
- Use simplified prompt when processing large batches

**Validation**:
```javascript
const { validateRelationExtractionResult } = require('./kg/prompts/relation_candidate');

const result = validateRelationExtractionResult(llmResponse, entities, originalText);
console.log(result.validRelations); // Valid relations with confidence ≥ 0.7
console.log(result.errors);         // Validation errors/warnings
```

**Triggering Decision**:
```javascript
const { shouldUseLLMExtraction } = require('./kg/prompts/relation_candidate');

const decision = shouldUseLLMExtraction(ckb, entities, { samplingRate: 0.2 });
// Returns: { shouldUse: true/false, reason: 'causal_keywords'|'comparison_keywords'|'multi_entity'|'random_sampling'|'no_trigger', priority: 'high'|'medium'|'low' }
```

**Design Notes**:
- Triggered by causal/comparison keywords or multi-entity scenarios
- Includes validation rules to prevent false positives
- Actual token usage: ~600-800 tokens (full), ~200-300 tokens (simplified)
- Supports batch processing (up to 5 CKBs per request)
- Implements hybrid strategy: 50% LLM participation (30% high priority + 20% random sampling)

## Design Principles

### 1. No Inference Rule

All prompts enforce the **"不要推理"** (No Inference) rule:
- ❌ Wrong: Inferring "drought" from "water level decreased"
- ✅ Correct: Only extracting "water level" and "decreased"

### 2. Structured Output

All prompts require JSON output with strict schemas:
```json
{
  "fields": [
    {"name": "区域", "value": "阿里C区", "type": "location", "confidence": 0.95}
  ]
}
```

### 3. Confidence Scoring

All extracted data includes confidence scores:
- 0.9-1.0: Explicitly stated, no ambiguity
- 0.7-0.9: Stated but may have slight ambiguity
- 0.5-0.7: Requires context understanding
- < 0.5: Do not output (too uncertain)

### 4. Token Optimization

Each prompt provides multiple variants:
- **Full prompt**: Includes examples and detailed instructions (for accuracy)
- **Simplified prompt**: Minimal instructions (for batch processing)

Use simplified prompts when:
- Processing large batches (>10 CKBs)
- Token budget is limited
- Field types are well-understood

### 5. Validation

All prompts include validation functions to ensure:
- Required fields are present
- Field types are valid
- Confidence scores are in range [0, 1]
- Extracted values appear in original text (with warnings for normalized values)

## Token Usage Tracking

All LLM calls using these prompts should track token usage:

```javascript
const { trackTokenUsage } = require('./kg/field_extractor/llm_extractor');

await trackTokenUsage('field_extractor', ckbId, {
  prompt_tokens: 150,
  completion_tokens: 80,
  total_tokens: 230
});
```

This data is stored in the `kg_token_usage` table for monitoring and optimization.

## Testing

Each prompt module includes comprehensive tests:

```bash
# Run prompt tests
npm test -- kg/prompts/extract_fields.test.js

# Run all prompt tests
npm test -- kg/prompts/
```

Test coverage includes:
- Prompt generation with various options
- Field validation
- Token estimation
- Integration with field types

## Performance Metrics

Target metrics for the prompt system:

| Metric | Target | Current |
|--------|--------|---------|
| Token reduction vs. full LLM | 90% | TBD |
| Field extraction accuracy | >85% | TBD |
| Time standardization rate | >95% | TBD |
| False positive rate | <10% | TBD |

## Future Enhancements

1. **Prompt Caching**: Cache similar prompts to avoid redundant LLM calls
2. **Dynamic Prompt Selection**: Choose prompt variant based on CKB complexity
3. **Multi-language Support**: Add English prompts for international documents
4. **Prompt Versioning**: Track prompt versions for A/B testing

## References

- Design Document: `.kiro/specs/schema-driven-knowledge-graph/design.md`
- Requirements: `.kiro/specs/schema-driven-knowledge-graph/requirements.md`
- Task List: `.kiro/specs/schema-driven-knowledge-graph/tasks.md`
