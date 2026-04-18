import apiClient from '../api/client';
import type { ApiResponse, WikiHealth, WikiPage } from '../api/types';
import type { 
  KGStatus, 
  KGStatusResponse, 
  RebuildResponse 
} from '../types/kg-status';

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

export interface CommunityPost {
  id: number;
  userId: number;
  documentId: number;
  title: string;
  summary: string;
  coverImage: string | null;
  tags: string[];
  likes: number;
  viewCount: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  authorAvatar: string | null;
  isLiked: boolean;
  isBookmarked: boolean;
  isPublic: boolean;
  commentCount: number;
  contentImages?: string[];
}

export interface Comment {
  id: number;
  postId: number;
  userId: number;
  content: string;
  createdAt: string;
  authorName: string;
  authorAvatar: string | null;
}

export interface DigestItem {
  name: string;
  percentage: number;
  summary: string;
  keywords: string[];
  bodyIds: string[];
}

export interface KnowledgeDigest {
  items: DigestItem[];
  generatedAt: string;
}

// ============================================================================
// Cache Interface
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// ============================================================================
// API Service Class
// ============================================================================

class ApiService {
  // Cache for KG status responses (1 second TTL)
  private statusCache: Map<string, CacheEntry<ApiResponse<KGStatus>>> = new Map();
  private batchStatusCache: Map<string, CacheEntry<ApiResponse<KGStatus[]>>> = new Map();
  private readonly CACHE_TTL = 1000; // 1 second in milliseconds

  constructor() {
    // API base URL is configured in apiClient
  }

