import type { Request } from "express";
import { AlpacaTradingClient } from "./alpacaClient";
import { AlpacaOAuthBearerAuthProvider } from "./authProvider";
import { alpacaSession } from "./sessionBridge";
import {
  inferModeFromBaseUrl,
  loadAlpacaOAuthAppConfig,
  type AlpacaMode,
} from "../config";

export function getUserTrading(req: Request) {
  const s = alpacaSession(req);
  if (!s.alpacaAccessToken || !s.alpacaTradingBaseUrl) return null;
  return {
    trading: new AlpacaTradingClient(
      s.alpacaTradingBaseUrl,
      new AlpacaOAuthBearerAuthProvider(s.alpacaAccessToken),
    ),
    mode: inferModeFromBaseUrl(s.alpacaTradingBaseUrl) as AlpacaMode,
  };
}

export function defaultModeForUi(): AlpacaMode {
  return loadAlpacaOAuthAppConfig()?.oauthEnv ?? "paper";
}

export function saveSessionPromise(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

export function markBrokerageSessionExpired(req: Request) {
  const s = alpacaSession(req);
  delete s.alpacaAccessToken;
  delete s.alpacaTradingBaseUrl;
  s.alpacaSessionExpired = true;
}
