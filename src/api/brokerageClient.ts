import type {
  AlpacaMode,
  AlpacaSnapshotResponse,
  AuthSessionResponse,
} from "../types/brokerage";

export class BrokerageApiError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly retryAfterSec?: number;
  readonly expired?: boolean;

  constructor(params: {
    status: number;
    code?: string;
    message: string;
    retryAfterSec?: number;
    expired?: boolean;
  }) {
    super(params.message);
    this.name = "BrokerageApiError";
    this.status = params.status;
    this.code = params.code;
    this.retryAfterSec = params.retryAfterSec;
    this.expired = params.expired;
  }
}

type ErrorBody = {
  error?: { code?: string; message?: string; retryAfterSec?: number };
  expired?: boolean;
};

const withCredentials: RequestInit = { credentials: "include" };

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw: text };
  }
}

function getErrorMessage(body: unknown, fallback: string): string {
  if (typeof body === "object" && body !== null && "error" in body) {
    const msg = (body as ErrorBody).error?.message;
    if (typeof msg === "string") return msg;
  }
  return fallback;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, withCredentials);
  const body = await parseBody(res);
  if (!res.ok) {
    const eb =
      typeof body === "object" && body !== null
        ? (body as ErrorBody).error
        : undefined;
    const expired =
      typeof body === "object" &&
      body !== null &&
      "expired" in body &&
      (body as ErrorBody).expired === true;
    throw new BrokerageApiError({
      status: res.status,
      code: typeof eb?.code === "string" ? eb.code : undefined,
      message: getErrorMessage(body, `Request failed (${res.status})`),
      retryAfterSec:
        typeof eb?.retryAfterSec === "number" ? eb.retryAfterSec : undefined,
      expired,
    });
  }
  return body as T;
}

export async function fetchAuthSession(): Promise<AuthSessionResponse> {
  return getJson<AuthSessionResponse>("/api/brokerage/alpaca/auth/session");
}

export async function fetchAlpacaSnapshot(): Promise<AlpacaSnapshotResponse> {
  const res = await fetch("/api/brokerage/alpaca/snapshot", withCredentials);
  const body = await parseBody(res);
  const data = body as Partial<AlpacaSnapshotResponse> & {
    error?: AlpacaSnapshotResponse["error"];
  };

  if (!res.ok) {
    const mode: AlpacaMode = data.mode === "live" || data.mode === "paper"
      ? data.mode
      : "paper";
    return {
      mode,
      connection:
        data.connection ??
        ({
          state: "error",
          message: getErrorMessage(body, "Could not load Alpaca snapshot."),
        } as const),
      lastUpdated: data.lastUpdated ?? new Date().toISOString(),
      account: data.account ?? null,
      positions: Array.isArray(data.positions) ? data.positions : [],
      unrealizedPL: Number(data.unrealizedPL ?? 0),
      unrealizedPLPercent: Number(data.unrealizedPLPercent ?? 0),
      dayPL: data.dayPL ?? null,
      dayPLPercent: data.dayPLPercent ?? null,
      openOrdersCount: Number(data.openOrdersCount ?? 0),
      error: data.error,
    };
  }

  return body as AlpacaSnapshotResponse;
}

export async function postBrokerageSync(): Promise<{ lastSynced: string }> {
  const res = await fetch("/api/brokerage/alpaca/sync", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const body = await parseBody(res);
  if (!res.ok) {
    const eb =
      typeof body === "object" && body !== null
        ? (body as ErrorBody).error
        : undefined;
    const expired =
      typeof body === "object" &&
      body !== null &&
      (body as ErrorBody).expired === true;
    throw new BrokerageApiError({
      status: res.status,
      code: typeof eb?.code === "string" ? eb.code : undefined,
      message: getErrorMessage(body, `Sync failed (${res.status})`),
      expired,
    });
  }
  const last =
    typeof body === "object" &&
    body !== null &&
    "lastSynced" in body &&
    typeof (body as { lastSynced?: string }).lastSynced === "string"
      ? (body as { lastSynced: string }).lastSynced
      : new Date().toISOString();
  return { lastSynced: last };
}

export async function logoutAlpacaSession(): Promise<void> {
  const res = await fetch("/api/brokerage/alpaca/auth/logout", {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  const body = await parseBody(res);
  if (!res.ok) {
    const eb =
      typeof body === "object" && body !== null
        ? (body as ErrorBody).error
        : undefined;
    throw new BrokerageApiError({
      status: res.status,
      code: typeof eb?.code === "string" ? eb.code : undefined,
      message: getErrorMessage(body, `Sign out failed (${res.status})`),
    });
  }
}

export type AlpacaOrderRow = Record<string, unknown> & {
  id?: string;
  symbol?: string;
  side?: string;
  status?: string;
  type?: string;
  order_type?: string;
  created_at?: string;
};

export function fetchAlpacaOrders(
  params: Record<string, string> = {},
): Promise<{ mode: string; orders: AlpacaOrderRow[] }> {
  const q = new URLSearchParams({ status: "all", limit: "50", ...params });
  return getJson(`/api/brokerage/alpaca/orders?${q.toString()}`);
}

export type AlpacaPortfolioHistoryResponse = {
  mode: string;
  period: string;
  timeframe: string;
  history: Record<string, unknown>;
  meta?: { isEmpty?: boolean; hint?: string };
};

export function fetchAlpacaPortfolioHistory(
  params: Record<string, string> = {},
): Promise<AlpacaPortfolioHistoryResponse> {
  const q = new URLSearchParams(params);
  const qs = q.toString();
  return getJson(
    `/api/brokerage/alpaca/portfolio-history${qs ? `?${qs}` : ""}`,
  );
}

export function startAlpacaOAuthRedirect(): void {
  window.location.href = "/api/brokerage/alpaca/auth/login";
}
