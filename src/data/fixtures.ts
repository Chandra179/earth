import type { ClimateDataset, ClimatePoint, Kpis, Pollutant, RegionMetric, RegionName } from "../domain/climate";
import { editorialEvents } from "../domain/events";

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const YEAR0 = 2000;
const YEAR_END = 2026;
const CO2_YEAR = [
  369.5, 371.1, 373.2, 375.8, 377.5, 379.8, 381.9, 383.8, 385.6, 387.4, 389.9, 391.6, 393.8, 396.5,
  398.6, 400.8, 404.2, 406.5, 408.5, 411.4, 414.2, 416.5, 418.6, 421.1, 424.6, 426.4, 428.2,
];
const TEMP_YEAR = [
  0.63, 0.71, 0.79, 0.82, 0.88, 0.95, 0.9, 1.02, 0.97, 1.0, 1.12, 1.01, 1.05, 1.09, 1.14, 1.24,
  1.36, 1.3, 1.24, 1.31, 1.4, 1.28, 1.3, 1.48, 1.52, 1.47, 1.42,
];

function slAtYear(year: number) {
  let t = (year - YEAR0) / (YEAR_END - YEAR0);
  if (t < 0) t = 0;
  return 98.5 * Math.pow(t, 1.32);
}
function lerp(arr: number[], t: number) {
  if (t <= 0) return arr[0];
  if (t >= arr.length - 1) return arr[arr.length - 1];
  const i = Math.floor(t);
  const f = t - i;
  return arr[i] * (1 - f) + arr[i + 1] * f;
}
function tempAnnual(year: number) {
  return lerp(TEMP_YEAR, year - YEAR0);
}
function co2Annual(year: number) {
  return lerp(CO2_YEAR, year - YEAR0);
}

function buildYears(): ClimateDataset {
  const pts: ClimatePoint[] = [];
  const proj: ClimatePoint[] = [];
  for (let y = YEAR0; y <= YEAR_END; y++) {
    pts.push({
      label: String(y),
      year: y,
      tempAnomalyC: tempAnnual(y),
      co2Ppm: co2Annual(y),
      seaLevelMmVs2000: slAtYear(y),
      event: editorialEvents.years[y] || null,
    });
  }
  for (let y = 2027; y <= 2030; y++) {
    proj.push({
      label: String(y),
      year: y,
      tempAnomalyC: 1.42 + (y - 2026) * 0.05,
      co2Ppm: 428.2 + (y - 2026) * 2.4,
      seaLevelMmVs2000: slAtYear(y),
      event: null,
      projection: true,
    });
  }
  return { points: pts, projection: proj, threshold: true };
}

function buildMonths(): ClimateDataset {
  const rng = mulberry32(20260823);
  const pts: ClimatePoint[] = [];
  const start = new Date(2021, 8, 1);
  for (let m = 0; m < 60; m++) {
    const d = new Date(start.getFullYear(), start.getMonth() + m, 1);
    const yFrac = d.getFullYear() + d.getMonth() / 12;
    const seasonal = Math.sin(2 * Math.PI * ((d.getMonth() + 1 - 6.5) / 12)) * 0.55;
    const co2Season = Math.cos(2 * Math.PI * ((d.getMonth() + 1 - 5) / 12)) * 2.6;
    const key = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
    const label = d.toLocaleString("en", { month: "short" }) + " '" + String(d.getFullYear()).slice(2);
    pts.push({
      label,
      key,
      year: d.getFullYear(),
      tempAnomalyC: +(tempAnnual(yFrac) + seasonal + (rng() - 0.5) * 0.08).toFixed(2),
      co2Ppm: +(co2Annual(yFrac) + co2Season + (rng() - 0.5) * 0.3).toFixed(2),
      seaLevelMmVs2000: +(slAtYear(yFrac) + Math.sin(2 * Math.PI * (d.getMonth() / 12)) * 0.8).toFixed(2),
      event: editorialEvents.months[key] || null,
    });
  }
  return { points: pts, projection: [], threshold: false };
}

function buildWeeks(): ClimateDataset {
  const rng = mulberry32(777001);
  const pts: ClimatePoint[] = [];
  const daily: ClimatePoint[] = [];
  const end = new Date(2026, 7, 23);
  const N = 120;
  for (let i = N - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
    const yFrac = d.getFullYear() + d.getMonth() / 12 + d.getDate() / 365;
    const seasonal = Math.sin(2 * Math.PI * ((d.getMonth() + 1 - 6.5) / 12)) * 0.6;
    const co2Season = Math.cos(2 * Math.PI * ((d.getMonth() + 1 - 5) / 12)) * 2.8;
    daily.push({
      label: d.toLocaleString("en", { month: "short" }) + " " + d.getDate(),
      year: d.getFullYear(),
      tempAnomalyC: +(tempAnnual(yFrac) + seasonal + (rng() - 0.5) * 0.4).toFixed(2),
      co2Ppm: +(co2Annual(yFrac) + co2Season + (rng() - 0.5) * 1.6).toFixed(2),
      seaLevelMmVs2000: +slAtYear(yFrac).toFixed(2),
      event: null,
    });
  }
  function ma(arr: ClimatePoint[], f: "tempAnomalyC" | "co2Ppm" | "seaLevelMmVs2000") {
    return arr.reduce((s, p) => s + p[f], 0) / arr.length;
  }
  for (let k = 0; k < N; k++) {
    const win = daily.slice(Math.max(0, k - 3), Math.min(N, k + 4));
    pts.push({
      label: daily[k].label,
      year: daily[k].year,
      tempAnomalyC: +ma(win, "tempAnomalyC").toFixed(2),
      co2Ppm: +ma(win, "co2Ppm").toFixed(2),
      seaLevelMmVs2000: +ma(win, "seaLevelMmVs2000").toFixed(2),
      dailyTempAnomalyC: daily[k].tempAnomalyC,
      event: null,
    });
  }
  pts[110].event = "Marine heatwave detected";
  pts[104].event = "Methane plume · satellite alert";
  return { points: pts, projection: [], threshold: false, daily: true };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value as Record<string, unknown>)) deepFreeze(v);
  }
  return value;
}

