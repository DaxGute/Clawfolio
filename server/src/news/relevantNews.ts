import type {
  ClawfolioDailyReport,
  ClawfolioLinkedNews,
  ClawfolioSuggestion,
} from "../reports/types";

const NEWS_PER_SYMBOL = 3;
const YAHOO_NEWS_ENDPOINT = "https://feeds.finance.yahoo.com/rss/2.0/headline";

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function readTag(item: string, tag: string): string | null {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1] ?? "") : null;
}

function parseRssItems(xml: string): ClawfolioLinkedNews[] {
  return [...xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)]
    .map((match) => {
      const item = match[1] ?? "";
      const title = readTag(item, "title");
      if (!title) return null;

      return {
        title,
        url: readTag(item, "link"),
        source: readTag(item, "source") ?? "Yahoo Finance",
        publishedAt: readTag(item, "pubDate"),
        relevance: "Current news context attached directly to this order suggestion.",
      } satisfies ClawfolioLinkedNews;
    })
    .filter((item): item is ClawfolioLinkedNews => item !== null)
    .slice(0, NEWS_PER_SYMBOL);
}

async function fetchSymbolNews(symbol: string): Promise<ClawfolioLinkedNews[]> {
  const url = new URL(YAHOO_NEWS_ENDPOINT);
  url.searchParams.set("s", symbol);
  url.searchParams.set("region", "US");
  url.searchParams.set("lang", "en-US");

  const res = await fetch(url, {
    headers: {
      accept: "application/rss+xml, application/xml, text/xml",
      "user-agent": "Clawfolio/0.0.1",
    },
  });

  if (!res.ok) {
    throw new Error(`News fetch failed for ${symbol}: ${res.status}`);
  }

  return parseRssItems(await res.text());
}

function missingNewsEvidence(suggestion: ClawfolioSuggestion): ClawfolioLinkedNews {
  return {
    title: "No relevant news returned during report run",
    url: null,
    source: "clawfolio:news-ingest",
    publishedAt: null,
    relevance: `No article was available to attach to the ${suggestion.action} suggestion for ${suggestion.symbol}; review before placing the order.`,
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
        const news = await fetchSymbolNews(suggestion.symbol);
        return {
          ...suggestion,
          linkedNews: news.length > 0 ? news : [missingNewsEvidence(suggestion)],
          sources: [...suggestion.sources, "news:yahoo-finance-rss"],
        };
      } catch (err) {
        warnings.push(
          `News ingest failed for ${suggestion.symbol}: ${err instanceof Error ? err.message : String(err)}`,
        );
        return {
          ...suggestion,
          linkedNews: [missingNewsEvidence(suggestion)],
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
