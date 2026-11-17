import type { QueryCtx } from "../_generated/server";
import * as userModel from "../models/userModel";
import type { UserDoc } from "../models/userModel";
import { forbidden, unauthenticated } from "./errors";

/**
 * Auth guards. Identity always comes from the Clerk JWT that Convex verified
 * (signature, issuer, audience, expiry). Never from function arguments.
 */

export async function getIdentity(ctx: QueryCtx) {
  return ctx.auth.getUserIdentity();
}

/** The caller's user record, or null when signed out or not yet provisioned. */
export async function getCurrentUser(ctx: QueryCtx): Promise<UserDoc | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const user = await userModel.getByClerkUserId(ctx, identity.subject);
  if (!user || user.deletedAt !== undefined) return null;
  return user;
}

export async function requireUser(ctx: QueryCtx): Promise<UserDoc> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw unauthenticated();
  const user = await userModel.getByClerkUserId(ctx, identity.subject);
  if (!user || user.deletedAt !== undefined) {
    // Signed in with Clerk but no active LendLoop profile (not provisioned yet, or deleted).
    throw unauthenticated();
  }
  return user;
}

export async function requireAdmin(ctx: QueryCtx): Promise<UserDoc> {
  const user = await requireUser(ctx);
  if (user.role !== "admin") throw forbidden("Admins only.");
  return user;
}
