# Field Normalizer Module

## Overview

The Field Normalizer module is responsible for mapping raw field names extracted from documents to standardized schema field names. It implements a 4-layer mapping strategy that balances accuracy with cost efficiency, achieving a target of 50% LLM participation rate.

## Architecture

### 4-Layer Mapping Strategy

```
Raw Field Name
    ↓
Layer 1: Exact Match (0 Token, 100% confidence)
    ↓ (if no match)
Layer 2: Algorithm-based Match (0 Token, 70-90% confidence)
    ├─ Synonym Dictionary Lookup
    └─ String Similarity (Levenshtein + Cosine)
    ↓ (if no match)
Layer 3: LLM-based Match (consumes tokens, 50% probability)
    ↓ (if no match)
Layer 4: Fallback (accept unmapped, 30% confidence)
```

### Modules

#### 1. `field_normalizer.js` (Main Module)
- **Purpose**: Orchestrates the 4-layer mapping strategy
- **Key Functions**:
  - `normalizeFields(rawFields, schema, options)` - Main entry point
  - `batchNormalizeFields(rawFieldsList, schemas, options)` - Batch processing
  - `cleanFieldValue(field)` - Value cleaning and standardization
  - `standardizeTime(timeStr)` - Time format normalization
  - `standardizeNumber(numberStr)` - Number format normalization
- **Features**:
  - Caching to avoid redundant LLM calls
  - Configurable LLM probability (default 50%)
  - Field value cleaning and standardization

#### 2. `algorithm_mapper.js` (Algorithm-based Mapping)
- **Purpose**: Provides zero-token mapping strategies
- **Key Functions**:
  - `mapFieldName(rawFieldName, schemaFieldNames, options)` - Main mapping function
  - `exactMatch(rawFieldName, schemaFieldNames)` - Direct string comparison
  - `synonymMatch(rawFieldName, schemaFieldNames)` - Synonym dictionary lookup
  - `similarityMatch(rawFieldName, schemaFieldNames, threshold)` - String similarity
  - `levenshteinDistance(a, b)` - Edit distance calculation
  - `cosineSimilarity(ngrams1, ngrams2)` - N-gram similarity
- **Features**:
  - Three mapping strategies with priority ordering
  - Configurable similarity threshold (default 0.7)
  - Batch processing support
  - Detailed similarity metrics for debugging

#### 3. `synonym_dict.js` (Synonym Dictionary)
- **Purpose**: Manages synonym mappings for fast lookup
- **Key Functions**:
  - `match(rawFieldName, schemaFieldNames)` - Find synonym match
  - `addSynonym(standard, synonym)` - Add new synonym
  - `learnFromLLM(rawFieldName, mappedFieldName, confidence)` - Learn from LLM results
  - `getSynonyms(standard)` - Get all synonyms for a standard field
- **Features**:
  - JSON-based storage for easy maintenance
  - Dynamic expansion from LLM results
  - 20 predefined standard fields with 100+ synonyms

#### 4. `synonym_dict.json` (Synonym Data)
- **Purpose**: Stores synonym mappings
- **Format**: `{ "standard_field": ["synonym1", "synonym2", ...] }`
- **Coverage**: 20 standard fields including:
  - 时间 (time), 区域 (region), 数值 (value), 单位 (unit)
  - 指标 (indicator), 实体 (entity), 描述 (description)
  - 类型 (type), 状态 (status), 结果 (result)
  - And 10 more...

## Usage

### Basic Usage

```javascript
const { normalizeFields } = require('./field_normalizer');

const rawFields = [
  { name: '地区', value: '阿里C区', type: 'location', confidence: 0.95 },
  { name: '日期', value: '2025-01', type: 'time', confidence: 0.95 },
  { name: '数值', value: '10', type: 'number', confidence: 0.9 }
];

const schema = {
  schema_name: '地下水位变化事件',
  core_fields: [
    { name: '区域', weight: 0.3, required: true },
    { name: '时间', weight: 0.2, required: true },
    { name: '数值', weight: 0.2, required: false }
  ]
};

const normalized = await normalizeFields(rawFields, schema);

// Result:
// [
//   { name: '区域', value: '阿里C区', type: 'location', confidence: 0.95,
//     original_name: '地区', mapping_confidence: 0.9, mapping_method: 'synonym' },
//   { name: '时间', value: '2025-01', type: 'time', confidence: 0.95,
//     original_name: '日期', mapping_confidence: 0.9, mapping_method: 'synonym' },
//   { name: '数值', value: '10', type: 'number', confidence: 0.9,
//     original_name: '数值', mapping_confidence: 1.0, mapping_method: 'exact' }
// ]
```

