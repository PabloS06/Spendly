"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { ArrowLeft, FileUp } from "lucide-react";
import { AppGate, PageSkeleton } from "@/components/app-gate";
import { Money } from "@/components/money";
import { Button, ICON, Label, cx } from "@/components/ui";
import { parseCsv } from "@/lib/csv";
import { newId, useLoaded } from "@/lib/data";
import { formatDate } from "@/lib/dates";
import { FIELDS, FIELD_LABELS, detectHeaderRow, guessMapping, parseRow, type Cell, type Mapping } from "@/lib/importer";
import type { Category, Expense } from "@/lib/types";

const NEW = "__new__";
const selectClass = "h-9 w-40 shrink-0 rounded-full border hairline bg-transparent px-3 text-sm outline-none";

export default function ImportPage() {
  return (
    <AppGate onboarding>
      <Suspense fallback={<PageSkeleton />}>
        <Import />
      </Suspense>
    </AppGate>
  );
}

async function readFile(file: File): Promise<Cell[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import("read-excel-file/universal");
    return (await readSheet(await file.arrayBuffer())) as Cell[][];
  }
  return parseCsv(await file.text());
}

function Import() {
  const { data, save, backend } = useLoaded();
  const router = useRouter();
  const fromOnboarding = useSearchParams().get("from") === "onboarding";
  const backHref = fromOnboarding ? "/onboarding/" : "/settings/";

  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Cell[][] | null>(null);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const active = data.categories.filter((c) => !c.archived);
  const byName = useMemo(() => new Map(data.categories.map((c) => [c.name.toLowerCase(), c.id])), [data.categories]);
  const fallback = active.find((c) => c.name === "Other")?.id ?? active[0]?.id ?? "";

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setResult(null);
    try {
      const parsed = await readFile(file);
      if (!parsed.length) throw new Error("empty");
      const header = detectHeaderRow(parsed);
      setFileName(file.name);
      setRows(parsed);
      chooseHeader(parsed, header);
    } catch {
      setError("Couldn't read that file. Use a .xlsx or .csv file.");
    }
  }

  function chooseHeader(all: Cell[][], index: number) {
    setHeaderRow(index);
    setMapping(guessMapping(all[index] ?? []));
    setCategoryMap({});
  }

  const header = rows?.[headerRow] ?? [];
  const body = useMemo(() => (rows ? rows.slice(headerRow + 1) : []), [rows, headerRow]);
  const parsed = useMemo(() => (mapping ? body.map((r) => parseRow(r, mapping)) : []), [body, mapping]);
  const valid = parsed.filter((p) => p !== null);
  const sourceCategories = useMemo(() => [...new Set(valid.map((p) => p.category).filter(Boolean))].sort(), [valid]);
  const targetFor = (name: string) => categoryMap[name] ?? byName.get(name.toLowerCase()) ?? (mapping?.category === null ? fallback : NEW);

  async function runImport() {
    if (!mapping) return;
    setBusy(true);
    const created = new Map<string, Category>();
    let order = Math.max(0, ...data.categories.map((c) => c.sort_order));
    const resolve = (name: string): string => {
      const target = name ? targetFor(name) : (categoryMap[""] ?? fallback);
      if (target !== NEW) return target;
      if (!created.has(name)) created.set(name, { id: newId(), user_id: backend.userId, name, sort_order: ++order, archived: false });
      return created.get(name)!.id;
    };
    const now = new Date().toISOString();
    const expenses: Expense[] = valid.map((p) => ({
      id: newId(),
      user_id: backend.userId,
      amount: p.amount,
      category_id: resolve(p.category),
      description: p.description,
      spent_on: p.date,
      payment_method: p.payment_method || "Card",
      notes: p.notes,
      created_at: now,
    }));
    await save("categories", [...created.values()]);
    for (let i = 0; i < expenses.length; i += 500) await save("expenses", expenses.slice(i, i + 500));
    setResult({ imported: expenses.length, skipped: body.length - expenses.length });
    setBusy(false);
  }

  const columnOptions = header.map((h, i) => ({ i, label: String(h ?? "").trim() || `Column ${i + 1}` }));
  const missing = mapping ? (["date", "amount"] as const).filter((f) => mapping[f] === null) : [];

  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] md:max-w-xl">
      <div className="flex h-11 items-center">
        <Link href={backHref} className="press -ml-2 p-2 text-muted hover:text-fg" aria-label="Back">
          <ArrowLeft {...ICON} />
        </Link>
      </div>
      <h1 className="mt-6 text-[28px] font-semibold tracking-[-0.03em]">Import expenses</h1>
      <p className="mt-2 text-[15px] text-muted">From a .xlsx or .csv spreadsheet. You&apos;ll check everything before anything is added.</p>

      {result ? (
        <div className="fade-in mt-12">
          <p className="num text-[40px] font-semibold tracking-[-0.04em]">Imported {result.imported}</p>
          <p className="mt-2 text-[15px] text-muted">
            {result.skipped ? `Skipped ${result.skipped} ${result.skipped === 1 ? "row" : "rows"} without a valid date or amount.` : "Nothing skipped."}
          </p>
          <Button className="mt-10 w-full" onClick={() => router.push(fromOnboarding ? "/onboarding/" : "/activity/?month=all")}>
            {fromOnboarding ? "Back to setup" : "See expenses"}
          </Button>
        </div>
      ) : (
        <>
          <label className="press mt-8 flex cursor-pointer items-center gap-4 border-y hairline py-5">
            <FileUp {...ICON} className="text-muted" />
            <span className="flex-1 text-[15px]">{fileName || "Choose a file"}</span>
            <span className="text-sm text-muted">{fileName ? "Change" : ".xlsx, .csv"}</span>
            <input type="file" accept=".xlsx,.csv,text/csv" className="sr-only" onChange={(e) => void onFile(e.target.files?.[0])} />
          </label>
          {error && <p className="mt-3 text-sm text-danger">{error}</p>}

          {rows && mapping && (
            <div className="fade-in">
              <section className="mt-10">
                <Label>Columns</Label>
                <div className="mt-2 flex items-center justify-between gap-4 border-b hairline py-3 text-[15px]">
                  <span>Header row</span>
                  <select value={headerRow} onChange={(e) => chooseHeader(rows, Number(e.target.value))} className={selectClass}>
                    {rows.slice(0, 15).map((r, i) => (
                      <option key={i} value={i}>
                        Row {i + 1}: {r.filter((c) => c != null && String(c).trim()).slice(0, 2).join(", ").slice(0, 24)}
                      </option>
                    ))}
                  </select>
                </div>
                {FIELDS.map((f) => (
                  <div key={f} className="flex items-center justify-between gap-4 border-b hairline py-3 text-[15px]">
                    <span>
                      {FIELD_LABELS[f]}
                      {(f === "date" || f === "amount") && <span className="text-faint"> required</span>}
                    </span>
                    <select
                      value={mapping[f] ?? ""}
                      onChange={(e) => setMapping({ ...mapping, [f]: e.target.value === "" ? null : Number(e.target.value) })}
                      className={selectClass}
                    >
                      <option value="">Not in file</option>
                      {columnOptions.map((c) => (
                        <option key={c.i} value={c.i}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </section>

              {missing.length === 0 && (
                <>
                  <section className="mt-10">
                    <div className="flex items-baseline justify-between">
                      <Label>Preview</Label>
                      <span className="text-xs text-muted">
                        {valid.length} of {body.length} rows ready
                      </span>
                    </div>
                    <ul className="mt-2">
                      {parsed.slice(0, 10).map((p, i) => (
                        <li key={i} className={cx("flex items-baseline justify-between gap-4 border-b hairline py-3 text-sm", !p && "text-faint")}>
                          {p ? (
                            <>
                              <span className="min-w-0 truncate">
                                <span className="num text-muted">{formatDate(p.date)}</span> {p.description || "—"}
                                {p.category && <span className="text-muted"> · {p.category}</span>}
                              </span>
                              <Money cents={p.amount} className="shrink-0" />
                            </>
                          ) : (
                            <span>Row {headerRow + i + 2} will be skipped (no valid date or amount)</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>

                  <section className="mt-10">
                    <Label>Categories</Label>
                    {(mapping.category === null || valid.some((p) => !p.category)) && (
                      <CategorySelect
                        label={mapping.category === null ? "All expenses" : "Rows without a category"}
                        value={categoryMap[""] ?? fallback}
                        onChange={(v) => setCategoryMap({ ...categoryMap, [""]: v })}
                        categories={active}
                        allowNew={false}
                      />
                    )}
                    {sourceCategories.map((name) => (
                      <CategorySelect
                        key={name}
                        label={name}
                        value={targetFor(name)}
                        onChange={(v) => setCategoryMap({ ...categoryMap, [name]: v })}
                        categories={active}
                        allowNew
                      />
                    ))}
                  </section>

                  <Button className="mt-10 w-full" disabled={busy || valid.length === 0} onClick={() => void runImport()}>
                    {busy ? "Importing…" : `Import ${valid.length} expenses`}
                  </Button>
                </>
              )}
              {missing.length > 0 && (
                <p className="mt-6 text-sm text-muted">Choose which column holds the {missing.map((f) => FIELD_LABELS[f].toLowerCase()).join(" and ")}.</p>
              )}
            </div>
          )}
        </>
      )}
    </main>
  );
}

function CategorySelect({
  label,
  value,
  onChange,
  categories,
  allowNew,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  categories: Category[];
  allowNew: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b hairline py-3 text-[15px]">
      <span className="min-w-0 truncate">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
        {allowNew && <option value={NEW}>Create &ldquo;{label}&rdquo;</option>}
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </div>
  );
}
