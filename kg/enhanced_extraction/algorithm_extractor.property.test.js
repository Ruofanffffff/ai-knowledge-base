/**
 * Property-based tests for AlgorithmExtractor
 * Feature: llm-enhanced-entity-extraction, Property 5: Algorithm Extraction Preservation
 * Validates: Requirements 4.1, 4.4
 */

const fc = require('fast-check');
const AlgorithmExtractor = require('./algorithm_extractor');
const { EXTRACTION_SOURCES } = require('./constants');

describe('AlgorithmExtractor - Property Tests', () => {
  let extractor;

  beforeEach(() => {
    extractor = new AlgorithmExtractor();
  });

  describe('Property 5: Algorithm Extraction Preservation', () => {
    test('all extracted entities should have algorithm source', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 500 }),
          async (text) => {
            const result = await extractor.extract(text);
            
            // Property: All entities must have 'algorithm' as source
            return result.entities.every(
              entity => entity.source === EXTRACTION_SOURCES.ALGORITHM
            );
          }
        ),
        { numRuns: 50 } // Run 50 iterations for faster testing
      );
    });

    test('all extracted entities should have confidence 1.0', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 500 }),
          async (text) => {
            const result = await extractor.extract(text);
            
            // Property: All algorithm extractions have 100% confidence
            return result.entities.every(
              entity => entity.confidence === 1.0
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    test('extraction result should always have required structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 1000 }),
          async (text) => {
            const result = await extractor.extract(text);
            
            // Property: Result must have required structure
            const hasRequiredStructure = 
              result.hasOwnProperty('entities') &&
              result.hasOwnProperty('relations') &&
              result.hasOwnProperty('metadata') &&
              Array.isArray(result.entities) &&
              Array.isArray(result.relations);
            
            return hasRequiredStructure;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('metadata should always include extraction time', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 500 }),
          async (text) => {
            const result = await extractor.extract(text);
            
            // Property: Metadata must include timing information
            return (
              result.metadata.hasOwnProperty('extractionTime') &&
              result.metadata.hasOwnProperty('algorithmTime') &&
              result.metadata.extractionTime >= 1 &&
              result.metadata.algorithmTime >= 1
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    test('entities should have valid structure', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 500 }),
          async (text) => {
            const result = await extractor.extract(text);
            
            // Property: All entities must have required fields
            return result.entities.every(entity => 
              entity.hasOwnProperty('id') &&
              entity.hasOwnProperty('type') &&
              entity.hasOwnProperty('name') &&
              entity.hasOwnProperty('properties') &&
              entity.hasOwnProperty('confidence') &&
              entity.hasOwnProperty('source') &&
              entity.hasOwnProperty('metadata')
            );
          }
        ),
        { numRuns: 50 }
      );
    });

    test('algorithm extractor should never extract relations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 500 }),
          async (text) => {
            const result = await extractor.extract(text);
            
            // Property: Algorithm extractor doesn't extract relations
            return result.relations.length === 0;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('parametersFound should match entities length', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 500 }),
          async (text) => {
            const result = await extractor.extract(text);
            
            // Property: parametersFound should equal number of entities
            return result.metadata.parametersFound === result.entities.length;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  describe('Idempotency', () => {
    test('extracting same text twice should produce same results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 10, maxLength: 200 }),
          async (text) => {
            const result1 = await extractor.extract(text);
            const result2 = await extractor.extract(text);
            
            // Property: Same input should produce same number of entities
            // (IDs will be different due to timestamps, but count should match)
            return result1.entities.length === result2.entities.length &&
                   result1.relations.length === result2.relations.length;
          }
        ),
        { numRuns: 30 }
      );
    });
  });
});
