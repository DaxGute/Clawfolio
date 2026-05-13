import type { BrokerAssetClass, BrokerPosition } from "../../src/types/brokerage";
import type { AlpacaPosition } from "./alpacaTypes";

function parseNum(v: string | undefined): number {
  if (v === undefined) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function mapAssetClass(assetClass: string): BrokerAssetClass {
  const a = assetClass.toLowerCase();
  if (a === "us_equity") return "us_equity";
  if (a === "crypto") return "crypto";
  return "other";
}

export function normalizeAlpacaPosition(row: AlpacaPosition): BrokerPosition {
  const qty = parseNum(row.qty);
  const marketValue = parseNum(row.market_value);
  const costBasis = parseNum(row.cost_basis);
  const avgEntryPrice = parseNum(row.avg_entry_price);
  const currentPrice = parseNum(row.current_price);
  const unrealizedPL = parseNum(row.unrealized_pl);
  const plpcRaw = parseNum(row.unrealized_plpc);
  const unrealizedPLPercent =
    costBasis !== 0
      ? (unrealizedPL / costBasis) * 100
      : plpcRaw > 1 || plpcRaw < -1
        ? plpcRaw
        : plpcRaw * 100;

  return {
    broker: "alpaca",
    symbol: row.symbol,
    qty,
    marketValue,
    costBasis,
    avgEntryPrice,
    currentPrice,
    unrealizedPL,
    unrealizedPLPercent: Number.isFinite(unrealizedPLPercent)
      ? unrealizedPLPercent
      : 0,
    assetClass: mapAssetClass(row.asset_class),
  };
}
