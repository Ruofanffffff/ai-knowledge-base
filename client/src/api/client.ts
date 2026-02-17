import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { showErrorModal } from '../contexts/ErrorContext';

// Get API base URL from environment variables or use default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * HTTP client for API requests
 * 
 * Configuration:
 * - Base URL: Configured from VITE_API_BASE_URL environment variable
 * - Timeout: 30 seconds
 * - Default headers: Content-Type application/json
 * - Request interceptor: Adds JWT token to Authorization header
 * - Response interceptor: Handles API errors consistently
 * 
 * Error Handling:
 * - 401 Unauthorized: Clears token, redirects to login, shows warning modal
 * - 403 Forbidden: Shows access denied error modal
 * - 404 Not Found: Shows not found warning modal
 * - 500+ Server Error: Shows server error modal
 * - Network errors: Shows connection error modal
 * 
 * All errors are displayed to users via the ErrorModal component.
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add authentication token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Dynamic baseURL configuration
    const serverUrl = localStorage.getItem('serverUrl');
    const baseUrl = serverUrl || import.meta.env.VITE_API_BASE_URL || '/api';
    config.baseURL = baseUrl;

    // Get token directly from localStorage (storage utilities will be created in task 5.1)
    const token = localStorage.getItem('auth_token');
    
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      
      // Handle 401 Unauthorized - Token expired or invalid
      if (status === 401) {
        // Clear token directly with localStorage
        localStorage.removeItem('auth_token');
        
        // Redirect to login page
        window.location.href = '/login';
        
        showErrorModal({
          title: 'Session Expired',
          message: 'Your session has expired. Please log in again.',
          type: 'warning',
        });
      }
      
      // Handle 403 Forbidden - Access denied
      else if (status === 403) {
        showErrorModal({
          title: 'Access Denied',
          message: 'You do not have permission to perform this action.',
          type: 'error',
        });
      }
      
      // Handle 404 Not Found
      else if (status === 404) {
        showErrorModal({
          title: 'Not Found',
          message: 'The requested resource was not found.',
          type: 'warning',
        });
      }
      
      // Handle 500+ Server Error
      else if (status >= 500) {
        showErrorModal({
          title: 'Server Error',
          message: 'An unexpected server error occurred. Please try again later.',
          type: 'error',
        });
      }
    } else if (error.request) {
      // Network error - request was made but no response received
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
