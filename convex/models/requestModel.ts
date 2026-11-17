import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { RequestStatus } from "../shared/constants";

/** Data access for the `borrowRequests` table. No business rules here. */

export type RequestDoc = Doc<"borrowRequests">;
export type NewRequest = Omit<RequestDoc, "_id" | "_creationTime">;

export const LIST_LIMIT = 200;

export function getById(ctx: QueryCtx, id: Id<"borrowRequests">) {
  return ctx.db.get(id);
}

export function insert(ctx: MutationCtx, request: NewRequest) {
  return ctx.db.insert("borrowRequests", request);
}

export function patch(ctx: MutationCtx, id: Id<"borrowRequests">, fields: Partial<NewRequest>) {
  return ctx.db.patch(id, fields);
}

export function listByToolAndStatus(ctx: QueryCtx, toolId: Id<"tools">, status: RequestStatus) {
  return ctx.db
    .query("borrowRequests")
    .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", status))
    .collect();
}

export function listByBorrower(ctx: QueryCtx, borrowerId: Id<"users">) {
  return ctx.db
    .query("borrowRequests")
    .withIndex("by_borrower", (q) => q.eq("borrowerId", borrowerId))
    .order("desc")
    .take(LIST_LIMIT);
}

export function listByOwner(ctx: QueryCtx, ownerId: Id<"users">) {
  return ctx.db
    .query("borrowRequests")
    .withIndex("by_owner", (q) => q.eq("ownerId", ownerId))
    .order("desc")
    .take(LIST_LIMIT);
}

/** Loans (approved or returned) for the admin view, newest first. */
export async function listLoans(ctx: QueryCtx) {
  const [approved, returned] = await Promise.all(
    (["approved", "returned"] as const).map((status) =>
      ctx.db
        .query("borrowRequests")
        .withIndex("by_status_endDate", (q) => q.eq("status", status))
        .order("desc")
        .take(LIST_LIMIT),
    ),
  );
  return [...approved!, ...returned!];
}

/** Approved loans whose end date is before `today` (overdue). */
export function listOverdue(ctx: QueryCtx, today: string) {
  return ctx.db
    .query("borrowRequests")
    .withIndex("by_status_endDate", (q) => q.eq("status", "approved").lt("endDate", today))
    .take(LIST_LIMIT);
}
