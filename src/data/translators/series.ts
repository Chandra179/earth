export function olsSlope(vals: number[]): number {
  const n = vals.length;
  if (n < 2) return 0;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) {
    sx += i; sy += vals[i]; sxy += i * vals[i]; sxx += i * i;
  }
  return (n * sxy - sx * sy) / (n * sxx - sx * sx);
}

export function meanLastDiff(vals: number[], n: number): number {
  const tail = vals.slice(-Math.min(n + 1, vals.length));
  let sum = 0;
  for (let i = 1; i < tail.length; i++) sum += tail[i] - tail[i - 1];
  return sum / Math.max(tail.length - 1, 1);
}

export function ym(year: number, month: number): string {
  return year + "-" + String(month).padStart(2, "0");
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleString("en", { month: "short" }) + " '" + String(year).slice(2);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatUtc(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}
