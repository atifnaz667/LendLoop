import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** Data access for the `users` table. No business rules here. */

export type UserDoc = Doc<"users">;
export type NewUser = Omit<UserDoc, "_id" | "_creationTime">;

export function getById(ctx: QueryCtx, id: Id<"users">) {
  return ctx.db.get(id);
}

export function getByClerkUserId(ctx: QueryCtx, clerkUserId: string) {
  return ctx.db
    .query("users")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .unique();
}

export function getByEmail(ctx: QueryCtx, email: string) {
  return ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .first();
}

export function insert(ctx: MutationCtx, user: NewUser) {
  return ctx.db.insert("users", user);
}

export function patch(ctx: MutationCtx, id: Id<"users">, fields: Partial<NewUser>) {
  return ctx.db.patch(id, fields);
}

/** Active (non-deleted) users, newest first. Bounded for the admin screen. */
export async function listActive(ctx: QueryCtx, limit: number) {
  const rows = await ctx.db
    .query("users")
    .order("desc")
    .take(limit * 2);
  return rows.filter((u) => u.deletedAt === undefined).slice(0, limit);
}

export async function getManyByIds(ctx: QueryCtx, ids: Id<"users">[]) {
  const unique = [...new Set(ids)];
  const docs = await Promise.all(unique.map((id) => ctx.db.get(id)));
  return new Map(docs.filter((d): d is UserDoc => d !== null).map((d) => [d._id, d]));
}
