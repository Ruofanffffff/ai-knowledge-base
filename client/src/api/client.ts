import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { showErrorModal } from '../contexts/ErrorContext';
import {
  getAccessToken,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  clearAllTokens,
} from '../utils/storage';

// Get API base URL from environment variables or use default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * HTTP client for API requests
 *
 * Configuration:
 * - Base URL: Configured from VITE_API_BASE_URL environment variable
 * - Timeout: 30 seconds
 * - Default headers: Content-Type application/json
 * - Request interceptor: Adds JWT access_token to Authorization header
 * - Response interceptor: Handles 401 with automatic token refresh + concurrent control
 *
 * Token Refresh:
 * - On 401: automatically calls /api/auth/refresh with refresh_token
 * - Concurrent requests are queued (isRefreshing + failedQueue)
 * - On refresh success: retries original + queued requests with new token
 * - On refresh failure: clears all tokens, redirects to /login
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// --- Concurrent refresh control ---
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (error: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null = null): void {
  failedQueue.forEach(({ resolve, reject }) => {
    if (token) {
      resolve(token);
    } else {
      reject(error);
    }
  });
  failedQueue = [];
}

// Request interceptor - Attach Bearer access_token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Dynamic baseURL configuration
    const serverUrl = localStorage.getItem('serverUrl');
    const baseUrl = serverUrl || import.meta.env.VITE_API_BASE_URL || '/api';
    config.baseURL = baseUrl;

    // Attach access_token from storage
    const token = getAccessToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle 401 with token refresh + other errors
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // --- 401 Token Refresh Logic ---
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Don't intercept 401 for login requests - let the component handle "Wrong Password"
      if (originalRequest.url?.includes('/auth/login')) {
        return Promise.reject(error);
      }

      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((newToken) => {
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
          }
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Use a plain axios instance (not apiClient) to avoid infinite loop
        const { data } = await axios.post('/api/auth/refresh', {
          refresh_token: refreshToken,
        });

        const newAccessToken: string = data.data.accessToken;
        const newRefreshToken: string = data.data.refreshToken;

        setAccessToken(newAccessToken);
        setRefreshToken(newRefreshToken);

        // Resolve all queued requests with the new token
        processQueue(null, newAccessToken);

        // Retry the original request
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Reject all queued requests
        processQueue(refreshError, null);

        // Clear tokens and redirect to login
        clearAllTokens();
        window.location.href = '/login';

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // --- Other error handling (non-401 or already retried) ---
    if (error.response) {
      const status = error.response.status;

      if (status === 403) {
        showErrorModal({
          title: 'Access Denied',
          message: 'You do not have permission to perform this action.',
          type: 'error',
        });
      } else if (status === 404) {
        showErrorModal({
          title: 'Not Found',
          message: 'The requested resource was not found.',
          type: 'warning',
        });
      } else if (status >= 500) {
        showErrorModal({
          title: 'Server Error',
          message: 'An unexpected server error occurred. Please try again later.',
          type: 'error',
        });
      }
    } else if (error.request) {
      showErrorModal({
        title: 'Network Error',
        message: 'Unable to connect to the server. Please check your internet connection.',
        type: 'error',
      });
    }

    return Promise.reject(error);
  }
);

export default apiClient;
