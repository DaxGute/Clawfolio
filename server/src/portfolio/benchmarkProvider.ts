import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { addDays } from "./range";

export type BenchmarkKey = "DOW" | "SP500" | "NASDAQ";

export type BenchmarkTimeframe = "1D";

export type BenchmarkHistoryPoint = {
  date: string;
  indexValue: number;
  cumulativeReturnPct: number;
};

export type BenchmarkHistoryResult = {
  label: string;
  symbol: string;
  provider: string;
  isProxy: boolean;
  totalReturnPct: number;
  points: BenchmarkHistoryPoint[];
};

type BenchmarkSpec = {
  label: string;
  indexSymbol: string;
  proxySymbol: string;
};

const BENCHMARKS: Record<BenchmarkKey, BenchmarkSpec> = {
  DOW: {
    label: "Dow Jones Industrial Average",
    indexSymbol: "^DJI",
    proxySymbol: "DIA",
  },
  SP500: {
    label: "S&P 500 Index",
    indexSymbol: "^GSPC",
    proxySymbol: "SPY",
  },
  NASDAQ: {
    label: "Nasdaq Composite",
    indexSymbol: "^IXIC",
    proxySymbol: "QQQ",
  },
};

type YahooChartResponse = {
  chart?: {
    result?: Array<{
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          close?: Array<number | null>;
        }>;
      };
    }>;
  };
};

type BenchmarkCacheFile = BenchmarkHistoryResult & {
  cacheKey: string;
  cachedAt: string;
  start: string;
  end: string;
};

const BENCHMARK_CACHE_ROOT = path.join(
  process.cwd(),
  "data",
  "portfolio",
  "benchmark_history",
);
const BENCHMARK_CACHE_TTL_MS = 60 * 60 * 1000;

function benchmarkCacheKey(
  benchmark: BenchmarkKey,
  start: string,
  end: string,
): string {
  return [benchmark, start, end].join("_").replace(/[^a-zA-Z0-9_-]/g, "_");
}

function benchmarkCachePath(cacheKey: string): string {
  return path.join(BENCHMARK_CACHE_ROOT, `${cacheKey}.json`);
}

async function readBenchmarkCache(
  benchmark: BenchmarkKey,
  start: string,
  end: string,
): Promise<BenchmarkHistoryResult | null> {
  const cacheKey = benchmarkCacheKey(benchmark, start, end);
  try {
    const raw = await readFile(benchmarkCachePath(cacheKey), "utf8");
    const cached = JSON.parse(raw) as BenchmarkCacheFile;
    if (
      cached.cacheKey !== cacheKey ||
      Date.now() - new Date(cached.cachedAt).getTime() > BENCHMARK_CACHE_TTL_MS
    ) {
      return null;
    }
    return {
      label: cached.label,
      symbol: cached.symbol,
      provider: cached.provider,
      isProxy: cached.isProxy,
      totalReturnPct: cached.totalReturnPct,
      points: Array.isArray(cached.points) ? cached.points : [],
    };
  } catch {
    return null;
  }
}

async function writeBenchmarkCache(
  benchmark: BenchmarkKey,
  start: string,
  end: string,
  result: BenchmarkHistoryResult,
): Promise<void> {
  const cacheKey = benchmarkCacheKey(benchmark, start, end);
  await mkdir(BENCHMARK_CACHE_ROOT, { recursive: true });
  await writeFile(
    benchmarkCachePath(cacheKey),
    `${JSON.stringify(
      {
        ...result,
        cacheKey,
        cachedAt: new Date().toISOString(),
        start,
        end,
      } satisfies BenchmarkCacheFile,
      null,
      2,
    )}\n`,
    "utf8",
  );
}

function dateToUnix(dateKey: string): number {
  return Math.floor(new Date(`${dateKey}T00:00:00.000Z`).getTime() / 1000);
}

function unixToDateKey(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function pctChange(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return 0;
  return ((to / from) - 1) * 100;
}

async function fetchYahooDailyBars(
  symbol: string,
  start: string,
  end: string,
): Promise<Array<{ date: string; close: number }>> {
  const period1 = dateToUnix(start);
  const period2 = dateToUnix(addDays(end, 1));
  const url = new URL(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`,
  );
  url.searchParams.set("period1", String(period1));
  url.searchParams.set("period2", String(period2));
  url.searchParams.set("interval", "1d");
  url.searchParams.set("includePrePost", "false");

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { "User-Agent": "Clawfolio/1.0" },
    });
  } catch {
    return [];
  }

  if (!res.ok) return [];

  const body = (await res.json()) as YahooChartResponse;
  const result = body.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const closes = result?.indicators?.quote?.[0]?.close ?? [];

  const rows: Array<{ date: string; close: number }> = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = timestamps[i];
    const close = closes[i];
    if (typeof ts !== "number" || close === null || close === undefined) continue;
    const value = Number(close);
    if (!Number.isFinite(value)) continue;
    rows.push({ date: unixToDateKey(ts), close: value });
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

function toBenchmarkPoints(
  bars: Array<{ date: string; close: number }>,
): BenchmarkHistoryPoint[] {
  if (bars.length === 0) return [];
  const first = bars[0].close;
  return bars.map((bar) => ({
    date: bar.date,
    indexValue: bar.close,
    cumulativeReturnPct: Number(pctChange(first, bar.close).toFixed(2)),
  }));
}

export function parseBenchmarkKey(raw: string | undefined): BenchmarkKey | null {
  if (!raw) return null;
  const normalized = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (normalized === "DOW" || normalized === "DJI" || normalized === "^DJI") {
    return "DOW";
  }
  if (
    normalized === "SP500" ||
    normalized === "S&P500" ||
    normalized === "SPX" ||
    normalized === "^GSPC" ||
    normalized === "GSPC"
  ) {
    return "SP500";
  }
  if (
    normalized === "NASDAQ" ||
    normalized === "IXIC" ||
    normalized === "^IXIC" ||
    normalized === "COMP"
  ) {
    return "NASDAQ";
  }
  return null;
}

export async function getBenchmarkHistory(params: {
  benchmark: BenchmarkKey;
  start: string;
  end: string;
  timeframe: BenchmarkTimeframe;
}): Promise<BenchmarkHistoryResult> {
  void params.timeframe;
  const cached = await readBenchmarkCache(
    params.benchmark,
    params.start,
    params.end,
  );
  if (cached) return cached;

  const spec = BENCHMARKS[params.benchmark];

  let bars = await fetchYahooDailyBars(spec.indexSymbol, params.start, params.end);
  let symbol = spec.indexSymbol;
  let provider = "yahoo-index";
  let isProxy = false;

  if (bars.length === 0) {
    bars = await fetchYahooDailyBars(spec.proxySymbol, params.start, params.end);
    symbol = spec.proxySymbol;
    provider = "yahoo-etf-proxy";
    isProxy = true;
  }

  const points = toBenchmarkPoints(bars);
  const totalReturnPct =
    points.length > 0 ? points[points.length - 1].cumulativeReturnPct : 0;

  const result = {
    label: spec.label,
    symbol,
    provider,
    isProxy,
    totalReturnPct,
    points,
  };
  await writeBenchmarkCache(params.benchmark, params.start, params.end, result);
  return result;
}
