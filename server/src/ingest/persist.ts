import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AlpacaIngestPaths, AlpacaIngestSnapshot } from "./types";

const DATA_ROOT = path.join(process.cwd(), "data", "alpaca");

export function resolveAlpacaIngestPaths(asOf: string): AlpacaIngestPaths {
  const dateKey = asOf.slice(0, 10);
  return {
    latestPath: path.join(DATA_ROOT, "latest.json"),
    dailySnapshotPath: path.join(DATA_ROOT, "snapshots", `${dateKey}.json`),
  };
}

async function writeSnapshotFile(
  filePath: string,
  snapshot: AlpacaIngestSnapshot,
): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
}

export async function persistAlpacaSnapshot(
  snapshot: AlpacaIngestSnapshot,
): Promise<AlpacaIngestPaths> {
  const paths = resolveAlpacaIngestPaths(snapshot.asOf);
  await Promise.all([
    writeSnapshotFile(paths.latestPath, snapshot),
    writeSnapshotFile(paths.dailySnapshotPath, snapshot),
  ]);
  return paths;
}
