import type {
  ClimateRepository,
  ClimateSnapshot,
  LiveEvent,
  Pollutant,
  RegionMetric,
  RegionName,
  Trend,
} from "../domain/climate";
import { fetchNoaaCo2Annual, fetchNoaaGasGrowth, fetchNoaaGasMonthly } from "./sources/noaaGml";
import { fetchGistempRaw } from "./sources/gistemp";
import { fetchOwidSeaLevelRaw } from "./sources/seaLevelOwid";
import { fetchNsidcSeaIceRaw } from "./sources/nsidcSeaIce";
import { fetchProdesYearRows } from "./sources/inpeProdes";
import { fetchFirmsRaw } from "./sources/firms";
import { fetchOpenAqPm25Raw } from "./sources/openaq";
import { fetchEonetRaw } from "./sources/eonet";
import { growthTrend, latestMonthlyValue } from "./translators/noaaGml";
import { latestMonthlyAnomaly, warmingVsPreIndustrial } from "./translators/gistemp";
import { buildQuarterLookup, latestVsBaseline } from "./translators/seaLevel";
import { seaIceRegionRow } from "./translators/nsidc";
import { sumProdesYear } from "./translators/prodes";
import { toLiveEvents } from "./translators/eonet";
import { translateMonths, translateYears } from "./translators/datasets";
import { formatUtc } from "./translators/series";
import { fixtureDatasets, fixtureKpis, fixturePollutants, fixtureRegions, fixtureUpdatedAt } from "./fixtures";

async function settled<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

async function fetchProdesLatestTwoYears(): Promise<{ year: number; areaKm2: number }[]> {
  const years = [new Date().getFullYear() - 2, new Date().getFullYear() - 1];
  const out: { year: number; areaKm2: number }[] = [];
  for (const y of years) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rows = await fetchProdesYearRows(y);
        const areaKm2 = sumProdesYear(rows, y);
        if (areaKm2 > 0) out.push({ year: y, areaKm2 });
        break;
      } catch {
        if (attempt === 1) break;
      }
    }
  }
  return out;
}

function withTrends(base: Pollutant[], trends: Partial<Record<"ch4" | "n2o" | "sf6", Trend>>): Pollutant[] {
  return base.map((p) => {
    let trend = p.trend;
    if (p.name.includes("Methane")) trend = trends.ch4 ?? p.trend;
    else if (p.name.includes("Nitrous")) trend = trends.n2o ?? p.trend;
    else if (p.name.includes("SF₆")) trend = trends.sf6 ?? p.trend;
    return trend === p.trend ? p : { ...p, trend };
  });
}

function mergeRegions(
  base: Record<RegionName, RegionMetric[]>,
  overrides: Partial<Record<RegionName, Record<string, RegionMetric>>>,
): Record<RegionName, RegionMetric[]> {
  const out = {} as Record<RegionName, RegionMetric[]>;
  for (const region of Object.keys(base) as RegionName[]) {
    const ov = overrides[region];
    out[region] = (base[region] ?? []).map((row) => ov?.[row.name] ?? row);
  }
  return out;
}

export function baselineSnapshot(): ClimateSnapshot {
  return {
    datasets: fixtureDatasets,
    kpis: fixtureKpis,
    pollutants: fixturePollutants,
    regions: fixtureRegions,
    extraEvents: [],
    eventFocus: {},
    liveSources: [],
    updatedAt: fixtureUpdatedAt,
  };
}

