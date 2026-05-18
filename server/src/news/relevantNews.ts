import type {
  ClawfolioDailyReport,
  ClawfolioLinkedNews,
  ClawfolioSuggestion,
} from "../reports/types";

const NEWS_PER_SYMBOL = 5;
const CANDIDATES_TO_ENRICH = 18;
const YAHOO_NEWS_ENDPOINT = "https://feeds.finance.yahoo.com/rss/2.0/headline";
const GOOGLE_NEWS_SEARCH_ENDPOINT = "https://news.google.com/rss/search";
const MAX_SUMMARY_LENGTH = 260;
const MAX_ARTICLE_TEXT_LENGTH = 5000;
const RECENT_NEWS_WINDOW_DAYS = 45;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type ScoredNews = ClawfolioLinkedNews & {
  relevanceScore: number;
};

type RawNewsItem = {
  title: string;
  url: string | null;
  source: string;
  publishedAt: string | null;
  description: string | null;
};

const SYMBOL_RELEVANCE_TERMS: Record<string, string[]> = {
  MTUM: ["mtum", "momentum", "momentum factor", "ishares msci usa momentum"],
  QQQM: ["qqqm", "qqq", "nasdaq", "nasdaq-100", "technology", "growth"],
  VTI: [
    "vti",
    "vanguard total stock market",
    "total stock market",
    "total market",
    "broad market",
    "s&p 500",
    "sp 500",
    "u.s. stocks",
    "us stocks",
    "stock-market",
    "stock market",
    "active fund managers",
  ],
  VOO: ["voo", "s&p 500", "sp 500", "large-cap", "large cap"],
  QUAL: ["quality factor", "profitable companies", "balance sheet"],
  SCHD: ["schd", "dividend", "dividend yield", "dividend quality", "cash flow"],
  XLK: ["xlk", "technology", "tech", "software", "semiconductor", "nasdaq"],
  XLV: ["xlv", "healthcare", "health care", "pharma", "biotech", "drug pricing"],
  XLF: ["xlf", "financials", "banks", "credit", "yield curve", "loan losses"],
  XLE: ["xle", "energy", "oil", "gas", "crude", "opec"],
  XLI: ["xli", "industrials", "manufacturing", "transport", "capital spending"],
};

const NEWS_FEED_SYMBOLS: Record<string, string[]> = {
  MTUM: ["MTUM", "SPMO", "PDP", "QQQ", "SPY", "IWM"],
  QQQM: ["QQQM", "QQQ", "XLK", "SMH", "NVDA", "MSFT", "AAPL", "TLT"],
  VTI: ["VTI", "ITOT", "SCHB", "VOO", "SPY", "IVV", "IWM", "DIA", "TLT"],
  VOO: ["VOO", "SPY", "IVV", "SPLG", "QQQ", "DIA", "TLT"],
  QUAL: ["QUAL", "SPHQ", "USMV", "SPLV", "VOO", "SPY", "TLT"],
  SCHD: ["SCHD", "VYM", "DVY", "VIG", "TLT"],
  XLK: ["XLK", "QQQ", "SMH", "NVDA", "MSFT", "AAPL", "TLT"],
  XLV: ["XLV", "IBB", "IYH", "PFE", "UNH", "LLY"],
  XLF: ["XLF", "KBE", "KRE", "JPM", "BAC", "TLT"],
  XLE: ["XLE", "USO", "XOM", "CVX", "OIH"],
  XLI: ["XLI", "IYT", "CAT", "GE", "HON"],
};

const MARKET_CONTEXT_TERMS = [
  "fed",
  "federal reserve",
  "interest rate",
  "rates",
  "inflation",
  "cpi",
  "ppi",
  "treasury",
  "yields",
  "recession",
  "jobs report",
  "unemployment",
  "earnings",
  "guidance",
  "volatility",
  "vix",
  "oil",
  "tariff",
  "geopolitical",
  "market rally",
  "selloff",
  "nasdaq",
  "s&p 500",
  "sp 500",
  "sector",
  "factor",
  "momentum",
  "quality",
  "growth",
  "value",
  "breadth",
  "liquidity",
  "flows",
  "inflows",
  "outflows",
  "expense ratio",
  "fee",
  "valuation",
  "multiple",
  "consumer sentiment",
];

