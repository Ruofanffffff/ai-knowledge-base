# Implementation Plan: Frontend Data API Migration

## Overview

This implementation plan systematically eliminates hardcoded data from the React + TypeScript frontend by replacing it with API calls to the Express backend. The approach follows a page-by-page migration strategy, starting with infrastructure (API service layer and hooks), then migrating each page (Graph, Documents, Chat, Models, Recommendations), and finally cleaning up demo data and validating the migration.

## Tasks

- [x] 1. Create centralized API service layer
  - Create `client/src/services/api.ts` with ApiService class
  - Define TypeScript interfaces for all data types (GraphNode, GraphLink, Document, ChatMessage, ChatSession, Model, Recommendation)
  - Implement API methods for all endpoints (graph, documents, chat, models, recommendations)
  - Add axios interceptor for authentication token injection
  - Implement consistent error handling with user-friendly messages
  - _Requirements: 2.1, 2.3, 3.2, 3.3, 5.1, 5.4_

- [x] 1.1 Write property test for API service error handling
  - **Property 4: Error Handling Presence**
  - **Validates: Requirements 3.2**

- [x] 1.2 Write property test for authentication token inclusion
  - **Property 5: Authentication Token Inclusion**
  - **Validates: Requirements 3.3**

- [x] 2. Create reusable data fetching hook
  - Create `client/src/hooks/useApiData.ts` with loading, error, and data states
  - Implement refetch functionality for data refresh
  - Add proper TypeScript generics for type safety
  - _Requirements: 4.1, 4.2, 4.3, 5.1_

- [x] 2.1 Write unit tests for useApiData hook
  - Test loading state transitions
  - Test error state handling
  - Test successful data fetch
  - Test refetch functionality
  - _Requirements: 4.1, 4.2, 4.3_

- [x] 3. Create shared UI components for states
  - Create `client/src/components/LoadingSpinner.tsx` for loading states
  - Create `client/src/components/ErrorDisplay.tsx` for error states with retry button
  - Create `client/src/components/EmptyState.tsx` for empty data states
  - Add proper TypeScript props interfaces
  - _Requirements: 4.1, 4.2, 4.4_

- [x] 4. Migrate Graph page to use API
  - [x] 4.1 Update `client/src/pages/Graph.tsx` to use useApiData hook
    - Replace getDemoNodes() with apiService.getGraphNodes()
    - Replace getDemoLinks() with apiService.getGraphLinks()
    - Add loading state with LoadingSpinner component
    - Add error state with ErrorDisplay component
    - Add empty state with EmptyState component
    - _Requirements: 3.1, 4.1, 4.2, 4.3, 4.4, 7.1, 7.2, 7.4_

  - [x] 4.2 Remove demo data functions from Graph.tsx
    - Delete getDemoNodes() function
    - Delete getDemoLinks() function
    - _Requirements: 3.5, 6.1_

  - [x] 4.3 Write integration test for Graph page API integration
    - Test component fetches data on mount
    - Test loading state displays
    - Test error state displays
    - Test empty state displays
    - _Requirements: 3.1, 4.1, 4.2, 4.4_

- [x] 5. Checkpoint - Ensure Graph page works with API
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Migrate Documents page to use API
  - [x] 6.1 Update `client/src/pages/Documents.tsx` to use useApiData hook
    - Replace any hardcoded document data with apiService.getDocuments()
    - Add loading state with LoadingSpinner component
    - Add error state with ErrorDisplay component
    - Add empty state with upload instructions
    - Implement refetch after upload/delete operations
    - _Requirements: 3.1, 4.1, 4.2, 4.3, 4.4, 8.1, 8.3, 8.4_

  - [x] 6.2 Write property test for document metadata display
    - **Property 15: Data Transformation Correctness**
    - **Validates: Requirements 8.2**

  - [x] 6.3 Write property test for operation-triggered refetch
    - **Property 16: Operation-Triggered Refetch**
    - **Validates: Requirements 8.3**

- [x] 7. Migrate Chat page to use API
  - [x] 7.1 Update `client/src/pages/Chat.tsx` to use useApiData hook
    - Replace any hardcoded chat data with apiService.getChatHistory()
    - Fetch chat sessions with apiService.getChatSessions()
    - Implement sendChatMessage with API integration
    - Add loading states for both sessions and messages
    - Add error state with ErrorDisplay component
    - Add empty state with chat instructions
    - Implement refetch after sending messages
    - _Requirements: 3.1, 4.1, 4.2, 4.3, 4.4, 9.1, 9.2, 9.3, 9.4_

  - [x] 7.2 Write property test for message send API integration
    - **Property 17: Message Send API Integration**
    - **Validates: Requirements 9.2**

- [x] 8. Migrate Models page to use API
  - [x] 8.1 Update `client/src/pages/Models.tsx` to use useApiData hook
    - Replace any hardcoded model data with apiService.getModels()
    - Add loading state with LoadingSpinner component
    - Add error state with ErrorDisplay component
    - Add empty state if no models available
    - Implement refetch after model configuration changes
    - _Requirements: 3.1, 4.1, 4.2, 4.3, 4.4, 10.1, 10.3_

