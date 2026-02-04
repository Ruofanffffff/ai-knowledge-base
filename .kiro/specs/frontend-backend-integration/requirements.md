# Frontend-Backend Integration Requirements

## 1. Overview

**Feature Name**: Frontend-Backend Integration  
**Feature ID**: frontend-backend-integration  
**Priority**: Critical  
**Status**: Draft - Awaiting User Confirmation

### Purpose
Integrate the new Figma-based React frontend with the existing Express.js backend by adapting the frontend to match backend API endpoints, authentication mechanisms, and data formats.

---

## 2. User Stories

### US-1: API Configuration
**As a** developer  
**I want** the frontend to connect to the local Express backend  
**So that** API calls can successfully reach the backend services

**Acceptance Criteria**:
- AC-1.1: Frontend API base URL points to `http://localhost:3000/api`
- AC-1.2: Environment variables are properly configured for different environments
- AC-1.3: All Supabase-specific code is removed or replaced
- AC-1.4: API calls use the correct HTTP methods and endpoints

### US-2: Authentication Integration
**As a** user  
**I want** to log in using the backend authentication system  
**So that** I can access protected features

**Acceptance Criteria**:
- AC-2.1: Login page sends credentials to `/api/auth/login`
- AC-2.2: JWT token is stored in localStorage upon successful login
- AC-2.3: Token is included in Authorization header for protected API calls
- AC-2.4: User session persists across page refreshes
- AC-2.5: Logout clears the token and redirects to login page

### US-3: Document Management
**As a** user  
**I want** to view, create, edit, and delete documents  
**So that** I can manage my knowledge base

**Acceptance Criteria**:
- AC-3.1: Documents list fetches from `/api/documents`
- AC-3.2: Document creation posts to `/api/documents`
- AC-3.3: Document updates use PUT to `/api/documents/:id`
- AC-3.4: Document deletion uses DELETE to `/api/documents/:id`
- AC-3.5: Document data format matches backend response structure

### US-4: Knowledge Graph Visualization
**As a** user  
**I want** to view the knowledge graph  
**So that** I can explore relationships between concepts

**Acceptance Criteria**:
- AC-4.1: Graph data fetches from `/api/knowledge-graph`
- AC-4.2: Backend entity/relation format is transformed to frontend node/link format
- AC-4.3: Graph visualization renders correctly with transformed data
- AC-4.4: Graph interactions (zoom, pan, node selection) work properly

### US-5: AI Search Integration
**As a** user  
**I want** to search documents using AI  
**So that** I can find relevant information quickly

**Acceptance Criteria**:
- AC-5.1: Search requests post to `/api/ai/search`
- AC-5.2: Search results display correctly in the UI
- AC-5.3: Loading states are shown during search
- AC-5.4: Error messages are displayed for failed searches

### US-6: File Upload
**As a** user  
**I want** to upload files  
**So that** I can add documents to my knowledge base

**Acceptance Criteria**:
- AC-6.1: File upload posts to `/api/upload`
- AC-6.2: Upload progress is displayed
- AC-6.3: Uploaded files appear in the document list
- AC-6.4: File type validation is performed

---

## 3. Technical Requirements

### TR-1: API Layer Refactoring
- Remove all Supabase client code
- Create new API service modules for each domain (auth, documents, graph, ai)
- Implement proper error handling and response parsing
- Add request/response interceptors for authentication

### TR-2: Authentication System
- Implement JWT token management
- Create auth context/hooks for React
- Handle token expiration and refresh
- Implement protected route logic

### TR-3: Data Transformation Layer
- Create transformation utilities for backend-to-frontend data mapping
- Handle entity → node transformation
- Handle relation → link transformation
- Ensure type safety with TypeScript interfaces

### TR-4: State Management
- Implement proper loading states
- Handle error states consistently
- Cache frequently accessed data
- Implement optimistic updates where appropriate

### TR-5: Environment Configuration
- Create `.env.local` for development
- Support production environment variables
- Document all required environment variables

---

## 4. API Endpoint Mapping

### Current Backend Endpoints (to be used):
```
Authentication:
- POST   /api/auth/login
- POST   /api/auth/register
- POST   /api/auth/logout
- GET    /api/auth/me

Documents:
- GET    /api/documents
- GET    /api/documents/:id
- POST   /api/documents
- PUT    /api/documents/:id
- DELETE /api/documents/:id

Knowledge Graph:
- GET    /api/knowledge-graph
- POST   /api/knowledge-graph/build
- GET    /api/knowledge-graph/entities
- GET    /api/knowledge-graph/relations

AI Features:
- POST   /api/ai/search
- POST   /api/ai/summarize
- POST   /api/ai/generate-tags

File Upload:
- POST   /api/upload

Tags:
- GET    /api/tags
- POST   /api/tags

Categories:
- GET    /api/categories
```

### Frontend API Calls (to be implemented):
```typescript
// Auth
login(username, password) → POST /api/auth/login
register(userData) → POST /api/auth/register
logout() → POST /api/auth/logout
getCurrentUser() → GET /api/auth/me

// Documents
getDocuments() → GET /api/documents
getDocument(id) → GET /api/documents/:id
createDocument(data) → POST /api/documents
updateDocument(id, data) → PUT /api/documents/:id
deleteDocument(id) → DELETE /api/documents/:id

// Knowledge Graph
getGraphData() → GET /api/knowledge-graph
buildGraph(docId) → POST /api/knowledge-graph/build
getEntities(filters) → GET /api/knowledge-graph/entities
getRelations(filters) → GET /api/knowledge-graph/relations

// AI
searchDocuments(query) → POST /api/ai/search
summarizeDocument(docId) → POST /api/ai/summarize
generateTags(content) → POST /api/ai/generate-tags

// Files
uploadFile(file) → POST /api/upload
```

