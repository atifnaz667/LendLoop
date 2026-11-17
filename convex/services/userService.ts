import type { UserIdentity } from "convex/server";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { forbidden, notFound, validation } from "../lib/errors";
import * as userModel from "../models/userModel";
import type { Role } from "../shared/constants";
import { canSetTrustedLender } from "./policy";

const MAX_NAME_LENGTH = 80;
const ADMIN_LIST_LIMIT = 200;

/** Public-safe projection of the caller's own profile. */
export function toSelfView(user: userModel.UserDoc) {
  return {
    _id: user._id,
    name: user.name,
    role: user.role,
    isTrustedLender: user.isTrustedLender,
  };
}

function cleanName(raw: string | undefined | null): string | undefined {
  const name = raw?.trim().replace(/\s+/g, " ");
  return name ? name.slice(0, MAX_NAME_LENGTH) : undefined;
}

function displayNameFromIdentity(identity: UserIdentity): string {
  return (
    cleanName(identity.name) ??
    cleanName([identity.givenName, identity.familyName].filter(Boolean).join(" ")) ??
    cleanName(identity.nickname) ??
    "Neighbor"
  );
}

/**
 * Creates the caller's profile on first sign-in, or refreshes it. Every value
 * comes from verified token claims. New users always start as role "user".
 */
export async function ensureFromIdentity(ctx: MutationCtx, identity: UserIdentity) {
  const existing = await userModel.getByClerkUserId(ctx, identity.subject);
  const name = displayNameFromIdentity(identity);
  const email = identity.email?.toLowerCase();

  if (!existing) {
    const id = await userModel.insert(ctx, {
      clerkUserId: identity.subject,
      name,
      email,
      role: "user",
      isTrustedLender: false,
    });
    return id;
  }

  if (existing.deletedAt !== undefined) {
    // A deleted Clerk account cannot come back through a stale token.
    throw forbidden("This account has been deleted.");
  }

  const changes: Partial<userModel.NewUser> = {};
  if (existing.name !== name) changes.name = name;
  if (email && existing.email !== email) changes.email = email;
  if (Object.keys(changes).length > 0) await userModel.patch(ctx, existing._id, changes);
  return existing._id;
}

export interface ClerkUserFields {
  clerkUserId: string;
  name?: string;
  email?: string;
}

/** Upsert from a verified Clerk webhook (user.created / user.updated). */
export async function syncFromClerk(ctx: MutationCtx, fields: ClerkUserFields) {
  const existing = await userModel.getByClerkUserId(ctx, fields.clerkUserId);
  const name = cleanName(fields.name) ?? existing?.name ?? "Neighbor";
  const email = fields.email?.toLowerCase();

  if (!existing) {
    return userModel.insert(ctx, {
      clerkUserId: fields.clerkUserId,
      name,
      email,
      role: "user",
      isTrustedLender: false,
    });
  }
  if (existing.deletedAt !== undefined) return existing._id;
  await userModel.patch(ctx, existing._id, { name, email });
  return existing._id;
}

/**
 * Handles user.deleted: clears personal fields and marks the profile deleted.
 * The row is kept (anonymized) so loan history stays consistent.
 */
export async function deleteFromClerk(ctx: MutationCtx, clerkUserId: string) {
  const existing = await userModel.getByClerkUserId(ctx, clerkUserId);
  if (!existing || existing.deletedAt !== undefined) return null;
  await userModel.patch(ctx, existing._id, {
    name: "Deleted user",
    email: undefined,
    isTrustedLender: false,
    role: "user",
    deletedAt: Date.now(),
  });
  return existing._id;
}

/** Operator-only role change (internal mutation, CLI or dashboard). */
export async function setRole(
  ctx: MutationCtx,
  target: { email?: string; clerkUserId?: string },
  role: Role,
) {
  let user: userModel.UserDoc | null = null;
  if (target.clerkUserId) {
    user = await userModel.getByClerkUserId(ctx, target.clerkUserId);
  } else if (target.email) {
    user = await userModel.getByEmail(ctx, target.email.trim().toLowerCase());
  } else {
    throw validation("Provide an email or clerkUserId.");
  }
  if (!user || user.deletedAt !== undefined) throw notFound("User");
  await userModel.patch(ctx, user._id, { role });
  return user._id;
}

export async function setTrustedLender(
  ctx: MutationCtx,
  actor: userModel.UserDoc,
  userId: Id<"users">,
  trusted: boolean,
) {
  if (!canSetTrustedLender(actor)) throw forbidden("Only admins can mark trusted lenders.");
  const user = await userModel.getById(ctx, userId);
  if (!user || user.deletedAt !== undefined) throw notFound("User");
  await userModel.patch(ctx, userId, { isTrustedLender: trusted });
}

/** Admin view: no emails, just what the trusted-lender screen needs. */
export async function listForAdmin(ctx: QueryCtx) {
  const users = await userModel.listActive(ctx, ADMIN_LIST_LIMIT);
  return users.map((u) => ({
    _id: u._id,
    name: u.name,
    role: u.role,
    isTrustedLender: u.isTrustedLender,
    joinedAt: u._creationTime,
  }));
}
