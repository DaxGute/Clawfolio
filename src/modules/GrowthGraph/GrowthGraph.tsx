import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  fetchPortfolioBackfillStatus,
  fetchPortfolioSnapshot,
  postPortfolioBackfill,
} from "../../api/portfolioClient";
import {
  BENCHMARK_TABS,
  PORTFOLIO_RANGES,
  type BenchmarkPayload,
  type BenchmarkTab,
  type DataFreshness,
  type PeriodReturnRow,
  type PortfolioHistoryPoint,
  type PortfolioRange,
} from "../../types/portfolio";
import styles from "./GrowthGraph.module.css";

type SlidingPillGroupProps<T extends string> = {
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  isOptionDisabled?: (value: T) => boolean;
};

function SlidingPillGroup<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  isOptionDisabled,
}: SlidingPillGroupProps<T>) {
  const groupRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ width: 0, translateX: 0 });

  const measureThumb = useCallback(() => {
    const group = groupRef.current;
    if (!group) return;
    const activeButton = group.querySelector<HTMLButtonElement>(
      'button[data-active="true"]',
    );
    if (!activeButton) return;
    setThumb({
      width: activeButton.offsetWidth,
      translateX: activeButton.offsetLeft,
    });
  }, []);

  useLayoutEffect(() => {
    measureThumb();
  }, [value, measureThumb]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    const observer = new ResizeObserver(() => measureThumb());
    observer.observe(group);
    return () => observer.disconnect();
  }, [measureThumb]);

  return (
    <div ref={groupRef} className={styles.pillGroup} role="group" aria-label={ariaLabel}>
      <div
        className={styles.pillThumb}
        style={{
          width: thumb.width,
          transform: `translateX(${thumb.translateX}px)`,
        }}
        aria-hidden
      />
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            data-active={active ? "true" : "false"}
            className={active ? styles.pillActive : styles.pill}
            onClick={() => onChange(opt)}
            disabled={isOptionDisabled?.(opt)}
            aria-pressed={active}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

type ChartRow = {
  date: string;
  label: string;
  portfolio: number | null;
  benchmark: number | null;
};

function formatAxisDate(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00.000Z`);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "2-digit",
  }).format(d);
}

function mergeChartRows(
  portfolio: PortfolioHistoryPoint[],
  benchmark: BenchmarkPayload | null,
): ChartRow[] {
  const byDate = new Map<string, ChartRow>();

  for (const p of portfolio) {
    byDate.set(p.date, {
      date: p.date,
      label: formatAxisDate(p.date),
      portfolio: p.cumulativeReturnPct,
      benchmark: null,
    });
  }

  for (const b of benchmark?.points ?? []) {
    const existing = byDate.get(b.date);
    if (existing) {
      existing.benchmark = b.cumulativeReturnPct;
    } else {
      byDate.set(b.date, {
        date: b.date,
        label: formatAxisDate(b.date),
        portfolio: null,
        benchmark: b.cumulativeReturnPct,
      });
    }
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function pickAxisTicks(rows: ChartRow[], maxTicks = 8): string[] {
  if (rows.length <= maxTicks) return rows.map((r) => r.label);
  const step = Math.max(1, Math.floor(rows.length / maxTicks));
  const ticks: string[] = [];
  for (let i = 0; i < rows.length; i += step) {
    ticks.push(rows[i].label);
  }
  const last = rows[rows.length - 1]?.label;
  if (last && ticks[ticks.length - 1] !== last) ticks.push(last);
  return ticks;
}

function computeYDomain(rows: ChartRow[]): [number, number] {
  const values = rows.flatMap((r) => [r.portfolio, r.benchmark]).filter(
    (v): v is number => typeof v === "number",
  );
  if (values.length === 0) return [-5, 5];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(1, (max - min) * 0.15);
  return [Number((min - pad).toFixed(1)), Number((max + pad).toFixed(1))];
}

function missingOverlayRange(
  rows: ChartRow[],
  freshness: DataFreshness | null,
): { x1?: string; x2?: string } {
  if (!freshness || rows.length === 0 || freshness.status === "complete") {
    return {};
  }

  const fetchable = freshness.missingWindows ?? [];
  if (fetchable.length === 0) return {};

  const window = fetchable[0];
  const startIdx = rows.findIndex((r) => r.date >= window.start);
  const endIdx = rows.findIndex((r) => r.date > window.end);
  if (startIdx < 0) return {};

  return {
    x1: rows[startIdx]?.label,
    x2: rows[endIdx >= 0 ? endIdx - 1 : rows.length - 1]?.label,
  };
}

function formatPct(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function buildTableRows(
  portfolioPeriods: PeriodReturnRow[],
  benchmarkPeriods: PeriodReturnRow[],
): Array<{
  periodLabel: string;
  portPeriod: string;
  portCumulative: string;
  benchPeriod: string;
  benchCumulative: string;
}> {
  const benchByLabel = new Map(
    benchmarkPeriods.map((row) => [row.periodLabel, row]),
  );

  return portfolioPeriods.map((port) => {
    const bench = benchByLabel.get(port.periodLabel);
    return {
      periodLabel: port.periodLabel,
      portPeriod: formatPct(port.periodReturnPct),
      portCumulative: formatPct(port.cumulativeReturnPct),
      benchPeriod: bench ? formatPct(bench.periodReturnPct) : "—",
      benchCumulative: bench ? formatPct(bench.cumulativeReturnPct) : "—",
    };
  });
}

export function GrowthGraph() {
  const [range, setRange] = useState<PortfolioRange>("YTD");
  const [benchmarkTab, setBenchmarkTab] = useState<BenchmarkTab>("DOW");
  const [points, setPoints] = useState<PortfolioHistoryPoint[]>([]);
  const [benchmark, setBenchmark] = useState<BenchmarkPayload | null>(null);
  const [periodReturns, setPeriodReturns] = useState<PeriodReturnRow[]>([]);
  const [freshness, setFreshness] = useState<DataFreshness | null>(null);
  const [accountLabel, setAccountLabel] = useState("Portfolio");
  const [loading, setLoading] = useState(true);
  const [backfillPct, setBackfillPct] = useState(0);
  const [backfillActive, setBackfillActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsAlpacaAuth, setNeedsAlpacaAuth] = useState(false);
  const backfillStarted = useRef(false);

  const emptyStateMessage = useMemo(() => {
    if (loading) return "Loading portfolio history…";
    if (needsAlpacaAuth) {
      return "Sign in with Alpaca to view performance history, or set ALPACA_API_KEY and ALPACA_SECRET_KEY on the server.";
    }
    if (error) return error;
    return "No portfolio history available yet.";
  }, [loading, needsAlpacaAuth, error]);

  const loadSnapshot = useCallback(async (options: { preferCache?: boolean } = {}) => {
    setLoading(true);
    setError(null);
    setNeedsAlpacaAuth(false);
    try {
      const snap = await fetchPortfolioSnapshot(range, benchmarkTab, options);
      if (snap.error?.code === "ALPACA_CREDENTIALS_MISSING") {
        setNeedsAlpacaAuth(true);
      }

      setPoints(snap.history?.points ?? []);
      setPeriodReturns(snap.history?.periodReturns ?? []);
      setBenchmark(snap.benchmark);
      setFreshness(snap.dataFreshness);

      const acct = snap.account?.accountNumber ?? snap.account?.id;
      if (acct) setAccountLabel(`Account ${acct}`);

      const needsBackfill =
        snap.dataFreshness?.status === "partial" ||
        snap.dataFreshness?.status === "loading";

      if (needsBackfill && !backfillStarted.current) {
        backfillStarted.current = true;
        void (async () => {
          try {
            const status = await fetchPortfolioBackfillStatus();
            if (!status.isRunning && status.status !== "running") {
              await postPortfolioBackfill(range);
            }
          } catch {
            await postPortfolioBackfill(range).catch(() => undefined);
          }
        })();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not load portfolio history.";
      setError(message);
      if (message.toLowerCase().includes("credentials missing")) {
        setNeedsAlpacaAuth(true);
      }
    } finally {
      setLoading(false);
    }
  }, [range, benchmarkTab]);

  useEffect(() => {
    backfillStarted.current = false;
    void loadSnapshot({ preferCache: true });
  }, [loadSnapshot]);

  useEffect(() => {
    const shouldPoll =
      freshness?.status === "loading" ||
      freshness?.status === "partial" ||
      backfillActive;

    if (!shouldPoll) return;

    const id = window.setInterval(() => {
      void (async () => {
        try {
          const statusRes = await fetchPortfolioBackfillStatus();
          const running =
            statusRes.isRunning || statusRes.status === "running";
          setBackfillActive(running);
          setBackfillPct(statusRes.coveragePct);

          if (statusRes.error) setError(statusRes.error);

          if (
            !running &&
            (statusRes.status === "complete" || statusRes.coveragePct >= 100)
          ) {
            await loadSnapshot();
          }
        } catch {
          /* ignore transient poll errors */
        }
      })();
    }, 2500);

    return () => window.clearInterval(id);
  }, [freshness?.status, backfillActive, loadSnapshot]);

  const rows = useMemo(() => mergeChartRows(points, benchmark), [points, benchmark]);
  const tableRows = useMemo(
    () => buildTableRows(periodReturns, benchmark?.periodReturns ?? []),
    [periodReturns, benchmark?.periodReturns],
  );
  const axisTicks = useMemo(() => pickAxisTicks(rows), [rows]);
  const yDomain = useMemo(() => computeYDomain(rows), [rows]);
  const overlay = useMemo(
    () => missingOverlayRange(rows, freshness),
    [rows, freshness],
  );

  const hasRealData = points.length > 0;
  const isBackfilling =
    backfillActive ||
    freshness?.status === "loading" ||
    (freshness?.status === "partial" &&
      (freshness.missingWindows?.length ?? 0) > 0);

  const lastPort = points[points.length - 1]?.cumulativeReturnPct;
  const lastBench = benchmark?.totalReturnPct;
  const portfolioLegend =
    lastPort !== undefined
      ? `${accountLabel} (${formatPct(lastPort)})`
      : accountLabel;
  const benchmarkLabel = benchmark?.isProxy
    ? `${benchmarkTab} (ETF proxy)`
    : benchmarkTab;
  const benchmarkLegend =
    lastBench !== undefined
      ? `${benchmarkLabel} (${formatPct(lastBench)})`
      : benchmarkLabel;

  const progressPct = Math.min(
    100,
    Math.max(0, backfillActive ? backfillPct : freshness?.coveragePct ?? 0),
  );

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <SlidingPillGroup
          options={BENCHMARK_TABS}
          value={benchmarkTab}
          onChange={setBenchmarkTab}
          ariaLabel="Benchmark index"
        />
        <SlidingPillGroup
          options={PORTFOLIO_RANGES}
          value={range}
          onChange={setRange}
          ariaLabel="Time range"
          isOptionDisabled={(opt) => loading && opt === range}
        />
      </div>

      {benchmark?.isProxy ? (
        <p className={styles.proxyNote}>
          Benchmark uses ETF proxy ({benchmark.symbol}) because index history was unavailable.
        </p>
      ) : null}

      <div
        className={`${styles.chartArea} ${isBackfilling ? styles.chartPartial : ""}`}
        aria-busy={loading || isBackfilling}
      >
        {hasRealData ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis
                dataKey="label"
                ticks={axisTicks}
                tick={{ fontSize: 11, fill: "#555" }}
                axisLine={{ stroke: "#ccc" }}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={(v) => `${Number(v).toFixed(1)}%`}
                tick={{ fontSize: 11, fill: "#555" }}
                axisLine={{ stroke: "#ccc" }}
                tickLine={false}
                width={52}
              />
              <Tooltip
                formatter={(value) =>
                  typeof value === "number" ? formatPct(value) : "—"
                }
                labelStyle={{ fontWeight: 600 }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid #ddd",
                  fontSize: 12,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => <span style={{ color: "#333" }}>{value}</span>}
              />
              {overlay.x1 && overlay.x2 ? (
                <ReferenceArea
                  x1={overlay.x1}
                  x2={overlay.x2}
                  fill="#9ca3af"
                  fillOpacity={0.22}
                  strokeOpacity={0}
                />
              ) : null}
              <Line
                type="monotone"
                dataKey="portfolio"
                name={portfolioLegend}
                stroke="#7c3aed"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="benchmark"
                name={benchmarkLegend}
                stroke="#2563eb"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className={styles.emptyState}>{emptyStateMessage}</div>
        )}

        {isBackfilling && hasRealData ? (
          <div className={styles.chartOverlay} aria-hidden>
            <div className={styles.overlayShade} />
          </div>
        ) : null}
      </div>

      {isBackfilling ? (
        <div className={styles.backfillBar} role="status">
          <span className={styles.backfillLabel}>Backfilling portfolio history…</span>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className={styles.progressPct}>{Math.round(progressPct)}% coverage</span>
        </div>
      ) : null}

      {error && hasRealData ? (
        <p className={styles.errorNote} role="alert">
          {error}
        </p>
      ) : null}

      {tableRows.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th />
                <th colSpan={2}>{accountLabel}</th>
                <th colSpan={2}>
                  {benchmarkLabel}
                  {benchmark?.isProxy ? " (proxy)" : ""}
                </th>
              </tr>
              <tr>
                <th>Period</th>
                <th>Period</th>
                <th>Cumulative</th>
                <th>Period</th>
                <th>Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.periodLabel}>
                  <td className={styles.monthCell}>{row.periodLabel}</td>
                  <td>{row.portPeriod}</td>
                  <td>{row.portCumulative}</td>
                  <td>{row.benchPeriod}</td>
                  <td>{row.benchCumulative}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <span className={styles.rangeNote} aria-live="polite">
        Range: {range}
        {benchmark?.isProxy ? " · benchmark proxy" : ""}
        {freshness?.status === "complete"
          ? ""
          : freshness?.status
            ? ` · ${freshness.status}`
            : loading
              ? " · loading"
              : hasRealData
                ? ""
                : " · no data"}
      </span>
    </div>
  );
}
