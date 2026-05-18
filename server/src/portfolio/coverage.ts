import { addDays } from "./range";
import type { DataFreshnessStatus, DateWindow, PortfolioHistoryPoint } from "./types";
import {
  contiguousWindowsFromDays,
  effectiveRequestedEnd,
  isLikelyUnfillableDate,
  listTradingDays,
} from "./tradingDays";

const GAP_TRADING_DAYS = 3;
const COMPLETE_COVERAGE_THRESHOLD = 99.5;

export type CoverageAnalysis = {
  requested: DateWindow;
  effectiveEnd: string;
  expectedTradingDays: string[];
  missingFetchableDays: string[];
  missingUnfillableDays: string[];
  fetchableWindows: DateWindow[];
  unfillableWindows: DateWindow[];
  coveragePct: number;
  status: DataFreshnessStatus;
  isComplete: boolean;
};

function detectInternalGaps(storedDates: string[]): string[] {
  const sorted = [...storedDates].sort();
  const missing: string[] = [];

  for (let i = 0; i < sorted.length - 1; i += 1) {
    const gapDays = listTradingDays(addDays(sorted[i], 1), addDays(sorted[i + 1], -1));
    if (gapDays.length >= GAP_TRADING_DAYS) {
      missing.push(...gapDays);
    }
  }

  return missing;
}

function detectBoundaryGaps(
  expectedTradingDays: string[],
  storedDates: string[],
): string[] {
  if (expectedTradingDays.length === 0) return [];
  if (storedDates.length === 0) return expectedTradingDays;

  const firstStored = storedDates[0];
  const lastStored = storedDates[storedDates.length - 1];
  return expectedTradingDays.filter(
    (day) => day < firstStored || day > lastStored,
  );
}

export function analyzeCoverage(
  requested: DateWindow,
  points: PortfolioHistoryPoint[],
  asOf: Date = new Date(),
  knownUnfillableWindows: DateWindow[] = [],
): CoverageAnalysis {
  const effectiveEnd = effectiveRequestedEnd(requested.end, asOf);
  const effectiveRequested: DateWindow = {
    start: requested.start,
    end: effectiveEnd,
  };

  const storedDates = points.map((p) => p.date).sort();
  const storedSet = new Set(storedDates);
  const expectedTradingDays = listTradingDays(
    effectiveRequested.start,
    effectiveRequested.end,
  );

  const missingInternal = detectInternalGaps(storedDates).filter(
    (d) => d >= effectiveRequested.start && d <= effectiveRequested.end,
  );
  const missingBoundary = detectBoundaryGaps(
    expectedTradingDays,
    storedDates,
  ).filter((d) => !storedSet.has(d));

  const missingDays = [...new Set([...missingBoundary, ...missingInternal])].sort();
  const knownUnfillableDays = new Set(
    knownUnfillableWindows.flatMap((window) =>
      listTradingDays(
        window.start < effectiveRequested.start ? effectiveRequested.start : window.start,
        window.end > effectiveRequested.end ? effectiveRequested.end : window.end,
      ),
    ),
  );

  const missingFetchableDays = missingDays.filter(
    (d) => !knownUnfillableDays.has(d) && !isLikelyUnfillableDate(d, asOf),
  );
  const missingUnfillableDays = missingDays.filter((d) =>
    knownUnfillableDays.has(d) || isLikelyUnfillableDate(d, asOf),
  );

  const fetchableWindows = contiguousWindowsFromDays(missingFetchableDays);
  const unfillableWindows = contiguousWindowsFromDays(missingUnfillableDays);

  const expectedCount = Math.max(expectedTradingDays.length, 1);
  const coveredCount = expectedTradingDays.filter((d) => storedSet.has(d)).length;
  let coveragePct = (coveredCount / expectedCount) * 100;

  const onlyUnfillableRemain =
    missingFetchableDays.length === 0 && missingDays.length > 0;
  const noMissing = missingDays.length === 0;

  if (noMissing || onlyUnfillableRemain || coveragePct >= COMPLETE_COVERAGE_THRESHOLD) {
    coveragePct = 100;
  } else {
    coveragePct = Math.min(99.4, Math.round(coveragePct * 10) / 10);
  }

  const isComplete =
    noMissing || onlyUnfillableRemain || coveragePct >= 100;

  let status: DataFreshnessStatus = "complete";
  if (!isComplete && fetchableWindows.length > 0) {
    status = "partial";
  } else if (isComplete) {
    status = "complete";
  }

  return {
    requested: effectiveRequested,
    effectiveEnd,
    expectedTradingDays,
    missingFetchableDays,
    missingUnfillableDays,
    fetchableWindows,
    unfillableWindows,
    coveragePct,
    status,
    isComplete,
  };
}

export function finalizeCoverageStatus(
  analysis: CoverageAnalysis,
  backfillRunning: boolean,
): DataFreshnessStatus {
  if (analysis.isComplete) return "complete";
  if (backfillRunning && analysis.fetchableWindows.length > 0) return "loading";
  if (analysis.fetchableWindows.length > 0) return "partial";
  return "complete";
}
