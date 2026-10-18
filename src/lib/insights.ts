import { budgetsFor, expensesIn, spentByCategory, sum } from "./budget.ts";
import { addDays, daysBetween, parseISODate, periodRange, shiftPeriod } from "./dates.ts";
import { formatMoney, type MoneyFormat } from "./money.ts";
import type { Snapshot } from "./types.ts";

const SMALL = 500; // a "small purchase" is under 5.00

/**
 * Up to three plain-language observations about the period, from simple rules.
 * While the period is still running, comparisons use the same point last month.
 */
export function observations(s: Snapshot, period: string, today: string, fmt: MoneyFormat): string[] {
  const startDay = s.profile?.month_start_day ?? 1;
  const money = (c: number) => formatMoney(c, fmt, { decimals: false });
  const range = periodRange(period, startDay);
  const inProgress = today >= range.start && today <= range.end;
  const elapsed = inProgress ? daysBetween(range.start, today) + 1 : daysBetween(range.start, range.end) + 1;
  const totalDays = daysBetween(range.start, range.end) + 1;

  const prevStart = shiftPeriod(period, -1, startDay);
  const prevRange = periodRange(prevStart, startDay);
  const prevCompare = inProgress ? { start: prevRange.start, end: minDate(addDays(prevStart, elapsed - 1), prevRange.end) } : prevRange;

  const now = expensesIn(s.expenses, { start: range.start, end: inProgress ? today : range.end });
  const before = expensesIn(s.expenses, prevCompare);
  const nowByCat = spentByCategory(now);
  const beforeByCat = spentByCategory(before);
  const name = (id: string) => s.categories.find((c) => c.id === id)?.name ?? "Other";
  const than = inProgress ? "than at this point last month" : "than last month";
  const out: { priority: number; text: string }[] = [];

  // Biggest rise and fall per category.
  const changes = [...new Set([...nowByCat.keys(), ...beforeByCat.keys()])]
    .map((id) => ({ id, now: nowByCat.get(id) ?? 0, before: beforeByCat.get(id) ?? 0 }))
    .filter((c) => c.before >= 500 && Math.abs(c.now - c.before) >= 1000)
    .map((c) => ({ ...c, pct: Math.round(((c.now - c.before) / c.before) * 100) }));
  const rise = changes.filter((c) => c.pct >= 25).sort((a, b) => b.pct - a.pct)[0];
  if (rise) out.push({ priority: 1, text: `${name(rise.id)} is ${rise.pct}% higher ${than}.` });
  const fall = changes.filter((c) => c.pct <= -25).sort((a, b) => a.pct - b.pct)[0];
  if (fall) out.push({ priority: 4, text: `${name(fall.id)} is ${-fall.pct}% lower ${than}. Nice.` });

  // Lots of small purchases add up.
  const small = now.filter((e) => e.amount < SMALL);
  if (small.length >= 5) {
    out.push({ priority: 2, text: `${small.length} small purchases under ${money(SMALL)} this month: ${money(sum(small, (e) => e.amount))} in total.` });
  }

  // Pace: where the month will land if spending continues like this.
  const budget = sum(budgetsFor(s.budgets, period), (b) => b.amount) + (s.months.find((m) => m.period === period)?.carry_in ?? 0);
  const spent = sum(now, (e) => e.amount);
  if (inProgress && budget > 0 && elapsed >= 5 && elapsed < totalDays) {
    const projected = Math.round((spent / elapsed) * totalDays);
    const diff = projected - budget;
    if (diff > 1000) out.push({ priority: 3, text: `At this pace you'll finish about ${money(diff)} over budget.` });
    else if (diff < -1000) out.push({ priority: 5, text: `At this pace you'll finish about ${money(-diff)} under budget.` });
  }

  // Weekend-heavy spending.
  if (now.length >= 10 && spent > 0) {
    const weekend = sum(
      now.filter((e) => [0, 6].includes(parseISODate(e.spent_on).getDay())),
      (e) => e.amount,
    );
    const share = Math.round((weekend / spent) * 100);
    if (share >= 50) out.push({ priority: 6, text: `${share}% of your spending this month happened at weekends.` });
  }

  // The category taking the biggest share.
  if (spent > 0 && nowByCat.size >= 3) {
    const [topId, top] = [...nowByCat.entries()].sort((a, b) => b[1] - a[1])[0];
    const share = Math.round((top / spent) * 100);
    if (share >= 30) out.push({ priority: 7, text: `${name(topId)} is ${share}% of everything you've spent this month.` });
  }

  return out
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3)
    .map((o) => o.text);
}

function minDate(a: string, b: string) {
  return a < b ? a : b;
}

/** Total spent in each of the last `count` periods ending with `period`, oldest first. */
export function monthlyTotals(s: Snapshot, period: string, count: number): { period: string; spent: number }[] {
  const startDay = s.profile?.month_start_day ?? 1;
  return Array.from({ length: count }, (_, i) => {
    const p = shiftPeriod(period, i - count + 1, startDay);
    return { period: p, spent: sum(expensesIn(s.expenses, periodRange(p, startDay)), (e) => e.amount) };
  });
}
