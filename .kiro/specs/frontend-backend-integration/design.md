# Frontend-Backend Integration Design

## 1. Overview

This design document outlines the technical approach for integrating the Figma-based React frontend with the existing Express.js backend. The integration focuses on adapting the frontend to match backend API endpoints, implementing JWT authentication, creating data transformation layers, and establishing robust error handling mechanisms.

### 1.1 Design Goals

- Remove all Supabase dependencies from the frontend
- Implement JWT-based authentication with localStorage
- Create modular API service layer for all backend endpoints
- Build data transformation utilities for backend-to-frontend format conversion
- Implement auto-refresh functionality with polling
- Design custom error modal component for user-friendly error notifications
- Ensure type safety with TypeScript interfaces throughout

### 1.2 Technology Stack

**Frontend:**
- React 18.3.1
- TypeScript 5.0+
- Vite 6.3.5
- Motion (Framer Motion) for animations
- Radix UI for accessible components
- D3.js for knowledge graph visualization

**Backend:**
- Express.js
- JWT for authentication
- SQLite database
- Existing KG pipeline and services

## 2. Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     React Frontend                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pages/     │  │  Components  │  │   Hooks      │      │
│  │   Routes     │  │              │  │              │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │              │
│         └─────────────────┴──────────────────┘              │
│                           │                                 │
│  ┌────────────────────────┴────────────────────────┐       │
│  │          API Service Layer                      │       │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │       │
│  │  │  Auth    │ │ Document │ │   Graph  │       │       │
│  │  │ Service  │ │ Service  │ │ Service  │       │       │
│  │  └──────────┘ └──────────┘ └──────────┘       │       │
│  └────────────────────────┬────────────────────────┘       │
│                           │                                 │
│  ┌────────────────────────┴────────────────────────┐       │
│  │       HTTP Client (Axios/Fetch)                 │       │
│  │  - Request Interceptors (Auth Token)            │       │
│  │  - Response Interceptors (Error Handling)       │       │
│  └────────────────────────┬────────────────────────┘       │
└───────────────────────────┼─────────────────────────────────┘
                            │
                    HTTP/HTTPS (JSON)
                            │
┌───────────────────────────┼─────────────────────────────────┐
│                           │                                 │
│  ┌────────────────────────┴────────────────────────┐       │
│  │          Express.js Backend                     │       │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐       │       │
│  │  │  Auth    │ │ Document │ │    KG    │       │       │
│  │  │  Routes  │ │  Routes  │ │  Routes  │       │       │
│  │  └──────────┘ └──────────┘ └──────────┘       │       │
│  └─────────────────────────────────────────────────┘       │
│                     Express Backend                         │
└─────────────────────────────────────────────────────────────┘
```


### 2.2 Directory Structure

```
client/src/
├── api/                      # API service layer
│   ├── client.ts            # HTTP client configuration
│   ├── auth.ts              # Authentication API
│   ├── documents.ts         # Document management API
│   ├── graph.ts             # Knowledge graph API
│   ├── ai.ts                # AI features API
│   ├── upload.ts            # File upload API
│   └── types.ts             # API response types
├── components/              # Reusable components
│   ├── ErrorModal/          # Custom error modal
│   │   ├── ErrorModal.tsx
│   │   └── ErrorModal.test.tsx
│   ├── LoadingSpinner/
│   └── ...
├── contexts/                # React contexts
│   ├── AuthContext.tsx      # Authentication context
│   └── ErrorContext.tsx     # Error handling context
├── hooks/                   # Custom React hooks
│   ├── useAuth.ts           # Authentication hook
│   ├── useDocuments.ts      # Document management hook
│   ├── useGraph.ts          # Knowledge graph hook
│   └── useAutoRefresh.ts    # Auto-refresh hook
├── pages/                   # Page components
│   ├── Login/
│   ├── Dashboard/
│   ├── Documents/
│   └── KnowledgeGraph/
├── utils/                   # Utility functions
│   ├── transformers.ts      # Data transformation utilities
│   ├── storage.ts           # localStorage utilities
│   └── validators.ts        # Input validation
├── types/                   # TypeScript type definitions
│   ├── api.ts               # API types
│   ├── domain.ts            # Domain model types
│   └── ui.ts                # UI component types
└── config/                  # Configuration
    └── constants.ts         # App constants
