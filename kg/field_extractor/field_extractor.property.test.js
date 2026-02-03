/**
 * Field Extractor Property-Based Tests
 * 
 * **Validates: Requirements 2.1, 2.2, 2.4, 2.5, 2.9, 2.10**
 */

const fc = require('fast-check');
const fieldExtractor = require('./field_extractor');
const ruleExtractor = require('./rule_extractor');

describe('Property 4: Field Extraction Determinism', () => {
  /**
   * Property: For any CKB with the same content, extracting fields multiple times 
   * should produce the same field list (when using rule-based extraction).
   * 
   * **Validates: Requirements 2.1, 2.2, 2.9**
   */
  test('should produce deterministic results for same input', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          ckbId: fc.uuid(),
          text: fc.string({ minLength: 20, maxLength: 200 })
        }),
        async (testData) => {
          const ckb = {
            ckb_id: testData.ckbId,
            content: { text: testData.text }
          };
          
          // Extract fields multiple times
          const fields1 = await fieldExtractor.extractFields(ckb, { useLLM: false });
          const fields2 = await fieldExtractor.extractFields(ckb, { useLLM: false });
          const fields3 = await fieldExtractor.extractFields(ckb, { useLLM: false });
          
          // Results should be identical
          expect(fields1.length).toBe(fields2.length);
          expect(fields2.length).toBe(fields3.length);
          
          // Field values should match
          fields1.forEach((field, index) => {
            expect(field.name).toBe(fields2[index].name);
            expect(field.value).toBe(fields2[index].value);
            expect(field.type).toBe(fields2[index].type);
          });
        }
      ),
      { numRuns: 50 }
    );
  });
  
  /**
   * Property: Rule-based extraction should be deterministic
   */
  test('rule extraction should always produce same results', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 500 }),
        (text) => {
          const fields1 = ruleExtractor.extractFields(text);
          const fields2 = ruleExtractor.extractFields(text);
          
          expect(fields1.length).toBe(fields2.length);
          
          // Sort both arrays for comparison
          const sorted1 = [...fields1].sort((a, b) => 
            `${a.type}:${a.value}`.localeCompare(`${b.type}:${b.value}`)
          );
          const sorted2 = [...fields2].sort((a, b) => 
            `${a.type}:${a.value}`.localeCompare(`${b.type}:${b.value}`)
          );
          
          sorted1.forEach((field, index) => {
            expect(field.value).toBe(sorted2[index].value);
            expect(field.type).toBe(sorted2[index].type);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 5: Field Type Validity', () => {
  /**
   * Property: For any extracted field, the type should be one of the valid types,
   * and the confidence should be between 0 and 1.
   * 
   * **Validates: Requirements 2.4, 2.5**
   */
  test('all extracted fields should have valid types and confidence', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          ckbId: fc.uuid(),
          text: fc.string({ minLength: 20, maxLength: 500 })
        }),
        async (testData) => {
          const ckb = {
            ckb_id: testData.ckbId,
            content: { text: testData.text }
          };
          
          const fields = await fieldExtractor.extractFields(ckb, { useLLM: false });
          
          const validTypes = ['location', 'time', 'number', 'unit', 'indicator', 'entity'];
          
          fields.forEach(field => {
            // Type must be valid
            expect(validTypes).toContain(field.type);
            
            // Confidence must be between 0 and 1
            expect(field.confidence).toBeGreaterThanOrEqual(0);
            expect(field.confidence).toBeLessThanOrEqual(1);
            
            // Field must have required properties
            expect(field.name).toBeDefined();
            expect(field.value).toBeDefined();
            expect(typeof field.name).toBe('string');
            expect(typeof field.value).toBe('string');
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Field confidence should be a valid number
   */
  test('field confidence should always be a valid number', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10, maxLength: 200 }),
        (text) => {
          const fields = ruleExtractor.extractFields(text);
          
          fields.forEach(field => {
            expect(typeof field.confidence).toBe('number');
            expect(isNaN(field.confidence)).toBe(false);
            expect(isFinite(field.confidence)).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 6: Time Field Standardization', () => {
  /**
   * Property: For any extracted time field, the value should be in ISO 8601 format.
   * 
   * **Validates: Requirements 2.10**
   */
  test('all time fields should be in ISO 8601 format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          ckbId: fc.uuid(),
          year: fc.integer({ min: 2000, max: 2030 }),
          month: fc.integer({ min: 1, max: 12 }),
          day: fc.integer({ min: 1, max: 28 })
        }),
        async (testData) => {
          const { year, month, day } = testData;
          const text = `${year}年${month}月${day}日发生的事件`;
          
          const ckb = {
            ckb_id: testData.ckbId,
            content: { text }
          };
          
          const fields = await fieldExtractor.extractFields(ckb, { useLLM: false });
          const timeFields = fields.filter(f => f.type === 'time');
          
          timeFields.forEach(field => {
            // Should match ISO 8601 date format (YYYY-MM-DD or YYYY-MM)
            const iso8601Pattern = /^\d{4}-\d{2}(-\d{2})?(T\d{2}:\d{2}:\d{2}Z)?$/;
            expect(field.value).toMatch(iso8601Pattern);
            
            // Should be a valid date
            if (field.value.includes('-')) {
              const date = new Date(field.value);
              expect(isNaN(date.getTime())).toBe(false);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Time field extraction should preserve date information
   */
  test('time fields should preserve original date information', () => {
    fc.assert(
      fc.property(
        fc.record({
          year: fc.integer({ min: 2000, max: 2030 }),
          month: fc.integer({ min: 1, max: 12 }),
          day: fc.integer({ min: 1, max: 28 })
        }),
        (testData) => {
          const { year, month, day } = testData;
          const text = `${year}年${month}月${day}日`;
          
          const fields = ruleExtractor.extractTimeFields(text);
          
          if (fields.length > 0) {
            const timeField = fields[0];
            const expectedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            expect(timeField.value).toBe(expectedDate);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
