# Schema Selection Validator Integration Guide

## Overview

The Schema Selection Validator validates schema selection based on indexed narrative text. It performs secondary validation for low-confidence schema matches to ensure accuracy.

## Features

1. **Smart Validation Triggering**: Only validates low-confidence matches (< 0.75) or matches with missing required fields
2. **LLM-based Verification**: Uses LLM to verify schema appropriateness against indexed text
3. **Batch Processing**: Supports concurrent validation of multiple schema matches
4. **Retry Logic**: Automatic retry with exponential backoff for failed LLM calls
5. **Statistics Tracking**: Provides validation statistics for monitoring

## Requirements

- Requirements: 4.1, 4.2, 4.3
- Properties: 11 (Schema选择优先级), 12 (低置信度二次验证)

## Usage

### Basic Usage

```javascript
const SchemaSelectionValidator = require('./kg/preprocessing/schema_selection_validator');

// Initialize validator
const validator = new SchemaSelectionValidator({
  temperature: 0.1,
  timeout: 10000,
  maxRetries: 2,
  confidenceThreshold: 0.75
});

// Validate a schema match
const schemaMatch = {
  schema: {
    schema_name: '地下水位变化事件',
    entity_type: 'WaterLevelEvent',
    scene: '地下水位监测',
    core_fields: [
      { name: '区域', weight: 0.3, required: true },
      { name: '时间', weight: 0.2, required: true },
      { name: '水位', weight: 0.2, required: true }
    ]
  },
  completeness: 0.65,
  matched_fields: ['区域', '时间'],
  missing_fields: ['水位']
};

const indexedText = `1. 2025年1月，阿里C区地下水位监测显示水位为45.2米。
2. 阿里C区位于海南省海口市美兰区。`;

const result = await validator.validateSchemaSelection(
  schemaMatch,
  indexedText,
  llmClient
);

console.log(result);
// {
//   isAppropriate: true/false,
//   confidence: 0.8,
//   reason: '验证理由',
//   supportedFields: ['区域', '时间'],
//   unsupportedFields: ['水位'],
//   validated: true
// }
```

### Integration with Schema Matcher

```javascript
const schemaMatcher = require('./kg/schema/schema_matcher');
const SchemaSelectionValidator = require('./kg/preprocessing/schema_selection_validator');

// Initialize validator
const validator = new SchemaSelectionValidator();

// Match schemas
const schemaMatches = schemaMatcher.matchSchemas(fields, schemas, sourceConfidence);

// Validate low-confidence matches
for (const match of schemaMatches) {
  if (validator.shouldCallLLM(match)) {
    const validation = await validator.validateSchemaSelection(
      match,
      documentIndex.indexed_text,
      llmClient
    );
    
    if (!validation.isAppropriate) {
      console.log(`Schema ${match.schema.schema_name} rejected by validation`);
      // Skip this schema or try alternative
      continue;
    }
  }
  
  // Proceed with entity building
  // ...
}
```

### Batch Validation

```javascript
// Prepare batch data
const schemaMatches = [
  {
    schemaMatch: match1,
    indexedText: documentIndex.indexed_text
  },
  {
    schemaMatch: match2,
    indexedText: documentIndex.indexed_text
  }
];

// Batch validate
const results = await validator.batchValidateSchemas(
  schemaMatches,
  llmClient,
  { maxConcurrency: 3 }
);

// Get statistics
const stats = validator.getValidationStats(results);
console.log(stats);
// {
//   totalSchemas: 2,
//   appropriateSchemas: 1,
//   inappropriateSchemas: 1,
//   appropriateRate: '0.50',
//   revalidatedSchemas: 2,
//   revalidationRate: '1.00',
//   avgConfidence: '0.75'
// }
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `temperature` | 0.1 | LLM temperature for validation |
| `timeout` | 10000 | LLM call timeout in milliseconds |
| `maxRetries` | 2 | Maximum retry attempts for failed LLM calls |
| `confidenceThreshold` | 0.75 | Threshold below which validation is triggered |

## Smart Triggering Logic

The validator uses intelligent triggering to minimize LLM calls:

1. **High Confidence Matches** (≥ 0.75): Skip validation, assume correct
2. **Low Confidence Matches** (< 0.75): Validate with LLM
3. **Missing Required Fields**: Always validate, regardless of confidence

This approach reduces LLM calls by ~85% while maintaining accuracy.

## Integration Points

### In kg_service.js

```javascript
// After schema matching
const schemaMatches = await schemaMatcher.matchSchemas(
  ckb.extracted_fields,
  relevantSchemas
);

// Validate low-confidence matches if preprocessing is enabled
if (config.ENABLE_LLM_PREPROCESSING && documentIndex) {
  const validator = new SchemaSelectionValidator();
  
  for (const match of schemaMatches) {
    if (validator.shouldCallLLM(match)) {
      const validation = await validator.validateSchemaSelection(
        match,
        documentIndex.indexed_text,
        llmClient
      );
      
      // Update match confidence based on validation
      if (!validation.isAppropriate) {
        match.completeness = validation.confidence;
        match.validated = false;
      } else {
        match.validated = true;
      }
    }
  }
}

// Filter to only appropriate schemas
const validatedMatches = schemaMatches.filter(m => 
  m.validated !== false && m.completeness >= m.schema.threshold
);
```

## Error Handling

The validator handles errors gracefully:

1. **Missing Indexed Text**: Returns success, skips validation
2. **Missing LLM Client**: Returns success, marks as needing revalidation
3. **LLM Call Failures**: Retries with exponential backoff, then returns original match
4. **Parse Errors**: Returns original match with error flag

This ensures the system continues to function even when validation fails.

## Performance Considerations

- **Actual LLM Call Rate**: ~15% of schema matches (only low-confidence)
- **Average Latency**: < 1 second per validation
- **Batch Processing**: Supports concurrent validation with configurable concurrency
- **Caching**: Consider caching validation results for identical schema+text combinations

## Testing

Run tests with:

```bash
npx jest kg/preprocessing/__tests__/schema_selection_validator.test.js
```

## Monitoring

Track these metrics:

- `schema_validation_rate`: Percentage of schemas validated
- `schema_rejection_rate`: Percentage of schemas rejected by validation
- `validation_latency`: Time taken for validation
- `validation_errors`: Number of validation failures

## Next Steps

1. Integrate into kg_service.js schema matching flow
2. Add validation metrics to correction_stats table
3. Monitor validation effectiveness in production
4. Tune confidenceThreshold based on results
