import { v, type Validator } from "convex/values";
import {
  AUTOMATION_EVENT_KINDS,
  REQUEST_STATUSES,
  ROLES,
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
} from "../shared/constants";

/** Builds a Convex union validator from a readonly tuple of string literals. */
function literalUnion<T extends readonly [string, string, ...string[]]>(
  values: T,
): Validator<T[number], "required", never> {
  const [a, b, ...rest] = values;
  // v.union loses the literal types when spread from an array, so restore them here.
  return v.union(
    v.literal(a),
    v.literal(b),
    ...rest.map((value) => v.literal(value)),
  ) as unknown as Validator<T[number], "required", never>;
}

export const vRole = literalUnion(ROLES);
export const vToolCategory = literalUnion(TOOL_CATEGORIES);
export const vToolCondition = literalUnion(TOOL_CONDITIONS);
export const vRequestStatus = literalUnion(REQUEST_STATUSES);
export const vAutomationEventKind = literalUnion(AUTOMATION_EVENT_KINDS);

/** Calendar date in ISO format (YYYY-MM-DD). Format is checked in the service layer. */
export const vIsoDate = v.string();
