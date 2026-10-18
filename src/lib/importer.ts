import { toISODate } from "./dates.ts";
import { parseAmount } from "./money.ts";

export type Cell = string | number | boolean | Date | null | undefined;

export const FIELDS = ["date", "description", "category", "amount", "payment_method", "notes"] as const;
export type Field = (typeof FIELDS)[number];
export type Mapping = Record<Field, number | null>;

export const FIELD_LABELS: Record<Field, string> = {
  date: "Date",
  description: "Description",
  category: "Category",
  amount: "Amount",
  payment_method: "Payment method",
  notes: "Notes",
};

// Header names people actually use, in English and Spanish (common for IE students).
const SYNONYMS: Record<Field, string[]> = {
  date: ["date", "day", "fecha", "when", "transaction date", "data", "datum"],
  description: ["description", "desc", "item", "merchant", "name", "payee", "what", "concepto", "descripcion", "descripción", "details"],
  category: ["category", "categories", "type", "categoria", "categoría", "group", "tag"],
  amount: ["amount", "cost", "price", "spent", "value", "total", "importe", "cantidad", "eur", "€", "amount (€)", "amount (eur)"],
  payment_method: ["payment method", "payment", "method", "paid with", "card", "account", "metodo de pago", "método de pago", "pago"],
  notes: ["notes", "note", "comment", "comments", "memo", "notas"],
};

const norm = (v: Cell) => String(v ?? "").trim().toLowerCase();

function fieldFor(header: Cell): Field | null {
  const h = norm(header);
  if (!h) return null;
  for (const f of FIELDS) if (SYNONYMS[f].includes(h)) return f;
  for (const f of FIELDS) if (SYNONYMS[f].some((s) => s.length > 3 && h.includes(s))) return f;
  return null;
}

/** Index of the header row: the first of the top 20 rows naming at least two known columns. */
export function detectHeaderRow(rows: Cell[][]): number {
  let best = { index: 0, score: 0 };
  rows.slice(0, 20).forEach((row, index) => {
    const score = new Set(row.map(fieldFor).filter(Boolean)).size;
    if (score > best.score) best = { index, score };
  });
  if (best.score >= 2) return best.index;
  // Otherwise the first row made mostly of text.
  const textual = rows.findIndex((r) => r.filter((c) => typeof c === "string" && c.trim() && parseAmount(c) === null).length >= 2);
  return Math.max(0, textual);
}

export function guessMapping(header: Cell[]): Mapping {
  const mapping = Object.fromEntries(FIELDS.map((f) => [f, null])) as Mapping;
  header.forEach((h, i) => {
    const f = fieldFor(h);
    if (f && mapping[f] === null) mapping[f] = i;
  });
  return mapping;
}

/** Accepts Date cells, Excel serial numbers, DD/MM/YYYY (or - .), YYYY-MM-DD and DD/MM/YY. */
export function parseDateCell(value: Cell): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : toISODate(new Date(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  if (typeof value === "number") {
    if (value < 20000 || value > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86_400_000);
    return toISODate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const s = String(value ?? "").trim();
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
  if (m) {
    const year = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return valid(year, +m[2], +m[1]);
  }
  return null;
}

function valid(y: number, m: number, d: number): string | null {
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? toISODate(date) : null;
}

export interface ParsedRow {
  date: string;
  description: string;
  category: string;
  amount: number;
  payment_method: string;
  notes: string;
}

/** Turns a data row into an expense draft; null when it has no usable date or amount. */
export function parseRow(row: Cell[], mapping: Mapping): ParsedRow | null {
  const get = (f: Field) => (mapping[f] === null ? undefined : row[mapping[f]!]);
  const date = parseDateCell(get("date"));
  const raw = get("amount");
  const amount = typeof raw === "number" ? Math.round(Math.abs(raw) * 100) : parseAmount(raw instanceof Date ? null : (raw as string | null));
  if (!date || !amount) return null;
  const text = (f: Field) => {
    const v = get(f);
    return v instanceof Date ? "" : String(v ?? "").trim();
  };
  return { date, amount, description: text("description"), category: text("category"), payment_method: text("payment_method"), notes: text("notes") };
}
