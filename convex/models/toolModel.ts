import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { ToolCategory } from "../shared/constants";

/** Data access for the `tools` table. No business rules here. */

export type ToolDoc = Doc<"tools">;
export type NewTool = Omit<ToolDoc, "_id" | "_creationTime">;

/** Upper bound for list screens; the board is neighborhood-sized. */
export const LIST_LIMIT = 200;

export function getById(ctx: QueryCtx, id: Id<"tools">) {
  return ctx.db.get(id);
}

export function insert(ctx: MutationCtx, tool: NewTool) {
  return ctx.db.insert("tools", tool);
}

export function patch(ctx: MutationCtx, id: Id<"tools">, fields: Partial<NewTool>) {
  return ctx.db.patch(id, fields);
}

/** Listed (not removed) tools, newest first, optionally by category. */
export function listListed(ctx: QueryCtx, category?: ToolCategory) {
  return ctx.db
    .query("tools")
    .withIndex("by_removedAt_category", (q) =>
      category
        ? q.eq("removedAt", undefined).eq("category", category)
        : q.eq("removedAt", undefined),
    )
    .order("desc")
    .take(LIST_LIMIT);
}

export async function listListedByOwner(ctx: QueryCtx, ownerId: Id<"users">) {
  const rows = await ctx.db
    .query("tools")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .take(LIST_LIMIT);
  return rows.filter((tool) => tool.removedAt === undefined);
}

export async function getManyByIds(ctx: QueryCtx, ids: Id<"tools">[]) {
  const unique = [...new Set(ids)];
  const docs = await Promise.all(unique.map((id) => ctx.db.get(id)));
  return new Map(docs.filter((d): d is ToolDoc => d !== null).map((d) => [d._id, d]));
}
