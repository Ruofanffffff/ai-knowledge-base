import apiClient from './client';
import { Document, CreateDocumentRequest, UpdateDocumentRequest } from './types';

/**
 * Document API Service
 * 
 * Provides functions for document management operations:
 * - getDocuments(): Fetch all documents
 * - getDocument(id): Fetch a single document by ID
 * - createDocument(data): Create a new document
 * - updateDocument(id, data): Update an existing document
 * - deleteDocument(id): Delete a document
 * 
 * All functions use the configured apiClient which handles:
 * - Authentication token injection
 * - Error handling and user notifications
 * - Request/response interceptors
 */
export const documentsApi = {
  /**
   * Get all documents
   * GET /api/documents
   */
  async getDocuments(): Promise<Document[]> {
    const response = await apiClient.get<Document[]>('/documents');
    return response.data;
  },

  /**
   * Get document by ID
   * GET /api/documents/:id
   */
  async getDocument(id: string): Promise<Document> {
    const response = await apiClient.get<Document>(`/documents/${id}`);
    return response.data;
  },

  /**
   * Create new document
   * POST /api/documents
   */
  async createDocument(data: CreateDocumentRequest): Promise<Document> {
    const response = await apiClient.post<Document>('/documents', data);
    return response.data;
  },

  /**
   * Update document
   * PUT /api/documents/:id
   */
  async updateDocument(id: string, data: UpdateDocumentRequest): Promise<Document> {
    const response = await apiClient.put<Document>(`/documents/${id}`, data);
    return response.data;
  },

  /**
   * Delete document
   * DELETE /api/documents/:id
   */
  async deleteDocument(id: string): Promise<void> {
    await apiClient.delete(`/documents/${id}`);
  },
};
