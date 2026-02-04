import apiClient from './client';
import { ApiResponse, LoginRequest, RegisterRequest, AuthResponse, User } from './types';
import { setAuthToken, clearAuthToken } from '../utils/storage';

/**
 * Authentication API Service
 * 
 * Provides functions for user authentication including:
 * - Login with username/password
 * - User registration
 * - Logout
 * - Get current user information
 * - Check authentication status
 * 
 * All functions interact with the backend authentication endpoints
 * and manage JWT token storage in localStorage.
 */
export const authApi = {
  /**
   * Login user
   * POST /api/auth/login
   * 
   * @param credentials - Username and password
   * @returns Promise with token and user data
   * @throws Error if login fails
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/login',
      credentials
    );
    
    if (response.data.success && response.data.data) {
      const { token, user } = response.data.data;
      setAuthToken(token);
      return { token, user };
    }
    
    throw new Error(response.data.error || 'Login failed');
  },

  /**
   * Register new user
   * POST /api/auth/register
   * 
   * @param userData - Username, email, and password
   * @returns Promise with token and user data
   * @throws Error if registration fails
   */
  async register(userData: RegisterRequest): Promise<AuthResponse> {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/register',
      userData
    );
    
    if (response.data.success && response.data.data) {
      const { token, user } = response.data.data;
      setAuthToken(token);
      return { token, user };
    }
    
    throw new Error(response.data.error || 'Registration failed');
  },

  /**
   * Logout user
   * POST /api/auth/logout
   * 
   * Clears the authentication token from localStorage
   * and notifies the backend of the logout.
   * 
   * @returns Promise that resolves when logout is complete
   */
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      // Always clear token, even if the API call fails
      clearAuthToken();
    }
  },

  /**
   * Get current user
   * GET /api/auth/me
   * 
   * Retrieves the currently authenticated user's information
   * using the stored JWT token.
   * 
   * @returns Promise with user data
   * @throws Error if request fails or user is not authenticated
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');
    
    if (response.data.success && response.data.data) {
      return response.data.data;
    }
    
    throw new Error(response.data.error || 'Failed to get user');
  },

  /**
   * Check if user is authenticated
   * 
   * Checks for the presence of an authentication token in localStorage.
   * Note: This only checks if a token exists, not if it's valid.
   * 
   * @returns true if token exists, false otherwise
   */
  isAuthenticated(): boolean {
    const token = localStorage.getItem('auth_token');
    return !!token;
  },
};
