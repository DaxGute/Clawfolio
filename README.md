<img width="1728" height="989" alt="Screenshot 2026-05-17 at 6 08 54 PM" src="https://github.com/user-attachments/assets/712fd1af-0ba5-459d-a1ee-6f45545d65ac" />
<img width="807" height="884" alt="Screenshot 2026-05-17 at 6 09 16 PM" src="https://github.com/user-attachments/assets/5aa2b3d6-b384-45d7-aa09-8c5c7b805727" />
# Clawfolio

Clawfolio is a portfolio intelligence system built around explainable, evidence-driven investment analysis.

Rather than functioning as a black-box trading bot, Clawfolio is designed to:

* Aggregate portfolio + market context
* Analyze positions using transparent scoring systems
* Interpret news and macro conditions
* Generate structured BUY / SELL suggestions
* Track portfolio health over time
* Produce dashboard-ready outputs and reports

The goal is not blind automation.
The goal is decision support with visibility into *why* a recommendation exists.

---

# Philosophy

Clawfolio is portfolio-centric rather than purely market-centric.

A traditional market agent asks:

> “What should be traded right now?”

Clawfolio instead asks:

> “Given *this* portfolio, *this* allocation, *this* risk profile, and *this* market environment, what action best improves the portfolio?”

That distinction matters.

The same stock can be:

* a BUY for one portfolio
* a HOLD for another
* a SELL for a third

Clawfolio attempts to reason from the perspective of the portfolio itself.

---

# Core Features

## Portfolio Ingestion

Clawfolio currently supports:

* Alpaca brokerage integration
* Historical portfolio snapshots
* Daily portfolio state persistence
* Position normalization
* Equity and buying power tracking

The system is designed so additional brokers and custodians can later be added.

---

## Portfolio Health Scoring

Each position can be analyzed across multiple dimensions:

* Conviction
* Volatility
* Drawdown risk
* News sentiment
* Concentration risk
* Technical trend alignment
* Liquidity
* Portfolio exposure
* Macro sensitivity

Scores are combined into explainable health metrics.

---

## News + Context Interpretation

Clawfolio is not just price-action based.

It incorporates:

* Company news
* Earnings events
* Macro conditions
* Sector movement
* Narrative shifts
* Market regime context

The intent is to connect portfolio behavior with real-world catalysts.

---

## Structured Recommendations

Clawfolio produces standardized recommendation outputs.

Examples:

```json
{
  "symbol": "NVDA",
  "action": "BUY",
  "confidence": 0.82,
  "reasoning": [
    "Strong momentum continuation",
    "AI infrastructure demand remains elevated",
    "Portfolio currently underweight semiconductors"
  ]
}
```

Recommendations are intentionally explainable rather than opaque.

---

## Dashboard-Ready Reports

Clawfolio generates structured JSON outputs for:

* Frontend dashboards
* Historical analysis
* Portfolio timelines
* Suggestion feeds
* Position summaries
* Daily reports

This allows the analysis layer and visualization layer to evolve independently.

---

# Architecture

## High-Level Flow

```text
Broker API
    ↓
Portfolio Snapshot
    ↓
Normalization Layer
    ↓
Scoring + Analysis Engine
    ↓
News / Context Evaluation
    ↓
Recommendation Generation
    ↓
Structured Reports
    ↓
Dashboard / UI
```

---

# Current Stack

## Backend

* Node.js
* TypeScript
* Express
* Scheduled jobs / cron workflows

## Market + Portfolio Data

* Alpaca API
* News aggregation sources
* Market data providers

## Frontend

* React
* Dashboard-oriented visualization system

## Storage

* Local JSON persistence
* Historical snapshot directories

---

# Project Structure

```text
server/
  src/
    ingest/
    jobs/
    analysis/
    reports/
    api/

data/
  alpaca/
  reports/

src/
```

---

# Example Workflow

## Pull Latest Portfolio Snapshot

```bash
npm run alpaca:pull
```

## Run Full Clawfolio Analysis

```bash
npm run clawfolio:daily
```

## Launch Development Environment

```bash
npm run dev
```


---

# Disclaimer

Clawfolio is an experimental portfolio intelligence project.

It is not financial advice.
All recommendations should be independently evaluated before execution.

---

# License

MIT License
