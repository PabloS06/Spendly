"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentPeriod, sum } from "@/lib/budget";
import { useLoaded } from "@/lib/data";
import { addDays, formatDate, parseISODate, periodLabel, periodRange, periodStart, shiftPeriod, todayISO } from "@/lib/dates";
import { dailyAllowance, dailyTotals, weekStart } from "@/lib/insights";
import { useMoney } from "./money";
import { Label, cx } from "./ui";

type View = "week" | "month";

/** Day-by-day spending for a week or a budget month, against the daily share of the plan. */
export function SpendingTracker() {
  const { data, profile, fmt } = useLoaded();
  const money = useMoney();
  const today = todayISO();
  const startDay = profile.month_start_day;
  const [view, setView] = useState<View>("week");
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const range =
    view === "week"
      ? { start: addDays(weekStart(today), offset * 7), end: addDays(weekStart(today), offset * 7 + 6) }
      : periodRange(shiftPeriod(currentPeriod(data, today), offset, startDay), startDay);
  const days = dailyTotals(data, range.start, range.end);
  const allowance = dailyAllowance(data, periodStart(range.start, startDay));
  const spent = sum(days, (d) => d.spent);
  const budget = allowance * days.length;
  const scale = Math.max(1, allowance * 1.25, ...days.map((d) => d.spent));

  const previous =
    view === "week"
      ? dailyTotals(data, addDays(range.start, -7), addDays(range.start, -1))
      : (() => {
          const p = periodRange(shiftPeriod(range.start, -1, startDay), startDay);
          return dailyTotals(data, p.start, p.end);
        })();
  const diff = spent - sum(previous, (d) => d.spent);

  const title =
    view === "week"
      ? offset === 0
        ? "This week"
        : offset === -1
          ? "Last week"
          : `Week of ${formatDate(range.start)}`
      : periodLabel(range.start, startDay, fmt.locale);
  const focus = days.find((d) => d.date === selected);
  const switchView = (v: View) => {
    setView(v);
    setOffset(0);
    setSelected(null);
  };

  return (
    <section aria-label="Spending tracker">
      <div className="flex items-center justify-between gap-4">
        <Label>Spending tracker</Label>
        <div className="flex rounded-full border hairline p-0.5 text-xs" role="tablist" aria-label="Period">
          {(["week", "month"] as const).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => switchView(v)}
              className={cx("press h-7 rounded-full px-3 capitalize", view === v ? "bg-fg text-bg" : "text-muted hover:text-fg")}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-muted">{title}</p>
          <p className="num mt-1 text-[32px] font-semibold leading-none tracking-[-0.03em]">{money(spent)}</p>
          <p className="num mt-2 text-sm text-muted">
            {budget > 0 && (
              <span className={spent > budget ? "text-danger" : undefined}>
                {spent > budget ? `${money(spent - budget, false)} over` : `${money(budget - spent, false)} under`} the plan
              </span>
            )}
            {budget > 0 && diff !== 0 && " · "}
            {diff !== 0 && `${money(Math.abs(diff), false)} ${diff > 0 ? "more" : "less"} than last ${view}`}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <button aria-label={`Previous ${view}`} onClick={() => (setOffset(offset - 1), setSelected(null))} className="press rounded-full p-2 text-muted hover:text-fg">
            <ChevronLeft size={18} strokeWidth={1.5} />
          </button>
          <button
            aria-label={`Next ${view}`}
            disabled={offset >= 0}
            onClick={() => (setOffset(offset + 1), setSelected(null))}
            className="press rounded-full p-2 text-muted hover:text-fg disabled:opacity-30"
          >
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      <div className="relative mt-6 h-40">
        {allowance > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-faint"
            style={{ bottom: `${(allowance / scale) * 100}%` }}
          />
        )}
        <div className={cx("flex h-full items-end", view === "week" ? "gap-3" : "gap-[2px] sm:gap-1")}>
          {days.map((d) => {
            const future = d.date > today;
            return (
              <button
                key={d.date}
                disabled={future}
                aria-label={`${formatDate(d.date)}: ${money(d.spent)}`}
                onClick={() => setSelected(selected === d.date ? null : d.date)}
                className="group flex h-full min-w-0 flex-1 flex-col justify-end"
              >
                <div
                  className={cx(
                    "w-full rounded-[2px] transition-[height,opacity] duration-200 ease-out",
                    future ? "h-[2px] bg-track" : selected === d.date ? "bg-fg" : d.date === today ? "bg-accent" : "bg-fg/25",
                    selected && selected !== d.date && "opacity-40",
                    !future && "group-hover:opacity-80",
                  )}
                  style={future ? undefined : { height: `${Math.max(d.spent ? 3 : 2, (d.spent / scale) * 100)}%` }}
                />
              </button>
            );
          })}
        </div>
      </div>
      <div className={cx("mt-2 flex text-[11px] text-muted", view === "week" ? "gap-3" : "gap-[2px] sm:gap-1")}>
        {days.map((d, i) => {
          const date = parseISODate(d.date);
          const show = view === "week" || i === 0 || date.getDate() % 5 === 0;
          return (
            <span key={d.date} className={cx("num min-w-0 flex-1 text-center", d.date === today && "text-fg")}>
              {show ? (view === "week" ? date.toLocaleDateString(fmt.locale, { weekday: "short" }).slice(0, 3) : date.getDate()) : ""}
            </span>
          );
        })}
      </div>
      <p className="num mt-4 h-5 text-sm text-muted" aria-live="polite">
        {focus ? (
          <>
            {parseISODate(focus.date).toLocaleDateString(fmt.locale, { weekday: "long" })} {formatDate(focus.date)} ·{" "}
            <span className="text-fg">{money(focus.spent)}</span>
          </>
        ) : (
          allowance > 0 ? (
            <>
              <span className="mr-1.5 inline-block w-4 border-t border-dashed border-faint align-middle" />
              Your plan allows {money(allowance, false)} a day
            </>
          ) : (
            "Tap a day to see what you spent."
          )
        )}
      </p>
    </section>
  );
}
