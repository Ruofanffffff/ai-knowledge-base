# Design Document: Human-Readable Knowledge Graph Enhancement

## Overview

This design enhances the knowledge graph extraction system to produce human-readable output by standardizing entity names, adding relationship descriptions, and extracting hierarchical relationships. The system currently generates entities with non-descriptive names (e.g., "unknown" for numeric parameters) and relationships that lack human-readable context. This enhancement integrates with the existing entity_builder, field_normalizer, and relation_builder modules to improve readability while maintaining backward compatibility.

The enhancement focuses on four key areas:
1. **Entity Name Standardization**: Replace "unknown" and raw text fragments with descriptive names
2. **Relationship Description Generation**: Add natural language descriptions to all relationships
3. **Hierarchical Relationship Extraction**: Identify and create is_a, part_of, and has_property relationships
4. **Quality Validation**: Ensure enhanced output meets quality standards

## Architecture

### System Context

The enhancement integrates with the existing knowledge graph pipeline:

```
Document → Field Extraction → Field Normalization → Entity Building → Relation Building → Enhanced Output
                                      ↓                    ↓                  ↓
                                Name Standardizer    Name Enhancer    Description Generator
                                                                            ↓
                                                                  Hierarchical Extractor
```

### Component Integration

**Existing Components (Modified)**:
- `kg/entity/entity_builder.js`: Enhanced to use improved name generation
- `kg/field_normalizer/field_normalizer.js`: Extended with semantic name standardization
- `kg/relation/builtin_relation_builder.js`: Extended to generate descriptions

**New Components**:
- `kg/entity/entity_name_standardizer.js`: Standardizes entity names using context and LLM
- `kg/relation/relation_description_generator.js`: Generates human-readable relationship descriptions
- `kg/relation/hierarchical_relation_extractor.js`: Extracts taxonomic and compositional relationships
- `kg/quality/human_readability_validator.js`: Validates enhanced output quality

## Components and Interfaces

### 1. Entity Name Standardizer

**Purpose**: Standardize entity names to be descriptive and human-readable

**Location**: `kg/entity/entity_name_standardizer.js`

**Interface**:
```javascript
class EntityNameStandardizer {
  /**
   * Standardize entity name based on context
   * @param {Object} entity - Entity object with fields and context
   * @param {Object} options - Standardization options
   * @returns {Promise<Object>} { standardizedName, confidence, method }
   */
  async standardizeName(entity, options = {})
  
  /**
   * Standardize numeric parameter entity name
   * @param {Object} entity - Numeric parameter entity
   * @param {string} context - Surrounding text context
   * @returns {Promise<string>} Descriptive name
   */
  async standardizeNumericParameter(entity, context)
  
  /**
   * Extract core concept from long text fragment
   * @param {string} textFragment - Long entity name
   * @returns {string} Concise core concept
   */
  extractCoreConcept(textFragment)
  
  /**
   * Merge synonymous entities
   * @param {Array} entities - List of entities
   * @returns {Array} Merged entities with standardized names
   */
  mergeSynonymousEntities(entities)
}
```

**Algorithm**:
1. **Numeric Parameter Handling**:
   - Extract context window (±50 characters) around numeric value
   - Identify measurement type from context (e.g., "曝光时间", "ISO感光度")
   - Use pattern matching for common parameter types
   - Fall back to LLM for ambiguous cases
   - Format: `{measurement_type}_{value}` (e.g., "曝光时间_1/125s")

2. **Text Fragment Simplification**:
   - Remove articles, filler words, excessive whitespace
   - Extract noun phrases using NLP
   - Identify key terms using TF-IDF
   - Limit to 2-6 characters for Chinese, 2-4 words for English

3. **Synonym Merging**:
   - Calculate semantic similarity using embeddings
   - Group entities with similarity > 0.85
   - Select canonical name based on frequency and clarity
   - Merge attributes and supporting CKBs

### 2. Relation Description Generator

**Purpose**: Generate natural language descriptions for relationships

**Location**: `kg/relation/relation_description_generator.js`

