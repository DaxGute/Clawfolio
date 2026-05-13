import styles from "./DailySuggestions.module.css";

type Suggestion = {
  id: string;
  action: string;
  qty: string;
  priority: string;
  tone: "buy" | "sell" | "neutral";
};

const items: Suggestion[] = [
  { id: "1", action: "Trim overweight tech", qty: "4", priority: "High", tone: "sell" },
  { id: "2", action: "Add to bond ladder", qty: "12", priority: "Med", tone: "buy" },
  { id: "3", action: "DRIP dividend reinvest", qty: "—", priority: "Low", tone: "buy" },
  { id: "4", action: "Review concentrated position", qty: "2", priority: "High", tone: "sell" },
];

export function DailySuggestions() {
  const count = 8;

  return (
    <div className={styles.root}>
      <h2 className={styles.title}>Daily Suggestions ({count})</h2>

      <div className={styles.list}>
        <div className={styles.headerRow}>
          <span>Action</span>
          <span className={styles.colQty}>Qty #</span>
          <span className={styles.colPri}>Priority</span>
        </div>

        {items.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`${styles.row} ${styles[`row--${s.tone}`]}`}
          >
            <span className={styles.rowInner}>
              <span className={styles.action}>{s.action}</span>
              <span className={styles.qty}>{s.qty}</span>
              <span className={styles.priority}>{s.priority}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
