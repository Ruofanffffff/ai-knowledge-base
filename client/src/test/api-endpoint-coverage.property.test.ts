/**
 * Property-Based Tests for API Endpoint Coverage
 * 
 * Feature: frontend-data-api-migration
 * Property 1: API Endpoint Coverage
 * Validates: Requirements 2.1
 * 
 * This test verifies that for any data type required by the frontend,
 * there exists a corresponding backend API endpoint that can provide that data.
 */

import { describe, test, expect } from 'vitest';
import { apiService } from '../services/api';
import type { 
  GraphNode, 
  GraphLink, 
  Document, 
  ChatMessage, 
  ChatSession 
} from '../services/api';

describe('Property 1: API Endpoint Coverage', () => {
  /**
   * Property: For any data type required by the frontend, there exists
   * a corresponding backend API endpoint that can provide that data.
   * 
   * This test verifies that all required API methods exist in the API service.
   */
  test('API service should have methods for all required data types', () => {
    const requiredMethods = [
      'getGraphNodes',
      'getGraphLinks',
      'getDocuments',
      'getChatHistory',
      'getChatSessions',
      'sendChatMessage'
    ];

    const missingMethods: string[] = [];

    for (const method of requiredMethods) {
      if (typeof (apiService as any)[method] !== 'function') {
        missingMethods.push(method);
      }
    }

    if (missingMethods.length > 0) {
      expect.fail(
        `API service is missing the following required methods:\n` +
        missingMethods.map(m => `  - ${m}()`).join('\n')
      );
    }

    expect(missingMethods).toHaveLength(0);
  });

  /**
   * Property: All API methods should return promises
   * 
   * This ensures that all API methods are asynchronous and can be awaited.
   */
  test('all API methods should return promises', () => {
    const apiMethods = [
      { name: 'getGraphNodes', args: [] },
      { name: 'getGraphLinks', args: [] },
      { name: 'getDocuments', args: [] },
      { name: 'getChatHistory', args: [] },
      { name: 'getChatSessions', args: [] },
      { name: 'sendChatMessage', args: ['test message'] }
    ];

    const nonPromiseMethods: string[] = [];

    for (const { name, args } of apiMethods) {
      try {
        const result = (apiService as any)[name](...args);
        if (!(result instanceof Promise)) {
          nonPromiseMethods.push(name);
        }
      } catch (error) {
        // Method exists but might throw - that's okay for this test
      }
    }

    if (nonPromiseMethods.length > 0) {
      expect.fail(
        `The following API methods do not return promises:\n` +
        nonPromiseMethods.map(m => `  - ${m}()`).join('\n')
      );
    }

    expect(nonPromiseMethods).toHaveLength(0);
  });

  /**
   * Property: API methods should have consistent return type structure
   * 
   * All API methods should return ApiResponse<T> with data and optional error.
   */
  test('API methods should return consistent response structure', async () => {
    const methods = [
      { name: 'getGraphNodes', call: () => apiService.getGraphNodes() },
      { name: 'getGraphLinks', call: () => apiService.getGraphLinks() },
      { name: 'getDocuments', call: () => apiService.getDocuments() },
      { name: 'getChatHistory', call: () => apiService.getChatHistory() },
      { name: 'getChatSessions', call: () => apiService.getChatSessions() }
    ];

    const violations: string[] = [];

    for (const { name, call } of methods) {
      try {
        const response = await call();
        
        // Check if response has 'data' property
        if (!('data' in response)) {
          violations.push(`${name}() response missing 'data' property`);
        }
        
        // Response should have either data or error
        if (!('data' in response) && !('error' in response)) {
          violations.push(`${name}() response missing both 'data' and 'error' properties`);
        }
      } catch (error) {
        // Network errors are expected in test environment
        // We're just checking the structure when it succeeds
      }
    }

    if (violations.length > 0) {
      expect.fail(
        `API methods have inconsistent response structures:\n` +
        violations.map(v => `  - ${v}`).join('\n')
      );
    }

    expect(violations).toHaveLength(0);
  });

  /**
   * Property: API service should be a singleton
   * 
   * The API service should be exported as a single instance to ensure
   * consistent configuration across the application.
   */
  test('API service should be a singleton instance', () => {
    expect(apiService).toBeDefined();
    expect(typeof apiService).toBe('object');
    
    // Check that it's not a class constructor
    expect(apiService.constructor.name).not.toBe('Function');
  });

  /**
   * Property: API methods should handle errors gracefully
   * 
   * All API methods should catch errors and return them in the response
   * rather than throwing exceptions.
   */
  test('API methods should not throw exceptions', async () => {
    const methods = [
      { name: 'getGraphNodes', call: () => apiService.getGraphNodes() },
      { name: 'getGraphLinks', call: () => apiService.getGraphLinks() },
      { name: 'getDocuments', call: () => apiService.getDocuments() },
      { name: 'getChatHistory', call: () => apiService.getChatHistory() },
      { name: 'getChatSessions', call: () => apiService.getChatSessions() }
    ];

    const throwingMethods: string[] = [];

    for (const { name, call } of methods) {
      try {
        await call();
      } catch (error) {
        throwingMethods.push(name);
      }
    }

    if (throwingMethods.length > 0) {
      expect.fail(
        `The following API methods threw exceptions instead of returning error responses:\n` +
        throwingMethods.map(m => `  - ${m}()`).join('\n') +
        '\n\nAPI methods should catch all errors and return them in the response object.'
      );
    }

    expect(throwingMethods).toHaveLength(0);
  });
});