**Interface**:
```javascript
class RelationDescriptionGenerator {
  /**
   * Generate description for a relationship
   * @param {Object} relation - Relation object with source, target, type
   * @param {Object} sourceEntity - Source entity
   * @param {Object} targetEntity - Target entity
   * @param {Object} context - Optional context from CKB
   * @returns {Promise<string>} Human-readable description
   */
  async generateDescription(relation, sourceEntity, targetEntity, context = null)
  
  /**
   * Generate description using template
   * @param {string} relationType - Relation type ID
   * @param {Object} sourceEntity - Source entity
   * @param {Object} targetEntity - Target entity
   * @returns {string} Template-based description
   */
  generateTemplateDescription(relationType, sourceEntity, targetEntity)
  
  /**
   * Generate description using LLM
   * @param {Object} relation - Relation object
   * @param {Object} context - Context from CKB
   * @returns {Promise<string>} LLM-generated description
   */
  async generateLLMDescription(relation, context)
}
```

**Algorithm**:
1. **Template-Based Generation** (Fast path, 0 tokens):
   - Load relation type definition from `relation_types.json`
   - Use predefined templates: `{source.name} {relation.displayName} {target.name}`
   - Example: "Canon EOS R5 拍摄于 北京故宫"
   - Apply for 80% of common relation types

2. **LLM-Based Generation** (Fallback, ~100 tokens):
   - Extract context from supporting CKB
   - Build prompt with source, target, relation type, and context
   - Request natural language description
   - Validate description length (5-50 words)
   - Cache result for similar relationships

3. **Hybrid Approach**:
   - Use templates for built-in relations
   - Use LLM for semantic and co-occurrence relations
   - Enrich template descriptions with context when available

### 3. Hierarchical Relation Extractor

**Purpose**: Extract taxonomic and compositional relationships

**Location**: `kg/relation/hierarchical_relation_extractor.js`

**Interface**:
```javascript
class HierarchicalRelationExtractor {
  /**
   * Extract hierarchical relationships from text
   * @param {string} text - Document text
   * @param {Array} entities - Extracted entities
   * @returns {Promise<Array>} Hierarchical relations
   */
  async extractHierarchicalRelations(text, entities)
  
  /**
   * Extract is_a relationships (taxonomy)
   * @param {string} text - Document text
   * @param {Array} entities - Extracted entities
   * @returns {Array} is_a relations
   */
  extractIsARelations(text, entities)
  
  /**
   * Extract part_of relationships (composition)
   * @param {string} text - Document text
   * @param {Array} entities - Extracted entities
   * @returns {Array} part_of relations
   */
  extractPartOfRelations(text, entities)
  
  /**
   * Extract has_property relationships (attributes)
   * @param {string} text - Document text
   * @param {Array} entities - Extracted entities
   * @returns {Array} has_property relations
   */
  extractHasPropertyRelations(text, entities)
  
  /**
   * Infer hierarchical relationships using LLM
   * @param {Array} entities - Extracted entities
   * @param {Object} domainKnowledge - Domain-specific knowledge
   * @returns {Promise<Array>} Inferred hierarchical relations
   */
  async inferHierarchicalRelations(entities, domainKnowledge)
}
```

**Algorithm**:
1. **Pattern-Based Extraction**:
   - **is_a patterns**: "X是一种Y", "X属于Y", "X is a Y", "X is a type of Y"
   - **part_of patterns**: "X包含Y", "Y是X的一部分", "X contains Y", "Y is part of X"
   - **has_property patterns**: "X的Y", "X has Y", "X with Y"
   - Use regex and dependency parsing
   - Confidence: 0.9 for exact matches

2. **LLM-Based Inference**:
   - Group entities by domain (photography, travel, etc.)
   - Build prompt with entity list and domain context
   - Request hierarchical relationships
   - Validate against entity types
   - Confidence: 0.7-0.8 for inferred relations

3. **Domain Knowledge Integration**:
   - Load domain-specific taxonomies (e.g., photography equipment hierarchy)
   - Match entities against known hierarchies
   - Create is_a relations for matches
   - Confidence: 0.95 for knowledge base matches

### 4. Human Readability Validator

**Purpose**: Validate enhanced output quality

**Location**: `kg/quality/human_readability_validator.js`

**Interface**:
```javascript
class HumanReadabilityValidator {
  /**
   * Validate knowledge graph readability
   * @param {Object} knowledgeGraph - KG with entities and relations
   * @returns {Object} Validation report
   */
  validate(knowledgeGraph)
  
  /**
   * Check entity name quality
   * @param {Array} entities - List of entities
   * @returns {Object} Entity name quality metrics
   */
  validateEntityNames(entities)
  
  /**
   * Check relationship description quality
   * @param {Array} relations - List of relations
   * @returns {Object} Relation description quality metrics
   */
  validateRelationDescriptions(relations)
  
  /**
   * Generate quality report
   * @param {Object} validationResults - Validation results
   * @returns {Object} Quality report with metrics and recommendations
   */
  generateQualityReport(validationResults)
}
```

