import type { Contribution, Contributor } from "./types";
import { cached } from "../cache";
import { fetchNsidcSeaIceRaw } from "../sources/nsidcSeaIce";
import { seaIceRegionRow } from "../translators/nsidc";

async function soft<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

export const seaIce: Contributor = {
  id: "sea-ice",
  ttlMs: 2 * 60 * 60 * 1000,
  async fetch({ signal }) {
    const ttl = this.ttlMs;
    const [arctic, antarctic] = await Promise.all([
      soft(() => cached("nsidc:north", ttl, () => fetchNsidcSeaIceRaw("north", signal))),
      soft(() => cached("nsidc:south", ttl, () => fetchNsidcSeaIceRaw("south", signal))),
    ]);

    const liveSources: string[] = [];
    const regionRows: NonNullable<Contribution["regionRows"]> = [];

    if (arctic?.length) {
      regionRows.push({ region: "Arctic", row: seaIceRegionRow(arctic[arctic.length - 1], arctic) });
      liveSources.push("NSIDC sea ice");
    }
    if (antarctic?.length) {
      regionRows.push({ region: "Antarctic", row: seaIceRegionRow(antarctic[antarctic.length - 1], antarctic) });
    }

    return { liveSources, regionRows };
  },
};
