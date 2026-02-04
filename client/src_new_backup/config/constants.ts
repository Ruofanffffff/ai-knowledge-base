/**
 * Application Configuration Constants
 * 
 * This file centralizes all application constants and configuration values,
 * making them easy to maintain and reference throughout the application.
 */

/**
 * API Configuration
 * Controls API endpoint and request settings
 */
export const API_CONFIG = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  TIMEOUT: 30000, // 30 seconds
};

/**
 * Auto-Refresh Configuration
 * Controls automatic data refresh intervals for different features
 */
export const AUTO_REFRESH_CONFIG = {
  ENABLED: import.meta.env.VITE_ENABLE_AUTO_REFRESH === 'true',
  DOCUMENTS_INTERVAL: parseInt(import.meta.env.VITE_AUTO_REFRESH_INTERVAL || '30000'), // 30 seconds default
  GRAPH_INTERVAL: 60000, // 1 minute
};

/**
 * LocalStorage Keys
 * Standardized keys for localStorage access
 */
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_DATA: 'user_data',
};

/**
 * Application Routes
 * Centralized route paths for navigation
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  DOCUMENTS: '/documents',
  KNOWLEDGE_GRAPH: '/knowledge-graph',
  AI_SEARCH: '/ai-search',
};
