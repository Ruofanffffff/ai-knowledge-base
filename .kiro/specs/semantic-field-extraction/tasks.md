# Implementation Plan: Semantic Field Extraction

## Overview

This implementation plan breaks down the semantic field extraction feature into discrete coding tasks. The approach follows a phased implementation strategy, starting with core infrastructure, then strategy execution, schema integration, two-stage extraction flow, and finally optimization and testing.

The implementation reuses existing infrastructure (LLM client, prompt builders, extractors, mapping table) and adds new components:
- Domain detector and strategy selector for intelligent extraction
- Two-stage extraction flow: Algorithm extraction → Mapping table → Schema ranking, then LLM semantic extraction for unmapped fields
- Schema field matcher and ranker for schema-aware extraction
- Performance optimizations (caching, token tracking)

**Key Innovation**: The two-stage extraction flow combines the efficiency of algorithm-based extraction with the semantic understanding of LLM extraction, producing both high-quality semantic field names and accurate schema matching.

## Tasks

- [x] 1. Set up core infrastructure and configuration
  - Create extraction_config.js with domain keywords, default strategies, and prompt builder mappings
  - Create extraction_config.json for external configuration
  - Add configuration loading and validation functions
  - _Requirements: 2.2.2, 3.2.1, 3.2.3_

- [x] 2. Implement domain detection
  - [x] 2.1 Create domain_detector.js with keyword-based detection
    - Implement detectDomain() function with keyword matching
    - Implement getDomainKeywords() function
    - Add keyword density calculation
    - Add confidence scoring logic
    - Handle edge cases (empty content, ambiguous domains)
    - _Requirements: 2.1.1, 3.1.1, 3.1.2, 3.1.3_

  - [ ]* 2.2 Write property test for domain detection
    - **Property 1: Domain Detection Accuracy**
    - **Validates: Requirements 2.1.1**
    - Generate documents with domain keywords and verify correct classification
    - Test with keyword density > 5%

  - [x]* 2.3 Write unit tests for domain detector
    - Test empty content defaults to general
    - Test travel keywords trigger travel domain
    - Test ambiguous content defaults to general
    - Test performance (< 10ms requirement)
    - _Requirements: 2.1.1, NFR-4.1.2_

- [x] 3. Implement strategy selection
  - [x] 3.1 Create strategy_selector.js with strategy selection logic
    - Implement selectStrategy() function
    - Implement getDefaultStrategy() function
    - Add strategy override handling
    - Add strategy validation
    - Build strategy result objects
    - _Requirements: 2.1.2, 2.2.1, 2.2.2, 3.2.1, 3.2.2, 3.2.4_

  - [ ]* 3.2 Write property test for strategy selection
    - **Property 2: Strategy Selection Consistency**
    - **Validates: Requirements 2.1.2, 2.2.2**
    - Test that any domain returns valid configured strategy

  - [ ]* 3.3 Write property test for strategy execution
    - **Property 4: Strategy Execution Completeness**
    - **Validates: Requirements 2.2.1**
    - Test that all supported strategies execute without errors

  - [x]* 3.4 Write unit tests for strategy selector
    - Test travel domain defaults to semantic-only
    - Test general domain defaults to rule-first
    - Test strategy override works
    - Test invalid strategy throws error
    - Test performance (< 5ms requirement)
    - _Requirements: 2.2.3, 2.2.4, NFR-4.1.3_

- [x] 4. Checkpoint - Verify core infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Enhance field extractor with new parameters
  - [x] 5.1 Update extractFields() function signature
    - Add domain parameter
    - Add strategy parameter
    - Add schema parameter
    - Add enableDomainDetection parameter
    - Add trackTokens parameter
    - Maintain backward compatibility with existing calls
    - _Requirements: 2.3.1, 3.4.1, NFR-4.4.1, NFR-4.4.2_

  - [x] 5.2 Implement domain detection integration
    - Call domainDetector.detectDomain() when enabled
    - Handle domain override parameter
    - Pass detected domain to strategy selector
    - _Requirements: 2.1.1, 2.1.2_

  - [x] 5.3 Implement strategy selection integration
    - Call strategySelector.selectStrategy()
    - Handle strategy override parameter
    - Pass strategy to execution engine
    - _Requirements: 2.1.2, 2.2.1, 2.2.2_

  - [ ]* 5.4 Write property test for backward compatibility
    - **Property 12: Backward Compatibility**
    - **Validates: Requirements NFR-4.4.1, NFR-4.4.2**
    - Test that existing code without new parameters works correctly

  - [x]* 5.5 Write unit tests for enhanced field extractor
    - Test backward compatibility (no options uses rule-first)
    - Test domain detection integration
    - Test strategy selection integration
    - Test parameter validation
    - _Requirements: NFR-4.4.1, NFR-4.4.2_

