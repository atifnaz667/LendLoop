import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdmin, requireUser } from "./lib/auth";
import { vToolCategory, vToolCondition } from "./lib/validators";
import * as toolService from "./services/toolService";

/** Tools controller. Thin handlers: validate args, resolve the caller, call the service. */

const toolInput = {
  name: v.string(),
  category: vToolCategory,
  condition: vToolCondition,
  description: v.string(),
};

/** Public landing page list. No auth required; returns name and category only. */
export const listPublic = query({
  args: {},
  handler: async (ctx) => toolService.listPublic(ctx),
});

export const browse = query({
  args: { category: v.optional(vToolCategory) },
  handler: async (ctx, { category }) => {
    const actor = await requireUser(ctx);
    return toolService.browse(ctx, actor, category);
  },
});

export const get = query({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const actor = await requireUser(ctx);
    return toolService.getForViewer(ctx, actor, toolId);
  },
});

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requireUser(ctx);
    return toolService.listMine(ctx, actor);
  },
});

export const create = mutation({
  args: toolInput,
  handler: async (ctx, input) => {
    const actor = await requireUser(ctx);
    return toolService.create(ctx, actor, input);
  },
});

export const update = mutation({
  args: { toolId: v.id("tools"), ...toolInput },
  handler: async (ctx, { toolId, ...input }) => {
    const actor = await requireUser(ctx);
    await toolService.update(ctx, actor, toolId, input);
  },
});

export const remove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const actor = await requireUser(ctx);
    await toolService.removeOwn(ctx, actor, toolId);
  },
});

export const adminRemove = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, { toolId }) => {
    const actor = await requireAdmin(ctx);
    await toolService.adminRemove(ctx, actor, toolId);
  },
});
