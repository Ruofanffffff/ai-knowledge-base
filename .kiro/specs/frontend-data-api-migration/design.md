# Design Document: Frontend Data API Migration

## Overview

This design addresses the systematic elimination of hardcoded data from the React + TypeScript frontend application. The migration involves auditing all frontend components, identifying hardcoded data, verifying or creating backend API endpoints, and replacing static data with dynamic API calls. The design ensures proper loading states, error handling, and type safety throughout the migration process.

The migration follows a page-by-page approach, starting with the Graph page (which has clear demo data functions), then moving to Documents, Chat, Models, and Recommendations pages. Each migration includes proper TypeScript typing, loading states, error handling, and removal of demo data functions.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────┐
│         React Frontend (Client)         │
│  ┌───────────────────────────────────┐  │
│  │  Pages (Graph, Documents, Chat)   │  │
│  │  - Remove hardcoded data          │  │
│  │  - Add API calls with axios       │  │
│  │  - Add loading/error states       │  │
│  └───────────────┬───────────────────┘  │
│                  │                       │
│  ┌───────────────▼───────────────────┐  │
│  │     API Service Layer             │  │
│  │  - Centralized axios calls        │  │
│  │  - Type-safe responses            │  │
│  │  - Error handling                 │  │
│  └───────────────┬───────────────────┘  │
└──────────────────┼───────────────────────┘
                   │ HTTP/REST
┌──────────────────▼───────────────────────┐
│       Express Backend (Server)           │
│  ┌───────────────────────────────────┐  │
│  │  API Routes                        │  │
│  │  - /api/graph/nodes                │  │
│  │  - /api/graph/links                │  │
│  │  - /api/documents                  │  │
│  │  - /api/chat/history               │  │
│  │  - /api/models                     │  │
│  │  - /api/recommendations            │  │
│  └───────────────┬───────────────────┘  │
│                  │                       │
│  ┌───────────────▼───────────────────┐  │
│  │     Database (PostgreSQL)         │  │
│  │  - Documents, Entities, Relations │  │
│  └───────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

### Migration Strategy

1. **Audit Phase**: Identify all hardcoded data locations
2. **API Verification Phase**: Verify backend endpoints exist
3. **Implementation Phase**: Replace hardcoded data with API calls
4. **Testing Phase**: Verify data flows correctly
5. **Cleanup Phase**: Remove demo data functions

## Components and Interfaces

### Frontend API Service Layer

Create a centralized API service to handle all backend communication:

```typescript
// client/src/services/api.ts

interface ApiResponse<T> {
  data: T;
  error?: string;
}

interface GraphNode {
  id: string;
  label: string;
  type: string;
  properties?: Record<string, any>;
}

interface GraphLink {
  source: string;
  target: string;
  type: string;
  weight?: number;
}

interface Document {
  id: string;
  name: string;
  uploadDate: string;
  status: 'processing' | 'completed' | 'failed';
  size?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
}

interface Model {
  id: string;
  name: string;
  provider: string;
  status: 'available' | 'unavailable';
}

interface Recommendation {
  id: string;
  type: string;
  content: string;
  confidence: number;
  relatedEntities: string[];
}

class ApiService {
  private baseURL: string;
  private axiosInstance: AxiosInstance;

  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add auth token interceptor
    this.axiosInstance.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });
  }

  // Graph API methods
  async getGraphNodes(): Promise<ApiResponse<GraphNode[]>> {
    try {
      const response = await this.axiosInstance.get('/api/graph/nodes');
      return { data: response.data };
    } catch (error) {
      return { data: [], error: this.handleError(error) };
    }
  }

  async getGraphLinks(): Promise<ApiResponse<GraphLink[]>> {
    try {
      const response = await this.axiosInstance.get('/api/graph/links');
      return { data: response.data };
    } catch (error) {
      return { data: [], error: this.handleError(error) };
    }
  }

  // Document API methods
  async getDocuments(): Promise<ApiResponse<Document[]>> {
    try {
      const response = await this.axiosInstance.get('/api/documents');
      return { data: response.data };
    } catch (error) {
      return { data: [], error: this.handleError(error) };
    }
  }

  // Chat API methods
  async getChatHistory(sessionId?: string): Promise<ApiResponse<ChatMessage[]>> {
    try {
      const url = sessionId ? `/api/chat/history/${sessionId}` : '/api/chat/history';
      const response = await this.axiosInstance.get(url);
      return { data: response.data };
    } catch (error) {
      return { data: [], error: this.handleError(error) };
    }
  }

  async getChatSessions(): Promise<ApiResponse<ChatSession[]>> {
    try {
      const response = await this.axiosInstance.get('/api/chat/sessions');
      return { data: response.data };
    } catch (error) {
      return { data: [], error: this.handleError(error) };
    }
  }

  async sendChatMessage(message: string, sessionId?: string): Promise<ApiResponse<ChatMessage>> {
    try {
      const response = await this.axiosInstance.post('/api/chat/message', {
        message,
        sessionId,
      });
      return { data: response.data };
    } catch (error) {
      return { data: null, error: this.handleError(error) };
    }
  }

  // Models API methods
  async getModels(): Promise<ApiResponse<Model[]>> {
    try {
      const response = await this.axiosInstance.get('/api/models');
      return { data: response.data };
    } catch (error) {
      return { data: [], error: this.handleError(error) };
    }
  }

  // Recommendations API methods
  async getRecommendations(): Promise<ApiResponse<Recommendation[]>> {
    try {
      const response = await this.axiosInstance.get('/api/recommendations');
      return { data: response.data };
    } catch (error) {
      return { data: [], error: this.handleError(error) };
    }
  }

  private handleError(error: any): string {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        return error.response.data?.message || error.response.statusText;
      } else if (error.request) {
        return 'No response from server. Please check your connection.';
      }
    }
    return error.message || 'An unexpected error occurred';
  }
}

export const apiService = new ApiService();
export type { GraphNode, GraphLink, Document, ChatMessage, ChatSession, Model, Recommendation };
```

