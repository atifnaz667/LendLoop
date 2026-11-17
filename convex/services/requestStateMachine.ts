import type { RequestStatus } from "../shared/constants";
import { conflict } from "../lib/errors";

/**
 * Allowed request transitions. Anything not listed is rejected, so a request
 * can never jump from declined back to approved, or be returned twice.
 */
const TRANSITIONS: Record<RequestStatus, readonly RequestStatus[]> = {
  pending: ["approved", "declined", "cancelled"],
  approved: ["returned"],
  declined: [],
  cancelled: [],
  returned: [],
};

export function canTransition(from: RequestStatus, to: RequestStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

const MESSAGES: Partial<Record<RequestStatus, string>> = {
  approved: "Only pending requests can be approved.",
  declined: "Only pending requests can be declined.",
  cancelled: "Only pending requests can be cancelled.",
  returned: "Only active loans can be marked as returned.",
};

export function assertTransition(from: RequestStatus, to: RequestStatus) {
  if (!canTransition(from, to)) {
    throw conflict(MESSAGES[to] ?? `Cannot change a ${from} request to ${to}.`);
  }
}
