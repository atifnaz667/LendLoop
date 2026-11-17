import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { addDays, daysBetween, isIsoDate, rangesOverlap, todayIso } from "../lib/dates";
import { conflict, forbidden, notFound, validation } from "../lib/errors";
import * as requestModel from "../models/requestModel";
import type { RequestDoc } from "../models/requestModel";
import * as toolModel from "../models/toolModel";
import * as userModel from "../models/userModel";
import type { UserDoc } from "../models/userModel";
import { LIMITS, type RequestStatus } from "../shared/constants";
import { canCancelRequest, canDecideRequest, canRequestTool, canViewAllLoans } from "./policy";
import { notifyRequestEvent } from "./notificationService";
import { assertTransition } from "./requestStateMachine";
import * as automationEventModel from "../models/automationEventModel";

export interface RequestInput {
  toolId: Id<"tools">;
  startDate: string;
  endDate: string;
  message?: string;
}

/** Date rules for a new request. Pure, so it is unit tested directly. */
export function validateDateRange(startDate: string, endDate: string, today: string) {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw validation("Dates must be valid calendar dates (YYYY-MM-DD).");
  }
  if (startDate < today) throw validation("The start date can't be in the past.");
  if (endDate < startDate) throw validation("The end date must be on or after the start date.");
  const days = daysBetween(startDate, endDate) + 1;
  if (days > LIMITS.maxLoanDays) {
    throw validation(`Loans can be at most ${LIMITS.maxLoanDays} days.`);
  }
  if (startDate > addDays(today, LIMITS.maxDaysAhead)) {
    throw validation(`Requests can start at most ${LIMITS.maxDaysAhead} days ahead.`);
  }
}

function cleanMessage(raw?: string) {
  const message = raw?.trim();
  if (!message) return undefined;
  if (message.length > LIMITS.requestMessageMax) {
    throw validation(`Message must be at most ${LIMITS.requestMessageMax} characters.`);
  }
  return message;
}

async function requireRequest(ctx: QueryCtx, id: Id<"borrowRequests">): Promise<RequestDoc> {
  const request = await requestModel.getById(ctx, id);
  if (!request) throw notFound("Request");
  return request;
}

