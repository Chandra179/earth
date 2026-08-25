import { describe, expect, it } from "vitest";
import type { ClimateSnapshot } from "../../domain/climate";
import { applyContribution } from "./merge";

function base(): ClimateSnapshot {
  return {
    datasets: {
      years: { points: [], projection: [], threshold: true },
      months: { points: [], projection: [], threshold: false },
      weeks: { points: [], projection: [], threshold: false },
    },
    kpis: { co2Ppm: 400, ch4Ppb: 1800, tempAnomalyC: 1, latestMonthLabel: "", seaLevelMmVs2000: 10, warmingCvsPreIndustrial: 1.2 },
    pollutants: [
      { name: "Methane (CH₄)", share: 0.5, trend: "flat", color: "x", note: "" },
      { name: "Nitrous Oxide (N₂O)", share: 0.3, trend: "flat", color: "y", note: "" },
    ],
    regions: {
      Global: [
        { name: "Global mean", metric: "+1.20°C", sub: "fixture", badge: "critical", badgeText: "critical" },
        { name: "Sea level", metric: "+10 mm", sub: "fixture", badge: "elevated", badgeText: "elevated" },
      ],
      Arctic: [{ name: "Permafrost thaw", metric: "+8%", sub: "", badge: "elevated", badgeText: "elevated" }],
      Antarctic: [],
      Amazon: [],
      Mediterranean: [],
      "South Asia": [],
    },
    extraEvents: [],
    liveSources: ["NOAA GML CO₂/CH₄"],
    updatedAt: "",
  };
}

describe("applyContribution", () => {
  it("patches KPIs field-wise without touching the rest", () => {
    const out = applyContribution(base(), { kpis: { co2Ppm: 428.7 } });
    expect(out.kpis.co2Ppm).toBe(428.7);
    expect(out.kpis.ch4Ppb).toBe(1800);
  });

  it("upserts region rows by name, preserving untouched rows and regions", () => {
    const out = applyContribution(base(), {
      regionRows: [
        { region: "Global", row: { name: "Global mean", metric: "+1.48°C", sub: "live", badge: "critical", badgeText: "critical" } },
        { region: "Arctic", row: { name: "Sea ice extent", metric: "5.09M km²", sub: "live", badge: "critical", badgeText: "well below median" } },
      ],
    });
    const global = Object.fromEntries(out.regions.Global.map((r) => [r.name, r]));
    expect(global["Global mean"].metric).toBe("+1.48°C");
    expect(global["Global mean"].sub).toBe("live");
    expect(global["Sea level"].sub).toBe("fixture");
    expect(out.regions.Arctic.map((r) => r.name)).toEqual(["Permafrost thaw", "Sea ice extent"]);
  });

  it("maps gas trends onto pollutants by display name", () => {
    const out = applyContribution(base(), { pollutantTrends: { ch4: "up", n2o: "flat" } });
    expect(out.pollutants[0].trend).toBe("up");
    expect(out.pollutants[1].trend).toBe("flat");
  });

  it("replaces datasets wholesale per mode", () => {
    const months = { points: [], projection: [], threshold: false };
    const out = applyContribution(base(), { datasets: { months } });
    expect(out.datasets.months).toBe(months);
    expect(out.datasets.years).toBe(base().datasets.years ? out.datasets.years : out.datasets.years);
    expect(out.datasets.years.threshold).toBe(true);
  });

  it("unions live sources without duplicates and appends events", () => {
    const ev = { id: "1", title: "Wildfire", date: "2026-08-01", category: "Wildfires" };
    const out = applyContribution(base(), {
      liveSources: ["NOAA GML CO₂/CH₄", "NASA GISTEMP"],
      events: [ev],
    });
    expect(out.liveSources).toEqual(["NOAA GML CO₂/CH₄", "NASA GISTEMP"]);
    expect(out.extraEvents).toEqual([ev]);
  });

  it("never mutates the input snapshot", () => {
    const snap = base();
    applyContribution(snap, {
      kpis: { co2Ppm: 999 },
      regionRows: [{ region: "Global", row: { name: "Global mean", metric: "+9°C", sub: "", badge: "critical", badgeText: "critical" } }],
    });
    expect(snap.kpis.co2Ppm).toBe(400);
    expect(snap.regions.Global[0].metric).toBe("+1.20°C");
  });
});
