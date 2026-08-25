import { PREINDUSTRIAL_OFFSET_C } from "../../domain/climate";
import type { RawAnnualAnomaly, RawMonthlyAnomaly } from "../sources/gistemp";

export function latestMonthlyAnomaly(rows: RawMonthlyAnomaly[]): RawMonthlyAnomaly | null {
  return rows.length ? rows[rows.length - 1] : null;
}

export function warmingVsPreIndustrial(latestAnnual: RawAnnualAnomaly | null): number | null {
  if (!latestAnnual) return null;
  return +(latestAnnual.anomalyC + PREINDUSTRIAL_OFFSET_C).toFixed(2);
}
