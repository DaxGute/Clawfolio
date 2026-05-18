import { Router } from "express";
import type { Request, Response } from "express";
import type {
  AlpacaAccount,
  AlpacaOrder,
  AlpacaPosition,
} from "../../alpaca/alpacaTypes";
import { AlpacaClientError, toPublicErrorPayload } from "../../alpaca/errors";
import { mapAlpacaAccount } from "../../alpaca/mapAccount";
import { normalizeAlpacaPosition } from "../../alpaca/normalizePosition";
import {
  markBrokerageSessionExpired,
  saveSessionPromise,
} from "../../alpaca/tradingContext";
import {
  AlpacaCredentialsError,
  resolveAlpacaReadOnlyClient,
  type AlpacaReadOnlyContext,
} from "../alpaca/resolveAlpacaReadOnlyClient";
import { inferModeFromBaseUrl } from "../../config";
import { parseBenchmarkKey } from "./benchmarkProvider";
import {
  getBackfillStatus,
  isBackfillRunning,
  startPortfolioBackfill,
} from "./backfillJob";
import {
  buildDataFreshness,
  fetchAndPersistWindows,
  finalizeCoverageStatus,
  loadStoredHistory,
  shouldSyncFetchOnSnapshot,
} from "./historyService";
import { parsePortfolioRange } from "./range";
import {
  buildBenchmarkPayload,
  buildPortfolioHistoryPayload,
} from "./snapshotPayload";
import type { BenchmarkKey, PortfolioRange } from "./types";

const DEFAULT_BENCHMARK: BenchmarkKey = "DOW";

function httpStatusFromAlpacaError(err: AlpacaClientError): number {
  if (err.code === "RATE_LIMIT") return 429;
  if (err.code === "INVALID_KEY") return 401;
  if (err.code === "FORBIDDEN") return 403;
  if (err.code === "NOT_FOUND") return 404;
  if (err.code === "NETWORK") return 502;
  if (err.status >= 400 && err.status < 600) return err.status;
  return 502;
}

function defaultModeFromEnv(): "paper" | "live" {
  const baseUrl = process.env.ALPACA_BASE_URL?.trim();
  if (baseUrl) return inferModeFromBaseUrl(baseUrl);
  return "paper";
}

function parseBenchmarkFromQuery(raw: string | undefined): BenchmarkKey {
  return parseBenchmarkKey(raw) ?? DEFAULT_BENCHMARK;
}

function credentialsErrorBody(range: PortfolioRange, benchmark: BenchmarkKey) {
  return {
    error: {
      code: "ALPACA_CREDENTIALS_MISSING",
      message:
        "Alpaca credentials missing. Set ALPACA_API_KEY and ALPACA_SECRET_KEY or sign in with Alpaca.",
    },
    mode: defaultModeFromEnv(),
    connection: {
      state: "error" as const,
      message:
        "Alpaca credentials missing. Set ALPACA_API_KEY and ALPACA_SECRET_KEY or sign in with Alpaca.",
    },
    lastUpdated: new Date().toISOString(),
    account: null,
    positions: [],
    unrealizedPL: 0,
    unrealizedPLPercent: 0,
    dayPL: null,
    dayPLPercent: null,
    openOrdersCount: 0,
    history: { range, totalReturnPct: 0, points: [], periodReturns: [] },
    benchmark: null,
    dataFreshness: null,
    benchmarkKey: benchmark,
  };
}

function resolveClientOrRespond(
  req: Request,
  res: Response,
  range: PortfolioRange,
  benchmark: BenchmarkKey,
): AlpacaReadOnlyContext | null {
  try {
    return resolveAlpacaReadOnlyClient(req);
  } catch (e) {
    if (e instanceof AlpacaCredentialsError) {
      res.status(401).json(credentialsErrorBody(range, benchmark));
      return null;
    }
    throw e;
  }
}

