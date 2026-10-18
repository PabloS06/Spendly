"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageSkeleton } from "@/components/app-gate";
import { useExpenseSheet } from "@/components/expense-sheet";
import { Money } from "@/components/money";
import { SwipeRow } from "@/components/swipe-row";
import { useToast } from "@/components/toast";
import { EmptyState, ICON } from "@/components/ui";
import { currentPeriod, sum } from "@/lib/budget";
import { useLoaded } from "@/lib/data";
import { dayHeading, inRange, periodLabel, periodRange, periodStart, todayISO } from "@/lib/dates";
import type { Expense } from "@/lib/types";

export default function ActivityPage() {
  return (
    <AppShell>
      <Suspense fallback={<PageSkeleton />}>
        <Activity />
      </Suspense>
    </AppShell>
  );
}

const selectClass = "h-9 min-w-0 flex-1 rounded-full border hairline bg-transparent px-3 text-sm outline-none";

function Activity() {
  const { data, profile, fmt, save, remove } = useLoaded();
  const sheet = useExpenseSheet();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const startDay = profile.month_start_day;
  const today = todayISO();

  const category = params.get("category") ?? "";
  const [month, setMonth] = useState(params.get("month") ?? currentPeriod(data, today));
  const [query, setQuery] = useState("");

  const months = useMemo(() => {
    const set = new Set(data.expenses.map((e) => periodStart(e.spent_on, startDay)));
    set.add(currentPeriod(data, today));
    return [...set].sort().reverse();
  }, [data, startDay, today]);

  const categoryName = useMemo(() => new Map(data.categories.map((c) => [c.id, c.name])), [data.categories]);

  const days = useMemo(() => {
    const range = month === "all" ? null : periodRange(month, startDay);
    const q = query.trim().toLowerCase();
    const list = data.expenses
      .filter((e) => !range || inRange(e.spent_on, range))
      .filter((e) => !category || e.category_id === category)
      .filter((e) => !q || e.description.toLowerCase().includes(q) || (categoryName.get(e.category_id) ?? "").toLowerCase().includes(q))
      .sort((a, b) => (b.spent_on + b.created_at).localeCompare(a.spent_on + a.created_at));
    const groups = new Map<string, Expense[]>();
    for (const e of list) groups.set(e.spent_on, [...(groups.get(e.spent_on) ?? []), e]);
    return [...groups.entries()];
  }, [data.expenses, month, category, query, startDay, categoryName]);

  const setCategory = (id: string) => router.replace(id ? `/activity/?category=${id}` : "/activity/", { scroll: false });

  const onDelete = (e: Expense) => {
    void remove("expenses", [e.id]);
    toast.show({ text: "Expense deleted", action: { label: "Undo", onClick: () => void save("expenses", [e]) } });
  };

  const total = sum(days, ([, list]) => sum(list, (e) => e.amount));

  return (
    <div className="pt-2">
      <div className="flex h-11 items-center gap-3 border-b hairline">
        <Search {...ICON} size={18} className="text-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          aria-label="Search expenses"
          className="h-full flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
        />
      </div>
      <div className="mt-4 flex gap-2">
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className={selectClass}>
          <option value="">All categories</option>
          {data.categories
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.archived ? " (archived)" : ""}
              </option>
            ))}
        </select>
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" className={selectClass}>
          {months.map((m) => (
            <option key={m} value={m}>
              {periodLabel(m, startDay, fmt.locale)}
            </option>
          ))}
          <option value="all">All time</option>
        </select>
      </div>

      {days.length === 0 ? (
        <EmptyState
          title={query || category ? "Nothing matches" : "No expenses yet"}
          body={query || category ? "Try another search or filter." : "Tap + to log your first one. It takes a few seconds."}
        />
      ) : (
        <>
          <p className="num mt-6 text-xs text-muted">
            Total <Money cents={total} className="text-fg" />
          </p>
          {days.map(([day, list]) => (
            <section key={day} className="mt-6">
              <div className="flex items-baseline justify-between pb-1">
                <h2 className="text-xs font-medium uppercase tracking-[0.08em] text-muted">{dayHeading(day, fmt.locale)}</h2>
                <Money cents={sum(list, (e) => e.amount)} className="text-xs text-muted" />
              </div>
              <ul>
                {list.map((e) => (
                  <li key={e.id} className="border-b hairline">
                    <SwipeRow onTap={() => sheet.open({ expense: e })} onDelete={() => onDelete(e)}>
                      <div className="flex items-center justify-between gap-4 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-[15px]">{e.description || categoryName.get(e.category_id)}</p>
                          <p className="mt-0.5 truncate text-[13px] text-muted">
                            {e.description ? categoryName.get(e.category_id) : null}
                            {e.description ? " · " : ""}
                            {e.payment_method}
                          </p>
                        </div>
                        <Money cents={e.amount} className="shrink-0 text-[15px]" />
                      </div>
                    </SwipeRow>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