---

## 5. Data Format Transformations

### 5.1 Knowledge Graph Data

**Backend Response**:
```json
{
  "success": true,
  "data": {
    "entities": [
      {
        "id": "entity-1",
        "name": "人工智能",
        "type": "ConceptEntity",
        "confidence": 0.95
      }
    ],
    "relations": [
      {
        "id": "rel-1",
        "source_id": "entity-1",
        "target_id": "entity-2",
        "type": "包含",
        "confidence": 0.88
      }
    ]
  }
}
```

**Frontend Expected Format**:
```json
{
  "nodes": [
    {
      "id": "entity-1",
      "label": "人工智能",
      "type": "ConceptEntity",
      "confidence": 0.95
    }
  ],
  "links": [
    {
      "id": "rel-1",
      "source": "entity-1",
      "target": "entity-2",
      "relation": "包含",
      "confidence": 0.88
    }
  ]
}
```

### 5.2 Document Data

**Backend Response**:
```json
{
  "id": "1",
  "title": "Document Title",
  "content": "Document content...",
  "type": "document",
  "fileType": ".md",
  "metadata": {},
  "tags": ["tag1", "tag2"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Frontend Expected Format**: Same as backend (no transformation needed)

### 5.3 Authentication Response

**Backend Response**:
```json
{
  "success": true,
  "token": "jwt-token-here",
  "user": {
    "id": "user-1",
    "username": "user",
    "email": "user@example.com"
  }
}
```

**Frontend Storage**:
- Store `token` in localStorage as `auth_token`
- Store `user` in React state/context

---

## 6. Non-Functional Requirements

### NFR-1: Performance
- API calls should complete within 3 seconds under normal conditions
- Loading states should appear within 100ms
- Graph rendering should handle up to 1000 nodes smoothly

### NFR-2: Error Handling
- All API errors should display user-friendly messages
- Network errors should be handled gracefully
- Failed requests should be retryable

### NFR-3: Security
- JWT tokens should be stored securely
- Sensitive data should not be logged
- API calls should use HTTPS in production

### NFR-4: Maintainability
- Code should follow TypeScript best practices
- API services should be modular and testable
- Data transformations should be centralized

---

## 7. Out of Scope

The following are explicitly NOT included in this integration:
- Migrating backend to Supabase
- Implementing real-time updates (WebSocket/SSE)
- Adding new backend API endpoints
- Modifying backend authentication logic
- Implementing offline support
- Adding service workers or PWA features

---

## 8. Dependencies

### External Dependencies:
- Backend server must be running on port 3000
- Backend must have proper CORS configuration
- Backend authentication endpoints must be functional

### Internal Dependencies:
- React 18.3.1
- TypeScript 5.0+
- Vite 6.3.5
- Motion (Framer Motion)
- Radix UI components

---

## 9. Risks and Mitigations

### Risk 1: Data Format Mismatches
**Mitigation**: Create comprehensive transformation layer with unit tests

### Risk 2: Authentication Token Expiration
**Mitigation**: Implement token refresh logic and proper error handling

### Risk 3: CORS Issues
**Mitigation**: Ensure backend CORS is properly configured for development

### Risk 4: Type Safety Issues
**Mitigation**: Define TypeScript interfaces for all API responses

---

## 10. Success Criteria

The integration is considered successful when:
1. ✅ User can log in and access protected routes
2. ✅ Documents can be viewed, created, edited, and deleted
3. ✅ Knowledge graph displays correctly with backend data
4. ✅ AI search returns and displays results
5. ✅ Files can be uploaded successfully
6. ✅ All API calls use correct endpoints and formats
7. ✅ Error handling works consistently across all features
8. ✅ No Supabase dependencies remain in the codebase

---

## 11. Questions for User Confirmation

Before proceeding with implementation, please confirm:

### Q1: API Endpoint Strategy
**Current Plan**: Modify frontend to match existing backend endpoints  
**Confirm**: Is this approach acceptable, or would you prefer to add adapter endpoints on the backend?

### Q2: Authentication Flow
**Current Plan**: Use localStorage for JWT token storage  
**Confirm**: Is this acceptable, or do you prefer a different storage mechanism (sessionStorage, cookies)?

### Q3: Real-time Updates
**Current Plan**: ✅ CONFIRMED - Implement auto-refresh functionality with polling  
**Decision**: Add automatic data refresh for documents and knowledge graph

### Q4: Error Handling Strategy
**Current Plan**: ✅ CONFIRMED - Use modal dialog for error notifications  
**Decision**: Design and implement custom error modal component

### Q5: Data Caching
**Current Plan**: Simple in-memory caching with React state  
**Confirm**: Is this sufficient, or should we implement more sophisticated caching (React Query, SWR)?

### Q6: Testing Requirements
**Current Plan**: ✅ CONFIRMED - Manual + automated integration tests  
**Decision**: Implement comprehensive test suite with Vitest

### Q7: Migration of Old Frontend
**Current Plan**: ✅ CONFIRMED - Delete old frontend  
**Decision**: Remove client/ folder completely

---

## 12. Next Steps

After confirmation:
1. Create design document with detailed technical approach
2. Break down into implementation tasks
3. Implement in phases (Auth → Documents → Graph → AI)
4. Test each phase before moving to next
5. Document any issues or deviations

---

**Document Status**: ✅ Approved - Ready for Design Phase  
**Created**: 2026-02-04  
**Last Updated**: 2026-02-04  
**Author**: Kiro AI Assistant  
**Approved By**: User
