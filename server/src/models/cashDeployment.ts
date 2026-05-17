import type { AlpacaIngestSnapshot } from "../ingest/types";
import type {
  ClawfolioDailyReport,
  ClawfolioInvestorProfile,
  ClawfolioSuggestion,
} from "../reports/types";

type Candidate = {
  symbol: string;
  thesis: string;
  tags: string[];
};

const BASE_CANDIDATES: Candidate[] = [
  {
    symbol: "VTI",
    thesis: "Broad US equity market exposure for idle cash deployment.",
    tags: ["index", "macro", "core", "balanced", "conservative"],
  },
  {
    symbol: "VOO",
    thesis: "S&P 500 large-cap equity exposure with diversified earnings power.",
    tags: ["index", "quality", "growth", "core"],
  },
  {
    symbol: "QUAL",
    thesis: "Quality-factor equity exposure for financially resilient companies.",
    tags: ["quality", "conservative", "balanced"],
  },
  {
    symbol: "SCHD",
    thesis: "Dividend-quality equity exposure for cash-flow-oriented investing.",
    tags: ["income", "quality", "conservative"],
  },
  {
    symbol: "QQQM",
    thesis: "Growth-heavy Nasdaq exposure for higher-risk equity deployment.",
    tags: ["growth", "momentum", "aggressive", "speculative", "technology"],
  },
  {
    symbol: "MTUM",
    thesis: "Momentum-factor equity exposure for trend-following profiles.",
    tags: ["momentum", "swing trader", "day trader"],
  },
];

const SECTOR_CANDIDATES: Record<string, Candidate> = {
  technology: {
    symbol: "XLK",
    thesis: "Technology sector exposure matching the selected sector focus.",
    tags: ["technology", "growth", "momentum"],
  },
  healthcare: {
    symbol: "XLV",
    thesis: "Healthcare sector exposure matching the selected sector focus.",
    tags: ["healthcare", "quality", "defensive"],
  },
  financials: {
    symbol: "XLF",
    thesis: "Financials sector exposure matching the selected sector focus.",
    tags: ["financials", "macro", "value"],
  },
  energy: {
    symbol: "XLE",
    thesis: "Energy sector exposure matching the selected sector focus.",
    tags: ["energy", "macro", "value"],
  },
  industrials: {
    symbol: "XLI",
    thesis: "Industrials sector exposure matching the selected sector focus.",
    tags: ["industrials", "macro", "quality"],
  },
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function normalized(value: string): string {
  return value.trim().toLowerCase();
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
  if (tags.includes(normalized(profile.philosophy))) score += 6;
  if (tags.includes(normalized(profile.riskAppetite))) score += 4;
  if (tags.includes(normalized(profile.tradingFrequency))) score += 3;
  if (profile.timeHorizon === "Generational" && tags.includes("core")) score += 3;
  if (profile.timeHorizon === "Long-Term" && tags.includes("quality")) score += 2;
  if (profile.timeHorizon === "Short-Term" && tags.includes("momentum")) score += 3;
  for (const focus of profile.sectorFocus.map(normalized)) {
    if (tags.includes(focus) || normalized(candidate.symbol) === focus) score += 8;
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

function confidenceForCash(profile: ClawfolioInvestorProfile): number {
  return {
    Conservative: 68,
    Balanced: 72,
    Aggressive: 70,
    Speculative: 64,
  }[profile.riskAppetite];
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

      suggestions.push({
        symbol: candidate.symbol,
        action: "BUY",
        order: {
          action: "BUY",
          symbol: candidate.symbol,
          orderType: "limit",
          limitPrice,
          quantity,
          estimatedNotional: round2(limitPrice * quantity),
          timeInForce: "day",
        },
        confidence: confidenceForCash(profile),
        rationale:
          `${candidate.thesis} Portfolio is ${round2(cashRatio * 100)}% cash, so the profile calls for deploying part of idle fiat into equity exposure rather than leaving all capital uninvested.`,
        riskNote:
          "Deploying cash into equities introduces market drawdown risk; use the limit order and profile-sized notional instead of moving all cash at once.",
        linkedNews: [],
        whatWouldChange:
          "A major market shock, profile change, or symbol-specific news deterioration could reduce or cancel this cash-deployment order.",
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
