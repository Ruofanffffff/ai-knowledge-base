# API Integration Guide

This document provides detailed information about how the frontend integrates with the backend API, including examples, patterns, and best practices.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [HTTP Client Configuration](#http-client-configuration)
- [Authentication](#authentication)
- [API Services](#api-services)
- [Data Transformation](#data-transformation)
- [Error Handling](#error-handling)
- [Auto-Refresh](#auto-refresh)
- [Usage Examples](#usage-examples)

## Architecture Overview

The frontend uses a layered architecture for API integration:

```
Pages/Components
       ↓
Custom Hooks (useDocuments, useGraph, etc.)
       ↓
API Services (auth, documents, graph, etc.)
       ↓
HTTP Client (axios with interceptors)
       ↓
Backend API
```

### Key Components

1. **HTTP Client** (`src/api/client.ts`): Centralized axios instance with interceptors
2. **API Services** (`src/api/*.ts`): Service layer for each API domain
3. **Custom Hooks** (`src/hooks/*.ts`): React hooks for state management
4. **Data Transformers** (`src/utils/transformers.ts`): Transform backend ↔ frontend data formats

## HTTP Client Configuration

### Base Configuration

```typescript
// src/api/client.ts
import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### Request Interceptor

Automatically adds authentication token to all requests:

```typescript
apiClient.interceptors.request.use(
  (config) => {
    const token = getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);
```

### Response Interceptor

Handles errors globally:

```typescript
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and redirect to login
      clearAuthToken();
      window.location.href = '/login';
    }
    // Show error modal
    showErrorModal({
      title: 'Error',
      message: error.message,
      type: 'error'
    });
    return Promise.reject(error);
  }
);
```

## Authentication

### Login Flow

```typescript
// 1. User submits login form
const { login } = useAuth();
await login(username, password);

// 2. API call
export const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
  const response = await apiClient.post('/auth/login', credentials);
  const { token, user } = response.data;
  
  // 3. Store token
  setAuthToken(token);
  setUserData(user);
  
  return response.data;
};

// 4. Token is automatically included in subsequent requests
```

### Token Storage

```typescript
// Store token
export const setAuthToken = (token: string): void => {
  localStorage.setItem('auth_token', token);
};

// Retrieve token
export const getAuthToken = (): string | null => {
  return localStorage.getItem('auth_token');
};

// Clear token
export const clearAuthToken = (): void => {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user_data');
};
```

### Protected Routes

```typescript
// Wrap protected pages with ProtectedRoute
<Route path="/dashboard" element={
  <ProtectedRoute>
    <Dashboard />
  </ProtectedRoute>
} />
```

## API Services

### Documents API

```typescript
// src/api/documents.ts

// Get all documents
export const getDocuments = async (): Promise<Document[]> => {
  const response = await apiClient.get('/documents');
  return response.data;
};

// Get single document
export const getDocument = async (id: string): Promise<Document> => {
  const response = await apiClient.get(`/documents/${id}`);
  return response.data;
};

// Create document
export const createDocument = async (data: CreateDocumentRequest): Promise<Document> => {
  const response = await apiClient.post('/documents', data);
  return response.data;
};

// Update document
export const updateDocument = async (
  id: string,
  data: UpdateDocumentRequest
): Promise<Document> => {
  const response = await apiClient.put(`/documents/${id}`, data);
  return response.data;
};

// Delete document
export const deleteDocument = async (id: string): Promise<void> => {
  await apiClient.delete(`/documents/${id}`);
};
```

### Knowledge Graph API

```typescript
// src/api/graph.ts

// Get graph data with transformation
export const getGraphData = async (params?: {
  minConfidence?: number;
  entityTypes?: string[];
}): Promise<FrontendGraphData> => {
  const response = await apiClient.get('/knowledge-graph', { params });
  const backendData: BackendGraphData = response.data;
  
  // Transform backend format to frontend format
  return transformGraphData(backendData);
};

// Get entities
export const getEntities = async (params?: {
  minConfidence?: number;
  types?: string[];
}): Promise<BackendEntity[]> => {
  const response = await apiClient.get('/knowledge-graph/entities', { params });
  return response.data.entities;
};

// Build graph from document
export const buildGraph = async (
  docId: string,
  filePath?: string,
  fileType?: string
): Promise<void> => {
  await apiClient.post('/knowledge-graph/build', {
    docId,
    filePath,
    fileType
  });
};
```

### AI Search API

```typescript
// src/api/ai.ts

// Semantic search
export const search = async (request: SearchRequest): Promise<SearchResult> => {
  const response = await apiClient.post('/ai/search', request);
  return response.data;
};

// Summarize document
export const summarize = async (docId: string): Promise<string> => {
  const response = await apiClient.post(`/ai/summarize/${docId}`);
  return response.data.summary;
};

// Generate tags
export const generateTags = async (content: string): Promise<string[]> => {
  const response = await apiClient.post('/ai/tags', { content });
  return response.data.tags;
};
```

### File Upload API

```typescript
// src/api/upload.ts

// Upload file with progress tracking
export const uploadFile = async (
  file: File,
  onProgress?: (progress: number) => void
): Promise<Document> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (progressEvent.total) {
        const progress = Math.round(
          (progressEvent.loaded * 100) / progressEvent.total
        );
        onProgress?.(progress);
      }
    },
  });

  return response.data;
};
```

## Data Transformation

### Backend to Frontend

The backend uses snake_case and different field names. We transform to camelCase and frontend-friendly names:

```typescript
// src/utils/transformers.ts

