import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireUser } from "./lib/auth";
import { vIsoDate } from "./lib/validators";
import * as requestService from "./services/requestService";

/** Borrow requests and loans controller. Thin handlers over requestService. */

const requestId = { requestId: v.id("borrowRequests") };

export const create = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: vIsoDate,
    endDate: vIsoDate,
    message: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const actor = await requireUser(ctx);
    return requestService.create(ctx, actor, input);
  },
});

export const approve = mutation({
  args: requestId,
  handler: async (ctx, { requestId }) => {
    const actor = await requireUser(ctx);
    return requestService.approve(ctx, actor, requestId);
  },
});

export const decline = mutation({
  args: requestId,
  handler: async (ctx, { requestId }) => {
    const actor = await requireUser(ctx);
    await requestService.decline(ctx, actor, requestId);
  },
});

export const cancel = mutation({
  args: requestId,
  handler: async (ctx, { requestId }) => {
    const actor = await requireUser(ctx);
    await requestService.cancel(ctx, actor, requestId);
  },
});

export const markReturned = mutation({
  args: requestId,
  handler: async (ctx, { requestId }) => {
    const actor = await requireUser(ctx);
    await requestService.markReturned(ctx, actor, requestId);
  },
});

/** "My requests": requests the caller made as a borrower. */
export const listMine = query({
  args: {},
  handler: async (ctx) => requestService.listMine(ctx, await requireUser(ctx)),
});

/** "Incoming requests": requests on the caller's tools. */
export const listIncoming = query({
  args: {},
  handler: async (ctx) => requestService.listIncoming(ctx, await requireUser(ctx)),
});

/** Admin: every loan (approved and returned). */
export const listAllLoans = query({
  args: {},
  handler: async (ctx) => requestService.listAllLoans(ctx, await requireAdmin(ctx)),
});
