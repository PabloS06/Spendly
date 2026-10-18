"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppGate } from "@/components/app-gate";
import { Money, useMoney } from "@/components/money";
import { Button, Label, cx } from "@/components/ui";
import { currentPeriod, summarize } from "@/lib/budget";
import { newId, useLoaded } from "@/lib/data";
import { periodLabel, todayISO } from "@/lib/dates";
import type { Month } from "@/lib/types";

export default function RolloverPage() {
  return (
    <AppGate>
      <Rollover />
    </AppGate>
  );
}

function Rollover() {
  const { data, profile, pendingRollover, save, backend, fmt } = useLoaded();
  const router = useRouter();
  const money = useMoney();
  const today = todayISO();

  useEffect(() => {
    if (!pendingRollover) router.replace("/");
  }, [pendingRollover, router]);
  if (!pendingRollover) return null;

  const summary = summarize(data, pendingRollover, today);
  const leftover = Math.max(0, summary.remaining);
  const current = currentPeriod(data, today);
  const previous = data.months.find((m) => m.period === pendingRollover)!;

  async function close(action: Month["leftover_action"]) {
    const now = new Date().toISOString();
    // Older months that were never summarised are closed quietly along with this one.
    const stale = data.months
      .filter((m) => m.period < pendingRollover! && !m.closed_at)
      .map((m) => ({ ...m, closed_at: now }));
    await save("months", [...stale, { ...previous, leftover_action: action, leftover_amount: leftover, closed_at: now }]);
    if (action === "next_month" && leftover > 0) {
      const next = data.months.find((m) => m.period === current) ?? {
        id: newId(),
        user_id: backend.userId,
        period: current,
        carry_in: 0,
        leftover_action: null,
        leftover_amount: 0,
        closed_at: null,
      };
      await save("months", [{ ...next, carry_in: next.carry_in + leftover }]);
    }
    router.replace("/");
  }

  const saved = profile.savings_goal;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-10 pt-16">
      <Label>{periodLabel(pendingRollover, profile.month_start_day, fmt.locale)} is done</Label>
      <p className={cx("num mt-4 text-[56px] font-semibold leading-none tracking-[-0.045em]", summary.remaining < 0 && "text-danger")}>
        {money(Math.abs(summary.remaining))}
      </p>
      <p className="mt-3 text-[15px] text-muted">{summary.remaining >= 0 ? "under budget" : "over budget"}</p>

      <ul className="mt-10">
        {summary.lines
          .filter((l) => l.budget > 0 || l.spent > 0)
          .map((l) => (
            <li key={l.category.id} className="flex items-baseline justify-between border-b hairline py-3.5 text-[15px]">
              <span>{l.category.name}</span>
              <span className={cx("num text-sm", l.left < 0 ? "text-danger" : "text-muted")}>
                {l.left >= 0 ? `${money(l.left)} under` : `${money(-l.left)} over`}
              </span>
            </li>
          ))}
      </ul>

      <div className="mt-6 flex items-baseline justify-between text-[15px]">
        <span>Total saved</span>
        <Money cents={saved} className="font-medium" />
      </div>
      {leftover > 0 && (
        <p className="mt-1 text-right text-sm text-muted">
          <Money cents={saved + leftover} /> if you carry the leftover to savings
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3 pt-12">
        {leftover > 0 ? (
          <>
            <p className="mb-2 text-sm text-muted">
              You have <Money cents={leftover} className="text-fg" /> left over. Where should it go?
            </p>
            <Button onClick={() => void close("savings")}>Carry leftover to savings</Button>
            <Button variant="secondary" onClick={() => void close("next_month")}>
              Add leftover to next month
            </Button>
          </>
        ) : (
          <Button onClick={() => void close(null)}>Start the new month</Button>
        )}
      </div>
    </main>
  );
}
