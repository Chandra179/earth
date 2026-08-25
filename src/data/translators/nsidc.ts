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
