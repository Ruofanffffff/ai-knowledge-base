-=jixu # Implementation Plan: Human-Readable Knowledge Graph Enhancement

## Overview

This implementation plan breaks down the human-readable knowledge graph enhancement into discrete coding tasks. The approach follows an incremental strategy: implement core name standardization first, then relationship descriptions, then hierarchical extraction, and finally quality validation. Each phase includes property-based tests to validate correctness properties from the design document.

## Tasks

- [x] 1. Set up project structure and core interfaces
  - Create directory structure for new modules
  - Define TypeScript/JSDoc interfaces for EntityNameStandardizer, RelationDescriptionGenerator, HierarchicalRelationExtractor
  - Set up fast-check for property-based testing
  - Configure environment variables for feature flags
  - _Requirements: 5.5_

- [ ] 2. Implement Entity Name Standardizer
  - [x] 2.1 Create EntityNameStandardizer class with core methods
    - Implement `standardizeName()` method with algorithm-based logic
    - Implement `extractCoreConcept()` for text fragment simplification
    - Implement context extraction utilities (±50 character window)
    - _Requirements: 1.1, 2.2_
  
  - [x] 2.2 Implement numeric parameter name standardization
    - Add pattern matching for common parameter types (ISO, shutter speed, aperture, etc.)
    - Implement context analysis to identify measurement types
    - Add fallback logic for low-context scenarios
    - _Requirements: 1.1, 1.2_
  
  - [x] 2.3 Write property test for numeric parameter naming
    - **Property 2: Numeric Parameter Descriptive Naming**
    - **Validates: Requirements 1.1, 1.5**
    - Generate random numeric parameters with context
    - Verify names contain descriptive terms
  
  - [x] 2.4 Write property test for no unknown names
    - **Property 1: No Unknown Entity Names**
    - **Validates: Requirements 1.4, 6.1**
    - Generate random entities
    - Verify none have "unknown" names
  
  - [x] 2.5 Write property test for numeric parameter uniqueness
    - **Property 4: Numeric Parameter Uniqueness**
    - **Validates: Requirements 1.3**
    - Generate documents with multiple numeric parameters
    - Verify all names are unique
  
  - [ ] 2.6 Implement LLM enhancement for ambiguous cases
    - Add LLM client integration for name enhancement
    - Implement prompt building for name standardization
    - Add caching for LLM results
    - _Requirements: 1.1_
  
  - [ ] 2.7 Implement synonym detection and merging
    - Add semantic similarity calculation using embeddings
    - Implement entity grouping logic (similarity > 0.85)
    - Add canonical name selection based on frequency
    - Implement attribute and CKB merging
    - _Requirements: 2.3_
  
  - [ ] 2.8 Write property test for synonym merging
    - **Property 6: Synonym Merging**
    - **Validates: Requirements 2.3**
    - Generate sets of synonymous entities
    - Verify they get merged under one name
  
  - [x] 2.9 Write property test for entity name normalization
    - **Property 5: Entity Name Normalization**
    - **Validates: Requirements 2.1, 2.2, 2.4, 2.5**
    - Generate entities with various name issues
    - Verify normalization rules are applied
  
  - [ ] 2.10 Write unit tests for edge cases
    - Test empty context scenarios
    - Test special characters in names
    - Test very long names (>100 characters)
    - Test non-ASCII characters
    - _Requirements: 1.2, 2.1, 2.2_

- [ ] 3. Integrate Entity Name Standardizer with Entity Builder
  - [x] 3.1 Modify entity_builder.js to use EntityNameStandardizer
    - Update `generateCanonicalName()` to call standardizer
    - Add name standardization metadata to entity objects
    - Preserve original names for debugging
    - _Requirements: 1.1, 2.1_
  
  - [x] 3.2 Add configuration support for name standardization
    - Add ENABLE_ENTITY_NAME_STANDARDIZATION environment variable
    - Implement feature flag logic
    - Add fallback to original behavior when disabled
    - _Requirements: 5.5_
  
  - [x] 3.3 Write integration tests for entity builder
    - Test entity building with standardization enabled/disabled
    - Test with real document samples
    - Verify metadata is correctly added
    - _Requirements: 1.1, 5.5_

