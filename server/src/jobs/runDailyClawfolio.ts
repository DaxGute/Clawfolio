import "dotenv/config";
import path from "node:path";
import {
  AlpacaIngestError,
  pullAndPersistAlpacaSnapshot,
} from "../ingest/alpaca";
import { readInvestorProfile } from "../investorProfile/profile";
import { pacificDateKey } from "../lib/pacificDate";
import { addCashDeploymentSuggestions } from "../models/cashDeployment";
import { runPortfolioModel } from "../models/runPortfolioModel";
import { attachRelevantNewsToReport } from "../news/relevantNews";
import {
  dailyReportPath,
  persistClawfolioReport,
  readDailyReport,
} from "../reports/persist";
import type { ClawfolioDailyReport, ClawfolioInvestorProfile } from "../reports/types";

export type RunDailyClawfolioOptions = {
  force?: boolean;
  dateKey?: string;
  investorProfile?: ClawfolioInvestorProfile;
};

export type RunDailyClawfolioResult = {
  report: ClawfolioDailyReport;
  cached: boolean;
  dateKey: string;
};

type LogLevel = "info" | "warn" | "error";

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const line = meta ? `${message} ${JSON.stringify(meta)}` : message;
  const fn =
    level === "error"
      ? console.error
      : level === "warn"
        ? console.warn
        : console.log;
  fn(`[clawfolio-daily] ${line}`);
}

export async function runDailyClawfolio(
  options: RunDailyClawfolioOptions = {},
): Promise<RunDailyClawfolioResult> {
  const dateKey = options.dateKey ?? pacificDateKey();

  if (!options.force) {
    const existing = await readDailyReport(dateKey);
    if (existing) {
      log("info", "Using cached daily report", { dateKey });
      return { report: existing, cached: true, dateKey };
    }
  }

  log("info", "Running full Clawfolio pipeline", { dateKey, force: !!options.force });

  const { snapshot, paths } = await pullAndPersistAlpacaSnapshot();
  const investorProfile = options.investorProfile ?? await readInvestorProfile();
  const snapshotPath = path.relative(
    process.cwd(),
    paths.dailySnapshotPath,
  );

  const baseReport = runPortfolioModel(snapshot, {
    dateKey,
    sourceSnapshotPath: snapshotPath,
    investorProfile,
  });
  const reportWithCashSuggestions = await addCashDeploymentSuggestions(
    baseReport,
    snapshot,
    investorProfile,
  );
  const report = await attachRelevantNewsToReport(reportWithCashSuggestions);

  const written = await persistClawfolioReport(report);
  log("info", "Daily report written", {
    dateKey,
    latest: written.latestPath,
    daily: written.dailyPath,
    positions: report.positions.length,
    suggestions: report.suggestions.length,
  });

  return { report, cached: false, dateKey };
}

/** Non-blocking startup hook: generate today's report if missing. */
export function scheduleDailyClawfolioOnStartup(): void {
  void runDailyClawfolioIfNeeded().catch((err: unknown) => {
    const message =
      err instanceof AlpacaIngestError
        ? `${err.code}: ${err.message}`
        : err instanceof Error
          ? err.message
          : String(err);
    log("error", "Startup daily run failed", { error: message });
  });
}

export async function runDailyClawfolioIfNeeded(): Promise<RunDailyClawfolioResult | null> {
  const dateKey = pacificDateKey();
  const existing = await readDailyReport(dateKey);
  if (existing) {
    log("info", "Today's report already exists", { dateKey, path: dailyReportPath(dateKey) });
    return { report: existing, cached: true, dateKey };
  }

  log("info", "No report for today — starting pipeline", { dateKey });
  return runDailyClawfolio({ dateKey });
}

async function main(): Promise<void> {
  const force = process.argv.includes("--force");
  const result = await runDailyClawfolio({ force });
  console.log(
    force
      ? `[clawfolio:run] ${result.cached ? "Returned existing" : "Generated"} report for ${result.dateKey}`
      : `[clawfolio:run] ${result.cached ? "Cached" : "Generated"} report for ${result.dateKey}`,
  );
  console.log(`  positions: ${result.report.positions.length}`);
  console.log(`  suggestions: ${result.report.suggestions.length}`);
}

const isMain =
  process.argv[1]?.includes("runDailyClawfolio") ||
  process.argv[1]?.endsWith("runDailyClawfolio.ts");

if (isMain) {
  main().catch((err: unknown) => {
    console.error("[clawfolio:run] Failed:", err);
    process.exitCode = 1;
  });
}
