import { describe, expect, it } from "vitest";
import { meanLastDiff, olsSlope, ym } from "./series";

describe("olsSlope", () => {
  it("returns exact slope for a linear series", () => {
    expect(olsSlope([10, 20, 30, 40])).toBeCloseTo(10, 10);
  });

  it("returns 0 for a constant series", () => {
    expect(olsSlope([5, 5, 5])).toBe(0);
  });

  it("returns 0 when fewer than two points", () => {
    expect(olsSlope([])).toBe(0);
    expect(olsSlope([7])).toBe(0);
  });
});

describe("meanLastDiff", () => {
  it("averages the last n deltas", () => {
    expect(meanLastDiff([0, 1, 2, 3, 10], 2)).toBeCloseTo(4, 10);
  });

  it("uses the whole series when shorter than n+1", () => {
    expect(meanLastDiff([1, 3], 5)).toBe(2);
  });

  it("does not divide by zero on a single point", () => {
    expect(meanLastDiff([4], 3)).toBe(0);
  });
});

describe("ym", () => {
  it("zero-pads the month", () => {
    expect(ym(2024, 1)).toBe("2024-01");
    expect(ym(2024, 12)).toBe("2024-12");
  });
});