- [x] 4. Checkpoint - Ensure entity name standardization works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement Relation Description Generator
  - [x] 5.1 Create RelationDescriptionGenerator class
    - Implement `generateDescription()` main method
    - Implement `generateTemplateDescription()` for template-based generation
    - Load relation type definitions from relation_types.json
    - _Requirements: 3.1, 3.4_
  
  - [x] 5.2 Implement template-based description generation
    - Create description templates for all relation types
    - Implement template variable substitution (source, target, type)
    - Add support for Chinese and English templates
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 5.3 Implement LLM-based description generation
    - Add `generateLLMDescription()` method
    - Implement prompt building with context extraction
    - Add description validation (length, content)
    - Implement caching for similar relationships
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [ ] 5.4 Write property test for relationship description completeness
    - **Property 7: Relationship Description Completeness and Quality**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 6.2**
    - Generate random relationships
    - Verify descriptions meet all quality criteria
  
  - [x] 5.5 Write unit tests for description generation
    - Test template generation for each relation type
    - Test LLM generation with mocked responses
    - Test error handling and fallbacks
    - Test with missing entity data
    - _Requirements: 3.1, 3.4_

- [x] 6. Integrate Relation Description Generator with Relation Builders
  - [x] 6.1 Modify builtin_relation_builder.js to generate descriptions
    - Update `buildRelationFromTemplate()` to call description generator
    - Add description metadata to relation objects
    - _Requirements: 3.1_
  
  - [x] 6.2 Modify semantic_relation_builder.js to generate descriptions
    - Add description generation after relation creation
    - Handle semantic-specific context
    - _Requirements: 3.1_
  
  - [x] 6.3 Modify cooccurrence_relation_builder.js to generate descriptions
    - Add description generation for co-occurrence relations
    - Use co-occurrence context for descriptions
    - _Requirements: 3.1_
  
  - [x] 6.4 Add configuration support for description generation
    - Add ENABLE_RELATION_DESCRIPTIONS environment variable
    - Add DESCRIPTION_GENERATION_METHOD configuration (template/llm/hybrid)
    - Implement feature flag logic
    - _Requirements: 5.5_
  
  - [x] 6.5 Write integration tests for relation builders
    - Test relation building with descriptions enabled/disabled
    - Test with different generation methods
    - Verify metadata is correctly added
    - _Requirements: 3.1, 5.5_

- [x] 7. Checkpoint - Ensure relationship descriptions work
  - Ensure all tests pass, ask the user if questions arise.

- [-] 8. Implement Hierarchical Relation Extractor
  - [x] 8.1 Create HierarchicalRelationExtractor class
    - Implement `extractHierarchicalRelations()` main method
    - Implement `extractIsARelations()` for taxonomy
    - Implement `extractPartOfRelations()` for composition
    - Implement `extractHasPropertyRelations()` for attributes
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 8.2 Implement pattern-based extraction
    - Add regex patterns for is_a relationships (Chinese and English)
    - Add regex patterns for part_of relationships
    - Add regex patterns for has_property relationships
    - Implement dependency parsing for complex patterns
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 8.3 Write property test for hierarchical pattern extraction
    - **Property 8: Hierarchical Pattern Extraction**
    - **Validates: Requirements 4.1, 4.2, 4.3**
    - Generate documents with hierarchical patterns
    - Verify corresponding relations are created
  
  - [ ] 8.4 Implement LLM-based hierarchical inference
    - Add `inferHierarchicalRelations()` method
    - Implement prompt building for hierarchical inference
    - Add entity grouping by domain
    - Implement validation against entity types
    - _Requirements: 4.5_
  
  - [ ] 8.5 Write property test for LLM hierarchical inference
    - **Property 10: LLM Hierarchical Inference**
    - **Validates: Requirements 4.5**
    - Generate documents without explicit patterns
    - Verify LLM inference is invoked
  
  - [ ] 8.6 Implement domain knowledge integration
    - Load domain-specific taxonomies (photography, travel, etc.)
    - Implement entity matching against known hierarchies
    - Create is_a relations for matches
    - _Requirements: 4.5_
  
  - [ ] 8.7 Write unit tests for hierarchical extraction
    - Test each pattern type individually
    - Test with various entity types
    - Test circular hierarchy detection
    - Test invalid entity type combinations
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [ ] 8.8 Write property test for relationship type support
    - **Property 9: Hierarchical Relationship Type Support**
    - **Validates: Requirements 4.4**
    - Test creation of each hierarchical type
    - Verify system supports all required types

