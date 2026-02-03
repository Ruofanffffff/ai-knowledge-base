# Implementation Plan: Universal Document Pipeline

## Overview

This implementation plan creates a reusable, configurable pipeline module that integrates all existing knowledge graph components into a unified orchestration layer. The pipeline will provide a clean API for processing documents from input to knowledge graph generation, with comprehensive error handling, metrics tracking, and batch processing support.

## Tasks

- [x] 1. Create pipeline module structure and core interfaces
  - Create `kg/pipeline/` directory
  - Create `kg/pipeline/universal_document_pipeline.js` main module file
  - Define `ProcessingContext` data structure
  - Define `PipelineOptions` and `BatchOptions` configuration interfaces
  - Create module exports and basic class structure
  - _Requirements: 1.5, 8.1, 8.5_

- [x] 2. Implement document validation and context creation
  - [x] 2.1 Implement document format validation
    - Validate supported formats (text, PDF, Word, Excel)
    - Check document size against limits
    - Return clear error messages for unsupported formats
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 2.2 Write property test for document validation
    - **Property 1: Document Format Support**
    - **Property 2: Document Validation**
    - **Property 3: Invalid Format Error Messages**
    - **Validates: Requirements 1.1, 1.2, 1.3**
  
  - [x] 2.3 Implement Processing_Context creation
    - Initialize context with document metadata
    - Set up steps tracking structure
    - Initialize metrics and error arrays
    - _Requirements: 1.5_
  
  - [x] 2.4 Write property test for context creation
    - **Property 4: Processing Context Creation**
    - **Validates: Requirements 1.5**

- [x] 3. Implement step executor with error handling
  - [x] 3.1 Create StepExecutor internal class
    - Implement `executeStep()` method with try-catch
    - Implement `recordMetrics()` for timing and results
    - Implement `handleStepError()` with criticality handling
    - Support critical vs non-critical error distinction
    - _Requirements: 10.1, 10.2, 10.3_
  
  - [x] 3.2 Write property tests for error handling
    - **Property 11: Critical Error Termination**
    - **Property 12: Non-Critical Error Continuation**
    - **Property 13: Error Logging Completeness**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**
  
  - [x] 3.3 Implement metrics recording
    - Record execution time for each step
    - Record step status (success, failure, partial)
    - Store results and errors in context
    - _Requirements: 9.1, 9.2, 12.1_
  
  - [x] 3.4 Write property test for metrics tracking
    - **Property 8: Metrics Tracking Completeness**
    - **Validates: Requirements 2.5, 3.5, 4.5, 5.5, 6.6, 7.5, 9.1, 9.2, 12.1**

- [x] 4. Checkpoint - Ensure core infrastructure tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement document parsing step
  - [x] 5.1 Integrate ckb_parser for document parsing
    - Import and call `ckb_parser.parseDocument()`
    - Handle parsing errors with appropriate logging
    - Store CKB results in Processing_Context
    - Mark parsing as critical step
    - _Requirements: 2.1, 2.3_
  
  - [x] 5.2 Write unit tests for parsing step
    - Test successful parsing for different formats
    - Test parsing error handling
    - Test context updates after parsing
    - _Requirements: 2.1, 2.3_

- [x] 6. Implement field extraction step
  - [x] 6.1 Integrate field_extractor module
    - Import and call `field_extractor.extractFields()`
    - Pass configuration (useLLM, useNER, useRules)
    - Handle extraction errors with degradation
    - Store extracted fields in context
    - Record field count and extraction time
    - _Requirements: 2.1, 2.2, 2.3, 2.5_
  
  - [x] 6.2 Write property tests for field extraction
    - **Property 5: Pipeline Step Execution Order** (partial - extraction after parsing)
    - **Property 6: Configuration Propagation** (partial - extraction config)
    - **Property 7: Data Flow Through Context** (partial - extracted fields)
    - **Validates: Requirements 2.1, 2.2, 2.3, 8.1, 8.2**
  
  - [x] 6.3 Implement extraction error degradation
    - Fallback from LLM to NER+Rules on LLM failure
    - Log warnings for partial extraction
    - Continue pipeline if minimum fields extracted
    - _Requirements: 2.4, 10.4_
  
  - [x] 6.4 Write property test for LLM fallback
    - **Property 14: LLM Fallback Degradation**
    - **Validates: Requirements 10.4**