const GENERIC_PERSONAL_FINANCE_TERMS = [
  "mistakes",
  "millionaire",
  "retire",
  "retirement",
  "social security",
  "401(k)",
  "salary",
  "budget",
  "saving",
  "savings",
  "credit card",
  "debt",
  "side hustle",
  "should you buy",
  "how to",
  "tips",
  "rules",
  "lessons",
];

const EVERGREEN_EDITORIAL_TERMS = [
  "investing radar",
  "strategy that works",
  "money moves",
  "made this",
  "millionaire",
  "returns 300%",
  "in a decade",
  "over the last 15 years",
  "top ",
  "best ",
  "worst ",
  "style box",
  "should ",
  "make you richer",
  "battle of",
  "catch for individual investors",
  "quietly outperforms",
  "buy-and-hold investors",
  "your portfolio",
  "simple fix",
  "brokerage statement",
  "cheap way",
  "overthink investing",
  "better choice for investors",
  "explore how",
  "your choice",
];

const RECENT_EVENT_TERMS = [
  "today",
  "this week",
  "this month",
  "recent",
  "filing",
  "filings",
  "launch",
  "launches",
  "adds",
  "added",
  "surge",
  "surges",
  "spike",
  "spikes",
  "resurface",
  "rally",
  "selloff",
  "cuts",
  "raises",
  "downgrade",
  "upgrade",
  "earnings",
  "guidance",
  "inflation",
  "oil",
  "fed",
  "rates",
  "tariff",
  "flows",
  "inflows",
  "outflows",
  "consumer sentiment",
  "jobs",
  "payrolls",
  "yield",
  "yields",
];

const CONSTRUCTIVE_BUY_TERMS = [
  "higher",
  "up +",
  "gains",
  "gain",
  "rally",
  "rallies",
  "optimism",
  "resilient",
  "inflows",
  "outperform",
  "outpaced",
  "strong",
  "surge",
  "easing",
  "worth watching",
  "appeal",
  "boost",
];

const NEGATIVE_BROAD_MARKET_TERMS = [
  "lower pre-bell",
  "fall pre-bell",
  "slide",
  "slides",
  "tumble",
  "tumbles",
  "down -",
  "selloff",
  "jitters",
  "pressured",
  "pressure",
];

const ETF_IMPLEMENTATION_TERMS = [
  "expense ratio",
  "fee",
  "fees",
  "inflows",
  "outflows",
  "flows",
  "liquidity",
  "launch",
  "launches",
];

const NON_EQUITY_FUND_TERMS = [
  "bond etf",
  "bond etfs",
  "muni bond",
  "municipal bond",
  "treasury etf",
];

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCharCode(parseInt(code, 16)))
    .trim();
}

function readTag(item: string, tag: string): string | null {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1] ?? "") : null;
}

function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^(.+?[.!?])(?:\s|$)/);
  return (match?.[1] ?? trimmed).trim();
}

function truncateSentence(value: string, maxLength = MAX_SUMMARY_LENGTH): string {
  if (value.length <= maxLength) return value;
  const clipped = value.slice(0, maxLength - 1).trimEnd();
  return `${clipped}.`;
}

function normalize(value: string): string {
  return value.toLowerCase();
}

