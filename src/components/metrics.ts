import type { ClimatePoint } from "../domain/climate";

export type MetricKey = "temp" | "co2" | "sl";

export type MetricDef = {
  key: MetricKey;
  color: string;
  bandFrac: number;
  areaFromOpacity: number;
  strokeWidth: number;
  drawDelaySec: number;
  value: (p: ClimatePoint) => number;
  endLabel: (p: ClimatePoint) => string;
  tooltipName: string;
  tooltipValue: (p: ClimatePoint) => string;
  deltaText: (p: ClimatePoint, since: ClimatePoint) => string;
  srHeader: string;
  srCell: (p: ClimatePoint) => string;
};

const signed = (v: number) => (v >= 0 ? "+" : "");

/** Single source of truth for every per-metric chart behavior. */
export const METRICS: MetricDef[] = [
  {
    key: "temp",
    color: "var(--danger)",
    bandFrac: 0.09,
    areaFromOpacity: 0.16,
    strokeWidth: 2.2,
    drawDelaySec: 0.1,
    value: (p) => p.tempAnomalyC,
    endLabel: (p) => "+" + p.tempAnomalyC.toFixed(2) + "°C",
    tooltipName: "Temp anomaly",
    tooltipValue: (p) => "+" + p.tempAnomalyC.toFixed(2) + "°C",
    deltaText: (p, s) => signed(p.tempAnomalyC - s.tempAnomalyC) + (p.tempAnomalyC - s.tempAnomalyC).toFixed(2) + "°C",
    srHeader: "Temp anomaly °C",
    srCell: (p) => "+" + p.tempAnomalyC.toFixed(2),
  },
  {
    key: "co2",
    color: "var(--accent)",
    bandFrac: 0.055,
    areaFromOpacity: 0.14,
    strokeWidth: 2.2,
    drawDelaySec: 0.05,
    value: (p) => p.co2Ppm,
    endLabel: (p) => p.co2Ppm.toFixed(1) + " ppm",
    tooltipName: "CO₂",
    tooltipValue: (p) => p.co2Ppm.toFixed(1) + " ppm",
    deltaText: (p, s) => {
      const pct = ((p.co2Ppm - s.co2Ppm) / s.co2Ppm) * 100;
      return signed(pct) + pct.toFixed(1) + "% CO₂";
    },
    srHeader: "CO₂ ppm",
    srCell: (p) => p.co2Ppm.toFixed(1),
  },
  {
    key: "sl",
    color: "var(--success)",
    bandFrac: 0.2,
    areaFromOpacity: 0.16,
    strokeWidth: 2.2,
    drawDelaySec: 0,
    value: (p) => p.seaLevelMmVs2000,
    endLabel: (p) => "+" + p.seaLevelMmVs2000.toFixed(1) + " mm",
    tooltipName: "Sea level",
    tooltipValue: (p) => "+" + p.seaLevelMmVs2000.toFixed(1) + " mm",
    deltaText: (p, s) => "+" + (p.seaLevelMmVs2000 - s.seaLevelMmVs2000).toFixed(1) + " mm",
    srHeader: "Sea level mm",
    srCell: (p) => "+" + p.seaLevelMmVs2000.toFixed(1),
  },
];

export const METRIC_BY_KEY: Record<MetricKey, MetricDef> = Object.fromEntries(
  METRICS.map((m) => [m.key, m]),
) as Record<MetricKey, MetricDef>;
