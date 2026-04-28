"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { authApi, setTokens, clearTokens } from "@/lib/api";

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
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setUser(null);
        setProfile(null);
        return;
      }
      const data = await authApi.me();
      setUser(data.user);
      setProfile(data.profile);
    } catch {
      setUser(null);
      setProfile(null);
      clearTokens();
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    setTokens(data.access_token, data.refresh_token);
    await refreshUser();
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await authApi.register({ name, email, password });
    setTokens(data.access_token, data.refresh_token);
    await refreshUser();
  };

  const logout = () => {
    clearTokens();
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
