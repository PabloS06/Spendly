"use client";

import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Money, useMoney } from "@/components/money";
import { Button, Label, Progress, useCountUp } from "@/components/ui";
import { currentPeriod, summarize, upcomingFixedCosts } from "@/lib/budget";
import { useLoaded } from "@/lib/data";
import { formatDate, todayISO } from "@/lib/dates";

export default function HomePage() {
  return (
    <AppShell>
      <Home />
    </AppShell>
  );
}

function Home() {
  const { data } = useLoaded();
  const money = useMoney();
  const today = todayISO();
  const summary = summarize(data, currentPeriod(data, today), today);
  const upcoming = upcomingFixedCosts(data.fixed_costs, today, 7);
  const hero = useCountUp(summary.remaining);
  const total = summary.budgetTotal + summary.carryIn;
  const over = summary.remaining < 0;

  return (
    <div className="pt-6">
      <section aria-label="Left this month">
        <p className={`num text-[60px] font-semibold leading-none tracking-[-0.045em] ${over ? "text-danger" : ""}`}>
          {money(Math.abs(hero), Math.abs(hero) < 100_000)}
        </p>
        <p className="mt-3 text-[15px] text-muted">{over ? "over budget this month" : "left this month"}</p>
        <Progress value={total > 0 ? summary.spent / total : 0} status={over ? "over" : "ok"} className="mt-6" />
        <p className="mt-4 text-[15px]">
          <Money cents={summary.perDay} className="font-medium" />
          <span className="text-muted"> per day for the next {summary.daysLeft} {summary.daysLeft === 1 ? "day" : "days"}</span>
        </p>
      </section>

      {summary.budgetTotal === 0 ? (
        <div className="mt-14 border-t hairline pt-8">
          <p className="text-[15px] font-medium">No spending plan yet</p>
          <p className="mt-1 text-sm text-muted">Set how much goes to each category and Spendly will track it for you.</p>
          <Link href="/onboarding/?edit=plan">
            <Button variant="secondary" className="mt-5">
              Set up your plan
            </Button>
          </Link>
        </div>
      ) : (
        <section className="mt-12" aria-label="Categories">
          <div className="flex items-baseline justify-between">
            <Label>Categories</Label>
            <span className="num text-xs text-muted">
              {money(summary.spent, false)} of {money(total, false)}
            </span>
          </div>
          <ul className="mt-2">
            {summary.lines
              .filter((l) => l.budget > 0 || l.spent > 0)
              .map((l) => (
                <li key={l.category.id}>
                  <Link href={`/activity/?category=${l.category.id}`} className="press block py-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <span className="text-[15px]">{l.category.name}</span>
                      <span className="num text-sm">
                        <span className={l.status === "over" ? "text-danger" : l.status === "warn" ? "text-warn" : ""}>{money(l.spent)}</span>
                        <span className="text-faint"> / {money(l.budget, false)}</span>
                      </span>
                    </div>
                    <Progress value={l.ratio} status={l.status} className="mt-3" />
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}

      {upcoming.length > 0 && (
        <section className="mt-12" aria-label="Upcoming fixed costs">
          <Label>Next 7 days</Label>
          <ul className="mt-2">
            {upcoming.map(({ cost, date }) => (
              <li key={cost.id} className="flex items-baseline justify-between border-b hairline py-3.5 text-[15px]">
                <span>
                  {cost.name}
                  <span className="num ml-2 text-sm text-muted">{date === today ? "Today" : formatDate(date)}</span>
                </span>
                <Money cents={cost.amount} className="text-muted" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
