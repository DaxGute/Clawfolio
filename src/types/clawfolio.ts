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
  summary?: string;
  symbolContext?: string;
  relevanceToSuggestion?: string;
  articleContext?: string;
  riskSignal?: "positive" | "negative" | "mixed" | "neutral";
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

export type ClawfolioConfidence = {
  scorePct: number;
  label: string;
  explanation: string;
};

export type ClawfolioPositionHealthRationale = {
  oneSentenceRationale: string;
  detailedRationale: string;
  evidenceUsed: string[];
  assumptions: string[];
  primaryRisks: string[];
  invalidationTriggers: string[];
};

export type ClawfolioPositionHealth = {
  scorePct: number;
  label: string;
  rationale: ClawfolioPositionHealthRationale;
  confidence: ClawfolioConfidence;
  linkedSources: string[];
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
  health: ClawfolioPositionHealth;
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
  newsContext?: ClawfolioLinkedNews[];
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
