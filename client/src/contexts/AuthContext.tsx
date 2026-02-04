import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi } from '../api/auth';
import { User, LoginRequest, RegisterRequest } from '../api/types';
import { setUserData, clearAuthToken, isAuthenticated } from '../utils/storage';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      if (isAuthenticated()) {
        try {
          const userData = await authApi.getCurrentUser();
          setUser(userData);
          setUserData(userData);
        } catch (error) {
          console.error('Failed to get current user:', error);
          clearAuthToken();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    const { user: userData } = await authApi.login(credentials);
    setUser(userData);
    setUserData(userData);
  };

  const register = async (userData: RegisterRequest) => {
    const { user: newUser } = await authApi.register(userData);
    setUser(newUser);
    setUserData(newUser);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    const userData = await authApi.getCurrentUser();
    setUser(userData);
    setUserData(userData);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
