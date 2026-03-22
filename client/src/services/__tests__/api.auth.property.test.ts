import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import apiClient from '../../api/client';

describe('API Authentication Property Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  // Feature: frontend-data-api-migration, Property 5: Authentication Token Inclusion
  // For any API call to an authenticated endpoint, the request includes an authentication token
  test('Property 5: API requests include auth token when available', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 20, maxLength: 100 }).filter((t) => !/\s/.test(t)),
        fc.constantFrom('get', 'post', 'put', 'delete'),
        fc.constantFrom('/api/documents', '/api/chat/history', '/api/models', '/api/graph/nodes'),
        async (token, method, endpoint) => {
          // Set token in localStorage
          localStorage.setItem('auth_token', token);

          const originalAdapter = apiClient.defaults.adapter;
          apiClient.defaults.adapter = async (config) => {
            const headers: any = config.headers as any;
            const auth =
              headers && typeof headers.get === 'function'
                ? headers.get('Authorization')
                : headers?.Authorization ?? headers?.authorization;
            expect(auth).toBe(`Bearer ${token}`);
            return {
              data: {},
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
            };
          };
          try {
            await (apiClient as any)[method](endpoint);
          } finally {
            apiClient.defaults.adapter = originalAdapter;
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: frontend-data-api-migration, Property 5: Authentication Token Inclusion
  // Test that requests without token don't have Authorization header
  test('Property 5: API requests without token do not include Authorization header', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom('get', 'post', 'put', 'delete'),
        fc.constantFrom('/api/documents', '/api/chat/history', '/api/models'),
        async (method, endpoint) => {
          // Ensure no token in localStorage
          localStorage.removeItem('auth_token');
          
          // Create a spy on the request interceptor
          const requestSpy = vi.fn((config) => {
            // Check that Authorization header is not set or is undefined
            if (config.headers) {
              const headers: any = config.headers as any;
              const auth =
                typeof headers.get === 'function'
                  ? headers.get('Authorization')
                  : headers.Authorization ?? headers.authorization;
              expect(auth).toBeUndefined();
            }
            return config;
          });
          
          // Add temporary interceptor
          const interceptorId = apiClient.interceptors.request.use(requestSpy);
          
          try {
            const originalAdapter = apiClient.defaults.adapter;
            apiClient.defaults.adapter = async (config) => ({
              data: {},
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
            });
            try {
              await (apiClient as any)[method](endpoint);
              expect(requestSpy).toHaveBeenCalled();
            } finally {
              apiClient.defaults.adapter = originalAdapter;
            }
          } finally {
            // Clean up interceptor
            apiClient.interceptors.request.eject(interceptorId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: frontend-data-api-migration, Property 5: Authentication Token Inclusion
  // Test that token format is always "Bearer {token}"
  test('Property 5: Authorization header uses Bearer token format', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 200 }).filter((t) => !/\s/.test(t)),
        async (token) => {
          localStorage.setItem('auth_token', token);
          
          const requestSpy = vi.fn((config) => {
            const headers: any = config.headers as any;
            const auth = config.headers
              ? typeof headers.get === 'function'
                ? headers.get('Authorization')
                : headers.Authorization ?? headers.authorization
              : undefined;
            if (auth) {
              // Verify Bearer format
              expect(auth).toMatch(/^Bearer .+$/);
              expect(auth).toBe(`Bearer ${token}`);
              
              // Verify no extra spaces or formatting issues
              const parts = auth.split(' ');
              expect(parts).toHaveLength(2);
              expect(parts[0]).toBe('Bearer');
              expect(parts[1]).toBe(token);
            }
            return config;
          });
          
          const interceptorId = apiClient.interceptors.request.use(requestSpy);
          
          try {
            const originalAdapter = apiClient.defaults.adapter;
            apiClient.defaults.adapter = async (config) => ({
              data: {},
              status: 200,
              statusText: 'OK',
              headers: {},
              config,
            });
            try {
              await apiClient.get('/api/test');
              expect(requestSpy).toHaveBeenCalled();
            } finally {
              apiClient.defaults.adapter = originalAdapter;
            }
          } finally {
            apiClient.interceptors.request.eject(interceptorId);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
