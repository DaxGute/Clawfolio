import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { analyzeCoverage } from "./coverage";
import type { PortfolioHistoryPoint } from "./types";

function point(date: string): PortfolioHistoryPoint {
  return {
    id: date,
    source: "alpaca",
    accountId: "acc",
    date,
    equity: 10_000,
    profitLoss: 0,
    profitLossPct: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("analyzeCoverage", () => {
  it("marks complete at 100% when only weekends are missing at the end", () => {
    const asOf = new Date("2026-05-17T20:00:00.000Z"); // Saturday
    const points = [
      point("2026-05-11"),
      point("2026-05-12"),
      point("2026-05-13"),
      point("2026-05-14"),
      point("2026-05-15"),
    ];

    const analysis = analyzeCoverage(
      { start: "2026-05-11", end: "2026-05-17" },
      points,
      asOf,
    );

    assert.equal(analysis.isComplete, true);
    assert.equal(analysis.coveragePct, 100);
    assert.equal(analysis.fetchableWindows.length, 0);
  });

  it("does not backfill isolated sparse provider gaps", () => {
    const asOf = new Date("2026-05-18T20:00:00.000Z");
    const analysis = analyzeCoverage(
      { start: "2026-05-11", end: "2026-05-18" },
      [
        point("2026-05-11"),
        point("2026-05-12"),
        point("2026-05-14"),
        point("2026-05-15"),
        point("2026-05-18"),
      ],
      asOf,
    );

    assert.equal(analysis.isComplete, true);
    assert.equal(analysis.coveragePct, 100);
    assert.equal(analysis.fetchableWindows.length, 0);
  });

  it("still backfills meaningful internal gaps", () => {
    const asOf = new Date("2026-05-18T20:00:00.000Z");
    const analysis = analyzeCoverage(
      { start: "2026-05-04", end: "2026-05-18" },
      [
        point("2026-05-04"),
        point("2026-05-05"),
        point("2026-05-11"),
        point("2026-05-12"),
        point("2026-05-18"),
      ],
      asOf,
    );

    assert.equal(analysis.isComplete, false);
    assert.deepEqual(analysis.fetchableWindows, [
      { start: "2026-05-06", end: "2026-05-08" },
      { start: "2026-05-13", end: "2026-05-15" },
    ]);
  });
});
