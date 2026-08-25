import { getJson } from "./http";

const EONET = "https://eonet.gsfc.nasa.gov/api/v3/events";

type EonetResponse = {
  events: {
    id: string;
    title: string;
    categories: { id: number; title: string }[];
    geometry: { date: string; type: string }[];
  }[];
};

export type RawEonetEvent = { id: string; title: string; date: string; category: string };

export async function fetchEonetRaw(limit = 60): Promise<RawEonetEvent[]> {
  const data = await getJson<EonetResponse>(`${EONET}?status=open&limit=${limit}`, 15000);
  return (data.events ?? []).map((e) => ({
    id: e.id,
    title: e.title.replace(/\s*\(.*?\)\s*$/, "").trim(),
    date: e.geometry?.[e.geometry.length - 1]?.date ?? "",
    category: e.categories?.[0]?.title ?? "Event",
  }));
}
