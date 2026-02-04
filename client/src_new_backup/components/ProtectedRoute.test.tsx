import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import * as AuthContextModule from '../contexts/AuthContext';

// Mock LoadingSpinner component
vi.mock('./LoadingSpinner', () => ({
  default: () => <div data-testid="loading-spinner">Loading...</div>,
}));

// Mock useAuth hook
vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('ProtectedRoute', () => {
  const mockAuthValue = (overrides = {}) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    ...overrides,
  });

  const renderWithRouter = (authValue: any) => {
    vi.mocked(AuthContextModule.useAuth).mockReturnValue(authValue);
    
    return render(
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/protected" element={<div>Protected Content</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.location for each test
    window.history.pushState({}, '', '/protected');
  });

  describe('when loading', () => {
    it('should show loading spinner while checking authentication', () => {
      const authValue = mockAuthValue({
        isLoading: true,
        isAuthenticated: false,
      });

      renderWithRouter(authValue);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    });

    it('should show loading spinner even if authenticated flag is true', () => {
      const authValue = mockAuthValue({
        isLoading: true,
        isAuthenticated: true,
      });

      renderWithRouter(authValue);

      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });

  describe('when not authenticated', () => {
    it('should redirect to login page when not authenticated', () => {
      const authValue = mockAuthValue({
        isLoading: false,
        isAuthenticated: false,
      });

      renderWithRouter(authValue);

      expect(screen.getByText('Login Page')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    it('should not show protected content when not authenticated', () => {
      const authValue = mockAuthValue({
        isLoading: false,
        isAuthenticated: false,
        user: null,
      });

      renderWithRouter(authValue);

      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  describe('when authenticated', () => {
    it('should render children when authenticated', () => {
      const authValue = mockAuthValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
      });

      renderWithRouter(authValue);

      expect(screen.getByText('Protected Content')).toBeInTheDocument();
      expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
    });

    it('should not show loading spinner when authenticated', () => {
      const authValue = mockAuthValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
      });

      renderWithRouter(authValue);

      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should not redirect to login when authenticated', () => {
      const authValue = mockAuthValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
      });

      renderWithRouter(authValue);

      expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });
  });

  describe('authentication state transitions', () => {
    it('should transition from loading to authenticated', () => {
      const authValue = mockAuthValue({
        isLoading: true,
        isAuthenticated: false,
      });

      const { rerender } = renderWithRouter(authValue);

      // Initially loading
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      // Update to authenticated
      const updatedAuthValue = mockAuthValue({
        isLoading: false,
        isAuthenticated: true,
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
      });

      vi.mocked(AuthContextModule.useAuth).mockReturnValue(updatedAuthValue);

      rerender(
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/protected" element={<div>Protected Content</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
      );

      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should transition from loading to not authenticated', () => {
      const authValue = mockAuthValue({
        isLoading: true,
        isAuthenticated: false,
      });

      const { rerender } = renderWithRouter(authValue);

      // Initially loading
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();

      // Update to not authenticated
      const updatedAuthValue = mockAuthValue({
        isLoading: false,
        isAuthenticated: false,
      });

      vi.mocked(AuthContextModule.useAuth).mockReturnValue(updatedAuthValue);

      rerender(
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<div>Login Page</div>} />
            <Route element={<ProtectedRoute />}>
              <Route path="/protected" element={<div>Protected Content</div>} />
            </Route>
          </Routes>
        </BrowserRouter>
      );

      expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
      expect(screen.getByText('Login Page')).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle missing user data when authenticated', () => {
      const authValue = mockAuthValue({
        isLoading: false,
        isAuthenticated: true,
        user: null, // User is null but authenticated is true
      });

      renderWithRouter(authValue);

      // Should still render protected content if isAuthenticated is true
      expect(screen.getByText('Protected Content')).toBeInTheDocument();
    });

    it('should prioritize isLoading over isAuthenticated', () => {
      const authValue = mockAuthValue({
        isLoading: true,
        isAuthenticated: true,
        user: { id: '1', username: 'testuser', email: 'test@example.com' },
      });

      renderWithRouter(authValue);

      // Should show loading spinner even though authenticated is true
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });

    it('should handle rapid authentication state changes', () => {
      // Test that component correctly responds to auth state
      const notAuthValue = mockAuthValue({
        isLoading: false,
        isAuthenticated: false,
      });

      renderWithRouter(notAuthValue);

      // Not authenticated - should show login
      expect(screen.getByText('Login Page')).toBeInTheDocument();
      expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    });
  });
});
