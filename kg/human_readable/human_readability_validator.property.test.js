/**
 * Property-based tests for HumanReadabilityValidator
 * 
 * Feature: human-readable-knowledge-graph
 * Property 13: Entity Name Quality Validation
 * Validates: Requirements 6.3
 */

const fc = require('fast-check');
const { HumanReadabilityValidator } = require('./human_readability_validator');

describe('HumanReadabilityValidator - Property Tests', () => {
  describe('Property 13: Entity Name Quality Validation', () => {
    test('should validate that all entity names meet quality requirements', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.oneof(
                // Valid names
                fc.constantFrom('Canon EOS R5', '北京故宫', 'Valid Name', 'Test Entity'),
                // Invalid names
                fc.constantFrom('unknown', '', 'A', 'This is a very very very very very very long name that exceeds limits')
              )
            }),
            { minLength: 1, maxLength: 5 }
          ),
          (entities) => {
            const validator = new HumanReadabilityValidator();
            const result = validator.validateEntityNames(entities);
            
            // Property: Validation should detect quality issues
            // 1. All entities should be processed
            expect(result.totalCount).toBe(entities.length);
            
            // 2. Score should be between 0 and 1
            expect(result.score).toBeGreaterThanOrEqual(0);
            expect(result.score).toBeLessThanOrEqual(1);
            
            // 3. Valid count should not exceed total count
            expect(result.validCount).toBeLessThanOrEqual(result.totalCount);
            
            // 4. Errors and warnings should be arrays
            expect(Array.isArray(result.errors)).toBe(true);
            expect(Array.isArray(result.warnings)).toBe(true);
            
            // 5. If there are errors, score should reflect that
            if (result.errors.length > 0) {
              expect(result.score).toBeLessThan(1);
            }
            
            // 6. Unknown names should be detected as errors
            const unknownEntities = entities.filter(e => 
              e.name && e.name.toLowerCase().includes('unknown')
            );
            if (unknownEntities.length > 0) {
              expect(result.errors.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should validate Chinese entity names (2-20 characters)', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constantFrom(
                '北京故宫',  // Valid
                '北',  // Too short
                '这是一个非常非常非常非常非常长的中文实体名称'  // Too long
              )
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (entities) => {
            const validator = new HumanReadabilityValidator();
            const result = validator.validateEntityNames(entities);
            
            // Property: Chinese names should be validated for length
            const tooShort = entities.filter(e => e.name === '北');
            const tooLong = entities.filter(e => e.name.length > 20 && /[\u4e00-\u9fa5]/.test(e.name));
            
            if (tooShort.length > 0) {
              expect(result.warnings.some(w => w.includes('too short'))).toBe(true);
            }
            
            if (tooLong.length > 0) {
              expect(result.warnings.some(w => w.includes('too long'))).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should detect excessive whitespace in entity names', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constantFrom(
                'Canon  EOS  R5',  // Excessive whitespace
                'Name   with   spaces',  // Excessive whitespace
                'Normal Name'  // Valid
              )
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (entities) => {
            const validator = new HumanReadabilityValidator();
            const result = validator.validateEntityNames(entities);
            
            // Property: Excessive whitespace should be detected
            const entitiesWithExcessiveWhitespace = entities.filter(e =>
              e.name && /\s{2,}/.test(e.name)
            );
            
            if (entitiesWithExcessiveWhitespace.length > 0) {
              expect(result.warnings.some(w => w.includes('excessive whitespace'))).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should detect special characters in entity names', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constantFrom(
                'Name@#$',  // Special characters
                'Entity!Name',  // Special characters
                'Canon-EOS-R5',  // Valid (hyphens allowed)
                'exposure_time_125'  // Valid (underscores allowed)
              )
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (entities) => {
            const validator = new HumanReadabilityValidator();
            const result = validator.validateEntityNames(entities);
            
            // Property: Special characters should be detected
            const entitiesWithSpecialChars = entities.filter(e =>
              e.name && /[^\w\s\u4e00-\u9fa5\-/]/.test(e.name)
            );
            
            if (entitiesWithSpecialChars.length > 0) {
              expect(result.warnings.some(w => w.includes('special characters'))).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should detect lack of descriptive content', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constantFrom(
                '123',  // Pure number
                '___',  // Pure symbols
                'Valid Name'  // Valid
              )
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (entities) => {
            const validator = new HumanReadabilityValidator();
            const result = validator.validateEntityNames(entities);
            
            // Property: Names without descriptive content should be detected
            const entitiesWithoutDescriptiveContent = entities.filter(e =>
              e.name && !/[a-zA-Z\u4e00-\u9fa5]/.test(e.name)
            );
            
            if (entitiesWithoutDescriptiveContent.length > 0) {
              expect(
                result.warnings.some(w => 
                  w.includes('lacks descriptive content') || 
                  w.includes('pure number')
                )
              ).toBe(true);
            }
          }
        ),
        { numRuns: 20 }
      );
    });

    test('should maintain consistency across multiple validations', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              name: fc.constantFrom('Canon EOS R5', '北京故宫', 'Valid Name')
            }),
            { minLength: 1, maxLength: 3 }
          ),
          (entities) => {
            const validator = new HumanReadabilityValidator();
            
            // Validate twice with same input
            const result1 = validator.validateEntityNames(entities);
            const result2 = validator.validateEntityNames(entities);
            
            // Property: Results should be consistent
            expect(result1.score).toBe(result2.score);
            expect(result1.validCount).toBe(result2.validCount);
            expect(result1.totalCount).toBe(result2.totalCount);
            expect(result1.errors.length).toBe(result2.errors.length);
            expect(result1.warnings.length).toBe(result2.warnings.length);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
});
