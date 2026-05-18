import { useCallback, useMemo, useState } from "react";
import { SuggestionDetailsPopover } from "../../components/SuggestionDetailsPopover/SuggestionDetailsPopover";
import { useClawfolioReport } from "../../context/ClawfolioReportContext";
import type { ClawfolioSuggestion, ClawfolioTradeAction } from "../../types/clawfolio";
import styles from "./DailySuggestions.module.css";

function toneForAction(action: ClawfolioTradeAction): "buy" | "sell" {
  return action === "BUY" ? "buy" : "sell";
}

function suggestionKey(s: ClawfolioSuggestion): string {
  return `${s.symbol}-${s.action}-${s.order.limitPrice}`;
}

export function DailySuggestions() {
  const { report, loading, running, needsRunToday } = useClawfolioReport();
  const items = useMemo(() => {
    const suggestions = report?.suggestions ?? [];
    return [...suggestions].sort((a, b) => b.confidence - a.confidence);
  }, [report?.suggestions]);
  const count = items.length;
  const [selected, setSelected] = useState<ClawfolioSuggestion | null>(null);

  const closeDetails = useCallback(() => setSelected(null), []);

  return (
    <div className={styles.root}>
      <div className={styles.titleRow}>
        <h2 className={styles.title}>
          Daily Suggestions ({loading || running ? "…" : count})
        </h2>
        <p className={styles.titleHint}>Click a row to pull up the description</p>
      </div>

      <div className={styles.list}>
        <div className={styles.headerRow}>
          <span>Action</span>
          <span className={styles.colQty}>Conf</span>
        </div>

        {running && items.length === 0 ? (
          <p className={styles.loading}>Generating suggestions…</p>
        ) : null}

        {!loading && !running && needsRunToday && items.length === 0 ? (
          <p className={styles.pendingRun}>Run to generate today&apos;s suggestions.</p>
        ) : null}

        {!loading && !running && !needsRunToday && items.length === 0 ? (
          <p className={styles.loading}>No actionable suggestions today.</p>
        ) : null}

        {items.map((s) => {
          const tone = toneForAction(s.action);
          const label = `${s.action} ${s.order.quantity} ${s.symbol}`;
          return (
            <button
              key={suggestionKey(s)}
              type="button"
              className={`${styles.row} ${styles[`row--${tone}`]}`}
              onClick={() => setSelected(s)}
              aria-label={`View details for ${label}`}
            >
              <span className={styles.rowInner}>
                <span className={styles.action}>{label}</span>
                <span className={styles.qty}>{s.confidence}%</span>
              </span>
            </button>
          );
        })}
      </div>

      {selected ? (
        <SuggestionDetailsPopover
          suggestion={selected}
          onClose={closeDetails}
        />
      ) : null}
    </div>
  );
}
