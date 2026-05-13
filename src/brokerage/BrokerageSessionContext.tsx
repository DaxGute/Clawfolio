import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  fetchAlpacaSnapshot,
  fetchAuthSession,
  logoutAlpacaSession,
} from "../api/brokerageClient";
import type { AuthSessionResponse } from "../types/brokerage";

type BrokerageSessionContextValue = {
  session: AuthSessionResponse | null;
  syncing: boolean;
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  refreshSession: () => Promise<void>;
  refreshAll: () => Promise<void>;
  refreshData: () => Promise<void>;
  signOut: () => Promise<void>;
};

const BrokerageSessionContext = createContext<BrokerageSessionContextValue | null>(
  null,
);

/** Calls Alpaca snapshot on the server (no local cache); used to validate token and refresh auth/session flags. */
async function pingAlpacaSnapshot(): Promise<void> {
  await fetchAlpacaSnapshot();
}

export function BrokerageSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const refreshSession = useCallback(async () => {
    const s = await fetchAuthSession();
    setSession(s);
  }, []);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshSession(), pingAlpacaSnapshot()]);
  }, [refreshSession]);

  const refreshData = useCallback(async () => {
    setSyncing(true);
    try {
      await pingAlpacaSnapshot();
      await refreshSession();
    } finally {
      setSyncing(false);
    }
  }, [refreshSession]);

  const signOut = useCallback(async () => {
    await logoutAlpacaSession();
    setMenuOpen(false);
    await refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.has("alpaca_error") || p.has("alpaca_connected")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    void refreshAll();
  }, [refreshAll]);

  const value = useMemo(
    () => ({
      session,
      syncing,
      menuOpen,
      setMenuOpen,
      refreshSession,
      refreshAll,
      refreshData,
      signOut,
    }),
    [session, syncing, menuOpen, refreshSession, refreshAll, refreshData, signOut],
  );

  return (
    <BrokerageSessionContext.Provider value={value}>
      {children}
    </BrokerageSessionContext.Provider>
  );
}

export function useBrokerageSession(): BrokerageSessionContextValue {
  const ctx = useContext(BrokerageSessionContext);
  if (!ctx) {
    throw new Error("useBrokerageSession must be used within BrokerageSessionProvider");
  }
  return ctx;
}
