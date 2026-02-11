/**
 * Property-Based Tests for Search Service
 * 
 * Tests universal properties that should hold for all search operations.
 * Uses fast-check for property-based testing with 100+ iterations.
 * 
 * Note: These tests focus on pure functions (generateHighlights, calculateRelevanceScore)
 * that don't require database access. Full end-to-end search tests with database
 * integration should be run separately with proper database setup.
 */

const fc = require('fast-check');
const { generateHighlights, calculateRelevanceScore } = require('./searchService');

describe('Search Service - Property-Based Tests', () => {
  /**
   * Feature: notes-feature, Property 15: 搜索结果高亮
   * 
   * For any search result, the returned data should include highlight
   * information indicating where the matching keywords are located.
   * 
   * Validates: Requirements 9.5
   */
  describe('Property 15: Search Result Highlighting', () => {
    it('should highlight exact match positions', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 10 }),
          (keyword) => {
            const content = `Start ${keyword} middle ${keyword} end`;
            
            const note = {
              content,
              tags: []
            };

            // Generate highlights
            const highlights = generateHighlights(note, keyword.toLowerCase());

            // Should have at least one highlight
            if (highlights.length === 0) return false;

            // Content highlight should contain the keyword wrapped in <mark>
            const contentHighlight = highlights.find(h => h.field === 'content');
            if (!contentHighlight) return false;

            const markedKeyword = `<mark>${keyword}</mark>`;
            const hasMarkedKeyword = contentHighlight.snippet.toLowerCase().includes(
              markedKeyword.toLowerCase()
            );

            return hasMarkedKeyword;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should provide snippet context around matches', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 10 }),
          fc.string({ minLength: 60, maxLength: 100 }),
          fc.string({ minLength: 60, maxLength: 100 }),
          (keyword, before, after) => {
            const content = `${before} ${keyword} ${after}`;
            
            const note = {
              content,
              tags: []
            };

            // Generate highlights
            const highlights = generateHighlights(note, keyword.toLowerCase());

            if (highlights.length === 0) return true; // Skip if no highlights

            const contentHighlight = highlights.find(h => h.field === 'content');
            if (!contentHighlight) return true;

            // Snippet should include context before and after the keyword
            const snippet = contentHighlight.snippet;
            
            // Should have some text before the <mark> tag
            const beforeMark = snippet.split('<mark>')[0];
            const hasContextBefore = beforeMark.length > 0;

            // Should have some text after the </mark> tag
            const afterMark = snippet.split('</mark>')[1];
            const hasContextAfter = afterMark && afterMark.length > 0;

            return hasContextBefore && hasContextAfter;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always use <mark> tags for highlights', () => {
      fc.assert(
        fc.property(
          fc.record({
            content: fc.string({ minLength: 20, maxLength: 200 }),
            tags: fc.array(fc.string({ minLength: 3, maxLength: 15 }), { maxLength: 5 })
          }),
          fc.string({ minLength: 3, maxLength: 10 }),
          (noteData, keyword) => {
            const note = {
              content: noteData.content,
              tags: noteData.tags
            };

            const highlights = generateHighlights(note, keyword.toLowerCase());

            // All highlights should use <mark> tags
            return highlights.every(h => {
              if (!h.snippet.includes(keyword.toLowerCase())) return true;
              return h.snippet.includes('<mark>') && h.snippet.includes('</mark>');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should identify correct field for highlights', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 15 }),
          fc.string({ minLength: 20, maxLength: 100 }),
          fc.array(fc.string({ minLength: 3, maxLength: 10 }), { minLength: 1, maxLength: 5 }),
          (keyword, content, tags) => {
            const note = {
              content: `${content} ${keyword}`,
              tags: [...tags, keyword]
            };

            const highlights = generateHighlights(note, keyword.toLowerCase());

            // Should have highlights for both content and tags
            const hasContentHighlight = highlights.some(h => h.field === 'content');
            const hasTagHighlight = highlights.some(h => h.field === 'tags');

            return hasContentHighlight && hasTagHighlight;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle case-insensitive matching', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 15 }),
          (keyword) => {
            const note = {
              content: `Test with ${keyword.toUpperCase()} in content`,
              tags: [keyword.toLowerCase()]
            };

            const highlights = generateHighlights(note, keyword.toLowerCase());

            // Should find matches regardless of case
            return highlights.length > 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Relevance scoring consistency
   */
  describe('Property: Relevance Scoring', () => {
    it('should assign non-negative scores', () => {
      fc.assert(
        fc.property(
          fc.record({
            content: fc.string({ minLength: 10, maxLength: 100 }),
            tags: fc.array(fc.string({ minLength: 3, maxLength: 10 }), { maxLength: 5 })
          }),
          fc.string({ minLength: 3, maxLength: 10 }),
          (noteData, query) => {
            const note = {
              content: noteData.content,
              tags: noteData.tags
            };

            const highlights = generateHighlights(note, query.toLowerCase());
            const score = calculateRelevanceScore(note, query.toLowerCase(), highlights);

            return score >= 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should give higher scores for exact tag matches', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 15 }),
          fc.string({ minLength: 20, maxLength: 100 }),
          (keyword, content) => {
            // Note with exact tag match
            const note1 = {
              content,
              tags: [keyword]
            };

            // Note with keyword only in content
            const note2 = {
              content: `${content} ${keyword}`,
              tags: []
            };

            const highlights1 = generateHighlights(note1, keyword.toLowerCase());
            const highlights2 = generateHighlights(note2, keyword.toLowerCase());

            const score1 = calculateRelevanceScore(note1, keyword.toLowerCase(), highlights1);
            const score2 = calculateRelevanceScore(note2, keyword.toLowerCase(), highlights2);

            // Exact tag match should score higher
            return score1 > score2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should give higher scores for multiple occurrences', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 10 }),
          (keyword) => {
            const note1 = {
              content: `${keyword} ${keyword} ${keyword}`,
              tags: []
            };

            const note2 = {
              content: `${keyword} once`,
              tags: []
            };

            const highlights1 = generateHighlights(note1, keyword.toLowerCase());
            const highlights2 = generateHighlights(note2, keyword.toLowerCase());

            const score1 = calculateRelevanceScore(note1, keyword.toLowerCase(), highlights1);
            const score2 = calculateRelevanceScore(note2, keyword.toLowerCase(), highlights2);

            return score1 > score2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should give higher scores for early occurrences', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 5, maxLength: 10 }),
          fc.string({ minLength: 100, maxLength: 200 }),
          (keyword, filler) => {
            const note1 = {
              content: `${keyword} at start`,
              tags: []
            };

            const note2 = {
              content: `${filler} ${keyword} at end`,
              tags: []
            };

            const highlights1 = generateHighlights(note1, keyword.toLowerCase());
            const highlights2 = generateHighlights(note2, keyword.toLowerCase());

            const score1 = calculateRelevanceScore(note1, keyword.toLowerCase(), highlights1);
            const score2 = calculateRelevanceScore(note2, keyword.toLowerCase(), highlights2);

            return score1 > score2;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should be deterministic for same input', () => {
      fc.assert(
        fc.property(
          fc.record({
            content: fc.string({ minLength: 10, maxLength: 100 }),
            tags: fc.array(fc.string({ minLength: 3, maxLength: 10 }), { maxLength: 5 })
          }),
          fc.string({ minLength: 3, maxLength: 10 }),
          (noteData, query) => {
            const note = {
              content: noteData.content,
              tags: noteData.tags
            };

            const highlights = generateHighlights(note, query.toLowerCase());
            
            const score1 = calculateRelevanceScore(note, query.toLowerCase(), highlights);
            const score2 = calculateRelevanceScore(note, query.toLowerCase(), highlights);

            // Same input should produce same score
            return score1 === score2;
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Additional property: Highlight generation consistency
   */
  describe('Property: Highlight Generation', () => {
    it('should return empty array when no matches', () => {
      fc.assert(
        fc.property(
          fc.record({
            content: fc.string({ minLength: 10, maxLength: 100 }),
            tags: fc.array(fc.string({ minLength: 3, maxLength: 10 }), { maxLength: 5 })
          }),
          fc.string({ minLength: 3, maxLength: 10 }),
          (noteData, query) => {
            // Ensure query doesn't match by using a unique marker
            const uniqueMarker = '___UNIQUE_MARKER___';
            const note = {
              content: noteData.content.replace(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), uniqueMarker),
              tags: noteData.tags.filter(t => !t.toLowerCase().includes(query.toLowerCase()))
            };

            // Now search for the original query (which shouldn't be in the modified content)
            const highlights = generateHighlights(note, query.toLowerCase());

            return highlights.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should always return array', () => {
      fc.assert(
        fc.property(
          fc.record({
            content: fc.string({ minLength: 0, maxLength: 100 }),
            tags: fc.array(fc.string({ minLength: 0, maxLength: 10 }), { maxLength: 5 })
          }),
          fc.string({ minLength: 1, maxLength: 10 }),
          (noteData, query) => {
            const note = {
              content: noteData.content,
              tags: noteData.tags
            };

            const highlights = generateHighlights(note, query.toLowerCase());

            return Array.isArray(highlights);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle empty content and tags', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 10 }),
          (query) => {
            const note = {
              content: '',
              tags: []
            };

            const highlights = generateHighlights(note, query.toLowerCase());

            return Array.isArray(highlights) && highlights.length === 0;
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