- [x] 6. Implement strategy execution logic
  - [x] 6.1 Implement executeStrategy() dispatcher function
    - Route to appropriate strategy executor
    - Handle unknown strategies
    - Add error handling and fallback
    - _Requirements: 2.2.1, 3.2.1_

  - [x] 6.2 Implement executeSemanticOnly() function
    - Call LLM extractor with semantic prompt
    - Handle LLM failures with fallback to rule-based
    - Track token usage
    - Validate results
    - _Requirements: 2.1.3, 2.1.4, 3.3.1, 3.3.2, 3.3.4_

  - [x] 6.3 Implement executeHybrid() function
    - Run Rule+NER and LLM semantic extraction in parallel
    - Merge results from both approaches
    - Deduplicate fields
    - _Requirements: 2.2.1, 3.2.2_

  - [x] 6.4 Implement executeLLMFirst() function
    - Run LLM extraction first
    - Fallback to Rule+NER if LLM fails
    - Track which method was used
    - _Requirements: 2.2.1, 3.2.2_

  - [ ]* 6.5 Write property test for semantic field names
    - **Property 3: Semantic Field Names**
    - **Validates: Requirements 2.1.4**
    - Test that travel extraction produces semantic names (not generic types)

  - [ ]* 6.6 Write integration tests for strategy execution
    - Test semantic-only strategy with travel document
    - Test hybrid strategy merges results correctly
    - Test llm-first strategy with fallback
    - Test error handling and fallback behavior
    - _Requirements: 2.1.3, 2.1.4, 2.2.1_

- [x] 7. Enhance LLM extractor with domain support
  - [x] 7.1 Update extractFieldsWithLLM() function
    - Add domain parameter
    - Add schema parameter
    - Implement prompt builder selection based on domain
    - Pass schema to prompt builder if provided
    - _Requirements: 2.3.1, 2.3.2, 3.3.1, 3.3.2, 3.3.3, 3.4.2_

  - [x] 7.2 Implement getPromptBuilderForDomain() function
    - Map domain to prompt builder function
    - Handle unknown domains
    - Return appropriate prompt builder
    - _Requirements: 3.3.1, 3.3.2, 3.3.3_

  - [ ]* 7.3 Write property test for semantic prompt selection
    - **Property 9: Semantic Prompt Selection**
    - **Validates: Requirements 2.4.2**
    - Test that semantic strategies use semantic prompt builders

  - [ ]* 7.4 Write unit tests for LLM extractor enhancement
    - Test semantic-only uses semantic prompt
    - Test travel domain uses travel prompt
    - Test prompt builder selection logic
    - _Requirements: 2.4.2, 3.3.1, 3.3.2_

