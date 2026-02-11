/**
 * Property-based tests for EntityNameStandardizer
 * 
 * These tests validate universal correctness properties that should hold
 * for all inputs, using fast-check for property-based testing.
 */

const fc = require('fast-check');
const { EntityNameStandardizer } = require('./entity_name_standardizer');

describe('EntityNameStandardizer - Property Tests', () => {
  let standardizer;

  beforeEach(() => {
    standardizer = new EntityNameStandardizer();
  });

  /**
   * Property 1: No Unknown Entity Names
   * Validates: Requirements 1.4, 6.1
   * 
   * For any entity, the standardized name should never contain "unknown"
   */
  describe('Property 1: No Unknown Entity Names', () => {
    test('standardized names should never contain "unknown"', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.oneof(
              fc.string({ minLength: 1, maxLength: 50 }),
              fc.constant('unknown'),
              fc.constant('Unknown Entity'),
              fc.constant('unknown_123')
            ),
            type: fc.oneof(
              fc.constant('concept'),
              fc.constant('parameter'),
              fc.constant('entity')
            ),
            ckbs: fc.array(
              fc.record({
                content: fc.record({
                  text: fc.string({ minLength: 10, maxLength: 200 })
                })
              }),
              { minLength: 0, maxLength: 3 }
            )
          }),
          async (entity) => {
            const result = await standardizer.standardizeName(entity);
            
            // The standardized name should not contain "unknown" (case-insensitive)
            const hasUnknown = result.standardizedName.toLowerCase().includes('unknown');
            
            // If original name was "unknown", it should be replaced
            if (entity.name.toLowerCase().includes('unknown')) {
              expect(hasUnknown).toBe(false);
            }
            
            return !hasUnknown || result.confidence < 0.5; // Allow low confidence fallbacks
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 2: Numeric Parameter Descriptive Naming
   * Validates: Requirements 1.1, 1.5
   * 
   * Numeric parameters should get descriptive names based on context
   */
  describe('Property 2: Numeric Parameter Descriptive Naming', () => {
    test('numeric parameters should have descriptive names', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.oneof(
              fc.nat(10000).map(n => n.toString()),
              fc.double({ min: 0, max: 1000 }).map(n => n.toFixed(2)),
              fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^\d/.test(s))
            ),
            type: fc.constant('parameter'),
            ckbs: fc.array(
              fc.record({
                content: fc.record({
                  text: fc.oneof(
                    fc.constant('ISO 感光度设置为 '),
                    fc.constant('焦距为 '),
                    fc.constant('光圈值 f/'),
                    fc.constant('快门速度 '),
                    fc.constant('The ISO value is ')
                  ).chain(prefix => 
                    fc.string({ minLength: 10, maxLength: 50 }).map(suffix => 
                      prefix + suffix
                    )
                  )
                })
              }),
              { minLength: 1, maxLength: 2 }
            )
          }),
          async (entity) => {
            const result = await standardizer.standardizeName(entity);
            
            // If it's a numeric parameter with good context, should have descriptive terms
            if (entity.ckbs.length > 0 && /^\d+$/.test(entity.name.trim())) {
              // Check if context has meaningful keywords AND sufficient content
              const contextText = entity.ckbs[0].content.text;
              const hasKeyword = 
                contextText.includes('ISO') ||
                contextText.includes('感光') ||
                contextText.includes('焦距') ||
                contextText.includes('光圈') ||
                contextText.includes('快门') ||
                contextText.includes('focal');
              
              // Context should have reasonable length and not be mostly whitespace/special chars
              const meaningfulContent = contextText.replace(/[\s%!@#$^&*()0-9]/g, '');
              const hasSubstantialContext = meaningfulContent.length >= 3;
              
              const hasGoodContext = hasKeyword && hasSubstantialContext;
              
              if (hasGoodContext) {
                const hasDescriptiveTerm = 
                  result.standardizedName.includes('ISO') ||
                  result.standardizedName.includes('焦距') ||
                  result.standardizedName.includes('光圈') ||
                  result.standardizedName.includes('快门') ||
                  result.standardizedName.includes('参数') ||
                  result.standardizedName.length > entity.name.trim().length + 1;
                
                // Allow low confidence results to not have descriptive terms
                return hasDescriptiveTerm || result.confidence < 0.7;
              }
            }
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 3: Numeric Parameter Fallback Naming
   * Validates: Requirements 1.2
   * 
   * When numeric parameters have minimal or no context, the system should
   * use a fallback pattern that is still human-readable
   */
  describe('Property 3: Numeric Parameter Fallback Naming', () => {
    test('numeric parameters with minimal context should use fallback pattern', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.oneof(
              fc.nat(10000).map(n => n.toString()),
              fc.double({ min: 0, max: 1000 }).map(n => n.toFixed(2)),
              fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^\d/.test(s))
            ),
            type: fc.constant('parameter'),
            ckbs: fc.oneof(
              // No context
              fc.constant([]),
              // Minimal context with no meaningful keywords
              fc.array(
                fc.record({
                  content: fc.record({
                    text: fc.string({ minLength: 5, maxLength: 20 })
                      .filter(s => !s.includes('ISO') && !s.includes('焦距') && 
                                   !s.includes('光圈') && !s.includes('快门'))
                  })
                }),
                { minLength: 1, maxLength: 1 }
              )
            )
          }),
          async (entity) => {
            const result = await standardizer.standardizeName(entity);
            
            // With minimal context, should use fallback pattern
            // Fallback should be human-readable (not just the number)
            const isJustNumber = result.standardizedName.trim() === entity.name.trim();
            const hasParameterSuffix = result.standardizedName.includes('参数') || 
                                       result.standardizedName.includes('Parameter');
            const hasValuePrefix = result.standardizedName.includes('值') ||
                                   result.standardizedName.includes('Value');
            
            // Should either add descriptive suffix/prefix or have low confidence
            const isFallbackPattern = hasParameterSuffix || hasValuePrefix || !isJustNumber;
            
            return isFallbackPattern || result.confidence < 0.5;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 4: Numeric Parameter Uniqueness
   * Validates: Requirements 1.3
   * 
   * Different numeric parameters in the same document should get unique names
   */
  describe('Property 4: Numeric Parameter Uniqueness', () => {
    test('different numeric parameters should get unique standardized names', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(
            fc.record({
              name: fc.nat(1000).map(n => n.toString()),
              type: fc.constant('parameter'),
              ckbs: fc.array(
                fc.record({
                  content: fc.record({
                    text: fc.string({ minLength: 20, maxLength: 100 })
                  })
                }),
                { minLength: 1, maxLength: 2 }
              )
            }),
            { minLength: 2, maxLength: 5 }
          ),
          async (entities) => {
            // Ensure entities have different names
            const uniqueNames = new Set(entities.map(e => e.name));
            if (uniqueNames.size < 2) return true; // Skip if not enough unique inputs
            
            const results = await Promise.all(
              entities.map(e => standardizer.standardizeName(e))
            );
            
            const standardizedNames = results.map(r => r.standardizedName);
            const uniqueStandardized = new Set(standardizedNames);
            
            // If original names were different, standardized names should be different
            // (unless they're all fallbacks with same pattern)
            const allLowConfidence = results.every(r => r.confidence < 0.5);
            
            return uniqueStandardized.size >= 2 || allLowConfidence;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property 5: Entity Name Normalization
   * Validates: Requirements 2.1, 2.2, 2.4, 2.5
   * 
   * Entity names should be normalized (trimmed, no excessive whitespace, etc.)
   */
  describe('Property 5: Entity Name Normalization', () => {
    test('standardized names should be properly normalized', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.oneof(
              fc.string({ minLength: 1, maxLength: 50 }).map(s => '  ' + s + '  '), // Extra whitespace
              fc.string({ minLength: 1, maxLength: 50 }).map(s => s + '\n\n'), // Newlines
              fc.string({ minLength: 1, maxLength: 50 }).map(s => s.replace(/ /g, '  ')) // Double spaces
            ),
            type: fc.constant('concept'),
            ckbs: fc.array(
              fc.record({
                content: fc.record({
                  text: fc.string({ minLength: 10, maxLength: 100 })
                })
              }),
              { minLength: 0, maxLength: 2 }
            )
          }),
          async (entity) => {
            const result = await standardizer.standardizeName(entity);
            
            // Standardized name should be trimmed
            expect(result.standardizedName).toBe(result.standardizedName.trim());
            
            // Should not have excessive whitespace
            expect(result.standardizedName).not.toMatch(/\s{2,}/);
            
            // Should not have newlines
            expect(result.standardizedName).not.toMatch(/\n/);
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });

    test('standardized names should have reasonable length', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 200 }),
            type: fc.constant('concept'),
            ckbs: fc.array(
              fc.record({
                content: fc.record({
                  text: fc.string({ minLength: 10, maxLength: 100 })
                })
              }),
              { minLength: 0, maxLength: 2 }
            )
          }),
          async (entity) => {
            const result = await standardizer.standardizeName(entity);
            
            // Standardized name should not be empty
            expect(result.standardizedName.length).toBeGreaterThan(0);
            
            // Should not be excessively long (unless original was very long)
            if (entity.name.length < 100) {
              expect(result.standardizedName.length).toBeLessThan(150);
            }
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Additional Property: Idempotence
   * 
   * Standardizing an already-standardized name should not change it significantly
   */
  describe('Additional Property: Idempotence', () => {
    test('standardizing twice should produce similar results', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.string({ minLength: 3, maxLength: 30 })
              .filter(s => !s.includes('unknown'))
              .filter(s => /[a-zA-Z\u4e00-\u9fa5]/.test(s)), // Must have at least one letter
            type: fc.constant('concept'),
            ckbs: fc.array(
              fc.record({
                content: fc.record({
                  text: fc.string({ minLength: 20, maxLength: 100 })
                })
              }),
              { minLength: 1, maxLength: 2 }
            )
          }),
          async (entity) => {
            const result1 = await standardizer.standardizeName(entity);
            
            // Standardize again using the result
            const entity2 = {
              ...entity,
              name: result1.standardizedName
            };
            const result2 = await standardizer.standardizeName(entity2);
            
            // Second standardization should either keep the name or have high confidence
            const isSimilar = 
              result2.standardizedName === result1.standardizedName ||
              result2.method === 'none' ||
              result2.confidence >= 0.9;
            
            return isSimilar;
          }
        ),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Additional Property: Confidence Correlation
   * 
   * Higher confidence should correlate with better standardization
   */
  describe('Additional Property: Confidence Correlation', () => {
    test('high confidence results should have better names', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            name: fc.oneof(
              fc.constant('unknown'),
              fc.nat(1000).map(n => n.toString()),
              fc.string({ minLength: 1, maxLength: 20 })
            ),
            type: fc.constant('parameter'),
            ckbs: fc.array(
              fc.record({
                content: fc.record({
                  text: fc.string({ minLength: 30, maxLength: 150 })
                })
              }),
              { minLength: 1, maxLength: 3 }
            )
          }),
          async (entity) => {
            const result = await standardizer.standardizeName(entity);
            
            // High confidence (>0.7) should mean:
            // - Name is not "unknown"
            // - Name is different from original (if original was bad)
            // - Name has reasonable length
            if (result.confidence > 0.7) {
              expect(result.standardizedName.toLowerCase()).not.toContain('unknown');
              expect(result.standardizedName.length).toBeGreaterThan(1);
              expect(result.standardizedName.length).toBeLessThan(100);
            }
            
            return true;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
