import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { dispatchToN8n } from "./integrations/n8nDispatch";
import { requireAdmin } from "./lib/auth";
import * as outboxService from "./services/outboxService";

/** Outbox controller: internal delivery pipeline plus the admin health view. */

const deliveryId = { deliveryId: v.id("webhookDeliveries") };

export const claim = internalMutation({
  args: deliveryId,
  handler: async (ctx, { deliveryId }) => outboxService.claim(ctx, deliveryId),
});

export const markDelivered = internalMutation({
  args: deliveryId,
  handler: async (ctx, { deliveryId }) => outboxService.markDelivered(ctx, deliveryId),
});

export const markAttemptFailed = internalMutation({
  args: { ...deliveryId, error: v.string(), retryable: v.boolean() },
  handler: async (ctx, { deliveryId, error, retryable }) =>
    outboxService.markAttemptFailed(ctx, deliveryId, error, retryable),
});

/** One delivery attempt: claim, send, record. Scheduled by enqueue, retries and the sweep. */
export const deliver = internalAction({
  args: deliveryId,
  handler: async (ctx, { deliveryId }) => {
    const claimed = await ctx.runMutation(internal.webhookDeliveries.claim, { deliveryId });
    if (!claimed) return;

    const result = await dispatchToN8n(
      { url: process.env.N8N_REQUEST_WEBHOOK_URL, secret: process.env.LENDLOOP_TO_N8N_SECRET },
      claimed,
    );
    if (result.ok) {
      await ctx.runMutation(internal.webhookDeliveries.markDelivered, { deliveryId });
    } else {
      await ctx.runMutation(internal.webhookDeliveries.markAttemptFailed, {
        deliveryId,
        error: result.error,
        retryable: result.retryable,
      });
    }
  },
});

export const sweep = internalMutation({
  args: {},
  handler: async (ctx) => outboxService.sweepDue(ctx),
});

export const health = query({
  args: {},
  handler: async (ctx) => outboxService.healthForAdmin(ctx, await requireAdmin(ctx)),
});

export const retry = mutation({
  args: deliveryId,
  handler: async (ctx, { deliveryId }) => {
    const actor = await requireAdmin(ctx);
    await outboxService.retry(ctx, actor, deliveryId);
  },
});