- [x] 8. Checkpoint - Verify extraction engine
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement schema integration
  - [x] 9.1 Update prompt builders to accept schema parameter
    - Modify buildSemanticFieldExtractionPrompt() to include schema fields
    - Modify buildTravelFieldExtractionPrompt() to include schema fields
    - Add schema field names to prompt guidance section
    - _Requirements: 2.3.2, 3.4.2_

  - [x] 9.2 Implement validateFieldsAgainstSchema() function
    - Validate field names against schema
    - Validate field types against schema
    - Return validation results with matched schema fields
    - Handle invalid schema format gracefully
    - _Requirements: 2.3.3, 3.4.3, 3.4.4_

  - [x] 9.3 Implement field name normalization
    - Create findMatchingSchemaField() function
    - Implement edit distance calculation
    - Implement semantic similarity matching
    - Map extracted field names to schema field names
    - _Requirements: 2.3.4, 3.4.4_

  - [ ]* 9.4 Write property test for schema-aware prompt construction
    - **Property 5: Schema-Aware Prompt Construction**
    - **Validates: Requirements 2.3.2**
    - Test that prompts include all schema field names

  - [ ]* 9.5 Write property test for schema validation
    - **Property 6: Schema Validation**
    - **Validates: Requirements 2.3.3**
    - Test that validation verifies fields against schema

  - [ ]* 9.6 Write property test for field name normalization
    - **Property 7: Field Name Normalization**
    - **Validates: Requirements 2.3.4**
    - Test that similar field names get normalized to schema names

  - [ ]* 9.7 Write unit tests for schema integration
    - Test schema field inclusion in prompts
    - Test schema validation with valid/invalid schemas
    - Test field name normalization with various similarities
    - Test error handling for invalid schemas
    - _Requirements: 2.3.2, 2.3.3, 2.3.4_

- [ ] 10. Implement performance optimizations
  - [x] 10.1 Add token usage tracking
    - Track tokens per extraction call
    - Track tokens per strategy
    - Associate token usage with extraction metadata
    - _Requirements: 2.4.1, 3.4.1_

  - [x] 10.2 Implement extraction caching
    - Create cache key from CKB content and options
    - Check cache before extraction
    - Store extraction results in cache
    - Implement cache invalidation
    - _Requirements: 2.4.4_

  - [x] 10.3 Implement batch extraction support
    - Update extractFieldsFromCKBs() to use new features
    - Add domain detection for batch
    - Add strategy selection for batch
    - Handle errors gracefully in batch mode
    - _Requirements: 2.4.3_

  - [ ]* 10.4 Write property test for token usage tracking
    - **Property 8: Token Usage Tracking**
    - **Validates: Requirements 2.4.1**
    - Test that token usage is recorded for all extractions

  - [ ]* 10.5 Write property test for cache effectiveness
    - **Property 11: Cache Effectiveness**
    - **Validates: Requirements 2.4.4**
    - Test that repeated extraction uses cache (zero additional tokens)

  - [ ]* 10.6 Write property test for batch extraction
    - **Property 10: Batch Extraction Completeness**
    - **Validates: Requirements 2.4.3**
    - Test that batch extraction returns results for all CKBs

  - [ ]* 10.7 Write performance tests
    - Test domain detection performance (< 10ms)
    - Test strategy selection performance (< 5ms)
    - Test semantic extraction time (< 5 seconds)
    - Test token usage (< 2000 tokens per CKB)
    - _Requirements: NFR-4.1.1, NFR-4.1.2, NFR-4.1.3, 5.3_

