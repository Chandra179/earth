import type { RawProdesRow } from "../sources/inpeProdes";

export type ProdesYear = { year: number; areaKm2: number };

export function sumProdesYear(rows: RawProdesRow[], year: number): number {
  return rows.reduce(
    (sum, r) => (r.cls.trim() === "d" + year && Number.isFinite(r.areaKm2) ? sum + r.areaKm2 : sum),
    0,
  );
}
