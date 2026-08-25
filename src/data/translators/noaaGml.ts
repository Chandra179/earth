import type { RawAnnualValue, RawMonthlyValue } from "../sources/noaaGml";
import type { Trend } from "../../domain/climate";

export function latestMonthlyValue(rows: RawMonthlyValue[]): RawMonthlyValue | null {
  return rows.length ? rows[rows.length - 1] : null;
}

export function growthTrend(rows: RawAnnualValue[]): Trend | undefined {
  if (!rows.length) return undefined;
  return rows[rows.length - 1].value > 0.05 ? "up" : "flat";
}
