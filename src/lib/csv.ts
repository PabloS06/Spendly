import { formatDate } from "./dates.ts";
import type { Snapshot } from "./types.ts";

/** RFC 4180-ish parser: quoted fields, escaped quotes, CRLF; detects ; or , or tab as separator. */
export function parseCsv(text: string): string[][] {
  const clean = text.replace(/^﻿/, "");
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
  const sep = [";", "\t", ","].map((s) => ({ s, n: firstLine.split(s).length })).sort((a, b) => b.n - a.n)[0].s;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function escape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(s: Snapshot): string {
  const names = new Map(s.categories.map((c) => [c.id, c.name]));
  const header = ["Date", "Description", "Category", "Amount", "Payment method", "Notes"];
  const lines = [...s.expenses]
    .sort((a, b) => a.spent_on.localeCompare(b.spent_on))
    .map((e) => [formatDate(e.spent_on), e.description, names.get(e.category_id) ?? "", (e.amount / 100).toFixed(2), e.payment_method, e.notes]);
  return [header, ...lines].map((r) => r.map(escape).join(",")).join("\r\n");
}

export async function exportCsv(s: Snapshot) {
  const filename = `spendly-expenses-${new Date().toISOString().slice(0, 10)}.csv`;
  const data = "\uFEFF" + toCsv(s);
  // Inside the Claude viewer, plain downloads are blocked; its downloads capability asks the viewer instead.
  const claude = (window as { claude?: { use(name: string): Promise<{ save(r: { filename: string; data: string }): Promise<unknown> } | null> } }).claude;
  const downloads = claude?.use ? await claude.use("downloads").catch(() => null) : null;
  if (downloads) {
    await downloads.save({ filename, data }).catch(() => undefined);
    return;
  }
  const url = URL.createObjectURL(new Blob([data], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
