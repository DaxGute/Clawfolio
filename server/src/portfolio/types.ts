export const PORTFOLIO_HISTORY_SOURCE = "alpaca" as const;

export type PortfolioHistorySource = typeof PORTFOLIO_HISTORY_SOURCE;

export type PortfolioRange = "YTD" | "3m" | "6m" | "1y" | "2y" | "3y";

export const PORTFOLIO_RANGES: PortfolioRange[] = [
  "YTD",
  "3m",
  "6m",
  "1y",
  "2y",
  "3y",
];

export type PortfolioHistoryPoint = {
  id: string;
  source: PortfolioHistorySource;
  accountId: string;
  date: string;
  equity: number;
  profitLoss: number;
  profitLossPct: number;
  createdAt: string;
  updatedAt: string;
};

export type DateWindow = {
  start: string;
  end: string;
};

export type DataFreshnessStatus = "complete" | "partial" | "loading" | "error";

export type DataFreshness = {
  status: DataFreshnessStatus;
  requestedStart: string;
  requestedEnd: string;
  storedStart: string | null;
  storedEnd: string | null;
  missingWindows: DateWindow[];
  unfillableWindows: DateWindow[];
  coveragePct: number;
  lastUpdatedAt: string | null;
};

export type PeriodReturnRow = {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  periodReturnPct: number;
  cumulativeReturnPct: number;
};

export type PortfolioHistoryPayload = {
  range: PortfolioRange;
  totalReturnPct: number;
  points: Array<{
    date: string;
    equity: number;
    cumulativeReturnPct: number;
  }>;
  periodReturns: PeriodReturnRow[];
};

export type BenchmarkKey = "DOW" | "SP500" | "NASDAQ";
