"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppGate, PageSkeleton } from "@/components/app-gate";
import { FixedCostEditor, INCOME_KINDS, IncomeEditor, PlanEditor } from "@/components/budget-editors";
import { AmountInput, Money } from "@/components/money";
import { Button, ICON, Label, cx } from "@/components/ui";
import { budgetsFor, currentPeriod, suggestSplit, sum } from "@/lib/budget";
import { newId, useLoaded } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import type { Budget, FixedCost, IncomeSource, ListTable, Month } from "@/lib/types";

const STEPS = ["income", "fixed", "savings", "plan"] as const;
type Step = (typeof STEPS)[number];

const COPY: Record<Step, { title: string; body: string }> = {
  income: { title: "Money in", body: "What arrives each month, and on which day." },
  fixed: { title: "Fixed costs", body: "These are set aside automatically every month." },
  savings: { title: "Savings goal", body: "How much you want to put aside each month. Optional." },
  plan: { title: "Spending plan", body: "Split what's left across your categories." },
};

export default function OnboardingPage() {
  return (
    <AppGate onboarding>
      <Suspense fallback={<PageSkeleton />}>
        <Onboarding />
      </Suspense>
    </AppGate>
  );
}

function Onboarding() {
  const router = useRouter();
  const params = useSearchParams();
  const edit = STEPS.find((s) => s === params.get("edit")) ?? null;
  const { data, profile, save, remove, backend, fmt } = useLoaded();
  const today = todayISO();
  const period = currentPeriod(data, today);
  const categories = data.categories.filter((c) => !c.archived).sort((a, b) => a.sort_order - b.sort_order);

  const [step, setStep] = useState<Step>(edit ?? "income");
  const [income, setIncome] = useState<IncomeSource[]>(() =>
    data.income_sources.length
      ? data.income_sources
      : INCOME_KINDS.map(({ kind, label }) => ({ id: newId(), user_id: backend.userId, kind, name: label, amount: 0, day_of_month: 1 })),
  );
  const [fixed, setFixed] = useState<FixedCost[]>(() =>
    data.fixed_costs.length
      ? data.fixed_costs
      : ["Rent", "Bills", "Phone", "Gym", "Subscriptions"].map((name) => ({ id: newId(), user_id: backend.userId, name, amount: 0, day_of_month: 1 })),
  );
  const [savings, setSavings] = useState(profile.savings_goal);
  const [plan, setPlan] = useState<Record<string, number>>(() =>
    Object.fromEntries(budgetsFor(data.budgets, period).map((b) => [b.category_id, b.amount])),
  );

  const incomeTotal = sum(income, (i) => i.amount);
  const fixedTotal = sum(fixed, (f) => f.amount);
  const available = Math.max(0, incomeTotal - fixedTotal - savings);
  // Without any income entered there's nothing to cap against, so the plan is free-form.
  const cap = incomeTotal > 0 ? available : null;

  async function syncList<T extends { id: string }>(table: ListTable, original: T[], next: T[]) {
    const keep = new Set(next.map((r) => r.id));
    await remove(table, original.filter((r) => !keep.has(r.id)).map((r) => r.id));
    await save(table as "income_sources", next as unknown as IncomeSource[]);
  }

  async function persist(s: Step) {
    if (s === "income") await syncList("income_sources", data.income_sources, income.filter((i) => i.amount > 0));
    if (s === "fixed") await syncList("fixed_costs", data.fixed_costs, fixed.filter((f) => f.name.trim() && f.amount > 0));
    if (s === "savings") await save("profiles", [{ ...profile, savings_goal: savings }]);
    if (s === "plan") {
      const existing = new Map(data.budgets.filter((b) => b.period === period).map((b) => [b.category_id, b]));
      const rows: Budget[] = categories.map((c) => ({
        id: existing.get(c.id)?.id ?? newId(),
        user_id: backend.userId,
        period,
        category_id: c.id,
        amount: plan[c.id] ?? 0,
      }));
      await save("budgets", rows);
    }
  }

  async function finish() {
    if (!data.months.some((m) => m.period === period)) {
      const month: Month = { id: newId(), user_id: backend.userId, period, carry_in: 0, leftover_action: null, leftover_amount: 0, closed_at: null };
      await save("months", [month]);
    }
    await save("profiles", [{ ...profile, savings_goal: savings, onboarded_at: profile.onboarded_at ?? new Date().toISOString() }]);
    router.replace("/");
  }

  function goTo(next: Step) {
    // Arriving at the plan with nothing allocated yet: start from the suggested split.
    if (next === "plan" && sum(categories, (c) => plan[c.id] ?? 0) === 0 && available > 0) {
      setPlan(Object.fromEntries(suggestSplit(available, categories)));
    }
    setStep(next);
    window.scrollTo({ top: 0 });
  }

  async function advance(persistStep: boolean) {
    if (persistStep) await persist(step);
    if (edit) return router.push("/settings/");
    const i = STEPS.indexOf(step);
    if (i < STEPS.length - 1) goTo(STEPS[i + 1]);
    else await finish();
  }

  const index = STEPS.indexOf(step);
  const copy = COPY[step];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-[max(1.25rem,env(safe-area-inset-left))] md:max-w-lg pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="flex h-11 items-center justify-between">
        {edit ? (
          <Link href="/settings/" className="press -ml-2 p-2 text-muted hover:text-fg" aria-label="Back to settings">
            <ArrowLeft {...ICON} />
          </Link>
        ) : index > 0 ? (
          <button onClick={() => goTo(STEPS[index - 1])} className="press -ml-2 p-2 text-muted hover:text-fg" aria-label="Back">
            <ArrowLeft {...ICON} />
          </button>
        ) : (
          <span />
        )}
        {!edit && (
          <button onClick={() => void finish()} className="text-sm text-muted hover:text-fg">
            Skip setup
          </button>
        )}
      </div>

      {!edit && (
        <div className="mt-4 grid grid-cols-4 gap-1.5" aria-label={`Step ${index + 1} of 4`}>
          {STEPS.map((s, i) => (
            <div key={s} className={cx("h-[2px] rounded-full transition-colors duration-200", i <= index ? "bg-fg" : "bg-track")} />
          ))}
        </div>
      )}

      <h1 className="mt-10 text-[28px] font-semibold tracking-[-0.03em]">{copy.title}</h1>
      <p className="mt-2 text-[15px] text-muted">{copy.body}</p>

      <div key={step} className="fade-in mt-8 flex-1">
        {step === "income" && (
          <>
            <IncomeEditor items={income} onChange={setIncome} />
            <Total label="Total in" cents={incomeTotal} />
            {!edit && (
              <Link href="/settings/import/?from=onboarding" className="mt-8 block text-sm text-muted underline-offset-4 hover:text-fg hover:underline">
                Already have a budget spreadsheet? Import it
              </Link>
            )}
          </>
        )}
        {step === "fixed" && (
          <>
            <FixedCostEditor items={fixed} onChange={setFixed} />
            <Total label="Total fixed" cents={fixedTotal} />
          </>
        )}
        {step === "savings" && (
          <label className="flex items-baseline gap-3 border-b hairline pb-3">
            <AmountInput
              cents={savings}
              onCents={setSavings}
              locale={fmt.locale}
              aria-label="Monthly savings goal"
              className="w-full text-4xl font-semibold tracking-tight"
            />
            <span className="shrink-0 text-sm text-muted">per month</span>
          </label>
        )}
        {step === "plan" && (
          <>
            {incomeTotal > 0 ? (
              <div className="space-y-2 text-[15px]">
                <Equation label="Income" cents={incomeTotal} />
                <Equation label="Fixed costs" cents={-fixedTotal} />
                <Equation label="Savings" cents={-savings} />
                <div className="flex items-baseline justify-between border-t hairline pt-3">
                  <span className="font-medium">Available to spend</span>
                  <Money cents={available} className="text-xl font-semibold" />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">Add your income in step 1 to get a suggested split. You can still set amounts here.</p>
            )}
            {available > 0 && (
              <button
                type="button"
                onClick={() => setPlan(Object.fromEntries(suggestSplit(available, categories)))}
                className="mt-6 text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
              >
                Use suggested split
              </button>
            )}
            <div className="mt-4">
              <PlanEditor categories={categories} amounts={plan} onChange={setPlan} cap={cap} />
            </div>
          </>
        )}
      </div>

      <div className="sticky bottom-0 mt-10 flex gap-3 bg-bg pb-[env(safe-area-inset-bottom)] pt-3">
        {!edit && (
          <Button variant="ghost" onClick={() => void advance(false)}>
            Skip
          </Button>
        )}
        <Button className="flex-1" onClick={() => void advance(true)}>
          {edit ? "Save" : step === "plan" ? "Finish" : "Continue"}
        </Button>
      </div>
    </main>
  );
}

function Total({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="mt-4 flex items-baseline justify-between text-[15px]">
      <Label>{label}</Label>
      <Money cents={cents} className="font-medium" />
    </div>
  );
}

function Equation({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-baseline justify-between text-muted">
      <span>{label}</span>
      <Money cents={cents} />
    </div>
  );
}
