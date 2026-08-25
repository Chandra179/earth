import { useEffect, useState } from "react";
import type { ClimateSnapshot } from "../domain/climate";
import { baselineSnapshot, climateRepository } from "../data/repository";

export function useClimateData(): { snapshot: ClimateSnapshot; isLive: boolean } {
  const [snapshot, setSnapshot] = useState<ClimateSnapshot>(baselineSnapshot);
  useEffect(() => {
    let alive = true;
    climateRepository
      .getSnapshot({
        onUpdate: (s) => {
          if (alive) setSnapshot(s);
        },
        onError: ({ source, error }) => {
          console.warn(`[climate] source "${source}" failed:`, error);
        },
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return { snapshot, isLive: snapshot.liveSources.length > 0 };
}