- [ ] 9. Integrate Hierarchical Relation Extractor with Pipeline
  - [x] 9.1 Add hierarchical extraction to knowledge graph pipeline
    - Integrate HierarchicalRelationExtractor after relation building
    - Pass entities and document text to extractor
    - Merge hierarchical relations with existing relations
    - _Requirements: 4.1, 4.2, 4.3_
  
  - [x] 9.2 Add configuration support for hierarchical extraction
    - Add ENABLE_HIERARCHICAL_EXTRACTION environment variable
    - Add HIERARCHICAL_EXTRACTION_METHOD configuration (pattern/llm/hybrid)
    - Implement feature flag logic
    - _Requirements: 5.5_
  
  - [x] 9.3 Write integration tests for pipeline
    - Test end-to-end extraction with hierarchical relations
    - Test with different extraction methods
    - Test with various document types
    - _Requirements: 4.1, 4.5_

- [x] 10. Checkpoint - Ensure hierarchical extraction works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Implement Human Readability Validator
  - [x] 11.1 Create HumanReadabilityValidator class
    - Implement `validate()` main method
    - Implement `validateEntityNames()` for entity validation
    - Implement `validateRelationDescriptions()` for relation validation
    - Implement `generateQualityReport()` for reporting
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 11.2 Implement entity name validation rules
    - Check for "unknown" names
    - Validate name length (2-20 chars Chinese, 2-40 chars English)
    - Check for descriptive terms
    - Validate format (no excessive whitespace, special characters)
    - _Requirements: 6.1, 6.3_
  
  - [x] 11.3 Write property test for entity name quality validation
    - **Property 13: Entity Name Quality Validation**
    - **Validates: Requirements 6.3**
    - Generate random entities
    - Verify validation catches quality issues
  
  - [x] 11.4 Implement relationship description validation rules
    - Check for non-empty descriptions
    - Validate description length (5-50 words)
    - Check for entity references
    - Validate natural language format
    - _Requirements: 6.2_
  
  - [x] 11.5 Implement quality report generation
    - Calculate percentage of standardized entity names
    - Calculate percentage of relations with descriptions
    - Calculate average name and description lengths
    - Generate warnings and recommendations
    - _Requirements: 6.4, 6.5_
  
  - [x] 11.6 Write unit tests for validation
    - Test each validation rule individually
    - Test quality report generation
    - Test with edge cases (empty graphs, all failures)
    - _Requirements: 6.1, 6.2, 6.3_

