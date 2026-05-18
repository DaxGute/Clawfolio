import { Router } from "express";
import { AlpacaIngestError } from "../ingest/alpaca";
import {
  readInvestorProfile,
  writeInvestorProfile,
  normalizeInvestorProfile,
} from "../investorProfile/profile";
import { runDailyClawfolio } from "../jobs/runDailyClawfolio";
import { pacificDateKey } from "../lib/pacificDate";
import { readLatestReport } from "../reports/persist";
import type { ClawfolioDailyReport } from "../reports/types";

export const clawfolioRouter = Router();

function parseForce(value: unknown): boolean {
  if (value === true) return true;
  if (typeof value === "string") {
    return value === "true" || value === "1";
  }
  return false;
}

function reportMeta(report: ClawfolioDailyReport | null) {
  const today = pacificDateKey();
  return {
    dateKey: today,
    hasReport: report !== null,
    isToday: report?.dateKey === today,
    isStale: report !== null && report.dateKey !== today,
  };
}

clawfolioRouter.get("/latest", async (_req, res) => {
  try {
    const report = await readLatestReport();
    res.json({
      report,
      ...reportMeta(report),
    });
  } catch (err) {
    console.error("[clawfolio-api] GET /latest failed:", err);
    res.status(500).json({
      error: {
        code: "READ_FAILED",
        message: err instanceof Error ? err.message : "Could not read latest report.",
      },
    });
  }
});

clawfolioRouter.get("/profile", async (_req, res) => {
  try {
    const profile = await readInvestorProfile();
    res.json({ profile });
  } catch (err) {
    console.error("[clawfolio-api] GET /profile failed:", err);
    res.status(500).json({
      error: {
        code: "READ_FAILED",
        message: err instanceof Error ? err.message : "Could not read investor profile.",
      },
    });
  }
});

clawfolioRouter.put("/profile", async (req, res) => {
  try {
    const profile = await writeInvestorProfile(normalizeInvestorProfile(req.body?.profile));
    res.json({ profile });
  } catch (err) {
    console.error("[clawfolio-api] PUT /profile failed:", err);
    res.status(500).json({
      error: {
        code: "WRITE_FAILED",
        message: err instanceof Error ? err.message : "Could not write investor profile.",
      },
    });
  }
});

clawfolioRouter.post("/run", async (req, res) => {
  const force = parseForce(req.query.force) || parseForce(req.body?.force);
  const investorProfile = req.body?.profile
    ? normalizeInvestorProfile(req.body.profile)
    : undefined;

  try {
    const result = await runDailyClawfolio({ force, investorProfile });
    res.json({
      report: result.report,
      cached: result.cached,
      ...reportMeta(result.report),
    });
  } catch (err) {
    const message =
      err instanceof AlpacaIngestError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Daily run failed";

    console.error("[clawfolio-api] POST /run failed:", err);

    const code =
      err instanceof AlpacaIngestError && err.code === "CONFIG"
        ? "CONFIG"
        : "RUN_FAILED";

    res.status(code === "CONFIG" ? 503 : 500).json({
      error: { code, message },
    });
  }
});
