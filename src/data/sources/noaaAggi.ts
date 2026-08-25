import { getText } from "./http";
import { csvRows, num } from "./csv";

/**
 * NOAA Annual Greenhouse Gas Index (AGGI) — annual effective radiative
 * forcing (W/m²) by gas group since 1979. Updated each fall; the "HFCs*"
 * column includes SF₆, "CFCs*" includes CCl₄/CH₃CCl₃/halons.
 * https://gml.noaa.gov/aggi/
 */
export type AggiRow = {
  year: number;
  co2: number;
  ch4: number;
  n2o: number;
  cfcs: number;
  hcfcs: number;
  hfcs: number;
  total: number;
};

const AGGI_CSV_URL = "https://gml.noaa.gov/aggi/AGGI_Table.csv";

function parseAggi(text: string): AggiRow[] {
  const out: AggiRow[] = [];
  for (const r of csvRows(text)) {
    const row = {
      year: num(r[0]),
      co2: num(r[1]),
      ch4: num(r[2]),
      n2o: num(r[3]),
      cfcs: num(r[4]),
      hcfcs: num(r[5]),
      hfcs: num(r[6]),
      total: num(r[7]),
    };
    if (row.year >= 1979 && [row.co2, row.ch4, row.n2o, row.cfcs, row.hcfcs, row.hfcs, row.total].every(Number.isFinite)) {
      out.push(row);
    }
  }
  return out;
}

export async function fetchAggiTable(signal?: AbortSignal): Promise<AggiRow[]> {
  const rows = parseAggi(await getText(AGGI_CSV_URL, { signal }));
  if (!rows.length) throw new Error("no AGGI forcing rows");
  return rows;
}
