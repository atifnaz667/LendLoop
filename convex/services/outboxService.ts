import type { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { forbidden, notFound } from "../lib/errors";
import * as deliveryModel from "../models/webhookDeliveryModel";
import type { DeliveryDoc } from "../models/webhookDeliveryModel";
import type { UserDoc } from "../models/userModel";
import type { RequestEventType } from "../shared/constants";
import { isAdmin } from "./policy";

/**
 * Transactional outbox for Convex -> n8n events.
 *
 * `enqueue` runs inside the same mutation as the state change, so the event is
 * recorded if and only if the change commits. Delivery happens in a scheduled
 * action with retries and exponential backoff.
 */

export const MAX_ATTEMPTS = 5;
/** While an attempt is in flight the row is leased so a sweep cannot double-send. */
export const LEASE_MS = 2 * 60 * 1000;
const BASE_BACKOFF_MS = 30 * 1000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;

/** 30s, 2m, 8m, 32m, then capped at 1h. */
export function backoffMs(attempt: number): number {
  return Math.min(BASE_BACKOFF_MS * 4 ** Math.max(0, attempt - 1), MAX_BACKOFF_MS);
}

export async function enqueue(
  ctx: MutationCtx,
  event: {
    eventType: RequestEventType;
    requestId: Id<"borrowRequests">;
    body: Record<string, unknown>;
  },
) {
  const eventId = crypto.randomUUID();
  const now = Date.now();
  const payload = JSON.stringify({
    eventId,
    eventType: event.eventType,
    occurredAt: now,
    ...event.body,
  });
  const deliveryId = await deliveryModel.insert(ctx, {
    eventId,
    eventType: event.eventType,
    requestId: event.requestId,
    payload,
    status: "pending",
    attempts: 0,
    nextAttemptAt: now,
  });
  await ctx.scheduler.runAfter(0, internal.webhookDeliveries.deliver, { deliveryId });
  return deliveryId;
}

/**
 * Claims a delivery for one attempt. Returns null when it is not due (already
 * delivered, failed, or leased by another attempt). Mutations are serializable,
 * so two concurrent claims cannot both succeed.
 */
export async function claim(ctx: MutationCtx, deliveryId: Id<"webhookDeliveries">) {
  const delivery = await deliveryModel.getById(ctx, deliveryId);
  const now = Date.now();
  if (!delivery || delivery.status !== "pending" || delivery.nextAttemptAt > now) return null;
  await deliveryModel.patch(ctx, deliveryId, {
    attempts: delivery.attempts + 1,
    nextAttemptAt: now + LEASE_MS,
  });
  return { eventId: delivery.eventId, payload: delivery.payload, attempt: delivery.attempts + 1 };
}

export async function markDelivered(ctx: MutationCtx, deliveryId: Id<"webhookDeliveries">) {
  await deliveryModel.patch(ctx, deliveryId, {
    status: "delivered",
    deliveredAt: Date.now(),
    lastError: undefined,
  });
}

/** Records a failed attempt and either schedules a retry or gives up visibly. */
export async function markAttemptFailed(
  ctx: MutationCtx,
  deliveryId: Id<"webhookDeliveries">,
  error: string,
  retryable: boolean,
) {
  const delivery = await deliveryModel.getById(ctx, deliveryId);
  if (!delivery || delivery.status !== "pending") return;
  const lastError = error.slice(0, 500);

  if (!retryable || delivery.attempts >= MAX_ATTEMPTS) {
    await deliveryModel.patch(ctx, deliveryId, { status: "failed", lastError });
    console.error(`Webhook delivery ${delivery.eventId} failed permanently: ${lastError}`);
    return;
  }
  const delay = backoffMs(delivery.attempts);
  await deliveryModel.patch(ctx, deliveryId, { nextAttemptAt: Date.now() + delay, lastError });
  await ctx.scheduler.runAfter(delay, internal.webhookDeliveries.deliver, { deliveryId });
}

/** Cron safety net: re-schedules due rows whose scheduled run was missed. */
export async function sweepDue(ctx: MutationCtx) {
  const due = await deliveryModel.listDue(ctx, Date.now(), 50);
  for (const delivery of due) {
    await ctx.scheduler.runAfter(0, internal.webhookDeliveries.deliver, {
      deliveryId: delivery._id,
    });
  }
  return due.length;
}

// ---------------------------------------------------------------------------
// Retention
// ---------------------------------------------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
/** Payloads hold a recipient's first name and email, so they are not kept longer than needed. */
export const RETENTION = { deliveredDays: 7, failedDays: 30 } as const;
const PURGE_BATCH = 200;

/** Deletes old finished deliveries in batches; the daily cron calls it. */
export async function purgeOld(ctx: MutationCtx, now = Date.now()) {
  const delivered = await deliveryModel.listFinishedBefore(
    ctx,
    "delivered",
    now - RETENTION.deliveredDays * DAY_MS,
    PURGE_BATCH,
  );
  const failed = await deliveryModel.listFinishedBefore(
    ctx,
    "failed",
    now - RETENTION.failedDays * DAY_MS,
    PURGE_BATCH,
  );
  for (const row of [...delivered, ...failed]) await deliveryModel.remove(ctx, row._id);
  return delivered.length + failed.length;
}

// ---------------------------------------------------------------------------
// Admin: automation health
// ---------------------------------------------------------------------------

function toAdminView(d: DeliveryDoc) {
  return {
    _id: d._id,
    eventType: d.eventType,
    status: d.status,
    attempts: d.attempts,
    lastError: d.lastError,
    createdAt: d._creationTime,
    deliveredAt: d.deliveredAt,
    nextAttemptAt: d.status === "pending" ? d.nextAttemptAt : undefined,
  };
}

export async function healthForAdmin(ctx: QueryCtx, actor: UserDoc) {
  if (!isAdmin(actor)) throw forbidden("Admins only.");
  const [failed, pending, delivered] = await Promise.all([
    deliveryModel.listByStatus(ctx, "failed", 50),
    deliveryModel.listByStatus(ctx, "pending", 50),
    deliveryModel.listByStatus(ctx, "delivered", 20),
  ]);
  return {
    failed: failed.map(toAdminView),
    pending: pending.map(toAdminView),
    recentDelivered: delivered.map(toAdminView),
  };
}

/**
 * Admin: send a delivery now. A failed one goes back in the queue with a fresh
 * attempt budget; a waiting one skips the rest of its backoff. The eventId stays
 * the same, so n8n dedupes if an attempt was already in flight.
 */
export async function retry(ctx: MutationCtx, actor: UserDoc, deliveryId: Id<"webhookDeliveries">) {
  if (!isAdmin(actor)) throw forbidden("Admins only.");
  const delivery = await deliveryModel.getById(ctx, deliveryId);
  if (!delivery) throw notFound("Delivery");
  if (delivery.status === "delivered") return;
  await deliveryModel.patch(ctx, deliveryId, {
    status: "pending",
    attempts: delivery.status === "failed" ? 0 : Math.min(delivery.attempts, MAX_ATTEMPTS - 1),
    nextAttemptAt: Date.now(),
  });
  await ctx.scheduler.runAfter(0, internal.webhookDeliveries.deliver, { deliveryId });
}
