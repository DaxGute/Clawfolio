import { randomBytes } from "node:crypto";
import { Router } from "express";
import type { Request } from "express";
import type {
  AlpacaAccount,
  AlpacaOrder,
  AlpacaPortfolioHistory,
  AlpacaPosition,
} from "./alpacaTypes";
import { AlpacaClientError, toPublicErrorPayload } from "./errors";
import { mapAlpacaAccount } from "./mapAccount";
import { exchangeAlpacaAuthorizationCode } from "./oauthToken";
import { normalizeAlpacaPosition } from "./normalizePosition";
import { alpacaSession } from "./sessionBridge";
import {
  defaultModeForUi,
  getUserTrading,
  markBrokerageSessionExpired,
  saveSessionPromise,
} from "./tradingContext";
import {
  loadAlpacaOAuthAppConfig,
  loadAppOrigin,
  oauthAppConfigured,
  tradingBaseUrlForMode,
  type AlpacaMode,
} from "../config";

function httpStatusFromAlpacaError(err: AlpacaClientError): number {
  if (err.code === "RATE_LIMIT") return 429;
  if (err.code === "INVALID_KEY") return 401;
  if (err.code === "FORBIDDEN") return 403;
  if (err.code === "NOT_FOUND") return 404;
  if (err.code === "NETWORK") return 502;
  if (err.status >= 400 && err.status < 600) return err.status;
  return 502;
}

export const alpacaBrokerageRouter = Router();

alpacaBrokerageRouter.get("/auth/login", (req, res, next) => {
  const cfg = loadAlpacaOAuthAppConfig();
  if (!cfg) {
    return res
      .status(503)
      .type("text/plain")
      .send("Alpaca OAuth is not configured (ALPACA_CLIENT_ID / SECRET / REDIRECT_URI).");
  }

  const state = randomBytes(24).toString("hex");
  alpacaSession(req).oauthState = state;

  req.session.save((err) => {
    if (err) return next(err);
    const url = new URL("https://app.alpaca.markets/oauth/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", cfg.clientId);
    url.searchParams.set("redirect_uri", cfg.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("env", cfg.oauthEnv);
    res.redirect(302, url.toString());
  });
});

alpacaBrokerageRouter.get("/auth/callback", async (req, res) => {
  const appOrigin = loadAppOrigin();
  const redirectErr = (msg: string) => {
    res.redirect(
      302,
      `${appOrigin}/?alpaca_error=${encodeURIComponent(msg)}`,
    );
  };

  const q = req.query;
  if (typeof q.error === "string") {
    const desc =
      typeof q.error_description === "string"
        ? q.error_description
        : q.error;
    return redirectErr(desc);
  }

  const code = q.code;
  const state = q.state;
  if (typeof code !== "string" || typeof state !== "string") {
    return redirectErr("Missing authorization code.");
  }

  const sess = alpacaSession(req);
  if (!sess.oauthState || state !== sess.oauthState) {
    return redirectErr("Invalid OAuth state. Please try signing in again.");
  }

  const cfg = loadAlpacaOAuthAppConfig();
  if (!cfg) {
    return redirectErr("OAuth is not configured on this server.");
  }

  try {
    const { access_token } = await exchangeAlpacaAuthorizationCode({
      code,
      clientId: cfg.clientId,
      clientSecret: cfg.clientSecret,
      redirectUri: cfg.redirectUri,
    });

    const base = tradingBaseUrlForMode(cfg.oauthEnv);

    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        const s = alpacaSession(req);
        s.alpacaAccessToken = access_token;
        s.alpacaTradingBaseUrl = base;
        s.alpacaSessionExpired = false;
        s.alpacaLastSyncedAt = new Date().toISOString();
        req.session.save((e2) => (e2 ? reject(e2) : resolve()));
      });
    });

    res.redirect(302, `${appOrigin}/?alpaca_connected=1`);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Token exchange failed";
    redirectErr(message);
  }
});

alpacaBrokerageRouter.post("/auth/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("oc.sid", { path: "/" });
    res.json({ ok: true });
  });
});