function hasAnyTerm(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

function matchingTerms(value: string, terms: string[]): string[] {
  return terms.filter((term) => value.includes(term));
}

function articleAgeDays(publishedAt: string | null): number | null {
  if (!publishedAt) return null;
  const published = new Date(publishedAt);
  if (Number.isNaN(published.getTime())) return null;
  return (Date.now() - published.getTime()) / MS_PER_DAY;
}

function inferRiskSignal(title: string, summary: string): ClawfolioLinkedNews["riskSignal"] {
  const text = `${title} ${summary}`.toLowerCase();
  const negative = [
    "falls",
    "fall",
    "drops",
    "drop",
    "miss",
    "misses",
    "cut",
    "cuts",
    "downgrade",
    "downgrades",
    "lawsuit",
    "probe",
    "warning",
    "risk",
    "weak",
    "slump",
    "selloff",
  ].some((term) => text.includes(term));
  const positive = [
    "rises",
    "rise",
    "gains",
    "gain",
    "beats",
    "beat",
    "upgrade",
    "upgrades",
    "record",
    "growth",
    "strong",
    "surge",
    "outperform",
  ].some((term) => text.includes(term));

  if (positive && negative) return "mixed";
  if (positive) return "positive";
  if (negative) return "negative";
  return "neutral";
}

function summarizeArticle(title: string, description: string | null): string {
  const cleanedDescription = description
    ? stripHtml(description).split(" Skip to navigation ")[0]?.trim() ?? ""
    : "";
  if (
    cleanedDescription &&
    !cleanedDescription.toLowerCase().includes("comprehensive up-to-date news coverage")
  ) return truncateSentence(firstSentence(decodeXml(cleanedDescription)));
  return `This article reports on: ${title}.`;
}

function canonicalNewsKey(item: Pick<RawNewsItem, "title" | "url">): string {
  const titleKey = item.title
    .toLowerCase()
    .replace(/\s+-\s+[^-]+$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return item.url?.replace(/[?#].*$/, "") ?? titleKey;
}

function extractMetaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${escaped}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${escaped}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeXml(match[1]);
  }

  return null;
}

function extractArticleText(html: string): string {
  const meta =
    extractMetaContent(html, "og:description") ??
    extractMetaContent(html, "description") ??
    "";
  const paragraphs = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map((match) => stripHtml(match[1] ?? ""))
    .filter((paragraph) => paragraph.length >= 80)
    .slice(0, 8)
    .join(" ");
  return [meta, paragraphs]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .slice(0, MAX_ARTICLE_TEXT_LENGTH)
    .trim();
}

async function fetchArticleText(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(3500),
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "Clawfolio/0.0.1",
      },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;
    const text = extractArticleText(await res.text());
    if (text.toLowerCase().includes("comprehensive up-to-date news coverage")) return null;
    return text || null;
  } catch {
    return null;
  }
}

function symbolTermsForSuggestion(suggestion: ClawfolioSuggestion): string[] {
  return SYMBOL_RELEVANCE_TERMS[suggestion.symbol] ?? [suggestion.symbol];
}

function feedSymbolsForSuggestion(suggestion: ClawfolioSuggestion): string[] {
  return [...new Set([suggestion.symbol, ...(NEWS_FEED_SYMBOLS[suggestion.symbol] ?? [])])];
}

function searchQueriesForSuggestion(suggestion: ClawfolioSuggestion): string[] {
  const terms = symbolTermsForSuggestion(suggestion)
    .filter((term) => term.length > 2)
    .slice(0, 5);
  const thesisTerms = relevanceTermsForSuggestion(suggestion)
    .filter((term) => !terms.includes(term))
    .slice(0, 5);
  const action = suggestion.action.toLowerCase();

  const queries = [
    `${suggestion.symbol} ETF ${action} thesis news`,
    `${suggestion.symbol} ${terms.slice(0, 3).join(" ")} recent news`,
    `${suggestion.symbol} ETF flows expense ratio liquidity`,
    `${terms.slice(0, 4).join(" ")} market outlook ETF`,
    `${thesisTerms.slice(0, 4).join(" ")} ${suggestion.symbol} ETF`,
    `inflation rates earnings ${suggestion.symbol} ETF`,
  ];

  return [...new Set(queries.map((query) => query.replace(/\s+/g, " ").trim()))]
    .filter((query) => query.length >= 12)
    .slice(0, 6);
}

