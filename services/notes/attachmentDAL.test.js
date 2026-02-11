/**
 * Unit tests for Attachment Data Access Layer
 * 
 * Tests database operations for Attachment and AttachmentAnalysis models.
 * Validates: Requirements 2.1, 2.5, 2.6, 3.1, 3.3, 4.1, 4.3
 */

const {
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
  _prisma: prisma
} = require('./attachmentDAL');

// Mock Prisma Client
jest.mock('@prisma/client', () => {
  const AttachmentType = {
    IMAGE: 'IMAGE',
    DOCUMENT: 'DOCUMENT',
    TABLE: 'TABLE'
  };

  const mockPrisma = {
    attachment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn()
    },
    attachmentAnalysis: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn()
    },
    $disconnect: jest.fn()
  };
  
  return {
    PrismaClient: jest.fn(() => mockPrisma),
    AttachmentType
  };
});

describe('Attachment DAL', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await disconnect();
  });

  describe('createAttachment', () => {
    it('should create an attachment', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        noteId: 'note-1',
        type: 'IMAGE',
        storageKey: 'images/test.jpg',
        url: 'https://s3.example.com/images/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        createdAt: new Date(),
        analysis: null
      };

      prisma.attachment.create.mockResolvedValue(mockAttachment);

      const result = await createAttachment({
        noteId: 'note-1',
        type: 'IMAGE',
        storageKey: 'images/test.jpg',
        url: 'https://s3.example.com/images/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg'
      });

      expect(result).toEqual(mockAttachment);
      expect(prisma.attachment.create).toHaveBeenCalledWith({
        data: {
          noteId: 'note-1',
          type: 'IMAGE',
          storageKey: 'images/test.jpg',
          url: 'https://s3.example.com/images/test.jpg',
          size: 1024,
          mimeType: 'image/jpeg'
        },
        include: {
          analysis: true
        }
      });
    });

    it('should throw error if required fields are missing', async () => {
      await expect(createAttachment({
        noteId: 'note-1',
        type: 'IMAGE'
      })).rejects.toThrow('All attachment fields are required');
    });

    it('should throw error for invalid attachment type', async () => {
      await expect(createAttachment({
        noteId: 'note-1',
        type: 'INVALID',
        storageKey: 'test.jpg',
        url: 'https://example.com/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg'
      })).rejects.toThrow('Invalid attachment type: INVALID');
    });
  });

  describe('getAttachmentById', () => {
    it('should get an attachment by ID', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        noteId: 'note-1',
        type: 'IMAGE',
        storageKey: 'images/test.jpg',
        url: 'https://s3.example.com/images/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        createdAt: new Date(),
        analysis: null,
        note: {
          id: 'note-1',
          content: 'Test note'
        }
      };

      prisma.attachment.findUnique.mockResolvedValue(mockAttachment);

      const result = await getAttachmentById('attachment-1');

      expect(result).toEqual(mockAttachment);
      expect(prisma.attachment.findUnique).toHaveBeenCalledWith({
        where: { id: 'attachment-1' },
        include: {
          analysis: true,
          note: true
        }
      });
    });

    it('should return null if attachment not found', async () => {
      prisma.attachment.findUnique.mockResolvedValue(null);

      const result = await getAttachmentById('non-existent');

      expect(result).toBeNull();
    });

    it('should throw error if attachmentId is missing', async () => {
      await expect(getAttachmentById()).rejects.toThrow('attachmentId is required');
    });
  });

  describe('getAttachmentsByNoteId', () => {
    it('should get all attachments for a note', async () => {
      const mockAttachments = [
        {
          id: 'attachment-1',
          noteId: 'note-1',
          type: 'IMAGE',
          storageKey: 'images/test1.jpg',
          url: 'https://s3.example.com/images/test1.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          createdAt: new Date(),
          analysis: null
        },
        {
          id: 'attachment-2',
          noteId: 'note-1',
          type: 'DOCUMENT',
          storageKey: 'docs/test.pdf',
          url: 'https://s3.example.com/docs/test.pdf',
          size: 2048,
          mimeType: 'application/pdf',
          createdAt: new Date(),
          analysis: null
        }
      ];

      prisma.attachment.findMany.mockResolvedValue(mockAttachments);

      const result = await getAttachmentsByNoteId('note-1');

      expect(result).toEqual(mockAttachments);
      expect(prisma.attachment.findMany).toHaveBeenCalledWith({
        where: { noteId: 'note-1' },
        include: {
          analysis: true
        },
        orderBy: { createdAt: 'asc' }
      });
    });

    it('should throw error if noteId is missing', async () => {
      await expect(getAttachmentsByNoteId()).rejects.toThrow('noteId is required');
    });
  });

  describe('updateAttachment', () => {
    it('should update an attachment', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        noteId: 'note-1',
        type: 'IMAGE',
        storageKey: 'images/test.jpg',
        url: 'https://s3.example.com/images/test-updated.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        createdAt: new Date(),
        analysis: null
      };

      prisma.attachment.update.mockResolvedValue(mockAttachment);

      const result = await updateAttachment('attachment-1', {
        url: 'https://s3.example.com/images/test-updated.jpg'
      });

      expect(result).toEqual(mockAttachment);
    });

    it('should throw error if attachmentId is missing', async () => {
      await expect(updateAttachment(null, { url: 'new-url' })).rejects.toThrow(
        'attachmentId is required'
      );
    });
  });

  describe('deleteAttachment', () => {
    it('should delete an attachment', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        noteId: 'note-1',
        type: 'IMAGE',
        storageKey: 'images/test.jpg',
        url: 'https://s3.example.com/images/test.jpg',
        size: 1024,
        mimeType: 'image/jpeg',
        createdAt: new Date()
      };

      prisma.attachment.delete.mockResolvedValue(mockAttachment);

      const result = await deleteAttachment('attachment-1');

      expect(result).toEqual(mockAttachment);
      expect(prisma.attachment.delete).toHaveBeenCalledWith({
        where: { id: 'attachment-1' }
      });
    });

    it('should throw error if attachmentId is missing', async () => {
      await expect(deleteAttachment()).rejects.toThrow('attachmentId is required');
    });
  });

  describe('upsertAttachmentAnalysis', () => {
    it('should create attachment analysis', async () => {
      const mockAttachment = {
        id: 'attachment-1',
        noteId: 'note-1',
        type: 'IMAGE'
      };

      const mockAnalysis = {
        id: 'analysis-1',
        attachmentId: 'attachment-1',
        textContent: 'Extracted text',
        description: 'Image description',
        tags: ['tag1', 'tag2'],
        metadata: { width: 800, height: 600 },
        createdAt: new Date()
      };

      prisma.attachment.findUnique.mockResolvedValue(mockAttachment);
      prisma.attachmentAnalysis.upsert.mockResolvedValue(mockAnalysis);

      const result = await upsertAttachmentAnalysis({
        attachmentId: 'attachment-1',
        textContent: 'Extracted text',
        description: 'Image description',
        tags: ['tag1', 'tag2'],
        metadata: { width: 800, height: 600 }
      });

      expect(result).toEqual(mockAnalysis);
      expect(prisma.attachmentAnalysis.upsert).toHaveBeenCalledWith({
        where: { attachmentId: 'attachment-1' },
        create: {
          attachmentId: 'attachment-1',
          textContent: 'Extracted text',
          description: 'Image description',
          tags: ['tag1', 'tag2'],
          metadata: { width: 800, height: 600 }
        },
        update: {
          textContent: 'Extracted text',
          description: 'Image description',
          tags: ['tag1', 'tag2'],
          metadata: { width: 800, height: 600 }
        }
      });
    });

    it('should throw error if attachment not found', async () => {
      prisma.attachment.findUnique.mockResolvedValue(null);

      await expect(upsertAttachmentAnalysis({
        attachmentId: 'non-existent',
        textContent: 'Text'
      })).rejects.toThrow('Attachment not found');
    });

    it('should throw error if attachmentId is missing', async () => {
      await expect(upsertAttachmentAnalysis({
        textContent: 'Text'
      })).rejects.toThrow('attachmentId is required');
    });
  });

  describe('getAttachmentAnalysis', () => {
    it('should get attachment analysis', async () => {
      const mockAnalysis = {
        id: 'analysis-1',
        attachmentId: 'attachment-1',
        textContent: 'Extracted text',
        description: 'Image description',
        tags: ['tag1', 'tag2'],
        metadata: { width: 800, height: 600 },
        createdAt: new Date(),
        attachment: {
          id: 'attachment-1',
          type: 'IMAGE'
        }
      };

      prisma.attachmentAnalysis.findUnique.mockResolvedValue(mockAnalysis);

      const result = await getAttachmentAnalysis('attachment-1');

      expect(result).toEqual(mockAnalysis);
      expect(prisma.attachmentAnalysis.findUnique).toHaveBeenCalledWith({
        where: { attachmentId: 'attachment-1' },
        include: {
          attachment: true
        }
      });
    });

    it('should throw error if attachmentId is missing', async () => {
      await expect(getAttachmentAnalysis()).rejects.toThrow('attachmentId is required');
    });
  });

  describe('deleteAttachmentAnalysis', () => {
    it('should delete attachment analysis', async () => {
      const mockAnalysis = {
        id: 'analysis-1',
        attachmentId: 'attachment-1',
        textContent: 'Extracted text',
        description: 'Image description',
        tags: ['tag1', 'tag2'],
        metadata: {},
        createdAt: new Date()
      };

      prisma.attachmentAnalysis.delete.mockResolvedValue(mockAnalysis);

      const result = await deleteAttachmentAnalysis('attachment-1');

      expect(result).toEqual(mockAnalysis);
      expect(prisma.attachmentAnalysis.delete).toHaveBeenCalledWith({
        where: { attachmentId: 'attachment-1' }
      });
    });

    it('should throw error if attachmentId is missing', async () => {
      await expect(deleteAttachmentAnalysis()).rejects.toThrow(
        'attachmentId is required'
      );
    });
  });

  describe('getAttachmentsByType', () => {
    it('should get attachments by type', async () => {
      const mockAttachments = [
        {
          id: 'attachment-1',
          noteId: 'note-1',
          type: 'IMAGE',
          storageKey: 'images/test1.jpg',
          url: 'https://s3.example.com/images/test1.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          createdAt: new Date(),
          analysis: null
        }
      ];

      prisma.attachment.findMany.mockResolvedValue(mockAttachments);

      const result = await getAttachmentsByType('note-1', 'IMAGE');

      expect(result).toEqual(mockAttachments);
      expect(prisma.attachment.findMany).toHaveBeenCalledWith({
        where: {
          noteId: 'note-1',
          type: 'IMAGE'
        },
        include: {
          analysis: true
        },
        orderBy: { createdAt: 'asc' }
      });
    });

    it('should throw error for invalid type', async () => {
      await expect(getAttachmentsByType('note-1', 'INVALID')).rejects.toThrow(
        'Invalid attachment type: INVALID'
      );
    });

    it('should throw error if parameters are missing', async () => {
      await expect(getAttachmentsByType()).rejects.toThrow(
        'noteId and type are required'
      );
    });
  });

  describe('countAttachmentsByNote', () => {
    it('should count attachments for a note', async () => {
      prisma.attachment.count.mockResolvedValue(3);

      const result = await countAttachmentsByNote('note-1');

      expect(result).toBe(3);
      expect(prisma.attachment.count).toHaveBeenCalledWith({
        where: { noteId: 'note-1' }
      });
    });

    it('should throw error if noteId is missing', async () => {
      await expect(countAttachmentsByNote()).rejects.toThrow('noteId is required');
    });
  });

  describe('getAttachmentsWithoutAnalysis', () => {
    it('should get attachments without analysis', async () => {
      const mockAttachments = [
        {
          id: 'attachment-1',
          noteId: 'note-1',
          type: 'IMAGE',
          storageKey: 'images/test.jpg',
          url: 'https://s3.example.com/images/test.jpg',
          size: 1024,
          mimeType: 'image/jpeg',
          createdAt: new Date(),
          note: {
            id: 'note-1',
            content: 'Test note'
          }
        }
      ];

      prisma.attachment.findMany.mockResolvedValue(mockAttachments);

      const result = await getAttachmentsWithoutAnalysis(5);

      expect(result).toEqual(mockAttachments);
      expect(prisma.attachment.findMany).toHaveBeenCalledWith({
        where: {
          analysis: null
        },
        take: 5,
        orderBy: { createdAt: 'asc' },
        include: {
          note: true
        }
      });
    });

    it('should use default limit', async () => {
      prisma.attachment.findMany.mockResolvedValue([]);

      await getAttachmentsWithoutAnalysis();

      expect(prisma.attachment.findMany).toHaveBeenCalledWith({
        where: {
          analysis: null
        },
        take: 10,
        orderBy: { createdAt: 'asc' },
        include: {
          note: true
        }
      });
    });
  });
});
