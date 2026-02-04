import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authApi } from './auth';
import { documentsApi } from './documents';
import { graphApi } from './graph';
import { aiApi } from './ai';
import { uploadApi } from './upload';
import { clearAuthToken, getAuthToken } from '../utils/storage';
import type { ApiResponse, AuthResponse, Document } from './types';

// Mock the API client
vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('API Integration Tests', () => {
  beforeEach(() => {
    clearAuthToken();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Full Authentication Flow', () => {
    it('should complete login → API call → logout flow', async () => {
      const apiClient = await import('./client');

      // Step 1: Login
      const loginResponse: { data: ApiResponse<AuthResponse> } = {
        data: {
          success: true,
          data: {
            token: 'integration-test-token',
            user: {
              id: '1',
              username: 'integrationuser',
              email: 'integration@test.com',
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          },
        },
      };

      vi.mocked(apiClient.default.post).mockResolvedValueOnce(loginResponse);

      const authResult = await authApi.login({
        username: 'integrationuser',
        password: 'password123',
      });

      expect(authResult.token).toBe('integration-test-token');
      expect(getAuthToken()).toBe('integration-test-token');

      // Step 2: Make authenticated API call (get documents)
      const documentsResponse: { data: Document[] } = {
        data: [
          {
            id: 'doc-1',
            title: 'Test Document',
            content: 'Test Content',
            type: 'document',
            fileType: 'text',
            metadata: {},
            tags: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(apiClient.default.get).mockResolvedValueOnce(documentsResponse);

      const documents = await documentsApi.getDocuments();

      expect(documents).toHaveLength(1);
      expect(documents[0].title).toBe('Test Document');

      // Step 3: Logout
      vi.mocked(apiClient.default.post).mockResolvedValueOnce({ data: {} });

      await authApi.logout();

      expect(getAuthToken()).toBeNull();
    });

    it('should handle authentication failure in flow', async () => {
      const apiClient = await import('./client');

      // Attempt login with invalid credentials
      const loginResponse: { data: ApiResponse<AuthResponse> } = {
        data: {
          success: false,
          error: 'Invalid credentials',
        },
      };

      vi.mocked(apiClient.default.post).mockResolvedValueOnce(loginResponse);

      await expect(
        authApi.login({ username: 'invalid', password: 'wrong' })
      ).rejects.toThrow('Invalid credentials');

      // Token should not be set
      expect(getAuthToken()).toBeNull();
    });
  });

  describe('Document CRUD Flow', () => {
    it('should complete full document lifecycle', async () => {
      const apiClient = await import('./client');

      // Step 1: Create document
      const createResponse: { data: Document } = {
        data: {
          id: 'new-doc',
          title: 'New Document',
          content: 'Initial content',
          type: 'document',
          fileType: 'text',
          metadata: {},
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.mocked(apiClient.default.post).mockResolvedValueOnce(createResponse);

      const created = await documentsApi.createDocument({
        title: 'New Document',
        content: 'Initial content',
      });

      expect(created.id).toBe('new-doc');
      expect(created.title).toBe('New Document');

      // Step 2: Read document
      const readResponse: { data: Document } = {
        data: {
          id: 'new-doc',
          title: 'New Document',
          content: 'Initial content',
          type: 'document',
          fileType: 'text',
          metadata: {},
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.mocked(apiClient.default.get).mockResolvedValueOnce(readResponse);

      const read = await documentsApi.getDocument('new-doc');

      expect(read.id).toBe('new-doc');
      expect(read.title).toBe('New Document');

      // Step 3: Update document
      const updateResponse: { data: Document } = {
        data: {
          id: 'new-doc',
          title: 'Updated Document',
          content: 'Updated content',
          type: 'document',
          fileType: 'text',
          metadata: {},
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-02T00:00:00.000Z',
        },
      };

      vi.mocked(apiClient.default.put).mockResolvedValueOnce(updateResponse);

      const updated = await documentsApi.updateDocument('new-doc', {
        title: 'Updated Document',
        content: 'Updated content',
      });

      expect(updated.title).toBe('Updated Document');
      expect(updated.content).toBe('Updated content');

      // Step 4: Delete document
      vi.mocked(apiClient.default.delete).mockResolvedValueOnce({ data: undefined });

      await documentsApi.deleteDocument('new-doc');

      expect(apiClient.default.delete).toHaveBeenCalledWith('/documents/new-doc');
    });

    it('should handle errors in CRUD operations', async () => {
      const apiClient = await import('./client');

      // Create fails
      vi.mocked(apiClient.default.post).mockRejectedValueOnce(new Error('Creation failed'));

      await expect(
        documentsApi.createDocument({ title: 'Test', content: 'Test content' })
      ).rejects.toThrow('Creation failed');

      // Update fails
      vi.mocked(apiClient.default.put).mockRejectedValueOnce(new Error('Update failed'));

      await expect(
        documentsApi.updateDocument('doc-1', { title: 'Updated' })
      ).rejects.toThrow('Update failed');

      // Delete fails
      vi.mocked(apiClient.default.delete).mockRejectedValueOnce(new Error('Delete failed'));

      await expect(documentsApi.deleteDocument('doc-1')).rejects.toThrow('Delete failed');
    });
  });

  describe('Graph Data Fetching and Transformation', () => {
    it('should fetch and combine graph data correctly', async () => {
      const apiClient = await import('./client');

      // Mock entities response
      const entitiesResponse = {
        data: {
          success: true,
          data: {
            entities: [
              {
                id: 'e1',
                canonical_name: 'Entity 1',
                type: 'Type1',
                confidence: 0.9,
                schemas: [],
              },
            ],
            total: 1,
            count: 1,
          },
        },
      };

      // Mock relations response
      const relationsResponse = {
        data: {
          success: true,
          data: {
            relations: [
              {
                id: 'r1',
                source_id: 'e1',
                target_id: 'e2',
                type: 'builtin',
                confidence: 0.85,
              },
            ],
            total: 1,
            count: 1,
          },
        },
      };

      vi.mocked(apiClient.default.get)
        .mockResolvedValueOnce(entitiesResponse)
        .mockResolvedValueOnce(relationsResponse);

      const graphData = await graphApi.getGraphData();

      expect(graphData.entities).toHaveLength(1);
      expect(graphData.relations).toHaveLength(1);
      expect(graphData.entities[0].canonical_name).toBe('Entity 1');
      expect(graphData.relations[0].source_id).toBe('e1');
    });

    it('should handle graph data with filters', async () => {
      const apiClient = await import('./client');

      const params = {
        minConfidence: 0.8,
        entityType: 'ConceptEntity',
      };

      vi.mocked(apiClient.default.get)
        .mockResolvedValueOnce({
          data: { success: true, data: { entities: [], total: 0, count: 0 } },
        })
        .mockResolvedValueOnce({
          data: { success: true, data: { relations: [], total: 0, count: 0 } },
        });

      await graphApi.getGraphData(params);

      expect(apiClient.default.get).toHaveBeenNthCalledWith(1, '/knowledge-graph/entities', {
        params,
      });
      expect(apiClient.default.get).toHaveBeenNthCalledWith(2, '/knowledge-graph/relations', {
        params,
      });
    });
  });

  describe('File Upload Flow', () => {
    it('should upload file and refresh document list', async () => {
      const apiClient = await import('./client');

      // Step 1: Upload file
      const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
      const uploadResponse = {
        data: {
          id: 'file-123',
          title: 'test.pdf',
          content: 'Uploaded content',
          type: 'document',
          fileType: 'pdf',
          metadata: {},
          tags: [],
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
        },
      };

      vi.mocked(apiClient.default.post).mockResolvedValueOnce(uploadResponse);

      const uploadResult = await uploadApi.uploadFile(file);

      expect(uploadResult.id).toBe('file-123');
      expect(uploadResult.title).toBe('test.pdf');

      // Step 2: Refresh document list
      const documentsResponse: { data: Document[] } = {
        data: [
          {
            id: 'doc-1',
            title: 'test.pdf',
            content: 'Uploaded content',
            type: 'document',
            fileType: 'pdf',
            metadata: {},
            tags: [],
            createdAt: '2024-01-01T00:00:00.000Z',
            updatedAt: '2024-01-01T00:00:00.000Z',
          },
        ],
      };

      vi.mocked(apiClient.default.get).mockResolvedValueOnce(documentsResponse);

      const documents = await documentsApi.getDocuments();

      expect(documents).toHaveLength(1);
      expect(documents[0].title).toBe('test.pdf');
    });

    it('should handle upload errors', async () => {
      const apiClient = await import('./client');

      const file = new File(['test'], 'test.txt', { type: 'text/plain' });

      vi.mocked(apiClient.default.post).mockRejectedValueOnce(new Error('Upload failed'));

      await expect(uploadApi.uploadFile(file)).rejects.toThrow('Upload failed');
    });
  });

  describe('AI Search Integration', () => {
    it('should perform search and return results', async () => {
      const apiClient = await import('./client');

      const searchResponse = {
        data: {
          success: true,
          data: {
            documents: [
              {
                id: 'result-1',
                title: 'Search Result',
                content: 'Relevant content',
                type: 'document',
                fileType: 'text',
                metadata: { score: 0.95 },
                tags: [],
                createdAt: '2024-01-01T00:00:00.000Z',
                updatedAt: '2024-01-01T00:00:00.000Z',
              },
            ],
            answer: 'This is the answer',
            sources: ['doc-1'],
          },
        },
      };

      vi.mocked(apiClient.default.post).mockResolvedValueOnce(searchResponse);

      const results = await aiApi.search({
        query: 'test query',
        topK: 10,
      });

      expect(results.documents).toHaveLength(1);
      expect(results.documents[0].title).toBe('Search Result');
      expect(results.documents[0].metadata.score).toBe(0.95);
    });

    it('should handle search errors', async () => {
      const apiClient = await import('./client');

      vi.mocked(apiClient.default.post).mockRejectedValueOnce(new Error('Search failed'));

      await expect(
        aiApi.search({ query: 'test', topK: 10 })
      ).rejects.toThrow('Search failed');
    });
  });

  describe('API Endpoint Correctness', () => {
    it('should use correct endpoints for all auth operations', async () => {
      const apiClient = await import('./client');

      vi.mocked(apiClient.default.post).mockResolvedValue({
        data: { success: true, data: { token: 'test', user: {} } },
      });
      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: { success: true, data: {} },
      });

      // Login
      await authApi.login({ username: 'test', password: 'test' }).catch(() => {});
      expect(apiClient.default.post).toHaveBeenCalledWith('/auth/login', expect.any(Object));

      // Register
      await authApi
        .register({ username: 'test', email: 'test@test.com', password: 'test' })
        .catch(() => {});
      expect(apiClient.default.post).toHaveBeenCalledWith('/auth/register', expect.any(Object));

      // Logout
      await authApi.logout().catch(() => {});
      expect(apiClient.default.post).toHaveBeenCalledWith('/auth/logout');

      // Get current user
      await authApi.getCurrentUser().catch(() => {});
      expect(apiClient.default.get).toHaveBeenCalledWith('/auth/me');
    });

    it('should use correct endpoints for all document operations', async () => {
      const apiClient = await import('./client');

      vi.mocked(apiClient.default.get).mockResolvedValue({ data: [] });
      vi.mocked(apiClient.default.post).mockResolvedValue({ data: {} });
      vi.mocked(apiClient.default.put).mockResolvedValue({ data: {} });
      vi.mocked(apiClient.default.delete).mockResolvedValue({ data: undefined });

      // Get all documents
      await documentsApi.getDocuments();
      expect(apiClient.default.get).toHaveBeenCalledWith('/documents');

      // Get single document
      await documentsApi.getDocument('doc-1');
      expect(apiClient.default.get).toHaveBeenCalledWith('/documents/doc-1');

      // Create document
      await documentsApi.createDocument({ title: 'Test', content: 'Test content' });
      expect(apiClient.default.post).toHaveBeenCalledWith('/documents', expect.any(Object));

      // Update document
      await documentsApi.updateDocument('doc-1', { title: 'Updated' });
      expect(apiClient.default.put).toHaveBeenCalledWith('/documents/doc-1', expect.any(Object));

      // Delete document
      await documentsApi.deleteDocument('doc-1');
      expect(apiClient.default.delete).toHaveBeenCalledWith('/documents/doc-1');
    });

    it('should use correct endpoints for all graph operations', async () => {
      const apiClient = await import('./client');

      vi.mocked(apiClient.default.get).mockResolvedValue({
        data: { success: true, data: { entities: [], relations: [], total: 0, count: 0 } },
      });
      vi.mocked(apiClient.default.post).mockResolvedValue({
        data: { success: true, data: {} },
      });

      // Get graph data
      await graphApi.getGraphData();
      expect(apiClient.default.get).toHaveBeenCalledWith(
        '/knowledge-graph/entities',
        expect.any(Object)
      );
      expect(apiClient.default.get).toHaveBeenCalledWith(
        '/knowledge-graph/relations',
        expect.any(Object)
      );

      // Get entities
      await graphApi.getEntities();
      expect(apiClient.default.get).toHaveBeenCalledWith(
        '/knowledge-graph/entities',
        expect.any(Object)
      );

      // Get relations
      await graphApi.getRelations();
      expect(apiClient.default.get).toHaveBeenCalledWith(
        '/knowledge-graph/relations',
        expect.any(Object)
      );

      // Build graph
      await graphApi.buildGraph('doc-1', '/path', '.pdf');
      expect(apiClient.default.post).toHaveBeenCalledWith(
        '/knowledge-graph/build',
        expect.any(Object)
      );

      // Get CKBs
      await graphApi.getCKBs();
      expect(apiClient.default.get).toHaveBeenCalledWith(
        '/knowledge-graph/ckb',
        expect.any(Object)
      );
    });

    it('should use correct endpoints for AI operations', async () => {
      const apiClient = await import('./client');

      vi.mocked(apiClient.default.post).mockResolvedValue({
        data: { success: true, data: { results: [], answer: '', sources: [] } },
      });

      // Search
      await aiApi.search({ query: 'test', topK: 10 });
      expect(apiClient.default.post).toHaveBeenCalledWith('/ai/search', expect.any(Object));

      // Summarize
      await aiApi.summarize('doc-1');
      expect(apiClient.default.post).toHaveBeenCalledWith('/ai/summarize', expect.any(Object));

      // Generate tags
      await aiApi.generateTags('content');
      expect(apiClient.default.post).toHaveBeenCalledWith('/ai/generate-tags', expect.any(Object));
    });

    it('should use correct endpoint for file upload', async () => {
      const apiClient = await import('./client');

      vi.mocked(apiClient.default.post).mockResolvedValue({
        data: { success: true, data: {} },
      });

      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      await uploadApi.uploadFile(file);

      expect(apiClient.default.post).toHaveBeenCalledWith('/upload', expect.any(FormData), {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: expect.any(Function),
      });
    });
  });

  describe('Authentication Token Persistence', () => {
    it('should persist token across multiple API calls', async () => {
      const apiClient = await import('./client');

      // Login to get token
      const loginResponse: { data: ApiResponse<AuthResponse> } = {
        data: {
          success: true,
          data: {
            token: 'persistent-token',
            user: {
              id: '1',
              username: 'user',
              email: 'user@test.com',
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          },
        },
      };

      vi.mocked(apiClient.default.post).mockResolvedValueOnce(loginResponse);

      await authApi.login({ username: 'user', password: 'pass' });

      expect(getAuthToken()).toBe('persistent-token');

      // Make multiple API calls - token should persist
      vi.mocked(apiClient.default.get).mockResolvedValue({ data: [] });

      await documentsApi.getDocuments();
      expect(getAuthToken()).toBe('persistent-token');

      await documentsApi.getDocuments();
      expect(getAuthToken()).toBe('persistent-token');

      await documentsApi.getDocuments();
      expect(getAuthToken()).toBe('persistent-token');
    });

    it('should clear token on logout', async () => {
      const apiClient = await import('./client');

      // Set token
      const loginResponse: { data: ApiResponse<AuthResponse> } = {
        data: {
          success: true,
          data: {
            token: 'temp-token',
            user: {
              id: '1',
              username: 'user',
              email: 'user@test.com',
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          },
        },
      };

      vi.mocked(apiClient.default.post).mockResolvedValueOnce(loginResponse);

      await authApi.login({ username: 'user', password: 'pass' });
      expect(getAuthToken()).toBe('temp-token');

      // Logout
      vi.mocked(apiClient.default.post).mockResolvedValueOnce({ data: {} });

      await authApi.logout();
      expect(getAuthToken()).toBeNull();
    });
  });

  describe('Error Handling Consistency', () => {
    it('should handle network errors consistently across all APIs', async () => {
      const apiClient = await import('./client');
      const networkError = new Error('Network error');

      // Auth API
      vi.mocked(apiClient.default.post).mockRejectedValueOnce(networkError);
      await expect(authApi.login({ username: 'test', password: 'test' })).rejects.toThrow(
        'Network error'
      );

      // Documents API
      vi.mocked(apiClient.default.get).mockRejectedValueOnce(networkError);
      await expect(documentsApi.getDocuments()).rejects.toThrow('Network error');

      // Graph API
      vi.mocked(apiClient.default.get).mockRejectedValueOnce(networkError);
      await expect(graphApi.getEntities()).rejects.toThrow('Network error');

      // AI API
      vi.mocked(apiClient.default.post).mockRejectedValueOnce(networkError);
      await expect(aiApi.search({ query: 'test', topK: 10 })).rejects.toThrow('Network error');

      // Upload API
      vi.mocked(apiClient.default.post).mockRejectedValueOnce(networkError);
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      await expect(uploadApi.uploadFile(file)).rejects.toThrow('Network error');
    });

    it('should handle 401 errors consistently', async () => {
      const apiClient = await import('./client');
      const unauthorizedError = new Error('Unauthorized');

      // All APIs should handle 401 the same way
      vi.mocked(apiClient.default.get).mockRejectedValueOnce(unauthorizedError);
      await expect(documentsApi.getDocuments()).rejects.toThrow('Unauthorized');

      vi.mocked(apiClient.default.get).mockRejectedValueOnce(unauthorizedError);
      await expect(graphApi.getEntities()).rejects.toThrow('Unauthorized');
    });
  });
});
