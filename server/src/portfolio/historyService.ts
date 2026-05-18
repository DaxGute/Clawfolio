import type { AlpacaPortfolioHistory } from "../../alpaca/alpacaTypes";
import type { AlpacaTradingClient } from "../../alpaca/alpacaClient";
import { analyzeCoverage, finalizeCoverageStatus } from "./coverage";
import { addDays } from "./range";
import {
  getUnavailableWindows,
  getLastUpdatedAt,
  markHistoryWindowsUnavailable,
  queryHistoryPoints,
  upsertHistoryPoints,
} from "./historyStore";
import { contiguousWindowsFromDays, listTradingDays } from "./tradingDays";
import type {
  DataFreshness,
  DataFreshnessStatus,
  DateWindow,
  PortfolioHistoryPoint,
  PortfolioRange,
} from "./types";
import { resolveRequestedWindow } from "./range";

const MAX_SYNC_FETCH_DAYS = 45;
const CHUNK_DAYS = 90;

function timestampToDateKey(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

export function alpacaHistoryToRows(
  history: AlpacaPortfolioHistory,
): Array<{
  date: string;
  equity: number;
  profitLoss: number;
  profitLossPct: number;
}> {
  const timestamps = history.timestamp ?? [];
  const equity = history.equity ?? [];
  const profitLoss = history.profit_loss ?? [];
  const profitLossPct = history.profit_loss_pct ?? [];

  const rows: Array<{
    date: string;
    equity: number;
    profitLoss: number;
    profitLossPct: number;
  }> = [];

  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = timestamps[i];
    if (typeof ts !== "number" || !Number.isFinite(ts)) continue;
    rows.push({
      date: timestampToDateKey(ts),
      equity: Number(equity[i] ?? 0),
      profitLoss: Number(profitLoss[i] ?? 0),
      profitLossPct: Number(profitLossPct[i] ?? 0),
    });
  }

  return rows;
}

export async function fetchAlpacaHistoryWindow(
  trading: AlpacaTradingClient,
  window: DateWindow,
): Promise<Array<{
  date: string;
  equity: number;
  profitLoss: number;
  profitLossPct: number;
}>> {
  const history = await trading.getJson<AlpacaPortfolioHistory>(
    "/v2/account/portfolio/history",
    {
      timeframe: "1D",
      start: window.start,
      end: window.end,
    },
  );
  return alpacaHistoryToRows(history);
}

export function chunkWindows(windows: DateWindow[]): DateWindow[] {
  const chunks: DateWindow[] = [];

  for (const window of windows) {
    let cursor = window.start;
    while (cursor <= window.end) {
      const tentativeEnd = addDays(cursor, CHUNK_DAYS - 1);
      const end = tentativeEnd < window.end ? tentativeEnd : window.end;
      chunks.push({ start: cursor, end });
      cursor = addDays(end, 1);
    }
  }

  return chunks;
}

export function totalWindowDays(windows: DateWindow[]): number {
  return windows.reduce((sum, w) => {
    const from = new Date(`${w.start}T12:00:00.000Z`).getTime();
    const to = new Date(`${w.end}T12:00:00.000Z`).getTime();
    return sum + Math.max(0, Math.round((to - from) / 86_400_000) + 1);
  }, 0);
}

export function buildDataFreshness(
  requested: DateWindow,
  points: PortfolioHistoryPoint[],
  fetchableWindows: DateWindow[],
  unfillableWindows: DateWindow[],
  status: DataFreshnessStatus,
  coveragePct: number,
  lastUpdatedAt: string | null,
): DataFreshness {
  return {
    status,
    requestedStart: requested.start,
    requestedEnd: requested.end,
    storedStart: points[0]?.date ?? null,
    storedEnd: points[points.length - 1]?.date ?? null,
    missingWindows: fetchableWindows,
    unfillableWindows,
    coveragePct,
    lastUpdatedAt,
  };
}

export async function loadStoredHistory(
  accountId: string,
  range: PortfolioRange,
): Promise<{
  requested: DateWindow;
  points: PortfolioHistoryPoint[];
  coverage: ReturnType<typeof analyzeCoverage>;
  lastUpdatedAt: string | null;
}> {
  const requested = resolveRequestedWindow(range);
  const points = await queryHistoryPoints(
    accountId,
    requested.start,
    requested.end,
  );
  const unavailableWindows = await getUnavailableWindows(accountId);
  const coverage = analyzeCoverage(requested, points, new Date(), unavailableWindows);
  const lastUpdatedAt = await getLastUpdatedAt(accountId);
  return { requested, points, coverage, lastUpdatedAt };
}

function missingReturnedDays(
  window: DateWindow,
  rows: Array<{ date: string }>,
): DateWindow[] {
  const returned = new Set(rows.map((row) => row.date));
  const missing = listTradingDays(window.start, window.end).filter(
    (date) => !returned.has(date),
  );
  return contiguousWindowsFromDays(missing);
}

export async function fetchAndPersistWindows(
  trading: AlpacaTradingClient,
  accountId: string,
  windows: DateWindow[],
): Promise<PortfolioHistoryPoint[]> {
  const upserted: PortfolioHistoryPoint[] = [];

  for (const window of windows) {
    const rows = await fetchAlpacaHistoryWindow(trading, window);
    await markHistoryWindowsUnavailable(
      accountId,
      missingReturnedDays(window, rows),
    );
    if (rows.length > 0) {
      const saved = await upsertHistoryPoints(accountId, rows);
      upserted.push(...saved);
    }
  }

  return upserted;
}

export function shouldSyncFetchOnSnapshot(fetchableWindows: DateWindow[]): boolean {
  return totalWindowDays(fetchableWindows) <= MAX_SYNC_FETCH_DAYS;
}

export { analyzeCoverage, finalizeCoverageStatus };
