import type { Contribution, Contributor } from "./types";
import { cached } from "../cache";
import { fetchProdesYearRows } from "../sources/inpeProdes";
import { sumProdesYear } from "../translators/prodes";

function canopyRow(year: number, areaKm2: number) {
  return {
    name: "Canopy loss",
    metric: Math.round(areaKm2).toLocaleString("en-US") + " km²",
    sub: `PRODES ${year} · INPE`,
    badge: "critical" as const,
    badgeText: "critical",
  };
}

export const deforestation: Contributor = {
  id: "deforestation",
  ttlMs: 24 * 60 * 60 * 1000,
  async fetch({ signal }) {
    const years = [new Date().getFullYear() - 2, new Date().getFullYear() - 1];
    const totals: { year: number; areaKm2: number }[] = [];
    for (const y of years) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const areaKm2 = sumProdesYear(await cached(`prodes:${y}`, this.ttlMs, () => fetchProdesYearRows(y, signal)), y);
          if (areaKm2 > 0) totals.push({ year: y, areaKm2 });
          break;
        } catch (err) {
          if (attempt === 1 && totals.length === 0 && y === years[years.length - 1]) throw err;
        }
      }
    }

    if (!totals.length) return null;
    const regionRows: NonNullable<Contribution["regionRows"]> = [];
    const cur = totals[totals.length - 1];
    if (totals.length >= 2) {
      const prev = totals[totals.length - 2];
      const pct = ((cur.areaKm2 / prev.areaKm2 - 1) * 100).toFixed(1);
      regionRows.push({
        region: "Amazon",
        row: {
          name: "Deforestation",
          metric: (Number(pct) >= 0 ? "+" : "") + pct + "% YoY",
          sub: `PRODES d${cur.year} vs d${prev.year}`,
          badge: Number(pct) > 0 ? "critical" : "elevated",
          badgeText: Number(pct) > 0 ? "rising" : "falling",
        },
      });
    }
    regionRows.push({ region: "Amazon", row: canopyRow(cur.year, cur.areaKm2) });
    return { liveSources: ["INPE PRODES"], regionRows };
  },
};
