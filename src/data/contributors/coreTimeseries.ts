import type { Contribution, Contributor } from "./types";
import { cached } from "../cache";
import { fetchNoaaCo2Annual, fetchNoaaGasGrowth, fetchNoaaGasMonthly } from "../sources/noaaGml";
import { fetchGistempRaw } from "../sources/gistemp";
import { fetchOwidSeaLevelRaw } from "../sources/seaLevelOwid";
import { growthTrend, latestMonthlyValue } from "../translators/noaaGml";
import { latestMonthlyAnomaly, warmingVsPreIndustrial } from "../translators/gistemp";
import { buildQuarterLookup, latestVsBaseline } from "../translators/seaLevel";
import { translateMonths, translateYears } from "../translators/datasets";

async function soft<T>(run: () => Promise<T>): Promise<T | null> {
  try {
    return await run();
  } catch {
    return null;
  }
}

/**
 * The joint temperature × CO₂ × sea-level timeseries: one composite because
 * the aligned datasets and Global region rows are products of all three
 * providers together.
 */
export const coreTimeseries: Contributor = {
  id: "core-timeseries",
  ttlMs: 3 * 60 * 60 * 1000,
  async fetch({ signal }) {
    const ttl = this.ttlMs;
    const [temps, co2Monthly, co2Annual, ch4Monthly, gmsl, ch4Gr, n2oGr] = await Promise.all([
      soft(() => cached("gistemp", ttl, () => fetchGistempRaw(signal))),
      soft(() => cached("noaa:co2-monthly", ttl, () => fetchNoaaGasMonthly("co2", signal))),
      soft(() => cached("noaa:co2-annual", ttl, () => fetchNoaaCo2Annual(signal))),
      soft(() => cached("noaa:ch4-monthly", ttl, () => fetchNoaaGasMonthly("ch4", signal))),
      soft(() => cached("owid:sea-level", ttl, () => fetchOwidSeaLevelRaw(signal))),
      soft(() => cached("noaa:ch4-growth", ttl, () => fetchNoaaGasGrowth("ch4", signal))),
      soft(() => cached("noaa:n2o-growth", ttl, () => fetchNoaaGasGrowth("n2o", signal))),
    ]);

    const liveSources: string[] = [];
    const kpis: Contribution["kpis"] = {};
    const datasets: Contribution["datasets"] = {};
    const pollutantTrends: NonNullable<Contribution["pollutantTrends"]> = {};
    const regionRows: NonNullable<Contribution["regionRows"]> = [];

    if (co2Monthly?.length) {
      kpis.co2Ppm = +latestMonthlyValue(co2Monthly)!.value.toFixed(1);
      liveSources.push("NOAA GML CO₂/CH₄");
    }
    const ch4Latest = ch4Monthly ? latestMonthlyValue(ch4Monthly) : null;
    if (ch4Latest) kpis.ch4Ppb = Math.round(ch4Latest.value);

    let warmingCvsPreIndustrial: number | undefined;
    const tempLatest = temps ? latestMonthlyAnomaly(temps.monthly) : null;
    if (tempLatest && temps) {
      kpis.tempAnomalyC = tempLatest.anomalyC;
      kpis.latestMonthLabel =
        new Date(tempLatest.year, tempLatest.month - 1, 1).toLocaleString("en", { month: "short" }) +
        " " +
        tempLatest.year;
      warmingCvsPreIndustrial = warmingVsPreIndustrial(temps.annual[temps.annual.length - 1] ?? null) ?? undefined;
      liveSources.push("NASA GISTEMP");
    }

    let slLatest: ReturnType<typeof latestVsBaseline> = null;
    if (gmsl?.quarters.length) {
      slLatest = latestVsBaseline(gmsl.quarters, buildQuarterLookup(gmsl.quarters));
      if (slLatest) {
        kpis.seaLevelMmVs2000 = slLatest.valueMmVs2000;
        liveSources.push("UHSLC/OWID sea level");
      }
    }

    if (warmingCvsPreIndustrial != null) kpis.warmingCvsPreIndustrial = warmingCvsPreIndustrial;

    const yearsDataset = translateYears({ tempsAnnual: temps?.annual, co2Annual, quarters: gmsl?.quarters });
    if (yearsDataset) datasets.years = yearsDataset;
    const monthsDataset = translateMonths({
      tempsMonthly: temps?.monthly,
      co2Monthly,
      quarters: gmsl?.quarters,
    });
    if (monthsDataset) datasets.months = monthsDataset;

    const ch4T = ch4Gr ? growthTrend(ch4Gr) : undefined;
    if (ch4T) {
      pollutantTrends.ch4 = ch4T;
      if (!liveSources.includes("NOAA GML CO₂/CH₄")) liveSources.push("NOAA GML CO₂/CH₄");
    }
    const n2oT = n2oGr ? growthTrend(n2oGr) : undefined;
    if (n2oT) pollutantTrends.n2o = n2oT;

    if (warmingCvsPreIndustrial != null) {
      regionRows.push({
        region: "Global",
        row: {
          name: "Global mean",
          metric: "+" + warmingCvsPreIndustrial.toFixed(2) + "°C",
          sub: "vs pre-industrial · est.",
          badge: "critical",
          badgeText: "critical",
        },
      });
    }
    if (kpis.co2Ppm != null) {
      regionRows.push({
        region: "Global",
        row: {
          name: "CO₂ concentration",
          metric: kpis.co2Ppm.toFixed(1) + " ppm",
          sub: "NOAA GML · global monthly",
          badge: "critical",
          badgeText: "critical",
        },
      });
    }
    if (slLatest) {
      regionRows.push({
        region: "Global",
        row: {
          name: "Sea level",
          metric: "+" + slLatest.valueMmVs2000.toFixed(0) + " mm",
          sub: "rise vs 2000 · tide-gauge recon",
          badge: "elevated",
          badgeText: "elevated",
        },
      });
    }

    return {
      liveSources,
      ...(Object.keys(kpis).length ? { kpis } : {}),
      ...(Object.keys(datasets).length ? { datasets } : {}),
      ...(Object.keys(pollutantTrends).length ? { pollutantTrends } : {}),
      regionRows,
    };
  },
};
