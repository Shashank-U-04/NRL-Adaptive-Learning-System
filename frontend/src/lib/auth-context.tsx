"use client";

/**
 * Auth contract:
 *  - Single source of truth: frontend auth state is authoritative ONLY when
 *    backend /auth/me has confirmed the token is valid.
 *  - On 401 from /auth/me: refresh session once → retry → sign out if still failing.
 *  - On network/5xx from /auth/me: use Supabase session as temporary fallback
 *    (backend may be restarting). This is the ONLY case we allow Supabase-only state.
 *  - `nrl:session-expired` window event from apiFetch triggers immediate sign-out.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "./supabase";
import { authApi, ApiError } from "@/lib/api";
import { useToast } from "@/lib/toast";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at?: string;
}

interface Profile {
  knowledge_level: string;
  current_streak: number;
  longest_streak: number;
  total_xp: number;
  sessions_completed: number;
  total_questions_answered: number;
  total_correct: number;
  accuracy: number;
  daily_goal_minutes: number;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function buildFallbackUser(sbUser: {
  id: string;
  email?: string;
  user_metadata?: Record<string, string | undefined>;
}): User {
  return {
    id: sbUser.id,
    email: sbUser.email ?? "",
    name:
      sbUser.user_metadata?.full_name ||
      sbUser.user_metadata?.name ||
      sbUser.email?.split("@")[0] ||
      "User",
    role: "student",
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const toast = useToast();
  const router = useRouter();

  // Central sign-out: clears state, shows toast, redirects (unless already on an auth page)
  const doSignOut = useCallback(
    async (message?: string) => {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      if (message) toast.error(message);
      const authPaths = ["/", "/login", "/register", "/auth/callback"];
      if (!authPaths.includes(window.location.pathname)) {
        router.push("/login");
      }
    },
    [toast, router],
  );

  const refreshUser = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();

    if (!sessionData.session) {
      setUser(null);
      setProfile(null);
      return;
    }

    // Build a fallback from the Supabase session — used ONLY for network/5xx errors
    const fallbackUser = buildFallbackUser(sessionData.session.user);

    try {
      const data = await authApi.me();
      setUser(data.user);
      setProfile(data.profile ?? null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Token rejected by backend — try refreshing the Supabase session
        const { data: refreshed, error: refreshErr } =
          await supabase.auth.refreshSession();

        if (refreshErr || !refreshed.session) {
          await doSignOut("Your session has expired. Please sign in again.");
          return;
        }

        // One more attempt with the freshly refreshed token
        try {
          const data = await authApi.me();
          setUser(data.user);
          setProfile(data.profile ?? null);
        } catch {
          await doSignOut("Authentication failed. Please sign in again.");
        }
      } else {
        // Network error or backend temporarily unavailable (5xx, ECONNREFUSED).
        // Keep the user "logged in" via the Supabase session so a backend
        // restart doesn't force everyone to re-authenticate.
        console.warn("Backend /auth/me unreachable, using Supabase session:", err);
        setUser(fallbackUser);
      }
    }
  }, [doSignOut]);

  useEffect(() => {
    // Hydrate session on mount
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) {
          return refreshUser().finally(() => setIsLoading(false));
        }
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));

    // React to Supabase auth state changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        refreshUser();
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    // Handle session-expired events dispatched by apiFetch after a failed refresh
    const handleSessionExpired = () => {
      doSignOut("Your session has expired. Please sign in again.");
    };
    window.addEventListener("nrl:session-expired", handleSessionExpired);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("nrl:session-expired", handleSessionExpired);
    };
  }, [refreshUser, doSignOut]);

  const login = async (email: string, password: string) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);
    if (!authData.session)
      throw new Error("Sign in succeeded but no session was returned.");
    // refreshUser will call /auth/me with the fresh token and set state atomically
    await refreshUser();
  };

  const register = async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, name } },
    });
    if (error) throw new Error(error.message);
    // Session exists only when email confirmation is disabled in Supabase
    if (data.session) {
      await refreshUser();
    }
  };

  const loginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw new Error(error.message);
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithGoogle,
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
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
