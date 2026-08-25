import type { ClimateDataset, LiveEvent } from "../../domain/climate";

export type EditorialChip = { i: number; label: string; ev: string };
export type LiveChip = { key: string; label: string; ev: string; focus: number | null };

/**
 * Maps a live event's date to the index of the dataset point whose month
 * contains it. Returns null when the dataset isn't month-keyed (e.g. years)
 * or the event falls outside the window.
 */
export function eventPointIndex(dateIso: string, points: ClimateDataset["points"]): number | null {
  const t = Date.parse(dateIso);
  if (!Number.isFinite(t)) return null;
  for (let i = 0; i < points.length; i++) {
    const key = points[i].key;
    if (!key) continue;
    const [y, m] = key.split("-").map(Number);
    const start = Date.UTC(y, m - 1, 1);
    const end = Date.UTC(y, m, 1);
    if (t >= start && t < end) return i;
  }
  return null;
}

/** Pure merge of editorial dataset events + live EONET events. */
export function collectEventChips(
  dataset: ClimateDataset,
  extraEvents: LiveEvent[],
): { editorial: EditorialChip[]; live: LiveChip[] } {
  const editorial = dataset.points
    .map((p, i) => ({ i, label: p.label, ev: p.event }))
    .filter((x): x is { i: number; label: string; ev: string } => !!x.ev);
  const live = extraEvents.map((ev, k) => ({
    key: "live-" + k,
    label: new Date(ev.date).toLocaleDateString("en", { month: "short", day: "numeric" }),
    ev: ev.title,
    focus: eventPointIndex(ev.date, dataset.points),
  }));
  return { editorial, live };
}