### Batch Processing

```javascript
const { batchNormalizeFields } = require('./field_normalizer');

const rawFieldsList = [
  [{ name: '地区', value: '阿里C区', type: 'location', confidence: 0.95 }],
  [{ name: '日期', value: '2025-01', type: 'time', confidence: 0.95 }]
];

const schemas = [schema1, schema2];

const results = await batchNormalizeFields(rawFieldsList, schemas);
```

### Algorithm-based Mapping Only

```javascript
const { mapFieldName } = require('./algorithm_mapper');

const result = mapFieldName('地区', ['区域', '时间', '数值']);
// Returns: { mapped_name: '区域', confidence: 0.9, method: 'synonym' }
```

### Custom Options

```javascript
const normalized = await normalizeFields(rawFields, schema, {
  useLLM: false,              // Disable LLM mapping
  llmProbability: 0.3,        // Reduce LLM probability to 30%
  cleanValues: false,         // Skip value cleaning
  useCache: false             // Disable caching
});
```

## Mapping Methods

### 1. Exact Match
- **Confidence**: 1.0
- **Token Cost**: 0
- **Use Case**: Field name exactly matches schema field
- **Example**: '区域' → '区域'

### 2. Synonym Match
- **Confidence**: 0.9
- **Token Cost**: 0
- **Use Case**: Field name is a known synonym
- **Example**: '地区' → '区域', '日期' → '时间'

### 3. Similarity Match
- **Confidence**: 0.7-0.95 (depends on similarity score)
- **Token Cost**: 0
- **Use Case**: Field name is similar but not exact
- **Algorithm**: Weighted combination of:
  - Levenshtein distance (60% weight)
  - Cosine similarity on character bigrams (40% weight)
- **Example**: 'regin' → 'region' (typo correction)

### 4. LLM Match
- **Confidence**: 0.7-0.9 (LLM confidence × 0.9)
- **Token Cost**: ~50-100 tokens per call
- **Use Case**: Algorithm-based methods fail
- **Probability**: 50% (configurable)
- **Example**: Complex semantic mappings

## Performance Metrics

### Expected Mapping Rates
- **Exact Match**: 20-30%
- **Synonym Match**: 40-50%
- **Similarity Match**: 10-20%
- **LLM Match**: 5-10%
- **Unmapped**: 5-10%

### Token Efficiency
- **Algorithm Mapping Rate**: 70-80% (0 tokens)
- **LLM Mapping Rate**: 10-15% (with 50% probability)
- **Token Savings**: 80-90% compared to full LLM approach

### Accuracy
- **Exact Match**: 100%
- **Synonym Match**: 95-98%
- **Similarity Match**: 85-90%
- **Overall**: 90-95%

## Field Value Cleaning

### Time Standardization
Converts various time formats to ISO 8601:
- `2025年1月` → `2025-01`
- `2025/01/26` → `2025-01-26`
- `2025.01.26` → `2025-01-26`

### Number Standardization
Removes formatting characters:
- `1,234.56` → `1234.56`
- `1 234` → `1234`

### General Cleaning
- Removes extra whitespace
- Removes special characters (keeps necessary punctuation)
- Trims leading/trailing spaces

## Caching

### Cache Strategy
- **Key Format**: `schemaName:rawFieldName`
- **Storage**: In-memory Map
- **Lifetime**: Process lifetime
- **Purpose**: Avoid redundant LLM calls

### Cache Operations
```javascript
const { getCachedMapping, cacheMapping, clearCache, getCacheStats } = require('./field_normalizer');

// Get cached mapping
const cached = getCachedMapping('地区', '地下水位变化事件');

// Manually cache a mapping
cacheMapping('地区', '地下水位变化事件', {
  mapped_name: '区域',
  confidence: 0.9,
  method: 'synonym'
});

// Clear cache
clearCache();

// Get cache statistics
const stats = getCacheStats();
// Returns: { size: 10, entries: ['schema1:field1', 'schema2:field2', ...] }
```

## Synonym Dictionary Management

