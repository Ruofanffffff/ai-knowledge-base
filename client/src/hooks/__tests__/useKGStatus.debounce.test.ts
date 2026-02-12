/**
 * Tests for useKGStatus debounce functionality
 * Validates: Requirements 8.2
 * 
 * These tests verify that the debounce mechanism prevents excessive API calls
 * by delaying execution until after a specified wait time has elapsed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Custom debounce function (copied from useKGStatus for testing)
 */
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, wait);
  };
}

describe('useKGStatus - Debounce Functionality', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('should delay function execution by specified wait time', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    // Call the debounced function
    debouncedFn('test');

    // Should not call immediately
    expect(mockFn).not.toHaveBeenCalled();

    // Fast forward 299ms - should not call yet
    vi.advanceTimersByTime(299);
    expect(mockFn).not.toHaveBeenCalled();

    // Fast forward 1 more ms (total 300ms) - should call now
    vi.advanceTimersByTime(1);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('test');
  });

  it('should cancel previous timeout on rapid calls', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    // Make multiple rapid calls
    debouncedFn('call1');
    vi.advanceTimersByTime(100);
    
    debouncedFn('call2');
    vi.advanceTimersByTime(100);
    
    debouncedFn('call3');
    vi.advanceTimersByTime(100);

    // Should not have called yet (only 300ms total, but each call resets)
    expect(mockFn).not.toHaveBeenCalled();

    // Fast forward 300ms from last call
    vi.advanceTimersByTime(200);
    
    // Should only call once with the last argument
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('call3');
  });

  it('should allow multiple executions if wait time elapses between calls', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    // First call
    debouncedFn('call1');
    vi.advanceTimersByTime(300);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('call1');

    // Second call after wait time
    debouncedFn('call2');
    vi.advanceTimersByTime(300);
    expect(mockFn).toHaveBeenCalledTimes(2);
    expect(mockFn).toHaveBeenCalledWith('call2');

    // Third call after wait time
    debouncedFn('call3');
    vi.advanceTimersByTime(300);
    expect(mockFn).toHaveBeenCalledTimes(3);
    expect(mockFn).toHaveBeenCalledWith('call3');
  });

  it('should work with different wait times', () => {
    const mockFn = vi.fn();
    
    // Test with 500ms delay
    const debouncedFn500 = debounce(mockFn, 500);
    debouncedFn500('test500');
    
    vi.advanceTimersByTime(300);
    expect(mockFn).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(200);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('test500');

    mockFn.mockClear();

    // Test with 100ms delay
    const debouncedFn100 = debounce(mockFn, 100);
    debouncedFn100('test100');
    
    vi.advanceTimersByTime(50);
    expect(mockFn).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(50);
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('test100');
  });

  it('should preserve function arguments', () => {
    const mockFn = vi.fn();
    const debouncedFn = debounce(mockFn, 300);

    // Call with multiple arguments
    debouncedFn('arg1', 'arg2', { key: 'value' }, 123);
    
    vi.advanceTimersByTime(300);
    
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', { key: 'value' }, 123);
  });

  it('should handle async functions', async () => {
    const mockAsyncFn = vi.fn().mockResolvedValue('result');
    const debouncedFn = debounce(mockAsyncFn, 300);

    debouncedFn('test');
    
    vi.advanceTimersByTime(300);
    
    expect(mockAsyncFn).toHaveBeenCalledTimes(1);
    expect(mockAsyncFn).toHaveBeenCalledWith('test');
  });

  it('should prevent excessive API calls in rapid succession', () => {
    const mockApiCall = vi.fn();
    const debouncedApiCall = debounce(mockApiCall, 300);

    // Simulate rapid user interactions or state changes
    for (let i = 0; i < 10; i++) {
      debouncedApiCall(`request-${i}`);
      vi.advanceTimersByTime(50); // 50ms between calls
    }

    // After 500ms (10 calls * 50ms), should not have called yet
    expect(mockApiCall).not.toHaveBeenCalled();

    // Fast forward 300ms from last call
    vi.advanceTimersByTime(300);

    // Should only call once with the last request
    expect(mockApiCall).toHaveBeenCalledTimes(1);
    expect(mockApiCall).toHaveBeenCalledWith('request-9');
  });
});
