# Semantic Field Extraction - Requirements

## 1. Overview

The current field extraction system uses Rule-based + NER extraction first, then falls back to LLM extraction. This approach works well for generic fields (数值, 单位, 区域, 时间) but fails to extract **semantic field names** that are critical for domain-specific knowledge graphs, especially in the travel domain.

### Current Problem
- Rule + NER extracts: "区域: 杭州", "数值: 800", "时间: 冬天"
- What we need: "目的地名称: 杭州", "预算范围: 800元", "最佳时间: 冬天"
- The semantic field names are essential for schema matching and entity building

### Existing Assets
- `buildSemanticFieldExtractionPrompt()` - already implemented
- `buildTravelFieldExtractionPrompt()` - already implemented  
- `forceLLM` option in field_extractor.js - already implemented
- LLM extraction infrastructure - already working

## 2. User Stories

### 2.1 Domain-Specific Extraction
**As a** knowledge graph builder  
**I want** to extract fields with semantic names based on document domain  
**So that** the extracted fields match the target schema requirements

**Acceptance Criteria:**
- 2.1.1 System can detect document domain (travel, medical, government, etc.)
- 2.1.2 System selects appropriate extraction strategy based on domain
- 2.1.3 Travel documents use semantic field extraction by default
- 2.1.4 Extracted fields have semantic names (e.g., "目的地名称" not "区域")

### 2.2 Extraction Strategy Selection
**As a** system administrator  
**I want** configurable extraction strategies per domain  
**So that** I can optimize extraction quality and token usage

**Acceptance Criteria:**
- 2.2.1 Support multiple extraction strategies: "rule-first", "llm-first", "semantic-only"
- 2.2.2 Strategy can be configured per domain
- 2.2.3 Default strategy is "rule-first" for backward compatibility
- 2.2.4 Travel domain defaults to "semantic-only" strategy

### 2.3 Schema-Aware Extraction
**As a** knowledge graph builder  
**I want** field extraction to be aware of target schema  
**So that** extracted fields align with schema field definitions

**Acceptance Criteria:**
- 2.3.1 Extractor can receive target schema as input
- 2.3.2 Extraction prompt includes schema field names as guidance
- 2.3.3 Extracted fields are validated against schema
- 2.3.4 Field names are normalized to match schema definitions

### 2.4 Performance Optimization
**As a** system operator  
**I want** efficient token usage for semantic extraction  
**So that** costs remain reasonable while improving quality

**Acceptance Criteria:**
- 2.4.1 Token usage is tracked per extraction strategy
- 2.4.2 Semantic extraction uses optimized prompts
- 2.4.3 Batch extraction is supported for multiple CKBs
- 2.4.4 Caching prevents redundant LLM calls

## 3. Functional Requirements

### 3.1 Domain Detection
- FR-3.1.1: Implement domain detection based on CKB content and metadata
- FR-3.1.2: Support domains: travel, medical, government, legal, financial, general
- FR-3.1.3: Domain detection should be fast (< 10ms) and not use LLM

### 3.2 Extraction Strategy Engine
- FR-3.2.1: Implement strategy selector that chooses extraction method based on domain
- FR-3.2.2: Support strategies: "rule-first", "llm-first", "semantic-only", "hybrid"
- FR-3.2.3: Strategy configuration stored in config file or database
- FR-3.2.4: Strategy can be overridden per extraction call

### 3.3 Semantic Field Extraction
- FR-3.3.1: Use `buildSemanticFieldExtractionPrompt` for semantic extraction
- FR-3.3.2: Use `buildTravelFieldExtractionPrompt` for travel domain
- FR-3.3.3: Support custom prompts for other domains
- FR-3.3.4: Validate extracted fields have semantic names (not generic types)

### 3.4 Schema Integration
- FR-3.4.1: Accept optional schema parameter in `extractFields()`
- FR-3.4.2: Pass schema field names to LLM prompt
- FR-3.4.3: Normalize extracted field names to match schema
- FR-3.4.4: Report field coverage (% of schema fields extracted)

## 4. Non-Functional Requirements

### 4.1 Performance
- NFR-4.1.1: Semantic extraction should complete within 5 seconds per CKB
- NFR-4.1.2: Domain detection should complete within 10ms
- NFR-4.1.3: Strategy selection should complete within 5ms

### 4.2 Quality
- NFR-4.2.1: Semantic extraction should achieve >90% field name accuracy
- NFR-4.2.2: Travel domain extraction should extract all core fields (8 fields minimum)
- NFR-4.2.3: Field confidence scores should be calibrated (>0.8 for clear fields)

### 4.3 Maintainability
- NFR-4.3.1: Domain-specific prompts should be easy to add/modify
- NFR-4.3.2: Strategy configuration should be externalized
- NFR-4.3.3: Extraction logic should be modular and testable

### 4.4 Backward Compatibility
- NFR-4.4.1: Existing code using `extractFields()` should work without changes
- NFR-4.4.2: Default behavior (rule-first) should remain unchanged
- NFR-4.4.3: New features should be opt-in via options parameter

## 5. Technical Constraints

### 5.1 Existing Infrastructure
- Must use existing LLM client (qwen_client.js)
- Must use existing prompt builders (extract_fields.js)
- Must integrate with existing field_extractor.js
- Must work with existing schema_matcher.js

### 5.2 Token Budget
- Semantic extraction will increase token usage
- Must track and report token usage per strategy
- Must provide cost estimates before extraction
- Must support token budget limits

### 5.3 Testing
- Must have unit tests for all new functions
- Must have integration tests for end-to-end extraction
- Must have property-based tests for field validation
- Must test with real travel documents

## 6. Success Metrics

### 6.1 Quality Metrics
- Field name accuracy: >90% semantic names (not generic types)
- Field extraction completeness: >95% of expected fields extracted
- Schema matching accuracy: >85% after semantic extraction

### 6.2 Performance Metrics
- Extraction time: <5 seconds per CKB
- Token usage: <2000 tokens per CKB for semantic extraction
- Cache hit rate: >50% for repeated extractions

### 6.3 Business Metrics
- Improved knowledge graph quality (measured by entity/relation count)
- Reduced manual field mapping effort
- Better schema matching results

## 7. Out of Scope

### 7.1 Not Included in This Spec
- Training custom NER models for semantic extraction
- Building domain-specific rule extractors
- Automatic schema generation from extracted fields
- Multi-language support (focus on Chinese first)

### 7.2 Future Enhancements
- Active learning to improve extraction over time
- User feedback loop for field corrections
- Automatic prompt optimization based on results
- Support for structured document formats (tables, forms)
