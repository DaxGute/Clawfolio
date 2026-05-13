export type AlpacaConnectionState =
  | "not_configured"
  | "signed_out"
  | "connected"
  | "expired"
  | "error";

export type AlpacaMode = "paper" | "live";

export type BrokerageUiSessionStatus = "disconnected" | "connected" | "expired";

export type AuthSessionResponse = {
  oauthConfigured: boolean;
  signedIn: boolean;
  status: BrokerageUiSessionStatus;
  mode: AlpacaMode;
  lastSynced: string | null;
};

export type BrokerId = "alpaca";

export type BrokerAssetClass = "us_equity" | "crypto" | "other";

/** Normalized open position across brokers (Alpaca first). */
export type BrokerPosition = {
  broker: BrokerId;
  symbol: string;
  qty: number;
  marketValue: number;
  costBasis: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  assetClass: BrokerAssetClass;
};

export type AlpacaAccountSummary = {
  id: string;
  accountNumber?: string;
  status: string;
  currency: string;
  equity: number;
  cash: number;
  buyingPower: number;
  portfolioValue: number;
  lastEquity?: number;
  patternDayTrader?: boolean;
  tradingBlocked?: boolean;
};

export type AlpacaSnapshotResponse = {
  mode: AlpacaMode;
  connection: {
    state: AlpacaConnectionState;
    message?: string;
  };
  lastUpdated: string;
  account: AlpacaAccountSummary | null;
  positions: BrokerPosition[];
  unrealizedPL: number;
  unrealizedPLPercent: number;
  dayPL: number | null;
  dayPLPercent: number | null;
  openOrdersCount: number;
  error?: {
    code: string;
    message: string;
    retryAfterSec?: number;
  };
};

export type AlpacaApiErrorBody = {
  error: {
    code: string;
    message: string;
    retryAfterSec?: number;
  };
};