```

## 3. Components and Interfaces

### 3.1 HTTP Client Configuration

The HTTP client will be configured with interceptors for authentication and error handling.

**File: `client/src/api/client.ts`**

```typescript
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { getAuthToken, clearAuthToken } from '../utils/storage';
import { showErrorModal } from '../contexts/ErrorContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = getAuthToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      
      // Handle 401 Unauthorized - Token expired or invalid
      if (status === 401) {
        clearAuthToken();
        window.location.href = '/login';
        showErrorModal({
          title: 'Session Expired',
          message: 'Your session has expired. Please log in again.',
          type: 'warning',
        });
      }
      
      // Handle 403 Forbidden
      else if (status === 403) {
        showErrorModal({
          title: 'Access Denied',
          message: 'You do not have permission to perform this action.',
          type: 'error',
        });
      }
      
      // Handle 404 Not Found
      else if (status === 404) {
        showErrorModal({
          title: 'Not Found',
          message: 'The requested resource was not found.',
          type: 'warning',
        });
      }
      
      // Handle 500 Server Error
      else if (status >= 500) {
        showErrorModal({
          title: 'Server Error',
          message: 'An unexpected server error occurred. Please try again later.',
          type: 'error',
        });
      }
    } else if (error.request) {
      // Network error
      showErrorModal({
        title: 'Network Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
        type: 'error',
      });
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
```


### 3.2 TypeScript Type Definitions

**File: `client/src/api/types.ts`**

```typescript
// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
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
  email: string;
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
```


### 3.3 Authentication Service

**File: `client/src/api/auth.ts`**

```typescript
import apiClient from './client';
import { ApiResponse, LoginRequest, RegisterRequest, AuthResponse, User } from './types';
import { setAuthToken, clearAuthToken } from '../utils/storage';

export const authApi = {
  /**
   * Login user
   * POST /api/auth/login
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/login',
      credentials
    );
    
    if (response.data.success && response.data.data) {
      const { token, user } = response.data.data;
      setAuthToken(token);
      return { token, user };
    }
    
    throw new Error(response.data.error || 'Login failed');
  },

  /**
   * Register new user
   * POST /api/auth/register
   */
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/register',
      userData
    );
    
    if (response.data.success && response.data.data) {
      const { token, user } = response.data.data;
      setAuthToken(token);
      return { token, user };
    }
    
    throw new Error(response.data.error || 'Registration failed');
  },

  /**
   * Logout user
   * POST /api/auth/logout
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearAuthToken();
    }
  },

  /**
   * Get current user
   * GET /api/auth/me
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Failed to get user');
  },

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem('auth_token');
    return !!token;
  },
};
```

### 3.4 Document Service

**File: `client/src/api/documents.ts`**

```typescript
import apiClient from './client';
import { ApiResponse, Document, CreateDocumentRequest, UpdateDocumentRequest } from './types';

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
```


### 3.5 Knowledge Graph Service

**File: `client/src/api/graph.ts`**

```typescript
import apiClient from './client';
import { ApiResponse, BackendGraphData, BackendEntity, BackendRelation } from './types';

export const graphApi = {
  /**
   * Get full knowledge graph
   * GET /api/knowledge-graph
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
```

### 3.6 AI Service

**File: `client/src/api/ai.ts`**

```typescript
import apiClient from './client';
import { ApiResponse, SearchRequest, SearchResult } from './types';

export const aiApi = {
  /**
   * Search documents using AI
   * POST /api/ai/search
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
```


### 3.7 File Upload Service

**File: `client/src/api/upload.ts`**

```typescript
import apiClient from './client';
import { Document, UploadResponse } from './types';

export const uploadApi = {
  /**
   * Upload file
   * POST /api/upload
   */
  async uploadFile(
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await apiClient.post<Document>('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });
    
    return response.data;
  },
};
```

## 4. Data Models

### 4.1 Data Transformation Layer

The transformation layer converts backend data formats to frontend-expected formats.

**File: `client/src/utils/transformers.ts`**

```typescript
import {
  BackendEntity,
  BackendRelation,
  BackendGraphData,
  GraphNode,
  GraphLink,
  FrontendGraphData,
} from '../api/types';

/**
 * Transform backend entity to frontend node
 */
export function transformEntityToNode(entity: BackendEntity): GraphNode {
  return {
    id: entity.id,
    label: entity.canonical_name,
    type: entity.type,
    confidence: entity.confidence,
    schemas: entity.schemas,
    attributes: entity.attributes,
  };
}

/**
 * Transform backend relation to frontend link
 */
export function transformRelationToLink(relation: BackendRelation): GraphLink {
  return {
    id: relation.id,
    source: relation.source_id,
    target: relation.target_id,
    relation: relation.type,
    subtype: relation.subtype,
    weight: relation.weight,
    confidence: relation.confidence,
  };
}

/**
 * Transform backend graph data to frontend format
 */
export function transformGraphData(backendData: BackendGraphData): FrontendGraphData {
  return {
    nodes: backendData.entities.map(transformEntityToNode),
    links: backendData.relations.map(transformRelationToLink),
  };
}

