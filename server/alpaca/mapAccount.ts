import type { AlpacaAccount } from "./alpacaTypes";

function num(v: string | undefined): number {
  if (v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function mapAlpacaAccount(a: AlpacaAccount) {
  return {
    id: a.id,
    accountNumber: a.account_number,
    status: a.status,
    currency: a.currency ?? "USD",
    equity: num(a.equity),
    cash: num(a.cash),
    buyingPower: num(a.buying_power),
    portfolioValue: num(a.portfolio_value ?? a.equity),
    lastEquity: a.last_equity !== undefined ? num(a.last_equity) : undefined,
    patternDayTrader: a.pattern_day_trader,
    tradingBlocked: a.trading_blocked,
  };
}
