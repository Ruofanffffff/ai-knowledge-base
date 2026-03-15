/**
 * Note Data Access Layer (DAL)
 * 
 * Provides database operations for Note model.
 * Validates: Requirements 1.2, 1.3, 1.4, 1.5
 */

const { PrismaClient } = require('@prisma/client');
const { extractTags, normalizeTags } = require('./tagExtractor');

const prisma = new PrismaClient();

function stripHtmlToPlainText(value) {
  if (value === null || value === undefined) return '';
  const text = String(value)
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/\s+/g, ' ')
    .trim();
  return text;
}

function deriveTitleFromContent(content, maxLength = 50) {
  const plain = stripHtmlToPlainText(content || '');
  if (!plain) return '无标题';
  return plain.slice(0, maxLength);
}

function normalizeNote(note) {
  if (!note) return note;
  const normalized = { ...note };
  if (Array.isArray(normalized.tags)) {
    normalized.tags = normalized.tags;
  } else if (normalized.tags) {
    try {
      normalized.tags = JSON.parse(normalized.tags);
    } catch (e) {
      normalized.tags = [];
    }
  } else {
    normalized.tags = [];
  }
  normalized.title = deriveTitleFromContent(normalized.content);
  return normalized;
}

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
    const normalizedUserId = String(user.id);
    // Use username or fallback to id if username is missing/empty
    // We must ensure username is unique.
    // If username is empty, we use user.id which is unique.
    const username = user.username || normalizedUserId;
    
    // Use a placeholder password since auth is handled externally
    // This hash is invalid but satisfies the non-null constraint
    const passwordPlaceholder = '$2b$10$EpMq.0.0.0.0.0.0.0.0.0'; 
    
    // Check if username already exists for a DIFFERENT user ID (collision case)
    // If so, we append a random suffix to the new username to satisfy unique constraint
    const existingUser = await prisma.user.findUnique({
      where: { username: username }
    });
    
    let finalUsername = username;
    if (existingUser && existingUser.id !== user.id) {
       finalUsername = `${username}_${Math.random().toString(36).substring(2, 7)}`;
    }

    await prisma.user.upsert({
      where: { id: normalizedUserId },
      update: {
        // Only update fields that might have changed from external provider
        username: finalUsername,
        // email: user.email || undefined, // Email might also conflict, so skip updating email for now to be safe
        // Don't update password
      },
      create: {
        id: normalizedUserId,
        username: finalUsername,
        // email: user.email || undefined, // Skip email to avoid unique constraint if another user has same email
        password: passwordPlaceholder,
        // role: user.role || 'user', // role field does not exist in User schema
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
async function createNote(input = {}) {
  const { user, content, tags, userId: legacyUserId } = input;

  const resolvedUserId = user?.id ?? legacyUserId;
  if (!resolvedUserId) {
    throw new Error('user object or userId is required');
  }

  const userId = String(resolvedUserId);

  if (!content) {
    throw new Error('content is required');
  }

  // Always ensure user exists, including legacy calls that only pass userId.
  await ensureUserExists({
    id: userId,
    username: user?.username || userId,
    email: user?.email
  });

  // Extract tags from content if not provided
  let finalTags = tags;
  if (!finalTags || finalTags.length === 0) {
    finalTags = extractTags(content);
  } else {
    // Normalize provided tags
    finalTags = normalizeTags(finalTags);
  }

  let note;
  try {
    note = await prisma.note.create({
      data: {
        userId,
        content,
        tags: JSON.stringify(finalTags)
      },
      include: {
        attachments: true
      }
    });
  } catch (error) {
    // Deployment fallback: if FK fails (legacy route / stale deployment data), re-sync user and retry once.
    const isForeignKeyError =
      error?.code === 'P2003' ||
      /foreign key/i.test(error?.message || '');

    if (!isForeignKeyError) {
      throw error;
    }

    await ensureUserExists({
      id: userId,
      username: user?.username || userId,
      email: user?.email
    });

    note = await prisma.note.create({
      data: {
        userId,
        content,
        tags: JSON.stringify(finalTags)
      },
      include: {
        attachments: true
      }
    });
  }

  return normalizeNote(note);
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

  return normalizeNote(note);
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

  return normalizeNote(note);
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

  return normalizeNote(note);
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

  const normalizedNotes = notes.map(normalizeNote);

  return {
    notes: normalizedNotes,
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

  const normalizedNotes = notes.map(normalizeNote);

  return {
    notes: normalizedNotes,
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