### React Hook for Data Fetching

Create a reusable hook for data fetching with loading and error states:

```typescript
// client/src/hooks/useApiData.ts

interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function useApiData<T>(
  fetchFunction: () => Promise<ApiResponse<T>>,
  dependencies: any[] = []
): UseApiDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    const response = await fetchFunction();
    
    if (response.error) {
      setError(response.error);
      setData(null);
    } else {
      setData(response.data);
      setError(null);
    }
    
    setLoading(false);
  }, [fetchFunction]);

  useEffect(() => {
    fetchData();
  }, dependencies);

  return { data, loading, error, refetch: fetchData };
}

export default useApiData;
```

### Page Component Updates

#### Graph Page Migration

```typescript
// client/src/pages/Graph.tsx (Updated)

import { useApiData } from '../hooks/useApiData';
import { apiService, GraphNode, GraphLink } from '../services/api';

function Graph() {
  const { 
    data: nodes, 
    loading: nodesLoading, 
    error: nodesError 
  } = useApiData(() => apiService.getGraphNodes());

  const { 
    data: links, 
    loading: linksLoading, 
    error: linksError 
  } = useApiData(() => apiService.getGraphLinks());

  const loading = nodesLoading || linksLoading;
  const error = nodesError || linksError;

  if (loading) {
    return <LoadingSpinner message="Loading knowledge graph..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={() => window.location.reload()} />;
  }

  if (!nodes || nodes.length === 0) {
    return <EmptyState message="No graph data available. Upload documents to build your knowledge graph." />;
  }

  return (
    <div className="graph-container">
      <GraphVisualization nodes={nodes} links={links || []} />
    </div>
  );
}

// REMOVE: getDemoNodes() function
// REMOVE: getDemoLinks() function
```

#### Documents Page Migration

```typescript
// client/src/pages/Documents.tsx (Updated)

import { useApiData } from '../hooks/useApiData';
import { apiService, Document } from '../services/api';

function Documents() {
  const { 
    data: documents, 
    loading, 
    error, 
    refetch 
  } = useApiData(() => apiService.getDocuments());

  const handleUploadComplete = () => {
    refetch(); // Refresh document list after upload
  };

  if (loading) {
    return <LoadingSpinner message="Loading documents..." />;
  }

  if (error) {
    return <ErrorDisplay message={error} onRetry={refetch} />;
  }

  return (
    <div className="documents-container">
      <DocumentUpload onUploadComplete={handleUploadComplete} />
      {documents && documents.length > 0 ? (
        <DocumentList documents={documents} onDelete={refetch} />
      ) : (
        <EmptyState message="No documents uploaded yet. Upload your first document to get started." />
      )}
    </div>
  );
}
```

#### Chat Page Migration

