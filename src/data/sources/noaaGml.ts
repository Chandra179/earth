import { getText } from "./http";
import { csvRows, num } from "./csv";

export type NoaaGas = "co2" | "ch4" | "n2o" | "sf6";
export type RawMonthlyValue = { year: number; month: number; value: number };
export type RawAnnualValue = { year: number; value: number };

function gasFile(gas: NoaaGas, kind: "mm" | "annmean" | "gr"): string {
  return `https://gml.noaa.gov/webdata/ccgg/trends/${gas}/${gas}_${kind}_gl.csv`;
}

function parseMonthly(text: string): RawMonthlyValue[] {
  const out: RawMonthlyValue[] = [];
  for (const r of csvRows(text)) {
    const year = num(r[0]);
    const month = num(r[1]);
    const value = num(r[3]);
    if (year > 1900 && month >= 1 && month <= 12 && Number.isFinite(value) && value > -9) {
      out.push({ year, month, value });
    }
  }
  return out;
}

export async function fetchNoaaGasMonthly(gas: NoaaGas, signal?: AbortSignal): Promise<RawMonthlyValue[]> {
  const out = parseMonthly(await getText(gasFile(gas, "mm"), { signal }));
  if (!out.length) throw new Error(`no ${gas} monthly data`);
  return out;
}

export async function fetchNoaaCo2Annual(signal?: AbortSignal): Promise<RawAnnualValue[]> {
  const out: RawAnnualValue[] = [];
  for (const r of csvRows(await getText(gasFile("co2", "annmean"), { signal }))) {
    const year = num(r[0]);
    const value = num(r[1]);
    if (year > 1900 && Number.isFinite(value)) out.push({ year, value });
  }
  if (!out.length) throw new Error("no co2 annual data");
  return out;
}

export async function fetchNoaaGasGrowth(gas: NoaaGas, signal?: AbortSignal): Promise<RawAnnualValue[]> {
  const out: RawAnnualValue[] = [];
  for (const r of csvRows(await getText(gasFile(gas, "gr"), { signal }))) {
    const year = num(r[0]);
    const value = num(r[1]);
    if (year > 1900 && Number.isFinite(value)) out.push({ year, value });
  }
  if (!out.length) throw new Error(`no ${gas} growth data`);
  return out;
}
