import apiClient from './client';
import { ApiResponse, BackendGraphData, BackendEntity, BackendRelation } from './types';

/**
 * Knowledge Graph API Service
 * 
 * Provides methods to interact with the knowledge graph backend endpoints:
 * - Get full graph data (entities + relations)
 * - Get filtered entities
 * - Get filtered relations
 * - Build graph from document
 * - Get CKBs (Contextualized Knowledge Blocks)
 * 
 * All methods use the configured apiClient which handles:
 * - Authentication (JWT token in headers)
 * - Error handling (via interceptors)
 * - Base URL configuration
 */
export const graphApi = {
  /**
   * Get full knowledge graph
   * GET /api/knowledge-graph/entities + GET /api/knowledge-graph/relations
   * 
   * Fetches both entities and relations in parallel and combines them
   * into a single BackendGraphData object.
   * 
   * @param params - Optional filtering parameters
   * @param params.minConfidence - Minimum confidence threshold (0-1)
   * @param params.entityType - Filter by entity type
   * @param params.relationType - Filter by relation type
   * @returns Promise<BackendGraphData> - Combined entities and relations
   */
  async getGraphData(params?: {
    minConfidence?: number;
    entityType?: string;
    relationType?: string;
  }): Promise<BackendGraphData> {
    // Get entities
    const entitiesResponse = await apiClient.get<ApiResponse<{
      entities: BackendEntity[];
      total: number;
      count: number;
    }>>('/knowledge-graph/entities', { params });
    
    // Get relations
    const relationsResponse = await apiClient.get<ApiResponse<{
      relations: BackendRelation[];
      total: number;
      count: number;
    }>>('/knowledge-graph/relations', { params });
    
    return {
      entities: entitiesResponse.data.data?.entities || [],
      relations: relationsResponse.data.data?.relations || [],
    };
  },

  /**
   * Get entities with filtering
   * GET /api/knowledge-graph/entities
   * 
   * Fetches entities from the knowledge graph with optional filtering
   * and pagination parameters.
   * 
   * @param params - Optional filtering and pagination parameters
   * @param params.type - Filter by entity type
   * @param params.minConfidence - Minimum confidence threshold (0-1)
   * @param params.skip - Number of entities to skip (pagination)
   * @param params.take - Number of entities to return (pagination)
   * @returns Promise<BackendEntity[]> - Array of entities
   */
  async getEntities(params?: {
    type?: string;
    minConfidence?: number;
    skip?: number;
    take?: number;
  }): Promise<BackendEntity[]> {
    const response = await apiClient.get<ApiResponse<{
      entities: BackendEntity[];
      total: number;
      count: number;
    }>>('/knowledge-graph/entities', { params });
    
    return response.data.data?.entities || [];
  },

  /**
   * Get relations with filtering
   * GET /api/knowledge-graph/relations
   * 
   * Fetches relations from the knowledge graph with optional filtering
   * and pagination parameters.
   * 
   * @param params - Optional filtering and pagination parameters
   * @param params.type - Filter by relation type
   * @param params.minConfidence - Minimum confidence threshold (0-1)
   * @param params.skip - Number of relations to skip (pagination)
   * @param params.take - Number of relations to return (pagination)
   * @returns Promise<BackendRelation[]> - Array of relations
   */
  async getRelations(params?: {
    type?: string;
    minConfidence?: number;
    skip?: number;
    take?: number;
  }): Promise<BackendRelation[]> {
    const response = await apiClient.get<ApiResponse<{
      relations: BackendRelation[];
      total: number;
      count: number;
    }>>('/knowledge-graph/relations', { params });
    
    return response.data.data?.relations || [];
  },

  /**
   * Build knowledge graph for document
   * POST /api/knowledge-graph/build
   * 
   * Triggers the knowledge graph building process for a specific document.
   * This will extract entities and relations from the document and add them
   * to the knowledge graph.
   * 
   * @param docId - Document ID
   * @param filePath - Path to the document file
   * @param fileType - Type of the file (e.g., '.pdf', '.md', '.txt')
   * @returns Promise<any> - Build result data
   */
  async buildGraph(docId: string, filePath: string, fileType: string): Promise<any> {
    const response = await apiClient.post<ApiResponse<any>>('/knowledge-graph/build', {
      docId,
      filePath,
      fileType,
    });
    
    return response.data.data;
  },

  /**
   * Get CKBs (Contextualized Knowledge Blocks)
   * GET /api/knowledge-graph/ckb
   * 
   * Fetches CKBs from the knowledge graph with optional pagination.
   * CKBs are contextualized knowledge blocks that represent structured
   * information extracted from documents.
   * 
   * @param params - Optional pagination parameters
   * @param params.skip - Number of CKBs to skip (pagination)
   * @param params.take - Number of CKBs to return (pagination)
   * @returns Promise<any[]> - Array of CKBs
   */
  async getCKBs(params?: {
    skip?: number;
    take?: number;
  }): Promise<any[]> {
    const response = await apiClient.get<ApiResponse<{
      ckbs: any[];
      total: number;
      count: number;
    }>>('/knowledge-graph/ckb', { params });
    
    return response.data.data?.ckbs || [];
  },
};
