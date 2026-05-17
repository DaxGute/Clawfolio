import { useMemo, useState } from "react";
import { useClawfolioReport } from "../../context/ClawfolioReportContext";
import type { ClawfolioTradeAction } from "../../types/clawfolio";
import styles from "./PortfolioHealth.module.css";

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function recClass(rec: ClawfolioTradeAction | null): string {
  if (rec === "BUY") return styles.recBuy;
  if (rec === "SELL") return styles.recSell;
  return styles.recNeutral;
}

export function PortfolioHealth() {
  const { report, loading, running, error, needsRunToday, refresh } =
    useClawfolioReport();
  const [query, setQuery] = useState("");

  const healthScore = report?.portfolioHealth.score ?? null;
  const healthLabel = report?.portfolioHealth.label ?? "—";
  const summary = report?.portfolioHealth.summary ?? "";

  const rows = useMemo(() => {
    const positions = report?.positions ?? [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? positions.filter((p) => p.symbol.toLowerCase().includes(q))
      : positions;
    return filtered.map((p) => ({
      ticker: p.symbol,
      qty: String(p.qty),
      totalValue: formatUsd(p.marketValue),
      health: `${p.healthScore}%`,
      healthLabel: p.healthLabel,
      recommendation: p.recommendation,
      confidence: p.confidence,
    }));
  }, [report, query]);

  return (
    <div className={styles.root}>
      <div className={styles.healthRow}>
        <div
          className={styles.healthBadge}
          aria-label="Weighted portfolio health"
        >
          {loading || running ? (
            <span className={styles.healthLoading}>…</span>
          ) : (
            <span className={styles.healthValue}>
              {healthScore !== null ? `${healthScore}%` : "—"}
            </span>
          )}
        </div>
        <div className={styles.healthLabelWrap}>
          <span className={styles.healthLabel}>
            {running
              ? "Running daily analysis…"
              : `${healthLabel} · Weighted Portfolio Health`}
          </span>
          {!running && summary ? (
            <span className={styles.healthSummary}>{summary}</span>
          ) : null}
          {!loading && !running && needsRunToday ? (
            <span className={styles.pendingRun}>
              Press Run for today&apos;s analysis
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className={styles.errorBanner} role="alert">
          <span>{error}</span>
          <button
            type="button"
            className={styles.retryBtn}
            onClick={() => void refresh(true)}
          >
            Retry
          </button>
        </div>
      ) : null}

      {report?.warnings.length ? (
        <ul className={styles.warnings}>
          {report.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}

      <label className={styles.searchWrap}>
        <span className={styles.visuallyHidden}>Search positions</span>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          disabled={loading || running}
        />
        <span className={styles.searchIcon} aria-hidden>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="m16.5 16.5 4.5 4.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </span>
      </label>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Qty #</th>
              <th>Total Value</th>
              <th>Health</th>
              <th>Rec</th>
            </tr>
          </thead>
          <tbody>
            {running && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  Pulling Alpaca snapshot and scoring portfolio…
                </td>
              </tr>
            ) : null}
            {!loading && !running && rows.length === 0 ? (
              <tr>
                <td colSpan={5} className={styles.emptyCell}>
                  {needsRunToday
                    ? "Run to load positions."
                    : "No positions in report."}
                </td>
              </tr>
            ) : null}
            {rows.map((row, i) => (
              <tr
                key={row.ticker}
                className={i % 2 === 0 ? styles.rowAlt : undefined}
                title={`${row.healthLabel} · ${row.confidence}% confidence`}
              >
                <td>{row.ticker}</td>
                <td>{row.qty}</td>
                <td>{row.totalValue}</td>
                <td>{row.health}</td>
                <td>
                  <span
                    className={`${styles.recBadge} ${recClass(row.recommendation)}`}
                  >
                    {row.recommendation ?? "NONE"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
