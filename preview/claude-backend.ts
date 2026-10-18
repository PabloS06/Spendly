// Backend for the hosted page: saves to the viewer's private storage in their
// Claude account (the artifact `db` capability), so data survives new tabs,
// devices and updates to the page.
//
// Layout, all under the viewer's private collection data/users/<id>:
//   setup              profile, income, fixed costs, categories, months, budgets
//   expenses-YYYY-MM   that calendar month's expenses ({ rows: [...] })
import type { Backend } from "@/lib/backend";
import { emptySnapshot } from "@/lib/backend";
import type { Expense, ListTable, Snapshot } from "@/lib/types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

const SETUP = "setup";
const bucketOf = (e: Pick<Expense, "spent_on">) => `expenses-${e.spent_on.slice(0, 7)}`;

export async function connectClaudeStorage(): Promise<Backend | null> {
  const claude = (window as any).claude;
  if (!claude?.use) return null;
  const [db, user] = await Promise.all([claude.use("db"), claude.use("user")]);
  const uid: string | null = user ? await user.id() : null;
  if (!db || !uid) return null;
  return claudeBackend(db, uid);
}

function claudeBackend(db: Db, uid: string): Backend {
  const col = db.collection(`data/users/${uid}`);
  let state: Snapshot = emptySnapshot();
  const where = new Map<string, string>(); // expense id -> bucket doc id
  const dirty = new Set<string>();
  let running: Promise<void> | null = null;

  function bucketBody(id: string) {
    return { rows: state.expenses.filter((e) => where.get(e.id) === id) };
  }

  function body(id: string) {
    if (id !== SETUP) return bucketBody(id);
    const { expenses: _ignored, ...setup } = state;
    return setup as Record<string, unknown>;
  }

  async function write(id: string) {
    const b = body(id);
    const ref = col.doc(id);
    try {
      if (id !== SETUP && !(b.rows as unknown[]).length) await ref.delete();
      else await ref.set(b);
    } catch (e: any) {
      if (e?.code !== "unavailable") throw e;
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));
      await ref.set(b);
    }
  }

  // One write at a time; a document changed during a write is written again after it.
  function flush(): Promise<void> {
    running ??= (async () => {
      try {
        while (dirty.size) {
          const [id] = dirty;
          dirty.delete(id);
          await write(id);
        }
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return {
    kind: "claude",
    userId: uid,
    email: null,
    async load() {
      const snap = await col.limit(1000).get();
      state = emptySnapshot();
      where.clear();
      for (const d of snap.docs) {
        const data = d.data() ?? {};
        if (d.id === SETUP) state = { ...state, ...data, expenses: state.expenses };
        else if (d.id.startsWith("expenses-")) {
          for (const e of (data.rows as Expense[]) ?? []) {
            state.expenses.push(e);
            where.set(e.id, d.id);
          }
        }
      }
      return structuredClone(state);
    },
    async upsert(table, rows) {
      if (!rows.length) return;
      if (table === "profiles") {
        state.profile = structuredClone(rows[rows.length - 1] as Snapshot["profile"]);
        dirty.add(SETUP);
      } else if (table === "expenses") {
        for (const row of rows as Expense[]) {
          const old = where.get(row.id);
          if (old) dirty.add(old);
          state.expenses = state.expenses.filter((e) => e.id !== row.id).concat(structuredClone(row));
          where.set(row.id, bucketOf(row));
          dirty.add(bucketOf(row));
        }
      } else {
        const list = [...(state[table as ListTable] as { id: string }[])];
        for (const row of rows as { id: string }[]) {
          const i = list.findIndex((r) => r.id === row.id);
          if (i >= 0) list[i] = structuredClone(row);
          else list.push(structuredClone(row));
        }
        state = { ...state, [table]: list };
        dirty.add(SETUP);
      }
      await flush();
    },
    async remove(table, ids) {
      const set = new Set(ids);
      if (table === "expenses") {
        for (const id of ids) {
          const b = where.get(id);
          if (b) dirty.add(b);
          where.delete(id);
        }
        state.expenses = state.expenses.filter((e) => !set.has(e.id));
      } else {
        state = { ...state, [table]: (state[table] as { id: string }[]).filter((r) => !set.has(r.id)) };
        dirty.add(SETUP);
        if (table === "categories") {
          state.budgets = state.budgets.filter((b) => !set.has(b.category_id));
          for (const e of state.expenses.filter((x) => set.has(x.category_id))) dirty.add(where.get(e.id)!);
          state.expenses = state.expenses.filter((e) => !set.has(e.category_id));
        }
      }
      await flush();
    },
    async deleteAccount() {
      await running;
      const snap = await col.limit(1000).get();
      for (const d of snap.docs) await col.doc(d.id).delete();
      location.reload();
    },
    async signOut() {
      // Storage follows the Claude account; there is no separate sign-in to leave.
    },
  };
}
