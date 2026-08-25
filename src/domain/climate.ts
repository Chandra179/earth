export type TemporalMode = "weeks" | "months" | "years";

export type ClimatePoint = {
  label: string;
  key?: string;
  year: number;
  tempAnomalyC: number;
  co2Ppm: number;
  seaLevelMmVs2000: number;
  event: string | null;
  dailyTempAnomalyC?: number;
  projection?: boolean;
};

export type ClimateDataset = {
  points: ClimatePoint[];
  projection: ClimatePoint[];
  threshold: boolean;
  daily?: boolean;
};

export const GISTEMP_BASELINE = "1951–1980";
export const SEA_LEVEL_BASELINE_YEAR = 2000;
export const PREINDUSTRIAL_OFFSET_C = 0.29;
export const PARIS_THRESHOLD_C = 1.5;

export type Trend = "up" | "flat";

export type Pollutant = {
  name: string;
  share: number;
  trend: Trend;
  color: string;
  note: string;
  termWord?: string;
  termDef?: string;
};

export type RegionMetric = {
  name: string;
  metric: string;
  sub: string;
  badge: "critical" | "elevated" | "stable";
  badgeText: string;
};

export const regionNames = ["Global", "Arctic", "Antarctic", "Amazon", "Mediterranean", "South Asia"] as const;
export type RegionName = (typeof regionNames)[number];

export type RegionOverrides = Partial<Record<RegionName, Record<string, RegionMetric>>>;

export const COMPARE_FACTORS: Record<string, number> = {
  Arctic: 2.6,
  Antarctic: 1.4,
  Amazon: 1.15,
  Mediterranean: 1.35,
  "South Asia": 1.2,
};

export type Kpis = {
  co2Ppm: number;
  ch4Ppb: number;
  tempAnomalyC: number;
  latestMonthLabel: string;
  seaLevelMmVs2000: number;
  warmingCvsPreIndustrial: number;
};

export type LiveEvent = { id: string; title: string; date: string; category: string };

export type ClimateSnapshot = {
  datasets: Record<TemporalMode, ClimateDataset>;
  kpis: Kpis;
  pollutants: Pollutant[];
  regions: Record<RegionName, RegionMetric[]>;
  extraEvents: LiveEvent[];
  eventFocus: Record<string, number>;
  liveSources: string[];
  updatedAt: string;
};

export interface ClimateRepository {
  getSnapshot(): Promise<ClimateSnapshot>;
}