alpacaBrokerageRouter.get("/auth/session", (req, res) => {
  const oauth = oauthAppConfigured();
  const s = alpacaSession(req);
  const ctx = getUserTrading(req);
  const lastSynced = s.alpacaLastSyncedAt ?? null;
  const mode = ctx?.mode ?? defaultModeForUi();

  let status: "disconnected" | "connected" | "expired";
  if (s.alpacaSessionExpired) {
    status = "expired";
  } else if (ctx) {
    status = "connected";
  } else {
    status = "disconnected";
  }

  res.json({
    oauthConfigured: oauth,
    signedIn: Boolean(ctx),
    status,
    mode,
    lastSynced,
  });
});

alpacaBrokerageRouter.post("/sync", async (req, res, next) => {
  if (!oauthAppConfigured()) return requireOAuthApp(res);
  const ctx = requireSignedIn(req, res);
  if (!ctx) return;
  try {
    await ctx.trading.getJson<AlpacaAccount>("/v2/account");
    const s = alpacaSession(req);
    s.alpacaLastSyncedAt = new Date().toISOString();
    s.alpacaSessionExpired = false;
    await saveSessionPromise(req);
    res.json({ ok: true, lastSynced: s.alpacaLastSyncedAt });
  } catch (e) {
    if (e instanceof AlpacaClientError && e.code === "INVALID_KEY") {
      markBrokerageSessionExpired(req);
      try {
        await saveSessionPromise(req);
      } catch (saveErr) {
        return next(saveErr);
      }
      return res.status(401).json({
        expired: true,
        error: toPublicErrorPayload(e),
      });
    }
    if (e instanceof AlpacaClientError) {
      return res.status(httpStatusFromAlpacaError(e)).json({
        error: toPublicErrorPayload(e),
      });
    }
    res.status(500).json({ error: toPublicErrorPayload(e) });
  }
});

function requireOAuthApp(res: import("express").Response) {
  return res.status(503).json({
    error: {
      code: "OAUTH_NOT_CONFIGURED",
      message:
        "Alpaca OAuth is not configured. Set ALPACA_CLIENT_ID, ALPACA_CLIENT_SECRET, and ALPACA_OAUTH_REDIRECT_URI on the server.",
    },
  });
}

function requireSignedIn(
  req: Request,
  res: import("express").Response,
): NonNullable<ReturnType<typeof getUserTrading>> | null {
  const ctx = getUserTrading(req);
  if (!ctx) {
    res.status(401).json({
      error: {
        code: "SIGNED_OUT",
        message: "Sign in with Alpaca to access this resource.",
      },
    });
    return null;
  }
  return ctx;
}

alpacaBrokerageRouter.get("/account", async (req, res) => {
  if (!oauthAppConfigured()) return requireOAuthApp(res);
  const ctx = requireSignedIn(req, res);
  if (!ctx) return;
  try {
    const account = await ctx.trading.getJson<AlpacaAccount>("/v2/account");
    res.json({ mode: ctx.mode, account: mapAlpacaAccount(account) });
  } catch (e) {
    if (e instanceof AlpacaClientError) {
      return res.status(httpStatusFromAlpacaError(e)).json({
        error: toPublicErrorPayload(e),
      });
    }
    res.status(500).json({ error: toPublicErrorPayload(e) });
  }
});

alpacaBrokerageRouter.get("/positions", async (req, res) => {
  if (!oauthAppConfigured()) return requireOAuthApp(res);
  const ctx = requireSignedIn(req, res);
  if (!ctx) return;
  try {
    const rows = await ctx.trading.getJson<AlpacaPosition[]>("/v2/positions");
    const positions = Array.isArray(rows)
      ? rows.map((r) => normalizeAlpacaPosition(r))
      : [];
    res.json({ mode: ctx.mode, positions });
  } catch (e) {
    if (e instanceof AlpacaClientError) {
      return res.status(httpStatusFromAlpacaError(e)).json({
        error: toPublicErrorPayload(e),
      });
    }
    res.status(500).json({ error: toPublicErrorPayload(e) });
  }
});