```typescript
// client/src/pages/Chat.tsx (Updated)

import { useApiData } from '../hooks/useApiData';
import { apiService, ChatMessage, ChatSession } from '../services/api';

function Chat() {
  const [currentSessionId, setCurrentSessionId] = useState<string | undefined>();
  
  const { 
    data: sessions, 
    loading: sessionsLoading 
  } = useApiData(() => apiService.getChatSessions());

  const { 
    data: messages, 
    loading: messagesLoading,
    error: messagesError,
    refetch: refetchMessages
  } = useApiData(() => apiService.getChatHistory(currentSessionId), [currentSessionId]);

  const handleSendMessage = async (message: string) => {
    const response = await apiService.sendChatMessage(message, currentSessionId);
    if (!response.error) {
      refetchMessages(); // Refresh chat history
    }
  };

  if (sessionsLoading || messagesLoading) {
    return <LoadingSpinner message="Loading chat..." />;
  }

  return (
    <div className="chat-container">
      <ChatSidebar 
        sessions={sessions || []} 
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
      />
      <ChatWindow 
        messages={messages || []} 
        onSendMessage={handleSendMessage}
        error={messagesError}
      />
    </div>
  );
}
```

## Data Models

### TypeScript Type Definitions

All data models are defined in the API service layer and exported for use throughout the application. Key type definitions include:

- **GraphNode**: Represents a node in the knowledge graph with id, label, type, and properties
- **GraphLink**: Represents an edge between nodes with source, target, type, and weight
- **Document**: Represents an uploaded document with metadata
- **ChatMessage**: Represents a single chat message with role and content
- **ChatSession**: Represents a chat conversation session
- **Model**: Represents an available AI model
- **Recommendation**: Represents a system-generated recommendation

### API Response Format

All API responses follow a consistent format:

```typescript
interface ApiResponse<T> {
  data: T;
  error?: string;
}
```

This allows for consistent error handling across all API calls.

## Correctness Properties


*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: API Endpoint Coverage
*For any* data type required by the frontend, there exists a corresponding backend API endpoint that can provide that data.
**Validates: Requirements 2.1**

### Property 2: API Response Type Compatibility
*For any* API endpoint, the response structure matches the expected TypeScript interface defined in the frontend.
**Validates: Requirements 2.3, 5.2**

### Property 3: Component Data Fetching
*For any* component that displays data, when the component mounts, it fetches that data from the appropriate backend API endpoint.
**Validates: Requirements 3.1, 7.1, 7.2, 8.1, 9.1, 9.3, 10.1, 10.2**

### Property 4: Error Handling Presence
*For any* API call in the frontend, there exists error handling logic (try-catch or .catch()) that prevents unhandled promise rejections.
**Validates: Requirements 3.2**

### Property 5: Authentication Token Inclusion
*For any* API call to an authenticated endpoint, the request includes an authentication token in the Authorization header.
**Validates: Requirements 3.3**

### Property 6: No Hardcoded Data Arrays
*For any* frontend component file, there are no hardcoded data arrays or objects that should come from the backend API.
**Validates: Requirements 3.4, 6.2**

### Property 7: No Demo Data Functions
*For any* frontend component file, there are no demo data generation functions like getDemoNodes() or getDemoLinks().
**Validates: Requirements 3.5, 6.1**

### Property 8: Loading State Management
*For any* component fetching data, the loading state is true during the fetch, false after completion, and a loading indicator is displayed while loading is true.
**Validates: Requirements 4.1, 4.3**

### Property 9: Error State Display
*For any* failed API call, an error message is displayed to the user and the error state contains the error information.
**Validates: Requirements 4.2**

### Property 10: Empty State Display
*For any* API response that returns an empty array or null, the component displays an appropriate empty state message instead of demo data.
**Validates: Requirements 4.4, 6.3, 7.4, 8.4, 9.4**

### Property 11: Loading State Interaction Prevention
*For any* component in a loading state, interactive elements that depend on the data being loaded are disabled or hidden.
**Validates: Requirements 4.5**

### Property 12: Type Mismatch Handling
*For any* API response that doesn't match the expected type structure, a warning is logged and the application handles it gracefully without crashing.
**Validates: Requirements 5.3**

### Property 13: Centralized Type Definitions
*For any* API integration, the TypeScript types used are imported from a central API service module, ensuring consistency.
**Validates: Requirements 5.4**

### Property 14: Development-Only Demo Data
*For any* demo data that exists in the codebase, it is wrapped in environment checks that prevent it from running in production.
**Validates: Requirements 6.4**

### Property 15: Data Transformation Correctness
*For any* API response, the data transformation produces output that matches the format expected by the consuming component or library.
**Validates: Requirements 7.3, 8.2**

### Property 16: Operation-Triggered Refetch
*For any* data mutation operation (create, update, delete), the component triggers a refetch of the affected data from the API.
**Validates: Requirements 8.3, 10.3**

### Property 17: Message Send API Integration
*For any* chat message sent by the user, an API call is made to the backend and the UI updates with the response.
**Validates: Requirements 9.2**

