import type { TemporalMode } from "../../domain/climate";

export const CHART_TITLE = "Temperature anomaly, CO₂ & sea level";

export const TEMPORAL_MODES: { mode: TemporalMode; label: string }[] = [
  { mode: "weeks", label: "Week" },
  { mode: "months", label: "Month" },
  { mode: "years", label: "Year" },
];

export const modeCopy: Record<TemporalMode, { title: string; sub: string; note: string }> = {
  years: {
    title: "Temperature anomaly vs. atmospheric CO₂",
    sub: "Annual means · 2000–2026 · projection to 2030",
    note: "Reference line: +1.5°C Paris threshold",
  },
  months: {
    title: "Seasonal ice melt & ocean heat cycle",
    sub: "Monthly means · 60-month window",
    note: "Month-over-month (MoM) deltas shown",
  },
  weeks: {
    title: "Short-term anomalies & methane events",
    sub: "Daily points with 7-day moving average · last 120 days",
    note: "Week-over-week (WoW) deltas shown",
  },
};

export function deltaLabelFor(mode: TemporalMode): string {
  return mode === "years" ? "YoY" : mode === "months" ? "MoM" : "WoW";
}
