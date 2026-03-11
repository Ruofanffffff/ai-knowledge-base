/**
 * Note Data Access Layer (DAL)
 * 
 * Provides database operations for Note model.
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5
 */

const { PrismaClient } = require('@prisma/client');
const { extractTags, normalizeTags } = require('./tagExtractor');

const prisma = new PrismaClient();

/**
 * Ensures user exists in the database to satisfy foreign key constraints.
 * @param {Object} user - User object from req.user
 * @returns {Promise<void>}
 */
async function ensureUserExists(user) {
  if (!user || !user.id) {
    console.warn('ensureUserExists called without valid user object');
    return;
  }

  try {
    // Use username or fallback to id if username is missing/empty
    // We must ensure username is unique.
    // If username is empty, we use user.id which is unique.
    const username = user.username || user.id;
    
    // Use a placeholder password since auth is handled externally
    // This hash is invalid but satisfies the non-null constraint
    const passwordPlaceholder = '$2b$10$EpMq.0.0.0.0.0.0.0.0.0'; 

    await prisma.user.upsert({
      where: { id: user.id },
      update: {
        // Only update fields that might have changed from external provider
        username: username,
        email: user.email || undefined,
        // Don't update password
      },
      create: {
        id: user.id,
        username: username,
        email: user.email || undefined,
        password: passwordPlaceholder,
        role: user.role || 'user',
        // status: 'active' // status is not in schema based on previous read, let me check schema again
      }
    });
  } catch (error) {
    console.error('Error ensuring user exists:', error);
    // Continue execution, let the foreign key constraint fail if it must
    // But usually this prevents the FK error.
  }
}

/**
 * Creates a new note
 * @param {Object} data - Note data
 * @param {Object} data.user - User object (required)
 * @param {string} data.content - Note content
 * @param {string[]} [data.tags] - Optional tags (will be extracted from content if not provided)
 * @returns {Promise<Object>} Created note
 */
async function createNote({ user, content, tags }) {
  // Support legacy call with userId only if user object is not provided (though new requirement says pass user)
  // But to be safe, if user is missing but userId is present (from tests?), we might fail or try to proceed.
  // The requirement is to call ensureUserExists(user).
  
  if (!user && !arguments[0].userId) {
     throw new Error('user object or userId is required');
  }

  let userId;
  if (user) {
    userId = user.id;
    await ensureUserExists(user);
  } else {
    userId = arguments[0].userId;
  }

  if (!content) {
    throw new Error('content is required');
  }

  // Extract tags from content if not provided
  let finalTags = tags;
  if (!finalTags || finalTags.length === 0) {
    finalTags = extractTags(content);
  } else {
    // Normalize provided tags
    finalTags = normalizeTags(finalTags);
  }

  const note = await prisma.note.create({
    data: {
      userId,
      content,
      tags: JSON.stringify(finalTags)
    },
    include: {
      attachments: true
    }
  });

  // Parse tags back to array for response
  if (note.tags) {
    try {
      note.tags = JSON.parse(note.tags);
    } catch (e) {
      note.tags = [];
    }
  }

  return note;
}

/**
 * Gets a note by ID
 * @param {string} noteId - Note ID
 * @param {string} [userId] - Optional user ID for authorization
 * @returns {Promise<Object|null>} Note or null if not found
 */
async function getNoteById(noteId, userId) {
  if (!noteId) {
    throw new Error('noteId is required');
  }

  const where = { id: noteId };
  if (userId) {
    where.userId = userId;
  }

  const note = await prisma.note.findUnique({
    where,
    include: {
      attachments: true
    }
  });

  if (note && note.tags) {
    try {
      note.tags = JSON.parse(note.tags);
    } catch (e) {
      note.tags = [];
    }
  }

  return note;
}

/**
 * Updates a note
 * @param {string} noteId - Note ID
 * @param {Object} data - Update data
 * @param {string} [data.content] - New content
 * @param {string[]} [data.tags] - New tags
 * @param {string} [userId] - Optional user ID for authorization
 * @returns {Promise<Object>} Updated note
 */
async function updateNote(noteId, data, userId) {
  if (!noteId) {
    throw new Error('noteId is required');
  }

  // Verify note exists and belongs to user
  const where = { id: noteId };
  if (userId) {
    where.userId = userId;
  }

  const existingNote = await prisma.note.findUnique({ where });
  if (!existingNote) {
    throw new Error('Note not found');
  }

  const updateData = {};
  
  if (data.content !== undefined) {
    updateData.content = data.content;
    
    // Re-extract tags from new content if tags not explicitly provided
    if (data.tags === undefined) {
      const extractedTags = extractTags(data.content);
      updateData.tags = JSON.stringify(extractedTags);
    }
  }
  
  if (data.tags !== undefined) {
    updateData.tags = JSON.stringify(normalizeTags(data.tags));
  }

  const note = await prisma.note.update({
    where: { id: noteId },
    data: updateData,
    include: {
      attachments: true
    }
  });

  if (note && note.tags) {
    try {
      note.tags = JSON.parse(note.tags);
    } catch (e) {
      note.tags = [];
    }
  }

  return note;
}

