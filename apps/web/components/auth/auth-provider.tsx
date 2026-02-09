"use client";

import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { buildApiUrl } from "../../app/api/_lib/backend";
export type AuthUser = {
  id: string;
  email: string;
  name?: string | null;
  created_at?: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  defaultProjectId: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  login: (payload: { email: string; password: string }) => Promise<void>;
  register: (payload: { email: string; password: string; name?: string }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const parseError = async (response: Response) => {
  try {
    const data = await response.json();
    return data.detail || data.error || response.statusText || "Request failed";
  } catch {
    return response.statusText || "Request failed";
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [defaultProjectId, setDefaultProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl("/api/auth/me"), { cache: "no-store" });
      if (!response.ok) {
        setUser(null);
        setDefaultProjectId(null);
        if (response.status !== 401) {
          setError(await parseError(response));
        }
        return;
      }
      const data = await response.json();
      setUser(data.user);
      setDefaultProjectId(data.default_project_id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load auth");
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (payload: { email: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data = await response.json();
      setUser(data.user);
      setDefaultProjectId(data.default_project_id ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (payload: { email: string; password: string; name?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(buildApiUrl("/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseError(response));
      }
      const data = await response.json();
      setUser(data.user);
      setDefaultProjectId(data.default_project_id ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await fetch(buildApiUrl("/api/auth/logout"), { method: "POST" });
    setUser(null);
    setDefaultProjectId(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      defaultProjectId,
      loading,
      error,
      refresh,
      login,
      register,
      logout,
    }),
    [user, defaultProjectId, loading, error, refresh, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};