alpacaBrokerageRouter.get("/orders", async (req, res) => {
  if (!oauthAppConfigured()) return requireOAuthApp(res);
  const ctx = requireSignedIn(req, res);
  if (!ctx) return;
  const status =
    typeof req.query.status === "string" ? req.query.status : "all";
  const limit =
    typeof req.query.limit === "string" ? req.query.limit : "100";
  const direction =
    typeof req.query.direction === "string" ? req.query.direction : "desc";

  try {
    const orders = await ctx.trading.getJson<AlpacaOrder[]>("/v2/orders", {
      status,
      limit,
      direction,
    });
    res.json({ mode: ctx.mode, orders: Array.isArray(orders) ? orders : [] });
  } catch (e) {
    if (e instanceof AlpacaClientError) {
      return res.status(httpStatusFromAlpacaError(e)).json({
        error: toPublicErrorPayload(e),
      });
    }
    res.status(500).json({ error: toPublicErrorPayload(e) });
  }
});

alpacaBrokerageRouter.get("/portfolio-history", async (req, res) => {
  if (!oauthAppConfigured()) return requireOAuthApp(res);
  const ctx = requireSignedIn(req, res);
  if (!ctx) return;

  const period =
    typeof req.query.period === "string" && req.query.period
      ? req.query.period
      : "1M";
  const timeframe =
    typeof req.query.timeframe === "string" && req.query.timeframe
      ? req.query.timeframe
      : "1D";
  const end = typeof req.query.end === "string" ? req.query.end : undefined;
  const start =
    typeof req.query.start === "string" ? req.query.start : undefined;

  try {
    const history = await ctx.trading.getJson<AlpacaPortfolioHistory>(
      "/v2/account/portfolio/history",
      { period, timeframe, end, start },
    );
    const hasPoints = Boolean(
      history.timestamp?.length || history.equity?.length,
    );
    res.json({
      mode: ctx.mode,
      period,
      timeframe,
      history,
      meta: {
        isEmpty: !hasPoints,
        hint: !hasPoints
          ? "No portfolio history points were returned. This often happens outside market hours for short intraday windows, or before the account has sufficient history."
          : undefined,
      },
    });
  } catch (e) {
    if (e instanceof AlpacaClientError) {
      const payload = toPublicErrorPayload(e);
      if (e.status === 422) {
        return res.status(200).json({
          mode: ctx.mode,
          period,
          timeframe,
          history: {},
          meta: {
            isEmpty: true,
            hint: "Alpaca could not build a portfolio history series for the requested window (for example, market closed for intraday series or invalid range).",
            upstream: payload,
          },
        });
      }
      return res.status(httpStatusFromAlpacaError(e)).json({
        error: payload,
      });
    }
    res.status(500).json({ error: toPublicErrorPayload(e) });
  }
});

alpacaBrokerageRouter.get("/snapshot", async (req, res, next) => {
  const lastUpdated = new Date().toISOString();
  const mode = getUserTrading(req)?.mode ?? defaultModeForUi();

  if (!oauthAppConfigured()) {
    return res.json({
      mode,
      connection: {
        state: "not_configured",
        message:
          "Alpaca OAuth is not configured. Set ALPACA_CLIENT_ID, ALPACA_CLIENT_SECRET, and ALPACA_OAUTH_REDIRECT_URI on the server.",
      },
      lastUpdated,
      account: null,
      positions: [],
      unrealizedPL: 0,
      unrealizedPLPercent: 0,
      dayPL: null,
      dayPLPercent: null,
      openOrdersCount: 0,
    });
  }

  if (alpacaSession(req).alpacaSessionExpired) {
    return res.json({
      mode: defaultModeForUi(),
      connection: {
        state: "expired",
        message:
          "Your Alpaca session has expired. Use Reconnect Alpaca in the menu to sign in again.",
      },
      lastUpdated,
      account: null,
      positions: [],
      unrealizedPL: 0,
      unrealizedPLPercent: 0,
      dayPL: null,
      dayPLPercent: null,
      openOrdersCount: 0,
    });
  }

  const ctx = getUserTrading(req);
  if (!ctx) {
    return res.json({
      mode,
      connection: {
        state: "signed_out",
        message: "Sign in with Alpaca to load your brokerage data.",
      },
      lastUpdated,
      account: null,
      positions: [],
      unrealizedPL: 0,
      unrealizedPLPercent: 0,
      dayPL: null,
      dayPLPercent: null,
      openOrdersCount: 0,
    });
  }

  try {
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

    res.json({
      mode: ctx.mode,
      connection: { state: "connected" },
      lastUpdated,
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
    });
  } catch (e) {
    if (e instanceof AlpacaClientError && e.code === "INVALID_KEY") {
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
      error: payload,
    });
  }
});
