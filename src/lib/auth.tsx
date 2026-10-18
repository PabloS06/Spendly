"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEMO_SESSION_KEY, demoBackend, storage, supabaseBackend, type Backend } from "./backend.ts";
import { getSupabase, supabaseConfigured } from "./supabase.ts";

type AuthState = { status: "loading" } | { status: "signedOut" } | { status: "signedIn"; backend: Backend };

interface AuthContextValue {
  state: AuthState;
  demoAvailable: boolean;
  startDemo: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * `connect` lets a host supply its own storage (the hosted single-file page
 * saves to the viewer's Claude account); when it yields null, the app falls
 * back to Supabase or the demo.
 */
export function AuthProvider({ children, connect }: { children: ReactNode; connect?: () => Promise<Backend | null> }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  const signedOut = useCallback(() => setState({ status: "signedOut" }), []);

  const startDemo = useCallback(() => {
    storage.set(DEMO_SESSION_KEY, "1");
    setState({ status: "signedIn", backend: demoBackend(signedOut) });
  }, [signedOut]);

  useEffect(() => {
    if (connect) {
      let cancelled = false;
      void connect()
        .catch(() => null)
        .then((backend) => {
          if (cancelled) return;
          if (backend) setState({ status: "signedIn", backend });
          else startDemo();
        });
      return () => {
        cancelled = true;
      };
    }
    const supabase = getSupabase();
    if (!supabase) {
      if (storage.get(DEMO_SESSION_KEY)) startDemo();
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
  }, [signedOut, startDemo, connect]);

  const value = useMemo(() => ({ state, demoAvailable: !supabaseConfigured, startDemo }), [state, startDemo]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
