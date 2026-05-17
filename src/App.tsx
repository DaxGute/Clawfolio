import { HomePage } from "./pages/HomePage";
import { BrokerageSessionProvider } from "./brokerage/BrokerageSessionContext";
import {
  ClawfolioReportProvider,
  useClawfolioReport,
} from "./context/ClawfolioReportContext";
import { LaserPointerCursor } from "./components/LaserPointerCursor/LaserPointerCursor";
import "./App.css";

function RunReportButton() {
  const { running, error, refresh } = useClawfolioReport();

  return (
    <button
      type="button"
      className={`app-run-report${running ? " app-run-report--loading" : ""}`}
      onClick={() => {
        void refresh(true);
      }}
      disabled={running}
      aria-busy={running}
      title="Fetch latest Alpaca data and run a fresh Clawfolio report"
    >
      <span className="app-run-report__label">
        {running ? "Running" : "Run"}
      </span>
      {error ? <span className="app-run-report__dot" aria-hidden="true" /> : null}
      <span
        className="app-run-report__progress"
        role="progressbar"
        aria-hidden={!running}
        aria-valuetext={running ? "Running report" : undefined}
      >
        <span className="app-run-report__progress-bar" />
      </span>
    </button>
  );
}

export function App() {
  return (
    <BrokerageSessionProvider>
      <ClawfolioReportProvider>
        <div className="app">
          <LaserPointerCursor />
          <HomePage />
          <RunReportButton />
        </div>
      </ClawfolioReportProvider>
    </BrokerageSessionProvider>
  );
}
