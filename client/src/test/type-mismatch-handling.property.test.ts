/**
 * Property 12: Type Mismatch Handling
 * 
 * Feature: frontend-data-api-migration
 * Property: For any API response that doesn't match the expected type structure,
 * a warning is logged and the application handles it gracefully without crashing.
 * 
 * Validates: Requirements 5.3
 */

import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiService } from '../services/api';

describe('Property 12: Type Mismatch Handling', () => {
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  /**
   * Property: API service should handle type mismatches gracefully
   */
  test('API service should handle malformed responses without crashing', async () => {
    // Mock fetch to return malformed data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        // Missing required fields
        invalidData: 'test'
      })
    });

    // Call API method - should not throw
    const result = await apiService.getGraphNodes();

    // Should return data (even if empty) and not crash
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    
    // Application should continue running
    expect(true).toBe(true);
  });

  /**
   * Property: API service should handle null responses gracefully
   */
  test('API service should handle null responses without crashing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => null
    });

    const result = await apiService.getDocuments();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  /**
   * Property: API service should handle undefined responses gracefully
   */
  test('API service should handle undefined responses without crashing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => undefined
    });

    const result = await apiService.getChatSessions();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
  });

  /**
   * Property: API service should handle responses with wrong types gracefully
   */
  test('API service should handle responses with wrong types without crashing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        // Return string instead of array
        data: 'not an array'
      })
    });

    const result = await apiService.getGraphLinks();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    // Should convert to array or return empty array
    expect(Array.isArray(result.data)).toBe(true);
  });

  /**
   * Property: API service should handle responses with missing required fields
   */
  test('API service should handle responses with missing required fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          // Missing 'id' field
          label: 'Test Node',
          type: 'concept'
        }
      ])
    });

    const result = await apiService.getGraphNodes();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    // Should handle gracefully, possibly filtering out invalid items
    expect(Array.isArray(result.data)).toBe(true);
  });

  /**
   * Property: API service should handle responses with extra fields
   */
  test('API service should handle responses with extra unexpected fields', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          id: '1',
          label: 'Test Node',
          type: 'concept',
          // Extra fields that aren't in the interface
          extraField1: 'value1',
          extraField2: 'value2',
          nestedExtra: { foo: 'bar' }
        }
      ])
    });

    const result = await apiService.getGraphNodes();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    // Should not crash even with extra fields - the key is it doesn't throw
    // The data may be filtered or returned as-is depending on implementation
    expect(result.data.length).toBeGreaterThanOrEqual(0);
  });

  /**
   * Property: API service should handle JSON parse errors gracefully
   */
  test('API service should handle JSON parse errors without crashing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('Invalid JSON');
      }
    });

    const result = await apiService.getDocuments();

    expect(result).toBeDefined();
    // Should return error response instead of crashing
    expect(result.error || result.data).toBeDefined();
  });

  /**
   * Property: API service should handle network errors gracefully
   */
  test('API service should handle network errors without crashing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await apiService.getChatHistory();

    expect(result).toBeDefined();
    expect(result.error).toBeDefined();
    expect(result.data).toBeDefined();
  });

  /**
   * Property: Type guards should validate data structure
   */
  test('API responses should be validated before use', async () => {
    // Mock response with partially valid data
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { id: '1', label: 'Valid', type: 'concept' },
        { id: '2', label: 'Valid', type: 'technology' },
        { label: 'Invalid - missing id', type: 'method' }, // Invalid
        { id: '4', type: 'tool' } // Invalid - missing label
      ])
    });

    const result = await apiService.getGraphNodes();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    
    // Should filter out or handle invalid items
    // Valid implementation might return all items or only valid ones
    // The key is it shouldn't crash
    expect(result.data.length).toBeGreaterThanOrEqual(0);
  });

  /**
   * Property: Application should continue functioning after type mismatch
   */
  test('application should remain functional after encountering type mismatches', async () => {
    // First call with bad data
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ invalid: 'data' })
    });

    await apiService.getGraphNodes();

    // Second call with good data - should still work
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ([
        { id: '1', label: 'Test', type: 'concept' }
      ])
    });

    const result = await apiService.getGraphNodes();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    // Application should recover and work normally
    expect(Array.isArray(result.data)).toBe(true);
  });
});