- [x] 7. Implement schema matching step
  - [x] 7.1 Integrate schema_matcher and schema_manager
    - Load schemas using `schema_manager.listSchemas()`
    - Call `schema_matcher.matchSchemas()` with extracted fields
    - Get triggered schemas using `schema_matcher.getTriggeredSchemas()`
    - Store matched schemas and confidence scores in context
    - Record matching time
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
  
  - [x] 7.2 Write property tests for schema matching
    - **Property 5: Pipeline Step Execution Order** (partial - matching after extraction)
    - **Property 6: Configuration Propagation** (partial - matching config)
    - **Property 7: Data Flow Through Context** (partial - matched schema)
    - **Validates: Requirements 3.1, 3.2, 3.3, 8.1, 8.3**
  
  - [x] 7.3 Implement generic schema fallback
    - Detect when no schema meets threshold
    - Log warning and use generic schema
    - Continue pipeline with generic schema
    - _Requirements: 3.4_
  
  - [x] 7.4 Write unit test for generic schema fallback
    - Test fallback when no schema matches
    - Verify warning is logged
    - Verify pipeline continues
    - _Requirements: 3.4_

- [x] 8. Checkpoint - Ensure extraction and matching tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement field normalization step
  - [x] 9.1 Integrate field_normalizer module
    - Call `field_normalizer.normalizeFields()` for each matched schema
    - Pass extracted fields, schema, and configuration
    - Handle partial normalization failures
    - Store normalized fields in context
    - Record normalization time and success rate
    - _Requirements: 4.1, 4.2, 4.3, 4.5_
  
  - [x] 9.2 Write property tests for field normalization
    - **Property 5: Pipeline Step Execution Order** (partial - normalization after matching)
    - **Property 6: Configuration Propagation** (partial - normalization config)
    - **Property 7: Data Flow Through Context** (partial - normalized fields)
    - **Validates: Requirements 4.1, 4.2, 4.3, 8.1, 8.2, 8.3**
  
  - [x] 9.3 Implement partial normalization handling
    - Accept partial results if some fields normalize successfully
    - Log warnings for failed field mappings
    - Calculate and record mapping success rate
    - Continue pipeline with partial results
    - _Requirements: 4.4_
  
  - [x] 9.4 Write unit test for partial normalization
    - Test handling of partial normalization failures
    - Verify warnings are logged
    - Verify success rate calculation
    - _Requirements: 4.4_

- [x] 10. Implement entity building step
  - [x] 10.1 Integrate entity_builder module
    - Call `entity_builder.buildEntity()` for each matched schema
    - Pass normalized fields, schema, and configuration
    - Handle entity building errors with partial entity support
    - Store built entities in context
    - Record building time and entity count
    - _Requirements: 5.1, 5.2, 5.3, 5.5_
  
  - [x] 10.2 Write property tests for entity building
    - **Property 5: Pipeline Step Execution Order** (partial - building after normalization)
    - **Property 6: Configuration Propagation** (partial - building config)
    - **Property 7: Data Flow Through Context** (partial - entities)
    - **Validates: Requirements 5.1, 5.2, 5.3, 8.1, 8.2**
  
  - [x] 10.3 Implement partial entity building
    - Attempt to build partial entities on failure
    - Log errors and warnings
    - Continue pipeline if at least one entity built
    - _Requirements: 5.4_
  
  - [x] 10.4 Write unit test for partial entity building
    - Test partial entity construction
    - Verify error logging
    - Verify pipeline continuation
    - _Requirements: 5.4_

- [x] 11. Implement relation extraction step
  - [x] 11.1 Integrate all relation builders
    - Import builtin, cooccurrence, and semantic relation builders
    - Call enabled builders based on configuration
    - Pass entities and configuration to each builder
    - Handle builder failures independently
    - Store extracted relations in context
    - Record extraction time and relation count per builder
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.6_
  
  - [x] 11.2 Write property tests for relation extraction
    - **Property 5: Pipeline Step Execution Order** (partial - extraction after building)
    - **Property 6: Configuration Propagation** (partial - relation config)
    - **Property 7: Data Flow Through Context** (partial - relations)
    - **Property 20: Relation Builder Configuration**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 8.1, 8.4**
  
  - [x] 11.3 Implement relation builder error handling
    - Continue if some builders fail
    - Log warnings for failed builders
    - Record results from successful builders
    - Mark step as partial success if some builders fail
    - _Requirements: 6.5_
  
  - [x] 11.4 Write unit test for relation builder failures
    - Test handling of individual builder failures
    - Verify warnings are logged
    - Verify successful builders' results are kept
    - _Requirements: 6.5_

- [x] 12. Checkpoint - Ensure entity and relation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Implement knowledge graph storage step
  - [x] 13.1 Integrate kg_service for storage
    - Import and use `kg_service` or entity/relation stores
    - Wrap storage in database transaction
    - Store entities and relations atomically
    - Update context with stored IDs
    - Record storage time
    - _Requirements: 7.1, 7.2, 7.4, 7.5_
  
  - [x] 13.2 Write property tests for storage
    - **Property 15: Transaction Atomicity**
    - **Property 7: Data Flow Through Context** (partial - stored IDs)
    - **Validates: Requirements 7.1, 7.2, 7.4**
  
  - [x] 13.3 Implement transaction rollback on failure
    - Catch storage errors
    - Rollback transaction on failure
    - Return error in context
    - Mark storage as critical step
    - _Requirements: 7.3_
  
  - [x] 13.4 Write unit test for storage rollback
    - Test transaction rollback on failure
    - Verify no data is persisted on error
    - Verify error is returned in context
    - _Requirements: 7.3_

