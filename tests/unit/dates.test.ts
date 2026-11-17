import { describe, expect, it } from "vitest";
import {
  addDays,
  coversDate,
  daysBetween,
  isIsoDate,
  rangesOverlap,
  todayIso,
} from "@convex/lib/dates";

describe("dates", () => {
  it("validates real calendar dates only", () => {
    expect(isIsoDate("2026-11-17")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-1-7")).toBe(false);
    expect(isIsoDate("not a date")).toBe(false);
  });

  it("computes today in UTC", () => {
    expect(todayIso(Date.parse("2026-11-17T23:59:00Z"))).toBe("2026-11-17");
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-11-10", "2026-11-17")).toBe(7);
    expect(daysBetween("2026-11-17", "2026-11-10")).toBe(-7);
  });

  it("treats ranges as inclusive", () => {
    const a = { startDate: "2026-11-10", endDate: "2026-11-12" };
    expect(rangesOverlap(a, { startDate: "2026-11-12", endDate: "2026-11-14" })).toBe(true);
    expect(rangesOverlap(a, { startDate: "2026-11-13", endDate: "2026-11-14" })).toBe(false);
    expect(coversDate(a, "2026-11-12")).toBe(true);
    expect(coversDate(a, "2026-11-13")).toBe(false);
  });
});
