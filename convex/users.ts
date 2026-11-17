import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { getCurrentUser, requireAdmin, requireUser } from "./lib/auth";
import { unauthenticated } from "./lib/errors";
import { vRole } from "./lib/validators";
import * as userService from "./services/userService";

/**
 * Users controller. Thin handlers: validate args, resolve the caller, call the
 * service. Authorization decisions live in services/policy.ts.
 */

/** The signed-in user's own profile, or null when signed out / not provisioned yet. */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user ? userService.toSelfView(user) : null;
  },
});

/** Called by the client after sign-in. Creates or refreshes the profile from JWT claims. */
export const ensureCurrent = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw unauthenticated();
    return userService.ensureFromIdentity(ctx, identity);
  },
});

/** Admin: list members for the Trusted Lender screen. */
export const listForAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return userService.listForAdmin(ctx);
  },
});

/** Admin: mark or unmark a lender as Trusted Lender. */
export const setTrustedLender = mutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  handler: async (ctx, { userId, trusted }) => {
    const actor = await requireUser(ctx);
    await userService.setTrustedLender(ctx, actor, userId, trusted);
  },
});

/**
 * Operator only. Not callable from the browser: internal functions can only be
 * run from the Convex dashboard or CLI by someone with deployment access.
 *   npx convex run users:setRole "{\"email\":\"you@example.com\",\"role\":\"admin\"}"
 */
export const setRole = internalMutation({
  args: { email: v.optional(v.string()), clerkUserId: v.optional(v.string()), role: vRole },
  handler: async (ctx, { email, clerkUserId, role }) => {
    return userService.setRole(ctx, { email, clerkUserId }, role);
  },
});

/** Called by the Clerk webhook HTTP action after signature verification. */
export const syncFromClerk = internalMutation({
  args: {
    clerkUserId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => userService.syncFromClerk(ctx, args),
});

export const deleteFromClerk = internalMutation({
  args: { clerkUserId: v.string() },
  handler: async (ctx, { clerkUserId }) => userService.deleteFromClerk(ctx, clerkUserId),
});
