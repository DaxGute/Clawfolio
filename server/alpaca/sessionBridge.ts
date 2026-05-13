import type { Request } from "express";

/** Fields stored on `express-session` for Alpaca OAuth (see `server/index.ts`). */
export type AlpacaSessionData = {
  oauthState?: string;
  alpacaAccessToken?: string;
  alpacaTradingBaseUrl?: string;
  /** ISO timestamp from last successful `POST /sync` (or OAuth callback). */
  alpacaLastSyncedAt?: string;
  /** True after Alpaca returns 401 until reconnect or full sign-out. */
  alpacaSessionExpired?: boolean;
};

export function alpacaSession(req: Request): AlpacaSessionData {
  return req.session as AlpacaSessionData;
}
