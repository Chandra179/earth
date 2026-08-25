import { describe, expect, it } from "vitest";
import { toLiveEvents } from "./eonet";
import type { RawEonetEvent } from "../sources/eonet";

const raw = (id: string, title: string, date: string, category: string): RawEonetEvent => ({
  id,
  title,
  date,
  category,
});

describe("toLiveEvents", () => {
  it("filters to tracked categories and sorts newest first", () => {
    const out = toLiveEvents([
      raw("1", "Volcano", "2026-08-20T00:00:00Z", "Volcanoes"),
      raw("2", "Old fire", "2026-01-05T00:00:00Z", "Wildfires"),
      raw("3", "New fire", "2026-08-24T00:00:00Z", "Wildfires"),
      raw("4", "", "2026-08-23T00:00:00Z", "Drought"),
    ]);
    expect(out.map((e) => e.id)).toEqual(["3", "4", "2"]);
  });

  it("caps results at the limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => raw(String(i), `Fire ${i}`, `2026-08-${String(i + 1).padStart(2, "0")}T00:00:00Z`, "Wildfires"));
    expect(toLiveEvents(many, 4)).toHaveLength(4);
    expect(toLiveEvents(many, 4)[0].id).toBe("9");
  });
});
