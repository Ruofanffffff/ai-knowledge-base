# Design Document: Universal Document Pipeline

## Overview

The Universal Document Pipeline is a comprehensive, configurable system that orchestrates the complete flow from document input to knowledge graph generation. **This design builds upon and integrates existing implementations**:

- **Existing `document_processor`**: Provides document structure analysis, content filtering, and completeness validation
- **Existing `build_knowledge_graph.js`**: Demonstrates the complete flow but as a script, not a reusable module
- **New `universal_document_pipeline`**: Creates a reusable, configurable pipeline module that integrates all existing components

### Relationship to Existing Code

This pipeline **enhances and unifies** existing implementations:

1. **Reuses `document_processor`** for document parsing and structure analysis
2. **Integrates all KG modules** (field_extractor, schema_matcher, field_normalizer, entity_builder, relation_builders)
3. **Adds orchestration layer** with consistent error handling, metrics tracking, and configuration
4. **Provides reusable API** that `build_knowledge_graph.js` and other code can use
5. **Maintains compatibility** with existing database schemas and data models

### Key Design Principles

1. **Integration over Reimplementation**: Reuse all existing modules without modification
2. **Context-Driven Processing**: A Processing_Context object flows through all steps, accumulating results and metrics
3. **Fail-Safe Design**: Each step has error handling with appropriate degradation strategies
4. **Configurability**: Every step accepts configuration parameters for flexibility
5. **Observability**: Comprehensive tracking of execution time, metrics, and results at each step

### Design Goals

- **Universality**: Handle 90%+ of document scenarios without domain-specific hooks
- **Completeness**: Cover all steps from document to knowledge graph without gaps
- **Traceability**: Provide detailed execution logs and performance metrics
- **Resilience**: Continue processing when non-critical steps fail
- **Performance**: Support batch processing with configurable concurrency
- **Backward Compatibility**: Work seamlessly with existing code and database schemas

## Architecture

### High-Level Flow

```
Document Input
    ↓
[1] Document Parsing (REUSE: ckb_parser or document_processor)
    ↓
[2] Field Extraction (REUSE: field_extractor)
    ↓
[3] Schema Matching (REUSE: schema_matcher)
    ↓
[4] Field Normalization (REUSE: field_normalizer)
    ↓
[5] Entity Building (REUSE: entity_builder)
    ↓
[6] Relation Extraction (REUSE: relation_builders)
    ↓
[7] Knowledge Graph Storage (REUSE: kg_service)
    ↓
Processing Context Output
```

### Module Integration (All Existing Code)

The pipeline **reuses** these existing modules without modification:

**Document Processing**:
- `kg/ckb/ckb_parser.js` - Document parsing (CKB creation)
- `kg/document_processor/index.js` - Enhanced document processing with structure analysis

**Knowledge Graph Construction**:
- `kg/field_extractor/field_extractor.js` - Field extraction (LLM, NER, Rules)
- `kg/schema/schema_matcher.js` - Schema matching with scoring
- `kg/schema/schema_manager.js` - Schema loading and management
- `kg/field_normalizer/field_normalizer.js` - Field normalization (LLM + Algorithm)
- `kg/entity/entity_builder.js` - Entity construction
- `kg/relation/builtin_relation_builder.js` - Built-in relation rules
- `kg/relation/cooccurrence_relation_builder.js` - Co-occurrence relations
- `kg/relation/semantic_relation_builder.js` - Semantic relations (LLM)

**Storage and Services**:
- `kg/services/kg_service.js` - Knowledge graph storage and querying
- `kg/entity/entity_store.js` - Entity persistence
- `kg/relation/relation_store.js` - Relation persistence

**Utilities**:
- `kg/utils/token_tracker.js` - Token usage tracking
- `kg/utils/performance_monitor.js` - Performance monitoring
- `kg/confidence/confidence_engine.js` - Confidence scoring

### Integration with `build_knowledge_graph.js`

The existing `build_knowledge_graph.js` script demonstrates the complete flow but is not reusable. This pipeline module will:

1. **Extract the orchestration logic** from the script into a reusable class
2. **Add configuration support** for all steps (currently hardcoded)
3. **Add error handling** and degradation strategies
4. **Add metrics tracking** and performance monitoring
5. **Support batch processing** with concurrency control
6. **Provide a clean API** that the script and other code can use