async function buildLiveSnapshot(ctx: AlpacaReadOnlyContext) {
  const [accountRaw, positionsRaw, openOrders] = await Promise.all([
    ctx.trading.getJson<AlpacaAccount>("/v2/account"),
    ctx.trading.getJson<AlpacaPosition[]>("/v2/positions"),
    ctx.trading.getJson<AlpacaOrder[]>("/v2/orders", {
      status: "open",
      limit: "500",
      direction: "desc",
    }),
  ]);

  const account = mapAlpacaAccount(accountRaw);
  const positions = Array.isArray(positionsRaw)
    ? positionsRaw.map((r) => normalizeAlpacaPosition(r))
    : [];

  const unrealizedPL = positions.reduce((s, p) => s + p.unrealizedPL, 0);
  const cost = positions.reduce((s, p) => s + p.costBasis, 0);
  const unrealizedPLPercent = cost !== 0 ? (unrealizedPL / cost) * 100 : 0;

  const dayPL =
    account.lastEquity !== undefined
      ? account.equity - account.lastEquity
      : undefined;
  const dayPLPercent =
    account.lastEquity !== undefined &&
    account.lastEquity !== 0 &&
    dayPL !== undefined
      ? (dayPL / account.lastEquity) * 100
      : undefined;

  return {
    mode: ctx.mode,
    connection: { state: "connected" as const },
    lastUpdated: new Date().toISOString(),
    account,
    positions,
    unrealizedPL,
    unrealizedPLPercent,
    dayPL: dayPL !== undefined && Number.isFinite(dayPL) ? dayPL : null,
    dayPLPercent:
      dayPLPercent !== undefined && Number.isFinite(dayPLPercent)
        ? dayPLPercent
        : null,
    openOrdersCount: Array.isArray(openOrders) ? openOrders.length : 0,
  };
}

async function attachHistory(
  ctx: AlpacaReadOnlyContext,
  range: PortfolioRange,
  benchmark: BenchmarkKey,
  live: Awaited<ReturnType<typeof buildLiveSnapshot>>,
) {
  const accountId = live.account?.id;
  const emptyHistory = {
    range,
    totalReturnPct: 0,
    points: [],
    periodReturns: [],
  };

  if (!accountId) {
    return {
      ...live,
      history: emptyHistory,
      benchmark: null,
      benchmarkKey: benchmark,
      dataFreshness: null,
    };
  }

  let { requested, points, coverage, lastUpdatedAt } = await loadStoredHistory(
    accountId,
    range,
  );

  if (
    coverage.fetchableWindows.length > 0 &&
    shouldSyncFetchOnSnapshot(coverage.fetchableWindows)
  ) {
    try {
      await fetchAndPersistWindows(
        ctx.trading,
        accountId,
        coverage.fetchableWindows,
      );
      const refreshed = await loadStoredHistory(accountId, range);
      requested = refreshed.requested;
      points = refreshed.points;
      coverage = refreshed.coverage;
      lastUpdatedAt = refreshed.lastUpdatedAt;
    } catch {
      /* keep partial data */
    }
  } else if (coverage.fetchableWindows.length > 0 && !isBackfillRunning()) {
    void startPortfolioBackfill({
      trading: ctx.trading,
      accountId,
      range,
    });
  }

  const freshnessStatus = finalizeCoverageStatus(
    coverage,
    isBackfillRunning(),
  );

  const history = buildPortfolioHistoryPayload(points, range);
  const benchmarkPayload = await buildBenchmarkPayload(
    benchmark,
    coverage.requested.start,
    coverage.requested.end,
    range,
  );

  return {
    ...live,
    history,
    benchmark: benchmarkPayload,
    benchmarkKey: benchmark,
    dataFreshness: buildDataFreshness(
      coverage.requested,
      points,
      coverage.fetchableWindows,
      coverage.unfillableWindows,
      freshnessStatus,
      coverage.coveragePct,
      lastUpdatedAt,
    ),
  };
}

export const portfolioRouter = Router();

