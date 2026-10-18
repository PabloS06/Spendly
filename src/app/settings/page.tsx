"use client";

import Link from "next/link";
import { useState } from "react";
import { ArchiveRestore, Archive, ChevronRight, Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Money } from "@/components/money";
import { useToast } from "@/components/toast";
import { Button, ICON, Label, cx } from "@/components/ui";
import { budgetsFor, currentPeriod, sum, totalFixed, totalIncome } from "@/lib/budget";
import { exportCsv } from "@/lib/csv";
import { newId, useLoaded } from "@/lib/data";
import { periodStart, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { Budget, Month } from "@/lib/types";

const CURRENCIES = ["EUR", "GBP", "USD", "CHF", "SEK", "DKK", "NOK", "PLN", "CZK"];
const LOCALES = ["en-IE", "en-GB", "en-US", "es-ES", "fr-FR", "de-DE", "it-IT", "nl-NL", "pt-PT"];

export default function SettingsPage() {
  return (
    <AppShell>
      <Settings />
    </AppShell>
  );
}

const selectClass = "h-9 rounded-full border hairline bg-transparent px-3 text-sm outline-none";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 break-inside-avoid first:mt-4 lg:mb-12 lg:mt-0">
      <Label>{title}</Label>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Row({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("flex min-h-14 items-center justify-between gap-4 border-b hairline py-2 text-[15px]", className)}>{children}</div>;
}

function LinkRow({ href, label, value }: { href: string; label: string; value?: React.ReactNode }) {
  return (
    <Link href={href} className="press block">
      <Row>
        <span>{label}</span>
        <span className="flex items-center gap-2 text-sm text-muted">
          {value}
          <ChevronRight size={16} strokeWidth={1.5} />
        </span>
      </Row>
    </Link>
  );
}

function Settings() {
  const { data, profile, save, backend, fmt } = useLoaded();
  const toast = useToast();
  const [newCategory, setNewCategory] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const today = todayISO();
  const period = currentPeriod(data, today);
  const planTotal = sum(budgetsFor(data.budgets, period), (b) => b.amount);
  const categories = data.categories.slice().sort((a, b) => Number(a.archived) - Number(b.archived) || a.sort_order - b.sort_order);

  function changeStartDay(day: number) {
    // The current period moves: carry the plan over to it and close the old months quietly.
    const next = periodStart(today, day);
    const now = new Date().toISOString();
    const months: Month[] = data.months.filter((m) => !m.closed_at && m.period !== next).map((m) => ({ ...m, closed_at: now }));
    if (!data.months.some((m) => m.period === next)) {
      months.push({ id: newId(), user_id: backend.userId, period: next, carry_in: 0, leftover_action: null, leftover_amount: 0, closed_at: null });
    }
    const budgets: Budget[] = data.budgets.some((b) => b.period === next)
      ? []
      : budgetsFor(data.budgets, period).map((b) => ({ ...b, id: newId(), period: next }));
    void save("profiles", [{ ...profile, month_start_day: day }]);
    void save("months", months);
    void save("budgets", budgets);
  }

  function addCategory() {
    const name = newCategory.trim();
    if (!name) return;
    const category = { id: newId(), user_id: backend.userId, name, archived: false, sort_order: Math.max(0, ...data.categories.map((c) => c.sort_order)) + 1 };
    void save("categories", [category]);
    void save("budgets", [{ id: newId(), user_id: backend.userId, period, category_id: category.id, amount: 0 }]);
    setNewCategory("");
  }

  async function deleteAccount() {
    if (!confirmDelete) return setConfirmDelete(true);
    try {
      await backend.deleteAccount();
    } catch {
      toast.show({ text: "Couldn't delete your account. Try again.", tone: "error" });
    }
  }

  return (
    <div className="lg:columns-2 lg:gap-x-16 lg:pt-6">
      <Section title="Preferences">
        <Row>
          <span>Currency</span>
          <select value={profile.currency} onChange={(e) => void save("profiles", [{ ...profile, currency: e.target.value }])} className={selectClass}>
            {CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Row>
        <Row>
          <span>Number format</span>
          <select value={profile.locale} onChange={(e) => void save("profiles", [{ ...profile, locale: e.target.value }])} className={selectClass}>
            {[...new Set([profile.locale, ...LOCALES])].map((l) => (
              <option key={l} value={l}>
                {formatMoney(1250, { currency: profile.currency, locale: l })}
              </option>
            ))}
          </select>
        </Row>
        <Row>
          <span>Month starts on</span>
          <select value={profile.month_start_day} onChange={(e) => changeStartDay(Number(e.target.value))} className={selectClass}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Day {d}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section title="Budget">
        <LinkRow href="/onboarding/?edit=income" label="Income" value={<Money cents={totalIncome(data)} />} />
        <LinkRow href="/onboarding/?edit=fixed" label="Fixed costs" value={<Money cents={totalFixed(data)} />} />
        <LinkRow href="/onboarding/?edit=savings" label="Savings goal" value={<Money cents={profile.savings_goal} />} />
        <LinkRow href="/onboarding/?edit=plan" label="Spending plan" value={<Money cents={planTotal} />} />
      </Section>

      <Section title="Categories">
        {categories.map((c) => (
          <Row key={c.id}>
            <input
              defaultValue={c.name}
              aria-label={`Rename ${c.name}`}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (name && name !== c.name) void save("categories", [{ ...c, name }]);
                else e.target.value = c.name;
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
              className={cx("min-w-0 flex-1 bg-transparent outline-none", c.archived && "text-faint")}
            />
            <button
              onClick={() => void save("categories", [{ ...c, archived: !c.archived }])}
              aria-label={c.archived ? `Restore ${c.name}` : `Archive ${c.name}`}
              className="press flex items-center gap-1.5 text-sm text-muted hover:text-fg"
            >
              {c.archived ? <ArchiveRestore {...ICON} size={16} /> : <Archive {...ICON} size={16} />}
              {c.archived ? "Restore" : "Archive"}
            </button>
          </Row>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addCategory();
          }}
        >
          <Row>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="New category"
              aria-label="New category name"
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint"
            />
            <button type="submit" disabled={!newCategory.trim()} className="press flex items-center gap-1.5 text-sm text-muted hover:text-fg disabled:opacity-40">
              <Plus {...ICON} size={16} /> Add
            </button>
          </Row>
        </form>
      </Section>

      <Section title="Data">
        <LinkRow href="/settings/import/" label="Import from spreadsheet" />
        <button className="press block w-full text-left" onClick={() => void exportCsv(data)}>
          <Row>
            <span>Export to CSV</span>
            <span className="text-sm text-muted">{data.expenses.length} expenses</span>
          </Row>
        </button>
      </Section>

      <Section title="Account">
        <Row>
          <span className="text-muted">
            {backend.kind === "demo" ? "Demo mode (this browser only)" : backend.kind === "claude" ? "Saved to your Claude account" : backend.email}
          </span>
          {backend.kind !== "claude" && (
            <button onClick={() => void backend.signOut()} className="press text-sm text-muted hover:text-fg">
              Sign out
            </button>
          )}
        </Row>
        <div className="pt-8">
          <Button variant="danger" className="w-full" onClick={() => void deleteAccount()}>
            {confirmDelete ? "Tap again to delete everything" : backend.kind === "claude" ? "Delete all my data" : "Delete account and all data"}
          </Button>
          {confirmDelete && <p className="mt-3 text-center text-sm text-muted">This can&apos;t be undone.</p>}
        </div>
      </Section>
    </div>
  );
}
