import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSeriesWithReturns } from "./periodReturns";

describe("buildSeriesWithReturns", () => {
  it("computes cumulative and period returns from value series", () => {
    const result = buildSeriesWithReturns(
      [
        { date: "2026-01-02", value: 100 },
        { date: "2026-01-09", value: 105 },
        { date: "2026-01-16", value: 110 },
      ],
      "3m",
    );

    assert.equal(result.points[0].cumulativeReturnPct, 0);
    assert.equal(result.points[2].cumulativeReturnPct, 10);
    assert.ok(result.periodReturns.length >= 2);
    assert.equal(result.totalReturnPct, 10);
  });
});