export const climateRepository: ClimateRepository = {
  async getSnapshot(): Promise<ClimateSnapshot> {
    const snap = baselineSnapshot();
    const sources: string[] = [];

    const [temps, co2Monthly, co2Annual, ch4Monthly, gmsl, arcticIce, antarcticIce, prodes, fires, pm25, eonet] =
      await Promise.all([
        settled(() => fetchGistempRaw()),
        settled(() => fetchNoaaGasMonthly("co2")),
        settled(() => fetchNoaaCo2Annual()),
        settled(() => fetchNoaaGasMonthly("ch4")),
        settled(() => fetchOwidSeaLevelRaw()),
        settled(() => fetchNsidcSeaIceRaw("north")),
        settled(() => fetchNsidcSeaIceRaw("south")),
        settled(() => fetchProdesLatestTwoYears()),
        settled(() => fetchFirmsRaw("-10,30,40,46", 2)),
        settled(() => fetchOpenAqPm25Raw("65,5,90,35")),
        settled(() => fetchEonetRaw()),
      ]);

    const quarters = gmsl?.quarters;
    const liveYears = translateYears({ tempsAnnual: temps?.annual, co2Annual, quarters });
    if (liveYears) snap.datasets.years = liveYears;
    const liveMonths = translateMonths({ tempsMonthly: temps?.monthly, co2Monthly, quarters });
    if (liveMonths) snap.datasets.months = liveMonths;

    if (co2Monthly?.length) {
      snap.kpis.co2Ppm = +latestMonthlyValue(co2Monthly)!.value.toFixed(1);
      sources.push("NOAA GML CO₂/CH₄");
    }
    const ch4Latest = ch4Monthly ? latestMonthlyValue(ch4Monthly) : null;
    if (ch4Latest) snap.kpis.ch4Ppb = Math.round(ch4Latest.value);

    const tempLatest = temps ? latestMonthlyAnomaly(temps.monthly) : null;
    if (tempLatest && temps) {
      snap.kpis.tempAnomalyC = tempLatest.anomalyC;
      snap.kpis.latestMonthLabel =
        new Date(tempLatest.year, tempLatest.month - 1, 1).toLocaleString("en", { month: "short" }) +
        " " +
        tempLatest.year;
      sources.push("NASA GISTEMP");
    }

    const slLookup = quarters ? buildQuarterLookup(quarters) : null;
    const slLatest = quarters && slLookup ? latestVsBaseline(quarters, slLookup) : null;
    if (slLatest) {
      snap.kpis.seaLevelMmVs2000 = slLatest.valueMmVs2000;
      sources.push("UHSLC/OWID sea level");
    }

    const warming = temps ? warmingVsPreIndustrial(temps.annual[temps.annual.length - 1] ?? null) : null;
    if (warming != null) snap.kpis.warmingCvsPreIndustrial = warming;

    const trends: Partial<Record<"ch4" | "n2o" | "sf6", Trend>> = {};
    const [n2oGr, sf6Gr, ch4Gr] = await Promise.all([
      settled(() => fetchNoaaGasGrowth("n2o")),
      settled(() => fetchNoaaGasGrowth("sf6")),
      settled(() => fetchNoaaGasGrowth("ch4")),
    ]);
    const n2oT = n2oGr ? growthTrend(n2oGr) : undefined;
    const sf6T = sf6Gr ? growthTrend(sf6Gr) : undefined;
    const ch4T = ch4Gr ? growthTrend(ch4Gr) : undefined;
    if (ch4T) {
      trends.ch4 = ch4T;
      if (!sources.some((s) => s.includes("NOAA"))) sources.push("NOAA GML CO₂/CH₄");
    }
    if (n2oT) trends.n2o = n2oT;
    if (sf6T) trends.sf6 = sf6T;

    const overrides: Partial<Record<RegionName, Record<string, RegionMetric>>> = {};

    if (temps || co2Monthly || slLatest) {
      const rows: Record<string, RegionMetric> = {};
      if (warming != null) {
        rows["Global mean"] = {
          name: "Global mean",
          metric: "+" + warming.toFixed(2) + "°C",
          sub: "vs pre-industrial · est.",
          badge: "critical",
          badgeText: "critical",
        };
      }
      if (co2Monthly?.length) {
        rows["CO₂ concentration"] = {
          name: "CO₂ concentration",
          metric: snap.kpis.co2Ppm.toFixed(1) + " ppm",
          sub: "NOAA GML · global monthly",
          badge: "critical",
          badgeText: "critical",
        };
      }
      if (slLatest) {
        rows["Sea level"] = {
          name: "Sea level",
          metric: "+" + slLatest.valueMmVs2000.toFixed(0) + " mm",
          sub: "rise vs 2000 · tide-gauge recon",
          badge: "elevated",
          badgeText: "elevated",
        };
      }
      overrides.Global = rows;
    }

    if (arcticIce?.length) {
      overrides.Arctic = { "Sea ice extent": seaIceRegionRow(arcticIce[arcticIce.length - 1], arcticIce) };
      sources.push("NSIDC sea ice");
    }
    if (antarcticIce?.length) {
      overrides.Antarctic = { "Sea ice extent": seaIceRegionRow(antarcticIce[antarcticIce.length - 1], antarcticIce) };
    }

    if (prodes && prodes.length >= 2) {
      const cur = prodes[prodes.length - 1];
      const prev = prodes[prodes.length - 2];
      const pct = ((cur.areaKm2 / prev.areaKm2 - 1) * 100).toFixed(1);
      overrides.Amazon = {
        Deforestation: {
          name: "Deforestation",
          metric: (Number(pct) >= 0 ? "+" : "") + pct + "% YoY",
          sub: `PRODES d${cur.year} vs d${prev.year}`,
          badge: Number(pct) > 0 ? "critical" : "elevated",
          badgeText: Number(pct) > 0 ? "rising" : "falling",
        },
        "Canopy loss": {
          name: "Canopy loss",
          metric: Math.round(cur.areaKm2).toLocaleString("en-US") + " km²",
          sub: `PRODES ${cur.year} · INPE`,
          badge: "critical",
          badgeText: "critical",
        },
      };
      sources.push("INPE PRODES");
    } else if (prodes && prodes.length === 1) {
      const cur = prodes[0];
      overrides.Amazon = {
        "Canopy loss": {
          name: "Canopy loss",
          metric: Math.round(cur.areaKm2).toLocaleString("en-US") + " km²",
          sub: `PRODES ${cur.year} · INPE`,
          badge: "critical",
          badgeText: "critical",
        },
      };
      sources.push("INPE PRODES");
    }

    if (fires) {
      overrides.Mediterranean = {
        "Fire risk": {
          name: "Fire risk",
          metric: fires.count.toLocaleString("en-US") + " hotspots/" + fires.dayRange + "d",
          sub: fires.source + " active fires · FIRMS",
          badge: fires.count > 150 ? "critical" : "elevated",
          badgeText: fires.count > 150 ? "critical" : "elevated",
        },
      };
      sources.push("NASA FIRMS");
    }

    if (pm25) {
      overrides["South Asia"] = {
        "Air quality": {
          name: "Air quality",
          metric: "PM2.5 " + Math.round(pm25.valueUgM3) + " µg/m³",
          sub: `${pm25.stations}-station avg · OpenAQ`,
          badge: pm25.valueUgM3 > 60 ? "critical" : "elevated",
          badgeText: pm25.valueUgM3 > 60 ? "critical" : "elevated",
        },
      };
      sources.push("OpenAQ");
    }

    let events: LiveEvent[] = [];
    if (eonet) {
      events = toLiveEvents(eonet);
      if (events.length) {
        const ds = snap.datasets.months.points;
        events.forEach((ev, i) => {
          const t = Date.parse(ev.date);
          if (!Number.isFinite(t) || !ds.length || !ds[0].key) return;
          const first = Date.parse(ds[0].key + "-01");
          const lastD = Date.parse(ds[ds.length - 1].key! + "-01");
          if (t >= first && t <= lastD + 31 * 86400000) {
            const span = lastD - first || 1;
            snap.eventFocus["live-" + i] = Math.min(
              ds.length - 1,
              Math.max(0, Math.round(((t - first) / span) * (ds.length - 1))),
            );
          }
        });
        sources.push("NASA EONET");
      }
    }

    snap.pollutants = withTrends(snap.pollutants, trends);
    snap.regions = mergeRegions(snap.regions, overrides);
    snap.extraEvents = events;
    snap.liveSources = sources;
    snap.updatedAt = formatUtc(new Date());
    return snap;
  },
};
