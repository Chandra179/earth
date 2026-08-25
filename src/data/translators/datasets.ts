import { editorialEvents } from "../../domain/events";
import type { ClimateDataset, ClimatePoint } from "../../domain/climate";
import type { RawAnnualValue, RawMonthlyValue } from "../sources/noaaGml";
import type { RawAnnualAnomaly, RawMonthlyAnomaly } from "../sources/gistemp";
import type { RawSeaLevelQuarter } from "../sources/seaLevelOwid";
import type { QuarterLookup } from "./seaLevel";
import { buildQuarterLookup } from "./seaLevel";
import { meanLastDiff, monthLabel, olsSlope, ym } from "./series";

function buildYearsDataset(
  temps: RawAnnualAnomaly[],
  co2s: RawAnnualValue[],
  slq: QuarterLookup,
): ClimateDataset {
  const tempByYear = new Map(temps.map((t) => [t.year, t.anomalyC]));
  const co2ByYear = new Map(co2s.map((c) => [c.year, c.value]));
  const endYear = Math.min(Math.max(...tempByYear.keys()), Math.max(...co2ByYear.keys()));

  const years: number[] = [];
  for (let y = 2000; y <= endYear; y++) if (tempByYear.has(y) && co2ByYear.has(y)) years.push(y);

  const lastSlYear = Math.floor((slq.lastQIndex + 1) / 4);
  const slSlope = olsSlope(years.filter((y) => y <= lastSlYear).map((y) => slq.get(y, 6)));

  const points: ClimatePoint[] = years.map((y) => ({
    label: String(y),
    year: y,
    tempAnomalyC: +(tempByYear.get(y)!).toFixed(2),
    co2Ppm: +(co2ByYear.get(y)!).toFixed(1),
    seaLevelMmVs2000: +slq.get(y, 6).toFixed(1),
    event: editorialEvents.years[y] ?? null,
  }));

  const tStep = meanLastDiff(points.map((p) => p.tempAnomalyC), 3);
  const cStep = meanLastDiff(points.map((p) => p.co2Ppm), 3);
  const projection: ClimatePoint[] = [];
  for (let k = 1; k <= 4; k++) {
    const y = endYear + k;
    const last = points[points.length - 1];
    projection.push({
      label: String(y),
      year: y,
      tempAnomalyC: +(last.tempAnomalyC + tStep * k).toFixed(2),
      co2Ppm: +(last.co2Ppm + cStep * k).toFixed(1),
      seaLevelMmVs2000: +(points[points.length - 1].seaLevelMmVs2000 + slSlope * k).toFixed(1),
      event: null,
      projection: true,
    });
  }
  return { points, projection, threshold: true };
}

function buildMonthsDataset(
  temps: RawMonthlyAnomaly[],
  co2s: RawMonthlyValue[],
  slq: QuarterLookup,
): ClimateDataset {
  const tempByYm = new Map(temps.map((t) => [ym(t.year, t.month), t.anomalyC]));
  const co2ByYm = new Map(co2s.map((c) => [ym(c.year, c.month), c.value]));
  const common = [...tempByYm.keys()].filter((k) => co2ByYm.has(k)).sort();
  if (!common.length) throw new Error("no overlapping months");
  const window = common.slice(-60);

  const points: ClimatePoint[] = window.map((key) => {
    const [yy, mm] = key.split("-").map(Number);
    return {
      label: monthLabel(yy, mm),
      key,
      year: yy,
      tempAnomalyC: +tempByYm.get(key)!.toFixed(2),
      co2Ppm: +co2ByYm.get(key)!.toFixed(1),
      seaLevelMmVs2000: +slq.get(yy, mm).toFixed(1),
      event: editorialEvents.months[key] ?? null,
    };
  });
  return { points, projection: [], threshold: false };
}

export type LiveSeriesInput = {
  tempsAnnual?: RawAnnualAnomaly[] | null;
  tempsMonthly?: RawMonthlyAnomaly[] | null;
  co2Annual?: RawAnnualValue[] | null;
  co2Monthly?: RawMonthlyValue[] | null;
  quarters?: RawSeaLevelQuarter[] | null;
};

export function translateYears(input: LiveSeriesInput): ClimateDataset | null {
  if (!input.tempsAnnual?.length || !input.co2Annual?.length || !input.quarters?.length) return null;
  try {
    return buildYearsDataset(input.tempsAnnual, input.co2Annual, buildQuarterLookup(input.quarters));
  } catch {
    return null;
  }
}

export function translateMonths(input: LiveSeriesInput): ClimateDataset | null {
  if (!input.tempsMonthly?.length || !input.co2Monthly?.length || !input.quarters?.length) return null;
  try {
    return buildMonthsDataset(input.tempsMonthly, input.co2Monthly, buildQuarterLookup(input.quarters));
  } catch {
    return null;
  }
}
