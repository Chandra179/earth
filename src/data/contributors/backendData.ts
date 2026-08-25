import type { Contribution, Contributor } from "./types";
import type { RegionMetric, RegionName } from "../../domain/climate";
import { regionNames } from "../../domain/climate";
import { fetchIceMass, fetchRegionRows, type SheetStats } from "../sources/backendApi";

const GT_LOSS_CRITICAL = -250; // Gt/yr — sustained heavy loss
const GT_LOSS_ELEVATED = -150;

function iceRow(sheet: SheetStats, name: string, sub: string): RegionMetric {
  const trend = sheet.trendGtPerYear;
  const losing = trend < 0;
  const metric = `${losing ? "−" : "+"}${Math.abs(Math.round(trend))} Gt / yr`;
  const badge = !losing || trend > GT_LOSS_ELEVATED ? "stable" : trend <= GT_LOSS_CRITICAL ? "critical" : "elevated";
  return {
    name,
    metric,
    sub,
    badge,
    badgeText:
      badge === "critical"
        ? "sustained heavy mass loss"
        : badge === "elevated"
          ? "ongoing mass loss"
          : "near balance",
  };
}

async function soft<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

/**
 * Talks to our Go backend for indicators the browser can't compute:
 * GRACE/GRACE-FO netCDF-derived ice-sheet trends and Open-Meteo
 * regional rows. If the backend is down, returns null and fixtures show.
 */
export const backendData: Contributor = {
  id: "regional-backend",
  ttlMs: 30 * 60 * 1000,
  async fetch({ signal }) {
    const [ice, regions] = await Promise.all([
      soft(() => fetchIceMass(signal)),
      soft(() => fetchRegionRows(signal)),
    ]);

    const liveSources: string[] = [];
    const regionRows: NonNullable<Contribution["regionRows"]> = [];

    if (ice) {
      liveSources.push("GRACE-FO ice mass");
      regionRows.push({ region: "Arctic", row: iceRow(ice.greenland, "Ice melt velocity", "Greenland mass balance") });
      regionRows.push({ region: "Antarctic", row: iceRow(ice.antarctica, "Ice sheet loss", "Antarctica mass balance") });
    }

    if (regions?.rows?.length) {
      liveSources.push("Open-Meteo regional");
      for (const entry of regions.rows) {
        if ((regionNames as readonly string[]).includes(entry.region)) {
          regionRows.push({ region: entry.region as RegionName, row: entry.row });
        }
      }
    }

    if (liveSources.length === 0) return null;
    return { liveSources, regionRows };
  },
};
