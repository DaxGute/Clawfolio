import { useCallback, useState } from "react";
import { SuggestionDetailsPopover } from "../../components/SuggestionDetailsPopover/SuggestionDetailsPopover";
import { useClawfolioReport } from "../../context/ClawfolioReportContext";
import type { ClawfolioSuggestion, ClawfolioTradeAction } from "../../types/clawfolio";
import styles from "./DailySuggestions.module.css";

function toneForAction(action: ClawfolioTradeAction): "buy" | "sell" {
  return action === "BUY" ? "buy" : "sell";
}

function priorityLabel(confidence: number): string {
  if (confidence >= 75) return "High";
  if (confidence >= 55) return "Med";
  return "Low";
}

function suggestionKey(s: ClawfolioSuggestion): string {
  return `${s.symbol}-${s.action}-${s.order.limitPrice}`;
}

function DetailsIcon() {
  return (
    <svg
      className={styles.detailsIcon}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 11v5M12 8h.01"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DailySuggestions() {
  const { report, loading, running, needsRunToday } = useClawfolioReport();
  const items = report?.suggestions ?? [];
  const count = items.length;
  const [selected, setSelected] = useState<ClawfolioSuggestion | null>(null);

  const closeDetails = useCallback(() => setSelected(null), []);

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>
        Daily Suggestions ({loading || running ? "…" : count})
      </h2>

      <div className={styles.list}>
        <div className={styles.headerRow}>
          <span>Action</span>
          <span className={styles.colQty}>Conf</span>
          <span className={styles.colPri}>Priority</span>
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
                <span className={styles.action}>
                  <span className={styles.actionLabel}>{label}</span>
                  <span className={styles.detailsAffordance}>
                    <DetailsIcon />
                    <span className={styles.detailsText}>Details</span>
                  </span>
                </span>
                <span className={styles.qty}>{s.confidence}%</span>
                <span className={styles.priority}>
                  {priorityLabel(s.confidence)}
                </span>
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