function relevanceTermsForSuggestion(suggestion: ClawfolioSuggestion): string[] {
  const symbolTerms = symbolTermsForSuggestion(suggestion);
  const thesisTerms = suggestion.rationale
    .split(/[^a-zA-Z0-9-]+/)
    .map((term) => term.toLowerCase())
    .filter((term) => term.length >= 5)
    .filter(
      (term) =>
        ![
          "account",
          "about",
          "rather",
          "leaving",
          "entire",
          "fiat",
          "profile",
          "through",
          "trading",
          "frequency",
          "deployment",
          "exposure",
          "market",
        ].includes(term),
    )
    .slice(0, 12);

  return [...new Set([suggestion.symbol.toLowerCase(), ...symbolTerms, ...thesisTerms])];
}

function scoreArticleRelevance(
  suggestion: ClawfolioSuggestion,
  title: string,
  summary: string,
  publishedAt: string | null,
): number {
  const text = normalize(`${title} ${summary}`);
  const symbolMatches = matchingTerms(text, symbolTermsForSuggestion(suggestion));
  const thesisMatches = matchingTerms(text, relevanceTermsForSuggestion(suggestion));
  const marketMatches = matchingTerms(text, MARKET_CONTEXT_TERMS);
  const hasGenericPersonalFinance = hasAnyTerm(text, GENERIC_PERSONAL_FINANCE_TERMS);
  const hasEvergreenEditorial = hasAnyTerm(text, EVERGREEN_EDITORIAL_TERMS);
  const hasRecentEvent = hasAnyTerm(text, RECENT_EVENT_TERMS);
  const hasConstructiveBuySignal = hasAnyTerm(text, CONSTRUCTIVE_BUY_TERMS);
  const hasNegativeBroadMarketSignal = hasAnyTerm(text, NEGATIVE_BROAD_MARKET_TERMS);
  const hasImplementationSignal = hasAnyTerm(text, ETF_IMPLEMENTATION_TERMS);
  const ageDays = articleAgeDays(publishedAt);
  const isRecent = ageDays === null || ageDays <= RECENT_NEWS_WINDOW_DAYS;

  if (!isRecent) return 0;

  const hasSymbolMatch = symbolMatches.length > 0;
  const hasThesisMatch = thesisMatches.length > 0;
  const hasMarketContext = marketMatches.length > 0;

  if (!hasSymbolSpecificSupport(suggestion, text)) return 0;
  if (hasGenericPersonalFinance && !hasSymbolMatch && !hasMarketContext) return 0;
  if (hasEvergreenEditorial && !hasRecentEvent && !hasImplementationSignal) return 0;
  if (!hasSymbolMatch && !hasThesisMatch && !hasMarketContext) return 0;
  if (
    suggestion.action === "BUY" &&
    hasNegativeBroadMarketSignal &&
    !hasImplementationSignal
  ) return 0;
  if (
    hasAnyTerm(text, NON_EQUITY_FUND_TERMS) &&
    !text.includes(suggestion.symbol.toLowerCase())
  ) return 0;

  let score = 0;
  score += Math.min(8, symbolMatches.length * 4);
  score += Math.min(6, thesisMatches.length * 2);
  score += Math.min(6, marketMatches.length * 2);
  if (hasRecentEvent) score += 3;
  if (hasConstructiveBuySignal && suggestion.action === "BUY") score += 4;
  if (hasImplementationSignal) score += 3;
  if (title.toLowerCase().includes(suggestion.symbol.toLowerCase())) score += 5;
  if (hasGenericPersonalFinance) score -= 5;
  if (hasEvergreenEditorial && !hasRecentEvent) score -= 4;

  return Math.max(0, score);
}

