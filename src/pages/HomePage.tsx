import { useEffect } from "react";
import { BrokerageConnectDropdown } from "../components/BrokerageConnectDropdown/BrokerageConnectDropdown";
import { useClawfolioReport } from "../context/ClawfolioReportContext";
import { formatLastRun } from "../lib/lastRun";
import { PortfolioHealth } from "../modules/PortfolioHealth/PortfolioHealth";
import { GrowthGraph } from "../modules/GrowthGraph/GrowthGraph";
import { DailySuggestions } from "../modules/DailySuggestions/DailySuggestions";
import { InvestingPersonality } from "../modules/InvestingPersonality/InvestingPersonality";

/** Set true when brokerage OAuth UI should appear in the header again. */
const SHOW_BROKERAGE_CONNECT = false;

function formatPortfolioTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function HomePage() {
  const { lastRunAt, isStaleRun, running } = useClawfolioReport();
  const dateLabel = formatPortfolioTitle(new Date());
  const portfolioSuffix = isStaleRun ? "*" : "";
  const title = `${dateLabel} Portfolio${portfolioSuffix}`;
  const lastRunLabel = running ? "Running…" : `Last run ${formatLastRun(lastRunAt)}`;

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <>
      <header className="app-header">
        {SHOW_BROKERAGE_CONNECT ? (
          <div className="app-header-toolbar">
            <div className="app-connect-brokerage">
              <BrokerageConnectDropdown />
            </div>
          </div>
        ) : null}
        <h1 className="app-title">{title}</h1>
        <p className="app-last-run" title={lastRunAt ?? undefined}>
          {lastRunLabel}
        </p>
      </header>

      <main className="app-grid">
        <section className="app-col app-col--left">
          <PortfolioHealth />
        </section>
        <section className="app-col app-col--center">
          <GrowthGraph />
          <DailySuggestions />
        </section>
        <section className="app-col app-col--right">
          <InvestingPersonality />
        </section>
      </main>
    </>
  );
}
