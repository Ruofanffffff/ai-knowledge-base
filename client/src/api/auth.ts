import apiClient from './client';
import {
  ApiResponse,
  LoginRequest,
  RegisterRequest,
  EmailRegisterRequest,
  AuthResponse,
  RefreshResponse,
  User,
  UserRole,
  PermissionCheckResult,
} from './types';
import { setAuthToken, clearAuthToken, getAccessToken } from '../utils/storage';

/**
 * Authentication API Service (Legacy)
 *
 * Kept for backward compatibility with existing callers.
 */
export const authApi = {
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/login',
      credentials
    );

    if (response.data.success && response.data.data) {
      const { user, accessToken } = response.data.data;
      if (accessToken) {
        setAuthToken(accessToken);
        return { token: accessToken, user } as unknown as AuthResponse;
      }
    }

    throw new Error(response.data.error || 'Login failed');
  },

  async register(userData: RegisterRequest): Promise<{ user: User }> {
    const response = await apiClient.post<ApiResponse<User>>(
      '/auth/register',
      userData
    );

    if (response.data.success && response.data.data) {
      return { user: response.data.data };
    }

    throw new Error(response.data.error || 'Registration failed');
  },

  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearAuthToken();
    }
  },

  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<ApiResponse<User>>('/auth/me');

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.error || 'Failed to get user');
  },

  isAuthenticated(): boolean {
    return !!getAccessToken();
  },
};

// =============================================
// New Authen API Functions
// =============================================

/**
 * Login via Authen Gateway
 * POST /api/auth/login
 */
export async function loginApi(credentials: LoginRequest): Promise<AuthResponse> {
  try {
    const response = await apiClient.post<ApiResponse<AuthResponse>>(
      '/auth/login',
      credentials
    );

    if (response.data.success && response.data.data) {
      return response.data.data;
    }

    throw new Error(response.data.error || 'Login failed');
  } catch (err: any) {
    // Extract error message from backend response
    const msg = err?.response?.data?.error || err?.response?.data?.detail || err?.message || '登录失败，请检查邮箱和密码';
    throw new Error(msg);
  }
}

/**
 * Register by email via Authen Gateway
 * POST /api/auth/register/email
 */
export async function registerByEmailApi(data: EmailRegisterRequest): Promise<AuthResponse> {
  const response = await apiClient.post<ApiResponse<AuthResponse>>(
    '/auth/register/email',
    data
  );

  if (response.data.success && response.data.data) {
    return response.data.data;
  }

  throw new Error(response.data.error || 'Registration failed');
}

/**
 * Refresh access token via Authen Gateway
 * POST /api/auth/refresh
 */
export async function refreshTokenApi(refreshToken: string): Promise<RefreshResponse> {
  const response = await apiClient.post<ApiResponse<RefreshResponse>>(
    '/auth/refresh',
    { refresh_token: refreshToken }
  );

  if (response.data.success && response.data.data) {
    return response.data.data;
  }

  throw new Error(response.data.error || 'Token refresh failed');
}

/**
 * Get current user info via Authen Gateway
 * GET /api/auth/me
 */
export async function getMeApi(): Promise<User> {
  const response = await apiClient.get<ApiResponse<User>>('/auth/me');

  if (response.data.success && response.data.data) {
    return response.data.data;
  }

  throw new Error(response.data.error || 'Failed to get user');
}

/**
 * Get current user's roles via Authen Gateway
 * GET /api/auth/me/roles
 */
export async function getMyRolesApi(): Promise<UserRole[]> {
  const response = await apiClient.get<ApiResponse<UserRole[]>>('/auth/me/roles');

  if (response.data.success && response.data.data) {
    return response.data.data;
  }

  throw new Error(response.data.error || 'Failed to get roles');
}

/**
 * Check if current user has a specific permission
 * GET /api/auth/me/permissions/check?permission=<permissionCode>
 */
export async function checkPermissionApi(permissionCode: string): Promise<PermissionCheckResult> {
  const response = await apiClient.get<ApiResponse<PermissionCheckResult>>(
    '/auth/me/permissions/check',
    { params: { permission: permissionCode } }
  );

  if (response.data.success && response.data.data) {
    return response.data.data;
  }

  throw new Error(response.data.error || 'Permission check failed');
}

/**
 * OAuth login via Authen Gateway
 * POST /api/auth/oauth/{provider}
 */
export async function oauthLoginApi(provider: string, data: Record<string, unknown>): Promise<AuthResponse> {
  const response = await apiClient.post<ApiResponse<AuthResponse>>(
    `/auth/oauth/${provider}`,
    data
  );

  if (response.data.success && response.data.data) {
    return response.data.data;
  }

  throw new Error(response.data.error || 'OAuth login failed');
}