After implementation, `build_knowledge_graph.js` can be refactored to use:
```javascript
const { UniversalDocumentPipeline } = require('./kg/pipeline/universal_document_pipeline');
const pipeline = new UniversalDocumentPipeline();
const result = await pipeline.processDocument(document, options);
```

### Processing Context Structure

The Processing_Context is the central data structure that flows through the pipeline:

```javascript
{
  documentId: string,
  documentType: string,
  startTime: timestamp,
  endTime: timestamp,
  totalDuration: number,
  
  steps: {
    parsing: { status, duration, result, error },
    extraction: { status, duration, result, metrics, error },
    schemaMatching: { status, duration, result, metrics, error },
    normalization: { status, duration, result, metrics, error },
    entityBuilding: { status, duration, result, metrics, error },
    relationExtraction: { status, duration, result, metrics, error },
    storage: { status, duration, result, metrics, error }
  },
  
  data: {
    ckb: CKB,
    extractedFields: Field[],
    matchedSchema: Schema,
    normalizedFields: NormalizedField[],
    entities: Entity[],
    relations: Relation[]
  },
  
  metrics: {
    fieldCount: number,
    entityCount: number,
    relationCount: number,
    tokenUsage: number,
    confidenceScores: { schema: number, normalization: number }
  },
  
  errors: Error[],
  warnings: Warning[]
}
```

## Components and Interfaces

### 1. UniversalDocumentPipeline (Main Class)

**Purpose**: Orchestrates the complete document processing flow

**Public Methods**:

```javascript
class UniversalDocumentPipeline {
  /**
   * Process a single document through the complete pipeline
   * @param {Document} document - Input document (text, PDF, Word, Excel, etc.)
   * @param {PipelineOptions} options - Configuration for each step
   * @returns {Promise<ProcessingContext>} - Complete processing results
   */
  async processDocument(document, options = {})
  
  /**
   * Process multiple documents in batch with concurrency control
   * @param {Document[]} documents - Array of input documents
   * @param {BatchOptions} options - Batch processing configuration
   * @returns {Promise<ProcessingContext[]>} - Array of processing results
   */
  async processBatch(documents, options = {})
}
```

**Configuration Options**:

```javascript
const PipelineOptions = {
  // Field extraction configuration
  extraction: {
    useLLM: boolean,              // Default: true
    useNER: boolean,              // Default: true
    useRules: boolean,            // Default: true
    maxTokens: number             // Default: 4000
  },
  
  // Schema matching configuration
  schemaMatching: {
    useLLM: boolean,              // Default: true
    minConfidence: number,        // Default: 0.5
    fallbackToGeneric: boolean    // Default: true
  },
  
  // Field normalization configuration
  normalization: {
    useLLM: boolean,              // Default: true
    useAlgorithm: boolean,        // Default: true
    minConfidence: number,        // Default: 0.6
    maxRetries: number            // Default: 2
  },
  
  // Entity building configuration
  entityBuilding: {
    useLLM: boolean,              // Default: true
    allowPartialEntities: boolean,// Default: true
    minFieldCoverage: number      // Default: 0.5
  },
  
  // Relation extraction configuration
  relationExtraction: {
    enableBuiltin: boolean,       // Default: true
    enableCooccurrence: boolean,  // Default: true
    enableSemantic: boolean,      // Default: true
    semanticUseLLM: boolean,      // Default: true
    minConfidence: number         // Default: 0.5
  },
  
  // Storage configuration
  storage: {
    useTransaction: boolean,      // Default: true
    skipDuplicates: boolean       // Default: true
  },
  
  // Error handling
  errorHandling: {
    stopOnCriticalError: boolean, // Default: true
    continueOnWarning: boolean    // Default: true
  }
}

const BatchOptions = {
  ...PipelineOptions,
  concurrency: number,            // Default: 3
  stopOnFirstError: boolean       // Default: false
}
```

### 2. Step Executor (Internal)

**Purpose**: Execute individual pipeline steps with consistent error handling and metrics tracking

**Internal Methods**:

