import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ClawfolioInvestorProfile } from "../reports/types";

const PROFILE_PATH = path.join(process.cwd(), "data", "clawfolio", "investor-profile.json");

const timeHorizons = ["Short-Term", "Medium-Term", "Long-Term", "Generational"] as const;
const riskAppetites = ["Conservative", "Balanced", "Aggressive", "Speculative"] as const;
const tradingFrequencies = [
  "Day Trader",
  "Swing Trader",
  "Position Trader",
  "Long-Term Holder",
] as const;
const philosophies = ["Value", "Growth", "Momentum", "Quality", "Income", "Macro", "Index"] as const;

export const DEFAULT_INVESTOR_PROFILE: ClawfolioInvestorProfile = {
  timeHorizon: "Medium-Term",
  riskAppetite: "Conservative",
  tradingFrequency: "Position Trader",
  philosophy: "Macro",
  sectorFocus: [],
  sectorBlacklist: [],
};

function oneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fallback: T[number],
): T[number] {
  return typeof value === "string" && allowed.includes(value) ? value : fallback;
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean),
  )].slice(0, 12);
}

export function normalizeInvestorProfile(value: unknown): ClawfolioInvestorProfile {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    timeHorizon: oneOf(row.timeHorizon, timeHorizons, DEFAULT_INVESTOR_PROFILE.timeHorizon),
    riskAppetite: oneOf(row.riskAppetite, riskAppetites, DEFAULT_INVESTOR_PROFILE.riskAppetite),
    tradingFrequency: oneOf(
      row.tradingFrequency,
      tradingFrequencies,
      DEFAULT_INVESTOR_PROFILE.tradingFrequency,
    ),
    philosophy: oneOf(row.philosophy, philosophies, DEFAULT_INVESTOR_PROFILE.philosophy),
    sectorFocus: normalizeTags(row.sectorFocus),
    sectorBlacklist: normalizeTags(row.sectorBlacklist),
  };
}

export async function readInvestorProfile(): Promise<ClawfolioInvestorProfile> {
  try {
    const raw = await readFile(PROFILE_PATH, "utf8");
    return normalizeInvestorProfile(JSON.parse(raw));
  } catch {
    return DEFAULT_INVESTOR_PROFILE;
  }
}

export async function writeInvestorProfile(
  profile: ClawfolioInvestorProfile,
): Promise<ClawfolioInvestorProfile> {
  const normalized = normalizeInvestorProfile(profile);
  await mkdir(path.dirname(PROFILE_PATH), { recursive: true });
  await writeFile(PROFILE_PATH, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
  return normalized;
}
