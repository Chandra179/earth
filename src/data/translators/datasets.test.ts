import { describe, expect, it } from "vitest";
import type { RawAnnualValue, RawMonthlyValue } from "../sources/noaaGml";
import type { RawAnnualAnomaly, RawMonthlyAnomaly } from "../sources/gistemp";
import type { RawSeaLevelQuarter } from "../sources/seaLevelOwid";
import { translateMonths, translateYears } from "./datasets";

const ANNUAL_YEARS = [2000, 2001, 2002];
const tempsAnnual: RawAnnualAnomaly[] = ANNUAL_YEARS.map((year, i) => ({ year, anomalyC: i * 0.1 }));
const co2Annual: RawAnnualValue[] = ANNUAL_YEARS.map((year, i) => ({ year, value: 370 + i }));

const MONTH_KEYS = ["2020-01", "2020-02", "2020-03", "2020-04"];
const tempsMonthly: RawMonthlyAnomaly[] = MONTH_KEYS.map((_k, i) => ({ year: 2020, month: i + 1, anomalyC: i }));
const co2Monthly: RawMonthlyValue[] = MONTH_KEYS.map((_k, i) => ({ year: 2020, month: i + 1, value: 410 + i }));
const slQuarters: RawSeaLevelQuarter[] = [
  { year: 1999, quarter: 1, mm: 10 },
  ...ANNUAL_YEARS.map((y) => ({ year: y, quarter: 1, mm: 20 + (y - 2000) })),
  { year: 2020, quarter: 1, mm: 50 },
  { year: 2021, quarter: 1, mm: 60 },
];

describe("translateYears", () => {
  it("aligns providers on their common years and appends a projection", () => {
    const ds = translateYears({ tempsAnnual, co2Annual, quarters: slQuarters });
    expect(ds).not.toBeNull();
    expect(ds!.points.map((p) => p.label)).toEqual(["2000", "2001", "2002"]);
    expect(ds!.points[1]).toMatchObject({ tempAnomalyC: 0.1, co2Ppm: 371, seaLevelMmVs2000: 1 });
    expect(ds!.projection).toHaveLength(4);
    expect(ds!.projection.every((p) => p.projection === true && p.year > 2002)).toBe(true);
    expect(ds!.threshold).toBe(true);
  });

  it("restricts years to the provider overlap", () => {
    const shortCo2 = co2Annual.filter((r) => r.year <= 2001);
    const ds = translateYears({ tempsAnnual, co2Annual: shortCo2, quarters: slQuarters });
    expect(ds!.points).toHaveLength(2);
  });

  it("returns null when any required input is missing", () => {
    expect(translateYears({ tempsAnnual: [], co2Annual, quarters: slQuarters })).toBeNull();
    expect(translateYears({ co2Annual, quarters: slQuarters })).toBeNull();
    expect(translateYears({ tempsAnnual, co2Annual })).toBeNull();
  });
});

describe("translateMonths", () => {
  it("builds month-keyed points within the requested window", () => {
    const ds = translateMonths({ tempsMonthly, co2Monthly, quarters: slQuarters });
    expect(ds).not.toBeNull();
    expect(ds!.points).toHaveLength(4);
    expect(ds!.points[0]).toMatchObject({ key: "2020-01", label: "Jan '20", tempAnomalyC: 0, co2Ppm: 410 });
    expect(ds!.threshold).toBe(false);
  });

  it("returns null when there is no overlapping month", () => {
    const other = co2Monthly.map((r) => ({ ...r, year: 1990 }));
    expect(translateMonths({ tempsMonthly, co2Monthly: other, quarters: slQuarters })).toBeNull();
  });

  it("returns null when inputs are missing", () => {
    expect(translateMonths({ tempsMonthly, quarters: slQuarters })).toBeNull();
  });
});
