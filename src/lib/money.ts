// Money is integer cents everywhere; these helpers convert at the edges.

const formatters = new Map<string, Intl.NumberFormat>();

function formatter(currency: string, locale: string, decimals: boolean): Intl.NumberFormat {
  const key = `${currency}|${locale}|${decimals}`;
  let f = formatters.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    });
    formatters.set(key, f);
  }
  return f;
}

export interface MoneyFormat {
  currency: string;
  locale: string;
}

export function formatMoney(cents: number, fmt: MoneyFormat, opts: { decimals?: boolean } = {}): string {
  const decimals = opts.decimals ?? true;
  return formatter(fmt.currency, fmt.locale, decimals).format((decimals ? cents : Math.round(cents / 100) * 100) / 100);
}

/** The amount as typed in an input, without currency symbol: "12,50" or "12.50" depending on locale. */
export function centsToInput(cents: number, locale: string): string {
  if (!cents) return "";
  const s = (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
  return decimalSeparator(locale) === "," ? s.replace(".", ",") : s;
}

export function decimalSeparator(locale: string): "," | "." {
  return (1.5).toLocaleString(locale).includes(",") ? "," : ".";
}

/**
 * Parses user or spreadsheet input into cents. Accepts "12", "12.5", "12,50",
 * "€1.234,56", "1,234.56", "-3.30" (sign dropped). Returns null when it isn't a number.
 */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input == null) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(Math.abs(input) * 100) : null;
  let s = input.replace(/[^\d.,-]/g, "").replace(/-/g, "");
  if (!s || !/\d/.test(s)) return null;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma > -1 && lastDot > -1) {
    // Whichever separator comes last is the decimal one.
    const dec = lastComma > lastDot ? "," : ".";
    const thousands = dec === "," ? "." : ",";
    s = s.split(thousands).join("").replace(dec, ".");
  } else if (lastComma > -1) {
    // "1,234" (thousands) vs "12,5" / "12,50" (decimal)
    const decimals = s.length - lastComma - 1;
    s = decimals === 3 && s.indexOf(",") === lastComma && s.length > 4 ? s.replace(",", "") : s.split(",").join(".");
  }
  const parts = s.split(".");
  if (parts.length > 2) s = parts.slice(0, -1).join("") + "." + parts[parts.length - 1];
  const value = Number(s);
  return Number.isFinite(value) ? Math.round(value * 100) : null;
}

/** Parses what someone typed in an amount field, where "," and "." both mean the decimal point. */
export function parseTyped(input: string): number {
  const [whole, ...rest] = input.replace(/,/g, ".").split(".");
  const value = Number(`${whole || "0"}.${rest.join("").slice(0, 2) || "0"}`);
  return Number.isFinite(value) ? Math.round(value * 100) : 0;
}
