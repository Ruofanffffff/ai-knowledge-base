import axios from 'axios';
import { Capacitor } from '@capacitor/core';

// Base URL configuration
// In development, we use the proxy defined in vite.config.ts or VITE_API_URL if set
// In production (Capacitor), we need the full URL from VITE_API_URL
const isDev = import.meta.env.DEV;

// Remove hardcoded IP. Use VITE_API_URL from .env or fallback to /api (proxy)
let BASE_URL = import.meta.env.VITE_API_URL || '/api';

if (Capacitor.isNativePlatform() || import.meta.env.PROD) {
  BASE_URL = 'http://120.26.35.225:3000/api';
}

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Prevent infinite loops
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't intercept 401 for login requests - let the component handle "Wrong Password"
      if (originalRequest.url?.includes('/auth/login')) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
          
          if (data.success && data.data.accessToken) {
            localStorage.setItem('access_token', data.data.accessToken);
            localStorage.setItem('refresh_token', data.data.refreshToken);
            
            // Update authorization header and retry original request
            api.defaults.headers.common['Authorization'] = `Bearer ${data.data.accessToken}`;
            originalRequest.headers['Authorization'] = `Bearer ${data.data.accessToken}`;
            
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // Logout user if refresh fails
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_info');
          localStorage.removeItem('hi_brain_authed');
          if (!window.location.pathname.includes('/auth')) {
            window.location.href = '/auth'; // Redirect to login
          }
        }
      } else {
        // No refresh token available
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_info');
        localStorage.removeItem('hi_brain_authed');
        if (!window.location.pathname.includes('/auth')) {
          window.location.href = '/auth'; // Redirect to login
        }
      }
    }
    return Promise.reject(error);
  }
);