/**
 * Transform frontend node to backend entity (for updates)
 */
export function transformNodeToEntity(node: GraphNode): Partial<BackendEntity> {
  return {
    id: node.id,
    canonical_name: node.label,
    type: node.type,
    confidence: node.confidence,
    schemas: node.schemas,
    attributes: node.attributes,
  };
}

/**
 * Transform frontend link to backend relation (for updates)
 */
export function transformLinkToRelation(link: GraphLink): Partial<BackendRelation> {
  return {
    id: link.id,
    source_id: link.source,
    target_id: link.target,
    type: link.relation,
    subtype: link.subtype,
    weight: link.weight,
    confidence: link.confidence,
  };
}
```

### 4.2 Storage Utilities

**File: `client/src/utils/storage.ts`**

```typescript
const AUTH_TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

/**
 * Get authentication token from localStorage
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Set authentication token in localStorage
 */
export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * Clear authentication token from localStorage
 */
export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Get user data from localStorage
 */
export function getUserData(): any | null {
  const data = localStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
}

/**
 * Set user data in localStorage
 */
export function setUserData(user: any): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
```


## 5. Authentication Flow

### 5.1 Authentication Context

**File: `client/src/contexts/AuthContext.tsx`**

```typescript
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../api/auth';
import { User, LoginRequest, RegisterRequest } from '../api/types';
import { setUserData, getUserData, clearAuthToken, isAuthenticated } from '../utils/storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      if (isAuthenticated()) {
        try {
          const userData = await authApi.getCurrentUser();
          setUser(userData);
          setUserData(userData);
        } catch (error) {
          console.error('Failed to get current user:', error);
          clearAuthToken();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    const { user: userData } = await authApi.login(credentials);
    setUser(userData);
    setUserData(userData);
  };

  const register = async (userData: RegisterRequest) => {
    const { user: newUser } = await authApi.register(userData);
    setUser(newUser);
    setUserData(newUser);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    const userData = await authApi.getCurrentUser();
    setUser(userData);
    setUserData(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
```

### 5.2 Protected Route Component

**File: `client/src/components/ProtectedRoute.tsx`**

```typescript
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
```

## 6. Error Handling

### 6.1 Error Context

**File: `client/src/contexts/ErrorContext.tsx`**

```typescript
import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ErrorModalData {
  title: string;
  message: string;
  type: 'error' | 'warning' | 'info';
  details?: string;
}

interface ErrorContextType {
  error: ErrorModalData | null;
  showError: (error: ErrorModalData) => void;
  clearError: () => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<ErrorModalData | null>(null);

  const showError = (errorData: ErrorModalData) => {
    setError(errorData);
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <ErrorContext.Provider value={{ error, showError, clearError }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useError() {
  const context = useContext(ErrorContext);
  if (context === undefined) {
    throw new Error('useError must be used within an ErrorProvider');
  }
  return context;
}

// Global function for showing errors from interceptors
let globalShowError: ((error: ErrorModalData) => void) | null = null;

export function setGlobalErrorHandler(handler: (error: ErrorModalData) => void) {
  globalShowError = handler;
}

export function showErrorModal(error: ErrorModalData) {
  if (globalShowError) {
    globalShowError(error);
  }
}
```


### 6.2 Error Modal Component

**File: `client/src/components/ErrorModal/ErrorModal.tsx`**

```typescript
import React, { useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import { useError } from '../../contexts/ErrorContext';
import './ErrorModal.css';

export function ErrorModal() {
  const { error, clearError } = useError();

  // Auto-dismiss info messages after 5 seconds
  useEffect(() => {
    if (error && error.type === 'info') {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const getIcon = () => {
    switch (error?.type) {
      case 'error':
        return (
          <svg className="error-icon error" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'warning':
        return (
          <svg className="error-icon warning" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 20h20L12 2z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            <path d="M12 9v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      case 'info':
        return (
          <svg className="error-icon info" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
            <path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {error && (
        <Dialog.Root open={!!error} onOpenChange={clearError}>
          <Dialog.Portal>
            <Dialog.Overlay asChild>
              <motion.div
                className="error-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="error-modal-content"
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                <div className="error-modal-header">
                  {getIcon()}
                  <Dialog.Title className="error-modal-title">
                    {error.title}
                  </Dialog.Title>
                </div>
                
                <Dialog.Description className="error-modal-message">
                  {error.message}
                </Dialog.Description>
                
                {error.details && (
                  <details className="error-modal-details">
                    <summary>Technical Details</summary>
                    <pre>{error.details}</pre>
                  </details>
                )}
                
                <div className="error-modal-actions">
                  <Dialog.Close asChild>
                    <button className="error-modal-button">
                      {error.type === 'info' ? 'OK' : 'Close'}
                    </button>
                  </Dialog.Close>
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </AnimatePresence>
  );
}
```

**File: `client/src/components/ErrorModal/ErrorModal.css`**

```css
.error-modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9998;
}

.error-modal-content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  z-index: 9999;
}

.error-modal-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.error-icon {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
}

.error-icon.error {
  color: #ef4444;
}

.error-icon.warning {
  color: #f59e0b;
}

.error-icon.info {
  color: #3b82f6;
}

.error-modal-title {
  font-size: 20px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.error-modal-message {
  font-size: 14px;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 20px;
}

.error-modal-details {
  background: #f3f4f6;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 20px;
}

.error-modal-details summary {
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
  user-select: none;
}

.error-modal-details pre {
  margin-top: 8px;
  font-size: 12px;
  color: #6b7280;
  white-space: pre-wrap;
  word-break: break-word;
}

.error-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.error-modal-button {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  background: #3b82f6;
  color: white;
}

.error-modal-button:hover {
  background: #2563eb;
}

.error-modal-button:active {
  transform: scale(0.98);
}
```


## 7. Auto-Refresh Functionality

### 7.1 Auto-Refresh Hook

**File: `client/src/hooks/useAutoRefresh.ts`**

```typescript
import { useEffect, useRef, useCallback } from 'react';

interface UseAutoRefreshOptions {
  enabled?: boolean;
  interval?: number; // in milliseconds
  onRefresh: () => Promise<void> | void;
}

/**
 * Hook for auto-refreshing data at specified intervals
 * @param options Configuration options
 * @returns Object with manual refresh function and pause/resume controls
 */
export function useAutoRefresh({
  enabled = true,
  interval = 30000, // Default: 30 seconds
  onRefresh,
}: UseAutoRefreshOptions) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPausedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (isPausedRef.current) return;
    
    try {
      await onRefresh();
    } catch (error) {
      console.error('Auto-refresh failed:', error);
    }
  }, [onRefresh]);

  const pause = useCallback(() => {
    isPausedRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    isPausedRef.current = false;
    if (enabled && !intervalRef.current) {
      intervalRef.current = setInterval(refresh, interval);
    }
  }, [enabled, interval, refresh]);

  const manualRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  useEffect(() => {
    if (enabled && !isPausedRef.current) {
      intervalRef.current = setInterval(refresh, interval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, interval, refresh]);

  return {
    refresh: manualRefresh,
    pause,
    resume,
  };
}
```

### 7.2 Usage Example in Documents Hook

**File: `client/src/hooks/useDocuments.ts`**

```typescript
import { useState, useCallback } from 'react';
import { documentsApi } from '../api/documents';
import { Document, CreateDocumentRequest, UpdateDocumentRequest } from '../api/types';
import { useAutoRefresh } from './useAutoRefresh';

export function useDocuments(autoRefresh = true) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await documentsApi.getDocuments();
      setDocuments(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createDocument = useCallback(async (data: CreateDocumentRequest) => {
    const newDoc = await documentsApi.createDocument(data);
    setDocuments((prev) => [newDoc, ...prev]);
    return newDoc;
  }, []);

  const updateDocument = useCallback(async (id: string, data: UpdateDocumentRequest) => {
    const updated = await documentsApi.updateDocument(id, data);
    setDocuments((prev) =>
      prev.map((doc) => (doc.id === id ? updated : doc))
    );
    return updated;
  }, []);

  const deleteDocument = useCallback(async (id: string) => {
    await documentsApi.deleteDocument(id);
    setDocuments((prev) => prev.filter((doc) => doc.id !== id));
  }, []);

  // Auto-refresh every 30 seconds
  const { refresh, pause, resume } = useAutoRefresh({
    enabled: autoRefresh,
    interval: 30000,
    onRefresh: fetchDocuments,
  });

  return {
    documents,
    isLoading,
    error,
    fetchDocuments,
    createDocument,
    updateDocument,
    deleteDocument,
    refresh,
    pauseAutoRefresh: pause,
    resumeAutoRefresh: resume,
  };
}
```

### 7.3 Usage Example in Knowledge Graph Hook

**File: `client/src/hooks/useGraph.ts`**

```typescript
import { useState, useCallback } from 'react';
import { graphApi } from '../api/graph';
import { BackendGraphData, FrontendGraphData } from '../api/types';
import { transformGraphData } from '../utils/transformers';
import { useAutoRefresh } from './useAutoRefresh';

export function useGraph(autoRefresh = true) {
  const [graphData, setGraphData] = useState<FrontendGraphData>({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchGraphData = useCallback(async (params?: {
    minConfidence?: number;
    entityType?: string;
    relationType?: string;
  }) => {
    setIsLoading(true);
    setError(null);
    try {
      const backendData = await graphApi.getGraphData(params);
      const frontendData = transformGraphData(backendData);
      setGraphData(frontendData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Auto-refresh every 60 seconds (graph data changes less frequently)
  const { refresh, pause, resume } = useAutoRefresh({
    enabled: autoRefresh,
    interval: 60000,
    onRefresh: fetchGraphData,
  });

  return {
    graphData,
    isLoading,
    error,
    fetchGraphData,
    refresh,
    pauseAutoRefresh: pause,
    resumeAutoRefresh: resume,
  };
}
```


## 8. State Management Approach

### 8.1 State Management Strategy

The application uses a combination of:

1. **React Context** for global state (auth, errors)
2. **Custom Hooks** for feature-specific state (documents, graph)
3. **Local Component State** for UI-specific state

This approach provides:
- Simple, predictable state management
- No external dependencies (Redux, MobX)
- Easy to test and maintain
- Sufficient for the application's complexity

### 8.2 State Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    App Component                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ AuthProvider │  │ErrorProvider │  │ ErrorModal   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────┬───────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
    ┌─────────▼─────────┐         ┌─────────▼─────────┐
    │  Documents Page   │         │  Graph Page       │
    │  ┌─────────────┐  │         │  ┌─────────────┐  │
    │  │useDocuments │  │         │  │  useGraph   │  │
    │  │   Hook      │  │         │  │    Hook     │  │
    │  └─────────────┘  │         │  └─────────────┘  │
    │  ┌─────────────┐  │         │  ┌─────────────┐  │
    │  │useAutoRefresh│ │         │  │useAutoRefresh│ │
    │  └─────────────┘  │         │  └─────────────┘  │
    └───────────────────┘         └───────────────────┘
```

### 8.3 Caching Strategy

**In-Memory Caching:**
- Documents list cached in `useDocuments` hook
- Graph data cached in `useGraph` hook
- Cache invalidated on mutations (create, update, delete)
- Auto-refresh updates cache periodically

**localStorage Caching:**
- Auth token persisted across sessions
- User data persisted for quick initialization
- No sensitive data stored (only user ID, username, email)

## 9. Environment Configuration

### 9.1 Environment Variables

**File: `client/.env.local` (Development)**

```env
# API Configuration
VITE_API_BASE_URL=http://localhost:3000/api

# Feature Flags
VITE_ENABLE_AUTO_REFRESH=true
VITE_AUTO_REFRESH_INTERVAL=30000

# Debug Mode
VITE_DEBUG_MODE=true
```

**File: `client/.env.production` (Production)**

```env
# API Configuration
VITE_API_BASE_URL=https://api.yourdomain.com/api

# Feature Flags
VITE_ENABLE_AUTO_REFRESH=true
VITE_AUTO_REFRESH_INTERVAL=60000

# Debug Mode
VITE_DEBUG_MODE=false
```

### 9.2 Configuration Constants

**File: `client/src/config/constants.ts`**

```typescript
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  TIMEOUT: 30000,
};

export const AUTO_REFRESH_CONFIG = {
  ENABLED: import.meta.env.VITE_ENABLE_AUTO_REFRESH === 'true',
  DOCUMENTS_INTERVAL: parseInt(import.meta.env.VITE_AUTO_REFRESH_INTERVAL || '30000'),
  GRAPH_INTERVAL: 60000, // 1 minute
};

export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  DOCUMENTS: '/documents',
  KNOWLEDGE_GRAPH: '/knowledge-graph',
  AI_SEARCH: '/ai-search',
};
```

## 10. Testing Strategy

### 10.1 Testing Approach

The testing strategy follows a dual approach:

1. **Unit Tests**: Test individual functions, utilities, and components
2. **Integration Tests**: Test API services, hooks, and component interactions

### 10.2 Unit Testing

**Test Coverage:**
- Data transformation utilities (transformers.ts)
- Storage utilities (storage.ts)
- API service functions
- Custom hooks
- React components

**Example: Transformer Tests**

**File: `client/src/utils/transformers.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import {
  transformEntityToNode,
  transformRelationToLink,
  transformGraphData,
} from './transformers';
import { BackendEntity, BackendRelation } from '../api/types';

describe('transformEntityToNode', () => {
  it('should transform backend entity to frontend node', () => {
    const entity: BackendEntity = {
      id: 'entity-1',
      canonical_name: '人工智能',
      type: 'ConceptEntity',
      confidence: 0.95,
      schemas: [{ schema_name: 'Concept', confidence: 0.92 }],
      attributes: { category: 'technology' },
    };

    const node = transformEntityToNode(entity);

    expect(node).toEqual({
      id: 'entity-1',
      label: '人工智能',
      type: 'ConceptEntity',
      confidence: 0.95,
      schemas: [{ schema_name: 'Concept', confidence: 0.92 }],
      attributes: { category: 'technology' },
    });
  });

  it('should handle entities without optional fields', () => {
    const entity: BackendEntity = {
      id: 'entity-2',
      canonical_name: 'Test',
      type: 'TestEntity',
      confidence: 0.8,
      schemas: [],
    };

    const node = transformEntityToNode(entity);

    expect(node.id).toBe('entity-2');
    expect(node.label).toBe('Test');
    expect(node.attributes).toBeUndefined();
  });
});

describe('transformRelationToLink', () => {
  it('should transform backend relation to frontend link', () => {
    const relation: BackendRelation = {
      id: 'rel-1',
      source_id: 'entity-1',
      target_id: 'entity-2',
      type: 'builtin',
      subtype: 'contains',
      weight: 0.8,
      confidence: 0.9,
    };

    const link = transformRelationToLink(relation);

    expect(link).toEqual({
      id: 'rel-1',
      source: 'entity-1',
      target: 'entity-2',
      relation: 'builtin',
      subtype: 'contains',
      weight: 0.8,
      confidence: 0.9,
    });
  });
});

describe('transformGraphData', () => {
  it('should transform complete graph data', () => {
    const backendData = {
      entities: [
        {
          id: 'e1',
          canonical_name: 'Entity 1',
          type: 'Type1',
          confidence: 0.9,
          schemas: [],
        },
      ],
      relations: [
        {
          id: 'r1',
          source_id: 'e1',
          target_id: 'e2',
          type: 'builtin',
          confidence: 0.85,
        },
      ],
    };

    const frontendData = transformGraphData(backendData);

    expect(frontendData.nodes).toHaveLength(1);
    expect(frontendData.links).toHaveLength(1);
    expect(frontendData.nodes[0].label).toBe('Entity 1');
    expect(frontendData.links[0].source).toBe('e1');
  });
});
```


### 10.3 Integration Testing

**Test Coverage:**
- API service integration with backend
- Authentication flow
- Document CRUD operations
- Knowledge graph data fetching
- Error handling scenarios

**Example: Auth API Integration Tests**

**File: `client/src/api/auth.test.ts`**

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authApi } from './auth';
import { setAuthToken, clearAuthToken, getAuthToken } from '../utils/storage';

// Mock API client
vi.mock('./client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('authApi', () => {
  beforeEach(() => {
    clearAuthToken();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('login', () => {
    it('should login successfully and store token', async () => {
      const mockResponse = {
        data: {
          success: true,
          data: {
            token: 'test-token',
            user: {
              id: '1',
              username: 'testuser',
              email: 'test@example.com',
              createdAt: '2024-01-01',
            },
          },
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      const result = await authApi.login({
        username: 'testuser',
        password: 'password',
      });

      expect(result.token).toBe('test-token');
      expect(result.user.username).toBe('testuser');
      expect(getAuthToken()).toBe('test-token');
    });

    it('should throw error on failed login', async () => {
      const mockResponse = {
        data: {
          success: false,
          error: 'Invalid credentials',
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      await expect(
        authApi.login({ username: 'testuser', password: 'wrong' })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('logout', () => {
    it('should clear token on logout', async () => {
      setAuthToken('test-token');
      expect(getAuthToken()).toBe('test-token');

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue({ data: {} });

      await authApi.logout();

      expect(getAuthToken()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return true when token exists', () => {
      setAuthToken('test-token');
      expect(authApi.isAuthenticated()).toBe(true);
    });

    it('should return false when token does not exist', () => {
      clearAuthToken();
      expect(authApi.isAuthenticated()).toBe(false);
    });
  });
});
```

### 10.4 Component Testing

**Example: ErrorModal Component Tests**

**File: `client/src/components/ErrorModal/ErrorModal.test.tsx`**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorModal } from './ErrorModal';
import { ErrorProvider } from '../../contexts/ErrorContext';

describe('ErrorModal', () => {
  it('should not render when no error', () => {
    render(
      <ErrorProvider>
        <ErrorModal />
      </ErrorProvider>
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render error modal with correct content', () => {
    const { rerender } = render(
      <ErrorProvider>
        <ErrorModal />
      </ErrorProvider>
    );

    // Trigger error
    const TestComponent = () => {
      const { showError } = useError();
      return (
        <button onClick={() => showError({
          title: 'Test Error',
          message: 'This is a test error',
          type: 'error',
        })}>
          Show Error
        </button>
      );
    };

    rerender(
      <ErrorProvider>
        <TestComponent />
        <ErrorModal />
      </ErrorProvider>
    );

    fireEvent.click(screen.getByText('Show Error'));

    expect(screen.getByText('Test Error')).toBeInTheDocument();
    expect(screen.getByText('This is a test error')).toBeInTheDocument();
  });

  it('should close modal when close button clicked', () => {
    // Similar test for close functionality
  });
});
```

### 10.5 Test Configuration

**File: `client/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
    },
  },
});
```


## 11. Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### 11.1 Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties. Through reflection, I've eliminated redundancy:

**Redundancy Analysis:**
- AC-1.4, AC-2.1, AC-3.1-3.4, AC-4.1, AC-5.1, AC-6.1 all test specific API endpoint calls. These can be combined into a single comprehensive property about API endpoint correctness.
- AC-2.2 and AC-2.3 both relate to token management and can be tested together as part of authentication flow properties.
- AC-3.5 and AC-4.2 both test data format validation/transformation and represent universal properties.

### 11.2 Universal Properties

Property 1: API Endpoint Correctness
*For any* API service function, calling it should invoke the correct HTTP method on the correct endpoint path as specified in the backend API documentation.
**Validates: Requirements AC-1.4, AC-2.1, AC-3.1, AC-3.2, AC-3.3, AC-3.4, AC-4.1, AC-5.1, AC-6.1**

Property 2: Authentication Token Persistence
*For any* successful authentication (login or register), the JWT token should be stored in localStorage and included in the Authorization header for all subsequent API calls.
**Validates: Requirements AC-2.2, AC-2.3**

Property 3: Data Transformation Correctness
*For any* backend entity, transforming it to a frontend node and back should preserve all essential data fields (id, name/label, type, confidence).
**Validates: Requirements AC-4.2**

Property 4: Document Structure Validation
*For any* document returned from the backend API, it should contain all required fields (id, title, content, type, fileType, createdAt, updatedAt) with correct types.
**Validates: Requirements AC-3.5**

Property 5: Error Handling Consistency
*For any* failed API call, the error should be caught by the response interceptor and displayed to the user via the error modal with appropriate error type (error, warning, info).
**Validates: Requirements AC-5.4**

Property 6: File Type Validation
*For any* file selected for upload, if its type is not in the allowed list, the upload should be rejected before making the API call.
**Validates: Requirements AC-6.4**

### 11.3 Example-Based Tests

The following acceptance criteria are best tested with specific examples rather than universal properties:

**Configuration Tests:**
- AC-1.1: Verify API base URL is correctly configured
- AC-1.2: Verify environment variables load correctly in dev/prod
- AC-1.3: Verify no Supabase imports exist in codebase

**Authentication Flow Tests:**
- AC-2.4: Test session persistence across page refresh
- AC-2.5: Test logout clears token and redirects

**UI Integration Tests:**
- AC-4.3: Test graph visualization renders with sample data
- AC-4.4: Test graph interactions (zoom, pan, selection)
- AC-5.2: Test search results display
- AC-5.3: Test loading states during async operations
- AC-6.2: Test upload progress display
- AC-6.3: Test document list refresh after upload


## 12. Migration Strategy

### 12.1 Supabase Removal Plan

**Step 1: Identify Supabase Dependencies**
```bash
# Search for Supabase imports
grep -r "from '@supabase" client/src/
grep -r "import.*supabase" client/src/
```

**Step 2: Remove Supabase Packages**
```bash
cd client
npm uninstall @supabase/supabase-js
```

**Step 3: Replace Supabase Auth**
- Remove `client/src/lib/supabase.ts` (if exists)
- Replace with `client/src/api/client.ts` and `client/src/api/auth.ts`
- Update all components using Supabase auth to use `useAuth` hook

**Step 4: Replace Supabase Database Calls**
- Replace all `supabase.from('table').select()` with API service calls
- Update all CRUD operations to use new API services

**Step 5: Update Environment Variables**
- Remove `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Add `VITE_API_BASE_URL`

### 12.2 Old Frontend Cleanup

**Delete Old Client Folder:**
```bash
# Backup first (optional)
mv client client_backup_$(date +%Y%m%d)

# Or delete directly
rm -rf client
```

**Note:** The new frontend should be in a separate directory or the old one should be completely replaced.

## 13. Deployment Considerations

### 13.1 CORS Configuration

The backend must be configured to accept requests from the frontend origin:

**Backend: `server.js`**
```javascript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
```

### 13.2 Production Build

**Build Command:**
```bash
cd client
npm run build
```

**Environment Variables for Production:**
- Set `VITE_API_BASE_URL` to production API URL
- Ensure HTTPS is used in production

### 13.3 Serving Frontend

**Option 1: Serve from Express**
```javascript
// In server.js
app.use(express.static(path.join(__dirname, 'client/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist/index.html'));
});
```

**Option 2: Separate Deployment**
- Deploy frontend to Vercel/Netlify
- Deploy backend to separate server
- Configure CORS appropriately

## 14. Performance Considerations

### 14.1 API Call Optimization

**Debouncing Search:**
```typescript
import { debounce } from 'lodash-es';

const debouncedSearch = debounce(async (query: string) => {
  const results = await aiApi.search({ query });
  setResults(results);
}, 500);
```

**Request Cancellation:**
```typescript
const abortController = new AbortController();

apiClient.get('/documents', {
  signal: abortController.signal
});

// Cancel on unmount
return () => abortController.abort();
```

### 14.2 Data Caching

**Cache Invalidation Strategy:**
- Invalidate on mutations (create, update, delete)
- Auto-refresh updates cache periodically
- Manual refresh button for user-triggered updates

**Cache TTL:**
- Documents: 30 seconds
- Knowledge Graph: 60 seconds
- User data: Session lifetime

### 14.3 Bundle Size Optimization

**Code Splitting:**
```typescript
// Lazy load pages
const KnowledgeGraph = lazy(() => import('./pages/KnowledgeGraph'));
const Documents = lazy(() => import('./pages/Documents'));
```

**Tree Shaking:**
- Import only needed functions from libraries
- Use ES modules for better tree shaking

## 15. Security Considerations

### 15.1 Token Security

**Token Storage:**
- Store in localStorage (acceptable for this use case)
- Alternative: httpOnly cookies (requires backend changes)

**Token Expiration:**
- Backend should set reasonable expiration (e.g., 24 hours)
- Frontend should handle 401 responses and redirect to login

**XSS Protection:**
- Sanitize user input before rendering
- Use React's built-in XSS protection
- Avoid `dangerouslySetInnerHTML` unless necessary

### 15.2 HTTPS in Production

**Requirements:**
- All API calls must use HTTPS in production
- Set `VITE_API_BASE_URL` to HTTPS endpoint
- Configure backend with SSL certificate

### 15.3 Input Validation

**Client-Side Validation:**
- Validate all user inputs before sending to API
- Check file types and sizes before upload
- Sanitize search queries

**Server-Side Validation:**
- Backend must validate all inputs (primary defense)
- Frontend validation is for UX only

## 16. Monitoring and Debugging

### 16.1 Error Logging

**Console Logging:**
```typescript
if (import.meta.env.VITE_DEBUG_MODE === 'true') {
  console.log('[API]', method, endpoint, data);
}
```

**Error Tracking:**
- Log all API errors to console in development
- Consider integrating Sentry for production error tracking

### 16.2 Network Monitoring

**Browser DevTools:**
- Monitor Network tab for API calls
- Check request/response payloads
- Verify authentication headers

**Performance Monitoring:**
- Track API response times
- Monitor auto-refresh impact
- Measure component render times

## 17. Accessibility

### 17.1 Error Modal Accessibility

**ARIA Attributes:**
- Use Radix UI's built-in accessibility features
- Ensure keyboard navigation works
- Provide screen reader announcements

**Focus Management:**
- Trap focus in modal when open
- Return focus to trigger element on close
- Provide clear close button

### 17.2 Loading States

**Screen Reader Announcements:**
```typescript
<div role="status" aria-live="polite">
  {isLoading && 'Loading documents...'}
</div>
```

**Visual Indicators:**
- Show loading spinners for async operations
- Disable buttons during submission
- Provide progress feedback for uploads

## 18. Future Enhancements

### 18.1 Potential Improvements

**Real-time Updates:**
- Implement WebSocket connection for live updates
- Replace polling with server-sent events
- Reduce server load and improve responsiveness

**Offline Support:**
- Implement service worker for offline functionality
- Cache API responses for offline access
- Queue mutations for sync when online

**Advanced Caching:**
- Integrate React Query or SWR for sophisticated caching
- Implement optimistic updates
- Add background refetching

**Token Refresh:**
- Implement automatic token refresh before expiration
- Add refresh token mechanism
- Improve session management

### 18.2 Out of Scope (Current Phase)

The following are explicitly NOT included in this integration phase:
- Real-time updates (WebSocket/SSE)
- Offline support and PWA features
- Advanced state management (Redux, MobX)
- Token refresh mechanism
- Backend API modifications
- Database schema changes

---

**Document Status**: Draft - Ready for Review  
**Created**: 2024-02-04  
**Last Updated**: 2024-02-04  
**Author**: Kiro AI Assistant