export const fixtureDatasets = deepFreeze({
  years: buildYears(),
  months: buildMonths(),
  weeks: buildWeeks(),
} satisfies Record<"weeks" | "months" | "years", ClimateDataset>);

export const fixtureKpis = deepFreeze({
  co2Ppm: 428.2,
  ch4Ppb: 1930,
  tempAnomalyC: 1.92,
  latestMonthLabel: "",
  seaLevelMmVs2000: 98.5,
  warmingCvsPreIndustrial: 1.42,
} satisfies Kpis);

export const fixturePollutants = deepFreeze([
  { name: "Methane (CH₄)", share: 0.46, trend: "up", color: "var(--accent)", note: "1,930 ppb · livestock & leaks" },
  { name: "Nitrous Oxide (N₂O)", share: 0.21, trend: "up", color: "var(--warn)", note: "~337 ppb · fertilizer soils" },
  { name: "HFCs", share: 0.12, trend: "up", color: "var(--danger)", note: "fastest-growing F-gas class" },
  { name: "SF₆", share: 0.07, trend: "up", color: "var(--fg-2)", note: "23,500× GWP · grid switchgear", termWord: "GWP", termDef: "Global warming potential — how much heat a gas traps vs. the same mass of CO₂ over 100 years." },
  { name: "Black Carbon (soot)", share: 0.09, trend: "flat", color: "var(--fg)", note: "short-lived · Arctic forcing" },
  { name: "Ground-level O₃", share: 0.05, trend: "flat", color: "var(--muted)", note: "secondary · precursor-driven" },
] satisfies Pollutant[]);

const regionData = {
  Global: [
    { name: "Global mean", metric: "+1.42°C", sub: "land+ocean anomaly", badge: "critical", badgeText: "critical" },
    { name: "Sea level", metric: "+98.5 mm", sub: "rise vs. 2000 baseline", badge: "elevated", badgeText: "elevated" },
    { name: "CO₂ concentration", metric: "428.2 ppm", sub: "annual mean, still rising", badge: "critical", badgeText: "critical" },
    { name: "Arctic ice extent", metric: "−13% / decade", sub: "September minimum trend", badge: "critical", badgeText: "critical" },
  ],
  Arctic: [
    { name: "Heatwave alerts", metric: "7 active", sub: "Siberian tundra + coastal", badge: "critical", badgeText: "critical" },
    { name: "Ice melt velocity", metric: "−52 Gt / yr", sub: "Greenland mass balance", badge: "critical", badgeText: "critical" },
    { name: "Permafrost thaw", metric: "+8% area", sub: "active-layer deepening", badge: "elevated", badgeText: "elevated" },
    { name: "Sea ice extent", metric: "4.3M km²", sub: "below 1981–2010 median", badge: "elevated", badgeText: "elevated" },
  ],
  Antarctic: [
    { name: "Ice sheet loss", metric: "−150 Gt / yr", sub: "WAIS grounding-line retreat", badge: "critical", badgeText: "critical" },
    { name: "Sea ice extent", metric: "record low", sub: "2026 winter anomaly", badge: "critical", badgeText: "critical" },
    { name: "Shelf calving", metric: "3 events", sub: "Larsen–Thwaites sector", badge: "elevated", badgeText: "elevated" },
  ],
  Amazon: [
    { name: "Deforestation", metric: "+12% YoY", sub: "primary forest loss", badge: "critical", badgeText: "critical" },
    { name: "Canopy loss", metric: "11,570 km²", sub: "PRODES-equivalent estimate", badge: "critical", badgeText: "critical" },
    { name: "Drought stress", metric: "severe", sub: "soil-moisture deficit", badge: "elevated", badgeText: "elevated" },
  ],
  Mediterranean: [
    { name: "Heatwave alerts", metric: "4 active", sub: "Iberia · Aegean · Maghreb", badge: "critical", badgeText: "critical" },
    { name: "Fire risk", metric: "extreme", sub: "fuel moisture at record low", badge: "critical", badgeText: "critical" },
    { name: "Drought", metric: "22 months", sub: "persistent precipitation deficit", badge: "elevated", badgeText: "elevated" },
  ],
  "South Asia": [
    { name: "Heatwave alerts", metric: "6 active", sub: "Indo-Gangetic plain", badge: "critical", badgeText: "critical" },
    { name: "Monsoon anomaly", metric: "−7%", sub: "seasonal precipitation", badge: "elevated", badgeText: "elevated" },
    { name: "Air quality", metric: "PM2.5 high", sub: "urban + crop-residue", badge: "elevated", badgeText: "elevated" },
  ],
} satisfies Record<RegionName, RegionMetric[]>;

export const fixtureRegions = deepFreeze(regionData);

export const fixtureUpdatedAt = "23 Aug 2026, 14:02 UTC";
