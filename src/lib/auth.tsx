import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  clearTokens,
  decodeJwt,
  getAccessToken,
  getClientType,
  isTokenExpired,
  setTokens,
} from "@/lib/api-client";
import { authApi } from "@/services/auth.service";
import type { Role, UserResponse } from "@/types/api";
import { ROLE_HIERARCHY } from "@/types/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuthState {
  user: UserResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  clientType: "mobile" | "desktop";
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  hasRole: (minimumRole: Role) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clientType = getClientType();

  // Hydrate user from token on mount
  useEffect(() => {
    const token = getAccessToken();
    if (!token || isTokenExpired(token)) {
      setIsLoading(false);
      return;
    }

    const payload = decodeJwt(token);
    if (!payload) {
      setIsLoading(false);
      return;
    }

    // Build minimal user from JWT claims
    setUser({
      id: payload.sub,
      email: "",
      name: payload.sub,
      role: payload.role as Role,
      tenant_id: payload.tenant_id,
      plant_ids: [],
      active: true,
    });

    // Fetch full profile in background
    authApi
      .getMe()
      .then(setUser)
      .catch(() => {
        // Token might be invalid — keep JWT-derived user
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password, clientType);
      setTokens(res.access_token, res.refresh_token);

      const profile = await authApi.getMe();
      setUser(profile);
    },
    [clientType],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const profile = await authApi.getMe();
      setUser(profile);
    } catch {
      // keep current user
    }
  }, []);

  const hasRole = useCallback(
    (minimumRole: Role) => {
      if (!user) return false;
      return ROLE_HIERARCHY[user.role] >= ROLE_HIERARCHY[minimumRole];
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isLoading,
      isAuthenticated: !!user,
      clientType,
      login,
      logout,
      refreshUser,
      hasRole,
    }),
    [user, isLoading, clientType, login, logout, refreshUser, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
