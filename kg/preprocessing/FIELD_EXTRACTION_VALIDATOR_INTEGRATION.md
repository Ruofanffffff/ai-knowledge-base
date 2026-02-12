# Field Extraction Validator Integration Guide

## Overview

The Field Extraction Validator validates field extraction completeness based on indexed text and supplements missing fields.

## Integration Points

### 1. In kg_service.js - After Schema-Aware Field Extraction

Add the validator after the schema-aware field extraction step (around line 170):

```javascript
const FieldExtractionValidator = require('../preprocessing/field_extraction_validator');

// ... existing code ...

// Step 2.5: Field Extraction Validation (NEW)
const enableFieldValidation = process.env.ENABLE_FIELD_VALIDATION === 'true' && llmClient;

if (enableFieldValidation) {
  console.log(`[KG Service] Validating field extraction completeness...`);
  const fieldValidator = new FieldExtractionValidator();
  
  // Get document index for this document
  const documentIndex = await getDocumentIndex(docId); // You need to implement this
  
  if (documentIndex && documentIndex.indexed_text) {
    const indexedText = documentIndex.indexed_text;
    
    // Prepare CKBs for batch validation
    const ckbsForValidation = ckbs.map(ckb => ({
      ckb,
      fields: ckb.extracted_fields || [],
      indexedText
    }));
    
    // Batch validate
    const validationResults = await fieldValidator.batchValidateFields(
      ckbsForValidation,
      llmClient,
      { maxConcurrency: 3 }
    );
    
    // Collect CKBs needing supplementation
    const ckbsNeedingSupplement = [];
    validationResults.forEach((result, ckbId) => {
      if (result.needsSupplement && result.missingFields.length > 0) {
        const ckb = ckbs.find(c => c.ckb_id === ckbId);
        if (ckb) {
          ckbsNeedingSupplement.push({
            ckb,
            missingFields: result.missingFields
          });
        }
      }
    });
    
    // Supplement missing fields
    if (ckbsNeedingSupplement.length > 0) {
      console.log(`[KG Service] Supplementing ${ckbsNeedingSupplement.length} CKBs with missing fields...`);
      
      for (const item of ckbsNeedingSupplement) {
        try {
          const supplementedFields = await fieldValidator.supplementFields(
            item.missingFields,
            item.ckb,
            llmClient
          );
          
          // Merge supplemented fields
          if (supplementedFields.length > 0) {
            item.ckb.extracted_fields = item.ckb.extracted_fields || [];
            supplementedFields.forEach(field => {
              const existing = item.ckb.extracted_fields.find(f => f.name === field.name);
              if (!existing) {
                item.ckb.extracted_fields.push(field);
              }
            });
          }
        } catch (error) {
          console.error(`[KG Service] Field supplementation failed for CKB ${item.ckb.ckb_id}:`, error);
        }
      }
    }
    
    // Log validation statistics
    const stats = fieldValidator.getValidationStats(validationResults);
    console.log(`[KG Service] Field validation stats:`, stats);
  } else {
    console.log(`[KG Service] No document index available, skipping field validation`);
  }
}

// Continue with existing LLM enhancement step...
```

### 2. Environment Variables

Add to `.env`:

```bash
# Field Extraction Validation
ENABLE_FIELD_VALIDATION=true
```

### 3. Document Index Retrieval

You need to implement a function to retrieve the document index:

```javascript
async function getDocumentIndex(docId) {
  try {
    const index = await prisma.documentIndex.findFirst({
      where: { doc_id: docId },
      orderBy: { created_at: 'desc' }
    });
    return index;
  } catch (error) {
    console.error('[KG Service] Failed to get document index:', error);
    return null;
  }
}
```

## Usage Example

```javascript
const FieldExtractionValidator = require('./kg/preprocessing/field_extraction_validator');

// Initialize validator
const validator = new FieldExtractionValidator({
  timeout: 15000,
  maxRetries: 2,
  coverageThreshold: 0.8
});

// Validate single CKB
const result = await validator.validateFields(
  extractedFields,
  indexedText,
  ckb,
  llmClient
);

if (result.needsSupplement) {
  const supplementedFields = await validator.supplementFields(
    result.missingFields,
    ckb,
    llmClient
  );
  
  // Merge supplemented fields
  extractedFields.push(...supplementedFields);
}

// Batch validation
const ckbsWithFields = [
  { ckb: ckb1, fields: fields1, indexedText },
  { ckb: ckb2, fields: fields2, indexedText }
];

const validationResults = await validator.batchValidateFields(
  ckbsWithFields,
  llmClient,
  { maxConcurrency: 3 }
);

// Get statistics
const stats = validator.getValidationStats(validationResults);
console.log('Validation stats:', stats);
```

## Configuration Options

```javascript
const validator = new FieldExtractionValidator({
  temperature: 0.1,           // LLM temperature
  timeout: 15000,             // LLM call timeout (ms)
  maxRetries: 2,              // Max retry attempts
  coverageThreshold: 0.8      // Coverage rate threshold
});
```

## Output Format

### Validation Result

```javascript
{
  isValid: true,              // Whether coverage meets threshold
  coverageRate: 0.85,         // Coverage rate (0-1)
  missingFields: [            // Missing fields
    {
      name: '时间',
      value: '2025年1月',
      type: 'time',
      confidence: 0.9,
      sourceIndex: 1,
      sources: ['llm_validation']
    }
  ],
  needsSupplement: true       // Whether supplementation is needed
}
```

### Validation Statistics

```javascript
{
  totalCKBs: 10,
  validCKBs: 8,
  invalidCKBs: 2,
  validRate: '0.80',
  totalMissingFields: 5,
  avgMissingFieldsPerCKB: '0.50',
  avgCoverageRate: '0.87'
}
```

## Error Handling

The validator handles errors gracefully:

1. **Missing indexed text**: Returns valid result, skips validation
2. **Missing LLM client**: Returns valid result, skips validation
3. **LLM errors**: Retries with exponential backoff, then returns valid result
4. **Parse errors**: Returns valid result with error message

This ensures the KG build process continues even if validation fails.

## Performance Considerations

1. **Batch processing**: Use `batchValidateFields` for multiple CKBs
2. **Concurrency control**: Set `maxConcurrency` to limit parallel LLM calls
3. **Timeout control**: Configure timeout to prevent long waits
4. **Smart triggering**: Only validate when indexed text is available

## Testing

Run tests:

```bash
npm test kg/preprocessing/__tests__/field_extraction_validator.test.js
```

All 17 tests should pass.
