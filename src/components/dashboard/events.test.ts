import { describe, expect, it } from "vitest";
import type { ClimateDataset } from "../../domain/climate";
import type { LiveEvent } from "../../domain/climate";
import { collectEventChips, eventPointIndex } from "./events";

const ds = (keys: string[], events: (string | null)[] = []): ClimateDataset => ({
  points: keys.map((key, i) => ({
    label: key,
    key,
    year: Number(key.slice(0, 4)),
    tempAnomalyC: i,
    co2Ppm: i,
    seaLevelMmVs2000: i,
    event: events[i] ?? null,
  })),
  projection: [],
  threshold: false,
});

describe("eventPointIndex", () => {
  const pts = ds(["2025-06", "2025-07", "2025-08"]).points;

  it("maps a mid-month date to its month's index", () => {
    expect(eventPointIndex("2025-07-15T00:00:00Z", pts)).toBe(1);
  });

  it("maps a date on month start to that month", () => {
    expect(eventPointIndex("2025-06-01T00:00:00Z", pts)).toBe(0);
  });

  it("returns null outside the window or for un-keyed points", () => {
    expect(eventPointIndex("2024-01-01T00:00:00Z", pts)).toBeNull();
    expect(eventPointIndex("not-a-date", pts)).toBeNull();
    expect(eventPointIndex("2025-07-15", pts.slice(0, 1).map((p) => ({ ...p, key: undefined })))).toBeNull();
  });
});

describe("collectEventChips", () => {
  it("keeps only editorial points with events", () => {
    const { editorial } = collectEventChips(ds(["2025-06", "2025-07"], [null, "Heatwave"]), []);
    expect(editorial).toEqual([{ i: 1, label: "2025-07", ev: "Heatwave" }]);
  });

  it("resolves live event focus against the active dataset", () => {
    const liveEvents: LiveEvent[] = [
      { id: "a", title: "Storm", date: "2025-08-09T12:00:00Z", category: "Severe Storms" },
      { id: "b", title: "Old drought", date: "2020-01-01T00:00:00Z", category: "Drought" },
    ];
    const { live } = collectEventChips(ds(["2025-06", "2025-07", "2025-08"]), liveEvents);
    expect(live[0].focus).toBe(2);
    expect(live[1].focus).toBeNull();
  });
});
