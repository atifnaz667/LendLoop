/**
 * Domain constants shared by Convex functions and the Next.js client.
 * This file must stay free of server-only imports so the browser bundle can use it.
 */

export const TOOL_CATEGORIES = [
  "power_tools",
  "hand_tools",
  "garden",
  "kitchen",
  "camping",
  "cleaning",
  "other",
] as const;
export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  power_tools: "Power tools",
  hand_tools: "Hand tools",
  garden: "Garden",
  kitchen: "Kitchen",
  camping: "Camping",
  cleaning: "Cleaning",
  other: "Other",
};

export const TOOL_CONDITIONS = ["new", "good", "fair", "worn"] as const;
export type ToolCondition = (typeof TOOL_CONDITIONS)[number];

export const CONDITION_LABELS: Record<ToolCondition, string> = {
  new: "Like new",
  good: "Good",
  fair: "Fair",
  worn: "Well used",
};

export const ROLES = ["admin", "user"] as const;
export type Role = (typeof ROLES)[number];

/**
 * Borrow request lifecycle. An "approved" request is an active loan.
 *
 *   pending  -> approved | declined | cancelled
 *   approved -> returned
 */
export const REQUEST_STATUSES = [
  "pending",
  "approved",
  "declined",
  "cancelled",
  "returned",
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const AUTOMATION_EVENT_KINDS = [
  "notification_sent",
  "notification_failed",
  "reminder_sent",
  "reminder_failed",
] as const;
export type AutomationEventKind = (typeof AUTOMATION_EVENT_KINDS)[number];

/** Input limits, enforced server side and mirrored in forms. */
export const LIMITS = {
  toolNameMax: 80,
  toolDescriptionMax: 500,
  requestMessageMax: 280,
  maxLoanDays: 30,
  maxDaysAhead: 180,
} as const;

/** Events Convex sends to the n8n request-notification workflow. */
export const REQUEST_EVENT_TYPES = [
  "request.created",
  "request.approved",
  "request.declined",
  "request.cancelled",
  "request.returned",
] as const;
export type RequestEventType = (typeof REQUEST_EVENT_TYPES)[number];