portfolioRouter.get("/snapshot", async (req, res, next) => {
  const range = parsePortfolioRange(
    typeof req.query.range === "string" ? req.query.range : "YTD",
  );
  const benchmark = parseBenchmarkFromQuery(
    typeof req.query.benchmark === "string" ? req.query.benchmark : undefined,
  );

  if (!range) {
    return res.status(400).json({
      error: {
        code: "INVALID_RANGE",
        message: "range must be one of YTD, 3m, 6m, 1y, 2y, 3y",
      },
    });
  }

  const ctx = resolveClientOrRespond(req, res, range, benchmark);
  if (!ctx) return;

  const lastUpdated = new Date().toISOString();

  try {
    const live = await buildLiveSnapshot(ctx);
    const body = await attachHistory(ctx, range, benchmark, live);
    res.json(body);
  } catch (e) {
    if (
      e instanceof AlpacaClientError &&
      e.code === "INVALID_KEY" &&
      ctx.authMode === "oauth"
    ) {
      markBrokerageSessionExpired(req);
      try {
        await saveSessionPromise(req);
      } catch (saveErr) {
        return next(saveErr);
      }
      const payload = toPublicErrorPayload(e);
      return res.json({
        mode: ctx.mode,
        connection: {
          state: "expired",
          message:
            "Your Alpaca session has expired. Reconnect Alpaca to continue.",
        },
        lastUpdated,
        account: null,
        positions: [],
        unrealizedPL: 0,
        unrealizedPLPercent: 0,
        dayPL: null,
        dayPLPercent: null,
        openOrdersCount: 0,
        history: { range, totalReturnPct: 0, points: [], periodReturns: [] },
        benchmark: null,
        benchmarkKey: benchmark,
        dataFreshness: null,
        error: payload,
      });
    }

    const payload = toPublicErrorPayload(e);
    const status =
      e instanceof AlpacaClientError ? httpStatusFromAlpacaError(e) : 502;
    res.status(status).json({
      mode: ctx.mode,
      connection: {
        state: "error",
        message: payload.message,
      },
      lastUpdated,
      account: null,
      positions: [],
      unrealizedPL: 0,
      unrealizedPLPercent: 0,
      dayPL: null,
      dayPLPercent: null,
      openOrdersCount: 0,
      history: { range, totalReturnPct: 0, points: [], periodReturns: [] },
      benchmark: null,
      benchmarkKey: benchmark,
      dataFreshness: {
        status: "error",
        requestedStart: "",
        requestedEnd: "",
        storedStart: null,
        storedEnd: null,
        missingWindows: [],
        unfillableWindows: [],
        coveragePct: 0,
        lastUpdatedAt: null,
      },
      error: payload,
    });
  }
});

portfolioRouter.post("/backfill", async (req, res) => {
  const range = parsePortfolioRange(
    typeof req.body?.range === "string"
      ? req.body.range
      : typeof req.query.range === "string"
        ? req.query.range
        : "3y",
  );
  if (!range) {
    return res.status(400).json({
      error: {
        code: "INVALID_RANGE",
        message: "range must be one of YTD, 3m, 6m, 1y, 2y, 3y",
      },
    });
  }

  const benchmark = parseBenchmarkFromQuery(
    typeof req.body?.benchmark === "string"
      ? req.body.benchmark
      : typeof req.query.benchmark === "string"
        ? req.query.benchmark
        : undefined,
  );

  const ctx = resolveClientOrRespond(req, res, range, benchmark);
  if (!ctx) return;

  try {
    const account = await ctx.trading.getJson<AlpacaAccount>("/v2/account");
    const status = await startPortfolioBackfill({
      trading: ctx.trading,
      accountId: account.id,
      range,
    });
    res.status(202).json(status);
  } catch (e) {
    const payload = toPublicErrorPayload(e);
    res.status(502).json({ error: payload });
  }
});

portfolioRouter.get("/backfill/status", (_req, res) => {
  res.json(getBackfillStatus());
});
