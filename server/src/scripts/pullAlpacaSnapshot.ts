import "dotenv/config";
import {
  AlpacaIngestError,
  pullAndPersistAlpacaSnapshot,
} from "../ingest/alpaca";

async function main(): Promise<void> {
  const { snapshot, paths } = await pullAndPersistAlpacaSnapshot();

  console.log("[alpaca:pull] Done.");
  console.log(`  asOf: ${snapshot.asOf}`);
  console.log(`  positions: ${snapshot.positions.length}`);
  console.log(`  openOrders: ${snapshot.openOrders.length}`);
  console.log(`  recentActivities: ${snapshot.recentActivities.length}`);
  console.log(`  latest: ${paths.latestPath}`);
  console.log(`  daily: ${paths.dailySnapshotPath}`);
}

main().catch((err: unknown) => {
  if (err instanceof AlpacaIngestError) {
    console.error(`[alpaca:pull] ${err.code}: ${err.message}`);
    process.exitCode = 1;
    return;
  }

  console.error("[alpaca:pull] Unexpected error:", err);
  process.exitCode = 1;
});