- [x] 9. Migrate Recommendations page to use API
  - [x] 9.1 Update `client/src/pages/Recommendations.tsx` to use useApiData hook
    - Replace any hardcoded recommendation data with apiService.getRecommendations()
    - Add loading state with LoadingSpinner component
    - Add error state with ErrorDisplay component
    - Add empty state if no recommendations available
    - _Requirements: 3.1, 4.1, 4.2, 4.3, 4.4, 10.2, 10.4_

  - [x] 9.2 Write property test for real-time results display
    - **Property 18: Real-Time Results Display**
    - **Validates: Requirements 10.4**

- [x] 10. Checkpoint - Ensure all pages work with API
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Audit and remove remaining hardcoded data
  - [x] 11.1 Search codebase for hardcoded data arrays
    - Use grep/search to find const arrays in component files
    - Document any remaining hardcoded data
    - Replace with API calls or remove if unnecessary
    - _Requirements: 3.4, 6.2_

  - [x] 11.2 Search codebase for demo data functions
    - Search for functions with "demo" or "mock" in the name
    - Remove all demo data generation functions
    - _Requirements: 3.5, 6.1_

  - [x] 11.3 Write property test for no hardcoded data arrays
    - **Property 6: No Hardcoded Data Arrays**
    - **Validates: Requirements 3.4, 6.2**

  - [x] 11.4 Write property test for no demo data functions
    - **Property 7: No Demo Data Functions**
    - **Validates: Requirements 3.5, 6.1**

- [x] 12. Add comprehensive property-based tests
  - [x] 12.1 Write property test for API endpoint coverage
    - **Property 1: API Endpoint Coverage**
    - **Validates: Requirements 2.1**

  - [x] 12.2 Write property test for API response type compatibility
    - **Property 2: API Response Type Compatibility**
    - **Validates: Requirements 2.3, 5.2**

  - [x] 12.3 Write property test for component data fetching
    - **Property 3: Component Data Fetching**
    - **Validates: Requirements 3.1, 7.1, 7.2, 8.1, 9.1, 9.3, 10.1, 10.2**

  - [x] 12.4 Write property test for loading state management
    - **Property 8: Loading State Management**
    - **Validates: Requirements 4.1, 4.3**

  - [x] 12.5 Write property test for error state display
    - **Property 9: Error State Display**
    - **Validates: Requirements 4.2**

  - [x] 12.6 Write property test for empty state display
    - **Property 10: Empty State Display**
    - **Validates: Requirements 4.4, 6.3, 7.4, 8.4, 9.4**

  - [x] 12.7 Write property test for loading state interaction prevention
    - **Property 11: Loading State Interaction Prevention**
    - **Validates: Requirements 4.5**

  - [x] 12.8 Write property test for type mismatch handling
    - **Property 12: Type Mismatch Handling**
    - **Validates: Requirements 5.3**

  - [x] 12.9 Write property test for centralized type definitions
    - **Property 13: Centralized Type Definitions**
    - **Validates: Requirements 5.4**

  - [x] 12.10 Write property test for development-only demo data
    - **Property 14: Development-Only Demo Data**
    - **Validates: Requirements 6.4**

- [x] 13. Verify backend API endpoints
  - [x] 13.1 Check that all required API endpoints exist in backend
    - Verify /api/graph/nodes endpoint exists
    - Verify /api/graph/links endpoint exists
    - Verify /api/documents endpoint exists
    - Verify /api/chat/history endpoint exists
    - Verify /api/chat/sessions endpoint exists
    - Verify /api/chat/message endpoint exists
    - Verify /api/models endpoint exists
    - Verify /api/recommendations endpoint exists
    - _Requirements: 2.1_

  - [x] 13.2 Verify API response formats match frontend types
    - Test each endpoint returns data matching TypeScript interfaces
    - Document any mismatches and fix them
    - _Requirements: 2.3, 5.2_

- [x] 14. Final validation and cleanup
  - [x] 14.1 Run all tests and ensure they pass
    - Run unit tests
    - Run property-based tests
    - Run integration tests
    - _Requirements: All_

  - [x] 14.2 Manual testing of all pages
    - Test Graph page with real data
    - Test Documents page with real data
    - Test Chat page with real data
    - Test Models page with real data
    - Test Recommendations page with real data
    - Test loading states appear correctly
    - Test error states appear correctly
    - Test empty states appear correctly
    - _Requirements: All_

  - [x] 14.3 Code review and cleanup
    - Remove any commented-out demo data code
    - Remove unused imports
    - Ensure consistent code style
    - Update any relevant documentation
    - _Requirements: All_

- [x] 15. Final checkpoint - Migration complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across all API integrations
- Unit tests validate specific examples and edge cases for individual components
- The migration follows a systematic approach: infrastructure → pages → cleanup → validation
- All tasks are required for comprehensive migration with full test coverage
