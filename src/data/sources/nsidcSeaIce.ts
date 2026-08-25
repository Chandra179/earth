import { getText } from "./http";
import { num } from "./csv";

const NSIDC = import.meta.env.DEV ? "/proxy/nsidc" : "https://noaadata.apps.nsidc.org";

export type Hemisphere = "north" | "south";
export type RawSeaIceDay = { year: number; month: number; day: number; extentMkm2: number };

export async function fetchNsidcSeaIceRaw(hemisphere: Hemisphere): Promise<RawSeaIceDay[]> {
  const cap = hemisphere === "north" ? "N" : "S";
  const url = `${NSIDC}/NOAA/G02135/${hemisphere}/daily/data/${cap}_seaice_extent_daily_v4.0.csv`;
  const rows = (await getText(url, 25000)).split(/\r?\n/);
  const out: RawSeaIceDay[] = [];
  for (const line of rows) {
    if (!line || /^[\sY]/.test(line)) continue;
    const cells = line.split(",");
    const year = Math.trunc(num(cells[0]));
    const month = Math.trunc(num(cells[1]));
    const day = Math.trunc(num(cells[2]));
    const extent = num(cells[3]);
    if (year >= 1978 && month >= 1 && month <= 12 && day >= 1 && day <= 31 && Number.isFinite(extent) && extent > 0) {
      out.push({ year, month, day, extentMkm2: extent });
    }
  }
  if (!out.length) throw new Error(`no ${hemisphere} sea ice data`);
  return out;
}
