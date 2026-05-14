"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";
import { authApi } from "@/lib/api";

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      setUser(null);
      setProfile(null);
      return;
    }

    // Set basic user from Supabase session immediately so isAuthenticated = true
    const sbUser = sessionData.session.user;
    const fallbackUser: User = {
      id: sbUser.id,
      email: sbUser.email ?? "",
      name:
        sbUser.user_metadata?.full_name ||
        sbUser.user_metadata?.name ||
        sbUser.email?.split("@")[0] ||
        "User",
      role: "student",
    };
    setUser(fallbackUser);

    // Enrich with backend profile (non-blocking — backend failure won't log user out)
    try {
      const data = await authApi.me();
      setUser(data.user);
      setProfile(data.profile ?? null);
    } catch (err) {
      console.warn("Backend /auth/me failed, using Supabase session data:", err);
      // Keep the Supabase-derived user — don't set user to null
    }
  }, []);

  useEffect(() => {
    // Initialize from current session on mount
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        refreshUser().finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    }).catch(() => setIsLoading(false));

    // Subscribe to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        refreshUser();
      } else {
        setUser(null);
        setProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    if (!authData.session) throw new Error("Sign in succeeded but no session was returned.");

    // Set user from Supabase session immediately
    const sbUser = authData.session.user;
    const fallbackUser: User = {
      id: sbUser.id,
      email: sbUser.email ?? email,
      name:
        sbUser.user_metadata?.full_name ||
        sbUser.user_metadata?.name ||
        email.split("@")[0],
      role: "student",
    };
    setUser(fallbackUser);

    // Try to get full profile from backend
    try {
      const meData = await authApi.me();
      setUser(meData.user);
      setProfile(meData.profile ?? null);
    } catch (err) {
      console.warn("Backend /auth/me failed after login, using Supabase session:", err);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, name } },
    });
    if (error) throw new Error(error.message);
    // Session exists only when email confirmation is disabled in Supabase.
    // If confirmation is required, data.session is null and the user must
    // verify their email before they can log in.
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
