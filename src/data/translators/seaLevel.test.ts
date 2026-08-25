import { describe, expect, it } from "vitest";
import { buildQuarterLookup, latestVsBaseline } from "./seaLevel";
import type { RawSeaLevelQuarter } from "../sources/seaLevelOwid";

function quarters(years: number[], mmPerYear: number[]): RawSeaLevelQuarter[] {
  return years.map((year, i) => ({ year, quarter: 1, mm: mmPerYear[i] }));
}

// 10mm/year rise from a 2000 baseline of 0
const YEARS = [2000, 2001, 2002, 2003, 2004];
const MM = [0, 10, 20, 30, 40];

describe("buildQuarterLookup", () => {
  it("rebases values against the baseline-year mean", () => {
    const q = buildQuarterLookup(quarters(YEARS, MM));
    expect(q.get(2000, 1)).toBeCloseTo(0, 10);
    expect(q.get(2002, 7)).toBeCloseTo(20, 10);
  });

  it("throws when the baseline year is missing", () => {
    expect(() => buildQuarterLookup(quarters([2001], [5]))).toThrow(/baseline/);
  });

  it("extrapolates beyond the last observation using recent slope (no upper clamp)", () => {
    const q = buildQuarterLookup(quarters(YEARS, MM));
    // slope over last decade ≈ 10/yr → 2.5/quarter; 5 quarters past end
    const expected = 40 + 5 * 2.5;
    expect(q.get(2006, 1)).toBeCloseTo(expected, 6);
    // monotonic growth past the end — regression guard for the clamp bug
    expect(q.get(2007, 1)).toBeGreaterThan(q.get(2006, 1));
  });
});

describe("latestVsBaseline", () => {
  it("returns the latest rebased value", () => {
    const qs = quarters(YEARS, MM);
    const q = buildQuarterLookup(qs);
    const res = latestVsBaseline(qs, q);
    expect(res?.valueMmVs2000).toBe(40);
    expect(res?.latest.year).toBe(2004);
  });

  it("returns null for empty input", () => {
    const qs: RawSeaLevelQuarter[] = [];
    expect(latestVsBaseline(qs, buildQuarterLookup(quarters(YEARS, MM)))).toBeNull();
  });
});
