import { getText } from "./http";

const FIRMS = import.meta.env.DEV ? "/proxy/firms" : "https://firms.modaps.eosdis.nasa.gov";

export function firmsMapKey(): string {
  return (import.meta.env.VITE_FIRMS_MAP_KEY as string | undefined) ?? "";
}

export type RawHotspotCount = { count: number; source: string; dayRange: number };

export async function fetchFirmsRaw(bboxWestSouthEastNorth: string, dayRange = 2, signal?: AbortSignal): Promise<RawHotspotCount> {
  const key = firmsMapKey();
  if (!key) throw new Error("VITE_FIRMS_MAP_KEY not set");
  const url = `${FIRMS}/api/area/csv/${key}/VIIRS_SNPP_NRT/${bboxWestSouthEastNorth}/${dayRange}`;
  const text = await getText(url, { timeoutMs: 30000, signal });
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length || !/^latitude/i.test(lines[0])) throw new Error("unexpected FIRMS response");
  return { count: lines.length - 1, source: "VIIRS S-NPP", dayRange };
}
