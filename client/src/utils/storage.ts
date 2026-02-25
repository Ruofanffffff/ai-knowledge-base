// --- localStorage key constants ---
const LEGACY_AUTH_TOKEN_KEY = 'auth_token';
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'user_data';

// =============================================
// Dual Token Storage (access_token + refresh_token)
// =============================================

/**
 * Get access token from localStorage.
 * Checks new `access_token` key first, then falls back to legacy `auth_token` for backward compatibility.
 */
export function getAccessToken(): string | null {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (token) return token;

  // Backward compatibility: read from legacy key
  return localStorage.getItem(LEGACY_AUTH_TOKEN_KEY);
}

/**
 * Set access token in localStorage.
 * Writes to new `access_token` key and removes legacy `auth_token` if present.
 */
export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
  // Clean up legacy key to complete migration
  localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
}

/**
 * Get refresh token from localStorage.
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Set refresh token in localStorage.
 */
export function setRefreshToken(token: string): void {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

/**
 * Clear all tokens (access, refresh, user data, and legacy auth_token).
 */
export function clearAllTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(LEGACY_AUTH_TOKEN_KEY);
}

// =============================================
// User Data Storage
// =============================================

/**
 * Get user data from localStorage.
 */
export function getUserData(): any | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;

  try {
    return JSON.parse(data);
  } catch {
    // Invalid JSON — clean up and return null
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

/**
 * Set user data in localStorage.
 */
export function setUserData(user: any): void {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

/**
 * Clear user data from localStorage.
 */
export function clearUserData(): void {
  localStorage.removeItem(USER_KEY);
}

// =============================================
// Legacy API (backward-compatible wrappers)
// =============================================

/**
 * @deprecated Use `getAccessToken()` instead.
 */
export function getAuthToken(): string | null {
  return getAccessToken();
}

/**
 * @deprecated Use `setAccessToken()` instead.
 */
export function setAuthToken(token: string): void {
  setAccessToken(token);
}

/**
 * @deprecated Use `clearAllTokens()` instead.
 */
export function clearAuthToken(): void {
  clearAllTokens();
}

/**
 * Check if user is authenticated (has an access token).
 */
export function isAuthenticated(): boolean {
  return !!getAccessToken();
}
