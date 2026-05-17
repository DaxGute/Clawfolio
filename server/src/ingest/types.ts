/** Normalized Alpaca portfolio snapshot for local persistence and downstream models. */

export type AlpacaIngestAccount = {
  equity: number;
  cash: number;
  buyingPower: number;
  portfolioValue: number;
};

export type AlpacaIngestPosition = {
  symbol: string;
  qty: number;
  marketValue: number;
  costBasis: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
};

export type AlpacaIngestOpenOrder = {
  id: string;
  symbol: string;
  side: string;
  type: string;
  status: string;
  qty: number;
  filledQty: number;
  limitPrice: number | null;
  stopPrice: number | null;
  createdAt: string;
};

export type AlpacaIngestActivity = {
  id: string;
  activityType: string;
  occurredAt: string;
  symbol?: string;
  side?: string;
  qty?: number;
  price?: number;
  netAmount?: number;
  status?: string;
};

export type AlpacaIngestSnapshot = {
  asOf: string;
  source: "alpaca";
  account: AlpacaIngestAccount;
  positions: AlpacaIngestPosition[];
  openOrders: AlpacaIngestOpenOrder[];
  recentActivities: AlpacaIngestActivity[];
};

export type AlpacaIngestPaths = {
  latestPath: string;
  dailySnapshotPath: string;
};
