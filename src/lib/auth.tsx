"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEMO_SESSION_KEY, demoBackend, supabaseBackend, type Backend } from "./backend.ts";
import { getSupabase, supabaseConfigured } from "./supabase.ts";

type AuthState = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; backend: Backend };

interface AuthContextValue {
  state: AuthState;
  demoAvailable: boolean;
  startDemo: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const signedOut = useCallback(() => setState({ status: "signedOut" }), []);

  const startDemo = useCallback(() => {
    localStorage.setItem(DEMO_SESSION_KEY, "1");
    setState({ status: "signedIn", backend: demoBackend(signedOut) });
  }, [signedOut]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      if (localStorage.getItem(DEMO_SESSION_KEY)) startDemo();
      else signedOut();
      return;
    }
    let currentUser: string | null = null;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user ?? null;
      if (user?.id === currentUser) return; // token refreshes don't reload data
      currentUser = user?.id ?? null;
      setState(user ? { status: "signedIn", backend: supabaseBackend(supabase, user.id, user.email ?? null) } : { status: "signedOut" });
    });
    return () => data.subscription.unsubscribe();
  }, [signedOut, startDemo]);

  const value = useMemo(() => ({ state, demoAvailable: !supabaseConfigured, startDemo }), [state, startDemo]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
