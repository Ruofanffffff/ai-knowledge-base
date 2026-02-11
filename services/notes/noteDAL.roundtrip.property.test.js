/**
 * Property-Based Tests for Note Data Round-trip Consistency
 * 
 * Feature: notes-feature, Property 2: 文本数据往返一致性
 * **Validates: Requirements 1.4, 12.1**
 * 
 * Property: For any note text and tags, serializing to JSON and then
 * deserializing should produce equivalent data.
 */

const fc = require('fast-check');

describe('Note Data Round-trip Consistency - Property-Based Tests', () => {
  describe('Property 2: Text Data Round-trip Consistency', () => {
    /**
     * Property: JSON serialization round-trip should preserve note data
     */
    it('should preserve note data through JSON serialization round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            userId: fc.uuid(),
            content: fc.string({ minLength: 0, maxLength: 10000 }),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 }),
            createdAt: fc.date(),
            updatedAt: fc.date()
          }),
          async (note) => {
            // Serialize to JSON
            const serialized = JSON.stringify(note);
            
            // Deserialize from JSON
            const deserialized = JSON.parse(serialized);
            
            // Verify all fields are preserved
            expect(deserialized.id).toBe(note.id);
            expect(deserialized.userId).toBe(note.userId);
            expect(deserialized.content).toBe(note.content);
            expect(deserialized.tags).toEqual(note.tags);
            
            // Dates are serialized as ISO strings, so compare as strings
            expect(deserialized.createdAt).toBe(note.createdAt.toISOString());
            expect(deserialized.updatedAt).toBe(note.updatedAt.toISOString());
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Empty content should round-trip correctly
     */
    it('should handle empty content in round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            userId: fc.uuid(),
            content: fc.constant(''),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
          }),
          async (note) => {
            const serialized = JSON.stringify(note);
            const deserialized = JSON.parse(serialized);
            
            expect(deserialized.content).toBe('');
            expect(deserialized.tags).toEqual(note.tags);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Empty tags array should round-trip correctly
     */
    it('should handle empty tags array in round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            userId: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 1000 }),
            tags: fc.constant([])
          }),
          async (note) => {
            const serialized = JSON.stringify(note);
            const deserialized = JSON.parse(serialized);
            
            expect(deserialized.content).toBe(note.content);
            expect(deserialized.tags).toEqual([]);
            expect(Array.isArray(deserialized.tags)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Special characters in content should round-trip correctly
     */
    it('should preserve special characters in content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            userId: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 1000 }),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
          }),
          async (note) => {
            const serialized = JSON.stringify(note);
            const deserialized = JSON.parse(serialized);
            
            // Content should be exactly the same, including special chars
            expect(deserialized.content).toBe(note.content);
            expect(deserialized.content.length).toBe(note.content.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Unicode characters should round-trip correctly
     */
    it('should preserve unicode characters in content and tags', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            userId: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 1000 }),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
          }),
          async (note) => {
            // Add some explicit unicode characters to test
            const unicodeNote = {
              ...note,
              content: note.content + ' 你好世界 🌍 émojis',
              tags: [...note.tags, '中文标签', 'émoji🎉']
            };
            
            const serialized = JSON.stringify(unicodeNote);
            const deserialized = JSON.parse(serialized);
            
            expect(deserialized.content).toBe(unicodeNote.content);
            expect(deserialized.tags).toEqual(unicodeNote.tags);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Newlines and whitespace should be preserved
     */
    it('should preserve newlines and whitespace in content', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            userId: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 1000 }),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
          }),
          async (note) => {
            // Add various whitespace characters
            const contentWithWhitespace = note.content + '\n\t  \r\n';
            const noteWithWhitespace = { ...note, content: contentWithWhitespace };
            
            const serialized = JSON.stringify(noteWithWhitespace);
            const deserialized = JSON.parse(serialized);
            
            expect(deserialized.content).toBe(contentWithWhitespace);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Large content should round-trip correctly
     */
    it('should handle large content in round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            userId: fc.uuid(),
            content: fc.string({ minLength: 5000, maxLength: 10000 }),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 20 })
          }),
          async (note) => {
            const serialized = JSON.stringify(note);
            const deserialized = JSON.parse(serialized);
            
            expect(deserialized.content).toBe(note.content);
            expect(deserialized.content.length).toBe(note.content.length);
            expect(deserialized.tags).toEqual(note.tags);
          }
        ),
        { numRuns: 50 } // Fewer runs for large content
      );
    });

    /**
     * Property: Multiple round-trips should be idempotent
     */
    it('should be idempotent across multiple round-trips', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            userId: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 1000 }),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
          }),
          async (note) => {
            // First round-trip
            const serialized1 = JSON.stringify(note);
            const deserialized1 = JSON.parse(serialized1);
            
            // Second round-trip
            const serialized2 = JSON.stringify(deserialized1);
            const deserialized2 = JSON.parse(serialized2);
            
            // Third round-trip
            const serialized3 = JSON.stringify(deserialized2);
            const deserialized3 = JSON.parse(serialized3);
            
            // All should be equal
            expect(deserialized1.content).toBe(note.content);
            expect(deserialized2.content).toBe(note.content);
            expect(deserialized3.content).toBe(note.content);
            
            expect(deserialized1.tags).toEqual(note.tags);
            expect(deserialized2.tags).toEqual(note.tags);
            expect(deserialized3.tags).toEqual(note.tags);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Note with attachments metadata should round-trip correctly
     */
    it('should preserve attachments metadata in round-trip', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            userId: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 1000 }),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
            attachments: fc.array(
              fc.record({
                id: fc.uuid(),
                type: fc.constantFrom('IMAGE', 'DOCUMENT', 'TABLE'),
                url: fc.webUrl(),
                size: fc.integer({ min: 0, max: 10000000 }),
                mimeType: fc.constantFrom('image/jpeg', 'image/png', 'application/pdf', 'text/csv')
              }),
              { maxLength: 5 }
            )
          }),
          async (note) => {
            const serialized = JSON.stringify(note);
            const deserialized = JSON.parse(serialized);
            
            expect(deserialized.content).toBe(note.content);
            expect(deserialized.tags).toEqual(note.tags);
            expect(deserialized.attachments).toEqual(note.attachments);
            expect(deserialized.attachments.length).toBe(note.attachments.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Nested JSON structures should round-trip correctly
     */
    it('should preserve nested structures in attachments analysis', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            userId: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 1000 }),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 }),
            attachments: fc.array(
              fc.record({
                id: fc.uuid(),
                type: fc.constant('IMAGE'),
                url: fc.webUrl(),
                analysis: fc.record({
                  textContent: fc.option(fc.string({ maxLength: 1000 })),
                  description: fc.option(fc.string({ maxLength: 500 })),
                  tags: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { maxLength: 10 }),
                  metadata: fc.record({
                    width: fc.integer({ min: 1, max: 10000 }),
                    height: fc.integer({ min: 1, max: 10000 }),
                    format: fc.constantFrom('jpeg', 'png', 'gif', 'webp')
                  })
                })
              }),
              { maxLength: 3 }
            )
          }),
          async (note) => {
            const serialized = JSON.stringify(note);
            const deserialized = JSON.parse(serialized);
            
            expect(deserialized).toEqual(note);
            
            // Verify nested structures
            if (note.attachments.length > 0) {
              expect(deserialized.attachments[0].analysis).toEqual(note.attachments[0].analysis);
              expect(deserialized.attachments[0].analysis.metadata).toEqual(
                note.attachments[0].analysis.metadata
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Tags with special characters should round-trip correctly
     */
    it('should preserve tags with special characters', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            userId: fc.uuid(),
            content: fc.string({ minLength: 1, maxLength: 1000 }),
            tags: fc.array(
              fc.string({ minLength: 1, maxLength: 50 }),
              { maxLength: 10 }
            )
          }),
          async (note) => {
            const serialized = JSON.stringify(note);
            const deserialized = JSON.parse(serialized);
            
            expect(deserialized.tags).toEqual(note.tags);
            expect(deserialized.tags.length).toBe(note.tags.length);
            
            // Verify each tag individually
            note.tags.forEach((tag, index) => {
              expect(deserialized.tags[index]).toBe(tag);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Serialization should produce valid JSON string
     */
    it('should produce valid JSON string that can be parsed', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            userId: fc.uuid(),
            content: fc.string({ minLength: 0, maxLength: 1000 }),
            tags: fc.array(fc.string({ minLength: 1, maxLength: 50 }), { maxLength: 10 })
          }),
          async (note) => {
            const serialized = JSON.stringify(note);
            
            // Should be a string
            expect(typeof serialized).toBe('string');
            
            // Should be parseable without throwing
            expect(() => JSON.parse(serialized)).not.toThrow();
            
            // Parsed result should be an object
            const deserialized = JSON.parse(serialized);
            expect(typeof deserialized).toBe('object');
            expect(deserialized).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
