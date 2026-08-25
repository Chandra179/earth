import type { RawSeaIceDay } from "../sources/nsidcSeaIce";
import type { RegionMetric } from "../../domain/climate";

export function medianForDate(data: RawSeaIceDay[], month: number, day: number, y0: number, y1: number): number | null {
  const vals = data
    .filter((d) => d.month === month && d.day === day && d.year >= y0 && d.year <= y1)
    .map((d) => d.extentMkm2);
  if (!vals.length) return null;
  vals.sort((a, b) => a - b);
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
}

export type IceStatus = { badge: "critical" | "elevated" | "stable"; text: string };

export function iceStatus(latest: RawSeaIceDay, data: RawSeaIceDay[]): IceStatus {
  const med = medianForDate(data, latest.month, latest.day, 1981, 2010);
  if (med == null) return { badge: "stable", text: "no median ref" };
  if (latest.extentMkm2 < med * 0.92) return { badge: "critical", text: "well below median" };
  if (latest.extentMkm2 < med) return { badge: "elevated", text: "below median" };
  return { badge: "stable", text: "at/above median" };
}

export function seaIceRegionRow(latest: RawSeaIceDay, data: RawSeaIceDay[]): RegionMetric {
  const st = iceStatus(latest, data);
  const iso = `${latest.year}-${String(latest.month).padStart(2, "0")}-${String(latest.day).padStart(2, "0")}`;
  return {
    name: "Sea ice extent",
    metric: latest.extentMkm2.toFixed(2) + "M km²",
    sub: `daily ${iso} · NSIDC`,
    badge: st.badge,
    badgeText: st.text,
  };
}

/**
 * Long-term September-extent trend in %/decade (OLS over yearly September
 * means). Needs ≥20 years of coverage; null otherwise. This is the
 * headline Arctic decline metric (≈ −12%/decade since 1979).
 */
export function septemberTrendPctPerDecade(data: RawSeaIceDay[]): number | null {
  const byYear = new Map<number, number[]>();
  for (const d of data) {
    if (d.month !== 9 || d.extentMkm2 <= 0) continue;
    const vals = byYear.get(d.year) ?? [];
    vals.push(d.extentMkm2);
    byYear.set(d.year, vals);
  }
  const series = [...byYear.entries()]
    .filter(([, vals]) => vals.length >= 5)
    .map(([year, vals]) => ({ year, extent: vals.reduce((a, b) => a + b, 0) / vals.length }))
    .sort((a, b) => a.year - b.year);
  if (series.length < 20) return null;

  const n = series.length;
  const sx = series.reduce((a, p) => a + p.year, 0);
  const sy = series.reduce((a, p) => a + p.extent, 0);
  const sxx = series.reduce((a, p) => a + p.year * p.year, 0);
  const sxy = series.reduce((a, p) => a + p.year * p.extent, 0);
  const den = n * sxx - sx * sx;
  if (!den) return null;
  const slopePerYear = (n * sxy - sx * sy) / den;

  const baseline =
    series.slice(0, 10).reduce((a, p) => a + p.extent, 0) / Math.min(10, series.length);
  if (!baseline) return null;
  return ((slopePerYear / baseline) * 100) * 10;
}
