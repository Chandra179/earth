import type { ClimateSnapshot, Pollutant, RegionMetric, RegionName, Trend } from "../../domain/climate";
import type { Contribution, PollutantGas } from "./types";

function withTrends(base: Pollutant[], trends: Partial<Record<PollutantGas, Trend>>): Pollutant[] {
  return base.map((p) => {
    let trend = p.trend;
    if (p.name.includes("Methane")) trend = trends.ch4 ?? p.trend;
    else if (p.name.includes("Nitrous")) trend = trends.n2o ?? p.trend;
    else if (p.name.includes("SF₆")) trend = trends.sf6 ?? p.trend;
    return trend === p.trend ? p : { ...p, trend };
  });
}

function upsertRows(rows: RegionMetric[], incoming: RegionMetric[]): RegionMetric[] {
  const byName = new Map(rows.map((r) => [r.name, r]));
  for (const row of incoming) byName.set(row.name, row);
  return [...byName.values()];
}

/** Pure reducer: folds one provider contribution into a snapshot (new object). */
export function applyContribution(snap: ClimateSnapshot, c: Contribution): ClimateSnapshot {
  const next: ClimateSnapshot = { ...snap };

  if (c.kpis) next.kpis = { ...snap.kpis, ...c.kpis };
  if (c.datasets) next.datasets = { ...snap.datasets, ...c.datasets };
  if (c.pollutantTrends) next.pollutants = withTrends(snap.pollutants, c.pollutantTrends);
  if (c.pollutants?.length) next.pollutants = c.pollutants;

  if (c.regionRows?.length) {
    const byRegion = new Map<RegionName, RegionMetric[]>(Object.entries(snap.regions) as [RegionName, RegionMetric[]][]);
    for (const { region, row } of c.regionRows) {
      byRegion.set(region, upsertRows(byRegion.get(region) ?? [], [row]));
    }
    next.regions = Object.fromEntries(byRegion) as Record<RegionName, RegionMetric[]>;
  }

  if (c.events?.length) next.extraEvents = [...snap.extraEvents, ...c.events];
  if (c.liveSources?.length) {
    const known = new Set(snap.liveSources);
    next.liveSources = [...snap.liveSources, ...c.liveSources.filter((s) => !known.has(s))];
  }

  return next;
}
