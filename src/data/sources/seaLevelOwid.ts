import { getText } from "./http";
import { csvRows, headerIndex, num } from "./csv";

const OWID_URL = "https://ourworldindata.org/grapher/sea-level-rise.csv";

export type RawSeaLevelQuarter = { year: number; quarter: number; mm: number };
export type OwidRaw = { quarters: RawSeaLevelQuarter[]; seriesName: string };

function pickColumn(header: string[]): number {
  for (const name of ["UHSLC", "Average of Church and White (2011) and UHSLC", "Church and White (2011)"]) {
    try {
      return headerIndex(header, name);
    } catch {
      continue;
    }
  }
  throw new Error("no usable sea level column");
}

export async function fetchOwidSeaLevelRaw(): Promise<OwidRaw> {
  const rows = csvRows(await getText(OWID_URL));
  if (!rows.length) throw new Error("empty sea level response");
  const header = rows[0];
  const entityCol = headerIndex(header, "Entity");
  const qCol = headerIndex(header, "Quarter");
  const valCol = pickColumn(header);
  const quarters: RawSeaLevelQuarter[] = [];
  let seriesName = "";
  for (const r of rows.slice(1)) {
    if (r[entityCol]?.trim() !== "World") continue;
    const m = /^(\d{4})-Q([1-4])$/.exec(r[qCol] ?? "");
    const v = num(r[valCol]);
    if (!m || !Number.isFinite(v)) continue;
    seriesName = header[valCol]?.trim() ?? "";
    quarters.push({ year: parseInt(m[1], 10), quarter: parseInt(m[2], 10), mm: v });
  }
  if (!quarters.length) throw new Error("no sea level rows");
  return { quarters, seriesName };
}
