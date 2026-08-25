import type { Contribution, Contributor } from "./types";
import { cached } from "../cache";
import { fetchEonetRaw } from "../sources/eonet";
import { toLiveEvents } from "../translators/eonet";

export const eonetEvents: Contributor = {
  id: "eonet-events",
  ttlMs: 15 * 60 * 1000,
  async fetch({ signal }): Promise<Contribution | null> {
    const raw = await cached("eonet:open", this.ttlMs, () => fetchEonetRaw(60, signal));
    const events = toLiveEvents(raw);
    return events.length ? { events, liveSources: ["NASA EONET"] } : null;
  },
};
