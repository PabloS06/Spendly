import type { SupabaseClient } from "@supabase/supabase-js";
import type { ListTable, Snapshot, TableName, Tables } from "./types.ts";

/**
 * Persistence for one signed-in user. The app keeps a full Snapshot in memory,
 * applies changes optimistically and then writes them through a Backend.
 */
export interface Backend {
  kind: "supabase" | "demo" | "claude";
  userId: string;
  email: string | null;
  load(): Promise<Snapshot>;
  upsert<T extends TableName>(table: T, rows: Tables[T][]): Promise<void>;
  remove(table: ListTable, ids: string[]): Promise<void>;
  deleteAccount(): Promise<void>;
  signOut(): Promise<void>;
}

const LIST_TABLES: ListTable[] = ["income_sources", "fixed_costs", "categories", "months", "budgets", "expenses"];

export function emptySnapshot(): Snapshot {
  return { profile: null, income_sources: [], fixed_costs: [], categories: [], months: [], budgets: [], expenses: [] };
}

// ---------- Supabase ----------

const PAGE = 1000;

async function fetchAll<T>(client: SupabaseClient, table: string): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await client.from(table).select("*").order("id").range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export function supabaseBackend(client: SupabaseClient, userId: string, email: string | null): Backend {
  return {
    kind: "supabase",
    userId,
    email,
    async load() {
      const [profile, ...lists] = await Promise.all([
        client.from("profiles").select("*").maybeSingle(),
        ...LIST_TABLES.map((t) => fetchAll(client, t)),
      ]);
      if (profile.error) throw profile.error;
      const snapshot = emptySnapshot();
      snapshot.profile = profile.data;
      LIST_TABLES.forEach((t, i) => ((snapshot[t] as unknown[]) = lists[i] as unknown[]));
      return snapshot;
    },
    async upsert(table, rows) {
      if (!rows.length) return;
      const { error } = await client.from(table).upsert(rows as never[], { onConflict: table === "profiles" ? "user_id" : "id" });
      if (error) throw error;
    },
    async remove(table, ids) {
      if (!ids.length) return;
      const { error } = await client.from(table).delete().in("id", ids);
      if (error) throw error;
    },
    async deleteAccount() {
      const { error } = await client.rpc("delete_my_account");
      if (error) throw error;
      await client.auth.signOut();
    },
    async signOut() {
      await client.auth.signOut();
    },
  };
}

// ---------- Demo (this browser only) ----------

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000000";
const DEMO_KEY = "spendly-demo-data";
export const DEMO_SESSION_KEY = "spendly-demo-session";

/** localStorage that never throws (private windows and sandboxed frames can block it). */
export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Blocked or full: the demo keeps working in memory.
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing stored to remove.
    }
  },
};

// In-memory fallback so the demo still works when storage is blocked.
let memory: Snapshot | null = null;

function readDemo(): Snapshot {
  try {
    const raw = storage.get(DEMO_KEY);
    return raw ? { ...emptySnapshot(), ...JSON.parse(raw) } : (memory ?? emptySnapshot());
  } catch {
    return memory ?? emptySnapshot();
  }
}

function writeDemo(s: Snapshot) {
  memory = structuredClone(s);
  storage.set(DEMO_KEY, JSON.stringify(s));
}

export function demoBackend(onSignOut: () => void): Backend {
  let snapshot = readDemo();
  return {
    kind: "demo",
    userId: DEMO_USER_ID,
    email: null,
    async load() {
      snapshot = readDemo();
      return structuredClone(snapshot);
    },
    async upsert(table, rows) {
      if (table === "profiles") {
        snapshot.profile = { ...(rows[rows.length - 1] as Tables["profiles"]) };
      } else {
        const list = snapshot[table as ListTable] as { id: string }[];
        for (const row of rows as { id: string }[]) {
          const i = list.findIndex((r) => r.id === row.id);
          if (i >= 0) list[i] = { ...row };
          else list.push({ ...row });
        }
      }
      writeDemo(snapshot);
    },
    async remove(table, ids) {
      const set = new Set(ids);
      (snapshot[table] as { id: string }[]) = (snapshot[table] as { id: string }[]).filter((r) => !set.has(r.id));
      if (table === "categories") {
        snapshot.budgets = snapshot.budgets.filter((b) => !set.has(b.category_id));
        snapshot.expenses = snapshot.expenses.filter((e) => !set.has(e.category_id));
      }
      writeDemo(snapshot);
    },
    async deleteAccount() {
      memory = null;
      storage.remove(DEMO_KEY);
      storage.remove(DEMO_SESSION_KEY);
      onSignOut();
    },
    async signOut() {
      storage.remove(DEMO_SESSION_KEY);
      onSignOut();
    },
  };
}

export function seedDemo(snapshot: Snapshot) {
  writeDemo(snapshot);
}
