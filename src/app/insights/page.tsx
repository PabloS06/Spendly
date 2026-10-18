"use client";

import { AppShell } from "@/components/app-shell";
import { Money, useMoney } from "@/components/money";
import { EmptyState, Label, cx } from "@/components/ui";
import { currentPeriod, expensesIn, spentByCategory } from "@/lib/budget";
import { useLoaded } from "@/lib/data";
import { periodLabel, periodRange, shiftPeriod, todayISO } from "@/lib/dates";
import { monthlyTotals, observations } from "@/lib/insights";

export default function InsightsPage() {
  return (
    <AppShell>
      <Insights />
    </AppShell>
  );
}

function Insights() {
  const { data, profile, fmt } = useLoaded();
  const money = useMoney();
  const today = todayISO();
  const startDay = profile.month_start_day;
  const period = currentPeriod(data, today);
  const prev = shiftPeriod(period, -1, startDay);

  const thisByCat = spentByCategory(expensesIn(data.expenses, periodRange(period, startDay)));
  const lastByCat = spentByCategory(expensesIn(data.expenses, periodRange(prev, startDay)));
  const rows = data.categories
    .filter((c) => thisByCat.has(c.id) || lastByCat.has(c.id))
    .map((c) => ({ category: c, now: thisByCat.get(c.id) ?? 0, last: lastByCat.get(c.id) ?? 0 }))
    .sort((a, b) => b.now - a.now || b.last - a.last);
  const rowMax = Math.max(1, ...rows.flatMap((r) => [r.now, r.last]));

  const months = monthlyTotals(data, period, 6);
  const monthMax = Math.max(1, ...months.map((m) => m.spent));
  const notes = observations(data, period, today, fmt);

  if (data.expenses.length === 0) {
    return <EmptyState title="No insights yet" body="Once you've logged a few expenses, this is where patterns show up." />;
  }

  return (
    <div className="space-y-14 pt-6">
      {notes.length > 0 && (
        <section aria-label="Observations">
          <ul className="space-y-4">
            {notes.map((n) => (
              <li key={n} className="border-l-[1.5px] border-accent pl-4 text-[17px] leading-snug tracking-[-0.01em]">
                {n}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Last 6 months">
        <Label>Last 6 months</Label>
        <div className="mt-6 flex h-44 items-end gap-3" role="img" aria-label="Spending per month for the last 6 months">
          {months.map((m) => {
            const current = m.period === period;
            return (
              <div key={m.period} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <span className={cx("num text-[11px]", current ? "text-fg" : "text-muted")}>{m.spent ? money(m.spent, false) : ""}</span>
                <div
                  className={cx("w-full max-w-10 rounded-[3px] transition-[height] duration-200 ease-out", current ? "bg-accent" : "bg-fg/15")}
                  style={{ height: `${Math.max(m.spent ? 2 : 0, (m.spent / monthMax) * 100)}%` }}
                />
                <span className={cx("text-[11px]", current ? "text-fg" : "text-muted")}>{periodLabel(m.period, startDay, fmt.locale, true)}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section aria-label="This month vs last month">
        <div className="flex items-baseline justify-between">
          <Label>This month vs last</Label>
          <span className="flex items-center gap-3 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              <i className="h-[3px] w-3 rounded-full bg-fg" /> This month
            </span>
            <span className="flex items-center gap-1.5">
              <i className="h-[3px] w-3 rounded-full bg-fg/20" /> Last month
            </span>
          </span>
        </div>
        <ul className="mt-3">
          {rows.map(({ category, now, last }) => {
            return (
              <li key={category.id} className="border-b hairline py-4">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-[15px]">{category.name}</span>
                  <span className="num text-sm">
                    <Money cents={now} />
                    <span className="ml-2 text-xs text-muted">
                      vs <Money cents={last} decimals={false} />
                    </span>
                  </span>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="h-[3px] rounded-full bg-fg transition-[width] duration-200" style={{ width: `${(now / rowMax) * 100}%` }} />
                  <div className="h-[3px] rounded-full bg-fg/20 transition-[width] duration-200" style={{ width: `${(last / rowMax) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
