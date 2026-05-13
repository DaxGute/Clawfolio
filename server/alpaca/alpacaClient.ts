import type { AlpacaAuthProvider } from "./authProvider";
import { AlpacaClientError } from "./errors";

type AlpacaJsonError = { message?: string; code?: number };

function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const n = Number(header);
  if (Number.isFinite(n) && n >= 0) return n;
  return undefined;
}

function mapStatusToError(
  status: number,
  body: unknown,
  retryAfterSec?: number,
): AlpacaClientError {
  const msg =
    typeof body === "object" &&
    body !== null &&
    "message" in body &&
    typeof (body as AlpacaJsonError).message === "string"
      ? (body as AlpacaJsonError).message
      : `Alpaca request failed (${status})`;

  if (status === 401) {
    return new AlpacaClientError({
      code: "INVALID_KEY",
      status,
      message: "Alpaca rejected the API credentials.",
      alpacaMessage: msg,
    });
  }
  if (status === 403) {
    return new AlpacaClientError({
      code: "FORBIDDEN",
      status,
      message: "Alpaca denied access for this credential.",
      alpacaMessage: msg,
    });
  }
  if (status === 404) {
    return new AlpacaClientError({
      code: "NOT_FOUND",
      status,
      message: msg,
      alpacaMessage: msg,
    });
  }
  if (status === 429) {
    return new AlpacaClientError({
      code: "RATE_LIMIT",
      status,
      message: "Alpaca rate limit reached. Try again shortly.",
      alpacaMessage: msg,
      retryAfterSec,
    });
  }
  return new AlpacaClientError({
    code: "UPSTREAM",
    status,
    message: msg,
    alpacaMessage: msg,
  });
}

export class AlpacaTradingClient {
  constructor(
    private readonly baseUrl: string,
    private readonly auth: AlpacaAuthProvider,
  ) {}

  private buildUrl(path: string, query?: Record<string, string | undefined>) {
    const base = this.baseUrl.replace(/\/+$/, "");
    const p = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${base}${p}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== "") url.searchParams.set(k, v);
      }
    }
    return url.toString();
  }

  async getJson<T>(
    path: string,
    query?: Record<string, string | undefined>,
  ): Promise<T> {
    const { headers } = await this.auth.getTradingAuth();
    const url = this.buildUrl(path, query);

    let res: Response;
    try {
      res = await fetch(url, {
        method: "GET",
        headers: {
          ...headers,
          Accept: "application/json",
        },
      });
    } catch {
      throw new AlpacaClientError({
        code: "NETWORK",
        status: 0,
        message: "Could not reach Alpaca. Check your network connection.",
      });
    }

    const retryAfterSec = parseRetryAfter(res.headers.get("retry-after"));
    const text = await res.text();
    let body: unknown = undefined;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = { message: text };
      }
    }

    if (!res.ok) {
      throw mapStatusToError(res.status, body, retryAfterSec);
    }
    return body as T;
  }
}
