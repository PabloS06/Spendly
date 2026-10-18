// Row types mirror supabase/migrations/0001_init.sql. Money is integer cents.

export type IncomeKind = "allowance" | "job" | "scholarship" | "other";

export interface Profile {
  user_id: string;
  currency: string;
  locale: string;
  month_start_day: number;
  savings_goal: number;
  last_payment_method: string;
  onboarded_at: string | null;
}

export interface IncomeSource {
  id: string;
  user_id: string;
  kind: IncomeKind;
  name: string;
  amount: number;
  day_of_month: number;
}

export interface FixedCost {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  day_of_month: number;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  sort_order: number;
  archived: boolean;
}

export interface Month {
  id: string;
  user_id: string;
  period: string; // YYYY-MM-DD, first day of the period
  carry_in: number;
  leftover_action: "savings" | "next_month" | null;
  leftover_amount: number;
  closed_at: string | null;
}

export interface Budget {
  id: string;
  user_id: string;
  period: string;
  category_id: string;
  amount: number;
}

export interface Expense {
  id: string;
  user_id: string;
  amount: number;
  category_id: string;
  description: string;
  spent_on: string; // YYYY-MM-DD
  payment_method: string;
  notes: string;
  created_at: string;
}

export interface Tables {
  profiles: Profile;
  income_sources: IncomeSource;
  fixed_costs: FixedCost;
  categories: Category;
  months: Month;
  budgets: Budget;
  expenses: Expense;
}

export type TableName = keyof Tables;

export type ListTable = Exclude<TableName, "profiles">;

export interface Snapshot {
  profile: Profile | null;
  income_sources: IncomeSource[];
  fixed_costs: FixedCost[];
  categories: Category[];
  months: Month[];
  budgets: Budget[];
  expenses: Expense[];
}

export const PAYMENT_METHODS = ["Card", "Cash", "Bank transfer", "Mobile"] as const;

export const DEFAULT_CATEGORIES = [
  "Groceries",
  "Eating Out",
  "Transport",
  "Going Out",
  "Shopping",
  "University",
  "Personal",
  "Other",
] as const;

// Sensible student defaults for the spending plan, as a share of what's available.
export const DEFAULT_SPLIT: Record<string, number> = {
  Groceries: 0.3,
  "Eating Out": 0.12,
  Transport: 0.1,
  "Going Out": 0.12,
  Shopping: 0.1,
  University: 0.06,
  Personal: 0.1,
  Other: 0.1,
};
