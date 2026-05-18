import { addDays, daysBetween } from "./range";

export function toDateKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function isWeekend(dateKey: string): boolean {
  const day = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function lastTradingDayOnOrBefore(dateKey: string): string {
  let cursor = dateKey;
  while (isWeekend(cursor)) {
    cursor = addDays(cursor, -1);
  }
  return cursor;
}

export function effectiveRequestedEnd(requestedEnd: string, asOf: Date = new Date()): string {
  const today = toDateKey(asOf);
  const lastTrading = lastTradingDayOnOrBefore(today);
  return requestedEnd < lastTrading ? requestedEnd : lastTrading;
}

export function listTradingDays(start: string, end: string): string[] {
  if (start > end) return [];
  const days: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    if (!isWeekend(cursor)) days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function contiguousWindowsFromDays(days: string[]): Array<{ start: string; end: string }> {
  if (days.length === 0) return [];

  const sorted = [...days].sort();
  const windows: Array<{ start: string; end: string }> = [];
  let windowStart = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const day = sorted[i];
    if (daysBetween(prev, day) <= 4) {
      prev = day;
      continue;
    }
    windows.push({ start: windowStart, end: prev });
    windowStart = day;
    prev = day;
  }

  windows.push({ start: windowStart, end: prev });
  return windows;
}

export function isLikelyUnfillableDate(dateKey: string, asOf: Date = new Date()): boolean {
  const today = toDateKey(asOf);
  if (dateKey > today) return true;
  if (dateKey === today) return true;
  if (isWeekend(dateKey)) return true;
  return false;
}
