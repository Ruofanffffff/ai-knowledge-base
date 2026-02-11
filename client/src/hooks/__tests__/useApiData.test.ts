import { describe, test, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useApiData } from '../useApiData';
import type { ApiResponse } from '../../api/types';

describe('useApiData Hook Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Test loading state transitions
  test('should start with loading true and transition to false after fetch', async () => {
    const mockFetch = vi.fn<[], Promise<ApiResponse<string>>>().mockResolvedValue({
      success: true,
      data: 'test data',
    });

    const { result } = renderHook(() => useApiData(mockFetch, []));

    // Initially loading should be true
    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();

    // Wait for the fetch to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // After fetch, loading should be false and data should be set
    expect(result.current.data).toBe('test data');
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // Test error state handling
  test('should set error state when fetch fails', async () => {
    const errorMessage = 'Failed to fetch data';
    const mockFetch = vi.fn<[], Promise<ApiResponse<string>>>().mockResolvedValue({
      success: false,
      error: errorMessage,
    });

    const { result } = renderHook(() => useApiData(mockFetch, []));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe(errorMessage);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // Test successful data fetch
  test('should set data state when fetch succeeds', async () => {
    const testData = { id: '1', name: 'Test Item' };
    const mockFetch = vi.fn<[], Promise<ApiResponse<typeof testData>>>().mockResolvedValue({
      success: true,
      data: testData,
    });

    const { result } = renderHook(() => useApiData(mockFetch, []));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(testData);
    expect(result.current.error).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  // Test refetch functionality
  test('should refetch data when refetch is called', async () => {
    let callCount = 0;
    const mockFetch = vi.fn<[], Promise<ApiResponse<number>>>().mockImplementation(async () => {
      callCount++;
      return {
        success: true,
        data: callCount,
      };
    });

    const { result } = renderHook(() => useApiData(mockFetch, []));

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Call refetch
    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toBe(2);
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  // Test that refetch sets loading state
  test('should set loading state during refetch', async () => {
    let resolvePromise: (value: ApiResponse<string>) => void;
    const mockFetch = vi.fn<[], Promise<ApiResponse<string>>>().mockImplementation(() => {
      return new Promise((resolve) => {
        resolvePromise = resolve;
      });
    });

    const { result } = renderHook(() => useApiData(mockFetch, []));

    // Resolve initial fetch
    resolvePromise!({ success: true, data: 'test' });

    // Wait for initial fetch
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Start refetch (don't await yet)
    result.current.refetch();

    // Wait for loading to become true
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    // Resolve the refetch
    resolvePromise!({ success: true, data: 'test2' });

    // Loading should be false after refetch
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });

  // Test error handling for thrown exceptions
  test('should handle thrown exceptions gracefully', async () => {
    const mockFetch = vi.fn<[], Promise<ApiResponse<string>>>().mockRejectedValue(
      new Error('Network error')
    );

    const { result } = renderHook(() => useApiData(mockFetch, []));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  // Test that dependencies trigger refetch
  test('should refetch when dependencies change', async () => {
    const mockFetch = vi.fn<[], Promise<ApiResponse<string>>>().mockResolvedValue({
      success: true,
      data: 'test',
    });

    const { rerender } = renderHook(
      ({ deps }) => useApiData(mockFetch, deps),
      { initialProps: { deps: [1] } }
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    // Change dependencies
    rerender({ deps: [2] });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // Test empty array data
  test('should handle empty array data correctly', async () => {
    const mockFetch = vi.fn<[], Promise<ApiResponse<any[]>>>().mockResolvedValue({
      success: true,
      data: [],
    });

    const { result } = renderHook(() => useApiData(mockFetch, []));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  // Test null data handling
  test('should handle null data in error response', async () => {
    const mockFetch = vi.fn<[], Promise<ApiResponse<string>>>().mockResolvedValue({
      success: false,
      error: 'Not found',
    });

    const { result } = renderHook(() => useApiData(mockFetch, []));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Not found');
  });

  // Test error clearing on successful refetch
  test('should clear error on successful refetch', async () => {
    let shouldFail = true;
    const mockFetch = vi.fn<[], Promise<ApiResponse<string>>>().mockImplementation(async () => {
      if (shouldFail) {
        return { success: false, error: 'Error occurred' };
      }
      return { success: true, data: 'success' };
    });

    const { result } = renderHook(() => useApiData(mockFetch, []));

    // Wait for initial fetch (should fail)
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Error occurred');
    expect(result.current.data).toBeNull();

    // Change mock to succeed
    shouldFail = false;

    // Refetch
    await result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toBe('success');
    });

    expect(result.current.error).toBeNull();
  });
});
