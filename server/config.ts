export type AlpacaMode = "paper" | "live";

export type AlpacaOAuthAppConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Passed to Alpaca authorize as `env` (paper vs live account). */
  oauthEnv: AlpacaMode;
};

export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function inferModeFromBaseUrl(baseUrl: string): AlpacaMode {
  const host = (() => {
    try {
      return new URL(baseUrl).hostname;
    } catch {
      return "";
    }
  })();
  return host.includes("paper-api") ? "paper" : "live";
}

export function loadAlpacaOAuthAppConfig(): AlpacaOAuthAppConfig | null {
  const clientId = process.env.ALPACA_CLIENT_ID?.trim();
  const clientSecret = process.env.ALPACA_CLIENT_SECRET?.trim();
  const redirectUri = process.env.ALPACA_OAUTH_REDIRECT_URI?.trim();
  const envRaw = process.env.ALPACA_OAUTH_ENV?.trim().toLowerCase();
  const oauthEnv: AlpacaMode = envRaw === "live" ? "live" : "paper";

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    oauthEnv,
  };
}

export function oauthAppConfigured(): boolean {
  return loadAlpacaOAuthAppConfig() !== null;
}

export function loadAppOrigin(): string {
  return (
    process.env.APP_ORIGIN?.trim() || "http://localhost:5173"
  ).replace(/\/+$/, "");
}

export function tradingBaseUrlForMode(mode: AlpacaMode): string {
  return mode === "paper"
    ? "https://paper-api.alpaca.markets"
    : "https://api.alpaca.markets";
}

export function loadAlpacaDataUrl(): string {
  return (
    process.env.ALPACA_DATA_URL?.trim() || "https://data.alpaca.markets"
  ).replace(/\/+$/, "");
}
