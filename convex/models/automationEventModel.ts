import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Data access for the `automationEvents` table (activity written back by n8n). */

export type AutomationEventDoc = Doc<"automationEvents">;
export type NewAutomationEvent = Omit<AutomationEventDoc, "_id" | "_creationTime">;

export function getByIdempotencyKey(ctx: QueryCtx, idempotencyKey: string) {
  return ctx.db
    .query("automationEvents")
    .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
    .unique();
}

export function insert(ctx: MutationCtx, event: NewAutomationEvent) {
  return ctx.db.insert("automationEvents", event);
}

export function listForRequest(ctx: QueryCtx, requestId: Id<"borrowRequests">, limit: number) {
  return ctx.db
    .query("automationEvents")
    .withIndex("by_request", (q) => q.eq("requestId", requestId))
    .order("desc")
    .take(limit);
}
