import type { Doc } from "../_generated/dataModel";

/**
 * Permission rules as pure functions. Services call these before every write,
 * so the rules live in one place and are unit tested without a database.
 */

type Actor = Pick<Doc<"users">, "_id" | "role">;
type Tool = Pick<Doc<"tools">, "ownerId" | "removedAt">;
type Request = Pick<Doc<"borrowRequests">, "ownerId" | "borrowerId">;

export const isAdmin = (actor: Actor) => actor.role === "admin";

/** Edit or delete a listing: owners only. Admins remove listings, they don't edit them. */
export const canEditTool = (actor: Actor, tool: Tool) => tool.ownerId === actor._id;

/** Remove any listing (moderation). */
export const canRemoveAnyTool = (actor: Actor) => isAdmin(actor);

/** Borrow: any signed-in user, never their own tool, never a removed tool. */
export const canRequestTool = (actor: Actor, tool: Tool) =>
  tool.ownerId !== actor._id && tool.removedAt === undefined;

/** Approve, decline or mark returned: the tool owner only. */
export const canDecideRequest = (actor: Actor, request: Request) => request.ownerId === actor._id;

/** Cancel a pending request: the borrower only. */
export const canCancelRequest = (actor: Actor, request: Request) =>
  request.borrowerId === actor._id;

/** See a request's details: the two parties, or an admin. */
export const canViewRequest = (actor: Actor, request: Request) =>
  request.ownerId === actor._id || request.borrowerId === actor._id || isAdmin(actor);

export const canViewAllLoans = (actor: Actor) => isAdmin(actor);
export const canSetTrustedLender = (actor: Actor) => isAdmin(actor);
