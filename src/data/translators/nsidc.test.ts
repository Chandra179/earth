import { describe, expect, it } from "vitest";
import type { RawSeaIceDay } from "../sources/nsidcSeaIce";
import { iceStatus, medianForDate } from "./nsidc";

function day(year: number, month: number, d: number, extentMkm2: number): RawSeaIceDay {
  return { year, month, day: d, extentMkm2 };
}

const data = [
  day(1990, 8, 15, 8),
  day(2000, 8, 15, 7),
  day(2010, 8, 15, 5),
  day(2020, 9, 1, 4),
];

describe("medianForDate", () => {
  it("returns the middle value for odd counts", () => {
    expect(medianForDate(data, 8, 15, 1980, 2020)).toBe(7);
  });

  it("averages the two middle values for even counts", () => {
    const even = [...data, day(2021, 8, 15, 3)];
    expect(medianForDate(even, 8, 15, 1980, 2021)).toBe(6);
  });

  it("returns null when nothing matches", () => {
    expect(medianForDate(data, 12, 25, 1980, 2020)).toBeNull();
  });
});

describe("iceStatus", () => {
  it("flags critical well below the 1981–2010 median", () => {
    expect(iceStatus(day(2024, 8, 15, 5.5), data).badge).toBe("critical");
  });

  it("flags elevated below the median", () => {
    expect(iceStatus(day(2024, 8, 15, 6.5), data).badge).toBe("elevated");
  });

  it("reports stable at or above the median", () => {
    expect(iceStatus(day(2024, 8, 15, 7), data).badge).toBe("stable");
  });

  it("falls back to stable when no reference exists", () => {
    expect(iceStatus(day(2024, 2, 28, 5), []).text).toBe("no median ref");
  });
});