function textIncludes(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function hasSymbolSpecificSupport(suggestion: ClawfolioSuggestion, text: string): boolean {
  if (suggestion.symbol === "MTUM") {
    return textIncludes(text, [
      "mtum",
      "spmo",
      "momentum",
      "momentum factor",
      "equity futures higher",
    ]);
  }

  if (suggestion.symbol === "QQQM") {
    return textIncludes(text, [
      "qqqm",
      "qqq",
      "nasdaq",
      "nasdaq-100",
      "chip",
      "semiconductor",
      "technology",
      "mega-cap",
      "ai ",
      "artificial intelligence",
    ]);
  }

  if (suggestion.symbol === "VTI") {
    return textIncludes(text, [
      "vti",
      "vanguard total stock",
      "total u.s. stock",
      "total us stock",
      "total stock market",
      "s&p 500",
      "sp 500",
      "spdr s&p",
      "core funds",
      "broad market",
      "u.s. equity",
      "us equity",
      "equity futures higher",
      "etf inflows",
    ]);
  }

  if (suggestion.symbol === "QUAL") {
    return /\bqual\b/.test(text) || textIncludes(text, [
      "sphq",
      "jqua",
      "quality-factor",
      "quality factor",
      "quality etf",
      "quality and value",
      "profitable",
      "balance sheet",
    ]);
  }

  return hasAnyTerm(text, symbolTermsForSuggestion(suggestion));
}

function buildArticleContext(
  suggestion: ClawfolioSuggestion,
  title: string,
  summary: string,
): string | null {
  const text = normalize(`${title} ${summary}`);
  const action = suggestion.action;
  const direction = action === "BUY" ? "BUY" : "SELL";
  const reportedFact = summary.replace(/\.$/, "");

  if (suggestion.symbol === "MTUM" && textIncludes(text, ["momentum", "factor"])) {
    return `This supports the ${direction} thesis because the article reports that ${reportedFact}. MTUM is a momentum-factor allocation, so current momentum outperformance is directly aligned with buying trend exposure; reversal risk remains the main constraint.`;
  }

  if (suggestion.symbol === "QQQM" && textIncludes(text, ["nasdaq", "qqq", "qqqm"])) {
    if (textIncludes(text, ["blackrock", "state street", "compete", "launch", "launches"])) {
      return `This supports checking the ${direction} thesis because the article reports that ${reportedFact}. QQQM is an implementation vehicle for Nasdaq-100 exposure, so competing product launches can affect fees, flows, and liquidity.`;
    }
    if (textIncludes(text, ["lower fee", "fee", "expense"])) {
      return `This supports the ${direction} thesis because the article reports that ${reportedFact}. For QQQM, implementation cost matters because lower fees improve the case for using it over similar Nasdaq-100 products.`;
    }
    return `This supports the ${direction} thesis because the article reports that ${reportedFact}. QQQM owns Nasdaq-100 growth exposure, so recent Nasdaq, mega-cap technology, semiconductor, or liquidity strength is directly relevant to the proposed allocation.`;
  }

  if (suggestion.symbol === "VTI") {
    if (textIncludes(text, ["etf inflows", "inflows", "core funds"])) {
      return `This supports the ${direction} thesis because the article reports that ${reportedFact}. VTI is broad U.S. equity exposure, so strong core-equity ETF demand supports the market-participation case for deploying idle cash.`;
    }
    if (textIncludes(text, ["treasury", "10-year", "yield", "yields", "rates"])) {
      return `This is pertinent to the ${direction} thesis because the article reports that ${reportedFact}. VTI is broad U.S. equity exposure, and rates directly affect equity valuation multiples and the cash-vs-stock tradeoff.`;
    }
    if (textIncludes(text, ["vti", "vanguard total stock market", "total u.s. stock market", "total stock market"])) {
      return `This supports the ${direction} thesis because the article reports that ${reportedFact}. The order is choosing VTI-style total-market exposure, so structure, cost, and liquidity comparisons are directly relevant.`;
    }
    if (textIncludes(text, ["s&p 500", "sp 500", "broad market", "u.s. stock", "us stock"])) {
      return `This supports the ${direction} thesis because the article reports that ${reportedFact}. VTI owns the total U.S. market, so broad equity strength, earnings resilience, and healthy participation are direct support for deploying cash.`;
    }
  }

  if (suggestion.symbol === "QUAL") {
    if (textIncludes(text, ["inflation", "oil", "volatility", "quality"])) {
      return `This supports the ${direction} thesis because the article reports that ${reportedFact}. QUAL targets quality-factor companies, so evidence that volatility or inflation is pushing investors toward quality, profitability, and resilient balance sheets maps to the exposure being bought.`;
    }
    if (textIncludes(text, ["quality", "balance sheet", "profitable"])) {
      return `This supports the ${direction} thesis because the article reports that ${reportedFact}. QUAL targets profitable, higher-quality companies, so balance-sheet, profitability, or quality-factor evidence is directly tied to the order rationale.`;
    }
  }

  if (textIncludes(text, ["inflation", "cpi", "ppi", "fed", "rates", "treasury", "yield", "yields"])) {
    return `This is pertinent to the ${direction} thesis because the article reports that ${reportedFact}. That macro input changes equity discount rates, risk appetite, or cash-vs-equity tradeoffs for ${suggestion.symbol}.`;
  }

  if (textIncludes(text, ["earnings", "guidance", "revenue", "margin", "valuation", "multiple"])) {
    return `This supports the ${direction} thesis because the article reports that ${reportedFact}. Earnings, guidance, valuation, or margin facts affect the exposure behind ${suggestion.symbol} and therefore the order rationale.`;
  }

  if (textIncludes(text, ["flows", "inflows", "outflows", "liquidity", "expense ratio", "fee"])) {
    return `This supports the ${direction} thesis because the article reports that ${reportedFact}. ETF flows, fees, and liquidity affect whether ${suggestion.symbol} is a good implementation vehicle, not just whether the broad asset class is attractive.`;
  }

  return null;
}

function parseRssItems(xml: string, fallbackSource: string): RawNewsItem[] {
  return [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)]
    .map<RawNewsItem | null>((match) => {
      const item = match[1] ?? "";
      const title = readTag(item, "title");
      if (!title) return null;

      return {
        title,
        url: readTag(item, "link"),
        source: readTag(item, "source") ?? fallbackSource,
        publishedAt: readTag(item, "pubDate"),
        description: readTag(item, "description"),
      };
    })
    .filter((item): item is RawNewsItem => item !== null);
}

