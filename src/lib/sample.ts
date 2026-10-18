import { suggestSplit } from "./budget.ts";
import { addDays, periodStart, shiftPeriod, todayISO } from "./dates.ts";
import { DEMO_USER_ID } from "./backend.ts";
import { DEFAULT_CATEGORIES, type Budget, type Category, type Expense, type Month, type Snapshot } from "./types.ts";

// Deterministic pseudo-random numbers so the sample month looks the same every time.
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const SPOTS: Record<string, [string, number, number][]> = {
  Groceries: [["Aldi", 1200, 3800], ["Lidl", 900, 3000], ["Tesco", 600, 2500]],
  "Eating Out": [["Campus café", 250, 450], ["Boojum", 950, 1250], ["Coffee", 280, 420], ["Snack", 150, 350]],
  Transport: [["Leap top-up", 1000, 2000], ["Dublin Bikes", 300, 500]],
  "Going Out": [["Drinks", 1200, 3500], ["Cinema", 900, 1300], ["Gig tickets", 2500, 4000]],
  Shopping: [["Penneys", 1000, 3500], ["Amazon", 800, 3000]],
  University: [["Printing", 200, 800], ["Books", 1500, 3500]],
  Personal: [["Haircut", 1500, 2500], ["Pharmacy", 500, 1500]],
  Other: [["Gift", 1000, 2500]],
};

const PER_MONTH: Record<string, number> = {
  Groceries: 7,
  "Eating Out": 12,
  Transport: 4,
  "Going Out": 4,
  Shopping: 2,
  University: 2,
  Personal: 1,
  Other: 1,
};

/** A believable student budget with five past months and the current one in progress. */
export function sampleSnapshot(): Snapshot {
  const user_id = DEMO_USER_ID;
  const today = todayISO();
  const rand = rng(42);
  const id = () => crypto.randomUUID();
  const categories: Category[] = DEFAULT_CATEGORIES.map((name, i) => ({ id: id(), user_id, name, sort_order: i, archived: false }));
  const income_sources = [
    { id: id(), user_id, kind: "allowance" as const, name: "Allowance", amount: 80000, day_of_month: 1 },
    { id: id(), user_id, kind: "job" as const, name: "Part-time job", amount: 52000, day_of_month: 25 },
  ];
  const fixed_costs = [
    { id: id(), user_id, name: "Rent", amount: 65000, day_of_month: 1 },
    { id: id(), user_id, name: "Phone", amount: 1500, day_of_month: addDayOfMonth(today, 3) },
    { id: id(), user_id, name: "Gym", amount: 2900, day_of_month: addDayOfMonth(today, 6) },
    { id: id(), user_id, name: "Spotify", amount: 599, day_of_month: 12 },
  ];
  const savings_goal = 10000;
  const available = 80000 + 52000 - 65000 - 1500 - 2900 - 599 - savings_goal;
  const split = suggestSplit(available, categories);

  const current = periodStart(today, 1);
  const months: Month[] = [];
  const budgets: Budget[] = [];
  const expenses: Expense[] = [];
  for (let n = -5; n <= 0; n++) {
    const period = shiftPeriod(current, n, 1);
    const closed = n < 0;
    months.push({ id: id(), user_id, period, carry_in: 0, leftover_action: closed ? "savings" : null, leftover_amount: 0, closed_at: closed ? new Date().toISOString() : null });
    for (const c of categories) budgets.push({ id: id(), user_id, period, category_id: c.id, amount: split.get(c.id) ?? 0 });
    const end = n === 0 ? today : addDays(shiftPeriod(current, n + 1, 1), -1);
    const length = Number(end.slice(8, 10));
    const fraction = length / 30;
    for (const c of categories) {
      const busier = c.name === "Eating Out" && n === 0 ? 1.5 : 1;
      const count = Math.round(PER_MONTH[c.name] * fraction * busier * (0.7 + rand() * 0.6));
      for (let k = 0; k < count; k++) {
        const [description, min, max] = SPOTS[c.name][Math.floor(rand() * SPOTS[c.name].length)];
        const day = 1 + Math.floor(rand() * length);
        expenses.push({
          id: id(),
          user_id,
          amount: Math.round((min + rand() * (max - min)) / 10) * 10,
          category_id: c.id,
          description,
          spent_on: `${period.slice(0, 8)}${String(day).padStart(2, "0")}`,
          payment_method: rand() > 0.8 ? "Cash" : "Card",
          notes: "",
          created_at: new Date().toISOString(),
        });
      }
    }
  }
  return {
    profile: { user_id, currency: "EUR", locale: "en-IE", month_start_day: 1, savings_goal, last_payment_method: "Card", onboarded_at: new Date().toISOString() },
    income_sources,
    fixed_costs,
    categories,
    months,
    budgets,
    expenses,
  };
}

function addDayOfMonth(today: string, days: number) {
  return Number(addDays(today, days).slice(8, 10));
}
