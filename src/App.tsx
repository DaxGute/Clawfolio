import { useEffect } from "react";
import { PortfolioHealth } from "./modules/PortfolioHealth/PortfolioHealth";
import { GrowthGraph } from "./modules/GrowthGraph/GrowthGraph";
import { DailySuggestions } from "./modules/DailySuggestions/DailySuggestions";
import { InvestingPersonality } from "./modules/InvestingPersonality/InvestingPersonality";
import "./App.css";

function formatPortfolioTitle(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function App() {
  const title = `${formatPortfolioTitle(new Date())} Portfolio`;

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">{title}</h1>
        <p className="app-subtitle">
          Click on any of the suggestions or positions to get more context
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
    </div>
  );
}