**Validation Rules**:
1. **Entity Name Quality**:
   - No "unknown" names (hard requirement)
   - Length: 2-20 characters for Chinese, 2-40 characters for English
   - Contains at least one descriptive term
   - No excessive whitespace or special characters
   - Pass rate target: 95%

2. **Relationship Description Quality**:
   - All relations have non-empty descriptions (hard requirement)
   - Length: 5-50 words
   - Contains source and target entity references
   - Uses natural language (not codes)
   - Pass rate target: 90%

3. **Hierarchical Relationship Coverage**:
   - At least 20% of entities have hierarchical relations
   - is_a relations form valid taxonomies (no cycles)
   - part_of relations form valid compositions (no cycles)

## Data Models

### Enhanced Entity Model

```javascript
{
  entity_id: "entity_123",
  entity_type: "PhotographyEntity",
  canonical_name: "曝光时间_1/125s",  // Standardized, descriptive name
  original_name: "unknown",           // Original extracted name
  aliases: ["快门速度_1/125s", "1/125秒"],
  schemas: [...],
  supported_by: ["ckb_456"],
  attributes: {
    "参数类型": "曝光时间",
    "数值": "1/125",
    "单位": "秒"
  },
  confidence: 0.85,
  name_standardization: {
    method: "context_analysis",      // or "llm_enhancement"
    confidence: 0.9,
    original_name: "unknown"
  },
  llm_enriched: true,
  created_at: "2025-01-26T10:00:00Z",
  updated_at: "2025-01-26T10:00:00Z"
}
```

### Enhanced Relation Model

```javascript
{
  relation_id: "rel_789",
  source_id: "entity_123",
  target_id: "entity_456",
  type: "builtin",
  subtype: "photography_has_parameter",
  description: "Canon EOS R5相机使用1/125秒的曝光时间进行拍摄",  // Human-readable description
  confidence: 0.95,
  evidence_ckb: ["ckb_456"],
  evidence_text: "使用Canon EOS R5，曝光时间设置为1/125秒",
  metadata: {
    schema_name: "摄影参数事件",
    relation_type_id: "photography_has_parameter",
    description_method: "template",  // or "llm"
    description_confidence: 0.9
  },
  created_at: "2025-01-26T10:00:00Z"
}
```

### Hierarchical Relation Model

