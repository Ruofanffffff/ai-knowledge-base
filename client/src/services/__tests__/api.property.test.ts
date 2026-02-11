import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import apiService from '../api';
import apiClient from '../../api/client';

// Mock the apiClient
vi.mock('../../api/client');

describe('API Service Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Feature: frontend-data-api-migration, Property 4: Error Handling Presence
  // For any API call in the frontend, there exists error handling logic that prevents unhandled promise rejections
  test('Property 4: all API methods handle errors without throwing', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'getGraphNodes',
          'getGraphLinks',
          'getGraphData',
          'getDocuments',
          'getChatHistory',
          'getChatSessions',
          'getModels',
          'getRecommendations'
        ),
        async (methodName) => {
          // Mock network failure
          vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));
          
          // Call the method
          const result = await (apiService as any)[methodName]();
          
          // Should return error response, not throw
          expect(result).toBeDefined();
          expect(result).toHaveProperty('success');
          expect(result.success).toBe(false);
          expect(result).toHaveProperty('error');
          expect(result.error).toBeTruthy();
          expect(typeof result.error).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: frontend-data-api-migration, Property 4: Error Handling Presence
  // Test that error handling works for different error types
  test('Property 4: API methods handle different error types gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          'getGraphNodes',
          'getDocuments',
          'getChatHistory',
          'getModels'
        ),
        fc.constantFrom(
          { response: { status: 404, statusText: 'Not Found', data: { message: 'Resource not found' } } },
          { response: { status: 500, statusText: 'Internal Server Error', data: {} } },
          { request: {}, message: 'Network Error' },
          { message: 'Timeout error' }
        ),
        async (methodName, errorType) => {
          // Mock different error types
          vi.mocked(apiClient.get).mockRejectedValue(errorType);
          
          // Call the method
          const result = await (apiService as any)[methodName]();
          
          // Should handle all error types gracefully
          expect(result.success).toBe(false);
          expect(result.error).toBeTruthy();
          expect(typeof result.error).toBe('string');
          expect(result.error.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: frontend-data-api-migration, Property 4: Error Handling Presence
  // Test that successful responses don't have errors
  test('Property 4: successful API calls return success without errors', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          { method: 'getGraphNodes', mockData: { nodes: [] } },
          { method: 'getDocuments', mockData: [] },
          { method: 'getChatHistory', mockData: { messages: [] } },
          { method: 'getModels', mockData: { models: [] } }
        ),
        async ({ method, mockData }) => {
          // Mock successful response
          vi.mocked(apiClient.get).mockResolvedValue({ data: mockData });
          
          // Call the method
          const result = await (apiService as any)[method]();
          
          // Should return success without error
          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();
          expect(result.error).toBeUndefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: frontend-data-api-migration, Property 2: API Response Type Compatibility
  // Test that API responses are transformed to match expected types
  test('Property 2: API responses match expected TypeScript interfaces', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.string(),
          label: fc.string(),
          type: fc.string(),
        }),
        async (mockNode) => {
          // Mock backend response with different field names
          vi.mocked(apiClient.get).mockResolvedValue({
            data: {
              nodes: [{
                entity_id: mockNode.id,
                canonical_name: mockNode.label,
                type: mockNode.type,
              }],
            },
          });
          
          const result = await apiService.getGraphNodes();
          
          // Should transform to frontend format
          expect(result.success).toBe(true);
          expect(result.data).toBeDefined();
          expect(Array.isArray(result.data)).toBe(true);
          
          if (result.data && result.data.length > 0) {
            const node = result.data[0];
            expect(node).toHaveProperty('id');
            expect(node).toHaveProperty('label');
            expect(node).toHaveProperty('type');
            expect(node.id).toBe(mockNode.id);
            expect(node.label).toBe(mockNode.label);
            expect(node.type).toBe(mockNode.type);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
