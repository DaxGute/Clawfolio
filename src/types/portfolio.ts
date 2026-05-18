import type {
  AlpacaAccountSummary,
  AlpacaConnectionState,
  AlpacaMode,
  BrokerPosition,
} from "./brokerage";

export type PortfolioRange = "YTD" | "3m" | "6m" | "1y" | "2y" | "3y";

export const PORTFOLIO_RANGES: PortfolioRange[] = [
  "YTD",
  "3m",
  "6m",
  "1y",
  "2y",
  "3y",
];

export type BenchmarkTab = "DOW" | "S&P 500" | "NASDAQ";

export const BENCHMARK_TABS: BenchmarkTab[] = ["DOW", "S&P 500", "NASDAQ"];

export const BENCHMARK_QUERY: Record<BenchmarkTab, string> = {
  DOW: "DOW",
  "S&P 500": "SP500",
  NASDAQ: "NASDAQ",
};

export type PeriodReturnRow = {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  periodReturnPct: number;
  cumulativeReturnPct: number;
};

export type PortfolioHistoryPoint = {
  date: string;
  equity: number;
  cumulativeReturnPct: number;
};

export type BenchmarkHistoryPoint = {
  date: string;
  indexValue: number;
  cumulativeReturnPct: number;
};

export type DataFreshnessStatus = "complete" | "partial" | "loading" | "error";

export type DataFreshness = {
  status: DataFreshnessStatus;
  requestedStart: string;
  requestedEnd: string;
  storedStart: string | null;
  storedEnd: string | null;
  missingWindows: Array<{ start: string; end: string }>;
  unfillableWindows: Array<{ start: string; end: string }>;
  coveragePct: number;
  lastUpdatedAt: string | null;
};

export type BenchmarkPayload = {
  key: string;
  label: string;
  symbol: string;
  provider: string;
  isProxy: boolean;
  totalReturnPct: number;
  points: BenchmarkHistoryPoint[];
  periodReturns: PeriodReturnRow[];
};

export type PortfolioSnapshotResponse = {
  mode: AlpacaMode;
  connection: {
    state: AlpacaConnectionState;
    message?: string;
  };
  lastUpdated: string;
  account: AlpacaAccountSummary | null;
  positions: BrokerPosition[];
  unrealizedPL: number;
  unrealizedPLPercent: number;
  dayPL: number | null;
  dayPLPercent: number | null;
  openOrdersCount: number;
  benchmarkKey: string;
  history: {
    range: PortfolioRange;
    totalReturnPct: number;
    points: PortfolioHistoryPoint[];
    periodReturns: PeriodReturnRow[];
  } | null;
  benchmark: BenchmarkPayload | null;
  dataFreshness: DataFreshness | null;
  error?: {
    code: string | "ALPACA_CREDENTIALS_MISSING" | "INVALID_RANGE";
    message: string;
    retryAfterSec?: number;
  };
};

export type BackfillJobStatus = "idle" | "running" | "complete" | "error";

export type PortfolioBackfillStatus = {
  isRunning: boolean;
  status: BackfillJobStatus;
  requestedRange: PortfolioRange | null;
  completedWindows: number;
  pendingWindows: Array<{ start: string; end: string }>;
  unfillableWindows: Array<{ start: string; end: string }>;
  coveragePct: number;
  currentWindow: { start: string; end: string } | null;
  error: string | null;
};
