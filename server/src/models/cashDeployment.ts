import type { AlpacaIngestSnapshot } from "../ingest/types";
import type {
  ClawfolioDailyReport,
  ClawfolioInvestorProfile,
  ClawfolioSuggestion,
} from "../reports/types";

type Candidate = {
  symbol: string;
  thesis: string;
  risk: string;
  tags: string[];
};

const BASE_CANDIDATES: Candidate[] = [
  {
    symbol: "VTI",
    thesis: "Broad US equity market exposure for idle cash deployment.",
    risk:
      "VTI buys the full US equity market, so the main risk is broad market drawdown rather than single-company failure; it will still fall with a risk-off equity tape.",
    tags: ["index", "macro", "core", "balanced", "conservative"],
  },
  {
    symbol: "VOO",
    thesis: "S&P 500 large-cap equity exposure with diversified earnings power.",
    risk:
      "VOO concentrates exposure in US large caps and mega-cap index weights, so weakness in the largest S&P 500 constituents can dominate returns.",
    tags: ["index", "quality", "growth", "core"],
  },
  {
    symbol: "QUAL",
    thesis: "Quality-factor equity exposure for financially resilient companies.",
    risk:
      "QUAL can lag when lower-quality cyclical, speculative, or deeply discounted stocks lead the market.",
    tags: ["quality", "conservative", "balanced"],
  },
  {
    symbol: "SCHD",
    thesis: "Dividend-quality equity exposure for cash-flow-oriented investing.",
    risk:
      "SCHD can underperform in growth-led rallies and carries dividend-factor exposure that may be sensitive to rate expectations.",
    tags: ["income", "quality", "conservative"],
  },
  {
    symbol: "QQQM",
    thesis: "Growth-heavy Nasdaq exposure for higher-risk equity deployment.",
    risk:
      "QQQM is growth and technology heavy, so valuation compression, AI/semiconductor reversals, or mega-cap concentration can create sharper drawdowns.",
    tags: ["growth", "momentum", "aggressive", "speculative", "technology"],
  },
  {
    symbol: "MTUM",
    thesis: "Momentum-factor equity exposure for trend-following profiles.",
    risk:
      "MTUM depends on trend persistence; momentum factor rotations can reverse quickly and cause whipsaw losses.",
    tags: ["momentum", "swing trader", "day trader"],
  },
];

const SECTOR_CANDIDATES: Record<string, Candidate> = {
  technology: {
    symbol: "XLK",
    thesis: "Technology sector exposure matching the selected sector focus.",
    risk:
      "XLK is sector-concentrated technology exposure and can draw down sharply if rates, regulation, or mega-cap tech sentiment deteriorate.",
    tags: ["technology", "growth", "momentum"],
  },
  healthcare: {
    symbol: "XLV",
    thesis: "Healthcare sector exposure matching the selected sector focus.",
    risk:
      "XLV carries healthcare-specific policy, drug-pricing, patent, and regulatory risk.",
    tags: ["healthcare", "quality", "defensive"],
  },
  financials: {
    symbol: "XLF",
    thesis: "Financials sector exposure matching the selected sector focus.",
    risk:
      "XLF is sensitive to credit conditions, yield-curve shifts, loan losses, and financial-system stress.",
    tags: ["financials", "macro", "value"],
  },
  energy: {
    symbol: "XLE",
    thesis: "Energy sector exposure matching the selected sector focus.",
    risk:
      "XLE is tied to commodity prices and energy-cycle volatility, so oil and gas reversals can dominate returns.",
    tags: ["energy", "macro", "value"],
  },
  industrials: {
    symbol: "XLI",
    thesis: "Industrials sector exposure matching the selected sector focus.",
    risk:
      "XLI is economically sensitive and can lag if manufacturing, transport, or capital-spending trends weaken.",
    tags: ["industrials", "macro", "quality"],
  },
};

