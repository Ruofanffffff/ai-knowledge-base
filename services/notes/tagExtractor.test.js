/**
 * Unit tests for Tag Extractor
 * 
 * Tests tag extraction and parsing logic.
 * Validates: Requirements 1.2, 1.3
 */

const {
  extractTags,
  parseTextWithTags,
  isValidTag,
  normalizeTags,
  highlightTags
} = require('./tagExtractor');

describe('Tag Extractor', () => {
  describe('extractTags', () => {
    it('should extract single tag from text', () => {
      const text = '这是一条便签 #工作';
      const tags = extractTags(text);
      expect(tags).toEqual(['工作']);
    });

    it('should extract multiple tags from text', () => {
      const text = '这是一条便签 #工作 #重要 #项目';
      const tags = extractTags(text);
      expect(tags).toEqual(['工作', '重要', '项目']);
    });

    it('should extract English tags', () => {
      const text = 'This is a note #work #important';
      const tags = extractTags(text);
      expect(tags).toEqual(['work', 'important']);
    });

    it('should extract mixed language tags', () => {
      const text = 'Mixed note #工作 #work #重要 #important';
      const tags = extractTags(text);
      expect(tags).toEqual(['工作', 'work', '重要', 'important']);
    });

    it('should extract tags with numbers', () => {
      const text = 'Note with numbers #project2024 #task1';
      const tags = extractTags(text);
      expect(tags).toEqual(['project2024', 'task1']);
    });

    it('should extract tags with underscores', () => {
      const text = 'Note with underscores #my_project #task_1';
      const tags = extractTags(text);
      expect(tags).toEqual(['my_project', 'task_1']);
    });

    it('should deduplicate tags', () => {
      const text = 'Duplicate tags #work #work #important #work';
      const tags = extractTags(text);
      expect(tags).toEqual(['work', 'important']);
    });

    it('should handle empty text', () => {
      const tags = extractTags('');
      expect(tags).toEqual([]);
    });

    it('should handle null input', () => {
      const tags = extractTags(null);
      expect(tags).toEqual([]);
    });

    it('should handle undefined input', () => {
      const tags = extractTags(undefined);
      expect(tags).toEqual([]);
    });

    it('should handle text without tags', () => {
      const text = 'This is a note without any tags';
      const tags = extractTags(text);
      expect(tags).toEqual([]);
    });

    it('should not extract # followed by space', () => {
      const text = 'Invalid tag # space';
      const tags = extractTags(text);
      expect(tags).toEqual([]);
    });

    it('should not extract # at end of text', () => {
      const text = 'Invalid tag #';
      const tags = extractTags(text);
      expect(tags).toEqual([]);
    });

    it('should extract tags from multiline text', () => {
      const text = 'Line 1 #tag1\nLine 2 #tag2\nLine 3 #tag3';
      const tags = extractTags(text);
      expect(tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should handle tags at start of text', () => {
      const text = '#first tag in the beginning';
      const tags = extractTags(text);
      expect(tags).toEqual(['first']);
    });

    it('should handle tags at end of text', () => {
      const text = 'tag at the end #last';
      const tags = extractTags(text);
      expect(tags).toEqual(['last']);
    });
  });

  describe('parseTextWithTags', () => {
    it('should parse text and extract tags', () => {
      const text = '这是一条便签 #工作 #重要';
      const result = parseTextWithTags(text);
      expect(result).toEqual({
        content: '这是一条便签 #工作 #重要',
        tags: ['工作', '重要']
      });
    });

    it('should handle empty text', () => {
      const result = parseTextWithTags('');
      expect(result).toEqual({
        content: '',
        tags: []
      });
    });

    it('should handle null input', () => {
      const result = parseTextWithTags(null);
      expect(result).toEqual({
        content: '',
        tags: []
      });
    });
  });

  describe('isValidTag', () => {
    it('should validate correct tags', () => {
      expect(isValidTag('work')).toBe(true);
      expect(isValidTag('工作')).toBe(true);
      expect(isValidTag('project2024')).toBe(true);
      expect(isValidTag('my_project')).toBe(true);
    });

    it('should reject empty tags', () => {
      expect(isValidTag('')).toBe(false);
      expect(isValidTag(null)).toBe(false);
      expect(isValidTag(undefined)).toBe(false);
    });

    it('should reject tags with spaces', () => {
      expect(isValidTag('my tag')).toBe(false);
    });

    it('should reject tags with special characters', () => {
      expect(isValidTag('tag!')).toBe(false);
      expect(isValidTag('tag@')).toBe(false);
      expect(isValidTag('tag#')).toBe(false);
    });

    it('should reject tags that are too long', () => {
      const longTag = 'a'.repeat(51);
      expect(isValidTag(longTag)).toBe(false);
    });

    it('should accept tags at max length', () => {
      const maxTag = 'a'.repeat(50);
      expect(isValidTag(maxTag)).toBe(true);
    });
  });

  describe('normalizeTags', () => {
    it('should normalize valid tags', () => {
      const tags = ['work', '工作', 'project2024'];
      const normalized = normalizeTags(tags);
      expect(normalized).toEqual(['work', '工作', 'project2024']);
    });

    it('should trim whitespace', () => {
      const tags = [' work ', '  important  '];
      const normalized = normalizeTags(tags);
      expect(normalized).toEqual(['work', 'important']);
    });

    it('should remove invalid tags', () => {
      const tags = ['work', 'invalid tag', 'tag!', '工作'];
      const normalized = normalizeTags(tags);
      expect(normalized).toEqual(['work', '工作']);
    });

    it('should deduplicate tags', () => {
      const tags = ['work', 'work', 'important'];
      const normalized = normalizeTags(tags);
      expect(normalized).toEqual(['work', 'important']);
    });

    it('should handle empty array', () => {
      const normalized = normalizeTags([]);
      expect(normalized).toEqual([]);
    });

    it('should handle null input', () => {
      const normalized = normalizeTags(null);
      expect(normalized).toEqual([]);
    });

    it('should filter non-string values', () => {
      const tags = ['work', 123, null, undefined, 'important'];
      const normalized = normalizeTags(tags);
      expect(normalized).toEqual(['work', 'important']);
    });
  });

  describe('highlightTags', () => {
    it('should highlight single tag', () => {
      const text = 'This is #work';
      const segments = highlightTags(text);
      expect(segments).toEqual([
        { type: 'text', content: 'This is ' },
        { type: 'tag', content: '#work' }
      ]);
    });

    it('should highlight multiple tags', () => {
      const text = 'This is #work and #important';
      const segments = highlightTags(text);
      expect(segments).toEqual([
        { type: 'text', content: 'This is ' },
        { type: 'tag', content: '#work' },
        { type: 'text', content: ' and ' },
        { type: 'tag', content: '#important' }
      ]);
    });

    it('should handle tag at start', () => {
      const text = '#work is important';
      const segments = highlightTags(text);
      expect(segments).toEqual([
        { type: 'tag', content: '#work' },
        { type: 'text', content: ' is important' }
      ]);
    });

    it('should handle tag at end', () => {
      const text = 'This is #work';
      const segments = highlightTags(text);
      expect(segments).toEqual([
        { type: 'text', content: 'This is ' },
        { type: 'tag', content: '#work' }
      ]);
    });

    it('should handle text without tags', () => {
      const text = 'No tags here';
      const segments = highlightTags(text);
      expect(segments).toEqual([
        { type: 'text', content: 'No tags here' }
      ]);
    });

    it('should handle empty text', () => {
      const segments = highlightTags('');
      expect(segments).toEqual([]);
    });

    it('should handle consecutive tags', () => {
      const text = '#work#important';
      const segments = highlightTags(text);
      expect(segments).toEqual([
        { type: 'tag', content: '#work' },
        { type: 'tag', content: '#important' }
      ]);
    });

    it('should handle Chinese tags', () => {
      const text = '这是 #工作 和 #重要';
      const segments = highlightTags(text);
      expect(segments).toEqual([
        { type: 'text', content: '这是 ' },
        { type: 'tag', content: '#工作' },
        { type: 'text', content: ' 和 ' },
        { type: 'tag', content: '#重要' }
      ]);
    });
  });
});
