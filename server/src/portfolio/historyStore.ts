import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  PORTFOLIO_HISTORY_SOURCE,
  type DateWindow,
  type PortfolioHistoryPoint,
  type PortfolioHistorySource,
} from "./types";
import { addDays } from "./range";

const DATA_ROOT = path.join(process.cwd(), "data", "portfolio");

function accountFilePath(accountId: string): string {
  const safe = accountId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_ROOT, "history_points", `${safe}.json`);
}

type AccountHistoryFile = {
  source: PortfolioHistorySource;
  accountId: string;
  points: PortfolioHistoryPoint[];
  unavailableWindows: DateWindow[];
  lastUpdatedAt: string | null;
};

async function readAccountFile(
  accountId: string,
): Promise<AccountHistoryFile> {
  const filePath = accountFilePath(accountId);
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as AccountHistoryFile;
    if (parsed.accountId !== accountId) {
      return emptyAccountFile(accountId);
    }
    return {
      source: parsed.source ?? PORTFOLIO_HISTORY_SOURCE,
      accountId,
      points: Array.isArray(parsed.points) ? parsed.points : [],
      unavailableWindows: Array.isArray(parsed.unavailableWindows)
        ? parsed.unavailableWindows
        : [],
      lastUpdatedAt: parsed.lastUpdatedAt ?? null,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return emptyAccountFile(accountId);
    }
    throw err;
  }
}

function emptyAccountFile(accountId: string): AccountHistoryFile {
  return {
    source: PORTFOLIO_HISTORY_SOURCE,
    accountId,
    points: [],
    unavailableWindows: [],
    lastUpdatedAt: null,
  };
}

async function writeAccountFile(file: AccountHistoryFile): Promise<void> {
  const filePath = accountFilePath(file.accountId);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
}

export async function queryHistoryPoints(
  accountId: string,
  start: string,
  end: string,
): Promise<PortfolioHistoryPoint[]> {
  const file = await readAccountFile(accountId);
  return file.points
    .filter((p) => p.date >= start && p.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function upsertHistoryPoints(
  accountId: string,
  incoming: Array<{
    date: string;
    equity: number;
    profitLoss: number;
    profitLossPct: number;
  }>,
): Promise<PortfolioHistoryPoint[]> {
  if (incoming.length === 0) return [];

  const file = await readAccountFile(accountId);
  const now = new Date().toISOString();
  const byDate = new Map(file.points.map((p) => [p.date, p]));

  for (const row of incoming) {
    const existing = byDate.get(row.date);
    if (existing) {
      byDate.set(row.date, {
        ...existing,
        equity: row.equity,
        profitLoss: row.profitLoss,
        profitLossPct: row.profitLossPct,
        updatedAt: now,
      });
    } else {
      byDate.set(row.date, {
        id: randomUUID(),
        source: PORTFOLIO_HISTORY_SOURCE,
        accountId,
        date: row.date,
        equity: row.equity,
        profitLoss: row.profitLoss,
        profitLossPct: row.profitLossPct,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  file.points = [...byDate.values()].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  file.lastUpdatedAt = now;
  await writeAccountFile(file);
  return incoming.map((row) => byDate.get(row.date)!);
}

export async function getLastUpdatedAt(
  accountId: string,
): Promise<string | null> {
  const file = await readAccountFile(accountId);
  return file.lastUpdatedAt;
}

function normalizeWindows(windows: DateWindow[]): DateWindow[] {
  const valid = windows
    .filter((w) => w.start && w.end && w.start <= w.end)
    .sort((a, b) => a.start.localeCompare(b.start));
  const merged: DateWindow[] = [];

  for (const window of valid) {
    const prev = merged[merged.length - 1];
    if (!prev || window.start > addDays(prev.end, 1)) {
      merged.push({ ...window });
      continue;
    }
    if (window.end > prev.end) prev.end = window.end;
  }

  return merged;
}

export async function getUnavailableWindows(
  accountId: string,
): Promise<DateWindow[]> {
  const file = await readAccountFile(accountId);
  return normalizeWindows(file.unavailableWindows);
}

export async function markHistoryWindowsUnavailable(
  accountId: string,
  windows: DateWindow[],
): Promise<void> {
  if (windows.length === 0) return;
  const file = await readAccountFile(accountId);
  file.unavailableWindows = normalizeWindows([
    ...file.unavailableWindows,
    ...windows,
  ]);
  file.lastUpdatedAt = new Date().toISOString();
  await writeAccountFile(file);
}