```javascript
class StepExecutor {
  /**
   * Execute a pipeline step with error handling and metrics
   * @param {string} stepName - Name of the step
   * @param {Function} stepFunction - Async function to execute
   * @param {ProcessingContext} context - Current processing context
   * @param {boolean} isCritical - Whether failure should stop pipeline
   * @returns {Promise<StepResult>} - Step execution result
   */
  async executeStep(stepName, stepFunction, context, isCritical)
  
  /**
   * Record step metrics in processing context
   */
  recordMetrics(stepName, startTime, result, context)
  
  /**
   * Handle step errors with appropriate logging and degradation
   */
  handleStepError(stepName, error, context, isCritical)
}
```

### 3. Pipeline Steps (Internal Functions)

Each step is implemented as an async function that takes context and options:

```javascript
// Step 1: Parse document and create CKB
async function parseDocument(document, context, options)

// Step 2: Extract fields from CKB
async function extractFields(context, options)

// Step 3: Match schema for extracted fields
async function matchSchema(context, options)

// Step 4: Normalize fields to schema
async function normalizeFields(context, options)

// Step 5: Build entities from normalized fields
async function buildEntities(context, options)

// Step 6: Extract relations between entities
async function extractRelations(context, options)

// Step 7: Store entities and relations to database
async function storeToKnowledgeGraph(context, options)
```

### 4. Batch Processor (Internal)

**Purpose**: Manage concurrent processing of multiple documents

```javascript
class BatchProcessor {
  /**
   * Process documents with concurrency control
   * @param {Document[]} documents - Documents to process
   * @param {BatchOptions} options - Batch configuration
   * @param {Function} processFn - Single document processor
   * @returns {Promise<ProcessingContext[]>} - All results
   */
  async processConcurrently(documents, options, processFn)
}
```

## Data Models

### Document

```javascript
{
  id: string,
  type: 'text' | 'pdf' | 'word' | 'excel' | 'other',
  content: string | Buffer,
  metadata: {
    filename: string,
    size: number,
    mimeType: string
  }
}
```

### ProcessingContext

See "Processing Context Structure" in Architecture section above.

### StepResult

```javascript
{
  status: 'success' | 'failure' | 'partial',
  duration: number,
  result: any,
  metrics: {
    [key: string]: number
  },
  error: Error | null,
  warnings: Warning[]
}
```

### PipelineMetrics

