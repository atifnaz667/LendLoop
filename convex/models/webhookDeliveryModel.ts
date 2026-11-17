import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Data access for the `webhookDeliveries` outbox table. */

export type DeliveryDoc = Doc<"webhookDeliveries">;
export type NewDelivery = Omit<DeliveryDoc, "_id" | "_creationTime">;

export function getById(ctx: QueryCtx, id: Id<"webhookDeliveries">) {
  return ctx.db.get(id);
}

export function insert(ctx: MutationCtx, delivery: NewDelivery) {
  return ctx.db.insert("webhookDeliveries", delivery);
}

export function patch(ctx: MutationCtx, id: Id<"webhookDeliveries">, fields: Partial<NewDelivery>) {
  return ctx.db.patch(id, fields);
}

/** Pending deliveries whose next attempt (or lease) is due. */
export function listDue(ctx: QueryCtx, now: number, limit: number) {
  return ctx.db
    .query("webhookDeliveries")
    .withIndex("by_status_nextAttemptAt", (q) =>
      q.eq("status", "pending").lte("nextAttemptAt", now),
    )
    .take(limit);
}

export function listByStatus(ctx: QueryCtx, status: DeliveryDoc["status"], limit: number) {
  return ctx.db
    .query("webhookDeliveries")
    .withIndex("by_status_nextAttemptAt", (q) => q.eq("status", status))
    .order("desc")
    .take(limit);
}
