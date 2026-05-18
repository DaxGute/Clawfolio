import type { AlpacaTradingClient } from "../../alpaca/alpacaClient";
import {
  chunkWindows,
  fetchAndPersistWindows,
  finalizeCoverageStatus,
  loadStoredHistory,
} from "./historyService";
import type { DateWindow, PortfolioRange } from "./types";

export type BackfillJobStatus = "idle" | "running" | "complete" | "error";

export type BackfillStatus = {
  isRunning: boolean;
  status: BackfillJobStatus;
  requestedRange: PortfolioRange | null;
  completedWindows: number;
  pendingWindows: DateWindow[];
  unfillableWindows: DateWindow[];
  coveragePct: number;
  currentWindow: DateWindow | null;
  error: string | null;
};

const idleStatus: BackfillStatus = {
  isRunning: false,
  status: "idle",
  requestedRange: null,
  completedWindows: 0,
  pendingWindows: [],
  unfillableWindows: [],
  coveragePct: 0,
  currentWindow: null,
  error: null,
};

let state: BackfillStatus = { ...idleStatus };
let runToken = 0;

export function getBackfillStatus(): BackfillStatus {
  return { ...state };
}

export function isBackfillRunning(): boolean {
  return state.isRunning;
}

function completeState(
  range: PortfolioRange,
  coveragePct: number,
  unfillableWindows: DateWindow[],
  completedWindows: number,
): BackfillStatus {
  return {
    isRunning: false,
    status: "complete",
    requestedRange: range,
    completedWindows,
    pendingWindows: [],
    unfillableWindows,
    coveragePct,
    currentWindow: null,
    error: null,
  };
}

export async function startPortfolioBackfill(params: {
  trading: AlpacaTradingClient;
  accountId: string;
  range: PortfolioRange;
}): Promise<BackfillStatus> {
  if (state.isRunning) {
    return getBackfillStatus();
  }

  const { coverage, points } = await loadStoredHistory(
    params.accountId,
    params.range,
  );

  if (coverage.isComplete || coverage.fetchableWindows.length === 0) {
    state = completeState(
      params.range,
      100,
      coverage.unfillableWindows,
      0,
    );
    return getBackfillStatus();
  }

  const windows = chunkWindows(coverage.fetchableWindows);

  const token = ++runToken;
  state = {
    isRunning: true,
    status: "running",
    requestedRange: params.range,
    completedWindows: 0,
    pendingWindows: windows,
    unfillableWindows: coverage.unfillableWindows,
    coveragePct: coverage.coveragePct,
    currentWindow: windows[0] ?? null,
    error: null,
  };

  void runBackfill(
    token,
    params.trading,
    params.accountId,
    params.range,
    windows,
  );

  return getBackfillStatus();
}

async function runBackfill(
  token: number,
  trading: AlpacaTradingClient,
  accountId: string,
  range: PortfolioRange,
  windows: DateWindow[],
) {
  try {
    let completed = 0;

    for (let i = 0; i < windows.length; i += 1) {
      if (token !== runToken) return;

      const window = windows[i];
      state = {
        ...state,
        currentWindow: window,
        pendingWindows: windows.slice(i),
      };

      await fetchAndPersistWindows(trading, accountId, [window]);
      completed += 1;

      const refreshed = await loadStoredHistory(accountId, range);
      const jobStatus = finalizeCoverageStatus(
        refreshed.coverage,
        false,
      );

      if (refreshed.coverage.isComplete || refreshed.coverage.fetchableWindows.length === 0) {
        state = completeState(
          range,
          100,
          refreshed.coverage.unfillableWindows,
          completed,
        );
        return;
      }

      state = {
        ...state,
        completedWindows: completed,
        pendingWindows: chunkWindows(refreshed.coverage.fetchableWindows),
        unfillableWindows: refreshed.coverage.unfillableWindows,
        coveragePct: refreshed.coverage.coveragePct,
        currentWindow: refreshed.coverage.fetchableWindows[0]
          ? {
              start: refreshed.coverage.fetchableWindows[0].start,
              end: refreshed.coverage.fetchableWindows[0].end,
            }
          : null,
        status: jobStatus === "loading" ? "running" : "running",
      };
    }

    const finalLoad = await loadStoredHistory(accountId, range);
    state = completeState(
      range,
      finalLoad.coverage.isComplete ? 100 : finalLoad.coverage.coveragePct,
      finalLoad.coverage.unfillableWindows,
      completed,
    );
    if (!finalLoad.coverage.isComplete && finalLoad.coverage.fetchableWindows.length === 0) {
      state.coveragePct = 100;
      state.status = "complete";
    }
  } catch (err) {
    if (token !== runToken) return;
    state = {
      ...state,
      isRunning: false,
      status: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export function resetBackfillState() {
  runToken += 1;
  state = { ...idleStatus };
}
