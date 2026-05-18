import type {
  BenchmarkTab,
  PortfolioBackfillStatus,
  PortfolioRange,
  PortfolioSnapshotResponse,
} from "../types/portfolio";
import { BENCHMARK_QUERY } from "../types/portfolio";

const withCredentials: RequestInit = { credentials: "include" };
const SNAPSHOT_CACHE_TTL_MS = 5 * 60 * 1000;

type SnapshotCacheEntry = {
  savedAt: number;
  snapshot: PortfolioSnapshotResponse;
};

function snapshotCacheKey(range: PortfolioRange, benchmark: BenchmarkTab): string {
  return `clawfolio:portfolio-snapshot:${range}:${benchmark}`;
}

function readCachedSnapshot(
  range: PortfolioRange,
  benchmark: BenchmarkTab,
): PortfolioSnapshotResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(snapshotCacheKey(range, benchmark));
    if (!raw) return null;
    const entry = JSON.parse(raw) as SnapshotCacheEntry;
    if (
      !entry.snapshot ||
      !entry.savedAt ||
      Date.now() - entry.savedAt > SNAPSHOT_CACHE_TTL_MS
    ) {
      return null;
    }
    return entry.snapshot;
  } catch {
    return null;
  }
}

function writeCachedSnapshot(
  range: PortfolioRange,
  benchmark: BenchmarkTab,
  snapshot: PortfolioSnapshotResponse,
): void {
  if (typeof window === "undefined" || snapshot.error) return;
  try {
    window.sessionStorage.setItem(
      snapshotCacheKey(range, benchmark),
      JSON.stringify({ savedAt: Date.now(), snapshot } satisfies SnapshotCacheEntry),
    );
  } catch {
    /* ignore storage quota/privacy errors */
  }
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

export function isAlpacaCredentialsError(body: unknown): boolean {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    (body as { error?: { code?: string } }).error?.code ===
      "ALPACA_CREDENTIALS_MISSING"
  );
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: { message?: string } }).error?.message === "string"
  ) {
    return (body as { error: { message: string } }).error.message;
  }
  if (
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof (body as { message: string }).message === "string"
  ) {
    return (body as { message: string }).message;
  }
  return fallback;
}

export async function fetchPortfolioSnapshot(
  range: PortfolioRange,
  benchmark: BenchmarkTab = "DOW",
  options: { preferCache?: boolean } = {},
): Promise<PortfolioSnapshotResponse> {
  if (options.preferCache) {
    const cached = readCachedSnapshot(range, benchmark);
    if (cached && cached.dataFreshness?.status === "complete") return cached;
  }

  const q = new URLSearchParams({
    range,
    benchmark: BENCHMARK_QUERY[benchmark],
  });
  const res = await fetch(`/api/portfolio/snapshot?${q}`, withCredentials);
  const body = await parseBody(res);
  const data = body as Partial<PortfolioSnapshotResponse>;

  if (!res.ok) {
    const errorPayload =
      data.error ??
      (isAlpacaCredentialsError(body)
        ? {
            code: "ALPACA_CREDENTIALS_MISSING" as const,
            message: getErrorMessage(body, "Alpaca credentials missing."),
          }
        : undefined);

    return {
      mode: data.mode === "live" || data.mode === "paper" ? data.mode : "paper",
      connection:
        data.connection ??
        ({
          state: "error",
          message: getErrorMessage(body, "Could not load portfolio snapshot."),
        } as const),
      lastUpdated: data.lastUpdated ?? new Date().toISOString(),
      account: data.account ?? null,
      positions: Array.isArray(data.positions) ? data.positions : [],
      unrealizedPL: Number(data.unrealizedPL ?? 0),
      unrealizedPLPercent: Number(data.unrealizedPLPercent ?? 0),
      dayPL: data.dayPL ?? null,
      dayPLPercent: data.dayPLPercent ?? null,
      openOrdersCount: Number(data.openOrdersCount ?? 0),
      history: data.history ?? {
        range,
        totalReturnPct: 0,
        points: [],
        periodReturns: [],
      },
      benchmark: data.benchmark ?? null,
      benchmarkKey: data.benchmarkKey ?? BENCHMARK_QUERY[benchmark],
      dataFreshness: data.dataFreshness ?? null,
      error: errorPayload,
    };
  }

  const snapshot = body as PortfolioSnapshotResponse;
  writeCachedSnapshot(range, benchmark, snapshot);
  return snapshot;
}

export async function postPortfolioBackfill(
  range: PortfolioRange,
): Promise<PortfolioBackfillStatus> {
  const res = await fetch("/api/portfolio/backfill", {
    ...withCredentials,
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ range }),
  });
  const body = await parseBody(res);
  if (!res.ok) {
    throw new Error(getErrorMessage(body, "Backfill request failed."));
  }
  return body as PortfolioBackfillStatus;
}

export async function fetchPortfolioBackfillStatus(): Promise<PortfolioBackfillStatus> {
  const res = await fetch("/api/portfolio/backfill/status", withCredentials);
  const body = await parseBody(res);
  if (!res.ok) {
    throw new Error(getErrorMessage(body, "Could not load backfill status."));
  }
  return body as PortfolioBackfillStatus;
}
