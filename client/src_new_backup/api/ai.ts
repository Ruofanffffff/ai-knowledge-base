import apiClient from './client';
import { ApiResponse, SearchRequest, SearchResult } from './types';

/**
 * AI API Service
 * 
 * Provides AI-powered features including:
 * - Document search with semantic understanding
 * - Document summarization
 * - Automatic tag generation
 * 
 * All endpoints use POST requests and return ApiResponse wrappers.
 */
export const aiApi = {
  /**
   * Search documents using AI
   * POST /api/ai/search
   * 
   * @param request - Search request with query and optional topK parameter
   * @returns SearchResult with documents, answer, and sources
   * @throws Error if search fails
   */
  async search(request: SearchRequest): Promise<SearchResult> {
    const response = await apiClient.post<ApiResponse<SearchResult>>(
      '/ai/search',
      request
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Search failed');
  },

  /**
   * Summarize document
   * POST /api/ai/summarize
   * 
   * @param docId - Document ID to summarize
   * @returns Summary text
   * @throws Error if summarization fails
   */
  async summarize(docId: string): Promise<string> {
    const response = await apiClient.post<ApiResponse<{ summary: string }>>(
      '/ai/summarize',
      { docId }
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data.summary;
    }
    
    throw new Error(response.data.error || 'Summarization failed');
  },

  /**
   * Generate tags for content
   * POST /api/ai/generate-tags
   * 
   * @param content - Content to generate tags for
   * @returns Array of generated tags
   * @throws Error if tag generation fails
   */
  async generateTags(content: string): Promise<string[]> {
    const response = await apiClient.post<ApiResponse<{ tags: string[] }>>(
      '/ai/generate-tags',
      { content }
    );
    
    if (response.data.success && response.data.data) {
      return response.data.data.tags;
    }
    
    throw new Error(response.data.error || 'Tag generation failed');
  },
};
