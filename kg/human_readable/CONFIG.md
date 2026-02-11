# Human-Readable Knowledge Graph Configuration

This document describes the configuration options for the Human-Readable Knowledge Graph enhancement features.

## Environment Variables

### Entity Name Standardization

**ENABLE_ENTITY_NAME_STANDARDIZATION**
- Type: `boolean`
- Default: `true`
- Description: Enable/disable entity name standardization feature
- When enabled: Entity names are standardized using algorithm-based and LLM-based methods
- When disabled: Original entity names are preserved

### Relation Description Generation

**ENABLE_RELATION_DESCRIPTIONS**
- Type: `boolean`
- Default: `true`
- Description: Enable/disable relation description generation
- When enabled: All relations get human-readable descriptions
- When disabled: Relations are created without descriptions

**DESCRIPTION_GENERATION_METHOD**
- Type: `string`
- Options: `auto`, `template`, `llm`
- Default: `auto`
- Description: Method for generating relation descriptions
  - `auto`: Try template first, use LLM if template confidence is low
  - `template`: Use only template-based generation (0 token cost)
  - `llm`: Use only LLM-based generation (requires LLM client)

**ENABLE_RELATION_DESCRIPTION_LLM**
- Type: `boolean`
- Default: `false`
- Description: Enable/disable LLM for relation description generation
- When enabled: LLM can be used for description generation (in `auto` or `llm` mode)
- When disabled: Only template-based generation is available

**RELATION_DESCRIPTION_LANGUAGE**
- Type: `string`
- Options: `zh`, `en`
- Default: `zh`
- Description: Language for relation descriptions
  - `zh`: Chinese descriptions
  - `en`: English descriptions

### Hierarchical Relation Extraction

**ENABLE_HIERARCHICAL_EXTRACTION**
- Type: `boolean`
- Default: `false`
- Description: Enable/disable hierarchical relation extraction
- When enabled: System extracts is_a, part_of, and has_property relationships
- When disabled: Only standard relations are extracted

**HIERARCHICAL_EXTRACTION_METHOD**
- Type: `string`
- Options: `pattern`, `llm`, `hybrid`
- Default: `pattern`
- Description: Method for extracting hierarchical relationships
  - `pattern`: Use only pattern-based extraction (regex, dependency parsing)
  - `llm`: Use only LLM-based inference (requires LLM client)
  - `hybrid`: Use both pattern and LLM methods for maximum coverage

**HIERARCHICAL_MIN_CONFIDENCE**
- Type: `number`
- Range: `0.0` to `1.0`
- Default: `0.7`
- Description: Minimum confidence threshold for hierarchical relations
- Relations with confidence below this threshold are filtered out

## Configuration Examples

### Minimal Configuration (Template-only, 0 Token Cost)

```bash
ENABLE_ENTITY_NAME_STANDARDIZATION=true
ENABLE_RELATION_DESCRIPTIONS=true
DESCRIPTION_GENERATION_METHOD=template
ENABLE_RELATION_DESCRIPTION_LLM=false
RELATION_DESCRIPTION_LANGUAGE=zh
ENABLE_HIERARCHICAL_EXTRACTION=false
```

This configuration:
- Enables entity name standardization
- Enables relation descriptions using templates only
- No LLM calls for descriptions (0 token cost)
- Disables hierarchical extraction
- Chinese language

### Balanced Configuration (Auto Mode)

```bash
ENABLE_ENTITY_NAME_STANDARDIZATION=true
ENABLE_RELATION_DESCRIPTIONS=true
DESCRIPTION_GENERATION_METHOD=auto
ENABLE_RELATION_DESCRIPTION_LLM=true
RELATION_DESCRIPTION_LANGUAGE=zh
ENABLE_HIERARCHICAL_EXTRACTION=true
HIERARCHICAL_EXTRACTION_METHOD=pattern
HIERARCHICAL_MIN_CONFIDENCE=0.7
QWEN_API_KEY=your_api_key_here
```

This configuration:
- Enables entity name standardization
- Enables relation descriptions with auto mode
- Uses templates first, falls back to LLM for low-confidence cases
- Enables hierarchical extraction with pattern-based method
- No LLM calls for hierarchical extraction (0 additional token cost)
- Requires LLM API key for relation descriptions only

