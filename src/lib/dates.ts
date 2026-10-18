// Dates are handled as local calendar dates in "YYYY-MM-DD" form.

const pad = (n: number) => String(n).padStart(2, "0");

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayISO(): string {
  return toISODate(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function daysBetween(fromISO: string, toISO: string): number {
  const ms = parseISODate(toISO).getTime() - parseISODate(fromISO).getTime();
  return Math.round(ms / 86_400_000);
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** The date in a given month for a "day of month" setting, clamped to short months (31 → 30 Apr). */
export function dayInMonth(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, Math.min(day, daysInMonth(year, monthIndex)));
}

/** First day of the budget period containing `iso`, for a month that starts on `startDay`. */
export function periodStart(iso: string, startDay: number): string {
  const d = parseISODate(iso);
  const thisStart = dayInMonth(d.getFullYear(), d.getMonth(), startDay);
  if (d >= thisStart) return toISODate(thisStart);
  return toISODate(dayInMonth(d.getFullYear(), d.getMonth() - 1, startDay));
}

/** Start of the period `n` periods after (or before, if negative) the period starting at `startISO`. */
export function shiftPeriod(startISO: string, n: number, startDay: number): string {
  const d = parseISODate(startISO);
  return toISODate(dayInMonth(d.getFullYear(), d.getMonth() + n, startDay));
}

/** Inclusive start and end dates of the period starting at `startISO`. */
export function periodRange(startISO: string, startDay: number): { start: string; end: string } {
  return { start: startISO, end: addDays(shiftPeriod(startISO, 1, startDay), -1) };
}

export function inRange(iso: string, range: { start: string; end: string }): boolean {
  return iso >= range.start && iso <= range.end;
}

/** DD/MM/YYYY */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function periodLabel(startISO: string, startDay: number, locale: string, short = false): string {
  const start = parseISODate(startISO);
  if (startDay === 1) {
    return start.toLocaleDateString(locale, { month: short ? "short" : "long", year: short ? undefined : "numeric" });
  }
  const end = parseISODate(periodRange(startISO, startDay).end);
  const fmt = (d: Date) => d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  return short ? start.toLocaleDateString(locale, { month: "short" }) : `${fmt(start)} – ${fmt(end)}`;
}

export function dayHeading(iso: string, locale: string): string {
  const today = todayISO();
  if (iso === today) return "Today";
  if (iso === addDays(today, -1)) return "Yesterday";
  const d = parseISODate(iso);
  const weekday = d.toLocaleDateString(locale, { weekday: "long" });
  return `${weekday}, ${formatDate(iso)}`;
}
