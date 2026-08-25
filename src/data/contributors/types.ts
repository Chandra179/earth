import type {
  ClimateDataset,
  ErrorReporter,
  Kpis,
  LiveEvent,
  Pollutant,
  RegionMetric,
  RegionName,
  TemporalMode,
  Trend,
} from "../../domain/climate";

export type PollutantGas = "ch4" | "n2o" | "sf6";

/** A partial snapshot update produced by a single data provider. */
export type Contribution = {
  liveSources?: string[];
  kpis?: Partial<Kpis>;
  datasets?: Partial<Record<TemporalMode, ClimateDataset>>;
  pollutantTrends?: Partial<Record<PollutantGas, Trend>>;
  /** Full replacement of the pollutant breakdown rows. */
  pollutants?: Pollutant[];
  regionRows?: { region: RegionName; row: RegionMetric }[];
  events?: LiveEvent[];
};

export type FetchContext = { signal?: AbortSignal; onError: ErrorReporter };

export type Contributor = {
  id: string;
  /** How long raw responses from this contributor's endpoints stay cached. */
  ttlMs: number;
  /**
   * Returns a contribution, or `null` when this source is legitimately
   * unavailable (e.g. optional API key not configured). Throwing signals an
   * unexpected failure — reported via `ctx.onError`, never fatal.
   */
  fetch: (ctx: FetchContext) => Promise<Contribution | null>;
};