- [x] 11. Implement two-stage extraction flow ✅ **ALREADY IMPLEMENTED**
  - [x] 11.1 Create schema_field_matcher.js ✅ **DONE: SchemaMatcherV2.js + MappingBasedNormalizer.js**
    - ✅ Implement matchFieldsToSchemas() function → `SchemaMatcherV2.matchSchemas()`
    - ✅ Implement mapping table lookup logic → `MappingBasedNormalizer._algorithmMap()`
    - ✅ Implement schema hit counting → Schema计数器在`matchSchemas()`中
    - ✅ Identify unmapped fields → `unmappedFields`数组
    - _Requirements: 2.3.3, 3.4.1_

  - [x] 11.2 Implement LLM schema matching ✅ **DONE: SchemaMatcherV2._llmMatchFields()**
    - ✅ Implement matchUnmappedFieldsWithLLM() function → `_llmMatchFields()`
    - ✅ Implement buildSchemaMatchingPrompt() function → `_buildLLMMatchPrompt()`
    - ✅ Parse LLM schema matching response → `_parseLLMResponse()`
    - ✅ Handle LLM errors gracefully → try-catch包裹
    - _Requirements: 2.1.4, 2.3.2, 3.3.2_

  - [x] 11.3 Create schema_ranker.js ✅ **DONE: 集成在SchemaMatcherV2中**
    - ✅ Implement rankSchemas() function → 排序逻辑在`matchSchemas()`中
    - ✅ Implement mergeHitCounts() function → 合并算法和LLM结果
    - ✅ Calculate coverage percentage for each schema → `completeness`和`weightedCompleteness`
    - ✅ Sort schemas by coverage → `rankedSchemas.sort()`
    - _Requirements: 2.3.3_

  - [x] 11.4 Implement coverage filtering ✅ **DONE: 集成在SchemaMatcherV2中**
    - ✅ Implement filterSchemasByCoverage() function → 阈值过滤逻辑
    - ✅ Apply configurable coverage threshold (default 40%) → `threshold = 0.4`
    - ✅ Return top schemas meeting threshold → `rankedSchemas`
    - _Requirements: 2.3.3_

  - [x] 11.5 Create two_stage_extractor.js ✅ **DONE: SchemaMatcherV2实现了完整流程**
    - ✅ Implement extractWithTwoStages() orchestration function → `matchSchemas()`
    - ✅ Implement executeAlgorithmExtraction() for Stage 1 → 映射表匹配阶段
    - ✅ Implement extractSemanticFieldNames() for Stage 2 → LLM匹配阶段
    - ✅ Integrate schema matching and ranking → 完整集成
    - ✅ Return complete extraction result with schema ranking → `rankedSchemas`
    - _Requirements: 2.1.1, 2.1.2, 2.1.4, 2.3.3_

  - [ ]* 11.6 Write property test for two-stage extraction completeness
    - **Property 15: Two-Stage Extraction Completeness**
    - **Validates: Requirements 2.1.1, 2.1.2, 2.1.4**
    - Test that extraction returns both algorithm and LLM fields with schema ranking

  - [ ]* 11.7 Write property test for schema hit counting
    - **Property 16: Schema Hit Counting Accuracy**
    - **Validates: Requirements 2.3.3**
    - Test that hit counts are correctly calculated from mapping table

  - [ ]* 11.8 Write property test for unmapped field detection
    - **Property 17: Unmapped Field Detection**
    - **Validates: Requirements 2.1.4, 3.3.1**
    - Test that fields not in mapping table are identified as unmapped

  - [ ]* 11.9 Write property test for schema ranking
    - **Property 18: Schema Ranking Correctness**
    - **Validates: Requirements 2.3.3**
    - Test that schemas are ranked by coverage in descending order

  - [ ]* 11.10 Write property test for coverage filtering
    - **Property 19: Coverage Threshold Filtering**
    - **Validates: Requirements 2.3.3**
    - Test that only schemas >= threshold are in top schemas

  - [ ]* 11.11 Write property test for LLM schema matching
    - **Property 20: LLM Schema Matching**
    - **Validates: Requirements 2.1.4, 2.3.2, 3.3.2**
    - Test that LLM returns valid schema field mappings

  - [ ]* 11.12 Write unit tests for two-stage extraction
    - Test algorithm extraction stage
    - Test LLM semantic extraction stage
    - Test schema hit merging
    - Test coverage calculation
    - Test error handling in each stage
    - _Requirements: 2.1.1, 2.1.4, 2.3.3_

- [x] 12. Checkpoint - Verify two-stage extraction
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Integration with existing field extractor ✅ **PARTIALLY DONE**
  - [x] 13.1 Add two-stage extraction option to extractFields() ✅ **DONE: 通过UniversalDocumentPipeline集成**
    - ✅ Add useTwoStageExtraction parameter → Pipeline中已集成
    - ✅ Add schemas parameter for schema matching → SchemaMatcherV2接收schemas
    - ✅ Add coverageThreshold parameter → `threshold`参数
    - ✅ Integrate two_stage_extractor when enabled → SchemaMatcherV2已集成
    - _Requirements: 2.1.1, 2.1.4, 2.3.3_

  - [x] 13.2 Update extractFieldsFromCKBs() for batch two-stage extraction ✅ **DONE: Pipeline支持批处理**
    - ✅ Support two-stage extraction in batch mode → Pipeline的`processBatch()`
    - ✅ Return schema ranking for each CKB → 每个CKB返回`matchedSchemas`
    - ✅ Handle errors gracefully → try-catch错误处理
    - _Requirements: 2.4.3_

  - [x]* 13.3 Write integration test for two-stage extraction ✅ **DONE: 多个测试文件**
    - ✅ Test complete flow with real travel document → `test_production_data2.js`
    - ✅ Verify algorithm fields are extracted → 测试验证
    - ✅ Verify LLM semantic fields are extracted → 测试验证
    - ✅ Verify schema ranking is correct → 测试验证
    - ✅ Verify top schemas meet coverage threshold → 测试验证
    - _Requirements: 2.1.1, 2.1.4, 2.3.3_

