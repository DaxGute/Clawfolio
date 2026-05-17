/**
 * Alpaca read-only portfolio ingestion for Clawfolio.
 *
 * Purpose:
 * - Pull account summary, positions, open orders, and recent activities from Alpaca.
 * - Normalize into a stable snapshot shape for portfolio health, recommendations, dashboards, and OpenClaw.
 *
 * Environment (required, no hardcoded credentials):
 * - ALPACA_API_KEY
 * - ALPACA_SECRET_KEY
 * - ALPACA_BASE_URL (e.g. https://paper-api.alpaca.markets or https://api.alpaca.markets)
 *
 * Output (written under the repo root):
 * - data/alpaca/latest.json
 * - data/alpaca/snapshots/YYYY-MM-DD.json
 */

import type { AlpacaAccount, AlpacaOrder, AlpacaPosition } from "../../alpaca/alpacaTypes";
import { AlpacaTradingClient } from "../../alpaca/alpacaClient";
import { AlpacaApiKeyAuthProvider } from "../../alpaca/authProvider";
import { AlpacaClientError } from "../../alpaca/errors";
import type { AlpacaIngestRawActivity } from "./alpacaApiTypes";
import {
  normalizeAccount,
  normalizeActivity,
  normalizeOpenOrder,
  normalizePosition,
} from "./normalize";
import { persistAlpacaSnapshot } from "./persist";
import type { AlpacaIngestPaths, AlpacaIngestSnapshot } from "./types";

export type { AlpacaIngestSnapshot } from "./types";
export { persistAlpacaSnapshot, resolveAlpacaIngestPaths } from "./persist";

export type AlpacaIngestConfig = {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
};

export type AlpacaIngestErrorCode = "CONFIG" | "FETCH" | "PERSIST";

export class AlpacaIngestError extends Error {
  readonly code: AlpacaIngestErrorCode;
  readonly cause?: unknown;

  constructor(
    message: string,
    code: AlpacaIngestErrorCode,
    options?: { cause?: unknown },
  ) {
    super(message);
    this.name = "AlpacaIngestError";
    this.code = code;
    this.cause = options?.cause;
  }
}

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const line = meta ? `${message} ${JSON.stringify(meta)}` : message;
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(`[alpaca-ingest] ${line}`);
}

export function loadAlpacaIngestConfig(): AlpacaIngestConfig {
  const apiKey = process.env.ALPACA_API_KEY?.trim();
  const secretKey = process.env.ALPACA_SECRET_KEY?.trim();
  const baseUrl = process.env.ALPACA_BASE_URL?.trim();

  const missing: string[] = [];
  if (!apiKey) missing.push("ALPACA_API_KEY");
  if (!secretKey) missing.push("ALPACA_SECRET_KEY");
  if (!baseUrl) missing.push("ALPACA_BASE_URL");

  if (missing.length > 0) {
    throw new AlpacaIngestError(
      `Missing required environment variables: ${missing.join(", ")}`,
      "CONFIG",
    );
  }

  return { apiKey, secretKey, baseUrl };
}

function createTradingClient(config: AlpacaIngestConfig): AlpacaTradingClient {
  return new AlpacaTradingClient(
    config.baseUrl,
    new AlpacaApiKeyAuthProvider(config.apiKey, config.secretKey),
  );
}

function formatUpstreamError(err: unknown): string {
  if (err instanceof AlpacaClientError) {
    return err.alpacaMessage ? `${err.message} (${err.alpacaMessage})` : err.message;
  }
  if (err instanceof Error) return err.message;
  return "Unknown Alpaca error";
}

export async function fetchAlpacaIngestSnapshot(
  config: AlpacaIngestConfig = loadAlpacaIngestConfig(),
): Promise<AlpacaIngestSnapshot> {
  const client = createTradingClient(config);
  const asOf = new Date().toISOString();

  log("info", "Fetching Alpaca portfolio snapshot", {
    baseUrl: config.baseUrl.replace(/\/+$/, ""),
  });

  try {
    const [accountRaw, positionsRaw, ordersRaw, activitiesRaw] = await Promise.all([
      client.getJson<AlpacaAccount>("/v2/account"),
      client.getJson<AlpacaPosition[]>("/v2/positions"),
      client.getJson<AlpacaOrder[]>("/v2/orders", {
        status: "open",
        limit: "100",
        direction: "desc",
      }),
      client.getJson<AlpacaIngestRawActivity[]>("/v2/account/activities", {
        direction: "desc",
        page_size: "50",
      }),
    ]);

    const positions = Array.isArray(positionsRaw)
      ? positionsRaw.map(normalizePosition)
      : [];
    const openOrders = Array.isArray(ordersRaw)
      ? ordersRaw.map(normalizeOpenOrder)
      : [];
    const recentActivities = Array.isArray(activitiesRaw)
      ? activitiesRaw.map(normalizeActivity)
      : [];

    const snapshot: AlpacaIngestSnapshot = {
      asOf,
      source: "alpaca",
      account: normalizeAccount(accountRaw),
      positions,
      openOrders,
      recentActivities,
    };

    log("info", "Alpaca snapshot fetched", {
      positions: positions.length,
      openOrders: openOrders.length,
      recentActivities: recentActivities.length,
      equity: snapshot.account.equity,
    });

    return snapshot;
  } catch (err) {
    log("error", "Alpaca fetch failed", { error: formatUpstreamError(err) });
    throw new AlpacaIngestError(
      `Failed to fetch Alpaca snapshot: ${formatUpstreamError(err)}`,
      "FETCH",
      { cause: err },
    );
  }
}

export async function pullAndPersistAlpacaSnapshot(
  config?: AlpacaIngestConfig,
): Promise<{ snapshot: AlpacaIngestSnapshot; paths: AlpacaIngestPaths }> {
  const snapshot = await fetchAlpacaIngestSnapshot(config);

  try {
    const paths = await persistAlpacaSnapshot(snapshot);
    log("info", "Snapshot persisted", paths);
    return { snapshot, paths };
  } catch (err) {
    log("error", "Failed to persist snapshot", {
      error: err instanceof Error ? err.message : String(err),
    });
    throw new AlpacaIngestError(
      `Failed to persist Alpaca snapshot: ${err instanceof Error ? err.message : String(err)}`,
      "PERSIST",
      { cause: err },
    );
  }
}
