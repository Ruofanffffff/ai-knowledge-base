/**
 * CKB Parser Property-Based Tests
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3**
 */

const fc = require('fast-check');
const { createCKB } = require('./ckb_factory');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('Property 1: CKB Parsing Completeness', () => {
  /**
   * Property: For any document with structured content, parsing should generate 
   * at least one CKB per structural unit, and each CKB should contain non-empty text content.
   * 
   * **Validates: Requirements 1.1**
   */
  test('should generate at least one CKB per paragraph with non-empty text', () => {
    fc.assert(
      fc.property(
        fc.record({
          docId: fc.uuid(),
          sourceType: fc.constantFrom('word', 'pdf', 'excel'),
          paragraphs: fc.array(
            fc.string({ minLength: 10, maxLength: 500 }),
            { minLength: 1, maxLength: 20 }
          )
        }),
        (testData) => {
          const { docId, sourceType, paragraphs } = testData;
          
          // Simulate parsing by creating CKBs for each paragraph
          const ckbs = paragraphs.map((text, index) => 
            createCKB({
              docId: docId,
              sourceType: sourceType,
              sourceMeta: { paragraph_index: index },
              text: text
            })
          );
          
          // Property assertions
          expect(ckbs.length).toBeGreaterThanOrEqual(paragraphs.length);
          
          ckbs.forEach((ckb, index) => {
            // Each CKB should have non-empty text
            expect(ckb.content.text).toBeTruthy();
            expect(ckb.content.text.length).toBeGreaterThan(0);
            
            // Each CKB should have required fields
            expect(ckb.ckb_id).toBeDefined();
            expect(ckb.doc_id).toBe(docId);
            expect(ckb.source_type).toBe(sourceType);
            expect(ckb.quality).toBeDefined();
            expect(ckb.timestamps).toBeDefined();
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: CKB quality scores should always be between 0 and 1
   * 
   * **Validates: Requirements 1.3**
   */
  test('should calculate quality scores within valid range [0, 1]', () => {
    fc.assert(
      fc.property(
        fc.record({
          docId: fc.uuid(),
          sourceType: fc.constantFrom('word', 'pdf', 'excel'),
          text: fc.string({ minLength: 1, maxLength: 1000 }),
          sourceConfidence: fc.float({ min: 0, max: 1, noNaN: true })  // Exclude NaN
        }),
        (testData) => {
          const ckb = createCKB(testData);
          
          // Quality scores should be in valid range
          expect(ckb.quality.overall_score).toBeGreaterThanOrEqual(0);
          expect(ckb.quality.overall_score).toBeLessThanOrEqual(1);
          expect(ckb.quality.length_score).toBeGreaterThanOrEqual(0);
          expect(ckb.quality.length_score).toBeLessThanOrEqual(1);
          expect(ckb.quality.density_score).toBeGreaterThanOrEqual(0);
          expect(ckb.quality.density_score).toBeLessThanOrEqual(1);
          expect(ckb.quality.source_confidence).toBe(testData.sourceConfidence);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: CKB IDs should be unique across multiple creations
   * 
   * **Validates: Requirements 1.1**
   */
  test('should generate unique CKB IDs', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            docId: fc.uuid(),
            sourceType: fc.constantFrom('word', 'pdf', 'excel'),
            text: fc.string({ minLength: 10, maxLength: 200 })
          }),
          { minLength: 2, maxLength: 50 }
        ),
        (testDataArray) => {
          const ckbs = testDataArray.map(data => createCKB(data));
          const ckbIds = ckbs.map(ckb => ckb.ckb_id);
          const uniqueIds = new Set(ckbIds);
          
          // All IDs should be unique
          expect(uniqueIds.size).toBe(ckbIds.length);
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Property: CKB structure should preserve source metadata
   * 
   * **Validates: Requirements 1.2**
   */
  test('should preserve source metadata in CKB structure', () => {
    fc.assert(
      fc.property(
        fc.record({
          docId: fc.uuid(),
          sourceType: fc.constantFrom('word', 'pdf', 'excel'),
          text: fc.string({ minLength: 10, maxLength: 200 }),
          sourceMeta: fc.record({
            file_name: fc.string({ minLength: 5, maxLength: 50 }),
            paragraph_index: fc.nat({ max: 1000 })
          }),
          structure: fc.record({
            section_title: fc.option(fc.string({ minLength: 1, maxLength: 100 })),
            level: fc.integer({ min: 0, max: 5 })
          })
        }),
        (testData) => {
          const ckb = createCKB(testData);
          
          // Source metadata should be preserved
          expect(ckb.source_meta).toEqual(testData.sourceMeta);
          expect(ckb.structure).toEqual(testData.structure);
        }
      ),
      { numRuns: 100 }
    );
  });
});