async function assertNoApprovedOverlap(
  ctx: QueryCtx,
  toolId: Id<"tools">,
  range: { startDate: string; endDate: string },
  ignoreId?: Id<"borrowRequests">,
) {
  const approved = await requestModel.listByToolAndStatus(ctx, toolId, "approved");
  if (approved.some((loan) => loan._id !== ignoreId && rangesOverlap(loan, range))) {
    throw conflict("The tool is already booked for some of those dates.");
  }
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function create(ctx: MutationCtx, actor: UserDoc, input: RequestInput) {
  const tool = await toolModel.getById(ctx, input.toolId);
  if (!tool || tool.removedAt !== undefined) throw notFound("Tool");
  if (!canRequestTool(actor, tool)) throw forbidden("You can't borrow your own tool.");

  validateDateRange(input.startDate, input.endDate, todayIso());
  const message = cleanMessage(input.message);
  const range = { startDate: input.startDate, endDate: input.endDate };
  await assertNoApprovedOverlap(ctx, tool._id, range);

  const pending = await requestModel.listByToolAndStatus(ctx, tool._id, "pending");
  if (pending.some((r) => r.borrowerId === actor._id && rangesOverlap(r, range))) {
    throw conflict("You already have a pending request for these dates.");
  }
  const mine = await requestModel.listByBorrower(ctx, actor._id);
  if (mine.filter((r) => r.status === "pending").length >= LIMITS.maxPendingRequestsPerBorrower) {
    throw conflict(
      `You can have at most ${LIMITS.maxPendingRequestsPerBorrower} pending requests. Cancel one first.`,
    );
  }

  const requestId = await requestModel.insert(ctx, {
    toolId: tool._id,
    borrowerId: actor._id,
    ownerId: tool.ownerId,
    ...range,
    status: "pending",
    message,
  });
  await notifyRequestEvent(
    ctx,
    { _id: requestId, toolId: tool._id, ownerId: tool.ownerId, borrowerId: actor._id, ...range },
    "request.created",
  );
  return requestId;
}

/**
 * Owner approves. Also declines other pending requests that overlap, so the
 * owner never ends up with a double booking.
 */
export async function approve(ctx: MutationCtx, actor: UserDoc, id: Id<"borrowRequests">) {
  const request = await requireRequest(ctx, id);
  if (!canDecideRequest(actor, request)) throw forbidden("Only the tool's owner can approve.");
  assertTransition(request.status, "approved");
  if (request.endDate < todayIso()) throw conflict("This request's dates have already passed.");
  await assertNoApprovedOverlap(ctx, request.toolId, request, request._id);

  const now = Date.now();
  await requestModel.patch(ctx, id, { status: "approved", decidedAt: now });
  await notifyRequestEvent(ctx, request, "request.approved");

  const autoDeclined: Id<"borrowRequests">[] = [];
  const pending = await requestModel.listByToolAndStatus(ctx, request.toolId, "pending");
  for (const other of pending) {
    if (other._id !== id && rangesOverlap(other, request)) {
      await requestModel.patch(ctx, other._id, { status: "declined", decidedAt: now });
      await notifyRequestEvent(ctx, other, "request.declined", "dates_taken");
      autoDeclined.push(other._id);
    }
  }
  return { autoDeclined };
}

export async function decline(ctx: MutationCtx, actor: UserDoc, id: Id<"borrowRequests">) {
  const request = await requireRequest(ctx, id);
  if (!canDecideRequest(actor, request)) throw forbidden("Only the tool's owner can decline.");
  assertTransition(request.status, "declined");
  await requestModel.patch(ctx, id, { status: "declined", decidedAt: Date.now() });
  await notifyRequestEvent(ctx, request, "request.declined");
}

export async function cancel(ctx: MutationCtx, actor: UserDoc, id: Id<"borrowRequests">) {
  const request = await requireRequest(ctx, id);
  if (!canCancelRequest(actor, request)) throw forbidden("You can only cancel your own requests.");
  assertTransition(request.status, "cancelled");
  await requestModel.patch(ctx, id, { status: "cancelled", decidedAt: Date.now() });
  await notifyRequestEvent(ctx, request, "request.cancelled");
}

/** The lender confirms the tool came back. */
export async function markReturned(ctx: MutationCtx, actor: UserDoc, id: Id<"borrowRequests">) {
  const request = await requireRequest(ctx, id);
  if (!canDecideRequest(actor, request)) {
    throw forbidden("Only the tool's owner can mark it as returned.");
  }
  assertTransition(request.status, "returned");
  await requestModel.patch(ctx, id, { status: "returned", returnedAt: Date.now() });
  await notifyRequestEvent(ctx, request, "request.returned");
}

/** Called when a listing is removed: open requests can no longer be fulfilled. */
export async function declinePendingForTool(ctx: MutationCtx, toolId: Id<"tools">) {
  const pending = await requestModel.listByToolAndStatus(ctx, toolId, "pending");
  const now = Date.now();
  for (const request of pending) {
    await requestModel.patch(ctx, request._id, { status: "declined", decidedAt: now });
    await notifyRequestEvent(ctx, request, "request.declined", "listing_removed");
  }
  return pending.map((r) => r._id);
}

// ---------------------------------------------------------------------------
// Queries (views shaped per screen; only the other party's display name)
// ---------------------------------------------------------------------------

const ACTIVITY_LIMIT = 3;

function isOverdue(request: Pick<RequestDoc, "status" | "endDate">, today: string) {
  return request.status === "approved" && request.endDate < today;
}

async function hydrate(ctx: QueryCtx, requests: RequestDoc[]) {
  const [tools, users] = await Promise.all([
    toolModel.getManyByIds(
      ctx,
      requests.map((r) => r.toolId),
    ),
    userModel.getManyByIds(
      ctx,
      requests.flatMap((r) => [r.borrowerId, r.ownerId]),
    ),
  ]);
  const today = todayIso();
  const activity = await Promise.all(
    requests.map((r) => automationEventModel.listForRequest(ctx, r._id, ACTIVITY_LIMIT)),
  );
  return requests.map((r, index) => {
    const tool = tools.get(r.toolId);
    return {
      _id: r._id,
      toolId: r.toolId,
      toolName: tool?.name ?? "Removed tool",
      toolRemoved: tool?.removedAt !== undefined,
      startDate: r.startDate,
      endDate: r.endDate,
      status: r.status as RequestStatus,
      message: r.message,
      requestedAt: r._creationTime,
      decidedAt: r.decidedAt,
      returnedAt: r.returnedAt,
      isOverdue: isOverdue(r, today),
      // Recent automation activity written back by n8n (bonus: "Reminder sent 2 days ago").
      activity: (activity[index] ?? []).map((e) => ({ kind: e.kind, occurredAt: e.occurredAt })),
      borrower: { name: users.get(r.borrowerId)?.name ?? "Neighbor" },
      lender: {
        name: users.get(r.ownerId)?.name ?? "Neighbor",
        isTrustedLender: users.get(r.ownerId)?.isTrustedLender ?? false,
      },
    };
  });
}

export async function listMine(ctx: QueryCtx, actor: UserDoc) {
  return hydrate(ctx, await requestModel.listByBorrower(ctx, actor._id));
}

export async function listIncoming(ctx: QueryCtx, actor: UserDoc) {
  return hydrate(ctx, await requestModel.listByOwner(ctx, actor._id));
}

export async function listAllLoans(ctx: QueryCtx, actor: UserDoc) {
  if (!canViewAllLoans(actor)) throw forbidden("Admins only.");
  const loans = await requestModel.listLoans(ctx);
  loans.sort((a, b) => b._creationTime - a._creationTime);
  return hydrate(ctx, loans);
}
