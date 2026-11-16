import { describe, expect, it } from "vitest";
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
} from "@convex/shared/constants";

describe("shared constants", () => {
  it("has a label for every tool category", () => {
    for (const category of TOOL_CATEGORIES) {
      expect(CATEGORY_LABELS[category]).toBeTruthy();
    }
  });

  it("has a label for every tool condition", () => {
    for (const condition of TOOL_CONDITIONS) {
      expect(CONDITION_LABELS[condition]).toBeTruthy();
    }
  });
});
