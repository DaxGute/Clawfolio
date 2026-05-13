/** Minimal Alpaca Trading API shapes used by OpenClaw (extend as needed). */

export type AlpacaAccount = {
  id: string;
  account_number?: string;
  status: string;
  currency?: string;
  equity?: string;
  cash?: string;
  buying_power?: string;
  portfolio_value?: string;
  last_equity?: string;
  pattern_day_trader?: boolean;
  trading_blocked?: boolean;
};

export type AlpacaPosition = {
  asset_class: string;
  symbol: string;
  exchange?: string;
  qty: string;
  avg_entry_price: string;
  market_value?: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc?: string;
  unrealized_intraday_pl?: string;
  unrealized_intraday_plpc?: string;
  current_price: string;
  lastday_price?: string;
  side?: string;
};

export type AlpacaOrder = {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at?: string | null;
  expired_at?: string | null;
  canceled_at?: string | null;
  failed_at?: string | null;
  replaced_at?: string | null;
  replaced_by?: string | null;
  replaces?: string | null;
  asset_id: string;
  symbol: string;
  asset_class: string;
  notional?: string | null;
  qty?: string | null;
  filled_qty: string;
  filled_avg_price?: string | null;
  order_class: string;
  order_type: string;
  type: string;
  side: string;
  time_in_force: string;
  limit_price?: string | null;
  stop_price?: string | null;
  status: string;
  extended_hours: boolean;
  legs?: unknown;
  trail_percent?: string | null;
  trail_price?: string | null;
  hwm?: string | null;
};

export type AlpacaPortfolioHistory = {
  timestamp?: number[];
  equity?: number[];
  profit_loss?: number[];
  profit_loss_pct?: number[];
  base_value?: number;
  timeframe?: string;
};
