import type { Contribution, Contributor, FetchContext } from "./types";
import { cached } from "../cache";
import { firmsMapKey, fetchFirmsRaw } from "../sources/firms";
import { openaqApiKey, fetchOpenAqPm25Raw } from "../sources/openaq";

/** Key-gated single-region providers: absent keys mean "not available", not "failed". */
export const fireRisk: Contributor = {
  id: "fire-risk",
  ttlMs: 60 * 60 * 1000,
  async fetch(ctx: FetchContext): Promise<Contribution | null> {
    if (!firmsMapKey()) return null;
    const fires = await cached("firms:med", this.ttlMs, () => fetchFirmsRaw("-10,30,40,46", 2, ctx.signal));
    return {
      liveSources: ["NASA FIRMS"],
      regionRows: [
        {
          region: "Mediterranean",
          row: {
            name: "Fire risk",
            metric: fires.count.toLocaleString("en-US") + " hotspots/" + fires.dayRange + "d",
            sub: fires.source + " active fires · FIRMS",
            badge: fires.count > 150 ? "critical" : "elevated",
            badgeText: fires.count > 150 ? "critical" : "elevated",
          },
        },
      ],
    };
  },
};

export const airQuality: Contributor = {
  id: "air-quality",
  ttlMs: 30 * 60 * 1000,
  async fetch(ctx: FetchContext): Promise<Contribution | null> {
    if (!openaqApiKey()) return null;
    const pm25 = await cached("openaq:pm25", this.ttlMs, () => fetchOpenAqPm25Raw("65,5,90,35", 6, ctx.signal));
    return {
      liveSources: ["OpenAQ"],
      regionRows: [
        {
          region: "South Asia",
          row: {
            name: "Air quality",
            metric: "PM2.5 " + Math.round(pm25.valueUgM3) + " µg/m³",
            sub: `${pm25.stations}-station avg · OpenAQ`,
            badge: pm25.valueUgM3 > 60 ? "critical" : "elevated",
            badgeText: pm25.valueUgM3 > 60 ? "critical" : "elevated",
          },
        },
      ],
    };
  },
};
