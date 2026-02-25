import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearAllTokens,
  getUserData,
  setUserData,
  clearUserData,
  getAuthToken,
  setAuthToken,
  clearAuthToken,
  isAuthenticated,
} from '../storage';

// Replace the global mock with a real in-memory localStorage for storage tests
const store: Record<string, string> = {};

beforeEach(() => {
  // Clear the backing store
  Object.keys(store).forEach((k) => delete store[k]);

  // Wire up localStorage methods to the backing store
  (localStorage.getItem as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string) => store[key] ?? null,
  );
  (localStorage.setItem as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string, value: string) => { store[key] = value; },
  );
  (localStorage.removeItem as ReturnType<typeof vi.fn>).mockImplementation(
    (key: string) => { delete store[key]; },
  );
  (localStorage.clear as ReturnType<typeof vi.fn>).mockImplementation(() => {
    Object.keys(store).forEach((k) => delete store[k]);
  });
});

describe('Dual Token Storage', () => {
  describe('getAccessToken', () => {
    it('returns null when no token exists', () => {
      expect(getAccessToken()).toBeNull();
    });

    it('returns token from access_token key', () => {
      store['access_token'] = 'new-jwt';
      expect(getAccessToken()).toBe('new-jwt');
    });

    it('falls back to legacy auth_token key', () => {
      store['auth_token'] = 'legacy-jwt';
      expect(getAccessToken()).toBe('legacy-jwt');
    });

    it('prefers access_token over legacy auth_token', () => {
      store['access_token'] = 'new-jwt';
      store['auth_token'] = 'legacy-jwt';
      expect(getAccessToken()).toBe('new-jwt');
    });
  });

  describe('setAccessToken', () => {
    it('stores token under access_token key', () => {
      setAccessToken('my-token');
      expect(store['access_token']).toBe('my-token');
    });

    it('removes legacy auth_token key', () => {
      store['auth_token'] = 'old';
      setAccessToken('new');
      expect(store['auth_token']).toBeUndefined();
      expect(store['access_token']).toBe('new');
    });
  });

  describe('getRefreshToken / setRefreshToken', () => {
    it('returns null when no refresh token exists', () => {
      expect(getRefreshToken()).toBeNull();
    });

    it('stores and retrieves refresh token', () => {
      setRefreshToken('rt-123');
      expect(getRefreshToken()).toBe('rt-123');
    });
  });

  describe('clearAllTokens', () => {
    it('clears access_token, refresh_token, user_data, and legacy auth_token', () => {
      store['access_token'] = 'at';
      store['refresh_token'] = 'rt';
      store['user_data'] = '{}';
      store['auth_token'] = 'legacy';

      clearAllTokens();

      expect(store['access_token']).toBeUndefined();
      expect(store['refresh_token']).toBeUndefined();
      expect(store['user_data']).toBeUndefined();
      expect(store['auth_token']).toBeUndefined();
    });
  });
});

describe('User Data Storage', () => {
  describe('getUserData', () => {
    it('returns null when no data exists', () => {
      expect(getUserData()).toBeNull();
    });

    it('parses and returns stored JSON', () => {
      store['user_data'] = JSON.stringify({ id: '1', name: 'Alice' });
      expect(getUserData()).toEqual({ id: '1', name: 'Alice' });
    });

    it('returns null and cleans up on invalid JSON', () => {
      store['user_data'] = 'not-json';
      expect(getUserData()).toBeNull();
      expect(store['user_data']).toBeUndefined();
    });
  });

  describe('setUserData', () => {
    it('stores user data as JSON string', () => {
      setUserData({ id: '2', email: 'bob@test.com' });
      expect(JSON.parse(store['user_data'])).toEqual({ id: '2', email: 'bob@test.com' });
    });
  });

  describe('clearUserData', () => {
    it('removes user_data from localStorage', () => {
      store['user_data'] = '{}';
      clearUserData();
      expect(store['user_data']).toBeUndefined();
    });
  });
});

describe('Legacy API wrappers', () => {
  it('getAuthToken delegates to getAccessToken', () => {
    setAccessToken('tok');
    expect(getAuthToken()).toBe('tok');
  });

  it('setAuthToken delegates to setAccessToken', () => {
    setAuthToken('tok2');
    expect(store['access_token']).toBe('tok2');
    expect(store['auth_token']).toBeUndefined();
  });

  it('clearAuthToken delegates to clearAllTokens', () => {
    setAccessToken('a');
    setRefreshToken('r');
    setUserData({ x: 1 });
    clearAuthToken();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(getUserData()).toBeNull();
  });
});

describe('isAuthenticated', () => {
  it('returns false when no token', () => {
    expect(isAuthenticated()).toBe(false);
  });

  it('returns true when access_token exists', () => {
    setAccessToken('jwt');
    expect(isAuthenticated()).toBe(true);
  });

  it('returns true when only legacy auth_token exists', () => {
    store['auth_token'] = 'legacy';
    expect(isAuthenticated()).toBe(true);
  });
});
