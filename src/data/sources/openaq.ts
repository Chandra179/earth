import { getJson } from "./http";

const OPENAQ = import.meta.env.DEV ? "/proxy/openaq/v3" : "https://api.openaq.org/v3";

export function openaqApiKey(): string {
  return (import.meta.env.VITE_OPENAQ_API_KEY as string | undefined) ?? "";
}

type LocationResponse = {
  results: {
    id: number;
    name: string;
    sensors: { id: number; parameter: { name: string } }[];
  }[];
};

type LatestResponse = {
  results: { sensorsId: number; value: number; datetimeFrom?: { utc?: string } }[];
};

export type RawPm25Reading = { valueUgM3: number; stations: number; asOf: string };

export async function fetchOpenAqPm25Raw(bboxLonLatLonLat: string, maxStations = 6): Promise<RawPm25Reading> {
  const key = openaqApiKey();
  if (!key) throw new Error("VITE_OPENAQ_API_KEY not set");
  const headers = { "X-API-Key": key };
  const locs = await getJson<LocationResponse>(
    `${OPENAQ}/locations?bbox=${bboxLonLatLonLat}&limit=100`,
    15000,
    headers,
  );
  const wanted: { locationId: number; sensorId: number }[] = [];
  for (const loc of locs.results ?? []) {
    const pm25 = loc.sensors?.find((s) => s.parameter?.name === "pm25");
    if (pm25 && wanted.length < maxStations) wanted.push({ locationId: loc.id, sensorId: pm25.id });
  }
  if (!wanted.length) throw new Error("no pm25 locations in bbox");
  const values: number[] = [];
  let asOf = "";
  for (const w of wanted) {
    try {
      const latest = await getJson<LatestResponse>(`${OPENAQ}/locations/${w.locationId}/latest`, 12000, headers);
      const hit = latest.results?.find((r) => r.sensorsId === w.sensorId);
      if (hit && Number.isFinite(hit.value)) {
        values.push(hit.value);
        if (!asOf && hit.datetimeFrom?.utc) asOf = hit.datetimeFrom.utc;
      }
    } catch {
      continue;
    }
  }
  if (!values.length) throw new Error("no pm25 readings");
  return { valueUgM3: values.reduce((a, b) => a + b, 0) / values.length, stations: values.length, asOf };
}
