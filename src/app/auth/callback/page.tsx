"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { PageSkeleton } from "@/components/app-gate";

// Supabase finishes the OAuth / email-confirmation exchange from the URL on load
// (detectSessionInUrl); this page just waits for the session and moves on.
export default function AuthCallback() {
  const { state } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (state.status === "signedIn") router.replace("/");
    if (state.status === "signedOut") {
      const t = setTimeout(() => router.replace("/login/"), 4000);
      return () => clearTimeout(t);
    }
  }, [state.status, router]);
  return <PageSkeleton />;
}
