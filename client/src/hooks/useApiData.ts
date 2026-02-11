import { useState, useEffect, useCallback } from 'react';
import type { ApiResponse } from '../api/types';

/**
 * Result type for the useApiData hook
 */
export interface UseApiDataResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Custom hook for fetching data from API with loading and error states
 * 
 * @param fetchFunction - Async function that returns an ApiResponse
 * @param dependencies - Array of dependencies that trigger refetch when changed
 * @returns Object containing data, loading state, error state, and refetch function
 * 
 * @example
 * ```typescript
 * const { data, loading, error, refetch } = useApiData(
 *   () => apiService.getDocuments(),
 *   []
 * );
 * ```
 */
export function useApiData<T>(
  fetchFunction: () => Promise<ApiResponse<T>>,
  dependencies: any[] = []
): UseApiDataResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetchFunction();
      
      if (response.success && response.data !== undefined) {
        setData(response.data);
        setError(null);
      } else {
        setError(response.error || 'An unexpected error occurred');
        setData(null);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [fetchFunction]);

  useEffect(() => {
    fetchData();
  }, dependencies);

  return { 
    data, 
    loading, 
    error, 
    refetch: fetchData 
  };
}

export default useApiData;
