/**
 * Unit Tests for Search Service
 * 
 * Tests specific examples and edge cases for search functionality.
 */

/**
 * Unit Tests for Search Service
 * 
 * Tests specific examples and edge cases for search functionality.
 * Focuses on pure functions that don't require database access.
 */

const { 
  generateHighlights, 
  calculateRelevanceScore
} = require('./searchService');

describe('Search Service - Unit Tests', () => {
  describe('generateHighlights', () => {
    it('should highlight keyword in content', () => {
      const note = {
        content: 'This is a test with keyword in the middle',
        tags: []
      };

      const highlights = generateHighlights(note, 'keyword');

      expect(highlights).toHaveLength(1);
      expect(highlights[0].field).toBe('content');
      expect(highlights[0].snippet).toContain('<mark>');
      expect(highlights[0].snippet).toContain('</mark>');
      expect(highlights[0].snippet.toLowerCase()).toContain('keyword');
    });

    it('should highlight keyword in tags', () => {
      const note = {
        content: 'Some content',
        tags: ['important', 'work']
      };

      const highlights = generateHighlights(note, 'important');

      const tagHighlight = highlights.find(h => h.field === 'tags');
      expect(tagHighlight).toBeDefined();
      expect(tagHighlight.snippet).toContain('<mark>');
      expect(tagHighlight.snippet).toContain('#');
    });

    it('should provide context around match', () => {
      const note = {
        content: 'This is some text before the keyword and some text after it',
        tags: []
      };

      const highlights = generateHighlights(note, 'keyword');

      expect(highlights[0].snippet).toContain('before');
      expect(highlights[0].snippet).toContain('after');
    });

    it('should truncate long content with ellipsis', () => {
      const longText = 'a'.repeat(200);
      const note = {
        content: `${longText} keyword ${longText}`,
        tags: []
      };

      const highlights = generateHighlights(note, 'keyword');

      expect(highlights[0].snippet).toContain('...');
    });

    it('should handle multiple tag matches', () => {
      const note = {
        content: 'Content',
        tags: ['test', 'testing', 'tester']
      };

      const highlights = generateHighlights(note, 'test');

      const tagHighlights = highlights.filter(h => h.field === 'tags');
      expect(tagHighlights.length).toBeGreaterThan(0);
    });

    it('should return empty array when no matches', () => {
      const note = {
        content: 'No matching content',
        tags: ['other']
      };

      const highlights = generateHighlights(note, 'keyword');

      expect(highlights).toHaveLength(0);
    });

    it('should be case-insensitive', () => {
      const note = {
        content: 'This has KEYWORD in uppercase',
        tags: []
      };

      const highlights = generateHighlights(note, 'keyword');

      expect(highlights).toHaveLength(1);
      expect(highlights[0].snippet).toContain('<mark>');
    });

    it('should handle partial tag matches', () => {
      const note = {
        content: 'Content',
        tags: ['important', 'importance', 'import']
      };

      const highlights = generateHighlights(note, 'import');

      const tagHighlights = highlights.filter(h => h.field === 'tags');
      expect(tagHighlights.length).toBe(3); // All three tags contain 'import'
    });
  });

  describe('calculateRelevanceScore', () => {
    it('should give higher score for exact tag match', () => {
      const note1 = {
        content: 'Some content',
        tags: ['keyword']
      };

      const note2 = {
        content: 'Content with keyword',
        tags: []
      };

      const highlights1 = generateHighlights(note1, 'keyword');
      const highlights2 = generateHighlights(note2, 'keyword');

      const score1 = calculateRelevanceScore(note1, 'keyword', highlights1);
      const score2 = calculateRelevanceScore(note2, 'keyword', highlights2);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should give higher score for multiple occurrences', () => {
      const note1 = {
        content: 'keyword keyword keyword',
        tags: []
      };

      const note2 = {
        content: 'keyword once',
        tags: []
      };

      const highlights1 = generateHighlights(note1, 'keyword');
      const highlights2 = generateHighlights(note2, 'keyword');

      const score1 = calculateRelevanceScore(note1, 'keyword', highlights1);
      const score2 = calculateRelevanceScore(note2, 'keyword', highlights2);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should give higher score for early occurrence', () => {
      const note1 = {
        content: 'keyword at the start',
        tags: []
      };

      const note2 = {
        content: 'a'.repeat(100) + ' keyword at the end',
        tags: []
      };

      const highlights1 = generateHighlights(note1, 'keyword');
      const highlights2 = generateHighlights(note2, 'keyword');

      const score1 = calculateRelevanceScore(note1, 'keyword', highlights1);
      const score2 = calculateRelevanceScore(note2, 'keyword', highlights2);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should return non-negative score', () => {
      const note = {
        content: 'Some content',
        tags: []
      };

      const highlights = generateHighlights(note, 'keyword');
      const score = calculateRelevanceScore(note, 'keyword', highlights);

      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should give bonus for partial tag match', () => {
      const note1 = {
        content: 'content',
        tags: ['keyword']
      };

      const note2 = {
        content: 'content',
        tags: ['key']
      };

      const highlights1 = generateHighlights(note1, 'key');
      const highlights2 = generateHighlights(note2, 'key');

      const score1 = calculateRelevanceScore(note1, 'key', highlights1);
      const score2 = calculateRelevanceScore(note2, 'key', highlights2);

      // Exact match should score higher than partial match
      expect(score2).toBeGreaterThan(score1);
    });

    it('should give bonus for shorter content', () => {
      const note1 = {
        content: 'keyword',
        tags: []
      };

      const note2 = {
        content: 'a'.repeat(1000) + ' keyword',
        tags: []
      };

      const highlights1 = generateHighlights(note1, 'keyword');
      const highlights2 = generateHighlights(note2, 'keyword');

      const score1 = calculateRelevanceScore(note1, 'keyword', highlights1);
      const score2 = calculateRelevanceScore(note2, 'keyword', highlights2);

      expect(score1).toBeGreaterThan(score2);
    });

    it('should handle notes with no matches', () => {
      const note = {
        content: 'No match here',
        tags: []
      };

      const highlights = generateHighlights(note, 'keyword');
      const score = calculateRelevanceScore(note, 'keyword', highlights);

      expect(score).toBeGreaterThanOrEqual(0);
      // Score may be > 0 due to length bonus, but should be low
      expect(score).toBeLessThan(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty content', () => {
      const note = {
        content: '',
        tags: ['test']
      };

      const highlights = generateHighlights(note, 'test');
      const tagHighlights = highlights.filter(h => h.field === 'tags');

      expect(tagHighlights.length).toBe(1);
    });

    it('should handle empty tags', () => {
      const note = {
        content: 'test content',
        tags: []
      };

      const highlights = generateHighlights(note, 'test');

      expect(highlights.length).toBe(1);
      expect(highlights[0].field).toBe('content');
    });

    it('should handle special characters in query', () => {
      const note = {
        content: 'Test with @#$ special chars',
        tags: []
      };

      const highlights = generateHighlights(note, '@#$');

      expect(highlights.length).toBe(1);
    });

    it('should handle very long queries', () => {
      const longQuery = 'a'.repeat(1000);
      const note = {
        content: `Test ${longQuery} content`,
        tags: []
      };

      const highlights = generateHighlights(note, longQuery);

      expect(highlights.length).toBe(1);
    });

    it('should handle unicode characters', () => {
      const note = {
        content: '这是中文测试内容',
        tags: ['中文']
      };

      const highlights = generateHighlights(note, '中文');

      expect(highlights.length).toBeGreaterThan(0);
    });

    it('should handle multiple spaces in content', () => {
      const note = {
        content: 'test    with    multiple    spaces',
        tags: []
      };

      const highlights = generateHighlights(note, 'test');

      expect(highlights.length).toBe(1);
    });
  });
});
