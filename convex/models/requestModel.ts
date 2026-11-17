import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { RequestStatus } from "../shared/constants";

/** Data access for the `borrowRequests` table. Write helpers arrive with the requests module. */

export type RequestDoc = Doc<"borrowRequests">;

export function listByToolAndStatus(ctx: QueryCtx, toolId: Id<"tools">, status: RequestStatus) {
  return ctx.db
    .query("borrowRequests")
    .withIndex("by_tool_status", (q) => q.eq("toolId", toolId).eq("status", status))
    .collect();
}
