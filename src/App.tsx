import { HomePage } from "./pages/HomePage";
import { BrokerageSessionProvider } from "./brokerage/BrokerageSessionContext";
import { LaserPointerCursor } from "./components/LaserPointerCursor/LaserPointerCursor";
import "./App.css";

export function App() {
  return (
    <BrokerageSessionProvider>
      <div className="app">
        <LaserPointerCursor />
        <HomePage />
      </div>
    </BrokerageSessionProvider>
  );
}
