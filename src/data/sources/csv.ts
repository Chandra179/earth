export function num(s: string | undefined): number {
  if (!s) return NaN;
  const v = parseFloat(s.trim());
  return Number.isFinite(v) ? v : NaN;
}

export function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i];
      if (inQ) {
        if (ch === '"' && trimmed[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQ = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    rows.push(cells);
  }
  return rows;
}

export function headerIndex(header: string[], name: string): number {
  const i = header.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());
  if (i < 0) throw new Error(`missing column ${name}`);
  return i;
}