  /**
   * Get cached response if available and not expired
   */
  private getCachedResponse<T>(
    cache: Map<string, CacheEntry<ApiResponse<T>>>,
    key: string
  ): ApiResponse<T> | null {
    const entry = cache.get(key);
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.CACHE_TTL) {
      // Cache expired, remove it
      cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Set cached response
   */
  private setCachedResponse<T>(
    cache: Map<string, CacheEntry<ApiResponse<T>>>,
    key: string,
    data: ApiResponse<T>
  ): void {
    cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate cache for a specific key
   */
  private invalidateCache(docId: string): void {
    this.statusCache.delete(docId);
    // Also invalidate batch cache entries that might contain this docId
    // For simplicity, we clear the entire batch cache
    this.batchStatusCache.clear();
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

  async getKGGraph(): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.get('/kg/graph');
      if (response.data?.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, data: null, error: response.data?.error || 'Failed to fetch KG graph' };
    } catch (error) {
      return { success: false, data: null, error: this.handleError(error) };
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
   * Upload a document to the backend with real progress tracking
   */
  async uploadDocument(
    file: File,
    onProgress?: (progress: number, speed: number, estimatedTime: number) => void
  ): Promise<ApiResponse<Document | any>> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append('file', file);

      let lastLoaded = 0;
      let lastTime = Date.now();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          const progress = (e.loaded / e.total) * 100;
          
          // Calculate upload speed (bytes per second)
          const currentTime = Date.now();
          const timeDiff = (currentTime - lastTime) / 1000; // seconds
          const bytesDiff = e.loaded - lastLoaded;
          const speed = timeDiff > 0 ? bytesDiff / timeDiff : 0;
          
          // Calculate estimated time remaining (seconds)
          const bytesRemaining = e.total - e.loaded;
          const estimatedTime = speed > 0 ? bytesRemaining / speed : 0;
          
          lastLoaded = e.loaded;
          lastTime = currentTime;
          
          onProgress(progress, speed, estimatedTime);
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            
            // 后端现在返回 { success: true, document: {...} } 格式
            // 提取 document 字段作为数据
            if (response.success && response.document) {
              resolve({ success: true, data: response.document });
            }
            // 如果是重复文件检测响应，返回完整响应数据
            else if (response.duplicate) {
              resolve({ 
                success: false, 
                data: response,
                isDuplicate: true 
              });
            }
            else {
              resolve({ success: true, data: response });
            }
          } catch (error) {
            resolve({
              success: false,
              error: 'Failed to parse server response',
            });
          }
        } else {
          resolve({
            success: false,
            error: `Upload failed with status ${xhr.status}`,
          });
        }
      });

      // Handle errors
      xhr.addEventListener('error', () => {
        resolve({
          success: false,
          error: 'Network error occurred during upload',
        });
      });

      // Handle abort
      xhr.addEventListener('abort', () => {
        resolve({
          success: false,
          error: 'Upload was cancelled',
        });
      });

      // Get auth token from localStorage
      const token = localStorage.getItem('token');
      
      // Open connection and send request
      xhr.open('POST', `${apiClient.defaults.baseURL}/documents/upload`);
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.send(formData);
    });
  }

  /**
   * Resolve duplicate file upload
   */
  async resolveDuplicate(
    action: 'replace' | 'keep-both' | 'cancel',
    tempFileId: string,
    existingFileId?: string
  ): Promise<ApiResponse<Document>> {
    try {
      const response = await apiClient.post('/documents/upload/resolve-duplicate', {
        action,
        tempFileId,
        existingFileId,
      });

      if (response.data.success && response.data.document) {
        return { success: true, data: response.data.document };
      }

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

  /**
   * Update a document's metadata (e.g., title)
   */
  async updateDocument(
    documentId: string,
    data: { title?: string }
  ): Promise<ApiResponse<Document>> {
    try {
      const response = await apiClient.put(`/documents/${documentId}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  async batchDeleteDocuments(
    documentIds: string[]
  ): Promise<ApiResponse<{ deletedCount: number; failed: string[] }>> {
    try {
      const response = await apiClient.post('/documents/batch-delete', {
        ids: documentIds,
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

  // ==========================================================================
  // Knowledge Graph Status API Methods
  // ==========================================================================

  /**
   * Get KG build status for a single document
   */
  async getKGStatus(docId: string): Promise<ApiResponse<KGStatus>> {
    // Check cache first
    const cached = this.getCachedResponse(this.statusCache, docId);
    if (cached) {
      return cached;
    }

    try {
      const response = await apiClient.get<KGStatusResponse>(`/kg/status/${docId}?detailed=true`);
      
      let result: ApiResponse<KGStatus>;
      if (response.data.success) {
        result = { success: true, data: response.data.data };
      } else {
        result = {
          success: false,
          error: response.data.error || 'Failed to fetch KG status'
        };
      }

      // Cache the response
      this.setCachedResponse(this.statusCache, docId, result);
      return result;
    } catch (error) {
      const result = {
        success: false,
        error: this.handleError(error)
      };
      // Don't cache error responses
      return result;
    }
  }

  /**
   * Get KG build status for multiple documents
   */
  async getBatchKGStatus(docIds: string[]): Promise<ApiResponse<KGStatus[]>> {
    // Create cache key from sorted docIds
    const cacheKey = [...docIds].sort().join(',');
    
    // Check cache first
    const cached = this.getCachedResponse(this.batchStatusCache, cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Use individual status calls since batch endpoint may not be implemented yet
      const statusPromises = docIds.map(docId => this.getKGStatus(docId));
      const results = await Promise.all(statusPromises);
      
      const data = results
        .filter(r => r.success && r.data)
        .map(r => r.data!);
      
      const result: ApiResponse<KGStatus[]> = {
        success: true,
        data
      };

      // Cache the response
      this.setCachedResponse(this.batchStatusCache, cacheKey, result);
      return result;
    } catch (error) {
      const result = {
        success: false,
        data: [],
        error: this.handleError(error)
      };
      // Don't cache error responses
      return result;
    }
  }

  /**
   * Trigger KG rebuild for a document
   */
  async rebuildKG(docId: string): Promise<ApiResponse<string>> {
    try {
      const response = await apiClient.post<RebuildResponse>(`/kg/rebuild/${docId}`, {
        options: { async: true }
      });
      
      if (response.data.success) {
        // Invalidate cache for this document
        this.invalidateCache(docId);
        return { success: true, data: response.data.message || 'KG rebuild initiated' };
      } else {
        return {
          success: false,
          error: response.data.error || 'Failed to trigger KG rebuild'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error)
      };
    }
  }

  /**
   * Trigger KG build for a document (manual trigger)
   */
  async buildKG(docId: string, options?: { force?: boolean }): Promise<ApiResponse<string>> {
    try {
      const response = await apiClient.post(`/kg/build`, {
        docId,
        options: {
          force: options?.force || false,
          async: true
        }
      });
      
      if (response.data.success) {
        // Invalidate cache for this document
        this.invalidateCache(docId);
        return { 
          success: true, 
          data: response.data.data?.message || 'KG build initiated' 
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'Failed to trigger KG build'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error)
      };
    }
  }

  // ==========================================================================
  // Community API Methods
  // ==========================================================================

  /**
   * 发布文档到社区
   */
  async publishToCommunity(documentIds: string[], isPublic: boolean = false): Promise<ApiResponse<{
    published: Array<{ id: number; documentId: string; title: string }>;
    skipped: Array<{ documentId: string; reason: string }>;
  }>> {
    try {
      const response = await apiClient.post('/community/publish', { documentIds, isPublic });
      return { success: true, data: response.data.data || response.data };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  /**
   * 获取社区帖子列表
   */
  async getCommunityPosts(params?: {
    page?: number;
    limit?: number;
    sort?: 'latest' | 'hottest';
    filter?: 'mine' | 'liked';
    search?: string;
  }): Promise<ApiResponse<{
    posts: CommunityPost[];
    total: number;
    page: number;
    limit: number;
  }>> {
    try {
      const response = await apiClient.get('/community/posts', { params });
      return { success: true, data: response.data.data || response.data };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  /**
   * 获取社区帖子详情（含文档索引）
   */
  async getCommunityPostDetail(postId: number): Promise<ApiResponse<CommunityPost & {
    indexData: { indexedText: string; version: number; metadata: Record<string, any> } | null;
  }>> {
    try {
      const response = await apiClient.get(`/community/posts/${postId}`);
      return { success: true, data: response.data.data || response.data };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  /**
   * 切换帖子点赞状态
   */
  async togglePostLike(postId: number): Promise<ApiResponse<{
    liked: boolean;
    likes: number;
  }>> {
    try {
      const response = await apiClient.post(`/community/posts/${postId}/like`);
      return { success: true, data: response.data.data || response.data };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  /**
   * 取消发布帖子
   */
  async unpublishPost(postId: number): Promise<ApiResponse<void>> {
    try {
      await apiClient.delete(`/community/posts/${postId}`);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  /**
   * 更新帖子
   */
  async updatePost(postId: number, data: { title?: string; summary?: string }): Promise<ApiResponse<{ id: number; title?: string; summary?: string; updated_at: string }>> {
    try {
      const response = await apiClient.put(`/community/posts/${postId}`, data);
      return { success: true, data: response.data.data || response.data };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  /**
   * 批量删除帖子
   */
  async batchDeletePosts(postIds: number[]): Promise<ApiResponse<{ deleted: number[]; failed: { id: number; reason: string }[] }>> {
    try {
      const response = await apiClient.post('/community/posts/batch-delete', { postIds });
      return { success: true, data: response.data.data || response.data };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  /**
   * 切换帖子收藏状态
   */
  async togglePostBookmark(postId: number): Promise<ApiResponse<{ bookmarked: boolean }>> {
    try {
      const response = await apiClient.post(`/community/posts/${postId}/bookmark`);
      return { success: true, data: response.data.data || response.data };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  /**
   * 获取帖子评论列表
   */
  async getPostComments(postId: number): Promise<ApiResponse<{ comments: Comment[]; total: number }>> {
    try {
      const response = await apiClient.get(`/community/posts/${postId}/comments`);
      return { success: true, data: response.data.data || response.data };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  /**
   * 发表帖子评论
   */
  async addPostComment(postId: number, content: string): Promise<ApiResponse<Comment>> {
    try {
      const response = await apiClient.post(`/community/posts/${postId}/comments`, { content });
      return { success: true, data: response.data.data || response.data };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  // ==========================================================================
  // Knowledge Digest API Methods
  // ==========================================================================

  /**
   * 生成知识摘要
   * POST /api/knowledge-growth/digest
   */
  async generateDigest(): Promise<ApiResponse<KnowledgeDigest>> {
    try {
      const response = await apiClient.post('/knowledge-growth/digest');

      if (response.data?.success) {
        return { success: true, data: response.data.data };
      }

      return {
        success: false,
        error: response.data?.error || '生成失败，请重试',
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error),
      };
    }
  }

  async getWikiPages(params?: { q?: string; limit?: number; offset?: number }): Promise<ApiResponse<WikiPage[]>> {
    try {
      const response = await apiClient.get('/wiki/pages', { params });
      if (response.data?.success) {
        return { success: true, data: response.data.data || [] };
      }
      return { success: false, data: [], error: response.data?.error || '获取 Wiki 页面失败' };
    } catch (error) {
      return { success: false, data: [], error: this.handleError(error) };
    }
  }

  async compileWikiSource(input: {
    sourceType: string;
    sourceId?: string | null;
    sourceUrl?: string | null;
    url?: string | null;
    title?: string | null;
    rawContent?: string | null;
    force?: boolean;
  }): Promise<ApiResponse<any>> {
    try {
      const response = await apiClient.post('/wiki/compile-source', input);
      if (response.data?.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, error: response.data?.error || '提交编译失败' };
    } catch (error) {
      return { success: false, error: this.handleError(error) };
    }
  }

  async wikiHealth(): Promise<ApiResponse<WikiHealth>> {
    try {
      const response = await apiClient.get('/wiki/health');
      if (response.data?.success) {
        return { success: true, data: response.data.data };
      }
      return { success: false, error: response.data?.error || '健康检查失败' };
    } catch (error) {
      try {
        const fallback = await apiClient.get('/wiki/healthcheck');
        if (fallback.data?.success) {
          return { success: true, data: fallback.data.data };
        }
        return { success: false, error: fallback.data?.error || '健康检查失败' };
      } catch (e) {
        return { success: false, error: this.handleError(error) };
      }
    }
  }

}

// ============================================================================
// Export singleton instance
// ============================================================================

export const apiService = new ApiService();
export default apiService;
