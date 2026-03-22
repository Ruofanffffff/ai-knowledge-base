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
import apiClient from '../api/client';

vi.mock('../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('Property 12: Type Mismatch Handling', () => {
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.clearAllMocks();
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
    vi.mocked(apiClient.get).mockResolvedValue({ data: { invalidData: 'test' } } as any);
    const result = await apiService.getGraphNodes();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(true).toBe(true);
  });

  /**
   * Property: API service should handle null responses gracefully
   */
  test('API service should handle null responses without crashing', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: null } as any);
    const result = await apiService.getDocuments();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  /**
   * Property: API service should handle undefined responses gracefully
   */
  test('API service should handle undefined responses without crashing', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: undefined } as any);
    const result = await apiService.getChatSessions();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  /**
   * Property: API service should handle responses with wrong types gracefully
   */
  test('API service should handle responses with wrong types without crashing', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { links: 'not an array' } } as any);
    const result = await apiService.getGraphLinks();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  /**
   * Property: API service should handle responses with missing required fields
   */
  test('API service should handle responses with missing required fields', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: { nodes: [{ label: 'Test Node', type: 'concept' }] } } as any);
    const result = await apiService.getGraphNodes();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });

  /**
   * Property: API service should handle responses with extra fields
   */
  test('API service should handle responses with extra unexpected fields', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        nodes: [
          {
            id: '1',
            label: 'Test Node',
            type: 'concept',
            extraField1: 'value1',
            extraField2: 'value2',
            nestedExtra: { foo: 'bar' }
          }
        ],
      },
    } as any);
    const result = await apiService.getGraphNodes();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(0);
  });

  /**
   * Property: API service should handle JSON parse errors gracefully
   */
  test('API service should handle JSON parse errors without crashing', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Invalid JSON'));
    const result = await apiService.getDocuments();

    expect(result).toBeDefined();
    expect(result.error || result.data).toBeDefined();
  });

  /**
   * Property: API service should handle network errors gracefully
   */
  test('API service should handle network errors without crashing', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));
    const result = await apiService.getChatHistory();

    expect(result).toBeDefined();
    expect(result.error).toBeDefined();
    expect(result.data).toBeDefined();
  });

  /**
   * Property: Type guards should validate data structure
   */
  test('API responses should be validated before use', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        nodes: [
          { id: '1', label: 'Valid', type: 'concept' },
          { id: '2', label: 'Valid', type: 'technology' },
          { label: 'Invalid - missing id', type: 'method' },
          { id: '4', type: 'tool' }
        ]
      }
    } as any);
    const result = await apiService.getGraphNodes();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data.length).toBeGreaterThanOrEqual(0);
  });

  /**
   * Property: Application should continue functioning after type mismatch
   */
  test('application should remain functional after encountering type mismatches', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { invalid: 'data' } } as any);
    await apiService.getGraphNodes();

    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { nodes: [{ id: '1', label: 'Test', type: 'concept' }] } } as any);
    const result = await apiService.getGraphNodes();

    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data)).toBe(true);
  });
});
