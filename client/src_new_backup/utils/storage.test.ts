import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  getUserData,
  setUserData,
  isAuthenticated,
} from './storage';

describe('storage utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    // Clean up after each test
    localStorage.clear();
  });

  describe('getAuthToken', () => {
    it('should return null when no token is stored', () => {
      expect(getAuthToken()).toBeNull();
    });

    it('should return stored token', () => {
      localStorage.setItem('auth_token', 'test-token-123');
      expect(getAuthToken()).toBe('test-token-123');
    });

    it('should return empty string if token is empty', () => {
      localStorage.setItem('auth_token', '');
      expect(getAuthToken()).toBe('');
    });
  });

  describe('setAuthToken', () => {
    it('should store token in localStorage', () => {
      setAuthToken('my-token');
      expect(localStorage.getItem('auth_token')).toBe('my-token');
    });

    it('should overwrite existing token', () => {
      setAuthToken('old-token');
      setAuthToken('new-token');
      expect(localStorage.getItem('auth_token')).toBe('new-token');
    });

    it('should store empty string token', () => {
      setAuthToken('');
      expect(localStorage.getItem('auth_token')).toBe('');
    });
  });

  describe('clearAuthToken', () => {
    it('should remove auth token from localStorage', () => {
      localStorage.setItem('auth_token', 'test-token');
      clearAuthToken();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });

    it('should remove user data from localStorage', () => {
      localStorage.setItem('user_data', JSON.stringify({ id: '1', username: 'test' }));
      clearAuthToken();
      expect(localStorage.getItem('user_data')).toBeNull();
    });

    it('should remove both token and user data', () => {
      localStorage.setItem('auth_token', 'test-token');
      localStorage.setItem('user_data', JSON.stringify({ id: '1' }));
      
      clearAuthToken();
      
      expect(localStorage.getItem('auth_token')).toBeNull();
      expect(localStorage.getItem('user_data')).toBeNull();
    });

    it('should not throw error when nothing is stored', () => {
      expect(() => clearAuthToken()).not.toThrow();
    });
  });

  describe('getUserData', () => {
    it('should return null when no user data is stored', () => {
      expect(getUserData()).toBeNull();
    });

    it('should return parsed user data', () => {
      const userData = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
      };
      localStorage.setItem('user_data', JSON.stringify(userData));
      
      expect(getUserData()).toEqual(userData);
    });

    it('should handle complex user data objects', () => {
      const userData = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
        profile: {
          firstName: 'Test',
          lastName: 'User',
          preferences: {
            theme: 'dark',
            language: 'en',
          },
        },
      };
      localStorage.setItem('user_data', JSON.stringify(userData));
      
      expect(getUserData()).toEqual(userData);
    });

    it('should return null for invalid JSON', () => {
      localStorage.setItem('user_data', 'invalid-json{');
      expect(getUserData()).toBeNull();
    });
  });

  describe('setUserData', () => {
    it('should store user data as JSON string', () => {
      const userData = {
        id: '1',
        username: 'testuser',
        email: 'test@example.com',
      };
      
      setUserData(userData);
      
      const stored = localStorage.getItem('user_data');
      expect(stored).toBe(JSON.stringify(userData));
      expect(JSON.parse(stored!)).toEqual(userData);
    });

    it('should overwrite existing user data', () => {
      const oldData = { id: '1', username: 'old' };
      const newData = { id: '2', username: 'new' };
      
      setUserData(oldData);
      setUserData(newData);
      
      expect(getUserData()).toEqual(newData);
    });

    it('should handle nested objects', () => {
      const userData = {
        id: '1',
        profile: {
          settings: {
            notifications: true,
          },
        },
      };
      
      setUserData(userData);
      expect(getUserData()).toEqual(userData);
    });

    it('should handle arrays in user data', () => {
      const userData = {
        id: '1',
        roles: ['admin', 'user'],
        permissions: ['read', 'write', 'delete'],
      };
      
      setUserData(userData);
      expect(getUserData()).toEqual(userData);
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no token is stored', () => {
      expect(isAuthenticated()).toBe(false);
    });

    it('should return true when token is stored', () => {
      setAuthToken('test-token');
      expect(isAuthenticated()).toBe(true);
    });

    it('should return false when token is empty string', () => {
      setAuthToken('');
      expect(isAuthenticated()).toBe(false);
    });

    it('should return false after token is cleared', () => {
      setAuthToken('test-token');
      expect(isAuthenticated()).toBe(true);
      
      clearAuthToken();
      expect(isAuthenticated()).toBe(false);
    });

    it('should return true for any non-empty token', () => {
      setAuthToken('a');
      expect(isAuthenticated()).toBe(true);
      
      setAuthToken('very-long-token-string-with-many-characters');
      expect(isAuthenticated()).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete login flow', () => {
      // Initial state - not authenticated
      expect(isAuthenticated()).toBe(false);
      expect(getAuthToken()).toBeNull();
      expect(getUserData()).toBeNull();
      
      // Login - store token and user data
      const token = 'login-token-123';
      const user = { id: '1', username: 'testuser', email: 'test@example.com' };
      setAuthToken(token);
      setUserData(user);
      
      // Verify authenticated state
      expect(isAuthenticated()).toBe(true);
      expect(getAuthToken()).toBe(token);
      expect(getUserData()).toEqual(user);
    });

    it('should handle complete logout flow', () => {
      // Setup authenticated state
      setAuthToken('token');
      setUserData({ id: '1', username: 'user' });
      expect(isAuthenticated()).toBe(true);
      
      // Logout - clear all data
      clearAuthToken();
      
      // Verify logged out state
      expect(isAuthenticated()).toBe(false);
      expect(getAuthToken()).toBeNull();
      expect(getUserData()).toBeNull();
    });

    it('should handle token refresh scenario', () => {
      // Initial login
      setAuthToken('old-token');
      setUserData({ id: '1', username: 'user' });
      
      // Token refresh - update token but keep user data
      setAuthToken('new-token');
      
      // Verify token updated but user data preserved
      expect(getAuthToken()).toBe('new-token');
      expect(getUserData()).toEqual({ id: '1', username: 'user' });
    });

    it('should handle user data update scenario', () => {
      // Initial state
      setAuthToken('token');
      setUserData({ id: '1', username: 'user', email: 'old@example.com' });
      
      // Update user data
      setUserData({ id: '1', username: 'user', email: 'new@example.com', verified: true });
      
      // Verify token preserved and user data updated
      expect(getAuthToken()).toBe('token');
      expect(getUserData()).toEqual({
        id: '1',
        username: 'user',
        email: 'new@example.com',
        verified: true,
      });
    });
  });
});
