import { api } from './api';

export interface User {
  id: string;
  username: string;
  email: string;
  phone?: string;
  avatar?: string;
  role?: string;
  status?: string;
  createdAt?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    accessToken: string;
    refreshToken: string;
    expiresAt?: number;
  };
  // Fallback for some endpoints that might return flat structure
  token?: string;
  refreshToken?: string;
  user?: User;
}

export const authService = {
  async login(credentials: { email?: string; phone?: string; password?: string; code?: string; type?: 'password' | 'code' }): Promise<AuthResponse> {
    // Backend expects specific fields. 
    // If type is code, we might need a different endpoint or payload.
    // Based on routes/authRoutes.js, /login handles password login.
    // For phone code login, it might not be implemented in the provided snippet, 
    // but let's assume standard password login for now or check if there is a verify code endpoint.
    // The UI has "code" for phone login? No, UI has "phone + code" for LOGIN? 
    // Let's check Auth.tsx again. Yes, Phone tab has "code".
    // But backend /login route only checks password.
    // Maybe I should use the mock logic for phone code login if backend doesn't support it, 
    // OR force password login for now.
    // Wait, the backend has /register/phone which sends code? No, /send-email-code.
    // It seems backend is partial.
    // I will support password login fully. For phone/code login, I might need to mock or fail if backend doesn't support.
    
    const response = await api.post<AuthResponse>('/auth/login', credentials);
    const data = response.data;
    
    if (data.success && (data.data?.accessToken || data.token)) {
      const token = data.data?.accessToken || data.token;
      const refresh = data.data?.refreshToken || data.refreshToken;
      const user = data.data?.user || data.user;
      
      if (token) localStorage.setItem('access_token', token);
      if (refresh) localStorage.setItem('refresh_token', refresh);
      if (user) localStorage.setItem('user_info', JSON.stringify(user));
    }
    return data;
  },

  async register(data: { username?: string; email?: string; phone?: string; password?: string; nickname?: string }): Promise<AuthResponse> {
    // Map nickname to username if needed
    const payload = {
      ...data,
      username: data.username || data.nickname // Backend uses username
    };
    const response = await api.post<AuthResponse>('/auth/register', payload);
    return response.data;
  },

  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_info');
    }
  },

  async getMe(): Promise<User> {
    const response = await api.get<{ success: boolean; data: User }>('/auth/me');
    return response.data.data;
  },

  isAuthenticated(): boolean {
    return !!localStorage.getItem('access_token');
  },

  getUser(): User | null {
    const userStr = localStorage.getItem('user_info');
    return userStr ? JSON.parse(userStr) : null;
  }
};
