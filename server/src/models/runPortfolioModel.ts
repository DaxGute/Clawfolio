import path from "node:path";
import type { AlpacaIngestSnapshot } from "../ingest/types";
import { pacificDateKey } from "../lib/pacificDate";
import { CLAWFOLIO_REPORT_PROMPT } from "../reports/prompt";
import type {
  ClawfolioDailyReport,
  ClawfolioInvestorProfile,
  ClawfolioPortfolioHealth,
  ClawfolioPositionReport,
  ClawfolioTradeAction,
  ClawfolioSuggestion,
} from "../reports/types";
import { DEFAULT_INVESTOR_PROFILE } from "../investorProfile/profile";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function profileLabel(profile: ClawfolioInvestorProfile): string {
  return [
    profile.timeHorizon,
    profile.riskAppetite,
    profile.tradingFrequency,
    profile.philosophy,
  ].join(" / ");
}

function riskBuyThreshold(profile: ClawfolioInvestorProfile): number {
  const base = {
    Conservative: 13,
    Balanced: 9,
    Aggressive: 6,
    Speculative: 3,
  }[profile.riskAppetite];
  const horizonAdj = {
    "Short-Term": 2,
    "Medium-Term": 0,
    "Long-Term": -1,
    Generational: -2,
  }[profile.timeHorizon];
  return base + horizonAdj;
}

function sellLossThreshold(profile: ClawfolioInvestorProfile): number {
  return {
    Conservative: -12,
    Balanced: -20,
    Aggressive: -30,
    Speculative: -42,
  }[profile.riskAppetite];
}

function concentrationSellThreshold(profile: ClawfolioInvestorProfile): number {
  const base = {
    Conservative: 14,
    Balanced: 22,
    Aggressive: 30,
    Speculative: 40,
  }[profile.riskAppetite];
  const horizonAdj = profile.timeHorizon === "Short-Term" ? -3 : 0;
  return base + horizonAdj;
}

function buyBudgetShare(profile: ClawfolioInvestorProfile): number {
  const byRisk = {
    Conservative: 0.03,
    Balanced: 0.05,
    Aggressive: 0.08,
    Speculative: 0.12,
  }[profile.riskAppetite];
  const frequencyCap = {
    "Day Trader": 0.04,
    "Swing Trader": 0.06,
    "Position Trader": 0.08,
    "Long-Term Holder": 0.1,
  }[profile.tradingFrequency];
  return Math.min(byRisk, frequencyCap);
}

function healthLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Fair";
  if (score >= 30) return "Weak";
  return "Poor";
}

function scoreFromUnrealizedPct(pct: number): number {
  let score = 72;
  if (pct > 0) score += Math.min(22, pct * 0.9);
  else score += Math.max(-35, pct * 1.1);
  return clamp(Math.round(score), 0, 100);
}

function recommendPosition(
  unrealizedPLPercent: number,
  allocationPercent: number,
  profile: ClawfolioInvestorProfile,
): ClawfolioTradeAction | null {
  if (unrealizedPLPercent <= sellLossThreshold(profile)) return "SELL";
  if (
    unrealizedPLPercent >= 18 &&
    allocationPercent >= concentrationSellThreshold(profile)
  ) return "SELL";
  if (
    unrealizedPLPercent >= riskBuyThreshold(profile) &&
    allocationPercent <= concentrationSellThreshold(profile) * 0.45
  ) return "BUY";
  return null;
}

function confidenceForPosition(
  pos: {
    qty: number;
    marketValue: number;
    allocationPercent: number;
  },
  recommendation: ClawfolioTradeAction | null,
): number {
  let confidence = 58;
  if (pos.qty > 0 && pos.marketValue > 0) confidence += 18;
  if (pos.allocationPercent >= 3) confidence += 8;
  if (recommendation) confidence += 12;
  else confidence = Math.max(45, confidence - 10);
  return clamp(Math.round(confidence), 0, 100);
}

