import type { AlpacaAccount, AlpacaOrder, AlpacaPosition } from "../../alpaca/alpacaTypes";
import type { AlpacaIngestRawActivity } from "./alpacaApiTypes";
import { parseFiniteNumber, parseOptionalFiniteNumber } from "./numbers";
import type {
  AlpacaIngestAccount,
  AlpacaIngestActivity,
  AlpacaIngestOpenOrder,
  AlpacaIngestPosition,
} from "./types";

export function normalizeAccount(account: AlpacaAccount): AlpacaIngestAccount {
  const equity = parseFiniteNumber(account.equity);
  const portfolioValue = parseFiniteNumber(account.portfolio_value, equity);

  return {
    equity,
    cash: parseFiniteNumber(account.cash),
    buyingPower: parseFiniteNumber(account.buying_power),
    portfolioValue,
  };
}

export function normalizePosition(row: AlpacaPosition): AlpacaIngestPosition {
  const qty = parseFiniteNumber(row.qty);
  const marketValue = parseFiniteNumber(row.market_value);
  const costBasis = parseFiniteNumber(row.cost_basis);
  const unrealizedPL = parseFiniteNumber(row.unrealized_pl);
  const plpcRaw = parseFiniteNumber(row.unrealized_plpc);
  const unrealizedPLPercent =
    costBasis !== 0
      ? (unrealizedPL / costBasis) * 100
      : plpcRaw > 1 || plpcRaw < -1
        ? plpcRaw
        : plpcRaw * 100;

  return {
    symbol: row.symbol,
    qty,
    marketValue,
    costBasis,
    unrealizedPL,
    unrealizedPLPercent: Number.isFinite(unrealizedPLPercent)
      ? unrealizedPLPercent
      : 0,
  };
}

export function normalizeOpenOrder(order: AlpacaOrder): AlpacaIngestOpenOrder {
  return {
    id: order.id,
    symbol: order.symbol,
    side: order.side,
    type: order.type,
    status: order.status,
    qty: parseFiniteNumber(order.qty),
    filledQty: parseFiniteNumber(order.filled_qty),
    limitPrice: parseOptionalFiniteNumber(order.limit_price) ?? null,
    stopPrice: parseOptionalFiniteNumber(order.stop_price) ?? null,
    createdAt: order.created_at,
  };
}

export function normalizeActivity(
  row: AlpacaIngestRawActivity,
): AlpacaIngestActivity {
  const occurredAt =
    row.transaction_time ?? row.date ?? row.created_at ?? new Date(0).toISOString();

  const activity: AlpacaIngestActivity = {
    id: row.id,
    activityType: row.activity_type,
    occurredAt,
    status: row.status ?? row.order_status,
  };

  if (row.symbol) activity.symbol = row.symbol;
  if (row.side) activity.side = row.side;

  const qty = parseOptionalFiniteNumber(row.qty);
  if (qty !== undefined) activity.qty = qty;

  const price = parseOptionalFiniteNumber(row.price);
  if (price !== undefined) activity.price = price;

  const netAmount = parseOptionalFiniteNumber(row.net_amount);
  if (netAmount !== undefined) activity.netAmount = netAmount;

  return activity;
}