/**
 * Deletes a note
 * @param {string} noteId - Note ID
 * @param {string} [userId] - Optional user ID for authorization
 * @returns {Promise<Object>} Deleted note
 */
async function deleteNote(noteId, userId) {
  if (!noteId) {
    throw new Error('noteId is required');
  }

  // Verify note exists and belongs to user
  const where = { id: noteId };
  if (userId) {
    where.userId = userId;
  }

  const existingNote = await prisma.note.findUnique({ where });
  if (!existingNote) {
    throw new Error('Note not found');
  }

  const note = await prisma.note.delete({
    where: { id: noteId }
  });

  if (note && note.tags) {
    try {
      note.tags = JSON.parse(note.tags);
    } catch (e) {
      note.tags = [];
    }
  }

  return note;
}

/**
 * Lists notes with pagination and filtering
 * @param {Object} options - Query options
 * @param {string} [options.userId] - Filter by user ID
 * @param {string[]} [options.tags] - Filter by tags
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @param {string} [options.sortBy='createdAt'] - Sort field
 * @param {string} [options.order='desc'] - Sort order
 * @returns {Promise<Object>} Object with notes, total, page, limit
 */
async function listNotes(options = {}) {
  const {
    userId,
    tags,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    order = 'desc'
  } = options;

  const where = {};
  
  if (userId) {
    where.userId = userId;
  }
  
  if (tags && tags.length > 0) {
    // Fix for SQLite JSON string storage: use string contains instead of array hasSome
    where.OR = tags.map(t => ({
      tags: { contains: `"${t}"` }
    }));
  }

  const skip = (page - 1) * limit;
  const orderBy = { [sortBy]: order };

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        attachments: true
      }
    }),
    prisma.note.count({ where })
  ]);

  // Parse tags for each note
  notes.forEach(note => {
    if (note.tags) {
      try {
        note.tags = JSON.parse(note.tags);
      } catch (e) {
        note.tags = [];
      }
    }
  });

  return {
    notes,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Gets all unique tags for a user
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} Array of unique tags
 */
async function getUserTags(userId) {
  if (!userId) {
    throw new Error('userId is required');
  }

  const notes = await prisma.note.findMany({
    where: { userId },
    select: { tags: true }
  });

  const tagSet = new Set();
  notes.forEach(note => {
    note.tags.forEach(tag => tagSet.add(tag));
  });

  return Array.from(tagSet).sort();
}

/**
 * Counts notes by user
 * @param {string} userId - User ID
 * @returns {Promise<number>} Note count
 */
async function countNotesByUser(userId) {
  if (!userId) {
    throw new Error('userId is required');
  }

  return await prisma.note.count({
    where: { userId }
  });
}

/**
 * Searches notes by content or tags
 * @param {Object} options - Search options
 * @param {string} options.query - Search query
 * @param {string} [options.userId] - Filter by user ID
 * @param {number} [options.page=1] - Page number
 * @param {number} [options.limit=20] - Items per page
 * @returns {Promise<Object>} Search results
 */
async function searchNotes(options) {
  const {
    query,
    userId,
    page = 1,
    limit = 20
  } = options;

  if (!query) {
    throw new Error('query is required');
  }

  const where = {
    OR: [
      {
        content: {
          contains: query
        }
      },
      {
        tags: {
          contains: `"${query}"`
        }
      }
    ]
  };

  if (userId) {
    where.userId = userId;
  }

  const skip = (page - 1) * limit;

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        attachments: true
      }
    }),
    prisma.note.count({ where })
  ]);

  notes.forEach(note => {
    if (note.tags) {
      try {
        note.tags = JSON.parse(note.tags);
      } catch (e) {
        note.tags = [];
      }
    }
  });

  return {
    notes,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  };
}

/**
 * Closes the Prisma client connection
 */
async function disconnect() {
  await prisma.$disconnect();
}

module.exports = {
  createNote,
  ensureUserExists,
  getNoteById,
  updateNote,
  deleteNote,
  listNotes,
  getUserTags,
  countNotesByUser,
  searchNotes,
  disconnect,
  // Export prisma instance for testing
  _prisma: prisma
};
