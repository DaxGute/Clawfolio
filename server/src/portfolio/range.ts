import type { DateWindow, PortfolioRange } from "./types";

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() - months);
  return out;
}

function addYears(d: Date, years: number): Date {
  const out = new Date(d);
  out.setFullYear(out.getFullYear() - years);
  return out;
}

export function parsePortfolioRange(
  raw: string | undefined,
): PortfolioRange | null {
  if (!raw) return null;
  const normalized = raw.trim();
  const match = ["YTD", "3m", "6m", "1y", "2y", "3y"].find(
    (r) => r.toLowerCase() === normalized.toLowerCase(),
  );
  return (match as PortfolioRange | undefined) ?? null;
}

export function resolveRequestedWindow(
  range: PortfolioRange,
  asOf: Date = new Date(),
): DateWindow {
  const end = toDateKey(asOf);
  let startDate: Date;

  switch (range) {
    case "YTD":
      startDate = new Date(Date.UTC(asOf.getUTCFullYear(), 0, 1));
      break;
    case "3m":
      startDate = addMonths(asOf, 3);
      break;
    case "6m":
      startDate = addMonths(asOf, 6);
      break;
    case "1y":
      startDate = addYears(asOf, 1);
      break;
    case "2y":
      startDate = addYears(asOf, 2);
      break;
    case "3y":
      startDate = addYears(asOf, 3);
      break;
    default:
      startDate = addMonths(asOf, 3);
  }

  return { start: toDateKey(startDate), end };
}

export function weekdayCountInWindow(start: string, end: string): number {
  const from = new Date(`${start}T12:00:00.000Z`);
  const to = new Date(`${end}T12:00:00.000Z`);
  if (from > to) return 0;

  let count = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return Math.max(1, count);
}

export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return toDateKey(d);
}

export function daysBetween(start: string, end: string): number {
  const from = new Date(`${start}T12:00:00.000Z`).getTime();
  const to = new Date(`${end}T12:00:00.000Z`).getTime();
  return Math.round((to - from) / (24 * 60 * 60 * 1000));
}
