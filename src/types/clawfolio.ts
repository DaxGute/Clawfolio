export type ClawfolioTradeAction = "BUY" | "SELL";

export type ClawfolioOrderSpec = {
  action: ClawfolioTradeAction;
  symbol: string;
  orderType: "limit";
  limitPrice: number;
  quantity: number;
  estimatedNotional: number;
  timeInForce: "day";
};

export type ClawfolioLinkedNews = {
  title: string;
  url: string | null;
  source: string;
  publishedAt: string | null;
  relevance: string;
};

export type ClawfolioReportPrompt = {
  id: string;
  version: string;
  objective: string;
  requiredInputs: string[];
  recommendationRules: string[];
  outputContract: string[];
};

export type ClawfolioInvestorProfile = {
  timeHorizon: "Short-Term" | "Medium-Term" | "Long-Term" | "Generational";
  riskAppetite: "Conservative" | "Balanced" | "Aggressive" | "Speculative";
  tradingFrequency: "Day Trader" | "Swing Trader" | "Position Trader" | "Long-Term Holder";
  philosophy: "Value" | "Growth" | "Momentum" | "Quality" | "Income" | "Macro" | "Index";
  sectorFocus: string[];
  sectorBlacklist: string[];
};

export type ClawfolioPortfolioHealth = {
  score: number;
  label: string;
  summary: string;
};

export type ClawfolioPositionReport = {
  symbol: string;
  qty: number;
  marketValue: number;
  allocationPercent: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  healthScore: number;
  healthLabel: string;
  recommendation: ClawfolioTradeAction | null;
  confidence: number;
  positiveDrivers: string[];
  negativeDrivers: string[];
  sources: string[];
};

export type ClawfolioSuggestion = {
  symbol: string;
  action: ClawfolioTradeAction;
  order: ClawfolioOrderSpec;
  confidence: number;
  rationale: string;
  riskNote: string;
  linkedNews: ClawfolioLinkedNews[];
  whatWouldChange: string;
  sources: string[];
};

export type ClawfolioDailyReport = {
  generatedAt: string;
  asOf: string;
  dateKey: string;
  sourceSnapshot: string;
  reportPrompt: ClawfolioReportPrompt;
  investorProfile: ClawfolioInvestorProfile;
  portfolioHealth: ClawfolioPortfolioHealth;
  positions: ClawfolioPositionReport[];
  suggestions: ClawfolioSuggestion[];
  warnings: string[];
};

export type ClawfolioLatestResponse = {
  report: ClawfolioDailyReport | null;
  dateKey: string;
  hasReport: boolean;
  isToday: boolean;
  isStale: boolean;
};

export type ClawfolioRunResponse = ClawfolioLatestResponse & {
  cached: boolean;
};

export type ClawfolioProfileResponse = {
  profile: ClawfolioInvestorProfile;
};