- [x] 14. Add monitoring and metrics
  - [x] 14.1 Add performance monitoring integration
    - Record domain detection metrics
    - Record strategy selection metrics
    - Record extraction metrics (time, tokens, field count)
    - Record cache hit rate
    - Record schema matching metrics (hit counts, coverage)
    - _Requirements: 6.2_

  - [x] 14.2 Add error tracking
    - Track domain detection errors
    - Track strategy selection errors
    - Track extraction errors by type
    - Track schema validation errors
    - Track schema matching errors
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 14.3 Write unit tests for monitoring
    - Test metric recording
    - Test error tracking
    - Test metric aggregation
    - _Requirements: 6.2_

- [ ] 15. End-to-end integration testing
  - [x]* 15.1 Write end-to-end test with real travel document
    - Test complete two-stage extraction flow
    - Verify semantic field names are extracted
    - Verify schema ranking is correct
    - Verify top schemas have >40% coverage
    - Verify token tracking works
    - _Requirements: 2.1.1, 2.1.2, 2.1.3, 2.1.4, 2.3.3, 2.4.1_

  - [ ]* 15.2 Write test with multiple schemas
    - Test extraction with 3+ available schemas
    - Verify correct schema is ranked highest
    - Verify coverage calculation is accurate
    - _Requirements: 2.3.3_

  - [ ]* 15.3 Write test with unmapped fields
    - Test extraction where some fields are not in mapping table
    - Verify unmapped fields are sent to LLM
    - Verify LLM returns semantic field names
    - Verify LLM schema matching works
    - _Requirements: 2.1.4, 3.3.1, 3.3.2_

  - [ ]* 15.4 Write batch extraction test
    - Test batch extraction with multiple CKBs
    - Verify schema ranking for each CKB
    - Verify error handling in batch mode
    - _Requirements: 2.4.3_

  - [ ]* 15.5 Write cache behavior test
    - Test cache with repeated two-stage extractions
    - Verify cache hit rate
    - Verify token savings from cache
    - _Requirements: 2.4.4_

- [ ] 16. Property-based test suite completion
  - [ ]* 16.1 Write property test for domain detection performance
    - **Property 13: Domain Detection Performance**
    - **Validates: Requirements NFR-4.1.2**
    - Test that detection completes within 10ms

  - [ ]* 16.2 Write property test for strategy selection performance
    - **Property 14: Strategy Selection Performance**
    - **Validates: Requirements NFR-4.1.3**
    - Test that selection completes within 5ms

- [x] 17. Final checkpoint and validation
  - Ensure all tests pass (unit, property, integration)
  - Verify backward compatibility with existing code
  - Verify performance requirements are met
  - Verify two-stage extraction produces correct schema rankings
  - Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (minimum 100 iterations each)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- The implementation reuses existing infrastructure (LLM client, prompts, extractors, mapping table)
- Backward compatibility is maintained throughout (existing code works without changes)
- New features are opt-in via the options parameter
- **Two-stage extraction flow**:
  - Stage 1: Algorithm extraction (Rule+NER) → Mapping table lookup → Schema hit counting
  - Stage 2: LLM semantic extraction for unmapped fields → Schema field matching
  - Merge: Combine hit counts → Rank schemas by coverage → Filter (>40% coverage)
- The two-stage approach optimizes token usage by only using LLM for fields not in the mapping table

