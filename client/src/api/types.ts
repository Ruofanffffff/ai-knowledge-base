// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  isDuplicate?: boolean; // For duplicate file detection
}

// Authentication types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface User {
  id: string;
  username: string;
  name?: string;
  email: string;
  phone?: string;
  avatar?: string;
  role?: string;
  status?: string;
  createdAt: string;
}

// Document types
export interface Document {
  id: string;
  title: string;
  content: string;
  type: string;
  fileType: string;
  metadata: Record<string, any>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateDocumentRequest {
  title: string;
  content: string;
  type?: string;
  fileType?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  type?: string;
  fileType?: string;
  metadata?: Record<string, any>;
  tags?: string[];
}

// Knowledge Graph types (Backend format)
export interface BackendEntity {
  id: string;
  canonical_name: string;
  type: string;
  confidence: number;
  schemas: Array<{
    schema_name: string;
    confidence: number;
  }>;
  attributes?: Record<string, any>;
}

export interface BackendRelation {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  subtype?: string;
  weight?: number;
  confidence: number;
}

export interface BackendGraphData {
  entities: BackendEntity[];
  relations: BackendRelation[];
}

// Knowledge Graph types (Frontend format)
export interface GraphNode {
  id: string;
  label: string;
  type: string;
  confidence: number;
  schemas?: Array<{
    schema_name: string;
    confidence: number;
  }>;
  attributes?: Record<string, any>;
}

export interface GraphLink {
  id: string;
  source: string;
  target: string;
  relation: string;
  subtype?: string;
  weight?: number;
  confidence: number;
  description?: string | null; // Human-readable description
}

export interface FrontendGraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// AI Search types
export interface SearchRequest {
  query: string;
  topK?: number;
}

export interface SearchResult {
  documents: Document[];
  answer: string;
  sources: string[];
}

// File Upload types
export interface UploadResponse {
  document: Document;
  message: string;
}
