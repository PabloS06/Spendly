"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { useData } from "@/lib/data";
import { Button, Skeleton } from "./ui";

/** Routes signed-out users to login, new users to onboarding, and a finished month to its summary. */
export function AppGate({ children, fallback, onboarding = false }: { children: ReactNode; fallback?: ReactNode; onboarding?: boolean }) {
  const { state } = useAuth();
  const router = useRouter();
  const path = usePathname();
  const signedIn = state.status === "signedIn";

  useEffect(() => {
    if (state.status === "signedOut") router.replace("/login/");
  }, [state.status, router]);

  if (!signedIn) return <>{fallback ?? <PageSkeleton />}</>;
  return (
    <DataGate path={path} onboarding={onboarding} fallback={fallback}>
      {children}
    </DataGate>
  );
}

function DataGate({ children, path, onboarding, fallback }: { children: ReactNode; path: string; onboarding: boolean; fallback?: ReactNode }) {
  const { data, error, reload, pendingRollover } = useData();
  const router = useRouter();
  const onboarded = Boolean(data?.profile?.onboarded_at);
  const target = !data ? null : !onboarded && !onboarding ? "/onboarding/" : pendingRollover && onboarded && !path.startsWith("/rollover") ? "/rollover/" : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (error)
    return (
      <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="font-medium">Couldn&apos;t load your budget</p>
        <p className="text-sm text-muted">{error}</p>
        <Button variant="secondary" onClick={() => void reload()}>
          Try again
        </Button>
      </div>
    );
  if (!data || target) return <>{fallback ?? <PageSkeleton />}</>;
  return <>{children}</>;
}

export function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-md px-5 pt-20">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-14 w-56" />
      <Skeleton className="mt-6 h-[2px] w-full" />
      <Skeleton className="mt-4 h-4 w-36" />
      <div className="mt-12 space-y-7">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2.5">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
            <Skeleton className="h-[2px] w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
