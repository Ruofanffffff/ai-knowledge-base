const AUTH_TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

/**
 * Get authentication token from localStorage
 */
export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Set authentication token in localStorage
 */
export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

/**
 * Clear authentication token from localStorage
 */
export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

/**
 * Get user data from localStorage
 */
export function getUserData(): any | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  
  try {
    return JSON.parse(data);
  } catch (error) {
    // Invalid JSON - return null and clean up
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

/**
 * Set user data in localStorage
 */
export function setUserData(user: any): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
