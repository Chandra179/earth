import { getText } from "./http";
import { num } from "./csv";

const WFS = (import.meta.env.DEV ? "/proxy/inpe" : "https://terrabrasilis.dpi.inpe.br") + "/geoserver/ows";
const PAGE = 50000;

export type RawProdesRow = { cls: string; areaKm2: number };

function wfsUrl(cql: string, startIndex: number): string {
  const q = new URLSearchParams({
    service: "WFS",
    version: "1.0.0",
    request: "GetFeature",
    outputFormat: "csv",
    typeName: "prodes-amazon-nb:yearly_deforestation_biome",
    propertyName: "year,class_name,area_km",
    cql_filter: cql,
    startIndex: String(startIndex),
    maxFeatures: String(PAGE),
  });
  return `${WFS}?${q.toString()}`;
}

export async function fetchProdesYearRows(year: number): Promise<RawProdesRow[]> {
  const out: RawProdesRow[] = [];
  let clsCol = -1;
  let areaCol = -1;
  for (let start = 0; start < 500000; start += PAGE) {
    const text = await getText(wfsUrl(`class_name = 'd${year}'`, start), 120000);
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) break;
    const header = lines[0].split(",").map((h) => h.trim());
    if (clsCol < 0) {
      clsCol = header.indexOf("class_name");
      areaCol = header.indexOf("area_km");
      if (clsCol < 0 || areaCol < 0) throw new Error("unexpected prodes csv shape");
    }
    for (const line of lines.slice(1)) {
      const cells = line.split(",");
      out.push({ cls: cells[clsCol] ?? "", areaKm2: num(cells[areaCol]) });
    }
    if (lines.length - 1 < PAGE) break;
  }
  return out;
}
