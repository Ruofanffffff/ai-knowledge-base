import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import apiClient from './client';

describe('API Client Configuration', () => {
  it('should be an axios instance', () => {
    expect(apiClient).toBeDefined();
    expect(typeof apiClient.get).toBe('function');
    expect(typeof apiClient.post).toBe('function');
    expect(typeof apiClient.put).toBe('function');
    expect(typeof apiClient.delete).toBe('function');
  });

  it('should have correct base URL', () => {
    // In test environment, it should use the default or env variable
    const baseURL = apiClient.defaults.baseURL;
    expect(baseURL).toBeDefined();
    expect(typeof baseURL).toBe('string');
    // Should either be the env variable or the default
    expect(baseURL).toMatch(/\/api$/);
  });

  it('should have 30 second timeout', () => {
    expect(apiClient.defaults.timeout).toBe(30000);
  });

  it('should have correct default headers', () => {
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });
});

describe('Response Interceptor Error Handling', () => {
  let consoleErrorSpy: any;
  let originalLocation: Location;

  beforeEach(() => {
    // Mock console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock window.location
    originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { ...originalLocation, href: '' };
    
    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    (window as any).location = originalLocation;
  });

  it('should handle 401 errors by clearing token and redirecting to login', async () => {
    // Set a token in localStorage
    localStorage.setItem('auth_token', 'test-token');
    
    // Create a mock 401 error
    const error = {
      response: {
        status: 401,
        data: { message: 'Unauthorized' }
      },
      request: {},
      config: {}
    };

    // Get the response interceptor
    const interceptor = (apiClient.interceptors.response as any).handlers[0];
    
    try {
      await interceptor?.rejected(error);
    } catch (e) {
      // Expected to throw
    }

    // Verify token was cleared
    expect(localStorage.getItem('auth_token')).toBeNull();
    
    // Verify redirect to login
    expect(window.location.href).toBe('/login');
    
    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Session Expired',
      'Your session has expired. Please log in again.'
    );
  });

  it('should handle 403 errors by logging access denied', async () => {
    const error = {
      response: {
        status: 403,
        data: { message: 'Forbidden' }
      },
      request: {},
      config: {}
    };

    const interceptor = (apiClient.interceptors.response as any).handlers[0];
    
    try {
      await interceptor?.rejected(error);
    } catch (e) {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Access Denied',
      'You do not have permission to perform this action.'
    );
  });

  it('should handle 404 errors by logging not found', async () => {
    const error = {
      response: {
        status: 404,
        data: { message: 'Not Found' }
      },
      request: {},
      config: {}
    };

    const interceptor = (apiClient.interceptors.response as any).handlers[0];
    
    try {
      await interceptor?.rejected(error);
    } catch (e) {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Not Found',
      'The requested resource was not found.'
    );
  });

  it('should handle 500+ errors by logging server error', async () => {
    const error = {
      response: {
        status: 500,
        data: { message: 'Internal Server Error' }
      },
      request: {},
      config: {}
    };

    const interceptor = (apiClient.interceptors.response as any).handlers[0];
    
    try {
      await interceptor?.rejected(error);
    } catch (e) {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Server Error',
      'An unexpected server error occurred. Please try again later.'
    );
  });

  it('should handle network errors by logging connection error', async () => {
    const error = {
      request: {},
      config: {},
      message: 'Network Error'
    };

    const interceptor = (apiClient.interceptors.response as any).handlers[0];
    
    try {
      await interceptor?.rejected(error);
    } catch (e) {
      // Expected to throw
    }

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Network Error',
      'Unable to connect to the server. Please check your internet connection.'
    );
  });

  it('should pass through successful responses', async () => {
    const response = {
      data: { success: true },
      status: 200,
      statusText: 'OK',
      headers: {} as any,
      config: {
        headers: {} as any
      } as any
    };

    const interceptor = (apiClient.interceptors.response as any).handlers[0];
    const result = await interceptor?.fulfilled(response);

    expect(result).toBe(response);
    expect(consoleErrorSpy).not.toHaveBeenCalled();
  });
});
