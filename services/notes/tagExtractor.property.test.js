/**
 * Property-Based Tests for Tag Extractor
 * 
 * Feature: notes-feature, Property 1: 标签识别和存储
 * **Validates: Requirements 1.2, 1.3**
 * 
 * Property: For any text input containing "#" symbols followed by valid characters,
 * the system should correctly identify all tags and associate them with the note content.
 */

const fc = require('fast-check');
const {
  extractTags,
  parseTextWithTags,
  isValidTag,
  normalizeTags,
  highlightTags
} = require('./tagExtractor');

describe('Tag Extractor - Property-Based Tests', () => {
  describe('Property 1: Tag Identification and Storage', () => {
    /**
     * Property: All extracted tags should be valid tags
     */
    it('should extract only valid tags from any text', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (text) => {
            const tags = extractTags(text);
            tags.forEach(tag => {
              expect(isValidTag(tag)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Extracted tags should not contain duplicates
     */
    it('should deduplicate tags in any text', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (text) => {
            const tags = extractTags(text);
            const uniqueTags = new Set(tags);
            expect(tags.length).toBe(uniqueTags.size);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: parseTextWithTags should preserve original content
     */
    it('should preserve original content when parsing text with tags', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (text) => {
            const result = parseTextWithTags(text);
            expect(result.content).toBe(text || '');
            expect(Array.isArray(result.tags)).toBe(true);
            result.tags.forEach(tag => {
              expect(isValidTag(tag)).toBe(true);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: normalizeTags should produce valid tags
     */
    it('should normalize any array to valid tags', () => {
      fc.assert(
        fc.property(
          fc.array(fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined), fc.integer())),
          (input) => {
            const normalized = normalizeTags(input);
            expect(Array.isArray(normalized)).toBe(true);
            normalized.forEach(tag => {
              expect(isValidTag(tag)).toBe(true);
            });
            const uniqueTags = new Set(normalized);
            expect(normalized.length).toBe(uniqueTags.size);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: highlightTags should preserve all text content
     */
    it('should preserve all text content when highlighting tags', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (text) => {
            const segments = highlightTags(text);
            const reconstructed = segments.map(s => s.content).join('');
            expect(reconstructed).toBe(text || '');
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Tags should not contain the # symbol
     */
    it('should extract tags without the # symbol', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (text) => {
            const tags = extractTags(text);
            tags.forEach(tag => {
              expect(tag).not.toContain('#');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Empty or null input should return empty arrays
     */
    it('should handle empty or null input gracefully', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant(''), fc.constant(null), fc.constant(undefined)),
          (input) => {
            expect(extractTags(input)).toEqual([]);
            expect(parseTextWithTags(input).tags).toEqual([]);
            expect(highlightTags(input)).toEqual([]);
            expect(normalizeTags(input)).toEqual([]);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Tag validation should reject tags with spaces
     */
    it('should reject tags with spaces', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter(s => s.includes(' ')),
          (tagWithSpace) => {
            expect(isValidTag(tagWithSpace)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: Tag validation should enforce length limits
     */
    it('should reject tags that are too long', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 51, maxLength: 100 }),
          (longTag) => {
            expect(isValidTag(longTag)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Property: normalizeTags should be idempotent
     */
    it('should produce same result when normalizing twice', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string()),
          (tags) => {
            const normalized1 = normalizeTags(tags);
            const normalized2 = normalizeTags(normalized1);
            expect(normalized2).toEqual(normalized1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
