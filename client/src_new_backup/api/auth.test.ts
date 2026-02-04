import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { authApi } from './auth';
import { setAuthToken, clearAuthToken, getAuthToken } from '../utils/storage';
import type { ApiResponse, AuthResponse } from './types';

// Mock the API client
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
      const mockResponse: { data: ApiResponse<AuthResponse> } = {
        data: {
          success: true,
          data: {
            token: 'test-token-123',
            user: {
              id: '1',
              username: 'testuser',
              email: 'test@example.com',
              createdAt: '2024-01-01T00:00:00.000Z',
            },
          },
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      const result = await authApi.login({
        username: 'testuser',
        password: 'password123',
      });

      expect(result.token).toBe('test-token-123');
      expect(result.user.username).toBe('testuser');
      expect(result.user.email).toBe('test@example.com');
      expect(getAuthToken()).toBe('test-token-123');
      expect(apiClient.default.post).toHaveBeenCalledWith(
        '/auth/login',
        { username: 'testuser', password: 'password123' }
      );
    });

    it('should throw error on failed login', async () => {
      const mockResponse: { data: ApiResponse<AuthResponse> } = {
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

    it('should throw default error message when no error provided', async () => {
      const mockResponse: { data: ApiResponse<AuthResponse> } = {
        data: {
          success: false,
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      await expect(
        authApi.login({ username: 'testuser', password: 'wrong' })
      ).rejects.toThrow('Login failed');
    });
  });

  describe('register', () => {
    it('should register successfully and store token', async () => {
      const mockResponse: { data: ApiResponse<AuthResponse> } = {
        data: {
          success: true,
          data: {
            token: 'new-user-token',
            user: {
              id: '2',
              username: 'newuser',
              email: 'new@example.com',
              createdAt: '2024-01-02T00:00:00.000Z',
            },
          },
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      const result = await authApi.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'password123',
      });

      expect(result.token).toBe('new-user-token');
      expect(result.user.username).toBe('newuser');
      expect(getAuthToken()).toBe('new-user-token');
      expect(apiClient.default.post).toHaveBeenCalledWith(
        '/auth/register',
        { username: 'newuser', email: 'new@example.com', password: 'password123' }
      );
    });

    it('should throw error on failed registration', async () => {
      const mockResponse: { data: ApiResponse<AuthResponse> } = {
        data: {
          success: false,
          error: 'Username already exists',
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue(mockResponse);

      await expect(
        authApi.register({
          username: 'existinguser',
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Username already exists');
    });
  });

  describe('logout', () => {
    it('should clear token on successful logout', async () => {
      setAuthToken('test-token');
      expect(getAuthToken()).toBe('test-token');

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockResolvedValue({ data: {} });

      await authApi.logout();

      expect(getAuthToken()).toBeNull();
      expect(apiClient.default.post).toHaveBeenCalledWith('/auth/logout');
    });

    it('should clear token even if API call fails', async () => {
      setAuthToken('test-token');
      expect(getAuthToken()).toBe('test-token');

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.post).mockRejectedValue(new Error('Network error'));

      // Logout will throw but token should still be cleared
      try {
        await authApi.logout();
      } catch (error) {
        // Expected to throw
      }

      expect(getAuthToken()).toBeNull();
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user data', async () => {
      const mockResponse: { data: ApiResponse<any> } = {
        data: {
          success: true,
          data: {
            id: '1',
            username: 'testuser',
            email: 'test@example.com',
            createdAt: '2024-01-01T00:00:00.000Z',
          },
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue(mockResponse);

      const user = await authApi.getCurrentUser();

      expect(user.id).toBe('1');
      expect(user.username).toBe('testuser');
      expect(user.email).toBe('test@example.com');
      expect(apiClient.default.get).toHaveBeenCalledWith('/auth/me');
    });

    it('should throw error when request fails', async () => {
      const mockResponse: { data: ApiResponse<any> } = {
        data: {
          success: false,
          error: 'Unauthorized',
        },
      };

      const apiClient = await import('./client');
      vi.mocked(apiClient.default.get).mockResolvedValue(mockResponse);

      await expect(authApi.getCurrentUser()).rejects.toThrow('Unauthorized');
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

    it('should return false when token is empty string', () => {
      localStorage.setItem('auth_token', '');
      expect(authApi.isAuthenticated()).toBe(false);
    });
  });
});
