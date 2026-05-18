import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

const ENV_KEYS = [
  "ALPACA_API_KEY",
  "ALPACA_SECRET_KEY",
  "ALPACA_BASE_URL",
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

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GET /api/portfolio/snapshot", () => {
  const savedEnv = snapshotEnv();
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof mock.fn>;
  let server: http.Server;
  let baseUrl = "";

  beforeEach(async () => {
    process.env.ALPACA_API_KEY = "test-key";
    process.env.ALPACA_SECRET_KEY = "test-secret";
    process.env.ALPACA_BASE_URL = "https://paper-api.alpaca.markets";

    fetchMock = mock.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (!url.includes("alpaca.markets") && !url.includes("finance.yahoo.com")) {
        return originalFetch(input, init);
      }

      if (url.includes("finance.yahoo.com")) {
        return jsonResponse({
          chart: {
            result: [
              {
                timestamp: [1714521600, 1714608000],
                indicators: { quote: [{ close: [39000, 39100] }] },
              },
            ],
          },
        });
      }

      if (url.includes("/v2/account/portfolio/history")) {
        return jsonResponse({
          timestamp: [1714521600],
          equity: [10000],
          profit_loss: [100],
          profit_loss_pct: [0.01],
        });
      }
      if (url.includes("/v2/account")) {
        return jsonResponse({
          id: "acc-env-test",
          status: "ACTIVE",
          equity: "10000",
          cash: "2500",
          portfolio_value: "10000",
          last_equity: "9900",
        });
      }
      if (url.includes("/v2/positions")) {
        return jsonResponse([]);
      }
      if (url.includes("/v2/orders")) {
        return jsonResponse([]);
      }

      return jsonResponse({ message: `unexpected url: ${url}` }, 404);
    });

    mock.method(globalThis, "fetch", fetchMock);

    const { createApp } = await import("../../app.js");
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterEach(async () => {
    restoreEnv(savedEnv);
    mock.restoreAll();
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  it("returns portfolio data without an OAuth session when env keys are set", async () => {
    const res = await fetch(`${baseUrl}/api/portfolio/snapshot?range=YTD`);
    assert.equal(res.status, 200);

    const body = (await res.json()) as {
      connection: { state: string };
      account: { id: string } | null;
      history: { points: unknown[]; periodReturns: unknown[] } | null;
      benchmark: { points: unknown[]; isProxy: boolean } | null;
    };

    assert.equal(body.connection.state, "connected");
    assert.equal(body.account?.id, "acc-env-test");
    assert.ok(Array.isArray(body.history?.points));
    assert.ok(Array.isArray(body.history?.periodReturns));
    assert.ok(Array.isArray(body.benchmark?.points));
    assert.ok(fetchMock.mock.calls.length > 0);
  });

  it("returns 401 when credentials are missing", async () => {
    for (const key of ENV_KEYS) delete process.env[key];

    const res = await fetch(`${baseUrl}/api/portfolio/snapshot?range=YTD`);
    assert.equal(res.status, 401);

    const body = (await res.json()) as {
      error: { code: string };
    };
    assert.equal(body.error.code, "ALPACA_CREDENTIALS_MISSING");
  });
});
