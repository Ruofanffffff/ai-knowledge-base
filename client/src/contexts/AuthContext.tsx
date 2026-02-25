import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { toast } from 'sonner';
import {
  loginApi,
  registerByEmailApi,
  getMeApi,
  getMyRolesApi,
  checkPermissionApi,
  refreshTokenApi,
} from '../api/auth';
import { LoginRequest, RegisterRequest, User, UserRole } from '../api/types';
import {
  getAccessToken,
  setAccessToken,
  getRefreshToken,
  setRefreshToken,
  clearAllTokens,
  setUserData,
} from '../utils/storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthContextType {
  user: User | null;
  roles: string[];
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (roleName: string) => boolean;
  hasPermission: (permissionCode: string) => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Full-screen loading component (brand logo + gradient spinner)
// ---------------------------------------------------------------------------

function FullScreenLoading() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50">
      {/* Brand logo */}
      <div className="mb-8 text-3xl font-bold bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 bg-clip-text text-transparent">
        AI Knowledge Base
      </div>
      {/* Gradient spinning ring */}
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-pink-500 border-r-purple-500 border-b-blue-500 animate-spin" />
      </div>
      <p className="mt-4 text-sm text-slate-400">正在加载...</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ------ helpers ------

  /** Fetch user info + roles from the API and update state. */
  const fetchUserAndRoles = useCallback(async () => {
    const userData = await getMeApi();
    setUser(userData);
    setUserData(userData);

    try {
      const roleList: UserRole[] = await getMyRolesApi();
      setRoles(roleList.map((r) => r.name));
    } catch {
      // Roles endpoint may not be available — keep empty list
      setRoles([]);
    }
  }, []);

  // ------ initialization ------

  useEffect(() => {
    const initAuth = async () => {
      const token = getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        // 1. Try fetching user info with current access_token
        await fetchUserAndRoles();
      } catch {
        // 2. access_token invalid — attempt refresh
        const refreshToken = getRefreshToken();
        if (refreshToken) {
          try {
            const refreshData = await refreshTokenApi(refreshToken);
            setAccessToken(refreshData.accessToken);
            setRefreshToken(refreshData.refreshToken);
            await fetchUserAndRoles();
          } catch {
            // 3. Refresh also failed — clear everything
            clearAllTokens();
            setUser(null);
            setRoles([]);
            toast.error('登录已过期，请重新登录');
          }
        } else {
          clearAllTokens();
          setUser(null);
          setRoles([]);
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, [fetchUserAndRoles]);

  // ------ login ------

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const data = await loginApi(credentials);

      // Store dual tokens
      setAccessToken(data.accessToken);
      setRefreshToken(data.refreshToken);
      setUserData(data.user);
      setUser(data.user);

      // Fetch roles
      try {
        const roleList: UserRole[] = await getMyRolesApi();
        setRoles(roleList.map((r) => r.name));
      } catch {
        setRoles([]);
      }
    },
    [],
  );

  // ------ register ------

  const register = useCallback(async (userData: RegisterRequest) => {
    const username = userData.username || userData.email.split('@')[0];
    await registerByEmailApi({ email: userData.email, password: userData.password, username });
  }, []);

  // ------ logout ------

  const logout = useCallback(async () => {
    clearAllTokens();
    setUser(null);
    setRoles([]);
  }, []);

  // ------ refreshUser ------

  const refreshUser = useCallback(async () => {
    await fetchUserAndRoles();
  }, [fetchUserAndRoles]);

  // ------ role / permission helpers ------

  const hasRole = useCallback(
    (roleName: string): boolean => roles.includes(roleName),
    [roles],
  );

  const hasPermission = useCallback(
    async (permissionCode: string): Promise<boolean> => {
      try {
        const result = await checkPermissionApi(permissionCode);
        return result.has_permission;
      } catch {
        return false;
      }
    },
    [],
  );

  // ------ render ------

  if (isLoading) {
    return <FullScreenLoading />;
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        roles,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
        hasRole,
        hasPermission,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
