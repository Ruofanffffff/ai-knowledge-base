import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { documentsApi } from './documents';
import type { Document, CreateDocumentRequest, UpdateDocumentRequest } from './types';

// Mock the API client
vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('documentsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getDocuments', () => {
    it('should fetch all documents using correct endpoint', async () => {
      const mockDocuments: Document[] = [
        {
          id: '1',
          title: 'Document 1',
          content: 'Content 1',
          type: 'text',
          fileType: 'txt',
          metadata: {},
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
        {
          id: '2',
          title: 'Document 2',
          content: 'Content 2',
          type: 'text',
          fileType: 'txt',
          metadata: {},
          tags: [],
          createdAt: '2024-01-02T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      ];

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({ data: mockDocuments });

      const result = await documentsApi.getDocuments();

      expect(result).toEqual(mockDocuments);
      expect(apiClient.default.get).toHaveBeenCalledWith('/documents');
      expect(apiClient.default.get).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no documents exist', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({ data: [] });

      const result = await documentsApi.getDocuments();

      expect(result).toEqual([]);
      expect(apiClient.default.get).toHaveBeenCalledWith('/documents');
    });

    it('should handle API errors', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockRejectedValue(new Error('Network error'));

      await expect(documentsApi.getDocuments()).rejects.toThrow('Network error');
    });
  });

  describe('getDocument', () => {
    it('should fetch single document by ID using correct endpoint', async () => {
      const mockDocument: Document = {
        id: '123',
        title: 'Test Document',
        content: 'Test Content',
        type: 'text',
        fileType: 'txt',
        metadata: {},
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({ data: mockDocument });

      const result = await documentsApi.getDocument('123');

      expect(result).toEqual(mockDocument);
      expect(apiClient.default.get).toHaveBeenCalledWith('/documents/123');
      expect(apiClient.default.get).toHaveBeenCalledTimes(1);
    });

    it('should handle document not found', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockRejectedValue(new Error('Document not found'));

      await expect(documentsApi.getDocument('nonexistent')).rejects.toThrow('Document not found');
    });

    it('should handle special characters in document ID', async () => {
      const mockDocument: Document = {
        id: 'doc-with-special-chars-123',
        title: 'Special Doc',
        content: 'Content',
        type: 'text',
        fileType: 'txt',
        metadata: {},
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({ data: mockDocument });

      const result = await documentsApi.getDocument('doc-with-special-chars-123');

      expect(result).toEqual(mockDocument);
      expect(apiClient.default.get).toHaveBeenCalledWith('/documents/doc-with-special-chars-123');
    });
  });

  describe('createDocument', () => {
    it('should create document using correct endpoint and data', async () => {
      const createRequest: CreateDocumentRequest = {
        title: 'New Document',
        content: 'New Content',
      };

      const mockResponse: Document = {
        id: 'new-doc-id',
        title: 'New Document',
        content: 'New Content',
        type: 'text',
        fileType: 'txt',
        metadata: {},
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue({ data: mockResponse });

      const result = await documentsApi.createDocument(createRequest);

      expect(result).toEqual(mockResponse);
      expect(apiClient.default.post).toHaveBeenCalledWith('/documents', createRequest);
      expect(apiClient.default.post).toHaveBeenCalledTimes(1);
    });

    it('should handle creation with minimal data', async () => {
      const createRequest: CreateDocumentRequest = {
        title: 'Minimal Doc',
        content: '',
      };

      const mockResponse: Document = {
        id: 'minimal-id',
        title: 'Minimal Doc',
        content: '',
        type: 'text',
        fileType: 'txt',
        metadata: {},
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue({ data: mockResponse });

      const result = await documentsApi.createDocument(createRequest);

      expect(result).toEqual(mockResponse);
      expect(apiClient.default.post).toHaveBeenCalledWith('/documents', createRequest);
    });

    it('should handle creation errors', async () => {
      const createRequest: CreateDocumentRequest = {
        title: 'Error Doc',
        content: 'Content',
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockRejectedValue(new Error('Creation failed'));

      await expect(documentsApi.createDocument(createRequest)).rejects.toThrow('Creation failed');
    });

    it('should handle creation with Chinese characters', async () => {
      const createRequest: CreateDocumentRequest = {
        title: '中文文档',
        content: '这是中文内容',
      };

      const mockResponse: Document = {
        id: 'chinese-doc',
        title: '中文文档',
        content: '这是中文内容',
        type: 'text',
        fileType: 'txt',
        metadata: {},
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue({ data: mockResponse });

      const result = await documentsApi.createDocument(createRequest);

      expect(result.title).toBe('中文文档');
      expect(result.content).toBe('这是中文内容');
    });
  });

  describe('updateDocument', () => {
    it('should update document using correct endpoint and data', async () => {
      const updateRequest: UpdateDocumentRequest = {
        title: 'Updated Title',
        content: 'Updated Content',
      };

      const mockResponse: Document = {
        id: 'doc-123',
        title: 'Updated Title',
        content: 'Updated Content',
        type: 'text',
        fileType: 'txt',
        metadata: {},
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.put).mockResolvedValue({ data: mockResponse });

      const result = await documentsApi.updateDocument('doc-123', updateRequest);

      expect(result).toEqual(mockResponse);
      expect(apiClient.default.put).toHaveBeenCalledWith('/documents/doc-123', updateRequest);
      expect(apiClient.default.put).toHaveBeenCalledTimes(1);
    });

    it('should handle partial updates', async () => {
      const updateRequest: UpdateDocumentRequest = {
        title: 'Only Title Updated',
      };

      const mockResponse: Document = {
        id: 'doc-456',
        title: 'Only Title Updated',
        content: 'Original Content',
        type: 'text',
        fileType: 'txt',
        metadata: {},
        tags: [],
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-02T00:00:00.000Z',
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.put).mockResolvedValue({ data: mockResponse });

      const result = await documentsApi.updateDocument('doc-456', updateRequest);

      expect(result.title).toBe('Only Title Updated');
      expect(apiClient.default.put).toHaveBeenCalledWith('/documents/doc-456', updateRequest);
    });

    it('should handle update errors', async () => {
      const updateRequest: UpdateDocumentRequest = {
        title: 'Error Update',
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.put).mockRejectedValue(new Error('Update failed'));

      await expect(documentsApi.updateDocument('doc-789', updateRequest)).rejects.toThrow('Update failed');
    });

    it('should handle updating non-existent document', async () => {
      const updateRequest: UpdateDocumentRequest = {
        title: 'Update Non-existent',
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.put).mockRejectedValue(new Error('Document not found'));

      await expect(documentsApi.updateDocument('nonexistent', updateRequest)).rejects.toThrow('Document not found');
    });
  });

  describe('deleteDocument', () => {
    it('should delete document using correct endpoint', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.delete).mockResolvedValue({ data: undefined });

      await documentsApi.deleteDocument('doc-123');

      expect(apiClient.default.delete).toHaveBeenCalledWith('/documents/doc-123');
      expect(apiClient.default.delete).toHaveBeenCalledTimes(1);
    });

    it('should handle deletion errors', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.delete).mockRejectedValue(new Error('Deletion failed'));

      await expect(documentsApi.deleteDocument('doc-456')).rejects.toThrow('Deletion failed');
    });

    it('should handle deleting non-existent document', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.delete).mockRejectedValue(new Error('Document not found'));

      await expect(documentsApi.deleteDocument('nonexistent')).rejects.toThrow('Document not found');
    });

    it('should not return any data on successful deletion', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.delete).mockResolvedValue({ data: undefined });

      const result = await documentsApi.deleteDocument('doc-789');

      expect(result).toBeUndefined();
    });
  });

  describe('API endpoint correctness', () => {
    it('should use /documents endpoint for getDocuments', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({ data: [] });

      await documentsApi.getDocuments();

      expect(apiClient.default.get).toHaveBeenCalledWith('/documents');
    });

    it('should use /documents/:id endpoint for getDocument', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue({ data: {} });

      await documentsApi.getDocument('test-id');

      expect(apiClient.default.get).toHaveBeenCalledWith('/documents/test-id');
    });

    it('should use POST /documents endpoint for createDocument', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue({ data: {} });

      await documentsApi.createDocument({ title: 'Test', content: 'Test content' });

      expect(apiClient.default.post).toHaveBeenCalledWith('/documents', { title: 'Test', content: 'Test content' });
    });

    it('should use PUT /documents/:id endpoint for updateDocument', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.put).mockResolvedValue({ data: {} });

      await documentsApi.updateDocument('test-id', { title: 'Updated' });

      expect(apiClient.default.put).toHaveBeenCalledWith('/documents/test-id', { title: 'Updated' });
    });

    it('should use DELETE /documents/:id endpoint for deleteDocument', async () => {
      const apiClient = await import('./client');
      vi.mocked(apiClient.default.delete).mockResolvedValue({ data: undefined });

      await documentsApi.deleteDocument('test-id');

      expect(apiClient.default.delete).toHaveBeenCalledWith('/documents/test-id');
    });
  });
});
