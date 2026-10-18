"use client";

import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/lib/auth";
import { DataProvider } from "@/lib/data";
import { ExpenseSheetProvider } from "./expense-sheet";
import { ToastProvider } from "./toast";

function SessionData({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status !== "signedIn") return <>{children}</>;
  return (
    <DataProvider key={state.backend.userId} backend={state.backend}>
      <ExpenseSheetProvider>{children}</ExpenseSheetProvider>
    </DataProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <AuthProvider>
        <SessionData>{children}</SessionData>
      </AuthProvider>
    </ToastProvider>
  );
}
