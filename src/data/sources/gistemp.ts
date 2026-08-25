import { getText } from "./http";
import { csvRows, headerIndex, num } from "./csv";

const GISS = (import.meta.env.DEV ? "/proxy/giss" : "https://data.giss.nasa.gov") + "/gistemp/tabledata_v4";

export type RawMonthlyAnomaly = { year: number; month: number; anomalyC: number };
export type RawAnnualAnomaly = { year: number; anomalyC: number };
export type GistempRaw = { monthly: RawMonthlyAnomaly[]; annual: RawAnnualAnomaly[] };

function parseCsvTable(text: string): string[][] {
  const rows = csvRows(text);
  const hIdx = rows.findIndex((r) => r[0]?.trim() === "Year");
  if (hIdx < 0 || !rows[hIdx + 1]) throw new Error("gistemp header not found");
  return rows.slice(hIdx);
}

function monthCols(header: string[]): number[] {
  const names = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return names.map((n) => headerIndex(header, n));
}

function parse(text: string): GistempRaw {
  const rows = parseCsvTable(text);
  const header = rows[0];
  const yearCol = headerIndex(header, "Year");
  const jdCol = headerIndex(header, "J-D");
  const cols = monthCols(header);
  const monthly: RawMonthlyAnomaly[] = [];
  const annual: RawAnnualAnomaly[] = [];
  for (const r of rows.slice(1)) {
    const year = num(r[yearCol]);
    if (!(year >= 1880)) continue;
    for (let m = 0; m < 12; m++) {
      const v = num(r[cols[m]]);
      if (Number.isFinite(v)) monthly.push({ year, month: m + 1, anomalyC: v });
    }
    const a = num(r[jdCol]);
    if (Number.isFinite(a)) annual.push({ year, anomalyC: a });
  }
  if (!monthly.length || !annual.length) throw new Error("no gistemp data");
  return { monthly, annual };
}

export async function fetchGistempRaw(): Promise<GistempRaw> {
  return parse(await getText(`${GISS}/GLB.Ts+dSST.csv`));
}
