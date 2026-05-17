import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchClawfolioLatest, runClawfolioDaily } from "../api/clawfolioClient";
import { isRunOlderThanDay } from "../lib/lastRun";
import type { ClawfolioDailyReport } from "../types/clawfolio";

type ClawfolioReportState = {
  report: ClawfolioDailyReport | null;
  loading: boolean;
  running: boolean;
  error: string | null;
  lastRunAt: string | null;
  hasReport: boolean;
  isToday: boolean;
  needsRunToday: boolean;
  isStaleRun: boolean;
  refresh: (force?: boolean) => Promise<void>;
};

const ClawfolioReportContext = createContext<ClawfolioReportState | null>(null);

function applyLatest(
  latest: Awaited<ReturnType<typeof fetchClawfolioLatest>>,
  setters: {
    setReport: (r: ClawfolioDailyReport | null) => void;
    setHasReport: (v: boolean) => void;
    setIsToday: (v: boolean) => void;
  },
) {
  setters.setReport(latest.report);
  setters.setHasReport(latest.hasReport);
  setters.setIsToday(latest.isToday);
}

export function ClawfolioReportProvider({ children }: { children: ReactNode }) {
  const [report, setReport] = useState<ClawfolioDailyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasReport, setHasReport] = useState(false);
  const [isToday, setIsToday] = useState(false);

  const lastRunAt = report?.generatedAt ?? null;
  const needsRunToday = hasReport ? !isToday : true;
  const isStaleRun = isRunOlderThanDay(lastRunAt);

  const loadLatest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const latest = await fetchClawfolioLatest();
      applyLatest(latest, { setReport, setHasReport, setIsToday });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Clawfolio report.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(
    async (force = false) => {
      if (!force) {
        await loadLatest();
        return;
      }

      setRunning(true);
      setError(null);
      try {
        const run = await runClawfolioDaily(true);
        setReport(run.report);
        setHasReport(true);
        setIsToday(run.isToday);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not run Clawfolio report.");
      } finally {
        setRunning(false);
      }
    },
    [loadLatest],
  );

  useEffect(() => {
    void loadLatest();
  }, [loadLatest]);

  const value = useMemo<ClawfolioReportState>(
    () => ({
      report,
      loading,
      running,
      error,
      lastRunAt,
      hasReport,
      isToday,
      needsRunToday,
      isStaleRun,
      refresh,
    }),
    [
      report,
      loading,
      running,
      error,
      lastRunAt,
      hasReport,
      isToday,
      needsRunToday,
      isStaleRun,
      refresh,
    ],
  );

  return (
    <ClawfolioReportContext.Provider value={value}>
      {children}
    </ClawfolioReportContext.Provider>
  );
}

export function useClawfolioReport(): ClawfolioReportState {
  const ctx = useContext(ClawfolioReportContext);
  if (!ctx) {
    throw new Error("useClawfolioReport must be used within ClawfolioReportProvider");
  }
  return ctx;
}
