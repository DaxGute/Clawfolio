import type { PortfolioRange } from "./types";

export type SeriesPoint = {
  date: string;
  value: number;
};

export type PeriodReturnRow = {
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  periodReturnPct: number;
  cumulativeReturnPct: number;
};

export type SeriesWithReturns = {
  points: Array<{
    date: string;
    value: number;
    cumulativeReturnPct: number;
  }>;
  periodReturns: PeriodReturnRow[];
  totalReturnPct: number;
};

type PeriodBucket = "week" | "month" | "quarter" | "year";

function periodKey(dateKey: string, bucket: PeriodBucket): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  if (bucket === "year") return `${year}`;
  if (bucket === "quarter") {
    const q = Math.floor((month - 1) / 3) + 1;
    return `${year}-Q${q}`;
  }
  if (bucket === "month") return `${year}-${String(month).padStart(2, "0")}`;
  const d = new Date(Date.UTC(year, month - 1, day));
  const oneJan = new Date(Date.UTC(year, 0, 1));
  const week = Math.ceil(
    ((d.getTime() - oneJan.getTime()) / 86_400_000 + oneJan.getUTCDay() + 1) / 7,
  );
  return `${year}-W${String(week).padStart(2, "0")}`;
}

function bucketForRange(range: PortfolioRange): PeriodBucket {
  switch (range) {
    case "3m":
      return "week";
    case "6m":
    case "YTD":
    case "1y":
      return "month";
    case "2y":
    case "3y":
      return "quarter";
    default:
      return "month";
  }
}

function formatPeriodLabel(key: string, bucket: PeriodBucket): string {
  if (bucket === "year") return key;
  if (bucket === "quarter") {
    const [year, q] = key.split("-Q");
    return `Q${q} '${year.slice(2)}`;
  }
  if (bucket === "week") {
    const [year, week] = key.split("-W");
    return `W${week} '${year.slice(2)}`;
  }
  const [year, month] = key.split("-");
  const monthDate = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
  }).format(monthDate);
}

function pctChange(from: number, to: number): number {
  if (!Number.isFinite(from) || !Number.isFinite(to) || from === 0) return 0;
  return ((to / from) - 1) * 100;
}

export function buildSeriesWithReturns(
  points: SeriesPoint[],
  range: PortfolioRange,
): SeriesWithReturns {
  if (points.length === 0) {
    return { points: [], periodReturns: [], totalReturnPct: 0 };
  }

  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const firstValue = sorted[0].value;

  const withCumulative = sorted.map((p) => ({
    date: p.date,
    value: p.value,
    cumulativeReturnPct: Number(pctChange(firstValue, p.value).toFixed(2)),
  }));

  const bucket = bucketForRange(range);
  const groups = new Map<string, SeriesPoint[]>();

  for (const point of sorted) {
    const key = periodKey(point.date, bucket);
    const group = groups.get(key) ?? [];
    group.push(point);
    groups.set(key, group);
  }

  const periodReturns: PeriodReturnRow[] = [];
  for (const [key, group] of [...groups.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const periodStart = group[0].date;
    const periodEnd = group[group.length - 1].date;
    const periodStartValue = group[0].value;
    const periodEndValue = group[group.length - 1].value;

    periodReturns.push({
      periodLabel: formatPeriodLabel(key, bucket),
      periodStart,
      periodEnd,
      periodReturnPct: Number(
        pctChange(periodStartValue, periodEndValue).toFixed(2),
      ),
      cumulativeReturnPct: Number(
        pctChange(firstValue, periodEndValue).toFixed(2),
      ),
    });
  }

  const last = sorted[sorted.length - 1];
  return {
    points: withCumulative,
    periodReturns,
    totalReturnPct: Number(pctChange(firstValue, last.value).toFixed(2)),
  };
}
