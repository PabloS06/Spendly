"use client";

import { createContext, useCallback, useContext, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { budgetsFor, currentPeriod, descriptionMemory, expensesIn, recentDescriptions } from "@/lib/budget";
import { useData, newId } from "@/lib/data";
import { formatDate, inRange, periodRange, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHODS, type Expense, type Snapshot } from "@/lib/types";
import { AmountInput } from "./money";
import { useToast } from "./toast";
import { Button, ICON, Sheet, cx } from "./ui";

interface OpenOptions {
  expense?: Expense;
  categoryId?: string;
}

const SheetContext = createContext<{ open: (opts?: OpenOptions) => void } | null>(null);

export function ExpenseSheetProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(OpenOptions & { key: number }) | null>(null);
  const open = useCallback((opts: OpenOptions = {}) => setState({ ...opts, key: Date.now() }), []);
  const close = useCallback(() => setState(null), []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <SheetContext.Provider value={value}>
      {children}
      <Sheet open={state !== null} onClose={close} label={state?.expense ? "Edit expense" : "Add expense"}>
        {state && <ExpenseForm key={state.key} expense={state.expense} categoryId={state.categoryId} onDone={close} />}
      </Sheet>
    </SheetContext.Provider>
  );
}

export function useExpenseSheet() {
  const ctx = useContext(SheetContext);
  if (!ctx) throw new Error("useExpenseSheet outside ExpenseSheetProvider");
  return ctx;
}

/** "€3.30 · Eating Out · €46.70 left in Eating Out" */
function confirmation(s: Snapshot, e: Expense, fmt: { currency: string; locale: string }): string {
  const money = (c: number) => formatMoney(c, fmt);
  const name = s.categories.find((c) => c.id === e.category_id)?.name ?? "";
  const period = currentPeriod(s, todayISO());
  const range = periodRange(period, s.profile?.month_start_day ?? 1);
  const head = `${money(e.amount)} · ${name}`;
  if (!inRange(e.spent_on, range)) return head;
  const budget = budgetsFor(s.budgets, period).find((b) => b.category_id === e.category_id)?.amount ?? 0;
  const spent = expensesIn(s.expenses, range)
    .filter((x) => x.category_id === e.category_id && x.id !== e.id)
    .reduce((t, x) => t + x.amount, e.amount);
  const left = budget - spent;
  return left >= 0 ? `${head} · ${money(left)} left in ${name}` : `${head} · ${money(-left)} over in ${name}`;
}

function ExpenseForm({ expense, categoryId, onDone }: OpenOptions & { onDone: () => void }) {
  const { data, save, remove, fmt, backend } = useData();
  const toast = useToast();
  const s = data!;
  const profile = s.profile!;

  const [amount, setAmount] = useState(expense?.amount ?? 0);
  const [category, setCategory] = useState(expense?.category_id ?? categoryId ?? "");
  const [description, setDescription] = useState(expense?.description ?? "");
  const [date, setDate] = useState(expense?.spent_on ?? todayISO());
  const [method, setMethod] = useState(expense?.payment_method ?? profile.last_payment_method);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const categories = s.categories.filter((c) => !c.archived || c.id === category).sort((a, b) => a.sort_order - b.sort_order);
  const memory = useMemo(() => descriptionMemory(s.expenses), [s.expenses]);
  const past = useMemo(() => recentDescriptions(s.expenses), [s.expenses]);
  const query = description.trim().toLowerCase();
  const suggestions = query ? past.filter((d) => d.toLowerCase().startsWith(query) && d.toLowerCase() !== query).slice(0, 4) : [];

  const pickDescription = (value: string) => {
    setDescription(value);
    const remembered = memory.get(value.trim().toLowerCase());
    if (remembered && s.categories.some((c) => c.id === remembered && !c.archived)) setCategory(remembered);
  };

  const valid = amount > 0 && Boolean(category) && Boolean(date);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const row: Expense = {
      id: expense?.id ?? newId(),
      user_id: backend.userId,
      amount,
      category_id: category,
      description: description.trim(),
      spent_on: date,
      payment_method: method,
      notes: expense?.notes ?? "",
      created_at: expense?.created_at ?? new Date().toISOString(),
    };
    void save("expenses", [row]);
    if (method !== profile.last_payment_method) void save("profiles", [{ ...profile, last_payment_method: method }]);
    toast.show({ text: confirmation({ ...s, expenses: s.expenses.filter((x) => x.id !== row.id).concat(row) }, row, fmt) });
    onDone();
  };

  const onDelete = () => {
    if (!expense) return;
    void remove("expenses", [expense.id]);
    toast.show({ text: "Expense deleted", action: { label: "Undo", onClick: () => void save("expenses", [expense]) } });
    onDone();
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium">{expense ? "Edit expense" : "Add expense"}</h2>
        {expense && (
          <button type="button" onClick={onDelete} aria-label="Delete expense" className="press p-2 text-muted hover:text-danger">
            <Trash2 {...ICON} />
          </button>
        )}
      </div>

      <label className="flex items-baseline gap-2">
        <span className="text-3xl font-medium text-faint">{currencySymbol(fmt)}</span>
        <AmountInput
          autoFocus
          aria-label="Amount"
          cents={amount}
          onCents={setAmount}
          locale={fmt.locale}
          className="w-full text-5xl font-semibold tracking-tight"
        />
      </label>

      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Category">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cx(
              "press h-9 rounded-full px-4 text-sm",
              category === c.id ? "bg-fg text-bg" : "border hairline text-muted hover:text-fg",
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="relative">
        <input
          value={description}
          onChange={(e) => pickDescription(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
          placeholder="Description (optional)"
          aria-label="Description"
          className="h-11 w-full border-b hairline bg-transparent text-[15px] outline-none placeholder:text-faint focus:border-fg"
        />
        {showSuggestions && suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((d) => (
              <button
                key={d}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickDescription(d)}
                className="press h-8 rounded-full bg-track px-3 text-sm"
              >
                {d}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm text-muted">
        {/* Native picker underneath, but always shown as DD/MM/YYYY. */}
        <label className="num relative flex h-9 items-center rounded-full border hairline px-3 text-fg">
          {date === todayISO() ? "Today" : formatDate(date)}
          <input
            type="date"
            value={date}
            max="2100-12-31"
            onChange={(e) => e.target.value && setDate(e.target.value)}
            onClick={(e) => e.currentTarget.showPicker?.()}
            aria-label="Date"
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          aria-label="Payment method"
          className="h-9 rounded-full border hairline bg-transparent px-3 text-fg outline-none"
        >
          {[...new Set([...PAYMENT_METHODS, method])].map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>

      <Button type="submit" disabled={!valid} className="w-full">
        {expense ? "Save changes" : "Save"}
      </Button>
    </form>
  );
}

function currencySymbol(fmt: { currency: string; locale: string }) {
  return (
    new Intl.NumberFormat(fmt.locale, { style: "currency", currency: fmt.currency }).formatToParts(0).find((p) => p.type === "currency")?.value ??
    fmt.currency
  );
}
