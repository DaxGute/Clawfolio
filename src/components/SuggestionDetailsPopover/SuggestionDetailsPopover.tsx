import { useEffect, useId, useRef, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import type {
  ClawfolioLinkedNews,
  ClawfolioSuggestion,
  ClawfolioTradeAction,
} from "../../types/clawfolio";
import styles from "./SuggestionDetailsPopover.module.css";

const GENERIC_NEWS_RELEVANCE =
  "Current news context attached directly to this order suggestion.";

type SuggestionDetailsPopoverProps = {
  suggestion: ClawfolioSuggestion;
  onClose: () => void;
};

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 4,
  }).format(value);
}

function formatPublishedAt(value: string | null): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(parsed);
}

function actionBadgeClass(action: ClawfolioTradeAction): string {
  return action === "BUY" ? styles.badgeBuy : styles.badgeSell;
}

function hasSpecificText(value: string | null | undefined): value is string {
  return !!value && value.trim() !== "" && value.trim() !== GENERIC_NEWS_RELEVANCE;
}

function mergedArticleContext(item: ClawfolioLinkedNews): string | null {
  if (hasSpecificText(item.articleContext)) return item.articleContext;
  const parts = [item.symbolContext, item.relevanceToSuggestion ?? item.relevance]
    .filter(hasSpecificText);
  return parts.length > 0 ? parts.join(" ") : null;
}

function OrderSection({ suggestion }: { suggestion: ClawfolioSuggestion }) {
  const { order } = suggestion;
  const rows: { label: string; value: string; wide?: boolean }[] = [
    { label: "Action", value: order.action },
    { label: "Symbol", value: order.symbol },
    { label: "Order type", value: order.orderType.toUpperCase() },
    { label: "Limit price", value: formatUsd(order.limitPrice) },
    { label: "Quantity", value: formatQuantity(order.quantity) },
    { label: "Est. notional", value: formatUsd(order.estimatedNotional) },
    {
      label: "Time in force",
      value: order.timeInForce.toUpperCase(),
      wide: true,
    },
  ];

  return (
    <section className={styles.section} aria-labelledby="suggestion-order">
      <h3 id="suggestion-order" className={styles.sectionTitle}>
        Order
      </h3>
      <div className={styles.orderGrid}>
        {rows.map((row) => (
          <OrderField key={row.label} row={row} />
        ))}
      </div>
    </section>
  );
}

function OrderField({
  row,
}: {
  row: { label: string; value: string; wide?: boolean };
}) {
  return (
    <div
      className={`${styles.orderItem}${row.wide ? ` ${styles.orderItemWide}` : ""}`}
    >
      <span className={styles.orderLabel}>{row.label}</span>
      <span className={styles.orderValue}>{row.value}</span>
    </div>
  );
}

function NewsSection({ items }: { items: ClawfolioLinkedNews[] }) {
  if (items.length === 0) {
    return (
      <section className={styles.section} aria-labelledby="suggestion-news">
        <h3 id="suggestion-news" className={styles.sectionTitle}>
          News
        </h3>
        <p className={styles.emptyHint}>No linked articles for this suggestion.</p>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="suggestion-news">
      <h3 id="suggestion-news" className={styles.sectionTitle}>
        News
      </h3>
      <ul className={styles.newsList}>
        {items.map((item, index) => (
          <NewsItem key={`${item.title}-${index}`} item={item} />
        ))}
      </ul>
    </section>
  );
}

function NewsItem({ item }: { item: ClawfolioLinkedNews }) {
  const articleContext = mergedArticleContext(item);

  return (
    <li className={styles.newsItem}>
            {item.url ? (
              <a
                className={styles.newsTitle}
                href={item.url}
                target="_blank"
                rel="noreferrer"
              >
                {item.title}
              </a>
            ) : (
              <span className={styles.newsTitleStatic}>{item.title}</span>
            )}
            <div className={styles.newsMeta}>
              {item.source ? <span>{item.source}</span> : null}
              <span>{formatPublishedAt(item.publishedAt)}</span>
              {item.riskSignal ? <span>{item.riskSignal} signal</span> : null}
            </div>
            {hasSpecificText(item.summary) ? (
              <NewsContext label="Summary" value={item.summary} />
            ) : null}
            {articleContext ? (
              <NewsContext label="Suggestion support" value={articleContext} />
            ) : null}
    </li>
  );
}

function NewsContext({ label, value }: { label: string; value: string }) {
  return (
    <p className={styles.newsContext}>
      <span className={styles.newsContextLabel}>{label}:</span> {value}
    </p>
  );
}

function SourcesSection({ sources }: { sources: string[] }) {
  if (sources.length === 0) {
    return (
      <section className={styles.section} aria-labelledby="suggestion-sources">
        <h3 id="suggestion-sources" className={styles.sectionTitle}>
          Sources
        </h3>
        <p className={styles.emptyHint}>No source tags recorded.</p>
      </section>
    );
  }

  return (
    <section className={styles.section} aria-labelledby="suggestion-sources">
      <h3 id="suggestion-sources" className={styles.sectionTitle}>
        Sources
      </h3>
      <ul className={styles.sourceList}>
        {sources.map((source) => (
          <li key={source}>
            <span className={styles.sourceChip}>{source}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SuggestionDetailsPopover({
  suggestion,
  onClose,
}: SuggestionDetailsPopoverProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    panelRef.current?.focus();
  }, []);

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) onClose();
  };

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={panelRef}
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <div className={styles.headerMain}>
            <h2 id={titleId} className={styles.symbol}>
              {suggestion.symbol}
            </h2>
            <div className={styles.badges}>
              <span
                className={`${styles.badge} ${actionBadgeClass(suggestion.action)}`}
              >
                {suggestion.action}
              </span>
              <span className={`${styles.badge} ${styles.badgeConfidence}`}>
                {suggestion.confidence}% confidence
              </span>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Close suggestion details"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path
                d="M2 2l10 10M12 2 2 12"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          <OrderSection suggestion={suggestion} />

          <section className={styles.section} aria-labelledby="suggestion-rationale">
            <h3 id="suggestion-rationale" className={styles.sectionTitle}>
              Rationale
            </h3>
            <p className={styles.prose}>{suggestion.rationale}</p>
          </section>

          <section className={styles.section} aria-labelledby="suggestion-risk">
            <h3 id="suggestion-risk" className={styles.sectionTitle}>
              Risk
            </h3>
            {suggestion.riskNote ? (
              <p className={styles.prose}>{suggestion.riskNote}</p>
            ) : (
              <p className={styles.emptyHint}>No risk note provided.</p>
            )}
          </section>

          <NewsSection items={suggestion.newsContext ?? suggestion.linkedNews ?? []} />

          <section
            className={styles.section}
            aria-labelledby="suggestion-what-would-change"
          >
            <h3
              id="suggestion-what-would-change"
              className={styles.sectionTitle}
            >
              What would change
            </h3>
            {suggestion.whatWouldChange ? (
              <p className={styles.prose}>{suggestion.whatWouldChange}</p>
            ) : (
              <p className={styles.emptyHint}>No change triggers recorded.</p>
            )}
          </section>

          <SourcesSection sources={suggestion.sources ?? []} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
