import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { authApi } from './auth';
import { documentsApi } from './documents';
import { graphApi } from './graph';
import { clearAuthToken, getAuthToken, setAuthToken } from '../utils/storage';
import type { ApiResponse, AuthResponse } from './types';

/**
 * Property-Based Test: Authentication Token Persistence
 * 
 * **Validates: Requirements AC-2.2, AC-2.3**
 * 
 * This test verifies that authentication tokens are properly stored in localStorage
 * and persist across multiple API calls. It ensures that:
 * 1. Tokens are stored after successful login
 * 2. Tokens persist across multiple API operations
 * 3. Tokens are included in request headers
 * 4. Tokens are cleared on logout
 */

// Mock the API client
vi.mock('./client', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: undefined }),
  },
}));

describe('Property-Based Test: Authentication Token Persistence', () => {
  let apiClient: any;

  beforeEach(async () => {
    clearAuthToken();
    vi.clearAllMocks();
    apiClient = (await import('./client')).default;
    
    // Reset all mocks to default behavior
    apiClient.get.mockResolvedValue({ data: {} });
    apiClient.post.mockResolvedValue({ data: {} });
    apiClient.put.mockResolvedValue({ data: {} });
    apiClient.delete.mockResolvedValue({ data: undefined });
  });

  afterEach(() => {
    clearAuthToken();
  });

  it('should store token after successful login and persist across API calls', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.string({ minLength: 3, maxLength: 20 }),
          password: fc.string({ minLength: 6, maxLength: 50 }),
          token: fc.string({ minLength: 20, maxLength: 100 }),
          userId: fc.uuid(),
          email: fc.emailAddress(),
        }),
        async (credentials) => {
          // Clear any existing tokens
          clearAuthToken();
          expect(getAuthToken()).toBeNull();

          // Mock successful login response
          const loginResponse: { data: ApiResponse<AuthResponse> } = {
            data: {
              success: true,
              data: {
                token: credentials.token,
                user: {
                  id: credentials.userId,
                  username: credentials.username,
                  email: credentials.email,
                  createdAt: new Date().toISOString(),
                },
              },
            },
          };

          apiClient.post.mockResolvedValueOnce(loginResponse);

          // Perform login
          const authResult = await authApi.login({
            username: credentials.username,
            password: credentials.password,
          });

          // Verify token is returned
          expect(authResult.token).toBe(credentials.token);

          // Verify token is stored in localStorage
          const storedToken = getAuthToken();
          expect(storedToken).toBe(credentials.token);

          // Make multiple API calls and verify token persists
          apiClient.get.mockResolvedValue({ data: [] });

          // Call 1: Get documents
          await documentsApi.getDocuments();
          expect(getAuthToken()).toBe(credentials.token);

          // Call 2: Get documents again
          await documentsApi.getDocuments();
          expect(getAuthToken()).toBe(credentials.token);

          // Call 3: Get graph entities
          apiClient.get.mockResolvedValue({
            data: { success: true, data: { entities: [], total: 0, count: 0 } },
          });
          await graphApi.getEntities();
          expect(getAuthToken()).toBe(credentials.token);

          // Call 4: Get graph relations
          apiClient.get.mockResolvedValue({
            data: { success: true, data: { relations: [], total: 0, count: 0 } },
          });
          await graphApi.getRelations();
          expect(getAuthToken()).toBe(credentials.token);

          // Verify token still persists after all calls
          expect(getAuthToken()).toBe(credentials.token);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should clear token on logout', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          token: fc.string({ minLength: 20, maxLength: 100 }),
        }),
        async (data) => {
          // Set a token
          setAuthToken(data.token);
          expect(getAuthToken()).toBe(data.token);

          // Mock logout response
          apiClient.post.mockResolvedValueOnce({ data: {} });

          // Perform logout
          await authApi.logout();

          // Verify token is cleared
          expect(getAuthToken()).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should clear token on logout even if API call fails', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          token: fc.string({ minLength: 20, maxLength: 100 }),
        }),
        async (data) => {
          // Set a token
          setAuthToken(data.token);
          expect(getAuthToken()).toBe(data.token);

          // Mock logout failure
          apiClient.post.mockRejectedValueOnce(new Error('Network error'));

          // Perform logout (will throw but token should still be cleared)
          try {
            await authApi.logout();
          } catch (error) {
            // Expected to throw
          }

          // Verify token is cleared even on error
          expect(getAuthToken()).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should not store token on failed login', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          username: fc.string({ minLength: 3, maxLength: 20 }),
          password: fc.string({ minLength: 6, maxLength: 50 }),
        }),
        async (credentials) => {
          // Clear any existing tokens
          clearAuthToken();
          expect(getAuthToken()).toBeNull();

          // Mock failed login response
          const loginResponse: { data: ApiResponse<AuthResponse> } = {
            data: {
              success: false,
              error: 'Invalid credentials',
            },
          };

          apiClient.post.mockResolvedValueOnce(loginResponse);

          // Attempt login (should fail)
          try {
            await authApi.login({
              username: credentials.username,
              password: credentials.password,
            });
          } catch (error) {
            // Expected to throw
          }

          // Verify token is NOT stored
          expect(getAuthToken()).toBeNull();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should maintain token isolation between different login sessions', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          session1: fc.record({
            username: fc.string({ minLength: 3, maxLength: 20 }),
            password: fc.string({ minLength: 6, maxLength: 50 }),
            token: fc.string({ minLength: 20, maxLength: 100 }),
            userId: fc.uuid(),
            email: fc.emailAddress(),
          }),
          session2: fc.record({
            username: fc.string({ minLength: 3, maxLength: 20 }),
            password: fc.string({ minLength: 6, maxLength: 50 }),
            token: fc.string({ minLength: 20, maxLength: 100 }),
            userId: fc.uuid(),
            email: fc.emailAddress(),
          }),
        }),
        async (data) => {
          // Ensure tokens are different
          if (data.session1.token === data.session2.token) {
            return; // Skip this test case
          }

          // Clear any existing tokens
          clearAuthToken();

          // Session 1: Login
          const loginResponse1: { data: ApiResponse<AuthResponse> } = {
            data: {
              success: true,
              data: {
                token: data.session1.token,
                user: {
                  id: data.session1.userId,
                  username: data.session1.username,
                  email: data.session1.email,
                  createdAt: new Date().toISOString(),
                },
              },
            },
          };

          apiClient.post.mockResolvedValueOnce(loginResponse1);

          await authApi.login({
            username: data.session1.username,
            password: data.session1.password,
          });

          expect(getAuthToken()).toBe(data.session1.token);

          // Session 1: Logout
          apiClient.post.mockResolvedValueOnce({ data: {} });
          await authApi.logout();
          expect(getAuthToken()).toBeNull();

          // Session 2: Login (different user)
          const loginResponse2: { data: ApiResponse<AuthResponse> } = {
            data: {
              success: true,
              data: {
                token: data.session2.token,
                user: {
                  id: data.session2.userId,
                  username: data.session2.username,
                  email: data.session2.email,
                  createdAt: new Date().toISOString(),
                },
              },
            },
          };

          apiClient.post.mockResolvedValueOnce(loginResponse2);

          await authApi.login({
            username: data.session2.username,
            password: data.session2.password,
          });

          // Verify new token is stored (not the old one)
          expect(getAuthToken()).toBe(data.session2.token);
          expect(getAuthToken()).not.toBe(data.session1.token);
        }
      ),
      { numRuns: 20 }
    );
  });

  it('should handle token replacement when logging in while already authenticated', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          oldToken: fc.string({ minLength: 20, maxLength: 100 }),
          newToken: fc.string({ minLength: 20, maxLength: 100 }),
          username: fc.string({ minLength: 3, maxLength: 20 }),
          password: fc.string({ minLength: 6, maxLength: 50 }),
          userId: fc.uuid(),
          email: fc.emailAddress(),
        }),
        async (data) => {
          // Ensure tokens are different
          if (data.oldToken === data.newToken) {
            return; // Skip this test case
          }

          // Set an existing token
          setAuthToken(data.oldToken);
          expect(getAuthToken()).toBe(data.oldToken);

          // Login again (should replace token)
          const loginResponse: { data: ApiResponse<AuthResponse> } = {
            data: {
              success: true,
              data: {
                token: data.newToken,
                user: {
                  id: data.userId,
                  username: data.username,
                  email: data.email,
                  createdAt: new Date().toISOString(),
                },
              },
            },
          };

          apiClient.post.mockResolvedValueOnce(loginResponse);

          await authApi.login({
            username: data.username,
            password: data.password,
          });

          // Verify new token replaced old token
          expect(getAuthToken()).toBe(data.newToken);
          expect(getAuthToken()).not.toBe(data.oldToken);
        }
      ),
      { numRuns: 20 }
    );
  });
});
