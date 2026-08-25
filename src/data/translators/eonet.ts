import type { LiveEvent } from "../../domain/climate";
import type { RawEonetEvent } from "../sources/eonet";

const KEEP_CATEGORIES = new Set(["Wildfires", "Severe Storms", "Drought"]);

export function toLiveEvents(raw: RawEonetEvent[], limit = 4): LiveEvent[] {
  return raw
    .filter((e) => e.date && KEEP_CATEGORIES.has(e.category))
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit)
    .map((e) => ({ id: e.id, title: e.title, date: e.date, category: e.category }));
}