### Property 18: Real-Time Results Display
*For any* recommendation or model result, the data displayed comes from the backend API, not from hardcoded or cached data.
**Validates: Requirements 10.4**

## Error Handling

### API Error Handling Strategy

All API calls follow a consistent error handling pattern:

1. **Network Errors**: Caught by axios interceptors and returned as user-friendly messages
2. **HTTP Errors**: Response status codes are checked and appropriate error messages are returned
3. **Timeout Errors**: 30-second timeout is configured, after which a timeout error is returned
4. **Type Errors**: Response validation catches type mismatches and logs warnings

### Error Display Components

```typescript
// client/src/components/ErrorDisplay.tsx

interface ErrorDisplayProps {
  message: string;
  onRetry?: () => void;
}

function ErrorDisplay({ message, onRetry }: ErrorDisplayProps) {
  return (
    <div className="error-container">
      <div className="error-icon">⚠️</div>
      <p className="error-message">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="retry-button">
          Retry
        </button>
      )}
    </div>
  );
}
```

### Loading State Components

```typescript
// client/src/components/LoadingSpinner.tsx

interface LoadingSpinnerProps {
  message?: string;
}

function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className="loading-container">
      <div className="spinner" />
      <p className="loading-message">{message}</p>
    </div>
  );
}
```

### Empty State Components

```typescript
// client/src/components/EmptyState.tsx

interface EmptyStateProps {
  message: string;
  actionText?: string;
  onAction?: () => void;
}

function EmptyState({ message, actionText, onAction }: EmptyStateProps) {
  return (
    <div className="empty-state-container">
      <div className="empty-state-icon">📭</div>
      <p className="empty-state-message">{message}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="action-button">
          {actionText}
        </button>
      )}
    </div>
  );
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** focus on:
- Specific API endpoint responses
- Error handling for specific error types
- Loading state transitions for individual components
- Empty state rendering for specific pages
- Integration between components and API service

**Property-Based Tests** focus on:
- Universal properties that hold across all API calls
- Type safety across all API responses
- Error handling consistency across all endpoints
- Loading state behavior across all components
- Data transformation correctness for all data types

### Property-Based Testing Configuration

We will use **fast-check** for property-based testing in TypeScript. Each property test will:
- Run a minimum of 100 iterations
- Reference the design document property number
- Use the tag format: **Feature: frontend-data-api-migration, Property {number}: {property_text}**

### Test Coverage Areas

1. **API Service Layer Tests**
   - Test all API methods return correct types
   - Test error handling for network failures
   - Test authentication token inclusion
   - Test timeout handling

2. **Component Integration Tests**
   - Test components fetch data on mount
   - Test loading states display correctly
   - Test error states display correctly
   - Test empty states display correctly
   - Test data refetch after mutations

3. **Type Safety Tests**
   - Test API responses match TypeScript interfaces
   - Test type mismatches are handled gracefully
   - Test centralized type definitions are used

4. **Code Quality Tests**
   - Test no hardcoded data arrays exist
   - Test no demo data functions exist
   - Test demo data (if any) is environment-gated

### Example Property Test

```typescript
// client/src/services/__tests__/api.property.test.ts

import fc from 'fast-check';
import { apiService } from '../api';

describe('API Service Property Tests', () => {
  // Feature: frontend-data-api-migration, Property 4: Error Handling Presence
  test('all API methods handle errors without throwing', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(
        'getGraphNodes',
        'getGraphLinks',
        'getDocuments',
        'getChatHistory',
        'getModels',
        'getRecommendations'
      ), async (methodName) => {
        // Mock network failure
        jest.spyOn(axios, 'get').mockRejectedValue(new Error('Network error'));
        
        const result = await apiService[methodName]();
        
        // Should return error response, not throw
        expect(result).toHaveProperty('error');
        expect(result.error).toBeTruthy();
      }),
      { numRuns: 100 }
    );
  });
});
```

### Migration Validation Tests

After migration, run validation tests to ensure:
- All pages load without errors
- All API calls succeed with real backend
- No console errors related to missing data
- Loading states appear and disappear correctly
- Error states can be triggered and recovered from
- Empty states display when appropriate

### Manual Testing Checklist

- [ ] Graph page displays real nodes and links
- [ ] Documents page displays real document list
- [ ] Chat page displays real chat history
- [ ] Models page displays real model list
- [ ] Recommendations page displays real recommendations
- [ ] Loading indicators appear during data fetch
- [ ] Error messages display when API fails
- [ ] Empty states display when no data exists
- [ ] Refetch works after data mutations
- [ ] No demo data functions remain in code
- [ ] No hardcoded data arrays remain in components
