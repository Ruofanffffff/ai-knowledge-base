import axios from 'axios';

// Base URL configuration
// In development, we use the proxy defined in vite.config.ts
// In production (Capacitor), we need the full URL
const isDev = import.meta.env.DEV;
const isCapacitor = window.Capacitor !== undefined;

// You might need to change this IP to your computer's local IP for mobile testing
// if 10.0.2.2 (Android emulator localhost) doesn't work or for iOS/Physical devices.
// For now, we assume proxy in dev and a placeholder for prod.
const BASE_URL = isDev ? '/api' : (import.meta.env.VITE_API_URL || 'http://120.26.35.225:3000/api');

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
          window.dispatchEvent(new CustomEvent('auth_logout'));
        }
      } else {
        // No refresh token available
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_info');
        window.dispatchEvent(new CustomEvent('auth_logout'));
      }
    }
    return Promise.reject(error);
  }
);