function buildDrivers(
  unrealizedPLPercent: number,
  allocationPercent: number,
  profile: ClawfolioInvestorProfile,
): { positive: string[]; negative: string[] } {
  const positive: string[] = [];
  const negative: string[] = [];

  if (unrealizedPLPercent > 5) {
    positive.push(`Unrealized gain of ${round1(unrealizedPLPercent)}%`);
  } else if (unrealizedPLPercent < -5) {
    negative.push(`Unrealized loss of ${round1(Math.abs(unrealizedPLPercent))}%`);
  } else {
    positive.push("Near breakeven on cost basis");
  }

  if (allocationPercent >= 25) {
    negative.push(`High concentration at ${round1(allocationPercent)}% of portfolio`);
  } else if (allocationPercent >= 12) {
    positive.push(`Meaningful allocation at ${round1(allocationPercent)}%`);
  } else if (allocationPercent > 0 && allocationPercent < 5) {
    positive.push("Small position size limits single-name risk");
  }

  if (unrealizedPLPercent >= 15 && allocationPercent >= 18) {
    negative.push("Large winner — consider trimming concentration");
  }

  positive.push(`Evaluated against ${profileLabel(profile)} profile`);

  return { positive, negative };
}

function portfolioHealthFromPositions(
  positions: ClawfolioPositionReport[],
  equity: number,
  cash: number,
): ClawfolioPortfolioHealth {
  if (positions.length === 0) {
    const cashHeavy = equity > 0 && cash / equity >= 0.9;
    return {
      score: cashHeavy ? 62 : 50,
      label: cashHeavy ? "Fair" : "Fair",
      summary: cashHeavy
        ? "Portfolio is mostly fiat; cash remains an allocation decision under the active investor profile."
        : "No equity positions in the latest snapshot.",
    };
  }

  const totalMv = positions.reduce((s, p) => s + p.marketValue, 0);
  const weighted =
    totalMv > 0
      ? positions.reduce((s, p) => s + p.healthScore * p.marketValue, 0) / totalMv
      : positions.reduce((s, p) => s + p.healthScore, 0) / positions.length;

  const score = clamp(Math.round(weighted), 0, 100);
  const losers = positions.filter((p) => p.unrealizedPL < 0).length;
  const winners = positions.filter((p) => p.unrealizedPL > 0).length;

  let summary = `${positions.length} position${positions.length === 1 ? "" : "s"} tracked; `;
  summary += `${winners} gaining, ${losers} losing.`;

  return {
    score,
    label: healthLabel(score),
    summary,
  };
}

function estimatedSharePrice(pos: ClawfolioPositionReport): number {
  if (pos.qty <= 0) return 0;
  return pos.marketValue / pos.qty;
}

function buildSuggestion(
  pos: ClawfolioPositionReport,
  accountCash: number,
  accountEquity: number,
  profile: ClawfolioInvestorProfile,
): ClawfolioSuggestion | null {
  if (!pos.recommendation) return null;

  const price = estimatedSharePrice(pos);
  if (price <= 0) return null;

  const limitPrice =
    pos.recommendation === "BUY"
      ? round2(price * 1.005)
      : round2(price * 0.995);

  const buyBudget = Math.max(
    0,
    Math.min(accountCash * 0.25, accountEquity * buyBudgetShare(profile)),
  );
  const quantity =
    pos.recommendation === "BUY"
      ? Math.floor(buyBudget / limitPrice)
      : pos.qty;

  if (quantity <= 0) return null;

  const drivers = [
    ...pos.positiveDrivers.slice(0, 2),
    ...pos.negativeDrivers.slice(0, 2),
  ];
  const rationale =
    drivers.length > 0
      ? drivers.join(" ")
      : `Model suggests ${pos.recommendation} based on P/L and allocation.`;

  const risks: string[] = [];
  if (pos.recommendation === "BUY") {
    risks.push("Adds concentration if position already large");
  }
  if (pos.recommendation === "SELL") {
    risks.push("May realize taxable gains or lock in losses");
  }
  if (pos.allocationPercent >= 20) {
    risks.push("Position is a large share of portfolio");
  }

  return {
    symbol: pos.symbol,
    action: pos.recommendation,
    order: {
      action: pos.recommendation,
      symbol: pos.symbol,
      orderType: "limit",
      limitPrice,
      quantity,
      estimatedNotional: round2(limitPrice * quantity),
      timeInForce: "day",
    },
    confidence: pos.confidence,
    rationale,
    riskNote: risks.length > 0 ? risks.join(" ") : "No position-specific risk note generated.",
    linkedNews: [],
    whatWouldChange:
      `A material company, sector, macro, earnings, valuation, or investor profile update could change this ${profileLabel(profile)} suggestion.`,
    sources: [...pos.sources, "clawfolio:standard-order-model", "clawfolio:investor-profile"],
  };
}