- [x] 12. Integrate Human Readability Validator with Pipeline
  - [x] 12.1 Add validation to knowledge graph pipeline
    - Integrate HumanReadabilityValidator before output
    - Add validation results to output metadata
    - Generate quality report for each extraction
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 12.2 Write integration tests for validation
    - Test end-to-end extraction with validation
    - Test with documents that should pass/fail validation
    - Verify quality reports are generated
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 13. Implement Backward Compatibility
  - [x] 13.1 Add field preservation logic
    - Ensure all original fields are preserved in enhanced output
    - Add new fields as additional properties
    - Implement schema validation
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [x] 13.2 Write property test for field preservation
    - **Property 11: Backward Compatibility - Field Preservation**
    - **Validates: Requirements 5.1, 5.2**
    - Compare enhanced vs original output
    - Verify no fields are removed
  
  - [x] 13.3 Write property test for schema structure
    - **Property 12: Backward Compatibility - Schema Structure**
    - **Validates: Requirements 5.3, 5.4**
    - Validate enhanced output against original schema
    - Test query compatibility
  
  - [x] 13.4 Write compatibility tests with downstream systems
    - Test with existing query patterns
    - Test with existing parsers
    - Verify responses match old format
    - _Requirements: 5.4_

- [x] 14. Implement Error Handling
  - [x] 14.1 Add error handling to EntityNameStandardizer
    - Implement fallback to generic patterns
    - Add error logging with context
    - Implement retry logic for LLM calls
    - _Requirements: 1.2_
  
  - [x] 14.2 Add error handling to RelationDescriptionGenerator
    - Implement fallback to minimal templates
    - Add error logging
    - Implement timeout handling
    - _Requirements: 3.1_
  
  - [x] 14.3 Add error handling to HierarchicalRelationExtractor
    - Implement graceful skipping of failed extractions
    - Add error logging
    - Implement LLM timeout handling
    - _Requirements: 4.5_
  
  - [x] 14.4 Write unit tests for error scenarios
    - Test LLM unavailable scenarios
    - Test timeout scenarios
    - Test invalid input scenarios
    - Test partial failure scenarios

- [x] 15. Checkpoint - Ensure error handling works
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 16. Performance Optimization
  - [ ] 16.1 Implement caching for LLM results
    - Add LRU cache for entity name enhancements
    - Add cache for relationship descriptions
    - Add cache for hierarchical inferences
    - Implement cache size limits and eviction
  
  - [ ] 16.2 Implement batch processing for LLM calls
    - Batch multiple name standardizations
    - Batch multiple description generations
    - Batch hierarchical inferences
    - Target: 5-10 items per batch
  
  - [ ] 16.3 Optimize pattern matching
    - Compile regex patterns once
    - Use efficient string matching algorithms
    - Implement early termination for matches
  
  - [ ] 16.4 Write performance tests
    - Measure processing time increase (target: <20%)
    - Measure LLM token consumption (target: <500 tokens/doc)
    - Test with large documents (>10,000 words)
    - Test batch processing (100+ documents)

- [x] 17. End-to-End Integration and Testing
  - [x] 17.1 Wire all components together in main pipeline
    - Integrate EntityNameStandardizer with entity_builder
    - Integrate RelationDescriptionGenerator with relation builders
    - Integrate HierarchicalRelationExtractor with pipeline
    - Integrate HumanReadabilityValidator with pipeline
    - _Requirements: 1.1, 3.1, 4.1, 6.1_
  
  - [x] 17.2 Add master configuration for all enhancements
    - Add ENABLE_HUMAN_READABLE_KG master flag
    - Implement cascading configuration logic
    - Add configuration validation
    - _Requirements: 5.5_
  
  - [x] 17.3 Write end-to-end integration tests
    - Test with real documents from multiple domains
    - Test with all enhancements enabled/disabled
    - Test with different configuration combinations
    - Verify quality metrics meet targets
    - _Requirements: 1.1, 3.1, 4.1, 5.5, 6.1_
  
  - [x] 17.4 Write property test for fallback naming
    - **Property 3: Numeric Parameter Fallback Naming**
    - **Validates: Requirements 1.2**
    - Generate numeric parameters with minimal context
    - Verify fallback pattern is used

- [x] 18. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end functionality
- The implementation follows an incremental approach: name standardization → descriptions → hierarchical extraction → validation
