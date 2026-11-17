import { describe, expect, it } from "vitest";
import { canTransition } from "@convex/services/requestStateMachine";
import { validateDateRange } from "@convex/services/requestService";

describe("request state machine", () => {
  it("allows only the documented transitions", () => {
    expect(canTransition("pending", "approved")).toBe(true);
    expect(canTransition("pending", "declined")).toBe(true);
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("approved", "returned")).toBe(true);

    expect(canTransition("pending", "returned")).toBe(false);
    expect(canTransition("approved", "declined")).toBe(false);
    expect(canTransition("declined", "approved")).toBe(false);
    expect(canTransition("returned", "approved")).toBe(false);
    expect(canTransition("cancelled", "pending")).toBe(false);
  });
});

describe("validateDateRange", () => {
  const today = "2026-11-17";
  it("accepts a same-day loan starting today", () => {
    expect(() => validateDateRange(today, today, today)).not.toThrow();
  });
  it("accepts exactly 30 days and rejects 31", () => {
    expect(() => validateDateRange("2026-11-18", "2026-12-17", today)).not.toThrow();
    expect(() => validateDateRange("2026-11-18", "2026-12-18", today)).toThrow(/30 days/);
  });
});
