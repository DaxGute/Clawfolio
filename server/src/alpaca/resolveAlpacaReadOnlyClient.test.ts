import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { Request } from "express";
import {
  AlpacaCredentialsError,
  hasEnvAlpacaKeys,
  portfolioAlpacaAuthModeAtStartup,
  resolveAlpacaReadOnlyClient,
} from "./resolveAlpacaReadOnlyClient";

const ENV_KEYS = [
  "ALPACA_API_KEY",
  "ALPACA_SECRET_KEY",
  "ALPACA_BASE_URL",
  "ALPACA_CLIENT_ID",
  "ALPACA_CLIENT_SECRET",
  "ALPACA_OAUTH_REDIRECT_URI",
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    out[key] = process.env[key];
  }
  return out;
}

function restoreEnv(saved: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

describe("resolveAlpacaReadOnlyClient", () => {
  const saved = snapshotEnv();

  afterEach(() => {
    restoreEnv(saved);
  });

  it("prefers env API keys over OAuth session", () => {
    process.env.ALPACA_API_KEY = "env-key";
    process.env.ALPACA_SECRET_KEY = "env-secret";
    process.env.ALPACA_BASE_URL = "https://paper-api.alpaca.markets";

    const req = {
      session: {
        alpacaAccessToken: "oauth-token",
        alpacaTradingBaseUrl: "https://paper-api.alpaca.markets",
      },
    } as Request;

    const ctx = resolveAlpacaReadOnlyClient(req);
    assert.equal(ctx.authMode, "env");
    assert.equal(ctx.mode, "paper");
  });

  it("throws when neither env keys nor OAuth session exist", () => {
    for (const key of ENV_KEYS) delete process.env[key];

    assert.throws(
      () => resolveAlpacaReadOnlyClient({ session: {} } as Request),
      AlpacaCredentialsError,
    );
  });

  it("reports env auth mode at startup when keys are set", () => {
    process.env.ALPACA_API_KEY = "env-key";
    process.env.ALPACA_SECRET_KEY = "env-secret";
    process.env.ALPACA_BASE_URL = "https://paper-api.alpaca.markets";

    assert.equal(hasEnvAlpacaKeys(), true);
    assert.equal(portfolioAlpacaAuthModeAtStartup(), "env");
  });
});
