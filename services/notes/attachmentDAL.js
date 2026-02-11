/**
 * Attachment Data Access Layer (DAL)
 * 
 * Provides database operations for Attachment and AttachmentAnalysis models.
 * Validates: Requirements 2.1, 2.5, 2.6, 3.1, 3.3, 4.1, 4.3
 */

const { PrismaClient, AttachmentType } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Creates a new attachment
 * @param {Object} data - Attachment data
 * @param {string} data.noteId - Note ID
 * @param {string} data.type - Attachment type (IMAGE, DOCUMENT, TABLE)
 * @param {string} data.storageKey - S3 storage key
 * @param {string} data.url - Public URL
 * @param {number} data.size - File size in bytes
 * @param {string} data.mimeType - MIME type
 * @returns {Promise<Object>} Created attachment
 */
async function createAttachment(data) {
  const { noteId, type, storageKey, url, size, mimeType } = data;

  if (!noteId || !type || !storageKey || !url || size === undefined || !mimeType) {
    throw new Error('All attachment fields are required');
  }

  // Validate attachment type
  if (!Object.values(AttachmentType).includes(type)) {
    throw new Error(`Invalid attachment type: ${type}`);
  }

  const attachment = await prisma.attachment.create({
    data: {
      noteId,
      type,
      storageKey,
      url,
      size,
      mimeType
    },
    include: {
      analysis: true
    }
  });

  return attachment;
}

/**
 * Gets an attachment by ID
 * @param {string} attachmentId - Attachment ID
 * @returns {Promise<Object|null>} Attachment or null if not found
 */
async function getAttachmentById(attachmentId) {
  if (!attachmentId) {
    throw new Error('attachmentId is required');
  }

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: {
      analysis: true,
      note: true
    }
  });

  return attachment;
}

/**
 * Gets all attachments for a note
 * @param {string} noteId - Note ID
 * @returns {Promise<Object[]>} Array of attachments
 */
async function getAttachmentsByNoteId(noteId) {
  if (!noteId) {
    throw new Error('noteId is required');
  }

  const attachments = await prisma.attachment.findMany({
    where: { noteId },
    include: {
      analysis: true
    },
    orderBy: { createdAt: 'asc' }
  });

  return attachments;
}

/**
 * Updates an attachment
 * @param {string} attachmentId - Attachment ID
 * @param {Object} data - Update data
 * @returns {Promise<Object>} Updated attachment
 */
async function updateAttachment(attachmentId, data) {
  if (!attachmentId) {
    throw new Error('attachmentId is required');
  }

  const attachment = await prisma.attachment.update({
    where: { id: attachmentId },
    data,
    include: {
      analysis: true
    }
  });

  return attachment;
}

/**
 * Deletes an attachment
 * @param {string} attachmentId - Attachment ID
 * @returns {Promise<Object>} Deleted attachment
 */
async function deleteAttachment(attachmentId) {
  if (!attachmentId) {
    throw new Error('attachmentId is required');
  }

  const attachment = await prisma.attachment.delete({
    where: { id: attachmentId }
  });

  return attachment;
}

/**
 * Creates or updates attachment analysis
 * @param {Object} data - Analysis data
 * @param {string} data.attachmentId - Attachment ID
 * @param {string} [data.textContent] - Extracted text content
 * @param {string} [data.description] - Content description
 * @param {string[]} [data.tags] - Extracted tags
 * @param {Object} [data.metadata] - Additional metadata
 * @returns {Promise<Object>} Created or updated analysis
 */
async function upsertAttachmentAnalysis(data) {
  const { attachmentId, textContent, description, tags = [], metadata = {} } = data;

  if (!attachmentId) {
    throw new Error('attachmentId is required');
  }

  // Verify attachment exists
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId }
  });

  if (!attachment) {
    throw new Error('Attachment not found');
  }

  const analysis = await prisma.attachmentAnalysis.upsert({
    where: { attachmentId },
    create: {
      attachmentId,
      textContent,
      description,
      tags,
      metadata
    },
    update: {
      textContent,
      description,
      tags,
      metadata
    }
  });

  return analysis;
}

/**
 * Gets attachment analysis by attachment ID
 * @param {string} attachmentId - Attachment ID
 * @returns {Promise<Object|null>} Analysis or null if not found
 */
async function getAttachmentAnalysis(attachmentId) {
  if (!attachmentId) {
    throw new Error('attachmentId is required');
  }

  const analysis = await prisma.attachmentAnalysis.findUnique({
    where: { attachmentId },
    include: {
      attachment: true
    }
  });

  return analysis;
}

/**
 * Deletes attachment analysis
 * @param {string} attachmentId - Attachment ID
 * @returns {Promise<Object>} Deleted analysis
 */
async function deleteAttachmentAnalysis(attachmentId) {
  if (!attachmentId) {
    throw new Error('attachmentId is required');
  }

  const analysis = await prisma.attachmentAnalysis.delete({
    where: { attachmentId }
  });

  return analysis;
}

/**
 * Gets attachments by type
 * @param {string} noteId - Note ID
 * @param {string} type - Attachment type
 * @returns {Promise<Object[]>} Array of attachments
 */
async function getAttachmentsByType(noteId, type) {
  if (!noteId || !type) {
    throw new Error('noteId and type are required');
  }

  if (!Object.values(AttachmentType).includes(type)) {
    throw new Error(`Invalid attachment type: ${type}`);
  }

  const attachments = await prisma.attachment.findMany({
    where: {
      noteId,
      type
    },
    include: {
      analysis: true
    },
    orderBy: { createdAt: 'asc' }
  });

  return attachments;
}

/**
 * Counts attachments by note
 * @param {string} noteId - Note ID
 * @returns {Promise<number>} Attachment count
 */
async function countAttachmentsByNote(noteId) {
  if (!noteId) {
    throw new Error('noteId is required');
  }

  return await prisma.attachment.count({
    where: { noteId }
  });
}

/**
 * Gets attachments with pending analysis
 * @param {number} [limit=10] - Maximum number of attachments to return
 * @returns {Promise<Object[]>} Array of attachments without analysis
 */
async function getAttachmentsWithoutAnalysis(limit = 10) {
  const attachments = await prisma.attachment.findMany({
    where: {
      analysis: null
    },
    take: limit,
    orderBy: { createdAt: 'asc' },
    include: {
      note: true
    }
  });

  return attachments;
}

/**
 * Closes the Prisma client connection
 */
async function disconnect() {
  await prisma.$disconnect();
}

module.exports = {
  createAttachment,
  getAttachmentById,
  getAttachmentsByNoteId,
  updateAttachment,
  deleteAttachment,
  upsertAttachmentAnalysis,
  getAttachmentAnalysis,
  deleteAttachmentAnalysis,
  getAttachmentsByType,
  countAttachmentsByNote,
  getAttachmentsWithoutAnalysis,
  disconnect,
  // Export prisma instance for testing
  _prisma: prisma
};
