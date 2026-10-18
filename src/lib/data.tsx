"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Backend } from "./backend.ts";
import { budgetsFor } from "./budget.ts";
import { periodStart, todayISO } from "./dates.ts";
import type { MoneyFormat } from "./money.ts";
import { DEFAULT_CATEGORIES, type Budget, type Category, type ListTable, type Month, type Profile, type Snapshot, type TableName, type Tables } from "./types.ts";
import { useToast } from "@/components/toast";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16),
  );
}

function guessLocale(): string {
  const lang = typeof navigator !== "undefined" ? navigator.language : "en-IE";
  // Plain "en" would format euros as "€12.50" but dates and grouping the US way; prefer Ireland.
  return lang === "en" || lang === "en-US" ? "en-IE" : lang;
}

export function defaultProfile(userId: string): Profile {
  return {
    user_id: userId,
    currency: "EUR",
    locale: guessLocale(),
    month_start_day: 1,
    savings_goal: 0,
    last_payment_method: "Card",
    onboarded_at: null,
  };
}

export function defaultCategories(userId: string): Category[] {
  return DEFAULT_CATEGORIES.map((name, i) => ({ id: newId(), user_id: userId, name, sort_order: i, archived: false }));
}

/**
 * Month rollover: makes sure the current period has a month row and budgets
 * (copied from the latest earlier period), and reports the previous period if
 * it still needs its summary screen.
 */
export function planRollover(s: Snapshot, today: string): { months: Month[]; budgets: Budget[]; pending: string | null } {
  const profile = s.profile;
  if (!profile?.onboarded_at) return { months: [], budgets: [], pending: null };
  const current = periodStart(today, profile.month_start_day);
  const months: Month[] = [];
  const budgets: Budget[] = [];

  if (!s.months.some((m) => m.period === current)) {
    months.push({ id: newId(), user_id: profile.user_id, period: current, carry_in: 0, leftover_action: null, leftover_amount: 0, closed_at: null });
  }
  if (!s.budgets.some((b) => b.period === current)) {
    const archived = new Set(s.categories.filter((c) => c.archived).map((c) => c.id));
    for (const b of budgetsFor(s.budgets, current)) {
      if (!archived.has(b.category_id)) budgets.push({ ...b, id: newId(), period: current });
    }
  }
  const open = s.months.filter((m) => m.period < current && !m.closed_at).sort((a, b) => b.period.localeCompare(a.period));
  return { months, budgets, pending: open[0]?.period ?? null };
}

interface DataContextValue {
  backend: Backend;
  data: Snapshot | null;
  error: string | null;
  fmt: MoneyFormat;
  pendingRollover: string | null;
  save: <T extends TableName>(table: T, rows: Tables[T][]) => Promise<void>;
  remove: (table: ListTable, ids: string[]) => Promise<void>;
  reload: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

function apply<T extends TableName>(s: Snapshot, table: T, rows: Tables[T][]): Snapshot {
  if (table === "profiles") return { ...s, profile: rows[rows.length - 1] as Profile };
  const list = [...(s[table as ListTable] as { id: string }[])];
  for (const row of rows as { id: string }[]) {
    const i = list.findIndex((r) => r.id === row.id);
    if (i >= 0) list[i] = row;
    else list.push(row);
  }
  return { ...s, [table]: list };
}

export function DataProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();
  const prepared = useRef<Backend | null>(null);

  const load = useCallback(async () => {
    try {
      let s = await backend.load();
      if (!s.profile) {
        // First sign-in: create the profile and the default categories.
        const profile = defaultProfile(backend.userId);
        const categories = s.categories.length ? [] : defaultCategories(backend.userId);
        await backend.upsert("profiles", [profile]);
        await backend.upsert("categories", categories);
        s = { ...s, profile, categories: [...s.categories, ...categories] };
      }
      const roll = planRollover(s, todayISO());
      if (roll.months.length || roll.budgets.length) {
        await backend.upsert("months", roll.months);
        await backend.upsert("budgets", roll.budgets);
        s = { ...s, months: [...s.months, ...roll.months], budgets: [...s.budgets, ...roll.budgets] };
      }
      setData(s);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load your data");
    }
  }, [backend]);

  useEffect(() => {
    if (prepared.current === backend) return; // StrictMode runs effects twice; bootstrap once
    prepared.current = backend;
    setData(null);
    void load();
  }, [backend, load]);

  const save = useCallback(
    async <T extends TableName>(table: T, rows: Tables[T][]) => {
      if (!rows.length) return;
      setData((s) => (s ? apply(s, table, rows) : s));
      try {
        await backend.upsert(table, rows);
      } catch (e) {
        toast.show({ text: "Couldn't save. Check your connection and try again.", tone: "error" });
        console.error(e);
        await load();
      }
    },
    [backend, load, toast],
  );

  const remove = useCallback(
    async (table: ListTable, ids: string[]) => {
      if (!ids.length) return;
      const set = new Set(ids);
      setData((s) => (s ? { ...s, [table]: (s[table] as { id: string }[]).filter((r) => !set.has(r.id)) } : s));
      try {
        await backend.remove(table, ids);
      } catch (e) {
        toast.show({ text: "Couldn't delete. Check your connection and try again.", tone: "error" });
        console.error(e);
        await load();
      }
    },
    [backend, load, toast],
  );

  const pendingRollover = useMemo(() => (data ? planRollover(data, todayISO()).pending : null), [data]);
  const fmt = useMemo<MoneyFormat>(
    () => ({ currency: data?.profile?.currency ?? "EUR", locale: data?.profile?.locale ?? "en-IE" }),
    [data?.profile?.currency, data?.profile?.locale],
  );

  const value = useMemo(
    () => ({ backend, data, error, fmt, pendingRollover, save, remove, reload: load }),
    [backend, data, error, fmt, pendingRollover, save, remove, load],
  );
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData outside DataProvider");
  return ctx;
}

/** For screens that render only once data has loaded (inside <AppGate>). */
export function useLoaded() {
  const ctx = useData();
  if (!ctx.data?.profile) throw new Error("useLoaded before data loaded");
  return { ...ctx, data: ctx.data, profile: ctx.data.profile };
}