```javascript
{
  totalDocuments: number,
  successfulDocuments: number,
  failedDocuments: number,
  partialDocuments: number,
  
  averageProcessingTime: number,
  minProcessingTime: number,
  maxProcessingTime: number,
  
  totalFieldsExtracted: number,
  totalEntitiesBuilt: number,
  totalRelationsExtracted: number,
  
  totalTokenUsage: number,
  totalApiCalls: number,
  
  stepPerformance: {
    [stepName: string]: {
      averageDuration: number,
      successRate: number
    }
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Document Format Support
*For any* document with a supported format (text, PDF, Word, Excel), the pipeline should accept and process it without format-related errors.
**Validates: Requirements 1.1**

### Property 2: Document Validation
*For any* document input, the pipeline should validate both format and size before processing.
**Validates: Requirements 1.2**

### Property 3: Invalid Format Error Messages
*For any* document with an unsupported format, the pipeline should return an error message that clearly indicates which formats are supported.
**Validates: Requirements 1.3**

### Property 4: Processing Context Creation
*For any* valid document, the pipeline should create a Processing_Context object that persists throughout the entire processing flow.
**Validates: Requirements 1.5**

### Property 5: Pipeline Step Execution Order
*For any* document that passes validation, the pipeline should execute steps in the correct order: parsing → extraction → schema matching → normalization → entity building → relation extraction → storage.
**Validates: Requirements 2.1, 3.1, 4.1, 5.1, 6.1, 7.1**

### Property 6: Configuration Propagation
*For any* pipeline configuration provided, each step should receive and respect its corresponding configuration parameters (LLM usage, confidence thresholds, etc.).
**Validates: Requirements 2.2, 3.2, 4.2, 5.2, 6.2, 8.1, 8.2, 8.3, 8.4**

### Property 7: Data Flow Through Context
*For any* document processed, the results from each step (extracted fields, matched schema, normalized fields, entities, relations) should be stored in the Processing_Context and available to subsequent steps.
**Validates: Requirements 2.3, 3.3, 4.3, 5.3, 6.4, 7.4**

### Property 8: Metrics Tracking Completeness
*For any* document processed, the Processing_Context should contain execution time and relevant metrics (counts, confidence scores) for every completed step.
**Validates: Requirements 2.5, 3.5, 4.5, 5.5, 6.6, 7.5, 9.1, 9.2, 12.1**

### Property 9: Total Processing Time Calculation
*For any* document processed, the total processing time recorded in the context should equal the sum of all individual step durations (within a small tolerance for overhead).
**Validates: Requirements 9.4**

### Property 10: Complete Context Return
*For any* document processed (successfully or with errors), the pipeline should return a Processing_Context containing results and status for all attempted steps.
**Validates: Requirements 9.3, 9.5**

### Property 11: Critical Error Termination
*For any* document where a critical step (parsing, schema matching) fails, the pipeline should terminate processing immediately and return an error status in the context.
**Validates: Requirements 10.2**

### Property 12: Non-Critical Error Continuation
*For any* document where a non-critical step (relation extraction) fails, the pipeline should log a warning, mark that step as failed in the context, and continue processing remaining steps.
**Validates: Requirements 10.3**

### Property 13: Error Logging Completeness
*For any* step that fails during processing, the Processing_Context should contain detailed error information including the step name, error message, and timestamp.
**Validates: Requirements 10.1, 10.5**

### Property 14: LLM Fallback Degradation
*For any* step that supports both LLM and algorithm-based processing, when LLM processing fails, the pipeline should automatically attempt the algorithm-based approach.
**Validates: Requirements 10.4**

### Property 15: Transaction Atomicity
*For any* document where storage is attempted, either all entities and relations should be stored successfully, or none should be stored (transaction rollback on failure).
**Validates: Requirements 7.2, 7.3**

### Property 16: Batch Processing Independence
*For any* batch of documents, the failure of one document's processing should not prevent other documents from being processed successfully.
**Validates: Requirements 11.2, 11.5**

### Property 17: Batch Result Completeness
*For any* batch of N documents processed, the pipeline should return exactly N Processing_Context objects, one for each input document.
**Validates: Requirements 11.4**

### Property 18: Concurrency Limit Enforcement
*For any* batch processing with concurrency limit C, at no point should more than C documents be processed simultaneously.
**Validates: Requirements 11.3**

### Property 19: Default Configuration Application
*For any* pipeline invocation without explicit configuration, all steps should use their documented default values for all parameters.
**Validates: Requirements 8.5**

### Property 20: Relation Builder Configuration
*For any* relation extraction configuration, only the enabled relation builders (builtin, cooccurrence, semantic) should be invoked, and results should be labeled by builder type.
**Validates: Requirements 6.3**

### Property 21: Token Usage Tracking
*For any* document processed with LLM enabled, the Processing_Context should contain accurate token usage counts and API call counts for all LLM-based steps.
**Validates: Requirements 12.2**

### Property 22: Throughput Metrics Calculation
*For any* completed pipeline execution, throughput metrics (documents per second, fields per second) should be calculated correctly based on total time and counts.
**Validates: Requirements 12.3**

### Property 23: Performance Statistics Accuracy
*For any* set of processed documents, the reported min, max, and average processing times should accurately reflect the actual processing times of all documents.
**Validates: Requirements 12.4**

### Property 24: Bottleneck Identification
*For any* document processed, the identified slowest step should be the step with the maximum execution duration among all completed steps.
**Validates: Requirements 12.5**

## Error Handling

### Error Categories

1. **Critical Errors** (stop processing):
   - Document parsing failure
   - Invalid document format
   - Document size exceeds limits
   - Schema matching complete failure (when fallback disabled)
   - Database connection failure

2. **Non-Critical Errors** (log and continue):
   - Partial field extraction failure
   - Partial field normalization failure
   - Partial entity building failure
   - Relation extraction failure for specific builders
   - Individual relation extraction failures

3. **Warnings** (log only):
   - Low confidence scores
   - Missing optional fields
   - Fallback to generic schema
   - Partial entity construction
   - Reduced relation extraction results

### Error Handling Strategy

```javascript
try {
  // Execute step
  const result = await executeStep(stepName, stepFunction, context, isCritical)
  
  if (result.status === 'failure' && isCritical) {
    // Critical failure: stop pipeline
    context.status = 'failed'
    context.errors.push({ step: stepName, error: result.error })
    return context
  }
  
  if (result.status === 'failure' && !isCritical) {
    // Non-critical failure: log and continue
    context.warnings.push({ step: stepName, error: result.error })
    context.steps[stepName].status = 'skipped'
  }
  
  if (result.status === 'partial') {
    // Partial success: log warnings and continue
    context.warnings.push(...result.warnings)
    context.steps[stepName].status = 'partial'
  }
  
} catch (error) {
  // Unexpected error: log and handle based on criticality
  logger.error(`Unexpected error in step ${stepName}:`, error)
  
  if (isCritical) {
    context.status = 'failed'
    context.errors.push({ step: stepName, error })
    return context
  } else {
    context.warnings.push({ step: stepName, error })
    context.steps[stepName].status = 'skipped'
  }
}
```

### Degradation Strategies

1. **LLM to Algorithm Fallback**:
   - Field extraction: LLM → NER + Rules
   - Schema matching: LLM scoring → Algorithm scoring
   - Field normalization: LLM mapping → Fuzzy matching + Synonym dict
   - Relation extraction: Semantic (LLM) → Cooccurrence only

2. **Partial Results Acceptance**:
   - Accept partial field extraction if at least 50% of expected fields found
   - Accept partial entity building if at least 50% of schema fields populated
   - Accept partial relation extraction if at least one builder succeeds

3. **Generic Schema Fallback**:
   - If no schema matches with confidence > threshold, use generic schema
   - Generic schema accepts any fields and creates generic entities

## Testing Strategy

### Dual Testing Approach

The testing strategy combines unit tests for specific scenarios and property-based tests for universal correctness:

**Unit Tests** focus on:
- Specific document format handling (PDF, Word, Excel)
- Error scenarios (invalid format, oversized document, parsing failure)
- Configuration edge cases (all LLM disabled, zero concurrency)
- Integration points between modules
- Database transaction rollback scenarios
- Specific degradation paths (LLM failure → algorithm fallback)

**Property-Based Tests** focus on:
- Universal properties that hold for all valid inputs
- Pipeline execution order and data flow
- Configuration propagation across all steps
- Metrics tracking completeness
- Batch processing independence
- Error handling consistency

### Property Test Configuration

- **Testing Library**: fast-check (for JavaScript/Node.js)
- **Iterations**: Minimum 100 iterations per property test
- **Tagging**: Each property test references its design document property
- **Tag Format**: `Feature: universal-document-pipeline, Property {number}: {property_text}`

### Test Data Generation

Property tests will use generators for:
- Random documents (various formats, sizes, content)
- Random configurations (different combinations of enabled/disabled features)
- Random field sets (varying counts, types, values)
- Random schemas (different entity types, field definitions)
- Random batch sizes (1 to 100 documents)
- Random failure scenarios (simulated errors at different steps)

### Integration Testing

Integration tests will verify:
- End-to-end flow from document to knowledge graph
- Interaction with all existing modules (field_extractor, schema_matcher, etc.)
- Database transactions and rollback behavior
- Concurrent batch processing with real documents
- Performance under load (throughput, latency)

### Performance Testing

Performance tests will measure:
- Processing time per document (by format and size)
- Throughput (documents per second)
- Memory usage during batch processing
- Token usage and API call efficiency
- Database query performance
- Bottleneck identification accuracy

### Example Property Test

```javascript
const fc = require('fast-check')
const { UniversalDocumentPipeline } = require('./universal_document_pipeline')

describe('Universal Document Pipeline Properties', () => {
  // Feature: universal-document-pipeline, Property 5: Pipeline Step Execution Order
  test('steps execute in correct order for all valid documents', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          content: fc.string({ minLength: 10, maxLength: 1000 }),
          type: fc.constantFrom('text', 'pdf', 'word', 'excel')
        }),
        async (document) => {
          const pipeline = new UniversalDocumentPipeline()
          const context = await pipeline.processDocument(document)
          
          // Verify steps executed in order
          const stepOrder = Object.keys(context.steps)
          const expectedOrder = [
            'parsing', 'extraction', 'schemaMatching', 
            'normalization', 'entityBuilding', 'relationExtraction', 'storage'
          ]
          
          // Filter to only completed/attempted steps
          const attemptedSteps = stepOrder.filter(step => 
            context.steps[step].status !== 'not_started'
          )
          
          // Verify order matches expected
          for (let i = 0; i < attemptedSteps.length; i++) {
            expect(attemptedSteps[i]).toBe(expectedOrder[i])
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})
```