// Transform entity to node
export const transformEntityToNode = (entity: BackendEntity): GraphNode => {
  return {
    id: entity.id,
    label: entity.canonical_name,  // canonical_name → label
    type: entity.type,
    confidence: entity.confidence,
    schemas: entity.schemas,
    attributes: entity.attributes,
  };
};

// Transform relation to link
export const transformRelationToLink = (relation: BackendRelation): GraphLink => {
  return {
    id: relation.id,
    source: relation.source_id,    // source_id → source
    target: relation.target_id,    // target_id → target
    relation: relation.type,
    subtype: relation.subtype,
    weight: relation.weight,
    confidence: relation.confidence,
  };
};

// Transform entire graph
export const transformGraphData = (data: BackendGraphData): FrontendGraphData => {
  return {
    nodes: data.entities.map(transformEntityToNode),
    links: data.relations.map(transformRelationToLink),
  };
};
```

### Frontend to Backend

```typescript
// Transform node to entity
export const transformNodeToEntity = (node: GraphNode): BackendEntity => {
  return {
    id: node.id,
    canonical_name: node.label,    // label → canonical_name
    type: node.type,
    confidence: node.confidence,
    schemas: node.schemas || [],
    attributes: node.attributes,
  };
};
```

## Error Handling

### Global Error Handler

All API errors are caught by the response interceptor and displayed via error modal:

```typescript
// Automatic error handling
try {
  await documentsApi.createDocument(data);
} catch (error) {
  // Error is automatically shown in modal
  // No need for manual error handling
}
```

### Manual Error Handling

For custom error handling:

```typescript
import { showErrorModal } from '../contexts/ErrorContext';

try {
  await someApiCall();
} catch (error) {
  showErrorModal({
    title: 'Custom Error',
    message: 'Something went wrong',
    type: 'error',
    technicalDetails: error.message
  });
}
```

### Error Types

- **error**: Critical errors (red icon)
- **warning**: Warning messages (yellow icon)
- **info**: Informational messages (blue icon, auto-dismiss after 5s)

## Auto-Refresh

### Using Auto-Refresh Hook

```typescript
// src/hooks/useDocuments.ts
import { useAutoRefresh } from './useAutoRefresh';

export const useDocuments = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  
  const fetchDocuments = async () => {
    const data = await documentsApi.getDocuments();
    setDocuments(data);
  };

  // Auto-refresh every 30 seconds
  const { pause, resume, refresh } = useAutoRefresh({
    callback: fetchDocuments,
    interval: 30000,
    enabled: true
  });

  return {
    documents,
    refresh,      // Manual refresh
    pause,        // Pause auto-refresh
    resume,       // Resume auto-refresh
  };
};
```

### Configuration

Auto-refresh intervals are configurable via environment variables:

```env
VITE_ENABLE_AUTO_REFRESH=true
VITE_AUTO_REFRESH_INTERVAL=30000  # 30 seconds
```

## Usage Examples

### Example 1: Document Management

```typescript
// In a React component
import { useDocuments } from '../hooks/useDocuments';

