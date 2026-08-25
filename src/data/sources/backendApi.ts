import type { RegionMetric } from "../../domain/climate";
import { getJson } from "./http";

export interface SheetStats {
  trendGtPerYear: number;
  cumulativeGt: number;
  lastDate: string;
}

export interface IceMassResponse {
  updatedAt: string;
  source: string;
  greenland: SheetStats;
  antarctica: SheetStats;
}

export interface RegionsResponse {
  updatedAt: string;
  rows: { region: string; row: RegionMetric }[];
}

/**
 * Our own Go backend (backend/) — GRACE/GRACE-FO ice-sheet mass balance
 * processed from the JPL Tellus series, plus Open-Meteo-derived regional
 * indicators. Served same-origin via the dev proxy (/api) or a reverse
 * proxy in production.
 */
export async function fetchIceMass(signal?: AbortSignal): Promise<IceMassResponse> {
  return getJson<IceMassResponse>("/api/v1/ice-mass", { signal });
}

export async function fetchRegionRows(signal?: AbortSignal): Promise<RegionsResponse> {
  return getJson<RegionsResponse>("/api/v1/regions", { signal });
}