export type RunPortfolioModelOptions = {
  dateKey?: string;
  sourceSnapshotPath?: string;
  investorProfile?: ClawfolioInvestorProfile;
};

export function runPortfolioModel(
  snapshot: AlpacaIngestSnapshot,
  options: RunPortfolioModelOptions = {},
): ClawfolioDailyReport {
  const dateKey = options.dateKey ?? pacificDateKey();
  const sourceSnapshot =
    options.sourceSnapshotPath ??
    path.join("data", "alpaca", "snapshots", `${dateKey}.json`);
  const investorProfile = options.investorProfile ?? DEFAULT_INVESTOR_PROFILE;

  const totalInvested = snapshot.positions.reduce(
    (s, p) => s + p.marketValue,
    0,
  );
  const portfolioValue = snapshot.account.portfolioValue || totalInvested;
  const warnings: string[] = [];

  if (snapshot.positions.length === 0) {
    warnings.push("No open equity positions in Alpaca snapshot.");
  }
  if (snapshot.openOrders.length > 0) {
    warnings.push(
      `${snapshot.openOrders.length} open order(s) may change exposure after fills.`,
    );
  }

  const positions: ClawfolioPositionReport[] = snapshot.positions.map((p) => {
    const allocationPercent =
      portfolioValue > 0 ? (p.marketValue / portfolioValue) * 100 : 0;
    const healthScore = scoreFromUnrealizedPct(p.unrealizedPLPercent);
    const recommendation = recommendPosition(
      p.unrealizedPLPercent,
      allocationPercent,
      investorProfile,
    );
    const { positive, negative } = buildDrivers(
      p.unrealizedPLPercent,
      allocationPercent,
      investorProfile,
    );

    return {
      symbol: p.symbol,
      qty: p.qty,
      marketValue: p.marketValue,
      allocationPercent: round1(allocationPercent),
      unrealizedPL: p.unrealizedPL,
      unrealizedPLPercent: round1(p.unrealizedPLPercent),
      healthScore,
      healthLabel: healthLabel(healthScore),
      recommendation,
      confidence: confidenceForPosition(
        { qty: p.qty, marketValue: p.marketValue, allocationPercent },
        recommendation,
      ),
      positiveDrivers: positive,
      negativeDrivers: negative,
      sources: snapshot.source ? [`alpaca:${snapshot.source}`] : [],
    };
  });

  const maxAlloc = positions.reduce(
    (m, p) => Math.max(m, p.allocationPercent),
    0,
  );
  if (maxAlloc >= 35) {
    warnings.push(
      `Largest position is ${round1(maxAlloc)}% of portfolio — concentration risk.`,
    );
  }

  const portfolioHealth = portfolioHealthFromPositions(
    positions,
    snapshot.account.equity,
    snapshot.account.cash,
  );

  const suggestions = positions
    .map((p) => buildSuggestion(p, snapshot.account.cash, snapshot.account.equity, investorProfile))
    .filter((s): s is ClawfolioSuggestion => s !== null)
    .sort((a, b) => b.confidence - a.confidence);

  return {
    generatedAt: new Date().toISOString(),
    asOf: snapshot.asOf,
    dateKey,
    sourceSnapshot,
    reportPrompt: CLAWFOLIO_REPORT_PROMPT,
    investorProfile,
    portfolioHealth,
    positions,
    suggestions,
    warnings,
  };
}