const DocumentsList = () => {
  const {
    documents,
    isLoading,
    error,
    createDocument,
    updateDocument,
    deleteDocument,
    refresh
  } = useDocuments();

  const handleCreate = async () => {
    await createDocument({
      title: 'New Document',
      content: 'Content here'
    });
    // List automatically refreshes
  };

  const handleUpdate = async (id: string) => {
    await updateDocument(id, {
      title: 'Updated Title'
    });
  };

  const handleDelete = async (id: string) => {
    await deleteDocument(id);
  };

  return (
    <div>
      <button onClick={refresh}>Refresh</button>
      {isLoading && <LoadingSpinner />}
      {error && <ErrorMessage error={error} />}
      {documents.map(doc => (
        <DocumentItem
          key={doc.id}
          document={doc}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      ))}
    </div>
  );
};
```

### Example 2: Knowledge Graph

```typescript
import { useGraph } from '../hooks/useGraph';

const GraphVisualization = () => {
  const { graphData, isLoading, refresh } = useGraph();

  useEffect(() => {
    if (graphData) {
      // Render graph with D3.js
      renderGraph(graphData.nodes, graphData.links);
    }
  }, [graphData]);

  return (
    <div>
      <button onClick={refresh}>Refresh Graph</button>
      {isLoading && <LoadingSpinner />}
      <svg ref={svgRef} />
    </div>
  );
};
```

### Example 3: File Upload with Progress

```typescript
import { uploadApi } from '../api/upload';

const FileUploader = () => {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const document = await uploadApi.uploadFile(file, setProgress);
      console.log('Uploaded:', document);
    } catch (error) {
      // Error automatically shown in modal
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div>
      <input
        type="file"
        onChange={(e) => e.target.files && handleUpload(e.target.files[0])}
      />
      {uploading && <ProgressBar value={progress} />}
    </div>
  );
};
```

### Example 4: AI Search

```typescript
import { aiApi } from '../api/ai';

const SearchPage = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const result = await aiApi.search({ query, topK: 5 });
      setResults(result);
    } catch (error) {
      // Error automatically shown
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
      />
      <button onClick={handleSearch} disabled={loading}>
        Search
      </button>
      {results && (
        <div>
          <h3>Answer: {results.answer}</h3>
          <h4>Sources:</h4>
          <ul>
            {results.sources.map((source, i) => (
              <li key={i}>{source}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

## Best Practices

### 1. Always Use API Services

❌ Don't call axios directly in components:
```typescript
// Bad
const response = await axios.get('http://localhost:3000/api/documents');
```

✅ Use API services:
```typescript
// Good
const documents = await documentsApi.getDocuments();
```

### 2. Use Custom Hooks for State Management

❌ Don't manage API state in components:
```typescript
// Bad
const [documents, setDocuments] = useState([]);
useEffect(() => {
  documentsApi.getDocuments().then(setDocuments);
}, []);
```

✅ Use custom hooks:
```typescript
// Good
const { documents, isLoading, error } = useDocuments();
```

### 3. Handle Loading and Error States

```typescript
const { data, isLoading, error } = useData();

if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
return <DataDisplay data={data} />;
```

### 4. Transform Data at API Layer

Transform data in API services, not in components:

```typescript
// In API service
export const getGraphData = async () => {
  const response = await apiClient.get('/knowledge-graph');
  return transformGraphData(response.data);  // Transform here
};
```

### 5. Use TypeScript Types

Always use proper TypeScript types from `src/api/types.ts`:

```typescript
import type { Document, CreateDocumentRequest } from '../api/types';

const createDoc = async (data: CreateDocumentRequest): Promise<Document> => {
  return await documentsApi.createDocument(data);
};
```

## Troubleshooting

### CORS Issues

If you see CORS errors:
1. Verify backend CORS configuration allows your origin
2. Check that credentials are included if needed
3. Verify API base URL is correct

### Authentication Issues

If authentication fails:
1. Check token is stored: `localStorage.getItem('auth_token')`
2. Verify token format in request headers
3. Check token expiration on backend

### Data Transformation Issues

If data doesn't display correctly:
1. Check backend response format matches expected types
2. Verify transformation functions are applied
3. Use browser DevTools to inspect network responses

## Related Documentation

- [Main README](../README.md)
- [Backend API Documentation](../../kg/API.md)
- [Testing Guide](./TESTING.md)
