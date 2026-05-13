import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import styles from "./GrowthGraph.module.css";

const INDEX_OPTIONS = ["DOW", "S&P 500", "NASDAQ"] as const;
const RANGE_OPTIONS = ["YTD", "3m", "6m", "1y", "2y", "3y"] as const;

type IndexKey = (typeof INDEX_OPTIONS)[number];

const chartSeed: Record<
  IndexKey,
  { portfolio: number[]; benchmark: number[] }
> = {
  DOW: {
    portfolio: [
      0, 0.4, 0.2, 1.1, 1.4, 2.0, 2.2, 3.1, 3.8, 4.2, 4.0, 5.1, 5.8, 6.2, 6.9,
      7.4, 8.1, 8.6, 9.2, 9.98,
    ],
    benchmark: [
      0, 0.1, -0.2, 0.3, 0.5, 0.4, 0.6, 0.5, 0.7, 0.8, 0.6, 0.9, 0.85, 0.95,
      1.0, 1.05, 1.08, 1.1, 1.12, 1.16,
    ],
  },
  "S&P 500": {
    portfolio: [
      0, 0.5, 0.3, 1.3, 1.6, 2.2, 2.5, 3.4, 4.0, 4.5, 4.3, 5.4, 6.0, 6.5, 7.2,
      7.8, 8.4, 9.0, 9.5, 10.2,
    ],
    benchmark: [
      0, 0.2, 0.0, 0.5, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.0, 1.3, 1.35, 1.4,
      1.45, 1.5, 1.55, 1.6, 1.65, 1.7,
    ],
  },
  NASDAQ: {
    portfolio: [
      0, 0.6, 0.4, 1.5, 1.8, 2.5, 2.8, 3.8, 4.5, 5.0, 4.8, 6.0, 6.8, 7.2, 8.0,
      8.6, 9.2, 9.8, 10.4, 11.0,
    ],
    benchmark: [
      0, 0.3, 0.1, 0.6, 0.9, 1.0, 1.2, 1.4, 1.6, 1.8, 1.5, 2.0, 2.1, 2.2, 2.3,
      2.4, 2.5, 2.55, 2.6, 2.65,
    ],
  },
};

const labels = [
  "Jan 01 '26",
  "Jan 15",
  "Feb 01",
  "Feb 15",
  "Mar 01",
  "Mar 15",
  "Apr 01",
  "Apr 15",
  "May 01",
  "May 07",
];

function buildChartData(index: IndexKey) {
  const { portfolio, benchmark } = chartSeed[index];
  const n = labels.length;
  const step = Math.max(1, Math.floor(portfolio.length / n));
  return labels.map((date, i) => {
    const j = Math.min(portfolio.length - 1, i * step);
    return {
      date,
      portfolio: Number(portfolio[j].toFixed(2)),
      benchmark: Number(benchmark[j].toFixed(2)),
    };
  });
}

const monthlyRows = [
  { month: "Jan '26", portMonthly: "2.1%", portCum: "2.1%", benchMonthly: "0.4%", benchCum: "0.4%" },
  { month: "Feb", portMonthly: "1.8%", portCum: "3.9%", benchMonthly: "0.3%", benchCum: "0.7%" },
  { month: "Mar", portMonthly: "2.4%", portCum: "6.4%", benchMonthly: "0.2%", benchCum: "0.9%" },
];

export function GrowthGraph() {
  const [indexKey, setIndexKey] = useState<IndexKey>("DOW");
  const [range, setRange] = useState<(typeof RANGE_OPTIONS)[number]>("YTD");

  const data = useMemo(() => buildChartData(indexKey), [indexKey]);

  const portfolioLabel = "Individual Brokerage-8642";
  const last = data[data.length - 1];
  const portfolioLegend = `${portfolioLabel} (${last.portfolio.toFixed(2)}%)`;
  const benchmarkLegend = `${indexKey} (${last.benchmark.toFixed(2)}%)`;

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.pillGroup} role="group" aria-label="Benchmark index">
          {INDEX_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={opt === indexKey ? styles.pillActive : styles.pill}
              onClick={() => setIndexKey(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
        <div className={styles.pillGroup} role="group" aria-label="Time range">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt}
              type="button"
              className={opt === range ? styles.pillActive : styles.pill}
              onClick={() => setRange(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.chartArea}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: "#555" }}
              axisLine={{ stroke: "#ccc" }}
              tickLine={false}
            />
            <YAxis
              domain={[-10, 10]}
              tickFormatter={(v) => `${v.toFixed(2)}%`}
              tick={{ fontSize: 11, fill: "#555" }}
              axisLine={{ stroke: "#ccc" }}
              tickLine={false}
              width={52}
            />
            <Tooltip
              formatter={(value) =>
                typeof value === "number" ? `${value.toFixed(2)}%` : String(value ?? "")
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
            <Line
              type="monotone"
              dataKey="portfolio"
              name={portfolioLegend}
              stroke="#7c3aed"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="benchmark"
              name={benchmarkLegend}
              stroke="#2563eb"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th />
              <th colSpan={2}>{portfolioLabel}</th>
              <th colSpan={2}>{indexKey}</th>
            </tr>
            <tr>
              <th />
              <th>Monthly</th>
              <th>Cumulative</th>
              <th>Monthly</th>
              <th>Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {monthlyRows.map((row) => (
              <tr key={row.month}>
                <td className={styles.monthCell}>{row.month}</td>
                <td>{row.portMonthly}</td>
                <td>{row.portCum}</td>
                <td>{row.benchMonthly}</td>
                <td>{row.benchCum}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <span className={styles.rangeNote} aria-live="polite">
        Range: {range} (demo)
      </span>
    </div>
  );
}
