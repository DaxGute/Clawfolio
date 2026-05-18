import { getBenchmarkHistory, type BenchmarkKey } from "./benchmarkProvider";
import { buildSeriesWithReturns } from "./periodReturns";
import type { PortfolioHistoryPoint, PortfolioRange } from "./types";

export function buildPortfolioHistoryPayload(
  points: PortfolioHistoryPoint[],
  range: PortfolioRange,
) {
  const series = buildSeriesWithReturns(
    points.map((p) => ({ date: p.date, value: p.equity })),
    range,
  );

  return {
    range,
    totalReturnPct: series.totalReturnPct,
    points: series.points.map((p) => ({
      date: p.date,
      equity: p.value,
      cumulativeReturnPct: p.cumulativeReturnPct,
    })),
    periodReturns: series.periodReturns,
  };
}

export async function buildBenchmarkPayload(
  benchmark: BenchmarkKey,
  start: string,
  end: string,
  range: PortfolioRange,
) {
  const history = await getBenchmarkHistory({
    benchmark,
    start,
    end,
    timeframe: "1D",
  });

  const series = buildSeriesWithReturns(
    history.points.map((p) => ({ date: p.date, value: p.indexValue })),
    range,
  );

  return {
    key: benchmark,
    label: history.label,
    symbol: history.symbol,
    provider: history.provider,
    isProxy: history.isProxy,
    totalReturnPct: series.totalReturnPct,
    points: series.points.map((p) => ({
      date: p.date,
      indexValue: p.value,
      cumulativeReturnPct: p.cumulativeReturnPct,
    })),
    periodReturns: series.periodReturns,
  };
}
