import { test } from "node:test";
import assert from "node:assert/strict";
import { periodRange, periodStart, shiftPeriod, formatDate } from "./dates.ts";
import { formatMoney, parseAmount, parseTyped } from "./money.ts";
import { statusFor, suggestSplit, summarize, upcomingFixedCosts, descriptionMemory } from "./budget.ts";
import { detectHeaderRow, guessMapping, parseDateCell, parseRow } from "./importer.ts";
import { parseCsv, toCsv } from "./csv.ts";
import { observations } from "./insights.ts";
import { sampleSnapshot } from "./sample.ts";
import type { Category, Expense, Snapshot } from "./types.ts";

test("periods respect the month start day and short months", () => {
  assert.equal(periodStart("2026-10-18", 1), "2026-10-01");
  assert.equal(periodStart("2026-10-18", 25), "2026-09-25");
  assert.equal(periodStart("2026-10-25", 25), "2026-10-25");
  assert.deepEqual(periodRange("2026-10-01", 1), { start: "2026-10-01", end: "2026-10-31" });
  assert.deepEqual(periodRange("2026-01-28", 28), { start: "2026-01-28", end: "2026-02-27" });
  assert.equal(shiftPeriod("2026-01-01", -1, 1), "2025-12-01");
  assert.equal(formatDate("2026-10-03"), "03/10/2026");
});

test("amount parsing handles both decimal styles", () => {
  assert.equal(parseAmount("12,50"), 1250);
  assert.equal(parseAmount("€12.50"), 1250);
  assert.equal(parseAmount("1.234,56"), 123456);
  assert.equal(parseAmount("1,234.56"), 123456);
  assert.equal(parseAmount("-3.30"), 330);
  assert.equal(parseAmount("abc"), null);
  assert.equal(parseAmount(4.2), 420);
  assert.equal(parseTyped("3,3"), 330);
  assert.equal(parseTyped("12."), 1200);
  assert.equal(formatMoney(1250, { currency: "EUR", locale: "en-IE" }), "€12.50");
  assert.match(formatMoney(1250, { currency: "EUR", locale: "es-ES" }), /12,50/);
});

test("category status turns amber at 80% and red when over", () => {
  assert.equal(statusFor(79, 100), "ok");
  assert.equal(statusFor(80, 100), "warn");
  assert.equal(statusFor(100, 100), "warn");
  assert.equal(statusFor(101, 100), "over");
});

const cat = (id: string, name: string, i: number): Category => ({ id, user_id: "u", name, sort_order: i, archived: false });
const exp = (amount: number, category_id: string, spent_on: string, description = ""): Expense => ({
  id: `${amount}-${spent_on}-${description}`,
  user_id: "u",
  amount,
  category_id,
  description,
  spent_on,
  payment_method: "Card",
  notes: "",
  created_at: "2026-01-01T00:00:00Z",
});

function snapshot(expenses: Expense[]): Snapshot {
  return {
    profile: { user_id: "u", currency: "EUR", locale: "en-IE", month_start_day: 1, savings_goal: 0, last_payment_method: "Card", onboarded_at: "x" },
    income_sources: [],
    fixed_costs: [],
    categories: [cat("g", "Groceries", 0), cat("e", "Eating Out", 1)],
    months: [{ id: "m", user_id: "u", period: "2026-10-01", carry_in: 1000, leftover_action: null, leftover_amount: 0, closed_at: null }],
    budgets: [
      { id: "b1", user_id: "u", period: "2026-10-01", category_id: "g", amount: 20000 },
      { id: "b2", user_id: "u", period: "2026-10-01", category_id: "e", amount: 5000 },
    ],
    expenses,
  };
}

test("summary: remaining, per-day and category lines", () => {
  const s = snapshot([exp(4500, "e", "2026-10-02"), exp(1000, "g", "2026-10-18"), exp(9999, "g", "2026-09-30")]);
  const sum = summarize(s, "2026-10-01", "2026-10-18");
  assert.equal(sum.budgetTotal, 25000);
  assert.equal(sum.spent, 5500);
  assert.equal(sum.remaining, 25000 + 1000 - 5500);
  assert.equal(sum.daysLeft, 14);
  assert.equal(sum.perDay, Math.floor(20500 / 14));
  assert.equal(sum.lines.find((l) => l.category.id === "e")!.status, "warn");
});

test("suggested split never exceeds what's available", () => {
  const cats = ["Groceries", "Eating Out", "Transport", "Other"].map((n, i) => cat(n, n, i));
  const split = suggestSplit(43210, cats);
  assert.equal([...split.values()].reduce((a, b) => a + b, 0), 43210);
});

test("upcoming fixed costs wrap into next month", () => {
  const fixed = [
    { id: "a", user_id: "u", name: "Rent", amount: 1, day_of_month: 1 },
    { id: "b", user_id: "u", name: "Gym", amount: 1, day_of_month: 20 },
    { id: "c", user_id: "u", name: "Phone", amount: 1, day_of_month: 10 },
  ];
  const up = upcomingFixedCosts(fixed, "2026-10-28", 7);
  assert.deepEqual(up.map((u) => [u.cost.name, u.date]), [["Rent", "2026-11-01"]]);
});

test("descriptions remember their last category", () => {
  const memory = descriptionMemory([exp(100, "g", "2026-10-01", "Aldi"), exp(100, "e", "2026-10-05", "aldi ")]);
  assert.equal(memory.get("aldi"), "e");
});

test("import: header detection, mapping and row parsing", () => {
  const rows = [["My budget 2026"], [], ["Fecha", "Concepto", "Categoría", "Importe"], ["03/10/2026", "Aldi", "Food", "12,50"], ["bad", "x", "y", "1"]];
  const header = detectHeaderRow(rows);
  assert.equal(header, 2);
  const mapping = guessMapping(rows[header]);
  assert.deepEqual([mapping.date, mapping.description, mapping.category, mapping.amount], [0, 1, 2, 3]);
  assert.deepEqual(parseRow(rows[3], mapping), { date: "2026-10-03", amount: 1250, description: "Aldi", category: "Food", payment_method: "", notes: "" });
  assert.equal(parseRow(rows[4], mapping), null);
  assert.equal(parseDateCell(46298), "2026-10-03");
  assert.equal(parseDateCell("2026-02-30"), null);
});

test("csv round trip", () => {
  const s = snapshot([exp(330, "e", "2026-10-02", 'Café "Central", Dublin')]);
  const parsed = parseCsv(toCsv(s));
  assert.deepEqual(parsed[1], ["02/10/2026", 'Café "Central", Dublin', "Eating Out", "3.30", "Card", ""]);
  assert.deepEqual(parseCsv("a;b\n1;2\n"), [["a", "b"], ["1", "2"]]);
});

test("insights produce at most three observations on sample data", () => {
  const s = sampleSnapshot();
  const notes = observations(s, s.months[s.months.length - 1].period, new Date().toISOString().slice(0, 10), { currency: "EUR", locale: "en-IE" });
  assert.ok(notes.length <= 3);
  console.log(notes);
});
