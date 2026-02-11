import apiClient from '../api/client';
import type { ApiResponse } from '../api/types';

// ============================================================================
// Type Definitions
// ============================================================================

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  color?: string;
  x?: number;
  y?: number;
  properties?: Record<string, any>;
  confidence?: number;
  schemas?: Array<{
    schema_name: string;
    confidence: number;
  }>;
}

export interface GraphLink {
  source: string;
  target: string;
  relation: string;
  type?: string;
  weight?: number;
  confidence?: number;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface Document {
  id: string;
  name: string;
  title?: string;
  uploadDate: string;
  status: 'processing' | 'completed' | 'failed';
  size?: number;
  type?: string;
  fileType?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface ChatMessage {
  id: string | number;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  sources?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  status: 'available' | 'unavailable';
  description?: string;
}

export interface Recommendation {
  id: string;
  type: string;
  content: string;
  confidence: number;
  relatedEntities: string[];
}

// ============================================================================
// API Service Class
// ============================================================================

class ApiService {
  private baseURL: string;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
  }

  /**
   * Handle API errors and return user-friendly error messages
   */
  private handleError(error: any): string {
    if (error.response) {
      // Server responded with error status
      return error.response.data?.message || error.response.data?.error || error.response.statusText;
    } else if (error.request) {
      // Request made but no response received
      return 'No response from server. Please check your connection.';
    } else {
      // Error setting up the request
      return error.message || 'An unexpected error occurred';
    }
  }

  // ==========================================================================
  // Graph API Methods
  // ==========================================================================

  /**
   * Fetch knowledge graph nodes from the backend
   */
  async getGraphNodes(): Promise<ApiResponse<GraphNode[]>> {
    try {
      const response = await apiClient.get('/knowledge-graph');
      
      // Transform backend format to frontend format
      if (response.data && response.data.nodes) {
        const nodes = response.data.nodes.map((node: any) => ({
          id: node.id || node.entity_id || String(node.id),
          label: node.label || node.name || node.canonical_name || 'Unnamed',
          type: node.type || 'default',
          color: node.color,
          x: node.x,
          y: node.y,
          properties: node.properties || node.attributes,
          confidence: node.confidence,
          schemas: node.schemas,
        }));
        
        return { success: true, data: nodes };
      }
      
      return { success: true, data: [] };
    } catch (error) {
      return { 
        success: false, 
        data: [], 
        error: this.handleError(error) 
      };
    }
  }

  /**
   * Fetch knowledge graph links from the backend
   */
  async getGraphLinks(): Promise<ApiResponse<GraphLink[]>> {
    try {
      const response = await apiClient.get('/knowledge-graph');
      
      // Transform backend format to frontend format
      if (response.data && response.data.links) {
        const links = response.data.links.map((link: any) => ({
          source: link.source || link.source_id || link.source_entity_id,
          target: link.target || link.target_id || link.target_entity_id,
          relation: link.relation || link.type || link.relation_type || 'related',
          type: link.type || link.subtype,
          weight: link.weight,
          confidence: link.confidence,
        }));
        
        return { success: true, data: links };
      }
      
      return { success: true, data: [] };
    } catch (error) {
      return { 
        success: false, 
        data: [], 
        error: this.handleError(error) 
      };
    }
  }

  /**
   * Fetch complete graph data (nodes and links together)
   */
  async getGraphData(): Promise<ApiResponse<GraphData>> {
    try {
      const [nodesResponse, linksResponse] = await Promise.all([
        this.getGraphNodes(),
        this.getGraphLinks(),
      ]);

      if (!nodesResponse.success || !linksResponse.success) {
        return {
          success: false,
          data: { nodes: [], links: [] },
          error: nodesResponse.error || linksResponse.error,
        };
      }

      return {
        success: true,
        data: {
          nodes: nodesResponse.data || [],
          links: linksResponse.data || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        data: { nodes: [], links: [] },
        error: this.handleError(error),
      };
    }
  }

  // ==========================================================================
  // Document API Methods
  // ==========================================================================

  /**
   * Fetch list of documents from the backend
   */
  async getDocuments(): Promise<ApiResponse<Document[]>> {
    try {
      const response = await apiClient.get('/documents');
      
      // Transform backend format to frontend format
      if (response.data) {
        const documents = Array.isArray(response.data) ? response.data : response.data.documents || [];
        
        const transformedDocs = documents.map((doc: any) => ({
          id: doc.id || doc._id || String(doc.id),
          name: doc.name || doc.title || doc.filename || 'Untitled',
          title: doc.title || doc.name,
          uploadDate: doc.uploadDate || doc.createdAt || doc.created_at || new Date().toISOString(),
          status: doc.status || 'completed',
          size: doc.size || doc.fileSize,
          type: doc.type || doc.documentType,
          fileType: doc.fileType || doc.file_type,
          metadata: doc.metadata,
          tags: doc.tags || [],
        }));
        
        return { success: true, data: transformedDocs };
      }
      
      return { success: true, data: [] };
    } catch (error) {
      return { 
        success: false, 
        data: [], 
        error: this.handleError(error) 
      };
    }
  }

  /**
   * Upload a document to the backend
   */
  async uploadDocument(file: File): Promise<ApiResponse<Document>> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  /**
   * Delete a document from the backend
   */
  async deleteDocument(documentId: string): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/documents/${documentId}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  // ==========================================================================
  // Chat API Methods
  // ==========================================================================

  /**
   * Fetch chat history for a specific session or all messages
   */
  async getChatHistory(sessionId?: string): Promise<ApiResponse<ChatMessage[]>> {
    try {
      const url = sessionId ? `/chat/history/${sessionId}` : '/chat/history';
      const response = await apiClient.get(url);
      
      const messages = Array.isArray(response.data) ? response.data : response.data.messages || [];
      
      return { success: true, data: messages };
    } catch (error) {
      return { 
        success: false, 
        data: [], 
        error: this.handleError(error) 
      };
    }
  }

  /**
   * Fetch list of chat sessions
   */
  async getChatSessions(): Promise<ApiResponse<ChatSession[]>> {
    try {
      const response = await apiClient.get('/chat/sessions');
      
      const sessions = Array.isArray(response.data) ? response.data : response.data.sessions || [];
      
      return { success: true, data: sessions };
    } catch (error) {
      return { 
        success: false, 
        data: [], 
        error: this.handleError(error) 
      };
    }
  }

  /**
   * Send a chat message to the backend
   */
  async sendChatMessage(
    message: string, 
    sessionId?: string
  ): Promise<ApiResponse<ChatMessage>> {
    try {
      const response = await apiClient.post('/chat/message', {
        message,
        sessionId,
      });

      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  // ==========================================================================
  // Models API Methods
  // ==========================================================================

  /**
   * Fetch available AI models from the backend
   */
  async getModels(): Promise<ApiResponse<Model[]>> {
    try {
      const response = await apiClient.get('/models');
      
      const models = Array.isArray(response.data) ? response.data : response.data.models || [];
      
      return { success: true, data: models };
    } catch (error) {
      return { 
        success: false, 
        data: [], 
        error: this.handleError(error) 
      };
    }
  }

  // ==========================================================================
  // Recommendations API Methods
  // ==========================================================================

  /**
   * Fetch recommendations from the backend
   */
  async getRecommendations(): Promise<ApiResponse<Recommendation[]>> {
    try {
      const response = await apiClient.get('/recommendations');
      
      const recommendations = Array.isArray(response.data) 
        ? response.data 
        : response.data.recommendations || [];
      
      return { success: true, data: recommendations };
    } catch (error) {
      return { 
        success: false, 
        data: [], 
        error: this.handleError(error) 
      };
    }
  }
}

// ============================================================================
// Export singleton instance
// ============================================================================

export const apiService = new ApiService();
export default apiService;
