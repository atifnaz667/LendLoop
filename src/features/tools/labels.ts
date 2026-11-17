import { CATEGORY_LABELS, CONDITION_LABELS } from "@convex/shared/constants";
import type { ToolCategory, ToolCondition } from "@convex/shared/constants";

export const categoryLabel = (c: ToolCategory) => CATEGORY_LABELS[c];
export const conditionLabel = (c: ToolCondition) => CONDITION_LABELS[c];

export function formatDate(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
