import { useMemo, useState } from "react";
import styles from "./PortfolioHealth.module.css";

type Row = {
  ticker: string;
  qty: string;
  totalValue: string;
  health: string;
};

const placeholderRows: Row[] = [
  { ticker: "AAPL", qty: "12", totalValue: "$2,847.00", health: "82%" },
  { ticker: "MSFT", qty: "5", totalValue: "$2,103.50", health: "76%" },
  { ticker: "VTI", qty: "40", totalValue: "$9,920.00", health: "91%" },
  { ticker: "BND", qty: "120", totalValue: "$8,412.00", health: "74%" },
  { ticker: "GOOGL", qty: "3", totalValue: "$534.21", health: "68%" },
];

export function PortfolioHealth() {
  const [query, setQuery] = useState("");
  const healthScore = 78;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return placeholderRows;
    return placeholderRows.filter((r) => r.ticker.toLowerCase().includes(q));
  }, [query]);

  return (
    <div className={styles.root}>
      <div className={styles.healthRow}>
        <div
          className={styles.healthBadge}
          aria-label="Weighted portfolio health"
        >
          <span className={styles.healthValue}>{healthScore}%</span>
        </div>
        <div className={styles.healthLabelWrap}>
          <span className={styles.healthLabel}>Weighted Portfolio Health</span>
        </div>
      </div>

      <label className={styles.searchWrap}>
        <span className={styles.visuallyHidden}>Search positions</span>
        <input
          className={styles.searchInput}
          type="search"
          placeholder="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
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
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr
                key={row.ticker}
                className={i % 2 === 0 ? styles.rowAlt : undefined}
              >
                <td>{row.ticker}</td>
                <td>{row.qty}</td>
                <td>{row.totalValue}</td>
                <td>{row.health}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
