/**
 * Tag Extractor
 * 
 * Extracts hashtags from text content and provides tag parsing utilities.
 * Validates: Requirements 1.2, 1.3
 */

/**
 * Extracts all hashtags from text
 * @param {string} text - The text to extract tags from
 * @returns {string[]} Array of unique tags (without # symbol)
 */
function extractTags(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Match hashtags: # followed by one or more word characters (letters, numbers, underscores)
  // Support for Chinese, English, and other Unicode characters
  const tagRegex = /#([\p{L}\p{N}_]+)/gu;
  const matches = text.matchAll(tagRegex);
  
  const tags = [];
  const seen = new Set();
  
  for (const match of matches) {
    const tag = match[1];
    // Deduplicate tags (case-sensitive)
    if (!seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  
  return tags;
}

/**
 * Parses text and returns both content and extracted tags
 * @param {string} text - The text to parse
 * @returns {{content: string, tags: string[]}} Object with content and tags
 */
function parseTextWithTags(text) {
  if (!text || typeof text !== 'string') {
    return { content: '', tags: [] };
  }

  const tags = extractTags(text);
  
  return {
    content: text,
    tags
  };
}

/**
 * Validates if a string is a valid tag
 * @param {string} tag - The tag to validate
 * @returns {boolean} True if valid tag
 */
function isValidTag(tag) {
  if (!tag || typeof tag !== 'string') {
    return false;
  }
  
  // Tags should contain at least one character and only word characters
  const tagRegex = /^[\p{L}\p{N}_]+$/u;
  return tagRegex.test(tag) && tag.length > 0 && tag.length <= 50;
}

/**
 * Normalizes tags by trimming and validating
 * @param {string[]} tags - Array of tags to normalize
 * @returns {string[]} Array of normalized, valid tags
 */
function normalizeTags(tags) {
  if (!Array.isArray(tags)) {
    return [];
  }
  
  const normalized = [];
  const seen = new Set();
  
  for (const tag of tags) {
    if (typeof tag === 'string') {
      const trimmed = tag.trim();
      if (isValidTag(trimmed) && !seen.has(trimmed)) {
        seen.add(trimmed);
        normalized.push(trimmed);
      }
    }
  }
  
  return normalized;
}

/**
 * Highlights hashtags in text for display
 * @param {string} text - The text to highlight
 * @returns {Array<{type: 'text'|'tag', content: string}>} Array of text segments
 */
function highlightTags(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const segments = [];
  const tagRegex = /#([\p{L}\p{N}_]+)/gu;
  let lastIndex = 0;
  
  for (const match of text.matchAll(tagRegex)) {
    // Add text before the tag
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }
    
    // Add the tag
    segments.push({
      type: 'tag',
      content: match[0] // Include the # symbol
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }
  
  return segments;
}

module.exports = {
  extractTags,
  parseTextWithTags,
  isValidTag,
  normalizeTags,
  highlightTags
};