### Maximum Quality Configuration (LLM-only)

```bash
ENABLE_ENTITY_NAME_STANDARDIZATION=true
ENABLE_RELATION_DESCRIPTIONS=true
DESCRIPTION_GENERATION_METHOD=llm
ENABLE_RELATION_DESCRIPTION_LLM=true
RELATION_DESCRIPTION_LANGUAGE=zh
ENABLE_HIERARCHICAL_EXTRACTION=true
HIERARCHICAL_EXTRACTION_METHOD=hybrid
HIERARCHICAL_MIN_CONFIDENCE=0.6
QWEN_API_KEY=your_api_key_here
```

This configuration:
- Enables entity name standardization
- Enables relation descriptions using LLM only
- Enables hierarchical extraction with hybrid method (pattern + LLM)
- Highest quality descriptions and hierarchical relations
- Higher token cost for both descriptions and hierarchical extraction
- Requires LLM API key

### Disabled Configuration

```bash
ENABLE_ENTITY_NAME_STANDARDIZATION=false
ENABLE_RELATION_DESCRIPTIONS=false
ENABLE_HIERARCHICAL_EXTRACTION=false
```

This configuration:
- Disables all human-readable enhancements
- System behaves as before (backward compatible)

### Pattern-Only Hierarchical Extraction

```bash
ENABLE_ENTITY_NAME_STANDARDIZATION=true
ENABLE_RELATION_DESCRIPTIONS=true
DESCRIPTION_GENERATION_METHOD=template
ENABLE_HIERARCHICAL_EXTRACTION=true
HIERARCHICAL_EXTRACTION_METHOD=pattern
HIERARCHICAL_MIN_CONFIDENCE=0.8
```

This configuration:
- Enables all features with minimal token cost
- Uses pattern-based hierarchical extraction only
- Higher confidence threshold for better precision
- No LLM calls (0 token cost)

## Usage in Code

### Builtin Relation Builder

```javascript
const relations = await buildRelations(entity, schema, fields, ckbIds, {
  enableDescriptions: true  // Override environment variable
});
```

### Semantic Relation Builder

```javascript
const relations = await extractSemanticRelations(ckb, llmClient, {
  enableDescriptions: true,  // Override environment variable
  confidenceThreshold: 0.7
});
```

### Cooccurrence Relation Builder

```javascript
const relations = await buildCooccurrenceRelations(ckbs, {
  enableDescriptions: true,  // Override environment variable
  weightThreshold: 0.5
});
```

### Universal Document Pipeline

```javascript
const { UniversalDocumentPipeline } = require('./kg/pipeline/universal_document_pipeline');

const pipeline = new UniversalDocumentPipeline({
  relationExtraction: {
    enableHierarchical: true,      // Override environment variable
    hierarchicalMethod: 'pattern',  // Override environment variable
    minConfidence: 0.7
  }
});

const context = await pipeline.processDocument(document);
```

## Performance Considerations

### Token Cost

- **Template-only mode**: 0 tokens per relation
- **Auto mode**: ~50-100 tokens per relation (only for low-confidence cases)
- **LLM-only mode**: ~100-200 tokens per relation
- **Hierarchical extraction (pattern mode)**: 0 tokens
- **Hierarchical extraction (LLM mode)**: ~200-500 tokens per document
- **Hierarchical extraction (hybrid mode)**: ~100-300 tokens per document (LLM only for ambiguous cases)

### Processing Time

- **Template-only mode**: <1ms per relation
- **Auto mode**: 1-5ms per relation (template) + 100-500ms (LLM when needed)
- **LLM-only mode**: 100-500ms per relation
- **Hierarchical extraction (pattern mode)**: 50-200ms per document
- **Hierarchical extraction (LLM mode)**: 500-2000ms per document
- **Hierarchical extraction (hybrid mode)**: 100-1000ms per document

### Recommendations

1. **For production with budget constraints**: Use `template` mode for descriptions, `pattern` mode for hierarchical extraction
2. **For balanced quality and cost**: Use `auto` mode for descriptions, `pattern` mode for hierarchical extraction
3. **For maximum quality**: Use `llm` mode for descriptions, `hybrid` mode for hierarchical extraction
4. **For backward compatibility**: Disable all features

