import { useEffect } from "react";
import { BrokerageConnectDropdown } from "../components/BrokerageConnectDropdown/BrokerageConnectDropdown";
import { PortfolioHealth } from "../modules/PortfolioHealth/PortfolioHealth";
import { GrowthGraph } from "../modules/GrowthGraph/GrowthGraph";
import { DailySuggestions } from "../modules/DailySuggestions/DailySuggestions";
import { InvestingPersonality } from "../modules/InvestingPersonality/InvestingPersonality";

function formatPortfolioTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function HomePage() {
  const title = `${formatPortfolioTitle(new Date())} Portfolio`;

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <>
      <header className="app-header">
        <div className="app-header-toolbar">
          <div className="app-connect-brokerage">
            <BrokerageConnectDropdown />
          </div>
          <p className="app-subtitle">
            Click on any of the suggestions or positions to get more context
          </p>
        </div>
        <h1 className="app-title">{title}</h1>
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
