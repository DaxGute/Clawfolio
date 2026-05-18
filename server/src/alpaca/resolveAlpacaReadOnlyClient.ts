import type { Request } from "express";
import { AlpacaTradingClient } from "../../alpaca/alpacaClient";
import { AlpacaApiKeyAuthProvider } from "../../alpaca/authProvider";
import { getUserTrading } from "../../alpaca/tradingContext";
import {
  inferModeFromBaseUrl,
  oauthAppConfigured,
  type AlpacaMode,
} from "../../config";

export type PortfolioAlpacaAuthMode = "env" | "oauth" | "missing";

export type AlpacaReadOnlyContext = {
  trading: AlpacaTradingClient;
  mode: AlpacaMode;
  authMode: "env" | "oauth";
};

export const ALPACA_CREDENTIALS_MISSING_MESSAGE =
  "Alpaca credentials missing. Set ALPACA_API_KEY and ALPACA_SECRET_KEY or sign in with Alpaca.";

export class AlpacaCredentialsError extends Error {
  readonly code = "ALPACA_CREDENTIALS_MISSING" as const;

  constructor(message = ALPACA_CREDENTIALS_MISSING_MESSAGE) {
    super(message);
    this.name = "AlpacaCredentialsError";
  }
}

function loadEnvAlpacaConfig(): {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
} | null {
  const apiKey = process.env.ALPACA_API_KEY?.trim();
  const secretKey = process.env.ALPACA_SECRET_KEY?.trim();
  const baseUrl = process.env.ALPACA_BASE_URL?.trim();
  if (!apiKey || !secretKey || !baseUrl) return null;
  return { apiKey, secretKey, baseUrl };
}

export function hasEnvAlpacaKeys(): boolean {
  return loadEnvAlpacaConfig() !== null;
}

export function portfolioAlpacaAuthModeAtStartup(): PortfolioAlpacaAuthMode {
  if (hasEnvAlpacaKeys()) return "env";
  if (oauthAppConfigured()) return "oauth";
  return "missing";
}

export function logPortfolioAlpacaAuthMode(): void {
  const mode = portfolioAlpacaAuthModeAtStartup();
  const label =
    mode === "env"
      ? "env keys"
      : mode === "oauth"
        ? "OAuth"
        : "missing";
  console.log(`[openclaw] Portfolio Alpaca auth mode: ${label}`);
}

export function resolveAlpacaReadOnlyClient(
  req: Request,
): AlpacaReadOnlyContext {
  const envConfig = loadEnvAlpacaConfig();
  if (envConfig) {
    return {
      trading: new AlpacaTradingClient(
        envConfig.baseUrl,
        new AlpacaApiKeyAuthProvider(envConfig.apiKey, envConfig.secretKey),
      ),
      mode: inferModeFromBaseUrl(envConfig.baseUrl),
      authMode: "env",
    };
  }

  const oauth = getUserTrading(req);
  if (oauth) {
    return {
      trading: oauth.trading,
      mode: oauth.mode,
      authMode: "oauth",
    };
  }

  throw new AlpacaCredentialsError();
}
