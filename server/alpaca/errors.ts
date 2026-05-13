export type AlpacaClientErrorCode =
  | "CONFIG_MISSING"
  | "INVALID_KEY"
  | "FORBIDDEN"
  | "RATE_LIMIT"
  | "NOT_FOUND"
  | "MARKET_DATA_UNAVAILABLE"
  | "UPSTREAM"
  | "NETWORK"
  | "UNKNOWN";

export class AlpacaClientError extends Error {
  readonly code: AlpacaClientErrorCode;
  readonly status: number;
  readonly retryAfterSec?: number;
  readonly alpacaMessage?: string;

  constructor(params: {
    code: AlpacaClientErrorCode;
    message: string;
    status: number;
    retryAfterSec?: number;
    alpacaMessage?: string;
  }) {
    super(params.message);
    this.name = "AlpacaClientError";
    this.code = params.code;
    this.status = params.status;
    this.retryAfterSec = params.retryAfterSec;
    this.alpacaMessage = params.alpacaMessage;
  }
}

export function toPublicErrorPayload(err: unknown): {
  code: AlpacaClientErrorCode;
  message: string;
  retryAfterSec?: number;
} {
  if (err instanceof AlpacaClientError) {
    return {
      code: err.code,
      message: err.message,
      ...(err.retryAfterSec !== undefined
        ? { retryAfterSec: err.retryAfterSec }
        : {}),
    };
  }
  if (err instanceof Error) {
    return { code: "UNKNOWN", message: err.message };
  }
  return { code: "UNKNOWN", message: "Unexpected error" };
}