const TAG_ALIASES: Record<string, string> = {
  tech: "technology",
  it: "technology",
  fintech: "financials",
  finance: "financials",
  financial: "financials",
  bank: "financials",
  banks: "financials",
  healthcare: "healthcare",
  "health care": "healthcare",
  biotech: "healthcare",
  pharma: "healthcare",
  oil: "energy",
  gas: "energy",
  "oil and gas": "energy",
  industrial: "industrials",
  manufacturing: "industrials",
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalized(value: string): string {
  const tag = value.trim().toLowerCase();
  return TAG_ALIASES[tag] ?? tag;
}

function cashDeployShare(profile: ClawfolioInvestorProfile): number {
  return {
    Conservative: 0.15,
    Balanced: 0.25,
    Aggressive: 0.4,
    Speculative: 0.55,
  }[profile.riskAppetite];
}

function candidateCount(profile: ClawfolioInvestorProfile): number {
  return profile.riskAppetite === "Conservative" ? 3 : 4;
}

function scoreCandidate(candidate: Candidate, profile: ClawfolioInvestorProfile): number {
  const tags = candidate.tags.map(normalized);
  let score = 0;

  if (tags.includes(normalized(profile.philosophy))) score += 30;
  if (tags.includes(normalized(profile.riskAppetite))) score += 8;
  if (tags.includes(normalized(profile.tradingFrequency))) score += 10;

  if (profile.timeHorizon === "Short-Term") {
    if (tags.includes("momentum")) score += 14;
    if (tags.includes("growth")) score += 7;
    if (tags.includes("core")) score -= 3;
    if (tags.includes("income")) score -= 4;
  }
  if (profile.timeHorizon === "Medium-Term") {
    if (tags.includes("macro")) score += 3;
    if (tags.includes("balanced")) score += 2;
    if (tags.includes("growth")) score += 3;
  }
  if (profile.timeHorizon === "Long-Term") {
    if (tags.includes("quality")) score += 10;
    if (tags.includes("growth")) score += 6;
    if (tags.includes("core")) score += 6;
    if (tags.includes("momentum")) score -= 3;
  }
  if (profile.timeHorizon === "Generational") {
    if (tags.includes("core")) score += 12;
    if (tags.includes("index")) score += 9;
    if (tags.includes("quality")) score += 6;
    if (tags.includes("speculative")) score -= 8;
    if (tags.includes("momentum")) score -= 5;
  }

  if (profile.riskAppetite === "Conservative") {
    if (tags.includes("conservative")) score += 8;
    if (tags.includes("speculative")) score -= 18;
    if (tags.includes("technology")) score -= 5;
  }
  if (profile.riskAppetite === "Balanced") {
    if (tags.includes("balanced")) score += 4;
    if (tags.includes("core")) score += 2;
    if (tags.includes("speculative")) score -= 8;
  }
  if (profile.riskAppetite === "Aggressive") {
    if (tags.includes("aggressive")) score += 10;
    if (tags.includes("growth")) score += 7;
    if (tags.includes("conservative")) score -= 5;
  }
  if (profile.riskAppetite === "Speculative") {
    if (tags.includes("speculative")) score += 14;
    if (tags.includes("momentum")) score += 8;
    if (tags.includes("conservative")) score -= 10;
    if (tags.includes("income")) score -= 8;
  }

  if (profile.tradingFrequency === "Day Trader") {
    if (tags.includes("day trader") || tags.includes("momentum")) score += 12;
    if (tags.includes("core")) score -= 4;
  }
  if (profile.tradingFrequency === "Swing Trader") {
    if (tags.includes("swing trader") || tags.includes("momentum")) score += 10;
  }
  if (profile.tradingFrequency === "Position Trader") {
    if (tags.includes("macro")) score += 3;
    if (tags.includes("quality")) score += 3;
  }
  if (profile.tradingFrequency === "Long-Term Holder") {
    if (tags.includes("core")) score += 9;
    if (tags.includes("quality")) score += 7;
    if (tags.includes("momentum")) score -= 6;
  }

  for (const focus of profile.sectorFocus.map(normalized)) {
    if (tags.includes(focus) || normalized(candidate.symbol) === focus) score += 60;
  }
  return score;
}

function candidateBlocked(candidate: Candidate, profile: ClawfolioInvestorProfile): boolean {
  const blocked = profile.sectorBlacklist.map(normalized);
  const tags = candidate.tags.map(normalized);
  return blocked.some((tag) => tag === normalized(candidate.symbol) || tags.includes(tag));
}

function candidatesForProfile(profile: ClawfolioInvestorProfile): Candidate[] {
  const sectorCandidates = profile.sectorFocus
    .map((tag) => SECTOR_CANDIDATES[normalized(tag)])
    .filter((candidate): candidate is Candidate => candidate !== undefined);

  const bySymbol = new Map<string, Candidate>();
  for (const candidate of [...sectorCandidates, ...BASE_CANDIDATES]) {
    if (!candidateBlocked(candidate, profile)) bySymbol.set(candidate.symbol, candidate);
  }

  return [...bySymbol.values()]
    .sort((a, b) => scoreCandidate(b, profile) - scoreCandidate(a, profile))
    .slice(0, candidateCount(profile));
}

async function fetchLastPrice(symbol: string): Promise<number> {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`);
  url.searchParams.set("range", "1d");
  url.searchParams.set("interval", "1d");

  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "user-agent": "Clawfolio/0.0.1",
    },
  });
  if (!res.ok) throw new Error(`Quote fetch failed for ${symbol}: ${res.status}`);

  const body = await res.json() as {
    chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> };
  };
  const price = body.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (!Number.isFinite(price) || price === undefined || price <= 0) {
    throw new Error(`Quote fetch did not return a usable price for ${symbol}`);
  }
  return price;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function profileConfidenceBase(profile: ClawfolioInvestorProfile): number {
  return {
    Conservative: 68,
    Balanced: 72,
    Aggressive: 70,
    Speculative: 64,
  }[profile.riskAppetite];
}

function profileMatches(candidate: Candidate, profile: ClawfolioInvestorProfile): string[] {
  const tags = candidate.tags.map(normalized);
  const matches: string[] = [];

  if (tags.includes(normalized(profile.philosophy))) {
    matches.push(`${profile.philosophy} philosophy`);
  }
  if (tags.includes(normalized(profile.riskAppetite))) {
    matches.push(`${profile.riskAppetite} risk appetite`);
  }
  if (tags.includes(normalized(profile.tradingFrequency))) {
    matches.push(`${profile.tradingFrequency} trading frequency`);
  }
  if (profile.timeHorizon === "Short-Term" && tags.includes("momentum")) {
    matches.push("short-term momentum preference");
  }
  if (profile.timeHorizon === "Long-Term" && tags.includes("quality")) {
    matches.push("long-term quality preference");
  }
  if (profile.timeHorizon === "Generational" && tags.includes("core")) {
    matches.push("generational core allocation preference");
  }

  for (const focus of profile.sectorFocus) {
    if (tags.includes(normalized(focus)) || normalized(candidate.symbol) === normalized(focus)) {
      matches.push(`${focus} sector focus`);
    }
  }

  return matches;
}

function confidenceForCashCandidate(
  candidate: Candidate,
  profile: ClawfolioInvestorProfile,
  cashRatio: number,
  estimatedNotional: number,
  equity: number,
): number {
  const fit = scoreCandidate(candidate, profile);
  const tags = candidate.tags.map(normalized);
  const notionalPct = equity > 0 ? estimatedNotional / equity : 0;
  let confidence = 50 + Math.min(34, Math.max(0, fit));
  confidence += Math.round((profileConfidenceBase(profile) - 68) / 2);
  if (cashRatio >= 0.9) confidence += 5;
  if (notionalPct > 0.18) confidence -= 4;
  if (tags.includes("core") && profile.timeHorizon === "Generational") confidence += 4;
  if (tags.includes("index") && profile.philosophy === "Index") confidence += 4;
  if (tags.includes("quality") && profile.philosophy === "Quality") confidence += 4;
  if (tags.includes("momentum") && profile.philosophy === "Momentum") confidence += 4;
  if (tags.includes("income") && profile.philosophy === "Income") confidence += 4;
  if (tags.includes("growth") && profile.philosophy === "Growth") confidence += 4;
  if (tags.includes("macro") && profile.philosophy === "Macro") confidence += 4;
  if (
    profile.sectorFocus
      .map(normalized)
      .some((focus) => tags.includes(focus) || normalized(candidate.symbol) === focus)
  ) confidence += 10;
  if (tags.includes("speculative") && profile.riskAppetite !== "Speculative") confidence -= 5;
  if (tags.includes("technology") && profile.riskAppetite === "Conservative") confidence -= 4;

  return Math.round(clamp(confidence, 35, 98));
}

function buildRationale(
  candidate: Candidate,
  profile: ClawfolioInvestorProfile,
  cashRatio: number,
  estimatedNotional: number,
): string {
  const matches = profileMatches(candidate, profile);
  const fitText =
    matches.length > 0
      ? `It matches the active profile through ${matches.join(", ")}.`
      : "It is included as a diversified cash-deployment candidate, but it is not a tight profile match.";

  return [
    `${candidate.symbol}: ${candidate.thesis}`,
    `The account is ${round2(cashRatio * 100)}% cash, so idle cash is the primary portfolio issue.`,
    `This order deploys about $${round2(estimatedNotional).toLocaleString()} into ${candidate.symbol} rather than leaving the entire account in fiat.`,
    fitText,
  ].join(" ");
}

function buildRiskNote(
  candidate: Candidate,
  estimatedNotional: number,
  equity: number,
): string {
  const notionalPct = equity > 0 ? round2((estimatedNotional / equity) * 100) : 0;
  return [
    `${candidate.symbol}: ${candidate.risk}`,
    `The proposed notional is about ${notionalPct}% of portfolio equity, so this is a staged entry rather than full cash deployment.`,
    "Limit pricing reduces execution drift but does not protect against post-fill market losses.",
  ].join(" ");
}

function buildWhatWouldChange(candidate: Candidate): string {
  const symbol = candidate.symbol;
  const tags = candidate.tags.map(normalized);

  if (symbol === "QQQM") {
    return "Reduce or cancel this QQQM BUY if Nasdaq mega-cap momentum breaks down, AI/semiconductor leadership reverses, growth valuations compress, or newer news points to broad technology risk.";
  }
  if (symbol === "MTUM") {
    return "Reduce or cancel this MTUM BUY if recent momentum leadership rolls over, factor rotation favors value/defensives, or the market shifts into choppy mean-reversion instead of trend continuation.";
  }
  if (symbol === "VOO") {
    return "Reduce or cancel this VOO BUY if S&P 500 breadth deteriorates, mega-cap concentration becomes the main risk driver, earnings expectations weaken, or broad US equity news turns materially negative.";
  }
  if (symbol === "VTI") {
    return "Reduce or cancel this VTI BUY if broad US equity conditions weaken, market breadth deteriorates, macro risk rises enough to favor cash, or better evidence supports a narrower allocation.";
  }

  if (tags.includes("technology")) {
    return `Reduce or cancel this ${symbol} BUY if technology-sector momentum weakens, valuation risk rises, or sector-specific news turns materially negative.`;
  }
  if (tags.includes("healthcare")) {
    return `Reduce or cancel this ${symbol} BUY if healthcare policy, drug-pricing, regulatory, or earnings news weakens the sector setup.`;
  }
  if (tags.includes("financials")) {
    return `Reduce or cancel this ${symbol} BUY if credit stress, yield-curve pressure, or bank earnings news weakens the financial-sector setup.`;
  }
  if (tags.includes("energy")) {
    return `Reduce or cancel this ${symbol} BUY if oil and gas prices reverse, demand expectations weaken, or energy-sector news turns negative.`;
  }

  return `Reduce or cancel this ${symbol} BUY if the specific thesis weakens, linked news turns negative, price action invalidates the setup, or the active investor profile changes.`;
}

export async function addCashDeploymentSuggestions(
  report: ClawfolioDailyReport,
  snapshot: AlpacaIngestSnapshot,
  profile: ClawfolioInvestorProfile,
): Promise<ClawfolioDailyReport> {
  const equity = snapshot.account.equity;
  const cash = snapshot.account.cash;
  const cashRatio = equity > 0 ? cash / equity : 0;

  if (report.suggestions.length > 0 || cashRatio < 0.5 || cash <= 0) return report;

  const candidates = candidatesForProfile(profile);
  if (candidates.length === 0) {
    return {
      ...report,
      warnings: [
        ...report.warnings,
        "Portfolio is mostly cash, but no deployment candidates matched the investor profile.",
      ],
    };
  }

  const totalBudget = Math.min(cash * cashDeployShare(profile), snapshot.account.buyingPower);
  const perCandidateBudget = totalBudget / candidates.length;
  const suggestions: ClawfolioSuggestion[] = [];
  const warnings = [...report.warnings];

  for (const candidate of candidates) {
    try {
      const lastPrice = await fetchLastPrice(candidate.symbol);
      const limitPrice = round2(lastPrice * 1.005);
      const quantity = Math.floor(perCandidateBudget / limitPrice);
      if (quantity <= 0) continue;
      const estimatedNotional = round2(limitPrice * quantity);

      suggestions.push({
        symbol: candidate.symbol,
        action: "BUY",
        order: {
          action: "BUY",
          symbol: candidate.symbol,
          orderType: "limit",
          limitPrice,
          quantity,
          estimatedNotional,
          timeInForce: "day",
        },
        confidence: confidenceForCashCandidate(
          candidate,
          profile,
          cashRatio,
          estimatedNotional,
          equity,
        ),
        rationale: buildRationale(candidate, profile, cashRatio, estimatedNotional),
        riskNote: buildRiskNote(candidate, estimatedNotional, equity),
        linkedNews: [],
        whatWouldChange: buildWhatWouldChange(candidate),
        sources: ["clawfolio:cash-deployment-model", "quote:yahoo-finance-chart"],
      });
    } catch (err) {
      warnings.push(
        `Cash deployment quote failed for ${candidate.symbol}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  if (suggestions.length === 0) {
    warnings.push("Portfolio is mostly cash, but quote/order sizing prevented BUY suggestions.");
  }

  return {
    ...report,
    suggestions: [...report.suggestions, ...suggestions],
    warnings,
  };
}
