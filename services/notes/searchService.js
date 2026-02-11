/**
 * Search Service
 * 
 * Provides full-text search functionality for notes.
 * Uses PostgreSQL's built-in full-text search capabilities.
 * Validates: Requirements 9.2, 9.3, 9.4, 9.5
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Searches notes by query string
 * Searches in title, content, and tags
 * 
 * @param {Object} options - Search options
 * @param {string} options.query - Search query
 * @param {string} [options.userId] - Filter by user ID
 * @param {string[]} [options.tags] - Filter by tags
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @returns {Promise<Object>} Search results with highlights
 */
async function searchNotes(options) {
  const {
    query,
    userId,
    tags,
    page = 1,
    limit = 20
  } = options;

  if (!query || query.trim() === '') {
    throw new Error('query is required and cannot be empty');
  }

  const normalizedQuery = query.trim().toLowerCase();
  const skip = (page - 1) * limit;

  // Build where clause for fuzzy search
  const where = {
    AND: []
  };

  // Add user filter if provided
  if (userId) {
    where.AND.push({ userId });
  }

  // Add tag filter if provided
  if (tags && tags.length > 0) {
    where.AND.push({
      tags: {
        hasSome: tags
      }
    });
  }

  // Add content search (case-insensitive, fuzzy)
  where.AND.push({
    OR: [
      {
        content: {
          contains: normalizedQuery,
          mode: 'insensitive'
        }
      },
      {
        tags: {
          hasSome: [normalizedQuery]
        }
      }
    ]
  });

  // Execute search query
  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      include: {
        attachments: {
          include: {
            analysis: true
          }
        }
      }
    }),
    prisma.note.count({ where })
  ]);

  // Generate highlights for each result
  const results = notes.map(note => {
    const highlights = generateHighlights(note, normalizedQuery);
    return {
      note,
      highlights,
      score: calculateRelevanceScore(note, normalizedQuery, highlights)
    };
  });

  // Sort by relevance score
  results.sort((a, b) => b.score - a.score);

  return {
    results,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Generates highlights for search results
 * Identifies matching keywords in content and tags
 * 
 * @param {Object} note - Note object
 * @param {string} query - Search query (normalized)
 * @returns {Array<Object>} Array of highlight objects
 */
function generateHighlights(note, query) {
  const highlights = [];
  const queryLower = query.toLowerCase();

  // Check content for matches
  const contentLower = note.content.toLowerCase();
  const contentIndex = contentLower.indexOf(queryLower);
  
  if (contentIndex !== -1) {
    // Extract snippet around the match (50 chars before and after)
    const start = Math.max(0, contentIndex - 50);
    const end = Math.min(note.content.length, contentIndex + queryLower.length + 50);
    
    let snippet = note.content.substring(start, end);
    
    // Add ellipsis if truncated
    if (start > 0) snippet = '...' + snippet;
    if (end < note.content.length) snippet = snippet + '...';
    
    // Highlight the matching text
    const matchStart = snippet.toLowerCase().indexOf(queryLower);
    if (matchStart !== -1) {
      const matchEnd = matchStart + queryLower.length;
      snippet = 
        snippet.substring(0, matchStart) +
        '<mark>' + snippet.substring(matchStart, matchEnd) + '</mark>' +
        snippet.substring(matchEnd);
    }
    
    highlights.push({
      field: 'content',
      snippet
    });
  }

  // Check tags for matches
  const matchingTags = note.tags.filter(tag => 
    tag.toLowerCase().includes(queryLower)
  );
  
  if (matchingTags.length > 0) {
    matchingTags.forEach(tag => {
      const tagLower = tag.toLowerCase();
      const matchIndex = tagLower.indexOf(queryLower);
      
      if (matchIndex !== -1) {
        const matchEnd = matchIndex + queryLower.length;
        const highlightedTag = 
          tag.substring(0, matchIndex) +
          '<mark>' + tag.substring(matchIndex, matchEnd) + '</mark>' +
          tag.substring(matchEnd);
        
        highlights.push({
          field: 'tags',
          snippet: `#${highlightedTag}`
        });
      }
    });
  }

  return highlights;
}

/**
 * Calculates relevance score for a search result
 * Higher score = more relevant
 * 
 * @param {Object} note - Note object
 * @param {string} query - Search query (normalized)
 * @param {Array<Object>} highlights - Highlight objects
 * @returns {number} Relevance score
 */
function calculateRelevanceScore(note, query, highlights) {
  let score = 0;
  const queryLower = query.toLowerCase();
  const contentLower = note.content.toLowerCase();

  // Base score: number of highlights
  score += highlights.length * 10;

  // Bonus for exact tag match
  const exactTagMatch = note.tags.some(tag => tag.toLowerCase() === queryLower);
  if (exactTagMatch) {
    score += 50;
  }

  // Bonus for partial tag match
  const partialTagMatch = note.tags.some(tag => tag.toLowerCase().includes(queryLower));
  if (partialTagMatch && !exactTagMatch) {
    score += 25;
  }

  // Bonus for multiple occurrences in content
  // Escape special regex characters
  const escapedQuery = queryLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    const occurrences = (contentLower.match(new RegExp(escapedQuery, 'g')) || []).length;
    score += occurrences * 5;
  } catch (e) {
    // If regex fails, fall back to simple count
    const occurrences = contentLower.split(queryLower).length - 1;
    score += occurrences * 5;
  }

  // Bonus for query appearing early in content
  const firstOccurrence = contentLower.indexOf(queryLower);
  if (firstOccurrence !== -1) {
    const positionScore = Math.max(0, 20 - (firstOccurrence / 10));
    score += positionScore;
  }

  // Bonus for shorter content (more focused)
  if (note.content.length < 500) {
    score += 10;
  }

  return score;
}

/**
 * Gets search suggestions based on existing tags
 * 
 * @param {string} userId - User ID
 * @param {string} [prefix] - Optional prefix to filter tags
 * @returns {Promise<string[]>} Array of tag suggestions
 */
async function getSearchSuggestions(userId, prefix = '') {
  if (!userId) {
    throw new Error('userId is required');
  }

  const notes = await prisma.note.findMany({
    where: { userId },
    select: { tags: true }
  });

  const tagSet = new Set();
  notes.forEach(note => {
    note.tags.forEach(tag => {
      if (!prefix || tag.toLowerCase().startsWith(prefix.toLowerCase())) {
        tagSet.add(tag);
      }
    });
  });

  return Array.from(tagSet).sort();
}

/**
 * Updates search index for a note
 * This is a placeholder for future optimization with dedicated search engines
 * Currently, PostgreSQL handles indexing automatically
 * 
 * @param {string} noteId - Note ID
 * @returns {Promise<void>}
 */
async function updateSearchIndex(noteId) {
  // PostgreSQL automatically updates indexes on data changes
  // This function is a placeholder for future integration with
  // dedicated search engines like Elasticsearch if needed
  
  // For now, just verify the note exists
  const note = await prisma.note.findUnique({
    where: { id: noteId }
  });

  if (!note) {
    throw new Error('Note not found');
  }

  // In the future, this could trigger:
  // - Elasticsearch index update
  // - Full-text search index rebuild
  // - Search cache invalidation
  
  return;
}

/**
 * Closes the Prisma client connection
 */
async function disconnect() {
  await prisma.$disconnect();
}

module.exports = {
  searchNotes,
  generateHighlights,
  calculateRelevanceScore,
  getSearchSuggestions,
  updateSearchIndex,
  disconnect,
  // Export prisma instance for testing
  _prisma: prisma
};