function scoreRawNewsItem(
  suggestion: ClawfolioSuggestion,
  item: RawNewsItem,
  articleText: string | null,
): ScoredNews | null {
  const summary = articleText
    ? truncateSentence(firstSentence(articleText))
    : summarizeArticle(item.title, item.description);
  const scoringText = articleText ? [summary, articleText].join(" ") : summary;
  const relevanceScore = scoreArticleRelevance(
    suggestion,
    item.title,
    scoringText,
    item.publishedAt,
  );
  if (relevanceScore <= 0) return null;
  const articleContext = buildArticleContext(suggestion, item.title, summary);
  if (!articleContext) return null;

  return {
    title: item.title,
    url: item.url,
    source: item.source,
    publishedAt: item.publishedAt,
    summary,
    symbolContext: articleContext,
    relevanceToSuggestion: articleContext,
    articleContext,
    riskSignal: inferRiskSignal(item.title, summary),
    relevance: articleContext,
    relevanceScore,
  };
}

async function fetchSymbolNews(
  suggestion: ClawfolioSuggestion,
): Promise<ClawfolioLinkedNews[]> {
  const yahooUrls = feedSymbolsForSuggestion(suggestion).map((symbol) => {
    const url = new URL(YAHOO_NEWS_ENDPOINT);
    url.searchParams.set("s", symbol);
    url.searchParams.set("region", "US");
    url.searchParams.set("lang", "en-US");
    return { url, source: "Yahoo Finance" };
  });
  const googleUrls = searchQueriesForSuggestion(suggestion).map((query) => {
    const url = new URL(GOOGLE_NEWS_SEARCH_ENDPOINT);
    url.searchParams.set("q", query);
    url.searchParams.set("hl", "en-US");
    url.searchParams.set("gl", "US");
    url.searchParams.set("ceid", "US:en");
    return { url, source: "Google News" };
  });

  const rawItems = (await Promise.all(
    [...yahooUrls, ...googleUrls].map(async (feed) => {
      try {
        const res = await fetch(feed.url, {
          signal: AbortSignal.timeout(5000),
          headers: {
            accept: "application/rss+xml, application/xml, text/xml",
            "user-agent": "Clawfolio/0.0.1",
          },
        });

        if (!res.ok) return [];

        return parseRssItems(await res.text(), feed.source);
      } catch {
        return [];
      }
    }),
  )).flat();

  const byUrlOrTitle = new Map<string, RawNewsItem>();
  for (const item of rawItems) {
    const key = canonicalNewsKey(item);
    const existing = byUrlOrTitle.get(key);
    if (!existing) {
      byUrlOrTitle.set(key, item);
    }
  }

  const preliminary = [...byUrlOrTitle.values()]
    .map((item) => scoreRawNewsItem(suggestion, item, null))
    .filter((item): item is ScoredNews => item !== null)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, CANDIDATES_TO_ENRICH);

  const enriched = await Promise.all(
    preliminary.map(async (item) => {
      const articleText = await fetchArticleText(item.url);
      if (!articleText) return item;
      const rescored = scoreRawNewsItem(
        suggestion,
        {
          title: item.title,
          url: item.url,
          source: item.source,
          publishedAt: item.publishedAt,
          description: item.summary,
        },
        articleText,
      );
      return rescored ?? item;
    }),
  );

  return enriched
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, NEWS_PER_SYMBOL)
    .map(({ relevanceScore: _relevanceScore, ...item }) => item);
}

