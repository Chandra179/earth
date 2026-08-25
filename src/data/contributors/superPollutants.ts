import type { Pollutant, Trend } from "../../domain/climate";
import { fetchAggiTable } from "../sources/noaaAggi";
import type { Contribution } from "./types";

/**
 * Super-pollutant breakdown from NOAA AGGI radiative forcing by gas
 * group. Shares are each group's slice of non-CO₂ forcing; trends come
 * from the year-over-year forcing change (annual data — long TTL).
 */

const TREND_UP = 0.01;
const TREND_DOWN = -0.005;

function trendOf(latest: number, prev: number): Trend {
  const pct = (latest - prev) / Math.max(Math.abs(prev), 1e-9);
  return pct > TREND_UP ? "up" : pct < TREND_DOWN ? "down" : "flat";
}

export const superPollutants = {
  id: "super-pollutants",
  ttlMs: 7 * 24 * 60 * 60 * 1000,
  fetch: async (): Promise<Contribution> => {
    const rows = await fetchAggiTable();
    const b = rows[rows.length - 1];
    const a = rows[rows.length - 2] ?? b;
    const nonCo2 = Math.max(b.total - b.co2, 1e-6);
    const share = (v: number) => v / nonCo2;

    const pollutants: Pollutant[] = [
      {
        name: "Methane (CH₄)",
        share: share(b.ch4),
        trend: trendOf(b.ch4, a.ch4),
        color: "var(--accent)",
        note: `${b.ch4.toFixed(2)} W/m² · livestock & leaks`,
      },
      {
        name: "Nitrous Oxide (N₂O)",
        share: share(b.n2o),
        trend: trendOf(b.n2o, a.n2o),
        color: "var(--warn)",
        note: `${b.n2o.toFixed(2)} W/m² · fertilizer soils`,
      },
      {
        name: "CFCs (legacy)",
        share: share(b.cfcs),
        trend: trendOf(b.cfcs, a.cfcs),
        color: "var(--muted)",
        note: `${b.cfcs.toFixed(2)} W/m² · banned, still fading`,
      },
      {
        name: "HCFCs",
        share: share(b.hcfcs),
        trend: trendOf(b.hcfcs, a.hcfcs),
        color: "var(--fg-2)",
        note: `${b.hcfcs.toFixed(2)} W/m² · interim substitutes, peaking`,
      },
      {
        name: "HFCs + SF₆",
        share: share(b.hfcs),
        trend: trendOf(b.hfcs, a.hfcs),
        color: "var(--danger)",
        note: `${b.hfcs.toFixed(2)} W/m² · fastest-growing F-gases`,
        termWord: "GWP",
        termDef:
          "Global warming potential — how much heat a gas traps vs. the same mass of CO₂ over 100 years.",
      },
    ];

    const kpis: Contribution["kpis"] = {};
    if (a.hfcs > 0) {
      const fGasDeltaPct = +(((b.hfcs - a.hfcs) / a.hfcs) * 100).toFixed(1);
      kpis.fGasForcingDeltaPct = fGasDeltaPct;
    }

    return {
      pollutants,
      kpis: Object.keys(kpis).length ? kpis : undefined,
      liveSources: [`NOAA AGGI ${b.year}`],
    };
  },
};