- [x] 14. Implement processing context finalization
  - [x] 14.1 Calculate total processing time
    - Sum all step durations
    - Record total time in context
    - Calculate throughput metrics
    - _Requirements: 9.4, 12.3_
  
  - [x] 14.2 Write property tests for time calculation
    - **Property 9: Total Processing Time Calculation**
    - **Property 22: Throughput Metrics Calculation**
    - **Validates: Requirements 9.4, 12.3**
  
  - [x] 14.3 Generate processing summary
    - List successful and failed steps
    - Identify slowest step (bottleneck)
    - Calculate performance statistics
    - Return complete context
    - _Requirements: 9.3, 9.5, 12.4, 12.5_
  
  - [x] 14.4 Write property tests for summary generation
    - **Property 10: Complete Context Return**
    - **Property 23: Performance Statistics Accuracy**
    - **Property 24: Bottleneck Identification**
    - **Validates: Requirements 9.3, 9.5, 12.4, 12.5**

- [x] 15. Implement batch processing functionality
  - [x] 15.1 Create BatchProcessor internal class
    - Implement `processConcurrently()` method
    - Use Promise.all with concurrency limit
    - Process each document independently
    - Collect all results
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [x] 15.2 Write property tests for batch processing
    - **Property 16: Batch Processing Independence**
    - **Property 17: Batch Result Completeness**
    - **Property 18: Concurrency Limit Enforcement**
    - **Validates: Requirements 11.2, 11.3, 11.4, 11.5**
  
  - [x] 15.3 Implement batch error handling
    - Continue processing on individual document failures
    - Collect all results (success and failure)
    - Return array of all Processing_Contexts
    - _Requirements: 11.4, 11.5_
  
  - [x] 15.4 Write unit tests for batch error handling
    - Test batch processing with some failing documents
    - Verify all documents are processed
    - Verify all results are returned
    - _Requirements: 11.4, 11.5_

- [x] 16. Implement token usage tracking
  - [x] 16.1 Integrate token_tracker utility
    - Track token usage for LLM-based steps
    - Record API call counts
    - Store token metrics in context
    - _Requirements: 12.2_
  
  - [x] 16.2 Write property test for token tracking
    - **Property 21: Token Usage Tracking**
    - **Validates: Requirements 12.2**

- [x] 17. Implement default configuration handling
  - [x] 17.1 Define default configuration values
    - Set sensible defaults for all options
    - Document default values in code comments
    - Apply defaults when no config provided
    - _Requirements: 8.5_
  
  - [x] 17.2 Write property test for default configuration
    - **Property 19: Default Configuration Application**
    - **Validates: Requirements 8.5**

- [x] 18. Checkpoint - Ensure all core functionality tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Create comprehensive integration tests
  - [x] 19.1 Write end-to-end integration test
    - Test complete flow from document to knowledge graph
    - Verify all steps execute in correct order
    - Verify data flows through context correctly
    - Test with real documents (text, PDF, Word)
    - **Property 5: Pipeline Step Execution Order**
    - **Property 6: Configuration Propagation**
    - **Property 7: Data Flow Through Context**
    - **Validates: Requirements 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1**
  
  - [x] 19.2 Write configuration integration test
    - Test all configuration options
    - Verify LLM enable/disable works
    - Verify confidence thresholds are respected
    - Verify relation builder selection works
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
  
  - [x] 19.3 Write error handling integration test
    - Test critical error termination
    - Test non-critical error continuation
    - Test LLM fallback degradation
    - Test partial results handling
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5**

- [x] 20. Create module documentation
  - [x] 20.1 Write README.md for pipeline module
    - Document module purpose and features
    - Provide usage examples
    - Document configuration options
    - Include API reference
    - Add troubleshooting guide
  
  - [x] 20.2 Add JSDoc comments to all public methods
    - Document parameters and return types
    - Add usage examples in comments
    - Document error conditions
  
  - [x] 20.3 Create migration guide for build_knowledge_graph.js
    - Show how to refactor existing script to use pipeline
    - Provide before/after code examples
    - Document benefits of migration

- [x] 21. Final checkpoint - Complete system validation
  - Run all tests (unit, property, integration)
  - Verify all requirements are met
  - Test with real documents from different domains
  - Measure and document performance metrics
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples, edge cases, and error conditions
- Integration tests verify end-to-end flows and module interactions
- The pipeline reuses all existing modules without modification
- Focus is on orchestration, error handling, and configuration management