function missingNewsEvidence(suggestion: ClawfolioSuggestion): ClawfolioLinkedNews {
  const summary =
    `No article was available to attach to the ${suggestion.action} suggestion for ${suggestion.symbol}.`;
  const articleContext =
    `For ${suggestion.symbol}, Clawfolio could not verify a recent article that was specifically pertinent to the ${suggestion.action} thesis. Review fresh company, sector, factor, and macro news before acting on the order suggestion.`;

  return {
    title: "No relevant news returned during report run",
    url: null,
    source: "clawfolio:news-ingest",
    publishedAt: null,
    summary,
    symbolContext: articleContext,
    relevanceToSuggestion: articleContext,
    articleContext,
    riskSignal: "neutral",
    relevance: articleContext,
  };
}

export async function attachRelevantNewsToReport(
  report: ClawfolioDailyReport,
): Promise<ClawfolioDailyReport> {
  if (report.suggestions.length === 0) return report;

  const warnings = [...report.warnings];
  const suggestions = await Promise.all(
    report.suggestions.map(async (suggestion) => {
      try {
        const news = await fetchSymbolNews(suggestion);
        const linkedNews = news.length > 0 ? news : [missingNewsEvidence(suggestion)];
        return {
          ...suggestion,
          linkedNews,
          newsContext: linkedNews,
          sources: [
            ...suggestion.sources,
            "news:yahoo-finance-rss",
            "news:google-news-rss",
          ],
        };
      } catch (err) {
        warnings.push(
          `News ingest failed for ${suggestion.symbol}: ${err instanceof Error ? err.message : String(err)}`,
        );
        const linkedNews = [missingNewsEvidence(suggestion)];
        return {
          ...suggestion,
          linkedNews,
          newsContext: linkedNews,
        };
      }
    }),
  );

  return {
    ...report,
    suggestions,
    warnings,
  };
}
