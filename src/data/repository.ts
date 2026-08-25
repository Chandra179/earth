import type { ClimateRepository, ClimateSnapshot } from "../domain/climate";
import { formatUtc } from "./translators/series";
import {
  fixtureDatasets,
  fixtureKpis,
  fixturePollutants,
  fixtureRegions,
  fixtureUpdatedAt,
} from "./fixtures";
import { applyContribution } from "./contributors/merge";
import type { Contributor, FetchContext } from "./contributors/types";
import { coreTimeseries } from "./contributors/coreTimeseries";
import { seaIce } from "./contributors/seaIce";
import { deforestation } from "./contributors/deforestation";
import { fireRisk, airQuality } from "./contributors/regional";
import { eonetEvents } from "./contributors/eonetEvents";
import { backendData } from "./contributors/backendData";
import { superPollutants } from "./contributors/superPollutants";

const CONTRIBUTORS: Contributor[] = [coreTimeseries, seaIce, deforestation, fireRisk, airQuality, eonetEvents, backendData, superPollutants];

export function baselineSnapshot(): ClimateSnapshot {
  return structuredClone({
    datasets: fixtureDatasets,
    kpis: fixtureKpis,
    pollutants: fixturePollutants,
    regions: fixtureRegions,
    extraEvents: [],
    liveSources: [],
    updatedAt: fixtureUpdatedAt,
  });
}

async function runPipeline(
  ctx: FetchContext,
  notify: (snapshot: ClimateSnapshot) => void,
): Promise<ClimateSnapshot> {
  let draft = baselineSnapshot();
  notify(draft);

  await Promise.all(
    CONTRIBUTORS.map(async (contributor) => {
      try {
        const contribution = await contributor.fetch(ctx);
        if (contribution) {
          draft = applyContribution(draft, contribution);
          notify(draft);
        }
      } catch (error) {
        ctx.onError({ source: contributor.id, error });
      }
    }),
  );

  const final = applyContribution(draft, {});
  final.updatedAt = formatUtc(new Date());
  return final;
}

const listeners = new Set<(snapshot: ClimateSnapshot) => void>();
let inflight: Promise<ClimateSnapshot> | null = null;

export const climateRepository: ClimateRepository = {
  getSnapshot(options = {}) {
    if (options.onUpdate) listeners.add(options.onUpdate);
    if (!inflight) {
      const onError = options.onError ?? (() => {});
      const signal = options.signal;
      inflight = runPipeline(
        { signal, onError },
        (snapshot) => {
          for (const listener of listeners) listener(snapshot);
        },
      ).finally(() => {
        inflight = null;
        listeners.clear();
      });
    }
    return inflight;
  },
};
