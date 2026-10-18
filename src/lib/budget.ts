import { addDays, dayInMonth, daysBetween, inRange, parseISODate, periodRange, periodStart, shiftPeriod, toISODate } from "./dates.ts";
import { DEFAULT_SPLIT, type Budget, type Category, type Expense, type FixedCost, type Snapshot } from "./types.ts";

export type BudgetStatus = "ok" | "warn" | "over";

export interface CategoryLine {
  category: Category;
  budget: number;
  spent: number;
  left: number;
  ratio: number;
  status: BudgetStatus;
}

export interface PeriodSummary {
  period: string;
  range: { start: string; end: string };
  budgetTotal: number;
  carryIn: number;
  spent: number;
  remaining: number;
  daysLeft: number;
  perDay: number;
  lines: CategoryLine[];
}

export function statusFor(spent: number, budget: number): BudgetStatus {
  if (spent > budget) return "over";
  if (budget > 0 && spent >= budget * 0.8) return "warn";
  return "ok";
}

export function sum<T>(items: T[], value: (item: T) => number): number {
  return items.reduce((total, item) => total + value(item), 0);
}

export function totalIncome(s: Pick<Snapshot, "income_sources">): number {
  return sum(s.income_sources, (i) => i.amount);
}

export function totalFixed(s: Pick<Snapshot, "fixed_costs">): number {
  return sum(s.fixed_costs, (f) => f.amount);
}

/** Available to spend = income − fixed costs − savings. */
export function availableToSpend(s: Snapshot): number {
  return Math.max(0, totalIncome(s) - totalFixed(s) - (s.profile?.savings_goal ?? 0));
}

/** Budget rows for a period; falls back to the latest earlier period that has any. */
export function budgetsFor(budgets: Budget[], period: string): Budget[] {
  const exact = budgets.filter((b) => b.period === period);
  if (exact.length) return exact;
  const earlier = budgets.filter((b) => b.period < period).map((b) => b.period).sort();
  const latest = earlier[earlier.length - 1];
  return latest ? budgets.filter((b) => b.period === latest) : [];
}

export function expensesIn(expenses: Expense[], range: { start: string; end: string }): Expense[] {
  return expenses.filter((e) => inRange(e.spent_on, range));
}

export function spentByCategory(expenses: Expense[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const e of expenses) map.set(e.category_id, (map.get(e.category_id) ?? 0) + e.amount);
  return map;
}

export function currentPeriod(s: Snapshot, today: string): string {
  return periodStart(today, s.profile?.month_start_day ?? 1);
}

export function summarize(s: Snapshot, period: string, today: string): PeriodSummary {
  const startDay = s.profile?.month_start_day ?? 1;
  const range = periodRange(period, startDay);
  const budgets = budgetsFor(s.budgets, period);
  const budgetByCat = new Map(budgets.map((b) => [b.category_id, b.amount]));
  const spentByCat = spentByCategory(expensesIn(s.expenses, range));

  const lines: CategoryLine[] = s.categories
    .filter((c) => !c.archived || budgetByCat.has(c.id) || spentByCat.has(c.id))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((category) => {
      const budget = budgetByCat.get(category.id) ?? 0;
      const spent = spentByCat.get(category.id) ?? 0;
      return {
        category,
        budget,
        spent,
        left: budget - spent,
        ratio: budget > 0 ? spent / budget : spent > 0 ? 1 : 0,
        status: statusFor(spent, budget),
      };
    });

  const budgetTotal = sum(budgets, (b) => b.amount);
  const carryIn = s.months.find((m) => m.period === period)?.carry_in ?? 0;
  const spent = sum(lines, (l) => l.spent);
  const remaining = budgetTotal + carryIn - spent;

  let daysLeft: number;
  if (today > range.end) daysLeft = 0;
  else if (today < range.start) daysLeft = daysBetween(range.start, range.end) + 1;
  else daysLeft = daysBetween(today, range.end) + 1;

  const perDay = daysLeft > 0 ? Math.floor(Math.max(0, remaining) / daysLeft) : 0;
  return { period, range, budgetTotal, carryIn, spent, remaining, daysLeft, perDay, lines };
}

/** Next date (on or after today) each fixed cost falls due, within `days` days. */
export function upcomingFixedCosts(fixed: FixedCost[], today: string, days = 7): { cost: FixedCost; date: string }[] {
  const limit = addDays(today, days);
  const t = parseISODate(today);
  return fixed
    .map((cost) => {
      let due = toISODate(dayInMonth(t.getFullYear(), t.getMonth(), cost.day_of_month));
      if (due < today) due = toISODate(dayInMonth(t.getFullYear(), t.getMonth() + 1, cost.day_of_month));
      return { cost, date: due };
    })
    .filter((u) => u.date <= limit)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Splits `available` across categories using student defaults, rounded to whole euros. */
export function suggestSplit(available: number, categories: Category[]): Map<string, number> {
  const active = categories.filter((c) => !c.archived);
  const weights = active.map((c) => DEFAULT_SPLIT[c.name] ?? 0.05);
  const totalWeight = sum(weights, (w) => w) || 1;
  const result = new Map<string, number>();
  let assigned = 0;
  active.forEach((c, i) => {
    const amount = Math.floor(((available * weights[i]) / totalWeight) / 100) * 100;
    result.set(c.id, amount);
    assigned += amount;
  });
  // Rounding leftovers go to the biggest category so nothing is unassigned by accident.
  if (active.length && available > assigned) {
    const biggest = active[weights.indexOf(Math.max(...weights))];
    result.set(biggest.id, (result.get(biggest.id) ?? 0) + (available - assigned));
  }
  return result;
}

/** description (lowercased) → category id of the most recent expense with it. */
export function descriptionMemory(expenses: Expense[]): Map<string, string> {
  const sorted = [...expenses].sort((a, b) => (a.spent_on + a.created_at).localeCompare(b.spent_on + b.created_at));
  const map = new Map<string, string>();
  for (const e of sorted) {
    const key = e.description.trim().toLowerCase();
    if (key) map.set(key, e.category_id);
  }
  return map;
}

/** Distinct past descriptions, most recently used first. */
export function recentDescriptions(expenses: Expense[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const sorted = [...expenses].sort((a, b) => (b.spent_on + b.created_at).localeCompare(a.spent_on + a.created_at));
  for (const e of sorted) {
    const d = e.description.trim();
    if (d && !seen.has(d.toLowerCase())) {
      seen.add(d.toLowerCase());
      out.push(d);
    }
  }
  return out;
}

/** The `count` periods before `current`, oldest first. */
export function pastPeriods(s: Snapshot, current: string, count: number): string[] {
  const startDay = s.profile?.month_start_day ?? 1;
  return Array.from({ length: count }, (_, i) => shiftPeriod(current, i - count, startDay));
}