```javascript
{
  relation_id: "rel_hierarchical_001",
  source_id: "entity_camera_eos_r5",
  target_id: "entity_camera_type",
  type: "hierarchical",
  subtype: "is_a",
  description: "Canon EOS R5是一种全画幅无反相机",
  confidence: 0.9,
  evidence_ckb: ["ckb_456"],
  evidence_text: "Canon EOS R5是佳能的全画幅无反相机",
  metadata: {
    hierarchy_type: "is_a",          // is_a, part_of, has_property
    extraction_method: "pattern",    // pattern, llm, knowledge_base
    domain: "photography"
  },
  created_at: "2025-01-26T10:00:00Z"
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: No Unknown Entity Names
*For any* knowledge graph extraction result, all entities should have descriptive names and none should have the name "unknown" or any placeholder pattern.
**Validates: Requirements 1.4, 6.1**

### Property 2: Numeric Parameter Descriptive Naming
*For any* numeric parameter entity with surrounding context, the entity name should contain at least one descriptive term indicating the parameter's semantic meaning (e.g., "曝光时间", "ISO感光度").
**Validates: Requirements 1.1, 1.5**

### Property 3: Numeric Parameter Fallback Naming
*For any* numeric parameter entity lacking sufficient context, the entity name should follow the pattern "{measurement_type}_value" or similar descriptive pattern.
**Validates: Requirements 1.2**

### Property 4: Numeric Parameter Uniqueness
*For any* document containing multiple numeric parameter entities in the same context, all parameter names should be unique (differentiated by qualifiers or indices).
**Validates: Requirements 1.3**

### Property 5: Entity Name Normalization
*For any* entity name, after normalization it should: (a) contain no redundant articles, filler words, or excessive whitespace, (b) be concise if originally a long text fragment, (c) follow consistent capitalization rules, and (d) use standard forms for abbreviations.
**Validates: Requirements 2.1, 2.2, 2.4, 2.5**

### Property 6: Synonym Merging
*For any* set of entities identified as synonymous (similarity > 0.85), they should be merged under a single standardized canonical name.
**Validates: Requirements 2.3**

### Property 7: Relationship Description Completeness and Quality
*For any* relationship, the description field should be: (a) non-empty, (b) at least 5 words long, (c) contain references to both source and target entities, (d) use natural language (complete sentences or clear phrases), and (e) reflect the standard semantic meaning of the relationship type.
**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 6.2**

### Property 8: Hierarchical Pattern Extraction
*For any* document containing taxonomic patterns (is_a), compositional patterns (part_of), or property patterns (has_property), the system should create corresponding hierarchical relationships with confidence ≥ 0.9.
**Validates: Requirements 4.1, 4.2, 4.3**

### Property 9: Hierarchical Relationship Type Support
*For any* hierarchical relationship type in the set {"is_a", "part_of", "has_property", "subclass_of", "instance_of"}, the system should be able to create relationships of that type.
**Validates: Requirements 4.4**

### Property 10: LLM Hierarchical Inference
*For any* document where hierarchical relationships cannot be extracted via patterns, the system should invoke LLM inference to identify likely hierarchical relationships based on domain knowledge.
**Validates: Requirements 4.5**

### Property 11: Backward Compatibility - Field Preservation
*For any* entity or relationship in the enhanced output, all fields present in the original (non-enhanced) output should be preserved without modification or removal.
**Validates: Requirements 5.1, 5.2**

### Property 12: Backward Compatibility - Schema Structure
*For any* knowledge graph output, the JSON structure should conform to the original schema and be parseable by systems expecting the previous format.
**Validates: Requirements 5.3, 5.4**

### Property 13: Entity Name Quality Validation
*For any* completed extraction, all entity names should meet quality requirements: length between 2-20 characters (Chinese) or 2-40 characters (English), no excessive whitespace, and no special characters except hyphens and underscores.
**Validates: Requirements 6.3**

## Error Handling

### Error Categories

1. **Name Standardization Failures**:
   - **Cause**: Insufficient context, ambiguous parameters, LLM unavailable
   - **Handling**: Fall back to generic descriptive pattern "{type}_value"
   - **Logging**: Record entity ID, context snippet, failure reason
   - **Recovery**: Continue processing, mark entity with low confidence

2. **Description Generation Failures**:
   - **Cause**: Missing entity data, LLM timeout, template not found
   - **Handling**: Use minimal template "{source} relates to {target}"
   - **Logging**: Record relation ID, type, failure reason
   - **Recovery**: Continue processing, mark description with low confidence

3. **Hierarchical Extraction Failures**:
   - **Cause**: Pattern matching errors, LLM inference failure, invalid entity types
   - **Handling**: Skip hierarchical relation creation for failed cases
   - **Logging**: Record entity pairs, attempted hierarchy type, failure reason
   - **Recovery**: Continue processing, report in quality metrics

4. **Validation Failures**:
   - **Cause**: Quality thresholds not met, schema violations
   - **Handling**: Generate detailed validation report with specific failures
   - **Logging**: Record all validation errors with entity/relation IDs
   - **Recovery**: Return partial results with validation warnings

### Error Recovery Strategies

1. **Graceful Degradation**:
   - If LLM unavailable: Use algorithm-based methods only
   - If name standardization fails: Keep original name with warning
   - If description generation fails: Use minimal template
   - If hierarchical extraction fails: Skip hierarchical relations

2. **Retry Logic**:
   - LLM calls: Retry up to 2 times with exponential backoff
   - Timeout: 5 seconds per LLM call, 30 seconds total per document
   - Circuit breaker: Disable LLM after 5 consecutive failures

3. **Partial Success Handling**:
   - Process entities and relations independently
   - Mark failed items with error metadata
   - Include success/failure counts in quality report
   - Allow downstream systems to filter by confidence

## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit tests for specific scenarios and property-based tests for comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and error conditions
- Specific numeric parameter patterns (ISO, shutter speed, aperture)
- Known synonym pairs (Canon EOS R5 / EOS R5 / R5)
- Template-based description generation
- Pattern matching for hierarchical relations
- Configuration option toggling
- Error handling scenarios

**Property Tests**: Verify universal properties across all inputs
- Generate random entities with various name patterns
- Generate random relationships with different types
- Generate random documents with hierarchical patterns
- Test with diverse domains (photography, travel, shopping)
- Minimum 100 iterations per property test

### Property-Based Testing Configuration

- **Library**: fast-check (JavaScript)
- **Iterations**: 100 per property test
- **Tag Format**: `Feature: human-readable-knowledge-graph, Property {number}: {property_text}`
- **Coverage**: Each correctness property must have exactly one property-based test

### Test Coverage Requirements

1. **Entity Name Standardization**: 90% code coverage
   - All numeric parameter patterns
   - Text fragment simplification
   - Synonym detection and merging
   - Edge cases: empty context, special characters, very long names

2. **Relationship Description Generation**: 85% code coverage
   - Template-based generation for all relation types
   - LLM-based generation with mocked responses
   - Error handling and fallbacks
   - Edge cases: missing entities, invalid types

3. **Hierarchical Extraction**: 80% code coverage
   - Pattern matching for all hierarchy types
   - LLM inference with mocked responses
   - Domain knowledge integration
   - Edge cases: circular hierarchies, invalid entity types

4. **Quality Validation**: 95% code coverage
   - All validation rules
   - Quality report generation
   - Threshold checking
   - Edge cases: empty graphs, all failures

### Integration Testing

1. **End-to-End Pipeline**:
   - Process real documents from multiple domains
   - Verify enhanced output quality
   - Measure performance impact
   - Validate backward compatibility

2. **Compatibility Testing**:
   - Test with existing downstream systems
   - Verify query compatibility
   - Test configuration options
   - Validate schema conformance

3. **Performance Testing**:
   - Measure processing time increase (target: <20%)
   - Measure LLM token consumption
   - Test with large documents (>10,000 words)
   - Test batch processing (100+ documents)

## Implementation Notes

### Integration Points

1. **Entity Builder Integration**:
   - Modify `generateCanonicalName()` to call `EntityNameStandardizer`
   - Add name standardization metadata to entity objects
   - Preserve original names for debugging

2. **Relation Builder Integration**:
   - Extend `buildRelationFromTemplate()` to call `RelationDescriptionGenerator`
   - Add description generation to semantic and co-occurrence relations
   - Store description method and confidence in metadata

3. **Pipeline Integration**:
   - Add `HierarchicalRelationExtractor` after relation building
   - Add `HumanReadabilityValidator` before output
   - Make enhancements configurable via environment variables

### Configuration

```javascript
// Environment variables
ENABLE_HUMAN_READABLE_KG=true
ENABLE_ENTITY_NAME_STANDARDIZATION=true
ENABLE_RELATION_DESCRIPTIONS=true
ENABLE_HIERARCHICAL_EXTRACTION=true
HIERARCHICAL_EXTRACTION_METHOD=hybrid  // pattern, llm, hybrid
DESCRIPTION_GENERATION_METHOD=hybrid   // template, llm, hybrid
```

### Performance Considerations

1. **LLM Usage Optimization**:
   - Use templates for 80% of descriptions (0 tokens)
   - Cache LLM results for similar entities/relations
   - Batch LLM calls when possible (5-10 items per call)
   - Target: <500 tokens per document on average

2. **Processing Time**:
   - Name standardization: +50ms per entity (mostly algorithm-based)
   - Description generation: +100ms per relation (mostly template-based)
   - Hierarchical extraction: +200ms per document (pattern + LLM)
   - Total overhead target: <20% of original processing time

3. **Memory Usage**:
   - Cache size limit: 10,000 entries
   - LRU eviction policy
   - Periodic cache cleanup (every 1000 documents)

### Migration Strategy

1. **Phase 1**: Deploy with feature flag disabled
2. **Phase 2**: Enable for 10% of traffic, monitor metrics
3. **Phase 3**: Gradually increase to 50%, validate quality
4. **Phase 4**: Enable for 100% of traffic
5. **Phase 5**: Make default behavior, remove feature flag

### Monitoring and Metrics

1. **Quality Metrics**:
   - Percentage of entities with "unknown" names (target: 0%)
   - Percentage of relations with descriptions (target: 100%)
   - Average entity name length (target: 5-15 characters)
   - Average description length (target: 10-30 words)

2. **Performance Metrics**:
   - Processing time increase (target: <20%)
   - LLM token consumption (target: <500 tokens/document)
   - Cache hit rate (target: >70%)
   - Error rate (target: <5%)

3. **Business Metrics**:
   - User satisfaction with KG readability
   - Downstream system adoption rate
   - Query success rate
   - Time to insight (reduced by better readability)