## Monitoring

The system logs description generation and hierarchical extraction statistics:

```javascript
// Check description generation method distribution
const descriptionStats = {
  template: 850,  // 85% used templates
  llm: 100,       // 10% used LLM
  fallback: 50    // 5% used fallback
};

// Check hierarchical extraction statistics
const hierarchicalStats = {
  isACount: 45,        // Number of is_a relations
  partOfCount: 30,     // Number of part_of relations
  hasPropertyCount: 25, // Number of has_property relations
  method: 'pattern',   // Extraction method used
  tokenUsage: 0        // Tokens consumed (0 for pattern mode)
};
```

## Troubleshooting

### Descriptions not being generated

1. Check `ENABLE_RELATION_DESCRIPTIONS=true`
2. Verify relation builders are passing `enableDescriptions` option
3. Check logs for errors

### LLM descriptions not working

1. Verify `ENABLE_RELATION_DESCRIPTION_LLM=true`
2. Check `QWEN_API_KEY` is set correctly
3. Verify LLM client is initialized
4. Check token budget is not exhausted

### Wrong language in descriptions

1. Check `RELATION_DESCRIPTION_LANGUAGE` setting
2. Verify templates exist for the language
3. Check LLM prompts are using correct language

### Hierarchical relations not being extracted

1. Check `ENABLE_HIERARCHICAL_EXTRACTION=true`
2. Verify document contains hierarchical patterns (is_a, part_of, has_property)
3. Check `HIERARCHICAL_MIN_CONFIDENCE` threshold is not too high
4. Review logs for extraction errors

### LLM hierarchical extraction not working

1. Verify `HIERARCHICAL_EXTRACTION_METHOD=llm` or `hybrid`
2. Check `QWEN_API_KEY` is set correctly
3. Verify LLM client is initialized
4. Check token budget is not exhausted
5. Review logs for LLM call failures

### Too many/few hierarchical relations

1. Adjust `HIERARCHICAL_MIN_CONFIDENCE` threshold
   - Lower threshold: More relations (higher recall, lower precision)
   - Higher threshold: Fewer relations (lower recall, higher precision)
2. Switch extraction method:
   - `pattern`: More precise, fewer relations
   - `llm`: More comprehensive, more relations
   - `hybrid`: Balanced approach

## Migration Guide

### From No Descriptions to Template Descriptions

1. Set `ENABLE_RELATION_DESCRIPTIONS=true`
2. Set `DESCRIPTION_GENERATION_METHOD=template`
3. Restart service
4. Existing relations: No change (backward compatible)
5. New relations: Will have descriptions

### From Template to LLM Descriptions

1. Set `ENABLE_RELATION_DESCRIPTION_LLM=true`
2. Set `DESCRIPTION_GENERATION_METHOD=auto` or `llm`
3. Configure `QWEN_API_KEY`
4. Restart service
5. Monitor token usage

### Enabling Hierarchical Extraction

1. Set `ENABLE_HIERARCHICAL_EXTRACTION=true`
2. Choose extraction method: `HIERARCHICAL_EXTRACTION_METHOD=pattern` (recommended to start)
3. Set confidence threshold: `HIERARCHICAL_MIN_CONFIDENCE=0.7`
4. Restart service
5. Monitor extraction statistics
6. Optionally upgrade to `hybrid` or `llm` method for better coverage

### From Pattern to LLM Hierarchical Extraction

1. Verify `ENABLE_RELATION_DESCRIPTION_LLM=true` (LLM client must be available)
2. Set `HIERARCHICAL_EXTRACTION_METHOD=hybrid` or `llm`
3. Adjust `HIERARCHICAL_MIN_CONFIDENCE` if needed (lower for LLM mode)
4. Restart service
5. Monitor token usage and extraction quality

## See Also

- [Entity Name Standardization Guide](./ENTITY_NAME_STANDARDIZATION_GUIDE.md)
- [Relation Description Generator](./relation_description_generator.js)
- [Hierarchical Relation Extractor](./hierarchical_relation_extractor.js)
- [Token Budget Management](../utils/token_budget_manager.js)
- [Universal Document Pipeline](../pipeline/universal_document_pipeline.js)
