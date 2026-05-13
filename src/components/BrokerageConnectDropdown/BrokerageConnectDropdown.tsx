import { useCallback, useEffect, useRef } from "react";
import { startAlpacaOAuthRedirect } from "../../api/brokerageClient";
import { useBrokerageSession } from "../../brokerage/BrokerageSessionContext";
import styles from "./BrokerageConnectDropdown.module.css";

export function BrokerageConnectDropdown() {
  const { session, syncing, menuOpen, setMenuOpen, refreshData, signOut } =
    useBrokerageSession();
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setMenuOpen(false), [setMenuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen, close]);

  const status = session?.status ?? "disconnected";
  const oauthOk = session?.oauthConfigured ?? false;

  const triggerLabel =
    status === "connected"
      ? "Alpaca Connected"
      : status === "expired"
        ? "Reconnect Alpaca"
        : "Connect Brokerage";

  const dotClass =
    status === "expired"
      ? styles.dotYellow
      : status === "connected"
        ? styles.dotGreen
        : styles.dotGray;

  const onRefreshData = async () => {
    if (!oauthOk || status !== "connected") return;
    try {
      await refreshData();
    } finally {
      close();
    }
  };

  const onDisconnect = async () => {
    try {
      await signOut();
    } finally {
      close();
    }
  };

  return (
    <div className={styles.wrap} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-busy={syncing}
        title={syncing ? "Refreshing…" : undefined}
        onClick={() => setMenuOpen(!menuOpen)}
      >
        <span className={`${styles.statusDot} ${dotClass}`} aria-hidden />
        <span className={styles.triggerLabel}>{triggerLabel}</span>
        <span className={styles.chevron} aria-hidden>
          ▾
        </span>
      </button>

      {menuOpen ? (
        <div className={styles.menu} role="menu">
          {status === "disconnected" ? (
            <button
              type="button"
              className={styles.menuItem}
              role="menuitem"
              disabled={!oauthOk}
              title={
                oauthOk
                  ? undefined
                  : "Alpaca OAuth is not configured on the server."
              }
              onClick={() => {
                if (!oauthOk) return;
                startAlpacaOAuthRedirect();
              }}
            >
              Connect Alpaca
            </button>
          ) : null}

          {status === "connected" ? (
            <>
              <button
                type="button"
                className={styles.menuItem}
                role="menuitem"
                disabled={syncing}
                onClick={() => void onRefreshData()}
              >
                Refresh Data
              </button>
              <button
                type="button"
                className={`${styles.menuItem} ${styles.danger}`}
                role="menuitem"
                disabled={syncing}
                onClick={() => void onDisconnect()}
              >
                Disconnect
              </button>
            </>
          ) : null}

          {status === "expired" ? (
            <button
              type="button"
              className={styles.menuItem}
              role="menuitem"
              disabled={!oauthOk}
              onClick={() => {
                if (!oauthOk) return;
                startAlpacaOAuthRedirect();
              }}
            >
              Reconnect
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
