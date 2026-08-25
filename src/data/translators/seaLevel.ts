import { SEA_LEVEL_BASELINE_YEAR } from "../../domain/climate";
import type { RawSeaLevelQuarter } from "../sources/seaLevelOwid";
import { olsSlope } from "./series";

export type QuarterLookup = {
  get: (year: number, month: number) => number;
  lastQIndex: number;
};

export function buildQuarterLookup(quarters: RawSeaLevelQuarter[], baselineYear = SEA_LEVEL_BASELINE_YEAR): QuarterLookup {
  const byQ = new Map<number, number>();
  const acc = new Map<number, number[]>();
  for (const q of quarters) {
    const arr = acc.get(q.year) ?? [];
    arr.push(q.mm);
    acc.set(q.year, arr);
  }
  const baseVals = acc.get(baselineYear);
  if (!baseVals || !baseVals.length) throw new Error("sea level baseline year missing");
  const base = baseVals.reduce((a, b) => a + b, 0) / baseVals.length;
  for (const [year, arr] of acc) {
    const v = arr.reduce((a, b) => a + b, 0) / arr.length;
    for (let qq = 0; qq < 4; qq++) byQ.set(year * 4 + qq, v - base);
  }
  const lastYear = Math.max(...acc.keys());
  const tail: number[] = [];
  for (let y = lastYear - 10; y <= lastYear; y++) {
    const arr = acc.get(y);
    if (arr?.length) tail.push(arr.reduce((a, b) => a + b, 0) / arr.length);
  }
  const slopePerQuarter = olsSlope(tail) / 4;
  const lastQIndex = lastYear * 4 + 3;
  return {
    get(year: number, month: number) {
      const qi = Math.max(year * 4 + Math.floor((month - 1) / 3), 0);
      if (byQ.has(qi)) return byQ.get(qi)!;
      return byQ.get(lastQIndex)! + (qi - lastQIndex) * slopePerQuarter;
    },
    lastQIndex,
  };
}

export function latestVsBaseline(
  quarters: RawSeaLevelQuarter[],
  lookup: QuarterLookup,
): { valueMmVs2000: number; latest: RawSeaLevelQuarter } | null {
  if (!quarters.length) return null;
  const latest = quarters[quarters.length - 1];
  return { valueMmVs2000: +lookup.get(latest.year, latest.quarter * 3).toFixed(1), latest };
}
