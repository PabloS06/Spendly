"use client";

import { Plus, X } from "lucide-react";
import { newId, useData } from "@/lib/data";
import { sum } from "@/lib/budget";
import type { Category, FixedCost, IncomeKind, IncomeSource } from "@/lib/types";
import { AmountInput, Money } from "./money";
import { Label, Progress, cx } from "./ui";

export const INCOME_KINDS: { kind: IncomeKind; label: string }[] = [
  { kind: "allowance", label: "Allowance" },
  { kind: "job", label: "Part-time job" },
  { kind: "scholarship", label: "Scholarship" },
  { kind: "other", label: "Other" },
];

function DayInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-muted">
      day
      <input
        inputMode="numeric"
        aria-label={label}
        value={value || ""}
        onChange={(e) => onChange(Math.min(31, Math.max(0, Number(e.target.value.replace(/\D/g, "").slice(0, 2)) || 0)))}
        onBlur={() => !value && onChange(1)}
        className="num h-9 w-10 border-b hairline bg-transparent text-center text-fg outline-none focus:border-fg"
      />
    </label>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 border-b hairline py-3">{children}</div>;
}

export function IncomeEditor({ items, onChange }: { items: IncomeSource[]; onChange: (items: IncomeSource[]) => void }) {
  const { fmt, backend } = useData();
  const update = (id: string, patch: Partial<IncomeSource>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  return (
    <div>
      {items.map((item) => (
        <Row key={item.id}>
          <input
            value={item.name}
            onChange={(e) => update(item.id, { name: e.target.value })}
            aria-label="Income name"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          />
          <AmountInput
            cents={item.amount}
            onCents={(amount) => update(item.id, { amount })}
            locale={fmt.locale}
            aria-label={`${item.name} amount`}
            className="w-24 text-right text-[15px]"
          />
          <DayInput value={item.day_of_month} onChange={(day_of_month) => update(item.id, { day_of_month })} label={`${item.name} arrives on day`} />
        </Row>
      ))}
      <AddRow
        label="Add income"
        onClick={() =>
          onChange([...items, { id: newId(), user_id: backend.userId, kind: "other", name: "Other", amount: 0, day_of_month: 1 }])
        }
      />
    </div>
  );
}

export function FixedCostEditor({ items, onChange }: { items: FixedCost[]; onChange: (items: FixedCost[]) => void }) {
  const { fmt, backend } = useData();
  const update = (id: string, patch: Partial<FixedCost>) => onChange(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  return (
    <div>
      {items.map((item) => (
        <Row key={item.id}>
          <input
            value={item.name}
            placeholder="Name"
            onChange={(e) => update(item.id, { name: e.target.value })}
            aria-label="Fixed cost name"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
          />
          <AmountInput
            cents={item.amount}
            onCents={(amount) => update(item.id, { amount })}
            locale={fmt.locale}
            aria-label={`${item.name} amount`}
            className="w-24 text-right text-[15px]"
          />
          <DayInput value={item.day_of_month} onChange={(day_of_month) => update(item.id, { day_of_month })} label={`${item.name} due on day`} />
          <button type="button" aria-label={`Remove ${item.name}`} onClick={() => onChange(items.filter((i) => i.id !== item.id))} className="press text-faint hover:text-fg">
            <X size={16} strokeWidth={1.5} />
          </button>
        </Row>
      ))}
      <AddRow
        label="Add fixed cost"
        onClick={() => onChange([...items, { id: newId(), user_id: backend.userId, name: "", amount: 0, day_of_month: 1 }])}
      />
    </div>
  );
}

function AddRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="press mt-3 flex items-center gap-2 py-2 text-sm text-muted hover:text-fg">
      <Plus size={16} strokeWidth={1.5} /> {label}
    </button>
  );
}

/**
 * Category allocations. When `cap` is set, the total can never exceed it:
 * sliders and typed amounts are clamped to what's still unassigned.
 */
export function PlanEditor({
  categories,
  amounts,
  onChange,
  cap,
}: {
  categories: Category[];
  amounts: Record<string, number>;
  onChange: (amounts: Record<string, number>) => void;
  cap: number | null;
}) {
  const { fmt } = useData();
  const total = sum(categories, (c) => amounts[c.id] ?? 0);
  const unassigned = cap === null ? null : cap - total;
  const set = (id: string, value: number) => {
    const others = total - (amounts[id] ?? 0);
    const max = cap === null ? Infinity : Math.max(0, cap - others);
    onChange({ ...amounts, [id]: Math.max(0, Math.min(value, max)) });
  };
  const sliderMax = Math.max(cap ?? 0, total, 10000);

  return (
    <div>
      {unassigned !== null && (
        <div className="sticky top-0 z-10 -mx-1 bg-bg/95 px-1 py-3 backdrop-blur">
          <div className="flex items-baseline justify-between">
            <Label>Unassigned</Label>
            <Money cents={unassigned} className={cx("text-lg font-semibold", unassigned === 0 ? "text-muted" : "text-fg")} />
          </div>
          <Progress value={cap ? total / cap : 0} className="mt-3" />
        </div>
      )}
      {categories.map((c) => {
        const value = amounts[c.id] ?? 0;
        return (
          <div key={c.id} className="border-b hairline py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[15px]">{c.name}</span>
              <AmountInput
                cents={value}
                max={cap === null ? undefined : Math.max(value, cap - (total - value))}
                onCents={(v) => set(c.id, v)}
                locale={fmt.locale}
                aria-label={`${c.name} budget`}
                className="w-28 text-right text-[15px]"
              />
            </div>
            <input
              type="range"
              min={0}
              max={sliderMax}
              step={500}
              value={value}
              aria-label={`${c.name} budget slider`}
              onChange={(e) => set(c.id, Number(e.target.value))}
              style={{ ["--fill" as string]: `${(value / sliderMax) * 100}%` }}
              className="mt-2"
            />
          </div>
        );
      })}
    </div>
  );
}