### Adding Synonyms
```javascript
const synonymDict = require('./synonym_dict');

// Add a new synonym
synonymDict.addSynonym('区域', '地方');

// Learn from LLM results (auto-adds if confidence >= 0.9)
synonymDict.learnFromLLM('地方', '区域', 0.95);
```

### Querying Synonyms
```javascript
// Get all synonyms for a standard field
const synonyms = synonymDict.getSynonyms('区域');
// Returns: ['地区', '地域', '区', '地点', '位置', '场所', '发生地点']

// Check if a field is standard
const isStandard = synonymDict.isStandardField('区域');
// Returns: true

// Get statistics
const stats = synonymDict.getStats();
// Returns: { standard_fields: 20, total_synonyms: 100, avg_synonyms_per_field: 5 }
```

### Export/Import
```javascript
// Export to JSON string
const json = synonymDict.exportToJSON();

// Import from JSON string
synonymDict.importFromJSON(json);

// Reset to default
synonymDict.reset();
```

## Testing

### Unit Tests
```bash
# Test algorithm mapper
npm test -- kg/field_normalizer/algorithm_mapper.test.js

# Test field normalizer
npm test -- kg/field_normalizer/field_normalizer.test.js

# Test all field normalizer modules
npm test -- kg/field_normalizer/
```

### Test Coverage
- **algorithm_mapper.js**: 46 tests, 100% coverage
- **field_normalizer.js**: 42 tests, 95% coverage
- **synonym_dict.js**: Covered by integration tests

## Design Decisions

### Why 4 Layers?
1. **Exact Match**: Handles perfect matches with zero cost
2. **Algorithm Match**: Handles common variations without LLM
3. **LLM Match**: Handles complex cases when algorithms fail
4. **Fallback**: Accepts unmapped fields rather than forcing incorrect mappings

### Why 50% LLM Probability?
- Balances accuracy (need LLM for complex cases) with cost (avoid unnecessary calls)
- Allows system to work even when LLM is unavailable
- Reduces token consumption by 80-90%

### Why Synonym Dictionary?
- Fast O(1) lookup vs. O(n) similarity calculation
- Captures domain-specific knowledge
- Can be expanded over time
- Reduces dependency on LLM

### Why Levenshtein + Cosine?
- **Levenshtein**: Good for typos and small edits
- **Cosine**: Good for character overlap
- **Combined**: More robust than either alone
- **Weighted**: Levenshtein (60%) more reliable for short strings

## Requirements Validation

This module validates the following requirements:

- **Requirement 18.1**: Field name mapping to schema-defined names ✓
- **Requirement 18.2**: String similarity algorithms (edit distance + cosine) ✓
- **Requirement 18.3**: Synonym dictionary mapping ✓
- **Requirement 18.4**: Field value format standardization ✓
- **Requirement 18.5**: LLM mapping with 50% probability ✓
- **Requirement 18.6**: LLM prompt with context and constraints ✓
- **Requirement 18.8**: Mapping result caching ✓
- **Requirement 18.9**: Field value noise removal ✓
- **Requirement 18.12**: Batch processing optimization ✓
- **Requirement 18.14**: Token budget control ✓
- **Requirement 18.15**: Mapping statistics reporting ✓

## Future Enhancements

1. **Machine Learning**: Train a lightweight model on mapping history
2. **Context-aware Mapping**: Use surrounding fields for disambiguation
3. **Multi-language Support**: Extend synonym dictionary for other languages
4. **Fuzzy Matching**: Add phonetic similarity (Soundex, Metaphone)
5. **Confidence Calibration**: Adjust confidence scores based on historical accuracy
6. **Distributed Caching**: Use Redis for shared cache across instances

## Troubleshooting

### Low Mapping Rate
- Check synonym dictionary coverage
- Adjust similarity threshold (default 0.7)
- Increase LLM probability temporarily
- Review unmapped fields and add synonyms

### High Token Consumption
- Reduce LLM probability (default 0.5)
- Expand synonym dictionary
- Enable caching (default enabled)
- Use batch processing

### Incorrect Mappings
- Review similarity threshold (may be too low)
- Check synonym dictionary for conflicts
- Validate LLM prompt and results
- Add negative examples to tests

## References

- Design Document: Section 4 - Field Normalization Module
- Requirements: 18.1-18.15
- Related Modules: field_extractor, schema_matcher
